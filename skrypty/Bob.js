// ==UserScript==
// @name         Kalkulator Budowy & Generator Szablonów
// @namespace    https://viayoo.com/
// @version      2.1
// @description  Zintegrowany system budowy, manualne szablony, ikona info, poprawiony UI
// @author       TCM (Wsparcie: Kipi955)
// @match        https://*.plemiona.pl/game.php?*screen=main*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    if (typeof $ === 'undefined' || typeof game_data === 'undefined') return;

    // --- SYSTEM UI (CSS ROOT) ---
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-main: #36393f;
            --bg-row-alt: #32353b;
            --bg-header: #202225;
            --border-color: #3e4147;
            --text-color: white;
            --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
        }
        #autoBuilderMain {
            background-color: var(--bg-main) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 4px;
            padding: 8px;
            margin: 10px 0;
            max-width: 360px;
            font-size: 12px;
        }
        #autoBuilderMain h4 { color: var(--title-color); margin: 0 0 8px 0; font-size: 13px; text-align: center; }
        .tcm-section-title { font-size: 11px; color: #aaa; text-transform: uppercase; margin: 10px 0 5px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 2px; display: flex; justify-content: space-between; align-items: center;}
        
        /* Wymuszenie czyszczenia stylów Plemion na nagłówkach w obrębie skryptu */
        #autoBuilderMain th, #autoBuilderMain .vis th {
            background-color: var(--bg-header) !important;
            background-image: none !important;
            border-bottom: 1px solid var(--border-color) !important;
            color: var(--title-color) !important;
        }

        #autoBuilderMain select, #autoBuilderMain input {
            background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color);
            padding: 3px; border-radius: 3px; max-width: 120px;
        }
        .tcm-btn {
            background: var(--btn-bg) !important; color: var(--text-color) !important;
            border: 1px solid var(--border-color) !important; padding: 5px 8px;
            border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 2px 1px; display: inline-block;
        }
        .tcm-btn:hover { background: var(--btn-hover) !important; color: var(--title-color) !important; }
        .tcm-btn-active { border-color: #4caf50 !important; color: #8bc34a !important; }
        .q-row-a { background-color: var(--bg-main); }
        .q-row-b { background-color: var(--bg-row-alt); }
        
        /* Popup Generatora */
        .tcm-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; justify-content:center; align-items:center; }
        .tcm-modal-content { background: var(--bg-main); width: 95%; max-width: 400px; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; color: var(--text-color); max-height: 85vh; overflow-y: auto; }
        .tcm-modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:5px; margin-bottom:10px; }
        .tcm-modal-header h3 { margin:0; font-size:14px; color:var(--title-color); }
        .tcm-instrukcja-line { padding: 4px; border-bottom: 1px dashed var(--border-color); font-size: 11px; color: #ccc; }
        
        #instrukcjeBtn { display:none; background:none; border:none; cursor:pointer; font-size:16px; padding:0 5px; color:#00bcd4; }
    `;
    document.head.appendChild(style);

    // --- ZMIENNE ---
    let buildingObject = { buildingQueue: [], buildingQueueLength: 5, status: false };
    let isBuilding = false;
    let isQueueMinimized = JSON.parse(localStorage.getItem('queueMinimized') || "false");
    let dynamicTranslateMap = {};
    let extractedInstructions = []; 

    const LINKS = {
        eko1: "https://raw.githubusercontent.com/Kipi955/sprawdzian/5a0309cbf24521ba89655119d9543c2d9942b88e/EKO1",
        eko2: "https://raw.githubusercontent.com/Kipi955/sprawdzian/refs/heads/main/EKO/Eko2"
    };
    const REVERSE_MAP = {
        "ratusz": "main", "koszary": "barracks", "stajnia": "stable", "warsztat": "garage", 
        "wieża strażnicza": "watchtower", "kuźnia": "smith", "rynek": "market", "tartak": "wood", 
        "cegielnia": "stone", "huta żelaza": "iron", "zagroda": "farm", "spichlerz": "storage",
        "schowek": "hide", "mur": "wall", "pałac": "snob"
    };
    const BUILDING_NAMES = Object.keys(REVERSE_MAP);

    function translate(code) { return dynamicTranslateMap[code] || code; }

    function updateLocalStorage() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        storage[game_data.village.id] = buildingObject;
        localStorage.setItem('buildingObject', JSON.stringify(storage));
    }

    function getInQueueCounts() {
        let inQueue = {};
        $('#buildqueue tr[class*="buildorder_"]').each(function() {
            const classList = $(this).attr('class').split(/\s+/);
            classList.forEach(c => {
                if (c.startsWith('buildorder_')) {
                    const bCode = c.replace('buildorder_', '');
                    inQueue[bCode] = (inQueue[bCode] || 0) + 1;
                }
            });
        });
        return inQueue;
    }

    function getEffectiveLevels() {
        const inQueueCounts = getInQueueCounts();
        let scriptQueueCounts = {};
        buildingObject.buildingQueue.forEach(item => {
            if (!item.includes('Aktywuj')) scriptQueueCounts[item] = (scriptQueueCounts[item] || 0) + 1;
        });

        let effLevels = {};
        if (typeof BuildingMain !== 'undefined' && BuildingMain.buildings) {
            for (let bCode in BuildingMain.buildings) {
                const b = BuildingMain.buildings[bCode];
                dynamicTranslateMap[bCode] = b.name; 
                const currentLevel = parseInt(b.level, 10) || 0;
                effLevels[bCode] = currentLevel + (inQueueCounts[bCode] || 0) + (scriptQueueCounts[bCode] || 0);
            }
        }
        return effLevels;
    }

    function updateSelectOptions() {
        const $select = $('#bSelect');
        if (!$select.length) return;
        const effLevels = getEffectiveLevels();
        let optionsHtml = '';
        
        if (typeof BuildingMain !== 'undefined' && BuildingMain.buildings) {
            for (let bCode in BuildingMain.buildings) {
                const b = BuildingMain.buildings[bCode];
                if (effLevels[bCode] !== undefined && effLevels[bCode] < b.max_level) {
                    optionsHtml += `<option value="${bCode}">${b.name}</option>`;
                }
            }
        }
        $select.html(optionsHtml);
    }

    function reloadQueueDisplay() {
        const table = $('#autoBuilderTable');
        if (!table.length) return;
        table.find('.q-row').remove();

        const inQueueCounts = getInQueueCounts();
        let simulatedLevels = {};
        for (let b in game_data.village.buildings) {
            simulatedLevels[b] = (parseInt(game_data.village.buildings[b], 10) || 0) + (inQueueCounts[b] || 0);
        }

        buildingObject.buildingQueue.forEach((b, i) => {
            const isBonus = b.includes('Aktywuj');
            let label = translate(b);

            if (!isBonus && simulatedLevels[b] !== undefined) {
                simulatedLevels[b]++;
                label += ` (${simulatedLevels[b]})`;
            }

            let row = `<tr class="q-row ${i % 2 === 0 ? 'q-row-a' : 'q-row-b'}" style="${isQueueMinimized ? 'display:none;' : ''}">
                <td style="padding: 4px; ${isBonus ? 'color: #ff9800; font-weight: bold;' : 'color: var(--text-color);'}">${label}</td>
                <td style="text-align:right; padding: 4px;">
                    <button class="tcm-btn q-action" data-type="up" data-idx="${i}">▲</button>
                    <button class="tcm-btn q-action" data-type="down" data-idx="${i}">▼</button>
                    <button class="tcm-btn q-action" data-type="del" data-idx="${i}" style="color: #f44336 !important;">X</button>
                </td>
            </tr>`;
            table.append(row);
        });
        updateSelectOptions();
    }

    // --- LOGIKA PARSERA ---
    function processTemplate(text) {
        let effLevels = getEffectiveLevels();
        let virtualSim = { ...effLevels };
        let addedCount = 0;
        extractedInstructions = [];

        const lines = text.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if(!trimmed) return;
            
            // Pomijanie konstrukcji tabeli i rzędów z kosztami/czasem z tabel bbcode
            if (trimmed.match(/^\[\/?table\]$/i) || trimmed.match(/^\[\*\*?\].*\[\/\*\*?\]$/i)) return;
            if (trimmed.startsWith('[|]')) return; 

            const tLower = trimmed.toLowerCase();
            const cleanText = trimmed.replace(/\[.*?\]/g, '').trim(); 

            const bKey = BUILDING_NAMES.find(name => tLower.includes(name));
            
            // Jesli zawiera budynek i słowa kluczowe (poziom/pzm) lub tag [building] (nawet uszkodzony)
            if (bKey && (tLower.includes('building') || tLower.includes('poziom') || tLower.includes('pzm'))) {
                
                // Zabezpieczenie przed wrzucaniem instrukcji do kolejki
                if(tLower.includes('szablon budowy') || tLower.includes('rekrutujemy')) {
                    if (cleanText.length > 3) extractedInstructions.push(cleanText);
                    return;
                }

                const gameCode = REVERSE_MAP[bKey];
                
                let targetLvl = null;
                const lvlMatch = cleanText.match(/(?:poziom|pzm\.?|lvl\.?)\s*(\d+)/i);
                if (lvlMatch) {
                    targetLvl = parseInt(lvlMatch[1], 10);
                } else {
                    const nums = cleanText.match(/\b([1-9]|[1-2][0-9]|30)\b/);
                    if (nums) targetLvl = parseInt(nums[1], 10);
                }
                
                let shouldAdd = false;
                if (targetLvl !== null) {
                    if (targetLvl > virtualSim[gameCode]) {
                        shouldAdd = true;
                        virtualSim[gameCode] = targetLvl;
                    }
                } else {
                    if (virtualSim[gameCode] < BuildingMain.buildings[gameCode].max_level) {
                        shouldAdd = true;
                        virtualSim[gameCode]++;
                    }
                }

                if (shouldAdd) {
                    buildingObject.buildingQueue.push(gameCode);
                    addedCount++;
                }
            } 
            else if (tLower.includes('aktywuj')) {
                if (cleanText) {
                    buildingObject.buildingQueue.push(cleanText);
                    addedCount++;
                }
            } 
            else {
                // Instrukcje i notatki z szablonu (pomijamy kreski puste linie)
                if (cleanText.length > 3 && !cleanText.match(/^[-\|\/\\]+$/)) {
                    extractedInstructions.push(cleanText);
                }
            }
        });

        if (addedCount > 0) {
            updateLocalStorage();
            reloadQueueDisplay();
            UI.SuccessMessage(`Dodano ${addedCount} poziomów z szablonu (pominięto już wybudowane).`);
        } else {
            UI.ErrorMessage("Nie dodano nic z szablonu - spełniasz już jego wymagania.");
        }
        
        if (extractedInstructions.length > 0) {
            $('#instrukcjeBtn').show();
            UI.InfoMessage("Wczytano nowe instrukcje do szablonu!");
        } else {
            $('#instrukcjeBtn').hide();
        }
    }

    function showInstructions() {
        const content = extractedInstructions.map(i => `<div class="tcm-instrukcja-line">🔹 ${i}</div>`).join('');
        $('#tcm-modal-inst').css('display', 'flex').find('#inst-content').html(content || '<div style="padding:10px; text-align:center;">Brak dodatkowych instrukcji.</div>');
    }

    function init() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        if (storage[game_data.village.id]) buildingObject = storage[game_data.village.id];

        let menuHtml = `
            <div id="autoBuilderMain">
                <h4>Bob</h4>
                
                <div class="tcm-section-title"> Menu</div>
                <table id="autoBuilderTable" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td colspan="2" style="padding-bottom: 6px; text-align:center;">
                            <button id="startBtn" class="tcm-btn ${buildingObject.status ? 'tcm-btn-active' : ''}">${buildingObject.status ? 'Stop' : 'Start'}</button>
                            <button id="clearQueueBtn" class="tcm-btn">Wyczyść</button>
                            <button id="addB10" class="tcm-btn">10%</button>
                            <button id="addB30" class="tcm-btn">30%</button>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0;">
                            <select id="bSelect"></select>
                            <button id="addBBtn" class="tcm-btn">Dodaj</button>
                        </td>
                        <td style="text-align:right; padding: 4px 0;">
                            Limit: <input id="qLenInput" type="number" value="${buildingObject.buildingQueueLength}" style="width:35px; text-align:center;">
                        </td>
                    </tr>
                    <tr>
                        <th colspan="2" style="padding: 4px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Kolejka</span>
                                <button id="toggleQueueBtn" class="tcm-btn" style="padding: 0 6px;">${isQueueMinimized ? '+' : '-'}</button>
                            </div>
                        </th>
                    </tr>
                </table>
                
                <div class="tcm-section-title" style="margin-top: 10px;">
                    <span>Szablon</span>
                    <button id="instrukcjeBtn" title="Pokaż notatki szablonu">ℹ️</button>
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
                    <button id="btn-eko1" class="tcm-btn" style="flex: 1 1 30%;">EKO SHADOW</button>
                    <button id="btn-eko2" class="tcm-btn" style="flex: 1 1 30%;">EKO 27 PAŁAC+</button>
                    <button id="btn-manual" class="tcm-btn" style="flex: 1 1 30%; color: #00bcd4 !important;">WŁASNY +</button>
                </div>
                
                <div id="manual-tpl-container" style="display:none; margin-top: 6px; flex-direction:column; gap:4px;">
                    <textarea id="manual-tpl-input" style="background:var(--bg-row-alt); color:var(--text-color); border:1px solid var(--border-color); width:95%; height:80px; font-size:11px; padding:4px;" placeholder="Wklej tutaj kod BBCode."></textarea>
                    <button id="btn-analyze-manual" class="tcm-btn" style="border-color:#00bcd4 !important;">Załaduj</button>
                </div>
            </div>
            
            <div id="tcm-modal-inst" class="tcm-modal">
                <div class="tcm-modal-content">
                    <div class="tcm-modal-header">
                        <h3>📜 Instrukcje</h3>
                        <button class="tcm-btn" onclick="$('#tcm-modal-inst').hide();" style="margin:0;">X</button>
                    </div>
                    <div id="inst-content"></div>
                </div>
            </div>`;

        $('#autoBuilderMain, #tcm-modal-inst').remove();
        $('#content_value').prepend(menuHtml);

        // --- Zdarzenia UI ---
        $('#clearQueueBtn').click(() => {
            if(confirm("Wyczyścić całą kolejkę?")) { buildingObject.buildingQueue = []; updateLocalStorage(); reloadQueueDisplay(); }
        });
        $('#addB10').click(() => { buildingObject.buildingQueue.push("Aktywuj 10% Wzmocnienie budowy na 24h"); updateLocalStorage(); reloadQueueDisplay(); });
        $('#addB30').click(() => { buildingObject.buildingQueue.push("Aktywuj 30% prędkości wydobycia na 48h"); updateLocalStorage(); reloadQueueDisplay(); });
        $('#addBBtn').click(() => { const v = $('#bSelect').val(); if(v) { buildingObject.buildingQueue.push(v); updateLocalStorage(); reloadQueueDisplay(); }});
        $('#startBtn').click(function() {
            buildingObject.status = !buildingObject.status;
            $(this).text(buildingObject.status ? "Stop" : "Start").toggleClass('tcm-btn-active', buildingObject.status);
            updateLocalStorage();
            if (buildingObject.status) runAutoBuild();
        });
        $('#toggleQueueBtn').click(function() {
            isQueueMinimized = !isQueueMinimized; localStorage.setItem('queueMinimized', JSON.stringify(isQueueMinimized));
            $(this).text(isQueueMinimized ? '+' : '-'); $('.q-row').toggle(!isQueueMinimized);
        });
        $('#autoBuilderTable').on('click', '.q-action', function() {
            const idx = $(this).data('idx'), type = $(this).data('type');
            if (type === 'del') buildingObject.buildingQueue.splice(idx, 1);
            else if (type === 'up' && idx > 0) [buildingObject.buildingQueue[idx-1], buildingObject.buildingQueue[idx]] = [buildingObject.buildingQueue[idx], buildingObject.buildingQueue[idx-1]];
            else if (type === 'down' && idx < buildingObject.buildingQueue.length - 1) [buildingObject.buildingQueue[idx+1], buildingObject.buildingQueue[idx]] = [buildingObject.buildingQueue[idx], buildingObject.buildingQueue[idx+1]];
            updateLocalStorage(); reloadQueueDisplay();
        });
        $('#qLenInput').on('change', function() { buildingObject.buildingQueueLength = parseInt($(this).val(), 10) || 5; updateLocalStorage(); });
        
        // Zdarzenia generatora
        $('#btn-eko1').click(() => { UI.InfoMessage("Pobieranie...", 1000); GM_xmlhttpRequest({ method: "GET", url: LINKS.eko1, onload: (r) => processTemplate(r.responseText) }); });
        $('#btn-eko2').click(() => { UI.InfoMessage("Pobieranie...", 1000); GM_xmlhttpRequest({ method: "GET", url: LINKS.eko2, onload: (r) => processTemplate(r.responseText) }); });
        $('#instrukcjeBtn').click(showInstructions);
        
        // Zdarzenia ręcznego wklejania
        $('#btn-manual').click(function() { $('#manual-tpl-container').toggle(); });
        $('#btn-analyze-manual').click(function() {
            const text = $('#manual-tpl-input').val();
            if (!text) return UI.ErrorMessage("Wklej najpierw kod w pole!");
            processTemplate(text);
            $('#manual-tpl-input').val('');
            $('#manual-tpl-container').hide();
        });

        reloadQueueDisplay();
        if (buildingObject.status) runAutoBuild();
        
        // Przywracanie ikony instrukcji po załadowaniu strony
        if(extractedInstructions.length > 0) $('#instrukcjeBtn').show();
    }

    function runAutoBuild() {
        if (!buildingObject.status || isBuilding) return;

        const $freeBtn = $('.btn-instant-free:visible');
        if ($freeBtn.length) {
            $freeBtn.click();
            setTimeout(runAutoBuild, 2000);
            return;
        }

        if (buildingObject.buildingQueue.length > 0) {
            let nextItem = buildingObject.buildingQueue[0];
            if (!nextItem.includes('Aktywuj')) {
                let currentQueue = $('#buildqueue tr[class*="buildorder_"]').length;
                if (currentQueue < buildingObject.buildingQueueLength) {
                    const $buildBtn = $(`.btn-build[data-building="${nextItem}"]`);
                    if ($buildBtn.length && $buildBtn.css('display') !== 'none') {
                        isBuilding = true;
                        buildAjax(nextItem);
                        return;
                    }
                }
            }
        }
        setTimeout(runAutoBuild, Math.floor(Math.random() * 1500) + 3500);
    }

    function buildAjax(bId) {
        $.ajax({
            url: `/game.php?village=${game_data.village.id}&screen=main&ajaxaction=upgrade_building&type=main&h=${game_data.csrf}`,
            type: "post",
            data: { id: bId, force: 1, destroy: 0, source: game_data.village.id },
            headers: { "TribalWars-Ajax": 1 }
        }).done(function(r) {
            let res = typeof r === "string" ? JSON.parse(r) : r;
            if (res.response && res.response.success) {
                buildingObject.buildingQueue.shift();
                updateLocalStorage();
                setTimeout(() => location.reload(), 1500);
            } else { isBuilding = false; }
        }).fail(() => { isBuilding = false; });
    }

    if (document.readyState === 'complete') init();
    else $(window).on('load', init);
})();
