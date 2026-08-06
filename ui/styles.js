window.TCM_UI = window.TCM_UI || {};

window.TCM_UI.injectStyles = function() {
    if (document.getElementById('tcm-styles')) return;
    const style = document.createElement('style');
    style.id = 'tcm-styles';
    style.textContent = `
        #tw-script-panel { width: max-content !important; height: fit-content !important; background: #e3d5b3; border: 2px solid #804000; position: absolute; z-index: 9999 !important; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); }
        #tw-script-panel-header { z-index: 1 !important; position: relative; background: #c1a264; padding: 5px; font-weight: bold; border-bottom: 2px solid #804000; display: flex; justify-content: space-between; cursor: grab; }
        .tw-header-btn { cursor: pointer; padding: 0 5px; font-size: 14px; }
        #tw-panel-body { display: flex; align-items: flex-start; height: fit-content !important; position: relative; }
        #tw-sidebar { display: flex; flex-direction: column; width: 140px; height: fit-content !important; border-right: 1px solid #7d510f; background: #e3d5b3; }
        .tw-tab { padding: 8px 5px; cursor: pointer; border-bottom: 1px solid #c1a264; font-size: 12px; font-weight: bold; color: #5c3a21; transition: background 0.2s; }
        .tw-tab.active, .tw-tab:hover { background: #f4e4bc; color: #000; }
        #tw-content-area { display: none; gap: 5px; padding: 8px; align-content: start; background: #e3d5b3; width: max-content; height: fit-content !important; }
        .tw-script-item { display: flex; align-items: center; justify-content: space-between; background: #f4e4bc; padding: 4px 6px; border: 1px solid #804000; border-radius: 4px; font-size: 11px; min-width: 140px; }
        .tw-game-btn { display: flex; align-items: center; cursor: pointer; flex: 1; }
        .tw-status-icon { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; border: 1px solid #000; }
        .tw-status-on { background-color: #00aa00; }
        .tw-status-off { background-color: #aa0000; }
        .tw-info-icon { cursor: pointer; font-weight: bold; color: #005500; padding-left: 8px; font-size: 14px; }
        #tw-global-tooltip { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 999999 !important; width: 220px; background: #fcf4db !important; border: 2px solid #804000; padding: 10px; color: #000; box-shadow: 0px 4px 10px rgba(0,0,0,0.8); font-size: 12px; border-radius: 4px; text-align: center; }
        #tw-tooltip-close { display: block; margin: 8px auto 0 auto; padding: 3px 8px; background: #804000; color: #fff; border: 1px solid #000; cursor: pointer; border-radius: 3px; font-weight: bold; }
    `;
    document.head.appendChild(style);
};
