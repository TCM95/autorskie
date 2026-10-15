// ==UserScript==
// @name         Klin z Cofki Ręczny
// @namespace    https://viayoo.com/
// @version      2.0
// @description  Planowanie klina z cofki – filtrowanie tylko ataków w przychodzących oraz licznik w formacie MM:SS.
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ───────────────────────── STAŁE ─────────────────────────
    const DAY = 86400000;
    const CANCEL_WINDOW_MS = 10 * 60 * 1000; // rozkaz można odwołać tylko ok. 10 min od wysłania
    const KEY_START = 'snip_start_time';
    const KEY_CMD = 'snip_cmd_id';
    const KEY_KNOWN = 'tcm_known_ids';

    // ───────────────────────── STYLE ─────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --bg-main: #36393f;
            --bg-row-alt: #32353b;
            --bg-header: #202225;
            --border-color: #3e4147;
            --text-color: white;
            --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
        }
        .shinko-btn-snipe {
            background: var(--btn-bg) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            padding: 4px 10px !important;
            margin-left: 6px !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important;
            transition: all 0.2s;
            touch-action: manipulation;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 36px;
            min-height: 30px;
        }
        .shinko-btn-snipe:hover { background: var(--btn-hover) !important; }
        .shinko-btn-active {
            background: var(--btn-red-bg) !important;
            border-color: #da3633 !important;
            color: #ffffff !important;
        }
        .shinko-btn-active:hover { background: var(--btn-red-hover) !important; }
        .shinko-timer-display {
            margin-left: 6px !important;
            font-weight: bold !important;
            font-family: monospace !important;
            font-size: 13px !important;
            padding: 3px 6px !important;
            background-color: var(--bg-header) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 3px !important;
            vertical-align: middle;
        }
        .tcm-manual-panel {
            background: var(--bg-main);
            border: 1px solid var(--border-color);
            margin: 10px 0 15px 0;
            padding: 10px;
            border-radius: 6px;
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: flex-start;
            flex-wrap: wrap;
            gap: 8px;
        }
        .tcm-manual-panel span.tcm-label {
            font-weight: bold;
            color: var(--title-color);
            font-size: 12px;
        }
        .tcm-manual-input {
            background: var(--bg-row-alt);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            padding: 6px;
            border-radius: 4px;
            width: 130px;
            text-align: center;
            font-family: monospace;
            font-size: 13px;
        }
        .tcm-input-auto { border-color: #5cad5c !important; }
    `;
    document.head.appendChild(style);

    // ───────────────────────── STORAGE ─────────────────────────
    const store = {
        get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
        del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
    };

    // ───────────────────────── LOGIKA CZASU (do reuse) ─────────────────────────
    const serverNow = () => Timing.getCurrentServerTime();

    // Przesunięcie strefy serwera względem UTC (zaokrąglone do 15 min),
    // wyznaczone z zegara #serverTime – niezależne od strefy przeglądarki.
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

    /**
     * Parsuje "HH:MM:SS[:ms]" na timestamp (ms) w czasie serwera.
     * past=true  → czas wysłania (zawsze w przeszłości)
     * past=false → czas celu (zawsze w przyszłości)
     * Rozumie słowa: dzisiaj / jutro / wczoraj.
     */
    function parseTime(text, { past = false } = {}) {
        if (!text) return null;
        const m = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/);
        if (!m) return null;

        const now = serverNow();
        const tz = getServerTzOffset(now);
        const nowSod = ((now + tz) % DAY + DAY) % DAY;
        const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
        const tSod = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + ms;

        let delta = tSod - nowSod;
        if (/jutro/i.test(text)) {
            delta += DAY;
        } else if (/wczoraj/i.test(text)) {
            delta -= DAY;
        } else if (/dzi[sś]/i.test(text)) {
            // dzisiaj – bez korekty
        } else if (past) {
            if (delta > 60000) delta -= DAY;
        } else {
            if (delta < -60000) delta += DAY;
        }
        return now + delta;
    }

    // Moment kliknięcia "anuluj" – wojsko wraca dokładnie na cel.
    const cancelAt = (startMs, targetMs) => startMs + (targetMs - startMs) / 2;

    function formatMsToTime(ms) {
        const d = new Date(ms + getServerTzOffset(serverNow()));
        const p = (n, l = 2) => String(n).padStart(l, '0');
        return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}:${p(d.getUTCMilliseconds(), 3)}`;
    }

    function formatCountdown(diffMs) {
        if (diffMs <= 0) return '00:00';
        const totalSeconds = Math.ceil(diffMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const pad = (n) => String(n).padStart(2, '0');
        if (minutes >= 60) {
            return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(seconds)}`;
        }
        return `${pad(minutes)}:${pad(seconds)}`;
    }

    // Udostępnienie logiki innym skryptom
    window.TCM_TIME = { parseTime, cancelAt, formatCountdown, formatMsToTime, getServerTzOffset };

    // ───────────────────────── ROZKAZY WYCHODZĄCE ─────────────────────────
    function getCommandId(row) {
        const cancel = row.querySelector('a.command-cancel');
        const candidates = [
            row.getAttribute('data-command-id'),
            cancel && cancel.getAttribute('data-id'),
            cancel && (cancel.getAttribute('href') || '').match(/[?&]id=(\d+)/)?.[1],
            row.querySelector('.quickedit[data-id]')?.getAttribute('data-id'),
            (row.querySelector('a[href*="info_command"]')?.getAttribute('href') || '').match(/[?&]id=(\d+)/)?.[1]
        ];
        return candidates.find(Boolean) || null;
    }

    function getOutgoingRows() {
        const table = document.querySelector('#commands_outgoings');
        return table ? Array.from(table.querySelectorAll('tr.command-row')) : [];
    }

    // Zapamiętuje, które rozkazy istniały przed wysłaniem, i po wysłaniu
    // wykrywa nowy rozkaz (to jego trzeba odwołać).
    function trackOutgoing() {
        const ids = getOutgoingRows().map(getCommandId).filter(Boolean);
        let known = [];
        try { known = JSON.parse(store.get(KEY_KNOWN) || '[]'); } catch (e) { known = []; }

        if (store.get(KEY_START) && !store.get(KEY_CMD)) {
            const fresh = ids.filter((id) => !known.includes(id));
            if (fresh.length) store.set(KEY_CMD, fresh[fresh.length - 1]);
        }
        store.set(KEY_KNOWN, JSON.stringify(ids));
    }

    function findCancelLink() {
        const rows = getOutgoingRows();
        const cmdId = store.get(KEY_CMD);

        if (cmdId) {
            const row = rows.find((r) => getCommandId(r) === cmdId);
            return row ? row.querySelector('a.command-cancel') : null;
        }
        // Brak zapisanego ID – bezpiecznie tylko gdy jest dokładnie jeden rozkaz
        if (rows.length === 1) return rows[0].querySelector('a.command-cancel');
        return null;
    }

    // ───────────────────────── SILNIK ─────────────────────────
    let timeoutId = null;
    let activeButton = null;
    let activeTimer = null;

    function stopCurrentSnipe() {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (activeButton) {
            activeButton.innerHTML = activeButton.dataset.originalText || '⚔️';
            activeButton.classList.remove('shinko-btn-active');
            activeButton = null;
        }
        if (activeTimer) {
            activeTimer.textContent = '';
            activeTimer.style.display = 'none';
            activeTimer = null;
        }
    }

    function startSnipeEngine(btnElement, timerElement, targetMs, customStartMs = null) {
        let startMs = customStartMs;
        if (!startMs) {
            const saved = store.get(KEY_START);
            if (saved) startMs = Number(saved);
        }

        if (!targetMs) {
            UI.ErrorMessage('Błędny czas celu. Format: HH:MM:SS:ms');
            return;
        }
        if (!startMs) {
            UI.ErrorMessage('Brak czasu wysłania! Wyślij wojsko lub wpisz czas wysłania ręcznie.');
            return;
        }
        if (targetMs <= startMs) {
            UI.ErrorMessage('Cel musi być później niż czas wysłania!');
            return;
        }

        const cancelTimeMs = cancelAt(startMs, targetMs);

        if (cancelTimeMs - startMs > CANCEL_WINDOW_MS) {
            UI.ErrorMessage('Cofka wypada później niż 10 min od wysłania – rozkazu nie da się już odwołać!');
            return;
        }
        if (cancelTimeMs <= serverNow()) {
            UI.ErrorMessage('Czas na anulowanie rozkazu już minął!');
            return;
        }

        btnElement.dataset.originalText = btnElement.innerHTML;
        activeButton = btnElement;
        activeTimer = timerElement;

        btnElement.innerHTML = '❌';
        btnElement.classList.add('shinko-btn-active');
        timerElement.style.display = 'inline-block';
        UI.SuccessMessage('Klin z cofki pomyślnie zaplanowany!');

        function tick() {
            const diff = cancelTimeMs - serverNow();

            if (diff <= 0) {
                timerElement.textContent = 'COFANIE...';
                timerElement.style.color = '#ff4444';

                const btnCancel = findCancelLink();
                if (btnCancel) {
                    btnCancel.click();
                    store.del(KEY_START);
                    store.del(KEY_CMD);
                } else {
                    UI.ErrorMessage('Nie znaleziono właściwego rozkazu do odwołania!');
                }

                btnElement.innerHTML = btnElement.dataset.originalText;
                btnElement.classList.remove('shinko-btn-active');
                activeButton = null;
                timeoutId = null;
                return;
            }

            timerElement.textContent = 'Cofka za: ' + formatCountdown(diff);
            timerElement.style.color = '#55ff55';

            // setTimeout działa także w tle (rAF się wtedy zatrzymuje)
            timeoutId = setTimeout(tick, Math.max(1, Math.min(200, diff)));
        }

        tick();
    }

    // ───────────────────────── STRONA POTWIERDZENIA ─────────────────────────
    if (window.location.href.includes('try=confirm')) {
        const confirmBtn = document.querySelector('#troop_confirm_submit, #troop_confirm_go');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                store.set(KEY_START, String(serverNow()));
                store.del(KEY_CMD);
            });
        }
        return;
    }

    // ───────────────────────── UI ─────────────────────────
    function setupManualUI() {
        if (document.querySelector('.tcm-manual-panel')) return;

        const outgoingTable = document.querySelector('#commands_outgoings');
        const mainContent = document.querySelector('#paged_view_content') || document.querySelector('.maincolumn');
        if (!outgoingTable && !mainContent) return;

        const manualPanel = document.createElement('div');
        manualPanel.className = 'tcm-manual-panel';

        const savedStart = store.get(KEY_START);
        const formattedStart = savedStart ? formatMsToTime(Number(savedStart)) : '';
        const autoClass = savedStart ? 'tcm-input-auto' : '';

        manualPanel.innerHTML = `
            <span class="tcm-label">Wysłano:</span>
            <input type="text" id="tcm_manual_start" class="tcm-manual-input ${autoClass}" placeholder="HH:MM:SS:ms" value="${formattedStart}">
            <span class="tcm-label">Cel:</span>
            <input type="text" id="tcm_manual_target" class="tcm-manual-input" placeholder="HH:MM:SS:ms">
            <button id="tcm_manual_btn" class="shinko-btn-snipe">⚔️</button>
            <span id="tcm_manual_timer" class="shinko-timer-display" style="display:none;"></span>
        `;

        if (outgoingTable) {
            outgoingTable.parentNode.insertBefore(manualPanel, outgoingTable);
        } else {
            mainContent.insertBefore(manualPanel, mainContent.firstChild);
        }

        const btn = document.getElementById('tcm_manual_btn');
        const inputStart = document.getElementById('tcm_manual_start');
        const inputTarget = document.getElementById('tcm_manual_target');
        const timer = document.getElementById('tcm_manual_timer');

        // Ręczna zmiana czasu wysłania = czas nie pochodzi już z automatu
        inputStart.addEventListener('input', () => inputStart.classList.remove('tcm-input-auto'));

        btn.addEventListener('click', (e) => {
            e.preventDefault();

            if (activeButton === btn) {
                stopCurrentSnipe();
                return;
            }

            stopCurrentSnipe();
            const startMs = parseTime(inputStart.value, { past: true });
            const targetMs = parseTime(inputTarget.value, { past: false });
            startSnipeEngine(btn, timer, targetMs, startMs);
        });
    }

    function setupRowButtons() {
        const incomingsTable = document.querySelector('#commands_incomings');
        if (!incomingsTable) return;

        incomingsTable.querySelectorAll('tr.command-row').forEach((row) => {
            if (row.dataset.tcmDone) return; // brak duplikatów po odświeżeniu AJAX

            // Pomijamy wsparcia – tylko ataki
            const img = row.querySelector('img[src*="graphic/command/"]');
            if (img && /support/i.test(img.src)) return;

            const nameCell = row.querySelector('td:first-child') || row.querySelector('td');
            if (!nameCell) return;

            row.dataset.tcmDone = '1';

            const btn = document.createElement('button');
            btn.type = 'button'; // tabela przychodzących jest w <form>
            btn.className = 'shinko-btn-snipe';
            btn.innerHTML = '⚔️';

            const timerDisplay = document.createElement('span');
            timerDisplay.className = 'shinko-timer-display';
            timerDisplay.style.display = 'none';

            nameCell.appendChild(btn);
            nameCell.appendChild(timerDisplay);

            btn.onclick = (e) => {
                e.preventDefault();

                if (activeButton === btn) {
                    stopCurrentSnipe();
                    return;
                }

                stopCurrentSnipe();

                const timeCell = row.querySelectorAll('td')[1];
                const targetText = timeCell ? timeCell.innerText : row.innerText;
                let targetMs = parseTime(targetText, { past: false });

                // Dokładniejsze źródło: data-endtime (epoch w sekundach) + ms z tekstu
                const endEl = row.querySelector('.widget-command-timer[data-endtime]');
                const msMatch = targetText.match(/\d{1,2}:\d{2}:\d{2}[:.](\d{1,3})/);
                if (endEl && msMatch) {
                    targetMs = Number(endEl.dataset.endtime) * 1000 + Number(msMatch[1].padEnd(3, '0'));
                }

                const manualStartInput = document.getElementById('tcm_manual_start');
                const startMs = manualStartInput ? parseTime(manualStartInput.value, { past: true }) : null;

                startSnipeEngine(btn, timerDisplay, targetMs, startMs);
            };
        });
    }

    // ───────────────────────── START ─────────────────────────
    function init() {
        trackOutgoing();
        setupManualUI();
        setupRowButtons();
    }

    if (window.location.href.includes('screen=place')) {
        init();

        // Gra potrafi przebudować tabelę przez AJAX – dopinamy przyciski ponownie
        const incomingsTable = document.querySelector('#commands_incomings');
        if (incomingsTable) {
            let pending = false;
            new MutationObserver(() => {
                if (pending) return;
                pending = true;
                setTimeout(() => {
                    pending = false;
                    setupRowButtons();
                }, 200);
            }).observe(incomingsTable, { childList: true, subtree: true });
        }
    }
})();
