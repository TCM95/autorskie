// ==UserScript==
// @name         Menedżer TCM
// @namespace    https://viayoo.com/
// @description  Menedżer skryptów z rozwijanym menu, układem kolumnowym i poprawnymi dymkami
// @author       TCM
// @match        https://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/confing.json'; 
    const CSS_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/style.css';
    const STORAGE_KEY = 'tw_scripts_state';
    const DARK_THEME_KEY = 'tw_dark_theme';
    
    const CATEGORIES = ["Ogólne", "Atak/obrona", "Budowa/rekrutacja", "Farma/zbieractwo", "Surowce", "Mapa"];
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

    async function loadExternalCSS() {
        try {
            const response = await fetch(`${CSS_URL}?t=${Date.now()}`);
            if (response.ok) {
                const cssText = await response.text();
                const style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = cssText;
                document.head.appendChild(style);
            }
        } catch (error) {
            console.error("TCM Menedżer: Błąd pobierania pliku style.css", error);
        }

        // Łatka CSS - Poprawa dymków, z-index i kompaktowego rozmiaru
        const customFix = document.createElement('style');
        customFix.type = 'text/css';
        customFix.innerHTML = `
            #tw-script-panel { 
                width: max-content !important; 
                height: max-content !important;
                background: #e3d5b3; /* Tło na wypadek, by ładnie wyglądało przed załadowaniem stylów */
                border: 2px solid #804000;
            }
            #tw-script-panel-header { 
                z-index: 1 !important; 
                position: relative; 
            }
            #tw-panel-body { 
                display: flex; 
                align-items: flex-start; 
                position: relative;
            }
            #tw-sidebar { 
                display: flex; 
                flex-direction: column; 
                min-width: 130px; 
                z-index: 1 !important; 
            }
            #tw-content-area { 
                display: none; 
                flex-flow: column wrap; 
                max-height: 220px; /* Wysokość dopasowana do słupka kategorii */
                align-content: flex-start; /* Zapobiega niepotrzebnemu rozciąganiu w poziomie */
                overflow: visible !important; /* Pozwala dymkom wyjść poza krawędź! */
                padding-left: 5px;
                gap: 5px;
                z-index: 100 !important; /* Wymuszenie nad nagłówkiem i kategoriami */
                position: relative;
            }
            .tw-script-item { 
                margin: 0; 
                min-width: 140px; 
                position: relative;
                z-index: inherit;
            }
            .tw-info-icon { 
                position: relative; 
                cursor: help;
            }
            .tw-tooltip { 
                z-index: 999999 !important; 
                white-space: normal; 
                min-width: 180px; 
                position: absolute;
                top: 100%; /* Wyświetla pod ikonką */
                right: 0; /* Zrównane z prawą krawędzią ikonki */
                background: #f4e4bc;
                border: 1px solid #7d510f;
                padding: 5px;
                color: #000;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
                font-size: 11px;
                margin-top: 5px;
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
            const msg = document.createElement('div');
            msg.className = 'tw-empty-msg';
            msg.innerText = 'Brak skryptów.';
            container.appendChild(msg);
            return;
        }

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

            const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Brak';
            const tooltip = document.createElement('div');
            tooltip.className = 'tw-tooltip';
            tooltip.innerHTML = `<strong>Opis:</strong> ${script.description || 'Brak.'}<br><br><strong>Działa na (screens):</strong> ${screensInfo}`;

            infoIcon.appendChild(tooltip);
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
        document.body.appendChild(opener);

        const panel = document.createElement('div');
        panel.id = 'tw-script-panel';
        panel.style.display = 'none';

        const header = document.createElement('div');
        header.id = 'tw-script-panel-header';
        
        const titleSpan = document.createElement('span');
        titleSpan.innerText = 'MENU';
        
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.gap = '3px';

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
                    contentArea.style.display = 'flex';
                    renderScripts(scriptsArray, contentArea);
                }
            };
            sidebar.appendChild(tab);
        });

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
        
        const urlParams = new URLSearchParams(window.location.search);
        const currentScreen = urlParams.get('screen') || 'overview'; 

        for (const script of scriptsArray) {
            if (script.id === 'ciemny_motyw') continue;

            if (state[script.id]) {
                if (!script.screens || !Array.isArray(script.screens)) continue;
                if (!script.screens.includes(currentScreen) && !script.screens.includes('*')) continue;

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
        await loadExternalCSS(); 
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
