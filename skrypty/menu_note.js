// ==UserScript==
// @name         Menu Raportow PRO
// @namespace    https://viayoo.com/
// @version      1.4
// @description  Zarządzanie raportami
// @author       TCM
// @match        https://*.plemiona.pl/game.php*screen=report*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const czekaj = (ms) => new Promise(res => setTimeout(res, ms));

    // --- 1. MODUŁ CZYSZCZENIA ---
    const sekwencja = ['support', 'trade', 'other'];

    window.czyscSmieci = function() {
        localStorage.setItem('czyszczenie_aktywne', '0');
        window.location.href = window.location.origin + window.location.pathname + "?screen=report&mode=support";
    };

    const wykonajKrokCzyszczenia = async () => {
        const checkAll = document.getElementById('select_all');
        const btnUsun = document.querySelector('input[name="del"]');
        let krok = parseInt(localStorage.getItem('czyszczenie_aktywne'));

        if (checkAll && btnUsun && !document.body.innerText.includes('Brak raportów')) {
            checkAll.click();
            await czekaj(200);
            localStorage.setItem('czyszczenie_aktywne', (krok + 1).toString());
            btnUsun.click();
        } else {
            localStorage.setItem('czyszczenie_aktywne', (krok + 1).toString());
            przejdzDalej(krok + 1);
        }
    };

    const przejdzDalej = (indeks) => {
        if (indeks < sekwencja.length) {
            window.location.href = window.location.origin + window.location.pathname + "?screen=report&mode=" + sekwencja[indeks];
        } else {
            localStorage.removeItem('czyszczenie_aktywne');
            UI.SuccessMessage("Czyszczenie zakończone!", 1000);
            window.location.href = window.location.origin + window.location.pathname + "?screen=report&mode=all";
        }
    };

    // --- 2. MODUŁ FILTROWANIA I ZAKŁADANIA GRUPY ---
    const utworzGrupeDzisiaj = async () => {
        const formData = new URLSearchParams();
        formData.append('group_name', 'Dzisiaj');
        await fetch(`/game.php?screen=report&mode=groups&action=create_group&h=${game_data.csrf}`, {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    };

    window.filtrujDzisiaj = async function() {
        let zaznaczono = 0;
        document.querySelectorAll('#report_list tr').forEach(w => {
            const dataKomorka = w.querySelector('td:nth-child(2)');
            if (dataKomorka && dataKomorka.innerText.toLowerCase().includes('dzisiaj')) {
                const cb = w.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) { 
                    cb.checked = true; 
                    zaznaczono++; 
                }
            }
        });

        if (zaznaczono > 0) {
            const select = document.querySelector('select[name="group_id"]');
            let grupaZnaleziona = false;

            if (select) {
                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].text.trim().toLowerCase() === "dzisiaj") {
                        select.selectedIndex = i;
                        grupaZnaleziona = true;
                        break;
                    }
                }
            }

            if (!grupaZnaleziona) {
                UI.InfoMessage("Tworzę zakładkę 'Dzisiaj'...", 1500);
                await utworzGrupeDzisiaj();
                localStorage.setItem('ponow_filtrowanie', 'true');
                location.reload();
                return;
            }

            localStorage.setItem('skocz_do_dzisiaj', 'true');
            document.querySelector('input[name="arch"]').click();
        } else {
            UI.InfoMessage("Brak raportów z dzisiaj na tej stronie.", 2000);
        }
    };

    // --- 3. MODUŁ NOTATEK ---
    window.notatkaToggle = function() {
        const aktywny = localStorage.getItem('notatki_aktywne') === 'true';
        localStorage.setItem('notatki_aktywne', (!aktywny).toString());
        location.reload();
    };

    const zakonczNotatkowanie = () => {
        localStorage.setItem('notatki_aktywne', 'false');
        UI.ErrorMessage("Koniec raportów! Automat wyłączony.", 3000);
        setTimeout(() => location.reload(), 2000);
    };

    const uruchomSkryptNotatek = async () => {
        const url = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/note.js';
        try {
            const response = await fetch(url);
            const code = await response.text();
            new Function(code)();
        } catch (e) {
            console.error("Błąd ładowania skryptu notatek:", e);
        }
    };

    // --- 4. WYMUSZONE STYLE ORAZ MENU BOCZNE ---
    const zaladujStyleUI = () => {
        if (document.getElementById('tcm-ui-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-ui-styles';
        style.innerHTML = `
            :root {
                --bg-main: #36393f;
                --bg-row-alt: #32353b;
                --bg-header: #202225;
                --border-color: #3e4147;
                --text-color: #ffffff;
                --title-color: #ffffdf;
                --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
                --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
                --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
                --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
                --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
                --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            }
            
            /* Wymuszenie nakładania stylów na przyciski w menu */
            button.tcm-ui-btn {
                all: unset !important;
                display: block !important;
                width: 100% !important;
                box-sizing: border-box !important;
                background: var(--btn-bg) !important;
                color: var(--text-color) !important;
                border: 1px solid var(--border-color) !important;
                border-radius: 3px !important;
                padding: 8px 4px !important;
                margin: 3px 0 !important;
                font-size: 12px !important;
                font-weight: bold !important;
                text-align: center !important;
                cursor: pointer !important;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 3px rgba(0,0,0,0.4) !important;
                text-shadow: 1px 1px 1px #000 !important;
            }

            button.tcm-ui-btn:active {
                background: var(--btn-hover) !important;
            }

            button.tcm-ui-btn.tcm-btn-red {
                background: var(--btn-red-bg) !important;
                border-color: #7a2e2e !important;
            }
            button.tcm-ui-btn.tcm-btn-red:active {
                background: var(--btn-red-hover) !important;
            }

            button.tcm-ui-btn.tcm-btn-green {
                background: var(--btn-green-bg) !important;
                border-color: #5cad5c !important;
                box-shadow: 0 0 6px rgba(92, 173, 92, 0.8) !important;
            }
            button.tcm-ui-btn.tcm-btn-green:active {
                background: var(--btn-green-hover) !important;
            }
        `;
        document.head.appendChild(style);
    };

    const dodajMenu = () => {
        const menu = document.querySelector('.modemenu tbody');
        if (!menu || document.getElementById('tcm-panel-wiersz')) return;

        zaladujStyleUI();

        const tr = document.createElement('tr');
        tr.id = 'tcm-panel-wiersz';
        tr.innerHTML = `
            <td style="padding: 6px 2px 2px 2px !important;">
                <button id="tcm-btn-czysc" class="tcm-ui-btn tcm-btn-red" type="button">🗑️Śmieci</button>
                <button id="tcm-btn-filtruj" class="tcm-ui-btn" type="button">🗓️Dzisiaj</button>
                <button id="tcm-btn-notatkuj" class="tcm-ui-btn" type="button">ℹ️Notatka</button>
            </td>
        `;
        menu.appendChild(tr);

        // Podpinanie czystych zdarzeń JS
        document.getElementById('tcm-btn-czysc').addEventListener('click', () => window.czyscSmieci());
        document.getElementById('tcm-btn-filtruj').addEventListener('click', () => window.filtrujDzisiaj());
        document.getElementById('tcm-btn-notatkuj').addEventListener('click', () => window.notatkaToggle());

        if (localStorage.getItem('notatki_aktywne') === 'true') {
            const btn = document.getElementById('tcm-btn-notatkuj');
            if (btn) {
                btn.classList.add('tcm-btn-green');
                btn.innerText = "● Notatkowanie...";
            }
        }
    };

    // --- 5. INICJACJA ---
    const inicjuj = async () => {
        dodajMenu();

        if (localStorage.getItem('czyszczenie_aktywne') !== null) {
            await czekaj(600);
            wykonajKrokCzyszczenia();
            return;
        }

        if (localStorage.getItem('ponow_filtrowanie') === 'true') {
            localStorage.removeItem('ponow_filtrowanie');
            await czekaj(500);
            window.filtrujDzisiaj();
            return;
        }

        if (localStorage.getItem('skocz_do_dzisiaj') === 'true') {
            localStorage.removeItem('skocz_do_dzisiaj');
            await czekaj(500);
            const linki = document.querySelectorAll('a');
            for (let link of linki) {
                if (link.innerText.includes('[Dzisiaj]')) { link.click(); break; }
            }
            return;
        }

        if (localStorage.getItem('notatki_aktywne') === 'true' && window.location.href.includes('view=')) {
            await czekaj(1000);
            const strzalka = document.querySelector('a[data-title="Nowszy raport"]') || document.querySelector('a[data-title="Starszy raport"]');
            const blad = document.body.innerText.includes('nie są obsługiwane');

            window.UserSettings = { simulator_luck: -25, simulator_def_wall: 20, simulator_att_troops: { axe: 6500, light: 2800, ram: 400 } };

            if (!strzalka && !blad) {
                await uruchomSkryptNotatek();
                await czekaj(1500); 
                zakonczNotatkowanie();
            } else if (blad) {
                if (strzalka) {
                    UI.InfoMessage("Raport pominięty...", 500);
                    await czekaj(500);
                    strzalka.click();
                } else {
                    zakonczNotatkowanie();
                }
            } else {
                await uruchomSkryptNotatek();
                await czekaj(1500);
                strzalka.click();
            }
        }
    };

    inicjuj();
})();
