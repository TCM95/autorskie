(async function() {
    'use strict';

    const BASE_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/';
    const UI_JS = ['ui/panel.js'];
    
    // Plik style.css jest w głównym folderze (tam gdzie menedzer_core.js)
    const UI_CSS_URL = `${BASE_URL}style.css`;
    
    const CATEGORIES = ["Ogólne", "Atak/obrona", "Farma/zbieractwo", "Budowa/rekrutacja", "Mapa"];
    const STORAGE_KEY = 'tw_scripts_state';

    function getScriptsState() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    function saveScriptState(id, isActive) {
        const state = getScriptsState();
        state[id] = isActive;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    async function loadCSS() {
        try {
            const res = await fetch(`${UI_CSS_URL}?t=${Date.now()}`);
            if (res.ok) {
                const style = document.createElement('style');
                style.textContent = await res.text();
                document.head.appendChild(style);
            } else {
                console.error("Nie udało się pobrać pliku CSS, status:", res.status);
            }
        } catch (e) {
            console.error("Błąd sieci przy pobieraniu CSS:", e);
        }
    }

    async function loadModule(path) {
        const res = await fetch(`${BASE_URL}${path}?t=${Date.now()}`);
        if (res.ok) {
            const script = document.createElement('script');
            script.textContent = await res.text();
            document.head.appendChild(script);
        }
    }

    async function toggleDarkTheme(darkScriptUrl, enable) {
        let themeElement = document.getElementById('tcm-dark-theme-script');
        if (enable) {
            localStorage.setItem('tw_dark_theme', '1');
            if (!themeElement && darkScriptUrl) {
                try {
                    const fetchUrl = darkScriptUrl.includes('?') ? `${darkScriptUrl}&t=${Date.now()}` : `${darkScriptUrl}?t=${Date.now()}`;
                    const response = await fetch(fetchUrl);
                    if (response.ok) {
                        const code = await response.text();
                        themeElement = document.createElement('script');
                        themeElement.id = 'tcm-dark-theme-script';
                        themeElement.textContent = code;
                        document.head.appendChild(themeElement);
                    }
                } catch (e) {
                    console.error("Błąd motywu:", e);
                }
            }
        } else {
            localStorage.setItem('tw_dark_theme', '0');
            if (themeElement) themeElement.remove();
            location.reload();
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
        await loadCSS();
        for (const file of UI_JS) await loadModule(file);
        
        const confRes = await fetch(`${BASE_URL}confing.json?t=${Date.now()}`);
        let scripts = [];
        if (confRes.ok) {
            const json = await confRes.json();
            scripts = Array.isArray(json) ? json : (json.scripts || []);
        }

        window.TCM_UI.initPanel(scripts, CATEGORIES, { 
            getScriptsState, 
            saveScriptState, 
            onToggleTheme: toggleDarkTheme 
        });
        
        await loadActiveScripts(scripts);
    } catch (e) {
        console.error("TCM Menedżer Błąd:", e);
    }
})();
