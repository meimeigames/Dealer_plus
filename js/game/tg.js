// "Telega" — a messenger with channels: private paid channels with below-market (and risky) goods,
// a repair channel, a local flea channel, a wholesale channel, plus members' requests ("Orders").
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { uid, clamp } from '../core/util.js';
import { MODEL, DEFECTS } from '../data/catalog.js';
import { CITY, countryOf } from '../data/world.js';
import { makeItem, itemValue, itemTitle, knownDefects } from './items.js';
import { getItem, removeItem, addItem, spend, earn, charge, addXP, notify, stat, canStore, addReview } from './player.js';
import { deliveryTime } from './market.js';
import { fmt, nicePrice } from '../core/money.js';
import { makeHot, watchHot, noteHotSale } from './hot.js';
import { arrest } from './crime.js';
import { bannedListing, bannedBoxListing, isBox } from './banned.js';
import { charisma } from './sell.js';
import { useEnergy, hasEnergy, noNeeds } from './needs.js';
import { npcName } from './npc.js';
import { rt } from '../core/clock.js';

export const CHANNELS = [
  { id: 'garage', name: ['Тёмный гараж', 'Темний гараж', 'Dark Garage'], ic: '🚗', col: '#7f1d1d', fee: 55, members: 5, about: ['Машины и техника без вопросов. Только для своих.', 'Машини й техніка без питань. Лише для своїх.', 'Cars and tech, no questions asked. Members only.'], cats: ['phones', 'electronics', 'consoles', 'cars', 'watches'], price: [0.35, 0.6], stolen: 0.3, scam: 0.1, lock: 0.12, handle: ['@tihiy_garage', '@bez_voprosov', '@noch_shop'] },
  { id: 'repair', name: ['Ремонт‑зона', 'Ремонт‑зона', 'Repair Zone'], ic: '🔧', col: '#1e3a8a', fee: 20, members: 3400, about: ['Телефоны после ремонта: дёшево, работают. Иногда не всё оригинальное.', 'Телефони після ремонту: дешево, працюють. Іноді не все оригінальне.', 'Phones after repair: cheap and working. Not always all original.'], cats: ['phones', 'electronics'], price: [0.5, 0.72], stolen: 0, scam: 0.03, hidden: 0.55, handle: ['@remont_zone', '@master_sergey', '@fixit_pro'] },
  { id: 'flea', name: ['Барахолка {city}', 'Барахолка {city}', '{city} Flea'], ic: '🏷', col: '#166534', fee: 0, members: 12800, about: ['Отдаю за копейки, самовывоз.', 'Віддаю за копійки, самовивіз.', 'Going cheap, pick up only.'], cats: ['clothing', 'sneakers', 'toys', 'misc', 'storage', 'gear', 'accessories', 'comics'], price: [0.6, 0.85], stolen: 0, scam: 0.02, handle: ['@baraholka_chat', '@otdam_deshevo', '@pereezd_sale'] },
  { id: 'opt', name: ['Опт и Китай', 'Опт і Китай', 'Wholesale & China'], ic: '📦', col: '#9a3412', fee: 0, members: 41000, about: ['Новости поставщиков, партии из Шэньчжэня, курсы юаня.', 'Новини постачальників, партії з Шеньчжені, курси юаня.', 'Supplier news, Shenzhen lots, yuan rates.'], news: true },
];
// kind (group: members talk, channel: only the admins post) and the admin who decides what may be posted and
// takes a share of the sale: 'shade' — anything incl. stolen and forbidden, 'banned' — forbidden/stolen boxes,
// 'legal' — only clean things, 'none' — no ads at all
const ADMINS = {
  garage: { kind: 'group', name: 'Артур', handle: '@garage_boss', share: [15, 25], accepts: 'shade', owner: true },
  repair: { kind: 'channel', name: 'Ремонт‑зона | админ', handle: '@remzona_admin', share: [8, 12], accepts: 'legal' },
  flea: { kind: 'group', name: 'Модератор барахолки', handle: '@baraholka_mod', share: [5, 10], accepts: 'legal' },
  opt: { kind: 'channel', name: 'Опт и Китай', handle: '@opt_china_news', share: [0, 0], accepts: 'none' },
  contra: { kind: 'group', name: 'Кладовщик', handle: '@sklad_master', share: [10, 20], accepts: 'banned', owner: true },
};
CHANNELS.push({ id: 'contra', name: ['Склад без вопросов', 'Склад без питань', 'No‑Questions Warehouse'], ic: '🗃', col: '#3f3f46', fee: 80, members: 870, about: ['Опт без бумажек: сигареты, алкоголь, техника коробками. Только встречи, без предоплат.', 'Опт без папірців: цигарки, алкоголь, техніка коробками. Лише зустрічі, без передоплат.', 'Wholesale, no paperwork: cigarettes, booze, electronics by the box. Meet‑ups only, no prepayment.'], contra: true });
export const adminOf = (c) => ADMINS[c.id] || ADMINS.flea;
export const chKind = (c) => adminOf(c).kind;
export const chName = (c) => L(c.name).replace('{city}', L(CITY[G.s.player.city]?.name || ['', '', '']));
export function tgState() { const s = G.s; s.tg ||= { joined: {}, sold: {}, police: [], reqDone: {}, seen: {} }; return s.tg; }
export const joined = (c) => !c.fee || !!tgState().joined[c.id];
export const entryFee = (c) => c.fee * Math.max(0.6, countryOf(G.s.player.city).wage);
export function join(c) {
  if (joined(c)) return { ok: true };
  if (!spend(entryFee(c), 'service', T(`Вход в «${chName(c)}»`, `Вхід у «${chName(c)}»`, `Joining ${chName(c)}`))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  tgState().joined[c.id] = true; stat('tgJoined'); emit('tg');
  return { ok: true };
}
const WINDOW = 180; // posts refresh every 3 game hours
export function postsOf(c) {
  const s = G.s, st = tgState();
  if (c.news) return newsPosts(c);
  if (c.contra) return contraPosts(c);
  const w = Math.floor(s.t / WINDOW);
  const out = [];
  for (const k of [w, w - 1]) {
    const r = new RNG(`tg|${s.id}|${c.id}|${k}|${s.player.city}`);
    const n = r.int(2, 4);
    for (let i = 0; i < n; i++) {
      const id = `${c.id}_${k}_${i}`;
      const it = makeItem(new RNG(`tgi|${id}|${s.id}`), { city: s.player.city, cats: c.cats, quality: c.id === 'garage' ? r.pick(['good', 'any']) : 'any', maxVal: c.id === 'flea' ? 160 : 4000, lockRate: c.lock ?? 0.03 });
      const v = itemValue(it, s.player.city, 'true');
      const price = nicePrice(v * r.float(c.price[0], c.price[1]));
      const mkt = nicePrice(itemValue(it, s.player.city, 'known') * 1.05);
      const risky = { stolen: r.chance(c.stolen || 0), scam: r.chance(c.scam || 0), hidden: r.chance(c.hidden || 0) };
      out.push({ id, ch: c.id, it, price, mkt, risky, handle: r.pick(c.handle), at: k * WINDOW + r.int(0, WINDOW - 1), views: r.int(180, 9800), note: r.pick(c.id === 'repair' ? [T('Был в ремонте, сейчас работает', 'Був у ремонті, зараз працює', 'Was repaired, works now'), T('Меняли экран, всё ок', 'Міняли екран, усе ок', 'Screen replaced, all good')] : c.id === 'garage' ? [T('Без коробки и документов, вопросов не задавать', 'Без коробки й документів, питань не ставити', 'No box, no papers, no questions'), T('Срочно, сегодня', 'Терміново, сьогодні', 'Urgent, today only')] : [T('Самовывоз, торг', 'Самовивіз, торг', 'Pick up, negotiable'), T('Переезжаю, отдам дёшево', 'Переїжджаю, віддам дешево', 'Moving, going cheap')]), sold: !!st.sold[id] });
    }
  }
  return out.filter((p) => p.at <= s.t).sort((a, b) => b.at - a.at);
}
function contraPosts(c) {
  const s = G.s, st = tgState(), w = Math.floor(s.t / WINDOW), out = [];
  for (const k of [w, w - 1]) {
    const r = new RNG(`tgc|${s.id}|${k}|${s.player.city}`);
    for (let i = 0, n = r.int(1, 3); i < n; i++) {
      const id = `contra_${k}_${i}`;
      const b = r.chance(0.6) ? bannedBoxListing(new RNG(`tgcb|${id}|${s.id}`), s.player.city) : bannedListing(new RNG(`tgcb|${id}|${s.id}`), s.player.city);
      out.push({ id, ch: c.id, it: b.it, price: b.price, mkt: nicePrice(b.clean), risky: { stolen: false, scam: false, hidden: false, sting: r.chance(0.05) }, handle: r.pick(['@sklad_master', '@opt_bez_voprosov', '@korobki_24']), at: k * WINDOW + r.int(0, WINDOW - 1), views: r.int(90, 900), note: r.pick([T('Только встреча, деньги на месте.', 'Лише зустріч, гроші на місці.', 'Meet‑up only, cash on the spot.'), T('Забирать сегодня, склад освобождаем.', 'Забирати сьогодні, звільняємо склад.', 'Pick up today, clearing the stock.')]), sold: !!st.sold[id] });
    }
  }
  return out.filter((p) => p.at <= s.t).sort((a, b) => b.at - a.at);
}
function newsPosts(c) {
  const s = G.s, w = Math.floor(s.t / WINDOW);
  const L3 = [
    [T('Появилась оптовая сделка на {n} телефонов! Смотрите в «АлиБаоЭкспресс» → «Опт с Китая».', 'Зʼявилася оптова угода на {n} телефонів! Дивіться в «АліБаоЕкспрес» → «Опт з Китаю».', 'A wholesale deal for {n} phones just dropped! Check AliBaoExpress → China wholesale.'), 'ymarket'],
    [T('Юань сегодня {r} — самое время закупаться.', 'Юань сьогодні {r} — саме час закуповуватися.', 'Yuan today {r} — time to stock up.'), null],
    [T('Таможня ужесточила проверки на ввоз партий телефонов. Декларируйте!', 'Митниця посилила перевірки на ввезення партій телефонів. Декларуйте!', 'Customs is tightening checks on phone lots. Declare them!'), 'travel'],
    [T('В «Неделю железа» видеокарты на −45%. Сборщики, налетайте.', 'У «Тиждень заліза» відеокарти на −45%. Збирачі, налітайте.', 'GPUs −45% during Hardware week. Builders, go.'), 'hw'],
  ];
  return [w, w - 1, w - 2].map((k) => { const r = new RNG(`tgn|${k}`); const [tx, go] = r.pick(L3); return { id: `opt_${k}`, ch: c.id, news: tx.replace('{n}', r.int(6, 30)).replace('{r}', (r.float(11.8, 13.4)).toFixed(2) + ' ₽'), go, at: k * WINDOW + 20, views: r.int(3000, 40000) }; }).filter((p) => p.at <= s.t);
}
// buying from a post: meet in person (inspect, pay on the spot) or prepay to the card (cheaper, may vanish)
export function buyPost(p, mode) {
  const s = G.s, st = tgState();
  if (st.sold[p.id]) return { ok: false, msg: T('Уже продано', 'Вже продано', 'Already sold') };
  if (!canStore(p.it)) return { ok: false, msg: T('Склад переполнен', 'Склад переповнений', 'Storage is full') };
  const price = mode === 'prepay' ? nicePrice(p.price * 0.95) : p.price;
  if (!spend(price, 'buy', T(`Телега: ${itemTitle(p.it)}`, `Телега: ${itemTitle(p.it)}`, `Telega: ${itemTitle(p.it)}`))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  st.sold[p.id] = true;
  stat('bought');
  if (mode === 'prepay' && p.risky.scam) {
    notify('tg', p.handle, T('Пользователь удалил аккаунт. Деньги не вернуть.', 'Користувач видалив акаунт. Гроші не повернути.', 'The user deleted their account. The money is gone.'));
    stat('scammed');
    emit('tg');
    return { ok: true, scam: true, price };
  }
  if (p.risky.sting) {
    const fine = nicePrice(Math.max(40, price * 0.5), countryOf(s.player.city).cur);
    arrest('banned', { fine, mins: 180, text: itemTitle(p.it) });
    emit('tg');
    return { ok: true, sting: true, fine, price };
  }
  const it = p.it; it.paid = price; it.src = 'tg';
  if (p.risky.stolen) { makeHot(it, new RNG(`tgh|${p.id}`), { known: false, src: 'tg' }); watchHot(it); }
  if (mode === 'meet') { addItem(it, price, 'tg'); addXP(4); }
  else s.deliveries.push({ id: uid('d'), kind: 'in', item: it, from: s.player.city, to: s.player.city, start: s.t, eta: s.t + deliveryTime(s.player.city, s.player.city), price, who: p.handle });
  emit('tg'); emit('inv');
  return { ok: true, price };
}
// stolen goods: the police come for them
export function tgTick() {
  const s = G.s, st = s.tg;
  if (!st?.police?.length) return;
  const due = st.police.filter((x) => x.at <= s.t);
  if (!due.length) return;
  st.police = st.police.filter((x) => x.at > s.t);
  for (const x of due) {
    const it = getItem(x.id);
    if (it) {
      removeItem(it.id);
      const fine = Math.round(x.val * 0.25 + 20);
      arrest('stolen', { fine: x.val * 0.1, text: x.title });
      notify('gov', T('Полиция', 'Поліція', 'Police'), T(`${x.title} оказался в розыске — изъят. Штраф ${fmt(fine)}.`, `${x.title} виявився в розшуку — вилучено. Штраф ${fmt(fine)}.`, `${x.title} was reported stolen — seized. Fine ${fmt(fine)}.`));
    } else if (new RNG(x.id).chance(0.5)) {
      const fine = Math.round(x.val * 0.15 + 15);
      charge(fine, 'fine', T('Штраф: сбыт краденого', 'Штраф: збут краденого', 'Fine: fencing stolen goods'));
      notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Вы продали краденый ${x.title}. Штраф ${fmt(fine)}.`, `Ви продали крадений ${x.title}. Штраф ${fmt(fine)}.`, `You sold a stolen ${x.title}. Fine ${fmt(fine)}.`));
    }
  }
  emit('tg');
}
// members' requests: "looking for X up to N" — fulfil from your storage
export function requests() {
  const s = G.s, st = tgState();
  const w = Math.floor(s.t / 120);
  const r = new RNG(`tgr|${s.id}|${w}|${s.player.city}`);
  const NAMES = ['Дима', 'Аня', 'Рустам', 'Оля', 'Павел', 'Ксюша', 'Егор', 'Мила', 'Сеня', 'Вика'];
  return Array.from({ length: 4 }, (_, i) => {
    const it = makeItem(new RNG(`tgrq|${s.id}|${w}|${i}`), { city: s.player.city, cats: ['phones', 'consoles', 'electronics', 'sneakers', 'watches', 'storage', 'pcparts'], maxVal: 2500 });
    const m = MODEL[it.m];
    const v = itemValue({ ...it, defects: [], cond: 85 }, s.player.city, 'true');
    const id = `rq_${w}_${i}`;
    return { id, who: r.pick(NAMES), m: m.id, cat: m.cat, title: itemTitle(it, false), budget: nicePrice(v * r.float(0.9, 1.3)), done: !!st.reqDone[id] };
  });
}
export const matchesFor = (rq) => G.s.inv.filter((it) => it.m === rq.m && !it.listed && !it.shop);
export function fulfil(rq, itemId) {
  const it = getItem(itemId), st = tgState();
  if (!it || st.reqDone[rq.id]) return { ok: false };
  noteHotSale(it, rq.budget);
  removeItem(it.id);
  st.reqDone[rq.id] = true;
  earn(rq.budget, 'sale', T(`Телега: ${rq.title} для ${rq.who}`, `Телега: ${rq.title} для ${rq.who}`, `Telega: ${rq.title} for ${rq.who}`));
  stat('sold'); addXP(10);
  addReview(5, T('Быстро нашёл то, что я искал. Респект!', 'Швидко знайшов те, що я шукав. Респект!', 'Found exactly what I was after, fast. Respect!'), { buyer: rq.who });
  emit('tg'); emit('inv');
  return { ok: true };
}

// ---------------------------------------------------------------- Telegram‑like profile
export function tgMe() {
  const st = tgState();
  st.me ||= { name: G.s.player.name || 'Я', user: '', bio: '', av: '🙂', col: '#5288c1', claimed: false };
  return st.me;
}

// ---------------------------------------------------------------- group members (for the group's info page)
export function membersOf(c) {
  const a = adminOf(c), r = new RNG(`tgm|${c.id}|${G.s.id}`);
  const list = [{ id: 'admin', name: a.name, handle: a.handle, role: a.owner ? 'owner' : 'admin', seen: 'online' }];
  for (let i = 0; i < 11; i++) { const { name } = npcName(r, G.s.player.city); list.push({ id: 'm' + i, name, handle: '@' + r.pick(['dima', 'max', 'sasha', 'kot', 'vova', 'lena', 'oleg', 'nastya', 'zhenya', 'artem', 'liza']) + '_' + r.int(10, 999), role: i === 0 && c.members > 100 ? 'admin' : '', seen: r.pick(['recent', 'recent', 'week', 'online']) }); }
  return list;
}

// ---------------------------------------------------------------- private chats (admins, buyers)
export function dmOf(id) { return tgState().dms?.[id] || null; }
export function openDm(id, who, handle, o = {}) {
  const st = tgState();
  st.dms ||= {};
  return (st.dms[id] ||= { id, who, handle, msgs: [], unread: 0, at: G.s.t, ...o });
}
export function dmSay(dm, me, tx, o = {}) {
  dm.msgs.push({ me, tx, t: G.s.t, ...o });
  if (dm.msgs.length > 60) dm.msgs.splice(0, dm.msgs.length - 60);
  dm.at = G.s.t;
  if (!me && !o.silent) dm.unread = (dm.unread || 0) + 1;
}
export const dmList = () => Object.values(tgState().dms || {}).sort((a, b) => b.at - a.at);

// ---------------------------------------------------------------- selling through a channel admin
// Write to the admin → pick a thing → they name their share and a price → haggle the share once → the post goes
// out → a buyer writes to you → you meet in person (only in person). With stolen or forbidden goods there is a 5 %
// chance the "buyer" is a police officer.
export const tgDeals = () => (tgState().deals ||= []);
export const dealById = (id) => tgDeals().find((d) => d.id === id);
export function eligibleFor(c) {
  const acc = adminOf(c).accepts;
  if (acc === 'none') return [];
  return G.s.inv.filter((it) => !it.listed && !it.shop && (acc === 'shade' || (acc === 'banned' ? it.banned || it.hot : !it.banned && !it.hot && !it.fake)));
}
const fairPrice = (it) => nicePrice(itemValue(it, G.s.player.city, 'true', { clean: true }) * (isBox(it) ? 1 : it.banned || it.hot ? 0.9 : 0.95), countryOf(G.s.player.city).cur);
export function proposeSale(chId, itemId) {
  const c = CHANNELS.find((x) => x.id === chId), a = adminOf(c), it = getItem(itemId);
  if (!c || !it) return null;
  const r = new RNG(uid('td'));
  const share = r.int(a.share[0], a.share[1]);
  const d = { id: uid('td'), ch: chId, itemId, title: itemTitle(it), share, price: fairPrice(it), st: 'offer', haggled: false, at: G.s.t };
  tgDeals().push(d);
  const dm = openDm('adm_' + chId, a.name, a.handle, { ch: chId, role: 'admin' });
  dmSay(dm, true, T(`Хочу разместить: ${d.title}`, `Хочу розмістити: ${d.title}`, `I want to post: ${d.title}`));
  dmSay(dm, false, T(`Глянул. Пост сделаю, моя доля — ${share}% с продажи. Цену ставим ${fmt(d.price)}, за неё быстро заберут. Деньги только при встрече, я с покупателем не пересекаюсь.`, `Глянув. Пост зроблю, моя частка — ${share}% із продажу. Ціну ставимо ${fmt(d.price)}, за неї швидко заберуть. Гроші лише при зустрічі, я з покупцем не перетинаюся.`, `Had a look. I’ll post it, my cut is ${share}% of the sale. We ask ${fmt(d.price)} — it’ll go fast at that. Cash only in person, I don’t meet the buyer.`), { deal: d.id });
  emit('tg');
  return d;
}
export function haggleShare(id) {
  const d = dealById(id); if (!d || d.st !== 'offer' || d.haggled) return null;
  const dm = dmOf('adm_' + d.ch), want = Math.max(3, d.share - 5);
  d.haggled = true;
  dmSay(dm, true, T(`Давай ${want}%? Товар ходовой, уйдёт сразу.`, `Давай ${want}%? Товар ходовий, піде одразу.`, `How about ${want}%? It sells itself.`));
  const ok = new RNG(uid('th')).chance(0.3 + charisma() * 0.005);
  if (ok) { d.share = want; dmSay(dm, false, T(`Ладно, ${want}%. Но если покупатель сольётся — не ко мне.`, `Гаразд, ${want}%. Але якщо покупець зіллється — не до мене.`, `Fine, ${want}%. But if the buyer bails, that’s on you.`), { deal: d.id }); }
  else dmSay(dm, false, T(`Нет, ${d.share}% — и так по‑братски. Не хочешь — ищи другой канал.`, `Ні, ${d.share}% — і так по‑братськи. Не хочеш — шукай інший канал.`, `No, ${d.share}% is already a favour. Don’t like it — find another channel.`), { deal: d.id });
  emit('tg');
  return ok;
}
export function setDealPrice(id, k) {
  const d = dealById(id); if (!d || d.st !== 'offer') return;
  const it = getItem(d.itemId); if (!it) return;
  d.price = nicePrice(fairPrice(it) * k, countryOf(G.s.player.city).cur);
  const dm = dmOf('adm_' + d.ch);
  dmSay(dm, true, T(`Поставь ${fmt(d.price)}.`, `Постав ${fmt(d.price)}.`, `Make it ${fmt(d.price)}.`));
  dmSay(dm, false, k > 1.05 ? T('Можно, но ждать покупателя будешь дольше, и торговаться будут.', 'Можна, але чекатимеш покупця довше, і торгуватимуться.', 'Sure, but you’ll wait longer and they’ll haggle.') : T('Ок.', 'Ок.', 'Ok.'), { deal: d.id });
  emit('tg');
}
export function agreeDeal(id) {
  const d = dealById(id); if (!d || d.st !== 'offer') return { ok: false };
  const it = getItem(d.itemId); if (!it) return { ok: false };
  removeItem(it.id);
  d.item = it; d.st = 'posted';
  const fair = fairPrice(it), dear = clamp(d.price / Math.max(1, fair), 0.7, 1.6);
  // forbidden boxes and fair prices find a buyer fastest
  const wait = rt(new RNG(uid('tw')).float(2, 6) * Math.pow(dear, 2.5) / (isBox(it) ? 1.6 : 1));
  d.buyerAt = G.s.t + Math.max(2, Math.round(wait));
  const dm = dmOf('adm_' + d.ch);
  dmSay(dm, true, T('Договорились, ставь.', 'Домовились, став.', 'Deal, post it.'));
  dmSay(dm, false, T('Пост вышел ✅ Покупатели напишут тебе в личку. Мою долю переведёшь после встречи.', 'Пост вийшов ✅ Покупці напишуть тобі в особисті. Мою частку переведеш після зустрічі.', 'The post is up ✅ Buyers will DM you. Send my cut after the meet‑up.'), { deal: d.id });
  stat('tgPosted');
  emit('tg'); emit('inv');
  return { ok: true };
}
export function cancelDeal(id) {
  const d = dealById(id); if (!d || ['done', 'busted'].includes(d.st)) return false;
  if (d.item) addItem(d.item, d.item.paid || 0, 'tg');
  d.st = 'cancel';
  const dm = dmOf('adm_' + d.ch);
  if (dm) dmSay(dm, true, T('Снимай пост, передумал.', 'Знімай пост, передумав.', 'Take the post down, changed my mind.'));
  emit('tg'); emit('inv');
  return true;
}
export function tgDealsTick() {
  const s = G.s, ds = s.tg?.deals;
  if (!ds?.length) return;
  for (const d of ds) {
    if (d.st !== 'posted' || s.t < d.buyerAt) continue;
    const r = new RNG(uid('tb'));
    const { name } = npcName(r, s.player.city);
    const it = d.item, fair = fairPrice(it);
    const offer = d.price > fair * 1.05 ? nicePrice(Math.max(fair, d.price * r.float(0.88, 0.96)), countryOf(s.player.city).cur) : d.price;
    d.buyer = { name, handle: '@' + r.pick(['buyer', 'kupl', 'beru', 'zabiray', 'opt', 'nado']) + '_' + r.int(100, 9999), offer };
    // stolen / forbidden: 5 % of «buyers» are police officers (decided now, nothing gives it away)
    d.cop = !!(it.banned || it.hot) && r.chance(0.05);
    d.st = 'buyer';
    const dm = openDm('buy_' + d.id, name, d.buyer.handle, { role: 'buyer', deal: d.id, ch: d.ch });
    dmSay(dm, false, T(`Привет! По посту в «${chName(CHANNELS.find((x) => x.id === d.ch))}»: ${d.title}. Беру за ${fmt(offer)}. Встретимся сегодня?`, `Привіт! По посту в «${chName(CHANNELS.find((x) => x.id === d.ch))}»: ${d.title}. Беру за ${fmt(offer)}. Зустрінемося сьогодні?`, `Hi! About the post in “${chName(CHANNELS.find((x) => x.id === d.ch))}”: ${d.title}. I’ll take it for ${fmt(offer)}. Meet today?`), { deal: d.id });
    notify('tg', name, T(`Готов купить «${d.title}» за ${fmt(offer)}`, `Готовий купити «${d.title}» за ${fmt(offer)}`, `Wants “${d.title}” for ${fmt(offer)}`), { go: ['tg', 'dm', { id: dm.id }], silent: !!tgState().mute });
    emit('tg');
  }
}
export function declineBuyer(id) {
  const d = dealById(id); if (!d || d.st !== 'buyer') return;
  const dm = dmOf('buy_' + d.id);
  if (dm) dmSay(dm, true, T('Нет, не продаю за столько.', 'Ні, не продаю за стільки.', 'No, not at that price.'));
  d.st = 'posted'; d.buyer = null; d.buyerAt = G.s.t + rt(new RNG(uid('tw')).float(2, 5));
  emit('tg');
}
// the meet‑up: takes a while; then either the money (minus the admin's cut) or handcuffs
export function meetBuyer(id) {
  const s = G.s, d = dealById(id); if (!d || d.st !== 'buyer') return { ok: false };
  if (!hasEnergy(8)) return { ok: false, msg: T('Нет сил ехать на встречу — поешьте или отдохните', 'Немає сил їхати на зустріч — поїжте або відпочиньте', 'Too tired for a meet‑up — eat or rest') };
  if (noNeeds()) emit('timeSpent', 45); else useEnergy(8);
  const dm = dmOf('buy_' + d.id), adm = dmOf('adm_' + d.ch);
  const it = d.item, cur = countryOf(s.player.city).cur;
  if (d.cop) {
    const fine = nicePrice(Math.max(40, itemValue(it, s.player.city, 'true', { clean: true }) * 0.5), cur);
    d.st = 'busted';
    arrest(it.banned ? 'banned' : 'stolen', { fine, mins: 180, text: d.title });
    if (dm) dmSay(dm, false, T('Полиция. Не двигаться.', 'Поліція. Не рухатися.', 'Police. Don’t move.'));
    stat('tgBusted'); emit('tg'); emit('inv');
    return { ok: true, busted: true, fine };
  }
  const price = d.buyer.offer, cut = Math.round(price * d.share) / 100;
  earn(price, 'sale', T(`Телега: ${d.title}`, `Телега: ${d.title}`, `Telega: ${d.title}`));
  charge(cut, 'service', T(`Доля админу ${adminOf(CHANNELS.find((x) => x.id === d.ch)).handle}`, `Частка адміну ${adminOf(CHANNELS.find((x) => x.id === d.ch)).handle}`, `Admin's cut ${adminOf(CHANNELS.find((x) => x.id === d.ch)).handle}`));
  d.st = 'done'; d.net = price - cut;
  if (dm) { dmSay(dm, true, T('На месте, отдаю.', 'На місці, віддаю.', 'Here, handing it over.')); dmSay(dm, false, T('Всё ок, деньги отдал 🤝', 'Усе ок, гроші віддав 🤝', 'All good, paid 🤝'), { silent: true }); }
  if (adm) { dmSay(adm, true, T(`Продал. Твои ${fmt(cut)} перевёл.`, `Продав. Твої ${fmt(cut)} переказав.`, `Sold. Sent your ${fmt(cut)}.`)); dmSay(adm, false, T('Принял 👍 Будет ещё — пиши.', 'Прийняв 👍 Буде ще — пиши.', 'Got it 👍 Got more — write.'), { silent: true }); }
  stat('sold'); stat('tgSold'); stat('profit', d.net - (it.paid || 0)); addXP(it.banned ? 18 : 10);
  emit('tg'); emit('money');
  return { ok: true, price, cut, net: d.net };
}
