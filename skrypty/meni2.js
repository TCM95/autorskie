// ==UserScript==
// @name         Menu skryptów (Custom Shape)
// @namespace    https://viayoo.com/
// @version      3.0
// @description  Niewidzialny select nałożony na customowy guzik w kształcie strzały z neonowym obramowaniem
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @grant        none
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
        // Dodajemy delikatny padding na dole kontenera, aby zielony cień (glow) miał miejsce i nie był ucięty
        container.style.setProperty('padding-bottom', '12px', 'important');

        // GŁÓWNY KONTENER GUZIKA (Odpowiada za neonowy zielony cień)
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; width: 95%; max-width: 250px; height: 35px; margin: 0 auto; filter: drop-shadow(0 3px 5px #267326); transition: filter 0.2s; cursor: pointer;';

        // WARSTWA 1: ZIELONE OBRAMOWANIE (Kształt trapezu wycięty z gradientu)
        const borderLayer = document.createElement('div');
        // Kąty: lewy-górny (0,0), prawy-górny (100,0), prawy-dolny (85,100), lewy-dolny (15,100)
        borderLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--btn-green-hover); clip-path: polygon(0 0, 100% 0, 85% 100%, 15% 100%); pointer-events: none;';

        // WARSTWA 2: CIEMNE TŁO WNĘTRZA (Zmniejszona o 2px względem obramowania)
        const innerLayer = document.createElement('div');
        innerLayer.style.cssText = 'position: absolute; top: 2px; left: 2px; width: calc(100% - 4px); height: calc(100% - 4px); background: var(--btn-bg); clip-path: polygon(0 0, 100% 0, 84% 100%, 16% 100%); display: flex; align-items: center; justify-content: center; pointer-events: none;';

        // TEKST NA ŚRODKU GUZIKA
        const label = document.createElement('span');
        label.innerText = 'WYBIERZ SKRYPT...';
        label.style.cssText = 'color: var(--title-color); font-size: 11px; font-weight: bold; text-shadow: 1px 1px 2px black; letter-spacing: 1px; margin-top: -2px;';

        innerLayer.appendChild(label);
        wrapper.appendChild(borderLayer);
        wrapper.appendChild(innerLayer);

        // WARSTWA 3: NIEWIDZIALNY SELECT (Zbiera kliknięcia palcem)
        const select = document.createElement('select');
        select.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; z-index: 10; cursor: pointer; appearance: none; -webkit-appearance: none;';

        scripts.forEach((s, i) => {
            let opt = document.createElement('option');
            opt.value = i;
            opt.innerText = s.name;
            opt.style.cssText = 'background: var(--bg-main) !important; color: var(--text-color) !important; text-align: center;';
            select.appendChild(opt);
        });

        // Efekty "Glow" przy przytrzymaniu/najechaniu
        wrapper.onmouseenter = () => wrapper.style.filter = 'drop-shadow(0 4px 8px #6bbf6b)';
        wrapper.onmouseleave = () => wrapper.style.filter = 'drop-shadow(0 3px 5px #267326)';

        // Logika Auto-Run
        select.onchange = () => {
            const idx = select.value;
            if (idx > 0) {
                scripts[idx].run();
                select.value = 0; // Wracamy do stanu wyjściowego
            }
        };

        wrapper.appendChild(select);
        container.appendChild(wrapper);
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
