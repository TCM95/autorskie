// ==UserScript==
// @name         etykiety
// @namespace    https://viayoo.com/
// @author       TCM
// @description  Etykiety
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*mode=incomings*subtype=attacks*
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*mode=incomings*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Wstrzyknięcie dedykowanych stylów Shinko
    const style = document.createElement('style');
    style.textContent = `
        .tcm-shinko-panel {
            background-color: #36393f !important;
            border: 1px solid #3e4147 !important;
            color: #ffffff !important;
            font-family: Verdana, sans-serif !important;
            border-radius: 4px !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
            overflow: hidden !important;
        }
        .tcm-shinko-header {
            background-color: #202225 !important;
            border-bottom: 1px solid #3e4147 !important;
            color: #ffffdf !important;
            padding: 6px 10px !important;
            font-weight: bold !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        .tcm-shinko-btn {
            background: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%) !important;
            border: 1px solid #3e4147 !important;
            color: #ffffff !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            transition: background 0.2s !important;
        }
        .tcm-shinko-btn:hover {
            background: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%) !important;
        }
        .tcm-shinko-input {
            background-color: #202225 !important;
            border: 1px solid #3e4147 !important;
            color: #ffffff !important;
            border-radius: 3px !important;
            text-align: center !important;
            padding: 2px !important;
        }
    `;
    document.head.appendChild(style);

    const getSetting = (key, defaultValue) => localStorage.getItem('at_label_' + key) || defaultValue;
    const saveSetting = (key, value) => localStorage.setItem('at_label_' + key, value);

    let isRunning = getSetting('running', '0') === '1';
    let minTime = parseInt(getSetting('minTime', '240'));
    let maxTime = parseInt(getSetting('maxTime', '360'));
    let totalAdded = parseInt(getSetting('totalAdded', '0'));
    let activeFilter = null;

    const unitIcons = {
        axe: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_axe.png',
        sword: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_sword.png',
        ram: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_ram.png',
        snob: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_snob.png'
    };

    const countIncomingTypes = () => {
        const counts = { axe: 0, sword: 0, ram: 0, snob: 0 };
        $("#incomings_table tr.nowrap").each(function() {
            const text = $(this).text().toLowerCase();
            if (text.includes('topór') || text.includes('topor')) counts.axe++;
            if (text.includes('miecz')) counts.sword++;
            if (text.includes('taran')) counts.ram++;
            if (text.includes('szlachcic') || text.includes('szlachta')) counts.snob++;
        });
        return counts;
    };

    const filterTableByUnit = (unitKey) => {
        const keywordMap = {
            axe: ['topór', 'topor'],
            sword: ['miecz'],
            ram: ['taran'],
            snob: ['szlachcic', 'szlachta']
        };

        if (activeFilter === unitKey) {
            activeFilter = null;
            $("#incomings_table tr").show();
            $('.unit-filter-btn').css('border-color', '#3e4147');
            return;
        }

        activeFilter = unitKey;
        $('.unit-filter-btn').css('border-color', '#3e4147');
        $(`#btn_filter_${unitKey}`).css('border-color', '#ffffdf');

        const keywords = keywordMap[unitKey];

        $("#incomings_table tr.nowrap").each(function() {
            const rowText = $(this).text().toLowerCase();
            const matches = keywords.some(kw => rowText.includes(kw));
            if (matches) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    };

    const setupUI = () => {
        const statusColor = isRunning ? '#00ff00' : '#ff4444';
        const unitCounts = countIncomingTypes();

        const container = $('<div id="label_panel" class="tcm-shinko-panel" style="margin: 0; display: inline-block; min-width: 230px; vertical-align: top;"></div>');

        const header = $(`
            <div class="tcm-shinko-header">
                <span>Etykiety <span id="status_dot" style="color: ${statusColor}; text-shadow: 0 0 3px black;">●</span></span>
                <span id="timer_display" style="font-weight: normal; min-width: 40px; text-align: right; color: #ffffff;"></span>
            </div>
        `);

        const content = $(`
            <div style="padding: 8px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; gap: 5px;">
                    <div>
                        <input type="number" id="min_input" class="tcm-shinko-input" value="${minTime}" style="width: 40px;">
                        <input type="number" id="max_input" class="tcm-shinko-input" value="${maxTime}" style="width: 40px;">
                    </div>
                    <span>Suma: <b id="total_val" style="color: #ffffdf;">${totalAdded}</b> <span id="btn_reset" style="cursor:pointer; font-size:14px; margin-left: 3px;" title="Zresetuj sumę">🗑️</span></span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button id="btn_toggle" class="tcm-shinko-btn" style="flex: 1; padding: 4px;">${isRunning ? 'Wyłącz' : 'Włącz'}</button>
                    <button id="btn_manual" class="tcm-shinko-btn" style="flex: 1; padding: 4px;">Etykieta</button>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 4px; margin-top: 2px;">
                    <button id="btn_filter_axe" class="tcm-shinko-btn unit-filter-btn" style="flex: 1; padding: 3px 1px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 10px;">
                        <img src="${unitIcons.axe}" style="width: 14px; height: 14px;"> <b>${unitCounts.axe}</b>
                    </button>
                    <button id="btn_filter_sword" class="tcm-shinko-btn unit-filter-btn" style="flex: 1; padding: 3px 1px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 10px;">
                        <img src="${unitIcons.sword}" style="width: 14px; height: 14px;"> <b>${unitCounts.sword}</b>
                    </button>
                    <button id="btn_filter_ram" class="tcm-shinko-btn unit-filter-btn" style="flex: 1; padding: 3px 1px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 10px;">
                        <img src="${unitIcons.ram}" style="width: 14px; height: 14px;"> <b>${unitCounts.ram}</b>
                    </button>
                    <button id="btn_filter_snob" class="tcm-shinko-btn unit-filter-btn" style="flex: 1; padding: 3px 1px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 10px;">
                        <img src="${unitIcons.snob}" style="width: 14px; height: 14px;"> <b>${unitCounts.snob}</b>
                    </button>
                </div>
            </div>
        `);

        container.append(header).append(content);

        const filterBtn = $('.overview_filters_manage');
        if (filterBtn.length) {
            let flexWrapper = $('<div id="tcm_filter_wrapper" style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 10px; flex-wrap: wrap;"></div>');
            filterBtn.before(flexWrapper);
            
            let nativeFiltersCol = $('<div style="display: flex; flex-direction: column; gap: 5px;"></div>');
            nativeFiltersCol.append($('.overview_filters'));
            nativeFiltersCol.append(filterBtn);
            
            flexWrapper.append(nativeFiltersCol);
            flexWrapper.append(container);
        } else {
            $("#content_value").prepend(container);
        }

        $('#btn_filter_axe').on('click', function() { filterTableByUnit('axe'); });
        $('#btn_filter_sword').on('click', function() { filterTableByUnit('sword'); });
        $('#btn_filter_ram').on('click', function() { filterTableByUnit('ram'); });
        $('#btn_filter_snob').on('click', function() { filterTableByUnit('snob'); });

        $('#min_input').on('change', function() { saveSetting('minTime', $(this).val()); });
        $('#max_input').on('change', function() { saveSetting('maxTime', $(this).val()); });

        $('#btn_toggle').on('click', function() {
            isRunning = !isRunning;
            saveSetting('running', isRunning ? '1' : '0');
            location.reload();
        });

        $('#btn_manual').on('click', function() {
            executeLabeling();
        });

        $('#btn_reset').on('click', function() {
            totalAdded = 0;
            saveSetting('totalAdded', '0');
            $('#total_val').text('0');
        });
    };

    const executeLabeling = () => {
        const attackRows = $("#incomings_table").find("td:contains('Atak')");
        if (attackRows.length > 0) {
            let currentCount = parseInt(getSetting('totalAdded', '0'));
            saveSetting('totalAdded', currentCount + attackRows.length);

            $("#select_all").trigger('click');

            setTimeout(() => {
                $("input[value='Etykieta']").trigger('click');
            }, 2000);
        }
    };

    if (isRunning) {
        const randomSeconds = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
        let timeLeft = randomSeconds;

        setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) location.reload();
            $('#timer_display').text(timeLeft + "s");
        }, 1000);

        setTimeout(executeLabeling, 2000);
    }

    $(document).ready(function() {
        setupUI();
    });
})();
