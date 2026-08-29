// ==UserScript==
// @name         Kalkulator Budowy PRO
// @namespace    https://viayoo.com/
// @version      2.7
// @description  Zintegrowany system budowy, Touch Drag&Drop, Zaawansowane Bonusy (Wojenny wysiłek)
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
        } catch (e) { console.log("Brak Biblioteki Hermitowskiego."); }
    }

    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147;
            --text-color: #fff; --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, #000 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --neon-green: #74ff00; --neon-glow: 0 0 8px rgba(116,255,0,.6), 0 0 15px rgba(116,255,0,.4);
        }
        #autoBuilderMain * { box-sizing: border-box !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }
        #autoBuilderMain { background-color: var(--bg-main) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; border-radius: 4px; padding: 8px; margin: 10px 0; max-width: 320px; font-size: 12px; }
        #autoBuilderMain h4 { color: var(--title-color); margin: 0 0 8px 0; font-size: 13px; text-align: center; display: flex; justify-content: center; align-items: center; gap: 10px; }
        #autoBuilderMain th { background-color: var(--bg-header) !important; color: var(--title-color) !important; border-bottom: 1px solid var(--border-color); }
        #autoBuilderMain select, #autoBuilderMain input { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 3px; border-radius: 3px; max-width: 100px; }
        .tcm-btn { background: var(--btn-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; padding: 5px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 2px 1px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.8); transition: all 0.2s ease; }
        .tcm-btn-active { border-color: var(--neon-green) !important; color: var(--neon-green) !important; text-shadow: var(--neon-glow); box-shadow: inset 0 0 5px rgba(116,255,0,.3); }
        .q-row-a { background-color: var(--bg-main); } .q-row-b { background-color: var(--bg-row-alt); }
        .drag-handle { cursor: grab; font-size: 16px; color: #aaa; padding: 0 6px !important; user-select: none; }
        .drag-handle:active { cursor: grabbing; }
        .tcm-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; justify-content:center; align-items:center; }
        .tcm-modal-content { background: var(--bg-main); width: 95%; max-width: 400px; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; color: var(--text-color); }
        .tcm-modal-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:5px; margin-bottom:5px; }
        .tcm-modal-header h3 { margin:0; font-size:14px; color:var(--title-color); }
        .tcm-modal-body { max-height: 60vh; overflow-y: auto; text-align: center; }
    `;
    document.head.appendChild(style);

    let buildingObject = { buildingQueue: [], buildingQueueLength: 5, status: false, instructions: [] };
    let isBuilding = false, isActivatingBonus = false;
    let isQueueMinimized = JSON.parse(localStorage.getItem('queueMinimized') || "false");
    let dynamicTranslateMap = {};

    const REVERSE_MAP = {
        "ratusz": "main", "koszary": "barracks", "stajnia": "stable", "warsztat": "garage", 
        "wieża strażnicza": "watchtower", "kuźnia": "smith", "rynek": "market", "tartak": "wood", 
        "cegielnia": "stone", "huta żelaza": "iron", "zagroda": "farm", "spichlerz": "storage",
        "schowek": "hide", "mur": "wall", "pałac": "snob"
    };

    function updateLocalStorage() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        storage[game_data.village.id] = buildingObject;
        localStorage.setItem('buildingObject', JSON.stringify(storage));
    }

    function reloadQueueDisplay() {
        const table = $('#autoBuilderTable');
        if (!table.length) return;
        table.find('.q-row').remove();

        const plNames = { "wood": "Tartak", "stone": "Cegielnia", "iron": "Huta żelaza", "main": "Ratusz", "farm": "Zagroda", "storage": "Spichlerz", "hide": "Schowek", "wall": "Mur", "barracks": "Koszary", "stable": "Stajnia", "garage": "Warsztat", "smith": "Kuźnia", "market": "Rynek", "snob": "Pałac", "watchtower": "Wieża strażnicza" };
        
        let inQueueCounts = {};
        $('#buildqueue tr[class*="buildorder_"]').each(function() {
            const cls = $(this).attr('class').match(/buildorder_([a-z]+)/);
            if(cls) inQueueCounts[cls[1]] = (inQueueCounts[cls[1]] || 0) + 1;
        });

        let simulatedLevels = {};
        for (let b in game_data.village.buildings) simulatedLevels[b] = (parseInt(game_data.village.buildings[b], 10) || 0) + (inQueueCounts[b] || 0);

        buildingObject.buildingQueue.forEach((b, i) => {
            const isBonus = typeof b === 'string' && b.includes('Aktywuj');
            let label = plNames[b] || dynamicTranslateMap[b] || b;
            if (!isBonus && simulatedLevels[b] !== undefined) {
                simulatedLevels[b]++;
                label += ` (${simulatedLevels[b]})`;
            }

            let row = `<tr class="q-row ${i % 2 === 0 ? 'q-row-a' : 'q-row-b'}" data-idx="${i}" style="${isQueueMinimized ? 'display:none;' : ''}">
                <td class="drag-handle">☰</td>
                <td style="padding: 4px; ${isBonus ? 'color: #ff9800; font-weight: bold;' : 'color: var(--text-color);'} word-break: break-word;">${label}</td>
                <td style="text-align:right; padding: 4px; white-space: nowrap; width: 65px;">
                    <button class="tcm-btn q-action" data-type="del" data-idx="${i}" style="background: var(--btn-red-bg) !important; border-color: #ff003c !important;">X</button>
                </td>
            </tr>`;
            table.append(row);
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
                <h4>🛠️ BOB 🛠️</h4>
                <table id="autoBuilderTable" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td colspan="3" style="padding-bottom: 6px; text-align:center;">
                            <button id="startBtn" class="tcm-btn ${buildingObject.status ? 'tcm-btn-active' : ''}">${buildingObject.status ? 'Stop' : 'Start'}</button>
                            <button id="clearQueueBtn" class="tcm-btn">Wyczyść</button>
                            <button id="addWWBtn" class="tcm-btn" style="color:#ff9800 !important;">+Wojenny Wysiłek</button>
                        </td>
                    </tr>
                    <tr>
                        <th colspan="3" style="padding: 4px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Kolejka (Chwyć ☰ aby przenieść)</span>
                                <button id="toggleQueueBtn" class="tcm-btn" style="padding: 0 6px;">${isQueueMinimized ? '+' : '-'}</button>
                            </div>
                        </th>
                    </tr>
                </table>
            </div>
            
            <div id="tcm-modal-bonus" class="tcm-modal">
                <div class="tcm-modal-content">
                    <div class="tcm-modal-header">
                        <h3>⚠️ Brak Bonusu</h3>
                    </div>
                    <div class="tcm-modal-body">
                        <p>Nie znaleziono w ekwipunku: <b id="missing-bonus-name" style="color:#ff9800;"></b></p>
                        <p>Kolejka została zatrzymana.</p>
                        <div style="margin-top:15px; display:flex; justify-content:space-around;">
                            <button id="btn-bonus-wait" class="tcm-btn" style="background: var(--btn-blue-bg) !important;">⌛ Czekaj</button>
                            <button id="btn-bonus-skip" class="tcm-btn" style="background: var(--btn-green-bg) !important;">▶ Pomiń</button>
                        </div>
                    </div>
                </div>
            </div>`;

        $('#autoBuilderMain, #tcm-modal-bonus').remove();
        $('#content_value').prepend(menuHtml);

        // Zdarzenia UI
        $('#clearQueueBtn').click(() => { if(confirm("Wyczyścić kolejkę?")) { buildingObject.buildingQueue = []; updateLocalStorage(); reloadQueueDisplay(); }});
        $('#addWWBtn').click(() => { buildingObject.buildingQueue.push("Aktywuj Wojenny wysiłek"); updateLocalStorage(); reloadQueueDisplay(); });
        
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
            if ($(this).data('type') === 'del') {
                buildingObject.buildingQueue.splice($(this).data('idx'), 1);
                updateLocalStorage(); reloadQueueDisplay();
            }
        });

        // Touch Drag & Drop (VIA browser support)
        let dragIdx = -1, dragEl = null;
        $('#autoBuilderTable').on('touchstart', '.drag-handle', function(e) {
            dragEl = $(this).closest('.q-row');
            dragIdx = dragEl.data('idx');
            dragEl.css({opacity: '0.4', background: 'var(--bg-row-alt)'});
        }).on('touchmove', '.drag-handle', function(e) {
            e.preventDefault(); // Zapobiega skrolowaniu strony
        }).on('touchend', '.drag-handle', function(e) {
            if(dragEl) dragEl.css({opacity: '1', background: ''});
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

        // Obsługa modala braku bonusu
        $('#btn-bonus-wait').click(() => { $('#tcm-modal-bonus').hide(); });
        $('#btn-bonus-skip').click(() => { 
            $('#tcm-modal-bonus').hide(); 
            buildingObject.buildingQueue.shift(); // Usuwa zablokowany bonus
            buildingObject.status = true; 
            $('#startBtn').text("Stop").addClass('tcm-btn-active');
            updateLocalStorage(); reloadQueueDisplay();
            runAutoBuild();
        });

        reloadQueueDisplay();
        if (buildingObject.status) runAutoBuild();
    }

    function activateBonusInBg(bonusText) {
        if (isActivatingBonus) return;
        isActivatingBonus = true;

        let keyword = "";
        let textLower = bonusText.toLowerCase();

        // 📌 Priorytetowe dopasowanie słów kluczowych
        if (textLower.includes('wojenny wysiłek')) keyword = "wojenny wysiłek";
        else if (textLower.includes('budow')) keyword = "budow";
        else if (textLower.includes('wydobyci')) keyword = "wydobyci";
        else keyword = textLower.replace('aktywuj', '').trim();

        $.ajax({
            url: `/game.php?village=${game_data.village.id}&screen=inventory&ajax=load_inventory`,
            type: 'GET', dataType: 'json', headers: { "TribalWars-Ajax": 1 }
        }).done(function(r) {
            let foundItemId = null;
            if (r && r.dialog && r.dialog.inventory) {
                let items = r.dialog.inventory;
                for (let i = 0; i < items.length; i++) {
                    let name = (items[i].name || '').toLowerCase();
                    let desc = (items[i].description || '').toLowerCase();
                    if (name.includes(keyword) || desc.includes(keyword)) {
                        foundItemId = items[i].id || items[i].item_id; break;
                    }
                }
            }

            if (foundItemId) {
                $.ajax({
                    url: `/game.php?village=${game_data.village.id}&screen=inventory&ajaxaction=use_item&h=${game_data.csrf}`,
                    type: "post", data: { item_id: foundItemId, village_id: game_data.village.id }, headers: { "TribalWars-Ajax": 1 }
                }).done(function(res) {
                    buildingObject.buildingQueue.shift(); updateLocalStorage();
                    isActivatingBonus = false; setTimeout(() => location.reload(), 1500);
                }).fail(function() { isActivatingBonus = false; });
            } else {
                // ⚠️ Blokada kolejki i wyświetlenie okna wyboru
                isActivatingBonus = false;
                buildingObject.status = false;
                $('#startBtn').text("Start").removeClass('tcm-btn-active');
                updateLocalStorage();
                $('#missing-bonus-name').text(bonusText.replace('Aktywuj', '').trim());
                $('#tcm-modal-bonus').css('display', 'flex');
            }
        }).fail(function() { isActivatingBonus = false; });
    }

    function runAutoBuild() {
        if (!buildingObject.status || isBuilding || isActivatingBonus) return;

        const $freeBtn = $('.btn-instant-free:visible');
        if ($freeBtn.length) { $freeBtn.click(); setTimeout(runAutoBuild, 2000); return; }

        if (buildingObject.buildingQueue.length > 0) {
            let nextItem = buildingObject.buildingQueue[0];
            if (typeof nextItem === 'string' && nextItem.includes('Aktywuj')) {
                activateBonusInBg(nextItem); return;
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
        setTimeout(runAutoBuild, Math.floor(Math.random() * 1500) + 3500);
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
