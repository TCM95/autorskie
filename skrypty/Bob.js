// ==UserScript==
// @name         Kalkulator budowy
// @namespace    https://viayoo.com/
// @version      4.0
// @description  Zintegrowany system budowy, szablony BB, notatki w kolejce, podgląd końcowy, auto-usuwanie zbudowanych
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=main*
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    if (typeof $ === 'undefined' || typeof game_data === 'undefined') return;

    let daneSwiata = {};
    if (typeof get_world_info === 'function') {
        try {
            daneSwiata = await get_world_info({ configs: ['config', 'building_info'], entities: { 'village': ['id', 'name', 'points'] } });
        } catch (e) {
            console.log("Brak Biblioteki Hermitowskiego. Praca w trybie ograniczonym.");
        }
    }

    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147;
            --text-color: white; --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --neon-green: #74ff00; --neon-glow: 0 0 8px rgba(116,255,0,.6), 0 0 15px rgba(116,255,0,.4);
        }
        #kalkulatorBudowyMain * { box-sizing: border-box !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }
        #kalkulatorBudowyMain { background-color: var(--bg-main) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; border-radius: 4px; padding: 8px; margin: 10px 0; max-width: 340px; font-size: 12px; }
        #kalkulatorBudowyMain h4 { color: var(--title-color); margin: 0 0 8px 0; font-size: 13px; text-align: center; display: flex; justify-content: center; align-items: center; gap: 10px; }
        #kalkulatorBudowyMain th { background: var(--bg-header) !important; background-image: none !important; color: var(--title-color) !important; border-bottom: 1px solid var(--border-color); }
        #kalkulatorBudowyMain select { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 4px; border-radius: 3px; font-size: 11px; }
        .tcm-btn { background: var(--btn-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; padding: 5px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold; margin: 2px 1px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.8); transition: all 0.2s ease; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
        .tcm-btn-active { border-color: var(--neon-green) !important; color: var(--neon-green) !important; text-shadow: var(--neon-glow); box-shadow: inset 0 0 5px rgba(116,255,0,.3); }
        .q-row-a { background-color: var(--bg-main); } .q-row-b { background-color: var(--bg-row-alt); }
        .q-current td { border-top: 1px solid var(--neon-green); border-bottom: 1px solid var(--neon-green); }
        .drag-handle { cursor: grab; font-size: 16px; color: #aaa; padding: 0 6px !important; user-select: none; }
        .drag-handle:active { cursor: grabbing; }
        .drag-over { border-top: 2px dashed var(--neon-green) !important; background-color: #171717 !important; }
        .q-note-text { color: #8fd3ff; font-style: italic; }
        #tcm-preview { margin-top: 8px; border: 1px solid var(--border-color); border-radius: 3px; padding: 4px; background: var(--bg-row-alt); }
        #tcm-preview .pv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
        #tcm-preview .pv-cell { display: flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid var(--border-color); border-radius: 3px; font-size: 10px; line-height: 1.2; opacity: .45; }
        #tcm-preview .pv-cell img { width: 24px; height: 24px; object-fit: contain; flex: none; }
        #tcm-preview .pv-up { opacity: 1; border-color: var(--neon-green); }
        #tcm-preview .pv-up .pv-lvl { color: var(--neon-green); font-weight: bold; }
    `;
    document.head.appendChild(style);

    let buildingObject = { buildingQueue: [], buildingQueueLength: 5, autoFarmLimit: 0, status: false, instructions: [] };
    let isBuilding = false;
    let expectedBuild = null;
    let isQueueMinimized = JSON.parse(localStorage.getItem('queueMinimized') || "false");
    let isPreviewOpen = JSON.parse(localStorage.getItem('previewOpen') || "false");

    const LINKS = {
        eko1: "https://raw.githubusercontent.com/Kipi955/sprawdzian/5a0309cbf24521ba89655119d9543c2d9942b88e/EKO1",
        eko2: "https://raw.githubusercontent.com/Kipi955/sprawdzian/main/EKO/Eko2"
    };

    const PL_NAMES = {
        "main": "Ratusz", "barracks": "Koszary", "stable": "Stajnia", "garage": "Warsztat",
        "watchtower": "Wieża strażnicza", "smith": "Kuźnia", "market": "Rynek", "wood": "Tartak",
        "stone": "Cegielnia", "iron": "Huta żelaza", "farm": "Zagroda", "storage": "Spichlerz",
        "hide": "Schowek", "wall": "Mur", "snob": "Pałac"
    };

    const MAX_LEVELS = {
        "main": 30, "barracks": 25, "stable": 20, "garage": 15, "watchtower": 20, "smith": 20,
        "market": 25, "wood": 30, "stone": 30, "iron": 30, "farm": 30, "storage": 30, "hide": 10, "wall": 20, "snob": 3
    };

    // Wzorce nazw (po usunięciu polskich znaków i zmniejszeniu liter) - obsługują odmiany
    const NAME_RX = {
        main: /ratusz/, barracks: /koszar/, stable: /stajn/, garage: /warsztat/,
        watchtower: /wiez\w*\s*straz|straznic/, smith: /kuzni/, market: /rynek|rynku/,
        wood: /tartak/, stone: /cegieln/, iron: /hut\w*\s*zelaz|\bhuta\b|\bhuty\b/,
        farm: /zagrod/, storage: /spichlerz/, hide: /schowek|schowk/, wall: /\bmur\b|\bmuru\b|\bmurze\b/, snob: /palac/
    };

    const norm = s => (s || '').replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esc = s => $('<div>').text(s).html();

    function maxLevel(b) {
        return (typeof BuildingMain !== 'undefined' && BuildingMain.buildings && BuildingMain.buildings[b] && BuildingMain.buildings[b].max_level)
            ? parseInt(BuildingMain.buildings[b].max_level, 10) : (MAX_LEVELS[b] || 30);
    }

    function updateLocalStorage() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        storage[game_data.village.id] = buildingObject;
        localStorage.setItem('buildingObject', JSON.stringify(storage));
    }

    // ---------- Poziomy ----------
    function getInQueueCounts() {
        let inQueue = {};
        $('#buildqueue tr[class*="buildorder_"]').each(function() {
            ($(this).attr('class') || '').split(/\s+/).forEach(c => {
                if (c.startsWith('buildorder_')) {
                    const bCode = c.replace('buildorder_', '');
                    inQueue[bCode] = (inQueue[bCode] || 0) + 1;
                }
            });
        });
        return inQueue;
    }

    // Poziom faktycznie zbudowany (max z kilku źródeł, bo game_data bywa nieaktualne po odświeżeniu AJAX)
    function builtLevel(b) {
        let lv = 0;
        const gb = game_data.village.buildings;
        if (gb && gb[b] !== undefined) lv = Math.max(lv, parseInt(gb[b], 10) || 0);
        if (typeof BuildingMain !== 'undefined' && BuildingMain.buildings && BuildingMain.buildings[b] && BuildingMain.buildings[b].level !== undefined) {
            lv = Math.max(lv, parseInt(BuildingMain.buildings[b].level, 10) || 0);
        }
        return lv;
    }

    // Poziom wraz z kolejką w grze
    function gameEffLevel(b, inQ) {
        inQ = inQ || getInQueueCounts();
        return builtLevel(b) + (inQ[b] || 0);
    }

    // Poziom po wykonaniu całej kolejki skryptu
    function projectedLevel(b, inQ) {
        let lv = gameEffLevel(b, inQ);
        buildingObject.buildingQueue.forEach(it => { if (it.t === 'b' && it.b === b && it.l > lv) lv = it.l; });
        return lv;
    }

    function firstActionIdx() {
        return buildingObject.buildingQueue.findIndex(it => it.t !== 'note');
    }

    // ---------- Migracja starego formatu kolejki ----------
    function normalizeQueue() {
        const inQ = getInQueueCounts();
        let sim = {};
        for (let b in PL_NAMES) sim[b] = gameEffLevel(b, inQ);
        buildingObject.buildingQueue = (buildingObject.buildingQueue || []).map(it => {
            if (it && typeof it === 'object') return it;
            if (typeof it === 'string') {
                if (it.includes('Aktywuj')) return { t: 'bonus', text: it };
                if (PL_NAMES[it]) { sim[it]++; return { t: 'b', b: it, l: sim[it] }; }
                return { t: 'note', text: it };
            }
            return null;
        }).filter(Boolean);
        if (buildingObject.instructions && buildingObject.instructions.length) {
            const notes = buildingObject.instructions.map(t => ({ t: 'note', text: t }));
            buildingObject.buildingQueue = notes.concat(buildingObject.buildingQueue);
        }
        buildingObject.instructions = [];
    }

    // Usuwa z kolejki skryptu pozycje, które są już zbudowane / w budowie (np. kliknięte ręcznie)
    function cleanupQueue() {
        const inQ = getInQueueCounts();
        let removed = 0;
        buildingObject.buildingQueue = buildingObject.buildingQueue.filter(it => {
            if (it.t !== 'b') return true;
            let done = it.l <= gameEffLevel(it.b, inQ);
            const nxt = parseInt($(`.btn-build[data-building="${it.b}"]`).first().attr('data-level-next'), 10);
            if (!isNaN(nxt) && nxt > it.l) done = true;
            if (done) removed++;
            return !done;
        });
        if (removed) {
            updateLocalStorage();
            reloadQueueDisplay();
            UI.InfoMessage(`Usunięto z kolejki (już zbudowane): ${removed}`, 2000);
        }
        return removed;
    }

    // ---------- UI: lista, wybór, podgląd ----------
    function updateSelectOptions() {
        const $select = $('#bSelect');
        if (!$select.length) return;
        const cur = $select.val();
        const inQ = getInQueueCounts();
        let html = '';
        for (let b in PL_NAMES) {
            html += `<option value="${b}">${PL_NAMES[b]} (${projectedLevel(b, inQ)}/${maxLevel(b)})</option>`;
        }
        $select.html(html);
        if (cur && $select.find(`option[value="${cur}"]`).length) $select.val(cur);
    }

    function iconSrc(b) {
        const s = $(`#main_buildrow_${b} img`).first().attr('src');
        if (s) return s;
        return (typeof image_base !== 'undefined' ? image_base : '/graphic/') + 'buildings/' + b + '.png';
    }

    function renderPreview() {
        const $p = $('#tcm-preview');
        if (!$p.length) return;
        if (!isPreviewOpen) { $p.hide(); return; }
        const inQ = getInQueueCounts();
        let steps = buildingObject.buildingQueue.filter(i => i.t === 'b').length;
        let cells = '';
        for (let b in PL_NAMES) {
            const cur = gameEffLevel(b, inQ);
            const fin = projectedLevel(b, inQ);
            const up = fin > cur;
            cells += `<div class="pv-cell ${up ? 'pv-up' : ''}">
                <img src="${iconSrc(b)}" alt="">
                <div><div>${PL_NAMES[b]}</div><div class="pv-lvl">${up ? cur + ' ➜ ' + fin : cur}</div></div>
            </div>`;
        }
        $p.html(`<div style="text-align:center; margin-bottom:4px; color:var(--title-color);">Stan końcowy po kolejce (${steps} rozbudów)</div><div class="pv-grid">${cells}</div>`).show();
    }

    function uruchomModulBonusow(url, bonusTekst) {
        console.log(`Wywołano moduł bonusów dla obiektu: ${bonusTekst}. Brak podpiętego linku.`);
        UI.InfoMessage("Oczekiwanie na aktywację modułu bonusów...", 2000);
    }

    function reloadQueueDisplay() {
        const table = $('#kalkulatorBudowyTabela');
        if (!table.length) return;
        table.find('.q-row').remove();
        const firstIdx = firstActionIdx();

        buildingObject.buildingQueue.forEach((it, i) => {
            const isBonus = it.t === 'bonus';
            const isNote = it.t === 'note';
            let label, labelStyle = 'color: var(--text-color);', extraBtns = '';

            if (isNote) {
                label = `🔹 ${esc(it.text)}`;
                labelStyle = '';
            } else if (isBonus) {
                label = esc(it.text);
                labelStyle = 'color: #ff9800; font-weight: bold;';
                extraBtns = `
                    <button class="tcm-btn q-action-wait" data-idx="${i}" title="Czekaj" style="background: var(--btn-blue-bg) !important;">⌛</button>
                    <button class="tcm-btn q-action-skip" data-idx="${i}" title="Pomiń" style="background: var(--btn-green-bg) !important;">▶</button>
                    <button class="tcm-btn q-action-modul" data-idx="${i}" title="Moduł" style="border-color:#00bcd4 !important;">M</button>`;
            } else {
                label = `${PL_NAMES[it.b] || it.b} (${it.l})`;
            }

            const cls = `q-row ${i % 2 === 0 ? 'q-row-a' : 'q-row-b'} ${i === firstIdx ? 'q-current' : ''}`;
            table.append(`<tr class="${cls}" data-idx="${i}" style="${isQueueMinimized ? 'display:none;' : ''}">
                <td class="drag-handle">☰</td>
                <td class="${isNote ? 'q-note-text' : ''}" style="padding: 4px; ${labelStyle} word-break: break-word;">${label}</td>
                <td style="text-align:right; padding: 4px; white-space: nowrap;">
                    ${extraBtns}
                    <button class="tcm-btn q-action" data-type="del" data-idx="${i}" style="background: var(--btn-red-bg) !important; border-color: #ff003c !important;">❌</button>
                </td>
            </tr>`);
        });
        updateSelectOptions();
        renderPreview();
    }

    // ---------- Parser szablonu (BB code / zwykły tekst) ----------
    function processTemplate(text) {
        const inQ = getInQueueCounts();
        let virtual = {};
        for (let b in PL_NAMES) virtual[b] = projectedLevel(b, inQ);
        let addedB = 0, addedN = 0, addedBonus = 0;

        const rows = String(text).replace(/\r/g, '')
            .replace(/\[\*\*\]/g, '\n[**]')
            .replace(/\[\*\]/g, '\n')
            .replace(/\[\/\*\*?\]/g, '\n')
            .replace(/\[\/?table\]/gi, '\n')
            .split('\n');

        rows.forEach(raw => {
            const row = raw.trim();
            if (!row || row.startsWith('[**]')) return; // nagłówek tabeli

            const cells = row.split(/\[\|{1,2}\]/).map(c => c.replace(/\[\/?[a-z*][^\]]*\]/gi, '').trim());
            const flat = cells.filter(Boolean).join(' ').trim();
            if (!flat || /^[-|\/\\\s]+$/.test(flat) || /^\d+$/.test(flat)) return;

            const nCells = cells.map(norm);
            const nFlat = norm(flat);

            if (nFlat.includes('aktywuj')) {
                buildingObject.buildingQueue.push({ t: 'bonus', text: flat });
                addedBonus++;
                return;
            }

            // znajdź wszystkie wzmianki o budynkach w wierszu (także kilka w jednym)
            let mentions = [];
            nCells.forEach((c, ci) => {
                for (const code in NAME_RX) {
                    const rx = new RegExp(NAME_RX[code].source, 'g');
                    let m;
                    while ((m = rx.exec(c))) mentions.push({ code, ci, start: m.index, end: m.index + m[0].length });
                }
            });
            mentions.sort((a, b) => a.ci - b.ci || a.start - b.start);

            if (!mentions.length || nFlat.includes('szablon budowy')) {
                if (!mentions.length && /^(lp|nr|budynek|poziom|lvl)(\s|$)/.test(nFlat)) return;
                if (flat.length > 3) {
                    buildingObject.buildingQueue.push({ t: 'note', text: flat });
                    addedN++;
                }
                return;
            }

            mentions.forEach(m => {
                const maxL = maxLevel(m.code);
                const nextSame = mentions.find(x => x.ci === m.ci && x.start > m.start);
                const seg = nCells[m.ci].slice(m.end, nextSame ? nextSame.start : undefined);
                let target = null;
                let lm = seg.match(/^[^\d]{0,12}?(\d{1,2})\b/);
                if (lm) target = parseInt(lm[1], 10);

                if (target === null && !nextSame) {
                    for (let cj = m.ci + 1; cj < nCells.length; cj++) {
                        if (mentions.some(x => x.ci === cj)) break;
                        if (nCells[cj].length <= 20) {
                            const cm = nCells[cj].match(/^[^\d]{0,12}?(\d{1,2})\b/);
                            if (cm) { target = parseInt(cm[1], 10); break; }
                        }
                    }
                }

                if (target !== null) {
                    target = Math.min(target, maxL);
                    for (let l = virtual[m.code] + 1; l <= target; l++) {
                        buildingObject.buildingQueue.push({ t: 'b', b: m.code, l });
                        addedB++;
                    }
                    if (target > virtual[m.code]) virtual[m.code] = target;
                } else if (virtual[m.code] < maxL) {
                    virtual[m.code]++;
                    buildingObject.buildingQueue.push({ t: 'b', b: m.code, l: virtual[m.code] });
                    addedB++;
                }
            });

            // wytyczne w tym samym wierszu (np. "Koszary 1 - rekrutujemy ...")
            if (nFlat.includes('rekrut')) {
                buildingObject.buildingQueue.push({ t: 'note', text: flat });
                addedN++;
            }
        });

        if (addedB + addedN + addedBonus > 0) {
            updateLocalStorage();
            reloadQueueDisplay();
            UI.SuccessMessage(`Dodano: budynki ${addedB}, bonusy ${addedBonus}, notatki ${addedN}.`);
        } else {
            UI.ErrorMessage("Nie dodano nic - spełniasz już wymagania lub błędny kod.");
        }
    }

    function fetchTemplate(url) {
        UI.InfoMessage("Pobieranie...", 1000);
        $.ajax({ url: url, type: 'GET', cache: false, dataType: 'text' })
        .done(text => processTemplate(text))
        .fail(() => UI.ErrorMessage("Wystąpił błąd podczas pobierania szablonu."));
    }

    function init() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        if (storage[game_data.village.id]) {
            buildingObject = { ...buildingObject, ...storage[game_data.village.id] };
            if (buildingObject.autoFarmLimit === undefined) buildingObject.autoFarmLimit = 0;
        }
        normalizeQueue();
        updateLocalStorage();

        let menuHtml = `
            <div id="kalkulatorBudowyMain">
                <h4>🛠️ BOB 🛠️<button id="previewBtn" class="tcm-btn" title="Podgląd stanu końcowego" style="margin:0; padding:2px 6px;">📊</button></h4>
                <table id="kalkulatorBudowyTabela" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td colspan="3" style="padding-bottom: 6px; text-align:center;">
                            <button id="startBtn" class="tcm-btn ${buildingObject.status ? 'tcm-btn-active' : ''}">${buildingObject.status ? '❎️ Stop' : '✅️ Start'}</button>
                            <button id="clearQueueBtn" class="tcm-btn">🗑️ Wyczyść</button>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding-bottom: 6px; text-align:center;">
                            <button id="addWWBtn" class="tcm-btn" style="color:#ff9800 !important;">Surowce 30%</button>
                            <button id="addWBBtn" class="tcm-btn" style="color:#00bcd4 !important;">Budowa 10%</button>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; width: 45%;">
                            <div style="display:flex; align-items:center; gap:2px;">
                                <select id="bSelect" style="flex:1; width:100%;"></select>
                                <button id="addBBtn" class="tcm-btn" style="font-size: 14px; padding: 4px 6px;">➕</button>
                            </div>
                        </td>
                        <td style="text-align:center; padding: 4px 0; font-size: 11px; white-space: nowrap;">
                            Zagr: <select id="farmLimitInput" style="width:45px; text-align:center; padding:2px;">
                                <option value="0" ${buildingObject.autoFarmLimit === 0 ? 'selected' : ''}>Wył</option>
                                <option value="5" ${buildingObject.autoFarmLimit === 5 ? 'selected' : ''}>5%</option>
                                <option value="10" ${buildingObject.autoFarmLimit === 10 ? 'selected' : ''}>10%</option>
                                <option value="15" ${buildingObject.autoFarmLimit === 15 ? 'selected' : ''}>15%</option>
                                <option value="20" ${buildingObject.autoFarmLimit === 20 ? 'selected' : ''}>20%</option>
                            </select>
                        </td>
                        <td style="text-align:right; padding: 4px 0; font-size: 11px; white-space: nowrap;">
                            Max: <select id="qLenInput" style="width:40px; text-align:center; padding:2px;">
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${n === buildingObject.buildingQueueLength ? 'selected' : ''}>${n}</option>`).join('')}
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th colspan="3" style="padding: 4px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Szablon / kolejka</span>
                                <button id="toggleQueueBtn" class="tcm-btn" style="padding: 2px 8px; font-size:14px;">${isQueueMinimized ? '🔽' : '🔼'}</button>
                            </div>
                        </th>
                    </tr>
                </table>

                <div id="tcm-preview" style="display:none;"></div>

                <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin-top: 10px;">
                    <button id="btn-eko1" class="tcm-btn" style="flex: 1 1 30%;">EKO</button>
                    <button id="btn-eko2" class="tcm-btn" style="flex: 1 1 30%;">EKO27</button>
                    <button id="btn-manual" class="tcm-btn" style="flex: 1 1 30%; color: #00bcd4 !important;">WŁASNY</button>
                </div>

                <div id="manual-tpl-container" style="display:none; margin-top: 6px; flex-direction:column; gap:4px;">
                    <textarea id="manual-tpl-input" style="background:var(--bg-row-alt); color:var(--text-color); border:1px solid var(--border-color); width:100%; height:80px; font-size:11px; padding:4px;" placeholder="Wklej tutaj szablon (BB code)"></textarea>
                    <button id="btn-analyze-manual" class="tcm-btn" style="border-color:#00bcd4 !important;">Importuj</button>
                </div>
            </div>`;

        $('#kalkulatorBudowyMain').remove();
        $('#content_value').prepend(menuHtml);

        $('#clearQueueBtn').click(() => {
            if (confirm("Wyczyścić kolejkę oraz notatki?")) {
                buildingObject.buildingQueue = [];
                updateLocalStorage();
                reloadQueueDisplay();
            }
        });

        $('#previewBtn').click(() => {
            isPreviewOpen = !isPreviewOpen;
            localStorage.setItem('previewOpen', JSON.stringify(isPreviewOpen));
            renderPreview();
        });

        $('#addWWBtn').click(() => { buildingObject.buildingQueue.push({ t: 'bonus', text: "Aktywuj Surowce 30%" }); updateLocalStorage(); reloadQueueDisplay(); });
        $('#addWBBtn').click(() => { buildingObject.buildingQueue.push({ t: 'bonus', text: "Aktywuj Budowa 10%" }); updateLocalStorage(); reloadQueueDisplay(); });

        $('#addBBtn').click(() => {
            const v = $('#bSelect').val();
            if (!v) return;
            const next = projectedLevel(v) + 1;
            if (next > maxLevel(v)) {
                UI.ErrorMessage(`Osiągnięto maksymalny poziom dla: ${PL_NAMES[v]}`);
                return;
            }
            buildingObject.buildingQueue.push({ t: 'b', b: v, l: next });
            updateLocalStorage();
            reloadQueueDisplay();
        });

        $('#startBtn').click(function() {
            buildingObject.status = !buildingObject.status;
            $(this).text(buildingObject.status ? "❎️ Stop" : "✅️ Start").toggleClass('tcm-btn-active', buildingObject.status);
            updateLocalStorage();
            if (buildingObject.status) uruchomBudowe();
        });

        $('#toggleQueueBtn').click(function() {
            isQueueMinimized = !isQueueMinimized; localStorage.setItem('queueMinimized', JSON.stringify(isQueueMinimized));
            $(this).text(isQueueMinimized ? '🔽' : '🔼'); $('.q-row').toggle(!isQueueMinimized);
        });

        $('#farmLimitInput').on('change', function() {
            buildingObject.autoFarmLimit = parseInt($(this).val(), 10) || 0;
            updateLocalStorage();
        });

        $('#qLenInput').on('change', function() { buildingObject.buildingQueueLength = parseInt($(this).val(), 10) || 5; updateLocalStorage(); });

        $('#kalkulatorBudowyTabela').on('click', '.q-action-wait', function() {
            buildingObject.status = false;
            $('#startBtn').text("✅️ Start").removeClass('tcm-btn-active');
            updateLocalStorage();
            UI.InfoMessage("Kolejka wstrzymana na bonusie.");
        });

        $('#kalkulatorBudowyTabela').on('click', '.q-action-skip', function() {
            buildingObject.buildingQueue.splice($(this).data('idx'), 1);
            updateLocalStorage();
            reloadQueueDisplay();
            if (buildingObject.status) uruchomBudowe();
        });

        $('#kalkulatorBudowyTabela').on('click', '.q-action-modul', function() {
            const it = buildingObject.buildingQueue[$(this).data('idx')];
            uruchomModulBonusow("TUTAJ_ZMIENISZ_LINK", it ? it.text : '');
        });

        $('#kalkulatorBudowyTabela').on('click', '.q-action', function() {
            if ($(this).data('type') === 'del') {
                buildingObject.buildingQueue.splice($(this).data('idx'), 1);
                updateLocalStorage(); reloadQueueDisplay();
            }
        });

        let dragIdx = -1, dragEl = null;
        $('#kalkulatorBudowyTabela').on('touchstart', '.drag-handle', function(e) {
            dragEl = $(this).closest('.q-row');
            dragIdx = dragEl.data('idx');
            dragEl.css({opacity: '0.4', background: 'var(--bg-row-alt)'});
        }).on('touchmove', '.drag-handle', function(e) {
            e.preventDefault();
            let touch = e.originalEvent.changedTouches[0];
            let target = document.elementFromPoint(touch.clientX, touch.clientY);
            $('.q-row').removeClass('drag-over');
            let targetTr = $(target).closest('.q-row');
            if (targetTr.length && targetTr.data('idx') !== dragIdx) targetTr.addClass('drag-over');
        }).on('touchend', '.drag-handle', function(e) {
            if (dragEl) dragEl.css({opacity: '1', background: ''});
            $('.q-row').removeClass('drag-over');
            let touch = e.originalEvent.changedTouches[0];
            let target = document.elementFromPoint(touch.clientX, touch.clientY);
            let targetTr = $(target).closest('.q-row');
            if (targetTr.length) {
                let targetIdx = targetTr.data('idx');
                if (dragIdx !== targetIdx && targetIdx !== undefined) {
                    let item = buildingObject.buildingQueue.splice(dragIdx, 1)[0];
                    buildingObject.buildingQueue.splice(targetIdx, 0, item);
                    updateLocalStorage(); reloadQueueDisplay();
                }
            }
            dragEl = null; dragIdx = -1;
        });

        $('#btn-eko1').click(() => fetchTemplate(LINKS.eko1));
        $('#btn-eko2').click(() => fetchTemplate(LINKS.eko2));

        $('#btn-manual').click(() => $('#manual-tpl-container').toggle());
        $('#btn-analyze-manual').click(() => {
            const text = $('#manual-tpl-input').val();
            if (!text) return UI.ErrorMessage("Wklej najpierw kod w pole!");
            processTemplate(text);
            $('#manual-tpl-input').val('');
            $('#manual-tpl-container').hide();
        });

        cleanupQueue();
        reloadQueueDisplay();
        if (buildingObject.status) uruchomBudowe();
    }

    // Nasłuchiwacz odpowiedzi serwera na akcje wbudowane w grę
    $(document).ajaxSuccess(function(event, xhr, settings, data) {
        if (settings.url && settings.url.includes('ajaxaction=upgrade_building') && expectedBuild) {
            if (data && data.response && data.response.success) {
                const i = buildingObject.buildingQueue.findIndex(x => x === expectedBuild || (x.t === 'b' && x.b === expectedBuild.b && x.l === expectedBuild.l));
                if (i > -1) buildingObject.buildingQueue.splice(i, 1);
                updateLocalStorage();
                reloadQueueDisplay();
                expectedBuild = null;
                isBuilding = false;
                setTimeout(uruchomBudowe, Math.floor(Math.random() * 1000) + 2000);
            } else {
                isBuilding = false;
                expectedBuild = null;
            }
        }
    });

    $(document).ajaxError(function(event, xhr, settings) {
        if (settings.url && settings.url.includes('ajaxaction=upgrade_building') && expectedBuild) {
            isBuilding = false;
            expectedBuild = null;
        }
    });

    function uruchomBudowe() {
        if (!buildingObject.status || isBuilding) return;

        const $freeBtn = $('.btn-instant-free:visible');
        if ($freeBtn.length) {
            $freeBtn.click();
            setTimeout(uruchomBudowe, Math.floor(Math.random() * 1000) + 2500);
            return;
        }

        // Usuń to, co już zbudowane (np. kliknięte ręcznie)
        cleanupQueue();

        // Auto-zagroda
        if (buildingObject.autoFarmLimit > 0) {
            let currentPop = parseInt($('#pop_current_label').text(), 10);
            let maxPop = parseInt($('#pop_max_label').text(), 10);
            if (!isNaN(currentPop) && !isNaN(maxPop) && maxPop > 0) {
                let freePopPercent = ((maxPop - currentPop) / maxPop) * 100;
                if (freePopPercent <= buildingObject.autoFarmLimit) {
                    const inQ = getInQueueCounts();
                    const fi = firstActionIdx();
                    const head = fi > -1 ? buildingObject.buildingQueue[fi] : null;
                    if ((inQ['farm'] || 0) === 0 && !(head && head.t === 'b' && head.b === 'farm')) {
                        const nextFarm = gameEffLevel('farm', inQ) + 1;
                        if (nextFarm <= maxLevel('farm')) {
                            buildingObject.buildingQueue.splice(Math.max(fi, 0), 0, { t: 'b', b: 'farm', l: nextFarm });
                            updateLocalStorage();
                            reloadQueueDisplay();
                            UI.SuccessMessage("Dodano zagrodę na początek kolejki (brak wolnego miejsca).");
                        }
                    }
                }
            }
        }

        const idx = firstActionIdx();
        if (idx > -1) {
            const next = buildingObject.buildingQueue[idx];
            if (next.t === 'bonus') {
                buildingObject.status = false;
                $('#startBtn').text("✅️ Start").removeClass('tcm-btn-active');
                updateLocalStorage();
                UI.InfoMessage("Wymagana akcja ręczna na bonusie", 2000);
                return;
            }
            let currentQueue = $('#buildqueue tr[class*="buildorder_"]').length;
            if (currentQueue < buildingObject.buildingQueueLength) {
                const $buildBtn = $(`.btn-build[data-building="${next.b}"]`);
                if ($buildBtn.length && $buildBtn.css('display') !== 'none') {
                    isBuilding = true;
                    buildAjax(next);
                    return;
                }
            }
        }
        setTimeout(uruchomBudowe, Math.floor(Math.random() * 1500) + 3500);
    }

    function buildAjax(item) {
        expectedBuild = item;
        const $btn = $(`.btn-build[data-building="${item.b}"]`);
        if ($btn.length) {
            // Kliknięcie natywnego przycisku gry - gra sama zrobi AJAX i odświeży UI
            $btn[0].click();
        } else {
            isBuilding = false;
            expectedBuild = null;
        }
    }

    if (document.readyState === 'complete') init();
    else $(window).on('load', init);
})();
