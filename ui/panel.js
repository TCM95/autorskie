window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    const darkThemeConfig = scriptsArray.find(s => s.id === 'ciemny_motyw');
    let currentCategory = null;

    // Przycisk otwierający w lewym górnym rogu
    const opener = document.createElement('div');
    opener.id = 'tw-panel-opener';
    opener.innerHTML = `<img src="${window.location.origin}/favicon.ico" style="width: 20px; height: 20px; pointer-events: none; display: block;">`;
    document.body.appendChild(opener);

    // Główny panel - pionowy słupek
    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
    
    const titleSpan = document.createElement('span');
    titleSpan.innerText = 'TCM';
    
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px';

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
    };

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tw-header-btn';
    closeBtn.innerText = '✕';
    closeBtn.onclick = () => { panel.style.display = 'none'; };
    
    controls.appendChild(themeBtn);
    controls.appendChild(pinBtn);
    controls.appendChild(closeBtn);
    header.appendChild(titleSpan);
    header.appendChild(controls);
    panel.appendChild(header);

    // Pionowy pasek z kategoriami
    const categoriesBar = document.createElement('div');
    categoriesBar.id = 'tw-categories-bar';

    // Karta obszaru skryptów rozwijana po prawej stronie
    const contentArea = document.createElement('div');
    contentArea.id = 'tw-content-area';

    function renderScripts() {
        contentArea.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => s.id !== 'ciemny_motyw' && (s.category || "Ogólne") === currentCategory);

        if (filtered.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'tw-empty-msg';
            emptyMsg.innerText = 'Brak skryptów w tej kategorii.';
            contentArea.appendChild(emptyMsg);
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
            gameBtn.onclick = () => {
                const newState = !state[script.id];
                callbacks.saveScriptState(script.id, newState);
                statusIcon.className = `tw-status-icon ${newState ? 'tw-status-on' : 'tw-status-off'}`;
                state[script.id] = newState;
            };

            const infoIcon = document.createElement('span');
            infoIcon.className = 'tw-info-icon';
            infoIcon.innerText = 'ⓘ';
            
            const tooltip = document.createElement('div');
            tooltip.className = 'tw-tooltip';
            const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Wszystkie';
            tooltip.innerHTML = `<strong>${script.name}</strong><br><hr style="border: 0; border-bottom: 1px solid #7d5e3c; margin: 3px 0;"><strong>Opis:</strong> ${script.description || 'Brak.'}<br><strong>Strony:</strong> ${screensInfo}`;
            
            infoIcon.appendChild(tooltip);
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
                // Po ponownym kliknięciu w tę samą kategorię – zwijamy kartę boczną
                currentCategory = null;
                tab.classList.remove('active');
                contentArea.style.setProperty('display', 'none', 'important');
            } else {
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentCategory = cat;
                renderScripts();
                contentArea.style.setProperty('display', 'grid', 'important');
            }
        };
        categoriesBar.appendChild(tab);
    });

    panel.appendChild(categoriesBar);
    panel.appendChild(contentArea);

    // Kliknięcie w ikonę główną włącza/wyłącza pionowy słupek
    opener.onclick = () => { 
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.setProperty('display', 'flex', 'important');
        } else {
            panel.style.setProperty('display', 'none', 'important');
        }
    };

    document.body.appendChild(panel);

    // Drag and drop dla pionowego słupka
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = header.ontouchstart = dragStart;

    function dragStart(e) {
        if (localStorage.getItem('tw_panel_pinned') === '1' || e.target.className.includes('tw-header-btn')) return;
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
