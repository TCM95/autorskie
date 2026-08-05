// ==UserScript==
// @name         Klin_z_Cofki
// @namespace    https://viayoo.com/
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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
            globalActiveButton.innerHTML = '⚔️';
            globalActiveButton.style.background = "#f4e4bc";
            globalActiveButton = null;
        }
        if (globalTimerDisplay) {
            globalTimerDisplay.textContent = "";
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
            btn.innerHTML = '⚔️';
            btn.style = "margin-left: 6px; cursor:pointer; background: #f4e4bc; border: 1px solid #7d510f; border-radius: 3px; font-size: 10px; padding: 1px 4px;";
            btn.title = "Ustaw ten czas wejścia jako cel klina";

            const timerDisplay = document.createElement('span');
            timerDisplay.style = "margin-left: 5px; font-weight: bold; font-family: monospace; font-size: 11px;";
            
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
                
                btn.innerHTML = '❌';
                btn.style.background = "#ffcccc";
                UI.SuccessMessage("Klin zaplanowany!");

                function checkTime() {
                    const now = Timing.getCurrentServerTime();
                    const diff = cancelTimeMs - now;

                    if (diff <= 0) {
                        timerDisplay.textContent = "KLIKNIĘTO!";
                        timerDisplay.style.color = "red";
                        
                        const btnCancel = document.querySelector("a.command-cancel");
                        if (btnCancel) {
                            btnCancel.click();
                        } else {
                            UI.ErrorMessage("Zabrakło przycisku 'Anuluj'! Zbyt późno lub rozkaz nie istnieje.");
                        }

                        // Reset UI po kliknięciu
                        btn.innerHTML = '⚔️';
                        btn.style.background = "#f4e4bc";
                        globalActiveButton = null;
                        globalAnimationFrameId = null;
                        return;
                    }

                    timerDisplay.textContent = "Cofka za: " + (diff / 1000).toFixed(3) + "s";
                    timerDisplay.style.color = "#009900";
                    
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
