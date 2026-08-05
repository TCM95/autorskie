// ==UserScript==
// @name         MAPA-KORDY-HYBRYDA
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Skanowanie z ekranu + całego świata z przełącznikiem
// @author       TCM
// @match        *.plemiona.pl/game.php?*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    const STORAGE_TAGS = "tcm_v5_tags";
    const STORAGE_PLAYERS = "tcm_v5_players";
    const STORAGE_PTS = "tcm_v5_pts";
    const STORAGE_LIST = "tcm_v5_coords";

    let set = new Set(JSON.parse(localStorage.getItem(STORAGE_LIST) || "[]"));
    const cleanPoints = (pts) => parseInt(String(pts).replace(/\./g, '')) || 0;

    const updateButtonText = () => {
        const btn = document.getElementById('tcm_out_btn');
        if (btn) btn.innerText = `LISTA (${set.size})`;
    };

    // TWOJA ORYGINALNA FUNKCJA OZNACZANIA
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
            // TWOJA ORYGINALNA LOGIKA SKANOWANIA Z EKRANU
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
            // LOGIKA SKANOWANIA CAŁEGO ŚWIATA
            if (tTags.length === 0 && tPlayers.length === 0) {
                alert("W trybie 'Cały świat' podaj tag plemienia lub gracza! Inaczej skrypt pobierze setki tysięcy wiosek i zawiesi przeglądarkę.");
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

    const initUI = () => {
        const anchor = $('#content_value h2').first();
        if (!anchor.length || $('#tcm_ui').length) return;

        const sTags = localStorage.getItem(STORAGE_TAGS) || "";
        const sPlayers = localStorage.getItem(STORAGE_PLAYERS) || "";
        const sPts = localStorage.getItem(STORAGE_PTS) || "3000";

        anchor.after(`
            <div id="tcm_ui" style="background:#e3d5b3; border:2px solid #000; margin:10px 0; padding:8px; display:inline-block; width:220px; font-size:10px; border-radius:4px;">
                <div style="margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid #000;">
                    <label style="margin-right:8px;"><input type="radio" name="tcm_mode" value="screen" checked> Z ekranu</label>
                    <label><input type="radio" name="tcm_mode" value="global"> Cały świat</label>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <input type="number" id="tcm_min_pts" value="${sPts}" style="width:50px;" placeholder="Pkt">
                    <button id="tcm_scan" class="btn" style="background:#214d21; color:#fff; padding:2px 10px;">SKANUJ</button>
                </div>
                <input type="text" id="tcm_target_tags" value="${sTags}" placeholder="Tagi (oddziel przecinkiem)" style="width:100%; margin-bottom:5px; box-sizing:border-box;">
                <input type="text" id="tcm_target_players" value="${sPlayers}" placeholder="Gracze (oddziel przecinkiem)" style="width:100%; margin-bottom:5px; box-sizing:border-box;">
                <div style="display:flex; gap:5px;">
                    <button id="tcm_out_btn" class="btn" style="flex:1;">LISTA (${set.size})</button>
                    <button id="tcm_reset_btn" class="btn" style="background:#800; color:#fff; width:60px;">RESET</button>
                </div>
            </div>`);

        $('#tcm_scan').click(scanMap);
        $('#tcm_out_btn').click(() => {
             const out = [...set].join(" ");
             Dialog.show('tcm_box', `<div style="padding:15px; background:#f4e4bc; border:2px solid #000;">
                <textarea id="tcm_copy" style="width:100%; height:120px; border:1px solid #000;">${out}</textarea>
                <button class="btn" style="width:100%; margin-top:10px;" onclick="document.getElementById('tcm_copy').select();document.execCommand('copy');">KOPIUJ</button>
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