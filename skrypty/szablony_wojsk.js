// ==UserScript==
// @name         Menedzer_Wojska_TCM glowby
// @namespace    https://viayoo.com/
// @description  Kafelki na stronie gry + Pływający Kalkulator/Kreator z poprawionym liczeniem czasu
// @author       TCM
// @match        *://*.plemiona.pl/game.php*screen=train*
// @match        *://*.plemiona.pl/game.php*screen=am_troops*
// @match        *://*.plemiona.pl/game.php*screen=train&mode=mass_decommission*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const urlKey = window.location.hostname.split('.')[0];
    
    const swiatZLukami = typeof game_data !== 'undefined' && game_data.units.includes('archer');
    
    const popKoszty = { spear: 1, sword: 1, axe: 1, archer: 1, spy: 2, light: 4, marcher: 5, heavy: 6, ram: 5, catapult: 8 };
    const budynki = {
        spear: 'kosz', sword: 'kosz', axe: 'kosz', archer: 'kosz',
        spy: 'staj', light: 'staj', marcher: 'staj', heavy: 'staj',
        ram: 'wars', catapult: 'wars'
    };
    // Zmodyfikowane lekko kolory pod ciemny motyw, aby były czytelne
    const koloryBudynkow = { kosz: '#ff6666', staj: '#66b3ff', wars: '#d2a679' };

    const ikony = {
        spear: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/spear.webp',
        sword: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/sword.webp',
        axe: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/axe.webp',
        archer: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/archer.webp',
        spy: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/spy.webp',
        light: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/light.webp',
        marcher: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/marcher.webp',
        heavy: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/heavy.webp',
        ram: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/ram.webp',
        catapult: 'https://dspl.innogamescdn.com/asset/2fe6656b/graphic/unit/recruit/catapult.webp'
    };

    let szablony = [
        { nazwa: '1 LINIA FRONT DO 3 KRATEK START', typ: 'off', wojsko: { sword: 2, axe: 13000, spy: 400, heavy: 1000, ram: 200 } },
        { nazwa: '1 LINIA FRONT DO 3 KRATEK SZYBKI', typ: 'off', wojsko: { sword: 2, axe: 7000, spy: 400, heavy: 2050, ram: 200 } },
        { nazwa: '1 LINIA FRONT DO 3 KRATEK LK', typ: 'off', wojsko: { sword: 2, axe: 7200, light: 3150, ram: 100 } },
        { nazwa: '1 LINIA POWYŻEJ 3 KRATEK START', typ: 'off', wojsko: { sword: 2, axe: 10700, light: 2000, ram: 300 } },
        { nazwa: '1 LINIA POWYŻEJ 3 KRATEK SZYBKI', typ: 'off', wojsko: { sword: 2, axe: 6790, light: 3000, ram: 300 } },
        { nazwa: '2 LINIA START', typ: 'off', wojsko: { sword: 3, axe: 10050, spy: 300, light: 2000, ram: 300, catapult: 50 } },
        { nazwa: '2 LINIA SZYBKI', typ: 'off', wojsko: { sword: 3, axe: 6100, spy: 300, light: 2950, ram: 300, catapult: 50 } },
        { nazwa: 'STREFA OFF OTWIERACZ START', typ: 'off', wojsko: { sword: 3, axe: 8700, spy: 400, light: 2000, ram: 500, catapult: 100 } },
        { nazwa: 'STREFA OFF OTWIERACZ SZYBKI', typ: 'off', wojsko: { sword: 3, axe: 6050, spy: 400, light: 2675, ram: 500, catapult: 100 } },
        { nazwa: 'STREFA OFF STANDARD START', typ: 'off', wojsko: { sword: 3, axe: 9700, spy: 400, light: 2000, ram: 300, catapult: 100 } },
        { nazwa: 'STREFA OFF STANDARD SZYBKI', typ: 'off', wojsko: { sword: 3, axe: 6790, spy: 400, light: 2825, ram: 300, catapult: 100 } },
        { nazwa: 'OFF/300', typ: 'off', wojsko: { axe: 5422, spy: 10, light: 2800, ram: 300, catapult: 300 } },
        { nazwa: 'OFF/200', typ: 'off', wojsko: { axe: 6250, spy: 150, light: 2741, ram: 310, catapult: 200 } },
        { nazwa: 'OFF/100', typ: 'off', wojsko: { axe: 6400, spy: 200, light: 2842, ram: 310, catapult: 100 } },
        { nazwa: 'OFF/50', typ: 'off', wojsko: { axe: 6500, spy: 200, light: 2900, ram: 310, catapult: 50 } },
        { nazwa: 'OFF 1', typ: 'off', wojsko: { axe: 6750, spy: 200, light: 3000, ram: 310 } },
        { nazwa: 'OFF 2', typ: 'off', wojsko: { axe: 7500, spy: 200, light: 2800, ram: 310 } },
        { nazwa: 'OFF Łucznicy', typ: 'off', wojsko: { axe: 5700, spy: 100, light: 2768, marcher: 300, ram: 450 } },
        { nazwa: 'Burzyciel Standard', typ: 'off', wojsko: { axe: 5082, spy: 100, light: 2600, ram: 1000, catapult: 5 } },
        { nazwa: 'Burzyciel Bunkry', typ: 'off', wojsko: { axe: 4082, spy: 100, light: 1850, ram: 1800, catapult: 5 } },
        { nazwa: '1 LINIA DEFF', typ: 'deff', wojsko: { spear: 8500, sword: 20, spy: 205, heavy: 1820, ram: 12 } },
        { nazwa: '2 LINIA DEFF', typ: 'deff', wojsko: { spear: 8500, sword: 20, spy: 528, heavy: 1700, ram: 12, catapult: 50 } },
        { nazwa: '3 LINIA DEFF', typ: 'deff', wojsko: { spear: 8460, sword: 4, axe: 80, spy: 660, light: 50, heavy: 1650, ram: 15, catapult: 100 } },
        { nazwa: 'ZAPLECZE STARTOWE DEFF', typ: 'deff', wojsko: { spear: 10300, sword: 10300, spy: 310 } },
        { nazwa: 'DEFF Mobil', typ: 'deff', wojsko: { spear: 8100, sword: 125, axe: 200, spy: 500, light: 100, heavy: 1600, ram:10, catapult: 100 } },
        { nazwa: 'DEFF Agresywny', typ: 'deff', wojsko: { spear: 9034, spy: 50, heavy: 1900 } },
        { nazwa: 'DEFF CK', typ: 'deff', wojsko: { spy: 100, heavy: 3395 } },
        { nazwa: 'Zwiadowcza', typ: 'deff', wojsko: { spear: 150, sword: 150, axe: 400, spy: 8750, light: 200, ram: 10, catapult: 200 } },
        { nazwa: 'Burzak 200k', typ: 'burz', wojsko: { axe: 300, light: 100, ram: 10, catapult: 200 } },
        { nazwa: 'Burzak 100k', typ: 'burz', wojsko: { axe: 200, light: 100, ram: 10, catapult: 100 } },
        { nazwa: 'Burzak 50k', typ: 'burz', wojsko: { axe: 150, light: 50, ram: 10, catapult: 50 } }
    ];

    let uiState = JSON.parse(localStorage.getItem(`kreator_ui_${urlKey}`)) || { top: '10%', left: '50%' };
    
    // Wstrzykiwanie wzorca CSS
    const css = `
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
        .tcm-btn {
            background: var(--btn-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            cursor: pointer;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: bold;
        }
        .tcm-btn:hover {
            background: var(--btn-hover);
        }
        .tcm-input {
            background: var(--bg-row-alt);
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);

    const getGameInput = (u) => document.getElementById(`${u}_0`) || document.getElementsByName(u)[0];

    const formatSeconds = (s) => {
        if (s <= 0) return "0s";
        const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        let res = "";
        if (d > 0) res += `<b>${d}d</b> `;
        if (h > 0 || d > 0) res += `${h}h `;
        if (m > 0 || h > 0 || d > 0) res += `${m}m `;
        if (d === 0) res += `${sec}s`;
        return res.trim();
    };

    const getUnitTimeInSeconds = (u) => {
        const el = document.getElementById(`${u}_0_cost_time`);
        if (!el || !el.innerText) return 0;
        const match = el.innerText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
        return match ? (parseInt(match[1], 10) * 3600) + (parseInt(match[2], 10) * 60) + parseInt(match[3], 10) : 0;
    };

    const przelicz = () => {
        let pop = 0, tk = 0, ts = 0, tw = 0;
        Object.keys(ikony).forEach(u => {
            const input = document.getElementById(`c_in_${u}`);
            if(!input) return;
            const val = parseInt(input.value, 10) || 0;
            const timeCell = document.getElementById(`c_time_${u}`);
            
            const unitSec = getUnitTimeInSeconds(u);

            if (unitSec > 0) {
                const totalUnitTime = val * unitSec;
                if(timeCell) timeCell.innerHTML = val > 0 ? formatSeconds(totalUnitTime) : "0s";
                if (budynki[u] === 'kosz') tk += totalUnitTime;
                if (budynki[u] === 'staj') ts += totalUnitTime;
                if (budynki[u] === 'wars') tw += totalUnitTime;
            } else {
                if(timeCell) timeCell.innerHTML = "-";
            }
            pop += val * (popKoszty[u] || 1);
        });
        
        let popEl = document.getElementById('r-pop');
        if(popEl) popEl.innerText = pop.toLocaleString();
        
        ['kosz', 'staj', 'wars'].forEach(b => {
            let el = document.getElementById(`r-${b}`);
            if(el) el.innerHTML = formatSeconds(b === 'kosz' ? tk : b === 'staj' ? ts : tw);
        });
    };

    const wstawDoGry = (szablon) => {
        if (szablon.typ !== 'burz') {
            Object.keys(ikony).forEach(u => {
                let el = getGameInput(u);
                if (el) el.value = "";
                let calcEl = document.getElementById(`c_in_${u}`);
                if (calcEl) calcEl.value = 0;
            });
        }
        
        for (let j in szablon.wojsko) {
            let el = getGameInput(j);
            if (el) {
                el.value = szablon.wojsko[j];
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            let calcEl = document.getElementById(`c_in_${j}`);
            if (calcEl) calcEl.value = szablon.wojsko[j];
        }
        przelicz();
    };

    const stworzBlok = (kolor) => {
        const d = document.createElement('div');
        d.style = `margin-bottom: 10px; padding: 6px; background: transparent; border: 2px solid ${kolor}; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 6px;`;
        return d;
    };

    const renderKafelki = () => {
        let glownyContainer = document.getElementById('sekcje-szablonow');
        const selectBox = document.getElementById('template_selection') || document.getElementById('train_form');
        if (!selectBox) return;

        if (!glownyContainer) {
            glownyContainer = document.createElement('div');
            glownyContainer.id = 'sekcje-szablonow';
            glownyContainer.style = "margin: 15px 0; border: 1px solid var(--border-color); background: var(--bg-main); border-radius: 4px; overflow: hidden; width: 100%; color: var(--text-color);";

            const header = document.createElement('div');
            header.style = "background: var(--bg-header); color: var(--title-color); border-bottom: 1px solid var(--border-color); padding: 6px 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; cursor: pointer;";
            header.innerHTML = `<span>SZABLONY TCM</span> <span id="toggle-btn" style="font-family: monospace;">[-]</span>`;

            const contentWrapper = document.createElement('div');
            contentWrapper.id = "szablony-content-main";
            contentWrapper.style = "padding: 10px;";

            let isMinimized = localStorage.getItem('szablony_minimized') === 'true';
            const updateState = () => {
                contentWrapper.style.display = isMinimized ? 'none' : 'block';
                header.querySelector('#toggle-btn').innerText = isMinimized ? '[+]' : '[-]';
                localStorage.setItem('szablony_minimized', isMinimized);
            };

            header.onclick = () => { isMinimized = !isMinimized; updateState(); };
            
            glownyContainer.append(header, contentWrapper);
            selectBox.parentNode.insertBefore(glownyContainer, selectBox);
            updateState();
        }

        const content = document.getElementById('szablony-content-main');
        content.innerHTML = ""; 

        const sOff = stworzBlok('#cc0000'); // Wyraźniejsze obramowanie dla OFF
        const sDef = stworzBlok('#3399ff'); // Wyraźniejsze obramowanie dla DEFF
        const sBurz = stworzBlok('#b36b00'); // Wyraźniejsze obramowanie dla Burzaków

        let saved = JSON.parse(localStorage.getItem(`tcm_custom_templates_${urlKey}`)) || [];
        let allTemplates = [...szablony, ...saved];

        allTemplates.forEach((s, idx) => {
            if (swiatZLukami && s.wojsko.sword && !s.wojsko.archer) {
                s.wojsko.archer = s.wojsko.sword;
                delete s.wojsko.sword;
            }
            if (!swiatZLukami && (s.wojsko.archer || s.wojsko.marcher)) return;

            let sumaPop = 0;
            for (let u in s.wojsko) sumaPop += s.wojsko[u] * (popKoszty[u] || 1);

            let target = sDef; let hCol = "#3399ff";
            if (s.typ === 'off') { target = sOff; hCol = "#cc0000"; }
            else if (s.typ === 'burz') { target = sBurz; hCol = "#b36b00"; }

            let grid = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">`;
            for (let j in s.wojsko) {
                grid += `<div style="display:flex; align-items:center; gap:3px; font-size:10px;"><img src="${ikony[j]}" width="12"><b>${s.wojsko[j]}</b></div>`;
            }
            grid += `</div>`;

            let usunBtn = s.custom ? `<span class="del-template" data-idx="${idx - szablony.length}" style="color:#ff4d4d; cursor:pointer; float:right;">[x]</span>` : "";

            const kafel = document.createElement('div');
            kafel.style = `background: var(--bg-row-alt); border: 1px solid ${hCol}; flex: 1; min-width: 130px; cursor: pointer; padding: 4px; border-radius: 4px; box-shadow: 1px 1px 2px rgba(0,0,0,0.2);`;
            kafel.innerHTML = `
                <div style="border-bottom: 1px solid ${hCol}; color: var(--title-color); text-align:center; font-weight:bold; margin-bottom:6px; padding-bottom:4px; font-size:11px;">
                    ${usunBtn} ${s.nazwa} <br> <span style="color:#aaaaaa; font-size:10px; font-weight:normal;">🏠 ${sumaPop.toLocaleString()}</span>
                </div>
                ${grid}`;

            kafel.onclick = (e) => {
                e.preventDefault();
                if(e.target.classList.contains('del-template')) {
                    e.stopPropagation();
                    let delIdx = e.target.getAttribute('data-idx');
                    saved.splice(delIdx, 1);
                    localStorage.setItem(`tcm_custom_templates_${urlKey}`, JSON.stringify(saved));
                    renderKafelki();
                    return;
                }
                wstawDoGry(s);
            };
            target.appendChild(kafel);
        });

        content.append(sOff, sDef, sBurz);
    };

    const stworzUIKalkulatora = () => {
        if (document.getElementById('tcm-kreator-wrapper')) return;

        const openBtn = document.createElement('button');
        openBtn.innerHTML = "🛠️ Kalkulator Czasu / Kreator Szablonów";
        openBtn.className = "tcm-btn";
        openBtn.style.margin = "10px 0";
        openBtn.style.width = "100%";
        openBtn.style.maxWidth = "350px";

        let selectBox = document.getElementById('template_selection') || document.getElementById('train_form');
        if (selectBox) selectBox.parentNode.insertBefore(openBtn, selectBox);

        const win = document.createElement('div');
        win.id = 'tcm-kreator-wrapper';
        win.style = `display: none; position: fixed; top: ${uiState.top}; left: ${uiState.left}; transform: translateX(-50%); z-index: 10000; background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 4px; width: 95%; max-width: 320px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); font-family: Verdana, sans-serif;`;

        win.innerHTML = `
            <div id="tcm-header" style="background: var(--bg-header); color: var(--title-color); padding: 10px; font-weight: bold; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: move;">
                <span>⏱️ KALKULATOR</span>
                <div>
                    <span id="close-calc" style="cursor: pointer; background: transparent; color: #ff4d4d; font-weight: bold; padding: 2px 8px; font-size: 14px;">X</span>
                </div>
            </div>

            <div style="padding: 10px;">
                <table style="width: 100%; border-collapse: collapse;">
                    ${Object.keys(ikony).map(u => {
                        if (!swiatZLukami && (u === 'archer' || u === 'marcher')) return '';
                        return `
                        <tr style="border-bottom: 1px solid var(--border-color); height: 35px;">
                            <td width="25"><img src="${ikony[u]}" width="18"></td>
                            <td width="80"><input type="number" id="c_in_${u}" value="0" min="0" class="tcm-input" style="width: 70px; font-size: 11px; text-align: center; padding: 2px;"></td>
                            <td id="c_time_${u}" style="font-size: 11px; text-align: right; color: ${koloryBudynkow[budynki[u]]}; font-weight: bold;">0s</td>
                        </tr>
                    `}).join('')}
                </table>

                <div style="margin-top: 15px; background: var(--bg-row-alt); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; padding-bottom: 5px; border-bottom: 1px dashed var(--border-color);">
                        <b>🏠 Populacja:</b> <span id="r-pop">0</span>
                    </div>
                    <div style="color:${koloryBudynkow.kosz}; display: flex; justify-content: space-between; margin-top: 5px;">
                        <b>⚔️ Koszary:</b> <span id="r-kosz">0s</span>
                    </div>
                    <div style="color:${koloryBudynkow.staj}; display: flex; justify-content: space-between; margin-top: 3px;">
                        <b>🐎 Stajnia:</b> <span id="r-staj">0s</span>
                    </div>
                    <div style="color:${koloryBudynkow.wars}; display: flex; justify-content: space-between; margin-top: 3px;">
                        <b>⚙️ Warsztat:</b> <span id="r-wars">0s</span>
                    </div>
                </div>

                <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                    <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                        <input type="text" id="cr-name" placeholder="Nazwa Szablonu" class="tcm-input" style="flex: 2; font-size: 11px; padding: 4px;">
                        <select id="cr-type" class="tcm-input" style="flex: 1; font-size: 11px; padding: 4px;">
                            <option value="off">OFF</option>
                            <option value="deff">DEFF</option>
                            <option value="burz">Burzak</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button id="cr-save" class="tcm-btn" style="flex: 2; font-size: 11px;">Zapisz jako Kafelek</button>
                        <button id="cr-export" class="tcm-btn" style="flex: 1; font-size: 11px;">Kod</button>
                    </div>
                    <button id="cr-clear" class="tcm-btn" style="width: 100%; margin-top: 5px; font-size: 11px; color: #ff4d4d;">Wyczyść Kalkulator</button>
                    <textarea id="cr-result" class="tcm-input" style="display: none; width: 95%; height: 40px; margin-top: 8px; font-size: 10px; padding: 4px;"></textarea>
                </div>
            </div>
        `;

        document.body.appendChild(win);

        let isDragging = false;
        let startX, startY, initialX, initialY;
        const header = document.getElementById('tcm-header');

        const startDrag = (e) => {
            if (e.target.id === 'close-calc') return;
            isDragging = true;
            let event = e.type.includes('mouse') ? e : e.touches[0];
            startX = event.clientX; startY = event.clientY;
            initialX = win.offsetLeft; initialY = win.offsetTop;
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let event = e.type.includes('mouse') ? e : e.touches[0];
            win.style.left = (initialX + (event.clientX - startX)) + 'px';
            win.style.top = (initialY + (event.clientY - startY)) + 'px';
        };

        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            uiState.top = win.style.top; uiState.left = win.style.left;
            localStorage.setItem(`kreator_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        header.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);

        openBtn.onclick = (e) => { e.preventDefault(); win.style.display = win.style.display === 'none' ? 'block' : 'none'; };
        document.getElementById('close-calc').onclick = () => win.style.display = 'none';
        
        document.getElementById('cr-clear').onclick = () => {
            Object.keys(ikony).forEach(u => {
                let c_in = document.getElementById(`c_in_${u}`);
                if(c_in) c_in.value = 0;
            });
            przelicz();
        };

        Object.keys(ikony).forEach(u => {
            let calcEl = document.getElementById(`c_in_${u}`);
            if(calcEl) {
                calcEl.addEventListener('input', () => {
                    przelicz();
                });
            }
        });

        document.getElementById('cr-save').onclick = () => {
            const name = document.getElementById('cr-name').value || "Nowy Szablon";
            const type = document.getElementById('cr-type').value;
            let units = {};
            Object.keys(ikony).forEach(u => {
                const val = parseInt(document.getElementById(`c_in_${u}`)?.value, 10) || 0;
                if (val > 0) units[u] = val;
            });
            if (Object.keys(units).length === 0) return alert("Wpisz chociaż jedną jednostkę w kalkulatorze!");

            let saved = JSON.parse(localStorage.getItem(`tcm_custom_templates_${urlKey}`)) || [];
            saved.push({ nazwa: name, typ: type, wojsko: units, custom: true });
            localStorage.setItem(`tcm_custom_templates_${urlKey}`, JSON.stringify(saved));
            renderKafelki(); 
            alert("Kafelek został dodany na górze strony!");
        };

        document.getElementById('cr-export').onclick = () => {
            const name = document.getElementById('cr-name').value || "Nowy";
            const type = document.getElementById('cr-type').value;
            let unitsArr = [];
            Object.keys(ikony).forEach(u => {
                const val = parseInt(document.getElementById(`c_in_${u}`)?.value, 10) || 0;
                if (val > 0) unitsArr.push(`${u}: ${val}`);
            });
            const line = `{ nazwa: '${name}', typ: '${type}', wojsko: { ${unitsArr.join(', ')} } },`;
            const area = document.getElementById('cr-result');
            area.value = line;
            area.style.display = 'block';
            area.select();
        };
    };

    setTimeout(() => {
        renderKafelki();
        stworzUIKalkulatora();
    }, 600);

})();
