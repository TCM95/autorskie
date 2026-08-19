// ==UserScript==
// @name          Kalkulator rekru
// @namespace    https://viayoo.com/
// @version      3.3
// @description  Zarządzanie rekrutacją wojsk
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=train*
// @match        *://*.plemiona.pl/game.php?*screen=barracks*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const villageId = (typeof game_data !== 'undefined' && game_data.village) ? game_data.village.id : 'global';
    
    const keyUnitData = `TCM_CR_unitData_${villageId}`;
    const keyLimitData = `TCM_CR_limitData_${villageId}`;
    const keyQueueSize = `TCM_CR_queueSize_${villageId}`;
    const keyActive = `TCM_CR_active_${villageId}`;

    let unitData = JSON.parse(localStorage.getItem(keyUnitData)) || { 'spear': 0, 'sword': 0, 'axe': 0, 'spy': 0, 'light': 0, 'heavy': 0, 'ram': 0, 'catapult': 0 };
    let limitData = JSON.parse(localStorage.getItem(keyLimitData)) || { 'spear': 0, 'sword': 0, 'axe': 0, 'spy': 0, 'light': 0, 'heavy': 0, 'ram': 0, 'catapult': 0 };
    let maxQueueSize = parseInt(localStorage.getItem(keyQueueSize)) || 4; 
    let isActive = parseInt(localStorage.getItem(keyActive)) || 2;

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
            width: 320px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.8); 
            font-family: Verdana,Arial,sans-serif; 
            color: var(--text-color);
            display: block !important;
        }

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

        .tcm-pin { 
            cursor: pointer; 
            padding: 2px 6px; 
            background: var(--btn-bg); 
            border: 1px solid var(--border-color); 
            border-radius: 3px; 
            font-size: 11px; 
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .tcm-pin.pinned { background: var(--btn-red-bg); }

        #tcm-rtable { width: 100%; margin-top: 4px; border-collapse: collapse; }
        #tcm-rtable td { text-align: center; padding: 2px; background: var(--bg-row-alt); border: 1px solid var(--border-color); }
        
        input.tcm-ri { 
            width: 100%; 
            font-size: 11px; 
            text-align: center; 
            background: #111; 
            color: white; 
            border: 1px solid var(--border-color); 
            border-radius: 3px; 
            padding: 2px 0;
        }

        .tcm-status-val { font-size: 10px; font-weight: bold; color: var(--title-color); }

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

        .tcm-queue-inline input {
            width: 35px;
            text-align: center;
            font-size: 11px;
            background: #111;
            color: white;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            padding: 2px;
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
    `);

    const iconUrl = (unit) => `https://dsen.innogamescdn.com/asset/10d39b3d/graphic/unit/unit_${unit}.png`;

    const uiHtml = `
    <div id="tcm-rekrutacja-ui">
        <div id="tcm-rekrutacja-header">
            <span>Kalkulator Rekrutacji</span>
            <span class="tcm-pin" id="tcm-pin-btn">📌</span>
        </div>
        <table id="tcm-rtable">
            <tbody>
                <tr>
                    <td><img src="${iconUrl('spear')}"></td>
                    <td><img src="${iconUrl('sword')}"></td>
                    <td><img src="${iconUrl('axe')}"></td>
                    <td><img src="${iconUrl('spy')}"></td>
                    <td><img src="${iconUrl('light')}"></td>
                    <td><img src="${iconUrl('heavy')}"></td>
                    <td><img src="${iconUrl('ram')}"></td>
                    <td><img src="${iconUrl('catapult')}"></td>
                </tr>
                <tr>
                    <td id="tcm-curr-spear" class="tcm-status-val">0</td>
                    <td id="tcm-curr-sword" class="tcm-status-val">0</td>
                    <td id="tcm-curr-axe" class="tcm-status-val">0</td>
                    <td id="tcm-curr-spy" class="tcm-status-val">0</td>
                    <td id="tcm-curr-light" class="tcm-status-val">0</td>
                    <td id="tcm-curr-heavy" class="tcm-status-val">0</td>
                    <td id="tcm-curr-ram" class="tcm-status-val">0</td>
                    <td id="tcm-curr-catapult" class="tcm-status-val">0</td>
                </tr>
                <tr>
                    <td><input class="tcm-ri limit-in" data-unit="spear" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="sword" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="axe" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="spy" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="light" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="heavy" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="ram" type="number"></td>
                    <td><input class="tcm-ri limit-in" data-unit="catapult" type="number"></td>
                </tr>
                <tr>
                    <td><input class="tcm-ri paczka-in" data-unit="spear" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="sword" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="axe" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="spy" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="light" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="heavy" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="ram" type="number"></td>
                    <td><input class="tcm-ri paczka-in" data-unit="catapult" type="number"></td>
                </tr>
            </tbody>
        </table>

        <div class="tcm-controls-bar">
            <div class="tcm-queue-inline">
                <span>Kolejka:</span>
                <input type="number" id="tcm-queue-size-in" min="1" max="20">
            </div>
            <div>
                <button id='tcm-save-btn' class='tcm-btn'>Zapisz</button>
                <button id='tcm-toggle-btn' class='tcm-btn'>Start</button>
            </div>
        </div>
    </div>`;

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
    }, 100);

    function initLogic() {
        const uiBox = document.getElementById('tcm-rekrutacja-ui');
        const header = document.getElementById('tcm-rekrutacja-header');
        const pinBtn = document.getElementById('tcm-pin-btn');
        
        let isPinned = localStorage.getItem('TCM_CR_Pinned') === 'true';
        let savedPos = JSON.parse(localStorage.getItem('TCM_CR_Pos'));

        if (savedPos) {
            uiBox.style.left = savedPos.left;
            uiBox.style.top = savedPos.top;
        }
        
        if (isPinned) {
            pinBtn.classList.add('pinned');
        }

        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isPinned = !isPinned;
            localStorage.setItem('TCM_CR_Pinned', isPinned);
            if (isPinned) {
                pinBtn.classList.add('pinned');
            } else {
                pinBtn.classList.remove('pinned');
            }
        });

        let isDragging = false, startX, startY, initialX, initialY;

        const dragStart = (e) => {
            if (isPinned || e.target === pinBtn) return;
            isDragging = true;
            let evt = e.type.includes('mouse') ? e : e.touches[0];
            
            startX = evt.pageX; 
            startY = evt.pageY;
            
            initialX = uiBox.offsetLeft;
            initialY = uiBox.offsetTop;
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault(); 
            
            let evt = e.type.includes('mouse') ? e : e.touches[0];
            let dx = evt.pageX - startX;
            let dy = evt.pageY - startY;
            
            uiBox.style.left = `${initialX + dx}px`;
            uiBox.style.top = `${initialY + dy}px`;
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

        const getUnitsInQueue = () => {
            let queueUnits = { 'spear': 0, 'sword': 0, 'axe': 0, 'spy': 0, 'light': 0, 'heavy': 0, 'ram': 0, 'catapult': 0 };
            $('.trainqueue_wrap table tr').each(function() {
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

            Object.keys(unitData).forEach(key => {
                const input = $(`#train_form input[name="${key}"]`);
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

        const updateUI = () => {
            $('.limit-in').each(function() { $(this).val(limitData[$(this).data('unit')] || ''); });
            $('.paczka-in').each(function() { $(this).val(unitData[$(this).data('unit')] || ''); });
            $('#tcm-queue-size-in').val(maxQueueSize);
            
            const btn = $('#tcm-toggle-btn');
            if (isActive === 1) {
                btn.text('Stop').removeClass('tcm-btn-start').addClass('tcm-btn-stop');
            } else {
                btn.text('Start').removeClass('tcm-btn-stop').addClass('tcm-btn-start');
            }
            
            getVillageUnits();
        };

        $('.limit-in').on('input', function() {
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
        });

        $('.paczka-in').on('input', function() { unitData[$(this).data('unit')] = parseInt($(this).val()) || 0; });
        $('#tcm-queue-size-in').on('input', function() { maxQueueSize = parseInt($(this).val()) || 4; });

        $('#tcm-save-btn').click(function() {
            localStorage.setItem(keyUnitData, JSON.stringify(unitData));
            localStorage.setItem(keyLimitData, JSON.stringify(limitData));
            localStorage.setItem(keyQueueSize, maxQueueSize);
            
            let btn = $(this);
            btn.text('Zapisano!').addClass('tcm-btn-start');
            setTimeout(() => {
                btn.text('Zapisz').removeClass('tcm-btn-start');
            }, 1200);
        });

        const recruitIfPossible = () => {
            if (isActive !== 1) return;

            let currentQueueCount = $('.trainqueue_wrap table tr[id^="trainorder_"], .trainqueue_wrap table tr.lit').length;
            if (currentQueueCount >= maxQueueSize) return;

            let currentUnits = getVillageUnits();
            let candidates = [];

            Object.keys(limitData).forEach(key => {
                let limit = parseInt(limitData[key]) || 0;
                let paczka = parseInt(unitData[key]) || 0;
                if (limit <= 0 || paczka <= 0) return;

                let current = currentUnits[key] || 0;
                let missing = limit - current;

                if (missing > 0) {
                    const input = $(`#train_form input[name="${key}"]`);
                    if (input.length && !input.prop('disabled')) {
                        let nextLink = input.next('a');
                        let maxAfford = nextLink.length ? (parseInt(nextLink.text().replace(/\D/g, '')) || 0) : 0;
                        
                        let targetAmount = Math.min(paczka, missing);
                        
                        if (maxAfford >= targetAmount && targetAmount > 0) {
                            candidates.push({
                                unit: key,
                                targetAmount: targetAmount,
                                missingPercentage: missing / limit,
                                missingAbsolute: missing
                            });
                        }
                    }
                }
            });

            if (candidates.length > 0) {
                candidates.sort((a, b) => b.missingPercentage - a.missingPercentage || b.missingAbsolute - a.missingAbsolute);
                let bestCandidate = candidates[0];

                const input = $(`#train_form input[name="${bestCandidate.unit}"]`);
                
                $('#train_form input[type="text"]').val(''); 
                input.val(bestCandidate.targetAmount);
                input.trigger('change');
                input[0].dispatchEvent(new Event('input', { bubbles: true }));

                setTimeout(() => {
                    let form = $('#train_form');
                    let submitBtn = form.find('input[type="submit"], button[type="submit"]');
                    if (!submitBtn.length) {
                        submitBtn = $('<input type="submit" style="display:none;">');
                        form.append(submitBtn);
                    }
                    submitBtn.click();
                }, 400);
            }
        };

        let recruitLoop;
        const startLoop = () => {
            clearInterval(recruitLoop);
            recruitLoop = setInterval(() => {
                if (isActive === 1) {
                    updateUI();
                    recruitIfPossible();
                }
            }, 3500);
        };
        const stopLoop = () => clearInterval(recruitLoop);

        $('#tcm-toggle-btn').click(() => {
            isActive = isActive === 1 ? 2 : 1;
            localStorage.setItem(keyActive, isActive);
            updateUI();
            if (isActive === 1) {
                recruitIfPossible();
                startLoop();
            } else {
                stopLoop();
            }
        });

        setTimeout(() => {
            updateUI();
            if (isActive === 1) {
                setTimeout(recruitIfPossible, 1200); 
                startLoop();
                setInterval(() => location.reload(true), 5 * 60 * 1000);
            }
        }, 1000);
    }
})();
