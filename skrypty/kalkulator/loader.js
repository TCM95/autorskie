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
    
    // Wklej tutaj linki "RAW" ze swojego GitHuba
    const urlUI = "https://raw.githubusercontent.com/TWOJ_PROFIL/REPO/main/kalk_ui.js";
    const urlLogika = "https://raw.githubusercontent.com/TWOJ_PROFIL/REPO/main/kalk_logika.js";

    function wczytajSkrypt(url) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            // Cache buster - zapobiega ładowaniu starej wersji z pamięci telefonu
            script.src = url + "?v=" + Date.now();
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Wczytujemy najpierw UI, a gdy skończy - Logikę
    wczytajSkrypt(urlUI).then(() => {
        wczytajSkrypt(urlLogika);
    });
})();
