window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    let currentCategory = null;

    let globalTooltip = document.getElementById('tw-global-tooltip');
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.id = 'tw-global-tooltip';
        globalTooltip.className = 'tw-tooltip';
        document.body.appendChild(globalTooltip);
    }

    const savedOpenerPos = JSON.parse(localStorage.getItem('tw_opener_pos') || 'null');

    const opener = document.createElement('button');
    opener.id = 'tw-panel-opener';
    opener.className = 'tw-opener-closed'; 
    opener.innerHTML = `<img src="https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/ui/ikony/logo_tcm_tw1.png" alt="ikona" style="width:100%; height:100%; object-fit:contain;">`;
    opener.style.cssText = 'position: absolute !important; top: 60px !important; left: 10px !important; z-index: 999999 !important;';

    if (savedOpenerPos) {
        opener.style.setProperty('left', savedOpenerPos.x + 'px', 'important');
        opener.style.setProperty('top', savedOpenerPos.y + 'px', 'important');
    }

    document.body.appendChild(opener);

    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
    header.style.cssText = 'touch-action: none; -webkit-touch-callout: none; user-select: none;';

    const titleSpan = document.createElement('span');
    titleSpan.innerText = 'Menu';
    titleSpan.style.cssText = 'font-style: italic; letter-spacing: 1px;';

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px';

    const bellBtn = document.createElement('button');
    bellBtn.className = 'tw-square-btn tw-bell-btn'; 
    bellBtn.innerText = '🔔';
    bellBtn.onclick = () => console.log("Powiadomienia");

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tw-close-btn';
    closeBtn.innerText = 'X';

    closeBtn.onclick = () => { 
        panel.style.setProperty('display', 'none', 'important'); 
        opener.classList.remove('tw-opener-open');
        opener.classList.add('tw-opener-closed');
        globalTooltip.style.display = 'none';
    };

    controls.appendChild(bellBtn);
    controls.appendChild(closeBtn);
    header.appendChild(titleSpan);
    header.appendChild(controls);
    panel.appendChild(header);

    const categoriesBar = document.createElement('div');
    categoriesBar.id = 'tw-categories-bar';

    const contentArea = document.createElement('div');
    contentArea.id = 'tw-content-area';

    const contentInner = document.createElement('div');
    contentInner.className = 'tw-content-inner';
    contentArea.appendChild(contentInner);

    function updateCategoryStatus() {
        const state = callbacks.getScriptsState();
        document.querySelectorAll('.tw-tab').forEach(tab => {
            const catName = tab.innerText;
            const scriptsInCat = scriptsArray.filter(s => (s.category || "Ogólne") === catName);
            if (scriptsInCat.length === 0) return;
            const anyActive = scriptsInCat.some(script => state[script.id] === true);
            tab.classList.remove('cat-status-on', 'cat-status-off');
            tab.classList.add(anyActive ? 'cat-status-on' : 'cat-status-off');
        });
    }

    function renderScripts() {
        contentInner.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => (s.category || "Ogólne") === currentCategory);

        filtered.forEach(script => {
            const isActive = state[script.id] === true;
            const item = document.createElement('div');
            item.className = `tw-script-item ${isActive ? 'tw-item-on' : 'tw-item-off'}`;

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
                item.className = `tw-script-item ${newState ? 'tw-item-on' : 'tw-item-off'}`;
                state[script.id] = newState;
                if (globalTooltip.dataset.activeId === script.id) updateTooltipContent(script, newState);
                updateCategoryStatus();
            };

            const infoIcon = document.createElement('button');
            infoIcon.className = 'tw-square-btn tw-btn-active';
            infoIcon.innerText = 'i';

            infoIcon.onclick = (e) => {
                e.stopPropagation();
                if (globalTooltip.dataset.activeId === script.id && globalTooltip.style.display === 'block') {
                    globalTooltip.style.display = 'none';
                    globalTooltip.dataset.activeId = '';
                } else {
                    updateTooltipContent(script, state[script.id] === true);
                    globalTooltip.style.display = 'block';
                    globalTooltip.dataset.activeId = script.id;
                    const rect = infoIcon.getBoundingClientRect();
                    globalTooltip.style.top = (rect.top + window.scrollY - 10) + 'px';
                    globalTooltip.style.left = (rect.right + window.scrollX + 10) + 'px';
                }
            };

            item.appendChild(gameBtn);
            item.appendChild(infoIcon);
            contentInner.appendChild(item);
        });
    }

    function updateTooltipContent(script, isActive) {
        const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Wszystkie';
        const statusText = isActive ? 'Aktywny' : 'Wyłączony';
        globalTooltip.className = `tw-tooltip ${isActive ? 'tw-tooltip-active' : 'tw-tooltip-inactive'}`;
        globalTooltip.innerHTML = `
            <strong style="color: var(--title-color); font-size: 12px;">${script.name}</strong> 
            <span style="color: ${isActive ? 'var(--neon-green)' : 'var(--neon-red)'}; float: right; font-weight: bold;">[${statusText}]</span><br>
            <hr style="border: 0; border-bottom: 1px solid var(--border-color); margin: 6px 0;">
            <div style="line-height: 1.4;">
                <strong style="color: var(--text-color);">Opis:</strong> <span style="color: var(--text-color);">${script.description || 'Brak.'}</span><br>
                <strong style="margin-top:4px; display:inline-block; color: var(--text-color);">Strony:</strong> <span style="color: var(--title-color);">${screensInfo}</span>
            </div>`;
    }

    categories.forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'tw-tab';
        tab.innerText = cat;
        tab.onclick = () => {
            if (currentCategory === cat) {
                currentCategory = null;
                tab.classList.remove('active-tab');
                contentArea.style.setProperty('display', 'none', 'important');
            } else {
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active-tab'));
                tab.classList.add('active-tab');
                currentCategory = cat;
                renderScripts();
                contentArea.style.setProperty('display', 'block', 'important');
            }
        };
        categoriesBar.appendChild(tab);
    });

    panel.appendChild(categoriesBar);
    panel.appendChild(contentArea);
    document.body.appendChild(panel);
    updateCategoryStatus();
};
