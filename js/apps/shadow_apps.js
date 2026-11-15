// Two hidden apps (found on drives, used through a VPN):
//  Probiv — look an item up by serial (stolen? fake? hidden faults?) or a person by nickname (scammer?)
//  Radar — the police band: when your items get checked, buyers' complaint windows, a stash for the check
// …and the Wi‑Fi picker used to shake off a leaked address.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { fmt, nicePrice } from '../core/money.js';
import { countryOf } from '../data/world.js';
import { DEFECTS } from '../data/catalog.js';
import { rerender, toast, confirmBox, sheet, resolveSheet } from '../ui/shell.js';
import { img, empty } from '../ui/comp.js';
import { getItem, spend, stat, notify } from '../game/player.js';
import { itemTitle, itemValue, defectName } from '../game/items.js';
import { TRAITS } from '../game/npc.js';
import { policeFine } from '../game/crime.js';
import { catchChance } from '../game/hot.js';
import { vpnActive, darkListings } from '../game/phone.js';
import { networks, currentNet, connectNet, wifiState, burnTodo, shadowLocked, STAY_MIN } from '../game/shadow.js';
import { playMini } from '../mini/engine.js';
import { sfx } from '../ui/sfx.js';

const G2 = '#2ef2a0';
const leak = () => { if (Math.random() < 0.02) { const fine = nicePrice(30, countryOf(G.s.player.city).cur); policeFine('cyber', fine, T('запрос в пробив', 'запит у пробив', 'a lookup query')); notify('gov', T('Полиция', 'Поліція', 'Police'), T(`База пробива «протекла» — по вашему запросу пришли с вопросами. Штраф ${fmt(fine)}.`, `База пробиву «протекла» — за вашим запитом прийшли з питаннями. Штраф ${fmt(fine)}.`, `The lookup database leaked — someone came asking. Fine ${fmt(fine)}.`)); } };
const term = (tx, host = 'probiv.onion') => `<div class="termbox mb"><span class="hl">&gt; ${host}</span><br>${tx}</div>`;

