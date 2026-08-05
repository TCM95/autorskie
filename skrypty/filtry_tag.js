// ==UserScript==
// @name         Filtry Raportów
// @namespace    https://viayoo.com/
// @namespace    plemiona.pl
// @version      3.3
// @description  Same filtry w raportach.
// @author       Gal Anonim
// @match        *://*.plemiona.pl/game.php?*screen=report*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Konfiguracja etykiet filtrowania
    const settings = {
        0: ['[OFF]', 'OFF'],
        1: ['[FEJK]', 'FEJK'],
        2: ['[BURZAK]', 'BURZAK'],
        3: ['[KONTRA]', 'KONTRA'],
        4: ['[KLIN]', 'KLIN']
    };

    function addReportFilters() {
        // Lokalizacja pola wyszukiwania w raportach
        const $filterInput = $('#filter_subject');

        // Zabezpieczenie przed podwójnym dodaniem lub brakiem elementu
        if ($filterInput.length === 0 || $('#custom-report-filters').length > 0) return;

        // Budowa kontenera filtrów
        let html = '<div id="custom-report-filters" style="margin-bottom: 10px; padding: 5px; background: #e3d1b1; border: 1px solid #7d510f; border-radius: 3px; display: flex; flex-wrap: wrap; gap: 4px;">';
        html += '<span style="font-weight:bold; margin-right:5px; line-height:22px;">Filtruj:</span>';

        // Generowanie przycisków na podstawie ustawień
        Object.keys(settings).forEach(key => {
            const s = settings[key];
            html += `<button type="button" class="btn report-tag-btn" data-tag="${s[0]}" style="padding: 3px 8px; font-size: 11px;">${s[1]}</button>`;
        });

        // Przycisk czyszczenia filtra [X]
        html += `<button type="button" class="btn report-tag-btn" data-tag="" style="padding: 3px 8px; font-size: 11px; background: #d9534f; color: white;">[X]</button></div>`;

        // Wstrzyknięcie filtrów przed formularz systemowy
        $filterInput.closest('form').before(html);

        // Obsługa kliknięcia w filtr
        $('.report-tag-btn').on('click', function(e) {
            e.preventDefault();
            const tag = $(this).data('tag');
            $filterInput.val(tag);
            // Automatyczne zatwierdzenie formularza
            $filterInput.closest('form').find('input[type="submit"]').click();
        });
    }

    // Inicjalizacja z lekkim opóźnieniem dla pewności załadowania DOM
    setTimeout(() => {
        addReportFilters();
    }, 400);
})();
