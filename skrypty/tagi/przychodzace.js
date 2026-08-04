// ==UserScript==
// @name         przychodzące tagi
// @namespace    https://viayoo.com/
// @author       TCM
// @description  Oznaczanie ataków z mobilnym edytorem UI, rozwijanym menu tagów i pełnym kolorowaniem wierszy.
// @match        https://*.plemiona.pl/game.php*screen=overview_villages*mode=incomings*
// @match        *://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (typeof $ === "undefined") return;

    const STORAGE_KEY = 'tcm_tagger_settings';
    const PIN_KEY = 'tcm_tagger_pinned';
    const POS_KEY = 'tcm_tagger_pos';

    const defaultSettings = {
        fontSize: 10,
        buttons: [
            { tag: '[Wioska OFF]', label: 'W.OFF', bgColor: '#d3790a' },
            { tag: '[OFF]', label: 'OFF', bgColor: '#ff1a1a' },
            { tag: '[Wioska DEFF]', label: 'W.D.DEFF', bgColor: '#228c05' },
            { tag: '[BURZAK]', label: 'BURZAK', bgColor: '#4f5b66' },
            { tag: '[KLIN]', label: 'KLIN', bgColor: '#ba55d3' },
            { tag: '[ODBITKA]', label: 'ODB', bgColor: '#ff69b4' },
            { tag: '[FEJK]', label: 'FEJ', bgColor: '#dbdbdb' },
            { tag: '[FEJK OFF]', label: 'F.OFF', bgColor: '#fbc02d' },
            { tag: '[FEJK DEFF]', label: 'F.DEFF', bgColor: '#0288d1' }
        ]
    };

    let cfg = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultSettings;
    let isPinned = localStorage.getItem(PIN_KEY) === 'true';
    let savedPos = JSON.parse(localStorage.getItem(POS_KEY)) || { top: '60px', left: '10px' };
    let activeRow = null;

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    }

    // --- GLOBALNY POPOVER Z TAGAMI ---
    function buildGlobalPopover() {
        if ($('#tcm-global-popover').length) return;
        
        let html = `<div id="tcm-global-popover" style="display:none; position:absolute; z-index:999999; background:#f4e4c1; border:2px solid #8b5a2b; padding:4px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.6); width:200px; gap:3px; flex-wrap:wrap;">`;
        cfg.buttons.forEach(b => {
            html += `<button type="button" class="btn tcm-tag-btn" data-tag="${b.tag}" 
                     style="background:${b.bgColor}; color:#ffffff; font-size:${cfg.fontSize}px; font-weight:bold; padding:3px 6px; text-shadow:1px 1px 2px #000; border:1px solid rgba(0,0,0,0.5);">
                     ${b.label}</button>`;
        });
        html += `</div>`;
        $('body').append(html);
    }

    // Wstrzykujemy małe przyciski do tabeli
    function injectTagTriggers() {
        const targets = $('#incomings_table tr.nowrap, #commands_incomings .command-row');
        targets.each(function() {
            let td = $(this).find('td').eq(0);
            if (td.find('.tcm-trigger-btn').length === 0) {
                let triggerBtn = `<button type="button" class="btn tcm-trigger-btn" style="padding:1px 4px; font-size:11px; margin-left:5px; cursor:pointer;" title="Otwórz tagi">🏷️</button>`;
                td.append(triggerBtn);
            }
        });
        colorRows();
    }

    // Kolorowanie CAŁYCH WIERSZY na podstawie najwyższego indeksu tagu
    function colorRows() {
        $('#incomings_table tr.nowrap, #commands_incomings .command-row').each(function() {
            let row = $(this);
            let name = $.trim(row.find('.quickedit-label').text());
            
            let bestIdx = -1;
            let finalColor = null;

            for (let b of cfg.buttons) {
                let idx = name.lastIndexOf(b.tag);
                if (idx > bestIdx) {
                    bestIdx = idx;
                    finalColor = b.bgColor;
                }
            }

            // Kolorujemy wszystkie komórki <td> w danym wierszu
            if (finalColor) {
                row.find('td').css('background-color', finalColor);
            } else {
                row.find('td').css('background-color', '');
            }
        });
    }

    // Otwieranie / pozycjonowanie globalnej chmurki tagów
    $(document).on('click', '.tcm-trigger-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        let trigger = $(this);
        activeRow = trigger.closest('tr');
        let popover = $('#tcm-global-popover');
        
        if (popover.is(':visible') && popover.data('current-trigger') === this) {
            popover.hide();
            return;
        }
        
        popover.data('current-trigger', this);
        
        let offset = trigger.offset();
        popover.css({ display: 'flex', top: '-9999px', left: '-9999px' });
        
        let popHeight = popover.outerHeight();
        let popWidth = popover.outerWidth();
        let winHeight = $(window).height();
        let winWidth = $(window).width();
        let scrollTop = $(window).scrollTop();
        
        let topPos;
        if (offset.top - scrollTop + trigger.outerHeight() + popHeight + 10 > winHeight) {
            topPos = offset.top - popHeight - 5; 
        } else {
            topPos = offset.top + trigger.outerHeight() + 5;
        }

        let leftPos = offset.left;
        if (leftPos + popWidth > winWidth) {
            leftPos = winWidth - popWidth - 10;
        }

        popover.css({ top: topPos + 'px', left: leftPos + 'px' });
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('#tcm-global-popover, .tcm-trigger-btn, #tcm-editor, #tcm-settings-btn').length) {
            $('#tcm-global-popover').hide();
        }
    });

    $(document).on('click', '.tcm-tag-btn', function(e) {
        e.preventDefault();
        if (!activeRow) return;

        let toAdd = $(this).attr('data-tag');
        let quickedit = activeRow.find('.quickedit');
        let renameIcon = quickedit.find('.rename-icon');
        
        if (renameIcon.length && renameIcon.is(':visible')) {
            renameIcon.click();
        }

        setTimeout(() => {
            let input = quickedit.find('input[type=text]');
            let current = input.val();
            if (!current.includes(toAdd)) {
                input.val(current + ' ' + toAdd);
            }
            quickedit.find('input[type=button]').click();
            setTimeout(colorRows, 200);
            $('#tcm-global-popover').hide();
        }, 150);
    });

    // --- PŁYWAJĄCY EDYTOR UI ---
    function buildEditorWindow() {
        if ($('#tcm-editor').length) return;

        let editorHTML = `
        <div id="tcm-editor" style="display:none; position:fixed; top:${savedPos.top}; left:${savedPos.left}; width:300px; background:#e3d5b6; border:2px solid #603000; z-index:999999; border-radius:5px; box-shadow:0 5px 15px rgba(0,0,0,0.6);">
            <div id="tcm-header" style="background:#8b5a2b; color:white; padding:6px; cursor:${isPinned ? 'default' : 'move'}; font-weight:bold; display:flex; justify-content:space-between; align-items:center; user-select:none;">
                <span>⚙️ Ustawienia Taggera</span>
                <div>
                    <span id="tcm-pin" style="cursor:pointer; font-size:14px; padding:0 5px;" title="Przypnij">📌</span>
                    <span id="tcm-close-editor" style="cursor:pointer; font-size:14px; padding:0 5px; color:#ff4d4d;" title="Zamknij">✖</span>
                </div>
            </div>
            <div id="tcm-body" style="padding:10px; max-height:60vh; overflow-y:auto;">
                <label style="font-size:12px; font-weight:bold;">Wielkość czcionki (px): 
                    <input type="number" id="tcm-font" value="${cfg.fontSize}" style="width:45px; padding:2px;">
                </label>
                <hr style="border-color:#603000; margin: 8px 0;">
                <div style="display:flex; font-size:10px; font-weight:bold; margin-bottom:5px; text-align:center;">
                    <span style="flex:1;">Poz.</span>
                    <span style="flex:2;">Wzór/Tag</span>
                    <span style="flex:2;">Przycisk</span>
                    <span style="flex:1;" title="Kolor Tła">Tło</span>
                    <span style="flex:1;">Usuń</span>
                </div>
                <div id="tcm-btn-list" style="overflow-x:hidden;"></div>
                <button id="tcm-add-btn" class="btn" style="width:100%; margin-top:10px; background:#4caf50; color:white;">➕ Dodaj nowy</button>
                <button id="tcm-save" class="btn" style="width:100%; margin-top:5px; background:#2196f3; color:white;">💾 Zapisz i Odśwież</button>
            </div>
        </div>`;

        $('body').append(editorHTML);
        renderEditorButtons();
        setupDragLogic();
        updatePinVisuals();

        $('#tcm-close-editor').on('click', () => $('#tcm-editor').hide());

        $('#tcm-pin').on('click', function() {
            isPinned = !isPinned;
            localStorage.setItem(PIN_KEY, isPinned);
            updatePinVisuals();
        });

        $('#tcm-add-btn').on('click', function() {
            let newRow = createEditorRow({ tag: '[NOWY]', label: 'NOWY', bgColor: '#000000' });
            $('#tcm-btn-list').append(newRow);
        });

        $('#tcm-btn-list').on('click', '.tcm-del-btn', function() {
            $(this).closest('.tcm-edit-row').remove();
        });

        $('#tcm-btn-list').on('click', '.tcm-up-btn', function() {
            let row = $(this).closest('.tcm-edit-row');
            row.prev('.tcm-edit-row').before(row);
        });

        $('#tcm-btn-list').on('click', '.tcm-down-btn', function() {
            let row = $(this).closest('.tcm-edit-row');
            row.next('.tcm-edit-row').after(row);
        });

        $('#tcm-save').on('click', function() {
            cfg.fontSize = parseInt($('#tcm-font').val()) || 10;
            cfg.buttons = [];
            
            $('.tcm-edit-row').each(function() {
                let tagVal = $.trim($(this).find('.tcm-tag-val').val());
                let labelVal = $.trim($(this).find('.tcm-label-val').val());
                let bgVal = $(this).find('.tcm-col-bg').val();
                
                if (tagVal && labelVal) {
                    cfg.buttons.push({ tag: tagVal, label: labelVal, bgColor: bgVal });
                }
            });
            
            saveConfig();
            location.reload();
        });
    }

    function createEditorRow(b) {
        return `
        <div class="tcm-edit-row" style="display:flex; gap:2px; margin-bottom:5px; align-items:center;">
            <div style="flex:1; display:flex; flex-direction:column; gap:1px;">
                <button class="btn tcm-up-btn" style="padding:0px 2px; font-size:9px; background:#ccc; border:1px solid #999;">▲</button>
                <button class="btn tcm-down-btn" style="padding:0px 2px; font-size:9px; background:#ccc; border:1px solid #999;">▼</button>
            </div>
            <input type="text" class="tcm-tag-val" value="${b.tag}" placeholder="Tag" style="flex:2; width:0; padding:2px; font-size:11px;">
            <input type="text" class="tcm-label-val" value="${b.label}" placeholder="Napis" style="flex:2; width:0; padding:2px; font-size:11px;">
            <input type="color" class="tcm-col-bg" value="${b.bgColor}" title="Kolor tła" style="flex:1; width:22px; padding:0; border:none; height:24px; cursor:pointer;">
            <button class="btn tcm-del-btn" style="flex:1; background:#f44336; color:white; padding:2px; font-weight:bold;">X</button>
        </div>`;
    }

    function renderEditorButtons() {
        let listHTML = '';
        cfg.buttons.forEach(b => listHTML += createEditorRow(b));
        $('#tcm-btn-list').html(listHTML);
    }

    function updatePinVisuals() {
        let pinBtn = document.getElementById('tcm-pin');
        let header = document.getElementById('tcm-header');
        if(isPinned) {
            pinBtn.innerText = '🔴';
            pinBtn.style.opacity = '1';
            header.style.cursor = 'default';
        } else {
            pinBtn.innerText = '📌';
            pinBtn.style.opacity = '0.5';
            header.style.cursor = 'move';
        }
    }

    function setupDragLogic() {
        let editor = document.getElementById('tcm-editor');
        let header = document.getElementById('tcm-header');
        let isDragging = false, startX, startY, initX, initY;

        const startDrag = (e) => {
            if (isPinned || e.target.id === 'tcm-pin' || e.target.id === 'tcm-close-editor') return;
            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initX = editor.offsetLeft;
            initY = editor.offsetTop;
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            editor.style.left = (initX + clientX - startX) + 'px';
            editor.style.top = (initY + clientY - startY) + 'px';
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                localStorage.setItem(POS_KEY, JSON.stringify({ top: editor.style.top, left: editor.style.left }));
            }
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        
        header.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    function injectHeaderTrigger() {
        let th = $('#incomings_table th').eq(0);
        if(th.length === 0) th = $('#commands_incomings th').eq(0);
        
        if(th.length > 0 && th.find('#tcm-settings-btn').length === 0) {
            let settingsBtn = $(`<button id="tcm-settings-btn" style="background:#ffeb3b; color:#000; font-weight:bold; border:1px solid #a3821a; padding:2px 6px; border-radius:3px; cursor:pointer; margin-left:10px; font-size:10px;">🏷️ TAGGER</button>`);
            th.append(settingsBtn);

            settingsBtn.on('click', function(e) {
                e.preventDefault();
                $('#tcm-editor').toggle();
            });
        }
    }

    setTimeout(() => {
        buildGlobalPopover();
        buildEditorWindow();
        injectTagTriggers();
        injectHeaderTrigger();
    }, 1000);

})();
