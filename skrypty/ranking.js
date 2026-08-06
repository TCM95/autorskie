// ==UserScript==
// @name         ranking
// @namespace    https://viayoo.com/
// @author       TCM
// @match        https://*.plemiona.pl/game.php*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PREDEFINED_COLORS = [
        '#ff4d4d', '#33ccff', '#33cc33', '#ffcc00', '#ff33cc', 
        '#9933ff', '#00ff99', '#ff9933', '#ff8080', '#66b3ff',
        '#c6538c', '#ffd11a', '#00e6e6', '#d24dff', '#e6e600',
        '#ffb366', '#aaff00', '#ff0066', '#4d94ff', '#00cc66',
        '#800000', '#000080', '#808000', '#800080', '#008080'
    ];

    function injectUI() {
        if (document.getElementById('tcm-ranking-ui')) return;
        if (!window.location.href.includes('screen=ranking') || !window.location.href.includes('mode=in_a_day')) return;

        const savedTribes = localStorage.getItem('TCM_Saved_Tribes') || '';
        const savedLimit = localStorage.getItem('TCM_Saved_Limit') || '1200';
        const savedType = localStorage.getItem('TCM_Saved_Type') || 'scavenge';
        let savedPos = JSON.parse(localStorage.getItem('TCM_Ranking_Pos'));

        const ui = document.createElement('div');
        ui.id = 'tcm-ranking-ui';
        
        let initialTop = savedPos ? savedPos.top : '10px';
        let initialLeft = savedPos ? savedPos.left : '50%';
        
        ui.style.cssText = `position:fixed; top:${initialTop}; left:${initialLeft}; ${!savedPos ? 'transform:translateX(-50%);' : ''} width:260px; z-index:999999; box-shadow: rgba(0, 0, 0, 0.7) 2px 2px 10px;`;
        
        ui.innerHTML = `
            <table class="vis" style="width:100%; margin:0;">
                <tr>
                    <th id="tcm-drag-handle" style="cursor:move; user-select:none; display:flex; justify-content:space-between; align-items:center; padding: 5px;">
                        <span>Ranking Zbiorczy</span>
                        <span id="tcm-pin-btn" style="cursor:pointer; opacity:${savedPos ? '1' : '0.4'}; font-size:14px; margin-left:10px;" title="Przypnij">📌</span>
                    </th>
                </tr>
                <tr>
                    <td style="padding: 10px; text-align: center;">
                        <label style="font-weight:bold; display:block; margin-bottom:2px; font-size:11px;">Typ rankingu:</label>
                        <select id="tcm-type-select" style="width:100%; padding:3px; margin-bottom:5px; box-sizing: border-box;">
                            <option value="scavenge" ${savedType === 'scavenge' ? 'selected' : ''}>Zbieractwo</option>
                            <option value="loot_res" ${savedType === 'loot_res' ? 'selected' : ''}>Farma (Zrabowane)</option>
                        </select>
                        
                        <label style="font-weight:bold; display:block; margin-bottom:2px; font-size:11px;">Tagi plemion:</label>
                        <input type="text" id="tcm-ally-input" style="width:100%; padding:3px; margin-bottom:5px; box-sizing: border-box;" value="${savedTribes}" placeholder="np. ABC XYZ">
                        
                        <label style="font-weight:bold; display:block; margin-bottom:2px; font-size:11px;">Limit pozycji:</label>
                        <input type="number" id="tcm-limit-input" style="width:100%; padding:3px; margin-bottom:10px; box-sizing: border-box;" value="${savedLimit}">
                        
                        <button id="tcm-generate-btn" class="btn" style="width:100%; margin-bottom:5px;">Generuj Ranking</button>
                        <button id="tcm-reset-btn" class="btn btn-cancel" style="width:100%; margin-bottom:5px;">Resetuj Historię</button>
                        
                        <div style="background:#e3d5b3; border: 1px inset #7d510f; width:100%; height:10px; margin-top:5px; box-sizing: border-box;">
                            <div id="tcm-progress" style="width:0%; height:100%; background:green; transition: width 0.2s;"></div>
                        </div>
                        
                        <textarea id="tcm-ranking-output" style="width:100%; height:120px; margin-top:10px; display:none; font-size:11px; box-sizing: border-box;"></textarea>
                        <button id="tcm-copy-btn" class="btn" style="width:100%; display:none; margin-top:5px;">Kopiuj</button>
                    </td>
                </tr>
            </table>
        `;
        document.body.appendChild(ui);

        setupDraggableAndPin(ui);

        document.getElementById('tcm-generate-btn').addEventListener('click', runRanking);
        document.getElementById('tcm-reset-btn').addEventListener('click', () => {
            const currentType = document.getElementById('tcm-type-select').value;
            if(confirm('Czy na pewno chcesz usunąć zapisaną historię dla tego rankingu?')) {
                localStorage.removeItem(`TCM_Hist_${game_data.world}_${currentType}`);
                alert('Historia zresetowana.');
            }
        });
        document.getElementById('tcm-copy-btn').addEventListener('click', () => {
            const output = document.getElementById('tcm-ranking-output');
            output.select();
            document.execCommand('copy');
            alert('Skopiowano pomyślnie!');
        });
    }

    function setupDraggableAndPin(ui) {
        const handle = document.getElementById('tcm-drag-handle');
        const pinBtn = document.getElementById('tcm-pin-btn');
        let isDragging = false, startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if(e.target === pinBtn) return;
            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initialX = ui.offsetLeft;
            initialY = ui.offsetTop;
            
            // Remove transform if we start dragging to avoid coordinate jumping
            if (ui.style.transform) {
                ui.style.transform = '';
            }
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault(); 
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let dx = clientX - startX;
            let dy = clientY - startY;
            ui.style.left = (initialX + dx) + 'px';
            ui.style.top = (initialY + dy) + 'px';
        };

        const stopDrag = () => { isDragging = false; };

        handle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        handle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);

        pinBtn.addEventListener('click', () => {
            let saved = localStorage.getItem('TCM_Ranking_Pos');
            if (saved) {
                localStorage.removeItem('TCM_Ranking_Pos');
                pinBtn.style.opacity = '0.4';
                alert('Pozycja odpięta.');
            } else {
                localStorage.setItem('TCM_Ranking_Pos', JSON.stringify({top: ui.style.top, left: ui.style.left}));
                pinBtn.style.opacity = '1';
                alert('Pozycja przypięta pomyślnie!');
            }
        });
    }

    async function runRanking() {
        const input = document.getElementById('tcm-ally-input').value.trim();
        const limit = parseInt(document.getElementById('tcm-limit-input').value) || 1200;
        const rankingType = document.getElementById('tcm-type-select').value;
        
        localStorage.setItem('TCM_Saved_Tribes', input);
        localStorage.setItem('TCM_Saved_Limit', limit);
        localStorage.setItem('TCM_Saved_Type', rankingType);

        const tribes = input.split(/\s+/).filter(t => t);
        const tribeColors = {};
        tribes.forEach((t, i) => tribeColors[t] = PREDEFINED_COLORS[i % PREDEFINED_COLORS.length]);

        const progress = document.getElementById('tcm-progress');
        const outputBtn = document.getElementById('tcm-copy-btn');
        const outputArea = document.getElementById('tcm-ranking-output');
        
        outputBtn.style.display = 'none';
        outputArea.style.display = 'none';

        let data = [];
        const histKey = `TCM_Hist_${game_data.world}_${rankingType}`;
        let hist = JSON.parse(localStorage.getItem(histKey)) || {};
        let newHist = {};

        const totalSteps = Math.ceil(limit / 25);
        for (let i = 0; i < totalSteps; i++) {
            progress.style.width = Math.round((i / totalSteps) * 100) + '%';
            
            try {
                let res = await fetch(`game.php?screen=ranking&mode=in_a_day&offset=${i * 25}&type=${rankingType}`);
                if (!res.ok) throw new Error("Network response was not ok");
                
                let text = await res.text();
                let doc = new DOMParser().parseFromString(text, "text/html");
                let table = doc.querySelector(".vis.ranking-table") || doc.querySelector("#in_a_day_ranking_table");
                if (!table) break;
                
                let rows = table.querySelectorAll("tr");
                for (let j = 1; j < rows.length; j++) {
                    let tds = rows[j].querySelectorAll('td');
                    if (tds.length < 5) continue;
                    
                    let globalRank = parseInt(tds[0].innerText);
                    if (globalRank > limit) {
                        i = totalSteps; // Force exit outer loop
                        break; 
                    }
                    
                    let name = tds[1].innerText.trim();
                    let tribe = tds[2].innerText.trim();
                    let score = tds[3].innerText.trim();
                    let recordDate = tds[4].innerText.trim();
                    
                    if (tribes.includes(tribe)) {
                        data.push({ globalRank, name, tribe, score, date: recordDate });
                        newHist[name] = globalRank;
                    }
                }
            } catch (e) {
                console.warn("Wystąpił błąd podczas pobierania danych:", e);
                break; 
            }
        }

        const currentDate = new Date().toLocaleDateString('pl-PL');
        const rankingTitle = rankingType === 'scavenge' ? 'Ranking Zbieractwa' : 'Ranking Farmy';
        let legend = tribes.map(t => `[color=${tribeColors[t]}]■[/color] [ally]${t}[/ally]`).join(' ');
        
        let bb = `[b]${rankingTitle} - ${currentDate}[/b]\n\nLegenda: ${legend}\n\n[spoiler=Ranking]\n[table]\n[**]LP[||]Global[||]Gracz[||]Plemię[||]Wynik[||]Zmiana[||]Data[/**]\n`;

        data.forEach((p, idx) => {
            let oldRank = hist[p.name];
            let diff;
            
            if (!oldRank) {
                diff = "●0";
            } else {
                let change = oldRank - p.globalRank;
                if (change > 0) diff = `[color=#33cc33]▲${change}[/color]`;
                else if (change < 0) diff = `[color=#ff4d4d]▼${Math.abs(change)}[/color]`;
                else diff = "●0";
            }
            
            bb += `[*] [color=${tribeColors[p.tribe]}]■[/color]${idx + 1} [|] ${p.globalRank} [|] [player]${p.name}[/player] [|] [ally]${p.tribe}[/ally] [|] ${p.score} [|] ${diff} [|] ${p.date}\n`;
        });
        bb += `[/table]\n[/spoiler]`;

        outputArea.value = bb;
        outputArea.style.display = 'block';
        outputBtn.style.display = 'block';
        progress.style.width = '100%';
        
        localStorage.setItem(histKey, JSON.stringify(Object.assign({}, hist, newHist)));
    }

    setInterval(() => { if (typeof game_data !== 'undefined' && document.body) injectUI(); }, 1000);
})();
