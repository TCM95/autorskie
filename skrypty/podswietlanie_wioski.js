// ==UserScript==
// @name         filtr mapa ataki
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Neonowe ramki ataków na mapie i minimapie - TCM Foundation
// @author       Gal Anonim
// @match        *.plemiona.pl/game.php?*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const style = document.createElement('style');
    style.innerHTML = `
        .tcm-neon-low { outline: 5px solid #39FF14 !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px #39FF14, 0 0 5px #39FF14 !important; z-index: 10 !important; background: transparent !important; }
        .tcm-neon-mid { outline: 5px solid #FF9100 !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px #FF9100, 0 0 5px #FF9100 !important; z-index: 10 !important; background: transparent !important; }
        .tcm-neon-high { outline: 5px solid #FF003C !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px #FF003C, 0 0 5px #FF003C !important; z-index: 10 !important; background: transparent !important; }
        .tcm-mini-neon { position: absolute; border: 2px solid #39FF14; width: 5px; height: 5px; box-sizing: border-box; background: transparent !important; box-shadow: 0 0 4px #39FF14; z-index: 20; pointer-events: none; }
        .tcm-atk-overlay { position:absolute; width:250px; height:250px; pointer-events:none; z-index:10; }
    `;
    document.head.appendChild(style);

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
            console.error("[TCM] Błąd pobierania ataków:", e);
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
                        count >= 20 ? 'tcm-neon-high' :
                        count >= 11 ? 'tcm-neon-mid' :
                        'tcm-neon-low';

                    $(`#map_village_${v.id}`).addClass(className);
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
                        count >= 20 ? "#FF003C" :
                        count >= 11 ? "#FF9100" :
                        "#39FF14";

                    html += `<div class="tcm-mini-neon" style="border-color:${color}; box-shadow:0 0 5px ${color}; left:${localX}px; top:${localY}px;"></div>`;
                }
            });

            if (container.innerHTML !== html)
                container.innerHTML = html;
        }
    };

    syncAttacks();
    setInterval(syncAttacks, 30000);
    setInterval(updateView, 50);

    $(document).ajaxStop(updateView);

})();