// ==UserScript==
// @name         udostepnianie komend
// @author       TCM
// @namespace    https://viayoo.com/
// @match        *://*.plemiona.pl/game.php*screen=settings*mode=command_sharing*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const storageRada = 'TCM_Lista_Rada';

    function init() {
        const $ = win.jQuery;
        if (!$) return;

        const targetTable = $('table.vis').has('input[name="share[]"]').first();
        if (!targetTable.length || $('#tcm_trigger_btn').length) return;

        const triggerBtn = `<div style="margin: 10px 0;"><button id="tcm_trigger_btn" class="btn" style="padding: 10px 20px; font-weight: bold;">UDOSTĘPNIJ KOMENDY</button></div>`;
        targetTable.before(triggerBtn);

        $('#tcm_trigger_btn').on('click', (e) => { e.preventDefault(); showMainUI(); });
    }

    function showMainUI() {
        const $ = win.jQuery;
        if ($('#tcm_ui_overlay').length) return;

        const savedRada = localStorage.getItem(storageRada) || "";
        let savedPos = JSON.parse(localStorage.getItem('TCM_ShareUI_Pos'));

        let initialTop = savedPos ? savedPos.top : '10%';
        let initialLeft = savedPos ? savedPos.left : '5%';

        const uiHtml = `
            <div id="tcm_ui_overlay" style="position:fixed; top:${initialTop}; left:${initialLeft}; width:90%; max-width:400px; background:#e3d5b3; border:2px solid #7d510f; z-index:30000; border-radius:5px; box-shadow: 0 0 20px rgba(0,0,0,0.8); box-sizing:border-box; overflow:hidden;">
                
                <!-- Pasek górny (Drag & Drop) -->
                <div id="tcm-drag-handle" style="background:#c1a264; padding:8px 10px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #7d510f; cursor:move; user-select:none;">
                    <span>Udostępnianie Komend</span>
                    <div>
                        <span id="tcm-pin-btn" style="cursor:pointer; opacity:${savedPos ? '1' : '0.4'}; font-size:14px; margin-right:10px;" title="Przypnij pozycję">📌</span>
                        <span id="tcm-close-btn" style="cursor:pointer; color:#8b0000; font-size:14px; font-weight:bold;" title="Zamknij">✖</span>
                    </div>
                </div>

                <div style="padding:15px; overflow-y:auto; max-height:85vh;">
                    <div style="margin-bottom:10px; padding:10px; border:1px solid #7d510f; background:#f4e4bc;">
                        <label style="font-weight:bold; display:block; margin-bottom:5px;">GRACZE (Tymczasowi):</label>
                        <textarea id="tcm_input_gracze" style="width:100%; height:60px; margin-bottom:10px;"></textarea>
                        <div style="display:flex; gap:10px;">
                            <button id="tcm_btn_add" class="btn" style="flex:1; background:#218838 !important; color:white !important;">DODAJ</button>
                            <button id="tcm_btn_replace" class="btn" style="flex:1; background:#c82333 !important; color:white !important;">PODMIEŃ</button>
                        </div>
                    </div>

                    <div style="margin-bottom:10px; padding:10px; border:1px solid #7d510f; background:#f4e4bc;">
                        <label style="font-weight:bold; display:block; margin-bottom:5px;">RADA (Na stałe):</label>
                        <textarea id="tcm_input_rada" style="width:100%; height:60px; margin-bottom:10px;">${savedRada}</textarea>
                        <button id="tcm_btn_save_rada" class="btn" style="width:100%; font-weight:bold;">ZAPISZ RADĘ I UDOSTĘPNIJ</button>
                    </div>

                    <div id="tcm_missing_section" style="display:none; margin-bottom:10px; padding:10px; border:2px solid #c82333; background:#ffdada;">
                        <label style="font-weight:bold; color:#c82333; display:block; margin-bottom:5px;">BRAKUJĄCE ZAPROSZENIA:</label>
                        <div id="tcm_missing_list" style="display:flex; flex-wrap:wrap; gap:5px;"></div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(uiHtml);
        setupDraggableAndPin($('#tcm_ui_overlay')[0]);

        $('#tcm_btn_save_rada').on('click', () => {
            localStorage.setItem(storageRada, $('#tcm_input_rada').val());
            win.UI.InfoMessage("Rada zapisana. Sprawdzam tabelę...", 2000, "success");
            processSharing(false);
        });

        $('#tcm_btn_add').on('click', () => processSharing(false));
        $('#tcm_btn_replace').on('click', () => processSharing(true));
        $('#tcm-close-btn').on('click', () => $('#tcm_ui_overlay').remove());
    }

    function setupDraggableAndPin(ui) {
        const handle = document.getElementById('tcm-drag-handle');
        const pinBtn = document.getElementById('tcm-pin-btn');
        let isDragging = false, startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if(e.target === pinBtn || e.target.id === 'tcm-close-btn') return;
            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initialX = ui.offsetLeft;
            initialY = ui.offsetTop;
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let dx = clientX - startX;
            let dy = clientY - startY;
            ui.style.left = (initialX + dx) + 'px';
            ui.style.top = (initialY + dy) + 'px';
        };

        const stopDrag = () => { isDragging = false; };

        handle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        handle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);

        pinBtn.addEventListener('click', () => {
            let saved = localStorage.getItem('TCM_ShareUI_Pos');
            if (saved) {
                localStorage.removeItem('TCM_ShareUI_Pos');
                pinBtn.style.opacity = '0.4';
            } else {
                localStorage.setItem('TCM_ShareUI_Pos', JSON.stringify({top: ui.style.top, left: ui.style.left}));
                pinBtn.style.opacity = '1';
            }
        });
    }

    function processSharing(shouldReplace) {
        const $ = win.jQuery;

        // Ulepszony parser - ignoruje cudzysłowy i nawiasy ułatwiając wklejanie formy ze skryptów
        const clean = (str) => {
            let cleanedStr = str.replace(/[\[\]"']/g, ''); 
            return cleanedStr.split(/[,;\n]/).map(n => n.trim()).filter(n => n !== "");
        };

        const radaList = clean($('#tcm_input_rada').val());
        const graczeList = clean($('#tcm_input_gracze').val());
        const totalList = [...new Set([...radaList, ...graczeList])];

        if (totalList.length === 0 && !shouldReplace) {
            win.UI.InfoMessage("Listy są puste!", 3000, "error");
            return;
        }

        const foundInTable = [];
        let markedCount = 0;

        if (shouldReplace) $('input[name="share[]"]').prop('checked', false);

        const totalListLower = totalList.map(n => n.toLowerCase());

        $('table.vis tr').has('input[name="share[]"]').each(function() {
            const nickInTable = $(this).find('td:first').text().trim();
            const nickInTableLower = nickInTable.toLowerCase();

            const index = totalListLower.indexOf(nickInTableLower);
            if (index !== -1) {
                $(this).find('input[name="share[]"]').prop('checked', true);
                $(this).css('background', '#00ff4d');
                foundInTable.push(totalList[index]);
                markedCount++;
            }
        });

        const foundInTableLower = foundInTable.map(n => n.toLowerCase());
        const missing = totalList.filter(n => !foundInTableLower.includes(n.toLowerCase()));

        if (missing.length > 0) {
            showMissingInvites(missing);
        } else if (markedCount > 0) {
            saveChanges();
        }
    }

    function showMissingInvites(missing) {
        const $ = win.jQuery;
        $('#tcm_missing_section').show();
        const listContainer = $('#tcm_missing_list').empty();

        missing.forEach(nick => {
            const btn = $(`<button class="btn" style="font-size:10px; background:#c82333 !important; color:white !important; cursor:pointer; padding:5px 10px;">Dodaj ${nick}</button>`);
            btn.on('click', function() { sendInvite(nick, $(this)); });
            listContainer.append(btn);
        });
    }

    function sendInvite(nick, buttonElement) {
        const $ = win.jQuery;
        const url = win.TribalWars.buildURL('POST', 'buddies', { action: 'add_buddy' });
        const h = url.substring(url.indexOf("h=") + 2);
        const cleanUrl = url.substring(0, url.indexOf("h=") - 1);

        $.post(cleanUrl, { name: nick, h: h }, function() {
            win.UI.InfoMessage(`Zaproszono: ${nick}`, 2000, "success");
            buttonElement.fadeOut(300, function() {
                $(this).remove();
                if ($('#tcm_missing_list').children().length === 0) $('#tcm_missing_section').hide();
            });
        });
    }

    function saveChanges() {
        const $ = win.jQuery;
        setTimeout(() => {
            $('form').has('input[name="share[]"]').find('input[type="submit"]').first().click();
        }, 500);
    }

    setInterval(init, 1000);
})();
