window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    let currentCategory = null;

    const opener = document.createElement('div');
    opener.innerHTML = `<img src="${window.location.origin}/favicon.ico" style="width: 24px; height: 24px; pointer-events: none;">`;
    opener.style.cssText = 'display: flex; justify-content: center; align-items: center; cursor: pointer;';
    document.body.appendChild(opener);

    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';
    panel.style.display = 'none';

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
    
    const titleSpan = document.createElement('span');
    titleSpan.innerText = 'Menedżer TCM';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center;';

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
    closeBtn.onclick = () => { panel.style.display = 'none'; };
    
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

    const tooltipModule = window.TCM_UI.createTooltip(panel);

    function renderScripts() {
        contentArea.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => s.id !== 'ciemny_motyw' && (s.category || "Ogólne") === currentCategory);

        if (filtered.length === 0) {
            contentArea.style.display = 'block';
            contentArea.innerHTML = '<div style="padding:10px; font-weight:bold;">Brak skryptów.</div>';
            return;
        }

        contentArea.style.display = 'grid';
        contentArea.style.gridTemplateColumns = `repeat(${filtered.length === 1 ? 1 : 2}, 1fr)`;

        filtered.forEach(script => {
            const isActive = state[script.id] === true;
            const item = document.createElement('div');
            item.className = 'tw-script-item';

            const gameBtn = document.createElement('div');
            gameBtn.className = 'tw-game-btn';
            
            const statusIcon = document.createElement('span');
            statusIcon.className = `tw-status-icon ${isActive ? 'tw-status-on' : 'tw-status-off'}`;
            
            const nameLabel = document.createElement('span');
            nameLabel.innerText = script.name;

            gameBtn.appendChild(statusIcon);
            gameBtn.appendChild(nameLabel);
            gameBtn.onclick = () => {
                const newState = !state[script.id];
                callbacks.saveScriptState(script.id, newState);
                statusIcon.className = `tw-status-icon ${newState ? 'tw-status-on' : 'tw-status-off'}`;
                state[script.id] = newState;
            };

            const infoIcon = document.createElement('span');
            infoIcon.className = 'tw-info-icon';
            infoIcon.innerText = 'ⓘ';
            infoIcon.onclick = (e) => { e.stopPropagation(); tooltipModule.show(script.name, script.description, script.screens); };

            item.appendChild(gameBtn);
            item.appendChild(infoIcon);
            contentArea.appendChild(item);
        });
    }

    categories.forEach(cat => {
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
                renderScripts();
            }
        };
        sidebar.appendChild(tab);
    });

    panelBody.appendChild(sidebar);
    panelBody.appendChild(contentArea);
    panel.appendChild(panelBody);

    opener.onclick = () => { panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none'; };

    if (isPinned) {
        const t = localStorage.getItem('tw_panel_top');
        const l = localStorage.getItem('tw_panel_left');
        if (t && l) { panel.style.top = t; panel.style.left = l; }
    }

    document.body.appendChild(panel);

    // Obsługa przeciągania
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
};
