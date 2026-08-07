// ==UserScript==
// @name         Zarządzanie znajomymi
// @namespace    https://viayoo.com/
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
            position: absolute; /* Zmiana z fixed na absolute */
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
        .tcm-log { background: #000; color: #0f0; padding: 5px; height: 60px; overflow-y: auto; font-family: monospace; font-size: 10px; margin-top: 5px; border-radius: 2px; }
    `;
    document.head.appendChild(style);

    // --- EKSTRAKCJA ISTNIEJĄCYCH ZNAJOMYCH I TAGÓW ---
    let friends = [];
    let tribesSet = new Set();
    const rows = document.querySelectorAll('table.vis > tbody > tr');
    
    rows.forEach(row => {
        if (row.querySelector('th') || row.classList.contains('lit')) return;
        let cells = row.querySelectorAll('td');
        if (cells.length < 10) return;
        
        let nameElem = cells[1].querySelector('a');
        let pointsText = cells[4].innerText.replace(/\./g, '').trim();
        let tribeElem = cells[8].querySelector('a');
        let deleteElem = cells[9].querySelector('a');
        
        if (nameElem && deleteElem) {
            let tribe = tribeElem ? tribeElem.innerText.trim() : "Brak plemienia";
            tribesSet.add(tribe);
            friends.push({
                name: nameElem.innerText.trim(),
                points: parseInt(pointsText, 10) || 0,
                tribe: tribe,
                deleteUrl: deleteElem.getAttribute('href')
            });
        }
    });

    let sortedTribes = Array.from(tribesSet).sort((a, b) => a.localeCompare(b));
    
    let checkboxHtmlAdd = '';
    let checkboxHtmlDel = '';
    
    sortedTribes.forEach(t => {
        if (t !== "Brak plemienia") {
            checkboxHtmlAdd += `<div style="display:flex; align-items:center; margin-bottom:3px;"><input type="checkbox" class="tcm-add-chk" value="${t}" style="margin-right:5px;"><span>${t}</span></div>`;
        }
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
                ${checkboxHtmlAdd || '<div style="color:#aaa;">Brak plemion do wyboru</div>'}
            </div>
            <label style="font-size:11px;">Oraz dodatkowe tagi (opcjonalnie):</label>
            <textarea id="tcm-ally-list" class="tcm-textarea" placeholder="np. K44\nELITE"></textarea>
            <button id="tcm-generate-btn" class="tcm-btn">Automatycznie dodaj znajomych</button>
            <div id="tcm-add-log" class="tcm-log">Oczekiwanie...</div>
        </div>

        <div id="tcm-tab-del" class="tcm-content-section">
            <label style="font-size:11px;">Usuń poniżej pkt (zostaw puste by zignorować):</label>
            <input type="number" id="tcm-min-points" class="tcm-input" placeholder="np. 50000">
            <label style="font-size:11px;">Zaznacz plemiona do usunięcia:</label>
            <div class="tcm-list-box">
                ${checkboxHtmlDel || '<div style="color:#aaa;">Brak tabeli znajomych</div>'}
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

    // --- SZPILKA I PRZECIĄGANIE (Z optymalizacją pod absolute) ---
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
        // Zmiana clientX/Y na pageX/Y by poprawnie czytać pozycję na zescrollowanej stronie (absolute)
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

    // --- FUNKCJE POMOCNICZE (LOGI) ---
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

    // --- LOGIKA DODAWANIA ZNAJOMYCH (AUTO) ---
    const baseUrl = window.location.origin;
    let urlTemplate = TribalWars.buildURL('POST', 'buddies', {action: 'add_buddy'});
    const tokenH = urlTemplate.substring(urlTemplate.indexOf("h=") + 2);
    const postUrl = urlTemplate.substring(0, urlTemplate.indexOf("h=") - 1);

    document.getElementById('tcm-generate-btn').addEventListener('click', async () => {
        const genBtn = document.getElementById('tcm-generate-btn');
        let targetAllies = document.getElementById('tcm-ally-list').value.split('\n').map(a => a.trim()).filter(a => a);
        
        document.querySelectorAll('.tcm-add-chk:checked').forEach(cb => {
            if (!targetAllies.includes(cb.value)) targetAllies.push(cb.value);
        });

        if (targetAllies.length === 0) {
            logAdd('Brak tagów do wyszukania.');
            return;
        }

        genBtn.disabled = true;
        logAdd('Pobieranie bazy z mapy serwera...');

        try {
            const [allyRes, tribeRes] = await Promise.all([
                fetch(baseUrl + "/map/ally.txt").then(r => r.text()),
                fetch(baseUrl + "/map/tribe.txt").then(r => r.text())
            ]);

            let targetAllyIds = new Set();
            allyRes.split('\n').forEach(line => {
                if (!line) return;
                let [id, , tag] = line.split(',');
                if (targetAllies.includes(decodeURIComponent(tag))) {
                    targetAllyIds.add(id);
                }
            });

            let playersToAdd = [];
            tribeRes.split('\n').forEach(line => {
                if (!line) return;
                let [id, name, allyId] = line.split(',');
                if (targetAllyIds.has(allyId)) {
                    playersToAdd.push({ id, name: decodeURIComponent(name).replace(/\+/g, ' ') });
                }
            });

            logAdd(`Znaleziono: ${playersToAdd.length} graczy. Rozpoczynam wysyłkę...`);

            for (let i = 0; i < playersToAdd.length; i++) {
                let p = playersToAdd[i];
                logAdd(`[${i+1}/${playersToAdd.length}] Wysyłam do: ${p.name}`);
                try {
                    await fetch(postUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `name=${encodeURIComponent(p.name)}&h=${tokenH}`
                    });
                    await new Promise(r => setTimeout(r, 250)); // Opóźnienie
                } catch (e) {
                    logAdd(`Błąd wysyłki: ${p.name}`);
                }
            }
            logAdd('Zakończono wysyłanie zaproszeń!');
        } catch (e) {
            logAdd('Błąd pobierania danych.');
            console.error(e);
        }
        genBtn.disabled = false;
    });

    // --- LOGIKA USUWANIA ZNAJOMYCH (Rygorystyczna) ---
    document.getElementById('tcm-delete-btn').addEventListener('click', async () => {
        const delBtn = document.getElementById('tcm-delete-btn');
        const minPointsVal = document.getElementById('tcm-min-points').value;
        const minPoints = minPointsVal !== "" ? parseInt(minPointsVal) : 0;
        
        const checkedBoxes = document.querySelectorAll('.tcm-del-chk:checked');
        const tribesToDelete = Array.from(checkedBoxes).map(cb => cb.value);

        let hasMinPointsCondition = minPoints > 0;
        let hasTribeCondition = tribesToDelete.length > 0;

        if (!hasMinPointsCondition && !hasTribeCondition) {
            logDel("Wybierz przynajmniej jedno kryterium usuwania.");
            return;
        }

        let toDelete = friends.filter(f => {
            let matchPoints = hasMinPointsCondition && f.points < minPoints;
            let matchTribe = hasTribeCondition && tribesToDelete.includes(f.tribe);
            
            return matchPoints || matchTribe;
        });

        if (toDelete.length === 0) {
            logDel("Brak graczy spełniających podane kryteria.");
            return;
        }

        if (!confirm(`Znaleziono ${toDelete.length} znajomych pasujących do kryteriów. Na pewno usunąć?`)) return;

        delBtn.disabled = true;
        for (let i = 0; i < toDelete.length; i++) {
            let f = toDelete[i];
            logDel(`[${i+1}/${toDelete.length}] Usuwam: ${f.name}`);
            try {
                await fetch(f.deleteUrl);
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                logDel(`Błąd usuwania: ${f.name}`);
            }
        }
        logDel("Zakończono! Odświeżam stronę...");
        setTimeout(() => location.reload(), 1500);
    });

})();
