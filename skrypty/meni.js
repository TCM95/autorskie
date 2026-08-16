// ==UserScript==
// @name         Meni
// @namespace    https://viayoo.com/
// @version      1.6
// @description  Wymusza twarde style !important i sztywne wymiary
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const scripts = [
        { name: "Wybierz", run: () => {} },
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

        // TWARDE BLOKOWANIE RODZICA
        container.style.setProperty('box-sizing', 'border-box', 'important');
        container.style.setProperty('width', '100%', 'important');
        container.style.setProperty('max-width', '100%', 'important');
        container.style.setProperty('overflow', 'hidden', 'important');
        
        container.innerHTML = '';

        const select = document.createElement('select');
        
        // Twarda kalkulacja szerokości (100% szerokości panelu minus przycisk i marginesy)
        select.style.setProperty('width', 'calc(100% - 85px)', 'important');
        select.style.setProperty('padding', '4px', 'important');
        select.style.setProperty('background', 'var(--bg-main)', 'important');
        select.style.setProperty('color', 'var(--text-color)', 'important');
        select.style.setProperty('border', '1px solid var(--border-color)', 'important');
        select.style.setProperty('border-radius', '3px', 'important');
        select.style.setProperty('font-size', '13px', 'important');
        select.style.setProperty('outline', 'none', 'important');
        select.style.setProperty('text-overflow', 'ellipsis', 'important');
        select.style.setProperty('white-space', 'nowrap', 'important');
        select.style.setProperty('overflow', 'hidden', 'important');

        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            select.appendChild(opt);
        });

        const runBtn = document.createElement('button');
        runBtn.innerText = 'Uruchom';
        
        // CAŁKOWITE USUNIĘCIE KLASY - zapobiega konfliktom i starym, niebieskim stylom
        runBtn.className = ''; 
        
        // TWARDE WYMUSZANIE WYGLĄDU (Zielony styl)
        runBtn.style.setProperty('width', '75px', 'important');
        runBtn.style.setProperty('flex-shrink', '0', 'important');
        runBtn.style.setProperty('padding', '4px 0', 'important');
        runBtn.style.setProperty('background', 'var(--btn-green-bg)', 'important');
        runBtn.style.setProperty('color', 'var(--title-color)', 'important');
        runBtn.style.setProperty('border', '1px solid var(--border-color)', 'important');
        runBtn.style.setProperty('border-radius', '3px', 'important');
        runBtn.style.setProperty('font-size', '11px', 'important');
        runBtn.style.setProperty('font-weight', 'bold', 'important');
        runBtn.style.setProperty('text-transform', 'uppercase', 'important');
        runBtn.style.setProperty('cursor', 'pointer', 'important');
        runBtn.style.setProperty('box-shadow', '0 1px 3px rgba(0,0,0,0.5)', 'important');
        runBtn.style.setProperty('transition', 'background 0.2s', 'important');

        // Dynamiczne zarządzanie najeżdżaniem myszką
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
