// ==UserScript==
// @name         Zaawansowane Nazwy Wiosek
// @namespace    https://viayoo.com/
// @version      1.4
// @description  Zmiana nazw wiosek - zintegrowany offset w linii
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=overview_villages*mode=combined*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (!window.location.href.includes('mode=combined')) return;

    const parentThingie = document.getElementById("inner-border");
    if (!parentThingie) return;

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
        }
        .tcm-shinko-panel { background-color: var(--bg-main) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; font-family: Verdana, sans-serif !important; border-radius: 4px !important; box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important; font-size: 10px; }
        .tcm-shinko-header { background-color: var(--bg-header) !important; border-bottom: 1px solid var(--border-color) !important; color: var(--title-color) !important; padding: 4px 6px !important; font-weight: bold !important; display: flex !important; justify-content: space-between !important; align-items: center !important; cursor: move; user-select: none; border-radius: 3px 3px 0 0; }
        .tcm-shinko-btn { background: var(--btn-bg) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; border-radius: 3px !important; cursor: pointer !important; font-weight: bold !important; transition: background 0.2s !important; padding: 4px 6px; text-shadow: 1px 1px 2px black; font-size: 10px; }
        .tcm-shinko-btn:hover { background: var(--btn-hover) !important; }
        .tcm-btn-green { background: var(--btn-green-bg) !important; border-color: #1e8449 !important; }
        .tcm-btn-green:hover { background: var(--btn-green-hover) !important; }
        .tcm-btn-red { background: var(--btn-red-bg) !important; border-color: #922b21 !important; }
        .tcm-btn-red:hover { background: var(--btn-red-hover) !important; }
        .tcm-shinko-input { background-color: var(--bg-header) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; border-radius: 3px !important; padding: 3px !important; box-sizing: border-box; font-size: 10px; outline: none; }
        .tcm-shinko-inner { background-color: var(--bg-row-alt); border: 1px solid var(--border-color); padding: 5px; border-radius: 3px; margin-bottom: 5px; }
    `;
    document.head.appendChild(style);

    const saveToStorage = (key, val) => localStorage.setItem('TCM_Etykiety_' + key, val);
    const getFromStorage = (key) => localStorage.getItem('TCM_Etykiety_' + key);

    const isPinned = getFromStorage('pinned') === 'true';
    let initLeft = getFromStorage('left') || '20px';
    let initTop = getFromStorage('top') || '100px';

    const container = document.createElement("div");
    container.id = "tcm-draggable-ui";
    container.className = "tcm-shinko-panel";
    
    container.style = `position: ${isPinned ? 'fixed' : 'relative'}; 
                       top: ${isPinned ? initTop : '0'}; 
                       left: ${isPinned ? initLeft : '0'}; 
                       z-index: 9999; padding: 6px; margin: 5px 0; 
                       width: 290px; max-width: 95vw;`;
    
    if(isPinned) {
        document.body.appendChild(container);
    } else {
        parentThingie.parentNode.insertBefore(container, parentThingie);
    }

    const header = document.createElement("div");
    header.id = "tcm-drag-handle";
    header.className = "tcm-shinko-header";
    header.style.marginBottom = "6px";
    
    header.innerHTML = `
        <b style="padding-left: 3px; font-size: 11px;">(TCM)RENAMER PRO</b>
        <button class="tcm-shinko-btn" id="tcm-pin-btn" style="font-size: 10px; padding: 1px 5px; opacity: ${isPinned ? '1' : '0.4'};">📌</button>
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
        if(!isDragging) return;
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
    controlPanel.style = "display: flex; flex-direction: column; gap: 6px;";
    container.appendChild(controlPanel);

    // CZYSTY PANEL ZAZNACZANIA
    const selectPanel = document.createElement("div");
    selectPanel.style = "display: flex; gap: 4px; justify-content: center; align-items: center;";
    selectPanel.innerHTML = `
        <input type="number" id="tcm-select-count" class="tcm-shinko-input" placeholder="Ile" style="width: 45px; text-align: center; font-size: 9px;" title="Ile wiosek zaznaczyć">
        <button class="tcm-shinko-btn" id="tcm-select-all" style="flex:1; font-size: 9px;">ZAZNACZ</button>
        <button class="tcm-shinko-btn" id="tcm-select-none" style="flex:1; font-size: 9px;">ODZNACZ</button>
    `;
    controlPanel.appendChild(selectPanel);

    // PANEL SORTOWANIA
    const sortRow = document.createElement("div");
    sortRow.className = "tcm-shinko-inner";
    sortRow.style.display = "flex";
    sortRow.style.flexDirection = "column";
    sortRow.style.gap = "4px";
    sortRow.innerHTML = `
        <div style="display: flex; gap: 4px; align-items: center;">
            <span style="font-weight: bold; font-size: 9px; width: 75px; color: var(--title-color);">Wioska Start:</span>
            <input type="text" id="tcm-sort-start-coords" class="tcm-shinko-input" placeholder="500|500" value="${getFromStorage('startCoords') || ''}" style="flex: 1; font-size: 9px; text-align: center;">
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
            <span style="font-weight: bold; font-size: 9px; width: 75px; color: var(--title-color);">Kierunek:</span>
            <select id="tcm-sort-type" class="tcm-shinko-input" style="flex: 1; height: 21px; font-size: 9px; padding: 1px !important;">
                <option value="dist">Najbliższe</option>
                <option value="ltr">Wschód</option>
                <option value="rtl">Zachód</option>
                <option value="ttb">Południe</option>
            </select>
        </div>
        <button id="tcm-apply-sort" class="tcm-shinko-btn" style="font-size: 9px; width: 100%;">SORTUJ</button>
    `;
    controlPanel.appendChild(sortRow);

    const smartPanel = document.createElement("div");
    smartPanel.className = "tcm-shinko-inner";
    controlPanel.appendChild(smartPanel);

    const smartRow1 = document.createElement("div");
    smartRow1.style = "display: flex; gap: 4px; align-items: center; margin-bottom: 4px;";
    smartRow1.innerHTML = `
        <span style="font-weight: bold; width: 35px; color: var(--title-color); font-size: 9px;">Nazwa:</span>
        <input type="text" id="tcm-base-name" class="tcm-shinko-input" placeholder="np. Xxx" value="${getFromStorage('baseName') || ''}" style="flex: 1; font-size: 9px;">
        <select id="tcm-pos" class="tcm-shinko-input" style="width: 85px; height: 21px; font-size: 9px; padding: 1px !important;">
            <option value="after" ${getFromStorage('pos') === 'after' ? 'selected' : ''}>[Nzw/Nr]</option>
            <option value="before" ${getFromStorage('pos') === 'before' ? 'selected' : ''}>[Nr/Nzw]</option>
        </select>
    `;
    smartPanel.appendChild(smartRow1);

    // SKOMPRESOWANY PANEL AUTOMATU Z OFFSETEM "Od:"
    const smartRow2 = document.createElement("div");
    smartRow2.style = "display: flex; gap: 2px; align-items: center;";
    smartRow2.innerHTML = `
        <span style="font-weight: bold; width: 35px; color: var(--title-color); font-size: 9px;">Numer:</span>
        <input type="text" id="tcm-num-pre" class="tcm-shinko-input" placeholder="[" value="${getFromStorage('numPre') || ''}" style="width: 18px; text-align:center; font-size: 9px; padding: 1px !important;">
        <input type="text" id="tcm-start-num" class="tcm-shinko-input" placeholder="01" value="${getFromStorage('startNum') || ''}" style="width: 25px; text-align: center; font-size: 9px; padding: 1px !important;">
        <input type="text" id="tcm-num-suf" class="tcm-shinko-input" placeholder="]" value="${getFromStorage('numSuf') || ''}" style="width: 18px; text-align:center; font-size: 9px; padding: 1px !important;">
        <span style="font-weight: bold; font-size: 9px; color: var(--title-color); margin-left: 2px;">Od:</span>
        <input type="number" id="tcm-smart-offset" class="tcm-shinko-input" value="1" min="1" style="width: 28px; text-align: center; font-size: 9px; padding: 1px !important;" title="Od jakiego numeru zacząć iterację">
        <button id="tcm-smart-start" class="tcm-shinko-btn tcm-btn-green" style="flex: 1; margin-left: 2px; font-size: 9px; padding: 2px 4px !important;">Zmień</button>
    `;
    smartPanel.appendChild(smartRow2);

    const listToggleContainer = document.createElement("div");
    listToggleContainer.style = "border-top: 1px solid var(--border-color); margin-top: 4px; padding-top: 4px;";
    listToggleContainer.innerHTML = `<button id="tcm-toggle-list" class="tcm-shinko-btn" style="width: 100%; margin-bottom: 4px; font-size: 9px;">POKAŻ LISTĘ</button>`;
    container.appendChild(listToggleContainer);

    const listPanel = document.createElement("div");
    listPanel.style = "display: none; flex-direction: column; gap: 4px;";
    listToggleContainer.appendChild(listPanel);

    // OSOBNY OFFSET "Od linii" DLA TRYBU Z LISTY
    listPanel.innerHTML = `
        <textarea id="tcm-vill-names" class="tcm-shinko-input" rows="3" style="width: 100%; font-family: monospace; font-size: 9px; resize: vertical;"></textarea>
        <div style="display: flex; gap: 4px; align-items: center;">
            <span style="font-weight: bold; font-size: 9px; color: var(--title-color);">Od linii:</span>
            <input type="number" id="tcm-list-start-line" class="tcm-shinko-input" value="1" min="1" style="width: 45px; text-align: center; font-size: 9px;" title="Od której linii czytać">
            <button id="tcm-start-list" class="tcm-shinko-btn tcm-btn-red" style="flex: 1; font-size: 9px;">Z LISTY</button>
        </div>
    `;

    const injectChecks = () => {
        document.querySelectorAll("tr.nowrap").forEach(row => {
            const renameIcon = row.querySelector('a.rename-icon');
            if (renameIcon && !row.querySelector('.tcm-village-check')) {
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'tcm-village-check';
                chk.checked = true;
                chk.style = "width: 18px; height: 18px; margin-right: 6px; vertical-align: middle; cursor: pointer; accent-color: #5cad5c;";
                renameIcon.parentNode.insertBefore(chk, renameIcon);
            }
        });
    };
    injectChecks();

    const villNames = document.getElementById("tcm-vill-names");
    villNames.value = getFromStorage('names') || "";

    document.getElementById('tcm-select-all').onclick = () => {
        const countStr = document.getElementById('tcm-select-count').value;
        const checkboxes = Array.from(document.querySelectorAll('.tcm-village-check'));
        
        if (!countStr || parseInt(countStr) <= 0) {
            checkboxes.forEach(c => c.checked = true);
            return;
        }
        
        const count = parseInt(countStr, 10);
        let startIndex = checkboxes.findIndex(c => c.checked);
        if (startIndex === -1) startIndex = 0; 
        
        checkboxes.forEach(c => c.checked = false); 
        
        for (let i = startIndex; i < startIndex + count && i < checkboxes.length; i++) {
            checkboxes[i].checked = true;
        }
    };

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

    document.getElementById("tcm-apply-sort").onclick = () => {
        const sortType = document.getElementById("tcm-sort-type").value;
        const startCoordsRaw = document.getElementById("tcm-sort-start-coords").value.trim();
        
        const coordsMatch = startCoordsRaw.match(/(\d{1,3})\|(\d{1,3})/);
        if (!coordsMatch) return alert("Musisz podać prawidłowe kordy wioski startowej (np. 500|500)!");

        const startX = parseInt(coordsMatch[1], 10);
        const startY = parseInt(coordsMatch[2], 10);

        const tableBody = document.querySelector("#combined_table tbody, #production_table tbody");
        if (!tableBody) return alert("Nie znaleziono tabeli wiosek!");

        const headers = tableBody.querySelector("tr:first-child");
        const rows = Array.from(tableBody.querySelectorAll("tr.nowrap"));
        
        rows.sort((a, b) => {
            const cA = getCoords(a);
            const cB = getCoords(b);

            const distA = Math.sqrt(Math.pow(cA.x - startX, 2) + Math.pow(cA.y - startY, 2));
            const distB = Math.sqrt(Math.pow(cB.x - startX, 2) + Math.pow(cB.y - startY, 2));

            if (sortType === "dist") return distA - distB;
            else if (sortType === "ltr") {
                const vecA = cA.x - startX;
                const vecB = cB.x - startX;
                if (vecA !== vecB) return vecA - vecB;
                return distA - distB;
            } 
            else if (sortType === "rtl") {
                const vecA = startX - cA.x;
                const vecB = startX - cB.x;
                if (vecA !== vecB) return vecA - vecB;
                return distA - distB;
            } 
            else if (sortType === "ttb") {
                const vecA = cA.y - startY;
                const vecB = cB.y - startY;
                if (vecA !== vecB) return vecA - vecB;
                return distA - distB;
            }
            return 0;
        });

        tableBody.innerHTML = '';
        if(headers) tableBody.appendChild(headers);
        rows.forEach((r, idx) => {
            r.style.backgroundColor = idx % 2 === 0 ? "var(--bg-row-alt)" : "var(--bg-header)"; 
            r.style.color = "var(--text-color)";
            tableBody.appendChild(r);
        });
        
        alert("Wioski zostały posortowane względem: " + startX + "|" + startY);
    };

    const runRenamer = (mode, smartConfig = null) => {
        const table = document.querySelector("#combined_table, #production_table");
        if (!table) return alert("Wejdź w widok Przeglądu!");

        const rows = Array.from(table.querySelectorAll("tr.nowrap")).filter(r => {
            const chk = r.querySelector('.tcm-village-check');
            return chk && chk.checked;
        });

        const namesList = villNames.value.split('\n').map(s => s.trim()).filter(s => s !== "");
        
        // POBIERANIE OFFSETU ZALEŻNIE OD TRYBU
        let offsetIndex = 0;
        if (mode === 'overwrite') {
            offsetIndex = Math.max(0, parseInt(document.getElementById("tcm-list-start-line")?.value || "1", 10) - 1);
        } else if (mode === 'smart') {
            offsetIndex = Math.max(0, parseInt(document.getElementById("tcm-smart-offset")?.value || "1", 10) - 1);
        }

        if (rows.length === 0) return alert("Zaznacz wioski!");

        let j = 0;
        const interval = setInterval(() => {
            if (j >= rows.length || (mode === 'overwrite' && (j + offsetIndex) >= namesList.length)) {
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
                                // OBLICZANIE NUMERU (BAZA + INDEKS + OFFSET)
                                const currentNum = smartConfig.start + index + offsetIndex;
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
                            input.value = namesList[index + offsetIndex];
                        }
                        
                        btn.click();
                    }
                }, 85, row, j);
            }
            j++;
        }, 1001);
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
