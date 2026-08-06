// ==UserScript==
// @name         Wybijak_Monet
// @namespace    https://viayoo.com/
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*
// @match        *://*.plemiona.pl/game.php*screen=snob*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Dodanie stylów Shinko
    const style = document.createElement('style');
    style.textContent = `
        .tcm-shinko-panel { background-color: #36393f !important; border: 1px solid #3e4147 !important; color: #ffffff !important; font-family: Verdana, sans-serif !important; border-radius: 4px !important; box-shadow: 0 8px 30px rgba(0,0,0,0.7) !important; overflow: hidden !important; z-index: 10000; }
        .tcm-shinko-header { background-color: #202225 !important; border-bottom: 1px solid #3e4147 !important; color: #ffffdf !important; padding: 10px !important; font-weight: bold !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
        .tcm-shinko-btn { background: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%) !important; border: 1px solid #3e4147 !important; color: #ffffff !important; border-radius: 3px !important; cursor: pointer !important; font-weight: bold !important; transition: background 0.2s !important; padding: 8px; width: 100%; box-sizing: border-box; }
        .tcm-shinko-btn:hover { background: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%) !important; }
    `;
    document.head.appendChild(style);

    const urlKey = window.location.hostname.split('.')[0];
    let uiState = JSON.parse(localStorage.getItem(`wybijak_ui_${urlKey}`)) || { pinned: false, top: '10%', left: '50%' };
    
    const stworzUI = () => {
        if (document.getElementById('tcm-wybijak-wrapper')) return;

        const win = document.createElement('div');
        win.id = 'tcm-wybijak-wrapper';
        win.className = 'tcm-shinko-panel';
        win.style = `position: fixed; top: ${uiState.top}; left: ${uiState.left}; transform: ${uiState.pinned ? 'none' : 'translateX(-50%)'}; width: 95%; max-width: 320px;`;

        win.innerHTML = `
            <div id="tcm-header-w" class="tcm-shinko-header" style="cursor: ${uiState.pinned ? 'default' : 'move'};">
                <span>🪙 MASOWE WYBIJANIE</span>
                <div>
                    <span id="pin-btn-w" style="cursor: pointer; margin-right: 10px;" title="Przypnij pozycję">📌</span>
                    <span id="close-wybijak" style="cursor: pointer; color: #ff4444; font-size: 14px;" title="Zamknij">✖</span>
                </div>
            </div>
            <div style="padding: 15px; text-align: center; background-color: #2f3136;">
                <button id="start-wybijak" class="tcm-shinko-btn">Uruchom Wybijanie</button>
                <div id="wybijak-status" style="margin-top: 10px; font-size: 12px; font-weight: bold; color: #ffffdf;"></div>
            </div>
        `;
        document.body.appendChild(win);

        // Obsługa Drag & Drop oraz Pin
        const header = document.getElementById('tcm-header-w');
        const pinBtn = document.getElementById('pin-btn-w');
        
        pinBtn.style.opacity = uiState.pinned ? '1' : '0.4';

        pinBtn.onclick = () => {
            uiState.pinned = !uiState.pinned;
            pinBtn.style.opacity = uiState.pinned ? '1' : '0.4';
            header.style.cursor = uiState.pinned ? 'default' : 'move';
            win.style.transform = uiState.pinned ? 'none' : 'translateX(-50%)';
            localStorage.setItem(`wybijak_ui_${urlKey}`, JSON.stringify(uiState));
        };
        
        document.getElementById('close-wybijak').onclick = () => win.style.display = 'none';

        // Logika aktywacji
        document.getElementById('start-wybijak').onclick = async () => {
            const status = document.getElementById('wybijak-status');
            
            // --- KOMPLEKSOWE ZBIERANIE ID WIOSEK Z RÓŻNYCH WIDOKÓW ---
            let wioski = [];
            
            // 1. Sprawdzamy Przegląd dla graczy z KP (Konto Premium)
            const spanWiosek = document.querySelectorAll('span.quickedit-vn[data-id]');
            
            // 2. Sprawdzamy widok Masowego Wybijania w Pałacu
            const wierszePalacu = document.querySelectorAll('tr[id^="village_"]');
            
            if (spanWiosek.length > 0) {
                wioski = Array.from(spanWiosek).map(el => el.getAttribute('data-id'));
            } 
            else if (wierszePalacu.length > 0) {
                wioski = Array.from(wierszePalacu).map(tr => tr.id.replace('village_', ''));
            } 
            else {
                // 3. Widok Przeglądu bez KP (wyciąganie ID z linków w głównej tabeli)
                const tabelaPrzegladu = document.getElementById('production_table') || document.getElementById('combined_table');
                if (tabelaPrzegladu) {
                    const linki = tabelaPrzegladu.querySelectorAll('a[href*="village="]');
                    linki.forEach(a => {
                        const match = a.href.match(/[?&]village=(\d+)/);
                        if (match && match[1]) wioski.push(match[1]);
                    });
                } 
                // 4. Pojedynczy widok Pałacu (pobieramy ID obecnej wioski z pamięci gry)
                else if (window.game_data && window.game_data.village && window.game_data.village.id) {
                    wioski.push(window.game_data.village.id);
                }
            }
            
            // Usuwamy duplikaty
            wioski = [...new Set(wioski)];
            
            if (wioski.length === 0) {
                status.innerHTML = "Nie znaleziono wiosek! Otwórz Pałac lub Przegląd.";
                status.style.color = "#ff4444";
                return;
            }

            status.style.color = "#ffffdf";
            const token = window.game_data.csrf;
            for (let i = 0; i < wioski.length; i++) {
                status.innerHTML = `Przetwarzanie: ${i + 1} / ${wioski.length}`;
                await fetch(`/game.php?village=${wioski[i]}&screen=snob&action=start_auto_minting_session&h=${token}`, { method: 'POST' });
                await new Promise(r => setTimeout(r, 300));
            }
            status.innerHTML = "Gotowe!";
            status.style.color = "#00ff00";
        };
    };

    setTimeout(stworzUI, 500);
})();
