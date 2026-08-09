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
    const urlUI = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/ui.js";
    const urlLogika = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/logika.js";
    const urlHandel_URL = "https://raw.githubusercontent.com/TCM95/autorskie/refs/heads/main/skrypty/kalkulator/handel.js";


    function wczytajSkrypt(url) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            // Cache buster - zapobiega ładowaniu starej wersji z pamięci telefonu
            script.src = url + "?v=" + Date.now();
            script.onload = resolve;
            document.head.appendChild(script);
        });async function loadHandlarzScript() {
    try {
        const response = await fetch(HANDLARZ_SCRIPT_URL);
        if (!response.ok) throw new Error('Błąd pobierania skryptu z GitHub');
        const scriptText = await response.text();
        
        // Wykonanie pobranego kodu w kontekście strony
        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptText;
        document.body.appendChild(scriptEl);
        
        UI.InfoMessage('Skrypt Handlarza został pomyślnie załadowany!', 3000, 'success');
    } catch (err) {
        console.error('Błąd ładowania Handlarza:', err);
        UI.ErrorMessage('Nie udało się załadować skryptu Handlarza.', 3000);
    }
    }

    // Wczytujemy najpierw UI, a gdy skończy - Logikę
    wczytajSkrypt(urlUI).then(() => {
        wczytajSkrypt(urlLogika);
    });
})();
