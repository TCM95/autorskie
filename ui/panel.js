window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    const darkThemeConfig = scriptsArray.find(s => s.id === 'ciemny_motyw');
    let currentCategory = null;

    let globalTooltip = document.getElementById('tw-global-tooltip');
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.id = 'tw-global-tooltip';
        globalTooltip.style.display = 'none';
        globalTooltip.style.position = 'absolute';
        document.body.appendChild(globalTooltip);
    }

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tw-info-icon')) {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';
        }
    });

    const opener = document.createElement('button');
    opener.id = 'tw-panel-opener';
    opener.innerHTML = `<img src="${window.location.origin}/favicon.ico" style="width: 80%; height: 80%; pointer-events: none;">`;

    document.body.appendChild(opener);

    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
    // Wymuszenie zachowania dotyku dla starych przeglądarek
    header.style.cssText = 'touch-action: none; -webkit-touch-callout: none; user-select: none;';
    
    const titleSpan = document.createElement('span');
    titleSpan.innerText = 'Menu';
    
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '4px';

    const iconDark = '☾';
    const iconLight = '☼';

    const themeBtn = document.createElement('button');
    themeBtn.className = 'tw-header-btn';
    let isDark = localStorage.getItem('tw_dark_theme') === '1';
    themeBtn.innerText = isDark ? iconDark : iconLight;
    themeBtn.onclick = async () => {
        isDark = !isDark;
        themeBtn.innerText = isDark ? iconDark : iconLight;
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

            const infoIcon = document.createElement('button');
            infoIcon.className = 'tw-info-icon';
            infoIcon.innerText = 'i';
            
            infoIcon.onclick = (e) => {
                e.stopPropagation();
                if (globalTooltip.dataset.activeId === script.id && globalTooltip.style.display === 'block') {
                    globalTooltip.style.display = 'none';
                    globalTooltip.dataset.activeId = '';
                } else {
                    const rect = infoIcon.getBoundingClientRect();
                    const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Wszystkie';
                    
                    globalTooltip.innerHTML = `<strong style="color: #ffffdf;">${script.name}</strong><br><hr style="border: 0; border-bottom: 1px solid #3e4147; margin: 4px 0;"><strong>Opis:</strong> ${script.description || 'Brak.'}<br><strong>Strony:</strong> ${screensInfo}`;
                    
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
        tab.className = 'tw-tab';
        tab.innerText = cat;
        tab.onclick = () => {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';
            
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

    opener.onclick = () => { 
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.setProperty('display', 'flex', 'important');
        } else {
            panel.style.setProperty('display', 'none', 'important');
            globalTooltip.style.display = 'none';
        }
    };

    document.body.appendChild(panel);

    // --- BRUTALNA OBSŁUGA DRAG & DROP DLA URZĄDZEŃ MOBILNYCH ---
    let isDragging = false;
    let initialX = 0, initialY = 0;
    let startX = 0, startY = 0;

    function dragStart(e) {
        // Ignoruj, jeśli przypięto okno lub kliknięto przyciski w nagłówku
        if (localStorage.getItem('tw_panel_pinned') === '1' || e.target.closest('.tw-header-btn')) return;

        // Wyciąganie pozycji w zależności od tego, czy to dotyk, czy myszka
        if (e.type === "touchstart") {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }

        const rect = panel.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        // Twarde wymuszenie swobodnego latania
        panel.style.position = 'fixed';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        panel.style.margin = '0';
        panel.style.transform = 'none';
        
        panel.style.left = initialX + 'px';
        panel.style.top = initialY + 'px';

        isDragging = true;

        // Nasłuchujemy przesuwania na całym dokumencie! { passive: false } jest tu najważniejsze
        document.addEventListener('mousemove', dragMove, { passive: false });
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    function dragMove(e) {
        if (!isDragging) return;
        
        // TO BLOKUJE SCROLLOWANIE STRONY W TELEFONIE!
        if (e.cancelable) e.preventDefault(); 

        let currentX, currentY;
        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        const dx = currentX - startX;
        const dy = currentY - startY;

        panel.style.left = (initialX + dx) + 'px';
        panel.style.top = (initialY + dy) + 'px';
    }

    function dragEnd() {
        if (!isDragging) return;
        isDragging = false;

        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }

       // Podpinamy start przesuwania do nagłówka ORAZ do ikony otwierającej
    header.addEventListener('mousedown', dragStart, { passive: false });
    header.addEventListener('touchstart', dragStart, { passive: false });
    
    opener.addEventListener('mousedown', dragStart, { passive: false });
    opener.addEventListener('touchstart', dragStart, { passive: false });

    header.addEventListener('touchstart', dragStart, { passive: false });

    // Włączenie ciemnego motywu jeśli był wcześniej aktywny
    if (isDark && darkThemeConfig && callbacks.onToggleTheme) {
        callbacks.onToggleTheme(darkThemeConfig.url, true);
    }
};
