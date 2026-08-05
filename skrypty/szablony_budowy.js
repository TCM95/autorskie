// ==UserScript==
// @name         SZABLONY MK - FIX POSITION CLASS
// @version      100.0
// @namespace    https://viayoo.com/
// @match        https://*.plemiona.pl/game.php?*screen=memo*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CEL = "Budowa Szablony";
    const GITHUB_URL = "https://raw.githubusercontent.com/Kipi955/sprawdzian/refs/heads/main/szablony%20forum.txt";

    const MOJE_PRYWATNE = `[b]EKO[/b]
[construction_template]TAEAAQkBDwEQAQ0BAAEAAQABAAEQAxABEAEMAQ4BDQEMAQ0BDAENAQwBDQEMAQ0BDAEBAQ0BDAENAQ4BDgEQAQsBEAEMAQ0BDAEOARIBAAIQAw0BDAEOAQECDQEMAQ4BAAMPAQ0BDAEPAQ4BDgENAQwBDgEQAQEBCwENAQwBDgEQARABDQEMAQ4BEAEBAQgBAAEAAQABCAEIAQ0BCwEMAQ4BDgEPARABEAEQARABDQEMAQ4BDgEPAQgCDQEMAQABAAENAQwBDgELARABDwENAQwBDgEPAQIBDQECAQwBDgEOAQIBDwENAQsBDAEOAQ8BAAENAQwBDgEQAQ0BDAEOAQABCwENAQ8BDAEOAQsBAAILAQABDwENAQ4BCwEMAQsBEAEPAQ0BDAEOAQ4BDQEMARABDwEOAQ0BDAEOARABDQEPAQwBDgEPAQ4BEAESEwUA9ICAgEVLT/SAgIA0[/construction_template]

[b]TCM1[/b]
[construction_template]dAEAAQwBDQEOAQ0BDAEAARABDgEAAQwBAAEQAQ4BDQEOAQwBDQEMAg0CDgIMAQ0BDAENAQwBDQIPAgEBCwESAg0BDwEMAQ4BEgEOARABEAEQAQ8BDwEOARABDAEMAQ0BDgEMAQ0BEgEOAQsBDQEMAQ4BDQEMARABDQEOAQwBDgEQAQwBDQEAARABDQEOAQsBDwELAQABDwEAARIBCwEMAQ4BEAENAQwBEAENAQABDAEOARABDgENAQACDAEQAQ8CEAENAQwBDgEQAQ0BDAEQAQ0BDgEMARABDQEOAQwBAAEQAQ0BDgEAAQwBEAENAQACDAEAAg8BDgMPAQgBAQEPAQ4BAAMPAg4BCAEQAQ8CAAEBAxADCAMCAwEFCAUDBQICCwUIAw8BDwEIAg8BCAIPAQgBDwEIAQ8BCAEHAQEFAgUDAwEFAgMCAg0BDAEPAw0BDAEOARABDQEMAQ4BDgELBRABEg8BAgMBDwMBAwICCwICAwMBDwIKAPSAgIBUQ00gMfSAgIA0[/construction_template]

[b]TCM2[/b]
[construction_template]AgEAAQkBDAENAQ4BDAENAQwBDwENAQ4BDwEMAQ0BAAEQAQABAQEQAQ8BDAENAQ4BDwEBAhACAAEPAQABCAMAARACDgIPAQABDAUNBQ4BDgEPAQsCAAEBAQ8BAAEBAQgBDwEIAQ8BAAECAQ8BAgICAg8BDAUNBQ4DCAUDAw4FAAUPAgEKDAENAQwBDQEQBA8BDAENAQwBDQEMAQ0BDgIABQwBDQEMAQ0BDwEBBQIFAwILCAgEDwEMAQ0BDgMPAQwBDQEOAQ0BDAEPAQwBDQEOARAKDgMIBgwBDQECBQ8BAwUMAQ0BBwEPCgwBDAELCg4FDQENAQAEAAEQBQEFAgUDBRIUEAUKAPSAgIBUQ00gMvSAgIA0[/construction_template]

[b]STAJNIA KOSZARY 15 10[/b]
[construction_template]VgAABQkBDwUQBQEBEgEIARAFAAUBBQgEEAUCAwEEEAECAQAFDwUQAQECAgIPARABAQICAg8BAQEPARABAgIPARABDwEQAQ8BEAEPAQ8BDwEQAQ8BDwEPAQoA9ICAgHN0YWpuaWFrb3N6YXJ5IDH0gICANA==[/construction_template]

[b]Wojsko +CK 20 15[/b]
[construction_template]hgAABQkBDwUQBgEBEgEQAQgBEAEABRABAQUIBBABAgMIAQEEEAEIAQIBAAUPBRABAQIIAQICEAEPAQgBAQICAggBAwMQAQ8BAQIIAQ8BAgIIAQMBEAEPAQgBAwEIAQgBAQIDAQICAwEDAQ8BAQICAgIBAwEPARABDwEDARABDwEPARABDwEPAQoA9ICAgFdvanNrbyArY2sgMjAvMTUvMTD0gICANA==[/construction_template]

[b]Mur[/b]
[construction_template]BgAAAwEBEhQAAPSAgIBtdXL0gICANA==[/construction_template]

[b]Pałac[/b]
[construction_template]HAAAFAEFCA8QCgsKCAIIAQgBCAEQAxAIBwEQARABBQD0gICAcGHFgmFj9ICAgDQ=[/construction_template]

[b]Odbudowa burzenie[/b]
[construction_template]bAAAAQkBDwEQAQAEEAQPBAEFCAUABRAFDwUIBQAFEAUPBQAFCAEPARABCAEIAQ8BEAEIAQ8BEAEIAQ8BCAEPARABCAEQARABCAEPARABCAEPARABCAELCgcBDwEQAg8DEAEPAQ8BEAEPAQ8BEAMAAPSAgIBidXJ6YWv0gICANA==[/construction_template]`;

    const startLogic = async () => {
        let tabId = null;
        $('.memo-tab-label').each(function() {
            if ($(this).text().trim().includes(CEL)) {
                tabId = $(this).closest('.memo-tab').attr('id').replace('tab_', '');
            }
        });

        const status = sessionStorage.getItem('szablony_status');

        if (status === 'creating') {
            let nowaId = null;
            $('.memo-tab').each(function() {
                if ($(this).find('.memo-tab-label').text().trim().includes("Nowa zakładka")) {
                    nowaId = $(this).attr('id').replace('tab_', '');
                }
            });

            if (nowaId) {
                sessionStorage.setItem('szablony_status', 'filling');
                await $.post($('#rename_tab_url').val(), { id: nowaId, newTitle: CEL });
                location.reload();
            }
            return;
        }

        if (status === 'filling' && tabId) {
            UI.SuccessMessage("Pobieram dane z GitHub...", 1000);
            try {
                const response = await fetch(GITHUB_URL);
                const forumText = await response.text();
                const finalBB = `[spoiler=MOJE PRYWATNE]\n${MOJE_PRYWATNE}\n[/spoiler]\n\n[spoiler=SZABLONY Z FORUM]\n${forumText}\n[/spoiler]`;

                await $.post(`/game.php?village=${game_data.village.id}&screen=memo&action=edit&h=${game_data.csrf}`, {
                    tab_id: tabId, memo: finalBB, h: game_data.csrf
                });
                sessionStorage.removeItem('szablony_status');
                location.reload();
            } catch (e) {
                sessionStorage.removeItem('szablony_status');
                UI.ErrorMessage("Błąd GitHuba!");
            }
        }
    };

    const dodajPrzycisk = () => {
        if ($('#btn_szablony_mk').length > 0) return;

        // Szukamy po klasie .edit_link, którą widać w Twoim kodzie
        const editBtn = $('.edit_link:visible').first();

        if (editBtn.length > 0) {
            const btn = $('<a id="btn_szablony_mk" class="btn" style="cursor: pointer; margin-right: 5px;">SZABLONY MK</a>');
            btn.insertBefore(editBtn);

            btn.click((e) => {
                e.preventDefault();
                sessionStorage.setItem('szablony_status', 'creating');
                TribalWars.post('memo', { ajaxaction: 'add_tab' }, {}, () => {
                    location.reload();
                });
            });
        }
    };

    const observer = new MutationObserver(dodajPrzycisk);
    observer.observe(document.body, { childList: true, subtree: true });
    dodajPrzycisk();
    startLogic();
})();
