// ==UserScript==
// @name         Notatki
// @namespace    https://viayoo.com/
// @version      1.2
// @description  Automatyczne notatki z mobilnym UI (Pomiń/Dodaj), wsparciem kolorów i auto-next
// @author       TCM
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
        simulator_att_troops: {
            axe: 6000,
            light: 3000,
            ram: 300,
        },
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

        calculate_rebuild_time: function (troops) {
            let rebuild_time = function (units) {
                return (
                    units
                        .filter(unit => troops[unit] > 0)
                        .reduce((time, unit) => Settings.build_time[unit] * troops[unit] + time, 0) * 1000
                );
            };
            return Math.max(
                rebuild_time(['spear', 'sword', 'axe', 'archer']),
                rebuild_time(['spy', 'light', 'marcher', 'heavy']),
                rebuild_time(['ram', 'catapult'])
            );
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
                mode: 'sim',
                moral: 100,
                luck: Settings.simulator_luck,
                belief_def: 'on',
                belief_att: 'on',
                simulate: 1,
                def_wall: Settings.simulator_def_wall,
            };
            let append_units = function (context, units) {
                for (const unit in units) {
                    if (units[unit] > 0) {
                        properties[`${context}_${unit}`] = units[unit];
                        switch (Settings.tech) {
                            case TechnologyEnum.TEN_LEVELS:
                                properties[`${context}_tech_${unit}`] = 10;
                                break;
                            case TechnologyEnum.THREE_LEVELS:
                                properties[`${context}_tech_${unit}`] = 3;
                                break;
                        }
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
            
            if (march_time_per_field === 0) throw 'Nie wykryto wojsk do marszu (prędkość 0).';

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
            const gui = `<h2>Błąd Przetwarzania Raportu</h2>
                <p><strong>Komunikat: </strong><br/>
                <textarea rows='5' style='width:100%;'>${error}\n\n${error.stack}</textarea></p>`;
            Dialog.show(SCRIPT_NAME, gui);
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
                
                await this.get_context();
                this.get_village_coords();

                if (this.context.side === 'att') {
                    this.get_church();
                    this.get_attack_results();
                    this.check_if_is_empty();
                    this.get_sim();
                    this.get_units_away();
                }
                if (this.context.side === 'def') {
                    this.get_back_time();
                }

                this.get_export_code();
                this.get_rebuild_time();
                this.get_belief();
                this.get_troops_type();
                
                await this.check_report();

                this.get_current_notes().then(old_notes => {
                    try {
                        let new_note = this.parse_notebook(old_notes);
                        if (new_note.error) {
                            UI.ErrorMessage(new_note.error);
                            this.go_next_report();
                            return; 
                        }
                        this.add_note(new_note);
                    } catch (e) {
                        UI.ErrorMessage(e);
                        console.error(e);
                    }
                });
            } catch (e) {
                if (typeof e === 'string') {
                    UI.ErrorMessage(e);
                } else {
                    Helper.handle_error(e);
                }
            }
        },

        go_next_report: function() {
            let next_report = $('#report-next')[0];
            if (next_report) {
                location.href = next_report.href;
            }
        },

        inject_css: function() {
            if (!document.getElementById('gray-notes-css')) {
                const style = document.createElement('style');
                style.id = 'gray-notes-css';
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
                    #gray-notes-overlay {
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: rgba(0,0,0,0.6); z-index: 999999;
                        display: flex; justify-content: center; align-items: center;
                    }
                    .gn-box {
                        background: var(--bg-main); border: 2px solid var(--border-color);
                        border-radius: 8px; padding: 20px; text-align: center; color: var(--text-color);
                        font-family: Arial, sans-serif; min-width: 250px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    }
                    .gn-title { font-size: 16px; font-weight: bold; color: var(--title-color); margin-bottom: 20px; }
                    .gn-btn-row { display: flex; justify-content: space-around; gap: 10px; }
                    .gn-btn {
                        background: var(--btn-bg); color: var(--text-color); border: 1px solid var(--border-color); 
                        padding: 10px 20px; border-radius: 4px; font-weight: bold; text-transform: uppercase; cursor: pointer;
                        flex-grow: 1;
                    }
                    .gn-btn:active { background: var(--btn-hover); }
                `;
                document.head.appendChild(style);
            }
        },

        prompt_side: function() {
            return new Promise((resolve) => {
                this.inject_css();
                const overlay = document.createElement('div');
                overlay.id = 'gray-notes-overlay';
                overlay.innerHTML = `
                    <div class="gn-box">
                        <div class="gn-title">Dodać notatkę do:</div>
                        <div class="gn-btn-row">
                            <button class="gn-btn" id="gn-btn-agresor">Agresor</button>
                            <button class="gn-btn" id="gn-btn-obronca">Obrońca</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                const handleSelection = (side) => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                        resolve(side);
                    }
                };

                document.getElementById('gn-btn-agresor').addEventListener('touchstart', (e) => { e.preventDefault(); handleSelection('att'); }, { passive: false });
                document.getElementById('gn-btn-obronca').addEventListener('touchstart', (e) => { e.preventDefault(); handleSelection('def'); }, { passive: false });
                document.getElementById('gn-btn-agresor').addEventListener('click', () => handleSelection('att'));
                document.getElementById('gn-btn-obronca').addEventListener('click', () => handleSelection('def'));
            });
        },

        prompt_skip: function() {
            return new Promise((resolve) => {
                this.inject_css();
                const overlay = document.createElement('div');
                overlay.id = 'gray-notes-overlay';
                overlay.innerHTML = `
                    <div class="gn-box">
                        <div class="gn-title">Ten raport wydaje się nic nie wnosić.<br>Co zrobić?</div>
                        <div class="gn-btn-row">
                            <button class="gn-btn" id="gn-btn-pomin">Pomiń</button>
                            <button class="gn-btn" id="gn-btn-dodaj">Dodaj</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                const handleSelection = (decision) => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                        resolve(decision);
                    }
                };

                document.getElementById('gn-btn-pomin').addEventListener('touchstart', (e) => { e.preventDefault(); handleSelection(false); }, { passive: false });
                document.getElementById('gn-btn-dodaj').addEventListener('touchstart', (e) => { e.preventDefault(); handleSelection(true); }, { passive: false });
                document.getElementById('gn-btn-pomin').addEventListener('click', () => handleSelection(false));
                document.getElementById('gn-btn-dodaj').addEventListener('click', () => handleSelection(true));
            });
        },

        check_report: async function () {
            if (Object.keys(this.village_info).length === 1 && Object.keys(this.attack_info).length === 3) {
                let force_add = await this.prompt_skip();
                if (!force_add) {
                    this.go_next_report();
                    throw 'Pominięto pusty raport.';
                }
            }
            if (this.village_info.troops_type) this.save_coords(this.village_info.troops_type);
            if (typeof this.village_info.belief === 'boolean' && !this.village_info.belief) {
                this.save_coords('without_belief');
            }
        },

        save_coords: function (key) {
            const full_key = ['GrayNotes', key].join('_');
            let item = localStorage.getItem(full_key);
            const arr = item === null ? [] : JSON.parse(item);
            arr.push(this.context.village_coords);
            localStorage.setItem(full_key, JSON.stringify([...new Set(arr)]));
        },

        check_screen: function () {
            if ($('.report_ReportAttack').length !== 1) {
                if ($('[class*=report_Report]').length !== 0) throw 'Tego typu raporty nie są obsługiwane.';
                throw 'Czy aby na pewno jesteś w przeglądzie raportu?';
            }
        },

        get_village_coords: function () {
            this.context.village_coords = $(`#attack_info_${this.context.opponent_side}`)[0]
                .rows[1].cells[1].innerText.match(/\d+\|\d+/g).pop();
        },

        get_context: async function () {
            let att = $('#attack_info_att');
            let def = $('#attack_info_def');

            const get_player_name = (element) => element[0].rows[0].cells[1].innerText.trim();
            const get_player_id = (element) => {
                const nodes = element[0].rows[0].cells[1].children;
                return nodes.length ? nodes[0].href.match(/id=(\d+)/)[1] : '0';
            };

            let att_player_name = get_player_name(att);
            let def_player_name = get_player_name(def);
            let att_player_id = get_player_id(att);
            let def_player_id = get_player_id(def);
            let att_village_id = att.find('.contexted').attr('data-id');
            let def_village_id = def.find('.contexted').attr('data-id');

            let get_forwarder = function () {
                let tables = $('.content-border').find('table.vis');
                for (let j = 0; j < tables.length; j++) {
                    let rows = tables[j].rows;
                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i].cells[0] && rows[i].cells[0].innerText === 'Przesłane od:') {
                            return rows[i].cells[1].innerText.trim();
                        }
                    }
                }
                return null;
            };

            let forwarder = get_forwarder();
            let currentPlayerId = game_data.player.id.toString();

            let is_side_att = currentPlayerId === att_player_id || forwarder === att_player_name;
            let is_side_def = currentPlayerId === def_player_id || forwarder === def_player_name;

            if (is_side_att && !is_side_def) {
                this.context.side = 'att';
            } else if (is_side_def && !is_side_att) {
                this.context.side = 'def';
            } else {
                this.context.side = await this.prompt_side();
            }

            this.context.opponent_side = this.context.side === 'att' ? 'def' : 'att';
            this.village_info.player_id = this.context.side === 'att' ? def_player_id : att_player_id;
            this.context.village_id = this.context.side === 'att' ? def_village_id : att_village_id;

            let village_player_id = (this.context.side === 'att' ? def : att)[0].rows[1].cells[1].children[0].getAttribute('data-player');
            if (this.village_info.player_id !== village_player_id) {
                this.add_note('');
                throw 'Docelowa wioska zmieniła właściciela!';
            }
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

        get_troops_type: function () {
            let verdict = function (summary, threshold) {
                if (summary.off_population > threshold) return 'OFF';
                if (summary.deff_population > threshold) return 'DEFF';
                if (summary.off_population && summary.deff_population === 0) return 'OFF';
                if (summary.deff_population && summary.off_population === 0) return 'DEFF';
                return undefined;
            };

            if (this.attack_info.units_away) {
                let troops_type = verdict(this.attack_info.units_away, 1000);
                if (troops_type) {
                    this.village_info.troops_type = troops_type;
                    return;
                }
            }

            let attack_info_units = $(`#attack_info_${this.context.opponent_side}_units`)[0];
            if (attack_info_units) {
                let troops = Helper.get_troops_by_row(attack_info_units.rows[1], 1);
                if (troops) {
                    let troops_type = verdict(Helper.get_troops_summary(troops), 3000);
                    if (troops_type) this.village_info.troops_type = troops_type;
                }
            }
        },

        get_rebuild_time: function () {
            let attack_info_units = $(`#attack_info_${this.context.opponent_side}_units`)[0];
            if (attack_info_units) {
                let loses = Helper.get_troops_by_row(attack_info_units.rows[2], 1);
                if (loses) {
                    let rebuild_time = Helper.calculate_rebuild_time(loses);
                    if (rebuild_time > Settings.rebuild_time_threshold) {
                        this.attack_info.rebuild_time = new Date(this.attack_info.battle_time.getTime() + rebuild_time);
                    }
                }
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
                let back_time_timestamp = this.attack_info.battle_time.getTime() + march_time;
                this.attack_info.back_time = new Date(back_time_timestamp - (back_time_timestamp % 1000));
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
            throw 'Nie udało się zlokalizować czasu bitwy w raporcie.';
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
                let is_empty = true;
                let is_clean = true;
                for (let i = 1; i < troops.cells.length; i++) {
                    if (loses.cells[i].innerText !== troops.cells[i].innerText) {
                        is_clean = false;
                        break;
                    }
                }
                if (is_clean) {
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
                }
            }
        },

        generate_attack_info: function (attack_info) {
            let properties = [Helper.date_to_datetime_string(attack_info.battle_time)];
            if (attack_info.is_empty) properties.push(attack_info.is_empty);
            if (attack_info.attack_results) {
                if (attack_info.attack_results.ram_result) {
                    properties.push(`Mur uszkodzony z poziomu ${attack_info.attack_results.ram_result[0]} do poziomu ${attack_info.attack_results.ram_result[1]}`);
                }
                if (attack_info.attack_results.catapult_result) {
                    let cat = attack_info.attack_results.catapult_result;
                    properties.push(`${cat.target} uszkodzono z poziomu ${cat.damage[0]} do poziomu ${cat.damage[1]}`);
                }
            }
            if (attack_info.back_time && attack_info.back_time.getTime() + Settings.back_time_delta > Date.now()) {
                properties.push(`Czas powrotu: ${Helper.date_to_datetime_string(attack_info.back_time)}`);
            }
            if (attack_info.rebuild_time && attack_info.rebuild_time.getTime() + Settings.rebuild_time_delta > Date.now()) {
                properties.push(`Odbudowa dnia: ${Helper.date_to_datetime_string(attack_info.rebuild_time)}`);
            }
            if (attack_info.units_away) {
                let away = [];
                if (attack_info.units_away.deff_population) away.push(`deff: ${Helper.beautify_number(attack_info.units_away.deff_population)}`);
                if (attack_info.units_away.off_population) away.push(`off: ${Helper.beautify_number(attack_info.units_away.off_population)}`);
                if (away.length > 0) properties.push(`Poza: (${away.join(', ')})`);
            }
            if (attack_info.catapult_attack_result_plaintext) properties.push(attack_info.catapult_attack_result_plaintext);
            if (attack_info.ram_attack_result_plaintext) properties.push(attack_info.ram_attack_result_plaintext);

            return `[spoiler=${properties.join(' | ')}]${attack_info.export_code}[color=#EFE6C9]#${attack_info.report_id.toString(36)}[/color][/spoiler]`;
        },

        generate_village_info() {
            let properties = [];
            if (this.village_info.troops_type) {
                if (this.village_info.troops_type === 'OFF') {
                    // Magia BBCode: wyłącza domyślny niebieski, aktywuje czerwony, a po sobie przywraca niebieski dla dalszych tagów
                    properties.push('[/color][color=#ff0000]Wioska OFF[/color][color=#0000ff]');
                } else if (this.village_info.troops_type === 'DEFF') {
                    properties.push('Wioska DEFF'); // Będzie domyślnie objęte głównym tagiem niebieskim
                } else {
                    properties.push(this.village_info.troops_type);
                }
            }
            if (typeof this.village_info.church === 'string') properties.push(this.village_info.church);
            if (typeof this.village_info.belief === 'boolean' && !this.village_info.belief) properties.push('Bez wiary');
            if (this.village_info.sim) {
                let url = Helper.generate_link_to_simulator(this.village_info.sim.troops);
                let deff_count = Helper.beautify_number(this.village_info.sim.deff_population);
                properties.push(`[url=${url}]Symulacja ${deff_count}[/url]`);
            }
            if (this.village_info.sim_plaintext) properties.push(this.village_info.sim_plaintext);
            if (this.village_info.player_id) properties.push(`[color=#F5EDDA]${this.village_info.player_id}[/color]`);
            return properties.join(' | ');
        },

        add_note: function (new_note) {
            TribalWars.post('info_village', { ajaxaction: 'edit_notes', id: this.context.village_id }, { note: new_note }, this.on_note_updated.bind(this));
        },

        on_note_updated: function (response) {
            if (response.note_parsed) {
                UI.SuccessMessage(`Notatka dodana do wioski ${this.context.side === 'def' ? 'atakującego' : 'broniącego'}`);
                this.go_next_report();
            } else {
                location.href = TribalWars.buildURL('GET', 'report', { action: 'del_one', mode: 'attack', id: this.attack_info.report_id, h: game_data.csrf });
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

        merge_village_info: function (old_village_info) {
            if (typeof this.village_info.belief === 'undefined') this.village_info.belief = old_village_info.belief;
            if (typeof this.village_info.church === 'undefined') this.village_info.church = old_village_info.church;
            if (typeof this.village_info.troops_type === 'undefined') this.village_info.troops_type = old_village_info.troops_type;
            if (typeof this.village_info.sim === 'undefined') this.village_info.sim_plaintext = old_village_info.sim_plaintext;
        },

        get_user_notes: function (old_notes) {
            let start = old_notes.indexOf('___');
            return start === -1 ? old_notes : old_notes.substr(start + 3);
        },

        parse_notebook: function (old_notes) {
            let old_village_info = this.get_old_village_info(old_notes);
            let attack_infos = this.get_attack_infos(old_notes);
            let user_notes = this.get_user_notes(old_notes);

            if (old_village_info.player_id !== this.village_info.player_id) {
                attack_infos = [];
            } else {
                this.merge_village_info(old_village_info);
            }

            if (attack_infos.some(old_info => old_info.report_id === this.attack_info.report_id)) {
                return { error: 'Wioska ma już zapisany ten raport.' };
            }

            attack_infos.push(this.attack_info);
            attack_infos.sort((lhs, rhs) => rhs.battle_time.getTime() - lhs.battle_time.getTime());
            attack_infos = attack_infos.filter(x => x.battle_time.getTime() + Settings.attack_info_lifetime > Date.now());

            let attack_infos_text = attack_infos.map(x => this.generate_attack_info(x)).join('\n');
            // Domyślny niebieski tag na całą sekcję informacji o wiosce
            return `[size=15][b][color=#0000ff]${this.generate_village_info()}[/color][/b][/size] \n\n${attack_infos_text}\n___${user_notes}`;
        },

        get_attack_infos: function (old_notes) {
            let start = old_notes.indexOf('\n\n');
            let end = old_notes.indexOf('___');
            if (end === -1 || start === -1) return [];

            let attack_infos_region = old_notes.substr(start + 2, end - start - 2);
            let attack_infos_text = attack_infos_region.match(/\[spoiler=.*\[\/spoiler]/g) || [];
            let attack_infos = [];

            for (let i = 0; i < attack_infos_text.length; i++) {
                let attack_info_text = attack_infos_text[i];
                let properties_text = attack_info_text.match(/\[spoiler=(.*)\]\[report_export/)[1];
                let properties = this.parse_old_attack_info_properties(properties_text);
                properties.export_code = attack_info_text.match(/\[report_export].*\[\/report_export\]/)[0];
                properties.report_id = parseInt(attack_info_text.match(/\[color=#EFE6C9\]#(.*)\[\/color\]/)[1], 36);
                attack_infos.push(properties);
            }
            return attack_infos;
        },

        parse_old_attack_info_properties: function (properties_text) {
            let properties_texts = properties_text.split(' | ');
            let properties = {};
            
            let battle_time_match = properties_texts.find(x => x.match(/^\d{2}.\d{2}.\d{2} \d{2}:\d{2}:\d{2}$/));
            if (battle_time_match) properties.battle_time = Helper.parse_datetime_string(battle_time_match);
            
            let rebuild_time_match = properties_texts.find(x => x.startsWith('Odbudowa dnia:'));
            if (rebuild_time_match) properties.rebuild_time = Helper.parse_datetime_string(rebuild_time_match.match(/\d{2}.\d{2}.\d{2} \d{2}:\d{2}:\d{2}/)[0]);
            
            let back_time_match = properties_texts.find(x => x.startsWith('Czas powrotu:'));
            if (back_time_match) properties.back_time = Helper.parse_datetime_string(back_time_match.match(/\d{2}.\d{2}.\d{2} \d{2}:\d{2}:\d{2}/)[0]);
            
            let empty_match = properties_texts.find(x => x === 'WYCZYSZCZONA' || x === 'PUSTA');
            if (empty_match) properties.is_empty = empty_match;
            
            let away_match = properties_texts.find(x => x.startsWith('Poza:'));
            if (away_match) properties.units_away_plaintext = away_match;
            
            let cat_match = properties_texts.find(x => x.startsWith('K:'));
            if (cat_match) properties.catapult_attack_result_plaintext = cat_match;
            
            let ram_match = properties_texts.find(x => x.startsWith('T:'));
            if (ram_match) properties.ram_attack_result_plaintext = ram_match;
            
            return properties;
        },

        get_old_village_info: function (old_notes) {
            let village_info_text = old_notes.split('\n\n')[0];
            let props_text = village_info_text.split(' | ');
            let old_village_info = {};

            if (props_text.some(x => x.includes('OFF'))) old_village_info.troops_type = 'OFF';
            if (props_text.some(x => x.includes('DEFF'))) old_village_info.troops_type = 'DEFF';
            if (props_text.some(x => x.includes('Bez wiary') || x.includes('BEZ WIARY'))) old_village_info.belief = false;

            let church_match = props_text.find(x => x.toLowerCase().indexOf('kościół') !== -1);
            if (church_match) old_village_info.church = church_match;

            let sim_match = props_text.find(x => x.startsWith('Symulacja') || x.includes('Symulacja'));
            if (sim_match) {
                old_village_info.sim = true;
                old_village_info.sim_plaintext = sim_match;
            }

            let player_id_match = props_text.find(x => x.match(/#F5EDDA\](\d+)/));
            if (player_id_match) old_village_info.player_id = player_id_match.match(/\](\d+)/)[1];

            return old_village_info;
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
