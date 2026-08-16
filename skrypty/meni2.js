// ==UserScript==
// @name         Meni
// @namespace    https://viayoo.com/
// @version      2.1
// @description  Czysty zielony przycisk z wbudowaną listą skryptów (wersja slim z obramówką)
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const scripts = [
        { name: "   ▼   ", run: () => {} },
        { name: "Health Check", run: () => $.getScript('https://twscripts.dev/scripts/defenseHealthCheck.js') },
        { name: "Przegląd ataków", run: () => { window.NOBLE_GAP = 100; window.FORMAT = '%unit% | %sent%'; $.getScript('https://twscripts.dev/scripts/incomingsOverview.js'); } },
        { name: "Filtry raportów", run: () => $.getScript('https://twscripts.dev/scripts/advancedReportFilters.js') },
        { name: "Tekst na notatkę", run: () => $.getScript('https://twscripts.dev/scripts/convertTextToNote.js') },
        { name: "Menadżer pamięci", run: () => $.getScript('https://twscripts.dev/scripts/localStorageManager.js') },
        { name: "Statystyki plemienia", run: () => $.getScript('https://twscripts.dev/scripts/tribeStatsTool.js') },
        { name: "Single zbierak", run: () => { window.premiumBtnEnabled = false; $.getScript('https://shinko-to-kuma.com/scripts/scavengingFinal.js'); } },
        { name: "Import grup", run: () => $.getScript("https://shinko-to-kuma.com/scripts/groupImport.js") },
{ name: "Wyszukiwarka Barbar", run: () => $.getScript('https://twscripts.dev/scripts/barbsFinder.js') },
{ name: "Szukanie Wioosek Bonusowych", run: () => $.getScript('https://twscripts.dev/scripts/bonusFinderEvolved.js') },
{ name: "Burzenie Murów Barbar", run: () => $.getScript('https://twscripts.dev/scripts/clearBarbarianWalls.js') },
{ name: "Karetka Fejków", run: () => $.getScript('https://twscripts.dev/scripts/evolvedFakeTrain.js') },
{ name: "Wydajność Zbieracza/Farmy", run: () => $.getScript('https://twscripts.dev/scripts/farmingEfficiencyCalculator.js') },
{ name: "Masywny Planer Ataków", run: () => $.getScript('https://twscripts.dev/scripts/massAttackPlanner.js') },
{ name: "Masywne Klinowanie", run: () => $.getScript('https://twscripts.dev/scripts/massSnipe.js') },
{ name: "Planer Jednej Wioski", run: () => $.getScript('https://twscripts.dev/scripts/singleVillagePlanner.js') },
{ name: "Klin z Jednej Wioski", run: () => $.getScript('https://twscripts.dev/scripts/singleVillageSnipe.js') },
{ name: "Zaawansowana Strażnica", run: () => $.getScript('https://twscripts.dev/scripts/watchtowerEvolved.js') }
   ];

    function initMenu() {
        const container = document.getElementById('tcm-external-menu-container');
        if (!container) return false;

        container.innerHTML = '';

        // Główny wrapper pełniący rolę zielonego przycisku
        const btnWrapper = document.createElement('div');
        btnWrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 22px; /* Zmniejszona wysokość */
            background: var(--btn-green-bg);
            border: 1px solid #5cad5c; /* Zielona obramówka dopasowana do gradientu */
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        `;

        // Wizualny napis wewnątrz przycisku
        const label = document.createElement('span');
        label.innerText = scripts[0].name;
        // Zmniejszony lekko font, by pasował do 22px wysokości
        label.style.cssText = 'color: var(--title-color); font-size: 11px; font-weight: bold; text-shadow: 1px 1px 2px black; pointer-events: none;';
        btnWrapper.appendChild(label);

        // Niewidzialny select przejmujący kliknięcia palcem/myszką
        const select = document.createElement('select');
        select.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; appearance: none; -webkit-appearance: none;';

        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            opt.style.cssText = 'background: var(--bg-main) !important; color: var(--text-color) !important;';
            select.appendChild(opt);
        });

        // Hover efekt
        btnWrapper.onmouseenter = () => btnWrapper.style.background = 'var(--btn-green-hover)';
        btnWrapper.onmouseleave = () => btnWrapper.style.background = 'var(--btn-green-bg)';

        // Logika Auto-Run po wybraniu opcji z listy
        select.onchange = () => {
            const idx = parseInt(select.value, 10);
            if (idx > 0) {
                scripts[idx].run();
                select.value = 0; // Od razu resetujemy wygląd po odpaleniu
            }
        };

        btnWrapper.appendChild(select);
        container.appendChild(btnWrapper);
        return true;
    }

    if (!initMenu()) {
        const checkInterval = setInterval(() => {
            if (initMenu()) clearInterval(checkInterval);
        }, 50);
    }

})();
