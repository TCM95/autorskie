(function() {
    'use strict';
    if (typeof game_data === 'undefined') return;

    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-main: #36393f;
            --bg-row-alt: #32353b;
            --bg-header: #202225;
            --border-color: #3e4147;
            --text-color: white;
            --title-color: #ffffdf;
            --btn-bg: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);
            --btn-hover: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);
        }
        .kalk-ui { background: var(--bg-main); color: var(--text-color); border: 1px solid var(--border-color); }
        .kalk-header { background: var(--bg-header); color: var(--title-color); border-bottom: 1px solid var(--border-color); }
        .kalk-btn { background: var(--btn-bg); color: var(--text-color); border: 1px solid var(--border-color); cursor: pointer; padding: 4px; border-radius: 3px; }
        .kalk-btn:hover { background: var(--btn-hover); }
        .kalk-input { background: var(--bg-row-alt); color: var(--text-color); border: 1px solid var(--border-color); padding: 2px;}
    `;
    document.head.appendChild(style);

    const world = window.location.hostname.split('.')[0];
    const STORAGE_KEY_POS = `etykiety_pos_${world}`;

    let savedP = JSON.parse(localStorage.getItem(STORAGE_KEY_POS)) || { top: 100, left: 20 };
    if (savedP.top < 0 || savedP.top > window.innerHeight - 50) savedP.top = 100;
    if (savedP.left < 0 || savedP.left > window.innerWidth - 50) savedP.left = 20;

    const ui = document.createElement('div');
    ui.id = "etykiety_ui";
    ui.className = "kalk-ui";
    ui.style = `position:absolute; top:${savedP.top}px; left:${savedP.left}px; z-index:9999999; border-radius:5px; font-family:Arial; font-size:11px; width:275px; box-shadow: 0 0 15px rgba(0,0,0,0.6); display:none; touch-action: none; cursor:move;`;

    ui.innerHTML = `
    <div id="calc_header" class="kalk-header" style="padding:10px; font-weight:bold; display:flex; justify-content:space-between; user-select:none;">
        <span>Kalkulator Rynku</span> <span id="close_btn" style="cursor:pointer; padding: 0 5px;">[X]</span>
    </div>
    <div style="padding:10px; max-height: 80vh; overflow-y: auto;">
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;"><span class="icon header wood"></span><input id="m_w" type="number" class="kalk-input" style="width:85px;"><input id="p_w" type="number" readonly class="kalk-input" style="width:75px;"></div>
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;"><span class="icon header stone"></span><input id="m_g" type="number" class="kalk-input" style="width:85px;"><input id="p_g" type="number" readonly class="kalk-input" style="width:75px;"></div>
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;"><span class="icon header iron"></span><input id="m_i" type="number" class="kalk-input" style="width:85px;"><input id="p_i" type="number" readonly class="kalk-input" style="width:75px;"></div>

<button id="load_handlarz_btn" class="kalk-btn" style="width:100%; margin-top:5px; background: linear-gradient(#4caf50 0%, #2e7d32 100%); font-weight:bold;">
    🚀 Uruchom Handlarza (GitHub)
</button>

        
        <div style="margin-top:8px; border-top:1px solid var(--border-color); padding-top:8px;">
            <b>CEL: <span id="target_label" style="font-weight:normal; color:#4caf50;">Brak</span></b>
            <div style="display:flex; gap:2px; margin-top:3px;">
                <input id="c_w" type="number" value="0" class="kalk-input" style="width:62px;">
                <input id="c_g" type="number" value="0" class="kalk-input" style="width:62px;">
                <input id="c_i" type="number" value="0" class="kalk-input" style="width:62px;">
            </div>
        </div>
        
        <div style="display:flex; gap:5px; margin-top:8px;">
            <button id="set_moneta" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">🪙 Moneta</button>
            <button id="set_gruby" data-count="0" class="kalk-btn" style="flex:1; font-size:10px;">👑 Gruby</button>
        </div>
        
        <div style="display:flex; gap:5px; margin-top:8px;">
            <button id="calc_btn" class="kalk-btn" style="flex:4; font-weight:bold;">OBLICZ (Sync)</button>
            <button id="clear_btn" class="kalk-btn" style="flex:1;">🗑️</button>
        </div>
        <div id="results" style="margin-top:10px; background:var(--bg-row-alt); padding:8px; display:none; border:1px solid var(--border-color); border-radius:3px;"></div>
    </div>`;
    document.body.appendChild(ui);

    // Obsługa przeciągania palcem
    let drag = false, sx, sy, il, it;
    const onStart = (e) => { if (['input', 'button', 'a', 'span'].includes(e.target.tagName.toLowerCase()) && e.target.id !== 'calc_header') return; drag = true; const t = e.type.includes('touch') ? e.touches[0] : e; sx = t.clientX; sy = t.clientY; il = ui.offsetLeft; it = ui.offsetTop; };
    const onMove = (e) => { if (!drag) return; const t = e.type.includes('touch') ? e.touches[0] : e; ui.style.left = (il + (t.clientX - sx)) + 'px'; ui.style.top = (it + (t.clientY - sy)) + 'px'; if (e.type === 'touchmove') e.preventDefault(); };
    ui.addEventListener('mousedown', onStart); ui.addEventListener('touchstart', onStart, {passive: false});
    document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, {passive: false});
    const onEnd = () => { if(drag) { drag = false; localStorage.setItem(STORAGE_KEY_POS, JSON.stringify({top: parseInt(ui.style.top), left: parseInt(ui.style.left)})); }};
    document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd);

    // Eksportowanie obiektu do użytku dla pliku logiki
    window.KalkulatorUI = {
        element: ui,
        StoragePos: STORAGE_KEY_POS
    };
})();
