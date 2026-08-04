// ==UserScript==
// @name         Wybijak_Monet_TCM
// @namespace    https://viayoo.com/
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const urlKey = window.location.hostname.split('.')[0];
    let uiState = JSON.parse(localStorage.getItem(`wybijak_ui_${urlKey}`)) || { pinned: false, top: '10%', left: '50%' };
    
    const stworzUI = () => {
        if (document.getElementById('tcm-wybijak-wrapper')) return;

        const win = document.createElement('div');
        win.id = 'tcm-wybijak-wrapper';
        win.style = `position: fixed; top: ${uiState.top}; left: ${uiState.left}; transform: ${uiState.pinned ? 'none' : 'translateX(-50%)'}; z-index: 10000; background: #e3d5b3; border: 2px solid #603000; border-radius: 6px; width: 95%; max-width: 320px; box-shadow: 0 8px 30px rgba(0,0,0,0.7); font-family: Verdana, sans-serif;`;

        win.innerHTML = `
            <div id="tcm-header-w" style="background: #3e2711; color: #fff; padding: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; cursor: ${uiState.pinned ? 'default' : 'move'};">
                <span>🪙 MASOWE WYBIJANIE</span>
                <div>
                    <span id="pin-btn-w" style="cursor: pointer; margin-right: 10px;">${uiState.pinned ? '📌' : '📍'}</span>
                    <span id="close-wybijak" style="cursor: pointer; background: #8b0000; padding: 2px 8px; border-radius: 3px; font-size: 11px;">X</span>
                </div>
            </div>
            <div style="padding: 10px; text-align: center;">
                <button id="start-wybijak" class="btn" style="width: 100%; padding: 8px; background: #004080; color: white; font-weight: bold; border-radius: 3px; border: 1px solid #002240;">Uruchom Wybijanie</button>
                <div id="wybijak-status" style="margin-top: 10px; font-size: 12px; font-weight: bold;"></div>
            </div>
        `;
        document.body.appendChild(win);

        // Obsługa Drag & Drop oraz Pin
        const header = document.getElementById('tcm-header-w');
        const pinBtn = document.getElementById('pin-btn-w');
        pinBtn.onclick = () => {
            uiState.pinned = !uiState.pinned;
            pinBtn.innerHTML = uiState.pinned ? '📌' : '📍';
            header.style.cursor = uiState.pinned ? 'default' : 'move';
            win.style.transform = uiState.pinned ? 'none' : 'translateX(-50%)';
            localStorage.setItem(`wybijak_ui_${urlKey}`, JSON.stringify(uiState));
        };
        
        document.getElementById('close-wybijak').onclick = () => win.style.display = 'none';

        // Logika aktywacji
        document.getElementById('start-wybijak').onclick = async () => {
            const status = document.getElementById('wybijak-status');
            // Zmiana: Szukamy wszystkich spanów z danymi wioski
            const elementyWioski = document.querySelectorAll('span.quickedit-vn[data-id]');
            const wioski = Array.from(elementyWioski).map(el => el.getAttribute('data-id'));
            
            if (wioski.length === 0) {
                status.innerHTML = "Nie znaleziono wiosek!";
                return;
            }

            const token = game_data.csrf;
            for (let i = 0; i < wioski.length; i++) {
                status.innerHTML = `Przetwarzanie: ${i + 1} / ${wioski.length}`;
                await fetch(`/game.php?village=${wioski[i]}&screen=snob&action=start_auto_minting_session&h=${token}`, { method: 'POST' });
                await new Promise(r => setTimeout(r, 300));
            }
            status.innerHTML = "Gotowe!";
        };
    };

    setTimeout(stworzUI, 500);
})();
