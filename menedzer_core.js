(function() {
    'use strict';

    const CONFIG_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/config.json';
    const STORAGE_KEY = 'tw_scripts_state';
    const DARK_THEME_KEY = 'tw_dark_theme';

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
                width: 210px;
                background-color: #e3d5b3;
                border: 2px solid #804000;
                border-radius: 3px;
                z-index: 99999;
                font-family: Verdana, Arial, sans-serif;
                font-size: 11px;
                box-shadow: 2px 2px 10px rgba(0,0,0,0.5);
            }
            #tw-script-panel-header {
                background-color: #c1a264;
                border-bottom: 1px solid #804000;
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
            .tw-script-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 6px;
                border-bottom: 1px dotted #804000;
                gap: 5px;
            }
            .tw-game-btn {
                flex-grow: 1;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                background: linear-gradient(to bottom, #f4e4bc 0%, #c1a473 100%);
                border: 1px solid #7d510f;
                border-radius: 3px;
                padding: 4px 6px;
                cursor: pointer;
                user-select: none;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
                transition: background 0.1s;
                text-decoration: none;
                color: #2b1d0c;
            }
            .tw-game-btn:active {
                background: linear-gradient(to bottom, #c1a473 0%, #f4e4bc 100%);
            }
            .tw-status-icon {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 6px;
                box-shadow: inset 1px 1px 2px rgba(0,0,0,0.3);
                flex-shrink: 0;
            }
            .tw-status-on { background-color: #4caf50; border: 1px solid #2e7d32; }
            .tw-status-off { background-color: #f44336; border: 1px solid #c62828; }
            
            .tw-script-name {
                font-weight: bold;
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .tw-info-icon {
                position: relative;
                font-size: 13px;
                color: #593108;
                cursor: pointer;
                padding: 2px 4px;
                font-weight: bold;
                background: #f4e4bc;
                border: 1px solid #7d510f;
                border-radius: 3px;
                line-height: 1;
            }
            .tw-tooltip {
                display: none;
                position: absolute;
                bottom: 125%;
                right: 0;
                width: 150px;
                background-color: #f4e4bc;
                border: 1px solid #804000;
                padding: 5px;
                border-radius: 3px;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.4);
                z-index: 100001;
                color: #000;
                text-align: left;
                font-size: 10px;
                font-weight: normal;
                line-height: 1.2;
                pointer-events: none;
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
            #tw-loading-msg {
                padding: 8px;
                text-align: center;
                font-style: italic;
                color: #593108;
                font-size: 10px;
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

    function buildPanel(scriptsArray) {
        const state = getScriptsState();
        const darkThemeConfig = scriptsArray.find(s => s.id === 'ciemny_motyw');
        const filteredScripts = scriptsArray.filter(s => s.id !== 'ciemny_motyw');

        const opener = document.createElement('div');
        opener.id = 'tw-panel-opener';
        opener.innerText = '⚙️';
        document.body.appendChild(opener);

        const panel = document.createElement('div');
        panel.id = 'tw-script-panel';

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

        if (!filteredScripts || filteredScripts.length === 0) {
            const errorMsg = document.createElement('div');
            errorMsg.id = 'tw-loading-msg';
            errorMsg.innerText = 'Brak skryptów.';
            panel.appendChild(errorMsg);
        } else {
            filteredScripts.forEach(script => {
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
                    if(newState) location.reload();
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
                panel.appendChild(item);
            });
        }

        document.body.appendChild(panel);
        makeDraggable(panel, header);

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
