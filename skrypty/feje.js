// ==UserScript==
// @name         FEJKOMAT Własny
// @namespace    https://viayoo.com/
// @version      1.0
// @description  Wysyłanie z własnego skryptu na pasku
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=place*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // --- AUTORSKI STYL (CSS) ---
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
        .tcn-panel {
            background-color: var(--bg-main);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.8);
            font-family: Verdana, sans-serif;
            padding: 10px;
            user-select: none;
            z-index: 999999;
            box-sizing: border-box;
        }
        .tcn-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-header);
            color: var(--title-color);
            border-bottom: 1px solid var(--border-color);
            margin: -10px -10px 10px -10px;
            padding: 8px 10px;
            border-radius: 4px 4px 0 0;
            font-size: 11px;
            font-weight: bold;
        }
        .tcn-btn {
            background: var(--btn-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 3px;
            cursor: pointer;
            padding: 6px;
            font-weight: bold;
            text-align: center;
            font-size: 10px;
            box-sizing: border-box;
        }
        .tcn-btn:hover {
            background: var(--btn-hover);
            color: #ffffff;
        }
        .tcn-input {
            background: var(--bg-header);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 3px;
            padding: 4px;
            box-sizing: border-box;
            font-size: 10px;
        }
        .tcn-input:focus {
            outline: 1px solid #7b7e85;
        }
        select.tcn-input {
            appearance: none;
            -webkit-appearance: none;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    const getS = (k, d) => localStorage.getItem('kf_' + k) || d;
    const setS = (k, v) => localStorage.setItem('kf_' + k, v);

    const getMyCoords = () => game_data.village.coord;
    const vId = String(game_data.village.id);

    // --- ANTY-DUBEL ---
    let sentCoords = JSON.parse(getS('sent_list', '{}'));
    const nowTime = Date.now();
    Object.keys(sentCoords).forEach(k => { if (nowTime - sentCoords[k] > 12 * 3600000) delete sentCoords[k]; });
    setS('sent_list', JSON.stringify(sentCoords));

    const currentDateObj = new Date();
    const defaultDay = String(currentDateObj.getDate()).padStart(2, '0');
    const defaultMonth = String(currentDateObj.getMonth() + 1).padStart(2, '0');
    const defaultYear = currentDateObj.getFullYear();

    // --- USTAWIENIA ---
    let stan = getS('stan', 'STOP');
    let kordyRaw = getS('kordy', '');
    let customScript = getS('custom_script', '');
    let gracze = getS('gracze', '');
    let tagi = getS('tagi', '');
    
    let selDayFrom = getS('sel_day_from', defaultDay);
    let selMonthFrom = getS('sel_month_from', defaultMonth);
    let selDayTo = getS('sel_day_to', defaultDay);
    let selMonthTo = getS('sel_month_to', defaultMonth);

    let timeFrom = getS('time_from', '08:00');
    let timeTo = getS('time_to', '23:00');
    
    let limit = parseInt(getS('limit', '3'));
    let petla = parseInt(getS('petla', '30'));
    let startCoords = getS('start_coords', '');

    let defUnits = { spear: '', sword: '', axe: '1', spy: '1', light: '', ram: '1', catapult: '' };
    let u = JSON.parse(getS('wojsko_obj', JSON.stringify(defUnits)));

    let pos = JSON.parse(getS('pos', '{"t":100,"l":10}'));
    let isPinned = getS('pinned', 'false') === 'true';
    const isRun = (stan === 'START');
    const isWait = (getS('loop_wait', 'false') === 'true');

    let cKey = 'kf_v_cnt_' + vId;
    let count = parseInt(localStorage.getItem(cKey) || '0');

    let allKordy = kordyRaw.match(/\d{3}\|\d{3}/g) || [];
    let filtrKordy = allKordy.filter(c => !sentCoords[c]).join(' ');

    // --- UI ---
    const ui = document.createElement('div');
    ui.id = "fejk_ui_main";
    ui.className = "tcn-panel";
    ui.style.position = isPinned ? 'absolute' : 'fixed';
    ui.style.top = pos.t + 'px';
    ui.style.left = pos.l + 'px';
    ui.style.width = '300px'; 
    ui.style.display = (getS('ui_visible', 'true') === 'true' || isWait) ? 'block' : 'none';

    const unitsList = ['spear', 'sword', 'axe', 'spy', 'light', 'ram', 'catapult'];
    let unitsHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; width:100%; gap:2px;">`;
    unitsList.forEach(unit => {
        unitsHtml += `
            <div style="display:flex; flex-direction:column; align-items:center; flex:1;">
                <img src="https://dspl.innogamescdn.com/asset/1d2499b/graphic/unit/unit_${unit}.png" style="width:18px; height:18px; margin-bottom:4px;" alt="${unit}">
                <input id="u_${unit}" class="tcn-input" value="${u[unit] || ''}" style="width:100%; max-width:30px; text-align:center; padding:3px 1px;">
            </div>`;
    });
    unitsHtml += `</div>`;

    let daysOptionsFrom = '', daysOptionsTo = '';
    let monthsOptionsFrom = '', monthsOptionsTo = '';
    for(let d=1; d<=31; d++) {
        let valD = String(d).padStart(2, '0');
        daysOptionsFrom += `<option value="${valD}" ${valD === selDayFrom ? 'selected' : ''}>${valD}</option>`;
        daysOptionsTo += `<option value="${valD}" ${valD === selDayTo ? 'selected' : ''}>${valD}</option>`;
    }
    for(let m=1; m<=12; m++) {
        let valM = String(m).padStart(2, '0');
        monthsOptionsFrom += `<option value="${valM}" ${valM === selMonthFrom ? 'selected' : ''}>${valM}</option>`;
        monthsOptionsTo += `<option value="${valM}" ${valM === selMonthTo ? 'selected' : ''}>${valM}</option>`;
    }

    let hoursOptionsFrom = '';
    let hoursOptionsTo = '';
    for(let h=0; h<24; h++) {
        let valH = String(h).padStart(2, '0') + ':00';
        hoursOptionsFrom += `<option value="${valH}" ${valH === timeFrom ? 'selected' : ''}>${valH}</option>`;
        hoursOptionsTo += `<option value="${valH}" ${valH === timeTo ? 'selected' : ''}>${valH}</option>`;
    }

    ui.innerHTML = `
        <div id="drag_h" class="tcn-header" style="cursor:${isPinned ? 'default' : 'move'};">
            <span>FEJKOMAT PRO</span>
            <div>
                <span id="pin_fejk" style="cursor:pointer; padding:0 5px;" title="Przypnij do tła">${isPinned ? '🔴' : '📌'}</span>
                <span id="close_fejk" style="cursor:pointer; color:#ff4d4d; font-size:14px; padding:0 5px;" title="Zamknij">✖</span>
            </div>
        </div>
        
        <textarea id="f_custom_script" class="tcn-input" placeholder="Wklej tutaj SWÓJ skrypt z paska (nadpisuje ustawienia poniżej)..." style="width:100%; height:45px; margin-bottom:6px; resize:vertical; background: #2f3136; border: 1px solid #7289da;">${customScript}</textarea>

        <div style="font-size:10px; margin-bottom:8px; color:var(--title-color); text-align:center;">
            Dostępne kordy: <b style="color:#5cb85c;">${filtrKordy.split(' ').filter(x=>x).length}</b> | Wysłano: <b style="color:#fbc02d;">${count}</b>
        </div>
        <textarea id="f_k" class="tcn-input" placeholder="Wklej kordy tutaj..." style="width:100%; height:45px; margin-bottom:6px; resize:vertical;">${kordyRaw}</textarea>
        
        <div style="display:flex; gap:5px; margin-bottom:6px; width:100%;">
            <input id="f_g" class="tcn-input" value="${gracze}" placeholder="Gracze" style="flex:1; width:50%;">
            <input id="f_t" class="tcn-input" value="${tagi}" placeholder="Tagi" style="flex:1; width:50%;">
        </div>

        <div style="font-size:10px; color:var(--title-color); margin-bottom:2px; font-weight:bold;">Data Od:</div>
        <div style="display:flex; gap:4px; margin-bottom:6px; align-items:center; font-size:10px;">
            <select id="sel_day_from_in" class="tcn-input" style="flex:1;">${daysOptionsFrom}</select>
            <select id="sel_month_from_in" class="tcn-input" style="flex:1;">${monthsOptionsFrom}</select>
            <select id="time_from_in" class="tcn-input" style="flex:1;">${hoursOptionsFrom}</select>
        </div>

        <div style="font-size:10px; color:var(--title-color); margin-bottom:2px; font-weight:bold;">Data Do:</div>
        <div style="display:flex; gap:4px; margin-bottom:10px; align-items:center; font-size:10px;">
            <select id="sel_day_to_in" class="tcn-input" style="flex:1;">${daysOptionsTo}</select>
            <select id="sel_month_to_in" class="tcn-input" style="flex:1;">${monthsOptionsTo}</select>
            <select id="time_to_in" class="tcn-input" style="flex:1;">${hoursOptionsTo}</select>
        </div>
        
        ${unitsHtml}
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:10px;">
            <div style="display:flex; align-items:center; gap:4px;">
                <span>Pętla (m):</span>
                <input id="f_p" class="tcn-input" type="number" value="${petla}" style="width:40px; text-align:center;">
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <span>Limit/Wioskę:</span>
                <input id="f_l" class="tcn-input" type="number" value="${limit}" style="width:40px; text-align:center;">
            </div>
        </div>
        
        <div style="display:flex; gap:5px; width:100%;">
            <button id="sav_btn" class="tcn-btn" style="flex:1;">ZAPISZ</button>
            <button id="tog_btn" class="tcn-btn" style="flex:1; background:${isRun ? '#d9534f' : '#5cb85c'} !important;">${isRun ? 'STOP' : 'START'}</button>
        </div>
        <div id="status_info" style="text-align:center; font-size:11px; color:#ff4d4d; font-weight:bold; margin-top:8px;"></div>
    `;
    document.body.appendChild(ui);

    // --- EVENTY UI ---
    if (!$('#f_trigger').length) $('#menu_row2').append(`<td><a href="#" id="f_trigger" style="font-size:18px; text-decoration:none; padding: 0 5px;">⚙️</a></td>`);
    $('#f_trigger').click((e) => { e.preventDefault(); ui.style.display = 'block'; setS('ui_visible', 'true'); });
    $('#close_fejk').click(() => { ui.style.display = 'none'; setS('ui_visible', 'false'); });

    $('#pin_fejk').click(() => {
        isPinned = !isPinned;
        setS('pinned', isPinned);
        $('#pin_fejk').text(isPinned ? '🔴' : '📌');
        $('#drag_h').css('cursor', isPinned ? 'default' : 'move');

        if (isPinned) {
            let rect = ui.getBoundingClientRect();
            ui.style.position = 'absolute';
            ui.style.top = (rect.top + window.scrollY) + 'px';
        } else {
            let rect = ui.getBoundingClientRect();
            ui.style.position = 'fixed';
            ui.style.top = rect.top + 'px';
        }
        setS('pos', JSON.stringify({t: parseInt(ui.style.top), l: parseInt(ui.style.left)}));
    });

    $('#sav_btn').click(() => {
        setS('custom_script', $('#f_custom_script').val());
        setS('kordy', $('#f_k').val()); 
        setS('gracze', $('#f_g').val()); 
        setS('tagi', $('#f_t').val());
        
        setS('sel_day_from', $('#sel_day_from_in').val());
        setS('sel_month_from', $('#sel_month_from_in').val());
        setS('sel_day_to', $('#sel_day_to_in').val());
        setS('sel_month_to', $('#sel_month_to_in').val());

        setS('time_from', $('#time_from_in').val());
        setS('time_to', $('#time_to_in').val());
        setS('petla', $('#f_p').val()); 
        setS('limit', $('#f_l').val());

        let newU = {};
        unitsList.forEach(unit => { newU[unit] = $(`#u_${unit}`).val().trim(); });
        setS('wojsko_obj', JSON.stringify(newU));
        
        location.reload();
    });

    $('#tog_btn').click(() => {
        if (!isRun) { setS('stan', 'START'); setS('start_coords', getMyCoords()); setS('has_moved', 'false'); setS('loop_wait', 'false'); }
        else { setS('stan', 'STOP'); setS('loop_wait', 'false'); }
        location.reload();
    });

    const delayedNextV = (message) => {
        setS('has_moved', 'true');
        let info = document.getElementById('status_info');
        if(info) info.innerText = message + " - Przeskok...";
        setTimeout(() => {
            const n = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
            if (n) n.click();
        }, 1500);
    };

    const getAvailableTroops = (unitName) => {
        let element = document.getElementById('units_entry_all_' + unitName);
        if (!element) return 0;
        return parseInt(element.innerText.replace(/\D/g, '') || '0');
    };

    const hasEnoughTroops = () => {
        for (let unit of unitsList) {
            let val = u[unit] ? u[unit].trim() : '0';
            let required = parseInt(val) || 0;
            if (required > 0) {
                let available = getAvailableTroops(unit);
                if ((unit === 'ram' || unit === 'catapult')) {
                    if (available <= 0) return false; 
                } else {
                    if (available < required) return false;
                }
            }
        }
        return true;
    };

    if (isRun) {
        if (isWait) {
            let diff = Math.ceil((parseInt(getS('next_run', '0')) - Date.now()) / 1000);
            if (diff <= 0) { setS('loop_wait', 'false'); location.reload(); }
            else {
                document.getElementById('status_info').innerText = `RESTART ZA: ${Math.floor(diff/60)}m ${diff%60}s`;
                setTimeout(() => location.reload(), 5000);
                return;
            }
        }

        let currentC = getMyCoords();
        if (currentC === startCoords && getS('has_moved', 'false') === 'true' && count >= limit) {
            setS('loop_wait', 'true');
            setS('has_moved', 'false');
            setS('next_run', Date.now() + (petla * 60000));
            Object.keys(localStorage).forEach(k => { if(k.startsWith('kf_v_cnt_')) localStorage.removeItem(k); });
            location.reload();
            return;
        }

        if (count >= limit) { 
            delayedNextV("Limit osiągnięty!");
            return; 
        }

        // ====== TRYB WŁASNEGO SKRYPTU ======
        if (customScript.trim().length > 10) {
            let cleanScript = customScript.replace(/^javascript:/i, '').trim();
            
            try {
                // Uruchamiamy Twój skrypt z paska
                let externalCode = new Function(cleanScript);
                externalCode();
            } catch(e) {
                console.error("Błąd ładowania własnego skryptu:", e);
                document.getElementById('status_info').innerText = "Błąd własnego skryptu!";
            }

            setTimeout(() => {
                if (location.href.includes('confirm')) {
                    let b = document.querySelector('#troop_confirm_submit');
                    if (b) {
                        let target = document.querySelector('.village_anchor')?.innerText.match(/\d{3}\|\d{3}/);
                        if (target) { sentCoords[target[0]] = Date.now(); setS('sent_list', JSON.stringify(sentCoords)); }
                        count++; localStorage.setItem(cKey, count); b.click();
                    }
                } else {
                    let t = 0;
                    let c = setInterval(() => {
                        let inp = document.querySelector('.target-input-field');
                        // Skrypt zewnętrzny wypełnia inputa
                        if (inp && inp.value.length >= 5) {
                            clearInterval(c);
                            setTimeout(() => { 
                                let atkBtn = document.getElementById('target_attack');
                                if(atkBtn) atkBtn.click();
                            }, 800);
                        }
                        if (t++ > 20) {
                            clearInterval(c);
                            delayedNextV("Brak celu ze skryptu, pomijam...");
                        }
                    }, 300);
                }
            }, 600);
            
            return; // Kończymy kod tutaj, omijamy natywną logikę poniżej
        }
        // ===================================

        // Odtąd zaczyna się stara logika wbudowanego skryptu (uruchomi się tylko jeśli panel własnego skryptu jest pusty)
        if (location.href.includes('screen=place') && !location.href.includes('try=confirm')) {
            if (!hasEnoughTroops()) {
                delayedNextV("Brak wojska!");
                return;
            }
        }

        let tpl = {};
        let fillers = [];
        
        unitsList.forEach(unit => {
            let val = u[unit] ? u[unit].trim() : '';
            if (val) {
                let num = parseInt(val);
                if (num > 0) {
                    if (unit === 'ram' || unit === 'catapult') {
                        let avail = getAvailableTroops(unit);
                        if (avail > 0) {
                            let targetCount = num > 1 ? Math.min(avail, num) : 1;
                            tpl[unit] = Math.min(targetCount, 5);
                            fillers.push(unit);
                        }
                    } else {
                        tpl[unit] = num;
                        if (num === 1) fillers.push(unit);
                    }
                }
            }
        });

        let customFill = fillers.sort((a,b) => {
            if (a === 'spy') return -1;
            if (b === 'spy') return 1;
            if (a === 'ram' || a === 'catapult') return -1;
            if (b === 'ram' || b === 'catapult') return 1;
            return 0;
        }).join(',');
        
        if(!customFill) customFill = 'spy,ram,catapult,axe,light,heavy,sword,spear';

        let dateFromStr = `${selDayFrom}.${selMonthFrom}.${defaultYear}`;
        let dateToStr = `${selDayTo}.${selMonthTo}.${defaultYear}`;
        let rangeTime = `${dateFromStr} ${timeFrom} - ${dateToStr} ${timeTo}`;

        window.HermitowskieFejki = {
            troops_templates: [tpl], 
            fill_troops: customFill,
            coords: filtrKordy, players: gracze, ally_tags: tagi, date_ranges: [rangeTime],
            blocking_enabled: true, skip_night_bonus: true, changing_village_enabled: false
        };

        const s = document.createElement('script');
        s.src = 'https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskieFejki.js';
        s.onload = () => {
            setTimeout(() => {
                if (location.href.includes('confirm')) {
                    let b = document.querySelector('#troop_confirm_submit');
                    if (b) {
                        let target = document.querySelector('.village_anchor')?.innerText.match(/\d{3}\|\d{3}/);
                        if (target) { sentCoords[target[0]] = Date.now(); setS('sent_list', JSON.stringify(sentCoords)); }
                        count++; localStorage.setItem(cKey, count); b.click();
                    }
                } else {
                    let t = 0;
                    let c = setInterval(() => {
                        let inp = document.querySelector('.target-input-field');
                        if (inp && inp.value.length > 5) {
                            clearInterval(c);
                            setTimeout(() => { document.getElementById('target_attack').click(); }, 800);
                        }
                        if (t++ > 15) {
                            clearInterval(c);
                            delayedNextV("Brak prawidłowego celu");
                        }
                    }, 250);
                }
            }, 600);
        };
        document.head.appendChild(s);
    }

    // --- Drag&Drop Logic ---
    const dragH = document.getElementById('drag_h');
    let isDragging = false, sX, sY, iX, iY;
    
    const startDrag = (e) => {
        if(isPinned || e.target.id === 'close_fejk' || e.target.id === 'pin_fejk') return;
        isDragging = true;
        let event = e.type.includes('mouse') ? e : e.touches[0];
        sX = event.clientX; sY = event.clientY;
        iX = ui.offsetLeft; iY = ui.offsetTop;
    };
    
    const onDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        let event = e.type.includes('mouse') ? e : e.touches[0];
        ui.style.left = (iX + (event.clientX - sX)) + 'px'; 
        ui.style.top = (iY + (event.clientY - sY)) + 'px';
    };
    
    const stopDrag = () => {
        if (isDragging) {
            isDragging = false;
            setS('pos', JSON.stringify({t: parseInt(ui.style.top), l: parseInt(ui.style.left)}));
        }
    };
    
    dragH.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    
    dragH.addEventListener('touchstart', startDrag, {passive: false});
    document.addEventListener('touchmove', onDrag, {passive: false});
    document.addEventListener('touchend', stopDrag);

})();
