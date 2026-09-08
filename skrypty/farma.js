// ==UserScript==
// @name         kalkulator farmy
// @namespace    https://viayoo.com/
// @version      2.5
// @description  Rozbudowany interfejs z podziałem sekcji czasowych na minuty i wyśrodkowanymi opcjami
// @author       TCM
// @match        https://*.plemiona.pl/game.php*screen=am_farm*
// ==/UserScript==

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // CZĘŚĆ 1: SILNIK KALKULATORA
    // -------------------------------------------------------------------------
    window.KalkulatorFarmy = {};
    window.KalkulatorFarmy.Library = (function () {
        if (typeof window.twLib === 'undefined') {
            window.twLib = {
                queues: null,
                init: function () {
                    if (this.queues === null) {
                        this.queues = this.queueLib.createQueues(5);
                    }
                },
                queueLib: {
                    maxAttempts: 3,
                    Item: function (action, arg, promise = null) {
                        this.action = action;
                        this.arguments = arg;
                        this.promise = promise;
                        this.attempts = 0;
                    },
                    Queue: function () {
                        this.list = [];
                        this.working = false;
                        this.length = 0;
                        this.doNext = function () {
                            let item = this.dequeue();
                            let self = this;
                            if (item.action == 'openWindow') {
                                window.open(...item.arguments).addEventListener('DOMContentLoaded', function () {
                                    self.start();
                                });
                            } else {
                                $[item.action](...item.arguments)
                                    .done(function () {
                                        item.promise.resolve.apply(null, arguments);
                                        self.start();
                                    })
                                    .fail(function () {
                                        item.attempts += 1;
                                        if (item.attempts < twLib.queueLib.maxAttempts) {
                                            self.enqueue(item, true);
                                        } else {
                                            item.promise.reject.apply(null, arguments);
                                        }
                                        self.start();
                                    });
                            }
                        };
                        this.start = function () {
                            if (this.length) {
                                this.working = true;
                                this.doNext();
                            } else {
                                this.working = false;
                            }
                        };
                        this.dequeue = function () {
                            this.length -= 1;
                            return this.list.shift();
                        };
                        this.enqueue = function (item, front = false) {
                            front ? this.list.unshift(item) : this.list.push(item);
                            this.length += 1;
                            if (!this.working) {
                                this.start();
                            }
                        };
                    },
                    createQueues: function (amount) {
                        let arr = [];
                        for (let i = 0; i < amount; i++) {
                            arr[i] = new twLib.queueLib.Queue();
                        }
                        return arr;
                    },
                    addItem: function (item) {
                        let leastBusyQueue = twLib.queues
                            .map((q) => q.length)
                            .reduce((next, curr) => (curr < next ? curr : next), 0);
                        twLib.queues[leastBusyQueue].enqueue(item);
                    },
                    orchestrator: function (type, arg) {
                        let promise = $.Deferred();
                        let item = new twLib.queueLib.Item(type, arg, promise);
                        twLib.queueLib.addItem(item);
                        return promise;
                    },
                },
                ajax: function () { return twLib.queueLib.orchestrator('ajax', arguments); },
                get: function () { return twLib.queueLib.orchestrator('get', arguments); },
                post: function () { return twLib.queueLib.orchestrator('post', arguments); },
                openWindow: function () {
                    let item = new twLib.queueLib.Item('openWindow', arguments);
                    twLib.queueLib.addItem(item);
                },
            };
            twLib.init();
        }

        const setUnitSpeeds = function () {
            let unitSpeeds = {};
            $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
                $(xml).find('config').children().map((i, el) => {
                    unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber();
                });
                localStorage.setItem('KF_unitSpeeds', JSON.stringify(unitSpeeds));
            });
        };

        const getUnitSpeeds = function () {
            return JSON.parse(localStorage.getItem('KF_unitSpeeds')) || false;
        };

        if (!getUnitSpeeds()) setUnitSpeeds();

        const determineNextPage = function (page, $html) {
            let villageLength = $html.find('#scavenge_mass_screen').length > 0 ? $html.find('tr[id*="scavenge_village"]').length : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
            let navSelect = $html.find('.paged-nav-item').first().closest('td').find('select').first();
            let navLength = $html.find('#am_widget_Farm').length > 0 ? parseInt(
                $('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item')[
                    $('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item').length - 1
                ].textContent.replace(/\D/g, '')
            ) - 1 : navSelect.length > 0 ? navSelect.find('option').length - 1 : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;
            let pageSize = $('#mobileHeader').length > 0 ? 10 : parseInt($html.find('input[name="page_size"]').val());
            
            if (page == -1 && villageLength == 1000) {
                return Math.floor(1000 / pageSize);
            } else if (page < navLength) {
                return page + 1;
            }
            return false;
        };

        const processPage = function (url, page, wrapFn) {
            let pageText = url.match('am_farm') ? `&Farm_page=${page}` : `&page=${page}`;
            return twLib.ajax({ url: url + pageText }).then((html) => {
                return wrapFn(page, $(html));
            });
        };

        const processAllPages = function (url, processorFn) {
            let page = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
            let wrapFn = function (page, $html) {
                let dnp = determineNextPage(page, $html);
                if (dnp) {
                    processorFn($html);
                    return processPage(url, dnp, wrapFn);
                } else {
                    return processorFn($html);
                }
            };
            return processPage(url, page, wrapFn);
        };

        const getDistance = function (origin, target) {
            let a = origin.toCoord(true).x - target.toCoord(true).x;
            let b = origin.toCoord(true).y - target.toCoord(true).y;
            return Math.hypot(a, b);
        };

        const subtractArrays = function (array1, array2) {
            let result = array1.map((val, i) => { return val - array2[i]; });
            return result.some((v) => v < 0) ? false : result;
        };

        const getCurrentServerTime = function () {
            let [hour, min, sec, day, month, year] = $('#serverTime').closest('p').text().match(/\d+/g);
            return new Date(year, month - 1, day, hour, min, sec).getTime();
        };

        const timestampFromString = function (timestr) {
            let d = $('#serverDate').text().split('/').map((x) => +x);
            let todayPattern = new RegExp(window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\d+|:]+)')).exec(timestr);
            let tomorrowPattern = new RegExp(window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\d+|:]+)')).exec(timestr);
            let laterDatePattern = new RegExp(window.lang['0cb274c906d622fa8ce524bcfbb7552d'].replace('%1', '([\\d+|\\.]+)').replace('%2', '([\\d+|:]+)')).exec(timestr);
            let t, date;
            
            if (todayPattern !== null) {
                t = todayPattern[1].split(':');
                date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
            } else if (tomorrowPattern !== null) {
                t = tomorrowPattern[1].split(':');
                date = new Date(d[2], d[1] - 1, d[0] + 1, t[0], t[1], t[2], t[3] || 0);
            } else {
                d = (laterDatePattern[1] + d[2]).split('.').map((x) => +x);
                t = laterDatePattern[2].split(':');
                date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
            }
            return date.getTime();
        };

        String.prototype.toCoord = function (objectified) {
            let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop();
            return c && objectified ? { x: c.split('|')[0], y: c.split('|')[1] } : c;
        };
        String.prototype.toNumber = function () { return parseFloat(this); };
        Number.prototype.toNumber = function () { return parseFloat(this); };

        return { getUnitSpeeds, processPage, processAllPages, getDistance, subtractArrays, getCurrentServerTime, timestampFromString };
    })();

    window.KalkulatorFarmy.Main = (function (Library) {
        const lib = Library;
        let farmBusy = false;

        const bindEventHandlers = function () {
            $('.kf_icon').off('click').on('click', function () {
                sendFarm($(this));
            });

            $(document).off('keydown').on('keydown', (event) => {
                if ((event.keyCode || event.which) == 13) {
                    $('.kf_icon').first().trigger('click');
                }
            });
        };

        const buildTable = function (plan) {
            let html = `<div class="vis kfContent"><h4>Kalkulator Farmy - Lista Ataków</h4><table class="vis" width="100%">
                <tr><div id="KFProgessbar" class="progress-bar live-progress-bar progress-bar-alive" style="width:98%;margin:5px auto;"><div style="background: rgb(146, 194, 0);"></div><span class="label" style="margin-top:0px;"></span></div></tr>
                <tr><th style="text-align:center;">Wioska</th><th style="text-align:center;">Cel</th><th style="text-align:center;">Kratki</th><th style="text-align:center;">Wyślij</th></tr>`;
            
            if (!$.isEmptyObject(plan)) {
                for (let prop in plan) {
                    plan[prop].forEach((val, i) => {
                        html += `<tr class="farmRow row_${i % 2 == 0 ? 'a' : 'b'}">
                            <td style="text-align:center;"><a href="${game_data.link_base_pure}info_village&id=${val.origin.id}">${val.origin.name} (${val.origin.coord})</a></td>
                            <td style="text-align:center;"><a href="${game_data.link_base_pure}info_village&id=${val.target.id}">${val.target.coord}</a></td>
                            <td style="text-align:center;">${val.fields.toFixed(2)}</td>
                            <td style="text-align:center;"><a href="#" data-origin="${val.origin.id}" data-target="${val.target.id}" data-template="${val.template.id}" class="kf_icon farm_icon farm_icon_${val.template.name}" style="margin:auto;"></a></td>
                        </tr>`;
                    });
                }
            } else {
                html += `<tr><td colspan="4" style="text-align: center;">Nie można wysłać żadnych farm przy obecnych ustawieniach.</td></tr>`;
            }
            html += `</table></div>`;
            return html;
        };

        const getData = function (group, newbarbs, losses) {
            let data = { villages: {}, commands: {}, farms: { templates: {}, farms: {} } };
            
            let villagesProcessor = ($html) => {
                let skipUnits = ['ram', 'catapult', 'knight', 'snob', 'militia'];
                const mobileCheck = $('#mobileHeader').length > 0;
                
                if (mobileCheck) {
                    let table = jQuery($html).find('.overview-container > div');
                    table.each((i, el) => {
                        try {
                            const villageId = jQuery(el).find('.quickedit-vn').data('id');
                            const name = jQuery(el).find('.quickedit-label').attr('data-text');
                            const coord = jQuery(el).find('.quickedit-label').text().toCoord();
                            const units = new Array(game_data.units.length).fill(0);
                            const unitsElements = jQuery(el).find('.overview-units-row > div.unit-row-item');
                            
                            unitsElements.each((_, unitElement) => {
                                const img = jQuery(unitElement).find('img');
                                const span = jQuery(unitElement).find('span.unit-row-name');
                                if (img.length && span.length) {
                                    let unitType = img.attr('src').split('unit_')[1].replace('@2x.webp', '').replace('.webp', '').replace('.png', '');
                                    const value = parseInt(span.text()) || 0;
                                    const unitIndex = game_data.units.indexOf(unitType);
                                    if (unitIndex !== -1) { units[unitIndex] = value; }
                                }
                            });
                            
                            const filteredUnits = units.filter((_, index) => skipUnits.indexOf(game_data.units[index]) === -1);
                            data.villages[coord] = { name: name, id: villageId, units: filteredUnits };
                        } catch (e) { console.error('Błąd danych wiosek:', e); }
                    });
                } else {
                    $html.find('#combined_table').find('.row_a, .row_b').filter((i, el) => { return $(el).find('.bonus_icon_33').length == 0; }).map((i, el) => {
                        let $el = $(el);
                        let $qel = $el.find('.quickedit-label').first();
                        let units = $el.find('.unit-item').filter((index, element) => { return (skipUnits.indexOf(game_data.units[index]) == -1); }).map((index, element) => { return $(element).text().toNumber(); }).get();
                        return (data.villages[$qel.text().toCoord()] = { name: $qel.data('text'), id: parseInt($el.find('.quickedit-vn').first().data('id')), units: units });
                    });
                }
                return data;
            };

            let commandsProcessor = ($html) => {
                $html.find('#commands_table').find('.row_a, .row_ax, .row_b, .row_bx').map((i, el) => {
                    let $el = $(el);
                    let coord = $el.find('.quickedit-label').first().text().toCoord();
                    if (coord) {
                        if (!data.commands.hasOwnProperty(coord)) data.commands[coord] = [];
                        return data.commands[coord].push(Math.round(lib.timestampFromString($el.find('td').eq(2).text().trim()) / 1000));
                    }
                });
                return data;
            };

            let farmProcessor = ($html) => {
                if ($.isEmptyObject(data.farms.templates)) {
                    let unitSpeeds = lib.getUnitSpeeds();
                    $html.find('form[action*="action=edit_all"]').find('input[type="hidden"][name*="template"]').closest('tr').map((i, el) => {
                        let $el = $(el);
                        return (data.farms.templates[$el.prev('tr').find('a.farm_icon').first().attr('class').match(/farm_icon_(.*)\s/)[1]] = {
                            id: $el.find('input[type="hidden"][name*="template"][name*="[id]"]').first().val().toNumber(),
                            units: $el.find('input[type="text"], input[type="number"]').map((index, element) => { return $(element).val().toNumber(); }).get(),
                            speed: Math.max(...$el.find('input[type="text"], input[type="number"]').map((index, element) => {
                                return $(element).val().toNumber() > 0 ? unitSpeeds[$(element).attr('name').trim().split('[')[0]] : 0;
                            }).get())
                        });
                    });
                }
                $html.find('#plunder_list').find('tr[id^="village_"]').map((i, el) => {
                    let $el = $(el);
                    return (data.farms.farms[$el.find('a[href*="screen=report&mode=all&view="]').first().text().toCoord()] = {
                        id: $el.attr('id').split('_')[1].toNumber(),
                        color: $el.find('img[src*="graphic/dots/"]').attr('src').match(/dots\/(green|yellow|red|blue|red_blue)/)[1],
                        max_loot: $el.find('img[src*="max_loot/1"]').length > 0
                    });
                });
                return data;
            };

            let findNewbarbs = () => {
                if (newbarbs) {
                    return twLib.get('/map/village.txt').then((allVillages) => {
                        allVillages.match(/[^\r\n]+/g).forEach((villageData) => {
                            let [id, name, x, y, player_id] = villageData.split(',');
                            let coord = `${x}|${y}`;
                            if (player_id == 0 && !data.farms.farms.hasOwnProperty(coord)) {
                                data.farms.farms[coord] = { id: id.toNumber() };
                            }
                        });
                        return data;
                    });
                } else {
                    return data;
                }
            };

            let filterFarms = () => {
                data.farms.farms = Object.fromEntries(
                    Object.entries(data.farms.farms).filter(([key, val]) => {
                        return (!val.hasOwnProperty('color') || (val.color != 'red' && val.color != 'red_blue' && (val.color != 'yellow' || losses)));
                    })
                );
                return data;
            };

            return Promise.all([
                lib.processAllPages(TribalWars.buildURL('GET', 'overview_villages', { mode: 'combined', group: group }), villagesProcessor),
                lib.processAllPages(TribalWars.buildURL('GET', 'overview_villages', { mode: 'commands', type: 'attack' }), commandsProcessor),
                lib.processAllPages(TribalWars.buildURL('GET', 'am_farm'), farmProcessor),
                findNewbarbs()
            ]).then(filterFarms).then(() => { return data; });
        };

        const createPlanning = function (optionDistance, optionTime, optionMaxloot, data) {
            let plan = { counter: 0, farms: {} };
            let serverTime = Math.round(lib.getCurrentServerTime() / 1000);
            
            for (let prop in data.villages) {
                let orderedFarms = Object.keys(data.farms.farms)
                    .map((key) => { return { coord: key, dis: lib.getDistance(prop, key) }; })
                    .sort((a, b) => (a.dis > b.dis ? 1 : -1));
                
                orderedFarms.forEach((el) => {
                    let farmIndex = data.farms.farms[el.coord];
                    let template_name = optionMaxloot && farmIndex.hasOwnProperty('max_loot') && farmIndex.max_loot ? 'b' : 'a';
                    let template = data.farms.templates[template_name];
                    let unitsLeft = lib.subtractArrays(data.villages[prop].units, template.units);
                    let distance = lib.getDistance(prop, el.coord);
                    let arrival = Math.round(serverTime + distance * template.speed * 60 + Math.round(plan.counter / 5));
                    let maxTimeDiff = Math.round(optionTime * 60);
                    let timeDiff = true;
                    
                    if (data.commands.hasOwnProperty(el.coord)) {
                        if (!farmIndex.hasOwnProperty('color') && data.commands[el.coord].length > 0) timeDiff = false;
                        data.commands[el.coord].forEach((timestamp) => {
                            if (Math.abs(timestamp - arrival) < maxTimeDiff) timeDiff = false;
                        });
                    } else {
                        data.commands[el.coord] = [];
                    }
                    
                    if (unitsLeft && timeDiff && distance < optionDistance) {
                        plan.counter++;
                        if (!plan.farms.hasOwnProperty(prop)) plan.farms[prop] = [];
                        plan.farms[prop].push({
                            origin: { coord: prop, name: data.villages[prop].name, id: data.villages[prop].id },
                            target: { coord: el.coord, id: farmIndex.id },
                            fields: distance,
                            template: { name: template_name, id: template.id }
                        });
                        data.villages[prop].units = unitsLeft;
                        data.commands[el.coord].push(arrival);
                    }
                });
            }
            return plan;
        };

        const sendFarm = function ($this) {
            let n = Timing.getElapsedTimeSinceLoad();
            if (!farmBusy && !(Accountmanager.farm.last_click && n - Accountmanager.farm.last_click < 200)) {
                farmBusy = true;
                Accountmanager.farm.last_click = n;
                let $pb = $('#KFProgessbar');
                
                TribalWars.post(
                    Accountmanager.send_units_link.replace(/village=(\d+)/, 'village=' + $this.data('origin')), null,
                    { target: $this.data('target'), template_id: $this.data('template'), source: $this.data('origin') },
                    function (r) {
                        UI.SuccessMessage(r.success);
                        $pb.data('current', $pb.data('current') + 1);
                        UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));
                        $this.closest('.farmRow').remove();
                        farmBusy = false;
                    },
                    function (r) {
                        UI.ErrorMessage(r || 'Błąd podczas wysyłania');
                        $pb.data('current', $pb.data('current') + 1);
                        UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));
                        $this.closest('.farmRow').remove();
                        farmBusy = false;
                    }
                );
            }
        };

        const runLogic = function(options) {
            if (!game_data.features.Premium.active || !game_data.features.FarmAssistent.active) {
                UI.ErrorMessage("Skrypt wymaga konta Premium i Asystenta Farmera.");
                return;
            }
            
            let optionGroup = options.fgGroup || 0;
            let optionDistance = options.fgDistance || 25;
            let optionTime = options.fgTime || 10;
            let optionLosses = options.fgLosses || false;
            let optionMaxloot = options.fgMaxLoot || true;
            let optionNewbarbs = options.fgNewBarbs || false;

            UI.SuccessMessage('Skanuję wioski i przeliczam wojsko...', 1500);
            
            getData(optionGroup, optionNewbarbs, optionLosses).then((data) => {
                let plan = createPlanning(optionDistance, optionTime, optionMaxloot, data);
                $('.kfContent').remove();
                $('#am_widget_Farm').first().before(buildTable(plan.farms));
                bindEventHandlers();
                UI.InitProgressBars();
                UI.updateProgressBar($('#KFProgessbar'), 0, plan.counter);
                $('#KFProgessbar').data('current', 0).data('max', plan.counter);
            });
        };

        return { runLogic };
    })(window.KalkulatorFarmy.Library);

    // -------------------------------------------------------------------------
    // CZĘŚĆ 2: UI Z WYŚRODKOWANIEM I NOWYMI NAGŁÓWKAMI
    // -------------------------------------------------------------------------
    const domain = window.location.hostname.split('.')[0];
    const runningKey = `${domain}_kalkulator_isRunning`;
    const settingsKey = `${domain}_kalkulator_settings`;

    let isRunning = localStorage.getItem(runningKey) === 'true';
    let enterTimeoutId = null;
    let countdownIntervalId = null;
    let startTimeoutIds = [];

    // Zmieniono domyślne reload z sekund (600, 900) na minuty (10, 15)
    let settings = {
        firstDelayMin: 150,
        firstDelayMax: 250,
        planDelayMin: 150,
        planDelayMax: 300,
        enterDelayMin: 90,
        enterDelayMax: 250,
        reloadMin: 10,
        reloadMax: 15,
        fgDistance: 25,
        fgTime: 10,       
        fgMaxLoot: true,
        fgLosses: false,
        fgGroup: 0,
        fgNewBarbs: true
    };

    function injectCSS() {
        if (document.getElementById('tcm-styles')) return;
        const style = document.createElement('style');
        style.id = 'tcm-styles';
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
                --neon-green: #39ff14;
            }
            .tcm-panel-builtin {
                background-color: var(--bg-main);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 8px 12px;
                margin: 8px 0;
                box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                gap: 8px;
                box-sizing: border-box;
            }
            .tcm-panel-header {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                gap: 12px;
                width: 100%;
                flex-wrap: wrap;
            }
            .tcm-panel-collapsible {
                display: none;
                border-top: 1px dashed var(--border-color);
                padding-top: 10px;
                margin-top: 4px;
            }
            .tcm-panel-collapsible.open {
                display: block;
            }
            .tcm-btn {
                background: var(--btn-bg);
                color: var(--text-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                padding: 5px 12px;
                cursor: pointer;
                font-size: 12px;
                display: inline-flex;
                justify-content: center;
                align-items: center;
                font-weight: bold;
                white-space: nowrap;
            }
            .tcm-btn:hover { background: var(--btn-hover); }
            .tcm-btn-green { background: var(--btn-green-bg); }
            .tcm-btn-green:hover { background: var(--btn-green-hover); }
            .tcm-btn-red { background: var(--btn-red-bg); }
            .tcm-btn-red:hover { background: var(--btn-red-hover); }
            .tcm-btn-icon {
                padding: 4px 8px;
                font-size: 15px;
                line-height: 1;
            }
            .tcm-input {
                width: 100%;
                box-sizing: border-box;
                background: var(--bg-row-alt);
                color: white;
                border: 1px solid var(--border-color);
                padding: 4px;
                border-radius: 3px;
                margin-top: 3px;
                text-align: center;
                font-size: 11px;
            }
            .tcm-select {
                width: 100%;
                box-sizing: border-box;
                background: var(--bg-row-alt);
                color: white;
                border: 1px solid var(--border-color);
                padding: 4px;
                border-radius: 3px;
                margin-top: 3px;
                font-size: 11px;
            }
            .tcm-timer {
                font-size: 12px;
                font-weight: bold;
                text-align: center;
                color: var(--neon-green);
                background-color: #1a1c1e;
                padding: 4px 10px;
                border-radius: 4px;
                border: 1px solid var(--neon-green);
                box-shadow: 0 0 6px rgba(57, 255, 20, 0.4);
                text-shadow: 0 0 3px rgba(57, 255, 20, 0.4);
                white-space: nowrap;
                min-width: 75px;
            }
            .tcm-cfg-section-title {
                color: var(--title-color);
                font-weight: bold;
                font-size: 11px;
                margin-bottom: 6px;
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 2px;
            }
            .tcm-cfg-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 12px;
            }
            .tcm-row-fields {
                display: flex;
                flex-direction: row;
                gap: 6px;
                margin-bottom: 6px;
                font-size: 11px;
            }
            .tcm-row-fields > div {
                flex: 1;
            }
        `;
        document.head.appendChild(style);
    }

    function randomDelay(min, max) {
        const safeMin = Math.max(1, Number(min) || 1);
        const safeMax = Math.max(safeMin, Number(max) || safeMin);
        return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
    }

    function loadSettings() {
        try {
            settings = { ...settings, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') };
        } catch (e) {
            console.warn('Błąd wczytywania ustawień.');
        }
    }

    function saveSettings() {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    }

    function setStatus(text) {
        const countdownEl = document.getElementById('tcm-countdown');
        if (countdownEl) countdownEl.innerText = text;
    }

    function rememberTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            startTimeoutIds = startTimeoutIds.filter((id) => id !== timeoutId);
            callback();
        }, delay);
        startTimeoutIds.push(timeoutId);
        return timeoutId;
    }

    function clearStartTimeouts() {
        startTimeoutIds.forEach((id) => clearTimeout(id));
        startTimeoutIds = [];
    }

    function pressEnterRandomly() {
        if (!isRunning) return;
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true
        }));
        enterTimeoutId = setTimeout(pressEnterRandomly, randomDelay(settings.enterDelayMin, settings.enterDelayMax));
    }

    function startCountdown() {
    function startCountdown() {
    clearInterval(countdownIntervalId);
    
    // 1. Zamieniamy minuty na sekundy (np. 5 min -> 300s, 10 min -> 600s)
    const minSeconds = Math.round((parseFloat(settings.reloadMin) || 1) * 60);
    const maxSeconds = Math.round((parseFloat(settings.reloadMax) || minSeconds) * 60);
    
    // 2. Losujemy dowolną SEKUNDĘ z przedziału np. [300, 600]
    let timeLeft = randomDelay(minSeconds, maxSeconds);
    
    countdownIntervalId = setInterval(() => {
        if (!isRunning) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
            return;
        }
        if (timeLeft <= 0) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
            setStatus('Odświeżanie...');
            location.reload();
            return;
        }
        
        // 3. Wyświetlanie formatu Xm Ys (np. 6m 48s)
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        setStatus(`${m}m ${s < 10 ? '0' : ''}${s}s`);
        timeLeft--;
    }, 1000);
        
    }

    function startProcess() {
        if (!isRunning) return;
        clearStartTimeouts();
        clearTimeout(enterTimeoutId);
        clearInterval(countdownIntervalId);
        
        setStatus('Kalkuluję...');
        
        rememberTimeout(() => {
            if (!isRunning) return;
            window.KalkulatorFarmy.Main.runLogic(settings);
            
            rememberTimeout(() => {
                if (!isRunning) return;
                setStatus('Wysyłanie');
                pressEnterRandomly();
                startCountdown();
            }, randomDelay(settings.planDelayMin, settings.planDelayMax));
        }, randomDelay(settings.firstDelayMin, settings.firstDelayMax));
    }

    function stopProcess() {
        clearStartTimeouts();
        clearTimeout(enterTimeoutId);
        clearInterval(countdownIntervalId);
        enterTimeoutId = null;
        countdownIntervalId = null;
        isRunning = false;
        localStorage.setItem(runningKey, 'false');
        updateButtonState(false);
        setStatus('Gotowy');
    }

    function toggleProcess() {
        if (isRunning) { 
            stopProcess(); 
        } else {
            isRunning = true;
            localStorage.setItem(runningKey, 'true');
            updateButtonState(true);
            startProcess();
        }
    }

    function buildGroupSelect(selectedGroupId) {
        return $.get(TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' })).then((groups) => {
            let html = `<select id="cfgGroup" class="tcm-select">`;
            groups.result.forEach((val) => {
                if (val.type == 'separator') {
                    html += `<option disabled="disabled">──────</option>`;
                } else {
                    html += `<option value="${val.group_id}" ${val.group_id == selectedGroupId ? 'selected' : ''}>${val.name}</option>`;
                }
            });
            html += `</select>`;
            return html;
        });
    }

    function updateButtonState(running) {
        const akcjaBtn = document.getElementById('tcm-main-btn');
        const countdownEl = document.getElementById('tcm-countdown');
        if (!akcjaBtn || !countdownEl) return;

        if (running) {
            akcjaBtn.innerHTML = '❎️ Zatrzymaj';
            akcjaBtn.className = 'tcm-btn tcm-btn-red';
        } else {
            akcjaBtn.innerHTML = '✅️ Uruchom';
            akcjaBtn.className = 'tcm-btn tcm-btn-green';
            countdownEl.innerText = 'Gotowy';
        }
    }

    function bindSettingsEvents() {
        const updateSetting = () => {
            settings.fgGroup = Number(document.getElementById('cfgGroup')?.value) || 0;
            settings.fgDistance = Number(document.getElementById('cfgDistance')?.value) || 25;
            settings.fgTime = Number(document.getElementById('cfgTime')?.value) || 10;
            settings.fgMaxLoot = document.getElementById('cfgMaxLoot')?.checked || false;
            settings.fgLosses = document.getElementById('cfgLosses')?.checked || false;
            settings.fgNewBarbs = document.getElementById('cfgNewBarbs')?.checked || false;

            settings.enterDelayMin = Number(document.getElementById('cfgEnterMin')?.value) || 90;
            settings.enterDelayMax = Number(document.getElementById('cfgEnterMax')?.value) || settings.enterDelayMin;
            settings.reloadMin = Number(document.getElementById('cfgReloadMin')?.value) || 10;
            settings.reloadMax = Number(document.getElementById('cfgReloadMax')?.value) || settings.reloadMin;

            if (settings.enterDelayMax < settings.enterDelayMin) settings.enterDelayMax = settings.enterDelayMin;
            if (settings.reloadMax < settings.reloadMin) settings.reloadMax = settings.reloadMin;

            saveSettings();
        };

        const inputs = document.querySelectorAll('.tcm-panel-collapsible input, .tcm-panel-collapsible select');
        inputs.forEach((input) => {
            input.addEventListener('change', updateSetting);
            input.addEventListener('input', updateSetting);
        });
    }

    function createUI() {
        injectCSS();
        loadSettings();

        const oldPanel = document.getElementById('tcm-main-container');
        if (oldPanel) oldPanel.remove();

        const container = document.createElement('div');
        container.id = 'tcm-main-container';
        container.className = 'tcm-panel-builtin';

        // Pasek główny
        const headerRow = document.createElement('div');
        headerRow.className = 'tcm-panel-header';

        const countdownElement = document.createElement('div');
        countdownElement.id = 'tcm-countdown';
        countdownElement.className = 'tcm-timer';
        countdownElement.innerText = 'Gotowy';

        const akcjaBtn = document.createElement('button');
        akcjaBtn.id = 'tcm-main-btn';
        akcjaBtn.className = 'tcm-btn';
        akcjaBtn.addEventListener('click', toggleProcess);

        const toggleSettingsBtn = document.createElement('button');
        toggleSettingsBtn.id = 'tcm-toggle-cfg-btn';
        toggleSettingsBtn.className = 'tcm-btn tcm-btn-icon';
        toggleSettingsBtn.title = 'Ustawienia';
        toggleSettingsBtn.innerText = '⚙️';

        headerRow.appendChild(countdownElement);
        headerRow.appendChild(akcjaBtn);
        headerRow.appendChild(toggleSettingsBtn);

        // Panel ustawień z nowym układem
        const collapsibleArea = document.createElement('div');
        collapsibleArea.id = 'tcm-cfg-area';
        collapsibleArea.className = 'tcm-panel-collapsible';

        container.appendChild(headerRow);
        container.appendChild(collapsibleArea);

        buildGroupSelect(settings.fgGroup).then((groupSelectHtml) => {
            collapsibleArea.innerHTML = `
                <div class="tcm-cfg-container">
                    <div>
                        <div class="tcm-cfg-section-title">Parametry Farmowania</div>
                        <div style="margin-bottom:6px;">
                            <label>Grupa wiosek:</label>
                            ${groupSelectHtml}
                        </div>
                        <div class="tcm-row-fields">
                            <div>
                                <label>Max kratki:
                                    <input type="number" id="cfgDistance" value="${settings.fgDistance}" class="tcm-input">
                                </label>
                            </div>
                            <div>
                                <label>Odstęp (min):
                                    <input type="number" id="cfgTime" value="${settings.fgTime}" class="tcm-input">
                                </label>
                            </div>
                        </div>
                        <!-- Wyśrodkowane opcje na dole kolumny -->
                        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin-top:12px; font-size:11px;">
                            <label style="cursor:pointer;"><input type="checkbox" id="cfgMaxLoot" ${settings.fgMaxLoot ? 'checked' : ''}> Full loot</label>
                            <label style="cursor:pointer;"><input type="checkbox" id="cfgLosses" ${settings.fgLosses ? 'checked' : ''}> Straty</label>
                            <label style="cursor:pointer;"><input type="checkbox" id="cfgNewBarbs" ${settings.fgNewBarbs ? 'checked' : ''}> Nowe barby</label>
                        </div>
                    </div>
                    <div>
                        <!-- Nagłówek 1: Prędkość klikania -->
                        <div class="tcm-cfg-section-title">Prędkość klikania (ms)</div>
                        <div class="tcm-row-fields">
                            <div>
                                <label>Min:
                                    <input type="number" id="cfgEnterMin" value="${settings.enterDelayMin}" class="tcm-input">
                                </label>
                            </div>
                            <div>
                                <label>Max:
                                    <input type="number" id="cfgEnterMax" value="${settings.enterDelayMax}" class="tcm-input">
                                </label>
                            </div>
                        </div>
                        <!-- Nagłówek 2: Pętla -->
                        <div class="tcm-cfg-section-title" style="margin-top: 10px;">Pętla (min.)</div>
                        <div class="tcm-row-fields">
                            <div>
                                <label>Min:
                                    <input type="number" id="cfgReloadMin" value="${settings.reloadMin}" class="tcm-input">
                                </label>
                            </div>
                            <div>
                                <label>Max:
                                    <input type="number" id="cfgReloadMax" value="${settings.reloadMax}" class="tcm-input">
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            bindSettingsEvents();
        });

        toggleSettingsBtn.addEventListener('click', () => {
            collapsibleArea.classList.toggle('open');
        });

        let targetTarget = $('#farm_units').closest('.vis');
        if (targetTarget.length === 0) {
            targetTarget = $('#am_widget_Farm');
        }

        if (targetTarget.length > 0) {
            targetTarget.after(container);
        } else {
            document.body.prepend(container);
        }

        updateButtonState(isRunning);
    }

    createUI();
    if (isRunning) startProcess();
})();
