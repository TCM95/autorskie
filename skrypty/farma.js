// ==UserScript==
// @name         Kalkulator Farmy - Integracja
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Skrypt do zarządzania wysyłaniem farm z wbudowanymi ustawieniami
// @author       TCM
// @match        https://*.plemiona.pl/game.php*screen=am_farm*
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
    let settingsPopup = null;

    let settings = {
        firstDelayMin: 1000,
        firstDelayMax: 1000,
        scriptDelayMin: 1000,
        scriptDelayMax: 1000,
        planDelayMin: 1000,
        planDelayMax: 1000,
        enterDelayMin: 90,
        enterDelayMax: 250,
        reloadMin: 600,
        reloadMax: 900,
        fgDistance: 25,
        fgTime: 10,
        fgMaxLoot: true,
        fgLosses: false
    };

    function injectCSS() {
        if (document.getElementById('tcm-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-styles';
        style.innerHTML = `
            :root {
                --bg-main: #36393f;
                --bg-row-alt: #32353b;
                --bg-header: #202225;
                --border-color: #3e4147;
                --text-color: white;
                --title-color: #ffffdf;
                --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
                --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
                --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
                --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
                --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
                --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
                --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
                --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
            }
            .tcm-panel {
                position: fixed !important;
                background-color: var(--bg-main);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                z-index: 9999;
                box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.5);
            }
            .tcm-btn {
                background: var(--btn-bg);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                padding: 6px 10px;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                justify-content: center;
                align-items: center;
                font-weight: bold;
            }
            .tcm-btn:hover { background: var(--btn-hover); }
            .tcm-btn-green { background: var(--btn-green-bg); }
            .tcm-btn-green:hover { background: var(--btn-green-hover); }
            .tcm-btn-red { background: var(--btn-red-bg); }
            .tcm-btn-red:hover { background: var(--btn-red-hover); }
            .tcm-btn-blue { background: var(--btn-blue-bg); }
            .tcm-btn-blue:hover { background: var(--btn-blue-hover); }
            .tcm-input {
                width: 100%;
                box-sizing: border-box;
                background: var(--bg-row-alt);
                color: white;
                border: 1px solid var(--border-color);
                padding: 4px;
                border-radius: 3px;
                margin-top: 2px;
                text-align: center;
            }
            .tcm-timer {
                font-size: 12px;
                font-weight: bold;
                text-align: center;
                color: var(--title-color);
                background-color: #1a1c1e;
                padding: 5px;
                border-radius: 4px;
                border: 1px solid #cda434;
                box-shadow: 0 0 6px rgba(205, 164, 52, 0.6);
                margin-bottom: 5px;
            }
        `;
        document.head.appendChild(style);
    }

    function randomDelay(min, max) {
        const safeMin = Math.max(1, Number(min) || 1);
        const safeMax = Math.max(safeMin, Number(max) || safeMin);
        return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
    }

    function loadSettings() {
        try {
            settings = { ...settings, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') };
        } catch (e) {
            console.warn('Błąd wczytywania ustawień.');
        }
    }

    function syncFarmGodOptions() {
        let fgOptions = JSON.parse(localStorage.getItem('farmGod_options')) || {
            optionGroup: 0, optionDistance: 25, optionTime: 10,
            optionLosses: false, optionMaxloot: true, optionNewbarbs: true
        };
        fgOptions.optionDistance = settings.fgDistance;
        fgOptions.optionTime = settings.fgTime;
        fgOptions.optionMaxloot = settings.fgMaxLoot;
        fgOptions.optionLosses = settings.fgLosses;
        localStorage.setItem('farmGod_options', JSON.stringify(fgOptions));
    }

    function saveSettings() {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        syncFarmGodOptions();
        toggleSettingsPopup();
    }

    function setStatus(text) {
        const countdownEl = document.getElementById('tcm-countdown');
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
            setStatus('Skrypt załadowany');
            callback();
            return;
        }
        setStatus('Ładowanie skryptu...');
        const script = document.createElement('script');
        script.src = farmGodUrl;
        script.type = 'text/javascript';
        script.onload = () => { setStatus('Załadowany'); callback(); };
        script.onerror = () => setStatus('Błąd ładowania❗');
        document.body.appendChild(script);
    }

    function clickOptionButton() {
        if (!isRunning) return;
        const button = document.querySelector('input.btn.optionButton[value="Plan farms"]');
        if (button) {
            button.click();
            setStatus('Aktywny');
            return;
        }
        
        setStatus('Szukam planu...');
        rememberTimeout(clickOptionButton, randomDelay(1000, 1100));
    }

    function pressEnterRandomly() {
        if (!isRunning) return;
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true
        }));
        enterTimeoutId = setTimeout(pressEnterRandomly, randomDelay(settings.enterDelayMin, settings.enterDelayMax));
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
                setStatus('...');
                location.reload();
                return;
            }
            setStatus(`${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s`);
            timeLeft--;
        }, 1000);
    }

    function startProcess() {
        if (!isRunning) return;
        clearStartTimeouts();
        clearTimeout(enterTimeoutId);
        clearInterval(countdownIntervalId);
        syncFarmGodOptions();
        setStatus('⌛');

        rememberTimeout(() => {
            if (!isRunning) return;
            loadFarmGodScript(() => {
                rememberTimeout(() => {
                    clickOptionButton();
                    rememberTimeout(() => {
                        if (!isRunning) return;
                        setStatus('Wysyłanie');
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
        updateButtonState(false);
    }

    function toggleProcess() {
        if (isRunning) { stopProcess(); } 
        else {
            isRunning = true;
            localStorage.setItem(runningKey, 'true');
            localStorage.setItem(oldRunningKey, 'true');
            updateButtonState(true);
            startProcess();
        }
    }

    function toggleSettingsPopup() {
        if (settingsPopup) {
            settingsPopup.remove();
            settingsPopup = null;
            return;
        }

        settingsPopup = document.createElement('div');
        settingsPopup.className = 'tcm-panel';
        settingsPopup.style.bottom = '90px';
        settingsPopup.style.left = '20px';
        settingsPopup.style.padding = '10px';
        settingsPopup.style.width = '200px';

        settingsPopup.innerHTML = `
            <h3 style="margin:0 0 10px 0; font-size:14px; color:var(--title-color); text-align:center;">⚙️</h3>
            
            <div style="margin-bottom: 8px; font-size: 11px; padding: 5px; border: 1px solid var(--border-color); border-radius: 4px;">
                <div style="color:var(--title-color); margin-bottom:5px; font-weight:bold;">Logika(FG):</div>
                <div style="display:flex; gap:5px;">
                    <label style="flex:1">Kratki: <input type="number" id="cfgDistance" value="${settings.fgDistance}" class="tcm-input"></label>
                    <label style="flex:1">Czas (m): <input type="number" id="cfgTime" value="${settings.fgTime}" class="tcm-input"></label>
                </div>
                <label style="display:block; margin-top:8px; cursor:pointer;">
                    <input type="checkbox" id="cfgMaxLoot" ${settings.fgMaxLoot ? 'checked' : ''}>full loot [B]
                </label>
                <label style="display:block; margin-top:5px; cursor:pointer;">
                    <input type="checkbox" id="cfgLosses" ${settings.fgLosses ? 'checked' : ''}> Partie losse
                </label>
            </div>

            <div style="margin-bottom: 8px; font-size: 11px; padding: 5px; border: 1px solid var(--border-color); border-radius: 4px;">
                <div style="color:var(--title-color); margin-bottom:5px; font-weight:bold;">Delay A/B</div>
                <div style="display:flex; gap:5px; margin-bottom:4px;">
                    <label style="flex:1">Min(ms): <input type="number" id="cfgEnterMin" value="${settings.enterDelayMin}" class="tcm-input"></label>
                    <label style="flex:1">Max(ms): <input type="number" id="cfgEnterMax" value="${settings.enterDelayMax}" class="tcm-input"></label>
                </div>
                <div style="color:var(--title-color); margin-bottom:5px; font-weight:bold;">Odświeżanie</div>
                <div style="display:flex; gap:5px;">
                    <label style="flex:1">Min(s): <input type="number" id="cfgReloadMin" value="${settings.reloadMin}" class="tcm-input"></label>
                    <label style="flex:1">Max(s): <input type="number" id="cfgReloadMax" value="${settings.reloadMax}" class="tcm-input"></label>
                </div>
            </div>
            
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button id="saveCfgBtn" class="tcm-btn tcm-btn-green" style="flex:1; font-size:20px; padding:4px;">💾</button>
                <button id="closeSettingsBtn" class="tcm-btn tcm-btn-red" style="flex:1; font-size:20px; padding:4px;">❌</button>
            </div>
        `;

        document.body.appendChild(settingsPopup);

        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            settingsPopup.remove();
            settingsPopup = null;
        });

        document.getElementById('saveCfgBtn').addEventListener('click', () => {
            settings.fgDistance = Number(document.getElementById('cfgDistance').value) || 25;
            settings.fgTime = Number(document.getElementById('cfgTime').value) || 10;
            settings.fgMaxLoot = document.getElementById('cfgMaxLoot').checked;
            settings.fgLosses = document.getElementById('cfgLosses').checked;

            settings.enterDelayMin = Number(document.getElementById('cfgEnterMin').value) || 200;
            settings.enterDelayMax = Number(document.getElementById('cfgEnterMax').value) || settings.enterDelayMin;
            settings.reloadMin = Number(document.getElementById('cfgReloadMin').value) || 600;
            settings.reloadMax = Number(document.getElementById('cfgReloadMax').value) || settings.reloadMin;
            
            if (settings.enterDelayMax < settings.enterDelayMin) settings.enterDelayMax = settings.enterDelayMin;
            if (settings.reloadMax < settings.reloadMin) settings.reloadMax = settings.reloadMin;

            saveSettings();
        });
    }

    function updateButtonState(running) {
        const autoBtn = document.getElementById('tcm-main-btn');
        const countdownEl = document.getElementById('tcm-countdown');
        if (!autoBtn || !countdownEl) return;

        if (running) {
            autoBtn.innerHTML = '❎️';
            autoBtn.className = 'tcm-btn tcm-btn-red';
            countdownEl.innerText = '⌛';
            countdownEl.style.boxShadow = '0 0 8px rgba(205, 92, 92, 0.6)';
            countdownEl.style.borderColor = '#cd5c5c';
        } else {
            autoBtn.innerHTML = '✅️';
            autoBtn.className = 'tcm-btn tcm-btn-green';
            countdownEl.innerText = 'Gotowy';
            countdownEl.style.boxShadow = '0 0 6px rgba(205, 164, 52, 0.6)';
            countdownEl.style.borderColor = '#cda434';
        }
    }

    function createUI() {
        injectCSS();
        loadSettings();

        const oldPanel = document.getElementById('tcm-main-container');
        if (oldPanel) oldPanel.remove();

        const container = document.createElement('div');
        container.id = 'tcm-main-container';
        container.className = 'tcm-panel';
        container.style.bottom = '20px';
        container.style.left = '20px';
        container.style.padding = '10px';
        container.style.width = '120px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';

        const countdownElement = document.createElement('div');
        countdownElement.id = 'tcm-countdown';
        countdownElement.className = 'tcm-timer';
        countdownElement.innerText = 'Wczytywanie';
        container.appendChild(countdownElement);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '6px';

        const autoBtn = document.createElement('button');
        autoBtn.id = 'tcm-main-btn';
        autoBtn.className = 'tcm-btn';
        autoBtn.style.padding = '8px';
        autoBtn.addEventListener('click', toggleProcess);

        const settingsBtn = document.createElement('button');
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.className = 'tcm-btn tcm-btn-blue';
        settingsBtn.style.padding = '8px';
        settingsBtn.addEventListener('click', toggleSettingsPopup);

        buttonContainer.appendChild(autoBtn);
        buttonContainer.appendChild(settingsBtn);
        container.appendChild(buttonContainer);
        document.body.appendChild(container);

        updateButtonState(isRunning);
    }

    createUI();
    if (isRunning) startProcess();
})();
