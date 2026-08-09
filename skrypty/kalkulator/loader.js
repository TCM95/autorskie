(function() {
    'use strict';

    // Zabezpieczenie: jeśli menedżer odpali się dwa razy, ignorujemy kolejne uruchomienia
    if (window.KalkulatorUruchomiony) return;
    window.KalkulatorUruchomiony = true;

    // Definiujemy linki
    const urlUI = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/ui.js";
    const urlLogika = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/logika.js";
    
    // Zmienna globalna dla pliku logika.js z linkiem do Handlarza
    window.KalkulatorConfig = {
        urlHandel: "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/handel.js"
    };

    function wczytajSkrypt(url) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            // Data pobierania omija cache przeglądarki przy każdym załadowaniu
            script.src = url + "?v=" + Date.now(); 
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Ładujemy synchronicznie: najpierw UI, potem Logika
    wczytajSkrypt(urlUI).then(() => {
        wczytajSkrypt(urlLogika);
    });
})();
