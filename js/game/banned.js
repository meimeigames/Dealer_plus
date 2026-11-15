// Forbidden goods from the Shade: jammers, spy cameras, police scanners, odometer "correctors", unstamped
// cigarettes… They carry traces (a batch number in the customs database, the courier's waybill, a GPS tag, prints)
// that can be wiped by hand or by a "master". They can only be sold back through the Shade: the drop happens in
// about a minute, with a small chance the police are watching it (3–5 % when the thing is fully wiped, more with
// traces left). Then, 3–7 minutes after the deal closes, the buyer may still complain to the police (5–7 %);
// if they don't, the thing is sold for good.
import { rt } from '../core/clock.js';
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { clamp, uid } from '../core/util.js';
import { fmt, nicePrice } from '../core/money.js';
import { countryOf } from '../data/world.js';
import { MODEL, MODELS } from '../data/catalog.js';
import { getItem, removeItem, addItem, earn, charge, spend, stat, notify, log, addXP } from './player.js';
import { itemValue, itemTitle, makeItem } from './items.js';
import { arrest, policeFine } from './crime.js';
import { strike } from './support.js';

export const BMARKS = {
  batch: { n: ['Номер партии в базе таможни', 'Номер партії в базі митниці', 'Batch number in the customs database'], ic: '🛃', w: 30, fix: 'svc', how: ['Перебить номер партии у «мастера»', 'Перебити номер партії у «майстра»', 'Have a “master” re‑mark the batch'] },
  label: { n: ['Наклейка с серийником', 'Наліпка з серійником', 'Serial sticker'], ic: '🏷', w: 20, fix: 'diy', game: 'mk_label', how: ['Отклеить наклейку', 'Відклеїти наліпку', 'Peel the sticker off'] },
  waybill: { n: ['Упаковка с накладной перевозчика', 'Упаковка з накладною перевізника', 'Box with the courier’s waybill'], ic: '📦', w: 18, fix: 'diy', game: 'pack', how: ['Переупаковать в безликую коробку', 'Перепакувати в безлику коробку', 'Repack it in a plain box'] },
  gps: { n: ['GPS‑метка курьерской службы', 'GPS‑мітка курʼєрської служби', 'Courier GPS tag'], ic: '📍', w: 22, fix: 'diy', game: 'mk_tags', how: ['Найти и срезать метки', 'Знайти й зрізати мітки', 'Find and cut the tags'] },
  prints: { n: ['Отпечатки и следы продавца', 'Відбитки та сліди продавця', 'Prints and the seller’s traces'], ic: '🧤', w: 12, fix: 'diy', game: 'scrub', how: ['Протереть спиртом', 'Протерти спиртом', 'Wipe it down with alcohol'] },
};
export const BANNED_MODELS = () => MODELS.filter((m) => m.banned);
export const isBannedItem = (it) => !!(it?.banned || MODEL[it?.m]?.banned);
const hashId = (id) => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const BAN_FLOOR = 5;
export const traceOfB = (it) => (it?.banned ? Math.round(it.banned.tr) : 0);
export const bMarksLeft = (it) => (it?.banned ? it.banned.marks.filter((k) => !it.banned.done.includes(k)) : []);
// chance the police are watching the drop: 3–5 % fully wiped (each item its own), up to ~35 % untouched
export const saleFloor = (it) => +(0.03 + (hashId(it.id + '|s') % 21) / 1000).toFixed(3);
export function saleRisk(it) {
  if (!it?.banned) return 0;
  const lo = saleFloor(it);
  if (!bMarksLeft(it).length) return lo;
  const x = clamp((traceOfB(it) - BAN_FLOOR) / (90 - BAN_FLOOR), 0.05, 1);
  return clamp(lo + (0.35 - lo) * Math.pow(x, 0.9), lo, 0.6);
}
// a buyer who complains afterwards: 5–7 %
export const complainRisk = (it) => +(0.05 + (hashId(it.id + '|c') % 21) / 1000).toFixed(3);

