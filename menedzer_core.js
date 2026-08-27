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

    // Bezpieczne ładowanie stylów CSS
    function loadCSS() {
        return new Promise((resolve) => {
            fetch(`${UI_CSS_URL}?t=${Date.now()}`)
                .then(res => res.ok ? res.text() : Promise.reject())
                .then(styleText => {
                    const style = document.createElement('style');
                    style.id = 'tcm-main-css';
                    style.textContent = styleText;
                    document.head.appendChild(style);
                    resolve();
                })
                .catch(() => {
                    resolve(); // Nie blokujemy panelu w razie awarii CSS
                });
        });
    }

    // Bezpieczne ładowanie modułów JS przez tag src (zapobiega błędom na mobile)
    function loadModule(path) {
        return new Promise((resolve) => {
            const url = path.startsWith('http') ? `${path}&t=${Date.now()}` : `${BASE_URL}${path}?t=${Date.now()}`;
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.onload = () => resolve(true);
            script.onerror = () => {
                console.warn(`TCM: Nie udało się załadować pliku: ${path}`);
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }

    async function toggleDarkTheme(darkScriptUrl, enable) {
        let themeElement = document.getElementById('tcm-dark-theme-script');
        if (enable) {
            localStorage.setItem('tw_dark_theme', '1');
            if (!themeElement && darkScriptUrl) {
                const fetchUrl = darkScriptUrl.includes('?') ? `${darkScriptUrl}&t=${Date.now()}` : `${darkScriptUrl}?t=${Date.now()}`;
                themeElement = document.createElement('script');
                themeElement.id = 'tcm-dark-theme-script';
                themeElement.src = fetchUrl;
                document.head.appendChild(themeElement);
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
                await loadModule(s.url);
            }
        }
    }

    try {
        await loadCSS();

        // Ładowanie modułów interfejsu
        for (const file of UI_JS) {
            await loadModule(file);
        }

        // Pobieranie pliku konfiguracyjnego
        let scripts = [];
        let categories = ["Atak/obrona", "Budowa/rekrutacja", "Farma/zbieractwo", "Raporty", "Etykiety", "Surowce", "Mapa", "Inne"];
        
        try {
            const confRes = await fetch(`${BASE_URL}confing.json?t=${Date.now()}`);
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
                }
            }
        } catch (e) {
            console.warn("TCM: Problem z pobraniem configu, używam domyślnych ustawień.");
        }

        scripts.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

        // Inicjalizacja panelu z zabezpieczeniem przed brakiem obiektu UI
        if (window.TCM_UI && typeof window.TCM_UI.initPanel === 'function') {
            window.TCM_UI.initPanel(scripts, categories, { 
                getScriptsState, 
                saveScriptState, 
                onToggleTheme: toggleDarkTheme 
            });
        } else {
            console.error("TCM Błąd: window.TCM_UI nie jest dostępne. Sprawdź plik ui/panel.js.");
        }

        // Ładowanie dodatkowego menu i aktywnych skryptów w tle
        loadModule(EXTERNAL_MENU_URL);
        loadActiveScripts(scripts);

    } catch (e) {
        console.error("TCM Menedżer: Błąd krytyczny inicjalizacji.", e);
    }
})();
