// ==UserScript==
// @name         Kalkulator Budowy
// @namespace    https://viayoo.com/
// @version      3.2
// @description  Zintegrowany system budowy, szablony, notatki, przygotowany interfejs bonusów
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
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
            --neon-green: #74ff00; --neon-glow: 0 0 8px rgba(116,255,0,.6), 0 0 15px rgba(116,255,0,.4);
        }
        #kalkulatorBudowyMain * { box-sizing: border-box !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }
        #kalkulatorBudowyMain { background-color: var(--bg-main) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; border-radius: 4px; padding: 8px; margin: 10px 0; max-width: 320px; font-size: 12px; }
        #kalkulatorBudowyMain h4 { color: var(--title-color); margin: 0 0 8px 0; font-size: 13px; text-align: center; display: flex; justify-content: center; align-items: center; gap: 10px; }
        #kalkulatorBudowyMain th { background: var(--bg-header) !important; background-image: none !important; color: var(--title-color) !important; border-bottom: 1px solid var(--border-color); }
        #kalkulatorBudowyMain select { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 4px; border-radius: 3px; font-size: 13px; }
        .tcm-btn { background: var(--btn-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; padding: 5px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold; margin: 2px 1px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.8); transition: all 0.2s ease; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
        .tcm-btn-active { border-color: var(--neon-green) !important; color: var(--neon-green) !important; text-shadow: var(--neon-glow); box-shadow: inset 0 0 5px rgba(116,255,0,.3); }
        .q-row-a { background-color: var(--bg-main); } .q-row-b { background-color: var(--bg-row-alt); }
        .drag-handle { cursor: grab; font-size: 16px; color: #aaa; padding: 0 6px !important; user-select: none; }
        .drag-handle:active { cursor: grabbing; }
        .drag-over { border-top: 2px dashed var(--neon-green) !important; background-color: #171717 !important; }
        .tcm-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; justify-content:center; align-items:center; }
        .tcm-modal-content { background: var(--bg-main); width: 95%; max-width: 400px; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; color: var(--text-color); }
        .tcm-modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:5px; margin-bottom:5px; }
        .tcm-modal-header h3 { margin:0; font-size:14px; color:var(--title-color); }
        .tcm-modal-body { max-height: 60vh; overflow-y: auto; padding-right: 5px; }
        .tcm-instrukcja-line { padding: 6px 4px; border-bottom: 1px dashed var(--border-color); font-size: 11px; color: #ccc; }
        #instrukcjeBtn { display:none; background:none; border:none; cursor:pointer; font-size:16px; padding:0; color:#00bcd4; margin:0; box-shadow:none; }
    `;
    document.head.appendChild(style);

    let buildingObject = { buildingQueue: [], buildingQueueLength: 5, status: false, instructions: [] };
    let isBuilding = false;
    let isQueueMinimized = JSON.parse(localStorage.getItem('queueMinimized') || "false");

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

    const REVERSE_MAP = {
        "ratusz": "main", "koszary": "barracks", "stajnia": "stable", "warsztat": "garage", 
        "wieża strażnicza": "watchtower", "kuźnia": "smith", "rynek": "market", "tartak": "wood", 
        "cegielnia": "stone", "huta żelaza": "iron", "zagroda": "farm", "spichlerz": "storage",
        "schowek": "hide", "mur": "wall", "pałac": "snob"
    };
    const BUILDING_NAMES = Object.keys(REVERSE_MAP);

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
            if (typeof item === 'string' && !item.includes('Aktywuj')) {
                scriptQueueCounts[item] = (scriptQueueCounts[item] || 0) + 1;
            }
        });
        let effLevels = {};
        for (let bCode in PL_NAMES) {
            let currentLevel = 0;
            if (game_data.village.buildings && game_data.village.buildings[bCode]) {
                currentLevel = parseInt(game_data.village.buildings[bCode], 10);
            }
            effLevels[bCode] = currentLevel + (inQueueCounts[bCode] || 0) + (scriptQueueCounts[bCode] || 0);
        }
        return effLevels;
    }

    function updateSelectOptions() {
        const $select = $('#bSelect');
        if (!$select.length) return;
        
        const obecnyWybór = $select.val();
        let optionsHtml = '';
        
        // Zawsze renderuje pełną listę 15 budynków, niezależnie od stanu wioski
        for (let bCode in PL_NAMES) {
            optionsHtml += `<option value="${bCode}">${PL_NAMES[bCode]}</option>`;
        }
        $select.html(optionsHtml);
        
        if (obecnyWybór && $select.find(`option[value="${obecnyWybór}"]`).length) {
            $select.val(obecnyWybór);
        }
    }

    function uruchomModulBonusow(url, bonusTekst) {
        console.log(`Wywołano moduł bonusów dla obiektu: ${bonusTekst}. Brak podpiętego linku.`);
        UI.InfoMessage("Oczekiwanie na aktywację modułu bonusów...", 2000);
    }

    function reloadQueueDisplay() {
        const table = $('#kalkulatorBudowyTabela');
        if (!table.length) return;
        table.find('.q-row').remove();

        const inQueueCounts = getInQueueCounts();
        let simulatedLevels = {};
        for (let b in PL_NAMES) {
            simulatedLevels[b] = (parseInt((game_data.village.buildings || {})[b], 10) || 0) + (inQueueCounts[b] || 0);
        }

        buildingObject.buildingQueue.forEach((b, i) => {
            const isBonus = typeof b === 'string' && b.includes('Aktywuj');
            let label = PL_NAMES[b] || b;

            if (!isBonus && simulatedLevels[b] !== undefined) {
                simulatedLevels[b]++;
                label += ` (${simulatedLevels[b]})`;
            }

            let extraBtns = '';
            if (isBonus) {
                extraBtns = `
                    <button class="tcm-btn q-action-wait" data-idx="${i}" title="Czekaj" style="background: var(--btn-blue-bg) !important;">⌛</button>
                    <button class="tcm-btn q-action-skip" data-idx="${i}" title="Pomiń" style="background: var(--btn-green-bg) !important;">▶</button>
                    <button class="tcm-btn q-action-modul" data-idx="${i}" title="Moduł" style="border-color:#00bcd4 !important;">M</button>
                `;
            }

            let row = `<tr class="q-row ${i % 2 === 0 ? 'q-row-a' : 'q-row-b'}" data-idx="${i}" style="${isQueueMinimized ? 'display:none;' : ''}">
                <td class="drag-handle">☰</td>
                <td style="padding: 4px; ${isBonus ? 'color: #ff9800; font-weight: bold;' : 'color: var(--text-color);'} word-break: break-word;">${label}</td>
                <td style="text-align:right; padding: 4px; white-space: nowrap;">
                    ${extraBtns}
                    <button class="tcm-btn q-action" data-type="del" data-idx="${i}" style="background: var(--btn-red-bg) !important; border-color: #ff003c !important;">❌</button>
                </td>
            </tr>`;
            table.append(row);
        });
        updateSelectOptions();
    }

    function processTemplate(text) {
        let effLevels = getEffectiveLevels();
        let virtualSim = { ...effLevels };
        let addedCount = 0;
        let localInstructions = [];

        const lines = text.replace(/\r\n/g, '\n').split('\n');
        lines.forEach(line => {
            const trimmed = line.trim();
            if(!trimmed) return;
            if (trimmed.match(/^\[\/?table\]$/i) || trimmed.match(/^\[\*\*?\].*\[\/\*\*?\]$/i)) return;
            if (trimmed.startsWith('[|]')) return; 

            const tLower = trimmed.toLowerCase();
            const cleanText = trimmed.replace(/\[.*?\]/g, '').trim(); 
            const bKey = BUILDING_NAMES.find(name => tLower.includes(name));

            if (bKey) {
                if(tLower.includes('szablon budowy') || tLower.includes('rekrutujemy')) {
                    if (cleanText.length > 3) localInstructions.push(cleanText);
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
                    const maxLvl = (typeof BuildingMain !== 'undefined' && BuildingMain.buildings && BuildingMain.buildings[gameCode]) ? BuildingMain.buildings[gameCode].max_level : (MAX_LEVELS[gameCode] || 30);
                    if (virtualSim[gameCode] < maxLvl) {
                        shouldAdd = true;
                        virtualSim[gameCode]++;
                    }
                }
                if (shouldAdd) {
                    buildingObject.buildingQueue.push(gameCode);
                    addedCount++;
                }
            } else if (tLower.includes('aktywuj')) {
                if (cleanText) {
                    buildingObject.buildingQueue.push(cleanText);
                    addedCount++;
                }
            } else {
                if (cleanText.length > 3 && !cleanText.match(/^[-\|\/\\]+$/)) {
                    localInstructions.push(cleanText);
                }
            }
        });

        if (localInstructions.length > 0) {
            buildingObject.instructions = [...buildingObject.instructions, ...localInstructions];
        }
        if (addedCount > 0) {
            updateLocalStorage();
            reloadQueueDisplay();
            UI.SuccessMessage(`Dodano ${addedCount} pozycji z szablonu.`);
        } else {
            UI.ErrorMessage("Nie dodano nic - spełniasz już wymagania lub błędny kod.");
        }
        if (buildingObject.instructions.length > 0) {
            $('#instrukcjeBtn').show();
            UI.InfoMessage("Wczytano notatki!");
        }
    }

    function showInstructions() {
        const content = buildingObject.instructions.map(i => `<div class="tcm-instrukcja-line">🔹 ${i}</div>`).join('');
        $('#tcm-modal-inst').css('display', 'flex').find('#inst-content').html(content || '<div style="padding:10px; text-align:center;">Brak notatek.</div>');
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
            buildingObject = storage[game_data.village.id];
            if (!buildingObject.instructions) buildingObject.instructions = [];
        }

        let menuHtml = `
            <div id="kalkulatorBudowyMain">
                <h4>🛠️ BOB 🛠️<button id="instrukcjeBtn" title="Pokaż notatki szablonu">ℹ️</button></h4>
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
                        <td style="padding: 4px 0;">
                            <div style="display:flex; align-items:center; gap:4px; max-width: 170px;">
                                <select id="bSelect" style="flex:1; width:100%;"></select>
                                <button id="addBBtn" class="tcm-btn" style="font-size: 14px; padding: 4px 6px;">➕</button>
                            </div>
                        </td>
                        <td colspan="2" style="text-align:right; padding: 4px 0;">
                            Max: <select id="qLenInput" style="width:40px; text-align:center;">
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${n === buildingObject.buildingQueueLength ? 'selected' : ''}>${n}</option>`).join('')}
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th colspan="3" style="padding: 4px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Kolejka</span>
                                <button id="toggleQueueBtn" class="tcm-btn" style="padding: 2px 8px; font-size:14px;">${isQueueMinimized ? '🔽' : '🔼'}</button>
                            </div>
                        </th>
                    </tr>
                </table>

                <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin-top: 10px;">
                    <button id="btn-eko1" class="tcm-btn" style="flex: 1 1 30%;">EKO</button>
                    <button id="btn-eko2" class="tcm-btn" style="flex: 1 1 30%;">EKO27</button>
                    <button id="btn-manual" class="tcm-btn" style="flex: 1 1 30%; color: #00bcd4 !important;">WŁASNY</button>
                </div>
                
                <div id="manual-tpl-container" style="display:none; margin-top: 6px; flex-direction:column; gap:4px;">
                    <textarea id="manual-tpl-input" style="background:var(--bg-row-alt); color:var(--text-color); border:1px solid var(--border-color); width:100%; height:80px; font-size:11px; padding:4px;" placeholder="Wklej tutaj szablon"></textarea>
                    <button id="btn-analyze-manual" class="tcm-btn" style="border-color:#00bcd4 !important;">Importuj</button>
                </div>
            </div>
            
            <div id="tcm-modal-inst" class="tcm-modal">
                <div class="tcm-modal-content">
                    <div class="tcm-modal-header">
                        <h3>📜 Instrukcje Szablonu</h3>
                        <button class="tcm-btn" onclick="$('#tcm-modal-inst').hide();" style="margin:0; background: var(--btn-red-bg) !important; border-color: #ff003c !important;">❌</button>
                    </div>
                    <div class="tcm-modal-body" id="inst-content"></div>
                </div>
            </div>`;

        $('#kalkulatorBudowyMain, #tcm-modal-inst').remove();
        $('#content_value').prepend(menuHtml);

        $('#clearQueueBtn').click(() => {
            if(confirm("Wyczyścić kolejkę oraz notatki?")) { 
                buildingObject.buildingQueue = []; 
                buildingObject.instructions = []; 
                updateLocalStorage(); 
                reloadQueueDisplay(); 
                $('#instrukcjeBtn').hide(); 
            }
        });

        $('#addWWBtn').click(() => { buildingObject.buildingQueue.push("Aktywuj Surowce 30%"); updateLocalStorage(); reloadQueueDisplay(); });
        $('#addWBBtn').click(() => { buildingObject.buildingQueue.push("Aktywuj Budowa 10%"); updateLocalStorage(); reloadQueueDisplay(); });
        
        // Logika weryfikująca maksymalny poziom podczas dodawania do kolejki z palca
        $('#addBBtn').click(() => { 
            const v = $('#bSelect').val(); 
            if(v) { 
                const effLevels = getEffectiveLevels();
                const maxLvl = (typeof BuildingMain !== 'undefined' && BuildingMain.buildings && BuildingMain.buildings[v]) ? BuildingMain.buildings[v].max_level : (MAX_LEVELS[v] || 30);
                
                if(effLevels[v] >= maxLvl) {
                    UI.ErrorMessage(`Osiągnięto maksymalny poziom dla: ${PL_NAMES[v]}`);
                    return;
                }

                buildingObject.buildingQueue.push(v); 
                updateLocalStorage(); 
                reloadQueueDisplay(); 
            }
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
            if(buildingObject.status) uruchomBudowe();
        });

        $('#kalkulatorBudowyTabela').on('click', '.q-action-modul', function() {
            const nazwaBonusu = buildingObject.buildingQueue[$(this).data('idx')];
            uruchomModulBonusow("TUTAJ_ZMIENISZ_LINK", nazwaBonusu);
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
            if(targetTr.length && targetTr.data('idx') !== dragIdx) {
                targetTr.addClass('drag-over');
            }
        }).on('touchend', '.drag-handle', function(e) {
            if(dragEl) dragEl.css({opacity: '1', background: ''});
            $('.q-row').removeClass('drag-over');
            let touch = e.originalEvent.changedTouches[0];
            let target = document.elementFromPoint(touch.clientX, touch.clientY);
            let targetTr = $(target).closest('.q-row');
            if(targetTr.length) {
                let targetIdx = targetTr.data('idx');
                if(dragIdx !== targetIdx && targetIdx !== undefined) {
                    let item = buildingObject.buildingQueue.splice(dragIdx, 1)[0];
                    buildingObject.buildingQueue.splice(targetIdx, 0, item);
                    updateLocalStorage(); reloadQueueDisplay();
                }
            }
            dragEl = null; dragIdx = -1;
        });

        $('#qLenInput').on('change', function() { buildingObject.buildingQueueLength = parseInt($(this).val(), 10) || 5; updateLocalStorage(); });

        $('#btn-eko1').click(() => fetchTemplate(LINKS.eko1));
        $('#btn-eko2').click(() => fetchTemplate(LINKS.eko2));
        $('#instrukcjeBtn').click(showInstructions);

        $('#btn-manual').click(() => $('#manual-tpl-container').toggle());
        $('#btn-analyze-manual').click(() => {
            const text = $('#manual-tpl-input').val();
            if (!text) return UI.ErrorMessage("Wklej najpierw kod w pole!");
            processTemplate(text);
            $('#manual-tpl-input').val('');
            $('#manual-tpl-container').hide();
        });

        reloadQueueDisplay();
        if (buildingObject.status) uruchomBudowe();
        if (buildingObject.instructions.length > 0) $('#instrukcjeBtn').show();
    }

    function uruchomBudowe() {
        if (!buildingObject.status || isBuilding) return;

        const $freeBtn = $('.btn-instant-free:visible');
        if ($freeBtn.length) { 
            $freeBtn.click(); 
            setTimeout(uruchomBudowe, Math.floor(Math.random() * 1000) + 2500); 
            return; 
        }

        if (buildingObject.buildingQueue.length > 0) {
            let nextItem = buildingObject.buildingQueue[0];
            if (typeof nextItem === 'string' && nextItem.includes('Aktywuj')) {
                buildingObject.status = false;
                $('#startBtn').text("✅️ Start").removeClass('tcm-btn-active');
                updateLocalStorage();
                UI.InfoMessage("Wymagana akcja ręczna na bonusie", 2000);
                return;
            } else {
                let currentQueue = $('#buildqueue tr[class*="buildorder_"]').length;
                if (currentQueue < buildingObject.buildingQueueLength) {
                    const $buildBtn = $(`.btn-build[data-building="${nextItem}"]`);
                    if ($buildBtn.length && $buildBtn.css('display') !== 'none') {
                        isBuilding = true; buildAjax(nextItem); return;
                    }
                }
            }
        }
        setTimeout(uruchomBudowe, Math.floor(Math.random() * 1500) + 3500);
    }

    function buildAjax(bId) {
        $.ajax({
            url: `/game.php?village=${game_data.village.id}&screen=main&ajaxaction=upgrade_building&type=main&h=${game_data.csrf}`,
            type: "post", data: { id: bId, force: 1, destroy: 0, source: game_data.village.id }, headers: { "TribalWars-Ajax": 1 }
        }).done(function(r) {
            let res = typeof r === "string" ? JSON.parse(r) : r;
            if (res.response && res.response.success) {
                buildingObject.buildingQueue.shift(); updateLocalStorage();
                setTimeout(() => location.reload(), 1500);
            } else { isBuilding = false; }
        }).fail(() => { isBuilding = false; });
    }

    if (document.readyState === 'complete') init();
    else $(window).on('load', init);
})();
