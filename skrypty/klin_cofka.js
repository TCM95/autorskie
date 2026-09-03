// ==UserScript==
// @name         Klin z Cofki Ręczny (Minimal UI)
// @namespace    https://viayoo.com/
// @version      1.3
// @description  Planowanie klina z cofki z minimalistycznymi przyciskami (dostosowane pod ekrany dotykowe)
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- STYL SHINKO (CSS) - UZUPEŁNIONY WZORZEC ---
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
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
        }

        /* Przyciski zoptymalizowane pod dotyk */
        .shinko-btn-snipe {
            background: var(--btn-bg) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 16px !important;
            padding: 6px 14px !important;
            margin-left: 6px !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important;
            transition: all 0.2s;
            touch-action: manipulation;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 44px;
            min-height: 36px;
        }

        .shinko-btn-snipe:hover {
            background: var(--btn-hover) !important;
        }

        .shinko-btn-active {
            background: var(--btn-red-bg) !important;
            border-color: #da3633 !important;
            color: #ffffff !important;
        }

        .shinko-btn-active:hover {
            background: var(--btn-red-hover) !important;
        }

        .shinko-timer-display {
            margin-left: 8px !important;
            font-weight: bold !important;
            font-family: monospace !important;
            font-size: 12px !important;
            padding: 4px 6px !important;
            background-color: var(--bg-header) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 3px !important;
            vertical-align: middle;
        }

        /* Nowe style dla RĘCZNEGO PANELU */
        .tcm-manual-panel {
            background: var(--bg-main);
            border: 1px solid var(--border-color);
            margin: 15px 0;
            padding: 12px;
            border-radius: 6px;
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: flex-start;
            flex-wrap: wrap;
            gap: 12px;
        }

        .tcm-manual-panel span.tcm-label {
            font-weight: bold;
            color: var(--title-color);
            font-size: 13px;
        }

        .tcm-manual-input {
            background: var(--bg-row-alt);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            padding: 8px;
            border-radius: 4px;
            width: 140px;
            text-align: center;
            font-family: monospace;
            font-size: 14px;
        }
    `;
    document.head.appendChild(style);

    let globalAnimationFrameId = null;
    let globalActiveButton = null;
    let globalTimerDisplay = null;

    function parseTimeFromText(text) {
        if (!text) return null;
        text = text.trim();
        const match = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/);
        if (!match) return null;
        
        const h = Number(match[1]);
        const m = Number(match[2]);
        const s = Number(match[3]);
        const ms = match[4] ? Number(match[4].padEnd(3, '0')) : 0; 

        const d = new Date(Timing.getCurrentServerTime());
        d.setHours(h, m, s, ms);

        if (d.getTime() < Timing.getCurrentServerTime() - 3600000) {
            d.setDate(d.getDate() + 1);
        }
        return d.getTime();
    }

    function stopCurrentSnipe() {
        if (globalAnimationFrameId) {
            cancelAnimationFrame(globalAnimationFrameId);
            globalAnimationFrameId = null;
        }
        if (globalActiveButton) {
            globalActiveButton.innerHTML = globalActiveButton.dataset.originalText || '⚔️';
            globalActiveButton.classList.remove('shinko-btn-active');
            globalActiveButton = null;
        }
        if (globalTimerDisplay) {
            globalTimerDisplay.textContent = "";
            globalTimerDisplay.style.display = "none";
            globalTimerDisplay = null;
        }
    }

    function startSnipeEngine(btnElement, timerElement, targetMs, specificCancelLink = null) {
        const savedStart = sessionStorage.getItem("snip_start_time");

        if (!targetMs) {
            UI.ErrorMessage("Nie udało się odczytać czasu. Format: HH:MM:SS:ms");
            return;
        }
        if (!savedStart) {
            UI.ErrorMessage("Brak czasu wysłania wojska. Wyślij wojsko z ekranu potwierdzenia!");
            return;
        }

        const startMs = Number(savedStart);
        const cancelTimeMs = startMs + (targetMs - startMs) / 2;

        if (cancelTimeMs <= Timing.getCurrentServerTime()) {
             UI.ErrorMessage("Czas na anulowanie już minął!");
             return;
        }

        btnElement.dataset.originalText = btnElement.innerHTML;
        
        globalActiveButton = btnElement;
        globalTimerDisplay = timerElement;
        
        btnElement.innerHTML = '❌';
        btnElement.classList.add('shinko-btn-active');
        timerElement.style.display = "inline-block";
        UI.SuccessMessage("Klin z cofki pomyślnie zaplanowany!");

        function checkTime() {
            const now = Timing.getCurrentServerTime();
            const diff = cancelTimeMs - now;

            if (diff <= 0) {
                timerElement.textContent = "COFANIE...";
                timerElement.style.color = "#ff4444";
                
                // Użycie konkretnego linku anulowania (jeśli dostarczono) lub pierwszego z brzegu
                const btnCancel = specificCancelLink || document.querySelector("a.command-cancel");
                
                if (btnCancel) {
                    btnCancel.click();
                } else {
                    UI.ErrorMessage("Nie znaleziono przycisku anulowania!");
                }

                btnElement.innerHTML = btnElement.dataset.originalText;
                btnElement.classList.remove('shinko-btn-active');
                globalActiveButton = null;
                globalAnimationFrameId = null;
                return;
            }

            timerElement.textContent = "Cofka za: " + (diff / 1000).toFixed(3) + "s";
            timerElement.style.color = "#55ff55";
            
            globalAnimationFrameId = requestAnimationFrame(checkTime);
        }

        globalAnimationFrameId = requestAnimationFrame(checkTime);
    }

    // Zapisywanie czasu startu
    if (window.location.href.includes("try=confirm")) {
        const confirmBtn = document.querySelector("#troop_confirm_submit");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
                sessionStorage.setItem("snip_start_time", Timing.getCurrentServerTime());
            });
        }
        return;
    }

    function setupManualUI() {
        const targetContainer = document.querySelector('#paged_view_content') || document.querySelector('.maincolumn');
        if(!targetContainer) return;

        const manualPanel = document.createElement('div');
        manualPanel.className = 'tcm-manual-panel';
        
        manualPanel.innerHTML = `
            <span class="tcm-label">Wejście (Cel):</span>
            <input type="text" id="tcm_manual_time" class="tcm-manual-input" placeholder="np. 14:30:15:123">
            <button id="tcm_manual_btn" class="shinko-btn-snipe">⚔️</button>
            <span id="tcm_manual_timer" class="shinko-timer-display" style="display:none;"></span>
        `;

        targetContainer.insertBefore(manualPanel, targetContainer.firstChild);

        const btn = document.getElementById('tcm_manual_btn');
        const input = document.getElementById('tcm_manual_time');
        const timer = document.getElementById('tcm_manual_timer');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (globalActiveButton === btn) {
                stopCurrentSnipe();
                return;
            }

            stopCurrentSnipe();
            const targetMs = parseTimeFromText(input.value);
            startSnipeEngine(btn, timer, targetMs, null); // Manual użyje pierwszego dostępnego anulowania
        });
    }

    function setupRowButtons() {
        const commandRows = document.querySelectorAll('tr.command-row');
        
        commandRows.forEach(row => {
            const nameCell = row.querySelector('td:first-child') || row.querySelector('td');
            if(!nameCell) return;

            // Szukanie linku anulowania w obrębie danego wiersza
            const specificCancelLink = row.querySelector('a.command-cancel');

            const btn = document.createElement('button');
            btn.className = 'shinko-btn-snipe';
            btn.innerHTML = '⚔️';
            
            const timerDisplay = document.createElement('span');
            timerDisplay.className = 'shinko-timer-display';
            timerDisplay.style.display = "none";
            
            nameCell.appendChild(btn);
            nameCell.appendChild(timerDisplay);

            btn.onclick = (e) => {
                e.preventDefault();
                
                if (globalActiveButton === btn) {
                    stopCurrentSnipe();
                    return;
                }

                stopCurrentSnipe();
                const targetMs = parseTimeFromText(row.innerText);
                // Przekazujemy konkretny link anulowania przypisany do tego wiersza
                startSnipeEngine(btn, timerDisplay, targetMs, specificCancelLink);
            };
        });
    }

    if (window.location.href.includes("screen=place")) {
        setupManualUI();
        setupRowButtons();
    }
})();