// wholesale boxes of forbidden goods: a lot of value in one box, and buyers want them (more of them, faster)
export const isBox = (it) => !!MODEL[it?.m]?.bulk;
export const boxInfo = (it) => { const m = MODEL[it?.m]; return m?.bulk ? { n: m.bulk, unit: L(m.unit || ['шт', 'шт', 'pcs']) } : null; };
export const liquidity = (it) => MODEL[it?.m]?.liquid || 1;
// what to call it on Oliks so the moderators and the police don't look twice
export const DISGUISES = [
  ['Коробки для переезда (б/у), много', 'Коробки для переїзду (б/в), багато', 'Moving boxes (used), lots'],
  ['Бытовая химия оптом, остатки склада', 'Побутова хімія оптом, залишки складу', 'Household chemicals, warehouse leftovers'],
  ['Подарочные наборы оптом', 'Подарункові набори оптом', 'Gift sets, wholesale'],
  ['Канцтовары оптом — закрытие магазина', 'Канцтовари оптом — закриття магазину', 'Stationery wholesale — shop closing'],
  ['Автозапчасти, неликвид со склада', 'Автозапчастини, неліквід зі складу', 'Car parts, dead stock'],
  ['Сувенирная продукция оптом', 'Сувенірна продукція оптом', 'Souvenirs, wholesale'],
];
export function makeBanned(it, rng) {
  const all = Object.keys(BMARKS);
  const marks = rng.sample(all, rng.int(3, 4));
  const tr = clamp(marks.reduce((a, k) => a + BMARKS[k].w, 0) * rng.float(0.85, 1.05), 30, 90);
  it.banned = { kind: MODEL[it.m]?.banned || 'misc', tr: Math.round(tr), marks, done: [] };
  it.shade = 'banned';
  return it;
}
// a forbidden lot for the Shade feed
export function bannedListing(rng, city) {
  const m = rng.pick(BANNED_MODELS().filter((x) => !x.bulk));
  const it = makeItem(rng, { model: m.id, quality: rng.chance(0.7) ? 'good' : 'any', fakeMult: 0, lockRate: 0 });
  it.fake = 0; it.docs = false; it.grey = true; it.defects = it.defects.filter((d) => d.known);
  makeBanned(it, rng);
  const clean = itemValue(it, city, 'true', { clean: true });
  return { it, clean, price: nicePrice(Math.max(5, clean * rng.float(0.45, 0.68)), countryOf(city).cur) };
}

// a wholesale box of forbidden goods for the Shade feed: dearer, and resold quickly at a good price
export function bannedBoxListing(rng, city) {
  const m = rng.pick(BANNED_MODELS().filter((x) => x.bulk));
  const it = makeItem(rng, { model: m.id, quality: 'good', fakeMult: 0, lockRate: 0 });
  it.fake = 0; it.docs = false; it.grey = true; it.defects = [];
  makeBanned(it, rng);
  const clean = itemValue(it, city, 'true', { clean: true });
  return { it, clean, price: nicePrice(Math.max(5, clean * rng.float(0.5, 0.64)), countryOf(city).cur) };
}

