// ==UserScript==
// @name         Zaawansowane Nazwy Wiosek
// @namespace    https://viayoo.com/
// @version      1.7
// @description  Zmiana nazw wiosek przez zapytania POST (bez klikania edycji) + sortowanie
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=overview_villages*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (!window.location.href.includes('mode=combined')) return;

    const parentThingie = document.getElementById("inner-border");
    if (!parentThingie) return;

    // ===== USTAWIENIA =====
    const MAX_NAME_LEN = 32;      // limit długości nazwy wioski w grze
    const DELAY_MIN = 500;        // ms między zapytaniami
    const DELAY_MAX = 1000;
    const VERIFY_FIRST = true;    // sprawdź odpowiedź przy 1. wiosce; jeśli nazwy nie widać -> przerwij
    // ======================

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
        .tcm-shinko-btn:disabled { opacity: 0.5; cursor: not-allowed !important; }
        .tcm-btn-green { background: var(--btn-green-bg) !important; border-color: #1e8449 !important; }
        .tcm-btn-green:hover { background: var(--btn-green-hover) !important; }
        .tcm-btn-red { background: var(--btn-red-bg) !important; border-color: #922b21 !important; }
        .tcm-btn-red:hover { background: var(--btn-red-hover) !important; }
        tr.tcm-start-row { outline: 2px solid #5cad5c; outline-offset: -2px; }
        .tcm-pick-start:hover { opacity: 1 !important; }
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

    if (isPinned) {
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

    let isDragging = false, currentX = 0, currentY = 0, initialX = 0, initialY = 0, xOffset = 0, yOffset = 0;

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
        if (!isDragging) return;
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

    // PANEL ZAZNACZANIA
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
                <option value="dist">Najbliższe (łańcuch)</option>
                <option value="ltr">Prawo</option>
                <option value="rtl">Lewo</option>
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

    // STATUS
    const statusLine = document.createElement("div");
    statusLine.id = "tcm-status";
    statusLine.style = "font-size: 9px; color: var(--title-color); text-align: center; min-height: 12px;";
    controlPanel.appendChild(statusLine);
    const setStatus = (t) => { statusLine.textContent = t; };

    const listToggleContainer = document.createElement("div");
    listToggleContainer.style = "border-top: 1px solid var(--border-color); margin-top: 4px; padding-top: 4px;";
    listToggleContainer.innerHTML = `<button id="tcm-toggle-list" class="tcm-shinko-btn" style="width: 100%; margin-bottom: 4px; font-size: 9px;">POKAŻ LISTĘ</button>`;
    container.appendChild(listToggleContainer);

    const listPanel = document.createElement("div");
    listPanel.style = "display: none; flex-direction: column; gap: 4px;";
    listToggleContainer.appendChild(listPanel);

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
                const pick = document.createElement('span');
                pick.className = 'tcm-pick-start';
                pick.textContent = '🎯';
                pick.title = 'Ustaw jako wioskę startową';
                pick.style = "cursor: pointer; margin-right: 4px; vertical-align: middle; font-size: 14px; opacity: 0.6;";
                pick.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const m = row.innerText.match(/\((\d{1,3})\|(\d{1,3})\)/);
                    if (!m) return setStatus('Nie znaleziono koordynatów w wierszu');
                    const val = m[1] + '|' + m[2];
                    const inp = document.getElementById('tcm-sort-start-coords');
                    if (inp) inp.value = val;
                    saveToStorage('startCoords', val);
                    document.querySelectorAll('tr.tcm-start-row').forEach(r => r.classList.remove('tcm-start-row'));
                    row.classList.add('tcm-start-row');
                    setStatus('Start: ' + val);
                };
                renameIcon.parentNode.insertBefore(pick, renameIcon);
                renameIcon.parentNode.insertBefore(chk, renameIcon);
            }
        });
    };
    injectChecks();

    const markStartFromStorage = () => {
        const s = (getFromStorage('startCoords') || '').trim();
        if (!s) return;
        document.querySelectorAll('tr.nowrap').forEach(r => {
            if (r.innerText.includes('(' + s + ')')) r.classList.add('tcm-start-row');
        });
    };
    markStartFromStorage();

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

    // ===== SORTOWANIE =====
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

        // wszystkie wiersze, które NIE są wioskami (nagłówki, podsumowania), zostają na górze
        const others = Array.from(tableBody.children).filter(r => !r.classList.contains('nowrap'));
        const rows = Array.from(tableBody.querySelectorAll("tr.nowrap"));

        if (sortType === "dist") {
            // łańcuch najbliższego sąsiada: od startu idziemy zawsze do najbliższej nieodwiedzonej wioski
            const pts = rows.map(r => ({ r, c: getCoords(r) }));
            const ordered = [];
            let cx = startX, cy = startY;
            while (pts.length) {
                let best = 0, bestD = Infinity;
                for (let i = 0; i < pts.length; i++) {
                    const d = Math.hypot(pts[i].c.x - cx, pts[i].c.y - cy);
                    if (d < bestD) { bestD = d; best = i; }
                }
                const p = pts.splice(best, 1)[0];
                ordered.push(p.r);
                cx = p.c.x;
                cy = p.c.y;
            }
            rows.splice(0, rows.length, ...ordered);
        }

        if (sortType !== "dist") rows.sort((a, b) => {
            const cA = getCoords(a);
            const cB = getCoords(b);

            const distA = Math.hypot(cA.x - startX, cA.y - startY);
            const distB = Math.hypot(cB.x - startX, cB.y - startY);

            if (sortType === "dist") return distA - distB;
            if (sortType === "ltr") return (cA.x - cB.x) || (distA - distB);
            if (sortType === "rtl") return (cB.x - cA.x) || (distA - distB);
            if (sortType === "ttb") return (cA.y - cB.y) || (distA - distB);
            return 0;
        });

        others.forEach(r => tableBody.appendChild(r));
        rows.forEach((r, idx) => {
            r.style.backgroundColor = idx % 2 === 0 ? "var(--bg-row-alt)" : "var(--bg-header)";
            r.style.color = "var(--text-color)";
            tableBody.appendChild(r);
        });

        setStatus("Posortowano względem: " + startX + "|" + startY);
    };

    // ===== ZMIANA NAZW PRZEZ POST =====
    let isRunning = false;

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    const randomDelay = () => Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;

    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const getVillageId = (row) => {
        const q = row.querySelector('.quickedit-vn[data-id], .quickedit[data-id]');
        if (q) return q.getAttribute('data-id');
        for (const a of row.querySelectorAll('a[href*="village="]')) {
            const m = a.href.match(/[?&]village=(\d+)/);
            if (m) return m[1];
        }
        return null;
    };

    // zwraca true/false (czy nazwa potwierdzona w odpowiedzi, jeśli verify=true)
    const renameVillage = async (villageId, name, csrf, verify) => {
        const url = `/game.php?village=${villageId}&screen=main&action=change_name&h=${csrf}`;
        const body = new URLSearchParams({ name }).toString();

        const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        if (verify) {
            const html = await res.text();
            const found = html.includes(name) || html.includes(escapeHtml(name));
            if (!found) console.log('[TCM Renamer] Odpowiedź serwera (weryfikacja nie powiodła się):', html.slice(0, 2000));
            return found;
        }
        return true;
    };

    // aktualizuje nazwę w tabeli, zostawia koordynaty i kontynent
    const updateRowLabel = (row, name) => {
        const label = row.querySelector('.quickedit-vn .quickedit-label, .quickedit-label');
        if (!label) return;
        const suffix = (label.textContent.match(/\(\d{1,3}\|\d{1,3}\)\s*K\d+/) || [''])[0];
        label.textContent = suffix ? `${name} ${suffix}` : name;
    };

    const buildSmartName = (cfg, index) => {
        let numberPart = "";
        if (cfg.useNumber) {
            const numStr = (cfg.start + index).toString().padStart(cfg.pad, '0');
            numberPart = cfg.pre + numStr + cfg.suf;
        }
        const sep = (numberPart && cfg.name) ? " " : "";
        const full = cfg.pos === 'before'
            ? numberPart + sep + cfg.name
            : cfg.name + sep + numberPart;
        return full.trim();
    };

    const setButtonsDisabled = (state) => {
        ['tcm-smart-start', 'tcm-start-list', 'tcm-apply-sort'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.disabled = state;
        });
    };

    const runRenamer = async (mode, smartConfig = null) => {
        if (isRunning) return;

        const table = document.querySelector("#combined_table, #production_table");
        if (!table) return alert("Wejdź w widok Przeglądu!");

        const rows = Array.from(table.querySelectorAll("tr.nowrap")).filter(r => {
            const chk = r.querySelector('.tcm-village-check');
            return chk && chk.checked;
        });
        if (rows.length === 0) return alert("Zaznacz wioski!");

        const csrf = window.game_data && window.game_data.csrf;
        if (!csrf) return alert("Brak tokenu CSRF (game_data.csrf) - odśwież stronę.");

        const namesList = villNames.value.split('\n').map(s => s.trim()).filter(s => s !== "");

        let offsetIndex = 0;
        if (mode === 'overwrite') {
            offsetIndex = Math.max(0, parseInt(document.getElementById("tcm-list-start-line")?.value || "1", 10) - 1);
        } else if (mode === 'smart') {
            offsetIndex = Math.max(0, parseInt(document.getElementById("tcm-smart-offset")?.value || "1", 10) - 1);
        }

        isRunning = true;
        setButtonsDisabled(true);

        let done = 0;
        const failed = [];
        let aborted = false;

        for (let j = 0; j < rows.length; j++) {
            let name;
            if (mode === 'overwrite') {
                const idx = j + offsetIndex;
                if (idx >= namesList.length) break;
                name = namesList[idx];
            } else {
                name = buildSmartName(smartConfig, j + offsetIndex);
            }

            const villageId = getVillageId(rows[j]);
            if (!villageId) { failed.push(`#${j + 1}: brak ID wioski`); continue; }
            if (!name) { failed.push(`#${j + 1}: pusta nazwa`); continue; }
            if (name.length > MAX_NAME_LEN) { failed.push(`#${j + 1}: za długa nazwa (${name.length}/${MAX_NAME_LEN})`); continue; }

            setStatus(`⌛ ${j + 1} / ${rows.length}`);

            try {
                const verify = VERIFY_FIRST && done === 0;
                const ok = await renameVillage(villageId, name, csrf, verify);
                if (!ok) {
                    aborted = true;
                    break;
                }
                updateRowLabel(rows[j], name);
                done++;
            } catch (err) {
                console.error('[TCM Renamer]', err);
                failed.push(`#${j + 1}: ${err.message}`);
            }

            await sleep(randomDelay());
        }

        isRunning = false;
        setButtonsDisabled(false);

        if (aborted) {
            setStatus('⛔ Przerwano');
            return alert("Przerwano po pierwszej wiosce: w odpowiedzi serwera nie ma nowej nazwy.\n" +
                         "Sprawdź czy nazwa się zmieniła (odśwież stronę). Szczegóły w konsoli (F12).\n" +
                         "Jeśli się zmieniła, ustaw VERIFY_FIRST = false.");
        }

        setStatus(`✅ ${done} zmienionych` + (failed.length ? `, błędy: ${failed.length}` : ''));
        alert("Zakończono! Zmieniono: " + done + (failed.length ? "\nBłędy:\n" + failed.join("\n") : ""));
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
