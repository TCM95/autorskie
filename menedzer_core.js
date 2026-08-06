(async function() {
    'use strict';

    const BASE_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/';
    const UI_FILES = ['ui/styles.js', 'ui/tooltip.js', 'ui/panel.js'];
    const CATEGORIES = ["Ogólne", "Atak/obrona", "Farma/zbieractwo", "Budowa/rekrutacja", "Mapa"];
    const STORAGE_KEY = 'tw_scripts_state';

    function getScriptsState() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    function saveScriptState(id, isActive) {
        const state = getScriptsState();
        state[id] = isActive;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    async function loadModule(path) {
        const res = await fetch(`${BASE_URL}${path}?t=${Date.now()}`);
        if (res.ok) {
            const script = document.createElement('script');
            script.textContent = await res.text();
            document.head.appendChild(script);
        }
    }

    async function loadActiveScripts(scripts) {
        const state = getScriptsState();
        const url = window.location.href;
        
        for (const s of scripts) {
            if (s.id === 'ciemny_motyw' || !state[s.id] || !s.screens) continue;
            
            if (s.screens.includes('*') || s.screens.some(sc => url.includes(sc))) {
                const sRes = await fetch(`${s.url}?t=${Date.now()}`);
                if (sRes.ok) {
                    const el = document.createElement('script');
                    el.textContent = await sRes.text();
                    document.head.appendChild(el);
                }
            }
        }
    }

    try {
        for (const file of UI_FILES) await loadModule(file);
        
        const confRes = await fetch(`${BASE_URL}confing.json?t=${Date.now()}`);
        let scripts = [];
        if (confRes.ok) {
            const json = await confRes.json();
            scripts = Array.isArray(json) ? json : (json.scripts || []);
        }

        window.TCM_UI.injectStyles();
        window.TCM_UI.initPanel(scripts, CATEGORIES, { getScriptsState, saveScriptState });
        
        await loadActiveScripts(scripts);
    } catch (e) {
        console.error("TCM Menedżer Błąd:", e);
    }
})();
