window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    const darkThemeConfig = scriptsArray.find(s => s.id === 'ciemny_motyw');
    let currentCategory = null;

    let globalTooltip = document.getElementById('tw-global-tooltip');
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.id = 'tw-global-tooltip';
        globalTooltip.className = 'vis popup_box';
        globalTooltip.style.cssText = `
            display: none; position: absolute; z-index: 999999999;
            padding: 6px 8px; width: 190px; font-size: 10px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.7); line-height: 1.3;
            text-align: left; pointer-events: none;
        `;
        document.body.appendChild(globalTooltip);
    }

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tw-info-icon')) {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';
        }
    });

    // Przycisk otwierający używający natywnej klasy Plemion "btn btn-default"
    const opener = document.createElement('button');
    opener.id = 'tw-panel-opener';
    opener.className = 'btn btn-default';
    opener.innerHTML = `<img src="${window.location.origin}/favicon.ico" style="width: 16px; height: 16px; pointer-events: none; vertical-align: middle;">`;
    document.body.appendChild(opener);

    // Główny panel jako tabelka systemowa Plemion (vis main_layout / main)
    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';
    panel.className = 'vis main_layout';

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
    header.className = 'head';
    
    const titleSpan = document.createElement('span');
    titleSpan.innerText = 'Menu';
    
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px';

    const themeBtn = document.createElement('button');
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

    const pinBtn = document.createElement('button');
    pinBtn.className = 'tw-header-btn';
    let isPinned = localStorage.getItem('tw_panel_pinned') === '1';
    pinBtn.innerText = isPinned ? '📍' : '📌';
    pinBtn.onclick = () => {
        isPinned = !isPinned;
        localStorage.setItem('tw_panel_pinned', isPinned ? '1' : '0');
        pinBtn.innerText = isPinned ? '📍' : '📌';
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tw-header-btn';
    closeBtn.innerText = '✕';
    closeBtn.onclick = () => { panel.style.display = 'none'; };
    
    controls.appendChild(themeBtn);
    controls.appendChild(pinBtn);
    controls.appendChild(closeBtn);
    header.appendChild(titleSpan);
    header.appendChild(controls);
    panel.appendChild(header);

    const categoriesBar = document.createElement('div');
    categoriesBar.id = 'tw-categories-bar';

    const contentArea = document.createElement('div');
    contentArea.id = 'tw-content-area';
    contentArea.className = 'vis';

    const contentInner = document.createElement('div');
    contentInner.className = 'tw-content-inner';
    contentArea.appendChild(contentInner);

    function renderScripts() {
        contentInner.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => s.id !== 'ciemny_motyw' && (s.category || "Ogólne") === currentCategory);

        if (filtered.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'text-align: center; color: #666; font-style: italic; padding: 8px;';
            emptyMsg.innerText = 'Brak skryptów w tej kategorii.';
            contentInner.appendChild(emptyMsg);
            return;
        }

        filtered.forEach(script => {
            const isActive = state[script.id] === true;
            const item = document.createElement('div');
            item.className = 'tw-script-item vis';

            const gameBtn = document.createElement('div');
            gameBtn.className = 'tw-game-btn';
            
            const statusIcon = document.createElement('span');
            statusIcon.className = `tw-status-icon ${isActive ? 'tw-status-on' : 'tw-status-off'}`;
            
            const nameLabel = document.createElement('span');
            nameLabel.className = 'tw-script-name';
            nameLabel.innerText = script.name;

            gameBtn.appendChild(statusIcon);
            gameBtn.appendChild(nameLabel);
            gameBtn.onclick = () => {
                const newState = !state[script.id];
                callbacks.saveScriptState(script.id, newState);
                statusIcon.className = `tw-status-icon ${newState ? 'tw-status-on' : 'tw-status-off'}`;
                state[script.id] = newState;
            };

            const infoIcon = document.createElement('button');
            infoIcon.className = 'tw-info-icon btn btn-default';
            infoIcon.innerText = 'i';
            
            infoIcon.onclick = (e) => {
                e.stopPropagation();
                if (globalTooltip.dataset.activeId === script.id && globalTooltip.style.display === 'block') {
                    globalTooltip.style.display = 'none';
                    globalTooltip.dataset.activeId = '';
                } else {
                    const rect = infoIcon.getBoundingClientRect();
                    const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Wszystkie';
                    
                    globalTooltip.innerHTML = `<strong>${script.name}</strong><br><hr style="border: 0; border-bottom: 1px solid #7d5e3c; margin: 3px 0;"><strong>Opis:</strong> ${script.description || 'Brak.'}<br><strong>Strony:</strong> ${screensInfo}`;
                    
                    globalTooltip.style.top = (rect.top + window.scrollY - 10) + 'px';
                    globalTooltip.style.left = (rect.right + window.scrollX + 10) + 'px';
                    globalTooltip.style.display = 'block';
                    globalTooltip.dataset.activeId = script.id;
                }
            };
            
            item.appendChild(gameBtn);
            item.appendChild(infoIcon);
            contentInner.appendChild(item);
        });
    }

    categories.forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'tw-tab btn btn-default';
        tab.innerText = cat;
        tab.onclick = () => {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';
            
            if (currentCategory === cat) {
                currentCategory = null;
                tab.classList.remove('btn-confirm-yes');
                contentArea.style.setProperty('display', 'none', 'important');
            } else {
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('btn-confirm-yes'));
                tab.classList.add('btn-confirm-yes');
                currentCategory = cat;
                renderScripts();
                contentArea.style.setProperty('display', 'block', 'important');
            }
        };
        categoriesBar.appendChild(tab);
    });

    panel.appendChild(categoriesBar);
    panel.appendChild(contentArea);

    opener.onclick = () => { 
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.setProperty('display', 'flex', 'important');
        } else {
            panel.style.setProperty('display', 'none', 'important');
            globalTooltip.style.display = 'none';
        }
    };

    document.body.appendChild(panel);

    // Poprawiony Drag & Drop dla mobilnych przeglądarek
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
        if (localStorage.getItem('tw_panel_pinned') === '1' || e.target.classList.contains('tw-header-btn')) return;
        
        const ev = e.type === 'touchstart' ? e.touches[0] : e;
        pos3 = ev.clientX;
        pos4 = ev.clientY;

        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('touchend', dragEnd);
        document.addEventListener('touchmove', dragMove, { passive: false });
    }

    function dragMove(e) {
        if (e.cancelable) e.preventDefault(); // Powstrzymuje przewijanie strony na telefonie

        const ev = e.type === 'touchmove' ? e.touches[0] : e;
        pos1 = pos3 - ev.clientX;
        pos2 = pos4 - ev.clientY;
        pos3 = ev.clientX;
        pos4 = ev.clientY;

        panel.style.top = (panel.offsetTop - pos2) + "px";
        panel.style.left = (panel.offsetLeft - pos1) + "px";
    }

    function dragEnd() {
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchend', dragEnd);
        document.removeEventListener('touchmove', dragMove);
    }

    if (isDark && darkThemeConfig && callbacks.onToggleTheme) {
        callbacks.onToggleTheme(darkThemeConfig.url, true);
    }
};
