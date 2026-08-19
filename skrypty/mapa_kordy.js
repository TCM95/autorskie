// ==UserScript==
// @name         MAPA-KORDY-HYBRYDA
// @namespace    https://viayoo.com/
// @version      2.1
// @description  Skanowanie mapy bez zewnętrznych bibliotek
// @author       TCM
// @match        *.plemiona.pl/game.php?*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_TAGS = "tcm_v5_tags";
    const STORAGE_PLAYERS = "tcm_v5_players";
    const STORAGE_PTS = "tcm_v5_pts";
    const STORAGE_LIST = "tcm_v5_coords";

    let set = new Set(JSON.parse(localStorage.getItem(STORAGE_LIST) || "[]"));
    const cleanPoints = (pts) => parseInt(String(pts).replace(/\./g, '')) || 0;

    function injectStyles() {
        if (document.getElementById('tcm-map-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-map-styles';
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
                --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
                --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
                --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
                --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            }
            #tcm_ui {
                position: fixed; z-index: 999999; width: 260px;
                background-color: var(--bg-main) !important;
                border: 2px solid var(--border-color) !important;
                border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.8);
                font-family: Verdana, Arial, sans-serif;
                color: var(--text-color) !important; touch-action: none; top: 80px; left: 10px;
            }
            #tcm-drag-handle {
                background-color: var(--bg-header) !important;
                color: var(--title-color) !important;
                padding: 10px; font-weight: bold; font-size: 12px;
                border-bottom: 2px solid var(--border-color) !important;
                user-select: none; display: flex; justify-content: space-between; align-items: center;
            }
            .tcm-input {
                background-color: var(--bg-row-alt) !important;
                color: var(--title-color) !important;
                border: 1px solid var(--border-color) !important;
                padding: 8px; width: 100%; box-sizing: border-box;
                margin-bottom: 8px; border-radius: 3px; outline: none; font-size: 11px;
            }
            .tcm-btn {
                background: var(--btn-bg) !important; color: var(--text-color) !important;
                border: 1px solid var(--border-color) !important;
                border-radius: 3px; cursor: pointer; padding: 8px;
                font-weight: bold; width: 100%; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); font-size: 11px;
            }
            .tcm-btn:hover { background: var(--btn-hover) !important; }
            .tcm-btn-green { background: var(--btn-green-bg) !important; border-color: #1e8449 !important; }
            .tcm-btn-green:hover { background: var(--btn-green-hover) !important; }
            .tcm-btn-red { background: var(--btn-red-bg) !important; border-color: #922b21 !important; }
            .tcm-btn-red:hover { background: var(--btn-red-hover) !important; }
            #tcm-pin-btn { cursor: pointer; font-size: 14px; padding: 4px 8px; background: rgba(0,0,0,0.2); border-radius: 3px; border: 1px solid transparent; }
            .tcm-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 5px; cursor: pointer; }
            .tcm-checkbox-label input[type="checkbox"] { width: 18px; height: 18px; margin: 0; }
        `;
        document.head.appendChild(style);
    }

    const updateButtonText = () => {
        const btn = document.getElementById('tcm_out_btn');
        if (btn) btn.innerText = `LISTA (${set.size})`;
    };

    const pinFramesToTiles = () => {
        const mini = document.getElementById('minimap');
        if (!mini) return;
        const tiles = mini.getElementsByTagName('img');
        const scale = 5;

        for (let i = 0; i < tiles.length; i++) {
            const img = tiles[i];
            const url = new URL(img.src);
            const tileX = parseInt(url.searchParams.get("x"));
            const tileY = parseInt(url.searchParams.get("y"));
            if (isNaN(tileX) || isNaN(tileY)) continue;

            let containerId = `tcm_tile_ctx_${tileX}_${tileY}`;
            let container = document.getElementById(containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = "tcm-tile-overlay";
                container.style = `position:absolute; width:250px; height:250px; pointer-events:none; z-index:10; left:${img.style.left}; top:${img.style.top};`;
                img.parentNode.appendChild(container);
            } else {
                container.style.left = img.style.left;
                container.style.top = img.style.top;
            }

            let html = "";
            set.forEach(coord => {
                const [vx, vy] = coord.split('|').map(Number);
                if (vx >= tileX && vx < tileX + 50 && vy >= tileY && vy < tileY + 50) {
                    const localX = (vx - tileX) * scale;
                    const localY = (vy - tileY) * scale;
                    html += `<div style="position:absolute; border:2px solid #000; width:5px; height:5px; box-sizing:border-box; background:rgba(0,0,0,0.1); box-shadow: 0 0 1px #FFF; left:${localX}px; top:${localY}px;"></div>`;
                }
            });
            if (container.innerHTML !== html) container.innerHTML = html;
        }
    };

    const scanMap = async () => {
        const minPoints = cleanPoints($('#tcm_min_pts').val());
        const tTags = ($('#tcm_target_tags').val() || "").split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");
        const tPlayers = ($('#tcm_target_players').val() || "").split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");
        const mode = document.querySelector('input[name="tcm_mode"]:checked').value;
        
        const scanBarbs = $('#tcm_scan_barbs').is(':checked');
        const scanEnemy = $('#tcm_scan_enemy').is(':checked');
        const scanMine = $('#tcm_scan_mine').is(':checked');

        localStorage.setItem(STORAGE_TAGS, $('#tcm_target_tags').val());
        localStorage.setItem(STORAGE_PLAYERS, $('#tcm_target_players').val());
        localStorage.setItem(STORAGE_PTS, minPoints);

        let count = 0;
        const btn = document.getElementById('tcm_scan');
        btn.innerText = "...";
        btn.disabled = true;

        if (mode === "screen") {
            if (typeof TWMap !== 'undefined' && TWMap.map.pos) {
                const pos = TWMap.map.pos;
                const size = TWMap.map.size;
                const startX = Math.floor(pos[0] / TWMap.tileSize[0]);
                const startY = Math.floor(pos[1] / TWMap.tileSize[1]);
                const endX = startX + Math.ceil(size[0] / TWMap.tileSize[0]);
                const endY = startY + Math.ceil(size[1] / TWMap.tileSize[1]);

                for (let x = startX; x <= endX; x++) {
                    for (let y = startY; y <= endY; y++) {
                        let v = TWMap.villages[x * 1000 + y];
                        if (!v || v.img === 51 || cleanPoints(v.points) < minPoints) continue;

                        let p = TWMap.players[v.owner];
                        let pName = p ? String(p.name).toLowerCase() : "";
                        let allyId = p ? Number(p.ally) : 0;
                        let allyTag = (p && TWMap.allies[allyId]) ? String(TWMap.allies[allyId].tag).toLowerCase() : "";

                        let isMe = Number(v.owner) === Number(game_data.player.id);
                        let isMyTribe = allyId !== 0 && Number(allyId) === Number(game_data.player.ally);
                        let isBarb = Number(v.owner) === 0;

                        let match = false;
                        if (tTags.length > 0 || tPlayers.length > 0) {
                            if (tTags.includes(allyTag)) match = true;
                            if (tPlayers.includes(pName)) match = true;
                        } else {
                            if (!isMe) {
                                if (isBarb && scanBarbs) match = true;
                                if (!isBarb && !isMyTribe && scanEnemy) match = true;
                                if (!isBarb && isMyTribe && scanMine) match = true;
                            }
                        }

                        if (match) {
                            let coord = x + "|" + y;
                            if (!set.has(coord)) {
                                set.add(coord);
                                count++;
                            }
                            $(`#map_village_${v.id}`).css({ "outline": "3px solid #000", "outline-offset": "-3px" });
                        }
                    }
                }
            }
        } else if (mode === "global") {
            try {
                // Bezpieczny fetch natywnych plików bez zewnętrznych bibliotek
                const [allyRes, playerRes, villageRes] = await Promise.all([
                    fetch('/map/ally.txt').then(r => r.text()),
                    fetch('/map/player.txt').then(r => r.text()),
                    fetch('/map/village.txt').then(r => r.text())
                ]);

                const allies = {};
                allyRes.split('\n').forEach(line => {
                    const p = line.split(',');
                    if (p.length > 2) allies[p[0]] = decodeURIComponent(p[2].replace(/\+/g, '%20')).toLowerCase();
                });

                const players = {};
                playerRes.split('\n').forEach(line => {
                    const p = line.split(',');
                    if (p.length > 2) players[p[0]] = {
                        name: decodeURIComponent(p[1].replace(/\+/g, '%20')).toLowerCase(),
                        ally: p[2]
                    };
                });

                villageRes.split('\n').forEach(line => {
                    const p = line.split(',');
                    if (p.length < 6 || parseInt(p[5]) < minPoints) return;

                    const playerId = parseInt(p[4]);
                    const player = players[playerId];
                    const pName = player ? player.name : "";
                    const allyId = player ? parseInt(player.ally) : 0;
                    const allyTag = (player && allies[allyId]) ? allies[allyId] : "";

                    let isBarb = playerId === 0;
                    let isMe = playerId === Number(game_data.player.id);
                    let isMyTribe = allyId !== 0 && allyId === Number(game_data.player.ally);

                    let match = false;
                    if (tTags.length > 0 || tPlayers.length > 0) {
                        if (tTags.includes(allyTag)) match = true;
                        if (tPlayers.includes(pName)) match = true;
                    } else {
                        if (!isMe) {
                            if (isBarb && scanBarbs) match = true;
                            if (!isBarb && !isMyTribe && scanEnemy) match = true;
                            if (!isBarb && isMyTribe && scanMine) match = true;
                        }
                    }

                    if (match) {
                        let coord = p[2] + "|" + p[3];
                        if (!set.has(coord)) {
                            set.add(coord);
                            count++;
                        }
                    }
                });
            } catch (error) {
                console.error("Błąd pobierania danych:", error);
                alert("Wystąpił błąd podczas pobierania plików świata.");
            }
        }

        localStorage.setItem(STORAGE_LIST, JSON.stringify([...set]));
        updateButtonText();
        pinFramesToTiles();
        UI.SuccessMessage(`Znaleziono nowych: ${count}`);
        btn.innerText = "SKANUJ";
        btn.disabled = false;
    };

    function setupDraggableAndPin(ui, initialPinState) {
        const handle = document.getElementById('tcm-drag-handle');
        const pinBtn = document.getElementById('tcm-pin-btn');
        
        let isPinned = initialPinState;
        let isDragging = false, startX, startY, initialX, initialY;

        const updatePinVisuals = () => {
            if (isPinned) {
                pinBtn.style.opacity = '1';
                pinBtn.style.border = '1px solid #2ecc71';
                handle.style.cursor = 'default';
            } else {
                pinBtn.style.opacity = '0.4';
                pinBtn.style.border = '1px solid transparent';
                handle.style.cursor = 'move';
            }
        };
        updatePinVisuals();

        const startDrag = (e) => {
            if(e.target === pinBtn) return;
            if(isPinned) return;
            
            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initialX = ui.offsetLeft;
            initialY = ui.offsetTop;
        };

        const onDrag = (e) => {
            if (!isDragging || isPinned) return;
            e.preventDefault();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let dx = clientX - startX;
            let dy = clientY - startY;
            ui.style.left = (initialX + dx) + 'px';
            ui.style.top = (initialY + dy) + 'px';
        };

        const stopDrag = () => { isDragging = false; };

        handle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        handle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);

        pinBtn.addEventListener('click', () => {
            if (isPinned) {
                localStorage.removeItem('TCM_MapUI_Pos');
                isPinned = false;
            } else {
                localStorage.setItem('TCM_MapUI_Pos', JSON.stringify({top: ui.style.top, left: ui.style.left}));
                isPinned = true;
            }
            updatePinVisuals();
        });
    }

    const initUI = () => {
        if ($('#tcm_ui').length) return;
        injectStyles();

        const sTags = localStorage.getItem(STORAGE_TAGS) || "";
        const sPlayers = localStorage.getItem(STORAGE_PLAYERS) || "";
        const sPts = localStorage.getItem(STORAGE_PTS) || "3000";

        let savedPos = null;
        try { savedPos = JSON.parse(localStorage.getItem('TCM_MapUI_Pos')); } catch(e) { localStorage.removeItem('TCM_MapUI_Pos'); }

        const ui = document.createElement('div');
        ui.id = 'tcm_ui';
        if (savedPos) {
            ui.style.top = savedPos.top;
            ui.style.left = savedPos.left;
        }

        ui.innerHTML = `
            <div id="tcm-drag-handle">
                <span>Skaner Mapy PRO</span>
                <span id="tcm-pin-btn" title="Przypnij/Odepnij">📌</span>
            </div>
            <div style="padding: 12px;">
                <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-color); font-size:11px;">
                    <label style="margin-right:10px; cursor:pointer;"><input type="radio" name="tcm_mode" value="screen" checked style="width:14px; height:14px;"> Z ekranu</label>
                    <label style="cursor:pointer;"><input type="radio" name="tcm_mode" value="global" style="width:14px; height:14px;"> Cały świat</label>
                </div>
                
                <div style="background:var(--bg-row-alt); padding:8px; border-radius:4px; border:1px solid var(--border-color); margin-bottom:10px;">
                    <label class="tcm-checkbox-label"><input type="checkbox" id="tcm_scan_barbs" checked> Barbarzyńskie (puste pola)</label>
                    <label class="tcm-checkbox-label"><input type="checkbox" id="tcm_scan_enemy" checked> Inni gracze (puste pola)</label>
                    <label class="tcm-checkbox-label" style="margin-bottom:0;"><input type="checkbox" id="tcm_scan_mine"> Moje plemię (puste pola)</label>
                </div>

                <div style="display:flex; justify-content:space-between; margin-bottom:8px; gap:8px;">
                    <input type="number" id="tcm_min_pts" class="tcm-input" value="${sPts}" style="width:70px; margin-bottom:0;" placeholder="Pkt">
                    <button id="tcm_scan" class="tcm-btn tcm-btn-green" style="flex:1;">SKANUJ</button>
                </div>
                
                <input type="text" id="tcm_target_tags" class="tcm-input" value="${sTags}" placeholder="Tagi (oddziel przecinkiem)">
                <input type="text" id="tcm_target_players" class="tcm-input" value="${sPlayers}" placeholder="Gracze (oddziel przecinkiem)">
                
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button id="tcm_out_btn" class="tcm-btn" style="flex:1;">LISTA (${set.size})</button>
                    <button id="tcm_reset_btn" class="tcm-btn tcm-btn-red" style="width:60px;">RESET</button>
                </div>
            </div>`;

        document.body.appendChild(ui);
        setupDraggableAndPin(ui, !!savedPos);

        $('#tcm_scan').click(scanMap);
        $('#tcm_out_btn').click(() => {
             const out = [...set].join(" ");
             Dialog.show('tcm_box', `<div style="padding:15px; background:var(--bg-main); border:2px solid var(--border-color); color:var(--text-color);">
                <textarea id="tcm_copy" class="tcm-input" style="width:100%; height:120px; resize:none;">${out}</textarea>
                <button class="tcm-btn tcm-btn-green" style="width:100%; margin-top:10px;" onclick="document.getElementById('tcm_copy').select();document.execCommand('copy'); UI.SuccessMessage('Skopiowano!');">KOPIUJ</button>
             </div>`);
        });
        $('#tcm_reset_btn').click(() => {
            if(confirm('Wyczyścić listę?')) {
                set.clear();
                localStorage.removeItem(STORAGE_LIST);
                $('.tcm-tile-overlay').remove();
                $('[id^="map_village_"]').css('outline', '');
                updateButtonText();
            }
        });

        setInterval(pinFramesToTiles, 50);
    };

    $(document).ready(initUI);
})();
