// ==UserScript==
// @name         Kalkulator Rekrutacji
// @namespace    https://viayoo.com/
// @version      4.4
// @description  Zarządzanie rekrutacją wojsk z niezależnymi kolejkami budynków, estymacją czasu i podglądem populacji. Działa na stronie rekrutacji oraz na ratuszu (dane pobierane w tle).
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=train*
// @match        *://*.plemiona.pl/game.php?*screen=barracks*
// @match        *://*.plemiona.pl/game.php?*screen=main*
// @match        *://*.plemiona.pl/game.php?*screen=overview*
// @exclude      *://*.plemiona.pl/game.php?*screen=overview_villages*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const villageId = (typeof game_data !== 'undefined' && game_data.village) ? game_data.village.id : 'global';

    const keyUnitData = `TCM_CR_unitData_${villageId}`;
    const keyLimitData = `TCM_CR_limitData_${villageId}`;
    const keyQueueSize = `TCM_CR_queueSize_${villageId}`;
    const keyActive = `TCM_CR_active_${villageId}`;

    // Czy jesteśmy na stronie rekrutacji (żywy DOM), czy na innej (np. ratusz – dane z fetch)
    const onTrainScreen = typeof game_data !== 'undefined' && (game_data.screen === 'train' || game_data.screen === 'barracks');
    const trainUrl = `${location.origin}/game.php?village=${villageId}&screen=train`;

    // Weryfikacja aktywnych jednostek na podstawie ustawień świata
    const availableUnits = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult'];
    const activeUnits = availableUnits.filter(u => typeof game_data !== 'undefined' && game_data.units && game_data.units.includes(u));

    let loadedUnitData = JSON.parse(localStorage.getItem(keyUnitData)) || {};
    let loadedLimitData = JSON.parse(localStorage.getItem(keyLimitData)) || {};

    let unitData = {};
    let limitData = {};

    activeUnits.forEach(u => {
        unitData[u] = loadedUnitData[u] || 0;
        limitData[u] = loadedLimitData[u] || 0;
    });

    let maxQueueSize = parseInt(localStorage.getItem(keyQueueSize)) || 4;
    let isActive = parseInt(localStorage.getItem(keyActive)) || 2;

    const buildingMap = {
        'spear': 'barracks', 'sword': 'barracks', 'axe': 'barracks', 'archer': 'barracks',
        'spy': 'stable', 'light': 'stable', 'marcher': 'stable', 'heavy': 'stable',
        'ram': 'garage', 'catapult': 'garage'
    };

    const popCost = {
        'spear': 1, 'sword': 1, 'axe': 1, 'archer': 1,
        'spy': 2, 'light': 4, 'marcher': 5, 'heavy': 6,
        'ram': 5, 'catapult': 8
    };

    const addGlobalStyle = (css) => {
        if (document.getElementById('tcm-global-style')) return;
        let style = document.createElement('style');
        style.id = 'tcm-global-style';
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    addGlobalStyle(`
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

        #tcm-rekrutacja-ui *, #tcm-rekrutacja-ui {
            box-sizing: border-box !important;
            outline: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }

        #tcm-rekrutacja-ui {
            position: absolute !important;
            top: 130px;
            left: 10px;
            z-index: 999999 !important;
            background: var(--bg-main) !important;
            border: 2px solid var(--border-color) !important;
            border-radius: 6px;
            padding: 6px;
            width: auto;
            max-width: 95vw;
            min-width: 280px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.8);
            font-family: Verdana,Arial,sans-serif;
            color: var(--text-color);
            display: block !important;
        }

        #tcm-rekrutacja-ui.tcm-hidden { display: none !important; }

        #tcm-rekrutacja-header {
            background: var(--bg-header) !important;
            color: var(--title-color) !important;
            padding: 6px 8px;
            cursor: move;
            font-weight: bold;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            touch-action: none;
            border-radius: 4px;
            border-bottom: 1px solid var(--border-color);
        }

        .tcm-table-wrapper {
            overflow-x: auto;
            padding-bottom: 4px;
        }

        #tcm-rtable { width: 100%; margin-top: 4px; border-collapse: collapse; }
        #tcm-rtable td { text-align: center; padding: 2px 1px; background: var(--bg-row-alt); border: 1px solid var(--border-color); }
        #tcm-rtable td.tcm-no-bg { background: transparent; border: none; }

        .tcm-row-label {
            font-size: 9px;
            font-weight: bold;
            color: var(--title-color);
            text-align: right !important;
            padding-right: 4px !important;
            text-transform: uppercase;
            white-space: nowrap;
        }

        input.tcm-ri {
            width: 42px;
            font-size: 11px;
            text-align: center;
            background: #111;
            color: white;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            padding: 2px 0;
            -moz-appearance: textfield;
        }
        input.tcm-ri::-webkit-outer-spin-button,
        input.tcm-ri::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        .tcm-status-val { font-size: 10px; font-weight: bold; color: var(--title-color); }
        .tcm-pop-val { color: #aaa; }

        #tcm-finish-time-box {
            margin-top: 5px;
            padding: 4px;
            background: #202225;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            text-align: center;
            font-size: 11px;
            font-weight: bold;
        }

        #tcm-queue-box {
            margin-top: 5px;
            padding: 4px 6px;
            background: var(--bg-row-alt);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            font-size: 10px;
        }
        .tcm-q-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 2px 0; }
        .tcm-q-name { font-weight: bold; color: var(--title-color); min-width: 62px; }
        .tcm-q-item { background: #111; border: 1px solid var(--border-color); border-radius: 3px; padding: 0 3px; white-space: nowrap; }
        .tcm-q-item img { height: 12px; vertical-align: middle; }
        .tcm-q-on { color: #6bbf6b; }
        .tcm-q-off { color: #aaa; }
        .tcm-q-meta { margin-top: 2px; color: #aaa; font-size: 9px; text-align: right; }

        .tcm-controls-bar {
            margin-top: 6px;
            padding: 4px 6px;
            background: var(--bg-row-alt);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid var(--border-color);
            border-radius: 4px;
        }

        .tcm-queue-inline {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: bold;
        }

        .tcm-queue-inline select {
            width: 36px;
            text-align: center;
            font-size: 11px;
            background: #111;
            color: white;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            padding: 2px;
            cursor: pointer;
        }

        .tcm-btns-wrapper {
            display: flex;
            gap: 4px;
        }

        .tcm-btn {
            padding: 5px 10px;
            font-weight: bold;
            font-size: 11px;
            cursor: pointer;
            background: var(--btn-bg);
            color: white;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        }
        .tcm-btn:hover { background: var(--btn-hover); }
        .tcm-btn-start { background: var(--btn-green-bg) !important; }
        .tcm-btn-start:hover { background: var(--btn-green-hover) !important; }
        .tcm-btn-stop { background: var(--btn-red-bg) !important; }
        .tcm-btn-stop:hover { background: var(--btn-red-hover) !important; }
        .tcm-btn-clear { padding: 5px 6px; font-size: 12px; }
    `);

    const iconUrl = (unit) => `https://dspl.innogamescdn.com/asset/45436e33/graphic/unit/unit_${unit}.png`;

    let thHtml = '<td class="tcm-no-bg"></td>';
    let stanHtml = '<td class="tcm-row-label">Stan</td>';
    let limitHtml = '<td class="tcm-row-label">Limit</td>';
    let pakaHtml = '<td class="tcm-row-label">Paka</td>';
    let popHtml = '<td class="tcm-row-label">Pop. (<span id="tcm-total-pop" style="color:var(--btn-green-hover)">0</span>)</td>';

    activeUnits.forEach(u => {
        thHtml += `<td><img src="${iconUrl(u)}"></td>`;
        stanHtml += `<td id="tcm-curr-${u}" class="tcm-status-val">0</td>`;
        limitHtml += `<td><input class="tcm-ri limit-in" data-unit="${u}" type="number"></td>`;
        pakaHtml += `<td><input class="tcm-ri paczka-in" data-unit="${u}" type="number"></td>`;
        popHtml += `<td id="tcm-pop-${u}" class="tcm-status-val tcm-pop-val">0</td>`;
    });

    const uiHtml = `
    <div id="tcm-rekrutacja-ui">
        <div id="tcm-rekrutacja-header">
            <span>Kalkulator Rekrutacji</span>
            <span id="tcm-close" style="cursor:pointer;padding:0 4px;">✖</span>
        </div>
        <div class="tcm-table-wrapper">
            <table id="tcm-rtable">
                <tbody>
                    <tr>${thHtml}</tr>
                    <tr>${stanHtml}</tr>
                    <tr>${limitHtml}</tr>
                    <tr>${pakaHtml}</tr>
                    <tr>${popHtml}</tr>
                </tbody>
            </table>
        </div>

        <div id="tcm-finish-time-box">Obliczanie...</div>
        <div id="tcm-queue-box"></div>

        <div class="tcm-controls-bar">
            <div class="tcm-queue-inline">
                <span>Kol:</span>
                <select id="tcm-queue-size-in">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                </select>
            </div>
            <div class="tcm-btns-wrapper">
                <button id='tcm-clear-btn' class='tcm-btn tcm-btn-clear tcm-btn-stop' title="Wyczyść">🗑️</button>
                <button id='tcm-save-btn' class='tcm-btn'>💾 Zapisz</button>
                <button id='tcm-toggle-btn' class='tcm-btn'>✅ Start</button>
            </div>
        </div>
    </div>`;

    function tcmAddIcon(id, emoji, title, onClick, order = 100) {
        if (document.getElementById(id)) return;

        let row = document.getElementById('tcm-icon-row');
        if (!row) {
            row = document.createElement('div');
            row.id = 'tcm-icon-row';
            row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;width:100%;clear:both;margin-top:5px;';
            const parent = document.querySelector('#quickbar_contents')
                || document.querySelector('#quickbar_outer')
                || document.querySelector('#menu_row')
                || document.body;
            parent.appendChild(row);
        }

        const btn = document.createElement('button');
        btn.id = id;
        btn.title = title;
        btn.textContent = emoji;
        btn.style.cssText = 'order:' + order + ';width:30px;height:30px;cursor:pointer;font-size:16px;'
            + 'color:#fff;border:1px solid #3e4147;border-radius:3px;'
            + 'background:linear-gradient(#6e7178 0%,#36393f 30%,#202225 80%,#000 100%);';
        btn.addEventListener('click', onClick);
        row.appendChild(btn);
    }

    let injectAttempts = 0;
    const checkAndInject = setInterval(() => {
        if (document.getElementById('tcm-rekrutacja-ui')) {
            clearInterval(checkAndInject);
            return;
        }

        if (document.getElementById('content_value') && document.body) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = uiHtml.trim();
            document.body.appendChild(wrapper.firstChild);
            initLogic();
            clearInterval(checkAndInject);
        }

        if (++injectAttempts > 50) clearInterval(checkAndInject);
    }, 100);

    function initLogic() {
        const uiBox = document.getElementById('tcm-rekrutacja-ui');
        const header = document.getElementById('tcm-rekrutacja-header');
        let isRecruiting = false;
        let tickBusy = false;

        // Źródło danych: na stronie rekrutacji = żywy dokument, gdzie indziej = pobrany w tle
        let srcDoc = document;
        let lastRefresh = null;
        const q = (sel) => $(sel, srcDoc);
        const hasTrainForm = () => !!srcDoc.getElementById('train_form');

        const refreshSource = async () => {
            if (onTrainScreen) { srcDoc = document; lastRefresh = new Date(); return true; }
            try {
                const r = await fetch(trainUrl, { credentials: 'same-origin' });
                const html = await r.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                if (doc.getElementById('train_form')) {
                    srcDoc = doc;
                    lastRefresh = new Date();
                    return true;
                }
            } catch (e) { /* ignoruj, spróbujemy przy kolejnym ticku */ }
            return false;
        };

        // Wysyłka rekrutacji bez strony rekrutacji (POST jak z formularza)
        const submitRemote = async (unit, amount) => {
            const form = srcDoc.getElementById('train_form');
            if (!form) return false;
            const params = new URLSearchParams();
            form.querySelectorAll('input[name]').forEach(el => {
                if (el.type === 'submit' || el.type === 'button') return;
                if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
                if (el.type === 'text' || el.type === 'number') {
                    params.append(el.name, el.name === unit ? String(amount) : '');
                } else {
                    params.append(el.name, el.value);
                }
            });
            const action = new URL(form.getAttribute('action') || trainUrl, location.href).href;
            if (!params.has('h') && !/[?&]h=/.test(action) && typeof game_data !== 'undefined' && game_data.csrf) {
                params.append('h', game_data.csrf);
            }
            const r = await fetch(action, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });
            return r.ok;
        };

        let savedPos = JSON.parse(localStorage.getItem('TCM_CR_Pos'));
        if (savedPos) {
            uiBox.style.left = savedPos.left;
            uiBox.style.top = savedPos.top;
        }

        let isDragging = false, startX, startY, initialX, initialY;

        const dragStart = (e) => {
            isDragging = true;
            let evt = e.type.includes('mouse') ? e : e.touches[0];
            startX = evt.pageX; startY = evt.pageY;
            initialX = uiBox.offsetLeft; initialY = uiBox.offsetTop;
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            let evt = e.type.includes('mouse') ? e : e.touches[0];
            uiBox.style.left = `${Math.max(0, initialX + (evt.pageX - startX))}px`;
            uiBox.style.top = `${Math.max(0, initialY + (evt.pageY - startY))}px`;
        };

        const dragEnd = () => {
            if (isDragging) {
                isDragging = false;
                localStorage.setItem('TCM_CR_Pos', JSON.stringify({ left: uiBox.style.left, top: uiBox.style.top }));
            }
        };

        header.addEventListener('mousedown', dragStart);
        header.addEventListener('touchstart', dragStart, {passive: false});
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('touchmove', dragMove, {passive: false});
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);

        // Widoczność panelu – przycisk w pasku ikon (rekrutacja działa także przy schowanym panelu)
        const keyVisible = 'TCM_CR_Visible';
        const setVisible = (v, adjust = true) => {
            uiBox.classList.toggle('tcm-hidden', !v);
            localStorage.setItem(keyVisible, v ? '1' : '0');
            if (v && adjust) {
                const vTop = window.pageYOffset, vH = window.innerHeight;
                const vLeft = window.pageXOffset, vW = window.innerWidth;
                if (uiBox.offsetTop < vTop || uiBox.offsetTop > vTop + vH - 60) uiBox.style.top = `${vTop + 60}px`;
                if (uiBox.offsetLeft < vLeft || uiBox.offsetLeft > vLeft + vW - 60) uiBox.style.left = `${vLeft + 10}px`;
            }
        };
        tcmAddIcon('tcm_rekrutacja_btn', '⚔️', 'Kalkulator rekrutacji', () => setVisible(uiBox.classList.contains('tcm-hidden')), 30);
        $('#tcm-close').on('click', () => setVisible(false));
        setVisible(localStorage.getItem(keyVisible) === '1', false);

        const calcPop = () => {
            let totalPop = 0;
            activeUnits.forEach(u => {
                let limit = parseInt(limitData[u]) || 0;
                let pop = limit * (popCost[u] || 1);
                totalPop += pop;
                $(`#tcm-pop-${u}`).text(pop);
            });
            $('#tcm-total-pop').text(totalPop);
        };

        const calcTime = () => {
            let bTimes = { barracks: 0, stable: 0, garage: 0 };

            ['barracks', 'stable', 'garage'].forEach(b => {
                let wrap = q(`#trainqueue_wrap_${b}`);
                if (wrap.length) {
                    wrap.find('tr').each(function() {
                        let timeCell = $(this).find('td:nth-child(2)');
                        let timerSpan = $(this).find('span.timer');
                        let textToParse = timerSpan.length ? timerSpan.text() : (timeCell.length ? timeCell.text() : '');

                        let match = textToParse.match(/^(\d+):(\d{2}):(\d{2})/);
                        if (match) {
                            bTimes[b] += (+match[1])*3600 + (+match[2])*60 + (+match[3]);
                        }
                    });
                }
            });

            activeUnits.forEach(key => {
                let limit = parseInt(limitData[key]) || 0;
                let current = parseInt($(`#tcm-curr-${key}`).text()) || 0;
                let missing = limit - current;

                if (missing > 0) {
                    let row = q(`#train_form input[name="${key}"]`).closest('tr');
                    let timeText = row.find('td').text();
                    let match = timeText.match(/(\d+):(\d{2}):(\d{2})/);
                    if (match) {
                        let sec = (+match[1]) * 3600 + (+match[2]) * 60 + (+match[3]);
                        bTimes[buildingMap[key]] += missing * sec;
                    }
                }
            });

            let maxSec = Math.max(bTimes.barracks, bTimes.stable, bTimes.garage);
            let finishBox = $('#tcm-finish-time-box');

            if (maxSec > 0) {
                let finish = new Date(Date.now() + maxSec * 1000);
                let d = finish.getDate().toString().padStart(2, '0');
                let m = (finish.getMonth()+1).toString().padStart(2, '0');
                let h = finish.getHours().toString().padStart(2, '0');
                let min = finish.getMinutes().toString().padStart(2, '0');
                finishBox.html(`⏳ <span style="color:#6bbf6b">${d}.${m} ${h}:${min}</span>`);
            } else {
                finishBox.html(`✅ <span style="color:#6bbf6b">Gotowe</span>`);
            }
        };

        const getUnitsInQueue = () => {
            let queueUnits = {};
            activeUnits.forEach(u => queueUnits[u] = 0);

            q('.trainqueue_wrap table tr').each(function() {
                let row = $(this);
                let sprite = row.find('.unit_sprite_smaller');
                if (sprite.length) {
                    let unitClass = sprite.attr('class').split(' ').find(c => c !== 'unit_sprite' && c !== 'unit_sprite_smaller');
                    if (unitClass && queueUnits[unitClass] !== undefined) {
                        let text = row.find('td').first().text().replace(/\s+/g, ' ').trim();
                        let count = parseInt(text.match(/^(\d+)/)) || 0;
                        queueUnits[unitClass] += count;
                    }
                }
            });
            return queueUnits;
        };

        const getVillageUnits = () => {
            let currentUnits = {};
            let queueUnits = getUnitsInQueue();

            activeUnits.forEach(key => {
                const input = q(`#train_form input[name="${key}"]`);
                if (input.length) {
                    let rowText = input.closest('tr').find('td').eq(2).text().replace(/\s+/g, '');
                    let match = rowText.match(/(\d+)\/(\d+)/);
                    let countInVillage = match ? parseInt(match[2], 10) : (parseInt(input.closest('td').prev('td').text().trim(), 10) || 0);

                    let totalWithQueue = countInVillage + (queueUnits[key] || 0);
                    currentUnits[key] = totalWithQueue;
                    $(`#tcm-curr-${key}`).text(totalWithQueue);
                } else {
                    $(`#tcm-curr-${key}`).text('0');
                }
            });
            return currentUnits;
        };

        // Moment (ms), kiedy najwcześniej skończy się jakaś pozycja kolejki – wtedy warto odświeżyć dane
        const getNextQueueEvent = () => {
            if (!lastRefresh) return 0;
            let next = Infinity;
            ['barracks', 'stable', 'garage'].forEach(b => {
                const row = q(`#trainqueue_wrap_${b} table tr:has(.unit_sprite_smaller)`).first();
                if (!row.length) return;
                const timerSpan = row.find('span.timer');
                const t = timerSpan.length ? timerSpan.text() : row.find('td:nth-child(2)').text();
                const m = t.match(/(\d+):(\d{2}):(\d{2})/);
                if (m) next = Math.min(next, lastRefresh.getTime() + ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + 1500);
            });
            return next;
        };

        const bNames = { barracks: 'Koszary', stable: 'Stajnia', garage: 'Warsztat' };

        const renderQueue = () => {
            const box = $('#tcm-queue-box');
            if (!hasTrainForm()) {
                box.html('<div class="tcm-q-off">Brak danych kolejki (nie udało się pobrać strony rekrutacji)</div>');
                return;
            }
            let html = '';
            ['barracks', 'stable', 'garage'].forEach(b => {
                if (!activeUnits.some(u => buildingMap[u] === b)) return;
                let items = '';
                q(`#trainqueue_wrap_${b} table tr:has(.unit_sprite_smaller)`).each(function() {
                    let row = $(this);
                    let sprite = row.find('.unit_sprite_smaller');
                    let unitClass = (sprite.attr('class') || '').split(' ').find(c => c !== 'unit_sprite' && c !== 'unit_sprite_smaller');
                    let text = row.find('td').first().text().replace(/\s+/g, ' ').trim();
                    let nMatch = text.match(/^(\d+)/);
                    let n = nMatch ? parseInt(nMatch[1], 10) : 0;
                    items += `<span class="tcm-q-item"><img src="${iconUrl(unitClass)}"> ${n}</span>`;

                });
                html += `<div class="tcm-q-line"><span class="tcm-q-name">${bNames[b]}</span>${items || '<span class="tcm-q-off">—</span>'}</div>`;
            });
            box.html(html);
        };

        const updateUI = () => {
            $('.limit-in').each(function() { $(this).val(limitData[$(this).data('unit')] || ''); });
            $('.paczka-in').each(function() { $(this).val(unitData[$(this).data('unit')] || ''); });
            $('#tcm-queue-size-in').val(maxQueueSize);

            const btn = $('#tcm-toggle-btn');
            if (isActive === 1) {
                btn.html('❎ Stop').removeClass('tcm-btn-start').addClass('tcm-btn-stop');
            } else {
                btn.html('✅ Start').removeClass('tcm-btn-stop').addClass('tcm-btn-start');
            }

            getVillageUnits();
            calcPop();
            calcTime();
            renderQueue();
            $('#tcm_rekrutacja_btn').css('border-color', isActive === 1 ? '#6bbf6b' : '#3e4147');
        };

        $('.limit-in').on('change', function() {
            let u = $(this).data('unit');
            let val = parseInt($(this).val()) || 0;
            limitData[u] = val;
            if (val > 0 && (!unitData[u] || unitData[u] == 0)) {
                let paczka = Math.max(1, Math.ceil(val / 50));
                unitData[u] = paczka;
                $(`.paczka-in[data-unit="${u}"]`).val(paczka);
            } else if (val <= 0) {
                unitData[u] = '';
                $(`.paczka-in[data-unit="${u}"]`).val('');
            }
            getVillageUnits();
            calcPop();
            calcTime();
        });

        $('.limit-in, .paczka-in').on('input', function() {
            let u = $(this).data('unit');
            if($(this).hasClass('limit-in')) {
                limitData[u] = parseInt($(this).val()) || 0;
                calcPop();
            } else {
                unitData[u] = parseInt($(this).val()) || 0;
            }
            calcTime();
        });

        $('#tcm-queue-size-in').on('change input', function() {
            maxQueueSize = parseInt($(this).val()) || 4;
            localStorage.setItem(keyQueueSize, maxQueueSize);
            runTick();
        });

        $('#tcm-save-btn').click(function() {
            localStorage.setItem(keyUnitData, JSON.stringify(unitData));
            localStorage.setItem(keyLimitData, JSON.stringify(limitData));
            maxQueueSize = parseInt($('#tcm-queue-size-in').val()) || maxQueueSize;
            localStorage.setItem(keyQueueSize, maxQueueSize);

            let btn = $(this);
            btn.html('Zapisano!').addClass('tcm-btn-start');
            setTimeout(() => { btn.html('💾 Zapisz').removeClass('tcm-btn-start'); }, 1500);
        });

        $('#tcm-clear-btn').click(function() {
            if (confirm('Czy na pewno chcesz usunąć wszystkie limity i wielkości paczek?')) {
                activeUnits.forEach(u => { unitData[u] = 0; limitData[u] = 0; });
                localStorage.setItem(keyUnitData, JSON.stringify(unitData));
                localStorage.setItem(keyLimitData, JSON.stringify(limitData));
                updateUI();
            }
        });

        const recruitIfPossible = () => {
            if (isActive !== 1 || isRecruiting) return;
            if (!hasTrainForm()) return;

            const getBuildingQueueCount = (buildingName) => {
                let wrap = srcDoc.getElementById(`trainqueue_wrap_${buildingName}`);
                if (!wrap) return 0;
                return $(wrap).find('table tr:has(.unit_sprite_smaller)').length;
            };

            let currentUnits = getVillageUnits();
            let candidates = [];

            activeUnits.forEach(key => {
                let limit = parseInt(limitData[key]) || 0;
                let paczka = parseInt(unitData[key]) || 0;
                if (limit <= 0 || paczka <= 0) return;

                let buildingName = buildingMap[key];
                let currentBuildingQueue = getBuildingQueueCount(buildingName);
                if (currentBuildingQueue >= maxQueueSize) return;

                let current = currentUnits[key] || 0;
                let missing = limit - current;

                if (missing > 0) {
                    const input = q(`#train_form input[name="${key}"]`);
                    if (input.length && !input.prop('disabled')) {
                        let nextLink = input.next('a');
                        let maxAfford = nextLink.length ? (parseInt(nextLink.text().replace(/\D/g, '')) || 0) : 0;

                        let targetAmount = Math.min(paczka, missing);

                        if (maxAfford >= targetAmount && targetAmount > 0) {
                            candidates.push({ unit: key, targetAmount: targetAmount, missingPercentage: missing / limit, missingAbsolute: missing });
                        }
                    }
                }
            });

            if (candidates.length === 0) return;

            candidates.sort((a, b) => b.missingPercentage - a.missingPercentage || b.missingAbsolute - a.missingAbsolute);
            let candidate = candidates[0];

            if (onTrainScreen) {
                // Tryb klasyczny – klikanie w formularz na stronie
                const input = $(`#train_form input[name="${candidate.unit}"]`);
                if (input.length && !input.prop('disabled')) {
                    isRecruiting = true;
                    document.querySelectorAll('#train_form input[type="text"]').forEach(el => el.value = '');

                    input.val(candidate.targetAmount);
                    input.trigger('change');
                    input[0].dispatchEvent(new Event('input', { bubbles: true }));

                    setTimeout(() => {
                        let submitBtn = $('#train_form .btn-recruit');
                        if (submitBtn.length) submitBtn.click();
                        setTimeout(() => { isRecruiting = false; updateUI(); }, 1500);
                    }, 400);
                }
            } else {
                // Tryb zdalny (ratusz) – POST w tle
                isRecruiting = true;
                setTimeout(async () => {
                    try {
                        await submitRemote(candidate.unit, candidate.targetAmount);
                        await new Promise(r => setTimeout(r, 800));
                        await refreshSource();
                        updateUI();
                    } catch (e) {
                        console.warn('TCM: błąd rekrutacji w tle', e);
                    } finally {
                        isRecruiting = false;
                    }
                }, 400);
            }
        };

        let workerBlob = new Blob([`
            let intervalId;
            self.onmessage = function(e) {
                if (e.data.command === 'start') {
                    intervalId = setInterval(() => self.postMessage('tick'), e.data.time);
                } else if (e.data.command === 'stop') {
                    clearInterval(intervalId);
                }
            };
        `], { type: 'application/javascript' });

        let workerUrl = URL.createObjectURL(workerBlob);
        let recruitWorker;

        // Czy trzeba pobrać świeże dane? Poza stroną rekrutacji pobieramy tylko, gdy ma to sens:
        // gdy skończyła się jakaś pozycja kolejki albo brakuje jednostek i w kolejce jest miejsce.
        const needFetch = () => {
            if (onTrainScreen || !hasTrainForm() || !lastRefresh) return true;
            if (Date.now() >= getNextQueueEvent()) return true;
            const cur = getVillageUnits();
            return activeUnits.some(key => {
                let limit = parseInt(limitData[key]) || 0;
                let paczka = parseInt(unitData[key]) || 0;
                if (limit <= 0 || paczka <= 0) return false;
                if (limit - (cur[key] || 0) <= 0) return false;
                let wrap = srcDoc.getElementById(`trainqueue_wrap_${buildingMap[key]}`);
                let inQueue = wrap ? $(wrap).find('table tr:has(.unit_sprite_smaller)').length : 0;
                return inQueue < maxQueueSize;
            });
        };

        const runTick = async () => {
            if (isActive !== 1 || tickBusy) return;
            tickBusy = true;
            try {
                if (needFetch()) await refreshSource();
                updateUI();
                recruitIfPossible();
            } finally {
                tickBusy = false;
            }
        };

        const startLoop = () => {
            if (recruitWorker) recruitWorker.terminate();
            recruitWorker = new Worker(workerUrl);
            recruitWorker.onmessage = runTick;
            recruitWorker.postMessage({ command: 'start', time: onTrainScreen ? 3500 : 5000 });
        };

        const stopLoop = () => { if (recruitWorker) recruitWorker.postMessage({ command: 'stop' }); };

        $('#tcm-toggle-btn').click(async () => {
            isActive = isActive === 1 ? 2 : 1;
            localStorage.setItem(keyActive, isActive);
            await refreshSource();
            updateUI();
            if (isActive === 1) {
                recruitIfPossible();
                startLoop();
            } else {
                stopLoop();
            }
        });

        setTimeout(async () => {
            await refreshSource();
            updateUI();
            if (isActive === 1) {
                setTimeout(recruitIfPossible, 1200);
                startLoop();
            }
        }, 1000);
    }
})();
