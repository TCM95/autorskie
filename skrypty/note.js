// ==UserScript==
// @name         Notatki z Raportów
// @namespace    https://viayoo.com/
// @version      2.3
// @description  Zapisuje do 6 raportów
// @author       TCM
// @match        *://*.plemiona.pl/*
// ==/UserScript==

;(async function (TribalWars) {
    const SCRIPT_NAME = 'Notatki z Raportu';

    let TechnologyEnum = {
        TEN_LEVELS: '0',
        THREE_LEVELS: '1',
        SIMPLE: '2',
    };

    let Settings = {
        simulator_luck: -25,
        simulator_def_wall: 20,
        simulator_att_troops: { axe: 6000, light: 3000, ram: 300 },
        back_time_delta: 1 * 3600 * 1000,
        rebuild_time_delta: 48 * 3600 * 1000,
        rebuild_time_threshold: 48 * 3600 * 1000,
        attack_info_lifetime: 30 * 24 * 3600 * 1000,
        
        deff_units: game_data.units.filter(x => -1 !== ['spear', 'sword', 'archer', 'heavy'].indexOf(x)),
        off_units: game_data.units.filter(x => -1 !== ['axe', 'light', 'marcher'].indexOf(x)),
        misc_units: game_data.units.filter(x => -1 !== ['spy', 'ram', 'catapult', 'snob'].indexOf(x)),
        population: {},
        speed: {},
        build_time: {},
        tech: undefined,

        init: function (worldInfo) {
            const core_build_time = {
                spear: 158.44, sword: 233, axe: 205.04, archer: 279.6, spy: 187.1,
                light: 374.2, marcher: 561.25, heavy: 748.35, ram: 1335.3, catapult: 2002.9,
            };
            this.tech = worldInfo.config.game.tech;
            let world_speed = Number(worldInfo.config.speed);
            for (const unit in worldInfo.unit_info) {
                this.population[unit] = Number(worldInfo.unit_info[unit].pop);
                this.speed[unit] = Number(worldInfo.unit_info[unit].speed);
                if (core_build_time[unit]) {
                    this.build_time[unit] = core_build_time[unit] / world_speed;
                }
            }
        },
    };

    let Helper = {
        parse_datetime_string: function (datetime_string) {
            let date_time = datetime_string.split(' ');
            let date = date_time[0].split('.').map(x => Number(x));
            let time = date_time[1].split(':').map(x => Number(x));
            return new Date(2000 + date[2], date[1] - 1, date[0], time[0], time[1], time[2]);
        },

        date_to_datetime_string: function (date) {
            let two_digit = (number) => number < 10 ? `0${number}` : `${number}`;
            return `${two_digit(date.getDate())}.${two_digit(date.getMonth() + 1)}.${two_digit(date.getFullYear() % 100)} ` +
                   `${two_digit(date.getHours())}:${two_digit(date.getMinutes())}:${two_digit(date.getSeconds())}`;
        },

        get_troops_summary: function (troops) {
            function count_population(units) {
                return units.reduce((time, unit) => Settings.population[unit] * troops[unit] + time, 0);
            }
            return {
                troops: troops,
                deff_population: count_population(Settings.deff_units),
                off_population: count_population(Settings.off_units),
                misc_population: count_population(Settings.misc_units),
            };
        },

        generate_link_to_simulator: function (def_troops) {
            let properties = {
                mode: 'sim', moral: 100, luck: Settings.simulator_luck, belief_def: 'on', belief_att: 'on', simulate: 1, def_wall: Settings.simulator_def_wall,
            };
            let append_units = function (context, units) {
                for (const unit in units) {
                    if (units[unit] > 0) {
                        properties[`${context}_${unit}`] = units[unit];
                    }
                }
            };
            append_units('att', Settings.simulator_att_troops);
            append_units('def', def_troops);
            return TribalWars.buildURL('GET', 'place', properties).substr(1);
        },

        get_march_time: function (troops, origin, destination) {
            let march_time_per_field = Object.keys(troops)
                .filter(unit => troops[unit] > 0)
                .reduce((time_per_field, unit) => Math.max(Settings.speed[unit], time_per_field), 0);
            if (march_time_per_field === 0) return 0;
            let distance = Math.hypot(origin[0] - destination[0], origin[1] - destination[1]);
            return Math.round(distance * march_time_per_field * 60) * 1000;
        },

        beautify_number: function (number) {
            if (number < 1000) return `${number}`;
            number /= 1000;
            let precision = number < 10 ? 2 : (number < 100 ? 1 : 0);
            return `${number.toFixed(precision)}K`;
        },

        get_troops_by_row: function (row, start) {
            let troops = {};
            for (let i = start; i < row.cells.length; i++) {
                troops[game_data.units[i - start]] = Number(row.cells[i].innerText);
            }
            return troops;
        },

        handle_error: function (error) {
            if (typeof error === 'string') {
                UI.ErrorMessage(error);
                return;
            }
            console.error(error);
        },
    };

    let NotesScript = {
        context: {},
        village_info: {},
        attack_info: {},

        init: async function () {
            try {
                this.check_screen();
                this.get_report_id();
                this.get_battle_time();
                this.get_context();
                this.get_village_coords();

                if (this.context.side === 'att') {
                    this.get_church();
                    this.get_attack_results();
                    this.check_if_is_empty();
                    this.get_sim();
                    this.get_units_away();
                } else {
                    this.get_back_time();
                }

                this.get_export_code();
                this.get_belief();

                this.get_current_notes().then(old_notes => {
                    try {
                        let new_note = this.parse_notebook(old_notes);
                        if (new_note.error) {
                            UI.InfoMessage('Zatrzymano: ' + new_note.error);
                            return;
                        }
                        this.add_note(new_note);
                    } catch (e) {
                        UI.ErrorMessage(e);
                        console.error(e);
                    }
                });
            } catch (e) {
                Helper.handle_error(e);
            }
        },

        go_next_report: function() {
            let next_report = $('#report-next')[0] || $('a:contains(">>")')[0] \vert{}\vert{} $('.report-nav-next')[0];
            if (next_report) {
                location.href = next_report.href;
            }
        },

        check_screen: function () {
            if ($('.report_ReportAttack').length !== 1) {
                throw 'Czy aby na pewno jesteś w przeglądzie raportu?';
            }
        },

        get_village_coords: function () {
            this.context.village_coords = $(`#attack_info_${this.context.opponent_side}`)[0]
                .rows[1].cells[1].innerText.match(/\d+\|\d+/g).pop();
        },

        get_context: function () {
            let att = $('#attack_info_att');
            let def = $('#attack_info_def');

            const get_player_id = (element) => {
                const nodes = element[0].rows[0].cells[1].children;
                return nodes.length ? nodes[0].href.match(/id=(\d+)/)[1] : '0';
            };

            let att_player_id = get_player_id(att);
            let att_village_id = att.find('.contexted').attr('data-id');
            let def_village_id = def.find('.contexted').attr('data-id');
            let currentPlayerId = game_data.player.id.toString();

            if (currentPlayerId === att_player_id) {
                this.context.side = 'att';
                this.context.opponent_side = 'def';
                this.context.village_id = def_village_id;
            } else {
                this.context.side = 'def';
                this.context.opponent_side = 'att';
                this.context.village_id = att_village_id;
            }
            this.attack_info.type = this.context.side;
        },

        get_export_code: function () {
            this.attack_info.export_code = $('#report_export_code').val().match(/\[report_export].*\[\/report_export\]/)[0];
        },

        get_report_id: function () {
            this.attack_info.report_id = Number(location.href.match(/view=(\d+)/)[1]);
        },

        get_units_away: function () {
            let spy_away = $('#attack_spy_away');
            if (spy_away.length === 1) {
                let row = spy_away.find('table')[0].rows[1];
                this.attack_info.units_away = Helper.get_troops_summary(Helper.get_troops_by_row(row, 0));
            }
        },

        get_back_time: function () {
            let match_coordinates = text => {
                let matches = text.match(/\d{1,3}\|\d{1,3}/g);
                return matches[matches.length - 1].split('|').map(x => Number(x));
            };

            let origin = match_coordinates($('#attack_info_att')[0].rows[1].innerText);
            let destination = match_coordinates($('#attack_info_def')[0].rows[1].innerText);
            let units = Helper.get_troops_by_row($('#attack_info_att_units')[0].rows[1], 1);
            
            let survivors = this.get_survivors('att');
            if (Object.values(survivors).some(x => x > 0)) {
                let march_time = Helper.get_march_time(units, origin, destination);
                if (march_time > 0) {
                    let back_time_timestamp = this.attack_info.battle_time.getTime() + march_time;
                    this.attack_info.back_time = new Date(back_time_timestamp - (back_time_timestamp % 1000));
                }
            }
        },

        get_battle_time: function () {
            let tables = $('.content-border').find('table.vis');
            for (let j = 0; j < tables.length; j++) {
                let rows = tables[j].rows;
                for (let i = 0; i < rows.length; i++) {
                    if (rows[i].cells[0] && rows[i].cells[0].innerText.trim() === 'Czas bitwy') {
                        this.attack_info.battle_time = Helper.parse_datetime_string(rows[i].cells[1].innerText);
                        return;
                    }
                }
            }
            throw 'Nie udało się zlokalizować czasu bitwy.';
        },

        get_attack_results: function () {
            let attack_results = $('#attack_results')[0];
            if (attack_results) {
                this.attack_info.attack_results = {};
                let ram_match = attack_results.innerText.match(/Uszkodzenie przez tarany:\s*Mur uszkodzony z poziomu (\d+) do poziomu (\d+)/);
                let catapult_match = attack_results.innerText.match(/Szkody spowodowane ostrzałem katapult:\s*(.*) uszkodzono z poziomu (\d+) do poziomu (\d+)/);

                if (ram_match) this.attack_info.attack_results.ram_result = ram_match.slice(1).map(Number);
                if (catapult_match) {
                    this.attack_info.attack_results.catapult_result = {
                        target: catapult_match[1].trim(),
                        damage: catapult_match.slice(2).map(Number),
                    };
                }
            }
        },

        get_church: function () {
            let table = $('#attack_spy_building_data');
            if (table.length === 1) {
                let buildings = JSON.parse(table.val());
                let church_match = buildings.find(x => x.id.match(/church/));
                this.village_info.church = church_match ? `${church_match.name} ${church_match.level}` : false;
            }
        },

        check_if_is_empty: function () {
            let def_units = $('#attack_info_def_units');
            if (def_units.length === 1) {
                let troops = def_units[0].rows[1];
                let loses = def_units[0].rows[2];
                let is_clean = true;
                for (let i = 1; i < troops.cells.length; i++) {
                    if (loses.cells[i].innerText !== troops.cells[i].innerText) {
                        is_clean = false;
                        break;
                    }
                }
                if (is_clean) {
                    let is_empty = true;
                    for (let i = 1; i < troops.cells.length; i++) {
                        if (loses.cells[i].innerText !== '0') is_empty = false;
                    }
                    this.attack_info.is_empty = is_empty ? 'PUSTA' : 'WYCZYSZCZONA';
                }
            }
        },

        get_belief: function () {
            let attack_info = $(`#attack_info_${this.context.opponent_side}`);
            if (attack_info.length) {
                let belief_match = attack_info[0].innerText.match(/Siła uderzenia:\s*(\d+)%/);
                if (belief_match) this.village_info.belief = belief_match[1] === '100';
            }
        },

        get_survivors: function (context) {
            let attack_info_units = $(`#attack_info_${context}_units`)[0];
            if (attack_info_units) {
                let defense = Helper.get_troops_by_row(attack_info_units.rows[1], 1);
                let loses = Helper.get_troops_by_row(attack_info_units.rows[2], 1);
                let survivors = {};
                for (const key in defense) {
                    survivors[key] = defense[key] - loses[key];
                }
                return survivors;
            }
            return {};
        },

        get_sim: function () {
            let survivors = this.get_survivors('def');
            if (Object.keys(survivors).length > 0) {
                let summary = Helper.get_troops_summary(survivors);
                if (summary.deff_population !== 0 || summary.off_population !== 0 || summary.misc_population !== 0) {
                    this.village_info.sim = summary;
                    this.attack_info.sim_link = Helper.generate_link_to_simulator(survivors);
                }
            }
        },

        generate_attack_info: function (attack_info) {
            let properties = [Helper.date_to_datetime_string(attack_info.battle_time)];
            
            if (attack_info.sim_link) properties.push(`[url=${attack_info.sim_link}]Symulator[/url]`);
            if (attack_info.is_empty) properties.push(attack_info.is_empty);
            if (attack_info.attack_results) {
                if (attack_info.attack_results.ram_result) {
                    properties.push(`Mur: ${attack_info.attack_results.ram_result[0]} -> ${attack_info.attack_results.ram_result[1]}`);
                }
                if (attack_info.attack_results.catapult_result) {
                    let cat = attack_info.attack_results.catapult_result;
                    properties.push(`${cat.target}: ${cat.damage[0]} -> ${cat.damage[1]}`);
                }
            }
            if (attack_info.back_time) {
                properties.push(`Powrót: ${Helper.date_to_datetime_string(attack_info.back_time)}`);
            }
            if (attack_info.units_away) {
                let away = [];
                if (attack_info.units_away.deff_population) away.push(`deff: ${Helper.beautify_number(attack_info.units_away.deff_population)}`);
                if (attack_info.units_away.off_population) away.push(`off: ${Helper.beautify_number(attack_info.units_away.off_population)}`);
                if (away.length > 0) properties.push(`Poza: (${away.join(', ')})`);
            }

            return `[spoiler=${properties.join(' | ')}]${attack_info.export_code}[color=#EFE6C9]#${attack_info.report_id.toString(36)}[/color][/spoiler]`;
        },

        add_note: function (new_note) {
            TribalWars.post('info_village', { ajaxaction: 'edit_notes', id: this.context.village_id }, { note: new_note }, this.on_note_updated.bind(this));
        },

        on_note_updated: function (response) {
            if (response.note_parsed) {
                UI.SuccessMessage(`Notatka zapisana. Przechodzenie...`);
                this.go_next_report();
            }
        },

        get_current_notes: function () {
            let village_notes_url = TribalWars.buildURL('GET', { screen: 'info_village', id: this.context.village_id });
            return fetch(village_notes_url, { credentials: 'include' })
                .then(t => t.text())
                .then(t => {
                    try { return $(t).find('textarea[name=note]')[0].innerText.trim(); } 
                    catch (e) { return ''; }
                });
        },

        parse_notebook: function (old_notes) {
            let reports = this.get_attack_infos_from_text(old_notes);

            let is_duplicate = reports.some(old => old.report_id === this.attack_info.report_id);
            if (is_duplicate) {
                return { error: 'Ten raport jest już zapisany w notatce.' };
            }

            reports.push(this.attack_info);
            reports.sort((a, b) => b.battle_time.getTime() - a.battle_time.getTime());

            if (reports.length > 6) {
                reports = reports.slice(0, 6);
            }

            let reports_text = reports.map(x => this.generate_attack_info(x)).join('\n');

            let user_notes = '';
            let start_user = old_notes.indexOf('___');
            if (start_user !== -1) {
                user_notes = '\n\n' + old_notes.substr(start_user);
            }

            return `${reports_text}${user_notes}`;
        },

        get_attack_infos_from_text: function (text) {
            let attack_infos_text = text.match(/\[spoiler=.*\[\/spoiler]/g) || [];
            let attack_infos = [];

            for (let i = 0; i < attack_infos_text.length; i++) {
                let attack_info_text = attack_infos_text[i];
                let properties_text = attack_info_text.match(/\[spoiler=(.*)\]\[report_export/)[1];
                let properties = this.parse_old_attack_info_properties(properties_text);
                properties.export_code = attack_info_text.match(/\[report_export].*\[\/report_export\]/)[0];                 properties.report_id = parseInt(attack_info_text.match(/\[color=#EFE6C9\]#(.*)\[\/color\]/)[1], 36);                 attack_infos.push(properties);             }             return attack_infos;         },          parse_old_attack_info_properties: function (properties_text) {             let properties_texts = properties_text.split(' \vert{} ');             let properties = {};                          let battle_time_match = properties_texts.find(x => x.match(/\d{2}.\d{2}.\d{2} \d{2}:\d{2}:\d{2}$/));             if (battle_time_match) properties.battle_time = Helper.parse_datetime_string(battle_time_match.match(/\d{2}.\d{2}.\d{2} \d{2}:\d{2}:\d{2}/)[0]);                          let sim_match = properties_texts.find(x => x.includes('Symulator'));             if (sim_match) properties.sim_link = sim_match.match(/url=(.*)\]Sym/)[1];

            let back_time_match = properties_texts.find(x => x.startsWith('Powrót:'));
            if (back_time_match) properties.back_time = Helper.parse_datetime_string(back_time_match.match(/\d{2}.\d{2}.\d{2} \d{2}:\d{2}:\d{2}/)[0]);
            
            let empty_match = properties_texts.find(x => x === 'WYCZYSZCZONA' || x === 'PUSTA');
            if (empty_match) properties.is_empty = empty_match;
            
            return properties;
        },

        main: async function () {
            try {
                const world_info = await get_world_info({ configs: ['config', 'unit_info'] });
                Settings.init(world_info);
                this.init();
            } catch (error) {
                Helper.handle_error(error);
            }
        },
    };

    $.ajax({
        url: 'https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskiePlikiMapy.js?_=' + ~~(Date.now() / 9e6),
        dataType: 'script',
        cache: true,
    }).then(() => {
        NotesScript.main().catch(Helper.handle_error);
    });
})(TribalWars);
