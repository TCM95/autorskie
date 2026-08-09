// ==UserScript==
// @name         Ekspresowy Handlar
// @version      1.7.7
// @description  handel i Hermit (Dyskretny).
// @author       Gal Anonim
// @namespace    https://viayoo.com/
// @match        *://*.plemiona.pl/game.php?*screen=market*
// @match        *://*.plemiona.pl/game.php?*screen=main*
// @match        *://*.plemiona.pl/game.php?*screen=snob*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (typeof game_data === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);

    const silentSelect = (s) => {
        const el = $(s);
        if (el.length) el.prop('disabled', false).prop('checked', true).trigger('change');
    };

    // --- MODUŁ 1: MONITOR KOSZTU CELU ---
    setInterval(() => {
        const targetW = parseInt($('#c_w').val()) || 0;
        const targetG = parseInt($('#c_g').val()) || 0;
        const targetI = parseInt($('#c_i').val()) || 0;

        if (targetW > 0 || targetG > 0 || targetI > 0) {
            localStorage.setItem('Etykiety_Hermit_Dynamic', JSON.stringify({
                'wood': targetW, 'stone': targetG, 'iron': targetI
            }));
        }
    }, 1000);

    // --- MODUŁ 2: WEZWIJ (Hermit - Cichy start) ---
    if (window.location.href.includes('mode=call')) {
        let attempts = 0;
        const checkAndInject = setInterval(() => {
            attempts++;
            const saved = localStorage.getItem('Etykiety_Hermit_Dynamic');
            if (saved) {
                clearInterval(checkAndInject);
                window.HermitowskieSurki = {
                    target_resources: JSON.parse(saved),
                    storage_percentage_limit: { 'wood': 98, 'stone': 98, 'iron': 98 },
                    resources_safeguard: { 'wood': 0, 'stone': 0, 'iron': 0 },
                    trim_to_storage_capacity: true,
                    traders_safeguard: 0,
                    idle_time: 5,
                    trader_capacity_threshold: 0
                };
                const script = document.createElement('script');
                script.src = 'https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskieSurki.js?_=' + Date.now();
                document.head.appendChild(script);
            }
            if (attempts > 30) clearInterval(checkAndInject);
        }, 1000);
    }

    // --- MODUŁ 3: HANDEL (Inni gracze / Kupno) ---
    if (window.location.href.includes('mode=other_offer') && urlParams.has('buy_res')) {
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

    // --- MODUŁ 4: TWORZENIE OFERT (Własne) ---
    if (window.location.href.includes('mode=own_offer') && urlParams.has('offer_buy')) {
        const b = urlParams.get('offer_buy');
        const s = urlParams.get('offer_sell');
        const needed = parseInt(urlParams.get('needed')) || 0;
        const merchants = parseInt($('#market_merchant_available_count').text()) || 0;
        let count = Math.min(merchants, Math.floor((needed + 400) / 1000));

        if (count > 0) {
            setTimeout(() => {
                silentSelect('#res_buy_all');
                silentSelect('#res_sell_all');
                setTimeout(() => {
                    $('#res_sell_amount').val(1000).trigger('change');
                    $('#res_buy_amount').val(1000).trigger('change');
                    $('input[name="multi"]').val(count).trigger('change');
                    $('input[name="max_time"]').val(3).trigger('change');
                    setTimeout(() => {
                        silentSelect(`#res_sell_${s}`);
                        silentSelect(`#res_buy_${b}`);
                        $('#submit_offer')
                            .css({"border":"4px solid green", "background":"#c0dfb0", "height":"auto", "padding":"10px", "font-weight":"bold"})
                            .val("WYSTAW " + count + " OFERT");
                    }, 200);
                }, 300);
            }, 1200);
        } else {
            $('#submit_offer').val("BRAKI < 600 - POMINIĘTO").prop('disabled', true);
        }
    }
})();