// ---------------------------------------------------------------- PROBIV
const P = { tab: 'item' };
const itemPrice = (it) => nicePrice(Math.max(2, itemValue(it, G.s.player.city, 'true') * 0.03), countryOf(G.s.player.city).cur);
function probeItem(it) {
  const out = [];
  if (it.hot) { it.hot.known = true; out.push(`🚨 ${T('В РОЗЫСКЕ: вещь числится краденой', 'У РОЗШУКУ: річ числиться краденою', 'WANTED: listed as stolen')}`); }
  else out.push(`✅ ${T('В базах розыска не числится', 'У базах розшуку не числиться', 'Not in any wanted database')}`);
  if (it.fake) { if (Math.random() < 0.85) { it.fakeKnown = true; out.push(`🎭 ${T('Серийник не бьётся с заводской базой — подделка', 'Серійник не бʼється із заводською базою — підробка', 'The serial doesn’t match the factory database — a fake')}`); } else out.push(`❔ ${T('По заводской базе — не установлено', 'За заводською базою — не встановлено', 'Factory database — inconclusive')}`); }
  else out.push(`🏭 ${T('Серийник есть в заводской базе', 'Серійник є в заводській базі', 'Serial found in the factory database')}`);
  const hidden = (it.defects || []).filter((d) => !d.known);
  for (const d of hidden.slice(0, 2)) { d.known = true; out.push(`🛠 ${T('Сервисная история', 'Сервісна історія', 'Service record')}: ${esc(defectName(d.c))}`); }
  if (!hidden.length) out.push(`🧾 ${T('Скрытых проблем в сервисных базах нет', 'Прихованих проблем у сервісних базах немає', 'No hidden issues in service records')}`);
  if (it.owners) out.push(`👥 ${T('Владельцев по базе', 'Власників за базою', 'Owners on record')}: ${it.owners}`);
  if (it.shade === 'grey') out.push(`📦 ${T('Ввезён без растаможки', 'Ввезено без розмитнення', 'Imported without customs clearance')}`);
  it.probed = { t: G.s.t, res: out };
  return out;
}
function probivMain() {
  const s = G.s;
  if (!vpnActive()) return term(T('Соединение без VPN — запросы не принимаются.', 'Зʼєднання без VPN — запити не приймаються.', 'No VPN — queries refused.'));
  const tabs = `<div class="seg" style="background:#06120c">${[['item', T('Вещь', 'Річ', 'Item')], ['people', T('Человек', 'Людина', 'Person')]].map(([k, n]) => `<button class="${P.tab === k ? 'on' : ''}" data-a="ptab" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (P.tab === 'item') {
    const mine = s.inv.filter((it) => !it.shop).slice(0, 60);
    const lots = (s.dark?.feed || []).slice(0, 14);
    const row = (it, id, src) => `<div class="list-item" data-key="pb_${id}"><div class="th">${img(it)}</div><div class="grow"><div class="t">${esc(itemTitle(it))}</div><div class="s">${it.probed ? it.probed.res.slice(0, 2).join(' · ') : T('не проверялась', 'не перевірялася', 'not checked')}</div></div><button class="btn xs" style="background:#0f2a1e;color:${G2}" data-a="pitem" data-v="${id}" data-w="${src}">${it.probed ? '👁' : '🔎 ' + fmt(itemPrice(it))}</button></div>`;
    return tabs + term(T('Пробив по серийнику: базы розыска, заводская база, сервисные центры. Каждый запрос оставляет след (≈2 %).', 'Пробив за серійником: бази розшуку, заводська база, сервісні центри. Кожен запит залишає слід (≈2 %).', 'Serial lookup: wanted lists, factory and service databases. Each query leaves a trace (≈2 %).'))
      + `<h3 class="sub">${T('Ваши вещи', 'Ваші речі', 'Your items')}</h3>` + (mine.length ? mine.map((it) => row(it, it.id, 'inv')).join('') : empty('box', T('Склад пуст', 'Склад порожній', 'Storage is empty')))
      + (lots.length ? `<h3 class="sub">${T('Лоты Тени', 'Лоти Тіні', 'Shade lots')}</h3>` + lots.map((l) => row(l.item, l.id, 'dark')).join('') : '');
  }
  const chats = s.chats.filter((c) => c.st !== 'closed' && c.npc).slice(0, 30);
  return tabs + term(T('Пробив по нику: история сделок, жалобы, связанные аккаунты.', 'Пробив за ніком: історія угод, скарги, повʼязані акаунти.', 'Nickname lookup: deal history, complaints, linked accounts.'))
    + (chats.length ? chats.map((c) => `<div class="list-item" data-key="pp_${c.id}"><div class="grow"><div class="t">${esc(c.npc.name)} · ${esc(c.title || '')}</div><div class="s">${c.probed ? (c.npc.trait === 'scammer' ? `<b class="r">🚩 ${T('Мошенник: 14 жалоб, 6 аккаунтов', 'Шахрай: 14 скарг, 6 акаунтів', 'Scammer: 14 complaints, 6 accounts')}</b>` : `✅ ${esc(L(TRAITS[c.npc.trait]?.n || ['', '', '']))} · ${T('жалоб нет', 'скарг немає', 'no complaints')}`) : c.kind === 'sell' ? T('покупатель', 'покупець', 'buyer') : T('продавец', 'продавець', 'seller')}</div></div>${c.probed ? '' : `<button class="btn xs" style="background:#0f2a1e;color:${G2}" data-a="pman" data-v="${c.id}">🔎 ${fmt(nicePrice(3, countryOf(s.player.city).cur))}</button>`}</div>`).join('') : empty('chat', T('Нет открытых переписок', 'Немає відкритих листувань', 'No open chats')));
}
export const probivApp = {
  id: 'probiv', glyph: 'search', lvl: 1, name: ['Пробив', 'Пробив', 'Probiv'], colors: ['#0b1a12', '#03080a'], glyphColor: '#2ef2a0', dark: true,
  views: { main: probivMain },
  actions: {
    ptab: (v) => { P.tab = v; rerender(); },
    pitem: async (id, el) => {
      const src = el?.dataset?.w;
      const it = src === 'dark' ? (G.s.dark?.feed || []).find((l) => l.id === id)?.item : getItem(id);
      if (!it) return;
      if (!it.probed) { if (!spend(itemPrice(it), 'service', T('Пробив', 'Пробив', 'Lookup'))) return toast(T('Не хватает денег', 'Не вистачає грошей', 'Not enough money'), 'r'); probeItem(it); stat('probes'); leak(); sfx('ok'); emit('inv'); }
      await sheet(`<h2>🔎 ${esc(itemTitle(it))}</h2>${term(it.probed.res.join('<br>'))}<button class="btn block" data-a="closeSheet">OK</button>`);
      rerender();
    },
    pman: (id) => { const c = G.s.chats.find((x) => x.id === id); if (!c) return; if (!spend(nicePrice(3, countryOf(G.s.player.city).cur), 'service', T('Пробив', 'Пробив', 'Lookup'))) return toast(T('Не хватает денег', 'Не вистачає грошей', 'Not enough money'), 'r'); c.probed = true; leak(); sfx(c.npc.trait === 'scammer' ? 'err' : 'ok'); toast(c.npc.trait === 'scammer' ? T('🚩 Это мошенник', '🚩 Це шахрай', '🚩 A scammer') : T('Чисто', 'Чисто', 'Clean'), c.npc.trait === 'scammer' ? 'r' : 'g'); rerender(); },
  },
};

