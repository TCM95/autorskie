// ==UserScript==
// @name         Kalkulator Surowców
// @namespace    https://viayoo.com/
// @version      2.2
// @description  Kompletny kalkulator surowców, celów oraz wymian rynkowych.
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=market*
// @match        *://*.plemiona.pl/game.php?*screen=main*
// @match        *://*.plemiona.pl/game.php?*screen=snob*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (typeof game_data === 'undefined') return;

    const vId = game_data.village.id;
    const world = window.location.hostname.split('.')[0];

    const STORAGE_KEY_OFFERS = `etykiety_market_offers_${world}`;
    const STORAGE_KEY_STATE = `etykiety_ui_state_${world}`;
    const STORAGE_KEY_POS = `etykiety_pos_${world}`;
    const STORAGE_KEY_TARGET = `etykiety_target_${vId}`;
    const STORAGE_KEY_CALL = `etykiety_call_${vId}`;

    let autoSyncTimer = null;

    // Wstrzyknięcie styli ciemnego motywu
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
        .kalk-ui { background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); }
        .kalk-header { background: var(--bg-header); color: var(--title-color); border-bottom: 1px solid var(--border-color); }
        .kalk-btn { background: var(--btn-bg); color: var(--text-color); border: 1px solid var(--border-color); cursor: pointer; padding: 3px 6px; border-radius: 3px; }
        .kalk-btn:hover { background: var(--btn-hover); }
        .kalk-input { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 2px; }
    `;
    document.head.appendChild(style);

    const cleanNum = (v) => {
        if (!v) return 0;
        let tmp = document.createElement("div");
        tmp.innerHTML = v;
        let text = tmp.textContent || tmp.innerText || "";
        let s = text.replace(/\./g, '').replace(/\s+/g, '');
        return parseInt(s.replace(/\D/g, '')) || 0;
    };

    function formatFullDate(h) {
        if (h <= 0 || !isFinite(h)) return "Teraz";
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
                    let html = item.html();
                    let val = parseInt(item.text().replace(/\./g, '').replace(/\s+/g, '')) || 0;

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
            console.error("Kalkulator: Błąd synchronizacji w tle:", error);
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

    function calculateTrade() {
        const target = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET)) || {w:0, g:0, i:0, name: 'Brak'};
        const inc = JSON.parse(localStorage.getItem(`calc_inc_${vId}`)) || { w:0, g:0, i:0 };
        const p = {
            w: Math.max(1, Math.round(game_data.village.wood_prod * 3600)),
            g: Math.max(1, Math.round(game_data.village.stone_prod * 3600)),
            i: Math.max(1, Math.round(game_data.village.iron_prod * 3600))
        };

        const realM = { w: Math.floor(game_data.village.wood) + inc.w, g: Math.floor(game_data.village.stone) + inc.g, i: Math.floor(game_data.village.iron) + inc.i };
        const realB = { w: Math.max(0, target.w - realM.w), g: Math.max(0, target.g - realM.g), i: Math.max(0, target.i - realM.i) };
        const tReal = Math.max(realB.w/p.w, realB.g/p.g, realB.i/p.i);

        let resBox = document.getElementById('results');
        if (!resBox) return;
        resBox.style.display = "block";

        $('#target_label').text(target.name || 'Brak');

        let html = `<div style="padding-bottom:8px; border-bottom:1px solid var(--border-color); margin-bottom:8px;"><b style="color:var(--title-color);">STAN AKTUALNY</b><br><b style="font-size: 13px;">[ ${formatFullDate(tReal)} ]</b></div>`;

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

        if (virtB.w > 0 || virtB.g > 0 || virtB.i > 0) {
            html += `
            <div style="margin-bottom:8px; text-align:center;">
                <button id="do_wezwij_btn" data-w="${virtB.w}" data-g="${virtB.g}" data-i="${virtB.i}" class="kalk-btn" style="width:100%;">Wezwij</button>
                <div style="height:1px; background:var(--border-color); margin: 4px 5%;"></div>
                <div style="font-size:10px; color:var(--text-color);">Brakuje:
                    ${virtB.w > 0 ? `<span class="icon header wood" style="transform:scale(0.8);"></span>${virtB.w.toLocaleString()} ` : ''}
                    ${virtB.g > 0 ? `<span class="icon header stone" style="transform:scale(0.8);"></span>${virtB.g.toLocaleString()} ` : ''}
                    ${virtB.i > 0 ? `<span class="icon header iron" style="transform:scale(0.8);"></span>${virtB.i.toLocaleString()}` : ''}
                </div>
            </div>`;
        }

        if ((virtB.w+virtB.g+virtB.i) > 0 && tVirt > 0) {
            let tradesHtml = '';
            let virtM_sim = { w: virtM.w, g: virtM.g, i: virtM.i };
            let realM_sim = { w: realM.w, g: realM.g, i: realM.i };
            const resMap = { 'w': 'wood', 'g': 'stone', 'i': 'iron' };

            for (let step = 0; step < 2; step++) {
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
                amount = Math.floor(amount / 10) * 10;

                if (amount >= 100) {
                    tradesHtml += `
                    <div style="background: rgba(0,128,0,0.15); border-radius:4px; padding:6px; margin-bottom:8px; border:1px solid rgba(0,128,0,0.3);">
                        <b style="color:#4caf50; font-size:11px;">⚖️ WYMIANA ${step+1}</b><br>
                        ${amount.toLocaleString()} <span class="icon header ${resMap[minT_key]}"></span> ➔ ${amount.toLocaleString()} <span class="icon header ${resMap[maxT_key]}"></span><br>
                        <div style="display:flex; gap:4px; margin-top:4px;">
                            <a href="https://${world}.plemiona.pl/game.php?village=${vId}&screen=market&mode=other_offer&buy_res=${resMap[maxT_key]}&sell_res=${resMap[minT_key]}" class="kalk-btn" style="flex:1; text-align:center; text-decoration:none;">Kup</a>
                            <a href="https://${world}.plemiona.pl/game.php?village=${vId}&screen=market&mode=own_offer&offer_buy=${resMap[maxT_key]}&offer_sell=${resMap[minT_key]}&needed=${amount}" class="kalk-btn" style="flex:1; text-align:center; text-decoration:none;">Wystaw</a>
                        </div>
                    </div>`;

                    virtM_sim[minT_key] -= amount;
                    virtM_sim[maxT_key] += amount;
                    realM_sim[minT_key] -= amount;
                } else {
                    break;
                }
            }

            if (tradesHtml !== '') {
                html += tradesHtml;
            }
        }

        const buildH = (txt) => `<div style="text-align:center; margin-top:10px; border-top: 1px dashed var(--border-color); padding-top:5px; display:flex; align-items:center; justify-content:center; gap:8px;"><b>${txt}</b></div>`;
        html += buildH("Przychodzące");
        html += `<div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:3px; padding:6px; display:flex; justify-content:space-between; margin-top:3px;">
            <span><span class="icon header wood"></span> ${inc.w.toLocaleString()}</span><span><span class="icon header stone"></span> ${inc.g.toLocaleString()}</span><span><span class="icon header iron"></span> ${inc.i.toLocaleString()}</span>
        </div>`;

        html += buildH("Własne oferty");
        if (!offers.length) html += `<div style="text-align:center; font-size:10px; color:#aaa; padding:5px;">Brak danych.</div>`;
        else offers.forEach(o => {
            html += `<div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:3px; padding:4px; margin-top:3px; font-size:10px;">
                <div style="display:flex; justify-content:space-between;"><span>[${o.oddasz.amt.toLocaleString()}] <span class="icon header ${o.oddasz.k}"></span></span>➔<span>[${o.dostaniesz.amt.toLocaleString()}] <span class="icon header ${o.dostaniesz.k}"></span></span></div>
            </div>`;
        });
        resBox.innerHTML = html;

        $('#do_wezwij_btn').click(function() {
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
    ui.style = `position:absolute; top:${savedP.top}px; left:${savedP.left}px; z-index:9999999; border-radius:5px; font-family:Arial; font-size:11px; width:275px; box-shadow: 0 0 15px rgba(0,0,0,0.6); display:none; touch-action: none; cursor:move;`;

    ui.innerHTML = `<div id="calc_header" class="kalk-header" style="padding:10px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; user-select:none;">
        <span>Kalkulator Surowców</span> 
        <span id="close_btn" style="cursor:pointer; padding: 0 2px;">[X]</span>
    </div>
    <div style="padding:10px; max-height: 80vh; overflow-y: auto;">
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;"><span class="icon header wood"></span><input id="m_w" type="number" class="kalk-input" style="width:85px;"><input id="p_w" type="number" readonly class="kalk-input" style="width:75px;"></div>
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;"><span class="icon header stone"></span><input id="m_g" type="number" class="kalk-input" style="width:85px;"><input id="p_g" type="number" readonly class="kalk-input" style="width:75px;"></div>
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;"><span class="icon header iron"></span><input id="m_i" type="number" class="kalk-input" style="width:85px;"><input id="p_i" type="number" readonly class="kalk-input" style="width:75px;"></div>
        <div style="margin-top:8px; border-top:1px solid var(--border-color); padding-top:8px;">
            <b>CEL: <span id="target_label" style="font-weight:normal; color:#4caf50;">Brak</span></b>
            <div style="display:flex; gap:2px; margin-top:3px;"><input id="c_w" type="number" value="0" class="kalk-input" style="width:62px;"><input id="c_g" type="number" value="0" class="kalk-input" style="width:62px;"><input id="c_i" type="number" value="0" class="kalk-input" style="width:62px;"></div>
        </div>
        <div style="display:flex; gap:5px; margin-top:8px;"><button id="set_moneta" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">🪙 Moneta</button><button id="set_gruby" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">👑 Gruby</button></div>
        <div style="display:flex; gap:5px; margin-top:8px;"><button id="calc_btn" class="kalk-btn" style="flex:4; font-weight:bold;">OBLICZ (Sync)</button><button id="clear_btn" class="kalk-btn" style="flex:1;">🗑️</button></div>
        <div id="results" style="margin-top:10px; background:var(--bg-row-alt); padding:8px; display:none; border:1px solid var(--border-color); border-radius:3px;"></div>
    </div>`;
    document.body.appendChild(ui);

    // Obsługa dotyku na telefonie
    let drag = false, sx, sy, il, it;
    const onStart = (e) => { if (['input', 'button', 'a', 'span'].includes(e.target.tagName.toLowerCase()) && e.target.id !== 'calc_header') return; drag = true; const t = e.type.includes('touch') ? e.touches[0] : e; sx = t.clientX; sy = t.clientY; il = ui.offsetLeft; it = ui.offsetTop; };
    const onMove = (e) => { if (!drag) return; const t = e.type.includes('touch') ? e.touches[0] : e; ui.style.left = (il + (t.clientX - sx)) + 'px'; ui.style.top = (it + (t.clientY - sy)) + 'px'; if (e.type === 'touchmove') e.preventDefault(); };
    ui.addEventListener('mousedown', onStart); ui.addEventListener('touchstart', onStart, {passive: false});
    document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, {passive: false});
    const onEnd = () => { if(drag) { drag = false; localStorage.setItem(STORAGE_KEY_POS, JSON.stringify({top: parseInt(ui.style.top), left: parseInt(ui.style.left)})); }};
    document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd);

    function fillData() {
        const sInc = JSON.parse(localStorage.getItem(`calc_inc_${vId}`)) || {w:0, g:0, i:0};
        $('#m_w').val(Math.floor(game_data.village.wood) + sInc.w);
        $('#m_g').val(Math.floor(game_data.village.stone) + sInc.g);
        $('#m_i').val(Math.floor(game_data.village.iron) + sInc.i);

        $('#p_w').val(Math.round(game_data.village.wood_prod * 3600));
        $('#p_g').val(Math.round(game_data.village.stone_prod * 3600));
        $('#p_i').val(Math.round(game_data.village.iron_prod * 3600));
    }

    $('#calc_btn').click(async () => {
        let btn = $('#calc_btn');
        btn.text('Czekaj...').prop('disabled', true);
        await syncMarketDataInBackground();
        fillData();
        calculateTrade();
        btn.text('OBLICZ (Sync)').prop('disabled', false);
    });

    $('#close_btn').click(() => { $(ui).hide(); localStorage.setItem(STORAGE_KEY_STATE, 'closed'); stopAutoSync(); });

    $('#set_moneta').click(function() {
        let n = (parseInt($(this).attr('data-count')) || 0) + 1;
        $(this).attr('data-count', n).text(`🪙 Moneta x${n}`);
        $('#c_w').val(n * 28000); $('#c_g').val(n * 30000); $('#c_i').val(n * 25000);
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w: n*28000, g: n*30000, i: n*25000, mCount: n, gCount: 0, name: `🪙 Moneta x${n}`}));
        calculateTrade();
    });

    $('#set_gruby').click(function() {
        let n = (parseInt($(this).attr('data-count')) || 0) + 1;
        $(this).attr('data-count', n).text(`👑 Gruby x${n}`);
        $('#c_w').val(n * 40000); $('#c_g').val(n * 50000); $('#c_i').val(n * 50000);
        localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w: n*40000, g: n*50000, i: n*50000, mCount: 0, gCount: n, name: `👑 Gruby x${n}`}));
        calculateTrade();
    });

    $('#clear_btn').click(() => {
        $('#c_w,#c_g,#c_i').val(0); $('#set_moneta,#set_gruby').attr('data-count', 0);
        $('#set_moneta').text('🪙 Moneta'); $('#set_gruby').text('👑 Gruby');
        localStorage.removeItem(STORAGE_KEY_TARGET);
        calculateTrade();
    });

    const woodLink = $('.icon.header.wood').first().closest('a');
    if (woodLink.length) {
        $(`<td class="box-item icon-box" style="padding: 0 4px; border-right: 1px solid var(--border-color);"><span id="calc_pin" style="cursor:pointer; font-size:14px;">📊</span></td>`).insertBefore(woodLink.closest('td'));
        $('#calc_pin').on('click', async () => {
            let s = $(ui).is(':hidden'); $(ui).toggle();
            localStorage.setItem(STORAGE_KEY_STATE, s ? 'open' : 'closed');
            if(s) {
                $('#calc_btn').text('Czekaj...').prop('disabled', true);
                await syncMarketDataInBackground();
                fillData();
                calculateTrade();
                $('#calc_btn').text('OBLICZ (Sync)').prop('disabled', false);
                startAutoSync();
            } else {
                stopAutoSync();
            }
        });
        $('#calc_pin').on('dblclick', () => {
            localStorage.removeItem(STORAGE_KEY_POS);
            ui.style.top = '100px'; ui.style.left = '20px';
        });
    }

    if (game_data.screen === 'main' || game_data.screen === 'snob') {
        $('#buildings tr, #main_buildrow tr, .train_units tr').each(function() {
            const r=$(this), w=cleanNum(r.find('.cost_wood').text()), g=cleanNum(r.find('.cost_stone').text()), i=cleanNum(r.find('.cost_iron').text());
            if (w||g||i) r.find('td:first').prepend($(`<input type="checkbox" class="calc-check" data-w="${w}" data-g="${g}" data-i="${i}" style="margin-right:8px; width:20px; height:20px;">`));
        });

        $(document).on('change', '.calc-check', function() {
            let tw=0, tg=0, ti=0, names=[];
            $('.calc-check:checked').each(function() {
                tw+=parseInt($(this).data('w')); tg+=parseInt($(this).data('g')); ti+=parseInt($(this).data('i'));
                let bName = $(this).parent().text().replace(/\s+/g, ' ').trim().split(' (')[0];
                if(bName) names.push(bName);
            });
            $('#c_w').val(tw); $('#c_g').val(tg); $('#c_i').val(ti);
            let finalName = names.length > 0 ? names.join(', ') : 'Brak';
            localStorage.setItem(STORAGE_KEY_TARGET, JSON.stringify({w:tw, g:tg, i:ti, name: finalName}));
            calculateTrade();
        });
    }

    // Wbudowana obsługa wezwania handlarzy (ekran market&mode=call)
    if (game_data.screen === 'market' && game_data.query.indexOf('mode=call') !== -1) {
        const callData = JSON.parse(localStorage.getItem(STORAGE_KEY_CALL));
        if (callData) {
            if (callData.w) $('#wood').val(callData.w);
            if (callData.g) $('#stone').val(callData.g);
            if (callData.i) $('#iron').val(callData.i);
            localStorage.removeItem(STORAGE_KEY_CALL);
        }
    }

    (function init() {
        const savedT = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET));
        if (savedT) {
            $('#c_w').val(savedT.w); $('#c_g').val(savedT.g); $('#c_i').val(savedT.i);
            if (savedT.mCount > 0) $('#set_moneta').attr('data-count', savedT.mCount).text(`🪙 Moneta x${savedT.mCount}`);
            if (savedT.gCount > 0) $('#set_gruby').attr('data-count', savedT.gCount).text(`👑 Gruby x${savedT.gCount}`);
        }
        fillData();

        if (localStorage.getItem(STORAGE_KEY_STATE) === 'open') {
            $(ui).show();
            syncMarketDataInBackground().then(() => {
                fillData();
                calculateTrade();
                startAutoSync();
            });
        }
    })();
})();
