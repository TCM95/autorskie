// ==UserScript==
// @name         Monety
// @namespace    https://viayoo.com/
// @version      1.3
// @description  Skrypt do masowego sterowania wybijaniem monet (Mini UI)
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=snob*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
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
        .tcm-mini-panel { background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; width: 130px; margin: 10px auto; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.5); }
        .tcm-btn-row { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 6px; }
        .tcm-mini-btn { background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 16px; padding: 8px 0; flex: 1; display: flex; align-items: center; justify-content: center; }
        .tcm-mini-btn:active { background: var(--btn-hover); }
        .tcm-btn-start { color: #00ff00; }
        .tcm-btn-stop { color: #ff4444; }
        .tcm-status { font-size: 11px; font-weight: bold; color: var(--title-color); }
    `;
    document.head.appendChild(style);

    const stworzUI = () => {
        const tabela = document.getElementById('coin_overview_table');
        if (!tabela || document.getElementById('tcm-wybijak-mini')) return;

        const container = document.createElement('div');
        container.id = 'tcm-wybijak-mini';
        container.className = 'tcm-mini-panel';
        container.innerHTML = `
            <div class="tcm-btn-row">
                <button id="tcm-start" class="tcm-mini-btn tcm-btn-start">✅️</button>
                <button id="tcm-stop" class="tcm-mini-btn tcm-btn-stop">❎️</button>
            </div>
            <div id="tcm-status" class="tcm-status">- / -</div>
        `;

        tabela.parentNode.insertBefore(container, tabela);

        const statusLabel = document.getElementById('tcm-status');
        let shouldStop = false;

        const akcja = async (typ) => {
            shouldStop = (typ === 'stop');
            const wiersze = document.querySelectorAll('tr[id^="village_"]');
            const token = window.game_data.csrf;
            
            if (wiersze.length === 0) {
                statusLabel.innerHTML = "Brak";
                statusLabel.style.color = "#ff4444";
                return;
            }

            statusLabel.style.color = "var(--title-color)";
            
            for (let i = 0; i < wiersze.length; i++) {
                if (shouldStop && typ === 'start') {
                    statusLabel.innerHTML = "Stop";
                    statusLabel.style.color = "#ffaa00";
                    return;
                }
                
                statusLabel.innerHTML = `${i + 1} / ${wiersze.length}`;
                const vid = wiersze[i].id.replace('village_', '');
                const actionUrl = typ === 'start' ? 'start_auto_minting_session' : 'stop_auto_minting_session';
                
                await fetch(`/game.php?village=${vid}&screen=snob&action=${actionUrl}&h=${token}`, { method: 'POST' });
                await new Promise(r => setTimeout(r, 1000));
            }
            
            statusLabel.innerHTML = "Gotowe!";
            statusLabel.style.color = "#00ff00";
        };

        document.getElementById('tcm-start').onclick = () => akcja('start');
        document.getElementById('tcm-stop').onclick = () => akcja('stop');
    };

    setTimeout(stworzUI, 1000);
})();
