// ==UserScript==
// @name         Menu skryptów (wersja podpięta)
// @namespace    https://viayoo.com/
// @version      1.8
// @description  Wymusza twardy układ CSS Grid, naprawiając rozpychanie na mobile
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const scripts = [
        { name: "Wybierz skrypt...", run: () => {} },
        { name: "Health Check", run: () => $.getScript('https://twscripts.dev/scripts/defenseHealthCheck.js') },
        { name: "Przegląd ataków (bardzo długa nazwa testowa do ucięcia)", run: () => { window.NOBLE_GAP = 100; window.FORMAT = '%unit% | %sent%'; $.getScript('https://twscripts.dev/scripts/incomingsOverview.js'); } },
        { name: "Filtry raportów", run: () => $.getScript('https://twscripts.dev/scripts/advancedReportFilters.js') },
        { name: "Tekst na notatkę", run: () => $.getScript('https://twscripts.dev/scripts/convertTextToNote.js') },
        { name: "Menadżer pamięci", run: () => $.getScript('https://twscripts.dev/scripts/localStorageManager.js') },
        { name: "Statystyki plemienia", run: () => $.getScript('https://twscripts.dev/scripts/tribeStatsTool.js') },
        { name: "Single zbierak", run: () => { window.premiumBtnEnabled = false; $.getScript('https://shinko-to-kuma.com/scripts/scavengingFinal.js'); } },
        { name: "Import grup", run: () => $.getScript("https://shinko-to-kuma.com/scripts/groupImport.js") }
    ];

    function initMenu() {
        const container = document.getElementById('tcm-external-menu-container');
        if (!container) return false;

        // BRUTALNE NADPISANIE CAŁEGO CSS RODZICA (GRID LAYOUT)
        // Kolumna 1: minmax(0, 1fr) - zajmuje resztę, zmusza do ucinania tekstu
        // Kolumna 2: 75px - sztywna szerokość dla przycisku
        container.style.cssText = 'box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; padding: 6px 8px !important; background: var(--bg-row-alt) !important; border-top: 1px solid var(--border-color) !important; display: grid !important; grid-template-columns: minmax(0, 1fr) 75px !important; gap: 5px !important; overflow: hidden !important; border-bottom-left-radius: 4px !important; border-bottom-right-radius: 4px !important;';
        
        container.innerHTML = '';

        const select = document.createElement('select');
        // Stylowanie selecta - zmuszamy go do pozostania w swojej celi siatki
        select.style.cssText = 'width: 100% !important; max-width: 100% !important; min-width: 0 !important; padding: 4px !important; background: var(--bg-main) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; border-radius: 3px !important; font-size: 12px !important; outline: none !important; text-overflow: ellipsis !important; white-space: nowrap !important; overflow: hidden !important; cursor: pointer !important;';

        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            select.appendChild(opt);
        });

        const runBtn = document.createElement('button');
        runBtn.innerText = 'Uruchom';
        // Stylowanie przycisku - twardo zajmuje swoje 75px
        runBtn.style.cssText = 'width: 100% !important; padding: 4px 0 !important; background: var(--btn-green-bg) !important; color: var(--title-color) !important; border: 1px solid var(--border-color) !important; border-radius: 3px !important; font-size: 11px !important; font-weight: bold !important; text-transform: uppercase !important; cursor: pointer !important; box-shadow: 0 1px 3px rgba(0,0,0,0.5) !important; transition: background 0.2s !important; text-align: center !important;';

        runBtn.onmouseenter = () => runBtn.style.setProperty('background', 'var(--btn-green-hover)', 'important');
        runBtn.onmouseleave = () => runBtn.style.setProperty('background', 'var(--btn-green-bg)', 'important');

        runBtn.onclick = () => {
            const idx = select.value;
            if (idx > 0) scripts[idx].run();
        };

        container.appendChild(select);
        container.appendChild(runBtn);
        return true;
    }

    if (!initMenu()) {
        const checkInterval = setInterval(() => {
            if (initMenu()) {
                clearInterval(checkInterval);
            }
        }, 50);
    }

})();
