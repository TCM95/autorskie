// ==UserScript==
// @name         Kalkulator Handlowy
// @namespace    https://viayoo.com/
// @version      1.8
// @description  Zintegrowany kalkulator surowców z szarym przyciskiem na dole paska skrótów.
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*
// ==/UserScript==

(function() {
    'use strict';
    if (typeof game_data === 'undefined') return;

    const vId = game_data.village.id;
    const world = window.location.hostname.split('.')[0];
    const urlParams = new URLSearchParams(window.location.search);

    const STORAGE_KEY_OFFERS = `etykiety_market_offers_${world}`;
    const STORAGE_KEY_STATE = `etykiety_ui_state_${world}`;
    const STORAGE_KEY_POS = `etykiety_pos_${world}`;
    const STORAGE_KEY_TARGET = `etykiety_target_${vId}`;
    const STORAGE_KEY_CALL = `etykiety_call_${vId}`;
    const STORAGE_KEY_CHECKS = `etykiety_checkboxes_${vId}`;
    const STORAGE_KEY_BUILDING_CHECKS = `etykiety_bchecks_${vId}_${game_data.screen}`;

    let autoSyncTimer = null;
    let resourceRefreshTimer = null;

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
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
        }
        .kalk-ui * { box-sizing: border-box; }
        .kalk-ui { 
            background: var(--bg-main); 
            color: var(--text-color); 
            border: 1px solid var(--border-color); 
            position: fixed !important;
            z-index: 9999999 !important;
            border-radius: 5px;
            font-family: Arial;
            font-size: 11px;
            width: 280px;
            max-width: 95vw;
            box-shadow: 0 0 15px rgba(0,0,0,0.6);
            display: none;
            touch-action: none;
        }
        .kalk-header { background: var(--bg-header); color: var(--title-color); border-bottom: 1px solid var(--border-color); padding:8px 10px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; user-select:none; cursor: move; }
        .kalk-btn { background: var(--btn-bg); color: var(--text-color); border: 1px solid var(--border-color); cursor: pointer; padding: 4px 6px; border-radius: 3px; font-size: 11px; }
        .kalk-btn:hover { background: var(--btn-hover); }
        .kalk-btn-green { background: var(--btn-green-bg); }
        .kalk-btn-green:hover { background: var(--btn-green-hover); }
        .kalk-input { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 3px; border-radius: 3px; font-size: 11px; }
        
        .kalk-shortcut-container {
            width: 100% !important;
            clear: both !important;
            display: block !important;
            margin-top: 5px !important;
            padding: 0 !important;
            list-style: none !important;
        }
        .kalk-shortcut-btn {
            background: var(--btn-bg) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 3px !important;
            width: 30px !important;
            height: 30px !important;
            display: inline-flex !important;
            justify-content: center !important;
            align-items: center !important;
            cursor: pointer !important;
            font-size: 16px !important;
            margin: 2px !important;
            vertical-align: middle !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .kalk-shortcut-btn:hover {
            background: var(--btn-hover) !important;
        }
    `;
    document.head.appendChild(style);

    const silentSelect = (s) => {
        const el = $(s);
        if (el.length) el.prop('disabled', false).prop('checked', true).trigger('change');
    };

    const cleanNum = (v) => {
        if (!v) return 0;
        let tmp = document.createElement("div");
        tmp.innerHTML = v;
        let text = tmp.textContent || tmp.innerText || "";
        let s = text.replace(/\./g, '').replace(/\s+/g, '');
        return parseInt(s.replace(/\D/g, '')) || 0;
    };

    function readCurrentResource(resourceId, fallbackValue) {
        const el = document.getElementById(resourceId);
        if (el) {
            const value = parseInt((el.textContent || el.value || '').replace(/[^\d]/g, ''), 10);
            if (Number.isFinite(value)) return value;
        }
        const fallback = Number(fallbackValue);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    function startResourceRefresh() {
        if (resourceRefreshTimer) clearInterval(resourceRefreshTimer);
        resourceRefreshTimer = setInterval(() => {
            if (!ui || $(ui).is(':hidden')) return;
            fillData();
            calculateTrade();
        }, 3000);
    }

    function stopResourceRefresh() {
        if (resourceRefreshTimer) {
            clearInterval(resourceRefreshTimer);
            resourceRefreshTimer = null;
        }
    }

    function updateHermitData(w, g, i) {
        if (w > 0 || g > 0 || i > 0) {
            localStorage.setItem('Etykiety_Hermit_Dynamic', JSON.stringify({ 'wood': w, 'stone': g, 'iron': i }));
        }
    }

    function formatFullDate(h) {
        if (h <= 0 || !isFinite(h)) return "Teraz ✅️";
        const d = new Date(); d.setMilliseconds(d.getMilliseconds() + (h * 3600000));
        return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    async function syncMarketDataInBackground() {
        try {
            const [resMarket, resOffers] = await Promise.all([
                fetch(TribalWars.buildURL('GET', 'market')),
                fetch(TribalWars.buildURL('GET', 'market', {mode: 'own_offer'}))
            ]);

            const htmlMarket = await resMarket.text();
            const htmlOffers = await resOffers.text();
            const parser = new DOMParser();

            const docM = parser.parseFromString(htmlMarket, 'text/html');
            const docO = parser.parseFromString(htmlOffers, 'text/html');

            let inc = {w: 0, g: 0, i: 0};
            $(docM).find('th:contains("Przybywające")').each(function() {
                let header = $(this);
                header.find('.nowrap').each(function() {
                    let item = $(this);
                    let val = parseInt(item.text().replace(/\./g, '').replace(/\s+/g, '')) || 0;
                    let html = item.html();
                    if (html.includes('wood')) inc.w += val;
                    else if (html.includes('stone')) inc.g += val;
                    else if (html.includes('iron')) inc.i += val;
                });
            });
            localStorage.setItem(`calc_inc_${vId}`, JSON.stringify(inc));

            let offLog = [];
            $(docO).find('table.vis').each(function() {
                if ($(this).text().includes('Oferta') && $(this).text().includes('Za')) {
                    $(this).find('tr').each(function() {
                        let tds = $(this).find('td');
                        if (tds.length >= 4) {
                            let tdOddasz = tds.eq(1);
                            let tdDostaniesz = tds.eq(2);
                            let tdIlosc = tds.eq(3);

                            let iconO = tdOddasz.find('.icon').attr('class') || "";
                            let iconF = tdDostaniesz.find('.icon').attr('class') || "";
                            let count = cleanNum(tdIlosc.text()) || 1;

                            if (iconO.includes('icon') && iconF.includes('icon')) {
                                offLog.push({
                                    oddasz: { amt: cleanNum(tdOddasz.text()) * count, k: iconO.split(' ').pop().replace('res-', '') },
                                    dostaniesz: { amt: cleanNum(tdDostaniesz.text()) * count, k: iconF.split(' ').pop().replace('res-', '') }
                                });
                            }
                        }
                    });
                }
            });

            let gd = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFERS)) || {};
            gd[vId] = offLog;
            localStorage.setItem(STORAGE_KEY_OFFERS, JSON.stringify(gd));

            return true;
        } catch (error) {
            console.error("❗ Błąd synchronizacji w tle:", error);
            return false;
        }
    }

    function startAutoSync() {
        if (autoSyncTimer) clearInterval(autoSyncTimer);
        autoSyncTimer = setInterval(async () => {
            if ($(ui).is(':hidden')) return;
            await syncMarketDataInBackground();
            calculateTrade();
        }, 20000);
    }

    function stopAutoSync() {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
        }
    }

    function saveCheckboxesState() {
        const state = {
            farm: $('#chk_farm').is(':checked'),
            scav: $('#chk_scav').is(':checked'),
            call: $('#chk_call').is(':checked')
        };
        localStorage.setItem(STORAGE_KEY_CHECKS, JSON.stringify(state));
    }

    function saveBuildingCheckboxesState() {
        let checkedIndices = [];
        $('.calc-check').each(function(index) {
            if ($(this).is(':checked')) {
                checkedIndices.push(index);
            }
        });
        localStorage.setItem(STORAGE_KEY_BUILDING_CHECKS, JSON.stringify(checkedIndices));
    }

    function calculateTrade() {
        const target = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET)) || {w:0, g:0, i:0, name:'Brak'};
        const inc = JSON.parse(localStorage.getItem(`calc_inc_${vId}`)) || { w:0, g:0, i:0 };
        let userPw = parseInt($('#p_w').val());
        let userPg = parseInt($('#p_g').val());
        let userPi = parseInt($('#p_i').val());

        const p = {
            w: userPw > 0 ? userPw : Math.max(1, Math.round(game_data.village.wood_prod * 3600)),
            g: userPg > 0 ? userPg : Math.max(1, Math.round(game_data.village.stone_prod * 3600)),
            i: userPi > 0 ? userPi : Math.max(1, Math.round(game_data.village.iron_prod * 3600))
        };

        const realM = {
            w: parseInt($('#m_w').val()) || 0,
            g: parseInt($('#m_g').val()) || 0,
            i: parseInt($('#m_i').val()) || 0
        };

        const realB = { w: Math.max(0, target.w - realM.w), g: Math.max(0, target.g - realM.g), i: Math.max(0, target.i - realM.i) };
        const tReal = Math.max(realB.w/p.w, realB.g/p.g, realB.i/p.i);

        let resBox = document.getElementById('results');
        if (!resBox) return;
        resBox.style.display = "block";

        $('#target_label').text(target.name || 'Brak');
        
        if ($('#chk_call').is(':checked')) {
            updateHermitData(target.w, target.g, target.i);
        } else {
            localStorage.removeItem('Etykiety_Hermit_Dynamic');
        }

        let html = `<div style="padding-bottom:8px; border-bottom:1px solid var(--border-color); margin-bottom:8px; text-align:center;"><b style="color:var(--title-color);">STAN AKTUALNY</b><br><b style="font-size: 12px;">[ ${formatFullDate(tReal)} ]</b></div>`;

        let offers = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFERS))?.[vId] || [];
        let allExp = { w: 0, g: 0, i: 0 };
        offers.forEach(o => {
            let k = (o.dostaniesz.k || "").toLowerCase();
            let key = k.includes('wood') ? 'w' : k.includes('stone') ? 'g' : 'i';
            allExp[key] += o.dostaniesz.amt;
        });

        const virtM = { w: realM.w + allExp.w, g: realM.g + allExp.g, i: realM.i + allExp.i };
        const virtB = { w: Math.max(0, target.w - virtM.w), g: Math.max(0, target.g - virtM.g), i: Math.max(0, target.i - virtM.i) };
        const tVirt = Math.max(virtB.w/p.w, virtB.g/p.g, virtB.i/p.i);

        if ((virtB.w > 0 || virtB.g > 0 || virtB.i > 0) && $('#chk_call').is(':checked')) {
            html += `
            <div style="margin-bottom:8px; text-align:center;">
                <button id="do_wezwij_btn" data-w="${virtB.w}" data-g="${virtB.g}" data-i="${virtB.i}" class="kalk-btn kalk-btn-green" style="width:100%;">Wezwij Handlarzy</button>
                <div style="height:1px; background:var(--border-color); margin: 4px 5%;"></div>
                <div style="font-size:10px; color:var(--text-color);">Brakuje:
                    ${virtB.w > 0 ? `<span class="icon header wood" style="transform:scale(0.8);"></span>${virtB.w.toLocaleString()} ` : ''}
                    ${virtB.g > 0 ? `<span class="icon header stone" style="transform:scale(0.8);"></span>${virtB.g.toLocaleString()} ` : ''}
                    ${virtB.i > 0 ? `<span class="icon header iron" style="transform:scale(0.8);"></span>${virtB.i.toLocaleString()}` : ''}
                </div>
            </div>`;
        }

        const buildH = (txt) => `<div style="text-align:center; margin-top:8px; border-top: 1px dashed var(--border-color); padding-top:4px; font-weight:bold;">${txt}</div>`;
        html += buildH("Przychodzące (Rynek)");
        html += `<div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:3px; padding:4px; display:flex; justify-content:space-around; margin-top:3px; font-size:10px;">
            <span><span class="icon header wood"></span> ${inc.w.toLocaleString()}</span><span><span class="icon header stone"></span> ${inc.g.toLocaleString()}</span><span><span class="icon header iron"></span> ${inc.i.toLocaleString()}</span>
        </div>`;

        html += buildH("Własne oferty");
        if (!offers.length) html += `<div style="text-align:center; font-size:10px; color:#aaa; padding:3px;">Brak danych.</div>`;
        else offers.forEach(o => {
            html += `<div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:3px; padding:3px; margin-top:3px; font-size:10px;">
                <div style="display:flex; justify-content:space-between;"><span>[${o.oddasz.amt.toLocaleString()}] <span class="icon header ${o.oddasz.k}"></span></span>➔<span>[${o.dostaniesz.amt.toLocaleString()}] <span class="icon header ${o.dostaniesz.k}"></span></span></div>
            </div>`;
        });
        resBox.innerHTML = html;

        $('#do_wezwij_btn').off('click').on('click', function() {
            const req = { w: $(this).data('w'), g: $(this).data('g'), i: $(this).data('i') };
            localStorage.setItem(STORAGE_KEY_CALL, JSON.stringify(req));
            window.location.href = `game.php?village=${vId}&screen=market&mode=call`;
        });
    }

    let savedP = JSON.parse(localStorage.getItem(STORAGE_KEY_POS)) || { top: 100, left: 20 };
    savedP.top = parseInt(savedP.top) || 100;
    savedP.left = parseInt(savedP.left) || 20;

    let ui = document.createElement('div');
    ui.id = "etykiety_ui";
    ui.className = "kalk-ui";
    ui.style.top = savedP.top + 'px';
    ui.style.left = savedP.left + 'px';

    ui.innerHTML = `<div id="calc_header" class="kalk-header">
        <span>Kalkulator & Handlarz</span>
        <span id="close_btn" style="cursor:pointer; padding: 0 2px;">❌</span>
    </div>
    <div style="padding:8px; max-height: 80vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:10px;">
            <span>Produkcja na /h (możesz edytować):</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; align-items:center; gap:4px;">
                <span class="icon header wood" style="width:18px;"></span>
                <input id="m_w" type="number" class="kalk-input" style="flex:1; width:50%;">
                <input id="p_w" type="number" class="kalk-input" style="flex:1; width:50%;">
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <span class="icon header stone" style="width:18px;"></span>
                <input id="m_g" type="number" class="kalk-input" style="flex:1; width:50%;">
                <input id="p_g" type="number" class="kalk-input" style="flex:1; width:50%;">
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <span class="icon header iron" style="width:18px;"></span>
                <input id="m_i" type="number" class="kalk-input" style="flex:1; width:50%;">
                <input id="p_i" type="number" class="kalk-input" style="flex:1; width:50%;">
            </div>
        </div>
        <div style="display:flex; gap:4px; margin-top:8px;">
            <button id="sync_btn" class="kalk-btn" style="flex:1;" title="Pobierz dane ze spichlerza">Spichlerz</button>
        </div>
        <div style="margin-top:6px; background:var(--bg-row-alt); border:1px solid var(--border-color); border-radius:3px; padding:6px; font-size:10px;">
            <div style="font-weight:bold; margin-bottom:4px; text-align:center;">Dolicz surowce w drodze / Opcje</div>
            <div style="display:flex; justify-content:space-around; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
                <label style="cursor:pointer;"><input type="checkbox" id="chk_farm" style="vertical-align:middle;"> ⚔️ Farma (<span id="f_count">0</span>)</label>
                <label style="cursor:pointer;"><input type="checkbox" id="chk_scav" style="vertical-align:middle;"> Zbierak</label>
                <label style="cursor:pointer;"><input type="checkbox" id="chk_call" style="vertical-align:middle;"> Wezwij</label>
            </div>
            <div id="kombi_preview" style="text-align:center; color:#4caf50; display:none;">
                + <span class="icon header wood" style="transform:scale(0.8);"></span><span id="kp_w">0</span>
                <span class="icon header stone" style="transform:scale(0.8);"></span><span id="kp_g">0</span>
                <span class="icon header iron" style="transform:scale(0.8);"></span><span id="kp_i">0</span>
            </div>
        </div>
        <div style="margin-top:8px; border-top:1px solid var(--border-color); padding-top:6px;">
            <div style="margin-bottom:4px;"><b>CEL: <span id="target_label" style="font-weight:normal; color:#4caf50;">Brak</span></b></div>
            <div style="display:flex; gap:4px;">
                <input id="c_w" type="number" value="0" class="kalk-input" style="flex:1; width:33%;">
                <input id="c_g" type="number" value="0" class="kalk-input" style="flex:1; width:33%;">
                <input id="c_i" type="number" value="0" class="kalk-input" style="flex:1; width:33%;">
            </div>
        </div>
        <div style="display:flex; gap:4px; margin-top:6px;">
            <button id="set_moneta" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">🪙 Moneta</button>
            <button id="set_gruby" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">👑 Gruby</button>
        </div>
        <div style="display:flex; gap:4px; margin-top:6px;">
            <button id="calc_btn" class="kalk-btn" style="flex:4; font-weight:bold;">OBLICZ</button>
            <button id="clear_btn" class="kalk-btn" style="flex:1;">🗑️</button>
        </div>
        <div id="results" style="margin-top:8px; background:var(--bg-row-alt); padding:6px; display:none; border:1px solid var(--border-color); border-radius:3px;"></div>
    </div>`;
    document.body.appendChild(ui);

    function addShortcutButton() {
        if ($('#calc_shortcut_btn').length) return;
        const btnContainerHTML = `<ul class="kalk-shortcut-container"><li><button id="calc_shortcut_btn" class="kalk-shortcut-btn" title="Kalkulator Handlowy">🧮</button></li></ul>`;
        let parentEl = $('#quickbar_contents');
        if (!parentEl.length) parentEl = $('#quickbar_outer');
        if (!parentEl.length) parentEl = $('#menu_row');
        if (parentEl.length) {
            parentEl.append(btnContainerHTML);
        } else {
            $('body').append(btnContainerHTML);
        }

        $('#calc_shortcut_btn').on('click', async (e) => {
            e.preventDefault();
            const shouldOpen = $(ui).is(':hidden');
            $(ui).toggle();
            localStorage.setItem(STORAGE_KEY_STATE, shouldOpen ? 'open' : 'closed');
            if (shouldOpen) {
                await loadExternalBootyData();
                await syncMarketDataInBackground();
                fillData();
                calculateTrade();
                startAutoSync();
                startResourceRefresh();
            } else {
                stopAutoSync();
                stopResourceRefresh();
            }
        });
    }
    addShortcutButton();

    let drag = false, sx, sy, il, it;
    const headerEl = ui.querySelector('#calc_header');

    const onStart = (e) => {
        drag = true;
        const t = e.type.includes('touch') ? e.touches[0] : e;
        sx = t.clientX;
        sy = t.clientY;
        il = ui.offsetLeft;
        it = ui.offsetTop;
    };

    const onMove = (e) => {
        if (!drag) return;
        const t = e.type.includes('touch') ? e.touches[0] : e;
        ui.style.left = (il + (t.clientX - sx)) + 'px';
        ui.style.top = (it + (t.clientY - sy)) + 'px';
        if (e.type === 'touchmove') e.preventDefault();
    };

    const onEnd = () => {
        if (drag) {
            drag = false;
            localStorage.setItem(STORAGE_KEY_POS, JSON.stringify({ top: parseInt(ui.style.top), left: parseInt(ui.style.left) }));
        }
    };

    headerEl.addEventListener('mousedown', onStart);
    headerEl.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    let cachedFarmData = { w: 0, g: 0, i: 0, count: 0 };
    let cachedScavData = { w: 0, g: 0, i: 0 };

    async function loadExternalBootyData() {
        cachedFarmData = { w: 0, g: 0, i: 0, count: 0 };
        cachedScavData = { w: 0, g: 0, i: 0 };
        try {
            const html = await $.ajax({ url: `/game.php?village=${vId}&screen=overview` });
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const returning = $(doc).find('.command-row, .command').filter((_, x) => $(x).text().includes('powrót'));
            const ids = [...new Set(returning.map((_, x) => $(x).attr('data-id')).get())];
            cachedFarmData.count = ids.length;
            for (const id of ids) {
                try {
                    const cRes = await $.ajax({ url: `/game.php?village=${vId}&screen=info_command&ajax=details&id=${id}`, dataType: 'json' });
                    if (cRes?.booty) {
                        cachedFarmData.w += parseInt(cRes.booty.wood) || 0;
                        cachedFarmData.g += parseInt(cRes.booty.stone) || 0;
                        cachedFarmData.i += parseInt(cRes.booty.iron) || 0;
                    }
                } catch (e) {
                    // ignore
                }
            }
            $('#f_count').text(cachedFarmData.count);
        } catch (e) {
            console.error('❗ Błąd pobierania danych zewnętrznych:', e);
        }
    }

    function initProdFields() {
        if (!$('#p_w').val()) $('#p_w').val(Math.round(game_data.village.wood_prod * 3600));
        if (!$('#p_g').val()) $('#p_g').val(Math.round(game_data.village.stone_prod * 3600));
        if (!$('#p_i').val()) $('#p_i').val(Math.round(game_data.village.iron_prod * 3600));
    }

    function fillData() {
        const sInc = JSON.parse(localStorage.getItem(`calc_inc_${vId}`)) || {w:0, g:0, i:0};
        const baseW = readCurrentResource('wood', game_data.village.wood) + (sInc.w || 0);
        const baseG = readCurrentResource('stone', game_data.village.stone) + (sInc.g || 0);
        const baseI = readCurrentResource('iron', game_data.village.iron) + (sInc.i || 0);

        let addW = 0, addG = 0, addI = 0;
        if ($('#chk_farm').is(':checked')) {
            addW += cachedFarmData.w;
            addG += cachedFarmData.g;
            addI += cachedFarmData.i;
        }
        if ($('#chk_scav').is(':checked')) {
            addW += cachedScavData.w;
            addG += cachedScavData.g;
            addI += cachedScavData.i;
        }

        if (addW > 0 || addG > 0 || addI > 0) {
            $('#kombi_preview').show();
            $('#kp_w').text(addW.toLocaleString());
            $('#kp_g').text(addG.toLocaleString());
            $('#kp_i').text(addI.toLocaleString());
        } else {
            $('#kombi_preview').hide();
        }

        $('#m_w').val(baseW + addW);
        $('#m_g').val(baseG + addG);
        $('#m_i').val(baseI + addI);
        initProdFields();
    }

    $('#chk_farm, #chk_scav, #chk_call').change(() => {
        saveCheckboxesState();
        fillData();
        calculateTrade();
    });
    $('#p_w, #p_g, #p_i').on('change input', () => calculateTrade());

    $('#sync_btn').click(async () => {
        const btn = $('#sync_btn');
        btn.text('⌛').prop('disabled', true);
        await loadExternalBootyData();
        fillData();
        calculateTrade();
        btn.text('Spichlerz').prop('disabled', false);
    });

    $('#calc_btn').click(() => calculateTrade());
    $('#close_btn').click(() => {
        $(ui).hide();
        localStorage.setItem(STORAGE_KEY_STATE, 'closed');
        stopAutoSync();
        stopResourceRefresh();
    });

    $('#c_w, #c_g, #c_i').on('input change', function() {
        const tw = parseInt($('#c_w').val()) || 0;
        const tg = parseInt($('#c_g').val()) || 0;
        const ti = parseInt($('#c_i').val()) || 0;
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({ w: tw, g: tg, i: ti, name: 'Wpis ręczny' }));
        calculateTrade();
    });

    $('#set_moneta').click(function() {
        const n = (parseInt($(this).attr('data-count')) || 0) + 1;
        $(this).attr('data-count', n).text(`🪙 Moneta x${n}`);
        $('#set_gruby').attr('data-count', 0).text('👑 Gruby');
        $('#c_w').val(n * 28000);
        $('#c_g').val(n * 30000);
        $('#c_i').val(n * 25000);
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({ w: n * 28000, g: n * 30000, i: n * 25000, name: `🪙 Moneta x${n}` }));
        calculateTrade();
    });

    $('#set_gruby').click(function() {
        const n = (parseInt($(this).attr('data-count')) || 0) + 1;
        $(this).attr('data-count', n).text(`👑 Gruby x${n}`);
        $('#set_moneta').attr('data-count', 0).text('🪙 Moneta');
        $('#c_w').val(n * 40000);
        $('#c_g').val(n * 50000);
        $('#c_i').val(n * 50000);
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({ w: n * 40000, g: n * 50000, i: n * 50000, name: `👑 Gruby x${n}` }));
        calculateTrade();
    });

    $('#clear_btn').click(() => {
        $('#c_w, #c_g, #c_i').val(0);
        $('#set_moneta, #set_gruby').attr('data-count', 0);
        $('#set_moneta').text('🪙 Moneta');
        $('#set_gruby').text('👑 Gruby');
        $('#kombi_preview').hide();
        localStorage.removeItem(STORAGE_KEY_TARGET);
        fillData();
        calculateTrade();
    });

    (function init() {
        const savedChecks = JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKS));
        if (savedChecks) {
            $('#chk_farm').prop('checked', !!savedChecks.farm);
            $('#chk_scav').prop('checked', !!savedChecks.scav);
            $('#chk_call').prop('checked', !!savedChecks.call);
        } else {
            $('#chk_call').prop('checked', true);
        }

        const savedT = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET));
        if (savedT) {
            $('#c_w').val(savedT.w);
            $('#c_g').val(savedT.g);
            $('#c_i').val(savedT.i);
            if (savedT.name) $('#target_label').text(savedT.name);
        }

        loadExternalBootyData().then(() => {
            fillData();
            calculateTrade();
        });

        if (localStorage.getItem(STORAGE_KEY_STATE) === 'open') {
            $(ui).show();
            syncMarketDataInBackground().then(() => {
                loadExternalBootyData().then(() => {
                    fillData();
                    calculateTrade();
                    startAutoSync();
                    startResourceRefresh();
                });
            });
        }
    })();
})();
