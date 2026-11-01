/*
 * TCM BOB - moduł NAGRODY ZA BUDYNKI (osobny plik, ładowany przez skrypt budowy z linku w kodzie)
 *
 * Co robi: gdy w skrypcie budowy zaznaczony jest checkbox "🎁 Odbieraj nagrody za budynki", co kilka minut
 * (z losowym rozrzutem) pobiera okno Nagrody (to samo, które otwierasz w Zadaniach) i odbiera po kolei
 * wszystkie dostępne nagrody - tak jak przycisk "Odbierz". Surowce trafiają do wioski, w której działa skrypt.
 *
 * Zapytania (z podglądu zapytań gry):
 *   GET  game.php?village=ID&screen=new_quests&ajax=quest_popup&tab=main-tab&quest=0   - lista nagród
 *   POST game.php?village=ID&screen=new_quests&ajax=claim_reward   (reward_id=...&h=csrf) - odbiór jednej nagrody
 *
 * Kontrakt z rdzeniem (window.TCM_BOB):
 *   api.setEnabled(bool) - włącza/wyłącza (rdzeń woła to przy zmianie checkboxa i przy starcie).
 *   api.checkNow()       - ręczne sprawdzenie, np. w konsoli: TCM_BOB.modules.nagrody.api.checkNow()
 *   api.debug()          - pokazuje początek odpowiedzi okna Nagrody (do diagnozy, gdy nic nie znajduje).
 */
(function() {
    'use strict';

    const BOB = window.TCM_BOB;
    if (!BOB || typeof game_data === 'undefined') return;
    if (BOB.modules && BOB.modules.nagrody) return; // już załadowany

    BOB.registerModule({
        id: 'nagrody',
        name: 'Nagrody za budynki',
        panel: false,

        init: function(ctx) {
            const H = ctx.helpers;
            const BASE = () => H.screenUrl('new_quests');
            const POPUP_URL = () => BASE() + '&ajax=quest_popup&tab=main-tab&quest=0';
            const CLAIM_URL = () => BASE() + '&ajax=claim_reward';
            const LOCK_KEY = 'TCM_BOB_rewardsLastAttempt';   // chroni przed dwiema kartami naraz
            const AJAX_HEADERS = { 'tribalwars-ajax': '1', 'x-requested-with': 'XMLHttpRequest' };
            const MAX_PER_RUN = 30;
            const rnd = (minMin, maxMin) => Math.round((minMin + Math.random() * (maxMin - minMin)) * 60000);
            const sleep = ms => new Promise(r => setTimeout(r, ms));

            let enabled = false, timer = null, busy = false;

            const toast = (msg, isErr) => {
                try { isErr ? UI.ErrorMessage(msg, 4000) : UI.SuccessMessage(msg, 4000); }
                catch (e) { console.log('[Nagrody]', msg); }
            };

            // Odpowiedź może być JSON-em z HTML w środku albo czystym HTML-em - zbieramy cały tekst
            function collectText(raw) {
                try {
                    const j = JSON.parse(raw);
                    const parts = [];
                    (function walk(v) {
                        if (typeof v === 'string') parts.push(v);
                        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k]));
                    })(j);
                    return parts.join('\n');
                } catch (e) { return raw; }
            }

            function parsePopup(raw) {
                const text = collectText(raw);
                const ids = [];
                for (const m of text.matchAll(/data-reward-id=["']?(\d+)/g)) if (!ids.includes(m[1])) ids.push(m[1]);
                const totals = {};
                ['wood', 'stone', 'iron'].forEach(res => {
                    const m = text.match(new RegExp('data-resource-name=["\']' + res + '["\'][^>]*>\\s*([\\d.,\\s]+)<'));
                    if (m) totals[res] = parseInt(m[1].replace(/\D/g, ''), 10) || 0;
                });
                return { ids, totals };
            }

            async function fetchPopup() {
                const res = await fetch(POPUP_URL(), { credentials: 'include', headers: AJAX_HEADERS });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return await res.text();
            }

            async function claim(id) {
                const r = await fetch(CLAIM_URL(), {
                    method: 'POST',
                    headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }, AJAX_HEADERS),
                    body: `reward_id=${id}&h=${game_data.csrf}`,
                    credentials: 'include'
                });
                if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
                let json = null;
                try { json = await r.json(); } catch (e) { /* odpowiedź nie-JSON - uznajemy za udaną, sprawdzimy listę po odbiorze */ }
                if (json && json.error) return { ok: false, error: String(json.error) };
                return { ok: true };
            }

            function schedule(ms) {
                if (timer) clearTimeout(timer);
                timer = null;
                if (enabled) timer = setTimeout(() => check(false), ms);
            }

            async function check(force) {
                if (busy || (!enabled && !force)) return;
                busy = true;
                let nextMs = rnd(5, 8);
                try {
                    const last = parseInt(localStorage.getItem(LOCK_KEY) || '0', 10);
                    if (!force && Date.now() - last < 60000) return;   // inna karta właśnie sprawdzała
                    localStorage.setItem(LOCK_KEY, String(Date.now()));

                    const { ids, totals } = parsePopup(await fetchPopup());
                    if (!ids.length) { console.log('[Nagrody] Brak nagród do odebrania.'); return; }

                    let done = 0;
                    for (const id of ids.slice(0, MAX_PER_RUN)) {
                        const res = await claim(id);
                        if (!res.ok) {
                            toast('Nagrody: ' + res.error, true);
                            console.warn('[Nagrody] Odbiór ' + id + ' nieudany:', res.error);
                            nextMs = rnd(10, 15);
                            break;
                        }
                        done++;
                        await sleep(500 + Math.random() * 600);
                    }

                    if (done) {
                        const sum = ['wood', 'stone', 'iron'].filter(k => totals[k] !== undefined).map(k => `${k === 'wood' ? 'drewno' : k === 'stone' ? 'glina' : 'żelazo'} ${totals[k]}`).join(', ');
                        toast(`Nagrody: odebrano ${done}${sum ? ' (do zebrania było: ' + sum + ')' : ''}.`, false);
                    }
                    if (ids.length > MAX_PER_RUN) nextMs = rnd(0.5, 1); // reszta w następnym obiegu
                } catch (e) {
                    console.warn('[Nagrody] Błąd:', e);
                    nextMs = rnd(8, 12);
                } finally {
                    busy = false;
                    schedule(nextMs);
                }
            }

            return {
                setEnabled: function(v) {
                    enabled = !!v;
                    if (timer) { clearTimeout(timer); timer = null; }
                    if (enabled) schedule(5000 + Math.random() * 10000); // pierwsze sprawdzenie zaraz po włączeniu
                },
                isEnabled: () => enabled,
                checkNow: () => check(true),
                debug: async function() {
                    const raw = await fetchPopup();
                    const p = parsePopup(raw);
                    console.log('[Nagrody] znalezione id:', p.ids, 'sumy:', p.totals, '\nPoczątek odpowiedzi:\n', raw.slice(0, 1500));
                    alert('Znalezione id: ' + (p.ids.join(', ') || 'brak') + '\n\n' + raw.slice(0, 600));
                    return p;
                }
            };
        }
    });
})();
