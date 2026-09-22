// ==UserScript==
// @name         Filtr Mapy Ataków
// @namespace    https://viayoo.com/
// @version      1.4
// @description  Neonowe ramki ataków na mapie i minimapie z opcją ustawienia progów i kolorów
// @author       TCM
// @match        *.plemiona.pl/game.php?*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Domyślna konfiguracja progów i kolorów
    let config = JSON.parse(localStorage.getItem('tcm_atk_map_cfg')) || {
        lowThresh: 1, lowColor: '#39FF14',
        midThresh: 11, midColor: '#FF9100',
        highThresh: 20, highColor: '#FF003C'
    };

    // Stworzenie kontenera na dynamiczne style
    let dynamicStyle = document.getElementById('tcm-dynamic-styles');
    if (!dynamicStyle) {
        dynamicStyle = document.createElement('style');
        dynamicStyle.id = 'tcm-dynamic-styles';
        document.head.appendChild(dynamicStyle);
    }

    // Aktualizacja stylów neonowych w CSS
    const updateStyles = () => {
        dynamicStyle.innerHTML = `
            :root {
                --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147;
                --text-color: white; --title-color: #ffffdf;
                --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
                --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
                --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
                --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            }
            .tcm-neon-low { outline: 5px solid ${config.lowColor} !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px ${config.lowColor}, 0 0 5px ${config.lowColor} !important; z-index: 10 !important; background: transparent !important; }
            .tcm-neon-mid { outline: 5px solid ${config.midColor} !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px ${config.midColor}, 0 0 5px ${config.midColor} !important; z-index: 10 !important; background: transparent !important; }
            .tcm-neon-high { outline: 5px solid ${config.highColor} !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px ${config.highColor}, 0 0 5px ${config.highColor} !important; z-index: 10 !important; background: transparent !important; }
            .tcm-mini-neon { position: absolute; border: 2px solid; width: 5px; height: 5px; box-sizing: border-box; background: transparent !important; z-index: 20; pointer-events: none; }
            .tcm-atk-overlay { position: absolute; width: 250px; height: 250px; pointer-events: none; z-index: 10; }
            
            #tcm-atk-ui {
                position: fixed !important; top: 70px; left: 10px; z-index: 9999;
                background: var(--bg-main); border: 1px solid var(--border-color);
                color: var(--text-color); padding: 10px; border-radius: 5px;
                font-size: 12px; width: 230px; box-shadow: 0 4px 10px rgba(0,0,0,0.6);
                font-family: Tahoma, Arial, sans-serif;
            }
            #tcm-atk-ui-header {
                background: var(--bg-header); margin: -10px -10px 10px -10px;
                padding: 8px 10px; color: var(--title-color); font-weight: bold;
                display: flex; justify-content: space-between; align-items: center;
            }
            .tcm-cfg-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .tcm-cfg-row input[type="number"] { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); width: 45px; padding: 2px; text-align: center; border-radius: 3px; }
            .tcm-cfg-row input[type="color"] { border: none; width: 30px; height: 25px; cursor: pointer; background: transparent; }
            
            .tcm-btn { padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; color: white; font-weight: bold; }
            .tcm-btn-green { background: var(--btn-green-bg); }
            .tcm-btn-green:hover { background: var(--btn-green-hover); }
            
            #tcm-atk-toggle {
                position: fixed !important; top: 70px; left: 10px; z-index: 9998;
                background: var(--btn-bg); color: var(--title-color); padding: 8px;
                border: 1px solid var(--border-color); border-radius: 5px; cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5); font-size: 12px;
            }
            #tcm-atk-toggle:hover { background: var(--btn-hover); }
        `;
    };

    // Budowanie panelu UI
    const initUI = () => {
        if (document.getElementById('tcm-atk-ui')) return;

        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'tcm-atk-toggle';
        toggleBtn.innerHTML = '⚙️ Kolory ataków';
        toggleBtn.style.display = 'none';
        document.body.appendChild(toggleBtn);

        const ui = document.createElement('div');
        ui.id = 'tcm-atk-ui';
        ui.innerHTML = `
            <div id="tcm-atk-ui-header">
                <span>⚙️ Kolory i Progi</span>
                <span id="tcm-close-ui" style="cursor:pointer;">❌</span>
            </div>
            <div class="tcm-cfg-row">
                <span>Niski (>= <input type="number" id="tcm-low-thresh" value="${config.lowThresh}" min="1">)</span>
                <input type="color" id="tcm-low-color" value="${config.lowColor}">
            </div>
            <div class="tcm-cfg-row">
                <span>Średni (>= <input type="number" id="tcm-mid-thresh" value="${config.midThresh}" min="1">)</span>
                <input type="color" id="tcm-mid-color" value="${config.midColor}">
            </div>
            <div class="tcm-cfg-row">
                <span>Wysoki (>= <input type="number" id="tcm-high-thresh" value="${config.highThresh}" min="1">)</span>
                <input type="color" id="tcm-high-color" value="${config.highColor}">
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                <button id="tcm-save-limits" class="tcm-btn tcm-btn-green">💾 Zapisz</button>
                <button id="tcm-refresh-limits" class="tcm-btn" style="background: var(--btn-bg);">♻️ Odśwież</button>
            </div>
        `;
        document.body.appendChild(ui);

        document.getElementById('tcm-close-ui').addEventListener('click', () => {
            ui.style.display = 'none';
            toggleBtn.style.display = 'block';
        });

        toggleBtn.addEventListener('click', () => {
            toggleBtn.style.display = 'none';
            ui.style.display = 'block';
        });

        document.getElementById('tcm-save-limits').addEventListener('click', () => {
            config.lowThresh = parseInt(document.getElementById('tcm-low-thresh').value) || 1;
            config.midThresh = parseInt(document.getElementById('tcm-mid-thresh').value) || 11;
            config.highThresh = parseInt(document.getElementById('tcm-high-thresh').value) || 20;

            config.lowColor = document.getElementById('tcm-low-color').value;
            config.midColor = document.getElementById('tcm-mid-color').value;
            config.highColor = document.getElementById('tcm-high-color').value;

            localStorage.setItem('tcm_atk_map_cfg', JSON.stringify(config));
            updateStyles();
            updateView();
            alert('ദ്ദി ˉ͈̀꒳ˉ͈́ )✧ Ustawienia zapisane!');
        });

        document.getElementById('tcm-refresh-limits').addEventListener('click', () => {
            syncAttacks();
        });
    };

    const URL_INC = '/game.php?screen=overview_villages&mode=incomings&type=unignored&subtype=attacks';
    let attackMap = new Map();

    const syncAttacks = async () => {
        try {
            const r = await fetch(URL_INC);
            const html = await r.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const rows = doc.querySelectorAll('#incomings_table tr.nowrap');

            attackMap.clear();
            rows.forEach(row => {
                const cel = row.cells[1]?.innerText.match(/\d{3}\|\d{3}/);
                if (cel) attackMap.set(cel[0], (attackMap.get(cel[0]) || 0) + 1);
            });

            updateView();
        } catch (e) {
            console.error("❗ [TCM] Błąd pobierania ataków:", e);
        }
    };

    const updateView = () => {
        if (typeof TWMap === 'undefined' || !TWMap.map.pos) return;

        const pos = TWMap.map.pos;
        const size = TWMap.map.size;
        const startX = Math.floor(pos[0] / TWMap.tileSize[0]);
        const startY = Math.floor(pos[1] / TWMap.tileSize[1]);
        const endX = startX + Math.ceil(size[0] / TWMap.tileSize[0]);
        const endY = startY + Math.ceil(size[1] / TWMap.tileSize[1]);

        $('[id^="map_village_"]').removeClass('tcm-neon-low tcm-neon-mid tcm-neon-high');

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                let v = TWMap.villages[x * 1000 + y];
                if (!v) continue;

                let coord = x + "|" + y;

                if (attackMap.has(coord)) {
                    let count = attackMap.get(coord);

                    let className =
                        count >= config.highThresh ? 'tcm-neon-high' :
                        count >= config.midThresh ? 'tcm-neon-mid' :
                        count >= config.lowThresh ? 'tcm-neon-low' : '';

                    if (className) {
                        $(`#map_village_${v.id}`).addClass(className);
                    }
                }
            }
        }

        pinToMinimap();
    };

    const pinToMinimap = () => {
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

            let containerId = `tcm_atk_tile_${tileX}_${tileY}`;
            let container = document.getElementById(containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = "tcm-atk-overlay";
                container.style.left = img.style.left;
                container.style.top = img.style.top;
                img.parentNode.appendChild(container);
            } else {
                container.style.left = img.style.left;
                container.style.top = img.style.top;
            }

            let html = "";

            attackMap.forEach((count, coord) => {
                const [vx, vy] = coord.split('|').map(Number);

                if (vx >= tileX && vx < tileX + 50 && vy >= tileY && vy < tileY + 50) {
                    const localX = (vx - tileX) * scale;
                    const localY = (vy - tileY) * scale;

                    let color =
                        count >= config.highThresh ? config.highColor :
                        count >= config.midThresh ? config.midColor :
                        count >= config.lowThresh ? config.lowColor : null;

                    if (color) {
                        html += `<div class="tcm-mini-neon" style="border-color:${color}; box-shadow:0 0 5px ${color}; left:${localX}px; top:${localY}px;"></div>`;
                    }
                }
            });

            if (container.innerHTML !== html)
                container.innerHTML = html;
        }
    };

    // Inicjalizacja
    updateStyles();
    initUI();
    syncAttacks();
    setInterval(syncAttacks, 30000);
    setInterval(updateView, 50);

    $(document).ajaxStop(updateView);

})();
