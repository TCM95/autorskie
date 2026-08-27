// ==UserScript==
// @name        zbieracz (Pojedyncza Wioska)
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Automatyzacja pojedynczego zbieraka na start serwera, ładująca zewnętrzny kod
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=place&mode=scavenge*
// ==/UserScript==

(function () {
    'use strict';

    // Style UI z pakietu EMOI i Twoich standardów
    const cssVariables = `
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
        #tcm-scav-ui { background-color: var(--bg-main); border: 2px solid var(--border-color); color: var(--text-color); font-family: monospace; }
        #tcm-scav-ui input { background-color: var(--bg-row-alt); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 3px; outline: none; }
        .tcm-btn { background: var(--btn-bg); border: 1px solid var(--border-color); color: white; padding: 6px; border-radius: 4px; cursor: pointer; text-align: center; margin-top: 5px; }
        .tcm-btn:hover { background: var(--btn-hover); }
        .tcm-btn-start { background: var(--btn-green-bg); font-weight: bold; }
        .tcm-btn-start:hover { background: var(--btn-green-hover); }
        .tcm-btn-stop { background: var(--btn-red-bg); font-weight: bold; }
        .tcm-btn-stop:hover { background: var(--btn-red-hover); }
    `;
    const style = document.createElement('style');
    style.innerHTML = cssVariables;
    document.head.appendChild(style);

    const urlKey = window.location.hostname.split('.')[0];
    let isRunning = localStorage.getItem(`tcm_wrap_run_${urlKey}`) === 'true';
    let delayConfig = JSON.parse(localStorage.getItem(`tcm_wrap_delay_${urlKey}`)) || { min: 2, max: 5 };
    let uiState = JSON.parse(localStorage.getItem(`tcm_wrap_ui_${urlKey}`)) || { top: 'auto', left: 'auto', bottom: '150px', right: '20px' };

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Interfejs pływający (Drag & Drop, position: fixed)
    function createUI() {
        const div = document.createElement('div');
        div.id = 'tcm-scav-ui';
        div.style.position = 'fixed'; // Zapewnia stałą pozycję niezależnie od scrolla
        div.style.zIndex = '99999';
        div.style.padding = '12px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        div.style.userSelect = 'none';
        div.style.width = '180px';

        div.style.top = uiState.top;
        div.style.left = uiState.left;
        if(uiState.top === 'auto') {
            div.style.bottom = uiState.bottom;
            div.style.right = uiState.right;
        }

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'center';
        header.style.marginBottom = '8px';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.style.paddingBottom = '4px';
        header.style.cursor = 'move';

        const title = document.createElement('span');
        title.innerHTML = '⚙️ Auto-Zbierak';
        title.style.color = 'var(--title-color)';
        title.style.fontWeight = 'bold';
        header.appendChild(title);

        const statusLabel = document.createElement('div');
        statusLabel.id = 'tcm-status';
        statusLabel.style.textAlign = 'center';
        statusLabel.style.marginBottom = '8px';
        statusLabel.style.fontWeight = 'bold';
        statusLabel.style.color = isRunning ? '#5cad5c' : '#ad5c5c';
        statusLabel.textContent = isRunning ? "✅️ Działa..." : "❌ Wyłączony";

        const delayRow = document.createElement('div');
        delayRow.style.display = 'flex';
        delayRow.style.justifyContent = 'space-between';
        delayRow.style.marginBottom = '8px';
        delayRow.style.fontSize = '12px';
        
        const delayInputs = document.createElement('div');
        const minInput = document.createElement('input');
        minInput.type = 'number'; minInput.value = delayConfig.min; minInput.style.width = '35px'; minInput.style.textAlign = 'center';
        const maxInput = document.createElement('input');
        maxInput.type = 'number'; maxInput.value = delayConfig.max; maxInput.style.width = '35px'; maxInput.style.textAlign = 'center';
        
        const saveDelay = () => {
            delayConfig = { min: parseInt(minInput.value)||1, max: parseInt(maxInput.value)||2 };
            localStorage.setItem(`tcm_wrap_delay_${urlKey}`, JSON.stringify(delayConfig));
        };
        minInput.addEventListener('change', saveDelay);
        maxInput.addEventListener('change', saveDelay);
        
        delayInputs.appendChild(minInput);
        delayInputs.appendChild(document.createTextNode('-'));
        delayInputs.appendChild(maxInput);
        delayRow.innerHTML = `<span>Opóźn.(s):</span>`;
        delayRow.appendChild(delayInputs);

        const btnStart = document.createElement('div');
        btnStart.className = isRunning ? 'tcm-btn tcm-btn-stop' : 'tcm-btn tcm-btn-start';
        btnStart.textContent = isRunning ? "❎️ Stop" : "✅️ Start";
        btnStart.onclick = () => {
            isRunning = !isRunning;
            localStorage.setItem(`tcm_wrap_run_${urlKey}`, isRunning);
            location.reload();
        };

        div.appendChild(header);
        div.appendChild(statusLabel);
        div.appendChild(delayRow);
        div.appendChild(btnStart);
        document.body.appendChild(div);

        // Mechanizm przesuwania okienka
        let isDragging = false, startX, startY, initialX, initialY;
        const startDrag = (e) => {
            if (e.target.tagName === 'INPUT') return;
            isDragging = true;
            let event = e.type.includes('mouse') ? e : e.touches[0];
            startX = event.clientX; startY = event.clientY;
            initialX = div.offsetLeft; initialY = div.offsetTop;
            div.style.bottom = 'auto'; div.style.right = 'auto';
        };
        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let event = e.type.includes('mouse') ? e : e.touches[0];
            div.style.left = (initialX + (event.clientX - startX)) + 'px';
            div.style.top = (initialY + (event.clientY - startY)) + 'px';
        };
        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            uiState.top = div.style.top; uiState.left = div.style.left;
            localStorage.setItem(`tcm_wrap_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        header.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    // Główna logika (Pętla w jednej wiosce)
    function processScavengeLoop() {
        if (!isRunning) return;
        const status = document.getElementById('tcm-status');
        const delay = randomDelay(delayConfig.min, delayConfig.max) * 1000;
        
        setTimeout(() => {
            let totalAvailable = 0;
            $('.units-entry-all').each((i, e) => {
                totalAvailable += parseInt($(e).text().replace(/[()]/g, ''));
            });
            let availableButtons = $('.free_send_button:not(.btn-disabled)');

            // Jeśli brakuje wojska lub nie ma wolnych poziomów zbiórki
            if (totalAvailable < 10 || availableButtons.length === 0) {
                status.textContent = "⌛ Czekam (60s)...";
                status.style.color = '#e2a445';
                
                // Czekamy 60 sekund i odświeżamy stronę, by sprawdzić ponownie
                setTimeout(() => {
                    location.reload();
                }, 60000);
                return;
            }

            // Mamy wojsko -> Odpalamy zewnetrzny skrypt
            status.textContent = "⚙️ Liczenie...";
            $.getScript('https://shinko-to-kuma.com/scripts/scavengingFinal.js', function() {
                
                setTimeout(() => {
                    status.textContent = "🚀 Wysyłanie...";
                    
                    let clickExecuted = false;
                    $('.scavenge-option').each(function() {
                        let btn = $(this).find('.free_send_button:not(.btn-disabled)');
                        let inputs = $(this).find('input.unitsInput');
                        let hasUnitsFilled = false;
                        
                        inputs.each(function() {
                            if (parseInt($(this).val()) > 0) hasUnitsFilled = true;
                        });

                        // Klikamy przycisk pierwszej opcji, która ma wpisane wojska
                        if (btn.length > 0 && hasUnitsFilled && !clickExecuted) {
                            btn.click();
                            clickExecuted = true;
                            // ദ്ദി ˉ͈̀꒳ˉ͈́ )✧
                        }
                    });

                    if (clickExecuted) {
                        // Gra robi update AJAX bez reloadu. Czekamy i ponawiamy dla tej samej wioski.
                        setTimeout(processScavengeLoop, randomDelay(2000, 3000));
                    } else {
                        status.textContent = "⚠️ Błąd (Reload)";
                        setTimeout(() => { location.reload(); }, 2000);
                    }

                }, 1000); // 1 sekunda dla zewnętrznego skryptu na wpisanie wartości w inputy
            });

        }, delay);
    }

    createUI();
    if (isRunning) {
        processScavengeLoop();
    }
})();
