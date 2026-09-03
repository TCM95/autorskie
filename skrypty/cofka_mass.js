// ==UserScript==
// @name         Masowy Klin z Cofki
// @namespace    https://viayoo.com/
// @version      5.2
// @description  Wysyłka z przypisanym numerem klina, wybór celu i odliczanie na placu
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
        .tcm-btn { background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
        .tcm-btn-active { background: var(--btn-red-bg) !important; border-color: #ff003c !important; }
        .tcm-select { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 6px; border-radius: 4px; font-size: 12px; }
        .tcm-panel { display: flex; gap: 6px; align-items: center; margin-top: 4px; flex-wrap: wrap; }
        .tcm-timer { font-family: monospace; font-size: 12px; font-weight: bold; background: var(--bg-header); padding: 4px 6px; border-radius: 3px; border: 1px solid var(--border-color); display: none; }
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

    function getStorageKey(num) {
        return `tcm_snipe_${VID}_${num}`;
    }

    // --- EKRAN POTWIERDZENIA ---
    if (window.location.href.includes("try=confirm")) {
        const container = document.querySelector("#troop_confirm_submit")?.parentElement;
        if (container) {
            const panel = document.createElement("div");
            panel.className = "tcm-panel";
            
            const select = document.createElement("select");
            select.className = "tcm-select";
            for (let i = 1; i <= 20; i++) {
                const opt = document.createElement("option");
                opt.value = i;
                opt.textContent = `Oznacz jako Klin #${i}`;
                select.appendChild(opt);
            }

            const btn = document.createElement("button");
            btn.className = "tcm-btn";
            btn.style.background = "var(--btn-green-bg)";
            btn.textContent = "Wysyłka z Numerem";
            
            btn.onclick = (e) => {
                e.preventDefault();
                localStorage.setItem(getStorageKey(select.value), Timing.getCurrentServerTime());
                document.querySelector("#troop_confirm_submit").click();
            };
            
            panel.appendChild(select);
            panel.appendChild(btn);
            container.appendChild(panel);
        }
        return;
    }

    // --- EKRAN PLACU ---
    const rows = document.querySelectorAll("tr.command-row");
    const targets = [];
    
    // Zbieranie celów (przychodzące)
    rows.forEach((row, idx) => {
        if (!row.querySelector("a.command-cancel")) {
            const ms = parseTimeToMs(row.innerText);
            if (ms) {
                targets.push({ id: idx + 1, ms: ms });
                const nameCell = row.querySelector("td");
                nameCell.innerHTML = `<span style="color:#ff003c; font-weight:bold;">[Cel #${idx + 1}]</span> ` + nameCell.innerHTML;
            }
        }
    });

    // Tworzenie paneli sterujących na wychodzących (możliwych do cofnięcia)
    rows.forEach(row => {
        const cancelBtn = row.querySelector("a.command-cancel");
        if (cancelBtn) {
            const td = row.querySelector("td");
            
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

            const selectTarget = document.createElement("select");
            selectTarget.className = "tcm-select";
            const targetDefaultOpt = document.createElement("option");
            targetDefaultOpt.value = "";
            targetDefaultOpt.textContent = "Pod który Cel?";
            selectTarget.appendChild(targetDefaultOpt);

            targets.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.ms;
                opt.textContent = `Cel #${t.id}`;
                selectTarget.appendChild(opt);
            });

            const actionBtn = document.createElement("button");
            actionBtn.className = "tcm-btn";
            actionBtn.textContent = "⚔️ Zbrój";

            const timerDisplay = document.createElement("span");
            timerDisplay.className = "tcm-timer";

            let loopId = null;

            actionBtn.onclick = (e) => {
                e.preventDefault();

                if (loopId) {
                    // Tryb wyłączania ręcznego
                    cancelAnimationFrame(loopId);
                    loopId = null;
                    actionBtn.textContent = "⚔️ Zbrój";
                    actionBtn.classList.remove("tcm-btn-active");
                    timerDisplay.style.display = "none";
                    return;
                }

                const sVal = selectSnipe.value;
                const tVal = selectTarget.value;

                if (!sVal || !tVal) {
                    alert("Wybierz zarówno numer klina, jak i cel!");
                    return;
                }

                const startMs = Number(localStorage.getItem(getStorageKey(sVal)));
                const targetMs = Number(tVal);
                const cancelTimeMs = startMs + (targetMs - startMs) / 2;

                if (cancelTimeMs <= Timing.getCurrentServerTime()) {
                    alert("Czas na anulowanie tego klina pod ten atak już minął!");
                    return;
                }

                actionBtn.textContent = "❌ Anuluj timer";
                actionBtn.classList.add("tcm-btn-active");
                timerDisplay.style.display = "inline-block";

                function checkTime() {
                    const diff = cancelTimeMs - Timing.getCurrentServerTime();

                    if (diff <= 0) {
                        timerDisplay.textContent = "COFANIE...";
                        timerDisplay.style.color = "#ff4444";
                        cancelBtn.click();
                        localStorage.removeItem(getStorageKey(sVal));
                        
                        actionBtn.textContent = "⚔️ Zbrój";
                        actionBtn.classList.remove("tcm-btn-active");
                        loopId = null;
                        return;
                    }

                    timerDisplay.textContent = (diff / 1000).toFixed(3) + "s";
                    timerDisplay.style.color = "#74ff00";
                    loopId = requestAnimationFrame(checkTime);
                }
                
                loopId = requestAnimationFrame(checkTime);
            };

            if(hasSnipes) {
                panel.appendChild(selectSnipe);
                panel.appendChild(selectTarget);
                panel.appendChild(actionBtn);
                panel.appendChild(timerDisplay);
                td.appendChild(panel);
            }
        }
    });
})();
