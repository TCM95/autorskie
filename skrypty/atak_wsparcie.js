// ==UserScript==
// @name         kalkulator Atak/wsparcie
// @version      2.0.0
// @description  Wpisz tylko czas - reszta (ping, zegar, czas podróży) automatycznie
// @namespace    https://viayoo.com/
// @author       TCM
// @include      https://*/game.php?*&screen=place&try=confirm
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SUBMIT_ID = "troop_confirm_submit";
    const submitBtn = document.getElementById(SUBMIT_ID);
    if (!submitBtn) return;

    let offsetMs = parseInt(localStorage.delayTime) || 0; // ręczna korekta (opcjonalna)
    let target = null;      // { serverMs, mode, label }
    let timer = null;
    let fired = false;

    // ---------- ZEGAR SERWERA (ms, oparty o performance.now) ----------
    let baseServer = Date.now(), basePerf = performance.now();
    function syncClock() {
        try {
            const s = Timing.getCurrentServerTime();
            if (typeof s === "number" && s > 0) {
                baseServer = s;
                basePerf = performance.now();
            }
        } catch (e) {}
    }
    syncClock();
    setInterval(syncClock, 20000);
    const serverNow = () => baseServer + (performance.now() - basePerf);

    // ---------- PING (mediana z próbek, w jedną stronę = RTT/2) ----------
    let samples = [];
    let pingRtt = 0;
    function measurePing() {
        const t0 = performance.now();
        return fetch('/game.php?screen=overview', { method: 'HEAD', cache: 'no-store' })
            .then(() => {
                samples.push(performance.now() - t0);
                if (samples.length > 9) samples.shift();
                const sorted = [...samples].sort((a, b) => a - b);
                pingRtt = sorted[Math.floor(sorted.length / 2)];
                const el = document.getElementById("live-ping-val");
                if (el) {
                    const v = Math.round(pingRtt);
                    el.innerText = v;
                    el.style.color = v < 150 ? "#00ff00" : (v < 250 ? "#ffff00" : "#ff4444");
                }
            }).catch(() => {});
    }
    // 5 szybkich próbek na start, potem co 3 s
    (async () => { for (let i = 0; i < 5; i++) { await measurePing(); } })();
    setInterval(measurePing, 3000);
    let usePing = localStorage.twUsePing === "1"; // domyślnie wyłączone
    const oneWay = () => (usePing ? pingRtt / 2 : 0);

    // ---------- STYL ----------
    const style = document.createElement('style');
    style.textContent = `
        #tw-pro-tools{display:inline-block;min-width:240px;background:#36393f!important;border:1px solid #3e4147!important;color:#fff!important;font-family:Verdana,sans-serif!important;border-radius:4px!important;box-shadow:0 4px 10px rgba(0,0,0,.5)!important;font-size:12px!important;padding:8px!important;box-sizing:border-box}
        .tw-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #3e4147;gap:6px}
        .tw-row-nb{border-bottom:none;padding-bottom:0;margin-top:6px}
        .shinko-btn{background:linear-gradient(#6e7178 0%,#36393f 30%,#202225 80%,#000 100%)!important;border:1px solid #3e4147!important;color:#fff!important;border-radius:3px!important;cursor:pointer!important;font-weight:bold!important;padding:4px 6px!important;text-shadow:1px 1px 2px #000;font-size:12px!important;display:inline-block;text-align:center;box-sizing:border-box;text-decoration:none!important}
        .shinko-btn:hover{filter:brightness(1.25)}
        .shinko-input{background:#202225!important;border:1px solid #3e4147!important;color:#fff!important;border-radius:3px!important;padding:3px!important;font-size:12px!important;text-align:center;box-sizing:border-box}
    `;
    document.head.appendChild(style);

    // ---------- UI ----------
    submitBtn.insertAdjacentHTML("afterend", `
        <div style="display:block;clear:both;width:100%;margin-top:15px;">
            <div id="tw-pro-tools">
                <div class="tw-row">
                    <span style="font-weight:bold;">Ping</span>
                    <span>[<span id="live-ping-val" style="color:#00ff00;">...</span> ms]
                        <label title="Odejmuj ping/2 od czasu wysyłki" style="cursor:pointer;"><input type="checkbox" id="usePingChk" ${usePing ? "checked" : ""}> -ping/2</label>
                    </span>
                    <span title="Ręczna korekta w ms (+ później, - wcześniej)">
                        <input id="delayInput" class="shinko-input" value="${offsetMs}" style="width:42px;">
                    </span>
                </div>
                <div class="tw-row">
                    <input id="timeInput" class="shinko-input" placeholder="HH:MM:SS:mmm" style="flex:1;">
                    <a id="refreshBtn" class="shinko-btn" style="width:30px;" title="Wstaw aktualny czas wejścia">↻</a>
                </div>
                <div class="tw-row tw-row-nb">
                    <a id="sendTime" class="shinko-btn" style="flex:1;">Wysyłka</a>
                    <a id="arrTime" class="shinko-btn" style="flex:1;">Dotarcie</a>
                    <a id="cancelBtn" class="shinko-btn" style="width:30px;" title="Anuluj">✖</a>
                </div>
                <div class="tw-row" style="border-bottom:none;margin-top:4px;">
                    <span id="twStatus" style="color:#ffffdf;font-weight:bold;">Brak zaplanowanej akcji</span>
                </div>
            </div>
        </div>
    `);

    const $ = id => document.getElementById(id);
    const setStatus = t => { $("twStatus").innerText = t; };

    // ---------- POMOCNICZE ----------
    const pad = (n, l = 2) => String(n).padStart(l, "0");

    function parseTime(str) {
        const m = (str || "").trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?$/);
        if (!m) return null;
        return { h: +m[1], m: +m[2], s: +m[3], ms: m[4] ? parseInt(m[4].padEnd(3, "0")) : 0 };
    }

    // HH:MM:SS(.mmm) -> bezwzględny czas serwera w ms (najbliższy w przyszłości)
    function toServerTs(t) {
        const d = new Date(serverNow());
        d.setHours(t.h, t.m, t.s, t.ms);
        let ts = d.getTime();
        if (ts < serverNow() - 2000) ts += 86400000;
        return ts;
    }

    // czas podróży w pełnych sekundach (gra liczy podróż w całych sekundach)
    function travelSeconds() {
        const arrTxt = document.querySelector(".relative_time").textContent.slice(-8);
        const a = parseTime(arrTxt);
        const n = new Date(serverNow());
        const arrSec = a.h * 3600 + a.m * 60 + a.s;
        const nowSec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
        return ((arrSec - nowSec) % 86400 + 86400) % 86400;
    }

    // ---------- HARMONOGRAM ----------
    function fmt(ts) {
        const d = new Date(ts);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
    }

    // Moment kliknięcia (czas serwera) = cel - ping/2 + korekta
    const clickAt = () => target.sendMs - oneWay() + offsetMs;

    function tick() {
        if (!target || fired) return;
        const remaining = clickAt() - serverNow();

        if (remaining > 80) {
            const s = Math.ceil(remaining / 1000);
            setStatus(`${target.label} ${fmt(target.shownMs)} | za ${s}s`);
            timer = setTimeout(tick, Math.min(remaining - 60, 250));
        } else {
            // końcówka: busy-wait, ping/zegar przeliczane na bieżąco
            while (clickAt() - serverNow() > 0) {}
            fired = true;
            setStatus(`Wysłano ✔ (${fmt(serverNow())})`);
            $(SUBMIT_ID).click();
        }
    }

    function schedule(sendMs, shownMs, label) {
        clearTimeout(timer);
        fired = false;
        target = { sendMs, shownMs, label };
        if (sendMs - oneWay() + offsetMs < serverNow()) {
            setStatus("Ten czas już minął!");
            target = null;
            return;
        }
        tick();
    }

    // ---------- PRZYCISKI ----------
    function fillArrival() {
        try {
            $("timeInput").value = document.querySelector(".relative_time").textContent.slice(-8) + ":000";
        } catch (e) {}
    }
    fillArrival();
    $("refreshBtn").onclick = fillArrival;

    $("usePingChk").onchange = function () {
        usePing = this.checked;
        localStorage.twUsePing = usePing ? "1" : "0";
    };

    $("delayInput").onchange = function () {
        offsetMs = parseInt(this.value) || 0;
        localStorage.delayTime = JSON.stringify(offsetMs);
    };

    $("cancelBtn").onclick = function () {
        clearTimeout(timer);
        target = null;
        fired = false;
        setStatus("Anulowano");
    };

    $("sendTime").onclick = function () {
        const t = parseTime($("timeInput").value);
        if (!t) return setStatus("Format: HH:MM:SS:mmm");
        const ts = toServerTs(t);
        schedule(ts, ts, "Wysyłka");
    };

    $("arrTime").onclick = function () {
        const t = parseTime($("timeInput").value);
        if (!t) return setStatus("Format: HH:MM:SS:mmm");
        const arrivalTs = toServerTs(t);
        const sendTs = arrivalTs - travelSeconds() * 1000;
        schedule(sendTs, arrivalTs, "Dotarcie");
    };

    $("timeInput").addEventListener("keydown", e => {
        if (e.key === "Enter") $("sendTime").click();
    });
})();
