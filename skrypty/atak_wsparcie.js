// ==UserScript==
// @name         kalkulator Atak/wsparcie 
// @version      1.0.0
// @description  Zintegrowany system wysyłki w kompaktowym UI
// @namespace    https://viayoo.com/
// @author       TCM
// @include      https://*/game.php?*&screen=place&try=confirm
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let inputMs, input, delay, arrRequest, attRequest;
    let delayTime = parseInt(localStorage.delayTime) || 0;

    // --- SEKCJA PINGU (LOGIKA) ---
    function checkPing() {
        const start = Date.now();
        fetch('/game.php?screen=overview', { method: 'HEAD', cache: 'no-store' })
            .then(() => {
                const diff = Date.now() - start;
                const pingDisplay = document.getElementById("live-ping-val");
                if (pingDisplay) {
                    pingDisplay.innerText = diff;
                    pingDisplay.style.color = diff < 150 ? "#00ff00" : (diff < 250 ? "#ffff00" : "#ff4444");
                }
            }).catch(() => {});
    }
    setInterval(checkPing, 3000);

    // --- STYL (CSS) ---
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --ui-font-size: 12px;
            
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

        #tw-pro-tools {
            display: inline-block;
            min-width: 220px;
            background-color: var(--bg-main) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            font-family: Verdana, sans-serif !important;
            border-radius: 4px !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
            font-size: var(--ui-font-size) !important;
            padding: 8px !important;
            box-sizing: border-box;
        }

        .tw-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--border-color);
        }
        
        .tw-row-no-border {
            border-bottom: none;
            padding-bottom: 0;
            margin-top: 6px;
            gap: 5px;
        }

        .shinko-btn {
            background: var(--btn-bg) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            padding: 4px 6px !important;
            text-shadow: 1px 1px 2px black;
            font-size: var(--ui-font-size) !important;
            display: inline-block;
            text-decoration: none !important;
            text-align: center;
            box-sizing: border-box;
        }

        .shinko-btn:hover {
            background: var(--btn-hover) !important;
            color: #ffffff !important;
        }

        .shinko-input {
            background-color: var(--bg-header) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            border-radius: 3px !important;
            padding: 3px !important;
            font-size: var(--ui-font-size) !important;
            text-align: center;
            box-sizing: border-box;
        }

        .ping-box {
            font-weight: bold;
            font-size: 0.9em;
        }
    `;
    document.head.appendChild(style);

    // --- INTERFEJS (HTML) ---
    // Dodano wrapper wymuszający załamanie linii (display: block; clear: both;)
    const buttonsHtml = `
        <div style="display: block; clear: both; width: 100%; margin-top: 15px;">
            <div id="tw-pro-tools">
                <!-- Wiersz 1: OFFSET [Ping] [Input] [Zapisz] -->
                <div class="tw-row">
                    <span style="font-weight: bold;">OFFSET</span>
                    <span class="ping-box">[<span id="live-ping-val" style="color: #00ff00;">...</span>ms]</span>
                    <div style="display: flex; gap: 3px;">
                        <input id="delayInput" class="shinko-input" value="${delayTime}" style="width: 40px;">
                        <a id="delayButton" class="shinko-btn" title="Zapisz">💾</a>
                    </div>
                </div>
                
                <!-- Wiersz 2: czas wejścia - xxxxx -->
                <div class="tw-row">
                    <span>Wejście - </span>
                    <span id="showArrTime" style="font-weight: bold; color: var(--title-color);">-</span>
                </div>
                
                <!-- Wiersz 3: czas wyjścia - xxxxx -->
                <div class="tw-row">
                    <span>Wysyłka - </span>
                    <span id="showSendTime" style="font-weight: bold; color: var(--title-color);">-</span>
                </div>
                
                <!-- Wiersz 4: [btn] [btn] -->
                <div class="tw-row tw-row-no-border">
                    <a id="arrTime" class="shinko-btn" style="flex: 1;">Dotarcie</a>
                    <a id="sendTime" class="shinko-btn" style="flex: 1;">Wysyłka</a>
                </div>
            </div>
        </div>
    `;

    document.getElementById("troop_confirm_submit").insertAdjacentHTML("afterend", buttonsHtml);

    // --- LOGIKA CZASU ---
    function toMs(t) {
        const [h, m, s] = t.split(":").map(Number);
        return ((h * 3600) + (m * 60) + s) * 1000;
    }

    function setArrivalTime() {
        const targetMs = toMs(input);
        function check() {
            let arrivalText = document.querySelector(".relative_time").textContent;
            let nowMs = toMs(arrivalText.slice(-8));
            if (nowMs >= targetMs) {
                cancelAnimationFrame(arrRequest);
                setTimeout(() => document.getElementById("troop_confirm_submit").click(), delay);
            } else { arrRequest = requestAnimationFrame(check); }
        }
        arrRequest = requestAnimationFrame(check);
    }

    function setSendTime() {
        const targetMs = toMs(input);
        function check() {
            const now = Timing.getCurrentServerTime();
            const date = new Date(now);
            const nowMs = (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) * 1000;
            if (nowMs >= targetMs) {
                cancelAnimationFrame(attRequest);
                setTimeout(() => document.getElementById("troop_confirm_submit").click(), delay);
            } else { attRequest = requestAnimationFrame(check); }
        }
        attRequest = requestAnimationFrame(check);
    }

    // --- OBSŁUGA PRZYCISKÓW ---
    document.getElementById("arrTime").onclick = function () {
        cancelAnimationFrame(attRequest);
        input = prompt("Godzina (HH:MM:SS)", document.querySelector(".relative_time").textContent.slice(-8));
        inputMs = parseInt(prompt("Milisekundy (0–999)", "000"));
        delay = delayTime + inputMs;
        document.getElementById("showArrTime").innerText = input + ":" + inputMs.toString().padStart(3, "0");
        setArrivalTime();
    };

    document.getElementById("sendTime").onclick = function () {
        cancelAnimationFrame(arrRequest);
        input = prompt("Godzina (HH:MM:SS)", document.getElementById("serverTime").textContent);
        inputMs = parseInt(prompt("Milisekundy (0–999)", "000"));
        delay = delayTime + inputMs;
        document.getElementById("showSendTime").innerText = input + ":" + inputMs.toString().padStart(3, "0");
        setSendTime();
    };

    document.getElementById("delayButton").onclick = function () {
        delayTime = parseInt(document.getElementById("delayInput").value) || 0;
        localStorage.delayTime = JSON.stringify(delayTime);
        alert("Zapisano Offset: " + delayTime);
    };

})();
