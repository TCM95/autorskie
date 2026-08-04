// ==UserScript==
// @name         etykiety
// @namespace    https://viayoo.com/
// @author       TCM
// @description  Etykiety z panelem i filtrowaniem jednostek (topór, miecz, taran, szlachcic).
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*mode=incomings*subtype=attacks*
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*mode=incomings*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const getSetting = (key, defaultValue) => localStorage.getItem('at_label_' + key) || defaultValue;
    const saveSetting = (key, value) => localStorage.setItem('at_label_' + key, value);

    let isRunning = getSetting('running', '0') === '1';
    let minTime = parseInt(getSetting('minTime', '240'));
    let maxTime = parseInt(getSetting('maxTime', '360'));
    let totalAdded = parseInt(getSetting('totalAdded', '0'));
    let activeFilter = null;

    // Grafiki ikon z serwera Plemion
    const unitIcons = {
        axe: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_axe.png',
        sword: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_sword.png',
        ram: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_ram.png',
        snob: 'https://dspl.innogamescdn.com/asset/8a8677a2/graphic/unit/unit_snob.png'
    };

    // Liczenie poszczególnych komend w tabeli
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

    // Filtrowanie wierszy tabeli
    const filterTableByUnit = (unitKey) => {
        const keywordMap = {
            axe: ['topór', 'topor'],
            sword: ['miecz'],
            ram: ['taran'],
            snob: ['szlachcic', 'szlachta']
        };

        if (activeFilter === unitKey) {
            // Ponowne kliknięcie resetuje filtr
            activeFilter = null;
            $("#incomings_table tr").show();
            $('.unit-filter-btn').css('border-color', '#7d510f');
            return;
        }

        activeFilter = unitKey;
        $('.unit-filter-btn').css('border-color', '#7d510f');
        $(`#btn_filter_${unitKey}`).css('border-color', '#00FF00');

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
        const statusColor = isRunning ? '#00FF00' : '#FF0000';
        const unitCounts = countIncomingTypes();

        const container = $('<div id="label_panel" class="vis" style="margin: 0; display: inline-block; min-width: 220px; border: 1px solid #7d510f; vertical-align: top;"></div>');

        const header = $(`
            <h4 style="margin: 0; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; background: #e3d5b3;">
                <span>Etykiety <span id="status_dot" style="color: ${statusColor}; text-shadow: 0 0 2px black;">●</span></span>
                <span id="timer_display" style="font-weight: normal; min-width: 40px; text-align: right;"></span>
            </h4>
        `);

        const content = $(`
            <div style="padding: 6px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; gap: 5px;">
                    <div>
                        <input type="number" id="min_input" value="${minTime}" style="width: 38px;">
                        <input type="number" id="max_input" value="${maxTime}" style="width: 38px;">
                    </div>
                    <span>Suma: <b id="total_val">${totalAdded}</b> <span id="btn_reset" style="cursor:pointer; font-size:14px; margin-left: 3px;" title="Zresetuj sumę">🗑️</span></span>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button id="btn_toggle" class="btn" style="flex: 1;">${isRunning ? 'Wyłącz' : 'Włącz'}</button>
                    <button id="btn_manual" class="btn" style="flex: 1;">Etykieta</button>
                </div>
                <!-- Poziome małe przyciski jednostek z licznikami -->
                <div style="display: flex; justify-content: space-between; gap: 2px; margin-top: 2px;">
                    <button id="btn_filter_axe" class="btn unit-filter-btn" style="flex: 1; padding: 2px 1px; display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 10px; border: 1px solid #7d510f;">
                        <img src="${unitIcons.axe}" style="width: 14px; height: 14px;"> <b>${unitCounts.axe}</b>
                    </button>
                    <button id="btn_filter_sword" class="btn unit-filter-btn" style="flex: 1; padding: 2px 1px; display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 10px; border: 1px solid #7d510f;">
                        <img src="${unitIcons.sword}" style="width: 14px; height: 14px;"> <b>${unitCounts.sword}</b>
                    </button>
                    <button id="btn_filter_ram" class="btn unit-filter-btn" style="flex: 1; padding: 2px 1px; display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 10px; border: 1px solid #7d510f;">
                        <img src="${unitIcons.ram}" style="width: 14px; height: 14px;"> <b>${unitCounts.ram}</b>
                    </button>
                    <button id="btn_filter_snob" class="btn unit-filter-btn" style="flex: 1; padding: 2px 1px; display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 10px; border: 1px solid #7d510f;">
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

        // Eventy dla przycisków filtrów
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
