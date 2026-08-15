// ==UserScript==
// @name         Zarządca Dysponenta Surowców
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Mobilny panel konfiguracji oraz automatyzacja klikania dla Dysponenta Surowcowego
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=overview_villages*mode=combined*
// @match        https://*.plemiona.pl/game.php?*screen=market*mode=call*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Nazwa klucza localStorage do zapisywania konfiguracji (w tym czasu reakcji)
    const STORAGE_KEY = 'tcm_dysponent_config';

    // Domyślne ustawienia
    let config = {
        fillWood: 28000,
        fillClay: 30000,
        fillIron: 25000,
        safeWood: 10000,
        safeClay: 10000,
        safeIron: 10000,
        reactionDelay: 300 // Czas reakcji w ms
    };

    // Wczytanie zapisanych ustawień, jeśli istnieją
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
        try {
            config = JSON.parse(savedConfig);
        } catch (e) {
            console.error('TCM: Błąd parsowania konfiguracji', e);
        }
    }

    // Sprawdzamy na jakiej stronie aktualnie jesteśmy
    const urlParams = new URLSearchParams(window.location.search);
    const screen = urlParams.get('screen');
    const mode = urlParams.get('mode');

    // ==========================================
    // 1. TRYB: PRZEGLĄD KOMBINOWANY (UI i Sterowanie)
    // ==========================================
    if (screen === 'overview_villages' && mode === 'combined') {
        
        const injectStyles = () => {
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
                }
                #tcm-dysponent-ui {
                    position: absolute;
                    top: 100px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--bg-main);
                    border: 2px solid var(--border-color);
                    color: var(--text-color);
                    width: 90%;
                    max-width: 320px;
                    z-index: 99999;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    border-radius: 8px;
                    font-family: sans-serif;
                }
                #tcm-dysponent-header {
                    background: var(--bg-header);
                    color: var(--title-color);
                    padding: 10px;
                    font-weight: bold;
                    text-align: center;
                    border-bottom: 1px solid var(--border-color);
                    border-top-left-radius: 6px;
                    border-top-right-radius: 6px;
                    touch-action: none;
                }
                .tcm-section {
                    padding: 10px;
                    border-bottom: 1px solid var(--border-color);
                }
                .tcm-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    align-items: center;
                }
                .tcm-row label {
                    font-size: 12px;
                    flex: 1;
                }
                .tcm-input {
                    width: 70px;
                    background: var(--bg-row-alt);
                    border: 1px solid var(--border-color);
                    color: var(--text-color);
                    padding: 5px;
                    text-align: center;
                    border-radius: 4px;
                }
                .tcm-btn {
                    background: var(--btn-bg);
                    color: var(--text-color);
                    border: 1px solid var(--border-color);
                    padding: 12px;
                    font-size: 14px;
                    font-weight: bold;
                    border-radius: 6px;
                    cursor: pointer;
                    width: calc(100% - 20px);
                    margin: 10px;
                    display: block;
                    box-sizing: border-box;
                    touch-action: manipulation;
                    text-align: center;
                }
                .tcm-btn:active {
                    background: var(--btn-hover);
                }
            `;
            document.head.appendChild(style);
        };

        const createUI = () => {
            injectStyles();

            const ui = document.createElement('div');
            ui.id = 'tcm-dysponent-ui';
            ui.innerHTML = `
                <div id="tcm-dysponent-header">Zarządca Surowców (TCM)</div>
                <div class="tcm-section">
                    <div style="text-align:center; font-size:12px; margin-bottom:10px; color:var(--title-color);">Wypełnienie do:</div>
                    <div class="tcm-row"><label>Drewno:</label> <input type="number" id="tcm-fill-wood" class="tcm-input" value="${config.fillWood}"></div>
                    <div class="tcm-row"><label>Glina:</label> <input type="number" id="tcm-fill-clay" class="tcm-input" value="${config.fillClay}"></div>
                    <div class="tcm-row"><label>Żelazo:</label> <input type="number" id="tcm-fill-iron" class="tcm-input" value="${config.fillIron}"></div>
                </div>
                <div class="tcm-section">
                    <div style="text-align:center; font-size:12px; margin-bottom:10px; color:var(--title-color);">Rezerwa (zostaw):</div>
                    <div class="tcm-row"><label>Drewno:</label> <input type="number" id="tcm-safe-wood" class="tcm-input" value="${config.safeWood}"></div>
                    <div class="tcm-row"><label>Glina:</label> <input type="number" id="tcm-safe-clay" class="tcm-input" value="${config.safeClay}"></div>
                    <div class="tcm-row"><label>Żelazo:</label> <input type="number" id="tcm-safe-iron" class="tcm-input" value="${config.safeIron}"></div>
                </div>
                <div class="tcm-section">
                    <div style="text-align:center; font-size:12px; margin-bottom:10px; color:var(--title-color);">Czas reakcji (ms):</div>
                    <div class="tcm-row"><label>Opóźnienie:</label> <input type="number" id="tcm-reaction-delay" class="tcm-input" value="${config.reactionDelay}" step="50" min="50"></div>
                </div>
                <button id="tcm-start-btn" class="tcm-btn">Start i Wykonaj Plan</button>
            `;
            document.body.appendChild(ui);
            makeDraggable(ui, document.getElementById('tcm-dysponent-header'));

            document.getElementById('tcm-start-btn').addEventListener('click', startProcess);
        };

        const makeDraggable = (element, handle) => {
            let startX = 0, startY = 0, initialX = 0, initialY = 0;
            
            handle.addEventListener('touchstart', (e) => {
                let touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                initialX = element.offsetLeft;
                initialY = element.offsetTop;
                element.style.transform = 'none'; 
                element.style.left = initialX + 'px';
            }, { passive: true });

            handle.addEventListener('touchmove', (e) => {
                let touch = e.touches[0];
                let dx = touch.clientX - startX;
                let dy = touch.clientY - startY;
                element.style.left = (initialX + dx) + 'px';
                element.style.top = (initialY + dy) + 'px';
            }, { passive: true });
        };

        const clickElementPrecyzyjnie = (selector, callback) => {
            let attempts = 0;
            let interval = setInterval(() => {
                attempts++;
                let targetBtn = document.querySelector(selector);

                if (targetBtn && targetBtn.style.display !== 'none' && !targetBtn.disabled) {
                    clearInterval(interval);
                    targetBtn.click();
                    if (callback) setTimeout(callback, 1200); 
                } else if (attempts > 40) {
                    clearInterval(interval);
                    console.error('TCM: Przekroczono czas oczekiwania na element: ' + selector);
                }
            }, 500);
        };

        const startProcess = () => {
            // Pobranie danych z UI do obiektu config
            config.fillWood = parseInt(document.getElementById('tcm-fill-wood').value) || 0;
            config.fillClay = parseInt(document.getElementById('tcm-fill-clay').value) || 0;
            config.fillIron = parseInt(document.getElementById('tcm-fill-iron').value) || 0;

            config.safeWood = parseInt(document.getElementById('tcm-safe-wood').value) || 0;
            config.safeClay = parseInt(document.getElementById('tcm-safe-clay').value) || 0;
            config.safeIron = parseInt(document.getElementById('tcm-safe-iron').value) || 0;

            config.reactionDelay = parseInt(document.getElementById('tcm-reaction-delay').value) || 300;

            // Zapisujemy konfigurację do localStorage, aby skrypt na rynku ją odczytał
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

            // Wstrzyknięcie globalne zmiennych dla oryginalnego skryptu
            window.DysponentSurowcowy = {
                resourcesFillTo: [config.fillWood, config.fillClay, config.fillIron],
                resourcesSafeguard: [config.safeWood, config.safeClay, config.safeIron],
                tradersSafeguard: 0,
                considerOngoingTransports: true,
                overFlowThreshold: 75,
                extendedOptimization: true,
                minSummon: 1000
            };

            // Ukrywamy okno na czas działania
            document.getElementById('tcm-dysponent-ui').style.display = 'none';

            // Uruchomienie zewnętrznego skryptu
            $.getScript('https://media.innogamescdn.com/com_DS_PL/skrypty/Dysponent_Surowcowy.js');

            // Sekwencja klikania przycisków generowania planu
            clickElementPrecyzyjnie('input[value="Opracuj Plan"]', () => {
                clickElementPrecyzyjnie('#marketplace_button', () => {
                    console.log('TCM: Plan wygenerowany i wysłany!');
                });
            });
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            createUI();
        } else {
            window.addEventListener('DOMContentLoaded', createUI);
        }
    }

    // ==========================================
    // 2. TRYB: RYNEK - WEZWANIA SUROWCÓW (Automatyzacja klikania)
    // ==========================================
    else if (screen === 'market' && mode === 'call') {
        let actionTriggered = false;

        function tryClickSubmit() {
            if (actionTriggered) return true;

            const checkedBox = document.querySelector('input[name="select-village"]:checked');
            const submitBtn = document.querySelector('form[name="call-resources"] input[type="submit"]');

            if (checkedBox && submitBtn && !submitBtn.disabled) {
                actionTriggered = true;
                
                // Pobieramy czas reakcji z konfiguracji (zabezpieczenie przed brakiem danych: domyślnie 300ms)
                let delay = config.reactionDelay || 300;
                
                setTimeout(() => {
                    if (document.querySelector('input[name="select-village"]:checked')) {
                        submitBtn.click();
                    }
                }, delay);
                
                return true;
            }
            return false;
        }

        // Czekamy na załadowanie oryginalnego skryptu odpowiedzialnego za wezwania
        $.getScript('https://media.innogamescdn.com/com_DS_PL/skrypty/Dysponent_Surowcowy.js', function() {
            const targetNode = document.getElementById('content_value') || document.body;
            
            const observer = new MutationObserver((mutations, obs) => {
                if (tryClickSubmit()) {
                    obs.disconnect();
                }
            });

            observer.observe(targetNode, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['disabled', 'checked']
            });

            setTimeout(() => {
                if (!actionTriggered && tryClickSubmit()) {
                    observer.disconnect();
                }
            }, 700);
        });
    }

})();
