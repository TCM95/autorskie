// ==UserScript==
// @name         profil
// @author       TCM
// @namespace    https://viayoo.com/
// @description  Pokonani przeciwnicy oraz daty przejęć wiosek (TWStats)
// @match        *://*.plemiona.pl/game.php?*screen=info_player*
// @match        *://*.plemiona.pl/game.php?*screen=info_village*
// @grant        GM_xmlhttpRequest
// @connect      twstats.com
// ==/UserScript==

(function() {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    const world = game_data.world;

    function getRelativeTime(dateString) {
        if (!dateString || dateString === "-") return "-";
        const conquerDate = new Date(dateString.replace(' ', 'T'));
        const now = new Date();
        conquerDate.setHours(0, 0, 0, 0);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffTime = today - conquerDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "dzisiaj";
        if (diffDays === 1) return "wczoraj";
        return `${diffDays} dni temu`;
    }

    if (screen === 'info_player') {
        const playerId = params.get('id') || game_data.player.id;
        const twStatsUrl = `https://pl.twstats.com/${world}/index.php?page=player&id=${playerId}`;
        const twStatsConquersUrl = `https://pl.twstats.com/${world}/index.php?page=player&mode=conquers&id=${playerId}&pn=-1`;

        // 1. ZBIERANIE DAT PRZEJĘĆ
        GM_xmlhttpRequest({
            method: "GET",
            url: twStatsConquersUrl,
            onload: function(res) {
                if (res.status === 200) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(res.responseText, "text/html");
                    const widget = doc.querySelector('.widget');
                    const datesMap = new Map();
                    
                    if (widget) {
                        const rows = widget.querySelectorAll('tr.r1, tr.r2');
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('td');
                            if (cells.length >= 6) {
                                const villageLink = cells[1].querySelector('a');
                                if (villageLink) {
                                    const vIdMatch = villageLink.href.match(/id=(\d+)/);
                                    if (vIdMatch) {
                                        const dateText = cells[5].innerText.trim();
                                        if(!datesMap.has(vIdMatch[1])) datesMap.set(vIdMatch[1], getRelativeTime(dateText));
                                    }
                                }
                            }
                        });
                    }

                    const tagVillages = () => {
                        const villageTable = document.getElementById('villages_list') || document.querySelector('table.vis[width="100%"]');
                        if (villageTable) {
                            const gameRows = villageTable.querySelectorAll('tbody tr');
                            gameRows.forEach((tr) => {
                                const link = tr.querySelector('a[href*="screen=info_village"]');
                                if (link && !link.parentNode.querySelector('.tcm-date-span')) {
                                    const vIdParam = new URLSearchParams(link.search).get('id');
                                    let dateAdded = datesMap.has(vIdParam) ? datesMap.get(vIdParam) : "pierwsza wioska";
                                    
                                    const span = document.createElement('span');
                                    span.className = 'tcm-date-span';
                                    span.innerText = ` (${dateAdded})`;
                                    span.style.fontSize = "10px";
                                    span.style.color = "#888";
                                    span.style.marginLeft = "4px";
                                    span.style.whiteSpace = "nowrap";
                                    link.parentNode.appendChild(span);
                                }
                            });
                        }
                    };

                    tagVillages();

                    const villageListBody = document.querySelector('#villages_list tbody');
                    if (villageListBody) {
                        const observer = new MutationObserver(() => tagVillages());
                        observer.observe(villageListBody, { childList: true });
                    }
                }
            }
        });

        // 2. POKONANI Z TW STATS
        GM_xmlhttpRequest({
            method: "GET",
            url: twStatsUrl,
            onload: function(response) {
                if (response.status === 200) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, "text/html");
                    const profileTable = doc.querySelector('.box.profile');

                    let odaText = "B/D", oddText = "B/D";

                    if (profileTable) {
                        const rows = profileTable.querySelectorAll('tr');
                        rows.forEach(row => {
                            const th = row.querySelector('th');
                            const td = row.querySelector('td');
                            if (th && td) {
                                const label = th.innerText.trim();
                                if (label.includes("agresor")) odaText = td.innerText.trim().replace(/\n/g, ' ');
                                else if (label.includes("obrońca")) oddText = td.innerText.trim().replace(/\n/g, ' ').replace("obroÅ„cy", "obrońca");
                            }
                        });
                    }

                    const playerInfoTable = document.getElementById('player_info');
                    if (playerInfoTable) {
                        const targetRow = Array.from(playerInfoTable.querySelectorAll('tr')).find(tr => tr.innerText.includes('Pokonani przeciwnicy'));
                        if (targetRow && !document.getElementById('tcm_injected_stats')) {
                            const newRowsHtml = `
                                <tr id="tcm_injected_stats"><td>Pokonani (Agresor):</td><td><b>${odaText}</b></td></tr>
                                <tr><td>Pokonani (Obrońca):</td><td><b>${oddText}</b></td></tr>
                            `;
                            targetRow.insertAdjacentHTML('afterend', newRowsHtml);
                        }
                    }
                }
            }
        });

    // 3. INFORMACJE O POJEDYNCZEJ WIOSCE
    } else if (screen === 'info_village') {
        if (document.getElementById('tcm-village-conquer')) return;

        const villageId = params.get('id');
        if(!villageId) return;
        const twStatsUrl = `https://pl.twstats.com/${world}/index.php?page=village&id=${villageId}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: twStatsUrl,
            onload: function(res) {
                if (res.status === 200) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(res.responseText, "text/html");
                    
                    let lastDate = "pierwsza wioska";
                    
                    const profileBox = doc.querySelector('.box.profile');
                    if (profileBox) {
                        const rows = profileBox.querySelectorAll('tr');
                        for (let row of rows) {
                            const th = row.querySelector('th');
                            const td = row.querySelector('td');
                            if (th && td && th.textContent.includes('Ostatnie przejęcie:')) {
                                lastDate = td.textContent.trim();
                                break;
                            }
                        }
                    }

                    const infoTables = document.querySelectorAll('table.vis');
                    let targetTableBody = null;
                    
                    for (let table of infoTables) {
                        if (table.textContent.includes('Punkty:') || table.textContent.includes('Współrzędne:')) {
                            targetTableBody = table.querySelector('tbody') || table;
                            break;
                        }
                    }
                                      
                    if (targetTableBody && !document.getElementById('tcm-village-conquer')) {
                        const tr = document.createElement('tr');
                        tr.id = 'tcm-village-conquer';
                        tr.innerHTML = `<td>Przejęcie:</td><td><b>${lastDate}</b></td>`;
                        targetTableBody.appendChild(tr);
                    }
                }
            }
        });
    }
})();
