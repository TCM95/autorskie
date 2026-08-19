// ==UserScript==
// @name         Analiza Raportów Plemiona
// @namespace    https://viayoo.com/
// @version      2.9
// @description  Analiza raportów ataków - działanie tylko w ataku, inteligentny zapis nowszych danych
// @author       TCM
// @match        *://*.plemiona.pl/game.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function($) {
    'use strict';

    if (typeof $ === 'undefined') return;

    // --- STYLIZACJA UI ---
    const addStyles = () => {
        if ($('#tcm_custom_styles').length) return;
        const style = document.createElement('style');
        style.id = 'tcm_custom_styles';
        style.innerHTML = `
            :root {
                --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225;
                --border-color: #3e4147; --text-color: white; --title-color: #ffffdf;
                --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
                --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            }
            #tcm_notes_panel { background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); font-family: Verdana, Arial, sans-serif; margin-bottom: 20px; border-radius: 4px; overflow: hidden; }
            #tcm_notes_panel h3 { background: var(--bg-header); color: var(--title-color); border-bottom: 1px solid var(--border-color); margin: 0; padding: 10px; font-size: 13px; }
            #tcm_notes_panel table { width: 100%; border-collapse: collapse; }
            #tcm_notes_panel th { background-color: var(--bg-header) !important; background-image: none !important; color: var(--title-color) !important; padding: 8px 4px; border: 1px solid var(--border-color); text-align: center; font-size: 11px; }
            #tcm_notes_panel td { padding: 8px 4px; border: 1px solid var(--border-color); text-align: center; font-size: 11px; vertical-align: middle; }
            
            .tcm-row { background: var(--bg-main); }
            .tcm-row:nth-child(even) { background: var(--bg-row-alt); }
            
            .tcm-player-header { background: #2f3136 !important; cursor: pointer; transition: background 0.2s; }
            .tcm-player-header:hover { background: #3b3e45 !important; }
            .tcm-player-header td { text-align: left !important; font-weight: bold; font-size: 12px; color: #e2e2e2; }
            
            .tcm-btn { background: var(--btn-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; }
            .tcm-btn:hover:not(:disabled) { background: var(--btn-hover); color: white; }
            .tcm-btn:disabled { opacity: 0.7; cursor: not-allowed; }
            .tcm-input { background: #2f3136; color: white; border: 1px solid #4e5157; padding: 4px; border-radius: 3px; font-size: 11px; }
            .tcm-link { color: #87ceeb; text-decoration: none; font-weight: bold; }
            .tcm-link:hover { text-decoration: underline; color: #b0e0e6; }
            
            .tcm-army-header { font-size: 10px; font-weight: bold; color: #ccc; margin-bottom: 5px; display: flex; justify-content: center; align-items: center; gap: 5px; }
            .tcm-sim-link { text-decoration: none; font-size: 14px; filter: grayscale(20%); transition: transform 0.2s; }
            .tcm-sim-link:hover { transform: scale(1.2); filter: grayscale(0%); }
            
            .tcm-unit-container { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; align-items: center; }
            .tcm-unit-item { display: inline-flex; align-items: center; background: #2a2c30; padding: 3px 5px; border-radius: 4px; border: 1px solid #5865f2; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); font-size: 11px; font-weight: bold; color: #fff; }
            .tcm-unit-item img { width: 16px; height: 16px; margin-right: 4px; }
            .tcm-text-none { color: #888; font-style: italic; font-weight: bold; }
            .tcm-text-missing { color: #666; font-style: italic; }
            
            .tcm-toolbar { padding: 8px 10px; font-size: 11px; background: var(--bg-row-alt); border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 15px; align-items: center; justify-content: space-between; }
            .tcm-toolbar-group { display: flex; gap: 10px; align-items: center; }
            .tcm-ally-box { padding: 8px 10px; background: #2a2c30; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 11px; }
            .tcm-ally-item { display: inline-flex; align-items: center; gap: 4px; background: #202225; padding: 2px 6px; border-radius: 3px; border: 1px solid #3e4147; }
        `;
        document.head.appendChild(style);
    };

    const urlParams = new URLSearchParams(window.location.search);
    const screen = urlParams.get('screen');
    const mode = urlParams.get('mode');

    async function getLoyaltyRegen() {
        let cached = localStorage.getItem('tcm_loyalty_regen');
        if (cached) return parseFloat(cached);
        try {
            const response = await fetch('/interface.php?func=get_config');
            const str = await response.text();
            const data = new window.DOMParser().parseFromString(str, "text/xml");
            const agreeSpeed = parseFloat(data.querySelector("agree speed").textContent);
            localStorage.setItem('tcm_loyalty_regen', agreeSpeed);
            return agreeSpeed;
        } catch (e) { return 1; }
    }

    // Uruchom główny moduł TYLKO na karcie "Ataki"
    if (screen === 'report' && mode === 'attack') {
        addStyles();
        if (urlParams.has('view')) {
            processReport($(document), document.body.innerHTML);
        } else {
            renderScoutedVillagesPanel();
        }
    } else if (screen === 'info_village' && urlParams.has('id')) {
        getLoyaltyRegen().then(regen => displayLoyaltyInfo(regen, urlParams.get('id')));
    }

    // Ekstrakcja czasu trwania bitwy do porównań chronologicznych
    function getReportTimestamp($context) {
        const $timeCell = $context.find("td").filter(function() { return $(this).text().trim() === "Czas bitwy"; }).next("td");
        if ($timeCell.length) {
            const timeText = $timeCell.text().trim();
            const dateTimeMatch = timeText.match(/(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2}:\d{2})/);
            if (dateTimeMatch) {
                return Date.parse(`20${dateTimeMatch[3]}-${dateTimeMatch[2]}-${dateTimeMatch[1]}T${dateTimeMatch[4]}`);
            }
        }
        return Date.now(); 
    }

    function processReport($context, htmlString) {
        const battleTimestamp = getReportTimestamp($context);
        saveLoyaltyFromReport($context, htmlString, battleTimestamp);
        return extractAndSaveReportData($context, battleTimestamp);
    }

    function saveLoyaltyFromReport($context, htmlString, battleTimestamp) {
        const loyaltyMatch = htmlString.match(/Spadek z\s*<b>\d+<\/b>\s*do\s*<b>(\d+)<\/b>/);
        if (loyaltyMatch) {
            const finalLoyalty = parseInt(loyaltyMatch[1], 10);
            const $defenderSpan = $context.find('#attack_info_def .village_anchor');
            if (!$defenderSpan.length) return;
            const targetId = $defenderSpan.attr('data-id');

            // Weryfikacja chronologii
            const savedPop = localStorage.getItem('tcm_loyalty_' + targetId);
            if (savedPop) {
                const pData = JSON.parse(savedPop);
                if (pData.timestamp && pData.timestamp > battleTimestamp) {
                    return; // Raport jest starszy niż to co mamy w bazie, odrzucamy zapis
                }
            }

            const dataToSave = { loyalty: finalLoyalty, timestamp: battleTimestamp };
            localStorage.setItem('tcm_loyalty_' + targetId, JSON.stringify(dataToSave));
        }
    }

    function parseTroopsTable($table) {
        if (!$table || !$table.length) return null;
        let units = [];
        $table.find('tr.center td a.unit_link').each(function() {
            let uName = $(this).attr('data-unit');
            if (uName) units.push(uName);
        });

        if (units.length === 0) return null;
        const $qtyRow = $table.find('tr').filter(function() { return $(this).find('td:first').text().includes('Ilość:'); });
        const $lossRow = $table.find('tr').filter(function() { return $(this).find('td:first').text().includes('Straty:'); });

        if (!$qtyRow.length) return null;

        let totalPop = 0, unitCounts = {}, hasAnyTroops = false;
        const popSpaces = { spear:1, sword:1, axe:1, archer:1, spy:2, light:4, marcher:5, heavy:6, ram:5, catapult:8, knight:10, snob:100 };

        $qtyRow.find('td[data-unit-count]').each(function(i) {
            let qty = parseInt($(this).attr('data-unit-count')) || 0;
            let loss = 0;
            if ($lossRow.length) {
                let $lossTd = $lossRow.find('td[data-unit-count]').eq(i);
                if ($lossTd.length) loss = parseInt($lossTd.attr('data-unit-count')) || 0;
            }
            let survivors = qty - loss;
            let unit = units[i];

            if (unit && survivors > 0) {
                hasAnyTroops = true; unitCounts[unit] = survivors; totalPop += (popSpaces[unit] || 1) * survivors;
            }
        });
        return { hasTroops: hasAnyTroops, units: unitCounts, totalPop: totalPop };
    }

    function extractAndSaveReportData($context, battleTimestamp) {
        const myName = window.game_data.player.name;
        const $attackerLink = $context.find('#attack_info_att tr:contains("Agresor:")').find('a');
        if (!$attackerLink.length || $attackerLink.text().trim() !== myName) return false;

        const $defenderSpan = $context.find('#attack_info_def .village_anchor');
        if (!$defenderSpan.length) return false;

        const targetId = $defenderSpan.attr('data-id');
        
        let db = JSON.parse(localStorage.getItem('tcm_scouted_villages') || '{}');
        let existing = db[targetId] || {};

        // Weryfikacja chronologii
        if (existing.timestamp && existing.timestamp > battleTimestamp) {
            return false; // Raport jest starszy niż wpis w bazie, nie nadpisujemy
        }

        const villageText = $defenderSpan.text().trim();
        const coordsMatch = villageText.match(/\((\d+)\|(\d+)\)/);
        const coords = coordsMatch ? coordsMatch[0] : "Nieznane";
        const vName = villageText.split('(')[0].trim();

        let playerName = "Barbarzyńska", playerId = "0";
        const $playerLink = $context.find('#attack_info_def a[href*="screen=info_player"]');
        if ($playerLink.length) {
            playerName = $playerLink.text().trim();
            let linkParams = new URLSearchParams($playerLink.attr('href').split('?')[1] || '');
            playerId = linkParams.get('id') || "0";
        }

        let insideData = parseTroopsTable($context.find('#attack_info_def_units'));
        let $outsideHeader = $context.find("th:contains('Wojska poza wioską'), th:contains('Wojska w drodze')");
        let outsideData = null, outsideStatus = "missing"; 

        if ($outsideHeader.length) {
            let $outsideTable = $outsideHeader.closest('table');
            outsideData = parseTroopsTable($outsideTable);
            outsideStatus = (outsideData && outsideData.hasTroops) ? "present" : "none";
        }

        db[targetId] = {
            id: targetId, coords: coords, vName: vName, playerName: playerName, playerId: playerId,
            inside: insideData || existing.inside || null,
            outside: outsideData || existing.outside || null,
            outsideStatus: outsideStatus !== "missing" ? outsideStatus : (existing.outsideStatus || "missing"),
            timestamp: battleTimestamp, // Zapamiętujemy dokładny czas dla logiki nadpisywania
            updatedAt: new Date().toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})
        };
        localStorage.setItem('tcm_scouted_villages', JSON.stringify(db));
        return true;
    }

    // --- POBIERANIE DANYCH ŚWIATA (Biblioteka Hermitowskiego) ---
    async function getWorldData() {
        if (typeof window.get_world_info === 'function') {
            return await window.get_world_info({
                configs: [],
                entities: {
                    'ally': ['id', 'name', 'tag'],
                    'player': ['id', 'name', 'ally_id'],
                    'village': ['id', 'player_id']
                }
            });
        }
        return null;
    }

    // --- LOGIKA IMPORTOWANIA W TLE ---
    async function runBackgroundImport($btn) {
        let reportLinks = $('#report_list a[href*="view="]').filter(function() {
            // Zabezpieczenie by importować tylko właściwe linki
            let href = $(this).attr('href');
            return href.includes('screen=report'); 
        }).map(function() { return $(this).attr('href'); }).get();

        reportLinks = [...new Set(reportLinks)];

        if (reportLinks.length === 0) {
            alert("Nie znaleziono linków do raportów na tej stronie!");
            return;
        }

        if (!confirm(`Znaleziono ${reportLinks.length} raportów. Pobieranie zajmie około ${reportLinks.length * 2} sekund. Rozpocząć?`)) return;

        $btn.text('Weryfikacja świata...');
        $btn.prop('disabled', true);
        $btn.css('background', 'linear-gradient(#b08d00 0%, #8a6c00 100%)');

        const ignoredAllies = JSON.parse(localStorage.getItem('tcm_ignored_allies') || '[]');
        const worldData = await getWorldData();

        let processed = 0, added = 0, skipped = 0;

        for (let url of reportLinks) {
            try {
                const response = await fetch(url);
                const htmlString = await response.text();
                const $doc = $($.parseHTML(htmlString));

                const $defenderSpan = $doc.find('#attack_info_def .village_anchor');
                let shouldSkip = false;

                if ($defenderSpan.length && worldData && worldData.village) {
                    const targetId = $defenderSpan.attr('data-id');
                    const currentVillage = worldData.village[targetId];

                    if (currentVillage) {
                        const currentPlayerId = String(currentVillage.player_id);
                        const myPlayerId = String(window.game_data.player.id);
                        const currentPlayer = worldData.player ? worldData.player[currentPlayerId] : null;

                        if (currentPlayerId === myPlayerId) {
                            shouldSkip = true;
                        } else if (currentPlayer && currentPlayer.ally_id) {
                            if (ignoredAllies.includes(String(currentPlayer.ally_id))) {
                                shouldSkip = true;
                            }
                        }
                    }
                }

                if (shouldSkip) {
                    skipped++;
                } else {
                    let success = processReport($doc, htmlString);
                    if (success) added++;
                    else skipped++; // Może zostać odrzucony jako starszy raport dzięki nowej logice
                }
            } catch (e) { console.error("Błąd importu raportu: " + url); }
            
            processed++;
            $btn.text(`Importuję: ${processed} / ${reportLinks.length}`);
            
            if (processed < reportLinks.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        $btn.text(`Gotowe! Zaktualizowano ${added} (Pominięto starych/odrzuconych ${skipped})`);
        $btn.css('background', 'var(--btn-bg)');
        setTimeout(() => location.reload(), 1500);
    }

    function renderTroopsHtml(armyData, status) {
        if (status === "missing" || (!armyData && !status)) return `<span class="tcm-text-missing">brak info</span>`;
        if (status === "none" || (armyData && !armyData.hasTroops)) return `<span class="tcm-text-none">brak</span>`;
        if (!armyData || !armyData.units) return `<span class="tcm-text-none">brak</span>`;

        let simParams = [];
        let html = `<div class="tcm-army-header">Populacja (${armyData.totalPop.toLocaleString('pl-PL')})`;

        for (const [unit, count] of Object.entries(armyData.units)) {
            simParams.push(`def_${unit}=${count}`);
        }
        
        let simUrl = `/game.php?screen=place&mode=sim&${simParams.join('&')}`;
        html += ` <a href="${simUrl}" target="_blank" class="tcm-sim-link" title="Wrzuć do symulatora">⚔️</a></div>`;
        html += `<div class="tcm-unit-container">`;
        
        for (const [unit, count] of Object.entries(armyData.units)) {
            html += `<div class="tcm-unit-item"><img src="/graphic/unit/unit_${unit}.png" alt="${unit}" /><span>${count.toLocaleString('pl-PL')}</span></div>`;
        }
        html += `</div>`;
        return html;
    }

    async function renderScoutedVillagesPanel() {
        const REGEN_SPEED = await getLoyaltyRegen();
        let db = JSON.parse(localStorage.getItem('tcm_scouted_villages') || '{}');
        let villages = Object.values(db);
        const isMinimized = localStorage.getItem('tcm_panel_minimized') === 'true';

        let playersMap = {};
        villages.forEach(v => {
            let pName = v.playerName || "Barbarzyńska";
            if (!playersMap[pName]) playersMap[pName] = [];
            playersMap[pName].push(v);
        });
        
        let playerNames = Object.keys(playersMap).sort((a,b) => a.localeCompare(b));
        let playerOptionsHtml = playerNames.map(name => `<option value="${encodeURIComponent(name)}">${name} (${playersMap[name].length} wiosek)</option>`).join('');

        let html = `
            <div id="tcm_notes_panel">
                <h3 id="tcm_toggle_panel" style="cursor:pointer; display: flex; justify-content: space-between; align-items: center;">
                    <span>📊 Analiza Raportów Ataków <span id="tcm_toggle_icon" style="margin-left:5px;">${isMinimized ? '[+]' : '[-]'}</span></span>
                    <button id="clear_tcm_notes" class="tcm-btn" style="background: linear-gradient(#b30000 0%, #800000 100%); border-color: #ff3333;" type="button">Wyczyść bazę</button>
                </h3>
                <div id="tcm_panel_content" style="${isMinimized ? 'display:none;' : ''}">
                    <div id="tcm_ally_container" class="tcm-ally-box">
                        <b>Ignorowane plemiona przy imporcie:</b> <span id="tcm_ally_loading" style="color:#aaa;">Ładowanie listy...</span>
                    </div>
                    <div class="tcm-toolbar">
                        <div class="tcm-toolbar-group">
                            <b>Gracz:</b> 
                            <select id="tcm_player_select" class="tcm-input">
                                <option value="ALL">▶ Wszyscy (Zgrupowani)</option>
                                ${playerOptionsHtml}
                            </select>
                        </div>
                        <div class="tcm-toolbar-group" style="border-left: 1px solid var(--border-color); padding-left: 15px;">
                            <b>Sortuj od:</b>
                            <select id="tcm_sort_type" class="tcm-input">
                                <option value="current">Bieżącej (${window.game_data.village.coord})</option>
                                <option value="custom">Własnych</option>
                            </select>
                            <input type="text" id="tcm_sort_coords" class="tcm-input" placeholder="np. 500|500" style="display:none; width:65px;">
                            <button id="tcm_btn_sort" class="tcm-btn" type="button">Posortuj wszystko</button>
                        </div>
                        <div class="tcm-toolbar-group" style="border-left: 1px solid var(--border-color); padding-left: 15px;">
                            <button id="tcm_btn_import" class="tcm-btn" style="background: linear-gradient(#2e7d32 0%, #1b5e20 100%); border-color: #4caf50;" type="button">📥 Importuj z tej strony</button>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%;">Gracz</th>
                                <th style="width: 15%;">Wioska</th>
                                <th style="width: 30%;">W wiosce</th>
                                <th style="width: 30%;">Poza wioską</th>
                                <th style="width: 10%;">Poparcie</th>
                            </tr>
                        </thead>
                        <tbody id="tcm_villages_tbody">
        `;

        if (villages.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Brak zapisanych raportów.</td></tr>`;
        } else {
            for (const [pName, pVillages] of Object.entries(playersMap)) {
                let safePlayerName = encodeURIComponent(pName);
                html += `
                    <tr class="tcm-player-header" data-player="${safePlayerName}">
                        <td colspan="5">
                            <span class="tcm-group-icon">▶</span> ${pName} <span style="font-weight:normal; color:#aaa;">(${pVillages.length} wiosek)</span>
                        </td>
                    </tr>
                `;
                pVillages.forEach(v => {
                    let currentLoyalty = 100;
                    const savedPop = localStorage.getItem('tcm_loyalty_' + v.id) || localStorage.getItem('etykiety_poparcie_' + v.id);
                    if (savedPop) {
                        const pData = JSON.parse(savedPop);
                        const hours = (Date.now() - pData.timestamp) / (1000 * 60 * 60);
                        currentLoyalty = Math.min(100, pData.loyalty + Math.floor(hours * REGEN_SPEED));
                    }
                    let popColor = "#4caf50"; if (currentLoyalty < 50) popColor = "#f44336"; else if (currentLoyalty < 100) popColor = "#ff9800";
                    const playerLink = v.playerId !== "0" ? `<a href="/game.php?screen=info_player&id=${v.playerId}" class="tcm-link">${v.playerName}</a>` : `<span style="color:#aaa;">Barbarzyńska</span>`;

                    html += `
                        <tr class="tcm-row tcm-village-row" data-player="${safePlayerName}" data-coords="${v.coords}" style="display:none;">
                            <td>${playerLink}</td>
                            <td style="text-align:center;"><a href="/game.php?screen=info_village&id=${v.id}" class="tcm-link" style="font-size:12px;">${v.vName}<br>${v.coords}</a></td>
                            <td>${renderTroopsHtml(v.inside, v.inside && !v.inside.hasTroops ? "none" : "present")}</td>
                            <td>${renderTroopsHtml(v.outside, v.outsideStatus || "missing")}</td>
                            <td><b style="color:${popColor}; font-size:13px;">${currentLoyalty}</b></td>
                        </tr>
                    `;
                });
            }
        }
        html += `</tbody></table></div></div>`;
        const $reportForm = $('#report_list');
        if ($reportForm.length) $reportForm.before(html); else $('.vis:first').before(html);

        getWorldData().then(worldData => {
            if (worldData && worldData.ally) {
                const ignoredAllies = JSON.parse(localStorage.getItem('tcm_ignored_allies') || '[]');
                let allyHtml = '<b>Ignorowane plemiona przy imporcie:</b> ';
                Object.values(worldData.ally).forEach(ally => {
                    const isChecked = ignoredAllies.includes(String(ally.id)) ? 'checked' : '';
                    allyHtml += `
                        <label class="tcm-ally-item">
                            <input type="checkbox" class="tcm-ally-checkbox" value="${ally.id}" ${isChecked}>
                            <span>[${ally.tag}] ${ally.name}</span>
                        </label>
                    `;
                });
                $('#tcm_ally_container').html(allyHtml);

                $('.tcm-ally-checkbox').on('change', function() {
                    let selected = [];
                    $('.tcm-ally-checkbox:checked').each(function() {
                        selected.push($(this).val());
                    });
                    localStorage.setItem('tcm_ignored_allies', JSON.stringify(selected));
                });
            } else {
                $('#tcm_ally_container').hide();
            }
        });

        $('#tcm_btn_import').on('click', function(e) {
            e.preventDefault();
            runBackgroundImport($(this));
        });

        $('#tcm_toggle_panel').on('click', function(e) {
            if (e.target.id === 'clear_tcm_notes') return;
            const $content = $('#tcm_panel_content');
            if ($content.is(':visible')) {
                $content.slideUp(150); $('#tcm_toggle_icon').text('[+]'); localStorage.setItem('tcm_panel_minimized', 'true');
            } else {
                $content.slideDown(150); $('#tcm_toggle_icon').text('[-]'); localStorage.setItem('tcm_panel_minimized', 'false');
            }
        });

        $('.tcm-player-header').on('click', function() {
            let pName = $(this).attr('data-player');
            let $rows = $(`.tcm-village-row[data-player="${pName}"]`);
            let $icon = $(this).find('.tcm-group-icon');
            if ($rows.is(':visible')) { $rows.hide(); $icon.text('▶'); } else { $rows.show(); $icon.text('▼'); }
        });

        $('#tcm_player_select').on('change', function() {
            let selected = $(this).val();
            if (selected === 'ALL') {
                $('.tcm-player-header').show(); $('.tcm-village-row').hide(); $('.tcm-group-icon').text('▶');
            } else {
                $('.tcm-player-header').hide(); $('.tcm-village-row').hide();
                $(`.tcm-village-row[data-player="${selected}"]`).show();
            }
        });

        $('#tcm_sort_type').on('change', function() {
            if ($(this).val() === 'custom') $('#tcm_sort_coords').show(); else $('#tcm_sort_coords').hide();
        });

        // W pełni zaizolowane zdarzenie click na przycisku sortowania (bez reloadu strony)
        $('#tcm_btn_sort').on('click', function(e) {
            e.preventDefault();

            let centerStr = $('#tcm_sort_type').val() === 'current' ? window.game_data.village.coord : $('#tcm_sort_coords').val();
            let coordsMatch = centerStr.match(/(\d{1,3})\|(\d{1,3})/);
            if (!coordsMatch) return alert("Wprowadzono błędne koordynaty!");

            let cx = parseInt(coordsMatch[1], 10), cy = parseInt(coordsMatch[2], 10);
            let $tbody = $('#tcm_villages_tbody');
            let rows = $tbody.find('tr.tcm-village-row').get();

            rows.sort(function(a, b) {
                let cA = $(a).attr('data-coords').split('|').map(Number);
                let cB = $(b).attr('data-coords').split('|').map(Number);
                return (Math.pow(cA[0] - cx, 2) + Math.pow(cA[1] - cy, 2)) - (Math.pow(cB[0] - cx, 2) + Math.pow(cB[1] - cy, 2));
            });

            $('#tcm_player_select').val('ALL'); 
            $('.tcm-player-header').hide();
            
            $.each(rows, function(index, row) { 
                $(row).show(); 
                $tbody.append(row); 
            });
        });

        $('#clear_tcm_notes').on('click', function(e) {
            e.preventDefault();
            if (confirm("Czy na pewno chcesz wyczyścić listę?")) {
                localStorage.removeItem('tcm_scouted_villages'); location.reload();
            }
        });
    }

    function displayLoyaltyInfo(regenPerHour, targetId) {
        const $pointsRow = $("td").filter(function() { return $(this).text().trim() === "Punkty:"; }).closest('tr');
        if (!$pointsRow.length) return;
        $pointsRow.parent().find('.etykiety-poparcie-row').remove();

        const savedData = localStorage.getItem('tcm_loyalty_' + targetId) || localStorage.getItem('etykiety_poparcie_' + targetId);
        if (savedData) {
            const data = JSON.parse(savedData);
            const hoursElapsed = (Date.now() - data.timestamp) / (1000 * 60 * 60);
            const currentLoyalty = Math.min(100, data.loyalty + Math.max(0, Math.floor(hoursElapsed * regenPerHour)));
            
            let color = "#4caf50"; if (currentLoyalty < 50) color = "#f44336"; else if (currentLoyalty < 100) color = "#ff9800";
            const timeString = new Date(data.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            $pointsRow.after(`<tr class="etykiety-poparcie-row"><td>Poparcie:</td><td><b style="color:${color}">${currentLoyalty}</b> <span style="font-size:9px; color:#aaa;">(bitwa o ${timeString})</span></td></tr>`);
        }
    }
})(window.jQuery);
