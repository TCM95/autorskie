// ==UserScript==
// @name         Masowy Klin z Cofki
// @namespace    https://viayoo.com/
// @version      6.2
// @description  Wybór numeru z oryginalnym przyciskiem wysyłki oraz czytelne numery przy wychodzących rozkazach.
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (typeof game_data === 'undefined') return;
    const VID = game_data.village.id;

    const style = document.createElement('style');
    style.textContent = `
        :root {
            --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147;
            --text-color: white; --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
        }
        .tcm-btn { background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
        .tcm-btn-active { background: var(--btn-red-bg) !important; border-color: #ff003c !important; }
        .tcm-select { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 4px; border-radius: 4px; font-size: 12px; }
        .tcm-panel { display: inline-flex; gap: 6px; align-items: center; margin-left: 10px; flex-wrap: wrap; }
        .tcm-timer { font-family: monospace; font-size: 13px; font-weight: bold; background: var(--bg-header); padding: 3px 6px; border-radius: 3px; border: 1px solid var(--border-color); display: none; }
        .tcm-tag { color: #ffffdf; font-weight: bold; background: #202225; padding: 2px 5px; border-radius: 3px; border: 1px solid var(--border-color); margin-right: 5px; }
    `;
    document.head.appendChild(style);

    function parseTimeToMs(text) {
        if (!text) return null;
        const match = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/);
        if (!match) return null;
        const d = new Date(Timing.getCurrentServerTime());
        d.setHours(Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? Number(match[4].padEnd(3, '0')) : 0);
        if (d.getTime() < Timing.getCurrentServerTime() - 3600000) d.setDate(d.getDate() + 1);
        return d.getTime();
    }

    function formatCountdown(diffMs) {
        if (diffMs <= 0) return "00:00";
        const totalSeconds = Math.ceil(diffMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const pad = (n) => String(n).padStart(2, '0');
        
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds)}`;
        }
        return `${pad(minutes)}:${pad(seconds)}`;
    }

    function getStorageKey(num) {
        return `tcm_snipe_${VID}_${num}`;
    }

    // --- EKRAN POTWIERDZENIA WYSYŁKI ---
    if (window.location.href.includes("try=confirm")) {
        const confirmBtn = document.querySelector("#troop_confirm_submit");
        if (confirmBtn) {
            const container = confirmBtn.parentElement;
            
            const panel = document.createElement("div");
            panel.className = "tcm-panel";
            panel.style.marginTop = "10px";
            
            const select = document.createElement("select");
            select.className = "tcm-select";
            
            const defaultOpt = document.createElement("option");
            defaultOpt.value = "0";
            defaultOpt.textContent = "-- Zwykły atak (nie klin) --";
            select.appendChild(defaultOpt);

            for (let i = 1; i <= 20; i++) {
                const opt = document.createElement("option");
                opt.value = i;
                opt.textContent = `Zapisz jako Klin #${i}`;
                select.appendChild(opt);
            }
            
            panel.appendChild(select);
            container.appendChild(panel);

            confirmBtn.addEventListener("click", () => {
                const selectedVal = select.value;
                if (selectedVal !== "0") {
                    localStorage.setItem(getStorageKey(selectedVal), Timing.getCurrentServerTime());
                }
            });
        }
        return;
    }

    // --- EKRAN PLACU ---
    const outgoings = Array.from(document.querySelectorAll("#commands_outgoings tr.command-row"))
        .filter(row => row.querySelector("a.command-cancel"));

    // Oznaczanie wychodzących rozkazów ich numerem klina
    outgoings.forEach(outRow => {
        const nameCell = outRow.querySelector("td");
        if (!nameCell) return;

        // Szukamy, który zapisany klin pasuje do tej sesji (na podstawie przybliżonego czasu trwania lub obecności w pamięci)
        for (let i = 1; i <= 20; i++) {
            const key = getStorageKey(i);
            const val = localStorage.getItem(key);
            if (val) {
                // Jeśli etykieta nie była jeszcze dodana do tego wiersza
                if (!nameCell.querySelector(`.tcm-tag[data-klin="${i}"]`)) {
                    // Sprawdzamy tekst w wierszu lub po prostu oznaczamy po kolei aktywne rozkazy
                    const tag = document.createElement("span");
                    tag.className = "tcm-tag";
                    tag.dataset.klin = i;
                    tag.textContent = `[Klin #${i}]`;
                    nameCell.insertBefore(tag, nameCell.firstChild);
                    break; // Przypisujemy jeden pasujący numer na wiersz
                }
            }
        }
    });
        
    const incomings = Array.from(document.querySelectorAll("#commands_incomings tr.command-row"));

    incomings.forEach(row => {
        const img = row.querySelector('img[src*="graphic/command/"]');
        if (img && (img.src.includes('support.webp') || img.src.includes('return.webp'))) return;

        const nameCell = row.querySelector("td:first-child") || row.querySelector("td");
        if (!nameCell) return;

        const panel = document.createElement("div");
        panel.className = "tcm-panel";

        const selectSnipe = document.createElement("select");
        selectSnipe.className = "tcm-select";
        let hasSnipes = false;
        
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = "Wybierz Klin...";
        selectSnipe.appendChild(defaultOpt);

        for(let i = 1; i <= 20; i++) {
            const start = localStorage.getItem(getStorageKey(i));
            if (start) {
                const opt = document.createElement("option");
                opt.value = i;
                opt.textContent = `Klin #${i}`;
                selectSnipe.appendChild(opt);
                hasSnipes = true;
            }
        }

        const selectCancelLink = document.createElement("select");
        selectCancelLink.className = "tcm-select";
        outgoings.forEach((outRow, idx) => {
            const opt = document.createElement("option");
            opt.value = idx;
            opt.textContent = `Wycofaj rozkaz #${idx + 1}`;
            selectCancelLink.appendChild(opt);
        });

        if (outgoings.length <= 1) {
            selectCancelLink.style.display = "none";
        }

        const actionBtn = document.createElement("button");
        actionBtn.className = "tcm-btn";
        actionBtn.textContent = "⚔️";

        const timerDisplay = document.createElement("span");
        timerDisplay.className = "tcm-timer";

        let loopId = null;

        actionBtn.onclick = (e) => {
            e.preventDefault();

            if (loopId) {
                cancelAnimationFrame(loopId);
                loopId = null;
                actionBtn.textContent = "⚔️";
                actionBtn.classList.remove("tcm-btn-active");
                timerDisplay.style.display = "none";
                return;
            }

            const sVal = selectSnipe.value;
            if (!sVal) {
                UI.ErrorMessage("Wybierz numer klina!");
                return;
            }

            const outIdx = selectCancelLink.value;
            if (!outgoings[outIdx]) {
                UI.ErrorMessage("Brak rozkazu do wycofania!");
                return;
            }

            const cancelBtnLink = outgoings[outIdx].querySelector("a.command-cancel");

            const timeCell = row.querySelectorAll('td')[1];
            const targetText = timeCell ? timeCell.innerText : row.innerText;
            const targetMs = parseTimeToMs(targetText);
            const startMs = Number(localStorage.getItem(getStorageKey(sVal)));

            const durationSec = Math.round((targetMs - startMs) / 1000);
            const halfDurationMs = (durationSec / 2) * 1000;
            const cancelTimeMs = startMs + halfDurationMs;

            if (cancelTimeMs <= Timing.getCurrentServerTime()) {
                UI.ErrorMessage("Czas na anulowanie klina pod ten atak już minął!");
                return;
            }

            actionBtn.textContent = "❌";
            actionBtn.classList.add("tcm-btn-active");
            timerDisplay.style.display = "inline-block";
            UI.SuccessMessage(`Klin zaplanowany pod wybrany atak!`);

            function checkTime() {
                const diff = cancelTimeMs - Timing.getCurrentServerTime();

                if (diff <= 0) {
                    timerDisplay.textContent = "COFANIE...";
                    timerDisplay.style.color = "#ff4444";
                    
                    if(cancelBtnLink) cancelBtnLink.click();
                    
                    localStorage.removeItem(getStorageKey(sVal));
                    actionBtn.textContent = "⚔️";
                    actionBtn.classList.remove("tcm-btn-active");
                    loopId = null;
                    return;
                }

                timerDisplay.textContent = formatCountdown(diff);
                timerDisplay.style.color = "#55ff55";
                loopId = requestAnimationFrame(checkTime);
            }
            
            loopId = requestAnimationFrame(checkTime);
        };

        if(hasSnipes) {
            panel.appendChild(selectSnipe);
            panel.appendChild(selectCancelLink);
            panel.appendChild(actionBtn);
            panel.appendChild(timerDisplay);
            nameCell.appendChild(panel);
        }
    });
})();
