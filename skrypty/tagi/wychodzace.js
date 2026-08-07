// ==UserScript==
// @name         Filtry i Tagger
// @namespace    https://viayoo.com/
// @description  Filtrowanie raportów oraz tagowanie komend w przeglądzie (Fejk, Zwiad, itp.)
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=overview_villages*
// @match        *://*.plemiona.pl/game.php?*screen=report*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    //            USTAWIENIA SKRYPTU
    // ==========================================
    
    const USTAWIENIA = {
        // Ustawienia dla przeglądu komend (overview_villages)
        komendy_filtry: [
            { id: 'snob',   img: 'command/snob.webp',          tag: '[GRUBY]',  hint: 'szlachcica',  type: 'icon', enabled: false },
            { type: 'spacer' },
            { id: 'large',  img: 'command/attack_large.webp',  tag: '[OFF]',    hint: 'Duży atak',   type: 'icon', enabled: false },
            { id: 'medium', img: 'command/attack_medium.webp', tag: '[OFF]',    hint: 'Średni atak', type: 'icon', enabled: false },
            { id: 'fejk',   img: 'command/attack_small.webp',  tag: '[FEJK]',   label: 'FEJK (1-10 T / 1-20 K)', type: 'unit_logic', enabled: false },
            { type: 'spacer' },
            { id: 'zwiad',  img: 'unit/unit_spy.png',          tag: '[ZWIAD]',  label: 'ZWIAD (5+ SAM)', type: 'unit_logic', enabled: false },
            { id: 'burzak', img: 'unit/unit_catapult.png',     tag: '[BURZAK]', label: 'BURZAK',     type: 'unit_logic', enabled: false }
        ],
        // Przyciski ręczne pojawiające się przy komendach
        komendy_reczne: ['[KLIN]', '[KONTRA]', '[ODBITKA]'],
        
        // Ustawienia dla zakładki raportów (szybkie filtrowanie)
        raporty_tagi: [
            { tag: '[OFF]', label: 'OFF' },
            { tag: '[FEJK]', label: 'FEJK' },
            { tag: '[BURZAK]', label: 'BURZAK' },
            { tag: '[KONTRA]', label: 'KONTRA' },
            { tag: '[KLIN]', label: 'KLIN' }
        ]
    };

    // ==========================================
    //                 STYL CSS
    // ==========================================

    const wstrzyknijCSS = () => {
        const css = `
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
            .tcm-btn {
                background: var(--btn-bg);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 10px;
                margin: 0 2px;
            }
            .tcm-btn:hover {
                background: var(--btn-hover);
            }
            .tcm-panel {
                background: var(--bg-main);
                border: 1px solid var(--border-color);
                color: var(--text-color);
                padding: 6px;
                border-radius: 4px;
                margin-bottom: 10px;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 4px;
            }
        `;
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
    };

    // ==========================================
    //           LOGIKA: PRZEGLĄD KOMEND
    // ==========================================

    const obslugaKomend = () => {
        const table = document.getElementById('commands_table');
        if (!table) return;

        let pendingTag = null;
        let isMassTagging = false;
        let filters = USTAWIENIA.komendy_filtry;

        const getUnitCol = (unit) => {
            let idx = -1;
            $(table.rows[0].cells).each((i, cell) => {
                if ($(cell).find(`img[src*="unit_${unit}"]`).length > 0) idx = i;
            });
            return idx;
        };

        const observer = new MutationObserver(() => {
            const $input = $('.quickedit-edit input[type="text"], input[type="text"].edit-label');
            if ($input.length > 0 && pendingTag !== null) {
                let currentVal = $input.val();
                let newName = currentVal.replace(/(Atak na|Zaplanowany atak na|Atak on)/gi, pendingTag);
                if (newName === currentVal) newName = pendingTag + " " + currentVal;

                $input.val(newName.trim());
                pendingTag = null;

                setTimeout(() => {
                    $input.closest('span, div, td').find('input[type="button"], .btn-ok, button').click();
                }, 100);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        async function processQueue(targets) {
            if (isMassTagging) return;
            isMassTagging = true;

            for (let item of targets) {
                let $label = item.$row.find('.quickedit-label');
                if ($label.text().includes(item.tag)) continue;

                pendingTag = item.tag;
                let $editBtn = item.$row.find('.rename-icon');

                if ($editBtn.length > 0) {
                    $editBtn.click();
                    await new Promise(resolve => {
                        let check = setInterval(() => {
                            if (pendingTag === null && $('.quickedit-edit').length === 0) {
                                clearInterval(check);
                                resolve();
                            }
                        }, 100);
                    });
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            isMassTagging = false;
        }

        function runLogic() {
            let active = filters.filter(f => f.enabled && f.type !== 'spacer');
            if (active.length === 0) { $(table).find('tr').show(); return; }

            let colRam = getUnitCol('ram');
            let colSpy = getUnitCol('spy');
            let colCat = getUnitCol('catapult');
            let unitCols = [];
            
            $(table.rows[0].cells).each((i, cell) => {
                if ($(cell).find('img[src*="/unit/unit_"]').length > 0) unitCols.push(i);
            });

            let toTag = [];

            for (let i = 1; i < table.rows.length; i++) {
                let row = table.rows[i];
                let $row = $(row);
                if ($row.hasClass('all_unit_container') || $row.find('th').length > 0) continue;

                let rams = colRam !== -1 ? (parseInt(row.cells[colRam].innerText) || 0) : 0;
                let spies = colSpy !== -1 ? (parseInt(row.cells[colSpy].innerText) || 0) : 0;
                let cats = colCat !== -1 ? (parseInt(row.cells[colCat].innerText) || 0) : 0;
                let others = 0;
                unitCols.forEach(idx => { if (idx !== colSpy) others += (parseInt(row.cells[idx].innerText) || 0); });

                let hints = $row.find('span.own_command').map(function() {
                    return ($(this).attr('data-icon-hint') || "").toLowerCase();
                }).get();

                let shouldShow = false;
                let rowTag = "";

                active.forEach(f => {
                    if (f.type === 'icon') {
                        if (hints.some(h => h.includes(f.hint.toLowerCase()))) { shouldShow = true; rowTag = f.tag; }
                    } else if (f.id === 'fejk') {
                        if ((rams > 0 || cats > 0) && rams <= 10 && cats <= 20) { shouldShow = true; rowTag = f.tag; }
                    } else if (f.id === 'zwiad') {
                        if (spies >= 5 && others === 0) { shouldShow = true; rowTag = f.tag; }
                    } else if (f.id === 'burzak') {
                        let obst = 0;
                        unitCols.forEach(idx => { if (idx !== colRam && idx !== colCat) obst += (parseInt(row.cells[idx].innerText) || 0); });
                        if (cats >= 20 && obst <= 1000) { shouldShow = true; rowTag = f.tag; }
                    }
                });

                $row.toggle(shouldShow);
                if (shouldShow && rowTag) toTag.push({$row, tag: rowTag});
            }

            if (toTag.length > 0) processQueue(toTag);
        }

        let th$ = $(table.rows[0].cells[0]);
        filters.forEach(f => {
            if (f.type === 'spacer') {
                th$.append('<span style="margin-left: 10px; border-left: 1px solid var(--border-color); padding-left: 4px;"></span>');
                return;
            }
            let img$ = $('<img>', {
                src: `https://dspl.innogamescdn.com/asset/2fe6656b/graphic/${f.img}`,
                style: 'cursor:pointer; margin-left: 4px; filter: grayscale(1.0); width: 16px; vertical-align: middle; border: 2px solid var(--border-color); padding: 1px; border-radius: 3px;',
                title: f.label || f.hint
            });
            img$.on('click', function() {
                f.enabled = !f.enabled;
                $(this).css(f.enabled ? { 'filter': 'grayscale(0.0)', 'border-color': '#00ff00' } : { 'filter': 'grayscale(1.0)', 'border-color': 'var(--border-color)' });
                runLogic();
            });
            th$.append(img$);
        });

        $(table).find('tr.nowrap').each(function() {
            const $cell = $(this).find('td:first');
            let html = '<div style="display:flex; flex-wrap:wrap; gap:2px; margin-top:3px;">';
            USTAWIENIA.komendy_reczne.forEach(t => {
                html += `<button type="button" class="tcm-btn">${t.replace('[','').replace(']','')}</button>`;
            });
            html += '</div>';
            
            const $btns = $(html);
            $btns.find('button').on('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                let label = $(this).text();
                pendingTag = `[${label}]`;
                $(this).closest('tr').find('.rename-icon').click();
            });
            $cell.append($btns);
        });
    };

    // ==========================================
    //           LOGIKA: RAPORTY
    // ==========================================

    const obslugaRaportow = () => {
        const $filterInput = $('#filter_subject');
        if ($filterInput.length === 0 || $('#tcm-report-filters').length > 0) return;

        let html = '<div id="tcm-report-filters" class="tcm-panel">';
        html += '<span style="font-weight:bold; margin-right:5px; color: var(--title-color);">Filtruj:</span>';

        USTAWIENIA.raporty_tagi.forEach(s => {
            html += `<button type="button" class="tcm-btn tcm-report-tag" data-tag="${s.tag}">${s.label}</button>`;
        });

        html += `<button type="button" class="tcm-btn tcm-report-tag" data-tag="" style="color: #ff4d4d;">[X] Wyczyść</button></div>`;

        $filterInput.closest('form').before(html);

        $('.tcm-report-tag').on('click', function(e) {
            e.preventDefault();
            const tag = $(this).data('tag');
            $filterInput.val(tag);
            $filterInput.closest('form').find('input[type="submit"]').click();
        });
    };

    // ==========================================
    //                 INICJALIZACJA
    // ==========================================
    
    wstrzyknijCSS();

    const url = window.location.href;
    setTimeout(() => {
        if (url.includes('screen=overview_villages')) {
            obslugaKomend();
        } else if (url.includes('screen=report')) {
            obslugaRaportow();
        }
    }, 400);

})();
