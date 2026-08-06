// ==UserScript==
// @name         Ciemny motyw (Shinko Theme)
// @namespace    https://viayoo.com/
// @author       TCM
// @description  Ciemny motyw wizualny dla gry Plemiona oparty na Shinko Theme
// @match        https://*.plemiona.pl/game.php*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const css = `
        /* Wzorzec wizualny (Shinko Theme) */
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

        /* Paski przewijania */
        ::-webkit-scrollbar-track {
            border-radius: 10px;
            background-color: var(--bg-header);
        }
        html[hide-scrollbar="true"] ::-webkit-scrollbar {
            display:none;
        }
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
            background-color: var(--bg-header);
        }
        ::-webkit-scrollbar-thumb {
            border-radius: 10px;
            background-color: var(--border-color);
        }
        ::placeholder {
            color: var(--text-color) !important;
            opacity: 0.7;
        }
        input:-moz-placeholder {
            color: var(--text-color) !important;
            opacity: 0.7;
        }
        
        /* Tło główne i teksty */
        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background: var(--bg-main) !important;
            color: var(--text-color);
        }

        /* Tabele, wiersze i nagłówki */
        .box-item, .vis td:not(.luck-item), .row {
            background: var(--bg-row-alt) !important;
            color: var(--text-color) !important;
        }
        th, .vis > h4 {
            background: var(--bg-header) !important;
            color: var(--title-color) !important;
            border-bottom: 1px solid var(--border-color) !important;
        }
        .luck {
            background-color: var(--bg-header) !important;
        }
        
        /* Ikony i strzałki */
        .widget-button, .list-right > img, .chat-button {
            filter: invert(100%);
        }
        .arrowLeft, .arrowRight {
            filter: grayscale(100%);
        }
        img:not(*) {
            border-radius: 50%;
        }

        /* Główne okna */
        #main_layout, .content > .inner {
            background: var(--bg-main) !important;
            border-radius: 0 0 8px 8px;
            color: var(--text-color);
        }
        .widget-tabs > li > a {
            background: var(--bg-header);
            border-radius: 0;
            color: var(--text-color);
        }
        .selected {
            background: var(--bg-row-alt) !important;
            border-radius: 8px 8px 0 0;
            color: var(--title-color);
        }

        /* Czat */
        .chat-header, .chat-body, .chat-message, .chat-footer, .chat-input {
            background: var(--bg-header) !important;
            border-radius: 4px 4px 0 0;
            color: var(--text-color);
            border-color: var(--border-color) !important;
        }

        /* Przezroczyste i wyzerowane tła ze zmienionym kolorem tekstu */
        .bg_left, .bg_bottomcenter, .bg_bottomright, .bg_right, .maincell, .bg_bottomleft, .box, .header-border, .server_info, .content-border, #inner-border, .widget, .head, .forum-content, .row h4, ul, li, .widget-content > div, .tickLabel, .flot-tick-Label, #chartdiv > canvas, .content, .divider, .divider::before, .divider::after, #menu_row > td.menu-item, .bg, .popup_box_content, .borderimage, .topTable, .top_bar, .menu_column, .decoration, .confirmation-box, #attack_spy_buildings_left, #attack_spy_buildings_right, .premium-advantage, .knight_card, .village-item, #inline_popup {
            background: rgba(0, 0, 0, 0) !important;
            box-shadow: none;
            color: var(--text-color);
            border: none !important;
            border-image: none !important;
        }
        
        /* Podświetlenia wiosek */
        .village-item.read-only:hover, .village-item.village-selected, .village-item:hover {
            background: var(--bg-row-alt) !important;
            color: var(--title-color);
        }
        
        /* Cele i zadania */
        .quest-goal, .quest-goal > table {
            background: var(--bg-header);
            box-shadow: none;
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }
        .quest-summary {
            background: rgba(0, 0, 0, 0) !important;
            border: 2px solid var(--border-color);
        }

        /* Popupy i menu */
        .popup_box, #menu_row > td.menu-item > a {
            background: var(--bg-header) !important;
            border-radius: 8px;
            color: var(--text-color);
        }
        .flag_box {
            background-color: var(--bg-header) !important;
            border-radius: 8px;
        }
        .flag_box_empty, .flag_box_small {
            opacity: .4;
            border-radius: 8px;
        }
        .flag_count, #village_targets, #village_targets_menu, #village_targets_content {
            background: var(--bg-header) !important;
            border-radius: 0 0 8px 0;
        }

        /* Elementy informacyjne */
        .premium_account_hint {
            background: var(--bg-row-alt) url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/premium/features/Premium_hint.png) no-repeat 4px center;
            border: 1px solid var(--border-color);
        }
        .info_box {
            background: url(https://dsbr.innogamescdn.com/asset/1d2499b/graphic/questionmark.png) no-repeat 4px center, var(--bg-row-alt) !important;
            border: 1px solid var(--border-color);
        }
        .error_box {
            background: var(--bg-row-alt) url(https://dsbr.innogamescdn.com/asset/1d2499b/graphic/error.png) no-repeat 3px center;
            border: 1px solid red;
        }

        /* Przyciski (Shinko Theme) */
        .btn, .btn-confirm-yes, .btn-confirm-no {
            background: var(--btn-bg) !important;
            border: 1px solid var(--border-color) !important;
            color: var(--text-color) !important;
        }
        .btn:hover, .btn-confirm-yes:hover, .btn-confirm-no:hover {
            background: var(--btn-hover) !important;
        }

        /* Przyciski z ikonami (łączą oryginalną ikonę z gradientem Shinko) */
        .btn-build { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px 1px, var(--btn-bg) !important; }
        .btn-build:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px 1px, var(--btn-hover) !important; }
        
        .btn-cancel { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -174px, var(--btn-bg) !important; }
        .btn-cancel:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -174px, var(--btn-hover) !important; }
        
        .btn-instant, .btn-btr { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -49px, var(--btn-bg) !important; }
        .btn-instant:hover, .btn-btr:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -49px, var(--btn-hover) !important; }
        
        .btn-bcr { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -24px, var(--btn-bg) !important; }
        .btn-bcr:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -24px, var(--btn-hover) !important; }
        
        .btn-recruit { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -125px, var(--btn-bg) !important; }
        .btn-recruit:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -125px, var(--btn-hover) !important; }
        
        .btn-attack { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -74px, var(--btn-bg) !important; }
        .btn-attack:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -74px, var(--btn-hover) !important; }
        
        .btn-support { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -99px, var(--btn-bg) !important; }
        .btn-support:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -99px, var(--btn-hover) !important; }
        
        .btn-bcr-disabled, .btn-bcr-disabled:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -24px, var(--bg-row-alt) !important; opacity: 0.6; }
        
        .btn-instant-free { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -49px, var(--btn-bg) !important; border-color: #2b7a2b !important; }
        .btn-instant-free:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -49px, var(--btn-hover) !important; border-color: #3b9a3b !important; }
        
        .current-quest { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px 1px, var(--btn-bg) !important; border: 1px solid #2b7a2b !important; }
        .current-quest:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px 1px, var(--btn-hover) !important; }
        
        .btn-research { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -146px, var(--btn-bg) !important; }
        .btn-research:hover { background: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/btn/buttons.png) no-repeat 3px -146px, var(--btn-hover) !important; }
        
        .btn-pp { background: url("https://dsbr.innogamescdn.com/asset/1d2499b/graphic/btn/buttons.png") no-repeat 3px -224px, var(--btn-bg) !important; }
        .btn-pp:hover { background: url("https://dsbr.innogamescdn.com/asset/1d2499b/graphic/btn/buttons.png") no-repeat 3px -224px, var(--btn-hover) !important; }

        /* Tooltipy, Zadania, Stopka, Różne boxy */
        #tooltip, .quest, #footer, .world_button_active, .world_button_inactive, .confirmation-box-content-pane, .labeled-box-label, .active-skill-list > div, .premium-box-content, .premium-box-head, .premium-box-foot, .feature-header, .advantage-content, .knight_card_container, .scavenge-option, #template_create, #map_popup, .report-preview-content, .side-notification, #tooltip_graph > div, #quickbar_inner .main, #quickbar_inner .left, #quickbar_inner .right {
            background: var(--bg-header) !important;
            color: var(--text-color);
            border-color: var(--border-color) !important;
        }
        
        .menu-column-item > a, .menu-column, .menu-column-item, .corner, .bottom, .chat-new-message-notification, #inline_popup_menu, #inline_popup_main, #tooltip_graph, .slimScrollDiv {
            background: var(--bg-main) !important;
        }

        .lit .lit-item, #topContainer, .item_container, .item_container > div, .inventory_items, .inventory_search, .searchbar > a, .labeled-box, .labeled-box-content, .count, .quote_message, .forum, .regimen_container {
            background-color: var(--bg-row-alt) !important;
            border-color: var(--border-color) !important;
        }

        /* Pola input */
        input, .target-input, .float_left {
            background-color: var(--bg-header) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 2px 4px;
        }
        
        img[alt=Lida], img[title=Lida], img[title=Fechado] {
            opacity: .6;
        }
        
        .searchbar input[type=submit] {
            background-image: url(https://dsbr.innogamescdn.com/asset/c820c05/graphic/search.png);
            background-color: var(--bg-header) !important;
        }
        input[type=image] {
            border-radius: 4px !important;
        }

        /* Elementy list, forów i raportów */
        .award-group-head, .award-group-content, .award-group-foot, .mentoring-cards, .mentor-list-nav, .map-legend-container table, .map_container, .widget_content, .side-notification-container, .vis_item, .igmline, .post, .report_transparent_overlay, .inventory_detail, .spoiler > div, #plunder_list_filters {
            background: var(--bg-row-alt) !important;
            border-color: var(--border-color) !important;
        }
        .spoiler div {
            border: 1px solid var(--border-color);
            margin: 3px 0;
            padding: 6px;
            overflow: auto;
        }

        /* Paski postępu */
        .progress-bar, .ttl_bar {
            background: var(--bg-main) !important;
            border: 1px solid var(--border-color);
        }
        .progress-bar > div, .ttl_bar > div {
            background: var(--btn-bg) !important;
        }
        .progress-bar > span {
            color: var(--text-color) !important;
            text-shadow: 1px 1px 2px black;
        }

        /* Różne */
        .shared_forum, .reportable.chat-row:hover {
            background: var(--bg-header) !important;
            border-radius: 0;
        }
        #info_content, .report-preview {
            background: var(--bg-main) !important;
            border: 1px solid var(--border-color);
        }
        
        /* Usuwanie reklam */
        #SkyScraperAd, #ContentAd {
            height: 0px;
            width: 0px;
            display:none;
        }
        
        .thread_edit, .thread_answer, .thread_new, .thread_poll {
            color: var(--text-color);
        }
        
        td:not(.nowrap):not(.village_overview_effect) > img, .friend, .chat-status:before {
            border-radius: 50%;
        }

        /* Teksty i odnośniki */
        strong, a {
            color: var(--text-color) !important;
        }
        a:hover {
            color: var(--title-color) !important;
            text-decoration: underline;
        }
    `;

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else {
        let style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }
})();
