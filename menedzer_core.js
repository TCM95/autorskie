(async function() {
    'use strict';

    const BASE_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/';
    const UI_JS = ['ui/panel.js'];
    const UI_CSS_URL = `${BASE_URL}style.css`;
    const EXTERNAL_MENU_URL = `${BASE_URL}skrypty/meni2.js`;

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
                const styleText = await res.text();
                const style = document.createElement('style');
                style.id = 'tcm-main-css';
                style.textContent = styleText;
                document.head.appendChild(style);
            }
        } catch (e) {
            console.error("Błąd ładowania CSS:", e);
        }
    }

    async function loadModule(path) {
        const url = path.startsWith('http') ? `${path}?t=${Date.now()}` : `${BASE_URL}${path}?t=${Date.now()}`;
        const res = await fetch(url);
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

        // Pobranie konfiguracji skryptów
        const confRes = await fetch(`${BASE_URL}confing.json?t=${Date.now()}`);
        let scripts = [];
        let categories = [];

        if (confRes.ok) {
            const json = await confRes.json();

            // Jeśli JSON to obiekt ze słupkami/kategoriami
            if (!Array.isArray(json)) {
                categories = Object.keys(json);
                
                Object.entries(json).forEach(([categoryName, scriptList]) => {
                    scriptList.forEach(s => {
                        s.category = categoryName; // Automatyczne przypisanie kategorii ze słupka
                        scripts.push(s);
                    });
                });
            } else {
                // Obsługa starej płaskiej tablicy w razie potrzeby
                scripts = json;
                categories = ["Atak/obrona", "Budowa/rekrutacja", "Farma/zbieractwo", "Surowce", "Mapa", "Inne"];
            }
        }

        // AUTOMATYCZNE SORTOWANIE ALFABETYCZNE PO NAZWIE
        scripts.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

        // Inicjalizacja budowy okna panelu
        window.TCM_UI.initPanel(scripts, categories, { 
            getScriptsState, 
            saveScriptState, 
            onToggleTheme: toggleDarkTheme 
        });

        await loadModule(EXTERNAL_MENU_URL);
        await loadActiveScripts(scripts);

    } catch (e) {
        console.error("TCM Menedżer Błąd:", e);
    }
})();
