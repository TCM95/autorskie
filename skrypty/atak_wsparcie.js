// ==UserScript==
// @name        Atak/wsparcie (Shinko UI)
// @version      1.0.0
// @description  Zintegrowany system wysyłki
// @namespace    https://viayoo.com/
// @author       tcm
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
                    pingDisplay.innerText = diff + "ms";
                    // Kolorowanie pingu dla szybkiej oceny
                    pingDisplay.style.color = diff < 150 ? "#00ff00" : (diff < 250 ? "#ffff00" : "#ff4444");
                }
            }).catch(() => {});
    }
    setInterval(checkPing, 2000);

    // --- STYL (CSS) ---
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

        #tw-pro-tools {
            background-color: var(--bg-main) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            font-family: Verdana, sans-serif !important;
            border-radius: 4px !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
            font-size: 11px !important;
            padding: 10px !important;
            margin-top: 10px !important;
        }

        #tw-pro-tools table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
        }

        #tw-pro-tools td {
            padding: 4px 6px;
            color: var(--text-color);
            border-bottom: 1px solid var(--border-color);
        }

        .shinko-btn {
            background: var(--btn-bg) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            padding: 4px 8px !important;
            text-shadow: 1px 1px 2px black;
            font-size: 11px !important;
            display: inline-block;
            text-decoration: none !important;
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
            padding: 3px 5px !important;
            font-size: 11px !important;
            text-align: center;
        }
    `;
    document.head.appendChild(style);

    // --- INTERFEJS (HTML) ---
    const buttonsHtml = `
        <div id="tw-pro-tools">
            <div style="margin-bottom: 8px; font-weight: bold; color: var(--title-color); display: flex; justify- content: space-between; align-items: center;">
                <span>⚡TIMING TOOLS</span>
                <span>PING: <span id="live-ping-val" style="color: #00ff00;">sprawdzam...</span></span>
            </div>
            <table>
                <tr>
                    <td>Offset (Ping kor.):</td>
                    <td style="text-align: right;">
                        <input id="delayInput" class="shinko-input" value="${delayTime}" style="width:50px">
                        <a id="delayButton" class="shinko-btn">Zapisz</a>
                    </td>
                </tr>
                <tr><td>Czas wejścia:</td><td id="showArrTime" style="text-align: right; font-weight: bold; color: var(--title-color);">-</td></tr>
                <tr><td>Czas wysyłki:</td><td id="showSendTime" style="text-align: right; font-weight: bold; color: var(--title-color);">-</td></tr>
            </table>
            <div style="margin-top: 10px; display: flex; gap: 5px;">
                <a id="arrTime" class="shinko-btn" style="cursor:pointer; flex: 1; text-align: center;">Ustaw dotarcie</a>
                <a id="sendTime" class="shinko-btn" style="cursor:pointer; flex: 1; text-align: center;">Ustaw wysyłkę</a>
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
