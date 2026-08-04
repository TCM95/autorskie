// ==UserScript==
// @name         Nazwy wiosek
// @description  Zmiana nazw wiosek - inteligentne przedrostki i sortowanie
// @author       TCM
// @namespace    https://viayoo.com/
// @match        *://*.plemiona.pl/game.php?*screen=overview_villages*mode=combined*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (!window.location.href.includes('mode=combined')) return;

    const parentThingie = document.getElementById("inner-border");
    if (!parentThingie) return;

    const saveToStorage = (key, val) => localStorage.setItem('TCM_Etykiety_' + key, val);
    const getFromStorage = (key) => localStorage.getItem('TCM_Etykiety_' + key);

    const isPinned = getFromStorage('pinned') === 'true';
    let initLeft = getFromStorage('left') || '20px';
    let initTop = getFromStorage('top') || '100px';

    const container = document.createElement("div");
    container.id = "tcm-draggable-ui";
    
    container.style = `position: ${isPinned ? 'fixed' : 'relative'}; 
                       top: ${isPinned ? initTop : '0'}; 
                       left: ${isPinned ? initLeft : '0'}; 
                       z-index: 9999; background: #e3d5b8; border: 2px solid #7d510f; 
                       padding: 8px; margin: 10px 0; border-radius: 5px; 
                       box-shadow: 2px 2px 5px rgba(0,0,0,0.5); font-size: 11px; color: #000; 
                       width: 320px; max-width: 95vw;`;
    
    if(isPinned) {
        document.body.appendChild(container);
    } else {
        parentThingie.parentNode.insertBefore(container, parentThingie);
    }

    const header = document.createElement("div");
    header.id = "tcm-drag-handle";
    header.style = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #7d510f; padding-bottom: 5px; margin-bottom: 8px; cursor: move; background: #cbb58c; padding: 4px; border-radius: 3px;";
    
    header.innerHTML = `
        <b style="padding-left: 5px; font-size: 12px;">TCM RENAMER (Przeciągnij)</b>
        <button class="btn" id="tcm-pin-btn" style="font-size: 12px; padding: 2px 6px; background: ${isPinned ? '#214d21' : '#6b4209'}; color: white; cursor:pointer;">${isPinned ? '📌 Odepnij' : '📌 Przypnij'}</button>
    `;
    container.appendChild(header);

    let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    if (isPinned) {
        xOffset = parseInt(initLeft) || 0;
        yOffset = parseInt(initTop) || 0;
    }

    function dragStart(e) {
        if (!isPinned) return; 
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
        if (e.target === header || header.contains(e.target)) isDragging = true;
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        if (isPinned) {
            saveToStorage('left', container.style.left);
            saveToStorage('top', container.style.top);
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            xOffset = currentX;
            yOffset = currentY;
            container.style.left = currentX + "px";
            container.style.top = currentY + "px";
        }
    }

    document.addEventListener("touchstart", dragStart, { passive: false });
    document.addEventListener("touchend", dragEnd);
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("mousedown", dragStart);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("mousemove", drag);

    document.getElementById('tcm-pin-btn').onclick = () => {
        if (isPinned) {
            saveToStorage('pinned', 'false');
        } else {
            saveToStorage('pinned', 'true');
            const rect = container.getBoundingClientRect();
            saveToStorage('left', rect.left + 'px');
            saveToStorage('top', rect.top + 'px');
        }
        location.reload();
    };

    const controlPanel = document.createElement("div");
    controlPanel.style = "display: flex; flex-direction: column; gap: 8px;";
    container.appendChild(controlPanel);

    const selectPanel = document.createElement("div");
    selectPanel.style = "display: flex; gap: 4px; justify-content: center;";
    selectPanel.innerHTML = `
        <button class="btn" id="tcm-select-all" style="flex:1; font-size: 10px;">ZAZNACZ WSZYSTKIE</button>
        <button class="btn" id="tcm-select-none" style="flex:1; font-size: 10px;">ODZNACZ WSZYSTKIE</button>
    `;
    controlPanel.appendChild(selectPanel);

    // PANEL SORTOWANIA
    const sortRow = document.createElement("div");
    sortRow.style = "display: flex; flex-direction: column; gap: 5px; border: 1px solid #a3753a; padding: 4px; background: #ebdcb9;";
    sortRow.innerHTML = `
        <div style="display: flex; gap: 5px; align-items: center;">
            <span style="font-weight: bold; font-size: 10px; width: 85px;">Wioska Start (X|Y):</span>
            <input type="text" id="tcm-sort-start-coords" placeholder="np. 500|500" value="${getFromStorage('startCoords') || ''}" style="flex: 1; padding: 2px; font-size: 10px; text-align: center;">
        </div>
        <div style="display: flex; gap: 5px; align-items: center;">
            <span style="font-weight: bold; font-size: 10px; width: 85px;">Kierunek fali:</span>
            <select id="tcm-sort-type" class="btn" style="flex: 1; height: 22px; font-size: 10px;">
                <option value="dist">Promień (Najbliższe od startu)</option>
                <option value="ltr">Od Startu -> w Prawo (Wschód)</option>
                <option value="rtl">Od Startu -> w Lewo (Zachód)</option>
                <option value="ttb">Od Startu -> w Dół (Południe)</option>
            </select>
        </div>
        <button id="tcm-apply-sort" class="btn" style="background: #4a2c06; color: white; font-size: 10px; width: 100%;">SORTUJ OD WIOSKI STARTOWEJ</button>
    `;
    controlPanel.appendChild(sortRow);

    const smartPanel = document.createElement("div");
    smartPanel.style = "border: 1px solid #a3753a; padding: 5px; background: #ebdcb9;";
    controlPanel.appendChild(smartPanel);

    const smartRow1 = document.createElement("div");
    smartRow1.style = "display: flex; gap: 5px; align-items: center; margin-bottom: 5px;";
    smartRow1.innerHTML = `
        <span style="font-weight: bold; width: 40px;">Nazwa:</span>
        <input type="text" id="tcm-base-name" placeholder="np. Xxx-x" value="${getFromStorage('baseName') || ''}" style="flex: 1; padding: 2px; font-size: 11px;">
        <select id="tcm-pos" class="btn" style="height: 22px; font-size: 10px;">
            <option value="after" ${getFromStorage('pos') === 'after' ? 'selected' : ''}>[Nazwa] [Numer]</option>
            <option value="before" ${getFromStorage('pos') === 'before' ? 'selected' : ''}>[Numer] [Nazwa]</option>
        </select>
    `;
    smartPanel.appendChild(smartRow1);

    const smartRow2 = document.createElement("div");
    smartRow2.style = "display: flex; gap: 3px; align-items: center;";
    smartRow2.innerHTML = `
        <span style="font-weight: bold; width: 40px;">Numer:</span>
        <input type="text" id="tcm-num-pre" placeholder="[" value="${getFromStorage('numPre') || ''}" style="width: 25px; padding: 2px; text-align:center;">
        <input type="text" id="tcm-start-num" placeholder="01" value="${getFromStorage('startNum') || ''}" style="width: 35px; padding: 2px; text-align: center;">
        <input type="text" id="tcm-num-suf" placeholder="]" value="${getFromStorage('numSuf') || ''}" style="width: 25px; padding: 2px; text-align:center;">
        <button id="tcm-smart-start" class="btn" style="flex: 1; background: #214d21; color: white; font-weight: bold; margin-left: 5px;">NADAJ</button>
    `;
    smartPanel.appendChild(smartRow2);

    const listToggleContainer = document.createElement("div");
    listToggleContainer.style = "border-top: 1px solid #7d510f; margin-top: 5px; padding-top: 5px;";
    listToggleContainer.innerHTML = `<button id="tcm-toggle-list" class="btn" style="width: 100%; font-weight: bold; margin-bottom: 5px;">POKAŻ / UKRYJ LISTĘ</button>`;
    container.appendChild(listToggleContainer);

    const listPanel = document.createElement("div");
    listPanel.style = "display: none; flex-direction: column; gap: 5px;";
    listToggleContainer.appendChild(listPanel);

    listPanel.innerHTML = `
        <textarea id="tcm-vill-names" rows="4" style="width: 96%; font-family: monospace; font-size: 10px; color: #000;"></textarea>
        <button id="tcm-start-list" class="btn" style="width: 100%; font-weight: bold; background: #8a2b2b; color: white;">NADAJ Z LISTY</button>
    `;

    const injectChecks = () => {
        document.querySelectorAll("tr.nowrap").forEach(row => {
            const renameIcon = row.querySelector('a.rename-icon');
            if (renameIcon && !row.querySelector('.tcm-village-check')) {
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'tcm-village-check';
                chk.checked = true;
                chk.style = "width: 18px; height: 18px; margin-right: 8px; vertical-align: middle; cursor: pointer;";
                renameIcon.parentNode.insertBefore(chk, renameIcon);
            }
        });
    };
    injectChecks();

    const villNames = document.getElementById("tcm-vill-names");
    villNames.value = getFromStorage('names') || "";

    document.getElementById('tcm-select-all').onclick = () => document.querySelectorAll('.tcm-village-check').forEach(c => c.checked = true);
    document.getElementById('tcm-select-none').onclick = () => document.querySelectorAll('.tcm-village-check').forEach(c => c.checked = false);

    document.getElementById('tcm-toggle-list').onclick = () => {
        listPanel.style.display = listPanel.style.display === "none" ? "flex" : "none";
    };

    villNames.oninput = () => saveToStorage('names', villNames.value);
    document.getElementById('tcm-base-name').oninput = (e) => saveToStorage('baseName', e.target.value);
    document.getElementById('tcm-pos').onchange = (e) => saveToStorage('pos', e.target.value);
    document.getElementById('tcm-start-num').oninput = (e) => saveToStorage('startNum', e.target.value);
    document.getElementById('tcm-num-pre').oninput = (e) => saveToStorage('numPre', e.target.value);
    document.getElementById('tcm-num-suf').oninput = (e) => saveToStorage('numSuf', e.target.value);
    document.getElementById('tcm-sort-start-coords').oninput = (e) => saveToStorage('startCoords', e.target.value);

    const getCoords = (row) => {
        const text = row.innerText;
        const match = text.match(/\((\d{1,3})\|(\d{1,3})\)/);
        return match ? { x: parseInt(match[1], 10), y: parseInt(match[2], 10) } : { x: 0, y: 0 };
    };

    // NOWA, PRECYZYJNA LOGIKA SORTOWANIA ZE WSKAZANĄ WIOSKĄ STARTOWĄ
    document.getElementById("tcm-apply-sort").onclick = () => {
        const sortType = document.getElementById("tcm-sort-type").value;
        const startCoordsRaw = document.getElementById("tcm-sort-start-coords").value.trim();
        
        const coordsMatch = startCoordsRaw.match(/(\d{1,3})\|(\d{1,3})/);
        if (!coordsMatch) {
            return alert("Musisz podać prawidłowe kordy wioski startowej (np. 500|500)!");
        }

        const startX = parseInt(coordsMatch[1], 10);
        const startY = parseInt(coordsMatch[2], 10);

        const tableBody = document.querySelector("#combined_table tbody, #production_table tbody");
        if (!tableBody) return alert("Błąd: Nie znaleziono tabeli wiosek!");

        const headers = tableBody.querySelector("tr:first-child");
        const rows = Array.from(tableBody.querySelectorAll("tr.nowrap"));
        
        rows.sort((a, b) => {
            const cA = getCoords(a);
            const cB = getCoords(b);

            // Odległość geometryczna od punktu startowego
            const distA = Math.sqrt(Math.pow(cA.x - startX, 2) + Math.pow(cA.y - startY, 2));
            const distB = Math.sqrt(Math.pow(cB.x - startX, 2) + Math.pow(cB.y - startY, 2));

            if (sortType === "dist") {
                return distA - distB;
            } 
            else if (sortType === "ltr") {
                // Skrypt premiuje wioski leżące po prawej stronie od punktu startowego
                const vecA = cA.x - startX;
                const vecB = cB.x - startX;
                if (vecA !== vecB) return vecA - vecB;
                return distA - distB;
            } 
            else if (sortType === "rtl") {
                // Skrypt premiuje wioski leżące po lewej stronie od punktu startowego
                const vecA = startX - cA.x;
                const vecB = startX - cB.x;
                if (vecA !== vecB) return vecA - vecB;
                return distA - distB;
            } 
            else if (sortType === "ttb") {
                // Skrypt premiuje wioski leżące w dół od punktu startowego
                const vecA = cA.y - startY;
                const vecB = cB.y - startY;
                if (vecA !== vecB) return vecA - vecB;
                return distA - distB;
            }
            return 0;
        });

        // Fizyczna zmiana w tabeli DOM
        tableBody.innerHTML = '';
        if(headers) tableBody.appendChild(headers);
        rows.forEach((r, idx) => {
            r.style.backgroundColor = idx % 2 === 0 ? "#fff5e1" : "#f7e8cc"; // Naprzemienne podświetlenie nowej kolejności
            tableBody.appendChild(r);
        });
        
        alert("Wioski zostały posortowane według odległości i kierunku od wskazanego punktu (" + startX + "|" + startY + ")!");
    };

    const runRenamer = (mode, smartConfig = null) => {
        const table = document.querySelector("#combined_table, #production_table");
        if (!table) return alert("Wejdź w widok Przeglądu!");

        const rows = Array.from(table.querySelectorAll("tr.nowrap")).filter(r => {
            const chk = r.querySelector('.tcm-village-check');
            return chk && chk.checked;
        });

        const namesList = villNames.value.split('\n').map(s => s.trim()).filter(s => s !== "");

        if (rows.length === 0) return alert("Zaznacz wioski!");

        let j = 0;
        const interval = setInterval(() => {
            if (j >= rows.length || (mode === 'overwrite' && j >= namesList.length)) {
                clearInterval(interval);
                alert("Zakończono! Przetworzono: " + j);
                return;
            }

            const row = rows[j];
            const renameIcon = row.querySelector('a.rename-icon');
            if (renameIcon) {
                renameIcon.click();
                setTimeout((currentRow, index) => {
                    const input = currentRow.querySelector('input[type="text"]');
                    const btn = currentRow.querySelector('input.btn');
                    if (input && btn) {

                        if (mode === 'smart') {
                            let finalName = "";
                            let numberPart = "";

                            if (smartConfig.useNumber) {
                                const currentNum = smartConfig.start + index;
                                const numStr = currentNum.toString().padStart(smartConfig.pad, '0');
                                numberPart = smartConfig.pre + numStr + smartConfig.suf;
                            }

                            if (smartConfig.pos === 'before') {
                                finalName = numberPart + (numberPart && smartConfig.name ? " " : "") + smartConfig.name;
                            } else {
                                finalName = smartConfig.name + (numberPart && smartConfig.name ? " " : "") + numberPart;
                            }

                            input.value = finalName.trim();
                        }
                        else if (mode === 'overwrite') {
                            input.value = namesList[index];
                        }
                        
                        btn.click();
                    }
                }, 85, row, j);
            }
            j++;
        }, 240);
    };

    document.getElementById("tcm-start-list").onclick = () => runRenamer('overwrite');

    document.getElementById("tcm-smart-start").onclick = () => {
        const baseName = document.getElementById("tcm-base-name").value.trim();
        const startNumStr = document.getElementById("tcm-start-num").value.trim();
        const pos = document.getElementById("tcm-pos").value;
        const numPre = document.getElementById("tcm-num-pre").value;
        const numSuf = document.getElementById("tcm-num-suf").value;

        if (!baseName && !startNumStr) return alert("Musisz podać nazwę lub numer!");

        let startNum = 0;
        let useNumber = false;

        if (startNumStr !== "") {
            startNum = parseInt(startNumStr, 10);
            if (isNaN(startNum)) return alert("Numer startowy musi być liczbą!");
            useNumber = true;
        }

        runRenamer('smart', {
            name: baseName,
            useNumber: useNumber,
            start: startNum,
            pad: startNumStr.length,
            pre: numPre,
            suf: numSuf,
            pos: pos
        });
    };

})();
