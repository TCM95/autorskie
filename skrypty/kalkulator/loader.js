// ==UserScript==
// @name         Kalkulator Rynku - Loader
// @namespace    https://viayoo.com/
// @version      1.0
// @description  Ładuje moduły kalkulatora (UI i Logikę) z GitHuba
// @author       TCM
// @match        *://*.plemiona.pl/game.php?*screen=market*
// @match        *://*.plemiona.pl/game.php?*screen=main*
// @match        *://*.plemiona.pl/game.php?*screen=snob*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const urlUI = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/ui.js";
    const urlLogika = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/logika.js";
    
    // Zapisujemy URL do globalnego obiektu, aby plik logika.js wiedział skąd pobrać handlarza
    window.KalkulatorConfig = {
        urlHandel: "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/handel.js"
    };

    function wczytajSkrypt(url) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = url + "?v=" + Date.now(); // Cache buster
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Wczytujemy najpierw UI, a gdy skończy - Logikę
    wczytajSkrypt(urlUI).then(() => {
        wczytajSkrypt(urlLogika);
    });
})();
