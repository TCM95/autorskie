// ==UserScript==
// @name         MAPA-KORDY-HYBRYDA
// @namespace    https://viayoo.com/
// @version      3.3
// @description  Skanowanie mapy: obszar W x H pól (podgląd na minimapie) / cały świat, ręczne dodawanie kliknięciem, format listy
// @author       TCM
// @match        *.plemiona.pl/game.php?*screen=map*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_TAGS = "tcm_v5_tags";
    const STORAGE_PLAYERS = "tcm_v5_players";
    const STORAGE_PTS = "tcm_v5_pts";
    const STORAGE_LIST = "tcm_v5_coords";
    const STORAGE_W = "tcm_v5_area_w";
    const STORAGE_H = "tcm_v5_area_h";
    const STORAGE_FORMAT = "tcm_v5_format";
    const SCALE = 5; // px na pole na minimapie

    let set = new Set(JSON.parse(localStorage.getItem(STORAGE_LIST) || "[]"));
    const cleanPoints = (pts) => parseInt(String(pts).replace(/\./g, '')) || 0;
    const saveSet = () => localStorage.setItem(STORAGE_LIST, JSON.stringify([...set]));
    const safeDecode = (s) => {
        try { return decodeURIComponent(String(s).replace(/\+/g, '%20')).toLowerCase(); }
        catch (e) { return String(s).toLowerCase(); }
    };

    function injectStyles() {
        if (document.getElementById('tcm-map-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-map-styles';
        style.innerHTML = `
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
            #tcm_ui {
                position: fixed; z-index: 999999; width: 270px;
                background-color: var(--bg-main) !important;
                border: 2px solid var(--border-color) !important;
                border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.8);
                font-family: Verdana, Arial, sans-serif;
                color: var(--text-color) !important; touch-action: none; top: 80px; left: 10px;
            }
            #tcm-drag-handle {
                background-color: var(--bg-header) !important;
                color: var(--title-color) !important;
                padding: 10px; font-weight: bold; font-size: 12px;
                border-bottom: 2px solid var(--border-color) !important;
                user-select: none; display: flex; justify-content: space-between; align-items: center;
            }
            .tcm-input {
                background-color: var(--bg-row-alt) !important;
                color: var(--title-color) !important;
                border: 1px solid var(--border-color) !important;
                padding: 8px; width: 100%; box-sizing: border-box;
                margin-bottom: 8px; border-radius: 3px; outline: none; font-size: 11px;
            }
            .tcm-btn {
                background: var(--btn-bg) !important; color: var(--text-color) !important;
                border: 1px solid var(--border-color) !important;
                border-radius: 3px; cursor: pointer; padding: 8px;
                font-weight: bold; width: 100%; text-shadow: 1px 1px 1px rgba(0,0,0,0.8); font-size: 11px;
            }
            .tcm-btn:hover { background: var(--btn-hover) !important; }
            .tcm-btn-green { background: var(--btn-green-bg) !important; border-color: #1e8449 !important; }
            .tcm-btn-green:hover { background: var(--btn-green-hover) !important; }
            .tcm-btn-red { background: var(--btn-red-bg) !important; border-color: #922b21 !important; }
            .tcm-btn-red:hover { background: var(--btn-red-hover) !important; }
            #tcm-pin-btn { cursor: pointer; font-size: 14px; padding: 4px 8px; background: rgba(0,0,0,0.2); border-radius: 3px; border: 1px solid transparent; }
            .tcm-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 5px; cursor: pointer; }
            .tcm-checkbox-label input[type="checkbox"] { width: 18px; height: 18px; margin: 0; }
            .tcm-label { font-size: 10px; color: #aaa; margin-bottom: 3px; display: block; }
        `;
        document.head.appendChild(style);
    }

    const updateButtonText = () => {
        const btn = document.getElementById('tcm_out_btn');
        if (btn) btn.innerText = `LISTA (${set.size})`;
    };

    // ---------- Geometria minimapy i wbudowany kwadrat gry ----------
    // origin = piksel współrzędnej 0|0 w układzie rodzica kafelków
    const minimapGeom = () => {
        const mini = document.getElementById('minimap');
        if (!mini) return null;
        const tiles = mini.getElementsByTagName('img');
        for (let i = 0; i < tiles.length; i++) {
            const img = tiles[i];
            let url;
            try { url = new URL(img.src); } catch (e) { continue; }
            const tileX = parseInt(url.searchParams.get("x"));
            const tileY = parseInt(url.searchParams.get("y"));
            if (isNaN(tileX) || isNaN(tileY)) continue;
            return {
                originX: parseFloat(img.style.left) - tileX * SCALE,
                originY: parseFloat(img.style.top) - tileY * SCALE,
                parent: img.parentNode
            };
        }
        return null;
    };

    const getViewportEl = () => {
        const mini = document.getElementById('minimap');
        if (!mini) return null;
        return document.getElementById('minimap_viewport') || mini.querySelector('[id*="viewport"]');
    };

    // Naturalny rozmiar wbudowanego kwadratu (px), zmierzony zanim go zmienimy
    let vpBase = null;
    let vpFailed = false; // gdy nie da się zmienić kwadratu gry - używamy własnej ramki
    const ensureVpBase = (el) => {
        if (vpBase || el.classList.contains('tcm-vp')) return;
        const r = el.getBoundingClientRect();
        if (r.width && r.height) vpBase = { w: r.width, h: r.height };
    };

    const removeVpStyle = (el) => { if (el) el.classList.remove('tcm-vp'); };

    // Zmienia rozmiar WBUDOWANEGO kwadratu na W x H pól (środek bez zmian). Zwraca true gdy się udało.
    const applyVpStyle = (el) => {
        ensureVpBase(el);
        if (!vpBase) return false;
        const w = Math.max(1, parseInt($('#tcm_area_w').val()) || 1);
        const h = Math.max(1, parseInt($('#tcm_area_h').val()) || 1);
        const wpx = w * SCALE, hpx = h * SCALE;

        let st = document.getElementById('tcm-vp-style');
        if (!st) {
            st = document.createElement('style');
            st.id = 'tcm-vp-style';
            document.head.appendChild(st);
        }
        const css = `.tcm-vp{width:${wpx}px !important;height:${hpx}px !important;` +
            `margin-left:${(vpBase.w - wpx) / 2}px !important;margin-top:${(vpBase.h - hpx) / 2}px !important;` +
            `box-sizing:border-box !important;border:2px dashed #ffeb3b !important;background:rgba(255,235,59,0.08) !important;}`;
        if (st.textContent !== css) st.textContent = css;
        el.classList.add('tcm-vp');

        const r = el.getBoundingClientRect();
        if (Math.abs(r.width - wpx) > 3 || Math.abs(r.height - hpx) > 3) {
            removeVpStyle(el);
            vpFailed = true;
            return false;
        }
        return true;
    };

    // Wbudowany kwadrat "tu patrzysz" w koordynatach (wartości ułamkowe): {x, y, w, h}
    const getViewportRect = () => {
        const g = minimapGeom();
        if (!g) return null;
        const vp = getViewportEl();
        if (!vp) return null;
        ensureVpBase(vp);
        const r = vp.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        const pr = g.parent.getBoundingClientRect();
        const left = r.left - pr.left - g.parent.clientLeft;
        const top = r.top - pr.top - g.parent.clientTop;
        return {
            x: (left - g.originX) / SCALE,
            y: (top - g.originY) / SCALE,
            w: r.width / SCALE,
            h: r.height / SCALE
        };
    };

    // Środek = środek wbudowanego kwadratu na minimapie (fallback: TWMap.pos / własna wioska)
    const getCenterF = () => {
        const vp = getViewportRect();
        if (vp) return [vp.x + vp.w / 2, vp.y + vp.h / 2];
        if (typeof TWMap !== 'undefined' && TWMap.pos) return [TWMap.pos[0], TWMap.pos[1]];
        return [Number(game_data.village.x), Number(game_data.village.y)];
    };

    // Zwraca {x1,x2,y1,y2,w,h} - prostokąt W x H pól wokół środka kwadratu gry
    const getArea = () => {
        const w = Math.max(1, parseInt($('#tcm_area_w').val()) || 1);
        const h = Math.max(1, parseInt($('#tcm_area_h').val()) || 1);
        const [cx, cy] = getCenterF();
        const x1 = Math.round(cx - w / 2);
        const y1 = Math.round(cy - h / 2);
        return { x1, y1, x2: x1 + w - 1, y2: y1 + h - 1, w, h };
    };

    // ---------- Minimapa: zaznaczone wioski + ramka obszaru ----------
    const pinFramesToTiles = () => {
        const mini = document.getElementById('minimap');
        if (!mini) return;
        const tiles = mini.getElementsByTagName('img');
        let originX = null, originY = null, frameParent = null;

        for (let i = 0; i < tiles.length; i++) {
            const img = tiles[i];
            let url;
            try { url = new URL(img.src); } catch (e) { continue; }
            const tileX = parseInt(url.searchParams.get("x"));
            const tileY = parseInt(url.searchParams.get("y"));
            if (isNaN(tileX) || isNaN(tileY)) continue;

            if (originX === null) {
                originX = parseFloat(img.style.left) - tileX * SCALE;
                originY = parseFloat(img.style.top) - tileY * SCALE;
                frameParent = img.parentNode;
            }

            const containerId = `tcm_tile_ctx_${tileX}_${tileY}`;
            let container = document.getElementById(containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = "tcm-tile-overlay";
                container.style = `position:absolute; width:250px; height:250px; pointer-events:none; z-index:10; left:${img.style.left}; top:${img.style.top};`;
                img.parentNode.appendChild(container);
            } else {
                if (container.style.left !== img.style.left) container.style.left = img.style.left;
                if (container.style.top !== img.style.top) container.style.top = img.style.top;
            }

            let html = "";
            set.forEach(coord => {
                const [vx, vy] = coord.split('|').map(Number);
                if (vx >= tileX && vx < tileX + 50 && vy >= tileY && vy < tileY + 50) {
                    const localX = (vx - tileX) * SCALE;
                    const localY = (vy - tileY) * SCALE;
                    html += `<div style="position:absolute; width:5px; height:5px; box-sizing:border-box; background:rgba(255,0,0,0.85); border:1px solid #fff; left:${localX}px; top:${localY}px;"></div>`;
                }
            });
            if (container.innerHTML !== html) container.innerHTML = html;
        }

        // Podgląd obszaru skanowania: najpierw próbujemy zmienić rozmiar wbudowanego kwadratu gry
        let frame = document.getElementById('tcm_area_frame');
        const mode = $('input[name="tcm_mode"]:checked').val();
        const vpEl = getViewportEl();
        if (vpEl && !vpFailed) {
            if (frame) frame.style.display = 'none';
            if (mode === 'area') applyVpStyle(vpEl); else removeVpStyle(vpEl);
            if (!vpFailed) return;
        }
        if (mode !== 'area' || originX === null) {
            if (frame) frame.style.display = 'none';
            return;
        }
        if (!frame) {
            frame = document.createElement('div');
            frame.id = 'tcm_area_frame';
            frame.style = 'position:absolute; box-sizing:border-box; border:2px dashed #ffeb3b; background:rgba(255,235,59,0.08); pointer-events:none; z-index:11;';
        }
        if (frame.parentNode !== frameParent) frameParent.appendChild(frame);
        const a = getArea();
        frame.style.display = 'block';
        frame.style.left = (originX + a.x1 * SCALE) + 'px';
        frame.style.top = (originY + a.y1 * SCALE) + 'px';
        frame.style.width = (a.w * SCALE) + 'px';
        frame.style.height = (a.h * SCALE) + 'px';
    };

    // ---------- Obwódki na głównej mapie ----------
    const markMainMap = () => {
        if (typeof TWMap === 'undefined' || !TWMap.villages) return;
        set.forEach(coord => {
            const [x, y] = coord.split('|').map(Number);
            const v = TWMap.villages[x * 1000 + y];
            if (!v) return;
            const el = document.getElementById(`map_village_${v.id}`);
            if (el && el.style.outline !== "3px solid rgb(0, 0, 0)") {
                el.style.outline = "3px solid #000";
                el.style.outlineOffset = "-3px";
            }
        });
    };

    // ---------- Dopasowanie wiosek ----------
    const buildMatcher = () => {
        const tTags = ($('#tcm_target_tags').val() || "").split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");
        const tPlayers = ($('#tcm_target_players').val() || "").split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");
        const scanBarbs = $('#tcm_scan_barbs').is(':checked');
        const scanEnemy = $('#tcm_scan_enemy').is(':checked');
        const scanMine = $('#tcm_scan_mine').is(':checked');
        const myId = Number(game_data.player.id);
        const myAlly = Number(game_data.player.ally);

        return (ownerId, pName, allyId, allyTag) => {
            const isMe = ownerId === myId;
            const isBarb = ownerId === 0;
            const isMyTribe = allyId !== 0 && allyId === myAlly;

            if (tTags.length > 0 || tPlayers.length > 0) {
                return tTags.includes(allyTag) || tPlayers.includes(pName);
            }
            if (isMe) return false;
            if (isBarb) return scanBarbs;
            if (isMyTribe) return scanMine;
            return scanEnemy;
        };
    };

    // ---------- Skanowanie ----------
    const scanMap = async () => {
        const minPoints = cleanPoints($('#tcm_min_pts').val());
        const mode = $('input[name="tcm_mode"]:checked').val();
        const matcher = buildMatcher();
        const area = getArea();

        localStorage.setItem(STORAGE_TAGS, $('#tcm_target_tags').val());
        localStorage.setItem(STORAGE_PLAYERS, $('#tcm_target_players').val());
        localStorage.setItem(STORAGE_PTS, minPoints);
        localStorage.setItem(STORAGE_W, area.w);
        localStorage.setItem(STORAGE_H, area.h);

        let count = 0;
        const btn = document.getElementById('tcm_scan');
        btn.innerText = "...";
        btn.disabled = true;

        try {
            const [allyRes, playerRes, villageRes] = await Promise.all([
                fetch('/map/ally.txt').then(r => r.text()),
                fetch('/map/player.txt').then(r => r.text()),
                fetch('/map/village.txt').then(r => r.text())
            ]);

            const allies = {};
            allyRes.split('\n').forEach(line => {
                const p = line.split(',');
                if (p.length > 2) allies[p[0]] = safeDecode(p[2]);
            });

            const players = {};
            playerRes.split('\n').forEach(line => {
                const p = line.split(',');
                if (p.length > 2) players[p[0]] = { name: safeDecode(p[1]), ally: p[2] };
            });

            villageRes.split('\n').forEach(line => {
                const p = line.split(',');
                if (p.length < 6 || parseInt(p[5]) < minPoints) return;

                const vx = parseInt(p[2]);
                const vy = parseInt(p[3]);
                if (mode === "area" && (vx < area.x1 || vx > area.x2 || vy < area.y1 || vy > area.y2)) return;

                const playerId = parseInt(p[4]);
                const player = players[playerId];
                const pName = player ? player.name : "";
                const allyId = player ? parseInt(player.ally) : 0;
                const allyTag = (player && allies[allyId]) ? allies[allyId] : "";

                if (matcher(playerId, pName, allyId, allyTag)) {
                    const coord = vx + "|" + vy;
                    if (!set.has(coord)) { set.add(coord); count++; }
                }
            });
        } catch (error) {
            console.error("Błąd skanowania:", error);
            alert("Wystąpił błąd podczas pobierania plików świata.");
        }

        saveSet();
        updateButtonText();
        pinFramesToTiles();
        markMainMap();
        UI.SuccessMessage(`Znaleziono nowych: ${count}`);
        btn.innerText = "SKANUJ";
        btn.disabled = false;
    };

    // ---------- Ręczne dodawanie: klik w wioskę na mapie ----------
    let lastManual = { coord: "", t: 0 };
    const manualAdd = (x, y) => {
        const coord = x + "|" + y;
        const now = Date.now();
        if (lastManual.coord === coord && now - lastManual.t < 400) return; // dwa hooki = jedno dodanie
        lastManual = { coord, t: now };

        if (set.has(coord)) {
            set.delete(coord);
            if (typeof TWMap !== 'undefined' && TWMap.villages) {
                const v = TWMap.villages[x * 1000 + y];
                if (v) {
                    const el = document.getElementById(`map_village_${v.id}`);
                    if (el) { el.style.outline = ''; el.style.outlineOffset = ''; }
                }
            }
            UI.SuccessMessage(`Usunięto: ${coord}`);
        } else {
            set.add(coord);
            UI.SuccessMessage(`Dodano: ${coord}`);
        }
        saveSet();
        updateButtonText();
        pinFramesToTiles();
        markMainMap();
    };

    const hookMapClick = () => {
        if (typeof TWMap === 'undefined' || !TWMap.map) return false;
        if (TWMap.map._tcmHooked) return true;

        // Hook 1: handler kliknięcia mapy
        const origHandle = TWMap.map._handleClick;
        if (typeof origHandle === 'function') {
            TWMap.map._handleClick = function (e) {
                if (!$('#tcm_manual').is(':checked')) return origHandle.apply(this, arguments);
                const pos = this.coordByEvent(e);
                if (!pos) return origHandle.apply(this, arguments);
                manualAdd(pos[0], pos[1]);
                return false;
            };
        }

        // Hook 2: mapHandler.onClick (na wypadek gdyby _handleClick nie był używany)
        if (TWMap.mapHandler && typeof TWMap.mapHandler.onClick === 'function') {
            const origOnClick = TWMap.mapHandler.onClick;
            TWMap.mapHandler.onClick = function (x, y) {
                if (!$('#tcm_manual').is(':checked')) return origOnClick.apply(this, arguments);
                manualAdd(x, y);
                return false;
            };
        }

        TWMap.map._tcmHooked = true;
        return true;
    };

    // ---------- UI: przeciąganie i przypinanie ----------
    function setupDraggableAndPin(ui, initialPinState) {
        const handle = document.getElementById('tcm-drag-handle');
        const pinBtn = document.getElementById('tcm-pin-btn');

        let isPinned = initialPinState;
        let isDragging = false, startX, startY, initialX, initialY;

        const updatePinVisuals = () => {
            if (isPinned) {
                pinBtn.style.opacity = '1';
                pinBtn.style.border = '1px solid #2ecc71';
                handle.style.cursor = 'default';
            } else {
                pinBtn.style.opacity = '0.4';
                pinBtn.style.border = '1px solid transparent';
                handle.style.cursor = 'move';
            }
        };
        updatePinVisuals();

        const startDrag = (e) => {
            if (e.target === pinBtn) return;
            if (isPinned) return;
            isDragging = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initialX = ui.offsetLeft;
            initialY = ui.offsetTop;
        };

        const onDrag = (e) => {
            if (!isDragging || isPinned) return;
            e.preventDefault();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            ui.style.left = (initialX + clientX - startX) + 'px';
            ui.style.top = (initialY + clientY - startY) + 'px';
        };

        const stopDrag = () => { isDragging = false; };

        handle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);

        pinBtn.addEventListener('click', () => {
            if (isPinned) {
                localStorage.removeItem('TCM_MapUI_Pos');
                isPinned = false;
            } else {
                localStorage.setItem('TCM_MapUI_Pos', JSON.stringify({ top: ui.style.top, left: ui.style.left }));
                isPinned = true;
            }
            updatePinVisuals();
        });
    }

    const formatList = (format) => [...set].join(format === 'line' ? '\n' : ' ');

    const initUI = () => {
        if ($('#tcm_ui').length) return;
        injectStyles();

        const sTags = localStorage.getItem(STORAGE_TAGS) || "";
        const sPlayers = localStorage.getItem(STORAGE_PLAYERS) || "";
        const sPts = localStorage.getItem(STORAGE_PTS) || "3000";
        const sW = localStorage.getItem(STORAGE_W) || "30";
        const sH = localStorage.getItem(STORAGE_H) || "30";

        let savedPos = null;
        try { savedPos = JSON.parse(localStorage.getItem('TCM_MapUI_Pos')); } catch (e) { localStorage.removeItem('TCM_MapUI_Pos'); }

        const ui = document.createElement('div');
        ui.id = 'tcm_ui';
        if (savedPos) {
            ui.style.top = savedPos.top;
            ui.style.left = savedPos.left;
        }

        ui.innerHTML = `
            <div id="tcm-drag-handle">
                <span>Skaner Mapy PRO</span>
                <span id="tcm-pin-btn" title="Przypnij/Odepnij">📌</span>
            </div>
            <div style="padding: 12px;">
                <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-color); font-size:11px;">
                    <label style="margin-right:10px; cursor:pointer;"><input type="radio" name="tcm_mode" value="area" checked style="width:14px; height:14px;"> Obszar</label>
                    <label style="cursor:pointer;"><input type="radio" name="tcm_mode" value="global" style="width:14px; height:14px;"> Cały świat</label>
                </div>

                <div id="tcm_area_box" style="margin-bottom:8px;">
                    <div style="display:flex; gap:8px;">
                        <div style="flex:1;">
                            <span class="tcm-label">W bok (pól)</span>
                            <input type="number" id="tcm_area_w" class="tcm-input" value="${sW}" min="1" style="margin-bottom:0;">
                        </div>
                        <div style="flex:1;">
                            <span class="tcm-label">W dół (pól)</span>
                            <input type="number" id="tcm_area_h" class="tcm-input" value="${sH}" min="1" style="margin-bottom:0;">
                        </div>
                    </div>
                    <button id="tcm_fit_btn" class="tcm-btn" style="margin-top:8px;">PRZYWRÓĆ ROZMIAR EKRANU</button>
                    <div style="font-size:10px; color:#aaa; margin-top:4px;">Wbudowany kwadrat na minimapie (żółty, kreskowany) = skanowany obszar, jego środek się nie zmienia. Czerwone pola = dodane wioski.</div>
                </div>

                <div style="background:var(--bg-row-alt); padding:8px; border-radius:4px; border:1px solid var(--border-color); margin-bottom:10px;">
                    <label class="tcm-checkbox-label"><input type="checkbox" id="tcm_scan_barbs" checked> Barbarzyńskie (puste pola)</label>
                    <label class="tcm-checkbox-label"><input type="checkbox" id="tcm_scan_enemy" checked> Inni gracze (puste pola)</label>
                    <label class="tcm-checkbox-label" style="margin-bottom:0;"><input type="checkbox" id="tcm_scan_mine"> Moje plemię (puste pola)</label>
                </div>

                <div style="display:flex; justify-content:space-between; margin-bottom:8px; gap:8px;">
                    <input type="number" id="tcm_min_pts" class="tcm-input" value="${sPts}" style="width:70px; margin-bottom:0;" placeholder="Pkt">
                    <button id="tcm_scan" class="tcm-btn tcm-btn-green" style="flex:1;">SKANUJ</button>
                </div>

                <input type="text" id="tcm_target_tags" class="tcm-input" value="${sTags}" placeholder="Tagi (oddziel przecinkiem)">
                <input type="text" id="tcm_target_players" class="tcm-input" value="${sPlayers}" placeholder="Gracze (oddziel przecinkiem)">

                <div style="background:var(--bg-row-alt); padding:8px; border-radius:4px; border:1px solid #2ecc71; margin-bottom:8px;">
                    <label class="tcm-checkbox-label" style="margin-bottom:0;"><input type="checkbox" id="tcm_manual"> RĘCZNE: klik w wioskę dodaje jej kordy, drugi klik usuwa</label>
                </div>

                <div style="display:flex; gap:8px; margin-top:4px;">
                    <button id="tcm_out_btn" class="tcm-btn" style="flex:1;">LISTA (${set.size})</button>
                    <button id="tcm_reset_btn" class="tcm-btn tcm-btn-red" style="width:60px;">RESET</button>
                </div>
            </div>`;

        document.body.appendChild(ui);
        setupDraggableAndPin(ui, !!savedPos);

        $('input[name="tcm_mode"]').on('change', function () {
            $('#tcm_area_box').toggle($('input[name="tcm_mode"]:checked').val() === 'area');
            pinFramesToTiles();
        });
        $('#tcm_area_w, #tcm_area_h').on('input change', pinFramesToTiles);

        $('#tcm_scan').click(scanMap);

        $('#tcm_fit_btn').click(() => {
            const vp = getViewportRect();
            if (!vp) { UI.ErrorMessage('Nie znaleziono kwadratu gry na minimapie'); return; }
            const fw = vpBase ? vpBase.w / SCALE : vp.w;
            const fh = vpBase ? vpBase.h / SCALE : vp.h;
            $('#tcm_area_w').val(Math.round(fw));
            $('#tcm_area_h').val(Math.round(fh));
            pinFramesToTiles();
        });

        $('#tcm_out_btn').click(() => {
            const fmt = localStorage.getItem(STORAGE_FORMAT) || 'space';
            Dialog.show('tcm_box', `<div style="padding:15px; background:var(--bg-main); border:2px solid var(--border-color); color:var(--text-color);">
                <span class="tcm-label">Format listy</span>
                <select id="tcm_format" class="tcm-input">
                    <option value="space" ${fmt === 'space' ? 'selected' : ''}>Jedna obok drugiej (spacja)</option>
                    <option value="line" ${fmt === 'line' ? 'selected' : ''}>Jedna pod drugą (nowa linia)</option>
                </select>
                <textarea id="tcm_copy" class="tcm-input" style="width:100%; height:140px; resize:none;">${formatList(fmt)}</textarea>
                <button id="tcm_copy_btn" class="tcm-btn tcm-btn-green" style="width:100%; margin-top:10px;">KOPIUJ</button>
             </div>`);
            $('#tcm_format').on('change', function () {
                localStorage.setItem(STORAGE_FORMAT, this.value);
                $('#tcm_copy').val(formatList(this.value));
            });
            $('#tcm_copy_btn').on('click', function () {
                const ta = document.getElementById('tcm_copy');
                ta.select();
                document.execCommand('copy');
                UI.SuccessMessage('Skopiowano!');
            });
        });

        $('#tcm_reset_btn').click(() => {
            if (confirm('Wyczyścić listę?')) {
                set.clear();
                localStorage.removeItem(STORAGE_LIST);
                $('.tcm-tile-overlay').remove();
                $('[id^="map_village_"]').css('outline', '');
                updateButtonText();
            }
        });

        // TWMap może nie być gotowy od razu - próbujemy podpiąć klik aż się uda
        if (!hookMapClick()) {
            const t = setInterval(() => { if (hookMapClick()) clearInterval(t); }, 500);
        }

        setInterval(pinFramesToTiles, 250);
        setInterval(markMainMap, 700);
    };

    $(document).ready(initUI);
})();
