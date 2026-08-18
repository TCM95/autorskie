// ==UserScript==
// @name         Panel UI Menedżera TCM
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Interfejs panelu z dynamiczną kontrolą kolorów kategorii, zielonym przyciskiem i zoptymalizowanym tooltipem.
// @author       TCM
// ==/UserScript==

window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.initPanel = function(scriptsArray, categories, callbacks) {
    let currentCategory = null;

    let globalTooltip = document.getElementById('tw-global-tooltip');
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.id = 'tw-global-tooltip';
        globalTooltip.style.cssText = 'display: none; position: absolute; pointer-events: none;';
        document.body.appendChild(globalTooltip);
    }

    const savedOpenerPos = JSON.parse(localStorage.getItem('tw_opener_pos') || 'null');

    const opener = document.createElement('button');
    opener.id = 'tw-panel-opener';
    opener.className = 'tw-opener-closed'; 
    opener.innerHTML = `<img src="https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/ui/ikony/logo_tcm_tw1.png" alt="ikona">`;
    opener.style.cssText = 'position: absolute !important; top: 60px !important; left: 10px !important;';

    if (savedOpenerPos) {
        opener.style.setProperty('left', savedOpenerPos.x + 'px', 'important');
        opener.style.setProperty('top', savedOpenerPos.y + 'px', 'important');
    }

    document.body.appendChild(opener);

    const panel = document.createElement('div');
    panel.id = 'tw-script-panel';

    // NAGŁÓWEK PANELU (PODŚWIETLONY NA CZERWONO)
    const header = document.createElement('div');
    header.id = 'tw-script-panel-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tw-header-title';
    titleSpan.innerText = 'Menu TCM';

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 4px;';

    // PRZYCISK STRZAŁKI (ZIELONY PRZYCISK 3D)
    const toggleContentBtn = document.createElement('button');
    toggleContentBtn.className = 'tw-square-btn tw-btn-green-sq'; 
    toggleContentBtn.innerText = '▼';
    toggleContentBtn.onclick = () => {
        if (contentArea.style.display === 'block') {
            contentArea.style.setProperty('display', 'none', 'important');
            toggleContentBtn.innerText = '▼';
        } else if (currentCategory) {
            contentArea.style.setProperty('display', 'block', 'important');
            toggleContentBtn.innerText = '▲';
        }
    };

    // PRZYCISK ZAMKNIĘCIA X (CZERWONY)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tw-square-btn tw-btn-red-sq';
    closeBtn.innerText = 'X';

    closeBtn.onclick = () => { 
        panel.style.setProperty('display', 'none', 'important'); 
        opener.classList.remove('tw-opener-open');
        opener.classList.add('tw-opener-closed');
        globalTooltip.style.display = 'none';
    };

    controls.appendChild(toggleContentBtn);
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

    // FUNKCJA AKTUALIZUJĄCA KOLORY NAZW KATEGORII
    function updateCategoryStatus() {
        const state = callbacks.getScriptsState();
        document.querySelectorAll('.tw-tab').forEach(tab => {
            const catName = tab.dataset.category;
            const catScripts = scriptsArray.filter(s => (s.category || "Inne") === catName);
            const hasActive = catScripts.some(s => state[s.id] === true);

            tab.classList.remove('tw-cat-has-active', 'tw-cat-all-off');
            if (hasActive) {
                tab.classList.add('tw-cat-has-active'); // Zielony napis
            } else {
                tab.classList.add('tw-cat-all-off'); // Czerwony napis
            }
        });
    }

    function renderScripts() {
        contentInner.innerHTML = '';
        const state = callbacks.getScriptsState();
        let filtered = scriptsArray.filter(s => (s.category || "Inne") === currentCategory);

        if (filtered.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'text-align: center; color: #888; font-style: italic; padding: 8px;';
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

                updateCategoryStatus();

                if (globalTooltip.dataset.activeId === script.id) {
                    updateTooltipContent(script, newState);
                }
            };

            const infoIcon = document.createElement('button');
            infoIcon.className = 'tw-square-btn tw-btn-green-sq';
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

    // UPDATED TOOLTIP WITH INNER BORDERS
    function updateTooltipContent(script, isActive) {
        const screensInfo = script.screens && script.screens.length > 0 ? script.screens.join(', ') : 'Wszystkie';
        const statusColor = isActive ? 'var(--neon-green)' : 'var(--neon-red)';
        const statusText = isActive ? 'Aktywny' : 'Wyłączony';

        globalTooltip.style.borderColor = statusColor;

        globalTooltip.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: var(--title-color); font-size: 12px;">${script.name}</strong> 
                <span style="color: ${statusColor}; font-weight: bold;">[${statusText}]</span>
            </div>
            <div class="tw-tooltip-box">
                <strong style="color: var(--title-color);">Opis:</strong>
                <div style="margin-top: 2px; color: var(--text-color);">${script.description || 'Brak opisu.'}</div>
            </div>
            <div class="tw-tooltip-box">
                <strong style="color: var(--title-color);">Aktywne ekrany:</strong>
                <div style="margin-top: 2px; color: ${statusColor};">${screensInfo}</div>
            </div>`;
    }

    // GENEROWANIE ZAKŁADEK KATEGORII
    categories.forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'tw-tab';
        tab.innerText = cat;
        tab.dataset.category = cat;

        tab.onclick = () => {
            globalTooltip.style.display = 'none';
            globalTooltip.dataset.activeId = '';

            if (currentCategory === cat) {
                currentCategory = null;
                tab.classList.remove('active-tab');
                contentArea.style.setProperty('display', 'none', 'important');
                toggleContentBtn.innerText = '▼';
            } else {
                document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active-tab'));
                tab.classList.add('active-tab');
                currentCategory = cat;
                renderScripts();
                contentArea.style.setProperty('display', 'block', 'important');
                toggleContentBtn.innerText = '▲';
            }
        };
        categoriesBar.appendChild(tab);
    });

    panel.appendChild(categoriesBar);
    panel.appendChild(contentArea);
    document.body.appendChild(panel);

    // INICJALNA WERYFIKACJA KOLORÓW KATEGORII
    updateCategoryStatus();

    // DRAG & DROP DLA OPENERA
    let isDragging = false;
    let wasDragged = false;
    let startX = 0, startY = 0, initialX = 0, initialY = 0;

    opener.onclick = () => { 
        if (wasDragged) { wasDragged = false; return; }

        if (panel.style.display === 'flex') {
            panel.style.setProperty('display', 'none', 'important');
            opener.classList.remove('tw-opener-open');
            opener.classList.add('tw-opener-closed');
        } else {
            panel.style.setProperty('display', 'flex', 'important');
            opener.classList.remove('tw-opener-closed');
            opener.classList.add('tw-opener-open');

            const leftPos = parseInt(opener.style.left) || 0;
            const topPos = parseInt(opener.style.top) || 0;

            panel.style.setProperty('left', (leftPos + 55) + 'px', 'important');
            panel.style.setProperty('top', topPos + 'px', 'important');
        }
    };

    function dragStart(e) {
        isDragging = true;
        wasDragged = false;
        const evt = e.touches ? e.touches[0] : e;
        startX = evt.clientX;
        startY = evt.clientY;

        const rect = opener.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        document.addEventListener('mousemove', dragMove, { passive: false });
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    function dragMove(e) {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();

        const evt = e.touches ? e.touches[0] : e;
        const dx = evt.clientX - startX;
        const dy = evt.clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragged = true;

        opener.style.setProperty('left', (initialX + dx) + 'px', 'important');
        opener.style.setProperty('top', (initialY + dy) + 'px', 'important');
    }

    function dragEnd() {
        if (!isDragging) return;
        isDragging = false;

        localStorage.setItem('tw_opener_pos', JSON.stringify({
            x: parseInt(opener.style.left) || 0,
            y: parseInt(opener.style.top) || 0
        }));

        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    }

    opener.addEventListener('mousedown', dragStart, { passive: false });
    opener.addEventListener('touchstart', dragStart, { passive: false });
};
