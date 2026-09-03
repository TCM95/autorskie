// ==UserScript==
// @name         Zarządzanie Znajomymi
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Automatyczne dodawanie i masowe usuwanie znajomych na podstawie plemienia, braku plemienia oraz punktów.
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=buddies*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (document.getElementById('tcm-friends-ui')) return;

    // --- WSTRZYKIWANIE STYLÓW UI ---
    const style = document.createElement('style');
    style.innerHTML = `
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
        #tcm-friends-ui {
            position: absolute;
            width: 320px;
            background: var(--bg-main); color: var(--text-color);
            border: 1px solid var(--border-color); z-index: 99999;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-family: Verdana, Arial, sans-serif; font-size: 12px;
            border-radius: 4px;
        }
        #tcm-header {
            background: var(--bg-header); padding: 8px 10px; cursor: move;
            color: var(--title-color); font-weight: bold; display: flex; justify-content: space-between;
            align-items: center; user-select: none; border-bottom: 1px solid var(--border-color);
        }
        .tcm-tabs {
            display: flex; background: var(--bg-row-alt); border-bottom: 1px solid var(--border-color);
        }
        .tcm-tab {
            flex: 1; padding: 6px; text-align: center; cursor: pointer; font-weight: bold; color: #aaa;
        }
        .tcm-tab.active {
            color: var(--title-color); background: var(--bg-main); border-bottom: 2px solid var(--title-color);
        }
        .tcm-content-section { padding: 10px; display: none; }
        .tcm-content-section.active { display: block; }
        .tcm-btn {
            background: var(--btn-bg); color: var(--text-color); border: 1px solid var(--border-color);
            padding: 5px 10px; cursor: pointer; border-radius: 3px; width: 100%; margin-top: 5px; font-weight: bold;
        }
        .tcm-btn:hover { background: var(--btn-hover); }
        .tcm-textarea, .tcm-input {
            width: 100%; box-sizing: border-box; background: var(--bg-header);
            color: var(--text-color); border: 1px solid var(--border-color); padding: 5px; border-radius: 3px; margin-bottom: 8px;
        }
        .tcm-textarea { height: 50px; resize: vertical; }
        #tcm-pin { cursor: pointer; filter: grayscale(100%); font-size: 14px; }
        #tcm-pin.pinned { filter: none; }
        .tcm-list-box {
            background: var(--bg-row-alt); border: 1px solid var(--border-color); padding: 5px;
            max-height: 100px; overflow-y: auto; margin-bottom: 8px; font-size: 11px;
        }
        .tcm-log { background: #000; color: #0f0; padding: 5px; height: 70px; overflow-y: auto; font-family: monospace; font-size: 10px; margin-top: 5px; border-radius: 2px; }
    `;
    document.head.appendChild(style);

    // --- EKSTRAKCJA ISTNIEJĄCYCH ZNAJOMYCH I TAGÓW ---
    let friends = [];
    let tribesSet = new Set();
    const rows = document.querySelectorAll('table.vis > tbody > tr');
    
    rows.forEach(row => {
        if (row.querySelector('th') || row.classList.contains('lit')) return;
        let cells = row.querySelectorAll('td');
        if (cells.length < 4) return;
        
        let nameElem = row.querySelector('a[href*="screen=info_player"]');
        let pointsElem = cells[4] || cells[3];
        let tribeElem = row.querySelector('a[href*="screen=info_ally"]');
        let deleteElem = row.querySelector('a[href*="action=del"]');
        
        if (nameElem && deleteElem) {
            let tribe = tribeElem ? tribeElem.innerText.trim() : "Brak plemienia";
            let pts = pointsElem ? parseInt(pointsElem.innerText.replace(/\./g, '').trim(), 10) : 0;
            if (tribe !== "Brak plemienia") tribesSet.add(tribe);
            
            friends.push({
                name: nameElem.innerText.trim(),
                points: pts || 0,
                tribe: tribe,
                deleteUrl: deleteElem.getAttribute('href')
            });
        }
    });

    let sortedTribes = Array.from(tribesSet).sort((a, b) => a.localeCompare(b));
    
    let checkboxHtmlAdd = '';
    let checkboxHtmlDel = '';
    
    sortedTribes.forEach(t => {
        checkboxHtmlAdd += `<div style="display:flex; align-items:center; margin-bottom:3px;"><input type="checkbox" class="tcm-add-chk" value="${t}" style="margin-right:5px;"><span>${t}</span></div>`;
        checkboxHtmlDel += `<div style="display:flex; align-items:center; margin-bottom:3px;"><input type="checkbox" class="tcm-del-chk" value="${t}" style="margin-right:5px;"><span>${t}</span></div>`;
    });

    // --- BUDOWA INTERFEJSU ---
    const ui = document.createElement('div');
    ui.id = 'tcm-friends-ui';
    ui.innerHTML = `
        <div id="tcm-header">
            <span>Zarządzanie Znajomymi</span>
            <span id="tcm-pin" title="Przypnij pozycję">📌</span>
        </div>
        <div class="tcm-tabs">
            <div class="tcm-tab active" data-tab="add">Dodawaj</div>
            <div class="tcm-tab" data-tab="del">Usuwaj</div>
        </div>
        
        <div id="tcm-tab-add" class="tcm-content-section active">
            <label style="font-size:11px;">Plemiona z Twojej listy znajomych:</label>
            <div class="tcm-list-box">
                ${checkboxHtmlAdd || '<div style="color:#aaa;">Brak plemion na liście</div>'}
            </div>
            <label style="font-size:11px;">Wpisz Tagi/Nazwy plemion (rozdzielone nową linią):</label>
            <textarea id="tcm-ally-list" class="tcm-textarea" placeholder="np. K44\nELITE"></textarea>
            <button id="tcm-generate-btn" class="tcm-btn">Automatycznie dodaj znajomych</button>
            <div id="tcm-add-log" class="tcm-log">Oczekiwanie...</div>
        </div>

        <div id="tcm-tab-del" class="tcm-content-section">
            <label style="font-size:11px;">Usuń poniżej pkt (zostaw puste by zignorować):</label>
            <input type="number" id="tcm-min-points" class="tcm-input" placeholder="np. 50000">
            <label style="font-size:11px;">Zaznacz plemiona do usunięcia:</label>
            <div class="tcm-list-box">
                ${checkboxHtmlDel || '<div style="color:#aaa;">Brak plemion do wyboru</div>'}
            </div>
            <div style="display:flex; align-items:center; margin-bottom:8px;">
                <input type="checkbox" id="tcm-del-no-tribe" style="margin-right:5px;">
                <span style="font-size:11px; font-weight:bold; color:#ffaaaa;">Usuń graczy bez plemienia</span>
            </div>
            <button id="tcm-delete-btn" class="tcm-btn">Usuń zaznaczonych</button>
            <div id="tcm-del-log" class="tcm-log">Oczekiwanie...</div>
        </div>
    `;
    document.body.appendChild(ui);

    // --- OBSŁUGA ZAKŁADEK ---
    document.querySelectorAll('.tcm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tcm-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tcm-content-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tcm-tab-${tab.getAttribute('data-tab')}`).classList.add('active');
        });
    });

    // --- SZPILKA I PRZECIĄGANIE ---
    const header = document.getElementById('tcm-header');
    const pinBtn = document.getElementById('tcm-pin');
    let isPinned = localStorage.getItem('tcm_pin_zaj') === 'true';

    if (isPinned) {
        pinBtn.classList.add('pinned');
        const pos = JSON.parse(localStorage.getItem('tcm_pos_zaj')) || { top: '100px', left: '100px' };
        ui.style.top = pos.top;
        ui.style.left = pos.left;
    } else {
        ui.style.top = '150px';
        ui.style.left = '50px';
    }

    pinBtn.addEventListener('click', () => {
        isPinned = !isPinned;
        pinBtn.classList.toggle('pinned', isPinned);
        localStorage.setItem('tcm_pin_zaj', isPinned);
        if (isPinned) {
            localStorage.setItem('tcm_pos_zaj', JSON.stringify({ top: ui.style.top, left: ui.style.left }));
        }
    });

    let isDragging = false, startX, startY, initialX, initialY;
    
    const dragStart = (e) => {
        if (isPinned || e.target === pinBtn) return;
        isDragging = true;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        startY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
        initialX = ui.offsetLeft;
        initialY = ui.offsetTop;
    };
    
    const dragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        let cX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        let cY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
        ui.style.left = (initialX + cX - startX) + 'px';
        ui.style.top = (initialY + cY - startY) + 'px';
    };
    
    const dragEnd = () => { isDragging = false; };

    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);

    // --- FUNKCJE POMOCNICZE ---
    function logAdd(msg) {
        const box = document.getElementById('tcm-add-log');
        box.innerHTML += `<div>${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    function logDel(msg) {
        const box = document.getElementById('tcm-del-log');
        box.innerHTML += `<div>${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    
    function cleanText(str) {
        return decodeURIComponent(str.replace(/\+/g, ' ')).trim().toLowerCase();
    }

    // --- LOGIKA DODAWANIA ZNAJOMYCH ---
    document.getElementById('tcm-generate-btn').addEventListener('click', async () => {
        const genBtn = document.getElementById('tcm-generate-btn');
        let rawInputs = document.getElementById('tcm-ally-list').value.split('\n').map(a => a.trim()).filter(a => a);
        
        document.querySelectorAll('.tcm-add-chk:checked').forEach(cb => {
            if (!rawInputs.includes(cb.value)) rawInputs.push(cb.value);
        });

        if (rawInputs.length === 0) {
            logAdd('⚠️ Zaznacz plemię lub wpisz tag!');
            return;
        }

        const targetSearch = rawInputs.map(t => t.toLowerCase());

        genBtn.disabled = true;
        logAdd('♻️ Pobieranie bazy świata...');

        try {
            const baseUrl = window.location.origin;
            const [allyRes, playerRes] = await Promise.all([
                fetch(baseUrl + "/map/ally.txt").then(r => r.text()),
                fetch(baseUrl + "/map/player.txt").then(r => r.text())
            ]);

            let targetAllyIds = new Set();
            allyRes.split('\n').forEach(line => {
                if (!line) return;
                let parts = line.split(',');
                if (parts.length >= 3) {
                    let id = parts[0];
                    let name = cleanText(parts[1]);
                    let tag = cleanText(parts[2]);

                    if (targetSearch.includes(name) || targetSearch.includes(tag)) {
                        targetAllyIds.add(id);
                    }
                }
            });

            if (targetAllyIds.size === 0) {
                logAdd('❗ Nie znaleziono plemienia o podanym tagu/nazwie.');
                genBtn.disabled = false;
                return;
            }

            let playersToAdd = [];
            playerRes.split('\n').forEach(line => {
                if (!line) return;
                let parts = line.split(',');
                if (parts.length >= 3) {
                    let name = decodeURIComponent(parts[1].replace(/\+/g, ' '));
                    let allyId = parts[2];
                    if (targetAllyIds.has(allyId)) {
                        playersToAdd.push(name);
                    }
                }
            });

            logAdd(`Znaleziono: ${playersToAdd.length} graczy. Wysyłam zaproszenia...`);

            const csrfToken = (window.csrf_token || (window.game_data && window.game_data.csrf));
            const postUrl = TribalWars.buildURL('POST', 'buddies', { action: 'add_buddy' });

            for (let i = 0; i < playersToAdd.length; i++) {
                let name = playersToAdd[i];
                logAdd(`[${i+1}/${playersToAdd.length}] Wysyłam do: ${name}`);
                
                let formData = new URLSearchParams();
                formData.append('name', name);
                formData.append('h', csrfToken);

                try {
                    await fetch(postUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                        body: formData.toString()
                    });
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {
                    logAdd(`❗ Błąd wysyłki do: ${name}`);
                }
            }
            logAdd('ദ്ദി ˉ͈̀꒳ˉ͈́ )✧ Gotowe!');
        } catch (e) {
            logAdd('❗ Błąd podczas pobierania bazy.');
            console.error(e);
        }
        genBtn.disabled = false;
    });

    // --- LOGIKA USUWANIA ZNAJOMYCH ---
    document.getElementById('tcm-delete-btn').addEventListener('click', async () => {
        const delBtn = document.getElementById('tcm-delete-btn');
        const minPointsVal = document.getElementById('tcm-min-points').value;
        const minPoints = minPointsVal !== "" ? parseInt(minPointsVal) : 0;
        
        const checkedBoxes = document.querySelectorAll('.tcm-del-chk:checked');
        const tribesToDelete = Array.from(checkedBoxes).map(cb => cb.value);
        const deleteNoTribe = document.getElementById('tcm-del-no-tribe').checked;

        let hasMinPointsCondition = minPoints > 0;
        let hasTribeCondition = tribesToDelete.length > 0;

        if (!hasMinPointsCondition && !hasTribeCondition && !deleteNoTribe) {
            logDel("⚠️ Wybierz przynajmniej jedno kryterium.");
            return;
        }

        let toDelete = friends.filter(f => {
            let matchPoints = hasMinPointsCondition && f.points < minPoints;
            let matchTribe = hasTribeCondition && tribesToDelete.includes(f.tribe);
            let matchNoTribe = deleteNoTribe && f.tribe === "Brak plemienia";
            return matchPoints || matchTribe || matchNoTribe;
        });

        if (toDelete.length === 0) {
            logDel("Brak graczy spełniających kryteria.");
            return;
        }

        if (!confirm(`Usuwasz ${toDelete.length} graczy. Kontynuować?`)) return;

        delBtn.disabled = true;
        for (let i = 0; i < toDelete.length; i++) {
            let f = toDelete[i];
            logDel(`[${i+1}/${toDelete.length}] Usuwam: ${f.name}`);
            try {
                await fetch(f.deleteUrl);
                await new Promise(r => setTimeout(r, 250));
            } catch (e) {
                logDel(`Błąd: ${f.name}`);
            }
        }
        logDel("ദ്ദി ˉ͈̀꒳ˉ͈́ )✧ Odświeżam...");
        setTimeout(() => location.reload(), 1200);
    });

})();
