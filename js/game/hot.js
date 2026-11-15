// Stolen ("hot") goods. Anything stolen carries traces: a blacklisted IMEI, the owner's account, a serial in the
// police database, an engraving, shop tags, a frame number / VIN, plates. The trace level (0–100) is how easy
// the thing is to find. You can wipe traces — by hand (mini‑games) or through shadow services — but a wiped
// trace still leaves a sign of tampering, so the risk never drops to zero.
// Police checks come a few times over the next days (and the buyer checks after you sell it):
// chance ≈ 3% + 45% × trace. Caught: the item is seized (or the buyer gets the police to make you pay), a fine
// and a mark on your record. A hot item also sells for less on the open market — buyers check.
import { rt } from '../core/clock.js';
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { uid, clamp } from '../core/util.js';
import { fmt, nicePrice } from '../core/money.js';
import { countryOf } from '../data/world.js';
import { MODEL } from '../data/catalog.js';
import { itemValue, itemTitle } from './items.js';
import { getItem, removeItem, earn, charge, spend, notify, stat, addXP, log } from './player.js';
import { arrest, policeFine } from './crime.js';
import { dv } from './difficulty.js';
import { saleRisk, saleFloor, complainRisk } from './banned.js';

// trace kinds: weight (how much of the trace it is), how to remove it
export const MARKS = {
  imei: { n: ['IMEI в чёрном списке', 'IMEI у чорному списку', 'IMEI blacklisted'], ic: '📡', w: 40, fix: 'svc', price: 0.16, how: ['Перебить IMEI', 'Перебити IMEI', 'Re‑flash the IMEI'] },
  acct: { n: ['Аккаунт владельца', 'Акаунт власника', 'Owner’s account'], ic: '👤', w: 25, fix: 'svc', price: 0.1, how: ['Отвязать аккаунт', 'Відвʼязати акаунт', 'Unlink the account'] },
  serial: { n: ['Серийник в базе розыска', 'Серійник у базі розшуку', 'Serial in the police database'], ic: '🏷', w: 30, fix: 'diy', game: 'mk_label', how: ['Переклеить серийник', 'Переклеїти серійник', 'Swap the serial sticker'] },
  owner: { n: ['Файлы и фото владельца', 'Файли й фото власника', 'Owner’s files and photos'], ic: '🗂', w: 15, fix: 'wipe', how: ['Стереть всё', 'Стерти все', 'Wipe everything'] },
  engrave: { n: ['Гравировка / номер корпуса', 'Гравіювання / номер корпусу', 'Engraving / case number'], ic: '✒️', w: 45, fix: 'diy', game: 'scrub', valueHit: 0.04, how: ['Сполировать', 'Сполірувати', 'Polish it off'] },
  papers: { n: ['Чек и карточка на чужое имя', 'Чек і картка на чуже імʼя', 'Receipt and card in someone’s name'], ic: '🧾', w: 20, fix: 'drop', how: ['Выбросить бумаги', 'Викинути папери', 'Bin the papers'] },
  tags: { n: ['Бирки и чип магазина', 'Бірки та чип магазину', 'Store tags and RFID chip'], ic: '🔖', w: 40, fix: 'diy', game: 'mk_tags', how: ['Срезать бирки', 'Зрізати бірки', 'Cut the tags off'] },
  vin: { n: ['Номер рамы / VIN в розыске', 'Номер рами / VIN у розшуку', 'Frame number / VIN wanted'], ic: '🔢', w: 50, fix: 'svc', price: 0.12, how: ['Перебить номер', 'Перебити номер', 'Re‑stamp the number'] },
  plates: { n: ['Номера в розыске', 'Номери в розшуку', 'Wanted plates'], ic: '🚘', w: 30, fix: 'svc', price: 0.02, min: 60, how: ['Новые номера', 'Нові номери', 'New plates'] },
  paint: { n: ['Приметный цвет и наклейки', 'Помітний колір і наклейки', 'Distinctive paint and stickers'], ic: '🎨', w: 18, fix: 'svc', price: 0.05, how: ['Перекрасить', 'Перефарбувати', 'Respray it'] },
};
const MARKS_BY_CAT = {
  phones: ['imei', 'acct', 'serial', 'owner'], electronics: ['serial', 'acct', 'owner'], consoles: ['serial', 'acct'], storage: ['owner', 'serial'],
  watches: ['engrave', 'papers'], jewelry: ['engrave', 'papers'], bags: ['tags', 'serial'], sneakers: ['tags'], clothing: ['tags'], perfume: ['tags'],
  bikes: ['vin', 'paint'], cars: ['vin', 'plates', 'paint'], instruments: ['serial', 'engrave'], pcparts: ['serial'],
};
const RESIDUE = 0.15; // a wiped trace still shows a little (tampering)
// however well you wipe it, a stolen thing never drops below this trace: serials in old databases, a photo in the
// owner's police report, a neighbour who saw it
export const HOT_FLOOR = 17;
// …and each stolen thing has its own floor (17–29 %): how well‑known it is, how many people saw it. A careful
// wipe gets it down to that floor; a sloppy one leaves more. So cleaned things no longer all read the same number.
export const floorOf = (it) => (it?.hot ? (it.hot.floor ??= HOT_FLOOR + (hashIdF(it.id + '|floor') % 13)) : HOT_FLOOR);
function hashIdF(id) { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
export const marksFor = (cat) => MARKS_BY_CAT[cat] || ['serial', 'owner'];
export const isHot = (it) => !!it?.hot;
export const traceOf = (it) => (it?.hot ? Math.round(it.hot.tr) : 0);
// The overall chance that a stolen thing gets you caught while you hold it (all police checks together).
// Even wiped to the floor it stays 41–47% (every item has its own minimum); untouched — up to ~92%.
const CHECKS = 3;
const hashId = (id) => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const minRisk = (it) => (it?.hot ? (it.hot.min ??= +(0.41 + (hashId(it.id) % 61) / 1000).toFixed(3)) : 0);
export function riskOf(it) {
  if (!it?.hot) return 0;
  const lo = minRisk(it), x = clamp((traceOf(it) - floorOf(it)) / (95 - floorOf(it)), 0, 1);
  const base = lo + (0.92 - lo) * Math.pow(x, 0.8);
  return clamp(1 - Math.pow(1 - base, dv().crime), 0.05, 0.97); // easier / harder difficulty bends it
}
// one police check
export const catchChance = (it) => 1 - Math.pow(1 - riskOf(it), 1 / CHECKS);
// After a sale: the chance the buyer runs it through the databases and reports you. Fully wiped — only 5–7%
// (every item has its own number); each trace still on it raises it, an untouched one ~60%.
export const buyerFloor = (it) => (it?.hot ? (it.hot.bmin ??= +(0.05 + (hashId(it.id + '|b') % 21) / 1000).toFixed(3)) : 0);
export function buyerRisk(it) {
  if (!it?.hot) return 0;
  const lo = buyerFloor(it);
  if (!markLeft(it).length) return lo;
  const x = clamp((traceOf(it) - floorOf(it)) / (95 - floorOf(it)), 0.08, 1);
  return clamp(lo + (0.6 - lo) * Math.pow(x, 0.85) * dv().crime, lo, 0.85);
}

// make an item stolen; known = the seller admitted it (it shows as hot right away)
export function makeHot(it, rng, o = {}) {
  const year = it.year || MODEL[it.m]?.year || 2020;
  // an old console has no online account, a 90s phone no IMEI blacklist worth the name
  const ms = marksFor(it.cat).filter((k) => !((k === 'acct' && year < 2010) || (k === 'imei' && year < 2005))).filter(() => rng.chance(0.8));
  if (!ms.length) ms.push(marksFor(it.cat).find((k) => k !== 'acct' && k !== 'imei') || 'serial');
  const tr = clamp(ms.reduce((a, k) => a + MARKS[k].w, 0) * rng.float(0.8, 1.05), 28, 95);
  it.hot = { tr: Math.round(tr), marks: ms, done: [], known: o.known !== false, src: o.src || 'dark' };
  it.stolen = true;
  return it;
}
export function hotState() { const s = G.s; s.hotw ||= []; return s.hotw; }
// police checks for an item you now hold: 3 times over the next ~5 days
export function watchHot(it) {
  const s = G.s, r = new RNG(uid('hw'));
  for (let i = 0; i < CHECKS; i++) hotState().push({ id: it.id, title: itemTitle(it), at: s.t + r.int(300, 1500) + i * r.int(900, 2400), val: itemValue(it, s.player.city, 'true', { clean: true }) });
}
export function hotTick() {
  const s = G.s, w = s.hotw;
  if (!w?.length) return;
  const due = w.filter((x) => x.at <= s.t);
  if (!due.length) return;
  s.hotw = w.filter((x) => x.at > s.t);
  for (const x of due) {
    // after a sale: the buyer runs the thing through the databases
    if (x.buyer) {
      if (Math.random() >= x.p) { notify('dark', T('Всё чисто', 'Усе чисто', 'All clear'), T(`${x.title}: покупатель не пожаловался — продано окончательно ✅`, `${x.title}: покупець не поскаржився — продано остаточно ✅`, `${x.title}: the buyer stayed quiet — sold for good ✅`), { noBadge: true }); continue; }
      const cur = countryOf(s.player.city).cur;
      if (x.banned) {
        const fine = nicePrice(Math.max(25, (x.price || x.val) * 0.5), cur);
        policeFine('banned', fine, x.title);
        notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Покупатель «${x.title}» пожаловался в полицию. Штраф ${fmt(fine)} и пометка в деле.`, `Покупець «${x.title}» поскаржився в поліцію. Штраф ${fmt(fine)} і позначка в справі.`, `The buyer of “${x.title}” went to the police. Fine ${fmt(fine)} and a mark on your record.`));
      } else if (x.grey) {
        const fine = nicePrice(Math.max(15, x.price * 0.25), cur);
        policeFine('grey', fine, x.title);
        notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Покупатель проверил ${x.title} по серийнику: серый импорт без растаможки. Он написал заявление — к вам пришла полиция. Штраф ${fmt(fine)} и пометка в деле.`, `Покупець перевірив ${x.title} за серійником: сірий імпорт без розмитнення. Він написав заяву — до вас прийшла поліція. Штраф ${fmt(fine)} і позначка в справі.`, `The buyer checked the ${x.title} by its serial: an uncleared grey import. He filed a report — the police came. Fine ${fmt(fine)} and a mark on your record.`));
      } else {
        const refund = nicePrice(x.price || x.val * 0.5, cur);
        charge(refund, 'refund', T(`Возврат покупателю: ${x.title}`, `Повернення покупцю: ${x.title}`, `Refund to the buyer: ${x.title}`));
        arrest('stolen', { fine: nicePrice(x.val * 0.2 + 25, cur), text: x.title });
        notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Покупатель пробил ${x.title} по базе — вещь числится краденой. Он написал заявление, и к вам пришла полиция: вернули ему ${fmt(refund)}, штраф и пометка в деле.`, `Покупець пробив ${x.title} за базою — річ числиться краденою. Він написав заяву, і до вас прийшла поліція: повернули йому ${fmt(refund)}, штраф і позначка в справі.`, `The buyer ran the ${x.title} through the database — it’s listed as stolen. He filed a report and the police came: ${fmt(refund)} refunded to him, a fine and a mark on your record.`));
      }
      stat('hotCaught');
      continue;
    }
    const it = getItem(x.id);
    const sold = s.hotSold?.[x.id];
    if (!it && !sold) continue; // given to a fence / an order / lost — off your hands
    // hidden in a stash for the check (Radar): the police find nothing; now and then the stash is robbed
    if (x.stash && it) {
      if (Math.random() < 0.1) { removeItem(it.id); notify('dark', T('Тайник вскрыли', 'Схованку розкрили', 'Stash robbed'), T(`${x.title}: из тайника всё вынесли.`, `${x.title}: зі схованки все винесли.`, `${x.title}: someone emptied the stash.`)); }
      continue;
    }
    const p = it ? catchChance(it) : clamp((0.03 + 0.45 * (sold.tr || 0) / 100) * 0.8 * dv().crime, 0.01, 0.5); // "sold" = saves from before buyer checks
    if (Math.random() >= p) continue;
    // caught: no more checks for this item
    s.hotw = s.hotw.filter((y) => y.id !== x.id);
    if (it) {
      removeItem(it.id);
      const fine = nicePrice(x.val * 0.2 + 25, countryOf(s.player.city).cur);
      arrest('stolen', { fine, text: x.title });
      notify('gov', T('Полиция', 'Поліція', 'Police'), T(`${x.title}: нашли по следам (${MARKS[it.hot.marks.find((k) => !it.hot.done.includes(k)) || it.hot.marks[0]]?.n[0].toLowerCase() || 'база'}). Вещь изъята, штраф.`, `${x.title}: знайшли за слідами. Річ вилучено, штраф.`, `${x.title}: traced. Seized, plus a fine.`));
      stat('hotCaught');
    } else {
      const refund = nicePrice(sold.price || x.val * 0.5, countryOf(s.player.city).cur);
      charge(refund, 'fine', T(`Возврат покупателю: ${x.title}`, `Повернення покупцю: ${x.title}`, `Refund to the buyer: ${x.title}`));
      arrest('stolen', { fine: x.val * 0.1, text: x.title });
      notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Покупатель проверил ${x.title} — краденое. Вернули ему ${fmt(refund)} и выписали штраф.`, `Покупець перевірив ${x.title} — крадене. Повернули йому ${fmt(refund)} і виписали штраф.`, `The buyer checked the ${x.title} — stolen. You refunded ${fmt(refund)} and got fined.`));
      delete s.hotSold[x.id];
      stat('hotCaught');
    }
  }
  emit('inv');
}
// Selling anything that came from the Shade (through ads, a pawn shop, your store, an auction, a dealer…):
// the buyer may check it. Stolen: the police stop looking at you, the buyer checks instead — 5–7% for a fully
// wiped item, more with traces left (buyerRisk). Grey imports: now and then a buyer checks the serial and
// reports the seller. The fence and "no questions" orders don't check.
export function noteHotSale(it, price) {
  // forged papers: now and then a buyer's bank or a service centre spots them
  if (it?.fakeDocs && Math.random() < 0.06) arrest('fake', { text: T('Поддельные документы на вещь', 'Підроблені документи на річ', 'Forged papers for an item') });
  if (!it) return;
  const kind = shadeOf(it);
  if (!kind) return;
  // the buyer's window to complain: 3–7 minutes after the deal closed; police stop watching the item
  const s = G.s, r = new RNG(uid('hb'));
  s.hotw = (s.hotw || []).filter((x) => x.id !== it.id);
  s.hotw.push({ id: it.id, buyer: true, kind, grey: kind === 'grey', banned: kind === 'banned', title: itemTitle(it), at: s.t + r.int(rt(3), rt(7)), val: itemValue(it, s.player.city, 'true', { clean: true }), price, p: complaintRisk(it) });
}
// ---------------------------------------------------------------- selling Shade goods on Oliks & co.
// Stolen, grey or forbidden: wipe the traces, sell it like anything else. At the deal itself there is a small
// chance the police are on to it (3–5 % fully wiped, more with traces left). Sold — then for 3–7 minutes after
// the deal closes the buyer may still complain to the police: 5–7 % fully wiped (more with traces). If they
// don't, the thing is sold for good.
export const shadeOf = (it) => (it?.hot ? 'hot' : it?.banned ? 'banned' : it?.shade === 'grey' ? 'grey' : null);
const pct = (it, salt, lo, span) => +(lo + (hashId(it.id + salt) % (span * 1000 + 1)) / 1000).toFixed(3);
export function dealRisk(it) {
  const kind = shadeOf(it);
  if (!kind) return 0;
  if (kind === 'banned') return it.olx === 'open' ? clamp(saleRisk(it) * 1.5 + 0.04, 0, 0.7) : saleRisk(it); // an open ad for forbidden goods draws attention
  const lo = pct(it, '|deal', 0.03, 0.02);
  if (kind === 'grey' || !markLeft(it).length) return lo;
  const x = clamp((traceOf(it) - floorOf(it)) / (95 - floorOf(it)), 0.05, 1);
  return clamp(lo + (0.35 - lo) * Math.pow(x, 0.9) * dv().crime, lo, 0.6);
}
export const dealFloor = (it) => (it?.banned ? saleFloor(it) : pct(it, '|deal', 0.03, 0.02));
export function complaintRisk(it) {
  const kind = shadeOf(it);
  if (kind === 'hot') return buyerRisk(it);
  if (kind === 'banned') return complainRisk(it);
  if (kind === 'grey') return pct(it, '|grey', 0.05, 0.02);
  return 0;
}
// what the player sees: a stolen thing sold to them as a "grey import" shows grey numbers (the truth is worse)
export function shownRisk(it) {
  if (it?.hot && !it.hot.known) return { deal: pct(it, '|deal', 0.03, 0.02), floor: pct(it, '|deal', 0.03, 0.02), complain: pct(it, '|grey', 0.05, 0.02), kind: 'grey' };
  return { deal: dealRisk(it), floor: dealFloor(it), complain: complaintRisk(it), kind: shadeOf(it) };
}
// at the moment of the deal (meeting or hand‑over to the courier); returns null or what happened
export function dealCheck(it, price) {
  const kind = shadeOf(it);
  if (!kind || Math.random() >= dealRisk(it)) return null;
  const s = G.s, cur = countryOf(s.player.city).cur;
  const val = itemValue(it, s.player.city, 'true', { clean: true });
  const fine = nicePrice(Math.max(30, val * (kind === 'grey' ? 0.3 : 0.5)), cur);
  s.hotw = (s.hotw || []).filter((x) => x.id !== it.id);
  arrest(kind === 'banned' ? 'banned' : kind === 'grey' ? 'grey' : 'stolen', { fine, mins: 180, text: itemTitle(it) });
  stat('hotCaught');
  return { caught: true, fine, kind };
}
// wiping a trace
export const markLeft = (it) => (it?.hot ? it.hot.marks.filter((k) => !it.hot.done.includes(k)) : []);
export function svcPrice(it, k) {
  const m = MARKS[k];
  const v = itemValue(it, G.s.player.city, 'true', { clean: true });
  return nicePrice(Math.max(m.min || 8, v * (m.price || 0.05)), countryOf(G.s.player.city).cur);
}
// apply a wipe: quality 0..1 (mini‑game score or service outcome)
export function wipeMark(it, k, quality = 1) {
  if (!it?.hot || !it.hot.marks.includes(k) || it.hot.done.includes(k)) return { ok: false };
  const m = MARKS[k];
  if (quality < 0.35) {
    // botched: the trace stays and now looks tampered with
    it.hot.tr = clamp(it.hot.tr + 6, 0, 99);
    emit('inv');
    return { ok: true, res: 'botched' };
  }
  it.hot.done.push(k);
  // how much of this trace goes: a clean job (≥ 90 %) all of it, a decent one 85 %, a rough one 55 %
  const share = quality >= 0.9 ? 1 : quality >= 0.7 ? 1 - RESIDUE : 0.55;
  it.hot.tr = Math.max(floorOf(it), Math.round(it.hot.tr - m.w * share));
  // the last trace wiped: what's left is the item's own floor plus whatever the sloppy jobs left behind
  if (!it.hot.marks.some((x) => !it.hot.done.includes(x))) it.hot.tr = Math.max(floorOf(it), Math.round(floorOf(it) + (it.hot.rough || 0) * 3));
  if (share < 1 && quality < 0.7) it.hot.rough = (it.hot.rough || 0) + 1;
  if (m.valueHit) it.cond = Math.max(5, Math.round(it.cond * (1 - m.valueHit)));
  if (k === 'owner') { (it.data ||= {}).wiped = true; }
  if (k === 'papers') it.docs = false;
  if (k === 'acct' && ['icloud', 'frp'].includes(it.lock)) it.lock = null;
  if (k === 'imei' && it.lock === 'blacklist') it.lock = null;
  stat('tracesWiped'); addXP(4);
  emit('inv');
  return { ok: true, res: quality >= 0.7 ? 'clean' : 'rough' };
}
// a shadow "master" does it for money: usually fine, sometimes sloppy, sometimes gone with the money
export function buyWipe(itemId, k) {
  const it = getItem(itemId);
  if (!it?.hot || MARKS[k]?.fix !== 'svc') return { ok: false };
  const price = svcPrice(it, k);
  if (!spend(price, 'service', `${L(MARKS[k].how)} · ${itemTitle(it)}`)) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  const r = Math.random();
  if (r < 0.08) { stat('scammed'); return { ok: true, res: 'scam', price }; }
  const res = wipeMark(it, k, r < 0.22 ? 0.5 : 1);
  return { ...res, price };
}

