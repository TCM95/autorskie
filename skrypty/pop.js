// ==UserScript==
// @name         poparcie
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @run-at       document-end
// @grant        none
// @namespace    https://viayoo.com/
// ==/UserScript==

(function($) {
    'use strict';

    if (typeof $ === 'undefined' && typeof window.jQuery !== 'undefined') {
        $ = window.jQuery;
    }

    if (typeof $ === 'undefined') return;

    const BASE_REGEN_PER_HOUR = 1; 
    const urlParams = new URLSearchParams(window.location.search);
    const screen = urlParams.get('screen');

    if (screen === 'report') {
        saveLoyaltyFromReport();
    } else if (screen === 'info_village') {
        const villageId = urlParams.get('id');
        if (villageId) {
            initLoyaltyObserver(BASE_REGEN_PER_HOUR, villageId);
        }
    }

    function saveLoyaltyFromReport() {
        const htmlContent = document.body.innerHTML;
        const loyaltyMatch = htmlContent.match(/Spadek z\s*<b>\d+<\/b>\s*do\s*<b>(\d+)<\/b>/);

        if (loyaltyMatch) {
            const finalLoyalty = parseInt(loyaltyMatch[1], 10);

            const $timeCell = $("td").filter(function() {
                return $(this).text().trim() === "Czas bitwy";
            }).next("td");

            let battleTimestamp = Date.now();

            if ($timeCell.length) {
                const timeText = $timeCell.text().trim();
                const dateTimeMatch = timeText.match(/(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2}:\d{2})/);

                if (dateTimeMatch) {
                    const day = dateTimeMatch[1];
                    const month = dateTimeMatch[2];
                    const year = "20" + dateTimeMatch[3];
                    const time = dateTimeMatch[4];

                    const isoString = `${year}-${month}-${day}T${time}`;
                    battleTimestamp = Date.parse(isoString);
                }
            }

            const $defenderSpan = $('#attack_info_def .village_anchor');
            if (!$defenderSpan.length) return;

            const targetId = $defenderSpan.attr('data-id');
            if (!targetId) return;

            const dataToSave = {
                loyalty: finalLoyalty,
                timestamp: battleTimestamp
            };

            localStorage.setItem('etykiety_poparcie_' + targetId, JSON.stringify(dataToSave));

            const $header = $('.report_ReportAttack h3');
            if ($header.length && !$header.text().includes('Zapisano')) {
                $header.append(' <span style="color:green; font-size: 11px;">(Zapisano poparcie)</span>');
            }
        }
    }

    function initLoyaltyObserver(baseRegen, targetId) {
        const targetTable = $("td").filter(function() {
            return $(this).text().trim() === "Punkty:" || $(this).text().trim() === "Poparcie:";
        }).closest('table')[0];

        if (!targetTable) return;

        function renderRow() {
            let $loyaltyRow = $(targetTable).find("td").filter(function() {
                return $(this).text().trim() === "Poparcie:";
            }).closest('tr');

            const $pointsRow = $(targetTable).find("td").filter(function() {
                return $(this).text().trim() === "Punkty:";
            }).closest('tr');

            // Jeśli element z naszą klasą już istnieje na stronie, nic nie robimy
            if ($('.custom-poparcie-container').length) return;

            let savedMultiplier = parseFloat(localStorage.getItem('poparcie_regen_multiplier')) || 1.0;
            const savedData = localStorage.getItem('etykiety_poparcie_' + targetId);

            if (savedData) {
                const data = JSON.parse(savedData);
                const hoursElapsed = (Date.now() - data.timestamp) / (1000 * 60 * 60);

                // Przeliczanie poparcia na podstawie aktualnie zapisanego mnożnika
                const currentRegen = baseRegen * savedMultiplier;
                const generatedLoyalty = Math.max(0, Math.floor(hoursElapsed * currentRegen));
                const currentLoyalty = Math.min(100, data.loyalty + generatedLoyalty);

                const color = currentLoyalty >= 100 ? 'green' : '#b11111';
                const timeString = new Date(data.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

                let selectOptions = '';
                for (let i = 10; i <= 20; i++) {
                    const val = (i / 10).toFixed(1);
                    const selected = parseFloat(val) === savedMultiplier ? 'selected' : '';
                    selectOptions += `<option value="${val}" ${selected}>${val}x</option>`;
                }

                const contentHtml = `
                    <span class="custom-poparcie-container">
                        <b style="color:${color}; font-size: 13px;">${currentLoyalty}</b> 
                        <span class="grey" style="font-size:9px; margin-right: 5px;">(bitwa o ${timeString})</span>
                        <select id="loyalty-multiplier-select" style="font-size: 10px; padding: 1px; vertical-align: middle;">
                            ${selectOptions}
                        </select>
                        <button id="save-loyalty-multiplier" class="btn" style="font-size: 10px; padding: 1px 4px; margin-left: 3px; vertical-align: middle; cursor: pointer;">OK</button>
                    </span>`;

                if ($loyaltyRow.length) {
                    $loyaltyRow.find('td').eq(1).html(contentHtml);
                } else if ($pointsRow.length) {
                    const newRow = `
                        <tr class="etykiety-poparcie-row">
                            <td>Poparcie:</td>
                            <td>${contentHtml}</td>
                        </tr>`;
                    $pointsRow.after(newRow);
                }

                // Kliknięcie "OK" zapisuje nową wartość i odświeża widok
                $('#save-loyalty-multiplier').off('click').on('click', function(e) {
                    e.preventDefault();
                    const selectedVal = parseFloat($('#loyalty-multiplier-select').val());
                    localStorage.setItem('poparcie_regen_multiplier', selectedVal);
                    
                    // Usuwamy kontenery, aby wymusić pełny re-render z nowymi obliczeniami
                    $('.custom-poparcie-container').remove();
                    $('.etykiety-poparcie-row').remove();
                    renderRow();
                });

            } else {
                if (!$loyaltyRow.length && $pointsRow.length) {
                    const noDataRow = `<tr class="etykiety-poparcie-row"><td>Poparcie:</td><td><span class="grey">Brak danych o poparciu</span></td></tr>`;
                    $pointsRow.after(noDataRow);
                }
            }
        }

        renderRow();

        // Obserwator monitoruje czy struktura tabeli została zmieniona przez grę
        const observer = new MutationObserver(function() {
            if (!$('.custom-poparcie-container').length) {
                renderRow();
            }
        });

        observer.observe(targetTable, { childList: true, subtree: true });
    }
})(window.jQuery);
