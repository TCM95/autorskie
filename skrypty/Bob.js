// ==UserScript==
// @name         Kalkulator Budowy PRO
// @namespace    https://viayoo.com/
// @version      2.4
// @description  Zintegrowany system budowy, trwałe notatki okienkowe, nowe UI 3D + Wbudowany Aktywator Bonusów
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
            daneSwiata = await get_world_info({
                configs: ['config', 'building_info'],
                entities: { 'village': ['id', 'name', 'points'] }
            });
        } catch (e) { console.log("Brak Biblioteki Hermitowskiego - pomijam ładowanie."); }
    }

    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-main: #36393f;
            --bg-row-alt: #32353b;
            --bg-header: #202225;
            --border-color: #3e4147;
            --text-color: #fff;
            --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, #000 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --neon-green: #74ff00;
            --neon-glow: 0 0 8px rgba(116,255,0,.6), 0 0 15px rgba(116,255,0,.4);
            --neon-red: #ff003c;
            --neon-red-glow: 0 0 8px rgba(255,0,60,.6), 0 0 15px rgba(255,0,60,.4);
        }
        
        #autoBuilderMain * { box-sizing: border-box !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }
        #autoBuilderMain { background-color: var(--bg-main) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; border-radius: 4px; padding: 8px; margin: 10px 0; max-width: 320px; font-size: 12px; }
        #autoBuilderMain h4 { color: var(--title-color); margin: 0 0 8px 0; font-size: 13px; text-align: center; display: flex; justify-content: center; align-items: center; gap: 10px; }
        #autoBuilderMain th, #autoBuilderMain .vis th { background-color: var(--bg-header) !important; background-image: none !important; border-bottom: 1px solid var(--border-color) !important; color: var(--title-color) !important; }
        #autoBuilderMain select, #autoBuilderMain input { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 3px; border-radius: 3px; max-width: 100px; }
        
        .tcm-btn { background: var(--btn-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; padding: 5px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 2px 1px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.8); transition: all 0.2s ease; }
        .tcm-btn:hover { background: var(--btn-hover) !important; color: var(--title-color) !important; box-shadow: 0 2px 6px rgba(0,0,0,0.8); transform: translateY(2px); }
        .tcm-btn-active { border-color: var(--neon-green) !important; color: var(--neon-green) !important; text-shadow: var(--neon-glow); box-shadow: 0 4px 12px rgba(0,0,0,0.8), inset 0 0 5px rgba(116,255,0,.3); }
        
        .q-row-a { background-color: var(--bg-main); } .q-row-b { background-color: var(--bg-row-alt); }
        
        /* Popup Notatek */
        .tcm-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; justify-content:center; align-items:center; }
        .tcm-modal-content { background: var(--bg-main); width: 95%; max-width: 400px; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; color: var(--text-color); }
        .tcm-modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:5px; margin-bottom:5px; }
        .tcm-modal-header h3 { margin:0; font-size:14px; color:var(--title-color); }
        .tcm-modal-body { max-height: 60vh; overflow-y: auto; padding-right: 5px; }
        .tcm-modal-body::-webkit-scrollbar { width: 6px; }
        .tcm-modal-body::-webkit-scrollbar-track { background: var(--bg-main); }
        .tcm-modal-body::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
        .tcm-instrukcja-line { padding: 6px 4px; border-bottom: 1px dashed var(--border-color); font-size: 11px; color: #ccc; }
        #instrukcjeBtn { display:none; background:none; border:none; cursor:pointer; font-size:16px; padding:0; color:#00bcd4; margin:0; box-shadow:none; }
    `;
    document.head.appendChild(style);

    // --- ZMIENNE ---
    let buildingObject = { buildingQueue: [], buildingQueueLength: 5, status: false, instructions: [] };
    let isBuilding = false;
    let isActivatingBonus = false; // Nowa zmienna dla aktywatora
    let isQueueMinimized = JSON.parse(localStorage.getItem('queueMinimized') || "false");
    let dynamicTranslateMap = {};

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
                    <button class="tcm-btn q-action" data-type="del" data-idx="${i}" style="background: var(--btn-red-bg) !important; border-color: #ff003c !important;">X</button>
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

        const lines = text.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if(!trimmed) return;
            
            if (trimmed.match(/^\[\/?table\]$/i) || trimmed.match(/^\[\*\*?\].*\[\/\*\*?\]$/i)) return;
            if (trimmed.startsWith('[|]')) return; 

            const tLower = trimmed.toLowerCase();
            const cleanText = trimmed.replace(/\[.*?\]/g, '').trim(); 

            const bKey = BUILDING_NAMES.find(name => tLower.includes(name));
            
            if (bKey && (tLower.includes('building') || tLower.includes('poziom') || tLower.includes('pzm'))) {
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
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error("Błąd pobierania");
                return response.text();
            })
            .then(text => processTemplate(text))
            .catch(error => {
                UI.ErrorMessage("Wystąpił błąd podczas pobierania szablonu.");
                console.error(error);
            });
    }

    function init() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        if (storage[game_data.village.id]) {
            buildingObject = storage[game_data.village.id];
            if (!buildingObject.instructions) buildingObject.instructions = [];
        }

        let menuHtml = `
            <div id="autoBuilderMain">
                <h4>🛠️ BOB 🛠️<button id="instrukcjeBtn" title="Pokaż notatki szablonu">ℹ️</button></h4>
                
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
                            <button id="addBBtn" class="tcm-btn">+</button>
                        </td>
                        <td style="text-align:right; padding: 4px 0;">
                            Max: <input id="qLenInput" type="number" value="${buildingObject.buildingQueueLength}" style="width:35px; text-align:center;">
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
                
                <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin-top: 10px;">
                    <button id="btn-eko1" class="tcm-btn" style="flex: 1 1 30%;">EKO</button>
                    <button id="btn-eko2" class="tcm-btn" style="flex: 1 1 30%;">EKO27 PAŁAC+</button>
                    <button id="btn-manual" class="tcm-btn" style="flex: 1 1 30%; color: #00bcd4 !important;">WŁASNY +</button>
                </div>
                
                <div id="manual-tpl-container" style="display:none; margin-top: 6px; flex-direction:column; gap:4px;">
                    <textarea id="manual-tpl-input" style="background:var(--bg-row-alt); color:var(--text-color); border:1px solid var(--border-color); width:100%; height:80px; font-size:11px; padding:4px;" placeholder="Wklej tutaj kod"></textarea>
                    <button id="btn-analyze-manual" class="tcm-btn" style="border-color:#00bcd4 !important;">Importuj</button>
                </div>
            </div>
            
            <div id="tcm-modal-inst" class="tcm-modal">
                <div class="tcm-modal-content">
                    <div class="tcm-modal-header">
                        <h3>📜 Instrukcje Szablonu</h3>
                        <button class="tcm-btn" onclick="$('#tcm-modal-inst').hide();" style="margin:0; background: var(--btn-red-bg) !important; border-color: #ff003c !important;">X</button>
                    </div>
                    <div class="tcm-modal-body" id="inst-content"></div>
                </div>
            </div>`;

        $('#autoBuilderMain, #tcm-modal-inst').remove();
        $('#content_value').prepend(menuHtml);

        // --- Zdarzenia UI ---
        $('#clearQueueBtn').click(() => {
            if(confirm("Wyczyścić całą kolejkę oraz notatki?")) { 
                buildingObject.buildingQueue = []; 
                buildingObject.instructions = []; 
                updateLocalStorage(); 
                reloadQueueDisplay(); 
                $('#instrukcjeBtn').hide(); 
            }
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
        
        $('#btn-eko1').click(() => fetchTemplate(LINKS.eko1));
        $('#btn-eko2').click(() => fetchTemplate(LINKS.eko2));
        $('#instrukcjeBtn').click(showInstructions);
        
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
        
        if(buildingObject.instructions.length > 0) $('#instrukcjeBtn').show();
    }

    // --- SEKCJA AKTYWATORA BONUSÓW ---
    function activateBonusInBg(bonusText) {
        if (isActivatingBonus) return;
        isActivatingBonus = true;

        let keyword = "";
        let textLower = bonusText.toLowerCase();
        
        if (textLower.includes('budow')) keyword = "budow";
        else if (textLower.includes('wydobyci')) keyword = "wydobyci";
        else keyword = textLower.replace('aktywuj', '').trim();

        UI.InfoMessage("Wykryto bonus! Szukam: " + keyword, 2000);

        $.getJSON(`/game.php?village=${game_data.village.id}&screen=inventory&ajax=load_inventory`)
        .done(function(r) {
            let foundItemId = null;
            if (r && r.dialog && r.dialog.inventory) {
                let items = r.dialog.inventory;
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let name = (item.name || '').toLowerCase();
                    let desc = (item.description || '').toLowerCase();
                    if (name.includes(keyword) || desc.includes(keyword)) {
                        foundItemId = item.id || item.item_id;
                        break;
                    }
                }
            }

            if (foundItemId) {
                $.ajax({
                    url: `/game.php?village=${game_data.village.id}&screen=inventory&ajaxaction=use_item&h=${game_data.csrf}`,
                    type: "post",
                    data: { item_id: foundItemId, village_id: game_data.village.id },
                    headers: { "TribalWars-Ajax": 1 }
                }).done(function(res) {
                    let response = typeof res === "string" ? JSON.parse(res) : res;
                    if ((response.response && response.response.success) || response.success) {
                        UI.SuccessMessage("Pomyślnie aktywowano bonus!");
                    } else {
                        UI.ErrorMessage("Problem z aktywacją bonusu po stronie serwera.");
                    }
                    finalizeBonus();
                }).fail(function() {
                    UI.ErrorMessage("Błąd połączenia podczas aktywacji.");
                    finalizeBonus();
                });
            } else {
                UI.ErrorMessage(`Nie znaleziono w inwentarzu: ${keyword}`);
                finalizeBonus();
            }
        })
        .fail(function() {
            UI.ErrorMessage("Nie udało się pobrać danych inwentarza.");
            isActivatingBonus = false;
        });
    }

    function finalizeBonus() {
        buildingObject.buildingQueue.shift();
        updateLocalStorage();
        isActivatingBonus = false;
        setTimeout(() => location.reload(), 1500);
    }
    // ---------------------------------

    function runAutoBuild() {
        if (!buildingObject.status || isBuilding || isActivatingBonus) return;

        const $freeBtn = $('.btn-instant-free:visible');
        if ($freeBtn.length) {
            $freeBtn.click();
            setTimeout(runAutoBuild, 2000);
            return;
        }

        if (buildingObject.buildingQueue.length > 0) {
            let nextItem = buildingObject.buildingQueue[0];
            
            // Jesli element zawiera słowo Aktywuj, puszczamy logikę inwentarza i przerywamy zwykłą pętlę
            if (typeof nextItem === 'string' && nextItem.includes('Aktywuj')) {
                activateBonusInBg(nextItem);
                return;
            } 
            // Standardowa budowa
            else {
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
