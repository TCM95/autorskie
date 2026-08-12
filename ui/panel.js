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

    // --- ODCZYT ZAPISANYCH POZYCJI Z PAMIĘCI PRZEGLĄDARKI ---
    const savedOpenerPos = JSON.parse(localStorage.getItem('tw_opener_pos') || 'null');
    const savedPanelPos = JSON.parse(localStorage.getItem('tw_panel_pos') || 'null');

        const opener = document.createElement('button');
opener.id = 'tw-panel-opener';
opener.innerHTML = `<img src="https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/ui/ikony/logo_tcm_tw1.png" alt="ikona">`;
    
    // Twarde wymuszenie pozycji bezpośrednio w JS - omija cache CSS
    opener.style.cssText = 'position: absolute !important; top: 60px !important; left: 10px !important; z-index: 999999 !important;';
    
    document.body.appendChild(opener);

    
    // Aplikowanie zapisanej pozycji dla ikony startowej
    if (savedOpenerPos) {
        opener.style.setProperty('left', savedOpenerPos.x + 'px', 'important');
        opener.style.setProperty('top', savedOpenerPos.y + 'px', 'important');
    }

    document.body.appendChild(opener);

    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';

    // Aplikowanie zapisanej pozycji dla samego panelu
    if (savedPanelPos) {
        panel.style.setProperty('left', savedPanelPos.x + 'px', 'important');
        panel.style.setProperty('top', savedPanelPos.y + 'px', 'important');
    }

    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';
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

        // Przycisk Przypięcia (Pin)
    const pinBtn = document.createElement('button');
    pinBtn.className = 'tw-header-btn';
    let isPinned = localStorage.getItem('tw_panel_pinned') === '1';

    const pinImg = document.createElement('img');
    pinImg.src = isPinned 
        ? 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/ui/ikony/pin1.png' 
        : 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/ui/ikony/pin1.png'; // Możesz podmienić na drugi stan, jeśli masz oddzielną ikonę
    pinImg.style.width = '14px';
    pinImg.style.height = '14px';
    pinImg.style.verticalAlign = 'middle';
    
    // Jeśli stan wpływa na przezroczystość lub wygląd w stanie odpiętym:
    pinBtn.style.opacity = isPinned ? '1' : '0.6';

    pinBtn.appendChild(pinImg);
    pinBtn.onclick = () => {
        isPinned = !isPinned;
        localStorage.setItem('tw_panel_pinned', isPinned ? '1' : '0');
        pinBtn.style.opacity = isPinned ? '1' : '0.6';
    };

    // Przycisk Zamknięcia (X / Krzyżyk)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tw-header-btn';

    const closeImg = document.createElement('img');
    closeImg.src = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/ui/ikony/krzyzyk.png';
    closeImg.style.width = '14px';
    closeImg.style.height = '14px';
    closeImg.style.verticalAlign = 'middle';

    closeBtn.appendChild(closeImg);
    closeBtn.onclick = () => { 
        panel.style.setProperty('display', 'none', 'important'); 
        opener.style.setProperty('display', 'flex', 'important'); 
    };

        opener.style.setProperty('display', 'flex', 'important'); 
    };
    
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
    document.body.appendChild(panel);

    let wasDragged = false; 

    // Otwieranie panelu
    opener.onclick = (e) => { 
        if (wasDragged) return; 
        panel.style.setProperty('display', 'flex', 'important');
        opener.style.setProperty('display', 'none', 'important'); 
    };

        // Dwuetapowe zamykanie przy kliknięciu w tło
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tw-info-icon')) {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';
        }
        
        const clickedInsidePanel = e.target.closest('#tw-script-panel');
        const clickedOpener = e.target.closest('#tw-panel-opener');
        
        if (!clickedInsidePanel && !clickedOpener && panel.style.display !== 'none') {
            
            // KROK 1: Sprawdzamy fizycznie, czy rozwinięta jest lista skryptów (contentArea)
            if (contentArea.style.display === 'block') {
                // Jeśli tak -> zamykamy TYLKO kategorię
                currentCategory = null;
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active-tab'));
                contentArea.style.setProperty('display', 'none', 'important');
            } else {
                // KROK 2: Jeśli lista skryptów jest już schowana -> zamykamy CAŁY panel do małej ikony
                panel.style.setProperty('display', 'none', 'important');
                opener.style.setProperty('display', 'flex', 'important'); 
            }
            
        }
    });


    // --- OBSŁUGA DRAG & DROP Z ZAPISEM DO PAMIĘCI ---
    let isDragging = false;
    let draggedElement = null;
    let initialX = 0, initialY = 0;
    let startX = 0, startY = 0;

    function dragStart(e) {
        if (localStorage.getItem('tw_panel_pinned') === '1' || e.target.closest('.tw-header-btn')) return;

        draggedElement = (e.currentTarget === header) ? panel : opener;
        wasDragged = false;

        if (e.type === "touchstart") {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }

        const rect = draggedElement.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        draggedElement.style.setProperty('position', 'fixed', 'important');
        draggedElement.style.setProperty('bottom', 'auto', 'important');
        draggedElement.style.setProperty('right', 'auto', 'important');
        draggedElement.style.setProperty('margin', '0', 'important');
        draggedElement.style.setProperty('transform', 'none', 'important');
        
        draggedElement.style.setProperty('left', initialX + 'px', 'important');
        draggedElement.style.setProperty('top', initialY + 'px', 'important');

        isDragging = true;

        document.addEventListener('mousemove', dragMove, { passive: false });
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    function dragMove(e) {
        if (!isDragging || !draggedElement) return;
        
        if (e.cancelable) e.preventDefault(); 
        window.getSelection().removeAllRanges(); 

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

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            wasDragged = true; 
        }

        draggedElement.style.setProperty('left', (initialX + dx) + 'px', 'important');
        draggedElement.style.setProperty('top', (initialY + dy) + 'px', 'important');
    }

    function dragEnd() {
        if (!isDragging) return;
        
        // Zapisywanie pozycji po puszczeniu elementu (dla Panelu i Ikony niezależnie)
        if (draggedElement === opener) {
            localStorage.setItem('tw_opener_pos', JSON.stringify({
                x: parseInt(opener.style.left) || 0,
                y: parseInt(opener.style.top) || 0
            }));
        } else if (draggedElement === panel) {
            localStorage.setItem('tw_panel_pos', JSON.stringify({
                x: parseInt(panel.style.left) || 0,
                y: parseInt(panel.style.top) || 0
            }));
        }

        isDragging = false;
        draggedElement = null;

        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
        
        setTimeout(() => { wasDragged = false; }, 50);
    }

    header.addEventListener('mousedown', dragStart, { passive: false });
    header.addEventListener('touchstart', dragStart, { passive: false });
    
    opener.addEventListener('mousedown', dragStart, { passive: false });
    opener.addEventListener('touchstart', dragStart, { passive: false });

    if (isDark && darkThemeConfig && callbacks.onToggleTheme) {
        callbacks.onToggleTheme(darkThemeConfig.url, true);
    }
};