// ---------------------------------------------------------------- wiping traces
export const bSvcPrice = (it, k) => nicePrice(Math.max(12, itemValue(it, G.s.player.city, 'true', { clean: true }) * 0.07 + BMARKS[k].w * 0.6), countryOf(G.s.player.city).cur);
export function bWipe(it, k, quality = 1) {
  if (!it?.banned || !it.banned.marks.includes(k) || it.banned.done.includes(k)) return { ok: false };
  if (quality < 0.35) { it.banned.tr = clamp(it.banned.tr + 5, 0, 95); emit('inv'); return { ok: true, res: 'botched' }; }
  it.banned.done.push(k);
  it.banned.tr = Math.max(BAN_FLOOR, Math.round(it.banned.tr - BMARKS[k].w * (quality >= 0.7 ? 1 : 0.65)));
  if (!bMarksLeft(it).length) it.banned.tr = BAN_FLOOR;
  emit('inv');
  return { ok: true, res: quality >= 0.7 ? 'clean' : 'rough' };
}
export function bBuyWipe(it, k) {
  const p = bSvcPrice(it, k);
  if (!spend(p, 'service', T('Теневой «мастер»', 'Тіньовий «майстер»', 'A shadow “master”'))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  return bWipe(it, k, 1);
}

// ---------------------------------------------------------------- selling through the Shade
const bs = () => { const s = G.s; s.bsales ||= { open: [], after: [], log: [] }; return s.bsales; };
export const openSales = () => bs().open;
export const saleLog = () => bs().log;
export const afterSales = () => bs().after;
// the Shade's own buyers: a fast drop, but they pay about 20–25 % over what you paid at most (no doubling your money)
export const offerFor = (it) => {
  const v = itemValue(it, G.s.player.city, 'true', { clean: true });
  let p = v * ((isBox(it) ? 0.88 : 0.85) - 0.25 * traceOfB(it) / 100);
  if (it.paid > 0) p = Math.min(Math.max(it.paid * 1.22, v * 0.3), v * 0.95);
  return nicePrice(p, countryOf(G.s.player.city).cur);
};
export function startSale(itemId) {
  const it = getItem(itemId);
  if (!it?.banned) return { ok: false };
  const r = new RNG(uid('bs'));
  const price = Math.round(offerFor(it) * r.float(0.92, 1.12));
  const mins = isBox(it) ? r.int(20, 45) : r.int(40, 90); // the drop: about a minute (boxes are snapped up faster)
  removeItem(it.id);
  bs().open.push({ id: uid('bo'), item: it, title: itemTitle(it), price, at: G.s.t + mins, start: G.s.t, risk: saleRisk(it), complain: complainRisk(it) });
  stat('bannedListed'); log('dark', `⛔ ${itemTitle(it)}`);
  emit('inv'); emit('dark');
  return { ok: true, mins, price };
}
export function cancelSale(id) {
  const st = bs(), o = st.open.find((x) => x.id === id);
  if (!o) return false;
  st.open = st.open.filter((x) => x !== o);
  addItem(o.item, o.item.paid || 0, 'dark');
  emit('inv'); emit('dark');
  return true;
}
export function bannedTick() {
  const s = G.s, st = s.bsales;
  if (!st) return;
  const cur = countryOf(s.player.city).cur;
  if (st.open.length) {
    const due = st.open.filter((o) => o.at <= s.t);
    if (due.length) {
      st.open = st.open.filter((o) => o.at > s.t);
      for (const o of due) {
        const value = itemValue(o.item, s.player.city, 'true', { clean: true });
        if (Math.random() < o.risk) {
          // the "buyer" was an operative: the thing is seized, a fine and a few minutes in a cell
          const fine = nicePrice(Math.max(30, value * 0.6), cur);
          arrest('banned', { fine, mins: 180, text: o.title });
          st.log.unshift({ t: s.t, title: o.title, res: 'caught', fine });
          notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Сбыт «${o.title}» сорвался: на встречу пришли оперативники. Товар изъят, штраф ${fmt(fine)}.`, `Збут «${o.title}» зірвався: на зустріч прийшли оперативники. Товар вилучено, штраф ${fmt(fine)}.`, `Selling “${o.title}” went wrong: plain‑clothes police showed up. Seized, fine ${fmt(fine)}.`));
          stat('bannedCaught');
          continue;
        }
        earn(o.price, 'sale', T(`Тень: ${o.title}`, `Тінь: ${o.title}`, `Shade: ${o.title}`));
        addXP(15); stat('bannedSold'); stat('profit', o.price - (o.item.paid || 0));
        st.log.unshift({ t: s.t, title: o.title, res: 'sold', price: o.price });
        notify('dark', T('Тень: продано', 'Тінь: продано', 'Shade: sold'), `${o.title} · +${fmt(o.price)}`);
        // the buyer's window to complain: 3–7 minutes after the deal closed
        st.after.push({ id: uid('bw'), title: o.title, price: o.price, p: o.complain, from: s.t, at: s.t + new RNG(uid('ba')).int(rt(3), rt(7)) });
      }
      st.log.length = Math.min(st.log.length, 20);
      emit('money'); emit('dark');
    }
  }
  if (st.after.length) {
    const due = st.after.filter((x) => x.at <= s.t);
    if (!due.length) return;
    st.after = st.after.filter((x) => x.at > s.t);
    for (const x of due) {
      if (Math.random() >= x.p) { // the buyer stayed quiet — the deal is done for good
        st.log.unshift({ t: s.t, title: x.title, res: 'clear', price: x.price });
        notify('dark', T('Тень: всё чисто', 'Тінь: усе чисто', 'Shade: all clear'), T(`${x.title}: покупатель не пожаловался — сделка закрыта окончательно ✅`, `${x.title}: покупець не поскаржився — угоду закрито остаточно ✅`, `${x.title}: the buyer stayed quiet — the deal is closed for good ✅`), { noBadge: true });
        continue;
      }
      const fine = nicePrice(Math.max(25, x.price * 0.5), cur);
      policeFine('banned', fine, x.title);
      st.log.unshift({ t: s.t, title: x.title, res: 'complaint', fine });
      notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Покупатель «${x.title}» пожаловался в полицию. Штраф ${fmt(fine)} и пометка в деле.`, `Покупець «${x.title}» поскаржився в поліцію. Штраф ${fmt(fine)} і позначка в справі.`, `The buyer of “${x.title}” went to the police. Fine ${fmt(fine)} and a mark on your record.`));
      stat('bannedComplaints');
    }
    emit('dark');
  }
}
export const banLabel = (it) => T('⛔ Запрещённое', '⛔ Заборонене', '⛔ Forbidden') + (it?.banned ? ` · ${T('след', 'слід', 'trace')} ${traceOfB(it)}%` : '');
export const blockMsg = () => T('Запрещённое можно сбыть только через Тень (вкладка «Сбыт»)', 'Заборонене можна збути лише через Тінь (вкладка «Збут»)', 'Forbidden goods can only be sold through the Shade (“Sell” tab)');
export const bMarkName = (k) => L(BMARKS[k].n);

// ---------------------------------------------------------------- forbidden goods on Oliks & co.
// Listed openly, the moderators take it down within a few hours (30 % an hour) and the account gets a strike;
// under a disguise («moving boxes», «gift sets»…) only 3 % an hour. At the deal the police risk is higher for an
// open ad (see hot.js dealRisk).
export function bannedAdsTick() {
  const s = G.s;
  if (!s.listings?.length) return;
  for (const l of s.listings.slice()) {
    const it = getItem(l.itemId);
    if (!it?.banned || l.frozen) continue;
    const r = new RNG(`mod|${l.id}|${s.t}`);
    if (!r.chance(l.mask ? 0.03 : 0.3)) continue;
    s.listings = s.listings.filter((x) => x !== l);
    it.listed = false; delete it.olx;
    s.chats = (s.chats || []).filter((c) => !(c.kind === 'sell' && c.itemId === it.id && c.st === 'open'));
    strike(T(`Объявление «${l.mask ? L(l.mask) : itemTitle(it)}» удалено модерацией: запрещённый товар`, `Оголошення «${l.mask ? L(l.mask) : itemTitle(it)}» видалено модерацією: заборонений товар`, `Ad “${l.mask ? L(l.mask) : itemTitle(it)}” removed by moderators: forbidden goods`));
    stat('bannedAdsRemoved');
    emit('listings');
  }
}
