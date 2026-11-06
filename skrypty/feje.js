// ==UserScript==
// @name         FEJKOMAT PRO
// @namespace    https://viayoo.com/
// @version      2.4
// @description  Checkboxy jednostek (0 = dopełnianie, liczba = dokładnie), szybszy przeskok wiosek, weryfikacja wysyłki, poprawiony koniec pętli
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=place*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- USTAWIENIA SZYBKOŚCI (ms / liczba prób) ---
    const JUMP_DELAY = 400;          // opóźnienie przed przeskokiem do następnej wioski
    const CONFIRM_DELAY = 300;       // opóźnienie przed kliknięciem "Wyślij" na potwierdzeniu
    const HERMIT_DELAY = 300;        // opóźnienie po załadowaniu Hermita
    const ATTACK_CLICK_DELAY = 700;  // opóźnienie przed kliknięciem "Atakuj"
    const TARGET_TICKS = 28;         // ile prób szukania celu (1 próba = 250 ms) => ok. 7 s
    const SCRIPT_TARGET_TICKS = 60;  // to samo dla trybu własnego skryptu

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
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
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
        .tcn-input:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }
        .tcn-chk {
            margin: 0 0 4px 0;
            cursor: pointer;
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

    let sentCoords = JSON.parse(getS('sent_list', '{}'));
    const nowTime = Date.now();
    Object.keys(sentCoords).forEach(k => { if (nowTime - sentCoords[k] > 12 * 3600000) delete sentCoords[k]; });
    setS('sent_list', JSON.stringify(sentCoords));

    const currentDateObj = new Date();
    const defaultDay = String(currentDateObj.getDate()).padStart(2, '0');
    const defaultMonth = String(currentDateObj.getMonth() + 1).padStart(2, '0');
    const defaultYear = currentDateObj.getFullYear();

    let stan = getS('stan', 'STOP');
    let tryb = getS('tryb', 'kordy');
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

    // --- JEDNOSTKI: on = czy używać jednostki, n = 0 (dopełniaj automatycznie) lub dokładna liczba ---
    const unitsList = ['spear', 'sword', 'axe', 'spy', 'light', 'ram', 'catapult'];
    const defUnits = {
        spear:    { on: false, n: 0 },
        sword:    { on: false, n: 0 },
        axe:      { on: true,  n: 0 },
        spy:      { on: true,  n: 0 },
        light:    { on: false, n: 0 },
        ram:      { on: true,  n: 1 },
        catapult: { on: false, n: 0 }
    };
    let storedU = {};
    try { storedU = JSON.parse(getS('wojsko_v2', '{}')); } catch (e) { storedU = {}; }
    let u = {};
    unitsList.forEach(k => {
        const src = storedU[k] || defUnits[k];
        u[k] = { on: !!src.on, n: Math.max(0, parseInt(src.n) || 0) };
    });

    // exactUnits: dokładna liczba, fillUnits: dopełniają fejka automatycznie (taran/katapulta nigdy nie dopełniają)
    const exactUnits = unitsList.filter(k => u[k].on && u[k].n > 0);
    const fillUnits = unitsList.filter(k => u[k].on && u[k].n === 0 && k !== 'ram' && k !== 'catapult');

    let pos = JSON.parse(getS('pos', '{"t":100,"l":10}'));
    let isPinned = getS('pinned', 'false') === 'true';
    const isRun = (stan === 'START');
    const isWait = (getS('loop_wait', 'false') === 'true');
    const isConfirmPage = location.href.includes('try=confirm');

    let cKey = 'kf_v_cnt_' + vId;
    let count = parseInt(localStorage.getItem(cKey) || '0');

    // --- WERYFIKACJA POPRZEDNIEJ WYSYŁKI ---
    // Fejk liczy się dopiero, gdy kord faktycznie widać w "Własne rozkazy"
    if (isRun && !isConfirmPage) {
        const pending = getS('pending', '');
        if (pending) {
            setS('pending', '');
            const out = document.querySelector('#commands_outgoings')?.innerText || '';
            if (pending === '?' || out.includes(pending)) {
                if (pending !== '?') {
                    sentCoords[pending] = Date.now();
                    setS('sent_list', JSON.stringify(sentCoords));
                }
                count++;
                localStorage.setItem(cKey, count);
            }
        }
    }

    let allKordy = kordyRaw.match(/\d{3}\|\d{3}/g) || [];
    let filtrKordy = allKordy.filter(c => !sentCoords[c]).join(' ');

    const ui = document.createElement('div');
    ui.id = "fejk_ui_main";
    ui.className = "tcn-panel";
    ui.style.position = isPinned ? 'absolute' : 'fixed';
    ui.style.top = pos.t + 'px';
    ui.style.left = pos.l + 'px';
    ui.style.width = '300px';
    ui.style.display = (getS('ui_visible', 'true') === 'true' || isWait) ? 'block' : 'none';

    let unitsHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; width:100%; gap:2px;">`;
    unitsList.forEach(unit => {
        unitsHtml += `
            <div style="display:flex; flex-direction:column; align-items:center; flex:1;">
                <img src="/graphic/unit/unit_${unit}.png" style="width:18px; height:18px; margin-bottom:3px;" alt="${unit}">
                <input type="checkbox" id="uc_${unit}" class="tcn-chk" ${u[unit].on ? 'checked' : ''} title="Użyj tej jednostki">
                <input id="u_${unit}" class="tcn-input" value="${u[unit].n}" ${u[unit].on ? '' : 'disabled'} title="0 = dopełniaj automatycznie, liczba = dokładnie tyle" style="width:100%; max-width:30px; text-align:center; padding:3px 1px;">
            </div>`;
    });
    unitsHtml += `</div>
        <div style="font-size:9px; color:#b9bbbe; text-align:center; margin-bottom:10px; line-height:1.3;">☑ użyj jednostki &nbsp;|&nbsp; <b>0</b> = dopełnij automatycznie &nbsp;|&nbsp; <b>liczba</b> = dokładnie tyle</div>`;

    let daysOptionsFrom = '', daysOptionsTo = '';
    let monthsOptionsFrom = '', monthsOptionsTo = '';
    for (let d = 1; d <= 31; d++) {
        let valD = String(d).padStart(2, '0');
        daysOptionsFrom += `<option value="${valD}" ${valD === selDayFrom ? 'selected' : ''}>${valD}</option>`;
        daysOptionsTo += `<option value="${valD}" ${valD === selDayTo ? 'selected' : ''}>${valD}</option>`;
    }
    for (let m = 1; m <= 12; m++) {
        let valM = String(m).padStart(2, '0');
        monthsOptionsFrom += `<option value="${valM}" ${valM === selMonthFrom ? 'selected' : ''}>${valM}</option>`;
        monthsOptionsTo += `<option value="${valM}" ${valM === selMonthTo ? 'selected' : ''}>${valM}</option>`;
    }

    let hoursOptionsFrom = '', hoursOptionsTo = '';
    for (let h = 0; h < 24; h++) {
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

        <div style="font-size:10px; margin-bottom:8px; color:var(--title-color); text-align:center; display:flex; justify-content:center; align-items:center; gap:8px;">
            <span>Dostępne: <b style="color:#5cb85c;">${filtrKordy.split(' ').filter(x => x).length}</b></span>
            <span>|</span>
            <span>Wysłano: <b id="ui_count_val" style="color:#fbc02d;">${count}</b></span>
            <span id="btn_reset_count" style="cursor:pointer; color:#ff4d4d; font-size:14px; font-weight:bold;" title="Zresetuj licznik limitu w tej wiosce">⟳</span>
        </div>

        <select id="f_tryb" class="tcn-input" style="width:100%; margin-bottom:6px; font-weight:bold; text-align:center;">
            <option value="kordy" ${tryb === 'kordy' ? 'selected' : ''}>📋 Z listy kordów (Hermit)</option>
            <option value="skrypt" ${tryb === 'skrypt' ? 'selected' : ''}>📜 Własny skrypt na pasku</option>
        </select>

        <textarea id="f_custom_script" class="tcn-input" placeholder="Wklej tutaj SWÓJ skrypt z paska..." style="width:100%; height:45px; margin-bottom:6px; resize:vertical; background: #2f3136; border: 1px solid #7289da; display:${tryb === 'skrypt' ? 'block' : 'none'};">${customScript}</textarea>

        <div id="kordy_container" style="display:${tryb === 'kordy' ? 'block' : 'none'};">
            <textarea id="f_k" class="tcn-input" placeholder="Wklej kordy tutaj..." style="width:100%; height:45px; margin-bottom:6px; resize:vertical;">${kordyRaw}</textarea>
            <div style="display:flex; gap:5px; margin-bottom:6px; width:100%;">
                <input id="f_g" class="tcn-input" value="${gracze}" placeholder="Gracze" style="flex:1; width:50%;">
                <input id="f_t" class="tcn-input" value="${tagi}" placeholder="Tagi" style="flex:1; width:50%;">
            </div>
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
            <button id="sav_btn" class="tcn-btn" style="flex:1;">💾 ZAPISZ</button>
            <button id="tog_btn" class="tcn-btn" style="flex:1; background:${isRun ? 'var(--btn-red-bg)' : 'var(--btn-green-bg)'} !important;">${isRun ? '❎ STOP' : '✅ START'}</button>
        </div>
        <div id="status_info" style="text-align:center; font-size:11px; color:#ff4d4d; font-weight:bold; margin-top:8px;"></div>
    `;
    document.body.appendChild(ui);

    if (!$('#f_trigger').length) {
        $('#menu_row2').append(`<td><a href="#" id="f_trigger" style="text-decoration:none; padding: 0 5px;" title="Otwórz FEJKOMAT PRO"><img src="/graphic/unit/unit_spy.png" style="width:18px; height:18px; vertical-align:middle;"></a></td>`);
    }

    $('#f_trigger').click((e) => { e.preventDefault(); ui.style.display = 'block'; setS('ui_visible', 'true'); });
    $('#close_fejk').click(() => { ui.style.display = 'none'; setS('ui_visible', 'false'); });

    // Checkbox jednostki włącza / wyłącza pole z liczbą
    unitsList.forEach(unit => {
        $(`#uc_${unit}`).change(function() {
            $(`#u_${unit}`).prop('disabled', !this.checked);
        });
    });

    // Ręczny reset limitu w bieżącej wiosce
    $('#btn_reset_count').click(() => {
        localStorage.removeItem(cKey);
        count = 0;
        $('#ui_count_val').text('0');
        let info = document.getElementById('status_info');
        info.innerText = "Zresetowano licznik!";
        info.style.color = "#5cb85c";
        setTimeout(() => { info.innerText = ""; info.style.color = "#ff4d4d"; }, 2000);
    });

    $('#f_tryb').change(function() {
        if ($(this).val() === 'skrypt') {
            $('#f_custom_script').show();
            $('#kordy_container').hide();
        } else {
            $('#f_custom_script').hide();
            $('#kordy_container').show();
        }
    });

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
        setS('tryb', $('#f_tryb').val());
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
        unitsList.forEach(unit => {
            newU[unit] = {
                on: $(`#uc_${unit}`).is(':checked'),
                n: Math.max(0, parseInt($(`#u_${unit}`).val()) || 0)
            };
        });
        setS('wojsko_v2', JSON.stringify(newU));

        let info = document.getElementById('status_info');
        info.innerText = "Zapisano pomyślnie!";
        info.style.color = "#5cb85c";
        setTimeout(() => { info.innerText = ""; info.style.color = "#ff4d4d"; }, 2000);
    });

    $('#tog_btn').click(() => {
        if (!isRun) {
            setS('stan', 'START');
            setS('visited', JSON.stringify([vId]));
            setS('jumped', 'false');
            setS('pending', '');
            setS('loop_wait', 'false');
            Object.keys(localStorage).forEach(k => { if (k.startsWith('kf_v_cnt_')) localStorage.removeItem(k); });
        } else {
            setS('stan', 'STOP');
            setS('loop_wait', 'false');
            setS('pending', '');
        }
        location.reload();
    });

    // --- PRZECIĄGANIE PANELU (podpinane PRZED logiką automatu) ---
    const dragH = document.getElementById('drag_h');
    let isDragging = false, sX, sY, iX, iY;

    const startDrag = (e) => {
        if (isPinned || e.target.id === 'close_fejk' || e.target.id === 'pin_fejk') return;
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

    // --- FUNKCJE POMOCNICZE AUTOMATU ---
    const endCycle = () => {
        setS('loop_wait', 'true');
        setS('jumped', 'false');
        setS('visited', '[]');
        setS('pending', '');
        setS('next_run', Date.now() + (petla * 60000));
        Object.keys(localStorage).forEach(k => { if (k.startsWith('kf_v_cnt_')) localStorage.removeItem(k); });
        location.reload();
    };

    const delayedNextV = (message) => {
        let info = document.getElementById('status_info');
        if (info) info.innerText = message + " - Przeskok...";
        setTimeout(() => {
            const n = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
            if (!n) { endCycle(); return; }
            setS('jumped', 'true');
            n.click();
        }, JUMP_DELAY);
    };

    const submitConfirm = () => {
        const b = document.querySelector('#troop_confirm_submit');
        if (!b) return;
        const t = document.querySelector('.village_anchor')?.innerText.match(/\d{3}\|\d{3}/);
        setS('pending', t ? t[0] : '?');
        b.click();
    };

    const getAvailableTroops = (unitName) => {
        let element = document.getElementById('units_entry_all_' + unitName);
        if (!element) return 0;
        return parseInt(element.innerText.replace(/\D/g, '') || '0');
    };

    // Szybkie sprawdzenie, czy w wiosce w ogóle da się zrobić fejka
    const hasEnoughTroops = () => {
        // jednostki z dokładną liczbą muszą być dostępne w całości
        for (const unit of exactUnits) {
            if (getAvailableTroops(unit) < u[unit].n) return false;
        }
        // brak dokładnych jednostek => musi być cokolwiek do dopełnienia
        if (!exactUnits.length && !fillUnits.some(unit => getAvailableTroops(unit) > 0)) return false;
        return true;
    };

    const triggerAll = (el) => {
        if (!el) return;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    };

    // --- GŁÓWNA LOGIKA AUTOMATU ---
    if (isRun) {
        // Tryb oczekiwania na kolejną pętlę
        if (isWait) {
            let targetTime = parseInt(getS('next_run', '0'));
            let waitInterval = setInterval(() => {
                let diff = Math.ceil((targetTime - Date.now()) / 1000);
                if (diff <= 0) {
                    clearInterval(waitInterval);
                    setS('loop_wait', 'false');
                    setS('visited', JSON.stringify([vId]));
                    setS('jumped', 'false');
                    setS('pending', '');
                    Object.keys(localStorage).forEach(k => { if (k.startsWith('kf_v_cnt_')) localStorage.removeItem(k); });
                    location.reload();
                } else {
                    let info = document.getElementById('status_info');
                    if (info) info.innerText = `⌛ RESTART ZA: ${Math.floor(diff / 60)}m ${String(diff % 60).padStart(2, '0')}s`;
                }
            }, 1000);
            return;
        }

        // Wykrywanie końca cyklu: po przeskoku trafiliśmy na wioskę już odwiedzoną
        if (getS('jumped', 'false') === 'true') {
            setS('jumped', 'false');
            let visited = JSON.parse(getS('visited', '[]'));
            if (visited.includes(vId)) { endCycle(); return; }
            visited.push(vId);
            setS('visited', JSON.stringify(visited));
        }

        // Strona potwierdzenia – tylko klikamy "Wyślij" (liczenie dopiero po weryfikacji)
        if (isConfirmPage) {
            setTimeout(submitConfirm, CONFIRM_DELAY);
            return;
        }

        // Nie wybrano żadnych jednostek - nie ma co robić
        if (!exactUnits.length && !fillUnits.length) {
            let info = document.getElementById('status_info');
            if (info) info.innerText = "Zaznacz jednostki (checkbox) i zapisz!";
            return;
        }

        if (count >= limit) {
            delayedNextV("Limit osiągnięty!");
            return;
        }

        // Brak wojska => od razu następna wioska (bez ładowania Hermita)
        if (tryb !== 'skrypt' && !hasEnoughTroops()) {
            delayedNextV("Brak wojska z panelu!");
            return;
        }

        // ---------- TRYB: WŁASNY SKRYPT ----------
        if (tryb === 'skrypt' && customScript.trim().length > 10) {
            let cleanScript = customScript.trim();
            if (cleanScript.match(/^javascript:/i)) {
                cleanScript = cleanScript.replace(/^javascript:/i, '');
                if (cleanScript.includes('%20')) {
                    try { cleanScript = decodeURIComponent(cleanScript); } catch (e) {}
                }
            }
            cleanScript = cleanScript.replace(/void\(0\);?$/i, '').trim();

            try {
                window.eval(cleanScript);
            } catch (e) {
                console.error("Fejkomat: Błąd skryptu:", e);
            }

            let t = 0;
            let c = setInterval(() => {
                let currentTargetInp = document.querySelector('.target-input-field');

                if (currentTargetInp && currentTargetInp.value.match(/(\d{3})\|(\d{3})/)) {
                    let match = currentTargetInp.value.match(/(\d{3})\|(\d{3})/);
                    clearInterval(c);

                    let cx = document.querySelector('input[name="x"]');
                    let cy = document.querySelector('input[name="y"]');
                    if (cx) { cx.value = match[1]; triggerAll(cx); }
                    if (cy) { cy.value = match[2]; triggerAll(cy); }
                    triggerAll(currentTargetInp);

                    // Wojska z panelu wpisujemy tylko, jeśli skrypt użytkownika sam niczego nie wpisał
                    let hasUnitsFilled = false;
                    unitsList.forEach(un => {
                        let el = document.getElementById('unit_input_' + un);
                        if (el && parseInt(el.value || 0) > 0) hasUnitsFilled = true;
                    });

                    if (!hasUnitsFilled) {
                        exactUnits.forEach(unit => {
                            let unitInp = document.getElementById('unit_input_' + unit);
                            if (unitInp) {
                                unitInp.value = u[unit].n;
                                triggerAll(unitInp);
                            }
                        });
                    }

                    setTimeout(() => {
                        let atkBtn = document.getElementById('target_attack');
                        if (atkBtn && !atkBtn.disabled && !atkBtn.classList.contains('btn-disabled')) {
                            atkBtn.click();
                        } else {
                            delayedNextV("Błąd kliknięcia (brak limitu/wojska)");
                        }
                    }, ATTACK_CLICK_DELAY);
                }
                if (t++ > SCRIPT_TARGET_TICKS) {
                    clearInterval(c);
                    delayedNextV("Twój skrypt nie wygenerował celu...");
                }
            }, 250);
            return;
        }

        // ---------- TRYB: KORDY (Hermit) ----------
        if (tryb === 'kordy') {
            // Szablon: tylko jednostki z dokładną liczbą
            let tpl = {};
            exactUnits.forEach(unit => { tpl[unit] = u[unit].n; });

            const priority = { spy: 1, axe: 2, light: 3, heavy: 4, sword: 5, spear: 6 };
            const byPriority = (a, b) => (priority[a] || 99) - (priority[b] || 99);

            // Dopełnianie: jednostki z checkboxem i wartością 0
            let customFill = fillUnits.slice().sort(byPriority).join(',');
            // Gdy nie ma jednostek do dopełniania, używamy tych z dokładną liczbą (bez taranów/katapult)
            if (!customFill) {
                customFill = exactUnits
                    .filter(unit => unit !== 'ram' && unit !== 'catapult')
                    .sort(byPriority)
                    .join(',');
            }
            if (!customFill) customFill = 'spy,axe,light,heavy,sword,spear';

            let dateFromStr = `${selDayFrom}.${selMonthFrom}.${defaultYear}`;
            let dateToStr = `${selDayTo}.${selMonthTo}.${defaultYear}`;

            let rangeTime = `${dateFromStr} ${timeFrom} - ${dateToStr} ${timeTo}`;

            window.HermitowskieFejki = {
                troops_templates: [tpl],
                fill_troops: customFill,
                coords: filtrKordy, players: gracze, ally_tags: tagi, date_ranges: [rangeTime],
                blocking_enabled: true, skip_night_bonus: true, changing_village_enabled: false
            };

            let targetInp = document.querySelector('.target-input-field');
            let xInp = document.querySelector('input[name="x"]');
            let yInp = document.querySelector('input[name="y"]');
            if (targetInp) targetInp.value = '';
            if (xInp) xInp.value = '';
            if (yInp) yInp.value = '';

            const s = document.createElement('script');
            s.src = 'https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskieFejki.js';
            s.onload = () => {
                setTimeout(() => {
                    let t = 0;
                    let c = setInterval(() => {
                        let currentTargetInp = document.querySelector('.target-input-field');
                        if (currentTargetInp) {
                            let match = currentTargetInp.value.match(/(\d{3})\|(\d{3})/);
                            if (match) {
                                clearInterval(c);
                                let cx = document.querySelector('input[name="x"]');
                                let cy = document.querySelector('input[name="y"]');
                                if (cx) { cx.value = match[1]; triggerAll(cx); }
                                if (cy) { cy.value = match[2]; triggerAll(cy); }

                                setTimeout(() => {
                                    let atkBtn = document.getElementById('target_attack');
                                    if (atkBtn && !atkBtn.disabled && !atkBtn.classList.contains('btn-disabled')) {
                                        atkBtn.click();
                                    } else {
                                        delayedNextV("Przycisk ataku niedostępny");
                                    }
                                }, ATTACK_CLICK_DELAY);
                            }
                        }
                        if (t++ > TARGET_TICKS) {
                            clearInterval(c);
                            delayedNextV("Brak celu w zasięgu czasowym");
                        }
                    }, 250);
                }, HERMIT_DELAY);
            };
            document.head.appendChild(s);
        }
    }
})();
