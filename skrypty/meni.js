// ==UserScript==
// @name         Meni
// @namespace    https://viayoo.com/
// @version      1.5
// @description  Ładuje listę skryptów, automatycznie naprawia UI i nadpisuje style rodzica
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const scripts = [
        { name: "Wybierz skrypt...", run: () => {} },
        { name: "Health Check", run: () => $.getScript('https://twscripts.dev/scripts/defenseHealthCheck.js') },
        { name: "Przegląd ataków (bardzo długa nazwa testowa)", run: () => { window.NOBLE_GAP = 100; window.FORMAT = '%unit% | %sent%'; $.getScript('https://twscripts.dev/scripts/incomingsOverview.js'); } },
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

        // ----------------------------------------------------
        // NAPRAWA STYLÓW PANELU (RODZICA) Z POZIOMU TEGO SKRYPTU
        // ----------------------------------------------------
        container.style.boxSizing = 'border-box';
        container.style.width = '100%';
        container.style.overflow = 'hidden';
        
        container.innerHTML = '';

        const select = document.createElement('select');
        
        // Flexbox naprawiony: min-width 0 zapobiega rozpychaniu, ellipsis ucina tekst
        select.style.cssText = 'flex: 1 1 auto; min-width: 0; padding: 4px; background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 3px; font-size: 13px; outline: none; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; cursor: pointer;';

        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            select.appendChild(opt);
        });

        const runBtn = document.createElement('button');
        runBtn.innerText = 'Uruchom';
        runBtn.title = 'Uruchom wybrany skrypt';

        // Estetyczny przycisk 3D z zielonym gradientem (zgodnie z UI panelu)
        // flex-shrink: 0 zapobiega ściskaniu przycisku przez długi tekst w selekcie
        runBtn.style.cssText = `
            flex-shrink: 0; 
            padding: 4px 10px; 
            background: var(--btn-green-bg); 
            color: var(--title-color); 
            border: 1px solid var(--border-color); 
            border-radius: 3px; 
            font-size: 11px; 
            font-weight: bold; 
            text-transform: uppercase;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            transition: background 0.2s, box-shadow 0.2s;
        `;

        // Pseudo-efekt hover (najechanie)
        runBtn.onmouseenter = () => {
            runBtn.style.background = 'var(--btn-green-hover)';
            runBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.7)';
        };
        runBtn.onmouseleave = () => {
            runBtn.style.background = 'var(--btn-green-bg)';
            runBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.5)';
        };

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
