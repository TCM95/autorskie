// ==UserScript==
// @name         Masowy Klin z Cofki
// @namespace    https://viayoo.com/
// @version      7.0
// @description  Wiele klinów naraz: numer przy wysyłce, wiązanie z konkretnym rozkazem, planowanie cofek pod wiele ataków.
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (typeof game_data === 'undefined') return;
    const VID = game_data.village.id;

    // ───────────────────────── USTAWIENIA ─────────────────────────
    const DAY = 86400000;
    const CANCEL_WINDOW_MS = 10 * 60 * 1000; // rozkaz można odwołać tylko ok. 10 min od wysłania
    const MIN_LEAD_MS = 300;                 // min. zapas czasu przed cofką
    const RETURN_OFFSET_MS = 0;              // o ile ms po ataku ma wrócić wojsko (0 = dokładnie w cel)
    const MAX_KLINS = 30;
    const PENDING_TTL_MS = 2 * 60 * 1000;
    const MISSED_GRACE_MS = 2000;

    // Klucze localStorage (osobno dla każdej wioski)
    const K = {
        klins: `tcm_klins_${VID}`,     // { num: { start, cmdId, ts } }
        plans: `tcm_plans_${VID}`,     // { incomingId: { num, cmdId, targetMs, cancelMs } }
        pending: `tcm_pending_${VID}`, // { num, start, ts } – wysłany, jeszcze bez ID rozkazu
        known: `tcm_known_${VID}`      // [ID rozkazów wychodzących sprzed wysłania]
    };

    const store = {
        read(k, fallback) {
            try {
                const v = localStorage.getItem(k);
                return v ? JSON.parse(v) : fallback;
            } catch (e) { return fallback; }
        },
        write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
        del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
    };

    // ───────────────────────── STYLE ─────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147; --text-color: white;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
        }
        .tcm-btn { background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); touch-action: manipulation; }
        .tcm-btn-active { background: var(--btn-red-bg) !important; border-color: #ff003c !important; }
        .tcm-select { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 4px; border-radius: 4px; font-size: 12px; }
        .tcm-panel { display: inline-flex; gap: 6px; align-items: center; margin-left: 10px; flex-wrap: wrap; }
        .tcm-timer { font-family: monospace; font-size: 13px; font-weight: bold; background: var(--bg-header); padding: 3px 6px; border-radius: 3px; border: 1px solid var(--border-color); }
        .tcm-tag { color: #ffffdf; font-weight: bold; background: #202225; padding: 2px 5px; border-radius: 3px; border: 1px solid var(--border-color); margin-right: 5px; }
    `;
    document.head.appendChild(style);

    // ───────────────────────── CZAS ─────────────────────────
    const serverNow = () => Timing.getCurrentServerTime();

    // Strefa serwera względem UTC (zaokr. do 15 min) z zegara #serverTime
    function getServerTzOffset(now) {
        const el = document.getElementById('serverTime');
        const m = el && el.textContent.match(/(\d{1,2}):(\d{2}):(\d{2})/);
        if (!m) return -new Date(now).getTimezoneOffset() * 60000;
        const utcSod = now % DAY;
        const dispSod = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + (now % 1000);
        let diff = dispSod - utcSod;
        diff = ((diff % DAY) + DAY + DAY / 2) % DAY - DAY / 2;
        return Math.round(diff / 900000) * 900000;
    }

    function formatWall(ms) {
        const d = new Date(ms + getServerTzOffset(serverNow()));
        const p = (n) => String(n).padStart(2, '0');
        return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
    }

    function formatCountdown(diffMs) {
        if (diffMs <= 0) return '00:00';
        const total = Math.ceil(diffMs / 1000);
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        const pad = (n) => String(n).padStart(2, '0');
        if (minutes >= 60) return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(seconds)}`;
        return `${pad(minutes)}:${pad(seconds)}`;
    }

    // Moment kliknięcia "anuluj": wojsko wraca na cel (+ ewentualne przesunięcie)
    const cancelAt = (startMs, targetMs) => startMs + (targetMs + RETURN_OFFSET_MS - startMs) / 2;

    function parseTargetText(text) {
        const m = (text || '').match(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/);
        if (!m) return null;
        const now = serverNow();
        const nowSod = (((now + getServerTzOffset(now)) % DAY) + DAY) % DAY;
        const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
        let delta = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + ms - nowSod;
        if (/jutro/i.test(text)) delta += DAY;
        else if (!/dzi[sś]/i.test(text) && delta < -60000) delta += DAY;
        return now + delta;
    }

    // Cel ataku: data-endtime (epoch, sekundy) + ms z tekstu; zapas: parser tekstu
    function getTargetMs(row) {
        const cell = row.querySelectorAll('td')[1];
        const text = cell ? cell.innerText : '';
        const end = row.querySelector('.widget-command-timer[data-endtime]');
        if (end) {
            const msM = text.match(/\d{1,2}:\d{2}:\d{2}[:.](\d{1,3})/);
            return Number(end.dataset.endtime) * 1000 + (msM ? Number(msM[1].padEnd(3, '0')) : 0);
        }
        return parseTargetText(text);
    }

    // ───────────────────────── DOM ─────────────────────────
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    const getOutRows = () => Array.from(document.querySelectorAll('#commands_outgoings tr.command-row'))
        .filter((r) => r.querySelector('a.command-cancel'));
    const getInRows = () => Array.from(document.querySelectorAll('#commands_incomings tr.command-row'));

    function getOutId(row) {
        const c = row.querySelector('a.command-cancel');
        if (!c) return null;
        return c.getAttribute('data-id')
            || ((c.getAttribute('href') || '').match(/[?&]id=(\d+)/) || [])[1]
            || null;
    }

    function getInId(row) {
        const a = row.querySelector('[data-command-id]');
        if (a) return a.getAttribute('data-command-id');
        const q = row.querySelector('.quickedit[data-id]');
        if (q) return q.getAttribute('data-id');
        const l = row.querySelector('a[href*="info_command"]');
        return l ? ((l.getAttribute('href') || '').match(/[?&]id=(\d+)/) || [])[1] || null : null;
    }

    function isAttackRow(row) {
        const t = row.querySelector('[data-command-type]');
        if (t && t.getAttribute('data-command-type') !== 'attack') return false;
        const imgs = row.querySelectorAll('img[src*="graphic/command/"]');
        return !Array.from(imgs).some((i) => /support|return/i.test(i.src));
    }

    // ───────────────────────── EKRAN POTWIERDZENIA ─────────────────────────
    if (window.location.href.includes('try=confirm')) {
        const confirmBtn = document.querySelector('#troop_confirm_submit, #troop_confirm_go');
        if (confirmBtn) {
            const klins = store.read(K.klins, {});
            const planned = new Set(Object.values(store.read(K.plans, {})).map((p) => String(p.num)));

            const panel = el('div', 'tcm-panel');
            panel.style.marginTop = '10px';
            const select = el('select', 'tcm-select');

            const def = el('option', '', '-- Zwykły atak (nie klin) --');
            def.value = '0';
            select.appendChild(def);

            for (let i = 1; i <= MAX_KLINS; i++) {
                const o = el('option', '', `Zapisz jako Klin #${i}`);
                o.value = String(i);
                if (planned.has(String(i))) {
                    o.disabled = true;
                    o.textContent += ' (zaplanowany)';
                } else if (klins[i]) {
                    o.textContent += ' (nadpisze)';
                }
                select.appendChild(o);
            }

            panel.appendChild(select);
            confirmBtn.parentElement.appendChild(panel);

            confirmBtn.addEventListener('click', () => {
                const v = select.value;
                if (v !== '0') store.write(K.pending, { num: v, start: serverNow(), ts: Date.now() });
                else store.del(K.pending);
            });
        }
        return;
    }

    // ───────────────────────── SYNCHRONIZACJA STANU (przy wczytaniu strony) ─────────────────────────
    function sync() {
        const now = serverNow();
        const outIds = getOutRows().map(getOutId).filter(Boolean);
        const inIds = getInRows().map(getInId).filter(Boolean);
        const klins = store.read(K.klins, {});
        const plans = store.read(K.plans, {});

        // 1) Powiązanie świeżo wysłanego klina z nowym rozkazem wychodzącym
        const pending = store.read(K.pending, null);
        if (pending) {
            if (Date.now() - pending.ts > PENDING_TTL_MS) {
                store.del(K.pending);
            } else {
                const known = store.read(K.known, null);
                const fresh = known ? outIds.filter((id) => !known.includes(id)) : (outIds.length === 1 ? outIds : []);
                if (fresh.length) {
                    klins[pending.num] = { start: pending.start, cmdId: fresh[fresh.length - 1], ts: pending.ts };
                    store.del(K.pending);
                    UI.SuccessMessage(`Zapisano Klin #${pending.num}`);
                }
            }
        }
        store.write(K.known, outIds);

        // 2) Sprzątanie klinów
        Object.keys(klins).forEach((num) => {
            const k = klins[num];
            const expired = now - k.start > CANCEL_WINDOW_MS + 5000;
            const gone = k.cmdId && !outIds.includes(String(k.cmdId));
            if (expired || gone) delete klins[num];
        });

        // 3) Sprzątanie planów (spóźnione, bez ataku lub bez klina)
        Object.keys(plans).forEach((incId) => {
            const p = plans[incId];
            if (!inIds.includes(String(incId)) || !klins[p.num]) {
                delete plans[incId];
            } else if (now - p.cancelMs > MISSED_GRACE_MS) {
                UI.ErrorMessage(`Klin #${p.num}: cofka przepadła (strona była zamknięta w tym momencie).`);
                delete plans[incId];
            }
        });

        store.write(K.klins, klins);
        store.write(K.plans, plans);
    }

    function pruneExpired() {
        const now = serverNow();
        const klins = store.read(K.klins, {});
        let changed = false;
        Object.keys(klins).forEach((num) => {
            if (now - klins[num].start > CANCEL_WINDOW_MS + 5000) {
                delete klins[num];
                changed = true;
            }
        });
        if (changed) store.write(K.klins, klins);
    }

    // ───────────────────────── RENDER ─────────────────────────
    const selected = {}; // zapamiętany wybór klina per atak
    let observer = null;
    let debounceId = null;

    function renderOutgoing() {
        const klins = store.read(K.klins, {});
        const plannedNums = new Set(Object.values(store.read(K.plans, {})).map((p) => String(p.num)));

        getOutRows().forEach((row) => {
            row.querySelectorAll('.tcm-tag').forEach((t) => t.remove());
            const id = getOutId(row);
            const num = Object.keys(klins).find((n) => String(klins[n].cmdId) === String(id));
            const cell = row.querySelector('td');
            if (num && cell) {
                const tag = el('span', 'tcm-tag', `[Klin #${num}${plannedNums.has(String(num)) ? ' ✓' : ''}]`);
                cell.insertBefore(tag, cell.firstChild);
            }
        });
    }

    function renderIncoming() {
        const now = serverNow();
        const klins = store.read(K.klins, {});
        const plans = store.read(K.plans, {});
        const outIds = getOutRows().map(getOutId).filter(Boolean).map(String);
        const usedNums = new Set(Object.values(plans).map((p) => String(p.num)));

        getInRows().forEach((row) => {
            row.querySelectorAll('.tcm-panel').forEach((p) => p.remove());
            if (!isAttackRow(row)) return;

            const incId = getInId(row);
            const cell = row.querySelector('td');
            if (!incId || !cell) return;

            const panel = el('div', 'tcm-panel');
            const plan = plans[incId];

            if (plan) {
                // ── atak z zaplanowaną cofką ──
                panel.appendChild(el('span', 'tcm-tag', `Klin #${plan.num}`));
                const timer = el('span', 'tcm-timer', 'Cofka za: ' + formatCountdown(plan.cancelMs - now));
                timer.dataset.inc = incId;
                timer.style.color = '#55ff55';
                panel.appendChild(timer);

                const stop = el('button', 'tcm-btn tcm-btn-active', '❌');
                stop.type = 'button';
                stop.onclick = (e) => {
                    e.preventDefault();
                    const cur = store.read(K.plans, {});
                    delete cur[incId];
                    store.write(K.plans, cur);
                    render();
                    schedule();
                };
                panel.appendChild(stop);
            } else {
                // ── atak bez planu: lista pasujących klinów ──
                const targetMs = getTargetMs(row);
                if (!targetMs) return;

                const options = Object.keys(klins)
                    .filter((n) => klins[n].cmdId && outIds.includes(String(klins[n].cmdId)) && !usedNums.has(String(n)))
                    .map((n) => ({ n, k: klins[n], cancel: cancelAt(klins[n].start, targetMs) }))
                    .filter((o) => targetMs > o.k.start
                        && o.cancel - o.k.start <= CANCEL_WINDOW_MS
                        && o.cancel > now + MIN_LEAD_MS)
                    .sort((a, b) => a.cancel - b.cancel);

                if (!options.length) return;

                const select = el('select', 'tcm-select');
                const def = el('option', '', 'Wybierz Klin...');
                def.value = '';
                select.appendChild(def);
                options.forEach((o) => {
                    const opt = el('option', '', `Klin #${o.n} · cofka ${formatWall(o.cancel)}`);
                    opt.value = o.n;
                    select.appendChild(opt);
                });
                if (selected[incId] && options.some((o) => o.n === selected[incId])) select.value = selected[incId];
                select.onchange = () => { selected[incId] = select.value; };

                const btn = el('button', 'tcm-btn', '⚔️');
                btn.type = 'button'; // tabela przychodzących jest w <form>
                btn.onclick = (e) => {
                    e.preventDefault();
                    planSnipe(row, incId, select.value);
                };

                panel.appendChild(select);
                panel.appendChild(btn);
            }

            cell.appendChild(panel);
        });
    }

    function render() {
        if (observer) observer.disconnect();
        try {
            pruneExpired();
            renderOutgoing();
            renderIncoming();
        } finally {
            observe();
        }
    }

    // ───────────────────────── PLANOWANIE ─────────────────────────
    function planSnipe(row, incId, num) {
        if (!num) {
            UI.ErrorMessage('Wybierz numer klina!');
            return;
        }
        const klins = store.read(K.klins, {});
        const plans = store.read(K.plans, {});
        const k = klins[num];

        if (!k || !k.cmdId) {
            UI.ErrorMessage('Ten klin nie ma przypisanego rozkazu.');
            render();
            return;
        }
        if (Object.values(plans).some((p) => String(p.num) === String(num))) {
            UI.ErrorMessage('Ten klin jest już użyty pod inny atak.');
            render();
            return;
        }

        const targetMs = getTargetMs(row);
        if (!targetMs || targetMs <= k.start) {
            UI.ErrorMessage('Błędny czas celu lub cel wcześniej niż wysyłka.');
            return;
        }
        const cancelMs = cancelAt(k.start, targetMs);
        if (cancelMs - k.start > CANCEL_WINDOW_MS) {
            UI.ErrorMessage('Cofka wypada później niż 10 min od wysłania – nie da się odwołać.');
            return;
        }
        if (cancelMs <= serverNow() + MIN_LEAD_MS) {
            UI.ErrorMessage('Czas na anulowanie klina pod ten atak już minął!');
            render();
            return;
        }

        plans[incId] = { num: String(num), cmdId: String(k.cmdId), targetMs, cancelMs };
        store.write(K.plans, plans);
        UI.SuccessMessage(`Klin #${num} zaplanowany pod wybrany atak!`);
        render();
        schedule();
    }

    // ───────────────────────── SCHEDULER ─────────────────────────
    let tickId = null;

    function updateTimer(incId, text, color) {
        const t = document.querySelector(`.tcm-timer[data-inc="${incId}"]`);
        if (t) {
            t.textContent = text;
            t.style.color = color;
        }
    }

    function fire(incId, late) {
        const plans = store.read(K.plans, {});
        const plan = plans[incId];
        if (!plan) return; // inna karta już odpaliła

        // "zajęcie" planu – chroni przed podwójnym kliknięciem z dwóch kart
        delete plans[incId];
        store.write(K.plans, plans);
        const klins = store.read(K.klins, {});
        delete klins[plan.num];
        store.write(K.klins, klins);

        updateTimer(incId, 'COFANIE...', '#ff4444');

        const row = getOutRows().find((r) => String(getOutId(r)) === String(plan.cmdId));
        const link = row && row.querySelector('a.command-cancel');
        if (link) {
            link.click();
            if (late > 500) UI.ErrorMessage(`Klin #${plan.num} cofnięty z opóźnieniem ${late} ms (karta w tle?).`);
            else UI.SuccessMessage(`Klin #${plan.num} cofnięty.`);
        } else {
            UI.ErrorMessage(`Klin #${plan.num}: nie znaleziono rozkazu do odwołania!`);
        }
        setTimeout(() => { render(); }, 800);
    }

    function tick() {
        tickId = null;
        const plans = store.read(K.plans, {});
        const now = serverNow();
        let next = Infinity;

        Object.keys(plans).forEach((incId) => {
            const diff = plans[incId].cancelMs - now;
            if (diff <= 0) {
                fire(incId, -diff);
                return;
            }
            updateTimer(incId, 'Cofka za: ' + formatCountdown(diff), '#55ff55');
            next = Math.min(next, diff);
        });

        // setTimeout działa także w tle (requestAnimationFrame się wtedy zatrzymuje)
        if (next < Infinity) tickId = setTimeout(tick, Math.max(1, Math.min(200, next)));
    }

    function schedule() {
        if (tickId) {
            clearTimeout(tickId);
            tickId = null;
        }
        tick();
    }

    // ───────────────────────── OBSERWACJA ZMIAN (AJAX) ─────────────────────────
    function relevant(rec) {
        return Array.from(rec.addedNodes).concat(Array.from(rec.removedNodes)).some((n) =>
            n.nodeType === 1
            && !n.closest('.tcm-panel, .tcm-tag')
            && (n.matches('tr.command-row, .commands-container, table') || n.querySelector('tr.command-row')));
    }

    function observe() {
        const root = document.getElementById('content_value') || document.body;
        if (!observer) {
            observer = new MutationObserver((records) => {
                if (!records.some(relevant)) return;
                clearTimeout(debounceId);
                debounceId = setTimeout(() => {
                    render();
                    schedule();
                }, 250);
            });
        }
        observer.observe(root, { childList: true, subtree: true });
    }

    // ───────────────────────── START ─────────────────────────
    sync();
    render();
    schedule();

    window.addEventListener('storage', (e) => {
        if (Object.values(K).includes(e.key)) {
            render();
            schedule();
        }
    });
})();
