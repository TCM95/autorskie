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
            .tcm-btn:hover { background: var(--btn-hover); }
            
            #tcm-floating-ui {
                position: absolute;
                top: 80px;
                left: 20px;
                z-index: 999999;
                background: var(--bg-main);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.5);
                width: max-width;
                max-width: 90vw;
            }
            #tcm-floating-header {
                background: var(--bg-header);
                padding: 4px 6px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
                font-size: 12px;
                color: var(--title-color);
                font-weight: bold;
                user-select: none;
            }
            #tcm-floating-content {
                padding: 6px;
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                align-items: center;
            }
            .tcm-pin {
                background: none !important;
                border: none !important;
                cursor: pointer;
                font-size: 12px !important;
                width: 20px !important;
                height: 20px !important;
                min-width: 20px !important;
                min-height: 20px !important;
                max-width: 20px !important;
                max-height: 20px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 0 0 20px !important;
                padding: 0 !important;
                margin: 0 !important;
                filter: grayscale(1);
                transition: filter 0.2s;
            }
            .tcm-pin.active { filter: grayscale(0); }
            .tcm-filter-img {
                cursor: pointer; width: 22px; filter: grayscale(1.0);
                border: 2px solid var(--border-color); padding: 2px; border-radius: 4px;
            }
        `;
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
    };

    // ==========================================
    //           LOGIKA PRZESUWANEGO UI
    // ==========================================
    const dodajPrzesuwaneUI = (storageKey) => {
        if ($(`#tcm-floating-ui`).length > 0) return $('#tcm-floating-content');

        const html = `
            <div id="tcm-floating-ui">
                <div id="tcm-floating-header">
                    <span>Filtry</span>
                    <button type="button" class="tcm-pin" title="Przypnij pozycję">📌</button>
                </div>
                <div id="tcm-floating-content"></div>
            </div>
        `;
        $('body').append(html);

        const el = document.getElementById('tcm-floating-ui');
        const header = document.getElementById('tcm-floating-header');
        const pinBtn = el.querySelector('.tcm-pin');
        
        let isPinned = localStorage.getItem(`${storageKey}_pinned`) === 'true';
        let savedPos = localStorage.getItem(`${storageKey}_pos`);
        
        if (savedPos) {
            try {
                let pos = JSON.parse(savedPos);
                el.style.top = pos.top;
                el.style.left = pos.left;
            } catch(e) {}
        }

        const updatePin = () => {
            if (isPinned) pinBtn.classList.add('active');
            else pinBtn.classList.remove('active');
        };
        updatePin();

        pinBtn.onclick = (e) => {
            e.stopPropagation();
            isPinned = !isPinned;
            localStorage.setItem(`${storageKey}_pinned`, isPinned);
            updatePin();
        };

        let startX = 0, startY = 0, initialLeft = 0, initialTop = 0, isDragging = false;
        
        const dragStart = (e) => {
            if (isPinned || e.target === pinBtn || $(e.target).closest('.tcm-pin').length > 0) return;
            if (e.cancelable) e.preventDefault();
            
            isDragging = true;
            let evt = e.type.includes('touch') ? e.touches[0] : e;
            
            startX = evt.pageX;
            startY = evt.pageY;
            
            initialLeft = el.offsetLeft;
            initialTop = el.offsetTop;

            document.addEventListener('mousemove', dragMove);
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchend', dragEnd);
        };

        const dragMove = (e) => {
            if (!isDragging || isPinned) return;
            if (e.cancelable) e.preventDefault();
            
            let evt = e.type.includes('touch') ? e.touches[0] : e;
            let dx = evt.pageX - startX;
            let dy = evt.pageY - startY;
            
            el.style.left = (initialLeft + dx) + "px";
            el.style.top = (initialTop + dy) + "px";
        };

        const dragEnd = () => {
            if (!isDragging) return;
            isDragging = false;

            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchend', dragEnd);

            localStorage.setItem(`${storageKey}_pos`, JSON.stringify({ top: el.style.top, left: el.style.left }));
        };

        header.addEventListener('mousedown', dragStart);
        header.addEventListener('touchstart', dragStart, { passive: false });

        return $('#tcm-floating-content');
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

        const $content = dodajPrzesuwaneUI('tcm_komendy_ui');

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
            if (active.length === 0) { $(table).find('tr').show(); return; }

            let colRam = getUnitCol('ram'), colSpy = getUnitCol('spy'), colCat = getUnitCol('catapult');
            let unitCols = [];
            $(table.rows[0].cells).each((i, cell) => { if ($(cell).find('img[src*="/unit/unit_"]').length > 0) unitCols.push(i); });

            let toTag = [];

            for (let i = 1; i < table.rows.length; i++) {
                let row = table.rows[i], $row = $(row);
                if ($row.hasClass('all_unit_container') || $row.find('th').length > 0) continue;

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
        if ($filterInput.length === 0) return;

        const $content = dodajPrzesuwaneUI('tcm_raporty_ui');

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