// the fence: takes any hot item now, no questions, no comeback — but pays little
export const fenceOffer = (it) => nicePrice(itemValue(it, G.s.player.city, 'true', { clean: true }) * (0.2 + 0.1 * (1 - traceOf(it) / 100)), countryOf(G.s.player.city).cur);
export function fenceSell(itemId) {
  const s = G.s, it = getItem(itemId);
  if (!it?.hot || it.listed) return { ok: false };
  const pay = fenceOffer(it);
  removeItem(it.id);
  s.hotw = (s.hotw || []).filter((x) => x.id !== it.id);
  earn(pay, 'sale', T(`Скупщик: ${itemTitle(it)}`, `Скупник: ${itemTitle(it)}`, `Fence: ${itemTitle(it)}`));
  stat('fenced'); log('dark', `${itemTitle(it)} → ${fmt(pay)}`);
  emit('inv');
  return { ok: true, pay };
}

// shadow orders: "need a phone, don't care where it's from" — they take hot items without checking
const ORDER_CATS = ['phones', 'electronics', 'consoles', 'watches', 'bags', 'sneakers', 'jewelry', 'bikes', 'cars'];
const BUYERS = ['@ghost_77', '@n1ght', '@zakaz_24', '@tihiy', '@m0nk', '@dropzone', '@sever_x', '@kot_v_mешке'.replace('ешке', 'eshke')];
export function darkOrders() {
  const s = G.s, w = Math.floor(s.t / 240);
  s.dord ||= { w: -1, list: [], done: {} };
  if (s.dord.w !== w) {
    const r = new RNG(`dord|${s.id}|${w}`);
    s.dord = { w, done: s.dord.done || {}, list: Array.from({ length: 4 }, (_, i) => ({ id: `do${w}_${i}`, cat: r.pick(ORDER_CATS), k: +r.float(0.5, 0.72).toFixed(2), who: r.pick(BUYERS), until: (w + 1) * 240 })) };
  }
  return s.dord.list.filter((o) => !s.dord.done[o.id]);
}
// they know what they're buying: a hot item is priced with its traces
export const orderPay = (o, it) => nicePrice(itemValue(it, G.s.player.city, 'true') * o.k, countryOf(G.s.player.city).cur);
export function fillOrder(orderId, itemId) {
  const s = G.s, o = darkOrders().find((x) => x.id === orderId), it = getItem(itemId);
  if (!o || !it || it.cat !== o.cat || it.listed || it.banned) return { ok: false };
  const pay = orderPay(o, it);
  removeItem(it.id);
  s.hotw = (s.hotw || []).filter((x) => x.id !== it.id);
  s.dord.done[o.id] = 1;
  earn(pay, 'sale', T(`Заказ ${o.who}`, `Замовлення ${o.who}`, `Order ${o.who}`));
  stat('darkOrders'); addXP(10);
  emit('inv');
  return { ok: true, pay };
}

