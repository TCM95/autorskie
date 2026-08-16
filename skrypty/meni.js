// ==UserScript==
// @name         Menedżer Narzędzi
// @namespace    https://viayoo.com/
// @version      1.1
// @description  Mobilne menu szybkiego uruchamiania skryptów Plemion z wbudowanym ciemnym motywem i funkcją zwijania.
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const scripts = [
        { name: "Wybierz skrypt...", run: () => {} },
        { name: "Health Check", run: () => $.getScript('https://twscripts.dev/scripts/defenseHealthCheck.js') },
        { name: "Przegląd Ataków", run: () => { window.NOBLE_GAP = 100; window.FORMAT = '%unit% | %sent%'; $.getScript('https://twscripts.dev/scripts/incomingsOverview.js'); } },
        { name: "Filtry Raportów", run: () => $.getScript('https://twscripts.dev/scripts/advancedReportFilters.js') },
        { name: "Tekst na Notatkę", run: () => $.getScript('https://twscripts.dev/scripts/convertTextToNote.js') },
        { name: "Menadżer Pamięci", run: () => $.getScript('https://twscripts.dev/scripts/localStorageManager.js') },
        { name: "Statystyki Plemienia", run: () => $.getScript('https://twscripts.dev/scripts/tribeStatsTool.js') },
        { name: "Pojedynczy Zbierak", run: () => { window.premiumBtnEnabled = false; $.getScript('https://shinko-to-kuma.com/scripts/scavengingFinal.js'); } },
        { name: "Import Grup", run: () => $.getScript("https://shinko-to-kuma.com/scripts/groupImport.js") }
    ];

    const injectCSS = () => {
        if (document.getElementById('tcm-script-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-script-styles';
        style.innerHTML = `
            :root {
                --bg-main: #36393f;
                --bg-row-alt: #32353b;
                --bg-header: #202225;
                --border-color: #3e4147;
                --text-color: white;
                --title-color: #ffffdf;
                --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
                --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
            }
            #tcm-script-menu {
                position: fixed;
                z-index: 99999;
                background-color: var(--bg-main);
                border: 2px solid var(--border-color);
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                width: 220px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                font-family: Arial, sans-serif;
            }
            #tcm-menu-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                background-color: var(--bg-header);
                color: var(--title-color);
                padding: 8px 10px;
                font-weight: bold;
                font-size: 14px;
                border-bottom: 1px solid var(--border-color);
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            .tcm-menu-ctrl-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                color: var(--text-color);
                transition: opacity 0.2s;
                padding: 0 4px;
            }
            #tcm-menu-body {
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            #tcm-script-select {
                padding: 8px;
                width: 100%;
                background: var(--bg-row-alt);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                font-size: 14px;
                outline: none;
            }
            #tcm-script-run {
                padding: 8px;
                background: var(--btn-blue-bg);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                text-shadow: 1px 1px 2px black;
            }
            #tcm-script-run:hover {
                background: var(--btn-blue-hover);
            }
        `;
        document.head.appendChild(style);
    };

    const buildUI = () => {
        injectCSS();

        const container = document.createElement('div');
        container.id = 'tcm-script-menu';

        let isPinned = localStorage.getItem('tcm_menu_pinned') === 'true';
        container.style.top = isPinned ? (localStorage.getItem('tcm_menu_top') || '50px') : '50px';
        container.style.left = isPinned ? (localStorage.getItem('tcm_menu_left') || '50px') : '50px';

        let optionsHTML = scripts.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');

        container.innerHTML = `
            <div id="tcm-menu-header">
                <span>Menu Narzędzi</span>
                <div>
                    <button id="tcm-menu-toggle" class="tcm-menu-ctrl-btn" title="Minimalizuj">[-]</button>
                    <button id="tcm-menu-pin" class="tcm-menu-ctrl-btn" style="opacity: ${isPinned ? '1' : '0.4'}; font-size: 12px;" title="Przypnij">📌</button>
                </div>
            </div>
            <div id="tcm-menu-body">
                <select id="tcm-script-select">${optionsHTML}</select>
                <button id="tcm-script-run">Uruchom Skrypt</button>
            </div>
        `;
        document.body.appendChild(container);
        return container;
    };

    const bindEvents = (container) => {
        const header = document.getElementById('tcm-menu-header');
        const pinBtn = document.getElementById('tcm-menu-pin');
        const toggleBtn = document.getElementById('tcm-menu-toggle');
        const bodySection = document.getElementById('tcm-menu-body');
        const select = document.getElementById('tcm-script-select');
        const runBtn = document.getElementById('tcm-script-run');

        let isPinned = localStorage.getItem('tcm_menu_pinned') === 'true';
        let isCollapsed = localStorage.getItem('tcm_menu_collapsed') === 'true';

        // Przywrócenie stanu zwinięcia
        if (isCollapsed) {
            bodySection.style.display = 'none';
            toggleBtn.innerText = '[+]';
        }

        runBtn.addEventListener('click', () => {
            const selectedIdx = select.value;
            if(selectedIdx > 0) scripts[selectedIdx].run();
        });

        // Obsługa zwijania/rozwijania
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            localStorage.setItem('tcm_menu_collapsed', isCollapsed);
            
            if (isCollapsed) {
                bodySection.style.display = 'none';
                toggleBtn.innerText = '[+]';
            } else {
                bodySection.style.display = 'flex';
                toggleBtn.innerText = '[-]';
            }
        });

        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isPinned = !isPinned;
            localStorage.setItem('tcm_menu_pinned', isPinned);
            pinBtn.style.opacity = isPinned ? '1' : '0.4';
            
            if (isPinned) {
                localStorage.setItem('tcm_menu_top', container.style.top);
                localStorage.setItem('tcm_menu_left', container.style.left);
            }
        });

        let isDragging = false, startX, startY, startLeft, startTop;

        const dragStart = (e) => {
            if (e.target.classList.contains('tcm-menu-ctrl-btn')) return; // Zabezpieczenie na kontener przycisków
            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            startLeft = parseInt(container.style.left, 10) || 0;
            startTop = parseInt(container.style.top, 10) || 0;
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            e.preventDefault(); 
            
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            let newLeft = startLeft + (clientX - startX);
            let newTop = startTop + (clientY - startY);
            
            const maxLeft = window.innerWidth - container.offsetWidth;
            const maxTop = window.innerHeight - container.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            container.style.left = newLeft + 'px';
            container.style.top = newTop + 'px';

            if (isPinned) {
                localStorage.setItem('tcm_menu_top', container.style.top);
                localStorage.setItem('tcm_menu_left', container.style.left);
            }
        };

        const dragEnd = () => { isDragging = false; };

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);

        header.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('touchend', dragEnd);
    };

    const init = () => {
        if(document.getElementById('tcm-script-menu')) return;
        const container = buildUI();
        bindEvents(container);
    };

    init();
})();
