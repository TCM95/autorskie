// ==UserScript==
// @name         Menedżer TCM
// @namespace    https://viayoo.com/
// @description  Menedżer skryptów - 2 kolumny, stałe kategorie, naprawione dymki
// @author       TCM
// @match        https://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Link do konfiguracji zgodnie z Twoim repozytorium
    const CONFIG_URL = 'https://github.com/TCM95/autorskie/raw/refs/heads/main/confing.json'; 
    const STORAGE_KEY = 'tw_scripts_state';
    const DARK_THEME_KEY = 'tw_dark_theme';
    
    // Sztywna lista kategorii 
    const CATEGORIES = ["Ogólne", "Atak/obrona", "Farma/zbieractwo", "Budowa/rekrutacja", "Mapa"];
    let currentCategory = null; 

    function getScriptsState() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    }

    function saveScriptState(id, isActive) {
        const state = getScriptsState();
        state[id] = isActive;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function loadCustomCSS() {
        const customFix = document.createElement('style');
        customFix.type = 'text/css';
        customFix.innerHTML = `
            #tw-script-panel { 
                width: max-content !important; 
                height: fit-content !important;
                background: #e3d5b3; 
                border: 2px solid #804000;
                position: absolute;
                z-index: 9999 !important;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
            }
            #tw-script-panel-header { 
                z-index: 1 !important; 
                position: relative; 
                background: #c1a264;
                padding: 5px;
                font-weight: bold;
                border-bottom: 2px solid #804000;
                display: flex;
                justify-content: space-between;
                cursor: grab;
            }
            .tw-header-btn {
                cursor: pointer;
                padding: 0 5px;
                font-size: 14px;
            }
            #tw-panel-body { 
                display: flex; 
                align-items: flex-start; /* Dopasowuje wysokość do zawartości */
                height: fit-content !important;
                position: relative;
            }
            #tw-sidebar { 
                display: flex; 
                flex-direction: column; 
                width: 110px; 
                height: fit-content !important;
                border-right: 1px solid #7d510f;
                background: #e3d5b3;
            }
            .tw-tab {
                padding: 8px 5px;
                cursor: pointer;
                border-bottom: 1px solid #c1a264;
                font-size: 12px;
                font-weight: bold;
                color: #5c3a21;
                transition: background 0.2s;
            }
            .tw-tab.active, .tw-tab:hover {
                background: #f4e4bc;
                color: #000;
            }
            #tw-content-area { 
                display: none; 
                gap: 5px;
                padding: 8px;
                align-content: start; 
                background: #e3d5b3;
                width: max-content;
                height: fit-content !important;
            }
            .tw-script-item { 
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #f4e4bc; 
                padding: 4px 6px;
                border: 1px solid #804000;
                border-radius: 4px;
                font-size: 11px;
                min-width: 140px;
            }
            .tw-game-btn {
                display: flex;
                align-items: center;
                cursor: pointer;
                flex: 1;
            }
            .tw-status-icon {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 6px;
                border: 1px solid #000;
            }
            .tw-status-on { background-color: #00aa00; }
            .tw-status-off { background-color: #aa0000; }
            .tw-info-icon { 
                cursor: pointer;
                font-weight: bold;
                color: #005500;
                padding-left: 8px;
                font-size: 14px;
            }
            
            /* GLOBALNY DYMEK ODPORNY NA UCINANIE */
            #tw-global-tooltip {
                display: none;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 999999 !important; 
                width: 220px; 
                background: #fcf4db !important; 
                border: 2px solid #804000;
                padding: 10px;
                color: #000;
                box-shadow: 0px 4px 10px rgba(0,0,0,0.8);
                font-size: 12px;
                border-radius: 4px;
                text-align: center;
            }
            #tw-tooltip-close {
                display: block;
                margin: 8px auto 0 auto;
                padding: 3px 8px;
                background: #804000;
                color: #fff;
                border: 1px solid #000;
                cursor: pointer;
                border-radius: 3px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(customFix);
    }

    async function toggleDarkTheme(darkScriptUrl, enable) {
        let themeElement = document.getElementById('tcm-dark-theme-script');
        if (enable) {
            localStorage.setItem(DARK_THEME_KEY, '1');
            if (!themeElement && darkScriptUrl) {
                try {
                    const fetchUrl = darkScriptUrl.includes('?') ? `${darkScriptUrl}&t=${Date.now()}` : `${darkScriptUrl}?t=${Date.now()}`;
                    const response = await fetch(fetchUrl);
                    if (response.ok) {
                        const code = await response.text();
                        themeElement = document.createElement('script');
                        themeElement.id = 'tcm-dark-theme-script';
                        themeElement.type = 'text/javascript';
                        themeElement.textContent = code;
                        document.head.appendChild(themeElement);
                    }
                } catch (e) {
                    console.error("Błąd ładowania ciemnego motywu:", e);
                }
            }
        } else {
            localStorage.setItem(DARK_THEME_KEY, '0');
            if (themeElement) themeElement.remove();
            location.reload();
        }
    }

    function renderScripts(scriptsArray, container) {
        container.innerHTML = '';
        const state = getScriptsState();
        
        let filtered = scriptsArray.filter(s => {
            if (s.id === 'ciemny_motyw') return false;
            const cat = s.category || "Ogólne";
            return cat === currentCategory;
        });

        filtered.sort((a, b) => a.name.localeCompare(b.name));

        if (filtered.length === 0) {
            container.style.display = 'block';
            const msg = document.createElement('div');
            msg.style.padding = '10px';
            msg.style.fontWeight = 'bold';
            msg.innerText = 'Brak skryptów w tej kategorii.';
            container.appendChild(msg);
            return;
        }

        // Twarde wymuszenie 1 lub 2 kolumn w zależności od ilości skryptów
        const columns = filtered.length === 1 ? 1 : 2;
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

        const globalTooltip = document.getElementById('tw-global-tooltip');
        const tooltipContent = document.getElementById('tw-tooltip-content');

        filtered.forEach(script => {
            const isActive = state[script.id] === true;
            
            const item = document.createElement('div');
            item.className = 'tw-script-item';

            const gameBtn = document.createElement('div');
            gameBtn.className = 'tw-game-btn';

            const statusIcon = document.createElement('span');
            statusIcon.className = `tw-status-icon ${isActive ? 'tw-status-on' : 'tw-status-off'}`;
            
            const nameLabel = document.createElement('span');
            nameLabel.className = 'tw-script-name';
            nameLabel.innerText = script.name;

            gameBtn.appendChild(statusIcon);
            gameBtn.appendChild(nameLabel);

            gameBtn.addEventListener('click', () => {
                const newState = !state[script.id];
                state[script.id] = newState;
                saveScriptState(script.id, newState);
                statusIcon.className = `tw-status-icon ${newState ? 'tw-status-on' : 'tw-status-off'}`;
            });

            const infoIcon = document.createElement('span');
            infoIcon.className = 'tw-info-icon';
            infoIcon.innerText = 'ⓘ';
            
            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Brak';
                tooltipContent.innerHTML = `<strong>${script.name}</strong><br><hr style="margin:4px 0;"><div style="text-align:left;"><strong>Opis:</strong> ${script.description || 'Brak.'}<br><strong>Strony:</strong> ${screensInfo}</div>`;
                globalTooltip.style.display = 'block';
            });

            item.appendChild(gameBtn);
            item.appendChild(infoIcon);
            container.appendChild(item);
        });
    }

    function buildPanel(scriptsArray) {
        const darkThemeConfig = scriptsArray.find(s => s.id === 'ciemny_motyw');

        const opener = document.createElement('div');
        opener.id = 'tw-panel-opener';
        const currentOrigin = window.location.origin;
        opener.innerHTML = `<img src="${currentOrigin}/favicon.ico" style="width: 24px; height: 24px; pointer-events: none;" alt="Favicon">`;
        opener.style.display = 'flex';
        opener.style.justifyContent = 'center';
        opener.style.alignItems = 'center';
        opener.style.cursor = 'pointer';
        document.body.appendChild(opener);

        const panel = document.createElement('div');
        panel.id = 'tw-script-panel';
        panel.style.display = 'none';

        const header = document.createElement('div');
        header.id = 'tw-script-panel-header';
        
        const titleSpan = document.createElement('span');
        titleSpan.innerText = 'Menedżer TCM';
        
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';

        const themeBtn = document.createElement('span');
        themeBtn.className = 'tw-header-btn';
        let isDark = localStorage.getItem(DARK_THEME_KEY) === '1';
        themeBtn.innerText = isDark ? '🌙' : '☀️';

        themeBtn.onclick = async () => {
            isDark = !isDark;
            themeBtn.innerText = isDark ? '🌙' : '☀️';
            if (darkThemeConfig) {
                await toggleDarkTheme(darkThemeConfig.url, isDark);
            }
        };

        const pinBtn = document.createElement('span');
        pinBtn.className = 'tw-header-btn';
        let isPinned = localStorage.getItem('tw_panel_pinned') === '1';
        pinBtn.innerText = isPinned ? '📍' : '📌';
        pinBtn.onclick = () => {
            isPinned = !isPinned;
            localStorage.setItem('tw_panel_pinned', isPinned ? '1' : '0');
            pinBtn.innerText = isPinned ? '📍' : '📌';
            if (isPinned) {
                localStorage.setItem('tw_panel_top', panel.style.top || '45px');
                localStorage.setItem('tw_panel_left', panel.style.left || '10px');
            }
        };

        const closeBtn = document.createElement('span');
        closeBtn.className = 'tw-header-btn';
        closeBtn.innerText = '✕';
        closeBtn.style.color = '#804000';
        closeBtn.onclick = () => {
            panel.style.display = 'none';
        };
        
        controls.appendChild(themeBtn);
        controls.appendChild(pinBtn);
        controls.appendChild(closeBtn);
        
        header.appendChild(titleSpan);
        header.appendChild(controls);
        panel.appendChild(header);

        const panelBody = document.createElement('div');
        panelBody.id = 'tw-panel-body';

        const sidebar = document.createElement('div');
        sidebar.id = 'tw-sidebar';

        const contentArea = document.createElement('div');
        contentArea.id = 'tw-content-area';

        // Sztywna generacja kategorii z tablicy CATEGORIES
        CATEGORIES.forEach(cat => {
            const tab = document.createElement('div');
            tab.className = 'tw-tab';
            tab.innerText = cat;
            
            tab.onclick = () => {
                if (currentCategory === cat) {
                    currentCategory = null;
                    tab.classList.remove('active');
                    contentArea.style.display = 'none';
                } else {
                    document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    currentCategory = cat;
                    renderScripts(scriptsArray, contentArea);
                }
            };
            sidebar.appendChild(tab);
        });

        // Tworzenie globalnego dymka (dodawany do głównego panelu)
        const globalTooltip = document.createElement('div');
        globalTooltip.id = 'tw-global-tooltip';
        
        const tooltipContent = document.createElement('div');
        tooltipContent.id = 'tw-tooltip-content';
        
        const closeTooltipBtn = document.createElement('button');
        closeTooltipBtn.id = 'tw-tooltip-close';
        closeTooltipBtn.innerText = 'Zamknij';
        closeTooltipBtn.onclick = (e) => {
            e.stopPropagation();
            globalTooltip.style.display = 'none';
        };

        globalTooltip.appendChild(tooltipContent);
        globalTooltip.appendChild(closeTooltipBtn);
        panel.appendChild(globalTooltip); // Dymek staje się nadrzędny wobec siatki

        panelBody.appendChild(sidebar);
        panelBody.appendChild(contentArea);
        panel.appendChild(panelBody);

        opener.onclick = () => {
            panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none';
        };

        if (isPinned) {
            const t = localStorage.getItem('tw_panel_top');
            const l = localStorage.getItem('tw_panel_left');
            if (t && l) {
                panel.style.top = t;
                panel.style.left = l;
            }
        }

        document.body.appendChild(panel);
        makeDraggable(panel, header);

        if (isDark && darkThemeConfig) {
            toggleDarkTheme(darkThemeConfig.url, true);
        }
    }

    async function loadActiveScripts(scriptsArray) {
        if (!scriptsArray || !Array.isArray(scriptsArray)) return;
        const state = getScriptsState();
        const currentUrl = window.location.href;

        for (const script of scriptsArray) {
            if (script.id === 'ciemny_motyw') continue;

            if (state[script.id]) {
                if (!script.screens || !Array.isArray(script.screens)) continue;
                
                let shouldRun = false;
                if (script.screens.includes('*')) {
                    shouldRun = true;
                } else {
                    for (const screenPart of script.screens) {
                        if (currentUrl.includes(screenPart)) {
                            shouldRun = true;
                            break;
                        }
                    }
                }

                if (!shouldRun) continue;

                try {
                    const scriptUrl = script.url.includes('?') ? `${script.url}&t=${Date.now()}` : `${script.url}?t=${Date.now()}`;
                    const response = await fetch(scriptUrl);
                    if (response.ok) {
                        const code = await response.text();
                        const scriptEl = document.createElement('script');
                        scriptEl.type = 'text/javascript';
                        scriptEl.textContent = code;
                        document.head.appendChild(scriptEl);
                    }
                } catch (error) {
                    console.error("TCM Menedżer: Błąd ładowania skryptu", error);
                }
            }
        }
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragStart;
        handle.ontouchstart = dragStart;

        function dragStart(e) {
            if (localStorage.getItem('tw_panel_pinned') === '1') return;
            if (e.target.className === 'tw-header-btn') return;
            
            e = e || window.event;
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (e.type === 'touchstart') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            
            pos3 = clientX;
            pos4 = clientY;
            
            document.onmouseup = dragEnd;
            document.onmousemove = dragMove;
            document.ontouchend = dragEnd;
            document.ontouchmove = dragMove;
        }

        function dragMove(e) {
            e = e || window.event;
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            
            pos1 = pos3 - clientX;
            pos2 = pos4 - clientY;
            pos3 = clientX;
            pos4 = clientY;
            
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function dragEnd() {
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        }
    }

    async function initManager() {
        loadCustomCSS(); 
        let fetchedScripts = [];

        if (CONFIG_URL && CONFIG_URL.startsWith('http')) {
            try {
                const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`);
                if(response.ok) {
                    fetchedScripts = await response.json();
                    if (!Array.isArray(fetchedScripts)) {
                        fetchedScripts = fetchedScripts.scripts || [];
                    }
                }
            } catch (error) {
                console.error("TCM Menedżer: Błąd JSON", error);
            }
        }
        
        buildPanel(fetchedScripts);
        await loadActiveScripts(fetchedScripts);
    }

    initManager();
})();
