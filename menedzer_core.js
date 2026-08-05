(function() {
    'use strict';

    const CONFIG_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/confing.json'; 
    const STORAGE_KEY = 'tw_scripts_state';
    const DARK_THEME_KEY = 'tw_dark_theme';
    
    // Lista zakładek
    const CATEGORIES = ["Ogólne", "Atak", "Obrona", "Mapa", "Surowce", "Zbieractwo", "Farma", "Etykiety"];
    let currentCategory = "Ogólne";

    function getScriptsState() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    }

    function saveScriptState(id, isActive) {
        const state = getScriptsState();
        state[id] = isActive;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function injectStyles() {
        const css = `
            #tw-panel-opener {
                position: fixed;
                top: 5px;
                left: 5px;
                width: 30px;
                height: 30px;
                z-index: 100000;
                background: linear-gradient(to bottom, #f4e4bc 0%, #c1a473 100%);
                border: 2px solid #804000;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                cursor: pointer;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
                color: #593108;
            }
            #tw-script-panel {
                display: none;
                position: fixed;
                top: 45px;
                left: 10px;
                width: 90vw;
                max-width: 480px;
                background-color: #e3d5b3;
                border: 2px solid #804000;
                border-radius: 3px;
                z-index: 99999;
                font-family: Verdana, Arial, sans-serif;
                font-size: 11px;
                box-shadow: 2px 2px 10px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
            }
            #tw-script-panel-header {
                background-color: #c1a264;
                border-bottom: 2px solid #804000;
                padding: 4px 6px;
                font-weight: bold;
                text-align: center;
                cursor: move;
                color: #593108;
                touch-action: none;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
            }
            #tw-panel-body {
                display: flex;
                flex-direction: row;
                height: 250px; /* Stała wysokość dla scrolla na telefonach */
            }
            #tw-sidebar {
                width: 90px;
                background-color: #f4e4bc;
                border-right: 2px solid #804000;
                overflow-y: auto;
                flex-shrink: 0;
            }
            .tw-tab {
                padding: 8px 5px;
                border-bottom: 1px solid #c1a264;
                cursor: pointer;
                font-weight: bold;
                color: #593108;
                text-align: center;
                transition: background 0.1s;
                font-size: 10px;
            }
            .tw-tab:hover {
                background-color: #e3d5b3;
            }
            .tw-tab.active {
                background-color: #c1a264;
                color: #2b1d0c;
                border-right: 2px solid #c1a264;
                margin-right: -2px; /* nachodzi na ramkę */
            }
            #tw-content-area {
                flex-grow: 1;
                padding: 8px;
                display: flex;
                flex-wrap: wrap;
                align-content: flex-start;
                gap: 6px;
                overflow-y: auto;
                background-color: #e3d5b3;
            }
            .tw-script-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: calc(50% - 3px);
                min-width: 130px;
                background: linear-gradient(to bottom, #f4e4bc 0%, #c1a473 100%);
                border: 1px solid #7d510f;
                border-radius: 3px;
                padding: 2px;
                box-sizing: border-box;
            }
            .tw-game-btn {
                flex-grow: 1;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                padding: 4px;
                cursor: pointer;
                user-select: none;
                color: #2b1d0c;
                overflow: hidden;
            }
            .tw-status-icon {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 4px;
                box-shadow: inset 1px 1px 2px rgba(0,0,0,0.3);
                flex-shrink: 0;
            }
            .tw-status-on { background-color: #4caf50; border: 1px solid #2e7d32; }
            .tw-status-off { background-color: #f44336; border: 1px solid #c62828; }
            
            .tw-script-name {
                font-weight: bold;
                font-size: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .tw-info-icon {
                position: relative;
                font-size: 11px;
                color: #593108;
                cursor: pointer;
                padding: 2px 4px;
                font-weight: bold;
                background: #f4e4bc;
                border-left: 1px solid #7d510f;
                line-height: 1;
                height: 100%;
                display: flex;
                align-items: center;
            }
            .tw-tooltip {
                display: none;
                position: absolute;
                bottom: 125%;
                right: 0;
                width: 140px;
                background-color: #f4e4bc;
                border: 1px solid #804000;
                padding: 5px;
                border-radius: 3px;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.4);
                z-index: 100001;
                color: #000;
                text-align: left;
                font-size: 9px;
                font-weight: normal;
                line-height: 1.2;
                pointer-events: none;
                white-space: normal;
            }
            .tw-info-icon:hover .tw-tooltip,
            .tw-info-icon:active .tw-tooltip {
                display: block;
            }

            .tw-header-btn {
                cursor: pointer;
                font-size: 12px;
                padding: 0 2px;
                user-select: none;
            }
            .tw-empty-msg {
                width: 100%;
                text-align: center;
                padding: 15px;
                font-style: italic;
                color: #804000;
            }
        `;
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
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
        
        // Filtrowanie po kategorii. Jeśli skrypt nie ma zdefiniowanej kategorii, trafia do "Ogólne"
        const filtered = scriptsArray.filter(s => {
            if (s.id === 'ciemny_motyw') return false;
            const cat = s.category || "Ogólne";
            return cat === currentCategory;
        });

        if (filtered.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'tw-empty-msg';
            msg.innerText = 'Brak skryptów w tej zakładce.';
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

            // ZMIANA: Usunięto location.reload(). Skrypt włącza się w tle.
            gameBtn.addEventListener('click', () => {
                const newState = !state[script.id];
                state[script.id] = newState;
                saveScriptState(script.id, newState);
                statusIcon.className = `tw-status-icon ${newState ? 'tw-status-on' : 'tw-status-off'}`;
            });

            const infoIcon = document.createElement('span');
            infoIcon.className = 'tw-info-icon';
            infoIcon.innerText = 'ⓘ';

            const tooltip = document.createElement('div');
            tooltip.className = 'tw-tooltip';
            tooltip.innerHTML = `<strong>Opis:</strong> ${script.description || 'Brak opisu.'}`;

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
        opener.innerText = '⚙️';
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
        closeBtn.onclick = () => panel.style.display = 'none';
        
        controls.appendChild(themeBtn);
        controls.appendChild(pinBtn);
        controls.appendChild(closeBtn);
        
        header.appendChild(titleSpan);
        header.appendChild(controls);
        panel.appendChild(header);

        // BUDOWA CIAŁA (ZAKŁADKI + OBSZAR ROBOCZY)
        const panelBody = document.createElement('div');
        panelBody.id = 'tw-panel-body';

        const sidebar = document.createElement('div');
        sidebar.id = 'tw-sidebar';

        const contentArea = document.createElement('div');
        contentArea.id = 'tw-content-area';

        CATEGORIES.forEach(cat => {
            const tab = document.createElement('div');
            tab.className = 'tw-tab' + (cat === currentCategory ? ' active' : '');
            tab.innerText = cat;
            
            tab.onclick = () => {
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentCategory = cat;
                renderScripts(scriptsArray, contentArea);
            };
            sidebar.appendChild(tab);
        });

        panelBody.appendChild(sidebar);
        panelBody.appendChild(contentArea);
        panel.appendChild(panelBody);

        opener.onclick = () => {
            panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'flex' : 'none';
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

        // Wyrenderowanie pierwszej domyślnej zakładki (Ogólne)
        renderScripts(scriptsArray, contentArea);

        if (isDark && darkThemeConfig) {
            toggleDarkTheme(darkThemeConfig.url, true);
        }
    }

    async function loadActiveScripts(scriptsArray) {
        if (!scriptsArray) return;
        const state = getScriptsState();
        
        for (const script of scriptsArray) {
            if (script.id === 'ciemny_motyw') continue;

            if (state[script.id]) {
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
                    console.error(`TCM Menedżer: Błąd ładowania ${script.name}`, error);
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
        injectStyles();
        let fetchedScripts = [];

        if (CONFIG_URL && CONFIG_URL.startsWith('http')) {
            try {
                const fetchUrl = CONFIG_URL.includes('?') ? `${CONFIG_URL}&t=${Date.now()}` : `${CONFIG_URL}?t=${Date.now()}`;
                const response = await fetch(fetchUrl);
                if(response.ok) {
                    fetchedScripts = await response.json();
                }
            } catch (error) {
                console.error("TCM Menedżer: Błąd pobierania JSON.", error);
            }
        }
        
        buildPanel(fetchedScripts);
        await loadActiveScripts(fetchedScripts);
    }

    initManager();
})();