// ---------------------------------------------------------------- RADAR
const stashPrice = (x) => nicePrice(Math.max(8, (x.val || 0) * 0.05 + 6), countryOf(G.s.player.city).cur);
function radarMain() {
  const s = G.s;
  if (!vpnActive()) return term(T('Без VPN волна не ловится.', 'Без VPN хвиля не ловиться.', 'No VPN — no signal.'), 'radar.onion');
  const w = (s.hotw || []).slice().sort((a, b) => a.at - b.at);
  const police = w.filter((x) => !x.buyer && getItem(x.id)), buyers = w.filter((x) => x.buyer);
  let h = term(T('📻 Полицейская волна. Видно, когда проверят ваши вещи, и сколько ещё покупатели могут жаловаться. На время проверки вещь можно спрятать в тайник (иногда тайники вскрывают).', '📻 Поліцейська хвиля. Видно, коли перевірять ваші речі й скільки ще покупці можуть скаржитися. На час перевірки річ можна сховати (іноді схованки розкривають).', '📻 The police band: when your items get checked and how long buyers can still complain. Stash an item for the check (stashes do get robbed).'), 'radar.onion');
  h += `<div class="card small">📶 ${T('Сеть', 'Мережа', 'Network')}: <b>${esc(currentNet().n)}</b> · <button class="btn xs dark" data-a="wifi">${T('Сменить Wi‑Fi', 'Змінити Wi‑Fi', 'Switch Wi‑Fi')}</button></div>`;
  h += `<h3 class="sub">🚔 ${T('Проверки ваших вещей', 'Перевірки ваших речей', 'Checks on your items')}</h3>` + (police.length ? police.map((x) => { const it = getItem(x.id); return `<div class="list-item" data-key="rd_${x.id}_${x.at}"><div class="th">${img(it)}</div><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">⏳ <span data-cd="${x.at}"></span> · ${T('шанс', 'шанс', 'chance')} ~${Math.round(catchChance(it) * 100)}%${x.stash ? ` · 🕳 ${T('в тайнике', 'у схованці', 'stashed')}` : ''}</div></div>${x.stash ? '' : `<button class="btn xs" style="background:#0f2a1e;color:${G2}" data-a="rstash" data-v="${x.id}" data-w="${x.at}">🕳 ${fmt(stashPrice(x))}</button>`}</div>`; }).join('') : `<p class="small m">${T('Проверок не ожидается', 'Перевірок не очікується', 'No checks coming')}</p>`);
  h += `<h3 class="sub">🧾 ${T('Покупатели ещё могут пожаловаться', 'Покупці ще можуть поскаржитися', 'Buyers may still complain')}</h3>` + (buyers.length ? buyers.map((x) => `<div class="kv"><span>${esc(x.title)} · ${Math.round((x.p || 0) * 100)}%</span><b>⏳ <span data-cd="${x.at}"></span></b></div>`).join('') : `<p class="small m">${T('Нет', 'Немає', 'None')}</p>`);
  return h;
}
export const radarApp = {
  id: 'radar', glyph: 'bell', lvl: 1, name: ['Радар', 'Радар', 'Radar'], colors: ['#2a0d0d', '#0a0303'], glyphColor: '#ff5468', dark: true,
  views: { main: radarMain },
  actions: {
    rstash: (id, el) => { const at = +el?.dataset?.w; const x = (G.s.hotw || []).find((y) => y.id === id && y.at === at && !y.buyer); if (!x) return; if (!spend(stashPrice(x), 'service', T('Тайник', 'Схованка', 'Stash'))) return toast(T('Не хватает денег', 'Не вистачає грошей', 'Not enough money'), 'r'); x.stash = true; sfx('ok'); toast(T('Вещь будет в тайнике во время проверки', 'Річ буде в схованці під час перевірки', 'The item will be stashed during the check'), 'g'); rerender(); },
    wifi: () => wifiPicker(),
  },
};

