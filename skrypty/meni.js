// ==UserScript==
// @name         Menu skryptów (wersja podpięta)
// @author       TCM
// @namespace    https://viayoo.com/
// @version      1.1
// @description  Ładuje listę skryptów do głównego panelu z zabezpieczeniem DOM
// ==/UserScript==

(function() {
    'use strict';

    const scripts = [
        { name: "Wybierz skrypt...", run: () => {} },
        { name: "Health Check", run: () => $.getScript('https://twscripts.dev/scripts/defenseHealthCheck.js') },
        { name: "Przegląd ataków", run: () => { window.NOBLE_GAP = 100; window.FORMAT = '%unit% | %sent%'; $.getScript('https://twscripts.dev/scripts/incomingsOverview.js'); } },
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
        select.style.cssText = 'flex-grow: 1; padding: 4px; background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 3px; font-size: 13px; outline: none;';
        
        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            select.appendChild(opt);
        });

        const runBtn = document.createElement('button');
        runBtn.className = 'tw-square-btn tw-btn-active';
        runBtn.innerText = '▶';
        runBtn.style.padding = '4px 10px';
        runBtn.title = 'Uruchom wybrany skrypt';

        runBtn.onclick = () => {
            const idx = select.value;
            if (idx > 0) scripts[idx].run();
        };

        container.appendChild(select);
        container.appendChild(runBtn);
        return true;
    }

    // Bezpieczne ładowanie - jeśli kontener jeszcze nie istnieje, próbujemy co 50ms
    if (!initMenu()) {
        const checkInterval = setInterval(() => {
            if (initMenu()) {
                clearInterval(checkInterval);
            }
        }, 50);
    }

})();
