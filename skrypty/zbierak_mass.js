// ==UserScript==
// @name         Kalkulator Zbierak
// @namespace    https://viayoo.com/
// @version      1.3
// @description  Kalkulator i automatyzacja masowej wysyłki zbieractwa
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=place&mode=scavenge_mass*
// ==/UserScript==

(function () {
    'use strict';

    // Dodanie systemowych styli CSS
    const style = document.createElement('style');
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
        #scav-container {
            position: fixed;
            z-index: 99999;
            background-color: var(--bg-main);
            border: 1px solid var(--border-color);
            padding: 10px;
            border-radius: 5px;
            color: var(--text-color);
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            font-family: Verdana, Arial, sans-serif;
            font-size: 12px;
            user-select: none;
            width: 200px;
        }
        .scav-btn {
            width: 100%;
            padding: 6px;
            margin-bottom: 5px;
            cursor: pointer;
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 3px;
            background: var(--btn-bg);
            font-weight: bold;
        }
        .scav-btn:hover { background: var(--btn-hover); }
        .scav-btn-blue { background: var(--btn-blue-bg); }
        .scav-btn-blue:hover { background: var(--btn-blue-hover); }
        .scav-btn-green { background: var(--btn-green-bg); }
        .scav-btn-green:hover { background: var(--btn-green-hover); }
        .scav-btn-red { background: var(--btn-red-bg); }
        .scav-btn-red:hover { background: var(--btn-red-hover); }
        .scav-input {
            width: 35px;
            background: var(--bg-row-alt);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            text-align: center;
            border-radius: 3px;
        }
    `;
    document.head.appendChild(style);

    const urlKey = window.location.hostname.split('.')[0];
    let isRunning = localStorage.getItem(`scav_run_${urlKey}`) === 'true';

    let delayConfig = JSON.parse(localStorage.getItem(`scav_delay_${urlKey}`)) || { min: 5, max: 10 };
    let uiState = JSON.parse(localStorage.getItem(`scav_ui_${urlKey}`)) || { pinned: false, top: 'auto', left: 'auto', bottom: '150px', right: '20px' };

    let URLReq = game_data.player.sitter > 0 
        ? `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass` 
        : "game.php?&screen=place&mode=scavenge_mass";

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Wyrównana logika pobierania zewnętrznego skryptu i klikania
    function loadShinkoMassScavenge(autoClick = false) {
        // Użycie jQuery getScript jest bezpieczniejsze przy nakładkach ładujących
        $.getScript('https://shinko-to-kuma.com/scripts/massScavenge.js').done(function() {
            if (autoClick) {
                let attempts = 0;
                
                // Polling - czekanie aż skrypt wygeneruje przycisk, zamiast strzelania na ślepo
                const checkBtnInterval = setInterval(() => {
                    attempts++;
                    const sendMassButton = document.getElementById('sendMass');
                    
                    if (sendMassButton) {
                        clearInterval(checkBtnInterval);
                        
                        setTimeout(() => {
                            sendMassButton.click();
                            
                            // Oczekanie na drugi przycisk i wykonanie ostatecznego wysłania
                            setTimeout(() => {
                                const sendMassButton2 = document.querySelector('input#sendMass.btn.btnSophie');
                                if (sendMassButton2) {
                                    sendMassButton2.click();
                                    if (typeof $ !== 'undefined') $(sendMassButton2).trigger('click'); 
                                    
                                    // Odświeżenie po udanej wysyłce
                                    setTimeout(() => location.reload(), 2000);
                                }
                            }, randomDelay(1000, 2000));
                            
                        }, randomDelay(1000, 3000));
                    } else if (attempts > 30) {
                        // Jeśli po 15 sekundach (30 prób * 500ms) przycisk się nie wygeneruje - restart (zabezpieczenie przed zawieszeniem)
                        clearInterval(checkBtnInterval);
                        console.error("Zbyt długi czas oczekiwania na przycisk sendMass.");
                        location.reload();
                    }
                }, 500);
            }
        }).fail(function() {
            console.error("Błąd pobierania skryptu massScavenge.js");
            if(autoClick) {
                setTimeout(() => location.reload(), 5000); // Awaryjne odświeżenie
            }
        });
    }

    function loadVisualTable() {
        $.getScript('https://shinko-to-kuma.com/scripts/scavengingOverview.js');
    }

    function createDraggableUI() {
        const div = document.createElement('div');
        div.id = 'scav-container';

        div.style.top = uiState.top;
        div.style.left = uiState.left;
        if(uiState.top === 'auto') {
            div.style.bottom = uiState.bottom;
            div.style.right = uiState.right;
        }

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '8px';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.style.paddingBottom = '4px';

        const title = document.createElement('span');
        title.textContent = 'Kalkulator Zbierak';
        title.style.fontWeight = 'bold';
        title.style.color = 'var(--title-color)';
        title.style.cursor = uiState.pinned ? 'default' : 'move';

        const pinBtn = document.createElement('span');
        pinBtn.innerHTML = uiState.pinned ? '📌' : '📍';
        pinBtn.style.cursor = 'pointer';
        pinBtn.onclick = () => {
            uiState.pinned = !uiState.pinned;
            pinBtn.innerHTML = uiState.pinned ? '📌' : '📍';
            title.style.cursor = uiState.pinned ? 'default' : 'move';
            localStorage.setItem(`scav_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.appendChild(title);
        header.appendChild(pinBtn);

        const clock = document.createElement('div');
        clock.id = 'scav-clock'; 
        clock.style.textAlign = 'center'; 
        clock.style.fontSize = '14px';
        clock.style.fontWeight = 'bold';
        clock.style.color = '#5cb85c';
        clock.style.marginBottom = '8px';
        clock.textContent = isRunning ? "Inicjalizacja..." : "Wyłączony";

        const delayRow = document.createElement('div');
        delayRow.style.display = 'flex';
        delayRow.style.alignItems = 'center';
        delayRow.style.justifyContent = 'space-between';
        delayRow.style.marginBottom = '8px';

        const delayLabel = document.createElement('span');
        delayLabel.textContent = 'Opóźnienie (s):';

        const delayInputs = document.createElement('div');
        delayInputs.style.display = 'flex';
        delayInputs.style.gap = '4px';

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.id = 'scav-min-delay';
        minInput.className = 'scav-input';
        minInput.value = delayConfig.min;

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.id = 'scav-max-delay';
        maxInput.className = 'scav-input';
        maxInput.value = delayConfig.max;

        const saveDelay = () => {
            let minVal = parseInt(minInput.value) || 0;
            let maxVal = parseInt(maxInput.value) || 0;
            if (minVal > maxVal) maxVal = minVal;
            delayConfig = { min: minVal, max: maxVal };
            localStorage.setItem(`scav_delay_${urlKey}`, JSON.stringify(delayConfig));
        };

        minInput.addEventListener('input', saveDelay);
        maxInput.addEventListener('input', saveDelay);

        delayInputs.appendChild(minInput);
        delayInputs.appendChild(document.createTextNode('-'));
        delayInputs.appendChild(maxInput);
        delayRow.appendChild(delayLabel);
        delayRow.appendChild(delayInputs);

        const btnManualRun = document.createElement('button');
        btnManualRun.textContent = '🚀 Uruchom Zbierak';
        btnManualRun.className = 'scav-btn scav-btn-blue';
        btnManualRun.onclick = () => { loadShinkoMassScavenge(false); };

        const btnOverview = document.createElement('button');
        btnOverview.textContent = 'ℹ️ Pokaż Czasy';
        btnOverview.className = 'scav-btn';
        btnOverview.onclick = () => { loadVisualTable(); };

        const btnUnlock = document.createElement('button');
        btnUnlock.textContent = '⚙️ Odblokuj Zbierak';
        btnUnlock.className = 'scav-btn scav-btn-blue';
        btnUnlock.onclick = () => {
            $.getScript('https://twscripts.dev/scripts/massUnlockScav.js');
        };

        const btnStart = document.createElement('button');
        btnStart.textContent = isRunning ? '❎️ Stop ZBIERACTWO' : '✅️ Start ZBIERACTWO';
        btnStart.className = `scav-btn ${isRunning ? 'scav-btn-red' : 'scav-btn-green'}`;

        btnStart.onclick = () => { 
            isRunning = !isRunning; 
            localStorage.setItem(`scav_run_${urlKey}`, isRunning); 
            location.reload(); 
        };

        div.appendChild(header);
        div.appendChild(clock);
        div.appendChild(delayRow); 
        div.appendChild(btnManualRun);
        div.appendChild(btnOverview); 
        div.appendChild(btnUnlock); 
        div.appendChild(btnStart); 
        document.body.appendChild(div);

        let isDragging = false;
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if (uiState.pinned || e.target === pinBtn || e.target === btnStart || e.target === btnOverview || e.target === btnUnlock || e.target === btnManualRun || e.target === minInput || e.target === maxInput) return;
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
            localStorage.setItem(`scav_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        header.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    function sophieGetAll(urls, onLoad, onDone) {
        let numDone = 0;
        let lastRequestTime = 0;
        let minWaitTime = 1050; 

        loadNext();

        function loadNext() {
            if (numDone == urls.length) { onDone(); return; }
            let now = Date.now();
            let timeElapsed = now - lastRequestTime;
            if (timeElapsed < minWaitTime) {
                setTimeout(loadNext, minWaitTime - timeElapsed);
                return;
            }
            lastRequestTime = now;
            $.get(urls[numDone])
                .done((data) => {
                    try { onLoad(numDone, data); ++numDone; loadNext(); } 
                    catch (e) { console.error(e); }
                }).fail(() => { setTimeout(loadNext, 1000); });
        }
    }

    function checkScavengeData() {
        const clock = document.getElementById('scav-clock');
        if (!isRunning) { 
            clock.textContent = "Wyłączony"; 
            return; 
        }
        clock.textContent = "Skanowanie...";

        $.get(URLReq, function (data) {
            let amountOfPages = 0;
            if ($(data).find(".paged-nav-item").length > 0) {
                amountOfPages = parseInt($(data).find(".paged-nav-item")[$(data).find(".paged-nav-item").length - 1].href.match(/page=(\d+)/)[1]);
            }
            let URLs = [];
            for (let i = 0; i <= amountOfPages; i++) URLs.push(URLReq + "&page=" + i);

            let arrayWithData = "[";

            sophieGetAll(URLs, (i, here) => {
                let thisPageData = $(here).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[2];
                arrayWithData += thisPageData + ",";
            }, () => {
                arrayWithData = arrayWithData.substring(0, arrayWithData.length - 1) + "]";

                try {
                    let scavengeInfo = JSON.parse(arrayWithData);
                    let minTime = Infinity;
                    let hasReadyVillages = false;

                    $.each(scavengeInfo, function (villageNr) {
                        let units = scavengeInfo[villageNr]["unit_counts_home"];
                        let hasTroops = false;
                        if (units) {
                            let totalUnits = (parseInt(units.spear || 0)) + 
                                             (parseInt(units.sword || 0)) + 
                                             (parseInt(units.axe || 0)) + 
                                             (parseInt(units.archer || 0)) + 
                                             (parseInt(units.light || 0)) + 
                                             (parseInt(units.marcher || 0)) + 
                                             (parseInt(units.heavy || 0)) + 
                                             (parseInt(units.knight || 0));

                            if (totalUnits >= 10) { 
                                hasTroops = true;
                            }
                        } else {
                            hasTroops = true;
                        }

                        $.each(scavengeInfo[villageNr]["options"], function (villageCategoryNr) {
                            let option = scavengeInfo[villageNr]["options"][villageCategoryNr];
                            if (option["is_locked"] !== true) {
                                if (option["scavenging_squad"] == null) {
                                    if (hasTroops) {
                                        hasReadyVillages = true;
                                    }
                                } else {
                                    let endTime = parseInt(option["scavenging_squad"]["return_time"]);
                                    if (endTime < minTime) minTime = endTime;
                                }
                            }
                        });
                    });

                    if (hasReadyVillages) {
                        clock.textContent = "Urun. wysyłkę!";
                        loadShinkoMassScavenge(true);
                    } else if (minTime !== Infinity) {
                        let addedSeconds = randomDelay(delayConfig.min, delayConfig.max);
                        let targetTime = minTime + addedSeconds;

                        const interval = setInterval(() => {
                            let currentNow = Math.floor(Date.now() / 1000);
                            let diff = targetTime - currentNow;
                            if (diff <= 0) {
                                clearInterval(interval);
                                clock.textContent = "Odświeżanie...";
                                location.reload();
                            } else {
                                let mins = Math.floor(diff / 60);
                                let secs = diff % 60;
                                clock.textContent = `Zegarek: ${mins}:${secs.toString().padStart(2, '0')}`;
                            }
                        }, 1000);
                    } else {
                        clock.textContent = "Brak ruchu (60s)";
                        setTimeout(() => { location.reload(); }, 60000);
                    }
                } catch (err) {
                    console.error("Błąd parsowania: ", err);
                    clock.textContent = "Błąd struktury";
                }
            });
        });
    }

    // Inicjalizacja interfejsu
    createDraggableUI();

    // Skanowanie uruchamiane tylko gdy flaga isRunning jest aktywna
    checkScavengeData();
})();
