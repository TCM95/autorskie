// ==UserScript==
// @name         Filtr Mapy Ataków
// @namespace    https://viayoo.com/
// @version      1.0
// @description  Neonowe ramki ataków na mapie i minimapie z konfigurowalnym interfejsem
// @author       TCM
// @match        https://*.plemiona.pl/game.php*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Wczytanie konfiguracji lub wartości domyślne
    let config = JSON.parse(localStorage.getItem('tcm_atk_map_cfg')) || {
        lowThresh: 1, lowColor: '#39FF14',
        midThresh: 11, midColor: '#FF9100',
        highThresh: 20, highColor: '#FF003C'
    };

    const style = document.createElement('style');
    document.head.appendChild(style);

    // Globalne zmienne kolorystyczne + dynamiczne style neonów
    const updateStyles = () => {
        style.innerHTML = `
            :root {
                --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147;
                --text-color: white; --title-color: #ffffdf;
                --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
                --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
                --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            }
            .tcm-neon-low { outline: 5px solid ${config.lowColor} !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px ${config.lowColor}, 0 0 5px${config.lowColor} !important; z-index: 10 !important; background: transparent !important; }
            .tcm-neon-mid { outline: 5px solid ${config.midColor} !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px ${config.midColor}, 0 0 5px${config.midColor} !important; z-index: 10 !important; background: transparent !important; }
            .tcm-neon-high { outline: 5px solid ${config.highColor} !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px ${config.highColor}, 0 0 5px${config.highColor} !important; z-index: 10 !important; background: transparent !important; }
            .tcm-mini-neon { position: absolute; border: 2px solid; width: 5px; height: 5px; box-sizing: border-box; background: transparent !important; z-index: 20; pointer-events: none; }
            .tcm-atk-overlay { position:absolute; width:250px; height:250px; pointer-events:none; z-index:10; }
            
            #tcm-settings-btn { position: fixed !important; bottom: 20px; left: 20px; z-index: 9999; background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 10px; border-radius: 5px; cursor: pointer; font-size: 16px; }
            #tcm-settings-btn:hover { background: var(--btn-hover); }
            
            #tcm-settings-panel { position: fixed !important; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: var(--bg-main); border: 2px solid var(--border-color); color: var(--text-color); padding: 15px; border-radius: 8px; display: none; width: 300px; max-width: 90vw; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-family: Tahoma, Arial, sans-serif;}
            #tcm-settings-panel h3 { margin: 0 0 15px 0; color: var(--title-color); text-align: center; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;}
            .tcm-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: var(--1. 📊 Ocena Ogólna
Skrypt stanowi bardzo dobrą bazę do wizualizacji zagrożeń na mapie, jednak w sztywny sposób narzucał progi kolorystyczne. Zgodnie z wytycznymi, trzon logiki rysującej i pobierającej pozostał nietknięty, a kod został obudowany o nowoczesny, pływający interfejs graficzny dostosowany do urządzeń mobilnych (z wykorzystaniem zadeklarowanej palety).

2. 🐛 Zidentyfikowane Błędy
* Niezgodny z naszymi standardami nagłówek skryptu (błędny autor, namespace oraz przestarzały format nazwy).
* Wartości progowe `11` oraz `20` były na sztywno wpisane (hardcoded) w dwóch różnych miejscach (mapa i minimapa), co utrudniało jakąkolwiek edycję.

3. 💡 Proponowane Rozwiązania
* Wdrożenie pływającego panelu `UI` w stylach `TCM` (zmienne `:root`), pozwalającego ustawić limity dla koloru pomarańczowego (średni) i czerwonego (wysoki).
* Integracja z `localStorage` – parametry są zapamiętywane między odświeżeniami strony 💾.
* Dodanie przycisku ⚙️ (Ustawienia), który pojawia się po zwinięciu głównego panelu, pozwalając zaoszczędzić miejsce na ekranie, zwłaszcza na przeglądarkach mobilnych.
* Zastąpienie twardych progów zmiennymi `cfg.mid` i `cfg.high`.

4. 🧩 Ocena Logiki
Logika główna pobierania ataków w tle oraz rysowania na mapie nie została zmieniona zgodnie z Twoim poleceniem. Należy jednak zwrócić uwagę, że `setInterval(updateView, 50)` to bardzo ciężka operacja – odpytywanie i pętla po całej siatce mapy co 50 milisekund zużywa sporo zasobów. Na ten moment zostało to zachowane, ale w przyszłości warto to przerobić na nasłuchiwanie zdarzeń z obiektu `TWMap`.

5. ⚡ Optymalizacje
* Elementy UI zyskały dyrektywę `position: fixed !important;`, by panel nie uciekał podczas przesuwania palcem po mapie.
* Wykorzystano standardowe przyciski z predefiniowanymi gradientami, aby interfejs spójnie integrował się z resztą naszych narzędzi.

6. ✅ Kod Poprawiony
```javascript
// ==UserScript==
// @name         Neonowe Ataki Mapa
// @namespace    [https://viayoo.com/](https://viayoo.com/)
// @version      1.3
// @description  Wizualizacja ataków na mapie i minimapie z konfigurowalnym progiem
// @author       TCM
// @match        *.plemiona.pl/game.php?*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let cfg = JSON.parse(localStorage.getItem('tcm_atk_cfg')) || { mid: 11, high: 20 };

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
        }
        .tcm-neon-low { outline: 5px solid #39FF14 !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px #39FF14, 0 0 5px #39FF14 !important; z-index: 10 !important; background: transparent !important; }
        .tcm-neon-mid { outline: 5px solid #FF9100 !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px #FF9100, 0 0 5px #FF9100 !important; z-index: 10 !important; background: transparent !important; }
        .tcm-neon-high { outline: 5px solid #FF003C !important; outline-offset: -5px !important; box-shadow: inset 0 0 10px #FF003C, 0 0 5px #FF003C !important; z-index: 10 !important; background: transparent !important; }
        .tcm-mini-neon { position: absolute; border: 2px solid #39FF14; width: 5px; height: 5px; box-sizing: border-box; background: transparent !important; box-shadow: 0 0 4px #39FF14; z-index: 20; pointer-events: none; }
        .tcm-atk-overlay { position:absolute; width:250px; height:250px; pointer-events:none; z-index:10; }
        
        #tcm-atk-ui {
            position: fixed !important; top: 80px; left: 10px; z-index: 9999;
            background: var(--bg-main); border: 1px solid var(--border-color);
            color: var(--text-color); padding: 10px; border-radius: 5px;
            font-size: 12px; width: 220px; box-shadow: 0 4px 6px rgba(0,0,0,0.5);
        }
        #tcm-atk-ui-header {
            background: var(--bg-header); margin: -10px -10px 10px -10px;
            padding: 8px 10px; color: var(--title-color); font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        #tcm-atk-ui input {
            background: var(--bg-row-alt); color: var(--text-color);
            border: 1px solid var(--border-color); width: 40px; padding: 2px;
            text-align: center; border-radius: 3px;
        }
        .tcm-btn { padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; color: white; font-weight: bold; }
        .tcm-btn-green { background: var(--btn-green-bg); }
        .tcm-btn-green:hover { background: var(--btn-green-hover); }
        .tcm-btn-red { background: var(--btn-red-bg); }
        .tcm-btn-red:hover { background: var(--btn-red-hover); }
        
        #tcm-atk-toggle {
            position: fixed !important; top: 80px; left: 10px; z-index: 9998;
            background: var(--btn-bg); color: var(--title-color); padding: 8px;
            border: 1px solid var(--border-color); border-radius: 5px; cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        #tcm-atk-toggle:hover { background: var(--btn-hover); }
    `;
    document.head.appendChild(style);

    const initUI = () => {
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'tcm-atk-toggle';
        toggleBtn.innerHTML = '⚙️ Ataki';
        toggleBtn.style.display = 'none';
        document.body.appendChild(toggleBtn);

        const ui = document.createElement('div');
        ui.id = 'tcm-atk-ui';
        ui.innerHTML = `
            <div id="tcm-atk-ui-header">
                <span>⚙️ Progi Kolorów</span>
                <span id="tcm-close-ui" style="cursor:pointer;">❌</span>
            </div>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #FF9100; font-weight: bold;">Pomarańczowy >=</span>
                <input type="number" id="tcm-mid-limit" value="${cfg.mid}" min="1">
            </div>
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #FF003C; font-weight: bold;">Czerwony >=</span>
                <input type="number" id="tcm-high-limit" value="${cfg.high}" min="2">
            </div>
            <div style="display: flex; justify-content: space-between;">
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
            cfg.mid = parseInt(document.getElementById('tcm-mid-limit').value) || 11;
            cfg.high = parseInt(document.getElementById('tcm-high-limit').value) || 20;
            localStorage.setItem('tcm_atk_cfg', JSON.stringify(cfg));
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
                        count >= cfg.high ? 'tcm-neon-high' :
                        count >= cfg.mid ? 'tcm-neon-mid' :
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
                        count >= cfg.high ? "#FF003C" :
                        count >= cfg.mid ? "#FF9100" :
                        "#39FF14";

                    html += `<div class="tcm-mini-neon" style="border-color:${color}; box-shadow:0 0 5px ${color}; left:${localX}px; top:${localY}px;"></div>`;
                }
            });

            if (container.innerHTML !== html)
                container.innerHTML = html;
        }
    };

    initUI();
    syncAttacks();
    setInterval(syncAttacks, 30000);
    setInterval(updateView, 50);

    $(document).ajaxStop(updateView);

})();
