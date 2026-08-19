// ==UserScript==
// @name         balanser
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Automatyczny balanser z pętlą + ręczny przycisk bez odświeżania.
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*mode=prod*
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    // --- AUTORSKI STYL (CSS) ---
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --bg-main: #36393f;
            --bg-row-alt: #32353b;
            --bg-header: #202225;
            --border-color: #3e4147;
            --text-color: white;
            --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
        }
        .tcm-panel {
            background-color: var(--bg-main);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.6);
            font-family: Verdana, sans-serif;
            padding: 12px;
            user-select: none;
            z-index: 99999;
        }
        .tcm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-header);
            color: var(--title-color);
            border-bottom: 1px solid var(--border-color);
            margin: -12px -12px 8px -12px;
            padding: 8px 12px;
            border-radius: 4px 4px 0 0;
        }
        .tcm-btn {
            background: var(--btn-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 3px;
            cursor: pointer;
            padding: 6px;
            font-weight: bold;
            text-shadow: 1px 1px 2px black;
            text-align: center;
        }
        .tcm-btn:hover {
            background: var(--btn-hover);
            color: #ffffff;
        }
        .tcm-input {
            background: var(--bg-header);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 3px;
            text-align: center;
            padding: 2px;
        }
        .tcm-input:focus {
            outline: 1px solid #7b7e85;
        }
    `;
    document.head.appendChild(style);

    const urlKey = window.location.hostname.split('.')[0];
    let isRunning = localStorage.getItem(`balanser_run_${urlKey}`) === 'true';
    let loopConfig = JSON.parse(localStorage.getItem(`balanser_loop_${urlKey}`)) || { min: 120, max: 240 };
    let uiState = JSON.parse(localStorage.getItem(`balanser_ui_${urlKey}`)) || { pinned: false, top: 'auto', left: 'auto', bottom: '20px', right: '20px' };

    const min_click = 100;
    const max_click = 100;
    const delay = ms => new Promise(res => setTimeout(res, ms));

    let countdownTimer = null;
    let clockInterval = null;
    let isExecuting = false;

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async function startBalancing(isManual = false) {
        if (isExecuting) return;
        isExecuting = true;

        const sendButtons = [...document.querySelectorAll("button, input")].filter(el =>
            (el.innerText && (el.innerText.includes("Send resources") || el.innerText.includes("Wyślij surowce"))) ||
            (el.value && (el.value.includes("Send resources") || el.value.includes("Wyślij surowce")))
        );

        const statusDisplay = document.getElementById('balanser-status');

        if (sendButtons.length === 0) {
            if (statusDisplay) statusDisplay.textContent = "Brak wysyłek. Czekam...";
            isExecuting = false;
            if (!isManual) startCountdown();
            return;
        }

        if (statusDisplay) statusDisplay.textContent = isManual ? "Ręczny" : "Pętla";
        if (isManual) $('#top_start_btn').text("🔄...").css("background", "#444");

        for (let i = 0; i < sendButtons.length; i++) {
            if (!isManual && !isRunning) {
                isExecuting = false;
                return; 
            }
            
            sendButtons[i].click();
            await delay(100);

            const confirmBtn = [...document.querySelectorAll("button, input")].find(el =>
                (el.innerText && (el.innerText.includes("Confirm") || el.innerText.includes("Potwierdź"))) ||
                (el.value && (el.value.includes("Confirm") || el.value.includes("Potwierdź")))
            );

            if (confirmBtn) confirmBtn.click();

            const rnd = Math.floor(Math.random() * (max_click - min_click + 1)) + min_click;
            await delay(rnd);
        }

        isExecuting = false;

        if (isManual) {
            if (statusDisplay) statusDisplay.textContent = "Zakończono (Tryb Ręczny)";
            $('#top_start_btn').text("✅ GOTOWE").css("background", "#5cb85c");
            setTimeout(() => { $('#top_start_btn').text("▶️ RĘCZNY").css("background", "var(--btn-bg)"); }, 3000);
        } else {
            if (statusDisplay) statusDisplay.textContent = "Zakończono wysyłkę!";
            startCountdown();
        }
    }

    function startCountdown() {
        if (!isRunning) return;
        
        let waitTime = randomDelay(loopConfig.min, loopConfig.max);
        const statusDisplay = document.getElementById('balanser-status');
        
        clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
            if (!isRunning) {
                clearInterval(countdownTimer);
                if (statusDisplay) statusDisplay.textContent = "Zatrzymano";
                return;
            }

            if (waitTime <= 0) {
                clearInterval(countdownTimer);
                if (statusDisplay) statusDisplay.textContent = "Odświeżanie...";
                window.location.search = '?screen=overview_villages&mode=prod';
            } else {
                let mins = Math.floor(waitTime / 60);
                let secs = waitTime % 60;
                if (statusDisplay) statusDisplay.textContent = `Kolejna pętla: ${mins}m ${secs.toString().padStart(2, '0')}s`;
                waitTime--;
            }
        }, 1000);
    }

    function injectButton() {
        if ($('#top_start_btn').length) return;

        const targetCell = $('.box-item:contains("|")').last();

        if (targetCell.length) {
            const btnHtml = `
                <a href="#" id="top_start_btn" class="tcm-btn"
                   style="display:inline-block; padding: 2px 8px; font-size:11px; margin-left:10px; text-decoration:none; width:auto;">
                   ▶️ RĘCZNY
                </a>`;
            targetCell.append(btnHtml);

            $('#top_start_btn').on('click', function(e) {
                e.preventDefault();
                startBalancing(true); 
            });
        }
    }

    function createUI() {
        const div = document.createElement('div');
        div.id = 'balanser-container';
        div.className = 'tcm-panel';
        
        // Zastosowanie przypięcia lub pozycjonowania fixed
        div.style.position = uiState.pinned ? 'absolute' : 'fixed'; 
        
        div.style.top = uiState.top;
        div.style.left = uiState.left;
        if(uiState.top === 'auto') {
            div.style.bottom = uiState.bottom;
            div.style.right = uiState.right;
        }

        const header = document.createElement('div');
        header.className = 'tcm-header';

        const title = document.createElement('span');
        title.textContent = 'Balanser TCM';
        title.style.fontWeight = 'bold';
        title.style.cursor = uiState.pinned ? 'default' : 'move';

        const pinBtn = document.createElement('span');
        pinBtn.innerHTML = uiState.pinned ? '🔴' : '📌';
        pinBtn.style.cursor = 'pointer';
        pinBtn.title = 'Przypnij do strony';
        
        pinBtn.onclick = () => {
            uiState.pinned = !uiState.pinned;
            pinBtn.innerHTML = uiState.pinned ? '🔴' : '📌';
            title.style.cursor = uiState.pinned ? 'default' : 'move';
            
            // Logika zmiany position (fixed vs absolute) żeby zachować przewijanie z dokumentem
            if (uiState.pinned) {
                let rect = div.getBoundingClientRect();
                div.style.position = 'absolute';
                div.style.top = (rect.top + window.scrollY) + 'px';
            } else {
                let rect = div.getBoundingClientRect();
                div.style.position = 'fixed';
                div.style.top = rect.top + 'px';
            }
            
            uiState.top = div.style.top;
            localStorage.setItem(`balanser_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.appendChild(title);
        header.appendChild(pinBtn);

        const realTimeClock = document.createElement('div');
        realTimeClock.id = 'balanser-clock';
        realTimeClock.style.textAlign = 'center';
        realTimeClock.style.fontSize = '12px';
        realTimeClock.style.color = '#aaa';
        realTimeClock.style.marginBottom = '8px';

        clockInterval = setInterval(() => {
            const now = new Date();
            realTimeClock.textContent = now.toLocaleTimeString('pl-PL');
        }, 1000);
        
        const statusDisplay = document.createElement('div');
        statusDisplay.id = 'balanser-status'; 
        statusDisplay.style.textAlign = 'center'; 
        statusDisplay.style.fontSize = '12px';
        statusDisplay.style.fontWeight = 'bold';
        statusDisplay.style.color = '#5cb85c'; 
        statusDisplay.style.marginBottom = '8px';
        statusDisplay.textContent = isRunning ? "Inicjalizacja..." : "Gotowy";

        const loopRow = document.createElement('div');
        loopRow.style.display = 'flex';
        loopRow.style.alignItems = 'center';
        loopRow.style.justifyContent = 'space-between';
        loopRow.style.marginBottom = '12px';
        loopRow.style.fontSize = '11px';

        const loopLabel = document.createElement('span');
        loopLabel.textContent = 'Pętla (s):';

        const loopInputs = document.createElement('div');
        loopInputs.style.display = 'flex';
        loopInputs.style.gap = '4px';

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'tcm-input';
        minInput.value = loopConfig.min;
        minInput.style.width = '45px';

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'tcm-input';
        maxInput.value = loopConfig.max;
        maxInput.style.width = '45px';

        const saveLoop = () => {
            let minVal = parseInt(minInput.value) || 0;
            let maxVal = parseInt(maxInput.value) || 0;
            if (minVal > maxVal) maxVal = minVal;
            loopConfig = { min: minVal, max: maxVal };
            localStorage.setItem(`balanser_loop_${urlKey}`, JSON.stringify(loopConfig));
        };

        minInput.addEventListener('input', saveLoop);
        maxInput.addEventListener('input', saveLoop);

        loopInputs.appendChild(minInput);
        loopInputs.appendChild(document.createTextNode('-'));
        loopInputs.appendChild(maxInput);
        loopRow.appendChild(loopLabel);
        loopRow.appendChild(loopInputs);

        const btnStart = document.createElement('button');
        btnStart.className = 'tcm-btn';
        btnStart.textContent = isRunning ? "STOP" : "START";
        btnStart.style.width = '100%';
        btnStart.style.backgroundColor = isRunning ? '#d9534f' : '#5cb85c';
        
        btnStart.onclick = () => { 
            isRunning = !isRunning; 
            localStorage.setItem(`balanser_run_${urlKey}`, isRunning); 
            
            if (isRunning) {
                btnStart.textContent = "STOP";
                btnStart.style.backgroundColor = '#d9534f';
                setTimeout(() => { startBalancing(false); }, 2000);
            } else {
                btnStart.textContent = "START";
                btnStart.style.backgroundColor = '#5cb85c';
                statusDisplay.textContent = "Zatrzymano";
                clearInterval(countdownTimer);
            }
        };

        div.appendChild(header);
        div.appendChild(realTimeClock);
        div.appendChild(statusDisplay);
        div.appendChild(loopRow); 
        div.appendChild(btnStart); 
        document.body.appendChild(div);

        let isDragging = false;
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if (uiState.pinned || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target === pinBtn) return;
            isDragging = true;
            let event = e.type.includes('mouse') ? e : e.touches[0];
            startX = event.clientX;
            startY = event.clientY;
            initialX = div.offsetLeft;
            initialY = div.offsetTop;
            div.style.bottom = 'auto';
            div.style.right = 'auto';
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let event = e.type.includes('mouse') ? e : e.touches[0];
            let dx = event.clientX - startX;
            let dy = event.clientY - startY;
            div.style.left = (initialX + dx) + 'px';
            div.style.top = (initialY + dy) + 'px';
        };

        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            uiState.top = div.style.top;
            uiState.left = div.style.left;
            uiState.bottom = 'auto';
            uiState.right = 'auto';
            localStorage.setItem(`balanser_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        header.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    createUI();
    
    // Pobranie logiki balansera (zewnętrzny skrypt potrzebny do uzupełniania pól)
    await $.getScript("https://shinko-to-kuma.com/scripts/WHBalancerShinkoToKuma.js");
    
    setInterval(injectButton, 1000); 

    if (isRunning) {
        setTimeout(() => { startBalancing(false); }, 2500); 
    }

})();
