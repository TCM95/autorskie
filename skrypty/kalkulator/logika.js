(function() {
    'use strict';

    if (window.KalkulatorUruchomiony) return;
    window.KalkulatorUruchomiony = true;

    const urlUI = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/ui.js";
    const urlLogika = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/logika.js";
    
    window.KalkulatorConfig = {
        urlHandel: "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/handel.js"
    };

    async function wczytajSkrypt(url) {
        try {
            const response = await fetch(url + "?v=" + Date.now());
            if (!response.ok) throw new Error(`Błąd pobierania: ${url}`);
            const code = await response.text();
            
            const script = document.createElement('script');
            script.textContent = code;
            document.head.appendChild(script);
        } catch(e) {
            console.error("TCM Kalkulator:", e);
        }
    }

    // Ładujemy sekwencyjnie (najpierw UI, po zakończeniu Logika)
    (async function startApp() {
        await wczytajSkrypt(urlUI);
        await wczytajSkrypt(urlLogika);
    })();
})();
