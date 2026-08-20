// ==UserScript==
// @name         Masowy Klin (Wersja Finalna)
// @namespace    https://viayoo.com/
// @version      5.1
// @description  Wysyłka z numerem, na Placu wybór celu dla danego numeru.
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=place*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CSS Pattern zgodnie z wymaganiami
    const style = document.createElement('style');
    style.textContent = `
        :root { --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147; --text-color: white; --title-color: #ffffdf; --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%); --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%); }
        .tcm-btn { background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 4px 8px; border-radius: 4px; cursor: pointer; }
        .tcm-select { background: var(--bg-header); color: white; border: 1px solid var(--border-color); padding: 4px; }
    `;
    document.head.appendChild(style);

    function parseTimeToMs(text) {
        const match = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/);
        if (!match) return null;
        const d = new Date(Timing.getCurrentServerTime());
        d.setHours(Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? Number(match[4].padEnd(3, '0')) : 0);
        if (d.getTime() < Timing.getCurrentServerTime() - 3600000) d.setDate(d.getDate() + 1);
        return d.getTime();
    }

    // --- EKRAN POTWIERDZENIA ---
    if (window.location.href.includes("try=confirm")) {
        const container = document.querySelector("#troop_confirm_submit")?.parentElement;
        if (container) {
            for (let i = 1; i <= 5; i++) {
                const btn = document.createElement("button");
                btn.className = "btn";
                btn.textContent = "Klin #" + i;
                btn.onclick = (e) => {
                    e.preventDefault();
                    localStorage.setItem("tcm_start_" + i, Timing.getCurrentServerTime());
                    document.querySelector("#troop_confirm_submit").click();
                };
                container.appendChild(btn);
            }
        }
        return;
    }

    // --- EKRAN PLACU ---
    const rows = document.querySelectorAll("tr.command-row");
    const targets = [];
    rows.forEach((row, idx) => {
        if (!row.querySelector("a.command-cancel")) {
            const ms = parseTimeToMs(row.innerText);
            if (ms) {
                targets.push({ id: idx, ms: ms });
                row.querySelector("td").innerHTML = `<span style="color:red">[Cel #${idx}]</span> ` + row.querySelector("td").innerHTML;
            }
        }
    });

    rows.forEach(row => {
        if (row.querySelector("a.command-cancel")) {
            const select = document.createElement("select");
            select.className = "tcm-select";
            
            // Lista naszych klinów
            for(let i = 1; i <= 5; i++) {
                const start = localStorage.getItem("tcm_start_" + i);
                if (start) {
                    const opt = document.createElement("option");
                    opt.value = i;
                    opt.textContent = "Klin #" + i;
                    select.appendChild(opt);
                }
            }

            const selectTarget = document.createElement("select");
            selectTarget.className = "tcm-select";
            targets.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.ms;
                opt.textContent = "Pod Cel #" + t.id;
                selectTarget.appendChild(opt);
            });

            const btn = document.createElement("button");
            btn.className = "tcm-btn";
            btn.textContent = "⚔️";
            btn.onclick = () => {
                const startMs = Number(localStorage.getItem("tcm_start_" + select.value));
                const targetMs = Number(selectTarget.value);
                const cancelTimeMs = startMs + (targetMs - startMs) / 2;
                
                function check() {
                    if (Timing.getCurrentServerTime() >= cancelTimeMs) {
                        row.querySelector("a.command-cancel").click();
                        localStorage.removeItem("tcm_start_" + select.value);
                    } else requestAnimationFrame(check);
                }
                check();
            };
            row.querySelector("td").append(select, selectTarget, btn);
        }
    });
})();
