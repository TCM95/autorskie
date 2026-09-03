// ==UserScript==
// @name         Udostępnianie Komend
// @namespace    https://viayoo.com/
// @version      1.8
// @description  Automatyzacja zaznaczania, dodawania i zapisywania udostępniania komend
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=settings*mode=command_sharing*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const storageRada = 'TCM_Lista_Rada';
    const storageGracze = 'TCM_Lista_Gracze';

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
              --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
              --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
              --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
              --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
              --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
              --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
            }
            .tcm-inline-container { 
              background-color: var(--bg-main); 
              border: 1px solid var(--border-color); 
              border-radius: 4px; 
              padding: 6px; 
              margin-bottom: 10px; 
              color: var(--text-color); 
              font-family: Verdana, Arial;
              display: inline-block;
              width: fit-content;
              max-width: 100%;
              box-sizing: border-box;
            }
            .tcm-bar { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
            .tcm-btn { 
              background: var(--btn-bg); 
              border: 1px solid var(--border-color); 
              color: var(--text-color); 
              border-radius: 4px; 
              padding: 5px 10px; 
              cursor: pointer; 
              font-size: 12px; 
              transition: background 0.2s; 
              outline: none; 
            }
            .tcm-btn:hover { background: var(--btn-hover); }
            .tcm-btn-green { background: var(--btn-green-bg); }
            .tcm-btn-green:hover { background: var(--btn-green-hover); }
            .tcm-btn-red { background: var(--btn-red-bg); }
            .tcm-btn-red:hover { background: var(--btn-red-hover); }
            .tcm-btn-blue { background: var(--btn-blue-bg); }
            .tcm-btn-blue:hover { background: var(--btn-blue-hover); }
            .tcm-modal-inline { 
              display: none; 
              margin-top: 6px; 
              background: var(--bg-row-alt); 
              border: 1px solid var(--border-color); 
              border-radius: 4px; 
              padding: 8px; 
              max-width: 320px;
              box-sizing: border-box;
            }
            .tcm-textarea { 
              background-color: var(--bg-header); 
              border: 1px solid var(--border-color); 
              color: var(--text-color); 
              border-radius: 3px; 
              padding: 6px; 
              box-sizing: border-box; 
              width: 100%; 
              height: 70px; 
              resize: vertical; 
              font-size: 11px; 
              margin-bottom: 6px; 
            }
            .tcm-title { color: var(--title-color); font-weight: bold; font-size: 11px; margin-bottom: 4px; }
        `;
        document.head.appendChild(style);
    }

    function init() {
        const $ = win.jQuery;
        if (!$) return;

        const targetForm = $('form').has('input[name="share[]"]').first();
        if (!targetForm.length || $('#tcm_main_container').length) return;

        injectCSS();
        buildUI(targetForm);
    }

    function buildUI(targetForm) {
        const $ = win.jQuery;
        const savedRada = localStorage.getItem(storageRada) || "";
        const savedGracze = localStorage.getItem(storageGracze) || "";

        const uiHtml = `
            <div id="tcm_main_container" class="tcm-inline-container">
                <div class="tcm-bar">
                    <button id="btn_modal_rada" class="tcm-btn tcm-btn-blue">👑 Rada</button>
                    <button id="btn_modal_gracze" class="tcm-btn tcm-btn-blue">📜 Gracze</button>
                    <button id="btn_action_add" class="tcm-btn tcm-btn-green">➕ Dodaj i Zapisz</button>
                    <button id="btn_action_replace" class="tcm-btn tcm-btn-red">🔄 Podmień i Zapisz</button>
                </div>

                <div id="modal_rada" class="tcm-modal-inline">
                    <div class="tcm-title">Lista Rady (Stała)</div>
                    <textarea id="tcm_input_rada" class="tcm-textarea" placeholder="Nicki oddzielone przecinkami lub nową linią">${savedRada}</textarea>
                    <div style="display:flex; gap:5px;">
                        <button id="btn_save_rada" class="tcm-btn tcm-btn-green" style="flex:1;">💾 Zapisz</button>
                        <button id="btn_clear_rada" class="tcm-btn" style="flex:1;">🗑️ Wyczyść</button>
                        <button id="btn_close_rada" class="tcm-btn" style="flex:1;">Zamknij</button>
                    </div>
                </div>

                <div id="modal_gracze" class="tcm-modal-inline">
                    <div class="tcm-title">Lista Graczy (Tymczasowa / Skrypt)</div>
                    <textarea id="tcm_input_gracze" class="tcm-textarea" placeholder="Nicki lub tablica w formacie skryptu">${savedGracze}</textarea>
                    <div style="display:flex; gap:5px;">
                        <button id="btn_save_gracze" class="tcm-btn tcm-btn-green" style="flex:1;">💾 Zapisz</button>
                        <button id="btn_clear_gracze" class="tcm-btn" style="flex:1;">🗑️ Wyczyść</button>
                        <button id="btn_close_gracze" class="tcm-btn" style="flex:1;">Zamknij</button>
                    </div>
                </div>

                <div id="tcm_missing_section" class="tcm-modal-inline" style="border-color: #ad5c5c;">
                    <div class="tcm-title" style="color: #ffbfbf;">Brakujący gracze w tabeli:</div>
                    <div id="tcm_missing_list" style="display:flex; flex-wrap:wrap; gap:5px;"></div>
                </div>
            </div>
        `;

        targetForm.before(uiHtml);
        bindEvents();
    }

    function bindEvents() {
        const $ = win.jQuery;

        $('#btn_modal_rada').on('click', (e) => {
            e.preventDefault();
            $('#modal_gracze').hide();
            $('#modal_rada').toggle();
        });

        $('#btn_modal_gracze').on('click', (e) => {
            e.preventDefault();
            $('#modal_rada').hide();
            $('#modal_gracze').toggle();
        });

        $('#btn_save_rada').on('click', (e) => {
            e.preventDefault();
            localStorage.setItem(storageRada, $('#tcm_input_rada').val());
            win.UI.InfoMessage("Rada została zapisana", 2000, "success");
        });

        $('#btn_clear_rada').on('click', (e) => {
            e.preventDefault();
            $('#tcm_input_rada').val('');
            localStorage.setItem(storageRada, '');
        });

        $('#btn_close_rada').on('click', (e) => {
            e.preventDefault();
            $('#modal_rada').hide();
        });

        $('#btn_save_gracze').on('click', (e) => {
            e.preventDefault();
            localStorage.setItem(storageGracze, $('#tcm_input_gracze').val());
            win.UI.InfoMessage("Lista graczy została zapisana", 2000, "success");
        });

        $('#btn_clear_gracze').on('click', (e) => {
            e.preventDefault();
            $('#tcm_input_gracze').val('');
            localStorage.setItem(storageGracze, '');
        });

        $('#btn_close_gracze').on('click', (e) => {
            e.preventDefault();
            $('#modal_gracze').hide();
        });

        $('#btn_action_add').on('click', (e) => {
            e.preventDefault();
            $('.tcm-modal-inline').hide();
            processSharing(false);
        });

        $('#btn_action_replace').on('click', (e) => {
            e.preventDefault();
            $('.tcm-modal-inline').hide();
            processSharing(true);
        });
    }

    function parseList(str) {
        if (!str) return [];
        let cleaned = str.replace(/[\[\]"']/g, '');
        return cleaned.split(/[\n,;]+/)
            .map(n => n.trim())
            .filter(n => n !== "");
    }

    function processSharing(shouldReplace) {
        const $ = win.jQuery;
        const radaList = parseList($('#tcm_input_rada').val());
        const graczeList = parseList($('#tcm_input_gracze').val());
        const totalList = [...new Set([...radaList, ...graczeList])];

        if (totalList.length === 0 && !shouldReplace) {
            win.UI.InfoMessage("Brak nicków do przetworzenia!", 3000, "error");
            return;
        }

        const form = $('form').has('input[name="share[]"]').first();
        if (!form.length) return;

        if (shouldReplace) {
            form.find('input[name="share[]"]').prop('checked', false);
        }

        const foundInTable = [];
        const totalListLower = totalList.map(n => n.toLowerCase());

        // Przeszukiwanie obecnych wierszy w tabeli
        form.find('tr').has('input[name="share[]"]').each(function() {
            const nickInTable = $(this).find('td:first').text().trim();
            const index = totalListLower.indexOf(nickInTable.toLowerCase());

            if (index !== -1) {
                $(this).find('input[name="share[]"]').prop('checked', true);
                foundInTable.push(totalList[index]);
            }
        });

        // Wyznaczenie graczy, których brakuje w tabeli
        const foundInTableLower = foundInTable.map(n => n.toLowerCase());
        const missing = totalList.filter(n => !foundInTableLower.includes(n.toLowerCase()));

        // Wyświetlenie brakujących graczy w osobnym panelu
        if (missing.length > 0) {
            showMissingPlayers(missing);
            win.UI.InfoMessage(`Zaznaczono znanych. Brakujących na liście: ${missing.length}`, 3000, "warning");
        } else {
            $('#tcm_missing_section').hide();
            
            // Jeśli wszyscy są w tabeli, klikamy Zapisz i odświeżamy
            const submitBtn = form.find('input[type="submit"][value="Zapisz"], input[type="submit"].btn').first();
            if (submitBtn.length) {
                win.UI.InfoMessage("Zapisywanie zmian...", 2000, "success");
                submitBtn.click();
            } else {
                form.submit();
            }
        }
    }

    function showMissingPlayers(missing) {
        const $ = win.jQuery;
        $('#tcm_missing_section').show();
        const listContainer = $('#tcm_missing_list').empty();

        missing.forEach(nick => {
            const btn = $(`<button class="tcm-btn tcm-btn-green" style="font-size:11px; padding:3px 6px;">➕ ${nick}</button>`);
            btn.on('click', function(e) { 
                e.preventDefault();
                addPlayerDirectly(nick, $(this)); 
            });
            listContainer.append(btn);
        });
    }

    function addPlayerDirectly(nick, buttonElement) {
        const $ = win.jQuery;
        
        // Szukanie drugiego formularza na stronie do dodawania nicku
        const addForm = $('form').not(':has(input[name="share[]"])').has('input[name="name"]').first();
        const nameInput = $('input[name="name"]').first();

        if (nameInput.length && addForm.length) {
            nameInput.val(nick);
            const submitAddBtn = addForm.find('input[type="submit"], button[type="submit"]').first();
            if (submitAddBtn.length) {
                submitAddBtn.click();
            } else {
                addForm.submit();
            }
        } else {
            win.UI.InfoMessage(`Brak pola dodawania dla: ${nick}`, 2500, "error");
        }
    }

    init();
})();
            
