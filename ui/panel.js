window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    let currentCategory = null;

    let globalTooltip = document.getElementById('tw-global-tooltip');
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.id = 'tw-global-tooltip';
        globalTooltip.style.cssText = 'display: none; position: absolute; z-index: 1000000 !important; background: var(--bg-main); border-radius: 4px; padding: 10px; pointer-events: none;';
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
    bellBtn.onclick = () => {
        console.log("Kliknięto dzwonek powiadomień.");
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tw-square-btn tw-btn-inactive';
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

    // Funkcja aktualizująca kolorowanie kategorii w zależności od statusu skryptów
    function updateCategoryStatus() {
        const state = callbacks.getScriptsState();
        document.querySelectorAll('.tw-tab').forEach(tab => {
            const catName = tab.innerText;
            const scriptsInCat = scriptsArray.filter(s => (s.category || "Ogólne") === catName);
            if (scriptsInCat.length === 0) return;

            const anyActive = scriptsInCat.some(script => state[script.id] === true);
            
            tab.classList.remove('cat-status-on', 'cat-status-off');
            if (anyActive) {
                tab.classList.add('cat-status-on');
            } else {
                tab.classList.add('cat-status-off');
            }
        });
    }

    function renderScripts() {
        contentInner.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => (s.category || "Ogólne") === currentCategory);

        if (filtered.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'text-align: center; color: #666; font-style: italic; padding: 8px;';
            emptyMsg.innerText = 'Brak skryptów.';
            contentInner.appendChild(emptyMsg);
            return;
        }

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

                if (globalTooltip.dataset.activeId === script.id) {
                    updateTooltipContent(script, newState);
                }

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
                    const tooltipWidth = 250; 

                    let topPos = rect.top + window.scrollY - 10;
                    let leftPos = rect.right + window.scrollX + 10;

                    if (rect.right + tooltipWidth > window.innerWidth) {
                        leftPos = rect.left + window.scrollX - tooltipWidth - 10;
                    }

                    const tooltipHeight = globalTooltip.offsetHeight;
                    if (rect.top + tooltipHeight > window.innerHeight) {
                        topPos = rect.top + window.scrollY - tooltipHeight + rect.height;
                    }

                    globalTooltip.style.top = topPos + 'px';
                    globalTooltip.style.left = leftPos + 'px';
                }
            };

            item.appendChild(gameBtn);
            item.appendChild(infoIcon);
            contentInner.appendChild(item);
        });
    }

    function updateTooltipContent(script, isActive) {
        const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Wszystkie';
        const colorVar = isActive ? 'var(--btn-green-hover)' : 'var(--btn-red-hover)';
        const statusText = isActive ? 'Aktywny' : 'Wyłączony';

        globalTooltip.style.border = `1px solid ${colorVar}`;
        globalTooltip.style.boxShadow = `0 4px 15px rgba(0,0,0,0.9), 0 0 10px ${colorVar}`;

        globalTooltip.innerHTML = `
            <strong style="color: var(--title-color); font-size: 12px;">${script.name}</strong> 
            <span style="color: ${colorVar}; float: right; font-weight: bold; text-shadow: 0 0 4px ${colorVar};">[${statusText}]</span><br>
            <hr style="border: 0; border-bottom: 1px solid var(--border-color); margin: 6px 0;">
            <div style="line-height: 1.4;">
                <strong style="color: var(--text-color);">Opis:</strong> <span style="color: var(--text-color);">${script.description || 'Brak.'}</span><br>
                <strong style="margin-top:4px; display:inline-block; color: var(--text-color);">Strony:</strong> <span style="color: ${colorVar};">${screensInfo}</span>
            </div>`;
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

    // --- CZYSTE MIEJSCE NA ZEWNĘTRZNY SKRYPT ---
    const externalMenuContainer = document.createElement('div');
    externalMenuContainer.id = 'tcm-external-menu-container';
    externalMenuContainer.style.cssText = 'box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; padding: 6px 8px; border-top: 1px solid var(--border-color); background: var(--bg-row-alt); border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; display: block !important;';
    panel.appendChild(externalMenuContainer);
    // ------------------------------------

    document.body.appendChild(panel);

    // Odśwież statusy kategorii na starcie
    updateCategoryStatus();

    let wasDragged = false; 

    opener.onclick = (e) => { 
        if (wasDragged) {
            wasDragged = false; 
            return; 
        }

        if (panel.style.display === 'flex') {
            panel.style.setProperty('display', 'none', 'important');
            opener.classList.remove('tw-opener-open');
            opener.classList.add('tw-opener-closed');
        } else {
            panel.style.setProperty('display', 'flex', 'important');
            opener.classList.remove('tw-opener-closed');
            opener.classList.add('tw-opener-open');

            const absoluteLeft = parseInt(opener.style.left) || 0;
            const absoluteTop = parseInt(opener.style.top) || 0;

            panel.style.setProperty('left', (absoluteLeft + 55) + 'px', 'important');
            panel.style.setProperty('top', absoluteTop + 'px', 'important');
        }
    };

    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tw-square-btn')) {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';
        }

        const clickedInsidePanel = e.target.closest('#tw-script-panel');
        const clickedOpener = e.target.closest('#tw-panel-opener');

        if (!clickedInsidePanel && !clickedOpener && panel.style.display !== 'none') {
            if (contentArea.style.display === 'block') {
                currentCategory = null;
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active-tab'));
                contentArea.style.setProperty('display', 'none', 'important');
            } else {
                panel.style.setProperty('display', 'none', 'important');
                opener.classList.remove('tw-opener-open');
                opener.classList.add('tw-opener-closed');
            }
        }
    });

    let isDragging = false;
    let draggedElement = null;
    let initialX = 0, initialY = 0;
    let startX = 0, startY = 0;

    function dragStart(e) {
        if (e.currentTarget !== opener) return;

        draggedElement = opener;
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

        isDragging = true;

        panel.style.setProperty('display', 'none', 'important');
        opener.classList.remove('tw-opener-open');
        opener.classList.add('tw-opener-closed');
        globalTooltip.style.display = 'none';

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

        localStorage.setItem('tw_opener_pos', JSON.stringify({
            x: parseInt(opener.style.left) || 0,
            y: parseInt(opener.style.top) || 0
        }));

        isDragging = false;
        draggedElement = null;

        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }

    opener.addEventListener('mousedown', dragStart, { passive: false });
    opener.addEventListener('touchstart', dragStart, { passive: false });
};
