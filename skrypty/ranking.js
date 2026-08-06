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

    function injectStyles() {
        if (document.getElementById('tcm-ranking-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-ranking-styles';
        style.innerHTML = `
            #tcm-ranking-ui {
                position: fixed; z-index: 999999; width: 260px;
                background-color: #36393f !important;
                border: 2px solid #3e4147 !important;
                border-radius: 4px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.8);
                font-family: Verdana, Arial, sans-serif;
                color: white !important;
                touch-action: none;
            }
            #tcm-ranking-header {
                background-color: #202225 !important;
                color: #ffffdf !important;
                padding: 8px; font-weight: bold; font-size: 12px;
                border-bottom: 2px solid #3e4147 !important;
                cursor: move; user-select: none;
                display: flex; justify-content: space-between; align-items: center;
            }
            .tcm-label {
                font-weight: bold; display: block; margin-bottom: 4px; font-size: 11px; color: #ffffdf !important;
            }
            .tcm-input {
                background-color: #32353b !important;
                color: #ffffdf !important;
                border: 1px solid #3e4147 !important;
                padding: 6px; width: 100%; box-sizing: border-box;
                margin-bottom: 10px; border-radius: 3px; outline: none;
            }
            .tcm-btn {
                background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%) !important;
                color: white !important;
                border: 1px solid #3e4147 !important;
                border-radius: 3px; cursor: pointer; padding: 6px;
                font-weight: bold; width: 100%; margin-bottom: 6px;
                text-shadow: 1px 1px 1px rgba(0,0,0,0.8);
            }
            .tcm-btn:hover { background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%) !important; }
            .tcm-btn-green {
                background-image: linear-gradient(#2ecc71 0%, #27ae60 100%) !important;
                border: 1px solid #1e8449 !important;
                font-size: 12px; padding: 8px;
            }
            .tcm-btn-green:hover { background-image: linear-gradient(#27ae60 0%, #2ecc71 100%) !important; }
            .tcm-btn-red {
                background-image: linear-gradient(#e74c3c 0%, #c0392b 100%) !important;
                border: 1px solid #922b21 !important;
                font-size: 10px;
            }
            .tcm-btn-red:hover { background-image: linear-gradient(#c0392b 0%, #e74c3c 100%) !important; }
            #tcm-pin-btn {
                cursor: pointer; font-size: 14px; padding: 2px 5px;
                background: rgba(0,0,0,0.2); border-radius: 3px; border: 1px solid transparent;
            }
            #tcm-pin-btn:active { background: rgba(0,0,0,0.5); }
        `;
        document.head.appendChild(style);
    }

    function injectUI() {
        if (document.getElementById('tcm-ranking-ui')) return;
        if (!window.location.href.includes('screen=ranking') || !window.location.href.includes('mode=in_a_day')) return;

        injectStyles();

        const savedTribes = localStorage.getItem('TCM_Saved_Tribes') || '';
        const savedLimit = localStorage.getItem('TCM_Saved_Limit') || '1200';
        const savedType = localStorage.getItem('TCM_Saved_Type') || 'scavenge';
        let savedPos = JSON.parse(localStorage.getItem('TCM_Ranking_Pos'));

        const ui = document.createElement('div');
        ui.id = 'tcm-ranking-ui';
        
        // Zabezpieczenie przed przeskakiwaniem (obliczanie precyzyjnego pozycjonowania od razu)
        let initialTop = savedPos ? savedPos.top : '50px';
        let initialLeft = savedPos ? savedPos.left : ((window.innerWidth / 2) - 130) + 'px';
        
        ui.style.top = initialTop;
        ui.style.left = initialLeft;
        
        ui.innerHTML = `
            <div id="tcm-ranking-header">
                <span>Ranking Zbiorczy</span>
                <span id="tcm-pin-btn" style="opacity:${savedPos ? '1' : '0.4'};" title="Przypnij">📌</span>
            </div>
            <div style="padding: 10px;">
                <label class="tcm-label">Typ rankingu:</label>
                <select id="tcm-type-select" class="tcm-input">
                    <option value="scavenge" ${savedType === 'scavenge' ? 'selected' : ''}>Zbieractwo</option>
                    <option value="loot_res" ${savedType === 'loot_res' ? 'selected' : ''}>Farma (Zrabowane)</option>
                </select>
                
                <label class="tcm-label">Tagi plemion:</label>
                <input type="text" id="tcm-ally-input" class="tcm-input" value="${savedTribes}" placeholder="np. ABC XYZ">
                
                <label class="tcm-label">Limit pozycji:</label>
                <input type="number" id="tcm-limit-input" class="tcm-input" value="${savedLimit}">
                
                <button id="tcm-generate-btn" class="tcm-btn tcm-btn-green">Generuj Ranking</button>
                <button id="tcm-reset-btn" class="tcm-btn tcm-btn-red">Resetuj Historię</button>
                
                <div style="background:#202225; border: 1px solid #3e4147; width:100%; height:12px; margin-top:8px; border-radius:3px; overflow:hidden;">
                    <div id="tcm-progress" style="width:0%; height:100%; background: linear-gradient(90deg, #2ecc71, #27ae60); transition: width 0.2s;"></div>
                </div>
                
                <textarea id="tcm-ranking-output" class="tcm-input" style="height:120px; margin-top:10px; display:none; resize:none;"></textarea>
                <button id="tcm-copy-btn" class="tcm-btn" style="display:none; background-image: linear-gradient(#3498db 0%, #2980b9 100%) !important;">Kopiuj do schowka</button>
            </div>
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
        const handle = document.getElementById('tcm-ranking-header');
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
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Blokuje scrollowanie strony na telefonie
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
                pinBtn.style.border = '1px solid transparent';
            } else {
                localStorage.setItem('TCM_Ranking_Pos', JSON.stringify({top: ui.style.top, left: ui.style.left}));
                pinBtn.style.opacity = '1';
                pinBtn.style.border = '1px solid #2ecc71';
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
                if (!res.ok) throw new Error("Network error");
                
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
                        i = totalSteps;
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
                console.warn("Wystąpił błąd:", e);
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
