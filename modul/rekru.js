/*
 * TCM BOB - moduł REKRUTACJA (osobny plik, ładowany przez skrypt budowy z linku GitHub)
 *
 * Co robi: panel Kalkulatora Rekrutacji (zakładka z ikoną koszar) + silnik rekrutacji w tle
 * (limity, paczki, kolejki koszar/stajni/warsztatu; dane pobierane z ekranu train w tle).
 *
 * Kontrakt z rdzeniem (window.TCM_BOB):
 *   api.run(item)        - wykonuje akcję z listy budowy {t:'act', kind:'recruit', mode, units:{spear:200,...}}.
 *                          mode 'target' = jak ręcznie w panelu: limit = podana liczba (docelowy stan wojska).
 *                          mode 'add' (domyślnie, też dla szablonów) - asynchronicznie: pobiera świeży stan wojska i ustawia limit na
 *                          "max(obecny limit, aktualny stan wraz z kolejką) + ilość", czyli ZAWSZE rekrutuje
 *                          o tyle więcej, ile podano - nie trzeba liczyć 1000 + 100 = 1100 ręcznie.
 *                          Jeśli nie ma danych z ekranu rekrutacji (np. brak koszar) - zwraca false i
 *                          próbuje ponownie przy kolejnym obiegu. Uruchamia rekrutację, gdy była wyłączona.
 *   api.addLimits(units, stock) - dodaje do limitów (limit = docelowy stan wojska; stock opcjonalny).
 *   api.isActive()       - czy rekrutacja jest włączona.
 *
 * Ustawienia zapisują się w tych samych kluczach co samodzielny skrypt "Kalkulator Rekrutacji"
 * (TCM_CR_*), więc limity i paczki są wspólne.
 */
