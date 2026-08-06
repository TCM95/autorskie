// ==UserScript==
// @name         Wybijak Monet - Shinko Theme
// @namespace    https://viayoo.com/
// @author       TCM
// @description  Wybijanie monet z panelem i odliczaniem w stylu Shinko Theme.
// @match        *://*.plemiona.pl/game.php*screen=snob*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Wstrzyknięcie dedykowanych stylów Shinko
    const style = document.createElement('style');
    style.textContent = `
        .tcm-shinko-panel {
            background-color: #36393f !important;
            border: 1px solid #3e4147 !important;
            color: #ffffff !important;
            font-family: Verdana, sans-serif !important;
            border-radius: 4px !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
            overflow: hidden !important;
            margin-bottom: 15px;
        }
        .tcm-shinko-header {
            background-color: #202225 !important;
            border-bottom: 1px solid #3e4147 !important;
            color: #ffffdf !important;
            padding: 6px 10px !important;
            font-weight: bold !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        .tcm-shinko-btn {
            background: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%) !important;
            border: 1px solid #3e4147 !important;
            color: #ffffff !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            transition: background 0.2s !important;
            padding: 4px 8px !important;
        }
        .tcm-shinko-btn:hover {
            background: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%) !important;
        }
        .tcm-shinko-input {
            background-color: #202225 !important;
            border: 1px solid #3e4147 !important;
            color: #ffffff !important;
            border-radius: 3px !important;
            text-align: center !important;
            padding: 2px !important;
        }
    `;
    document.head.appendChild(style);

    const getSetting = (key, defaultValue) => localStorage.getItem('at_mint_' + key) || defaultValue;
    const saveSetting = (key, value) => localStorage.setItem('at_mint_' + key, value);

    let isRunning = getSetting('running', '0') === '1';
    let minTime = parseInt(getSetting('minTime', '300'));
    let maxTime = parseInt(getSetting('maxTime', '600'));

    const setupUI = () => {
        const statusColor = isRunning ? '#00ff00' : '#ff4444';

        const container = $('<div id="mint_panel" class="tcm-shinko-panel" style="display: inline-block; min-width: 250px;"></div>');

        const header = $(`
            <div class="tcm-shinko-header">
                <span>Wybijak Monet <span id="status_dot" style="color: ${statusColor}; text-shadow: 0 0 3px black;">●</span></span>
                <span id="timer_display" style="font-weight: normal; min-width: 40px; text-align: right; color: #ffffff;"></span>
            </div>
        `);

        const content = $(`
            <div style="padding: 8px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; gap: 5px;">
                    <span>Odświeżanie (s):</span>
                    <div>
                        <input type="number" id="min_input" class="tcm-shinko-input" value="${minTime}" style="width: 45px;" title="Minimum sekund">
                        <input type="number" id="max_input" class="tcm-shinko-input" value="${maxTime}" style="width: 45px;" title="Maksimum sekund">
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button id="btn_toggle" class="tcm-shinko-btn" style="flex: 1;">${isRunning ? 'Wyłącz Auto-Wybijanie' : 'Włącz Auto-Wybijanie'}</button>
                </div>
            </div>
        `);

        container.append(header).append(content);

        // Umiejscowienie panelu nad główną zawartością gry
        $("#content_value").prepend(container);

        $('#min_input').on('change', function() { saveSetting('minTime', $(this).val()); });
        $('#max_input').on('change', function() { saveSetting('maxTime', $(this).val()); });

        $('#btn_toggle').on('click', function() {
            isRunning = !isRunning;
            saveSetting('running', isRunning ? '1' : '0');
            location.reload();
        });
    };

    const executeMinting = () => {
        // Skrypt szuka przycisku "Zaznacz wszystkie" (może to być id #select_anchor_top w zależności od widoku)
        const selectAllBtn = $('#select_anchor_top');
        if (selectAllBtn.length) {
            selectAllBtn.trigger('click');
            
            setTimeout(() => {
                // Po zaznaczeniu szuka przycisku odpowiadającego za wybicie ("Wybij monety")
                const mintBtn = $('form[action*="action=train"] input[type="submit"]');
                if (mintBtn.length) {
                    mintBtn.trigger('click');
                }
            }, 1000);
        }
    };

    if (isRunning) {
        const randomSeconds = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        let timeLeft = randomSeconds;

        setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) location.reload();
            if ($('#timer_display').length) {
                $('#timer_display').text(timeLeft + "s");
            }
        }, 1000);

        // Uruchomienie wybijania chwilę po załadowaniu (żeby DOM zdążył przetworzyć wszystko)
        setTimeout(() => {
           executeMinting();
        }, 2000);
    }

    $(document).ready(function() {
        setupUI();
    });
})();
