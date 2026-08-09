(function() {
    'use strict';
    if (typeof game_data === 'undefined' || !window.KalkulatorUI) return;

    const vId = game_data.village.id;
    const world = window.location.hostname.split('.')[0];
    const STORAGE_KEY_OFFERS = `etykiety_market_offers_${world}`;
    const STORAGE_KEY_STATE = `etykiety_ui_state_${world}`;
    const STORAGE_KEY_TARGET = `etykiety_target_${vId}`;
    const ui = window.KalkulatorUI.element;

    const cleanNum = (v) => parseInt((v||"0").toString().replace(/\D/g, '')) || 0;

    async function syncMarket() { /* ... [TUTAJ WKLEJ ZNANY KOD Z POPRZEDNIEJ WERSJI DLA syncMarketDataInBackground - POMIJAM DLA ZWIĘZŁOŚCI, JEST TAKI SAM] ... */ }
    
    function fillData() {
        const sInc = JSON.parse(localStorage.getItem(`calc_inc_${vId}`)) || {w:0, g:0, i:0};
        $('#m_w').val(Math.floor(game_data.village.wood) + sInc.w);
        $('#m_g').val(Math.floor(game_data.village.stone) + sInc.g);
        $('#m_i').val(Math.floor(game_data.village.iron) + sInc.i);
        $('#p_w').val(Math.round(game_data.village.wood_prod * 3600));
        $('#p_g').val(Math.round(game_data.village.stone_prod * 3600));
        $('#p_i').val(Math.round(game_data.village.iron_prod * 3600));
    }

    function calculateTrade() {
        const target = JSON.parse(localStorage.getItem(STORAGE_KEY_TARGET)) || {w:0, g:0, i:0, name: 'Brak'};
        const inc = JSON.parse(localStorage.getItem(`calc_inc_${vId}`)) || { w:0, g:0, i:0 };

        const realM = { w: Math.floor(game_data.village.wood) + inc.w, g: Math.floor(game_data.village.stone) + inc.g, i: Math.floor(game_data.village.iron) + inc.i };
        
        let offers = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFERS))?.[vId] || [];
        let allExp = { w: 0, g: 0, i: 0 };
        offers.forEach(o => {
            let k = (o.dostaniesz.k || "").toLowerCase();
            let key = k.includes('wood') ? 'w' : k.includes('stone') ? 'g' : 'i';
            allExp[key] += o.dostaniesz.amt;
        });

        // Wirtualny stan surowców po przyjściu ofert
        const virtM = { w: realM.w + allExp.w, g: realM.g + allExp.g, i: realM.i + allExp.i };
        const virtB = { w: Math.max(0, target.w - virtM.w), g: Math.max(0, target.g - virtM.g), i: Math.max(0, target.i - virtM.i) };

        let resBox = document.getElementById('results');
        if (!resBox) return;
        resBox.style.display = "block";
        $('#target_label').text(target.name || 'Brak');

        let html = `<div style="margin-bottom:8px; text-align:center;">`;
        if (virtB.w > 0 || virtB.g > 0 || virtB.i > 0) {
            html += `<button id="do_wezwij_btn" data-w="${virtB.w}" data-g="${virtB.g}" data-i="${virtB.i}" class="kalk-btn" style="width:100%;">Wezwij Braki</button>
            <div style="font-size:10px; margin-top:5px; color:var(--text-color);">Braki Całkowite:
                ${virtB.w > 0 ? `<span class="icon header wood"></span>${virtB.w.toLocaleString()} ` : ''}
                ${virtB.g > 0 ? `<span class="icon header stone"></span>${virtB.g.toLocaleString()} ` : ''}
                ${virtB.i > 0 ? `<span class="icon header iron"></span>${virtB.i.toLocaleString()}` : ''}
            </div>`;
        }
        html += `</div>`;

        // === POPRAWIONY ALGORYTM WYMIAN (BEZ UWZGLĘDNIANIA CZASU) ===
        if (virtB.w > 0 || virtB.g > 0 || virtB.i > 0) {
            let tradesHtml = '';
            let vSim = { w: virtM.w, g: virtM.g, i: virtM.i };
            let rSim = { w: realM.w, g: realM.g, i: realM.i }; // Pilnujemy, czy fizycznie mamy towar do wysłania
            const resMap = { w: 'wood', g: 'stone', i: 'iron' };

            // Trzy surowce, więc maksymalnie 3 iteracje wyrównujące
            for (let step = 0; step < 3; step++) {
                let braki = {
                    w: Math.max(0, target.w - vSim.w),
                    g: Math.max(0, target.g - vSim.g),
                    i: Math.max(0, target.i - vSim.i)
                };
                
                let nadwyzki = {
                    w: Math.max(0, vSim.w - target.w),
                    g: Math.max(0, vSim.g - target.g),
                    i: Math.max(0, vSim.i - target.i)
                };

                // Kto potrzebuje najwięcej?
                let kMaxBrak = Object.keys(braki).reduce((a, k) => braki[a] > braki[k] ? a : k);
                // Kto ma największą nadwyżkę?
                let kMaxNadwyzka = Object.keys(nadwyzki).reduce((a, k) => nadwyzki[a] > nadwyzki[k] ? a : k);

                // Jeśli nie ma braków lub nie ma nadwyżek – kończymy wymiany
                if (braki[kMaxBrak] <= 0 || nadwyzki[kMaxNadwyzka] <= 0) break;

                // Kwota do handlu to to, czego nam brakuje, ALBO to co mamy w nadwyżce, 
                // ograniczona przez to, ile faktycznie fizycznie leży w wiosce.
                let amount = Math.floor(Math.min(braki[kMaxBrak], nadwyzki[kMaxNadwyzka], rSim[kMaxNadwyzka]));
                amount = Math.floor(amount / 10) * 10; // okrągłe liczby

                if (amount >= 100) {
                    tradesHtml += `
                    <div style="background: rgba(0,128,0,0.15); border-radius:4px; padding:6px; margin-bottom:8px; border:1px solid rgba(0,128,0,0.3);">
                        <b style="color:#4caf50; font-size:11px;">⚖️ WYMIANA ${step+1}</b><br>
                        ${amount.toLocaleString()} <span class="icon header ${resMap[kMaxNadwyzka]}"></span> ➔ ${amount.toLocaleString()} <span class="icon header ${resMap[kMaxBrak]}"></span><br>
                        <div style="display:flex; gap:4px; margin-top:4px;">
                            <a href="https://${world}.plemiona.pl/game.php?village=${vId}&screen=market&mode=other_offer&buy_res=${resMap[kMaxBrak]}&sell_res=${resMap[kMaxNadwyzka]}" class="kalk-btn" style="flex:1; text-align:center; text-decoration:none;">Kup</a>
                            <a href="https://${world}.plemiona.pl/game.php?village=${vId}&screen=market&mode=own_offer&offer_buy=${resMap[kMaxBrak]}&offer_sell=${resMap[kMaxNadwyzka]}&needed=${amount}" class="kalk-btn" style="flex:1; text-align:center; text-decoration:none;">Wystaw</a>
                        </div>
                    </div>`;

                    // Symulacja wykonanej wymiany do kolejnego kroku pętli
                    vSim[kMaxNadwyzka] -= amount;
                    vSim[kMaxBrak] += amount;
                    rSim[kMaxNadwyzka] -= amount;
                } else {
                    break;
                }
            }
            if (tradesHtml !== '') html += tradesHtml;
        }

        resBox.innerHTML = html;

        $('#do_wezwij_btn').click(function() {
            const req = { w: $(this).data('w'), g: $(this).data('g'), i: $(this).data('i') };
            localStorage.setItem(`etykiety_call_${vId}`, JSON.stringify(req));
            window.location.href = `game.php?village=${vId}&screen=market&mode=call`;
        });
    }

    // Podpięcie przycisków
    $('#calc_btn').click(() => { fillData(); calculateTrade(); });
    $('#close_btn').click(() => { $(ui).hide(); localStorage.setItem(STORAGE_KEY_STATE, 'closed'); });
    
    // Pinezka do pokazywania ukrywania - wstrzykiwanie obok surowców
    const woodLink = $('.icon.header.wood').first().closest('a');
    if (woodLink.length && !$('#calc_pin').length) {
        $(`<td class="box-item icon-box" style="padding: 0 4px; border-right: 1px solid var(--border-color);"><span id="calc_pin" style="cursor:pointer; font-size:14px;">📊</span></td>`).insertBefore(woodLink.closest('td'));
        $('#calc_pin').on('click', () => {
            let s = $(ui).is(':hidden'); $(ui).toggle();
            localStorage.setItem(STORAGE_KEY_STATE, s ? 'open' : 'closed');
            if(s) { fillData(); calculateTrade(); }
        });
    }

    // Inicjalizacja
    fillData();
    if (localStorage.getItem(STORAGE_KEY_STATE) === 'open') {
        $(ui).show();
        calculateTrade();
    }
})();
