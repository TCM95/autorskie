// ==UserScript==
// @name         MAPA-KORDY-HYBRYDA
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Skanowanie z ekranu
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

    // Wstrzyknięcie stylów Shinko Theme
    function injectStyles() {
        if (document.getElementById('tcm-map-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-map-styles';
        style.innerHTML = `
            #tcm_ui {
                position: fixed; z-index: 999999; width: 240px;
                background-color: #36393f !important;
                border: 2px solid #3e4147 !important;
                border-radius: 4px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.8);
                font-family: Verdana, Arial, sans-serif;
                color: white !important;
                touch-action: none;
                top: 100px; left: 20px;
            }
            #tcm-drag-handle {
                background-color: #202225 !important;
                color: #ffffdf !important;
                padding: 8px; font-weight: bold; font-size: 11px;
                border-bottom: 2px solid #3e4147 !important;
                user-select: none;
                display: flex; justify-content: space-between; align-items: center;
            }
            .tcm-input {
                background-color: #32353b !important;
                color: #ffffdf !important;
                border: 1px solid #3e4147 !important;
                padding: 5px; width: 100%; box-sizing: border-box;
                margin-bottom: 6px; border-radius: 3px; outline: none; font-size: 10px;
            }
            .tcm-btn {
                background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%) !important;
                color: white !important;
                border: 1px solid #3e4147 !important;
                border-radius: 3px; cursor: pointer; padding: 6px;
                font-weight: bold; width: 100%; text-shadow: 1px 1px 1px rgba(0,0,0,0.8);
                font-size: 10px;
            }
            .tcm-btn:hover { background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%) !important; }
            .tcm-btn-green {
                background-image: linear-gradient(#2ecc71 0%, #27ae60 100%) !important;
                border: 1px solid #1e8449 !important;
            }
            .tcm-btn-red {
                background-image: linear-gradient(#e74c3c 0%, #c0392b 100%) !important;
                border: 1px solid #922b21 !important;
            }
            #tcm-pin-btn {
                cursor: pointer; font-size: 13px; padding: 2px 5px;
                background: rgba(0,0,0,0.2); border-radius: 3px; border: 1px solid transparent;
            }
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

                        let match = false;
                        if (tTags.length > 0 && tTags.some(t => allyTag === t)) match = true;
                        if (tPlayers.length > 0 && tPlayers.some(p => pName === p)) match = true;
                        if (tTags.length === 0 && tPlayers.length === 0) {
                            if (Number(v.owner) !== Number(game_data.player.id) && (game_data.player.ally == 0 || allyId != game_data.player.ally)) match = true;
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
            if (tTags.length === 0 && tPlayers.length === 0) {
                alert("W trybie 'Cały świat' podaj tag plemienia lub gracza!");
                btn.innerText = "SKANUJ";
                btn.disabled = false;
                return;
            }

            try {
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

                    const player = players[p[4]];
                    const pName = player ? player.name : "";
                    const allyTag = (player && allies[player.ally]) ? allies[player.ally] : "";

                    let match = false;
                    if (tTags.length > 0 && tTags.includes(allyTag)) match = true;
                    if (tPlayers.length > 0 && tPlayers.includes(pName)) match = true;

                    if (match) {
                        let coord = p[2] + "|" + p[3];
                        if (!set.has(coord)) {
                            set.add(coord);
                            count++;
                        }
                    }
                });
            } catch (error) {
                console.error("Błąd bazy:", error);
                alert("Wystąpił błąd podczas pobierania danych z serwera.");
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
                <span>Skaner Mapy</span>
                <span id="tcm-pin-btn" title="Przypnij/Odepnij">📌</span>
            </div>
            <div style="padding: 8px;">
                <div style="margin-bottom:6px; padding-bottom:5px; border-bottom:1px solid #3e4147; font-size:10px;">
                    <label style="margin-right:6px;"><input type="radio" name="tcm_mode" value="screen" checked> Z ekranu</label>
                    <label><input type="radio" name="tcm_mode" value="global"> Cały świat</label>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; gap:5px;">
                    <input type="number" id="tcm_min_pts" class="tcm-input" value="${sPts}" style="width:60px; margin-bottom:0;" placeholder="Pkt">
                    <button id="tcm_scan" class="tcm-btn tcm-btn-green" style="flex:1;">SKANUJ</button>
                </div>
                <input type="text" id="tcm_target_tags" class="tcm-input" value="${sTags}" placeholder="Tagi (oddziel przecinkiem)">
                <input type="text" id="tcm_target_players" class="tcm-input" value="${sPlayers}" placeholder="Gracze (oddziel przecinkiem)">
                <div style="display:flex; gap:5px; margin-top:4px;">
                    <button id="tcm_out_btn" class="tcm-btn" style="flex:1;">LISTA (${set.size})</button>
                    <button id="tcm_reset_btn" class="tcm-btn tcm-btn-red" style="width:50px;">RESET</button>
                </div>
            </div>`;

        document.body.appendChild(ui);
        setupDraggableAndPin(ui, !!savedPos);

        $('#tcm_scan').click(scanMap);
        $('#tcm_out_btn').click(() => {
             const out = [...set].join(" ");
             Dialog.show('tcm_box', `<div style="padding:15px; background:#36393f; border:2px solid #3e4147; color:#fff;">
                <textarea id="tcm_copy" class="tcm-input" style="width:100%; height:120px; resize:none;">${out}</textarea>
                <button class="tcm-btn tcm-btn-green" style="width:100%; margin-top:10px;" onclick="document.getElementById('tcm_copy').select();document.execCommand('copy');">KOPIUJ</button>
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
