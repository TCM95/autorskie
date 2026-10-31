/*
 * TCM BOB - moduł TECHNOLOGIE (osobny plik, ładowany przez skrypt budowy z linku w kodzie)
 *
 * Co robi:
 *  - zakładka z ikoną kuźni: lista technologii z ekranu kuźni (screen=smith) - zbadane / do zbadania,
 *    przycisk "Zbadaj" przy każdej dostępnej oraz "Odśwież";
 *  - wykonuje pozycje z listy budowy {t:'act', kind:'tech', units:{spear:1, ...}}: bada wskazane technologie
 *    (po kolei, z ponawianiem, gdy brakuje surowców / kuźnia jest zajęta / nie ma jeszcze kuźni).
 *    Pozycja znika z listy dopiero, gdy wszystkie wskazane technologie są zbadane lub rozpoczęte.
 *
 * Kontrakt z rdzeniem (window.TCM_BOB):
 *   api.run(item)  - jak wyżej (asynchronicznie). Zwraca {ok,msg} albo false (spróbuje ponownie).
 *   api.refresh()  - odświeża listę w zakładce.
 *
 * Badanie jest wysyłane w tle (POST na ekran kuźni), bo na ratuszu nie ma BuildingSmith.
 */
(function() {
    'use strict';

    const BOB = window.TCM_BOB;
    if (!BOB || typeof game_data === 'undefined' || typeof $ === 'undefined') return;
    if (BOB.modules && BOB.modules.tech) return; // już załadowany

    const CSS = `
        #tcm-panel-tech .th-head { background: var(--bg-header); color: var(--title-color); padding: 6px 8px; font-weight: bold; font-size: 12px; border-radius: 4px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        #tcm-panel-tech .th-list { margin-top: 6px; }
        #tcm-panel-tech .th-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-bottom: 1px dashed var(--border-color); }
        #tcm-panel-tech .th-row img { width: 22px; height: 22px; flex: none; }
        #tcm-panel-tech .th-name { flex: 1; font-size: 12px; }
        #tcm-panel-tech .th-ok { color: #6bbf6b; font-size: 11px; white-space: nowrap; }
        #tcm-panel-tech .th-wait { color: #aaa; font-size: 11px; white-space: nowrap; }
        #tcm-panel-tech .th-btn { padding: 5px 10px; font-weight: bold; font-size: 11px; cursor: pointer; background: var(--btn-green-bg); color: #fff; border: 1px solid var(--border-color); border-radius: 4px; white-space: nowrap; }
        #tcm-panel-tech .th-btn2 { padding: 4px 8px; font-size: 12px; cursor: pointer; background: var(--btn-bg); color: #fff; border: 1px solid var(--border-color); border-radius: 4px; }
        #tcm-panel-tech .th-info { margin-top: 6px; font-size: 10px; color: #aaa; }
    `;

    BOB.registerModule({
        id: 'tech',
        name: 'Technologie',
        icon: 'buildings/smith.png',
        panelWidth: 300,

        init: function(ctx) {
            const H = ctx.helpers;
            const sleep = ms => new Promise(r => setTimeout(r, ms));

            if (!document.getElementById('tcm-tech-style')) {
                const st = document.createElement('style');
                st.id = 'tcm-tech-style';
                st.innerHTML = CSS;
                document.head.appendChild(st);
            }

            const SMITH_URL = () => H.screenUrl('smith');
            const toast = (msg, isErr) => { try { isErr ? UI.ErrorMessage(msg, 4000) : UI.SuccessMessage(msg, 4000); } catch (e) { console.log('[Tech]', msg); } };

            // ---------- odczyt ekranu kuźni ----------
            async function loadSmith() {
                try {
                    const r = await fetch(SMITH_URL(), { credentials: 'same-origin' });
                    const html = await r.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    return doc.getElementById('tech_list') ? doc : null; // brak listy = brak kuźni
                } catch (e) { return null; }
            }

            function readTechs(doc) {
                const out = {};
                doc.querySelectorAll('#tech_list a.unit_link[data-unit]').forEach(a => {
                    const u = a.getAttribute('data-unit');
                    const label = a.textContent.trim();
                    if (out[u]) { if (!out[u].name && label) out[u].name = label; return; }
                    const box = a.closest('table.vis');
                    const btn = box ? box.querySelector('a.btn-research') : null;
                    const timeEl = btn ? btn.querySelector('span') : null;
                    out[u] = {
                        unit: u,
                        name: label,
                        canResearch: !!btn,
                        researched: !btn && /zbadane/i.test(box ? box.textContent : ''),
                        time: timeEl ? timeEl.textContent.trim() : ''
                    };
                });
                return out;
            }

            // ---------- badanie (POST w tle) ----------
            async function postResearch(unit) {
                try {
                    const url = SMITH_URL() + '&ajaxaction=research&h=' + game_data.csrf;
                    const r = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'tribalwars-ajax': '1',
                            'x-requested-with': 'XMLHttpRequest'
                        },
                        body: `tech_id=${unit}&source=${game_data.village.id}&h=${game_data.csrf}`,
                        credentials: 'same-origin'
                    });
                    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
                    let json = null;
                    try { json = await r.json(); } catch (e) { /* nie JSON */ }
                    if (!json) return { ok: false, error: 'odpowiedź nie jest JSON (zły format żądania?)' };
                    if (json.error) return { ok: false, error: String(json.error) };
                    return { ok: true, json: json };
                } catch (e) {
                    return { ok: false, error: String(e && e.message || e) };
                }
            }

            // ---------- panel (zakładka) ----------
            let lastTechs = null;
            function render() {
                let rows = '';
                if (!lastTechs) rows = '<div class="th-info">Brak danych z kuźni (nie ma kuźni albo nie udało się pobrać strony).</div>';
                else {
                    Object.keys(lastTechs).forEach(u => {
                        const t = lastTechs[u];
                        const state = t.researched ? '<span class="th-ok">✔ zbadane</span>'
                            : (t.canResearch ? `<button class="th-btn" data-unit="${u}">Zbadaj ${t.time ? '(' + H.esc(t.time) + ')' : ''}</button>`
                                             : '<span class="th-wait">niedostępne / w trakcie</span>');
                        rows += `<div class="th-row"><img src="${H.unitIcon(u)}" alt="${u}"><span class="th-name">${H.esc(t.name || u)}</span>${state}</div>`;
                    });
                }
                ctx.panel.html(`
                    <div class="th-head"><span>🔬 Technologie</span><button class="th-btn2" id="th-refresh">🔄</button></div>
                    <div class="th-list">${rows}</div>
                    <div class="th-info">Pozycje „Technologia” z listy budowy odpalają się tu same.</div>`);
            }

            async function refresh() {
                const doc = await loadSmith();
                lastTechs = doc ? readTechs(doc) : null;
                render();
                return lastTechs;
            }

            ctx.panel.on('click', '#th-refresh', () => refresh());
            ctx.panel.on('click', '.th-btn', async function() {
                const u = $(this).attr('data-unit');
                $(this).prop('disabled', true);
                const res = await postResearch(u);
                if (res.ok) toast('Technologia: rozpoczęto badanie (' + u + ').');
                else toast('Technologia: ' + res.error, true);
                await sleep(500);
                refresh();
            });

            render();
            refresh();

            // ---------- akcje z listy budowy ----------
            const progress = {}; // id pozycji -> {done:Set, tries:{}, next:{}, last}
            let running = false;

            async function run(item) {
                if (!item || item.kind !== 'tech') return false;
                const st = progress[item.id] || (progress[item.id] = { done: new Set(), tries: {}, next: {}, last: 0 });
                if (running || Date.now() - st.last < 30000) return false; // nie męczymy serwera
                st.last = Date.now();
                running = true;
                try {
                    const doc = await loadSmith();
                    if (!doc) return false; // brak kuźni - czekamy
                    let techs = readTechs(doc);
                    lastTechs = techs;
                    const wanted = Object.keys(item.units || {});
                    const started = [];

                    for (const u of wanted) {
                        if (st.done.has(u)) continue;
                        const t = techs[u];
                        if (!t) { st.done.add(u); continue; }             // tej technologii nie ma na tym świecie
                        if (t.researched) { st.done.add(u); continue; }
                        if (!t.canResearch) continue;                      // wymagania / kolejka / w trakcie - czekamy
                        if (Date.now() < (st.next[u] || 0)) continue;      // wycofanie po nieudanej próbie
                        const res = await postResearch(u);
                        if (res.ok) { st.done.add(u); started.push(u); st.tries[u] = 0; await sleep(700); }
                        else {
                            st.tries[u] = (st.tries[u] || 0) + 1;
                            st.next[u] = Date.now() + Math.min(600000, 20000 * Math.pow(2, st.tries[u]));
                            console.warn('[Tech] ' + u + ':', res.error);
                            if (st.tries[u] === 1 || st.tries[u] % 5 === 0) toast('Technologia ' + u + ': ' + res.error, true);
                        }
                    }

                    if (started.length) { // sprawdź, czy badanie faktycznie ruszyło (przycisk powinien zniknąć)
                        const doc2 = await loadSmith();
                        if (doc2) {
                            techs = readTechs(doc2);
                            lastTechs = techs;
                            started.forEach(u => { if (techs[u] && techs[u].canResearch) st.done.delete(u); });
                        }
                    }
                    render();

                    if (wanted.every(u => st.done.has(u))) {
                        delete progress[item.id];
                        return { ok: true, msg: 'Technologie: ' + (started.length ? 'rozpoczęto badanie (' + started.length + ').' : 'wszystko już zbadane.') };
                    }
                    return false;
                } finally {
                    running = false;
                }
            }

            return { run: run, refresh: refresh };
        }
    });
})();
