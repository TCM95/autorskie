(function () {
    'use strict';

    // Naprawia wybór kolejki: wcześniej używana była długość jako indeks.
    function fixFarmQueue() {
        if (!window.twLib || !twLib.queueLib || !Array.isArray(twLib.queues)) return false;
        if (twLib.queueLib.addItem.__tcmFixed) return true;

        const addItem = function (item) {
            if (!twLib.queues.length) return;
            let bestIndex = 0;
            for (let i = 1; i < twLib.queues.length; i++) {
                if (twLib.queues[i].length < twLib.queues[bestIndex].length) bestIndex = i;
            }
            twLib.queues[bestIndex].enqueue(item);
        };
        addItem.__tcmFixed = true;
        twLib.queueLib.addItem = addItem;
        return true;
    }

    // Panel nie może wypaść poza viewport przy małej wysokości ekranu.
    function fixPanelPosition() {
        const opener = document.getElementById('tw-panel-opener');
        const panel = document.getElementById('tw-script-panel');
        if (!opener || !panel || opener.__tcmPositionFixed) return;
        opener.__tcmPositionFixed = true;

        const position = () => {
            const bottom = Math.max(8, Math.min(1160, window.innerHeight - 60));
            opener.style.setProperty('bottom', `${bottom}px`, 'important');
            panel.style.setProperty('bottom', `${bottom}px`, 'important');
        };
        position();
        window.addEventListener('resize', position, { passive: true });
        opener.addEventListener('click', () => setTimeout(position, 0), true);
    }

    let attempts = 0;
    const timer = setInterval(() => {
        const queueFixed = fixFarmQueue();
        fixPanelPosition();
        attempts++;
        if ((queueFixed && document.getElementById('tw-panel-opener')) || attempts >= 200) clearInterval(timer);
    }, 50);
})();
