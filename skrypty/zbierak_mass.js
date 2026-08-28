// ==UserScript==
// @name         Kalkulator Zbierak 1.5
// @namespace    https://viayoo.com/
// @version      1.5
// @description  Kalkulator i automatyzacja masowej wysyłki zbieractwa
// @author       TCM
// @match        https://*.plemiona.pl/game.php?*screen=place&mode=scavenge_mass*
// ==/UserScript==

(function () {
    'use strict';

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
            --btn-green-bg: linear-gradient(#5cad5c 0%, #2e7a2e 30%, #1f5c1f 80%, #0f2e0f 100%);
            --btn-green-hover: linear-gradient(#6bbf6b 0%, #388c38 30%, #267326 80%, #143d14 100%);
            --btn-red-bg: linear-gradient(#ad5c5c 0%, #7a2e2e 30%, #5c1f1f 80%, #2e0f0f 100%);
            --btn-red-hover: linear-gradient(#bf6b6b 0%, #8c3838 30%, #732626 80%, #3d1414 100%);
            --btn-blue-bg: linear-gradient(#5c8cad 0%, #2e5c7a 30%, #1f425c 80%, #0f222e 100%);
            --btn-blue-hover: linear-gradient(#6ba3bf 0%, #38738c 30%, #265473 80%, #142e3d 100%);
        }
        #scav-container {
            position: fixed;
            z-index: 99999;
            background-color: var(--bg-main);
            border: 1px solid var(--border-color);
            padding: 10px;
            border-radius: 5px;
            color: var(--text-color);
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            font-family: Verdana, Arial, sans-serif;
            font-size: 12px;
            user-select: none;
            width: 200px;
        }
        .scav-btn {
            width: 100%;
            padding: 6px;
            margin-bottom: 5px;
            cursor: pointer;
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 3px;
            background: var(--btn-bg);
            font-weight: bold;
        }
        .scav-btn:hover { background: var(--btn-hover); }
        .scav-btn-blue { background: var(--btn-blue-bg); }
        .scav-btn-blue:hover { background: var(--btn-blue-hover); }
        .scav-btn-green { background: var(--btn-green-bg); }
        .scav-btn-green:hover { background: var(--btn-green-hover); }
        .scav-btn-red { background: var(--btn-red-bg); }
        .scav-btn-red:hover { background: var(--btn-red-hover); }
        .scav-input {
            width: 35px;
            background: var(--bg-row-alt);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            text-align: center;
            border-radius: 3px;
        }
    `;
    document.head.appendChild(style);

    const urlKey = window.location.hostname.split('.')[0];
    let isRunning = localStorage.getItem(`scav_run_${urlKey}`) === 'true';

    let delayConfig = JSON.parse(localStorage.getItem(`scav_delay_${urlKey}`)) || { min: 5, max: 10 };
    let uiState = JSON.parse(localStorage.getItem(`scav_ui_${urlKey}`)) || { pinned: false, top: 'auto', left: 'auto', bottom: '150px', right: '20px' };

    let URLReq = game_data.player.sitter > 0
        ? `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass`
        : "game.php?&screen=place&mode=scavenge_mass";

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function loadShinkoMassScavenge(autoClick = false) {
        if (!document.getElementById('massScavengeScript')) {
            const shinkoLogic = function() {
                window.squads = {};
                window.squads_premium = {};

                serverTimeTemp = $("#serverDate")[0].innerText + " " + $("#serverTime")[0].innerText;
                serverTime = serverTimeTemp.match(/^([0][1-9]|[12][0-9]|3[01])[\/\-]([0][1-9]|1[012])[\/\-](\d{4})( (0?[0-9]|[1][0-9]|[2][0-3])[:]([0-5][0-9])([:]([0-5][0-9]))?)?$/);
                
                // Zabezpieczenie przed brakiem dopasowania daty serwera (na wszelki wypadek)
                if(serverTime) {
                    serverDate = Date.parse(serverTime[3] + "/" + serverTime[2] + "/" + serverTime[1] + serverTime[4]);
                } else {
                    serverDate = Date.now();
                }
                
                var is_mobile = !!navigator.userAgent.match(/iphone|android|blackberry/ig) || false;
                var scavengeInfo;
                var tempElementSelection="";
                if (window.location.href.indexOf('screen=place&mode=scavenge_mass') < 0) {
                    window.location.assign(game_data.link_base_pure + "place&mode=scavenge_mass");
                }
                $("#massScavengeSophie").remove();
                if (typeof version == 'undefined') { version = "new"; }
                var langShinko = [ "Mass scavenging", "Select unit types/ORDER to scavenge with (drag units to order)", "Select categories to use", "When do you want your scav runs to return (approximately)?", "Runtime here", "Calculate runtimes for each page", "Creator: ", "Mass scavenging: send per 50 villages", "Launch group " ];
                
                if (localStorage.getItem("troopTypeEnabled") == null) {
                    worldUnits = game_data.units;
                    var troopTypeEnabled = {}
                    for (var i = 0; i < worldUnits.length; i++) {
                        if (worldUnits[i] != "militia" && worldUnits[i] != "snob" && worldUnits[i] != "ram" && worldUnits[i] != "catapult" && worldUnits[i] != "spy" && worldUnits[i] != "knight") {
                            troopTypeEnabled[worldUnits[i]] = false
                        }
                    };
                    localStorage.setItem("troopTypeEnabled", JSON.stringify(troopTypeEnabled));
                } else {
                    var troopTypeEnabled = JSON.parse(localStorage.getItem("troopTypeEnabled"));
                }
                if (localStorage.getItem("keepHome") == null) {
                    var keepHome = { "spear": 0, "sword": 0, "axe": 0, "archer": 0, "light": 0, "marcher": 0, "heavy": 0 }
                    localStorage.setItem("keepHome", JSON.stringify(keepHome));
                } else {
                    var keepHome = JSON.parse(localStorage.getItem("keepHome"));
                }
                if (localStorage.getItem("categoryEnabled") == null) {
                    var categoryEnabled = [true, true, true, true];
                    localStorage.setItem("categoryEnabled", JSON.stringify(categoryEnabled));
                } else {
                    var categoryEnabled = JSON.parse(localStorage.getItem("categoryEnabled"));
                }
                if (localStorage.getItem("prioritiseHighCat") == null) {
                    var prioritiseHighCat = false;
                    localStorage.setItem("prioritiseHighCat", JSON.stringify(prioritiseHighCat));
                } else {
                    var prioritiseHighCat = JSON.parse(localStorage.getItem("prioritiseHighCat"));
                }
                if (localStorage.getItem("timeElement") == null) {
                    localStorage.setItem("timeElement", "Date");
                    tempElementSelection = "Date";
                } else {
                    tempElementSelection = localStorage.getItem("timeElement");
                }
                if (localStorage.getItem("sendOrder") == null) {
                    worldUnits = game_data.units;
                    var sendOrder = [];
                    for (var i = 0; i < worldUnits.length; i++) {
                        if (worldUnits[i] != "militia" && worldUnits[i] != "snob" && worldUnits[i] != "ram" && worldUnits[i] != "catapult" && worldUnits[i] != "spy" && worldUnits[i] != "knight") {
                            sendOrder.push(worldUnits[i])
                        }
                    };
                    localStorage.setItem("sendOrder", JSON.stringify(sendOrder));
                } else {
                    var sendOrder = JSON.parse(localStorage.getItem("sendOrder"));
                }
                if (localStorage.getItem("runTimes") == null) {
                    var runTimes = { "off": 4, "def": 3 }
                    localStorage.setItem("runTimes", JSON.stringify(runTimes));
                } else {
                    var runTimes = JSON.parse(localStorage.getItem("runTimes"));
                }
                if (typeof premiumBtnEnabled == 'undefined') { var premiumBtnEnabled = false; }
                if (game_data.player.sitter > 0) {
                    URLReq = "\game.php?t=" + game_data.player.id + "&screen=place&mode=scavenge_mass";
                } else {
                    URLReq = "game.php?&screen=place&mode=scavenge_mass";
                }
                var arrayWithData;
                var enabledCategories = [];
                var squad_requests = [];
                var squad_requests_premium = [];
                var duration_factor = 0;
                var duration_exponent = 0;
                var duration_initial_seconds = 0;
                var categoryNames = JSON.parse("[" + $.find('script:contains("ScavengeMassScreen")')[0].innerHTML.match(/\{.*\:\{.*\:.*\}\}/g) + "]")[0];
                var time = { 'off': 0, 'def': 0 };
                
                var backgroundColor = "#36393f"; var borderColor = "#3e4147"; var headerColor = "#202225"; var titleColor = "#ffffdf";
                var cssClassesSophie = "<style> .sophRowA { background-color: #32353b; color: white; } .sophRowB { background-color: #36393f; color: white; } .sophHeader { background-color: #202225; font-weight: bold; color: white; } .btnSophie { background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%); } .btnSophie:hover { background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%); } #x { position: absolute; background: red; color: white; top: 0px; right: 0px; width: 30px; height: 30px; } #cog { position: absolute; background: #32353b; color: white; top: 0px; right: 30px; width: 30px; height: 30px; } </style>";
                
                $("#contentContainer").eq(0).prepend(cssClassesSophie);
                $("#mobileHeader").eq(0).prepend(cssClassesSophie);
                
                $.getAll = function ( urls, onLoad, onDone, onError ) {
                    var numDone = 0; var lastRequestTime = 0; var minWaitTime = 200;
                    loadNext();
                    function loadNext() {
                        if (numDone == urls.length) { onDone(); return; }
                        let now = Date.now();
                        let timeElapsed = now - lastRequestTime;
                        if (timeElapsed < minWaitTime) {
                            let timeRemaining = minWaitTime - timeElapsed;
                            setTimeout(loadNext, timeRemaining); return;
                        }
                        $("#progress").css("width", ((numDone + 1) / urls.length * 100) + "%");
                        lastRequestTime = now;
                        $.get(urls[numDone]).done((data) => {
                            try { onLoad(numDone, data); ++numDone; loadNext(); } catch (e) { onError(e); }
                        }).fail((xhr) => { onError(xhr); })
                    }
                };

                function getData() {
                    $("#massScavengeSophie").remove();
                    var URLs = [];
                    $.get(URLReq, function (data) {
                        var amountOfPages = 0;
                        if ($(".paged-nav-item").length > 0) {
                            // ZABEZPIECZENIE NUMER 1: Null-check dla wyrażenia regularnego
                            let lastPageHref = $(".paged-nav-item")[$(".paged-nav-item").length - 1].href;
                            let pageMatch = lastPageHref.match(/page=(\d+)/);
                            amountOfPages = pageMatch ? parseInt(pageMatch[1]) : 0;
                        }
                        for (var i = 0; i <= amountOfPages; i++) {
                            URLs.push(URLReq + "&page=" + i);
                            var tempData = JSON.parse($(data).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[0]);
                            duration_exponent = tempData[1].duration_exponent;
                            duration_factor = tempData[1].duration_factor;
                            duration_initial_seconds = tempData[1].duration_initial_seconds;
                        }
                    }).done(function () {
                        arrayWithData = "[";
                        $.getAll(URLs, (i, data) => {
                            var thisPageData = $(data).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[2];
                            arrayWithData += thisPageData + ",";
                        }, () => {
                            arrayWithData = arrayWithData.substring(0, arrayWithData.length - 1);
                            arrayWithData += "]";
                            scavengeInfo = JSON.parse(arrayWithData);
                            var count = 0;
                            for (var i = 0; i < scavengeInfo.length; i++) {
                                calculateHaulCategories(scavengeInfo[i]);
                                count++;
                            }
                            if (count == scavengeInfo.length) {
                                window.squads = {}; window.squads_premium = {}; var per200 = 0; var groupNumber = 0;
                                window.squads[groupNumber] = []; window.squads_premium[groupNumber] = [];
                                for (var k = 0; k < squad_requests.length; k++) {
                                    if (per200 == 200) {
                                        groupNumber++; window.squads[groupNumber] = []; window.squads_premium[groupNumber] = []; per200 = 0;
                                    }
                                    per200++;
                                    window.squads[groupNumber].push(squad_requests[k]);
                                    window.squads_premium[groupNumber].push(squad_requests_premium[k]);
                                }
                                var htmlWithLaunchButtons = '<div id="massScavengeFinal" class="ui-widget-content" style="position:fixed;background-color:'+backgroundColor+';cursor:move;z-index:50;"><button class="btn" id = "x" onclick="closeWindow(\'massScavengeFinal\')"> X </button><table id="massScavengeSophieFinalTable" class="vis" border="1" style="width: 100%;background-color:'+backgroundColor+';border-color:'+borderColor+'"><tr><td colspan="10" id="massScavengeSophieTitle" style="text-align:center; width:auto; background-color:'+headerColor+'"><h3><center style="margin:10px"><u><font color="'+titleColor+'">'+langShinko[7]+'</font></u></center></h3></td></tr>';
                                for (var s = 0; s < Object.keys(window.squads).length; s++) {
                                    htmlWithLaunchButtons += '<tr id="sendRow'+s+'" style="text-align:center; width:auto; background-color:'+backgroundColor+'"><td style="text-align:center; width:auto; background-color:'+backgroundColor+'"><center><input type="button" class="btn btnSophie btn-launch-group" id="sendGroupBtn'+s+'" onclick="sendGroup('+s+',false)" value="'+langShinko[8]+(s + 1)+'"></center></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'"><center><input type="button" class="btn btn-pp btn-send-premium" id="sendMassPremium" onclick="sendGroup('+s+',true)" value="'+langShinko[8]+(s + 1)+' WITH PREMIUM" style="display:none"></center></td></tr>'
                                }
                                htmlWithLaunchButtons += "</table></div>"
                                $(".maincell").eq(0).prepend(htmlWithLaunchButtons);
                                $("#mobileContent").eq(0).prepend(htmlWithLaunchButtons);
                                if (is_mobile == false) { $("#massScavengeFinal").draggable(); }
                                $("#sendGroupBtn0")[0].focus();
                            }
                        }, (error) => { console.error(error); });
                    })
                }

                var html = '<div id="massScavengeSophie" class="ui-widget-content" style="width:600px;background-color:'+backgroundColor+';cursor:move;z-index:50;"><button class="btn" id ="cog" onclick="settings()">⚙️</button><button class="btn" id = "x" onclick="closeWindow(\'massScavengeSophie\')"> X </button><table id="massScavengeSophieTable" class="vis" border="1" style="width: 100%;background-color:'+backgroundColor+';border-color:'+borderColor+'"><tr><td colspan="10" id="massScavengeSophieTitle" style="text-align:center; width:auto; background-color:'+headerColor+'"><h3><center style="margin:10px"><u><font color="'+titleColor+'">'+langShinko[0]+'</font></u></center></h3></td></tr><tr style="background-color:'+backgroundColor+'"><td style="text-align:center;background-color:'+headerColor+'" colspan="15"><h3><center style="margin:10px"><u><font color="'+titleColor+'">'+langShinko[1]+'</font></u></center></h3></td></tr><tr id="imgRow"></tr></table><hr><table class="vis" border="1" style="width: 100%;background-color:'+backgroundColor+';border-color:'+borderColor+'"><tbody><tr style="background-color:'+backgroundColor+'"><td style="text-align:center;background-color:'+headerColor+'" colspan="4"><h3><center style="margin:10px"><u><font color="'+titleColor+'">'+langShinko[2]+'</font></u></center></h3></td></tr><tr id="categories" style="text-align:center; width:auto; background-color:'+headerColor+'"><td style="text-align:center; width:auto; background-color:'+headerColor+';padding: 10px;"><font color="'+titleColor+'">'+categoryNames[1].name+'</font></td><td style="text-align:center; width:auto; background-color:'+headerColor+';padding: 10px;"><font color="'+titleColor+'">'+categoryNames[2].name+'</font></td><td style="text-align:center; width:auto; background-color:'+headerColor+';padding: 10px;"><font color="'+titleColor+'">'+categoryNames[3].name+'</font></td><td style="text-align:center; width:auto; background-color:'+headerColor+';padding: 10px;"><font color="'+titleColor+'">'+categoryNames[4].name+'</font></td></tr><tr><td style="text-align:center; width:auto; background-color:'+backgroundColor+'"><center><input type="checkbox" ID="category1" name="cat1"></center></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'"><center><input type="checkbox" ID="category2" name="cat2"></center></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'"><center><input type="checkbox" ID="category3" name="cat3"></center></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'"><center><input type="checkbox" ID="category4" name="cat4"></center></td></tr></tbody></table><hr><table class="vis" border="1" style="width: 100%;background-color:'+backgroundColor+';border-color:'+borderColor+'"><tr id="runtimesTitle" style="text-align:center; width:auto; background-color:'+headerColor+'"><td colspan="3" style="text-align:center; width:auto; background-color:'+headerColor+'"><center style="margin:10px"><font color="'+titleColor+'">'+langShinko[3]+'</font></center></td></tr><tr id="runtimes" style="text-align:center; width:auto; background-color:'+headerColor+'"><td style="background-color:'+headerColor+';"></td><td style="text-align:center; width:auto; background-color:'+headerColor+';padding: 10px;"><font color="'+titleColor+'">Off villages</font></td><td style="text-align:center; width:auto; background-color:'+headerColor+';padding: 10px;"><font color="'+titleColor+'">Def villages</font></td></tr><tr><td style="width:22px;background-color:'+backgroundColor+'; padding:5px;"><input type="radio" ID="timeSelectorDate" name="timeSelector" ></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'; padding:5px;"><input type="date" id="offDay" name="offDay" value="'+setDayToField(runTimes.off)+'"><input type="time" id="offTime" name="offTime" value="'+setTimeToField(runTimes.off)+'"></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'; padding:5px;"><input type="date" id="defDay" name="defDay" value="'+setDayToField(runTimes.def)+'"><input type="time" id="defTime" name="defTime" value="'+setTimeToField(runTimes.def)+'"></td></tr><tr><td style="width:22px;background-color:'+backgroundColor+'; padding:5px;"><input type="radio" ID="timeSelectorHours" name="timeSelector" ></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'; padding:5px;"><input type="text" class="runTime_off" style="background-color:'+backgroundColor+';color:'+titleColor+';" value="'+runTimes['off']+'" onclick="this.select();"></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'; padding:5px;"><input type="text" class="runTime_def" style="background-color:'+backgroundColor+';color:'+titleColor+';" value="'+runTimes['def']+'" onclick="this.select();"></td></tr><tr><td style="width:22px;background-color:'+backgroundColor+'; padding:5px;"></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'; padding:5px;"><font color="'+titleColor+'"><span id="offDisplay"></span></font></td><td style="text-align:center; width:auto; background-color:'+backgroundColor+'; padding:5px;"><font color="'+titleColor+'"><span id="defDisplay"></span></font></td></tr></tr></table><hr><table class="vis" border="1" style="width: 100%;background-color:'+backgroundColor+';border-color:'+borderColor+'"><tr id="settingPriorityTitle" style="text-align:center; width:auto; background-color:'+headerColor+'"><td colspan="2" style="text-align:center; width:auto; background-color:'+headerColor+'"><center style="margin:10px"><font color="'+titleColor+'">Which setting?</font></center></td></tr><tr id="settingPriorityHeader" style="text-align:center; width:auto; background-color:'+headerColor+'"><td style="text-align:center; width:50%; background-color:'+headerColor+'; padding:5px;"><font color="'+titleColor+'">Balanced over all categories</font></td><td style="text-align:center; width:50%; background-color:'+headerColor+'; padding:5px;"><font color="'+titleColor+'">Priority on filling higher categories</font></td></tr><tr id="settingPriority" style="text-align:center; width:auto; background-color:'+headerColor+'"><td style="text-align:center; width:50%; background-color:'+backgroundColor+'; padding:5px;"><input type="radio" ID="settingPriorityBalanced" name="prio"></td><td style="text-align:center; width:50%; background-color:'+backgroundColor+'; padding:5px;"><input type="radio" ID="settingPriorityPriority" name="prio"></td></tr><tr style="text-align:center; width:auto; background-color:'+headerColor+'"><td style="text-align:center; width:50%; background-color:'+backgroundColor+'; padding:5px;"><font color="'+titleColor+'">Settings bugged?</font></td><td style="text-align:center; width:50%; background-color:'+backgroundColor+'; padding:5px;"><center><input type="button" class="btn btnSophie" id="reset" onclick="resetSettings()" value="Reset settings"></center></td></tr></table><hr><center><input type="button" class="btn btnSophie" id="sendMass" onclick="readyToSend()" value="'+langShinko[5]+'"></center></div>';
                
                $(".maincell").eq(0).prepend(html);
                $("#mobileContent").eq(0).prepend(html);
                if (is_mobile == false) { $("#massScavengeSophie").css("position", "fixed"); $("#massScavengeSophie").draggable(); }
                $("#offDisplay")[0].innerText = fancyTimeFormat(runTimes.off * 3600);
                $("#defDisplay")[0].innerText = fancyTimeFormat(runTimes.def * 3600);
                if (tempElementSelection == "Date") { $("#timeSelectorDate").prop("checked", true); selectType("Date"); updateTimers(); } else { $("#timeSelectorHours").prop("checked", true); selectType("Hours"); updateTimers(); }
                $("#offDay")[0].addEventListener("input", function () { updateTimers(); }, false)
                $("#defDay")[0].addEventListener("input", function () { updateTimers(); }, false)
                $("#offTime")[0].addEventListener("input", function () { updateTimers(); }, false)
                $("#defTime")[0].addEventListener("input", function () { updateTimers(); }, false)
                $(".runTime_off")[0].addEventListener("input", function () { updateTimers(); }, false)
                $(".runTime_def")[0].addEventListener("input", function () { updateTimers(); }, false)
                $("#timeSelectorDate")[0].addEventListener("input", function () { selectType('Date'); updateTimers(); }, false)
                $("#timeSelectorHours")[0].addEventListener("input", function () { selectType('Hours'); updateTimers(); }, false)
                
                for (var i = 0; i < sendOrder.length; i++) {
                    $("#imgRow").eq(0).append('<td align="center" style="background-color:'+backgroundColor+'"><table class="vis" border="1" style="width: 100%"><thead></thead><tbody><tr><td style=" text-align:center;background-color:'+headerColor+';padding: 5px;"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_'+sendOrder[i]+'.png" title="'+sendOrder[i]+'" alt="" class=""></td></tr><tr><td align="center" style="background-color:'+backgroundColor+';padding: 5px;"><input type="checkbox" ID="'+sendOrder[i]+'" name="'+sendOrder[i]+'"></td></tr><tr><td style="text-align:center; width:auto; background-color:#202225;padding: 5px;"><font color="#ffffdf">Backup</font></td></tr><tr><td align="center" style="background-color:'+backgroundColor+';padding: 5px;"><input type="text" ID="'+sendOrder[i]+'Backup" name="'+sendOrder[i]+'" value="'+keepHome[sendOrder[i]]+'" size="5"></td></tr></tbody></table></td>');
                    if($.fn.sortable) {
                        $("#imgRow").sortable({ axis: "x", revert: 100, containment: "parent", forceHelperSize: true, delay: 100, scroll: false }).disableSelection();
                    }
                    if (prioritiseHighCat == true) { $("#settingPriorityPriority").prop("checked", true); } else { $("#settingPriorityBalanced").prop("checked", true); }
                    enableCorrectTroopTypes();
                }
                
                function readyToSend() {
                    if ($("#settingPriorityPriority")[0].checked == false && $("#settingPriorityBalanced")[0].checked == false) { alert("Wybierz metodę wysyłki!"); throw Error("didn't choose type"); }
                    if ($("#category1").is(":checked") == false && $("#category2").is(":checked") == false && $("#category3").is(":checked") == false && $("#category4").is(":checked") == false) { alert("Wybierz poziomy zbieractwa!"); throw Error("didn't choose category"); }
                    for (var i = 0; i < sendOrder.length; i++) { troopTypeEnabled[sendOrder[i]] = $(":checkbox#"+sendOrder[i]).is(":checked"); keepHome[sendOrder[i]] = $("#"+sendOrder[i]+"Backup").val(); }
                    enabledCategories = [];
                    enabledCategories.push($("#category1").is(":checked")); enabledCategories.push($("#category2").is(":checked")); enabledCategories.push($("#category3").is(":checked")); enabledCategories.push($("#category4").is(":checked"));
                    if ($("#timeSelectorDate")[0].checked == true) {
                        localStorage.setItem("timeElement", "Date");
                        time.off = Date.parse($("#offDay").val().replace(/-/g, "/") + " " + $("#offTime").val()); time.def = Date.parse($("#defDay").val().replace(/-/g, "/") + " " + $("#defTime").val());
                        time.off = (time.off - serverDate) / 1000 / 3600; time.def = (time.def - serverDate) / 1000 / 3600;
                    } else {
                        localStorage.setItem("timeElement", "Hours"); time.off = $('.runTime_off').val(); time.def = $('.runTime_def').val();
                    }
                    if ($("#settingPriorityPriority")[0].checked == true) { prioritiseHighCat = true; } else { prioritiseHighCat = false; }
                    sendOrder = [];
                    for (var k = 0; k < $("#imgRow :checkbox").length; k++) { sendOrder.push($("#imgRow :checkbox")[k].name) }
                    localStorage.setItem("troopTypeEnabled", JSON.stringify(troopTypeEnabled)); localStorage.setItem("keepHome", JSON.stringify(keepHome)); localStorage.setItem("categoryEnabled", JSON.stringify(enabledCategories)); localStorage.setItem("prioritiseHighCat", JSON.stringify(prioritiseHighCat)); localStorage.setItem("sendOrder", JSON.stringify(sendOrder)); localStorage.setItem("runTimes", JSON.stringify(time));
                    getData();
                }

                function sendGroup(groupNr, premiumEnabled) {
                    var actuallyEnabled = false;
                    if (premiumEnabled == true) { actuallyEnabled = confirm("Jesteś pewny, że chcesz wysłać za PP?"); }
                    var tempSquads = (actuallyEnabled == true) ? window.squads_premium[groupNr] : window.squads[groupNr];
                    
                    if (!tempSquads) {
                        console.error("Brak danych pakietu dla grupy:", groupNr);
                        return;
                    }

                    $(':button[id^="sendGroupBtn"]').prop('disabled', true);
                    
                    TribalWars.post('scavenge_api', { ajaxaction: 'send_squads' }, { "squad_requests": tempSquads }, function () { 
                        UI.SuccessMessage("Grupa została pomyślnie wysłana!"); 
                    }, !1 );

                    setTimeout(function () { 
                        $("#sendRow"+groupNr).remove(); 
                        $(':button[id^="sendGroupBtn"]').prop('disabled', false); 
                        if ($('.btn-launch-group').length > 0) {
                            $('.btn-launch-group').first().focus();
                        }
                    }, 300);
                }

                function calculateHaulCategories(data) {
                    if (data.has_rally_point == true) {
                        var troopsAllowed = {};
                        for (var key in troopTypeEnabled) {
                            if (troopTypeEnabled[key] == true) {
                                if (data.unit_counts_home[key] - keepHome[key] > 0) { troopsAllowed[key] = data.unit_counts_home[key] - keepHome[key]; } else { troopsAllowed[key] = 0; }
                            }
                        }
                        var unitType = { "spear": 'def', "sword": 'def', "axe": 'off', "archer": 'def', "light": 'off', "marcher": 'off', "heavy": 'def' }
                        var typeCount = { 'off': 0, 'def': 0 };
                        for (var prop in troopsAllowed) { typeCount[unitType[prop]] = typeCount[unitType[prop]] + troopsAllowed[prop]; }
                        var totalLoot = 0;
                        for (var key in troopsAllowed) {
                            if (key == "spear") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 25);
                            if (key == "sword") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 15);
                            if (key == "axe") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 10);
                            if (key == "archer") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 10);
                            if (key == "light") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 80);
                            if (key == "marcher") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 50);
                            if (key == "heavy") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 50);
                            if (key == "knight") totalLoot += troopsAllowed[key] * (data.unit_carry_factor * 100);
                        }
                        if (totalLoot == 0) { return; }
                        var haul = 0;
                        if (typeCount.off > typeCount.def) { haul = parseInt(((time.off * 3600) / duration_factor - duration_initial_seconds) ** (1 / (duration_exponent)) / 100) ** (1 / 2); } else { haul = parseInt(((time.def * 3600) / duration_factor - duration_initial_seconds) ** (1 / (duration_exponent)) / 100) ** (1 / 2); }
                        var haulCategoryRate = {};
                        if (data.options[1].is_locked == true || data.options[1].scavenging_squad != null) { haulCategoryRate[1] = 0; } else { haulCategoryRate[1] = haul / 0.1; }
                        if (data.options[2].is_locked == true || data.options[2].scavenging_squad != null) { haulCategoryRate[2] = 0; } else { haulCategoryRate[2] = haul / 0.25; }
                        if (data.options[3].is_locked == true || data.options[3].scavenging_squad != null) { haulCategoryRate[3] = 0; } else { haulCategoryRate[3] = haul / 0.50; }
                        if (data.options[4].is_locked == true || data.options[4].scavenging_squad != null) { haulCategoryRate[4] = 0; } else { haulCategoryRate[4] = haul / 0.75; }
                        for (var i = 0; i < enabledCategories.length; i++) { if (enabledCategories[i] == false) haulCategoryRate[i + 1] = 0; }
                        var totalHaul = haulCategoryRate[1] + haulCategoryRate[2] + haulCategoryRate[3] + haulCategoryRate[4];
                        var unitsReadyForSend = calculateUnitsPerVillage(troopsAllowed, totalLoot, totalHaul, haulCategoryRate);
                        for (var k = 0; k < Object.keys(unitsReadyForSend).length; k++) {
                            var candidate_squad = { "unit_counts": unitsReadyForSend[k], "carry_max": 9999999999 };
                            if (data.options[k + 1].is_locked == false) {
                                squad_requests.push({ "village_id": data.village_id, "candidate_squad": candidate_squad, "option_id": k + 1, "use_premium": false })
                                squad_requests_premium.push({ "village_id": data.village_id, "candidate_squad": candidate_squad, "option_id": k + 1, "use_premium": true })
                            }
                        }
                    }
                }

                function enableCorrectTroopTypes() {
                    worldUnits = game_data.units;
                    for (var i = 0; i < worldUnits.length; i++) {
                        if (worldUnits[i] != "militia" && worldUnits[i] != "snob" && worldUnits[i] != "ram" && worldUnits[i] != "catapult" && worldUnits[i] != "spy") {
                            if (troopTypeEnabled[worldUnits[i]] == true) $("#"+worldUnits[i]).prop("checked", true);
                        }
                    }
                    for (var i = 0; i < categoryEnabled.length + 1; i++) { if (categoryEnabled[i] == true) { $("#category"+(i + 1)).prop("checked", true); } }
                }

                function calculateUnitsPerVillage(troopsAllowed, totalLoot, totalHaul, haulCategoryRate) {
                    var unitHaul = { "spear": 25, "sword": 15, "axe": 10, "archer": 10, "light": 80, "marcher": 50, "heavy": 50, "knight": 100 };
                    var unitsReadyForSend = {}; unitsReadyForSend[0] = {}; unitsReadyForSend[1] = {}; unitsReadyForSend[2] = {}; unitsReadyForSend[3] = {};
                    if (totalLoot > totalHaul) {
                        for (var j = 3; j >= 0; j--) {
                            var reach = haulCategoryRate[j + 1];
                            sendOrder.forEach((unit) => {
                                if (troopsAllowed.hasOwnProperty(unit) && reach > 0) {
                                    var amountNeeded = Math.floor(reach / unitHaul[unit]);
                                    if (amountNeeded > troopsAllowed[unit]) { unitsReadyForSend[j][unit] = troopsAllowed[unit]; reach = reach - (troopsAllowed[unit] * unitHaul[unit]); troopsAllowed[unit] = 0; } else { unitsReadyForSend[j][unit] = amountNeeded; reach = 0; troopsAllowed[unit] = troopsAllowed[unit] - amountNeeded; }
                                }
                            });
                        }
                    } else {
                        var troopNumber = 0; for (var key in troopsAllowed) { troopNumber += troopsAllowed[key]; }
                        if (prioritiseHighCat != true && troopNumber > 130) {
                            for (var j = 0; j < 4; j++) { for (var key in troopsAllowed) { unitsReadyForSend[j][key] = Math.floor((totalLoot / totalHaul * haulCategoryRate[j + 1]) * (troopsAllowed[key] / totalLoot)); } }
                        } else {
                            for (var j = 3; j >= 0; j--) {
                                var reach = haulCategoryRate[j + 1];
                                sendOrder.forEach((unit) => {
                                    if (troopsAllowed.hasOwnProperty(unit) && reach > 0) {
                                        var amountNeeded = Math.floor(reach / unitHaul[unit]);
                                        if (amountNeeded > troopsAllowed[unit]) { unitsReadyForSend[j][unit] = troopsAllowed[unit]; reach = reach - (troopsAllowed[unit] * unitHaul[unit]); troopsAllowed[unit] = 0; } else { unitsReadyForSend[j][unit] = amountNeeded; reach = 0; troopsAllowed[unit] = troopsAllowed[unit] - amountNeeded; }
                                    }
                                });
                            }
                        }
                    }
                    return unitsReadyForSend;
                }

                function resetSettings() {
                    localStorage.removeItem("troopTypeEnabled"); localStorage.removeItem("categoryEnabled"); localStorage.removeItem("prioritiseHighCat"); localStorage.removeItem("sendOrder"); localStorage.removeItem("runTimes"); localStorage.removeItem("keepHome");
                    UI.BanneredRewardMessage("Settings reset"); window.location.reload();
                }
                function closeWindow(title) { $("#" + title).remove(); }
                function settings() { alert("coming soon!"); }
                function zeroPadded(val) { if (val >= 10) return val; else return '0' + val; }
                function setTimeToField(runtimeType) { var d = Date.parse(new Date(serverDate)) + runtimeType * 1000 * 3600; d = new Date(d); d = zeroPadded(d.getHours()) + ":" + zeroPadded(d.getMinutes()); return d; }
                function setDayToField(runtimeType) { var d = Date.parse(new Date(serverDate)) + runtimeType * 1000 * 3600; d = new Date(d); d = d.getFullYear() + "-" + zeroPadded(d.getMonth() + 1) + "-" + zeroPadded(d.getDate()); return d; }
                function fancyTimeFormat(time) {
                    if (time < 0) { return "Time is in the past!" } else {
                        var hrs = ~~(time / 3600); var mins = ~~((time % 3600) / 60); var secs = ~~time % 60;
                        var ret = "Max duration: ";
                        if (hrs > 0) { ret += "" + hrs + ":" + (mins < 10 ? "0" : ""); } else { ret += "0:" + (mins < 10 ? "0" : ""); }
                        ret += "" + mins + ":" + (secs < 10 ? "0" : ""); ret += "" + secs; return ret;
                    }
                }
                function updateTimers() {
                    if ($("#timeSelectorDate")[0].checked == true) {
                        $("#offDisplay")[0].innerText = fancyTimeFormat((Date.parse($("#offDay").val().replace(/-/g, "/") + " " + $("#offTime").val()) - serverDate) / 1000)
                        $("#defDisplay")[0].innerText = fancyTimeFormat((Date.parse($("#defDay").val().replace(/-/g, "/") + " " + $("#defTime").val()) - serverDate) / 1000)
                    } else {
                        $("#offDisplay")[0].innerText = fancyTimeFormat($(".runTime_off").val() * 3600)
                        $("#defDisplay")[0].innerText = fancyTimeFormat($(".runTime_def").val() * 3600)
                    }
                }
                function selectType(type) {
                    switch (type) {
                        case 'Hours':
                            if ($("#timeSelectorDate")[0].checked == true) {
                                $("#offDay").eq(0).removeAttr('disabled'); $("#defDay").eq(0).removeAttr('disabled'); $("#offTime").eq(0).removeAttr('disabled'); $("#defTime").eq(0).removeAttr('disabled'); $(".runTime_off").prop("disabled", true); $(".runTime_def").prop("disabled", true);
                            } else {
                                $("#offDay").prop("disabled", true); $("#defDay").prop("disabled", true); $("#offTime").prop("disabled", true); $("#defTime").prop("disabled", true); $(".runTime_off").eq(0).removeAttr('disabled'); $(".runTime_def").eq(0).removeAttr('disabled');
                            }
                            break;
                        case 'Date':
                            if ($("#timeSelectorHours")[0].checked == true) {
                                $("#offDay").prop("disabled", true); $("#defDay").prop("disabled", true); $("#offTime").prop("disabled", true); $("#defTime").prop("disabled", true); $(".runTime_off").eq(0).removeAttr('disabled'); $(".runTime_def").eq(0).removeAttr('disabled');
                            } else {
                                $("#offDay").eq(0).removeAttr('disabled'); $("#defDay").eq(0).removeAttr('disabled'); $("#offTime").eq(0).removeAttr('disabled'); $("#defTime").eq(0).removeAttr('disabled'); $(".runTime_off").prop("disabled", true); $(".runTime_def").prop("disabled", true);
                            }
                            break;
                        default: break;
                    }
                }

                window.readyToSend = readyToSend;
                window.sendGroup = sendGroup;
                window.resetSettings = resetSettings;
                window.closeWindow = closeWindow;
                window.settings = settings;
                window.updateTimers = updateTimers;
                window.selectType = selectType;
                window.setDayToField = setDayToField;
                window.setTimeToField = setTimeToField;
            };

            const script = document.createElement('script');
            script.id = 'massScavengeScript';
            script.type = 'text/javascript';
            script.textContent = '(' + shinkoLogic.toString() + ')();';
            document.body.appendChild(script);
        }

        if (autoClick) {
            setTimeout(() => {
                const calcBtn = document.getElementById('sendMass');
                if (calcBtn) calcBtn.click();

                const sendLoop = setInterval(() => {
                    const launchBtns = document.querySelectorAll('.btn-launch-group');
                    if (launchBtns.length > 0) {
                        launchBtns[0].click();
                    } else if (document.getElementById('massScavengeFinal') && document.querySelectorAll('.btn-launch-group').length === 0) {
                        clearInterval(sendLoop);
                        setTimeout(() => { location.reload(); }, 1500);
                    }
                }, randomDelay(1200, 2200));

            }, randomDelay(1000, 2000));
        }
    }

    function loadVisualTable() {
        const s = document.createElement('script');
        s.src = 'https://shinko-to-kuma.com/scripts/scavengingOverview.js';
        document.body.appendChild(s);
    }

    function createDraggableUI() {
        const div = document.createElement('div');
        div.id = 'scav-container';

        div.style.top = uiState.top;
        div.style.left = uiState.left;
        if(uiState.top === 'auto') {
            div.style.bottom = uiState.bottom;
            div.style.right = uiState.right;
        }

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '8px';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.style.paddingBottom = '4px';

        const title = document.createElement('span');
        title.textContent = 'Kalkulator Zbierak';
        title.style.fontWeight = 'bold';
        title.style.color = 'var(--title-color)';
        title.style.cursor = uiState.pinned ? 'default' : 'move';

        const pinBtn = document.createElement('span');
        pinBtn.innerHTML = uiState.pinned ? '📌' : '📍';
        pinBtn.style.cursor = 'pointer';
        pinBtn.onclick = () => {
            uiState.pinned = !uiState.pinned;
            pinBtn.innerHTML = uiState.pinned ? '📌' : '📍';
            title.style.cursor = uiState.pinned ? 'default' : 'move';
            localStorage.setItem(`scav_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.appendChild(title);
        header.appendChild(pinBtn);

        const clock = document.createElement('div');
        clock.id = 'scav-clock';
        clock.style.textAlign = 'center';
        clock.style.fontSize = '14px';
        clock.style.fontWeight = 'bold';
        clock.style.color = '#5cb85c';
        clock.style.marginBottom = '8px';
        clock.textContent = isRunning ? "⏳..." : "Wyłączony";

        const delayRow = document.createElement('div');
        delayRow.style.display = 'flex';
        delayRow.style.alignItems = 'center';
        delayRow.style.justifyContent = 'space-between';
        delayRow.style.marginBottom = '8px';

        const delayLabel = document.createElement('span');
        delayLabel.textContent = 'Opóźnienie (s):';

        const delayInputs = document.createElement('div');
        delayInputs.style.display = 'flex';
        delayInputs.style.gap = '4px';

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.id = 'scav-min-delay';
        minInput.className = 'scav-input';
        minInput.value = delayConfig.min;

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.id = 'scav-max-delay';
        maxInput.className = 'scav-input';
        maxInput.value = delayConfig.max;

        const saveDelay = () => {
            let minVal = parseInt(minInput.value) || 0;
            let maxVal = parseInt(maxInput.value) || 0;
            if (minVal > maxVal) maxVal = minVal;
            delayConfig = { min: minVal, max: maxVal };
            localStorage.setItem(`scav_delay_${urlKey}`, JSON.stringify(delayConfig));
        };

        minInput.addEventListener('input', saveDelay);
        maxInput.addEventListener('input', saveDelay);

        delayInputs.appendChild(minInput);
        delayInputs.appendChild(document.createTextNode('-'));
        delayInputs.appendChild(maxInput);
        delayRow.appendChild(delayLabel);
        delayRow.appendChild(delayInputs);

        const btnManualRun = document.createElement('button');
        btnManualRun.textContent = '🚀 Uruchom Zbierak';
        btnManualRun.className = 'scav-btn scav-btn-blue';
        btnManualRun.onclick = () => { loadShinkoMassScavenge(false); };

        const btnOverview = document.createElement('button');
        btnOverview.textContent = 'ℹ️ Pokaż Czasy';
        btnOverview.className = 'scav-btn';
        btnOverview.onclick = () => { loadVisualTable(); };

        const btnUnlock = document.createElement('button');
        btnUnlock.textContent = '⚙️ Odblokuj Zbierak';
        btnUnlock.className = 'scav-btn scav-btn-blue';
        btnUnlock.onclick = () => {
            $.getScript('https://twscripts.dev/scripts/massUnlockScav.js');
        };

        const btnStart = document.createElement('button');
        btnStart.textContent = isRunning ? '❎️ Stop ZBIERACTWO' : '✅️ Start ZBIERACTWO';
        btnStart.className = `scav-btn ${isRunning ? 'scav-btn-red' : 'scav-btn-green'}`;

        btnStart.onclick = () => {
            isRunning = !isRunning;
            localStorage.setItem(`scav_run_${urlKey}`, isRunning);
            location.reload();
        };

        div.appendChild(header);
        div.appendChild(clock);
        div.appendChild(delayRow);
        div.appendChild(btnManualRun);
        div.appendChild(btnOverview);
        div.appendChild(btnUnlock);
        div.appendChild(btnStart);
        document.body.appendChild(div);

        let isDragging = false;
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if (uiState.pinned || e.target === pinBtn || e.target === btnStart || e.target === btnOverview || e.target === btnUnlock || e.target === btnManualRun || e.target === minInput || e.target === maxInput) return;
            isDragging = true;
            let event = e.type.includes('mouse') ? e : e.touches[0];
            startX = event.clientX;
            startY = event.clientY;
            initialX = div.offsetLeft;
            initialY = div.offsetTop;
            div.style.bottom = 'auto';
            div.style.right = 'auto';
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let event = e.type.includes('mouse') ? e : e.touches[0];
            let dx = event.clientX - startX;
            let dy = event.clientY - startY;
            div.style.left = (initialX + dx) + 'px';
            div.style.top = (initialY + dy) + 'px';
        };

        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            uiState.top = div.style.top;
            uiState.left = div.style.left;
            uiState.bottom = 'auto';
            uiState.right = 'auto';
            localStorage.setItem(`scav_ui_${urlKey}`, JSON.stringify(uiState));
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        header.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    function sophieGetAll(urls, onLoad, onDone) {
        let numDone = 0;
        let lastRequestTime = 0;
        let minWaitTime = 1050;

        loadNext();

        function loadNext() {
            if (numDone == urls.length) { onDone(); return; }
            let now = Date.now();
            let timeElapsed = now - lastRequestTime;
            if (timeElapsed < minWaitTime) {
                setTimeout(loadNext, minWaitTime - timeElapsed);
                return;
            }
            lastRequestTime = now;
            $.get(urls[numDone])
                .done((data) => {
                    try { onLoad(numDone, data); ++numDone; loadNext(); }
                    catch (e) { console.error(e); }
                }).fail(() => { setTimeout(loadNext, 1000); });
        }
    }

    function checkScavengeData() {
        const clock = document.getElementById('scav-clock');
        if (!isRunning) {
            clock.textContent = "Wyłączony";
            return;
        }

        $.get(URLReq, function (data) {
            let amountOfPages = 0;
            if ($(data).find(".paged-nav-item").length > 0) {
                // ZABEZPIECZENIE NUMER 2: Null-check dla wyrażenia regularnego
                let lastPageHref = $(data).find(".paged-nav-item")[$(data).find(".paged-nav-item").length - 1].href;
                let pageMatch = lastPageHref.match(/page=(\d+)/);
                amountOfPages = pageMatch ? parseInt(pageMatch[1]) : 0;
            }
            let URLs = [];
            for (let i = 0; i <= amountOfPages; i++) URLs.push(URLReq + "&page=" + i);

            let arrayWithData = "[";

            sophieGetAll(URLs, (i, here) => {
                let thisPageData = $(here).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[2];
                arrayWithData += thisPageData + ",";
            }, () => {
                arrayWithData = arrayWithData.substring(0, arrayWithData.length - 1) + "]";

                try {
                    let scavengeInfo = JSON.parse(arrayWithData);
                    let minTime = Infinity;
                    let hasReadyVillages = false;

                    $.each(scavengeInfo, function (villageNr) {
                        let units = scavengeInfo[villageNr]["unit_counts_home"];
                        let hasTroops = false;
                        if (units) {
                            let totalUnits = (parseInt(units.spear || 0)) +
                                             (parseInt(units.sword || 0)) +
                                             (parseInt(units.axe || 0)) +
                                             (parseInt(units.archer || 0)) +
                                             (parseInt(units.light || 0)) +
                                             (parseInt(units.marcher || 0)) +
                                             (parseInt(units.heavy || 0)) +
                                             (parseInt(units.knight || 0));

                            if (totalUnits >= 10) {
                                hasTroops = true;
                            }
                        } else {
                            hasTroops = true;
                        }

                        $.each(scavengeInfo[villageNr]["options"], function (villageCategoryNr) {
                            let option = scavengeInfo[villageNr]["options"][villageCategoryNr];
                            if (option["is_locked"] !== true) {
                                if (option["scavenging_squad"] == null) {
                                    if (hasTroops) {
                                        hasReadyVillages = true;
                                    }
                                } else {
                                    let endTime = parseInt(option["scavenging_squad"]["return_time"]);
                                    if (endTime < minTime) minTime = endTime;
                                }
                            }
                        });
                    });

                    if (hasReadyVillages) {
                        clock.textContent = "Wysyłka...";
                        loadShinkoMassScavenge(true);
                    } else if (minTime !== Infinity) {
                        let addedSeconds = randomDelay(delayConfig.min, delayConfig.max);
                        let targetTime = minTime + addedSeconds;

                        const interval = setInterval(() => {
                            let currentNow = Math.floor(Date.now() / 1000);
                            let diff = targetTime - currentNow;
                            if (diff <= 0) {
                                clearInterval(interval);
                                clock.textContent = "Odświeżanie...";
                                location.reload();
                            } else {
                                let mins = Math.floor(diff / 60);
                                let secs = diff % 60;
                                clock.textContent = `Zegarek: ${mins}:${secs.toString().padStart(2, '0')}`;
                            }
                        }, 1000);
                    } else {
                        clock.textContent = "Brak ruchu (60s)";
                        setTimeout(() => { location.reload(); }, 60000);
                    }
                } catch (err) {
                    console.error("Błąd parsowania: ", err);
                    clock.textContent = "Błąd struktury";
                }
            });
        });
    }

    createDraggableUI();
    checkScavengeData();
})();
