(async function() {
    'style strict';

    const BASE_URL = 'https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/';
    const UI_JS = ['ui/panel.js'];
    const UI_CSS_URL = `${BASE_URL}style.css`;

    const CATEGORIES = ["Atak/obrona", "Budowa/rekrutacja", "Farma/zbieractwo",  "Surowce", "Mapa", "Inne"];
    const STORAGE_KEY = 'tw_scripts_state';

    function getScriptsState() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    function saveScriptState(id, isActive) {
        const state = getScriptsState();
        state[id] = isActive;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    // Wymuszenie załadowania i wstrzyknięcia CSS przed uruchomieniem UI
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
                runScriptByUrl(s.url);
            }
        }
    }

    // Pomocnicza funkcja do natychmiastowego pobierania i odpalania kodu po URL
    async function runScriptByUrl(scriptUrl) {
        if (!scriptUrl) return;
        try {
            const fetchUrl = scriptUrl.includes('?') ? `${scriptUrl}&t=${Date.now()}` : `${scriptUrl}?t=${Date.now()}`;
            const sRes = await fetch(fetchUrl);
            if (sRes.ok) {
                const el = document.createElement('script');
                el.textContent = await sRes.text();
                document.head.appendChild(el);
            }
        } catch (e) {
            console.error("Błąd uruchamiania skryptu:", e);
        }
    }

    try {
        // Najpierw pobierz i wdróż style!
        await loadCSS();

        // Dopiero po załadowaniu CSS buduj UI
        for (const file of UI_JS) await loadModule(file);

        const confRes = await fetch(`${BASE_URL}confing.json?t=${Date.now()}`);
        let scripts = [];
        if (confRes.ok) {
            const json = await confRes.json();
            scripts = Array.isArray(json) ? json : (json.scripts || []);
        }

        // Funkcja wywoływana z panelu przy kliknięciu w przycisk
        const runScript = (id) => {
            const found = scripts.find(s => s.id === id);
            if (found && found.url) {
                runScriptByUrl(found.url);
            } else {
                console.warn("Nie znaleziono adresu URL dla skryptu:", id);
            }
        };

        window.TCM_UI.initPanel(scripts, CATEGORIES, { 
            getScriptsState, 
            saveScriptState, 
            onToggleTheme: toggleDarkTheme,
            runScript // Dopisano brakujący callback
        });

        await loadActiveScripts(scripts);
    } catch (e) {
        console.error("TCM Menedżer Błąd:", e);
    }
})();
