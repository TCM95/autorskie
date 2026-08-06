window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.createTooltip = function(parentPanel) {
    const globalTooltip = document.createElement('div');
    globalTooltip.id = 'tw-global-tooltip';
    
    const tooltipContent = document.createElement('div');
    tooltipContent.id = 'tw-tooltip-content';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'tw-tooltip-close';
    closeBtn.innerText = 'Zamknij';
    closeBtn.onclick = (e) => { e.stopPropagation(); globalTooltip.style.display = 'none'; };

    globalTooltip.appendChild(tooltipContent);
    globalTooltip.appendChild(closeBtn);
    parentPanel.appendChild(globalTooltip);

    return {
        show: function(title, description, screens) {
            const screensInfo = screens && screens.length > 0 ? screens.join(', ') : 'Brak';
            tooltipContent.innerHTML = `<strong>${title}</strong><br><hr style="margin:4px 0;"><div style="text-align:left;"><strong>Opis:</strong> ${description || 'Brak.'}<br><strong>Strony:</strong> ${screensInfo}</div>`;
            globalTooltip.style.display = 'block';
        }
    };
};