// ---------------------------------------------------------------- Wi‑Fi picker (Settings, Radar, the "you're traced" notice)
export async function wifiPicker() {
  const cur = wifiState().net;
  const v = await sheet(`<h2>📶 Wi‑Fi</h2><div class="wf-list">${networks().map((n) => `<button class="wf-row ${n.id === cur ? 'on' : ''}" data-r="${n.id}"><span>${n.mobile ? '📱' : '📶'} ${esc(n.n)}${n.mine ? ` <small>· ${T('ваш', 'ваш', 'yours')}</small>` : ''}</span><b>${n.id === cur ? '✓' : n.lock && !wifiState().known.includes(n.id) ? '🔒' : ''}</b></button>`).join('')}</div><p class="small m mt">${T('Чужие закрытые сети придётся взломать — подобрать пароль.', 'Чужі закриті мережі доведеться зламати — підібрати пароль.', 'Other people’s locked networks need their password cracked.')}</p>`, { after(el) { el.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => resolveSheet(b.dataset.r); }); } });
  if (!v || v === cur) return;
  let r = connectNet(v);
  if (!r.ok && r.need === 'pass') {
    const g = await playMini('codelock', { title: T('Пароль от Wi‑Fi', 'Пароль від Wi‑Fi', 'Wi‑Fi password'), head: T('Подбор пароля', 'Підбір пароля', 'Cracking the password'), digits: 4, tries: 7, pass: 1 });
    if (g.quit) return;
    if (g.score < 1) { sfx('err'); toast(T('Не подошёл', 'Не підійшов', 'Wrong password'), 'r'); return; }
    r = connectNet(v, true);
  }
  if (r.ok) { sfx('ok'); toast(T(`Подключено: ${currentNet().n}`, `Підключено: ${currentNet().n}`, `Connected: ${currentNet().n}`), 'g'); }
  rerender();
}
// the "you're traced" card for Settings / Profile
export function burnCard() {
  if (!shadowLocked()) return '';
  const td = burnTodo();
  return `<div class="card warn"><b>🚨 ${T('Вас вычислили', 'Вас вирахували', 'You’ve been traced')}</b><div class="small mt">${td.wifi ? '✅' : '⬜'} ${T('Сменить Wi‑Fi', 'Змінити Wi‑Fi', 'Switch Wi‑Fi')}<br>${td.moved ? '✅' : '⬜'} ${td.lvl >= 2 ? T('Уехать в другую страну', 'Поїхати в іншу країну', 'Leave the country') : T(`Уехать из города (${esc(td.from)})`, `Поїхати з міста (${esc(td.from)})`, `Leave town (${esc(td.from)})`)}<br>${td.wifi && td.moved ? `⏳ ${T('Переждать', 'Перечекати', 'Wait it out')}: ${Math.ceil(td.left / 60)} ${T('ч', 'год', 'h')}` : `⬜ ${T('Переждать там', 'Перечекати там', 'Wait there')} ${STAY_MIN / 60} ${T('ч', 'год', 'h')}`}</div><div class="btns"><button class="btn sm" data-a="wifiPick">📶 Wi‑Fi</button><button class="btn dark sm" data-a="open" data-v="travel">✈️ ${T('Поездки', 'Поїздки', 'Travel')}</button></div></div>`;
}
