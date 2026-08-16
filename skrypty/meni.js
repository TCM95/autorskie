// ==UserScript==
// @name         Menu skryptów (wersja podpięta)
// @author       TCM
// @namespace    https://viayoo.com/
// @version      1.4
// @description  Ładuje listę skryptów do głównego panelu ze spójnym UI
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

        container.innerHTML = '';

        const select = document.createElement('select');
        // Dodano min-width: 0, text-overflow, white-space i overflow aby zapobiec rozpychaniu
        select.style.cssText = 'flex-grow: 1; min-width: 0; padding: 4px; background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 3px; font-size: 13px; outline: none; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;';

        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            select.appendChild(opt);
        });

        const runBtn = document.createElement('button');
        runBtn.innerText = 'Uruchom';
        runBtn.title = 'Uruchom wybrany skrypt';
        
        // Stylowanie zielonego przycisku zgodnie z naszymi zmiennymi CSS
        runBtn.style.cssText = `
            padding: 4px 10px; 
            background: var(--btn-green-bg); 
            color: var(--title-color); 
            border: 1px solid var(--border-color); 
            border-radius: 3px; 
            font-size: 11px; 
            font-weight: bold; 
            text-transform: uppercase;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.5);
            transition: background 0.2s;
        `;

        // Obsługa najechania myszką (hover)
        runBtn.onmouseenter = () => runBtn.style.background = 'var(--btn-green-hover)';
        runBtn.onmouseleave = () => runBtn.style.background = 'var(--btn-green-bg)';

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
