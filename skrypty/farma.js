// ==UserScript==
// @name         farma
// @version      1.0
// @description  Auto loot with FarmGodCopy and Autotrading-style controls.
// @include      https://*/game.php*screen=am_farm*
// @namespace https://greasyfork.org/users/1388863
// @downloadURL https://update.greasyfork.org/scripts/514955/Autofarm%20V2.user.js
// @updateURL https://update.greasyfork.org/scripts/514955/Autofarm%20V2.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const domain = window.location.hostname.split('.')[0];
    const oldRunningKey = `${domain}_isRunning`;
    const runningKey = `${domain}_autoloot_isRunning`;
    const settingsKey = `${domain}_autoloot_settings`;
    const farmGodUrl = 'https://higamy.github.io/TW/Scripts/Approved/FarmGodCopy.js';

    let isRunning = localStorage.getItem(runningKey) === 'true' || localStorage.getItem(oldRunningKey) === 'true';
    let enterTimeoutId = null;
    let countdownIntervalId = null;
    let startTimeoutIds = [];
    let settingsPopupLoot = null;

    let settings = {
        firstDelayMin: 4000,
        firstDelayMax: 7000,
        scriptDelayMin: 3000,
        scriptDelayMax: 5000,
        planDelayMin: 3000,
        planDelayMax: 5000,
        enterDelayMin: 200,
        enterDelayMax: 250,
        reloadMin: 600,
        reloadMax: 900,
        planRetries: 3
    };

    function randomDelay(min, max) {
        const safeMin = Math.max(1, Number(min) || 1);
        const safeMax = Math.max(safeMin, Number(max) || safeMin);
        return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
    }

    function loadSettingsLoot() {
        try {
            settings = {
                ...settings,
                ...JSON.parse(localStorage.getItem(settingsKey) || '{}')
            };
        } catch (e) {
            console.warn('Autoloot settings invalid, using defaults.');
        }
    }

    function saveSettingsLoot() {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        toggleSettingsPopupLoot();
    }

    function setStatus(text) {
        const countdownEl = document.getElementById('countdown-timer-loot');
        if (countdownEl) countdownEl.innerText = text;
    }

    function rememberTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            startTimeoutIds = startTimeoutIds.filter((id) => id !== timeoutId);
            callback();
        }, delay);
        startTimeoutIds.push(timeoutId);
        return timeoutId;
    }

    function clearStartTimeouts() {
        startTimeoutIds.forEach((id) => clearTimeout(id));
        startTimeoutIds = [];
    }

    function loadFarmGodScript(callback) {
        if (document.querySelector(`script[src="${farmGodUrl}"]`)) {
            setStatus('FarmGod already loaded');
            callback();
            return;
        }

        setStatus('Loading FarmGod...');
        const script = document.createElement('script');
        script.src = farmGodUrl;
        script.type = 'text/javascript';
        script.onload = () => {
            setStatus('FarmGod loaded');
            callback();
        };
        script.onerror = () => setStatus('FarmGod load failed');
        document.body.appendChild(script);
    }

    function clickOptionButton(retries = settings.planRetries, manual = false) {
        if (!isRunning && !manual) return;

        const button = document.querySelector('input.btn.optionButton[value="Plan farms"]');
        if (button) {
            button.click();
            setStatus('Plan farms clicked');
            return;
        }

        if (retries > 0) {
            setStatus(`Plan farms not found, retry ${retries}`);
            rememberTimeout(() => clickOptionButton(retries - 1, manual), randomDelay(2000, 4000));
            return;
        }

        setStatus('Plan farms not found');
    }

    function pressEnterRandomly() {
        if (!isRunning) return;

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            which: 13,
            keyCode: 13,
            bubbles: true
        }));

        enterTimeoutId = setTimeout(
            pressEnterRandomly,
            randomDelay(settings.enterDelayMin, settings.enterDelayMax)
        );
    }

    function startCountdown() {
        clearInterval(countdownIntervalId);

        let timeLeft = randomDelay(settings.reloadMin, settings.reloadMax);
        countdownIntervalId = setInterval(() => {
            if (!isRunning) {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
                return;
            }

            if (timeLeft <= 0) {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
                setStatus('Reload...');
                location.reload();
                return;
            }

            setStatus(`Next loop ${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s`);
            timeLeft--;
        }, 1000);
    }

    function startProcess() {
        if (!isRunning) return;

        clearStartTimeouts();
        clearTimeout(enterTimeoutId);
        clearInterval(countdownIntervalId);
        setStatus('Wait 4-7s');

        rememberTimeout(() => {
            if (!isRunning) return;

            loadFarmGodScript(() => {
                rememberTimeout(() => {
                    clickOptionButton();

                    rememberTimeout(() => {
                        if (!isRunning) return;
                        setStatus('Looting...');
                        pressEnterRandomly();
                        startCountdown();
                    }, randomDelay(settings.planDelayMin, settings.planDelayMax));
                }, randomDelay(settings.scriptDelayMin, settings.scriptDelayMax));
            });
        }, randomDelay(settings.firstDelayMin, settings.firstDelayMax));
    }

    function stopProcess() {
        clearStartTimeouts();
        clearTimeout(enterTimeoutId);
        clearInterval(countdownIntervalId);
        enterTimeoutId = null;
        countdownIntervalId = null;
        isRunning = false;
        localStorage.setItem(runningKey, 'false');
        localStorage.setItem(oldRunningKey, 'false');
        updateButtonStateLoot(false);
    }

    function toggleProcess() {
        if (isRunning) {
            stopProcess();
            return;
        }

        isRunning = true;
        localStorage.setItem(runningKey, 'true');
        localStorage.setItem(oldRunningKey, 'true');
        updateButtonStateLoot(true);
        startProcess();
    }

    function inputStyle() {
        return 'width: 100%; margin-bottom: 8px; box-sizing: border-box;';
    }

    function toggleSettingsPopupLoot() {
        if (settingsPopupLoot) {
            settingsPopupLoot.remove();
            settingsPopupLoot = null;
            return;
        }

        settingsPopupLoot = document.createElement('div');
        settingsPopupLoot.style.position = 'fixed';
        settingsPopupLoot.style.bottom = '100px';
        settingsPopupLoot.style.left = '100px';
        settingsPopupLoot.style.backgroundColor = '#222';
        settingsPopupLoot.style.color = '#fff';
        settingsPopupLoot.style.padding = '20px';
        settingsPopupLoot.style.borderRadius = '10px';
        settingsPopupLoot.style.boxShadow = '0px 4px 8px rgba(0, 0, 0, 0.2)';
        settingsPopupLoot.style.zIndex = '1000';
        settingsPopupLoot.style.width = '260px';
        settingsPopupLoot.style.height = 'auto';

        settingsPopupLoot.innerHTML = `
            <h3 style="margin: 0 0 5px 0; font-size: 14px; text-align: center;">Loot Settings</h3>
            <div style="margin-bottom: 3px; display: flex; gap: 8px; font-size: 12px;">
                <label>Start Min ms: <input type="number" id="lootFirstMinInput" value="${settings.firstDelayMin}" style="${inputStyle()}"></label>
                <label>Start Max ms: <input type="number" id="lootFirstMaxInput" value="${settings.firstDelayMax}" style="${inputStyle()}"></label>
            </div>
            <div style="margin-bottom: 3px; display: flex; gap: 8px; font-size: 12px;">
                <label>Enter Min ms: <input type="number" id="lootEnterMinInput" value="${settings.enterDelayMin}" style="${inputStyle()}"></label>
                <label>Enter Max ms: <input type="number" id="lootEnterMaxInput" value="${settings.enterDelayMax}" style="${inputStyle()}"></label>
            </div>
            <div style="margin-bottom: 3px; display: flex; gap: 8px; font-size: 12px;">
                <label>Reload Min s: <input type="number" id="lootReloadMinInput" value="${settings.reloadMin}" style="${inputStyle()}"></label>
                <label>Reload Max s: <input type="number" id="lootReloadMaxInput" value="${settings.reloadMax}" style="${inputStyle()}"></label>
            </div>
            <div style="margin-bottom: 8px; font-size: 12px;">
                <label>Plan retries: <input type="number" id="lootPlanRetriesInput" value="${settings.planRetries}" style="${inputStyle()}"></label>
            </div>
            <button id="saveSettingsLootButton" style="width: 100%; padding: 5px; background-color: #28a745; color: white; border: none; border-radius: 5px;">Save</button>
        `;

        document.body.appendChild(settingsPopupLoot);

        document.getElementById('saveSettingsLootButton').addEventListener('click', () => {
            settings.firstDelayMin = Number(document.getElementById('lootFirstMinInput').value) || 4000;
            settings.firstDelayMax = Number(document.getElementById('lootFirstMaxInput').value) || settings.firstDelayMin;
            settings.enterDelayMin = Number(document.getElementById('lootEnterMinInput').value) || 200;
            settings.enterDelayMax = Number(document.getElementById('lootEnterMaxInput').value) || settings.enterDelayMin;
            settings.reloadMin = Number(document.getElementById('lootReloadMinInput').value) || 600;
            settings.reloadMax = Number(document.getElementById('lootReloadMaxInput').value) || settings.reloadMin;
            settings.planRetries = Number(document.getElementById('lootPlanRetriesInput').value) || 3;

            if (settings.firstDelayMax < settings.firstDelayMin) settings.firstDelayMax = settings.firstDelayMin;
            if (settings.enterDelayMax < settings.enterDelayMin) settings.enterDelayMax = settings.enterDelayMin;
            if (settings.reloadMax < settings.reloadMin) settings.reloadMax = settings.reloadMin;
            if (settings.planRetries < 0) settings.planRetries = 0;

            saveSettingsLoot();
        });
    }

    function updateButtonStateLoot(running) {
        const autoButtonLoot = document.getElementById('auto-loot-button');
        const countdownElementLoot = document.getElementById('countdown-timer-loot');
        if (!autoButtonLoot || !countdownElementLoot) return;

        if (running) {
            autoButtonLoot.innerText = 'StopLoot';
            autoButtonLoot.style.backgroundColor = '#dc3545';
            countdownElementLoot.innerText = 'Wait 4-7s';
        } else {
            autoButtonLoot.innerText = 'AutoLoot';
            autoButtonLoot.style.backgroundColor = '#28a745';
            countdownElementLoot.innerText = 'Auto Loot';
        }
    }

    function createUI() {
        loadSettingsLoot();

        const oldPanel = document.getElementById('auto-loot-container');
        if (oldPanel) oldPanel.remove();

        const containerLoot = document.createElement('div');
        containerLoot.id = 'auto-loot-container';
        containerLoot.style.position = 'fixed';
        containerLoot.style.bottom = '20px';
        containerLoot.style.left = '100px';
        containerLoot.style.backgroundColor = '#222';
        containerLoot.style.color = '#fff';
        containerLoot.style.padding = '12px';
        containerLoot.style.borderRadius = '8px';
        containerLoot.style.zIndex = '1000';
        containerLoot.style.boxShadow = '0px 4px 8px rgba(0, 0, 0, 0.2)';
        containerLoot.style.display = 'flex';
        containerLoot.style.flexDirection = 'column';
        containerLoot.style.gap = '10px';
        containerLoot.style.backdropFilter = 'blur(5px)';

        const countdownElementLoot = document.createElement('div');
        countdownElementLoot.id = 'countdown-timer-loot';
        countdownElementLoot.style.marginBottom = '1px';
        countdownElementLoot.style.fontSize = '12px';
        countdownElementLoot.style.fontWeight = 'bold';
        countdownElementLoot.style.textAlign = 'center';
        countdownElementLoot.innerText = 'Auto Loot';
        containerLoot.appendChild(countdownElementLoot);

        const buttonContainerLoot = document.createElement('div');
        buttonContainerLoot.style.display = 'flex';
        buttonContainerLoot.style.justifyContent = 'space-between';
        buttonContainerLoot.style.width = '100%';
        buttonContainerLoot.style.gap = '5px';

        const autoButtonLoot = document.createElement('button');
        autoButtonLoot.id = 'auto-loot-button';
        autoButtonLoot.style.padding = '5px 10px';
        autoButtonLoot.style.fontSize = '13px';
        autoButtonLoot.style.color = '#fff';
        autoButtonLoot.style.border = 'none';
        autoButtonLoot.style.borderRadius = '5px';
        autoButtonLoot.style.cursor = 'pointer';
        autoButtonLoot.style.transition = 'background-color 0.3s ease';
        autoButtonLoot.addEventListener('click', toggleProcess);

        const manualButtonLoot = document.createElement('button');
        manualButtonLoot.innerText = 'Manual';
        manualButtonLoot.style.padding = '5px 10px';
        manualButtonLoot.style.fontSize = '13px';
        manualButtonLoot.style.backgroundColor = '#ff7f00';
        manualButtonLoot.style.color = '#ffff';
        manualButtonLoot.style.border = 'none';
        manualButtonLoot.style.borderRadius = '5px';
        manualButtonLoot.style.cursor = 'pointer';
        manualButtonLoot.style.transition = 'background-color 0.3s ease';
        manualButtonLoot.addEventListener('click', () => {
            loadFarmGodScript(() => {
                setTimeout(() => clickOptionButton(settings.planRetries, true), randomDelay(500, 1500));
            });
        });

        const settingsButtonLoot = document.createElement('button');
        settingsButtonLoot.innerText = 'Settings';
        settingsButtonLoot.style.padding = '5px 10px';
        settingsButtonLoot.style.fontSize = '13px';
        settingsButtonLoot.style.backgroundColor = '#007bff';
        settingsButtonLoot.style.color = '#fff';
        settingsButtonLoot.style.border = 'none';
        settingsButtonLoot.style.borderRadius = '5px';
        settingsButtonLoot.style.cursor = 'pointer';
        settingsButtonLoot.style.transition = 'background-color 0.3s ease';
        settingsButtonLoot.addEventListener('click', toggleSettingsPopupLoot);

        buttonContainerLoot.appendChild(autoButtonLoot);
        buttonContainerLoot.appendChild(manualButtonLoot);
        buttonContainerLoot.appendChild(settingsButtonLoot);
        containerLoot.appendChild(buttonContainerLoot);
        document.body.appendChild(containerLoot);

        updateButtonStateLoot(isRunning);
    }

    createUI();
    if (isRunning) startProcess();
})();
