// ==UserScript==
// @name         Udostępnianie Komend
// @namespace    https://viayoo.com/
// @version      1.1
// @description  Automatyzacja udostępniania i dodawania do znajomych
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=settings*mode=command_sharing*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const storageRada = 'TCM_Lista_Rada';

    function injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
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
            .tcm-shinko-panel { background-color: var(--bg-main) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; font-family: Verdana, sans-serif !important; border-radius: 4px !important; box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important; overflow: hidden !important; touch-action: none; }
            .tcm-shinko-header { background-color: var(--bg-header) !important; border-bottom: 1px solid var(--border-color) !important; color: var(--title-color) !important; padding: 8px 10px !important; font-weight: bold !important; display: flex !important; justify-content: space-between !important; align-items: center !important; user-select: none; }
            .tcm-shinko-btn { background: var(--btn-bg) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; border-radius: 3px !important; cursor: pointer !important; font-weight: bold !important; transition: background 0.2s !important; padding: 6px 12px; }
            .tcm-shinko-btn:hover { background: var(--btn-hover) !important; }
            .tcm-shinko-input { background-color: var(--bg-header) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; border-radius: 3px !important; padding: 6px !important; box-sizing: border-box; }
            .tcm-shinko-inner { background-color: var(--bg-row-alt); border: 1px solid var(--border-color); padding: 10px; border-radius: 3px; margin-bottom: 10px; }
        `;
        document.head.appendChild(style);
    }

    function init() {
        const $ = win.jQuery;
        if (!$) return;

        const targetTable = $('table.vis').has('input[name="share[]"]').first();
        if (!targetTable.length || $('#tcm_trigger_btn').length) return;

        injectCSS();

        const triggerBtn = `<div style="margin: 10px 0;"><button id="tcm_trigger_btn" class="tcm-shinko-btn" style="padding: 10px 20px;">UDOSTĘPNIJ KOMENDY</button></div>`;
        targetTable.before(triggerBtn);

        $('#tcm_trigger_btn').on('click', (e) => { e.preventDefault(); showMainUI(); });
    }

    function showMainUI() {
        const $ = win.jQuery;
        if ($('#tcm_ui_overlay').length) return;

        const savedRada = localStorage.getItem(storageRada) || "";
        let savedPos = null;
        try { savedPos = JSON.parse(localStorage.getItem('TCM_ShareUI_Pos')); } catch(e) { localStorage.removeItem('TCM_ShareUI_Pos'); }

        let initialTop = savedPos ? savedPos.top : '10%';
        let initialLeft = savedPos ? savedPos.left : '5%';

        const uiHtml = `
            <div id="tcm_ui_overlay" class="tcm-shinko-panel" style="position:fixed; top:${initialTop}; left:${initialLeft}; width:90%; max-width:400px; z-index:30000; box-sizing:border-box;">
                <div id="tcm-drag-handle" class="tcm-shinko-header">
                    <span>Udostępnianie Komend</span>
                    <div>
                        <span id="tcm-pin-btn" style="cursor:pointer; font-size:14px; margin-right:10px;" title="P">📌</span>
                        <span id="tcm-close-btn" style="cursor:pointer; color:#ff4444; font-size:14px; font-weight:bold;" title="Z">✖</span>
                    </div>
                </div>
                <div style="padding:15px; overflow-y:auto; max-height:85vh;">
                    <div class="tcm-shinko-inner">
                        <label style="font-weight:bold; display:block; margin-bottom:5px; color:var(--title-color);">GRACZE (Tymczasowi):</label>
                        <textarea id="tcm_input_gracze" class="tcm-shinko-input" style="width:100%; height:60px; margin-bottom:10px; resize:vertical;" placeholder="Wklej nicki lub cały skrypt..."></textarea>
                        <div style="display:flex; gap:10px;">
                            <button id="tcm_btn_add" class="tcm-shinko-btn" style="flex:1; background: linear-gradient(#2ea043 0%, #238636 100%) !important;">DODAJ</button>
                            <button id="tcm_btn_replace" class="tcm-shinko-btn" style="flex:1; background: linear-gradient(#da3633 0%, #b62324 100%) !important;">PODMIEŃ</button>
                        </div>
                    </div>
                    <div class="tcm-shinko-inner">
                        <label style="font-weight:bold; display:block; margin-bottom:5px; color:var(--title-color);">RADA (Na stałe):</label>
                        <textarea id="tcm_input_rada" class="tcm-shinko-input" style="width:100%; height:60px; margin-bottom:10px; resize:vertical;">${savedRada}</textarea>
                        <button id="tcm_btn_save_rada" class="tcm-shinko-btn" style="width:100%;">ZAPISZ RADĘ I UDOSTĘPNIJ</button>
                    </div>
                    <div id="tcm_missing_section" style="display:none; margin-bottom:10px; padding:10px; border:1px solid #da3633; background:#3c2020; border-radius:3px;">
                        <label style="font-weight:bold; color:#ff7b72; display:block; margin-bottom:5px;">ZAPROSZENIA:</label>
                        <div id="tcm_missing_list" style="display:flex; flex-wrap:wrap; gap:5px;"></div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(uiHtml);
        setupDraggableAndPin($('#tcm_ui_overlay')[0], !!savedPos);

        $('#tcm_btn_save_rada').on('click', () => {
            localStorage.setItem(storageRada, $('#tcm_input_rada').val());
            win.UI.InfoMessage("Rada zapisana. Sprawdzam tabelę...", 2000, "success");
            processSharing(false);
        });

        $('#tcm_btn_add').on('click', () => processSharing(false));
        $('#tcm_btn_replace').on('click', () => processSharing(true));
        $('#tcm-close-btn').on('click', () => $('#tcm_ui_overlay').remove());
    }

    function setupDraggableAndPin(ui, initialPinState) {
        const handle = document.getElementById('tcm-drag-handle');
        const pinBtn = document.getElementById('tcm-pin-btn');

        let isPinned = initialPinState;
        let isDragging = false, startX, startY, initialX, initialY;

        const updatePinVisuals = () => {
            if (isPinned) {
                pinBtn.style.opacity = '1';
                pinBtn.style.textShadow = '0 0 5px #2ecc71';
                handle.style.cursor = 'default';
            } else {
                pinBtn.style.opacity = '0.4';
                pinBtn.style.textShadow = 'none';
                handle.style.cursor = 'move';
            }
        };

        updatePinVisuals();

        const startDrag = (e) => {
            if(e.target === pinBtn || e.target.id === 'tcm-close-btn' || isPinned) return; 

            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initialX = ui.offsetLeft;
            initialY = ui.offsetTop;
        };

        const onDrag = (e) => {
            if (!isDragging || isPinned) return;
            e.preventDefault(); 
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let dx = clientX - startX;
            let dy = clientY - startY;
            
            // Zabezpieczenie przed wyjechaniem poza ekran
            let newX = Math.max(0, Math.min(window.innerWidth - ui.offsetWidth, initialX + dx));
            let newY = Math.max(0, Math.min(window.innerHeight - handle.offsetHeight, initialY + dy));

            ui.style.left = newX + 'px';
            ui.style.top = newY + 'px';
        };

        const stopDrag = () => { isDragging = false; };

        handle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        handle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);

        pinBtn.addEventListener('click', () => {
            if (isPinned) {
                localStorage.removeItem('TCM_ShareUI_Pos');
                isPinned = false;
            } else {
                localStorage.setItem('TCM_ShareUI_Pos', JSON.stringify({top: ui.style.top, left: ui.style.left}));
                isPinned = true;
            }
            updatePinVisuals();
        });
    }

    function processSharing(shouldReplace) {
        const $ = win.jQuery;

        const clean = (str) => {
            let content = str;
            // Ochrona skryptów konfiguracyjnych w grawisach
            const codeMatch = str.match(/`([^`]+)`/);
            if (codeMatch) content = codeMatch[1];

            // Usunięto dzielenie po " x " i dodano tabulatory z plusem
            return content.split(/[,;\n\t]+/)
                .map(n => n.replace(/[\[\]"']/g, '').trim())
                .filter(n => {
                    if (n === "") return false;
                    // Odfiltrowujemy śmieci składniowe na wypadek braku grawisów
                    if (n.match(/^(javascript:|var\s|let\s|const\s|if\s*\(|else|\$|\/\/|UI\.InfoMessage|\})/i)) return false;
                    return true;
                });
        };


        const radaList = clean($('#tcm_input_rada').val());
        const graczeList = clean($('#tcm_input_gracze').val());
        const totalList = [...new Set([...radaList, ...graczeList])];

        if (totalList.length === 0 && !shouldReplace) {
            win.UI.InfoMessage("Wprowadź prawidłowe nicki!", 3000, "error");
            return;
        }

        const foundInTable = [];
        let markedCount = 0;

        if (shouldReplace) $('input[name="share[]"]').prop('checked', false);

        const totalListLower = totalList.map(n => n.toLowerCase());

        $('table.vis tr').has('input[name="share[]"]').each(function() {
            const nickInTable = $(this).find('td:first').text().trim();
            const index = totalListLower.indexOf(nickInTable.toLowerCase());
            
            if (index !== -1) {
                $(this).find('input[name="share[]"]').prop('checked', true);
                $(this).css('background', 'var(--bg-row-alt)');
                foundInTable.push(totalList[index]);
                markedCount++;
            }
        });

        const foundInTableLower = foundInTable.map(n => n.toLowerCase());
        const missing = totalList.filter(n => !foundInTableLower.includes(n.toLowerCase()));

        if (markedCount > 0) {
            saveChangesAJAX();
        }

        if (missing.length > 0) {
            showMissingInvites(missing);
        } else {
            $('#tcm_missing_section').hide();
        }
    }

    function showMissingInvites(missing) {
        const $ = win.jQuery;
        $('#tcm_missing_section').show();
        const listContainer = $('#tcm_missing_list').empty();

        missing.forEach(nick => {
            const btn = $(`<button class="tcm-shinko-btn" style="font-size:10px; background: linear-gradient(#da3633 0%, #b62324 100%) !important; padding:5px 10px;">Dodaj ${nick}</button>`);
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
                if ($('#tcm_missing_list').children().length === 0) {
                    $('#tcm_missing_section').hide();
                    win.UI.InfoMessage("Wszyscy brakujący zostali zaproszeni. Odśwież stronę po ich akceptacji.", 4000, "success");
                }
            });
        });
    }

    function saveChangesAJAX() {
        const $ = win.jQuery;
        const form = $('form').has('input[name="share[]"]');
        const url = form.attr('action');
        const formData = form.serialize();

        $.post(url, formData, function() {
            win.UI.InfoMessage("Zaktualizowano uprawnienia wybranych graczy!", 2000, "success");
        }).fail(function() {
            win.UI.InfoMessage("Błąd zapisu uprawnień.", 3000, "error");
        });
    }

    // Usunięto setInterval, inicjalizacja po załadowaniu dokumentu
    init();
})();
