// ==UserScript==
// @name         Kalkulator Handlowy
// @namespace    https://viayoo.com/
// @version      1.9
// @description  Zintegrowany kalkulator surowców z szarym przyciskiem na dole paska skrótów.
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*
// ==/UserScript==

(function() {
    'use strict';
    if (typeof game_data === 'undefined') return;

    // ===== USTAWIENIA WYMIAN =====
    const TRADE_STEP = 50;   // krok kwoty wymiany (100, 150, 200...)
    const TRADE_MIN = 100;   // minimalna kwota wymiany
    // =============================

    const vId = game_data.village.id;
    const world = window.location.hostname.split('.')[0];

    const STORAGE_KEY_OFFERS = `etykiety_market_offers_${world}`;
    const STORAGE_KEY_STATE = `etykiety_ui_state_${world}`;
    const STORAGE_KEY_POS = `etykiety_pos_${world}`;
    const STORAGE_KEY_TARGET = `etykiety_target_${vId}`;
    const STORAGE_KEY_CALL = `etykiety_call_${vId}`;
    const STORAGE_KEY_CHECKS = `etykiety_checkboxes_${vId}`;
    const STORAGE_KEY_BUILDING_CHECKS = `etykiety_bchecks_${vId}_${game_data.screen}`;
    const STORAGE_KEY_INC = `calc_incev_${vId}`;
    const HERMIT_KEY = `Etykiety_Hermit_Dynamic_${vId}`;

    let autoSyncTimer = null;

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
            width: 540px;
            max-width: 98vw;
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

    const ICON_COIN = 'https://dspl.innogamescdn.com/asset/3e3b154c/graphic/gold.webp';
    const ICON_SNOB = 'https://dspl.innogamescdn.com/asset/3e3b154c/graphic/unit/unit_snob.webp';
    const imgI = (src) => `<img src="${src}" style="height:14px; width:auto; vertical-align:middle;">`;
    const coinLabel = (n) => `${imgI(ICON_COIN)} Moneta${n > 0 ? ' x' + n : ''}`;
    const snobLabel = (n) => `${imgI(ICON_SNOB)} Gruby${n > 0 ? ' x' + n : ''}`;

    const cleanNum = (v) => {
        if (!v) return 0;
        let tmp = document.createElement("div");
        tmp.innerHTML = v;
        let text = tmp.textContent || tmp.innerText || "";
        let s = text.replace(/\./g, '').replace(/\s+/g, '');
        return parseInt(s.replace(/\D/g, '')) || 0;
    };

    // Czas serwera w sekundach (data-endtime w grze jest w czasie serwera)
    const nowSec = () => {
        try {
            if (typeof Timing !== 'undefined' && Timing.getCurrentServerTime) return Timing.getCurrentServerTime() / 1000;
        } catch (e) {}
        return Date.now() / 1000;
    };

    // Format daty wg ZEGARA SERWERA (a nie urządzenia) - eliminuje przesunięcia o godziny
    function formatFullDate(h) {
        if (h <= 0 || !isFinite(h)) return "Teraz ✅️";
        let base = new Date();
        try {
            const tm = $('#serverTime').text().match(/(\d+):(\d+):(\d+)/);
            const dm = $('#serverDate').text().match(/(\d+)\/(\d+)\/(\d+)/);
            if (tm && dm) base = new Date(+dm[3], +dm[2] - 1, +dm[1], +tm[1], +tm[2], +tm[3]);
        } catch (e) {}
        const d = new Date(base.getTime() + h * 3600000);
        const p2 = (n) => n.toString().padStart(2, '0');
        return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }

    function fmtEta(h) {
        const m = Math.max(0, Math.round(h * 60));
        return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
    }

    // Aktualny stan surowców z żywego paska gry (game_data jest tylko z chwili załadowania strony)
    function liveStock() {
        const rd = (sel, fb) => {
            const v = parseInt($(sel).first().text().replace(/\D/g, ''));
            return isNaN(v) ? Math.floor(fb) : v;
        };
        return {
            w: rd('#wood', game_data.village.wood),
            g: rd('#stone', game_data.village.stone),
            i: rd('#iron', game_data.village.iron)
        };
    }

    // Najwcześniejszy moment (w godzinach od teraz), w którym są wszystkie surowce.
    // Uwzględnia: przybywające surowce (evs) oraz wzrost produkcji po ukończeniu
    // rozbudowy kopalni z kolejki budowy (boosts).
    // Produkcja kopalni na godzinę wg poziomu (indeks = poziom - 1) dla prędkości świata
    const MINE_TABLE = [
        [2,   [60,70,81,94,110,128,149,173,201,234,272,316,368,428,498,579,673,783,911,1059,1232,1433,1667,1939,2255,2623,3050,3548,4127,4800]],
        [1,   [30,35,41,47,55,64,74,86,100,117,136,158,184,214,249,289,337,391,455,530,616,717,833,969,1127,1311,1525,1774,2063,2400]],
        [0.5, [15,17,20,23,27,32,37,43,50,58,78,89,92,107,124,144,168,195,227,265,308,358,416,484,563,655,762,887,1031,1200]],
        [1.6, [48,56,65,76,88,102,119,138,161,187,218,253,294,342,398,463,539,626,729,847,986,1146,1333,1551,1804,2098,2440,2838,3301,3840]]
    ];
    const MINE_FACTOR = 1.163118; // awaryjnie, gdy produkcji nie da się dopasować do tabeli (np. bonus)

    // Z aktualnej produkcji odczytujemy prędkość świata i poziomy kopalni
    function findMine(p) {
        for (const [speed, t] of MINE_TABLE) {
            const lv = {};
            let ok = true;
            ['w', 'g', 'i'].forEach(r => {
                const idx = t.findIndex(v => Math.abs(v - p[r]) <= 1);
                if (idx < 0) ok = false; else lv[r] = idx + 1;
            });
            if (ok) return { speed: speed, t: t, lv: lv };
        }
        return null;
    }

    // Mnożnik produkcji po k-tej rozbudowie kopalni danego surowca
    function mineFactor(m, r, k) {
        if (m) {
            const prev = m.t[m.lv[r] - 1 + k - 1], next = m.t[m.lv[r] - 1 + k];
            if (prev && next) return next / prev;
        }
        return MINE_FACTOR;
    }

    // Najwcześniejszy moment (w godzinach od teraz), w którym są wszystkie surowce.
    // Uwzględnia: przybywające surowce (evs) oraz wzrost produkcji po ukończeniu
    // rozbudowy kopalni z kolejki budowy (boosts).
    function readyHours(stock, evs, target, p, boosts) {
        boosts = boosts || [];
        const keys = ['w', 'g', 'i'];
        const pts = [...new Set([0].concat(evs.map(e => e.h), boosts.map(b => b.h)))].sort((a, b) => a - b);
        let cur = { w: stock.w, g: stock.g, i: stock.i };
        let rate = { w: p.w, g: p.g, i: p.i };
        for (let k = 0; k < pts.length; k++) {
            const start = pts[k];
            const len = k + 1 < pts.length ? pts[k + 1] - start : Infinity;
            evs.forEach(e => { if (e.h === start) { cur.w += e.w; cur.g += e.g; cur.i += e.i; } });
            boosts.forEach(b => { if (b.h === start) rate[b.res] *= (b.f || MINE_FACTOR); });
            let dtMax = 0;
            keys.forEach(r => {
                const need = target[r] - cur[r];
                const dt = need <= 0 ? 0 : need / rate[r];
                if (dt > dtMax) dtMax = dt;
            });
            if (dtMax <= len) return start + dtMax;
            keys.forEach(r => { cur[r] += rate[r] * len; });
        }
        return 0;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const silentSelect = (s) => {
        const el = $(s);
        if (el.length) el.prop('disabled', false).prop('checked', true).trigger('change');
    };

    if (game_data.screen === 'market' && window.location.href.includes('mode=other_offer') && urlParams.has('buy_res')) {
        const my_need = urlParams.get('buy_res');
        const my_offer = urlParams.get('sell_res');
        setTimeout(() => {
            silentSelect(`input[name="res_sell"][value="all"]`);
            silentSelect(`input[name="res_buy"][value="all"]`);
            setTimeout(() => {
                silentSelect(`input[name="res_sell"][value="${my_need}"]`);
                silentSelect(`input[name="res_buy"][value="${my_offer}"]`);
                $('#trader_time_max_hours').val(3).trigger('change');
                setTimeout(() => {
                    const btn = $('#offer_filter input[type="submit"]');
                    if(btn.length) btn.click(); else $('#offer_filter').submit();
                }, 600);
            }, 300);
        }, 1200);
    }

    if (game_data.screen === 'market' && window.location.href.includes('mode=own_offer') && urlParams.has('offer_buy')) {
        const b = urlParams.get('offer_buy');
        const s = urlParams.get('offer_sell');
        const needed = parseInt(urlParams.get('needed')) || 0;
        const merchants = parseInt($('#market_merchant_available_count').text()) || 0;
        // Liczba ofert: max 1000 na ofertę (pojemność handlarza); kwota na ofertę dopasowana tak, by suma = potrzebna kwota
        const count = Math.min(merchants, Math.max(1, Math.ceil(needed / 1000)));
        const per = Math.min(1000, Math.ceil(needed / Math.max(1, count)));

        if (needed >= 50 && merchants > 0) {
            setTimeout(() => {
                silentSelect('#res_buy_all');
                silentSelect('#res_sell_all');
                setTimeout(() => {
                    $('#res_sell_amount').val(per).trigger('change');
                    $('#res_buy_amount').val(per).trigger('change');
                    $('input[name="multi"]').val(count).trigger('change');
                    $('input[name="max_time"]').val(3).trigger('change');
                    setTimeout(() => {
                        silentSelect(`#res_sell_${s}`);
                        silentSelect(`#res_buy_${b}`);
                    }, 1000);
                }, 300);
            }, 1200);
        }
    }

    if (game_data.screen === 'market' && window.location.href.includes('mode=call')) {
        const savedChecks = JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKS));
        const isCallEnabled = savedChecks ? !!savedChecks.call : false;
        const callData = JSON.parse(localStorage.getItem(STORAGE_KEY_CALL));

        // Hermit startuje tylko po kliknięciu "Wezwij Handlarzy" w panelu (i przy zaznaczonym "Wezwij")
        if (isCallEnabled && callData) {
            const savedHermitData = localStorage.getItem(HERMIT_KEY);
            if (savedHermitData) {
                window.HermitowskieSurki = {
                    target_resources: JSON.parse(savedHermitData),
                    storage_percentage_limit: { 'wood': 98, 'stone': 98, 'iron': 98 },
                    resources_safeguard: { 'wood': 0, 'stone': 0, 'iron': 0 },
                    trim_to_storage_capacity: true,
                    traders_safeguard: 0,
                    idle_time: 5,
                    trader_capacity_threshold: 0
                };
                $.getScript('https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskieSurki.js?_=' + Date.now());
            }
        }

        if (callData) {
            if (callData.w) $('#wood').val(callData.w);
            if (callData.g) $('#stone').val(callData.g);
            if (callData.i) $('#iron').val(callData.i);
            localStorage.removeItem(STORAGE_KEY_CALL);
        }
    }

    async function syncMarketDataInBackground() {
        try {
            const [resMarket, resOffers, resMain] = await Promise.all([
                fetch(TribalWars.buildURL('GET', 'market')),
                fetch(TribalWars.buildURL('GET', 'market', {mode: 'own_offer'})),
                fetch(TribalWars.buildURL('GET', 'main'))
            ]);

            const htmlMarket = await resMarket.text();
            const htmlOffers = await resOffers.text();
            const parser = new DOMParser();

            try {
                // Kolejka budowy: kopalnie, które zwiększą produkcję po ukończeniu
                const docMain = parser.parseFromString(await resMain.text(), 'text/html');
                const bq = [];
                $(docMain).find('#buildqueue tr[class*="buildorder_"]').each(function() {
                    const m = ($(this).attr('class') || '').match(/buildorder_(wood|stone|iron)/);
                    if (!m) return;
                    const t = parseInt($(this).find('[data-endtime]').first().attr('data-endtime')) || 0;
                    if (t) bq.push({ t: t, res: m[1] === 'wood' ? 'w' : m[1] === 'stone' ? 'g' : 'i' });
                });
                localStorage.setItem(`calc_boost_${vId}`, JSON.stringify(bq));
            } catch (e) { console.error("❗ Błąd kolejki budowy:", e); }

            const docM = parser.parseFromString(htmlMarket, 'text/html');
            const docO = parser.parseFromString(htmlOffers, 'text/html');

            // Przychodzący handlarze - każdy wpis z czasem przybycia (jeśli uda się go znaleźć)
            let incEv = [];
            $(docM).find('th:contains("Przybywające")').each(function() {
                $(this).find('.nowrap').each(function() {
                    let item = $(this);
                    let html = item.html();
                    let val = parseInt(item.text().replace(/\./g, '').replace(/\s+/g, '')) || 0;
                    if (!val) return;

                    let tr = item.closest('tr');
                    let timer = tr.find('[data-endtime]').first();
                    if (!timer.length) timer = tr.next('tr').find('[data-endtime]').first();
                    let t = timer.length ? (parseInt(timer.attr('data-endtime')) || null) : null;

                    let e = { t: t, w: 0, g: 0, i: 0, src: 'Rynek' };
                    if (html.includes('wood')) e.w = val;
                    else if (html.includes('stone')) e.g = val;
                    else if (html.includes('iron')) e.i = val;
                    else return;
                    incEv.push(e);
                });
            });
            localStorage.setItem(STORAGE_KEY_INC, JSON.stringify(incEv));

            const mA = parseInt($(docM).find('#market_merchant_available_count').text());
            const mT = parseInt($(docM).find('#market_merchant_total_count').text());
            if (!isNaN(mA) && !isNaN(mT)) localStorage.setItem(`calc_merch_${vId}`, JSON.stringify({ a: mA, t: mT }));

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
                                    cnt: count,
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
            fillData();
            calculateTrade();
        }, 20000);
    }

    function stopAutoSync() {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
        }
    }

    function updateHermitData(w, g, i) {
        if (w > 0 || g > 0 || i > 0) {
            localStorage.setItem(HERMIT_KEY, JSON.stringify({ 'wood': w, 'stone': g, 'iron': i }));
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

    let cachedFarmData = { count: 0, ev: [] };
    let cachedScavData = { ev: [] };

    // Lista surowców w drodze (rynek + zaznaczone: farma / zbierak) z czasem w godzinach od teraz
    function getEvents() {
        let ev = [];
        (JSON.parse(localStorage.getItem(STORAGE_KEY_INC)) || []).forEach(e => ev.push(e));
        if ($('#chk_farm').is(':checked')) cachedFarmData.ev.forEach(e => ev.push(e));
        if ($('#chk_scav').is(':checked')) cachedScavData.ev.forEach(e => ev.push(e));
        const n = nowSec();
        return ev.map(e => ({
            src: e.src, t: e.t || null,
            h: (e.t && e.src !== 'Rynek') ? Math.max(0, (e.t - n) / 3600) : 0, // rynek = od razu, jak w grze
            w: e.w || 0, g: e.g || 0, i: e.i || 0
        }));
    }

    function getBoosts(p) {
        const n = nowSec();
        const m = findMine(p);
        const cnt = { w: 0, g: 0, i: 0 };
        return (JSON.parse(localStorage.getItem(`calc_boost_${vId}`)) || [])
            .map(b => ({ res: b.res, h: (b.t - n) / 3600 }))
            .filter(b => b.h > 0)
            .sort((a, b) => a.h - b.h)
            .map(b => { cnt[b.res]++; return { res: b.res, h: b.h, f: mineFactor(m, b.res, cnt[b.res]) }; });
    }

    function calculateTrade() {
        const target = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET)) || {w:0, g:0, i:0, name: 'Brak'};

        let userPw = parseInt($('#p_w').val());
        let userPg = parseInt($('#p_g').val());
        let userPi = parseInt($('#p_i').val());

        const p = {
            w: userPw > 0 ? userPw : Math.max(1, Math.round(game_data.village.wood_prod * 3600)),
            g: userPg > 0 ? userPg : Math.max(1, Math.round(game_data.village.stone_prod * 3600)),
            i: userPi > 0 ? userPi : Math.max(1, Math.round(game_data.village.iron_prod * 3600))
        };

        // realM = surowce, które mamy TERAZ w wiosce
        const realM = {
            w: parseInt($('#m_w').val()) || 0,
            g: parseInt($('#m_g').val()) || 0,
            i: parseInt($('#m_i').val()) || 0
        };

        const evs = getEvents();
        const boosts = getBoosts(p);
        const sumEv = evs.reduce((a, e) => ({ w: a.w + e.w, g: a.g + e.g, i: a.i + e.i }), { w: 0, g: 0, i: 0 });

        let resBox = document.getElementById('results');
        if (!resBox) return;
        resBox.style.display = "block";
        const botBox = document.getElementById('results_bottom');

        const mh = JSON.parse(localStorage.getItem(`calc_merch_${vId}`));
        const merchTxt = mh ? `Handlarze: ${mh.a} / ${mh.t}` : 'Handlarze: -';

        $('#target_label').text(target.name || 'Brak');

        if ($('#chk_call').is(':checked')) {
            updateHermitData(target.w, target.g, target.i);
        } else {
            localStorage.removeItem(HERMIT_KEY);
        }

        const tReal = readyHours(realM, evs, target, p, boosts);

        let html = `<div style="padding-bottom:8px; border-bottom:1px solid var(--border-color); margin-bottom:8px; text-align:center;"><b style="color:var(--title-color);">STAN AKTUALNY</b><br><b style="font-size: 12px;">[ ${formatFullDate(tReal)} ]</b></div>`;

        const cap = parseInt(game_data.village.storage_max) || 0;
        if (cap && Math.max(target.w, target.g, target.i) > cap) {
            html += `<div style="background:rgba(200,0,0,0.2); border:1px solid rgba(200,0,0,0.4); border-radius:3px; padding:4px; margin-bottom:8px; text-align:center; color:#ff8080;">⚠️ Cel większy niż spichlerz (${cap.toLocaleString()})</div>`;
        }

        let offers = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFERS))?.[vId] || [];
        let allExp = { w: 0, g: 0, i: 0 };
        offers.forEach(o => {
            let k = (o.dostaniesz.k || "").toLowerCase();
            let key = k.includes('wood') ? 'w' : k.includes('stone') ? 'g' : 'i';
            allExp[key] += o.dostaniesz.amt;
        });

        // base = stan teraz + oferty własne; virtM = wszystko, co kiedykolwiek dotrze
        const base = { w: realM.w + allExp.w, g: realM.g + allExp.g, i: realM.i + allExp.i };
        const virtM = { w: base.w + sumEv.w, g: base.g + sumEv.g, i: base.i + sumEv.i };
        const virtB = { w: Math.max(0, target.w - virtM.w), g: Math.max(0, target.g - virtM.g), i: Math.max(0, target.i - virtM.i) };
        const tVirt = readyHours(base, evs, target, p, boosts);

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

        let tradesOut = '';
        if ((virtB.w + virtB.g + virtB.i) > 0 && tVirt > 0) {
            let tradesHtml = '';
            let virtM_sim = { w: virtM.w, g: virtM.g, i: virtM.i };
            let realM_sim = { w: realM.w, g: realM.g, i: realM.i };
            const resMap = { 'w': 'wood', 'g': 'stone', 'i': 'iron' };

            let tradesPlanned = [];

            for (let step = 0; step < 4; step++) {
                let b = { w: Math.max(0, target.w - virtM_sim.w), g: Math.max(0, target.g - virtM_sim.g), i: Math.max(0, target.i - virtM_sim.i) };
                if (b.w === 0 && b.g === 0 && b.i === 0) break;

                let t = { w: b.w/p.w, g: b.g/p.g, i: b.i/p.i };
                let maxT_key = Object.keys(t).reduce((a,k) => t[a] > t[k] ? a : k);
                let minT_key = Object.keys(t).reduce((a,k) => t[a] < t[k] ? a : k);

                if (t[maxT_key] - t[minT_key] < 0.1) break;

                let tEq = (b.w + b.g + b.i) / (p.w + p.g + p.i);
                if (isNaN(tEq) || tEq <= 0) break;

                let surplus = virtM_sim[minT_key] - (target[minT_key] - tEq * p[minT_key]);
                let deficit = (target[maxT_key] - tEq * p[maxT_key]) - virtM_sim[maxT_key];

                let amount = Math.floor(Math.min(surplus, deficit, realM_sim[minT_key]));
                amount = Math.floor(amount / TRADE_STEP) * TRADE_STEP;

                if (amount >= TRADE_MIN) {
                    tradesPlanned.push({ sell: minT_key, buy: maxT_key, amt: amount });
                    virtM_sim[minT_key] -= amount;
                    virtM_sim[maxT_key] += amount;
                    realM_sim[minT_key] -= amount;
                } else {
                    break;
                }
            }

            // Wyliczamy bilans każdego surowca i z niego wymiany -
            // dzięki temu nie ma sytuacji "600 drewna na żelazo" + "100 żelaza na drewno"
            const net = { w: 0, g: 0, i: 0 };
            tradesPlanned.forEach(tr => { net[tr.sell] -= tr.amt; net[tr.buy] += tr.amt; });
            const sellers = Object.keys(net).filter(k => net[k] < 0).map(k => ({ k: k, a: -net[k] })).sort((a, b) => b.a - a.a);
            const buyers = Object.keys(net).filter(k => net[k] > 0).map(k => ({ k: k, a: net[k] })).sort((a, b) => b.a - a.a);
            let aggregatedTrades = {};
            let si = 0, bi = 0;
            while (si < sellers.length && bi < buyers.length) {
                const m = Math.min(sellers[si].a, buyers[bi].a);
                if (m >= TRADE_MIN) aggregatedTrades[`${sellers[si].k}_${buyers[bi].k}`] = m;
                sellers[si].a -= m; buyers[bi].a -= m;
                if (sellers[si].a <= 0) si++;
                if (buyers[bi].a <= 0) bi++;
            }

            let stepCount = 1;
            let displayBase = { w: base.w, g: base.g, i: base.i };

            for (let key in aggregatedTrades) {
                let [sellK, buyK] = key.split('_');
                let amount = aggregatedTrades[key];

                displayBase[sellK] -= amount;
                displayBase[buyK] += amount;

                let tAfter = readyHours(displayBase, evs, target, p, boosts);

                tradesHtml += `
                <div style="background: rgba(0,128,0,0.15); border-radius:4px; padding:6px; flex:1 1 150px; max-width:260px; border:1px solid rgba(0,128,0,0.3);">
                    <b style="color:#4caf50; font-size:11px;">⚖️ WYMIANA ${stepCount++}</b><br>
                    ${amount.toLocaleString()} <span class="icon header ${resMap[sellK]}"></span> ➔ ${amount.toLocaleString()} <span class="icon header ${resMap[buyK]}"></span><br>
                    <div style="font-size:10px; color:#ccc; margin-top:2px;">Gotowość po wymianie: <b>[ ${formatFullDate(tAfter)} ]</b></div>
                    <div style="display:flex; gap:4px; margin-top:4px;">
                        <a href="https://${world}.plemiona.pl/game.php?village=${vId}&screen=market&mode=other_offer&buy_res=${resMap[buyK]}&sell_res=${resMap[sellK]}" class="kalk-btn" style="flex:1; text-align:center; text-decoration:none;">Kup</a>
                        <a href="https://${world}.plemiona.pl/game.php?village=${vId}&screen=market&mode=own_offer&offer_buy=${resMap[buyK]}&offer_sell=${resMap[sellK]}&needed=${amount}" class="kalk-btn" style="flex:1; text-align:center; text-decoration:none;">Wystaw</a>
                    </div>
                </div>`;
            }
            tradesOut = tradesHtml;
        }

        const buildH = (txt) => `<div style="margin-top:6px; border-top: 1px dashed var(--border-color); padding-top:4px; font-weight:bold; text-align:center;">${txt}</div>`;
        const wrapStyle = 'display:flex; flex-wrap:wrap; justify-content:center; gap:4px; margin-top:4px;';
        const boxStyle = 'background:var(--bg-main); border:1px solid var(--border-color); border-radius:3px; padding:3px 6px; font-size:10px;';
        const resTriple = (w, g, i) => `<div style="display:flex; justify-content:center; gap:8px;"><span><span class="icon header wood"></span> ${w.toLocaleString()}</span><span><span class="icon header stone"></span> ${g.toLocaleString()}</span><span><span class="icon header iron"></span> ${i.toLocaleString()}</span></div>`;

        let htmlB = `<div style="margin-top:6px; border-top: 1px dashed var(--border-color); padding-top:4px; text-align:center; font-weight:bold;">${merchTxt}</div>`;
        htmlB += buildH("Przybywające");
        if (!evs.length) {
            htmlB += `<div style="font-size:10px; color:#aaa; padding:3px;">Brak.</div>`;
        } else {
            const groups = {};
            evs.forEach(e => {
                const k = e.src + '|' + (e.t || 0);
                if (!groups[k]) groups[k] = { src: e.src, h: e.h, hasT: !!e.t, w: 0, g: 0, i: 0 };
                groups[k].w += e.w; groups[k].g += e.g; groups[k].i += e.i;
            });
            const list = Object.values(groups).sort((a, b) => a.h - b.h);
            htmlB += `<div style="${wrapStyle}">` + list.slice(0, 8).map(gr =>
                `<div style="${boxStyle}">${gr.src !== 'Rynek' ? `<div><b>${gr.src}</b> ${gr.hasT ? 'za ' + fmtEta(gr.h) : '⚠️ brak czasu'}</div>` : ''}${resTriple(gr.w, gr.g, gr.i)}</div>`
            ).join('') + `</div>`;
            if (list.length > 8) htmlB += `<div style="font-size:10px; color:#aaa; padding:3px;">+ ${list.length - 8} więcej</div>`;
        }

        htmlB += buildH("Własne oferty");
        if (!offers.length) htmlB += `<div style="font-size:10px; color:#aaa; padding:3px;">Brak danych.</div>`;
        else htmlB += `<div style="${wrapStyle}">` + offers.map(o =>
            `<div style="${boxStyle}">${(o.cnt || 1) > 1 ? (o.cnt) + ' × ' : ''}[${Math.round(o.oddasz.amt / (o.cnt || 1)).toLocaleString()}] <span class="icon header ${o.oddasz.k}"></span> ➔ [${Math.round(o.dostaniesz.amt / (o.cnt || 1)).toLocaleString()}] <span class="icon header ${o.dostaniesz.k}"></span></div>`
        ).join('') + `</div>`;

        resBox.innerHTML = html + htmlB;
        if (botBox) botBox.innerHTML = tradesOut ? `<div style="border-top:1px dashed var(--border-color); padding-top:6px; font-weight:bold;">Wymiana</div><div style="display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin-top:4px;">${tradesOut}</div>` : '';

        $('#do_wezwij_btn').off('click').on('click', function() {
            const req = { w: $(this).data('w'), g: $(this).data('g'), i: $(this).data('i') };
            localStorage.setItem(STORAGE_KEY_CALL, JSON.stringify(req));
            window.location.href = `game.php?village=${vId}&screen=market&mode=call`;
        });
    }

    let savedP = JSON.parse(localStorage.getItem(STORAGE_KEY_POS)) || { top: 100, left: 20 };
    savedP.top = parseInt(savedP.top) || 100;
    savedP.left = parseInt(savedP.left) || 20;

    if (savedP.top < 0 || savedP.top > window.innerHeight - 50) savedP.top = 100;
    if (savedP.left < 0 || savedP.left > window.innerWidth - 50) savedP.left = 20;

    const ui = document.createElement('div');
    ui.id = "etykiety_ui";
    ui.className = "kalk-ui";
    ui.style.top = savedP.top + 'px';
    ui.style.left = savedP.left + 'px';

    ui.innerHTML = `<div id="calc_header" class="kalk-header">
        <span>KALKULATOR</span> 
        <span id="close_btn" style="cursor:pointer; padding: 0 2px;">❌</span>
    </div>
    <div style="padding:8px; max-height: 85vh; overflow-y: auto;">
      <div style="display:flex; gap:8px; align-items:flex-start;">
        <div style="flex:1 1 0; min-width:0;">
            <div style="font-size:10px; margin-bottom:4px;">Teraz / Produkcja na h:</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="icon header wood" style="width:18px;"></span>
                    <input id="m_w" type="number" class="kalk-input" style="flex:1; width:50%; min-width:0;">
                    <input id="p_w" type="number" class="kalk-input" style="flex:1; width:50%; min-width:0;">
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="icon header stone" style="width:18px;"></span>
                    <input id="m_g" type="number" class="kalk-input" style="flex:1; width:50%; min-width:0;">
                    <input id="p_g" type="number" class="kalk-input" style="flex:1; width:50%; min-width:0;">
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="icon header iron" style="width:18px;"></span>
                    <input id="m_i" type="number" class="kalk-input" style="flex:1; width:50%; min-width:0;">
                    <input id="p_i" type="number" class="kalk-input" style="flex:1; width:50%; min-width:0;">
                </div>
            </div>

            <div style="display:flex; gap:4px; margin-top:6px; align-items:center;">
                <button id="sync_btn" class="kalk-btn" style="flex:1;" title="Pobierz dane ze spichlerza">Spichlerz</button>
            </div>

            <div style="margin-top:6px; background:var(--bg-row-alt); border:1px solid var(--border-color); border-radius:3px; padding:6px; font-size:10px;">
                <div style="display:flex; justify-content:space-around; margin-bottom:4px; flex-wrap:wrap; gap:4px;">
                    <label style="cursor:pointer;"><input type="checkbox" id="chk_farm" style="vertical-align:middle;"> Farma (<span id="f_count">0</span>)</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="chk_scav" style="vertical-align:middle;"> Zbierak</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="chk_call" style="vertical-align:middle;"> Wezwij</label>
                </div>
                <div id="kombi_preview" style="text-align:center; color:#4caf50; display:none;">
                    + <span class="icon header wood" style="transform:scale(0.8);"></span><span id="kp_w">0</span> 
                    <span class="icon header stone" style="transform:scale(0.8);"></span><span id="kp_g">0</span> 
                    <span class="icon header iron" style="transform:scale(0.8);"></span><span id="kp_i">0</span>
                </div>
            </div>

            <div style="margin-top:6px; border-top:1px solid var(--border-color); padding-top:6px;">
                <div style="margin-bottom:4px;"><b>CEL: <span id="target_label" style="font-weight:normal; color:#4caf50;">Brak</span></b></div>
                <div style="display:flex; gap:4px;">
                    <input id="c_w" type="number" value="0" class="kalk-input" style="flex:1; width:33%; min-width:0;">
                    <input id="c_g" type="number" value="0" class="kalk-input" style="flex:1; width:33%; min-width:0;">
                    <input id="c_i" type="number" value="0" class="kalk-input" style="flex:1; width:33%; min-width:0;">
                </div>
            </div>

            <div style="display:flex; gap:4px; margin-top:6px;">
                <button id="set_moneta" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">${coinLabel(0)}</button>
                <button id="set_gruby" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">${snobLabel(0)}</button>
            </div>

            <div style="display:flex; gap:4px; margin-top:6px;">
                <button id="calc_btn" class="kalk-btn" style="flex:4; font-weight:bold;">OBLICZ</button>
                <button id="clear_btn" class="kalk-btn" style="flex:1;">🗑️</button>
            </div>
        </div>

        <div id="results" style="flex:1 1 0; min-width:0; text-align:center; background:var(--bg-row-alt); padding:6px; border:1px solid var(--border-color); border-radius:3px; min-height:80px;"></div>
      </div>

      <div id="results_bottom" style="margin-top:8px; text-align:center;"></div>
    </div>`;
    document.body.appendChild(ui);

    function addShortcutButton() {
        if ($('#calc_shortcut_btn').length) return;

        const btnContainerHTML = `<ul class="kalk-shortcut-container"><li><button id="calc_shortcut_btn" class="kalk-shortcut-btn" title="Kalkulator Handlowy Kuźnia">🧮</button></li></ul>`;
        
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
            let s = $(ui).is(':hidden'); 
            $(ui).toggle();
            localStorage.setItem(STORAGE_KEY_STATE, s ? 'open' : 'closed');
            if(s) {
                fillData();
                calculateTrade();   // natychmiast z danych zapisanych
                $('#calc_btn').text('⌛').prop('disabled', true);
                await Promise.all([loadExternalBootyData(), syncMarketDataInBackground()]);
                fillData();
                calculateTrade();
                $('#calc_btn').text('OBLICZ').prop('disabled', false);
                startAutoSync();
            } else {
                stopAutoSync();
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

    async function loadExternalBootyData() {
        const farmNew = { count: 0, ev: [] };
        const scavNew = { ev: [] };

        const pScav = (async () => {
        try {
            const res = await $.ajax({url: `/game.php?village=${vId}&screen=scavenge_api&ajax=villages`, data: {'village_ids':[vId]}, dataType:'json'});
            const opts = res?.villages?.[vId]?.options;
            if(opts) {
                Object.values(opts).forEach(o => {
                    const sq = o.scavenging_squad;
                    if(sq?.loot_res) {
                        scavNew.ev.push({
                            t: parseInt(sq.return_time) || null,
                            w: parseInt(sq.loot_res.wood) || 0,
                            g: parseInt(sq.loot_res.stone) || 0,
                            i: parseInt(sq.loot_res.iron) || 0,
                            src: 'Zbierak'
                        });
                    }
                });
            }
        } catch(e) {
            console.error("❗ Błąd pobierania zbieraka:", e);
        }

        })();

        const pFarm = (async () => {
        try {
            const html = await $.ajax({url: `/game.php?village=${vId}&screen=overview`});
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const returning = $(doc).find('#commands_outgoings .quickedit-out').filter((i,x) => {
                return $(x).find('img[src*="return"], img[src*="back"]').length > 0 || $(x).find('.command_hover_details').attr('data-command-type') === "return";
            });

            const etaMap = {};
            returning.each((i, x) => {
                const id = $(x).attr('data-id');
                if (!id || (id in etaMap)) return;
                const tm = $(x).closest('tr').find('[data-endtime]').first();
                etaMap[id] = tm.length ? (parseInt(tm.attr('data-endtime')) || null) : null;
            });
            const ids = Object.keys(etaMap);
            farmNew.count = ids.length;

            const idsToFetch = ids.filter(id => !sessionStorage.getItem("RC.v1.8.Cmd_"+id));

            const chunkSize = 5;
            for (let i = 0; i < idsToFetch.length; i += chunkSize) {
                const chunk = idsToFetch.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async id => {
                    try {
                        const cRes = await $.ajax({url:`/game.php?village=${vId}&screen=info_command&ajax=details&id=${id}`, dataType:'json'});
                        if(cRes?.booty) {
                            sessionStorage.setItem("RC.v1.8.Cmd_"+id, JSON.stringify({
                                w:parseInt(cRes.booty.wood)||0, 
                                s:parseInt(cRes.booty.stone)||0, 
                                i:parseInt(cRes.booty.iron)||0
                            }));
                        }
                    } catch(e){}
                }));
                if (i + chunkSize < idsToFetch.length) await new Promise(r => setTimeout(r, 50)); 
            }

            for (const id of ids) {
                let cmd = JSON.parse(sessionStorage.getItem("RC.v1.8.Cmd_"+id));
                if(cmd) {
                    farmNew.ev.push({
                        t: etaMap[id],
                        w: cmd.w || 0,
                        g: (cmd.s !== undefined ? cmd.s : cmd.g || 0),
                        i: cmd.i || 0,
                        src: 'Farma'
                    });
                }
            }
            $('#f_count').text(farmNew.count);
        } catch(e) {
            console.error("❗ Błąd pobierania danych farmy:", e);
        }
        })();

        await Promise.all([pScav, pFarm]);
        cachedFarmData = farmNew;
        cachedScavData = scavNew;
        try { localStorage.setItem(`calc_ext_${vId}`, JSON.stringify({ farm: farmNew, scav: scavNew })); } catch (e) {}
        $('#f_count').text(farmNew.count);
    }

    function initProdFields() {
        if(!$('#p_w').val()) $('#p_w').val(Math.round(game_data.village.wood_prod * 3600));
        if(!$('#p_g').val()) $('#p_g').val(Math.round(game_data.village.stone_prod * 3600));
        if(!$('#p_i').val()) $('#p_i').val(Math.round(game_data.village.iron_prod * 3600));
    }

    function fillData() {
        const s = liveStock();
        $('#m_w').val(s.w);
        $('#m_g').val(s.g);
        $('#m_i').val(s.i);

        // Podgląd tego, co dolicza farma / zbierak
        let addW = 0, addG = 0, addI = 0;
        getEvents().forEach(e => {
            if (e.src === 'Farma' || e.src === 'Zbierak') { addW += e.w; addG += e.g; addI += e.i; }
        });
        if (addW > 0 || addG > 0 || addI > 0) {
            $('#kombi_preview').show();
            $('#kp_w').text(addW.toLocaleString());
            $('#kp_g').text(addG.toLocaleString());
            $('#kp_i').text(addI.toLocaleString());
        } else {
            $('#kombi_preview').hide();
        }

        initProdFields();
    }

    $('#chk_farm, #chk_scav, #chk_call').change(async () => { 
        saveCheckboxesState();
        fillData(); 
        calculateTrade(); 
    });
    $('#p_w, #p_g, #p_i, #m_w, #m_g, #m_i').on('change input', () => calculateTrade());

    $('#sync_btn').click(async () => {
        let btn = $('#sync_btn');
        btn.text('⌛').prop('disabled', true);
        await loadExternalBootyData();
        await syncMarketDataInBackground();
        fillData();
        calculateTrade();
        btn.text('Spichlerz').prop('disabled', false);
    });

    $('#calc_btn').click(() => { fillData(); calculateTrade(); });

    $('#close_btn').click(() => { $(ui).hide(); localStorage.setItem(STORAGE_KEY_STATE, 'closed'); stopAutoSync(); });

    $('#c_w, #c_g, #c_i').on('input change', function() {
        let tw = parseInt($('#c_w').val()) || 0;
        let tg = parseInt($('#c_g').val()) || 0;
        let ti = parseInt($('#c_i').val()) || 0;
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w:tw, g:tg, i:ti, mCount: 0, gCount: 0, name: `Wpis ręczny`}));
        calculateTrade();
    });

    $('#set_moneta').click(function() {
        let n = (parseInt($(this).attr('data-count')) || 0) + 1;
        $(this).attr('data-count', n).html(coinLabel(n));
        $('#set_gruby').attr('data-count', 0).html(snobLabel(0));
        $('#c_w').val(n * 28000); $('#c_g').val(n * 30000); $('#c_i').val(n * 25000);
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w: n*28000, g: n*30000, i: n*25000, mCount: n, gCount: 0, name: `Moneta x${n}`}));
        calculateTrade();
    });

    $('#set_gruby').click(function() {
        let n = (parseInt($(this).attr('data-count')) || 0) + 1;
        $(this).attr('data-count', n).html(snobLabel(n));
        $('#set_moneta').attr('data-count', 0).html(coinLabel(0));
        $('#c_w').val(n * 40000); $('#c_g').val(n * 50000); $('#c_i').val(n * 50000);
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w: n*40000, g: n*50000, i: n*50000, mCount: 0, gCount: n, name: `Gruby x${n}`}));
        calculateTrade();
    });

    $('#clear_btn').click(() => {
        $('#c_w,#c_g,#c_i').val(0); $('#set_moneta,#set_gruby').attr('data-count', 0);
        $('#set_moneta').html(coinLabel(0)); $('#set_gruby').html(snobLabel(0));
        $('#kombi_preview').hide();
        localStorage.removeItem(STORAGE_KEY_TARGET);
        localStorage.removeItem(STORAGE_KEY_BUILDING_CHECKS);
        $('.calc-check').prop('checked', false);
        fillData();
        calculateTrade();
    });

    if (['main', 'snob', 'smith'].includes(game_data.screen)) {
        $('#buildings tr, #main_buildrow tr, .train_units tr, table.vis tr').each(function() {
            const r = $(this);
            
            let w = cleanNum(r.find('.cost_wood').text());
            let g = cleanNum(r.find('.cost_stone').text());
            let i = cleanNum(r.find('.cost_iron').text());

            if (!w && !g && !i && game_data.screen === 'smith') {
                r.find('td').each(function() {
                    let html = $(this).html();
                    let val = cleanNum($(this).text());
                    if (val > 0) {
                        if (html.includes('wood.png') || html.includes('wood')) w = val;
                        else if (html.includes('stone.png') || html.includes('stone')) g = val;
                        else if (html.includes('iron.png') || html.includes('iron')) i = val;
                    }
                });
            }

            const hasUnitLink = r.find('.unit_link').length > 0;

            // poziom, NA KTÓRY rozbudowujemy
            let lvl = parseInt(r.find('.btn-build').first().attr('data-level-next')) || 0;
            if (!lvl) {
                const lm = r.find('td:first').text().match(/poziom\s*(\d+)/i);
                if (lm) lvl = parseInt(lm[1]) + 1;
            }

            if ((w || g || i || hasUnitLink) && r.find('td:first').length) {
                if (r.find('.calc-check').length === 0) {
                    r.find('td:first').prepend($(`<input type="checkbox" class="calc-check" data-w="${w}" data-g="${g}" data-i="${i}" data-level="${lvl}" style="margin-right:8px; width:20px; height:20px; vertical-align:middle;">`));
                }
            }
        });

        const savedBChecks = JSON.parse(localStorage.getItem(STORAGE_KEY_BUILDING_CHECKS)) || [];
        $('.calc-check').each(function(index) {
            if (savedBChecks.includes(index)) {
                $(this).prop('checked', true);
            }
        });

        $(document).on('change', '.calc-check', function() {
            saveBuildingCheckboxesState();
            let tw=0, tg=0, ti=0, names=[];
            $('.calc-check:checked').each(function() {
                tw += parseInt($(this).data('w')) || 0; 
                tg += parseInt($(this).data('g')) || 0; 
                ti += parseInt($(this).data('i')) || 0;
                
                let rawName = $(this).parent().text().replace(/\s+/g, ' ');
                let bName = rawName.replace(/\s*\(.*?\)/g, '').replace(/poziom\s*\d+/gi, '').trim();
                
                const lv = parseInt($(this).attr('data-level')) || 0;
                if(bName) names.push(lv > 0 ? `${bName} (poz. ${lv})` : bName);
            });
            $('#c_w').val(tw); $('#c_g').val(tg); $('#c_i').val(ti);
            let finalName = names.length > 0 ? names.join(', ') : 'Brak';
            localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w:tw, g:tg, i:ti, mCount: 0, gCount: 0, name: finalName}));
            if ($(ui).is(':visible')) calculateTrade();
        });
    }

    (function init() {
        const savedChecks = JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKS));
        if (savedChecks) {
            $('#chk_farm').prop('checked', !!savedChecks.farm);
            $('#chk_scav').prop('checked', !!savedChecks.scav);
            $('#chk_call').prop('checked', !!savedChecks.call);
        } else {
            $('#chk_call').prop('checked', true);
            saveCheckboxesState();
        }

        const savedT = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET));
        if (savedT) {
            $('#c_w').val(savedT.w); $('#c_g').val(savedT.g); $('#c_i').val(savedT.i);
            if (savedT.mCount > 0) $('#set_moneta').attr('data-count', savedT.mCount).html(coinLabel(savedT.mCount));
            if (savedT.gCount > 0) $('#set_gruby').attr('data-count', savedT.gCount).html(snobLabel(savedT.gCount));
        }
        // dane zapisane przy poprzedniej wizycie - pokazujemy je od razu
        try {
            const ext = JSON.parse(localStorage.getItem(`calc_ext_${vId}`));
            if (ext) {
                cachedFarmData = ext.farm || cachedFarmData;
                cachedScavData = ext.scav || cachedScavData;
                $('#f_count').text(cachedFarmData.count || 0);
            }
        } catch (e) {}


        // Panel wraca otwarty po odświeżeniu, jeśli był otwarty (zamykasz go sam).
        // Gdy jest zamknięty - skrypt nie robi nic i nic nie pobiera.
        if (localStorage.getItem(STORAGE_KEY_STATE) === 'open') {
            $(ui).show();
            fillData();
            calculateTrade();   // od razu z zapisanych danych
            Promise.all([syncMarketDataInBackground(), loadExternalBootyData()]).then(() => {
                fillData();
                calculateTrade();
                startAutoSync();
            });
        }
    })();
})();