(function() {
    'use strict';

    const BOB = window.TCM_BOB;
    if (!BOB || typeof game_data === 'undefined' || typeof $ === 'undefined') return;
    if (BOB.modules && BOB.modules.rek) return; // już załadowany

    const CSS = `
        #tcm-panel-rek * { box-sizing: border-box; outline: none; -webkit-tap-highlight-color: transparent; }
        #tcm-panel-rek .rk-head { background: var(--bg-header); color: var(--title-color); padding: 6px 8px; font-weight: bold; font-size: 12px; border-radius: 4px; border-bottom: 1px solid var(--border-color); }
        #tcm-panel-rek .rk-wrap { overflow-x: auto; padding-bottom: 4px; }
        #tcm-rtable { width: 100%; margin-top: 4px; border-collapse: collapse; }
        #tcm-rtable td { text-align: center; padding: 2px 1px; background: var(--bg-row-alt); border: 1px solid var(--border-color); }
        #tcm-rtable td.rk-nobg { background: transparent; border: none; }
        #tcm-rtable td.rk-label { font-size: 9px; font-weight: bold; color: var(--title-color); text-align: right; padding-right: 4px; text-transform: uppercase; white-space: nowrap; }
        #tcm-panel-rek input.tcm-ri { width: 42px; font-size: 11px; text-align: center; background: #111; color: white; border: 1px solid var(--border-color); border-radius: 3px; padding: 2px 0; -moz-appearance: textfield; }
        #tcm-panel-rek input.tcm-ri::-webkit-outer-spin-button, #tcm-panel-rek input.tcm-ri::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        #tcm-panel-rek .tcm-status-val { font-size: 10px; font-weight: bold; color: var(--title-color); }
        #tcm-panel-rek .tcm-pop-val { color: #aaa; }
        #tcm-finish-time-box { margin-top: 5px; padding: 4px; background: #202225; border: 1px solid var(--border-color); border-radius: 4px; text-align: center; font-size: 11px; font-weight: bold; }
        #tcm-queue-box { margin-top: 5px; padding: 4px 6px; background: var(--bg-row-alt); border: 1px solid var(--border-color); border-radius: 4px; font-size: 10px; }
        #tcm-panel-rek .tcm-q-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 2px 0; }
        #tcm-panel-rek .tcm-q-name { font-weight: bold; color: var(--title-color); min-width: 62px; }
        #tcm-panel-rek .tcm-q-item { background: #111; border: 1px solid var(--border-color); border-radius: 3px; padding: 0 3px; white-space: nowrap; }
        #tcm-panel-rek .tcm-q-item img { height: 12px; vertical-align: middle; }
        #tcm-panel-rek .tcm-q-off { color: #aaa; }
        #tcm-panel-rek .rk-controls { margin-top: 6px; padding: 4px 6px; background: var(--bg-row-alt); display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color); border-radius: 4px; }
        #tcm-panel-rek .rk-queue-inline { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: bold; }
        #tcm-panel-rek .rk-queue-inline select { width: 36px; text-align: center; font-size: 11px; background: #111; color: white; border: 1px solid var(--border-color); border-radius: 3px; padding: 2px; cursor: pointer; }
        #tcm-panel-rek .rk-btns { display: flex; gap: 4px; }
        #tcm-panel-rek .rk-btn { padding: 6px 10px; font-weight: bold; font-size: 11px; cursor: pointer; background: var(--btn-bg); color: white; border: 1px solid var(--border-color); border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.4); }
        #tcm-panel-rek .rk-btn:hover { background: var(--btn-hover); }
        #tcm-panel-rek .rk-btn-start { background: var(--btn-green-bg) !important; }
        #tcm-panel-rek .rk-btn-stop { background: var(--btn-red-bg) !important; }
        #tcm-panel-rek .rk-btn-clear { padding: 6px 8px; font-size: 12px; }
    `;

    BOB.registerModule({
        id: 'rek',
        name: 'Rekrutacja',
        icon: 'buildings/barracks.png',
        panelWidth: 520,

        init: function(ctx) {
            const H = ctx.helpers;
            const unitIcon = H.unitIcon;
            const REK_ALL = H.REK_ALL;

            if (!document.getElementById('tcm-rek-style')) {
                const st = document.createElement('style');
                st.id = 'tcm-rek-style';
                st.innerHTML = CSS;
                document.head.appendChild(st);
            }

            const villageId = game_data.village.id;
            const keyUnitData = `TCM_CR_unitData_${villageId}`;
            const keyLimitData = `TCM_CR_limitData_${villageId}`;
            const keyQueueSize = `TCM_CR_queueSize_${villageId}`;
            const keyActive = `TCM_CR_active_${villageId}`;
            const trainUrl = `${location.origin}/game.php?village=${villageId}&screen=train`;

            const activeUnits = REK_ALL.filter(u => game_data.units && game_data.units.includes(u));
            const buildingMap = {
                'spear': 'barracks', 'sword': 'barracks', 'axe': 'barracks', 'archer': 'barracks',
                'spy': 'stable', 'light': 'stable', 'marcher': 'stable', 'heavy': 'stable',
                'ram': 'garage', 'catapult': 'garage'
            };
            const popCost = { 'spear': 1, 'sword': 1, 'axe': 1, 'archer': 1, 'spy': 2, 'light': 4, 'marcher': 5, 'heavy': 6, 'ram': 5, 'catapult': 8 };

            const loadedUnitData = JSON.parse(localStorage.getItem(keyUnitData)) || {};
            const loadedLimitData = JSON.parse(localStorage.getItem(keyLimitData)) || {};
            let unitData = {}, limitData = {};
            activeUnits.forEach(u => { unitData[u] = loadedUnitData[u] || 0; limitData[u] = loadedLimitData[u] || 0; });
            let maxQueueSize = parseInt(localStorage.getItem(keyQueueSize)) || 4;
            let isActive = parseInt(localStorage.getItem(keyActive)) || 2;

            // --- HTML panelu ---
            let thHtml = '<td class="rk-nobg"></td>', stanHtml = '<td class="rk-label">Stan</td>', limitHtml = '<td class="rk-label">Limit</td>',
                pakaHtml = '<td class="rk-label">Paka</td>',
                popHtml = '<td class="rk-label">Pop. (<span id="tcm-total-pop" style="color:#6bbf6b">0</span>)</td>';
            activeUnits.forEach(u => {
                thHtml += `<td><img src="${unitIcon(u)}"></td>`;
                stanHtml += `<td id="tcm-curr-${u}" class="tcm-status-val">0</td>`;
                limitHtml += `<td><input class="tcm-ri limit-in" data-unit="${u}" type="number"></td>`;
                pakaHtml += `<td><input class="tcm-ri paczka-in" data-unit="${u}" type="number"></td>`;
                popHtml += `<td id="tcm-pop-${u}" class="tcm-status-val tcm-pop-val">0</td>`;
            });
            ctx.panel.html(`
                <div class="rk-head">⚔️ Kalkulator Rekrutacji</div>
                <div class="rk-wrap"><table id="tcm-rtable"><tbody>
                    <tr>${thHtml}</tr><tr>${stanHtml}</tr><tr>${limitHtml}</tr><tr>${pakaHtml}</tr><tr>${popHtml}</tr>
                </tbody></table></div>
                <div id="tcm-finish-time-box">Obliczanie...</div>
                <div id="tcm-queue-box"></div>
                <div class="rk-controls">
                    <div class="rk-queue-inline"><span>Kol:</span>
                        <select id="tcm-queue-size-in">${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join('')}</select>
                    </div>
                    <div class="rk-btns">
                        <button id="tcm-clear-btn" class="rk-btn rk-btn-clear rk-btn-stop" title="Wyczyść">🗑️</button>
                        <button id="tcm-save-btn" class="rk-btn">💾 Zapisz</button>
                        <button id="tcm-toggle-btn" class="rk-btn">✅ Start</button>
                    </div>
                </div>`);

            let isRecruiting = false, tickBusy = false;
            let srcDoc = document, lastRefresh = null;
            const q = (sel) => $(sel, srcDoc);
            const hasTrainForm = () => !!(srcDoc && srcDoc.getElementById && srcDoc.getElementById('train_form'));

            // Dane z ekranu rekrutacji pobieramy w tle (jesteśmy na ratuszu)
            const refreshSource = async () => {
                try {
                    const r = await fetch(trainUrl, { credentials: 'same-origin' });
                    const html = await r.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    if (doc.getElementById('train_form')) { srcDoc = doc; lastRefresh = new Date(); return true; }
                } catch (e) { /* spróbujemy przy kolejnym ticku */ }
                return false;
            };

            // Wysyłka rekrutacji w tle (POST jak z formularza)
            const submitRemote = async (unit, amount) => {
                const form = srcDoc.getElementById('train_form');
                if (!form) return false;
                const params = new URLSearchParams();
                form.querySelectorAll('input[name]').forEach(el => {
                    if (el.type === 'submit' || el.type === 'button') return;
                    if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
                    if (el.type === 'text' || el.type === 'number') params.append(el.name, el.name === unit ? String(amount) : '');
                    else params.append(el.name, el.value);
                });
                const action = new URL(form.getAttribute('action') || trainUrl, location.href).href;
                if (!params.has('h') && !/[?&]h=/.test(action) && game_data.csrf) params.append('h', game_data.csrf);
                const r = await fetch(action, {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString()
                });
                return r.ok;
            };

            const persist = () => {
                localStorage.setItem(keyUnitData, JSON.stringify(unitData));
                localStorage.setItem(keyLimitData, JSON.stringify(limitData));
                localStorage.setItem(keyQueueSize, maxQueueSize);
            };

            const calcPop = () => {
                let totalPop = 0;
                activeUnits.forEach(u => {
                    const pop = (parseInt(limitData[u]) || 0) * (popCost[u] || 1);
                    totalPop += pop;
                    $(`#tcm-pop-${u}`).text(pop);
                });
                $('#tcm-total-pop').text(totalPop);
            };

            const calcTime = () => {
                let bTimes = { barracks: 0, stable: 0, garage: 0 };
                ['barracks', 'stable', 'garage'].forEach(b => {
                    const wrap = q(`#trainqueue_wrap_${b}`);
                    if (wrap.length) {
                        wrap.find('tr').each(function() {
                            const timeCell = $(this).find('td:nth-child(2)');
                            const timerSpan = $(this).find('span.timer');
                            const textToParse = timerSpan.length ? timerSpan.text() : (timeCell.length ? timeCell.text() : '');
                            const match = textToParse.match(/^(\d+):(\d{2}):(\d{2})/);
                            if (match) bTimes[b] += (+match[1]) * 3600 + (+match[2]) * 60 + (+match[3]);
                        });
                    }
                });
                activeUnits.forEach(key => {
                    const limit = parseInt(limitData[key]) || 0;
                    const current = parseInt($(`#tcm-curr-${key}`).text()) || 0;
                    const missing = limit - current;
                    if (missing > 0) {
                        const row = q(`#train_form input[name="${key}"]`).closest('tr');
                        const match = row.find('td').text().match(/(\d+):(\d{2}):(\d{2})/);
                        if (match) bTimes[buildingMap[key]] += missing * ((+match[1]) * 3600 + (+match[2]) * 60 + (+match[3]));
                    }
                });
                const maxSec = Math.max(bTimes.barracks, bTimes.stable, bTimes.garage);
                const finishBox = $('#tcm-finish-time-box');
                if (maxSec > 0) {
                    const f = new Date(Date.now() + maxSec * 1000);
                    const p2 = n => String(n).padStart(2, '0');
                    finishBox.html(`⏳ <span style="color:#6bbf6b">${p2(f.getDate())}.${p2(f.getMonth() + 1)} ${p2(f.getHours())}:${p2(f.getMinutes())}</span>`);
                } else {
                    finishBox.html(`✅ <span style="color:#6bbf6b">Gotowe</span>`);
                }
            };

            const getUnitsInQueue = () => {
                let queueUnits = {};
                activeUnits.forEach(u => queueUnits[u] = 0);
                q('.trainqueue_wrap table tr').each(function() {
                    const row = $(this);
                    const sprite = row.find('.unit_sprite_smaller');
                    if (sprite.length) {
                        const unitClass = sprite.attr('class').split(' ').find(c => c !== 'unit_sprite' && c !== 'unit_sprite_smaller');
                        if (unitClass && queueUnits[unitClass] !== undefined) {
                            const text = row.find('td').first().text().replace(/\s+/g, ' ').trim();
                            queueUnits[unitClass] += parseInt(text.match(/^(\d+)/)) || 0;
                        }
                    }
                });
                return queueUnits;
            };

            const getVillageUnits = () => {
                let currentUnits = {};
                const queueUnits = getUnitsInQueue();
                activeUnits.forEach(key => {
                    const input = q(`#train_form input[name="${key}"]`);
                    if (input.length) {
                        const rowText = input.closest('tr').find('td').eq(2).text().replace(/\s+/g, '');
                        const match = rowText.match(/(\d+)\/(\d+)/);
                        const countInVillage = match ? parseInt(match[2], 10) : (parseInt(input.closest('td').prev('td').text().trim(), 10) || 0);
                        const total = countInVillage + (queueUnits[key] || 0);
                        currentUnits[key] = total;
                        $(`#tcm-curr-${key}`).text(total);
                    } else {
                        $(`#tcm-curr-${key}`).text('0');
                    }
                });
                return currentUnits;
            };

            // Moment (ms), kiedy najwcześniej skończy się jakaś pozycja kolejki - wtedy warto odświeżyć dane
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
            const renderQueueBox = () => {
                const box = $('#tcm-queue-box');
                if (!hasTrainForm()) { box.html('<div class="tcm-q-off">Brak danych kolejki (nie udało się pobrać strony rekrutacji)</div>'); return; }
                let html = '';
                ['barracks', 'stable', 'garage'].forEach(b => {
                    if (!activeUnits.some(u => buildingMap[u] === b)) return;
                    let items = '';
                    q(`#trainqueue_wrap_${b} table tr:has(.unit_sprite_smaller)`).each(function() {
                        const row = $(this);
                        const sprite = row.find('.unit_sprite_smaller');
                        const unitClass = (sprite.attr('class') || '').split(' ').find(c => c !== 'unit_sprite' && c !== 'unit_sprite_smaller');
                        const nMatch = row.find('td').first().text().replace(/\s+/g, ' ').trim().match(/^(\d+)/);
                        items += `<span class="tcm-q-item"><img src="${unitIcon(unitClass)}"> ${nMatch ? parseInt(nMatch[1], 10) : 0}</span>`;
                    });
                    html += `<div class="tcm-q-line"><span class="tcm-q-name">${bNames[b]}</span>${items || '<span class="tcm-q-off">—</span>'}</div>`;
                });
                box.html(html);
            };

            const updateUI = () => {
                $('#tcm-panel-rek .limit-in').each(function() { $(this).val(limitData[$(this).data('unit')] || ''); });
                $('#tcm-panel-rek .paczka-in').each(function() { $(this).val(unitData[$(this).data('unit')] || ''); });
                $('#tcm-queue-size-in').val(maxQueueSize);
                const btn = $('#tcm-toggle-btn');
                if (isActive === 1) btn.html('❎ Stop').removeClass('rk-btn-start').addClass('rk-btn-stop');
                else btn.html('✅ Start').removeClass('rk-btn-stop').addClass('rk-btn-start');
                getVillageUnits(); calcPop(); calcTime(); renderQueueBox();
                ctx.setRunning(isActive === 1);
            };

            $('#tcm-panel-rek .limit-in').on('change', function() {
                const u = $(this).data('unit');
                const val = parseInt($(this).val()) || 0;
                limitData[u] = val;
                if (val > 0 && (!unitData[u] || unitData[u] == 0)) {
                    const paczka = Math.max(1, Math.ceil(val / 50));
                    unitData[u] = paczka;
                    $(`#tcm-panel-rek .paczka-in[data-unit="${u}"]`).val(paczka);
                } else if (val <= 0) {
                    unitData[u] = '';
                    $(`#tcm-panel-rek .paczka-in[data-unit="${u}"]`).val('');
                }
                getVillageUnits(); calcPop(); calcTime();
            });

            $('#tcm-panel-rek .limit-in, #tcm-panel-rek .paczka-in').on('input', function() {
                const u = $(this).data('unit');
                if ($(this).hasClass('limit-in')) { limitData[u] = parseInt($(this).val()) || 0; calcPop(); }
                else unitData[u] = parseInt($(this).val()) || 0;
                calcTime();
            });

            $('#tcm-queue-size-in').on('change input', function() {
                maxQueueSize = parseInt($(this).val()) || 4;
                localStorage.setItem(keyQueueSize, maxQueueSize);
                runTick();
            });

            $('#tcm-save-btn').click(function() {
                maxQueueSize = parseInt($('#tcm-queue-size-in').val()) || maxQueueSize;
                persist();
                const btn = $(this);
                btn.html('Zapisano!').addClass('rk-btn-start');
                setTimeout(() => { btn.html('💾 Zapisz').removeClass('rk-btn-start'); }, 1500);
            });

            $('#tcm-clear-btn').click(function() {
                if (confirm('Czy na pewno chcesz usunąć wszystkie limity i wielkości paczek?')) {
                    activeUnits.forEach(u => { unitData[u] = 0; limitData[u] = 0; });
                    persist();
                    updateUI();
                }
            });

            const recruitIfPossible = () => {
                if (isActive !== 1 || isRecruiting || !hasTrainForm()) return;
                const getBuildingQueueCount = (b) => {
                    const wrap = srcDoc.getElementById(`trainqueue_wrap_${b}`);
                    return wrap ? $(wrap).find('table tr:has(.unit_sprite_smaller)').length : 0;
                };
                const currentUnits = getVillageUnits();
                const candidates = [];
                activeUnits.forEach(key => {
                    const limit = parseInt(limitData[key]) || 0;
                    const paczka = parseInt(unitData[key]) || 0;
                    if (limit <= 0 || paczka <= 0) return;
                    if (getBuildingQueueCount(buildingMap[key]) >= maxQueueSize) return;
                    const missing = limit - (currentUnits[key] || 0);
                    if (missing > 0) {
                        const input = q(`#train_form input[name="${key}"]`);
                        if (input.length && !input.prop('disabled')) {
                            const nextLink = input.next('a');
                            const maxAfford = nextLink.length ? (parseInt(nextLink.text().replace(/\D/g, '')) || 0) : 0;
                            const targetAmount = Math.min(paczka, missing);
                            if (maxAfford >= targetAmount && targetAmount > 0) {
                                candidates.push({ unit: key, targetAmount, missingPercentage: missing / limit, missingAbsolute: missing });
                            }
                        }
                    }
                });
                if (!candidates.length) return;
                candidates.sort((a, b) => b.missingPercentage - a.missingPercentage || b.missingAbsolute - a.missingAbsolute);
                const candidate = candidates[0];

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
            };

            // Tick w Workerze - działa także, gdy karta jest w tle
            const workerUrl = URL.createObjectURL(new Blob([`
                let intervalId;
                self.onmessage = function(e) {
                    if (e.data.command === 'start') { intervalId = setInterval(() => self.postMessage('tick'), e.data.time); }
                    else if (e.data.command === 'stop') { clearInterval(intervalId); }
                };
            `], { type: 'application/javascript' }));
            let recruitWorker = null;

            // Pobieramy świeże dane tylko wtedy, gdy ma to sens
            const needFetch = () => {
                if (!hasTrainForm() || !lastRefresh) return true;
                if (Date.now() >= getNextQueueEvent()) return true;
                const cur = getVillageUnits();
                return activeUnits.some(key => {
                    const limit = parseInt(limitData[key]) || 0;
                    const paczka = parseInt(unitData[key]) || 0;
                    if (limit <= 0 || paczka <= 0) return false;
                    if (limit - (cur[key] || 0) <= 0) return false;
                    const wrap = srcDoc.getElementById(`trainqueue_wrap_${buildingMap[key]}`);
                    const inQueue = wrap ? $(wrap).find('table tr:has(.unit_sprite_smaller)').length : 0;
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
                } finally { tickBusy = false; }
            };

            const startLoop = () => {
                if (recruitWorker) recruitWorker.terminate();
                recruitWorker = new Worker(workerUrl);
                recruitWorker.onmessage = runTick;
                recruitWorker.postMessage({ command: 'start', time: 5000 });
            };
            const stopLoop = () => { if (recruitWorker) recruitWorker.postMessage({ command: 'stop' }); };

            $('#tcm-toggle-btn').click(async () => {
                isActive = isActive === 1 ? 2 : 1;
                localStorage.setItem(keyActive, isActive);
                await refreshSource();
                updateUI();
                if (isActive === 1) { recruitIfPossible(); startLoop(); } else stopLoop();
            });

            setTimeout(async () => {
                await refreshSource();
                updateUI();
                if (isActive === 1) { setTimeout(recruitIfPossible, 1200); startLoop(); }
            }, 1000);

            // Włącza rekrutację, jeśli była wyłączona (akcja z listy ma ją po prostu odpalić)
            const ensureRunning = async () => {
                if (isActive === 1) return;
                isActive = 1;
                localStorage.setItem(keyActive, isActive);
                await refreshSource();
                updateUI();
                recruitIfPossible();
                startLoop();
            };

            const addLimits = (units, stock, absolute) => {
                const applied = [];
                Object.keys(units || {}).forEach(u => {
                    if (!activeUnits.includes(u)) return;
                    const n = parseInt(units[u], 10) || 0;
                    if (n <= 0) return;
                    if (absolute) limitData[u] = n; // tryb "do stanu": limit dokładnie jak wpisany w panelu
                    else limitData[u] = Math.max(parseInt(limitData[u]) || 0, stock ? (stock[u] || 0) : 0) + n;
                    if (!unitData[u] || unitData[u] == 0) unitData[u] = Math.max(1, Math.ceil(limitData[u] / 50));
                    applied.push(u);
                });
                persist();
                updateUI();
                return applied;
            };

            return {
                activeUnits: activeUnits,
                isActive: () => isActive === 1,
                addLimits: addLimits,
                // wywoływane przez rdzeń dla pozycji {t:'act', kind:'recruit'} na liście budowy
                run: async function(item) {
                    if (!item || item.kind !== 'recruit') return false;
                    if (item.mode === 'target') { // jak dotąd: limit = docelowy stan, bez liczenia obecnych
                        const ap = addLimits(item.units, null, true);
                        ensureRunning();
                        return { ok: true, msg: ap.length ? `Rekrutacja: ustawiono limity do stanu (${ap.length} jedn.), rekrutacja włączona.` : 'Rekrutacja: żadna z jednostek nie jest dostępna na tym świecie.' };
                    }
                    const fresh = await refreshSource();
                    if (!fresh || !hasTrainForm()) return false; // brak danych (np. brak koszar) - spróbuje ponownie
                    const applied = addLimits(item.units, getVillageUnits());
                    ensureRunning();
                    return {
                        ok: true,
                        msg: applied.length ? `Rekrutacja: dodano do limitów (${applied.length} jedn.), rekrutacja włączona.`
                                            : 'Rekrutacja: żadna z jednostek nie jest dostępna na tym świecie.'
                    };
                }
            };
        }
    });
})();
