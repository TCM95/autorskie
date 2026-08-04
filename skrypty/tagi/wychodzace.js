// ==UserScript==
// @name         Tagger + Filtry(wychodzące)
// @namespace    plemiona.pl
// @namespace    https://viayoo.com/
// @description  Filtrowanie + Tagowanie. Fejk 1-10T/1-20K, Zwiad 5+ SAMI.
// @author       Gal Anonim
// @match        *://*.plemiona.pl/game.php?*screen=overview_villages*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let filters = [
        { id: 'snob',   img: 'command/snob.webp',          tag: '[GRUBY]', hint: 'szlachcica',  type: 'icon', enabled: false },
        { type: 'spacer' },
        { id: 'large',  img: 'command/attack_large.webp',  tag: '[OFF]',   hint: 'Duży atak',   type: 'icon', enabled: false },
        { id: 'medium', img: 'command/attack_medium.webp', tag: '[OFF]',   hint: 'Średni atak', type: 'icon', enabled: false },
        { id: 'fejk',   img: 'command/attack_small.webp',  tag: '[FEJK]',  label: 'FEJK (1-10 T / 1-20 K)', type: 'unit_logic', enabled: false },
        { type: 'spacer' },
        { id: 'zwiad',  img: 'unit/unit_spy.png',          tag: '[ZWIAD]', label: 'ZWIAD (5+ SAM)', type: 'unit_logic', enabled: false },
        { id: 'burzak', img: 'unit/unit_catapult.png',     tag: '[BURZAK]', label: 'BURZAK',     type: 'unit_logic', enabled: false }
    ];

    let pendingTag = null;
    let isMassTagging = false;
    const table = $('#commands_table')[0];
    if (!table) return;

    function getUnitCol(unit) {
        let idx = -1;
        $(table.rows[0].cells).each((i, cell) => {
            if ($(cell).find(`img[src*="unit_${unit}"]`).length > 0) idx = i;
        });
        return idx;
    }

    // OBSERVER - Czeka na pojawienie się pola tekstowego po kliknięciu rename-icon
    const observer = new MutationObserver(() => {
        const $input = $('.quickedit-edit input[type="text"], input[type="text"].edit-label');
        if ($input.length > 0 && pendingTag !== null) {
            let currentVal = $input.val();
            let tag = pendingTag;
            let newName = currentVal.replace(/(Atak na|Zaplanowany atak na|Atak on)/gi, tag);
            if (newName === currentVal) newName = tag + " " + currentVal;

            $input.val(newName.trim());
            pendingTag = null;

            setTimeout(() => {
                $input.closest('span, div, td').find('input[type="button"], .btn-ok, button').click();
            }, 100);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Funkcja kolejkująca - klika edycję wiersz po wierszu
    async function processQueue(targets) {
        if (isMassTagging) return;
        isMassTagging = true;

        for (let item of targets) {
            let $label = item.$row.find('.quickedit-label');
            // Jeśli już ma tag, pomiń
            if ($label.text().includes(item.tag)) continue;

            pendingTag = item.tag;
            let $editBtn = item.$row.find('.rename-icon');

            if ($editBtn.length > 0) {
                $editBtn.click();
                // Czekaj aż okno edycji zostanie obsłużone przez observera i zniknie
                await new Promise(resolve => {
                    let check = setInterval(() => {
                        if (pendingTag === null && $('.quickedit-edit').length === 0) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                });
                await new Promise(r => setTimeout(r, 100)); // Delikatny delay serwerowy
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
                    // Logika: Musi być przynajmniej 1 maszyna oblężnicza, max 10 taranów i max 20 katapult.
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

    // Budowanie UI
    let th$ = $(table.rows[0].cells[0]);
    filters.forEach(f => {
        if (f.type === 'spacer') {
            th$.append('<span style="margin-left: 10px; border-left: 1px solid #999; padding-left: 4px;"></span>');
            return;
        }
        let img$ = $('<img>', {
            src: `https://dspl.innogamescdn.com/asset/2fe6656b/graphic/${f.img}`,
            style: 'cursor:pointer; margin-left: 4px; filter: grayscale(1.0); width: 16px; vertical-align: middle; border: 2px solid #333; padding: 1px; border-radius: 3px;',
            title: f.label || f.hint // Dodano podpowiedź po najechaniu myszką
        });
        img$.on('click', function() {
            f.enabled = !f.enabled;
            $(this).css(f.enabled ? { 'filter': 'grayscale(0.0)', 'border-color': '#00ff00', 'box-shadow': '0 0 5px #00ff00' } : { 'filter': 'grayscale(1.0)', 'border-color': '#333', 'box-shadow': 'none' });
            runLogic();
        });
        th$.append(img$);
    });

    // Przyciski manualne
    const manualTags = ['[KLIN]', '[KONTRA]', '[ODBITKA]'];
    $(table).find('tr.nowrap').each(function() {
        const $cell = $(this).find('td:first');
        let html = '<div style="display:flex; gap:2px; margin-top:3px;">';
        manualTags.forEach(t => {
            html += `<button type="button" class="btn" style="padding:0 3px; font-size:9px; cursor:pointer;">${t.replace('[','').replace(']','')}</button>`;
        });
        html += '</div>';
        const $btns = $(html);
        $btns.find('button').on('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            pendingTag = $(this).text() === 'KLIN' ? '[KLIN]' : ($(this).text() === 'KONTRA' ? '[KONTRA]' : '[ODBITKA]');
            $(this).closest('tr').find('.rename-icon').click();
        });
        $cell.append($btns);
    });
})();
