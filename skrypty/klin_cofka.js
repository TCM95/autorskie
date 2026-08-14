// ==UserScript==
// @name         Klin_z_Cofki (Shinko UI)
// @namespace    https://viayoo.com/
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- STYL SHINKO (CSS) ---
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

        .shinko-btn-snipe {
            background: var(--btn-bg) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-size: 11px !important;
            padding: 2px 6px !important;
            margin-left: 6px !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
            transition: all 0.2s;
        }

        .shinko-btn-snipe:hover {
            background: var(--btn-hover) !important;
            color: #ffffff !important;
        }

        .shinko-btn-active {
            background: linear-gradient(#da3633 0%, #b62324 100%) !important;
            border-color: #da3633 !important;
            color: #ffffff !important;
        }

        .shinko-timer-display {
            margin-left: 8px !important;
            font-weight: bold !important;
            font-family: monospace !important;
            font-size: 11px !important;
            padding: 2px 4px !important;
            background-color: var(--bg-header) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 3px !important;
        }
    `;
    document.head.appendChild(style);

    // Globalne zmienne do zarządzania stanem odliczania
    let globalAnimationFrameId = null;
    let globalActiveButton = null;
    let globalTimerDisplay = null;

    function parseTimeFromText(text) {
        // Szuka czasu w formacie HH:MM:SS oraz opcjonalnie milisekund HH:MM:SS:ms lub HH:MM:SS.ms
        const match = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/);
        if (!match) return null;
        
        const h = Number(match[1]);
        const m = Number(match[2]);
        const s = Number(match[3]);
        const ms = match[4] ? Number(match[4].padEnd(3, '0')) : 0; 

        const d = new Date(Timing.getCurrentServerTime());
        d.setHours(h, m, s, ms);

        // Jeśli czas z wiersza jest z przeszłości, dodajemy 24h
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
            globalActiveButton.innerHTML = '⚔️ Zaplanuj cofkę';
            globalActiveButton.classList.remove('shinko-btn-active');
            globalActiveButton = null;
        }
        if (globalTimerDisplay) {
            globalTimerDisplay.textContent = "";
            globalTimerDisplay.style.display = "none";
            globalTimerDisplay = null;
        }
    }

    // ZAPIS CZASU STARTU NA EKRANIE POTWIERDZENIA
    if (window.location.href.includes("try=confirm")) {
        const confirmBtn = document.querySelector("#troop_confirm_submit");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
                sessionStorage.setItem("snip_start_time", Timing.getCurrentServerTime());
            });
        }
        return;
    }

    // INICJALIZACJA PRZYCISKÓW W TABELACH ROZKAZÓW NA PLACU
    function setupRowButtons() {
        const commandRows = document.querySelectorAll('tr.command-row');
        
        commandRows.forEach(row => {
            const nameCell = row.querySelector('td:first-child') || row.querySelector('td');
            if(!nameCell) return;

            const btn = document.createElement('button');
            btn.className = 'shinko-btn-snipe';
            btn.innerHTML = '⚔️ Zaplanuj cofkę';
            btn.title = "Ustaw ten czas wejścia jako cel klina";

            const timerDisplay = document.createElement('span');
            timerDisplay.className = 'shinko-timer-display';
            timerDisplay.style.display = "none";
            
            // Dodajemy przycisk obok nazwy rozkazu
            nameCell.appendChild(btn);
            nameCell.appendChild(timerDisplay);

            btn.onclick = (e) => {
                e.preventDefault();
                
                // Jeśli ten konkretny przycisk jest aktywny, to go wyłączamy (Anulowanie)
                if (globalActiveButton === btn) {
                    stopCurrentSnipe();
                    return;
                }

                // Włączanie nowego odliczania (zatrzymując ew. poprzednie)
                stopCurrentSnipe();

                const targetMs = parseTimeFromText(row.innerText);
                const savedStart = sessionStorage.getItem("snip_start_time");

                if (!targetMs) {
                    UI.ErrorMessage("Nie udało się odczytać czasu wejścia z tego rozkazu.");
                    return;
                }
                if (!savedStart) {
                    UI.ErrorMessage("Najpierw wyślij wojsko z ekranu potwierdzenia (brak czasu wysłania).");
                    return;
                }

                const startMs = Number(savedStart);
                const cancelTimeMs = startMs + (targetMs - startMs) / 2;

                if (cancelTimeMs <= Timing.getCurrentServerTime()) {
                     UI.ErrorMessage("Czas anulowania klina dla tego ataku już minął!");
                     return;
                }

                // Uruchamianie UI odliczania dla klikniętego wiersza
                globalActiveButton = btn;
                globalTimerDisplay = timerDisplay;
                
                btn.innerHTML = '❌ Anuluj';
                btn.classList.add('shinko-btn-active');
                timerDisplay.style.display = "inline-block";
                UI.SuccessMessage("Klin zaplanowany!");

                function checkTime() {
                    const now = Timing.getCurrentServerTime();
                    const diff = cancelTimeMs - now;

                    if (diff <= 0) {
                        timerDisplay.textContent = "COFANIE...";
                        timerDisplay.style.color = "#ff4444";
                        
                        const btnCancel = document.querySelector("a.command-cancel");
                        if (btnCancel) {
                            btnCancel.click();
                        } else {
                            UI.ErrorMessage("Zabrakło przycisku 'Anuluj'! Zbyt późno lub rozkaz nie istnieje.");
                        }

                        // Reset UI po kliknięciu
                        btn.innerHTML = '⚔️ ';
                        btn.classList.remove('shinko-btn-active');
                        globalActiveButton = null;
                        globalAnimationFrameId = null;
                        return;
                    }

                    timerDisplay.textContent = "Cofka za: " + (diff / 1000).toFixed(3) + "s";
                    timerDisplay.style.color = "#55ff55";
                    
                    globalAnimationFrameId = requestAnimationFrame(checkTime);
                }

                globalAnimationFrameId = requestAnimationFrame(checkTime);
            };
        });
    }

    if (window.location.href.includes("screen=place")) {
        setupRowButtons();
    }
})();
