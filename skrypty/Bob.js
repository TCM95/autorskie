// ==UserScript==
// @name         Kalkulator budowy
// @namespace    https://viayoo.com/
// @version      7.2
// @description  Rdzeń: kolejka budowy, szablony BB, wytyczne, wstawianie, akcje (UI). Moduły wykonawcze (rekrutacja, technologie, bonusy, nagrody) ładowane z linków GitHub.
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=main*
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    if (typeof $ === 'undefined' || typeof game_data === 'undefined') return;

    // =====================================================================
    //  MODUŁY - osobne pliki z GitHub. LINKI SĄ TUTAJ, W KODZIE - podmień według potrzeb.
    //  Pełny adres = MODULES_BASE + file (albo wpisz własny 'url' w pozycji, wtedy ma pierwszeństwo).
    //  Pusty file/url = moduł wyłączony (opcje w UI zostają, ale nic nie robią).
    // =====================================================================
        const MODULES_BASE = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/modul/'; // folder z modułami
    const MODULES = [
        { id: 'rek',     name: 'Rekrutacja',      icon: 'buildings/barracks.png', panel: true, file: 'rekru.js', url: '', adapter: 'rek-legacy' },
        { id: 'tech',    name: 'Technologie',     icon: 'buildings/smith.png',    panel: true, file: 'tech.js',  url: '' },
        { id: 'bonus',   name: 'Auto-bonusy',     file: '', url: '' },   // <- wpisz plik, gdy będzie gotowy
        { id: 'nagrody', name: 'Dzienne nagrody', file: '', url: '' }    // <- wpisz plik, gdy będzie gotowy
    ];
    const moduleUrl = m => (m.url || (m.file ? MODULES_BASE + m.file : '')).trim();

    // Akcje na liście obsługiwane przez moduły: rodzaj -> {ikona, id modułu}
    const ACT_META = {
        recruit: { icon: '⚔️', mod: 'rek' },
        tech:    { icon: '🔬', mod: 'tech' }
    };

    let daneSwiata = {};
    if (typeof get_world_info === 'function') {
        try {
            daneSwiata = await get_world_info({ configs: ['config', 'building_info'], entities: { 'village': ['id', 'name', 'points'] } });
        } catch (e) {
            console.log("Brak Biblioteki Hermitowskiego. Praca w trybie ograniczonym.");
        }
    }

    // =====================================================================
    //  STYLE
    // =====================================================================
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-main: #36393f; --bg-row-alt: #32353b; --bg-header: #202225; --border-color: #3e4147;
            --text-color: white; --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --neon-green: #74ff00; --neon-glow: 0 0 8px rgba(116,255,0,.6), 0 0 15px rgba(116,255,0,.4);
        }
        #kalkulatorBudowyMain * { box-sizing: border-box !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }
        #kalkulatorBudowyMain { background-color: var(--bg-main) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; border-radius: 4px; padding: 8px; margin: 10px 0; max-width: 340px; font-size: 12px; }
        #kalkulatorBudowyMain h4 { color: var(--title-color); margin: 0 0 8px 0; font-size: 13px; text-align: center; }
        #kalkulatorBudowyMain th { background: var(--bg-header) !important; background-image: none !important; color: var(--title-color) !important; border-bottom: 1px solid var(--border-color); }
        #kalkulatorBudowyMain select { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 4px; border-radius: 3px; font-size: 11px; }
        .tcm-btn { background: var(--btn-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; padding: 5px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold; margin: 2px 1px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.8); transition: all 0.2s ease; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
        .tcm-btn-active { border-color: var(--neon-green) !important; color: var(--neon-green) !important; text-shadow: var(--neon-glow); box-shadow: inset 0 0 5px rgba(116,255,0,.3); }

        /* --- lista --- */
        #tcm-queue { width: 100%; border-collapse: collapse; }
        .q-row-a { background-color: var(--bg-main); } .q-row-b { background-color: var(--bg-row-alt); }
        .q-current td { border-top: 1px solid var(--neon-green); border-bottom: 1px solid var(--neon-green); }
        .q-sel td { border-bottom: 2px dashed var(--neon-green) !important; }
        .q-pinned td:first-child { box-shadow: inset 3px 0 0 #ffcc00; }
        .drag-handle { cursor: grab; font-size: 16px; color: #aaa; padding: 0 6px !important; user-select: none; }
        .drag-handle:active { cursor: grabbing; }
        .drag-over { border-top: 2px dashed var(--neon-green) !important; background-color: #171717 !important; }
        .q-note-text { color: #8fd3ff; font-style: italic; }
        .q-label { cursor: pointer; }
        .q-actions { position: relative; }
        .q-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
        .q-sub td { padding: 0 6px 6px 6px; }
        .q-sub .q-extra { font-size: 10px; color: #b8c4d0; padding-left: 4px; border-left: 2px solid #8fd3ff; }
        .q-unit { width: 16px; height: 16px; vertical-align: middle; margin: 0 1px; }
        .q-bico { width: 16px; height: 16px; vertical-align: middle; margin-right: 4px; }
        .q-infocell { width: 1%; padding: 0 2px !important; text-align: center; }
        .q-info { position: static !important; width: 34px; height: 32px; padding: 0 !important; margin: 0 !important; font-size: 16px !important; line-height: 1 !important; }
        .q-info-cur { border-color: var(--neon-green) !important; box-shadow: 0 0 8px rgba(116,255,0,.7) !important; }
        .q-more td { text-align: center; padding: 6px; color: #aaa; font-size: 11px; font-style: italic; }
        #insInfo { padding: 2px 0 6px; font-size: 11px; color: #aaa; }
        #insInfo b { color: var(--neon-green); }

        /* --- tooltip wytycznych --- */
        #tcm-tip { position: fixed; z-index: 100000; display: none; background: #202225; color: #fff; border: 1px solid var(--neon-green); border-radius: 6px; padding: 8px; max-width: min(280px, 80vw); font-size: 12px; line-height: 1.35; box-shadow: 0 4px 14px rgba(0,0,0,.9); overflow-wrap: anywhere; }
        #tcm-tip .tip-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }

        /* --- okno modalne (dla modułów) --- */
        #tcm-modal { position: fixed; inset: 0; z-index: 100001; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.8); }
        #tcm-modal .tcm-modal-box { background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; width: min(360px, 94vw); max-height: 88vh; overflow: auto; color: #fff; font-size: 12px; }
        #tcm-modal input[type=number], #tcm-modal input[type=text] { background: #111; color: #fff; border: 1px solid var(--border-color); border-radius: 3px; padding: 5px; font-size: 13px; width: 100%; }

        /* --- zakładki przypięte do prawej ścianki ramki UI, panel otwiera się obok --- */
        #tcm-wrap { display: flex; flex-wrap: nowrap; align-items: flex-start; overflow-x: auto; margin: 10px 0; }
        #tcm-wrap #kalkulatorBudowyMain { margin: 0; flex: 0 0 min(100%, 340px); }
        #tcm-tabs { display: flex; flex-direction: column; gap: 6px; flex: none; margin-top: 34px; }
        .tcm-tab { position: relative; width: 40px; height: 48px; padding: 0; cursor: pointer; background: var(--btn-bg); border: 1px solid var(--border-color); border-left: none; border-radius: 0 8px 8px 0; box-shadow: 2px 2px 8px rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; }
        .tcm-tab img { width: 28px; height: 28px; object-fit: contain; pointer-events: none; }
        .tcm-tab.tcm-tab-active { border-color: var(--neon-green); box-shadow: 2px 2px 8px rgba(0,0,0,.6), 0 0 8px rgba(116,255,0,.5); }
        .tcm-tab.tcm-tab-run:after { content: ''; position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border-radius: 50%; background: #6bbf6b; box-shadow: 0 0 6px #6bbf6b; }
        #tcm-panels { display: none; flex: none; margin-left: 6px; }
        .tcm-panel { display: none; background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px; max-height: 82vh; overflow: auto; max-width: calc(100vw - 60px); box-sizing: border-box; box-shadow: 4px 4px 12px rgba(0,0,0,.8); font-size: 12px; }
        #tcm-panel-prev { width: 250px; }
        #tcm-panel-prev .pv-title { text-align: center; margin-bottom: 4px; color: var(--title-color); font-weight: bold; }
        #tcm-panel-prev .pv-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px; }
        #tcm-panel-prev .pv-cell { display: flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid var(--border-color); border-radius: 3px; font-size: 10px; line-height: 1.2; opacity: .6; background: var(--bg-row-alt); }
        #tcm-panel-prev .pv-cell img { width: 24px; height: 24px; object-fit: contain; flex: none; }
        #tcm-panel-prev .pv-up { opacity: 1; border-color: var(--neon-green); }
        #tcm-panel-prev .pv-name { color: var(--neon-green) !important; text-shadow: var(--neon-glow); font-weight: bold; }
        #tcm-panel-prev .pv-lvl { color: #fff !important; }
        #tcm-panel-prev .pv-up .pv-lvl { color: var(--title-color) !important; font-weight: bold; }

        /* --- okno dodawania rekrutacji / technologii --- */
        #tcm-modal .rec-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 8px 0; }
        #tcm-modal .rec-cell { display: flex; align-items: center; gap: 6px; background: var(--bg-row-alt); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px; }
        #tcm-modal .rec-cell img { width: 20px; height: 20px; }
        #tcm-modal .rec-cell input[type=checkbox] { width: 20px; height: 20px; }

        .mod-ph { padding: 10px; color: #aaa; font-size: 11px; max-width: 260px; }
    `;
    document.head.appendChild(style);

    // =====================================================================
    //  STAN I STAŁE
    // =====================================================================
    let buildingObject = { buildingQueue: [], buildingQueueLength: 5, autoFarmLimit: 0, status: false, instructions: [] };
    let isBuilding = false;
    let expectedBuild = null;
    let isQueueMinimized = JSON.parse(localStorage.getItem('queueMinimized') || "false");
    let isGuideOpen = JSON.parse(localStorage.getItem('guideOpen') || "false");
    let activeTab = localStorage.getItem('tcmTab') || '';
    let insertAfterId = null;   // wstawianie "po tej pozycji" (null = na końcu)
    let tipId = null;
    let DISP = {};              // poziomy do wyświetlania (liczone z kolejności na liście)
    let rewardsOn = localStorage.getItem('TCM_BOB_rewards') === '1';

    const LINKS = {
        eko1: "https://raw.githubusercontent.com/Kipi955/sprawdzian/5a0309cbf24521ba89655119d9543c2d9942b88e/EKO1",
        eko2: "https://raw.githubusercontent.com/Kipi955/sprawdzian/main/EKO/Eko2"
    };

    const PL_NAMES = {
        "main": "Ratusz", "barracks": "Koszary", "stable": "Stajnia", "garage": "Warsztat",
        "watchtower": "Wieża strażnicza", "smith": "Kuźnia", "market": "Rynek", "wood": "Tartak",
        "stone": "Cegielnia", "iron": "Huta żelaza", "farm": "Zagroda", "storage": "Spichlerz",
        "hide": "Schowek", "wall": "Mur", "snob": "Pałac"
    };

    const MAX_LEVELS = {
        "main": 30, "barracks": 25, "stable": 20, "garage": 15, "watchtower": 20, "smith": 20,
        "market": 25, "wood": 30, "stone": 30, "iron": 30, "farm": 30, "storage": 30, "hide": 10, "wall": 20, "snob": 3
    };

    const REK_ALL = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult'];

    // Wzorce nazw (po usunięciu polskich znaków i zmniejszeniu liter) - obsługują odmiany
    const NAME_RX = {
        main: /ratusz/, barracks: /koszar/, stable: /stajn/, garage: /warsztat/,
        watchtower: /wiez\w*\s*straz|straznic/, smith: /kuzni/, market: /rynek|rynku/,
        wood: /tartak/, stone: /cegieln/, iron: /hut\w*\s*zelaz|\bhuta\b|\bhuty\b/,
        farm: /zagrod/, storage: /spichlerz/, hide: /schowek|schowk/, wall: /\bmur\b|\bmuru\b|\bmurze\b/, snob: /palac/
    };

    // Nazwy jednostek w tekście wytycznych (po normalizacji)
    const UNIT_RX = [
        ['marcher', /konn\w*\s*lucz|lucz\w*\s*konn/], ['archer', /lucz/], ['spear', /pikin|\bpik/], ['sword', /miecz/],
        ['axe', /topor|\btop\b/], ['spy', /zwiad|\bspy\b/], ['light', /lekk|\blk\b/], ['heavy', /ciezk|\bck\b/],
        ['ram', /taran/], ['catapult', /katap|\bkat\b/]
    ];

    const norm = s => (s || '').replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esc = s => $('<div>').text(s == null ? '' : s).html();
    const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

    const FALLBACK_GFX = 'https://dspl.innogamescdn.com/asset/45436e33/graphic/';
    const gfx = () => {
        const b = (typeof image_base !== 'undefined' && image_base) ? String(image_base) : FALLBACK_GFX;
        return b.endsWith('/') ? b : b + '/';
    };
    const unitIcon = u => gfx() + 'unit/unit_' + u + '.png';
    // tekst z tokenami {{u:spear}} -> ikony jednostek z gry
    const rich = t => esc(t).replace(/\{\{u:(\w+)\}\}/g, (m, u) => `<img class="q-unit" src="${unitIcon(u)}" alt="${u}">`);

    function iconSrc(b) {
        const s = $(`#main_buildrow_${b} img`).first().attr('src');
        return s || (gfx() + 'buildings/' + b + '.png');
    }

    function maxLevel(b) {
        return (typeof BuildingMain !== 'undefined' && BuildingMain.buildings && BuildingMain.buildings[b] && BuildingMain.buildings[b].max_level)
            ? parseInt(BuildingMain.buildings[b].max_level, 10) : (MAX_LEVELS[b] || 30);
    }

    // ---------- ID pozycji, zapis ----------
    function ensureIds() { buildingObject.buildingQueue.forEach(it => { if (!it.id) it.id = uid(); }); }

    function updateLocalStorage() {
        ensureIds();
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        storage[game_data.village.id] = buildingObject;
        localStorage.setItem('buildingObject', JSON.stringify(storage));
    }

    const findById = id => buildingObject.buildingQueue.find(x => x.id === id);
    const indexById = id => buildingObject.buildingQueue.findIndex(x => x.id === id);

    // ---------- Poziomy ----------
    function getInQueueCounts() {
        let inQueue = {};
        $('#buildqueue tr[class*="buildorder_"]').each(function() {
            ($(this).attr('class') || '').split(/\s+/).forEach(c => {
                if (c.startsWith('buildorder_')) {
                    const bCode = c.replace('buildorder_', '');
                    inQueue[bCode] = (inQueue[bCode] || 0) + 1;
                }
            });
        });
        return inQueue;
    }

    // Poziom faktycznie zbudowany (max z kilku źródeł, bo game_data bywa nieaktualne po odświeżeniu AJAX)
    function builtLevel(b) {
        let lv = 0;
        const gb = game_data.village.buildings;
        if (gb && gb[b] !== undefined) lv = Math.max(lv, parseInt(gb[b], 10) || 0);
        if (typeof BuildingMain !== 'undefined' && BuildingMain.buildings && BuildingMain.buildings[b] && BuildingMain.buildings[b].level !== undefined) {
            lv = Math.max(lv, parseInt(BuildingMain.buildings[b].level, 10) || 0);
        }
        return lv;
    }

    function gameEffLevel(b, inQ) {
        inQ = inQ || getInQueueCounts();
        return builtLevel(b) + (inQ[b] || 0);
    }

    function projectedLevel(b, inQ) {
        let lv = gameEffLevel(b, inQ);
        buildingObject.buildingQueue.forEach(it => { if (it.t === 'b' && it.b === b && it.l > lv) lv = it.l; });
        return lv;
    }

    // Pierwsza pozycja do wykonania (wytyczne są pomijane)
    function firstActionIdx() {
        return buildingObject.buildingQueue.findIndex(it => it.t !== 'note');
    }

    // ---------- Migracja starych formatów kolejki ----------
    function normalizeQueue() {
        const inQ = getInQueueCounts();
        let sim = {};
        for (let b in PL_NAMES) sim[b] = gameEffLevel(b, inQ);
        buildingObject.buildingQueue = (buildingObject.buildingQueue || []).map(it => {
            if (it && typeof it === 'object') {
                // stary typ "recruit" z v5 -> ogólna akcja
                if (it.t === 'recruit') return { id: it.id, t: 'act', kind: 'recruit', mod: 'rek', title: it.title, units: it.units, c: it.c, pinned: it.pinned };
                return it;
            }
            if (typeof it === 'string') {
                if (it.includes('Aktywuj')) return { t: 'bonus', text: it };
                if (PL_NAMES[it]) { sim[it]++; return { t: 'b', b: it, l: sim[it] }; }
                return { t: 'note', text: it };
            }
            return null;
        }).filter(Boolean);
        if (buildingObject.instructions && buildingObject.instructions.length) {
            const notes = buildingObject.instructions.map(t => ({ t: 'note', text: t }));
            buildingObject.buildingQueue = notes.concat(buildingObject.buildingQueue);
        }
        buildingObject.instructions = [];
        ensureIds();
    }

    // Usuwa pozycję oraz miniętę wytyczne (nieprzypięte) przed nią
    function removeAt(i) {
        buildingObject.buildingQueue = buildingObject.buildingQueue.filter((it, k) => k !== i && !(it.t === 'note' && !it.pinned && k < i));
    }

    // Usuwa z kolejki skryptu pozycje już zbudowane / w budowie (np. kliknięte ręcznie)
    function cleanupQueue(silent) {
        const inQ = getInQueueCounts();
        const done = new Set();
        let lastDone = -1;
        buildingObject.buildingQueue.forEach((it, i) => {
            if (it.t !== 'b') return;
            let d = it.l <= gameEffLevel(it.b, inQ);
            const nxt = parseInt($(`.btn-build[data-building="${it.b}"]`).first().attr('data-level-next'), 10);
            if (!isNaN(nxt) && nxt > it.l) d = true;
            if (d) { done.add(i); lastDone = i; }
        });
        if (!done.size) return 0;
        buildingObject.buildingQueue = buildingObject.buildingQueue.filter((it, i) => !done.has(i) && !(it.t === 'note' && !it.pinned && i < lastDone));
        if (insertAfterId && indexById(insertAfterId) < 0) insertAfterId = null;
        updateLocalStorage();
        reloadQueueDisplay();
        if (!silent) UI.InfoMessage(`Usunięto z kolejki (już zbudowane): ${done.size}`, 2000);
        return done.size;
    }

    // Poziomy budynków zawsze po kolei wg kolejności na liście
    function renumberLevels() {
        const inQ = getInQueueCounts();
        let sim = {};
        for (let b in PL_NAMES) sim[b] = gameEffLevel(b, inQ);
        buildingObject.buildingQueue.forEach(it => {
            if (it.t === 'b') { sim[it.b] = (sim[it.b] || 0) + 1; it.l = sim[it.b]; }
        });
    }

    // Wstawienie pozycji: po zaznaczonej pozycji albo na końcu listy
    function insertItem(item) {
        cleanupQueue(true);
        if (!item.id) item.id = uid();
        const q = buildingObject.buildingQueue;
        const k = insertAfterId ? indexById(insertAfterId) : -1;
        if (k > -1) { q.splice(k + 1, 0, item); insertAfterId = item.id; }
        else { q.push(item); insertAfterId = null; }
        renumberLevels();
        updateLocalStorage();
        reloadQueueDisplay();
    }

    // =====================================================================
    //  API DLA MODUŁÓW (window.TCM_BOB)
    // =====================================================================
    const BOB = window.TCM_BOB = window.TCM_BOB || {};
    BOB.version = '7.2';
    BOB.modules = BOB.modules || {};
    BOB.add = item => insertItem(item);
    BOB.helpers = { gfx, unitIcon, esc, rich, uid, norm, REK_ALL, screenUrl: screen => `${location.origin}/game.php?village=${game_data.village.id}&screen=${screen}` };
    BOB.modal = function(html) {
        let $m = $('#tcm-modal');
        if (!$m.length) {
            $m = $('<div id="tcm-modal"></div>').appendTo('body');
            $m.on('click', function(e) { if (e.target === this) $m.hide(); });
        }
        $m.html(`<div class="tcm-modal-box">${html}</div>`).css('display', 'flex');
        return $m.find('.tcm-modal-box');
    };
    BOB.closeModal = () => $('#tcm-modal').hide();
    BOB.ready = false;
    BOB.pending = [];
    BOB.registerModule = registerModule;

    function registerModule(def) {
        if (!def || !def.id) return;
        if (!BOB.ready) { BOB.pending.push(def); return; } // UI jeszcze nie gotowe - zarejestrujemy po zbudowaniu
        const rec = { def: def, api: null };
        BOB.modules[def.id] = rec;
        if (def.panel !== false) {
            if (!$(`#tcm-panel-${def.id}`).length) $('#tcm-panels').append(`<div id="tcm-panel-${def.id}" class="tcm-panel"></div>`);
            if (def.panelWidth) $(`#tcm-panel-${def.id}`).css('width', def.panelWidth);
            const icon = /^https?:/.test(def.icon || '') ? def.icon : gfx() + (def.icon || 'buildings/main.png');
            if (!$(`.tcm-tab[data-tab="${def.id}"]`).length) $('#tcm-tabs').append(`<button class="tcm-tab" data-tab="${def.id}" title="${esc(def.name || def.id)}"><img src="${icon}" alt=""></button>`);
        }
        const ctx = {
            panel: $(`#tcm-panel-${def.id}`),
            core: BOB,
            helpers: BOB.helpers,
            setRunning: on => $(`.tcm-tab[data-tab="${def.id}"]`).toggleClass('tcm-tab-run', !!on)
        };
        try {
            rec.api = def.init ? (def.init(ctx) || {}) : {};
        } catch (e) {
            console.error('TCM_BOB: błąd modułu ' + def.id, e);
            UI.ErrorMessage('Błąd modułu: ' + (def.name || def.id));
        }
        if (def.id === 'nagrody' && rec.api && typeof rec.api.setEnabled === 'function') rec.api.setEnabled(rewardsOn);
        applyTab();
        reloadQueueDisplay();
        updateModuleStatus();
    }

    // ---------- Adaptery: wczytanie zwykłego (niezmienionego) skryptu jako modułu ----------
    // 'rek-legacy': samodzielny "Kalkulator Rekrutacji" (rekru.js). Jego panel zostaje przeniesiony do zakładki,
    // a akcje z listy wykonujemy przez jego własne pola (Limit / Zapisz / Start) - bez zmian w tamtym pliku.
    const ADAPTERS = {
        'rek-legacy': function(m) {
            if (BOB.modules[m.id]) return;
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            registerModule({
                id: m.id, name: m.name, icon: m.icon, panelWidth: 520,
                init: function(ctx) {
                    const dock = () => {
                        const el = document.getElementById('tcm-rekrutacja-ui');
                        if (!el) return false;
                        if (el.parentNode !== ctx.panel[0]) { ctx.panel.empty(); ctx.panel[0].appendChild(el); }
                        const set = (p, v) => el.style.setProperty(p, v, 'important');
                        el.classList.remove('tcm-hidden');
                        ['position:static', 'top:auto', 'left:auto', 'width:100%', 'max-width:none', 'min-width:0', 'box-shadow:none', 'border:none', 'padding:0', 'margin:0', 'z-index:auto', 'display:block']
                            .forEach(x => { const [k, v] = x.split(':'); set(k, v); });
                        const hd = document.getElementById('tcm-rekrutacja-header'); if (hd) { hd.style.cursor = 'default'; hd.style.touchAction = 'auto'; }
                        const cl = document.getElementById('tcm-close'); if (cl) cl.style.display = 'none';
                        const ic = document.getElementById('tcm_rekrutacja_btn'); if (ic) ic.style.display = 'none';
                        return true;
                    };
                    let tries = 0;
                    const iv = setInterval(() => { if (dock() || ++tries > 60) clearInterval(iv); }, 300);

                    const isActive = () => /Stop/.test($('#tcm-toggle-btn').text());
                    setInterval(() => ctx.setRunning(isActive()), 3000);

                    return {
                        isActive: isActive,
                        run: async function(item) {
                            if (!item || item.kind !== 'recruit') return false;
                            if (!$('#tcm-rekrutacja-ui').length) return false;
                            if (!isActive()) { $('#tcm-toggle-btn').click(); await sleep(1800); } // start + świeże dane
                            const target = item.mode === 'target';
                            if (!target && /Brak danych/.test($('#tcm-queue-box').text())) return false; // brak danych o stanie - spróbuje ponownie
                            let n = 0;
                            Object.keys(item.units || {}).forEach(u => {
                                const $in = $(`#tcm-rekrutacja-ui .limit-in[data-unit="${u}"]`);
                                if (!$in.length) return;
                                const add = parseInt(item.units[u], 10) || 0;
                                if (add <= 0) return;
                                const stock = parseInt($(`#tcm-curr-${u}`).text()) || 0;
                                const lim = parseInt($in.val()) || 0;
                                $in.val(target ? add : Math.max(lim, stock) + add).trigger('change').trigger('input');
                                n++;
                            });
                            $('#tcm-save-btn').click();
                            ctx.setRunning(isActive());
                            return { ok: true, msg: n ? `Rekrutacja: ustawiono limity (${n} jedn.), rekrutacja włączona.` : 'Rekrutacja: żadna z jednostek nie jest dostępna na tym świecie.' };
                        }
                    };
                }
            });
        }
    };

    // Ładowanie modułu z linku: pobranie tekstu i wykonanie (raw.githubusercontent nie pozwala na <script src>)
    async function loadModule(m) {
        const url = moduleUrl(m);
        if (!url || BOB.modules[m.id]) { updateModuleStatus(); return; }
        // skrypt rekrutacji mógł już zostać wczytany przez inny panel - wtedy tylko go przejmujemy
        if (m.adapter === 'rek-legacy' && document.getElementById('tcm-rekrutacja-ui')) { ADAPTERS[m.adapter](m); updateModuleStatus(); return; }
        let reason = '';
        try {
            const sep = url.includes('?') ? '&' : '?';
            const r = await fetch(url + sep + '_=' + Date.now(), { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status + ' (sprawdź link)');
            const code = await r.text() + '\n//# sourceURL=' + url;
            // najpierw eval (błąd EvalError = zablokowany przez CSP strony), potem wstrzyknięcie <script>
            let ran = false;
            try { (0, eval)(code); ran = true; }
            catch (e1) {
                if (e1 instanceof EvalError || /unsafe-eval|Content Security Policy/i.test(String(e1 && e1.message))) ran = false;
                else throw e1;
            }
            if (!ran) {
                const sc = document.createElement('script');
                sc.textContent = code;
                document.head.appendChild(sc);
                sc.remove();
            }
            if (!BOB.modules[m.id] && m.adapter && ADAPTERS[m.adapter]) ADAPTERS[m.adapter](m); // zwykły skrypt -> adapter
            if (!BOB.modules[m.id]) throw new Error('plik nie zarejestrował modułu (to nie jest moduł BOB)');
        } catch (e) {
            reason = (e && e.message) ? e.message : String(e);
            console.warn('TCM_BOB: moduł "' + m.id + '" niepodłączony (' + url + ')', e);
            $(`#tcm-panel-${m.id} .mod-ph`).text(`Moduł „${m.name}” niepodłączony: ${reason}`);
        }
        updateModuleStatus();
    }

    // =====================================================================
    //  UI: selektory, podgląd, tooltip, lista
    // =====================================================================
    function updateSelectOptions() {
        const $s = $('#bSelect');
        if (!$s.length) return;
        const cur = $s.val();
        const inQ = getInQueueCounts();
        let html = '';
        for (let b in PL_NAMES) html += `<option value="${b}">${PL_NAMES[b]} (${projectedLevel(b, inQ)}/${maxLevel(b)})</option>`;
        $s.html(html);
        if (cur && $s.find(`option[value="${cur}"]`).length) $s.val(cur);
    }

    // Osobny selektor akcji: bonusy + akcje udostępniane przez załadowane moduły
    function updateActionSelect() {
        const $s = $('#aSelect');
        if (!$s.length) return;
        $s.html(`<optgroup label="Bonusy">
            <option value="bonus:res30">Aktywuj Surowce 30%</option>
            <option value="bonus:build10">Aktywuj Budowa 10%</option></optgroup>
            <optgroup label="Akcje (wymagają modułu)">
            <option value="act:recruit">⚔️ Rekrutuj…</option>
            <option value="act:tech">🔬 Technologia…</option></optgroup>`);
    }

    function labelText(it) {
        if (it.t === 'b') return `${esc(PL_NAMES[it.b] || it.b)} (${DISP[it.id] || it.l})`;
        if (it.t === 'bonus') return esc(it.text);
        if (it.t === 'act') return esc(it.title || 'Akcja');
        const t = String(it.text || '').replace(/\{\{u:\w+\}\}/g, '');
        return esc(t.length > 28 ? t.slice(0, 28) + '…' : t);
    }

    function updateInsInfo() {
        const $i = $('#insInfo');
        if (!$i.length) return;
        const it = insertAfterId ? findById(insertAfterId) : null;
        if (it) {
            $i.html(`↳ wstawiam po: <b>${labelText(it)}</b> <button id="insReset" class="tcm-btn" style="padding:2px 10px; margin-left:6px;">✖</button>`);
        } else {
            insertAfterId = null;
            $i.html('Dodaję na końcu listy. <span style="color:#777;">Dotknij nazwy w liście, aby wstawiać po niej.</span>');
        }
    }

    function renderPreview() {
        const $p = $('#tcm-panel-prev');
        if (!$p.length) return;
        const inQ = getInQueueCounts();
        const steps = buildingObject.buildingQueue.filter(i => i.t === 'b').length;
        let cells = '';
        for (let b in PL_NAMES) {
            const cur = gameEffLevel(b, inQ);
            const fin = projectedLevel(b, inQ);
            const up = fin > cur;
            cells += `<div class="pv-cell ${up ? 'pv-up' : ''}">
                <img src="${iconSrc(b)}" alt="">
                <div><div class="pv-name">${PL_NAMES[b]}</div><div class="pv-lvl">${up ? cur + ' ➜ ' + fin : cur}</div></div>
            </div>`;
        }
        $p.html(`<div class="pv-title">Stan końcowy po kolejce (${steps} rozbudów)</div><div class="pv-grid">${cells}</div>`);
    }

    // ----- tooltip wytycznych (pełna treść) -----
    function infoHtml(it) {
        if (it.t === 'note') return rich(it.text);
        let h = '';
        if (it.u) h += '⚔️ ' + rich(it.u) + '<br>';
        if (it.c) h += rich(it.c);
        return h;
    }
    const hasInfo = it => it.t === 'note' || !!(it.c || it.u);

    function hideTip() { tipId = null; $('#tcm-tip').hide(); }

    function showTip(id, anchor) {
        const it = findById(id);
        if (!it) return hideTip();
        if (tipId === id) return hideTip();
        tipId = id;
        let $t = $('#tcm-tip');
        if (!$t.length) $t = $('<div id="tcm-tip"></div>').appendTo('body');
        $t.html(`<div>${infoHtml(it)}</div>
            <div class="tip-actions">
                <button class="tcm-btn tip-pin" data-id="${id}">${it.pinned ? '📌 Odepnij' : '📌 Przypnij'}</button>
                <button class="tcm-btn tip-close">Zamknij</button>
            </div>`).css({ visibility: 'hidden', display: 'block' });
        const r = anchor.getBoundingClientRect();
        const tw = $t.outerWidth(), th = $t.outerHeight();
        const left = Math.max(8, Math.min(r.left - tw - 8, window.innerWidth - tw - 8));
        const top = Math.max(8, Math.min(r.top + r.height / 2 - th / 2, window.innerHeight - th - 8));
        $t.css({ left: left, top: top, visibility: 'visible' });
    }

    // ----- lista -----
    function reloadQueueDisplay() {
        const table = $('#tcm-queue');
        if (!table.length) return;
        ensureIds();
        if (insertAfterId && indexById(insertAfterId) < 0) insertAfterId = null;
        table.find('.q-row, .q-sub').remove();
        const q = buildingObject.buildingQueue;
        const firstIdx = firstActionIdx();

        // Poziomy do wyświetlania liczone z kolejności na liście - zawsze rosnąco (1, 2, 3...)
        const inQ = getInQueueCounts();
        const sim = {};
        DISP = {};
        q.forEach(it => {
            if (it.t !== 'b') return;
            if (sim[it.b] === undefined) sim[it.b] = gameEffLevel(it.b, inQ);
            sim[it.b]++;
            DISP[it.id] = sim[it.b];
        });

        // Zwinięta lista: tyle pierwszych budynków, ile wynosi "Max"
        let limitIdx = q.length - 1;
        if (isQueueMinimized) {
            let cnt = 0; limitIdx = -1;
            for (let i = 0; i < q.length; i++) {
                limitIdx = i;
                if (q[i].t === 'b' && ++cnt >= buildingObject.buildingQueueLength) break;
            }
        }

        q.forEach((it, i) => {
            if (i > limitIdx) return;
            let labelHtml, labelStyle = 'color: var(--text-color);', extraBtns = '', clamp = false;

            if (it.t === 'note') {
                labelHtml = rich(it.text);
                labelStyle = '';
                clamp = !isGuideOpen; // wytyczna: do 2 linii (pełna treść w tooltipie lub po rozwinięciu 💬)
            } else if (it.t === 'bonus') {
                labelHtml = esc(it.text);
                labelStyle = 'color: #ff9800; font-weight: bold;';
                extraBtns = `
                    <button class="tcm-btn q-action-wait" title="Czekaj" style="background: var(--btn-blue-bg) !important;">⌛</button>
                    <button class="tcm-btn q-action-skip" data-id="${it.id}" title="Pomiń" style="background: var(--btn-green-bg) !important;">▶</button>`;
            } else if (it.t === 'act') {
                const meta = ACT_META[it.kind] || { icon: '▶', mod: it.mod };
                const mod = BOB.modules[it.mod || meta.mod];
                const toks = Object.keys(it.units || {}).map(u => it.kind === 'tech' ? `{{u:${u}}}` : `{{u:${u}}}${it.units[u]}`).join(' ');
                clamp = true;
                labelHtml = `${meta.icon} ${rich(toks)} ${esc(it.title || '')}` +
                    ((it.kind === 'recruit' && it.mode === 'target') ? ' <span style="color:#aaa; font-weight:normal;">(do stanu)</span>' : '') +
                    ((mod && mod.api) ? '' : ' <span style="color:#888; font-weight:normal;">(czeka na moduł)</span>');
                labelStyle = 'color: #ffb347; font-weight: bold;';
            } else {
                labelHtml = `<img class="q-bico" src="${iconSrc(it.b)}" alt="">${esc(PL_NAMES[it.b] || it.b)} (${DISP[it.id] || it.l})`;
            }
            if (it.pinned && !hasInfo(it)) labelHtml = '📌 ' + labelHtml;

            const stripe = i % 2 === 0 ? 'q-row-a' : 'q-row-b';
            // ikona wytycznych w osobnej kolumnie po lewej; 📌 gdy przypięta
            const infoCell = `<td class="q-infocell">${hasInfo(it)
                ? `<button class="tcm-btn q-info ${i === firstIdx ? 'q-info-cur' : ''}" data-id="${it.id}" title="Wytyczne">${it.pinned ? '📌' : '💬'}</button>` : ''}</td>`;
            const cls = ['q-row', stripe, i === firstIdx ? 'q-current' : '', it.id === insertAfterId ? 'q-sel' : '', it.pinned ? 'q-pinned' : ''].join(' ');
            const labelDiv = clamp
                ? `<div class="q-clamp">${labelHtml}</div>`
                : `<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${labelHtml}</div>`;
            table.append(`<tr class="${cls}" data-id="${it.id}">
                <td class="drag-handle" style="width:1%;">☰</td>
                ${infoCell}
                <td class="q-label ${it.t === 'note' ? 'q-note-text' : ''}" style="padding: 4px; width: 100%; max-width: 0; ${labelStyle}">${labelDiv}</td>
                <td class="q-actions" style="text-align:right; padding: 4px; white-space: nowrap; width:1%;">
                    ${extraBtns}
                    <button class="tcm-btn q-action" data-type="del" data-id="${it.id}" style="background: var(--btn-red-bg) !important; border-color: #ff003c !important; margin-left: 10px !important;">❌</button>
                </td>
            </tr>`);

            // wytyczne pod pozycją: przy bieżącej (skrót) albo przy wszystkich po włączeniu 💬 w nagłówku (pełna treść)
            if (it.t !== 'note' && hasInfo(it) && (isGuideOpen || i === firstIdx)) {
                table.append(`<tr class="q-sub ${stripe}"><td colspan="4"><div class="q-extra ${isGuideOpen ? '' : 'q-clamp'}">${infoHtml(it)}</div></td></tr>`);
            }
        });

        if (limitIdx < q.length - 1) {
            const restB = q.slice(limitIdx + 1).filter(x => x.t === 'b').length;
            table.append(`<tr class="q-row q-more"><td colspan="4">… jeszcze ${restB} budynków w kolejce (rozwiń 🔽)</td></tr>`);
        }
        updateSelectOptions();
        updateInsInfo();
        renderPreview();
    }

    // =====================================================================
    //  PARSER SZABLONÓW
    // =====================================================================
    const unitText = s => (s || '').replace(/\[unit\]\s*(\w+)\s*\[\/unit\]/gi, (m, u) => `{{u:${u.toLowerCase()}}}`);
    const stripBB = s => (s || '').replace(/\[\/?[a-z*][^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
    const bonusLabel = p => /30\s*%/.test(p) ? 'Aktywuj Surowce 30%' : (/10\s*%/.test(p) ? 'Aktywuj Budowa 10%' : p);
    const splitRows = t => String(t).replace(/\r/g, '')
        .replace(/\[\*\*\]/g, '\n[**]').replace(/\[\*\]/g, '\n')
        .replace(/\[\/\*\*?\]/g, '\n').replace(/\[\/?table\]/gi, '\n').split('\n');
    const TECH_RX = /technolog|zbadaj|badaj|badani/;

    // jednostki wymienione z nazwy (po normalizacji tekstu)
    function unitsInText(n) {
        const found = [];
        UNIT_RX.forEach(([u, rx]) => {
            if (!rx.test(n)) return;
            if (u === 'archer' && found.includes('marcher')) return;
            found.push(u);
        });
        return found;
    }

    // ilości z tekstu: "200 pik", "pikinier 200", "40 zwiad"
    function parseUnitCounts(n) {
        const out = {};
        UNIT_RX.forEach(([u, rx]) => {
            if (u === 'archer' && out.marcher) return;
            const before = n.match(new RegExp('(\\d{1,5})\\s*(?:x|szt\\.?)?\\s*(?:' + rx.source + ')'));
            const after = n.match(new RegExp('(?:' + rx.source + ')\\w*\\s*[:x=]?\\s*(\\d{1,5})'));
            const m = before || after;
            if (m) out[u] = parseInt(m[1], 10);
        });
        return out;
    }

    // Akcja (rekrutacja / technologia) rozpoznana z samego tekstu wytycznej
    function actFromText(flat, title) {
        const n = norm(flat);
        if (TECH_RX.test(n)) {
            const us = unitsInText(n);
            if (us.length) { const units = {}; us.forEach(u => units[u] = 1); return { t: 'act', kind: 'tech', mod: 'tech', title: title || 'Technologia', units: units, c: flat }; }
        }
        if (/rekrut/.test(n)) {
            const cnt = parseUnitCounts(n);
            if (Object.keys(cnt).length) return { t: 'act', kind: 'recruit', mod: 'rek', title: title || 'Rekrutacja', units: cnt, c: flat };
        }
        return null;
    }

    function processTemplate(text) {
        return /\[building\]/i.test(text) ? processStructured(text) : processGeneric(text);
    }

    // Czy tekst to "sama nazwa budynku" (opcjonalnie z poziomem): zwraca {code, level|null}
    function plainBuilding(text) {
        const n = norm(stripBB(text));
        if (!n || n.length > 40) return null;
        for (const code in NAME_RX) {
            const m = n.match(NAME_RX[code]);
            if (!m) continue;
            let end = m.index + m[0].length;
            while (end < n.length && /[a-z]/.test(n[end])) end++; // dokończ słowo (końcówki odmiany)
            const rest = (n.slice(0, m.index) + ' ' + n.slice(end))
                .replace(/poziom|pzm\.?|lvl\.?|lv\.?|[()\-:.,]/g, ' ').replace(/\s+/g, ' ').trim();
            const tokens = rest.split(' ').filter(Boolean);
            const digits = tokens.filter(t => /^\d{1,2}$/.test(t));
            const others = tokens.filter(t => !/^\d{1,2}$/.test(t) && !['obronny', 'nicza'].includes(t));
            if (others.length || digits.length > 1) return null;
            return { code, level: digits.length ? parseInt(digits[0], 10) : null };
        }
        return null;
    }

    // Szablony z tagami [building]kod[/building]: LP | Budynek | czasy | Jednostki | Komentarz
    function processStructured(text) {
        const src = String(text).replace(/\r/g, '');
        const inQ = getInQueueCounts();
        let virtual = {};
        for (let b in PL_NAMES) virtual[b] = projectedLevel(b, inQ);
        const out = [], army = [];
        let nB = 0, nBonus = 0, nN = 0, nA = 0;

        const addUpgrade = (code, level, extra) => {
            level = Math.min(level, maxLevel(code));
            const before = virtual[code];
            for (let l = before + 1; l <= level; l++) {
                const it = { t: 'b', b: code, l };
                if (l === level && extra) { if (extra.c) it.c = extra.c; if (extra.u) it.u = extra.u; }
                out.push(it); nB++;
            }
            if (level > before) { virtual[code] = level; return true; }
            return false;
        };

        const sp = src.match(/\[spoiler=([^\]]+)\]/i);
        if (sp) { out.push({ t: 'note', text: `📜 Szablon: ${sp[1].trim()}` }); nN++; }

        splitRows(src).forEach(raw => {
            const row = raw.trim();
            if (!row || row.startsWith('[**]')) return;
            const cells = row.split(/\[\|{1,2}\]/);
            const tag = row.match(/\[building\]\s*(\w+)\s*\[\/building\]/i);

            if (!tag) {
                if (cells.length >= 4) { // tabela "Wojsko łącznie"
                    const last = stripBB(cells[cells.length - 1]);
                    const um = cells[0].match(/\[unit\]\s*(\w+)\s*\[\/unit\]/i);
                    const name = stripBB(cells[0].replace(/\[unit\]\s*\w+\s*\[\/unit\]/gi, ''));
                    if (/^\d+$/.test(last) && last !== '0') army.push(um ? `{{u:${um[1].toLowerCase()}}}${last}` : `${name} ${last}`);
                } else { // sama nazwa budynku w osobnej linii
                    const pb = plainBuilding(cells.join(' '));
                    if (pb) addUpgrade(pb.code, pb.level !== null ? pb.level : virtual[pb.code] + 1);
                }
                return;
            }

            const code = tag[1].toLowerCase();
            const bi = Math.max(0, cells.findIndex(c => /\[building\]/i.test(c)));
            const title = stripBB(cells[bi].replace(/\[building\][^\[]*\[\/building\]/gi, ''));
            const unitsRaw = cells[bi + 4] || '';
            const units = stripBB(unitText(unitsRaw));
            const comment = stripBB(cells.slice(bi + 5).join('; '));
            const parts = comment.split(';').map(x => x.trim()).filter(Boolean);
            const bonusParts = parts.filter(p => norm(p).includes('aktywuj'));
            const recParts = parts.filter(p => !norm(p).includes('aktywuj') && norm(p).includes('rekrut'));
            const otherParts = parts.filter(p => !norm(p).includes('aktywuj') && !norm(p).includes('rekrut'));

            const isMission = /z misji/i.test(stripBB(unitsRaw));
            const tagUnits = [];
            for (const m of unitsRaw.matchAll(/\[unit\]\s*(\w+)\s*\[\/unit\]\s*(\d*)/gi)) {
                const u = m[1].toLowerCase();
                if (REK_ALL.includes(u)) tagUnits.push([u, parseInt(m[2], 10) || 0]);
            }
            const rowNorm = norm(title + ' ' + comment);

            // technologie: jednostki z tagów lub z nazw w tekście wiersza
            const techUnits = {};
            if (TECH_RX.test(rowNorm)) {
                tagUnits.forEach(([u]) => techUnits[u] = 1);
                unitsInText(rowNorm).forEach(u => techUnits[u] = 1);
            }
            const isTechRow = Object.keys(techUnits).length > 0;

            // rekrutacja: jednostki z tagów (nie "z misji", nie technologie)
            const recUnits = {};
            if (!isMission && !isTechRow) tagUnits.forEach(([u, n]) => { if (n > 0) recUnits[u] = (recUnits[u] || 0) + n; });
            const hasRec = Object.keys(recUnits).length > 0;

            let level = null;
            if (PL_NAMES[code]) {
                const lv = title.match(/\(poziom\s*(\d+)\)/i);
                if (lv) level = parseInt(lv[1], 10);
                else {
                    const pb = plainBuilding(title); // np. samo "Koszary" => kolejny poziom
                    if (pb && pb.code === code) level = pb.level !== null ? pb.level : virtual[code] + 1;
                }
            }

            if (level !== null) {
                const bComment = (hasRec ? otherParts : otherParts.concat(recParts)).join('; ');
                addUpgrade(code, level, { c: bComment, u: (hasRec || isTechRow) ? '' : units });
                // bonus dodawany zawsze - także gdy budynek z tego kroku jest już zbudowany
                bonusParts.forEach(p => { out.push({ t: 'bonus', text: bonusLabel(p) }); nBonus++; });
                if (hasRec) { out.push({ t: 'act', kind: 'recruit', mod: 'rek', title: 'Rekrutacja', units: recUnits, c: recParts.join('; ') }); nA++; }
                if (isTechRow) { out.push({ t: 'act', kind: 'tech', mod: 'tech', title: 'Technologia', units: techUnits, c: comment }); nA++; }
            } else if (isTechRow) { // krok bez poziomu: technologia
                out.push({ t: 'act', kind: 'tech', mod: 'tech', title: title || 'Technologia', units: techUnits, c: comment }); nA++;
            } else if (hasRec) { // krok bez poziomu z jednostkami -> rekrutacja
                out.push({ t: 'act', kind: 'recruit', mod: 'rek', title: title || 'Rekrutacja', units: recUnits, c: comment }); nA++;
            } else {
                const a = actFromText(title + ' ' + comment, title); // rekrutacja/technologia zapisana tylko słowami
                if (a) { out.push(a); nA++; }
                else { // odbiór nagród, jednostki z misji itp. -> wytyczna
                    let txt = title;
                    const unitsShown = units.replace(/^z misji:\s*/i, '');
                    if (unitsShown) txt += `: ${unitsShown}`;
                    if (comment) txt += ` — ${comment}`;
                    out.push({ t: 'note', text: txt }); nN++;
                }
            }
        });

        if (army.length) { out.push({ t: 'note', text: `Wojsko łącznie: ${army.join(' ')}` }); nN++; }

        if (out.length) {
            buildingObject.buildingQueue.push(...out);
            updateLocalStorage();
            reloadQueueDisplay();
            UI.SuccessMessage(`Dodano: budynki ${nB}, bonusy ${nBonus}, akcje ${nA}, wytyczne ${nN}.`);
        } else {
            UI.ErrorMessage("Nie dodano nic - spełniasz już wymagania lub błędny kod.");
        }
    }

    function processGeneric(text) {
        const inQ = getInQueueCounts();
        let virtual = {};
        for (let b in PL_NAMES) virtual[b] = projectedLevel(b, inQ);
        let addedB = 0, addedN = 0, addedBonus = 0, addedA = 0;

        splitRows(text).forEach(raw => {
            const row = raw.trim();
            if (!row || row.startsWith('[**]')) return; // nagłówek tabeli

            const cells = row.split(/\[\|{1,2}\]/).map(c => c.replace(/\[\/?[a-z*][^\]]*\]/gi, '').trim());
            const flat = cells.filter(Boolean).join(' ').trim();
            if (!flat || /^[-|\/\\\s]+$/.test(flat) || /^\d+$/.test(flat)) return;

            const nCells = cells.map(norm);
            const nFlat = norm(flat);

            const hasBuilding = Object.values(NAME_RX).some(rx => rx.test(nFlat));
            if (nFlat.includes('aktywuj') && !hasBuilding) {
                buildingObject.buildingQueue.push({ t: 'bonus', text: flat });
                addedBonus++;
                return;
            }

            let mentions = [];
            nCells.forEach((c, ci) => {
                for (const code in NAME_RX) {
                    const rx = new RegExp(NAME_RX[code].source, 'g');
                    let m;
                    while ((m = rx.exec(c))) mentions.push({ code, ci, start: m.index, end: m.index + m[0].length });
                }
            });
            mentions.sort((a, b) => a.ci - b.ci || a.start - b.start);

            if (!mentions.length || nFlat.includes('szablon budowy')) {
                if (!mentions.length && /^(lp|nr|budynek|poziom|lvl)(\s|$)/.test(nFlat)) return;
                const a = actFromText(flat);
                if (a) { buildingObject.buildingQueue.push(a); addedA++; return; }
                if (flat.length > 3) {
                    buildingObject.buildingQueue.push({ t: 'note', text: flat });
                    addedN++;
                }
                return;
            }

            mentions.forEach(m => {
                const maxL = maxLevel(m.code);
                const nextSame = mentions.find(x => x.ci === m.ci && x.start > m.start);
                const seg = nCells[m.ci].slice(m.end, nextSame ? nextSame.start : undefined);
                let target = null;
                let lm = seg.match(/^[^\d]{0,12}?(\d{1,2})\b/);
                if (lm) target = parseInt(lm[1], 10);

                if (target === null && !nextSame) {
                    for (let cj = m.ci + 1; cj < nCells.length; cj++) {
                        if (mentions.some(x => x.ci === cj)) break;
                        if (nCells[cj].length <= 20) {
                            const cm = nCells[cj].match(/^[^\d]{0,12}?(\d{1,2})\b/);
                            if (cm) { target = parseInt(cm[1], 10); break; }
                        }
                    }
                }

                if (target !== null) {
                    target = Math.min(target, maxL);
                    for (let l = virtual[m.code] + 1; l <= target; l++) {
                        buildingObject.buildingQueue.push({ t: 'b', b: m.code, l });
                        addedB++;
                    }
                    if (target > virtual[m.code]) virtual[m.code] = target;
                } else if (virtual[m.code] < maxL) {
                    virtual[m.code]++;
                    buildingObject.buildingQueue.push({ t: 'b', b: m.code, l: virtual[m.code] });
                    addedB++;
                }
            });

            if (nFlat.includes('aktywuj')) {
                buildingObject.buildingQueue.push({ t: 'bonus', text: flat });
                addedBonus++;
            }
            if (nFlat.includes('rekrut') || TECH_RX.test(nFlat)) {
                const a = actFromText(flat);
                if (a) { buildingObject.buildingQueue.push(a); addedA++; }
                else { buildingObject.buildingQueue.push({ t: 'note', text: flat }); addedN++; }
            }
        });

        if (addedB + addedN + addedBonus + addedA > 0) {
            updateLocalStorage();
            reloadQueueDisplay();
            UI.SuccessMessage(`Dodano: budynki ${addedB}, bonusy ${addedBonus}, akcje ${addedA}, notatki ${addedN}.`);
        } else {
            UI.ErrorMessage("Nie dodano nic - spełniasz już wymagania lub błędny kod.");
        }
    }

    function fetchTemplate(url) {
        UI.InfoMessage("Pobieranie...", 1000);
        $.ajax({ url: url, type: 'GET', cache: false, dataType: 'text' })
        .done(text => processTemplate(text))
        .fail(() => UI.ErrorMessage("Wystąpił błąd podczas pobierania szablonu."));
    }

    // =====================================================================
    //  SZUFLADA Z ZAKŁADKAMI (prawa ściana ekranu)
    // =====================================================================
    function applyTab() {
        const exists = activeTab && $(`#tcm-panel-${activeTab}`).length;
        $('.tcm-panel').hide();
        $('#tcm-panels').toggle(!!exists);
        if (exists) $(`#tcm-panel-${activeTab}`).show();
        $('.tcm-tab').each(function() { $(this).toggleClass('tcm-tab-active', !!exists && $(this).attr('data-tab') === activeTab); });
    }

    function bindTabs() {
        $('#tcm-tabs').on('click', '.tcm-tab', function() {
            const t = $(this).attr('data-tab');
            activeTab = (activeTab === t) ? '' : t;
            localStorage.setItem('tcmTab', activeTab);
            applyTab();
            if (activeTab === 'prev') renderPreview();
        });
    }

    // ---------- Okna dodawania akcji (UI w rdzeniu; wykonanie robi moduł z linku) ----------
    const activeUnitList = () => REK_ALL.filter(u => game_data.units && game_data.units.includes(u));

    function openRecruitDialog() {
        const units = activeUnitList();
        const $b = BOB.modal(`
            <div style="font-weight:bold; color:var(--title-color); margin-bottom:6px;">⚔️ Rekrutuj - ile czego</div>
            <input type="text" id="rec-title" placeholder="Nazwa (opcjonalnie), np. Żelazny deff">
            <select id="rec-mode" style="width:100%; margin-top:6px; background:var(--bg-row-alt); color:#fff; border:1px solid var(--border-color); border-radius:3px; padding:6px; font-size:12px;">
                <option value="add">➕ Dodaj do obecnych (rekrutuj o tyle więcej)</option>
                <option value="target">🎯 Do stanu (limit jak w panelu: 1000 = razem 1000)</option>
            </select>
            <div class="rec-grid">${units.map(u => `<div class="rec-cell"><img src="${unitIcon(u)}" alt="${u}"><input type="number" min="0" class="rec-in" data-unit="${u}" placeholder="0"></div>`).join('')}</div>
            <div style="display:flex; gap:6px; justify-content:flex-end;">
                <button class="tcm-btn" id="rec-cancel">Anuluj</button>
                <button class="tcm-btn" id="rec-add" style="background: var(--btn-green-bg) !important;">➕ Dodaj do listy</button>
            </div>
            <div style="margin-top:8px; font-size:10px; color:#aaa;">Po dojściu do tej pozycji ilości trafią do limitów w module rekrutacji i rekrutacja ruszy sama. Wymaga podłączonego modułu rekrutacji (link w kodzie).</div>`);
        $b.find('#rec-cancel').click(BOB.closeModal);
        $b.find('#rec-add').click(() => {
            const un = {};
            $b.find('.rec-in').each(function() { const n = parseInt($(this).val(), 10) || 0; if (n > 0) un[$(this).data('unit')] = n; });
            if (!Object.keys(un).length) return UI.ErrorMessage('Wpisz ilość przynajmniej jednej jednostki.');
            insertItem({ t: 'act', kind: 'recruit', mod: 'rek', mode: $b.find('#rec-mode').val() === 'target' ? 'target' : 'add', title: ($b.find('#rec-title').val() || '').trim() || 'Rekrutacja', units: un, c: '' });
            BOB.closeModal();
        });
    }

    function openTechDialog() {
        const units = activeUnitList();
        const $b = BOB.modal(`
            <div style="font-weight:bold; color:var(--title-color); margin-bottom:6px;">🔬 Technologia - co zbadać</div>
            <input type="text" id="tech-title" placeholder="Nazwa (opcjonalnie)">
            <div class="rec-grid">${units.map(u => `<label class="rec-cell"><input type="checkbox" class="tech-in" data-unit="${u}"><img src="${unitIcon(u)}" alt="${u}"></label>`).join('')}</div>
            <div style="display:flex; gap:6px; justify-content:flex-end;">
                <button class="tcm-btn" id="tech-cancel">Anuluj</button>
                <button class="tcm-btn" id="tech-add" style="background: var(--btn-green-bg) !important;">➕ Dodaj do listy</button>
            </div>
            <div style="margin-top:8px; font-size:10px; color:#aaa;">Wymaga podłączonego modułu technologii (link w kodzie). Bez niego pozycja czeka na liście i nie blokuje budowy.</div>`);
        $b.find('#tech-cancel').click(BOB.closeModal);
        $b.find('#tech-add').click(() => {
            const un = {};
            $b.find('.tech-in:checked').each(function() { un[$(this).data('unit')] = 1; });
            if (!Object.keys(un).length) return UI.ErrorMessage('Zaznacz przynajmniej jedną jednostkę.');
            insertItem({ t: 'act', kind: 'tech', mod: 'tech', title: ($b.find('#tech-title').val() || '').trim() || 'Technologia', units: un, c: '' });
            BOB.closeModal();
        });
    }

    // ---------- Status modułów ----------
    function updateRewardsState() {
        const on = !!BOB.modules.nagrody;
        $('#rewardsState').html(on ? '<span style="color:#6bbf6b;">moduł OK</span>' : '<span style="color:#888;">brak modułu</span>');
        $('.tcm-tab[data-tab="rek"]').toggleClass('tcm-tab-run', !!(BOB.modules.rek && BOB.modules.rek.api && BOB.modules.rek.api.isActive && BOB.modules.rek.api.isActive()));
    }

    function updateModuleStatus() {
        updateRewardsState();
    }

    // =====================================================================
    //  INIT
    // =====================================================================
    function init() {
        let storage = JSON.parse(localStorage.getItem('buildingObject') || "{}");
        if (storage[game_data.village.id]) {
            buildingObject = { ...buildingObject, ...storage[game_data.village.id] };
            if (buildingObject.autoFarmLimit === undefined) buildingObject.autoFarmLimit = 0;
        }
        normalizeQueue();
        updateLocalStorage();

        const menuHtml = `
            <div id="tcm-wrap">
            <div id="kalkulatorBudowyMain">
                <h4>🛠️ BOB 🛠️</h4>
                <table id="kalkulatorBudowyTabela" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td colspan="3" style="padding-bottom: 6px; text-align:center;">
                            <button id="startBtn" class="tcm-btn ${buildingObject.status ? 'tcm-btn-active' : ''}">${buildingObject.status ? '❎️ Stop' : '✅️ Start'}</button>
                            <button id="clearQueueBtn" class="tcm-btn">🗑️ Wyczyść</button>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding: 3px 0;">
                            <div style="display:flex; align-items:center; gap:2px;">
                                <select id="bSelect" title="Budynki" style="flex:1; width:100%; min-width:0;"></select>
                                <button id="addBBtn" class="tcm-btn" style="font-size: 14px; padding: 4px 10px;">➕</button>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding: 3px 0;">
                            <div style="display:flex; align-items:center; gap:2px;">
                                <select id="aSelect" title="Akcje: bonusy, rekrutacja, technologie" style="flex:1; width:100%; min-width:0;"></select>
                                <button id="addABtn" class="tcm-btn" style="font-size: 14px; padding: 4px 10px;">➕</button>
                            </div>
                        </td>
                    </tr>
                    <tr><td colspan="3" id="insInfo"></td></tr>
                    <tr>
                        <td colspan="2" style="text-align:left; padding: 4px 0; font-size: 11px; white-space: nowrap;">
                            Zagr: <select id="farmLimitInput" style="width:50px; text-align:center; padding:2px;">
                                <option value="0" ${buildingObject.autoFarmLimit === 0 ? 'selected' : ''}>Wył</option>
                                <option value="5" ${buildingObject.autoFarmLimit === 5 ? 'selected' : ''}>5%</option>
                                <option value="10" ${buildingObject.autoFarmLimit === 10 ? 'selected' : ''}>10%</option>
                                <option value="15" ${buildingObject.autoFarmLimit === 15 ? 'selected' : ''}>15%</option>
                                <option value="20" ${buildingObject.autoFarmLimit === 20 ? 'selected' : ''}>20%</option>
                            </select>
                        </td>
                        <td style="text-align:right; padding: 4px 0; font-size: 11px; white-space: nowrap;">
                            Max: <select id="qLenInput" style="width:44px; text-align:center; padding:2px;">
                                ${[1,2,3,4,5].map(n => `<option value="${n}" ${n === buildingObject.buildingQueueLength ? 'selected' : ''}>${n}</option>`).join('')}
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding: 2px 0 6px; font-size: 11px;">
                            <label style="display:flex; align-items:center; gap:6px;">
                                <input type="checkbox" id="rewardsChk" ${rewardsOn ? 'checked' : ''} style="width:18px; height:18px;">
                                🎁 Odbieraj dzienne nagrody <span id="rewardsState" style="font-size:10px;"></span>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th colspan="3" style="padding: 4px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Szablon / kolejka</span>
                                <span>
                                    <button id="toggleGuideBtn" class="tcm-btn ${isGuideOpen ? 'tcm-btn-active' : ''}" title="Rozwiń wszystkie wytyczne" style="padding: 2px 8px; font-size:14px;">💬</button>
                                    <button id="toggleQueueBtn" class="tcm-btn" style="padding: 2px 8px; font-size:14px;">${isQueueMinimized ? '🔽' : '🔼'}</button>
                                </span>
                            </div>
                        </th>
                    </tr>
                </table>
                <table id="tcm-queue"></table>

                <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin-top: 10px;">
                    <button id="btn-eko1" class="tcm-btn" style="flex: 1 1 30%;">EKO</button>
                    <button id="btn-eko2" class="tcm-btn" style="flex: 1 1 30%;">EKO27</button>
                    <button id="btn-manual" class="tcm-btn" style="flex: 1 1 30%; color: #00bcd4 !important;">WŁASNY</button>
                </div>

                <div id="manual-tpl-container" style="display:none; margin-top: 6px; flex-direction:column; gap:4px;">
                    <textarea id="manual-tpl-input" style="background:var(--bg-row-alt); color:var(--text-color); border:1px solid var(--border-color); width:100%; height:80px; font-size:11px; padding:4px;" placeholder="Wklej tutaj szablon (BB code)"></textarea>
                    <button id="btn-analyze-manual" class="tcm-btn" style="border-color:#00bcd4 !important;">Importuj</button>
                </div>
            </div>
            <div id="tcm-tabs">
                <button class="tcm-tab" data-tab="prev" title="Stan końcowy po kolejce"><img src="${gfx()}buildings/main.png" alt=""></button>
                ${MODULES.filter(m => m.panel).map(m => `<button class="tcm-tab" data-tab="${m.id}" title="${esc(m.name)} (moduł)"><img src="${gfx()}${m.icon}" alt=""></button>`).join('')}
            </div>
            <div id="tcm-panels">
                <div id="tcm-panel-prev" class="tcm-panel"></div>
                ${MODULES.filter(m => m.panel).map(m => `<div id="tcm-panel-${m.id}" class="tcm-panel"><div class="mod-ph">Moduł „${esc(m.name)}” niepodłączony - podmień link w kodzie (MODULES).</div></div>`).join('')}
            </div>
            </div>`;

        $('#tcm-drawer, #tcm-tip, #tcm-modal').remove();
        $('#tcm-wrap, #kalkulatorBudowyMain').remove();
        $('#content_value').prepend(menuHtml);

        bindTabs();
        updateActionSelect();
        applyTab();
        updateRewardsState();
        BOB.ready = true;
        BOB.pending.splice(0).forEach(registerModule);

        // --- sterowanie ---
        $('#clearQueueBtn').click(() => {
            const pinned = buildingObject.buildingQueue.filter(it => it.pinned).length;
            if (confirm(pinned ? `Wyczyścić kolejkę? Przypięte pozycje (${pinned}) zostaną.` : "Wyczyścić kolejkę oraz notatki?")) {
                buildingObject.buildingQueue = buildingObject.buildingQueue.filter(it => it.pinned);
                insertAfterId = null;
                renumberLevels();
                updateLocalStorage();
                reloadQueueDisplay();
            }
        });

        $('#addBBtn').click(() => {
            const b = $('#bSelect').val();
            if (!b) return;
            cleanupQueue(true);
            const next = projectedLevel(b) + 1;
            if (next > maxLevel(b)) { UI.ErrorMessage(`Osiągnięto maksymalny poziom dla: ${PL_NAMES[b]}`); return; }
            insertItem({ t: 'b', b: b, l: next });
        });

        $('#addABtn').click(() => {
            const v = $('#aSelect').val();
            if (!v) return;
            if (v === 'bonus:res30') insertItem({ t: 'bonus', text: 'Aktywuj Surowce 30%' });
            else if (v === 'bonus:build10') insertItem({ t: 'bonus', text: 'Aktywuj Budowa 10%' });
            else if (v === 'act:recruit') openRecruitDialog();
            else if (v === 'act:tech') openTechDialog();
        });

        // nagrody (moduł z linku w kodzie)
        $('#rewardsChk').on('change', function() {
            rewardsOn = $(this).is(':checked');
            localStorage.setItem('TCM_BOB_rewards', rewardsOn ? '1' : '0');
            const m = BOB.modules.nagrody;
            if (m && m.api && typeof m.api.setEnabled === 'function') m.api.setEnabled(rewardsOn);
            else if (rewardsOn) UI.InfoMessage('Moduł nagród niepodłączony (link w kodzie).', 3000);
        });

        $('#startBtn').click(function() {
            buildingObject.status = !buildingObject.status;
            $(this).text(buildingObject.status ? "❎️ Stop" : "✅️ Start").toggleClass('tcm-btn-active', buildingObject.status);
            updateLocalStorage();
            if (buildingObject.status) uruchomBudowe();
        });

        $('#toggleQueueBtn').click(function() {
            isQueueMinimized = !isQueueMinimized; localStorage.setItem('queueMinimized', JSON.stringify(isQueueMinimized));
            $(this).text(isQueueMinimized ? '🔽' : '🔼'); reloadQueueDisplay();
        });

        $('#toggleGuideBtn').click(function() {
            isGuideOpen = !isGuideOpen; localStorage.setItem('guideOpen', JSON.stringify(isGuideOpen));
            $(this).toggleClass('tcm-btn-active', isGuideOpen); reloadQueueDisplay();
        });

        $('#farmLimitInput').on('change', function() {
            buildingObject.autoFarmLimit = parseInt($(this).val(), 10) || 0;
            updateLocalStorage();
        });

        $('#qLenInput').on('change', function() { buildingObject.buildingQueueLength = parseInt($(this).val(), 10) || 5; updateLocalStorage(); reloadQueueDisplay(); });

        // zaznaczenie punktu wstawiania (dotknięcie nazwy w liście)
        $('#tcm-queue').on('click', '.q-label', function() {
            const id = $(this).closest('tr').attr('data-id');
            if (!id) return;
            insertAfterId = (insertAfterId === id) ? null : id;
            reloadQueueDisplay();
        });
        $('#kalkulatorBudowyMain').on('click', '#insReset', function() { insertAfterId = null; reloadQueueDisplay(); });

        // tooltip wytycznych
        $('#tcm-queue').on('click', '.q-info', function(e) {
            e.stopPropagation();
            showTip($(this).attr('data-id'), this);
        });
        $(document).on('click', '.tip-close', hideTip);
        $(document).on('click', '.tip-pin', function() {
            const it = findById($(this).attr('data-id'));
            if (it) {
                it.pinned = !it.pinned;
                updateLocalStorage();
                UI.InfoMessage(it.pinned ? 'Przypięto - pozycja nie zniknie sama.' : 'Odpięto.', 1500);
            }
            hideTip();
            reloadQueueDisplay();
        });
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#tcm-tip, .q-info').length) hideTip();
        });
        $(window).on('scroll', hideTip);

        $('#tcm-queue').on('click', '.q-action-wait', function() {
            buildingObject.status = false;
            $('#startBtn').text("✅️ Start").removeClass('tcm-btn-active');
            updateLocalStorage();
            UI.InfoMessage("Kolejka wstrzymana na bonusie.");
        });

        $('#tcm-queue').on('click', '.q-action-skip', function() {
            const i = indexById($(this).attr('data-id'));
            if (i > -1) buildingObject.buildingQueue.splice(i, 1);
            updateLocalStorage();
            reloadQueueDisplay();
            if (buildingObject.status) uruchomBudowe();
        });

        $('#tcm-queue').on('click', '.q-action', function() {
            if ($(this).data('type') !== 'del') return;
            const id = $(this).attr('data-id');
            const it = findById(id);
            if (it && it.pinned && !confirm('Ta pozycja jest przypięta. Usunąć mimo to?')) return;
            cleanupQueue(true);
            const i = indexById(id);
            if (i > -1) buildingObject.buildingQueue.splice(i, 1);
            if (insertAfterId === id) insertAfterId = null;
            renumberLevels();
            updateLocalStorage(); reloadQueueDisplay();
        });

        // przeciąganie (dotyk)
        let dragId = null, dragEl = null;
        $('#tcm-queue').on('touchstart', '.drag-handle', function() {
            dragEl = $(this).closest('.q-row');
            dragId = dragEl.attr('data-id');
            dragEl.css({opacity: '0.4', background: 'var(--bg-row-alt)'});
        }).on('touchmove', '.drag-handle', function(e) {
            e.preventDefault();
            const touch = e.originalEvent.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            $('.q-row').removeClass('drag-over');
            const targetTr = $(target).closest('.q-row');
            if (targetTr.length && targetTr.attr('data-id') !== dragId) targetTr.addClass('drag-over');
        }).on('touchend', '.drag-handle', function(e) {
            if (dragEl) dragEl.css({opacity: '1', background: ''});
            $('.q-row').removeClass('drag-over');
            const touch = e.originalEvent.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetId = $(target).closest('.q-row').attr('data-id');
            if (dragId && targetId && targetId !== dragId) {
                cleanupQueue(true);
                const from = indexById(dragId);
                if (from > -1 && indexById(targetId) > -1) {
                    const item = buildingObject.buildingQueue.splice(from, 1)[0];
                    buildingObject.buildingQueue.splice(indexById(targetId), 0, item);
                    renumberLevels();
                    updateLocalStorage(); reloadQueueDisplay();
                }
            }
            dragEl = null; dragId = null;
        });

        $('#btn-eko1').click(() => fetchTemplate(LINKS.eko1));
        $('#btn-eko2').click(() => fetchTemplate(LINKS.eko2));
        $('#btn-manual').click(() => $('#manual-tpl-container').toggle());
        $('#btn-analyze-manual').click(() => {
            const text = $('#manual-tpl-input').val();
            if (!text) return UI.ErrorMessage("Wklej najpierw kod w pole!");
            processTemplate(text);
            $('#manual-tpl-input').val('');
            $('#manual-tpl-container').hide();
        });

        cleanupQueue();
        reloadQueueDisplay();

        // moduły z linków (po zbudowaniu UI); po załadowaniu ruszamy silnik
        Promise.all(MODULES.map(m => loadModule(m))).then(() => {
            if (buildingObject.status) uruchomBudowe();
        });
    }

    // =====================================================================
    //  SILNIK BUDOWY
    // =====================================================================
    $(document).ajaxSuccess(function(event, xhr, settings, data) {
        if (settings.url && settings.url.includes('ajaxaction=upgrade_building') && expectedBuild) {
            if (data && data.response && data.response.success) {
                const i = indexById(expectedBuild.id);
                if (i > -1) removeAt(i);
                updateLocalStorage();
                reloadQueueDisplay();
                expectedBuild = null;
                isBuilding = false;
                setTimeout(uruchomBudowe, Math.floor(Math.random() * 1000) + 2000);
            } else {
                isBuilding = false;
                expectedBuild = null;
            }
        }
    });

    $(document).ajaxError(function(event, xhr, settings) {
        if (settings.url && settings.url.includes('ajaxaction=upgrade_building') && expectedBuild) {
            isBuilding = false;
            expectedBuild = null;
        }
    });

    // Odpala akcję modułu (np. rekrutacja). Moduł może odpowiedzieć od razu albo obietnicą (Promise).
    const busyActs = new Set();
    function finishAct(it, res) {
        const ok = res === true || !!(res && res.ok);
        if (!ok) return false;
        const i = indexById(it.id);
        if (i > -1) buildingObject.buildingQueue.splice(i, 1);
        if (insertAfterId === it.id) insertAfterId = null;
        updateLocalStorage();
        reloadQueueDisplay();
        if (res && res.msg) UI.InfoMessage(res.msg, 3000);
        return true;
    }
    function runAct(it) {
        if (busyActs.has(it.id)) return false;
        const meta = ACT_META[it.kind] || {};
        const mod = BOB.modules[it.mod || meta.mod];
        if (!mod || !mod.api || typeof mod.api.run !== 'function') return false; // moduł niezaładowany - pomijamy, budowa idzie dalej
        let res;
        try { res = mod.api.run(it); } catch (e) { console.warn('TCM_BOB: błąd akcji', e); return false; }
        if (res && typeof res.then === 'function') {
            busyActs.add(it.id);
            res.then(r => { busyActs.delete(it.id); finishAct(it, r); })
               .catch(e => { busyActs.delete(it.id); console.warn('TCM_BOB: błąd akcji', e); });
            return false; // wynik przyjdzie później; budowa idzie dalej
        }
        return finishAct(it, res);
    }

    // Akcje stojące przed najbliższym budynkiem/bonusem odpalają się same i nie blokują budowy
    function runPendingActions() {
        for (let guard = 0; guard < 50; guard++) {
            const q = buildingObject.buildingQueue;
            const block = q.findIndex(it => it.t === 'b' || it.t === 'bonus');
            const lim = block < 0 ? q.length : block;
            let fired = false;
            for (let i = 0; i < lim; i++) {
                if (q[i].t === 'act' && runAct(q[i])) { fired = true; break; }
            }
            if (!fired) break;
        }
    }

    function pauseOnBonus() {
        buildingObject.status = false;
        $('#startBtn').text("✅️ Start").removeClass('tcm-btn-active');
        updateLocalStorage();
        UI.InfoMessage("Wymagana akcja ręczna na bonusie", 2000);
    }

    function uruchomBudowe() {
        if (!buildingObject.status || isBuilding) return;

        const $freeBtn = $('.btn-instant-free:visible');
        if ($freeBtn.length) {
            $freeBtn.click();
            setTimeout(uruchomBudowe, Math.floor(Math.random() * 1000) + 2500);
            return;
        }

        // Usuń to, co już zbudowane (np. kliknięte ręcznie)
        cleanupQueue();

        // Auto-zagroda
        if (buildingObject.autoFarmLimit > 0) {
            let currentPop = parseInt($('#pop_current_label').text(), 10);
            let maxPop = parseInt($('#pop_max_label').text(), 10);
            if (!isNaN(currentPop) && !isNaN(maxPop) && maxPop > 0) {
                let freePopPercent = ((maxPop - currentPop) / maxPop) * 100;
                if (freePopPercent <= buildingObject.autoFarmLimit) {
                    const inQ = getInQueueCounts();
                    const fi = buildingObject.buildingQueue.findIndex(it => it.t === 'b' || it.t === 'bonus');
                    const head = fi > -1 ? buildingObject.buildingQueue[fi] : null;
                    if ((inQ['farm'] || 0) === 0 && !(head && head.t === 'b' && head.b === 'farm')) {
                        const nextFarm = gameEffLevel('farm', inQ) + 1;
                        if (nextFarm <= maxLevel('farm')) {
                            buildingObject.buildingQueue.splice(Math.max(fi, 0), 0, { t: 'b', b: 'farm', l: nextFarm, id: uid() });
                            renumberLevels();
                            updateLocalStorage();
                            reloadQueueDisplay();
                            UI.SuccessMessage("Dodano zagrodę na początek kolejki (brak wolnego miejsca).");
                        }
                    }
                }
            }
        }

        runPendingActions();

        const idx = buildingObject.buildingQueue.findIndex(it => it.t === 'b' || it.t === 'bonus');
        if (idx > -1) {
            const next = buildingObject.buildingQueue[idx];
            if (next.t === 'bonus') {
                // moduł auto-bonusów (jeśli jest) aktywuje sam, w przeciwnym razie pauza na ręczną akcję
                const bm = BOB.modules.bonus;
                if (bm && bm.api && typeof bm.api.activate === 'function') {
                    isBuilding = true;
                    Promise.resolve(bm.api.activate(next.text)).then(ok => {
                        isBuilding = false;
                        if (ok) {
                            const i = indexById(next.id);
                            if (i > -1) buildingObject.buildingQueue.splice(i, 1);
                            updateLocalStorage();
                            reloadQueueDisplay();
                            setTimeout(uruchomBudowe, 1500);
                        } else pauseOnBonus();
                    }).catch(() => { isBuilding = false; pauseOnBonus(); });
                    return;
                }
                pauseOnBonus();
                return;
            }
            let currentQueue = $('#buildqueue tr[class*="buildorder_"]').length;
            if (currentQueue < buildingObject.buildingQueueLength) {
                const $buildBtn = $(`.btn-build[data-building="${next.b}"]`);
                if ($buildBtn.length && $buildBtn.css('display') !== 'none') {
                    isBuilding = true;
                    buildAjax(next);
                    return;
                }
            }
        }
        setTimeout(uruchomBudowe, Math.floor(Math.random() * 1500) + 3500);
    }

    function buildAjax(item) {
        expectedBuild = item;
        const $btn = $(`.btn-build[data-building="${item.b}"]`);
        if ($btn.length) {
            // Kliknięcie natywnego przycisku gry - gra sama zrobi AJAX i odświeży UI
            $btn[0].click();
        } else {
            isBuilding = false;
            expectedBuild = null;
        }
    }

    if (document.readyState === 'complete') init();
    else $(window).on('load', init);
})();
