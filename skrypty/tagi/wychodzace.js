// ==UserScript==
// @name         Filtry i Tagger
// @namespace    https://viayoo.com/
// @description  Filtrowanie raportów oraz tagowanie komend (bez pływającego UI)
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
        komendy_filtry: [
            { id: 'snob',   img: 'command/snob.png',          tag: '[GRUBY]',  hint: 'szlachcica',  type: 'icon', enabled: false },
            { id: 'large',  img: 'command/attack_large.png',  tag: '[OFF]',    hint: 'Duży atak',   type: 'icon', enabled: false },
            { id: 'medium', img: 'command/attack_medium.png', tag: '[OFF]',    hint: 'Średni atak', type: 'icon', enabled: false },
            { id: 'fejk',   img: 'command/attack_small.png',  tag: '[FEJK]',   label: 'FEJK (1-10 T / 1-20 K)', type: 'unit_logic', enabled: false },
            { id: 'zwiad',  img: 'unit/unit_spy.png',         tag: '[ZWIAD]',  label: 'ZWIAD (5+ SAM)', type: 'unit_logic', enabled: false },
            { id: 'burzak', img: 'unit/unit_catapult.png',    tag: '[BURZAK]', label: 'BURZAK',     type: 'unit_logic', enabled: false }
        ],
        komendy_reczne: ['[KLIN]', '[KONTRA]', '[ODBITKA]'],
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
                background: var(--btn-bg) !important;
                color: var(--text-color) !important;
                border: 1px solid var(--border-color) !important;
                cursor: pointer !important;
                padding: 4px 8px !important;
                border-radius: 4px !important;
                font-weight: bold !important;
                font-size: 11px !important;
                margin: 0 !important;
                white-space: nowrap !important;
                display: inline-block !important;
            }
            .tcm-btn:hover { background: var(--btn-hover) !important; }
            
            .tcm-filter-img {
                cursor: pointer; 
                width: 20px; 
                height: 20px;
                filter: grayscale(1.0);
                border: 2px solid var(--border-color); 
                padding: 2px; 
                border-radius: 4px;
                background: var(--bg-main);
                box-sizing: content-box;
                display: block;
            }
            
            .tcm-horizontal-container {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 6px !important;
                margin-top: 4px !important;
                margin-bottom: 4px !important;
                width: 100% !important;
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
        const imgBase = window.image_base || '/graphic/';

        // Wszczepienie kontenera w nagłówek tabeli
        const $headerCell = $(table).find('tr:first-child th').first();
        if ($headerCell.length === 0) return;
        
        $headerCell.append('<div id="tcm-komendy-filtry" class="tcm-horizontal-container"></div>');
        const $content = $('#tcm-komendy-filtry');

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

                setTimeout(() => { $input.closest('span, div, td').find('input[type="button"], .btn-ok, button').click(); }, 100);
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
                                clearInterval(check); resolve();
                            }
                        }, 100);
                    });
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            isMassTagging = false;
        }

        function runLogic() {
            let active = filters.filter(f => f.enabled);
            if (active.length === 0) { 
                $(table).find('tr').show(); 
                return; 
            }

            let colRam = getUnitCol('ram'), colSpy = getUnitCol('spy'), colCat = getUnitCol('catapult');
            let unitCols = [];
            $(table.rows[0].cells).each((i, cell) => { if ($(cell).find('img[src*="/unit/unit_"]').length > 0) unitCols.push(i); });

            let toTag = [];

            for (let i = 1; i < table.rows.length; i++) {
                let row = table.rows[i], $row = $(row);
                if ($row.hasClass('all_unit_container') || $row.find('th').length > 0) continue;
                if ($row.find('span.own_command').length === 0 && $row.find('span.command_hover_details').length === 0) continue;

                let rams = colRam !== -1 ? (parseInt(row.cells[colRam].innerText) || 0) : 0;
                let spies = colSpy !== -1 ? (parseInt(row.cells[colSpy].innerText) || 0) : 0;
                let cats = colCat !== -1 ? (parseInt(row.cells[colCat].innerText) || 0) : 0;
                let others = 0;
                unitCols.forEach(idx => { if (idx !== colSpy) others += (parseInt(row.cells[idx].innerText) || 0); });

                let hints = $row.find('span.own_command').map(function() { return ($(this).attr('data-icon-hint') || "").toLowerCase(); }).get();
                let shouldShow = false, rowTag = "";

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

        filters.forEach(f => {
            let img$ = $('<img>', {
                src: `${imgBase}${f.img}`,
                class: 'tcm-filter-img',
                title: f.label || f.hint
            });
            img$.on('click', function() {
                f.enabled = !f.enabled;
                $(this).css(f.enabled ? { 'filter': 'grayscale(0.0)', 'border-color': '#00ff00' } : { 'filter': 'grayscale(1.0)', 'border-color': 'var(--border-color)' });
                runLogic();
            });
            $content.append(img$);
        });

        // Wstawianie ręcznych tagów bezpośrednio pod nazwą wioski w rzędach
        $(table).find('tr.nowrap').each(function() {
            const $cell = $(this).find('td:first');
            let html = '<div class="tcm-horizontal-container" style="margin-top:2px; gap:2px !important;">';
            USTAWIENIA.komendy_reczne.forEach(t => {
                html += `<button type="button" class="tcm-btn" style="font-size: 9px !important; padding: 2px 4px !important;">${t.replace('[','').replace(']','')}</button>`;
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
        if ($filterInput.length === 0) return;

        // Kontener nad polem wyszukiwania - gwarantowany poziomy układ
        $filterInput.before('<div id="tcm-raporty-filtry" class="tcm-horizontal-container"></div>');
        const $content = $('#tcm-raporty-filtry');

        USTAWIENIA.raporty_tagi.forEach(s => {
            const btn = $(`<button type="button" class="tcm-btn" data-tag="${s.tag}">${s.label}</button>`);
            btn.on('click', function(e) {
                e.preventDefault();
                $filterInput.val(s.tag);
                $filterInput.closest('form').find('input[type="submit"]').click();
            });
            $content.append(btn);
        });

        const clearBtn = $(`<button type="button" class="tcm-btn" style="color: #ff4d4d;">[X] Wyczyść</button>`);
        clearBtn.on('click', function(e) {
            e.preventDefault();
            $filterInput.val('');
            $filterInput.closest('form').find('input[type="submit"]').click();
        });
        $content.append(clearBtn);
    };

    // ==========================================
    //                 INICJALIZACJA
    // ==========================================
    wstrzyknijCSS();

    const url = window.location.href;
    setTimeout(() => {
        if (url.includes('screen=overview_villages') && url.includes('mode=commands')) {
            obslugaKomend();
        } else if (url.includes('screen=report')) {
            obslugaRaportow();
        }
    }, 400);

})();
