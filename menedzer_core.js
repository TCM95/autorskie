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

    // BEZPIECZNE ŁADOWANIE MODUŁÓW (Naprawia 'Script error.')
    function loadModule(path) {
        return new Promise((resolve, reject) => {
            const url = path.startsWith('http') ? `${path}&t=${Date.now()}` : `${BASE_URL}${path}?t=${Date.now()}`;
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.onload = () => resolve();
            script.onerror = (err) => reject(new Error(`Nie udało się załadować modułu: ${path}`));
            document.head.appendChild(script);
        });
    }

    async function toggleDarkTheme(darkScriptUrl, enable) {
        let themeElement = document.getElementById('tcm-dark-theme-script');
        if (enable) {
            localStorage.setItem('tw_dark_theme', '1');
            if (!themeElement && darkScriptUrl) {
                try {
                    const fetchUrl = darkScriptUrl.includes('?') ? `${darkScriptUrl}&t=${Date.now()}` : `${darkScriptUrl}?t=${Date.now()}`;
                    themeElement = document.createElement('script');
                    themeElement.id = 'tcm-dark-theme-script';
                    themeElement.src = fetchUrl;
                    document.head.appendChild(themeElement);
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
                try {
                    await loadModule(s.url);
                } catch (err) {
                    console.error(`Błąd aktywnego skryptu [${s.id}]:`, err);
                }
            }
        }
    }

    try {
        await loadCSS();

        for (const file of UI_JS) {
            await loadModule(file);
        }

        // Pobranie konfiguracji skryptów
        const confRes = await fetch(`${BASE_URL}confing.json?t=${Date.now()}`);
        let scripts = [];
        let categories = [];

        if (confRes.ok) {
            const json = await confRes.json();

            if (!Array.isArray(json)) {
                categories = Object.keys(json);

                Object.entries(json).forEach(([categoryName, scriptList]) => {
                    scriptList.forEach(s => {
                        s.category = categoryName;
                        scripts.push(s);
                    });
                });
            } else {
                scripts = json;
                categories = ["Atak/obrona", "Budowa/rekrutacja", "Farma/zbieractwo", "Raporty", "Etykiety", "Surowce", "Mapa", "Inne"];
            }
        }

        // AUTOMATYCZNE SORTOWANIE ALFABETYCZNE PO NAZWIE
        scripts.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

        // Inicjalizacja budowy okna panelu
        if (window.TCM_UI && typeof window.TCM_UI.initPanel === 'function') {
            window.TCM_UI.initPanel(scripts, categories, { 
                getScriptsState, 
                saveScriptState, 
                onToggleTheme: toggleDarkTheme 
            });
        } else {
            console.error("TCM Menedżer: Obiekt window.TCM_UI nie został poprawnie zainicjalizowany przez ui/panel.js!");
        }

        await loadModule(EXTERNAL_MENU_URL);
        await loadActiveScripts(scripts);

    } catch (e) {
        console.error("TCM Menedżer Błąd krytyczny:", e);
    }
})();
