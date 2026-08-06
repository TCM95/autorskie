window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    const darkThemeConfig = scriptsArray.find(s => s.id === 'ciemny_motyw');
    let currentCategory = null;

    // Gwarancja pozycji ikony w lewym górnym rogu
    const opener = document.createElement('div');
    opener.id = 'tw-panel-opener';
    opener.innerHTML = `<img src="${window.location.origin}/favicon.ico" style="width: 20px; height: 20px; pointer-events: none;">`;
    opener.style.cssText = 'position: fixed !important; top: 5px !important; left: 5px !important; z-index: 100000 !important; cursor: pointer;';
    document.body.appendChild(opener);

    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';
    // Gwarancja stylów panelu na wypadek gdyby zewnętrzny CSS się spóźnił
    panel.style.cssText = 'display: none; position: fixed !important; top: 45px !important; left: 10px !important; z-index: 99999 !important; background-color: #e3d5b3 !important; border: 2px solid #804000 !important; flex-direction: column !important;';

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
    header.style.cssText = 'background-color: #c1a264 !important; border-bottom: 2px solid #804000 !important; padding: 4px 6px !important; font-weight: bold !important; display: flex !important; justify-content: space-between !important; align-items: center !important; cursor: move !important; color: #593108 !important;';
    
    const titleSpan = document.createElement('span');
    titleSpan.innerText = 'Menedżer TCM';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex !important; gap: 5px !important;';

    const themeBtn = document.createElement('span');
    themeBtn.className = 'tw-header-btn';
    let isDark = localStorage.getItem('tw_dark_theme') === '1';
    themeBtn.innerText = isDark ? '🌙' : '☀️';
    themeBtn.onclick = async () => {
        isDark = !isDark;
        themeBtn.innerText = isDark ? '🌙' : '☀️';
        if (darkThemeConfig && callbacks.onToggleTheme) {
            await callbacks.onToggleTheme(darkThemeConfig.url, isDark);
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
    closeBtn.onclick = () => { panel.style.setProperty('display', 'none', 'important'); };
    
    controls.appendChild(themeBtn);
    controls.appendChild(pinBtn);
    controls.appendChild(closeBtn);
    header.appendChild(titleSpan);
    header.appendChild(controls);
    panel.appendChild(header);

    const panelBody = document.createElement('div');
    panelBody.id = 'tw-panel-body';
    panelBody.style.cssText = 'display: flex !important; flex-direction: row !important; height: 250px !important;';

    const sidebar = document.createElement('div');
    sidebar.id = 'tw-sidebar';
    sidebar.style.cssText = 'width: 90px !important; background-color: #f4e4bc !important; border-right: 2px solid #804000 !important; overflow-y: auto !important; flex-shrink: 0 !important;';

    const contentArea = document.createElement('div');
    contentArea.id = 'tw-content-area';
    contentArea.style.cssText = 'flex-grow: 1 !important; padding: 8px !important; display: flex !important; flex-wrap: wrap !important; align-content: flex-start !important; gap: 6px !important; overflow-y: auto !important; background-color: #e3d5b3 !important;';

    function renderScripts() {
        contentArea.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => s.id !== 'ciemny_motyw' && (s.category || "Ogólne") === currentCategory);

        if (filtered.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'tw-empty-msg';
            emptyMsg.style.cssText = 'width: 100% !important; text-align: center !important; padding: 15px !important; font-style: italic !important; color: #804000 !important;';
            emptyMsg.innerText = 'Brak skryptów.';
            contentArea.appendChild(emptyMsg);
            return;
        }

        filtered.forEach(script => {
            const isActive = state[script.id] === true;
            const item = document.createElement('div');
            item.className = 'tw-script-item';
            item.style.cssText = 'display: flex !important; align-items: center !important; justify-content: space-between !important; width: calc(50% - 3px) !important; min-width: 130px !important; background: #f4e4bc !important; border: 1px solid #7d510f !important; border-radius: 3px !important; padding: 2px !important; box-sizing: border-box !important;';

            const gameBtn = document.createElement('div');
            gameBtn.className = 'tw-game-btn';
            gameBtn.style.cssText = 'flex-grow: 1 !important; display: flex !important; align-items: center !important; padding: 4px !important; cursor: pointer !important; color: #2b1d0c !important;';
            
            const statusIcon = document.createElement('span');
            statusIcon.className = `tw-status-icon ${isActive ? 'tw-status-on' : 'tw-status-off'}`;
            statusIcon.style.cssText = `display: inline-block !important; width: 8px !important; height: 8px !important; border-radius: 50% !important; margin-right: 4px !important; background-color: ${isActive ? '#4caf50' : '#f44336'} !important; border: 1px solid ${isActive ? '#2e7d32' : '#c62828'} !important;`;
            
            const nameLabel = document.createElement('span');
            nameLabel.className = 'tw-script-name';
            nameLabel.style.cssText = 'font-weight: bold !important; font-size: 10px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;';
            nameLabel.innerText = script.name;

            gameBtn.appendChild(statusIcon);
            gameBtn.appendChild(nameLabel);
            gameBtn.onclick = () => {
                const newState = !state[script.id];
                callbacks.saveScriptState(script.id, newState);
                statusIcon.style.backgroundColor = newState ? '#4caf50' : '#f44336';
                statusIcon.style.border = `1px solid ${newState ? '#2e7d32' : '#c62828'}`;
                state[script.id] = newState;
            };

            const infoIcon = document.createElement('span');
            infoIcon.className = 'tw-info-icon';
            infoIcon.style.cssText = 'position: relative !important; font-size: 11px !important; color: #593108 !important; cursor: pointer !important; padding: 2px 4px !important; font-weight: bold !important; background: #f4e4bc !important; border-left: 1px solid #7d510f !important;';
            infoIcon.innerText = 'ⓘ';
            
            const tooltip = document.createElement('div');
            tooltip.className = 'tw-tooltip';
            tooltip.style.cssText = 'display: none; position: absolute !important; bottom: 125% !important; right: 0 !important; width: 140px !important; background-color: #f4e4bc !important; border: 1px solid #804000 !important; padding: 5px !important; border-radius: 3px !important; z-index: 100001 !important; color: #000 !important; font-size: 9px !important; text-align: left !important;';
            
            const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Brak';
            tooltip.innerHTML = `<strong>${script.name}</strong><br><hr style="border: 0; border-bottom: 1px solid #c1a264; margin: 3px 0;"><strong>Opis:</strong> ${script.description || 'Brak.'}<br><strong>Strony:</strong> ${screensInfo}`;
            
            infoIcon.onmouseenter = infoIcon.ontouchstart = () => { tooltip.style.display = 'block'; };
            infoIcon.onmouseleave = infoIcon.ontouchend = () => { tooltip.style.display = 'none'; };

            infoIcon.appendChild(tooltip);
            item.appendChild(gameBtn);
            item.appendChild(infoIcon);
            contentArea.appendChild(item);
        });
    }

    categories.forEach(cat => {
        const tab = document.createElement('div');
        tab.className = 'tw-tab';
        tab.style.cssText = 'padding: 8px 5px !important; border-bottom: 1px solid #c1a264 !important; cursor: pointer !important; font-weight: bold !important; color: #593108 !important; text-align: center !important; font-size: 10px !important; background-color: #f4e4bc !important;';
        tab.innerText = cat;
        tab.onclick = () => {
            if (currentCategory === cat) {
                currentCategory = null;
                tab.style.backgroundColor = '#f4e4bc';
                contentArea.innerHTML = '';
            } else {
                document.querySelectorAll('.tw-tab').forEach(t => t.style.backgroundColor = '#f4e4bc');
                tab.style.backgroundColor = '#c1a264';
                currentCategory = cat;
                renderScripts();
            }
        };
        sidebar.appendChild(tab);
    });

    panelBody.appendChild(sidebar);
    panelBody.appendChild(contentArea);
    panel.appendChild(panelBody);

    opener.onclick = () => { 
        const currentDisplay = window.getComputedStyle(panel).display;
        if (currentDisplay === 'none') {
            panel.style.setProperty('display', 'flex', 'important');
        } else {
            panel.style.setProperty('display', 'none', 'important');
        }
    };

    if (isPinned) {
        const t = localStorage.getItem('tw_panel_top');
        const l = localStorage.getItem('tw_panel_left');
        if (t && l) { panel.style.top = t; panel.style.left = l; }
    }

    document.body.appendChild(panel);

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = header.ontouchstart = dragStart;

    function dragStart(e) {
        if (localStorage.getItem('tw_panel_pinned') === '1' || e.target.className === 'tw-header-btn') return;
        const ev = e.type === 'touchstart' ? e.touches[0] : e;
        pos3 = ev.clientX; pos4 = ev.clientY;
        document.onmouseup = document.ontouchend = dragEnd;
        document.onmousemove = document.ontouchmove = dragMove;
    }

    function dragMove(e) {
        const ev = e.type === 'touchmove' ? e.touches[0] : e;
        pos1 = pos3 - ev.clientX; pos2 = pos4 - ev.clientY;
        pos3 = ev.clientX; pos4 = ev.clientY;
        panel.style.top = (panel.offsetTop - pos2) + "px";
        panel.style.left = (panel.offsetLeft - pos1) + "px";
    }

    function dragEnd() {
        document.onmouseup = document.onmousemove = document.ontouchend = document.ontouchmove = null;
    }

    if (isDark && darkThemeConfig && callbacks.onToggleTheme) {
        callbacks.onToggleTheme(darkThemeConfig.url, true);
    }
};