// other shady services
export function recordWipePrice() { return nicePrice(160 * Math.max(0.5, countryOf(G.s.player.city).wage), countryOf(G.s.player.city).cur); }
export function wipeRecord() {
  const s = G.s, rec = s.record;
  const marks = (rec?.marks || []).filter((m) => m.until > s.t);
  if (!marks.length) return { ok: false, msg: T('Личное дело и так чистое', 'Особова справа й так чиста', 'Your record is already clean') };
  const price = recordWipePrice();
  if (!spend(price, 'service', T('«Подчистить» личное дело', '«Підчистити» особову справу', '“Clean up” the record'))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  const r = Math.random();
  if (r < 0.6) { const m = marks[marks.length - 1]; m.until = s.t; emit('jail'); return { ok: true, res: 'done' }; }
  if (r < 0.85) { stat('scammed'); return { ok: true, res: 'scam' }; }
  arrest('fraud', { text: T('Попытка дать взятку', 'Спроба дати хабар', 'Attempted bribery') });
  return { ok: true, res: 'caught' };
}
export const docsPrice = (it) => nicePrice(Math.max(10, itemValue(it, G.s.player.city, 'true') * 0.05), countryOf(G.s.player.city).cur);
export function fakeDocs(itemId) {
  const it = getItem(itemId);
  if (!it || it.docs) return { ok: false };
  if (!spend(docsPrice(it), 'service', T('Документы «под ключ»', 'Документи «під ключ»', 'Turnkey papers'))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  it.docs = true; it.box = true; it.fakeDocs = true;
  if (it.hot) it.hot.tr = Math.max(floorOf(it), it.hot.tr - 8);
  emit('inv');
  return { ok: true };
}
