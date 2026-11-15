// Selling: player listings, buyer chats & offers, shipping, payouts, returns and reviews.
import { G, emit } from '../core/state.js';
import { RNG } from '../core/rng.js';
import { T, L } from '../core/i18n.js';
import { uid, clamp, chance, rnd, pickR } from '../core/util.js';
import { countryOf, distanceKm, CITY } from '../data/world.js';
import { DEFECTS, LUXURY_CATS, CATS, MODEL } from '../data/catalog.js';
import { itemValue, itemTitle, isVehicle, defectName, fakeLabel } from './items.js';
import { nicePrice, fmt } from '../core/money.js';
import { makeBuyer, TRAITS, PH, say, fill } from './npc.js';
import { openingLines, pickQuestion, applyAnswer, line, lieTopicName } from './talk.js';
import { ME, OFFER, COUNTER, ACCEPT, DECLINE, ANGRY_LEAVE, PUSHBACK, PERSUADED, MY_PITCH, SCAMS, SCAM_LINKS, THANKS, REVIEW_GOOD, REVIEW_OK, CLAIM, CLAIM_LIE, CLAIM_FAKE } from '../data/talk_common.js';
import { DISTRICTS } from './market.js';
import { openDispute, isBanned, reportScam } from './support.js';
import { getItem, removeItem, addItem, earn, charge, spend, stat, addXP, upLevel, notify, log, repFactor, addReview, addProfit } from './player.js';
import { demand } from './economy.js';
import { leaksData, storageKind } from './files.js';
import { ymOnSale } from './shops2.js';
import { risk } from './crime.js';
import { deliveryTime } from './market.js';
import { collectionBonus } from './quests.js';
import { noteHotSale, dealCheck } from './hot.js';

export const PLATFORMS = {
  classifieds: { fee: 0, rate: 1, n: (c) => c.apps.classifieds[0], lvl: 1 },
  marketplace: { fee: 0.12, rate: 1.7, n: (c) => c.apps.marketplace[0], lvl: 3 },
  lux: { fee: 0.2, rate: 0.9, n: () => 'ReaLux', lvl: 4, bonus: 1.08, cats: [...LUXURY_CATS, 'sneakers', 'cards', 'comics', 'collectibles', 'cars'] },
};
export const myListing = (itemId) => G.s.listings.find((l) => l.itemId === itemId);
// how buyers on the classifieds price things, as a share of the market price
//  offer — the first offer;  max — the most they'll pay without being talked into more
const BUYER_K = {
  greedy: { offer: [0.6, 0.75], max: 0.86 }, polite: { offer: [0.84, 0.95], max: 0.98 }, reseller: { offer: [0.5, 0.64], max: 0.76 },
  collector: { offer: [0.88, 1.0], max: 1.08 }, newbie: { offer: [0.84, 0.96], max: 1.0 }, haggler: { offer: [0.62, 0.78], max: 0.9 },
  rich: { offer: [0.93, 1.02], max: 1.05 }, angry: { offer: [0.66, 0.8], max: 0.88 }, scammer: { offer: [1, 1.1], max: 1.2 },
};
// Charisma (0–100): grows with good haggling and sales, the "Haggling" upgrade adds to it. It lifts what buyers
// will pay (up to +15 %) and how much each argument in a haggle moves them.
export const charisma = () => clamp((G.s.charisma ?? 10) + upLevel('haggle') * 8, 0, 100);
export function addCharisma(d) { G.s.charisma = clamp((G.s.charisma ?? 10) + d, 0, 100); }

// What a buyer believes the item is worth (sees disclosed + visible problems)
export function buyerView(it, l, city) {
  const fakeDisclosed = l?.disclose && it.fake && it.fakeKnown;
  const shadow = { ...it, defects: it.defects.map((d) => ({ ...d, known: d.known && (l?.disclose || DEFECTS[d.c]?.vis === 'visible') })), fakeKnown: fakeDisclosed };
  return itemValue(shadow, city, 'known') * (1 + collectionBonus(it.cat));
}
export function listItem(itemId, platform, price, disclose = true, mask = null) {
  const s = G.s;
  const it = getItem(itemId);
  if (!it || it.shop) return false;
  if (isBanned()) return false;
  const old = myListing(itemId);
  if (old) { old.price = price; old.platform = platform; old.disclose = disclose; emit('listings'); return true; }
  s.listings.unshift({ id: uid('L'), itemId, platform, price, disclose, at: s.t, views: 0, city: s.player.city, offers: 0, ...(it.banned ? { mask } : {}) });
  it.listed = true;
  if (it.banned) it.olx = mask ? 'mask' : 'open';
  stat('listed');
  log('sell', `${itemTitle(it)} — ${fmt(price)}`);
  emit('listings');
  return true;
}
export function unlist(itemId) {
  const s = G.s;
  s.listings = s.listings.filter((l) => l.itemId !== itemId);
  const it = getItem(itemId); if (it) { it.listed = false; delete it.olx; }
  s.chats = s.chats.filter((c) => !(c.kind === 'sell' && c.itemId === itemId && c.st === 'open'));
  emit('listings');
}

// ---------------------------------------------------------------- market saturation
// A city only wants so many identical phones. Many of your ads for the same model split the buyers between
// them and make each one look less special; every recent sale of that model in the city ("everyone already
// bought one from you") lowers what the next buyer will pay. It wears off over a few days.
const floodKey = (city, m) => `${city}|${m}`;
export const floodOf = (city, m) => G.s.econ?.flood?.[floodKey(city, m)] || 0;
export function glutK(same, flood) {
  return { valK: 1 - Math.min(0.18, 0.006 * Math.max(0, same - 1)) - Math.min(0.15, 0.006 * flood), rateK: Math.pow(Math.max(1, same), -0.8) };
}
// for the sell screen: how flooded this model is in your city right now
export function glut(it, city = G.s.player.city) {
  const same = G.s.listings.filter((l) => l.city === city && l.itemId !== it.id && getItem(l.itemId)?.m === it.m).length + 1;
  const flood = floodOf(city, it.m);
  return { same, flood: Math.round(flood), ...glutK(same, flood) };
}
function addFlood(city, m) { const s = G.s; s.econ.flood ||= {}; const k = floodKey(city, m); s.econ.flood[k] = (s.econ.flood[k] || 0) + 1; }
function floodDecay() { const f = G.s.econ?.flood; if (!f) return; for (const k in f) { f[k] *= 0.972; if (f[k] < 0.3) delete f[k]; } } // about −50% a day

// ---------------------------------------------------------------- buyer generation
export function sellTick() {
  const s = G.s;
  if (s.t % 60 === 0) floodDecay();
  // how many ads each model has in each city
  const items = new Map(s.inv.map((i) => [i.id, i]));
  const count = new Map(), perCat = new Map();
  for (const l of s.listings) { const it = items.get(l.itemId); if (it) { const k = floodKey(l.city, it.m); count.set(k, (count.get(k) || 0) + 1); const kc = `${l.city}|${it.cat}`; perCat.set(kc, (perCat.get(kc) || 0) + 1); } }
  for (const l of s.listings) {
    const it = items.get(l.itemId);
    if (!it || l.frozen) continue;
    const city = s.player.city;
    const pf = PLATFORMS[l.platform] || PLATFORMS.classifieds;
    const g = glutK(count.get(floodKey(l.city, it.m)) || 1, floodOf(l.city, it.m));
    // a city has only so many buyers for one category: past ~10 of your ads they share them
    g.rateK *= Math.min(1, Math.pow(10 / (perCat.get(`${l.city}|${it.cat}`) || 1), 0.9));
    const val = buyerView(it, l, city) * g.valK * (pf.bonus || 1) * (1 + upLevel('photo') * 0.03) * (0.94 + (l.photoQ ?? 0.35) * 0.18);
    const ratio = val / Math.max(0.01, l.price);
    const attract = clamp(Math.pow(ratio, 3.2), 0.02, 4);
    const rate = (1 / 95) * (MODEL[it.m]?.liquid || 1) * (l.mask ? 0.8 : 1) * g.rateK * demand(it.cat, city) * repFactor() * (1 + upLevel('clients') * 0.22) * attract * pf.rate * (l.city === city ? 1 : 0.8) * ((G.s.boostUntil || 0) > G.s.t ? 2 : 1);
    if (chance(rate * 0.5)) l.views += 1 + Math.floor(Math.random() * 4);
    const open = s.chats.filter((c) => c.kind === 'sell' && c.itemId === it.id && c.st === 'open').length;
    if (open < 2 && chance(rate)) newBuyerChat(it, l, val);
  }
}
export function newBuyerChat(it, l, val) {
  const s = G.s;
  const rng = new RNG(`${s.id}:buyer:${it.id}:${s.t}`);
  const collectible = it.rar >= 2 || ['cards', 'comics', 'collectibles', 'antiques', 'art', 'toys', 'watches'].includes(it.cat);
  const b = makeBuyer(rng, s.player.city, { collectible, noScam: s.level < 2 });
  const tr = TRAITS[b.trait];
  // Buyers know the market: their first offer is anchored to the market price (or your price, if it is lower),
  // not to what you ask; the most they will pay is about the market price. Above it only charisma and
  // haggling get you — so buying for 30 and listing for 90 doesn't work by itself.
  const k = BUYER_K[b.trait] || BUYER_K.polite;
  const ch = charisma() / 100;
  const cap = val * k.max * (1 + 0.15 * ch);
  let offer = Math.min(l.price, val) * rng.float(k.offer[0], k.offer[1]);
  if (b.trait === 'scammer') offer = l.price * rng.float(1.0, 1.1);
  if (offer >= l.price * 0.985) offer = l.price;
  offer = nicePrice(Math.max(1, Math.min(offer, b.trait === 'scammer' ? Infinity : cap)), countryOf(s.player.city).cur);
  const maxPay = b.trait === 'scammer' ? l.price * 1.2 : Math.max(offer, Math.min(cap * rng.float(0.97, 1.03), l.price));
  const title = itemTitle(it);
  const c = { id: uid('c'), kind: 'sell', itemId: it.id, listingId: l.id, npc: b, title, offer, maxPay, ask: l.price, round: 0, patience: tr.patience + (b.trait === 'newbie' ? 1 : 0), st: 'open', msgs: [], t: s.t, unread: 1, persuaded: 0, asked: [], told: [], lies: [] };
  const region = countryOf(s.player.city);
  const ctx = { platform: (PLATFORMS[l.platform] || PLATFORMS.classifieds).n(region), district: L(rng.pick(Object.values(DISTRICTS))), city: L(CITY[s.player.city]?.name || ['', '', '']), model: MODEL_NAME(it) };
  for (const tx of openingLines(rng, b, it, l, ctx)) c.msgs.push({ f: 'them', tx, t: s.t });
  // most real buyers ask something before naming a price; scammers never do
  if (b.trait !== 'scammer' && rng.chance(b.trait === 'rich' ? 0.25 : b.trait === 'collector' || b.trait === 'newbie' ? 0.85 : 0.62)) {
    c.q = pickQuestion(rng, it, c.asked); c.asked.push(c.q.topic);
    c.msgs.push({ f: 'them', tx: c.q.tx, t: s.t });
  } else showOffer(c, rng);
  s.chats.unshift(c);
  l.offers++;
  notify('market', `${b.name} · ${T('покупатель', 'покупець', 'buyer')}`, c.msgs[c.msgs.length - 1].tx, { go: ['market', 'chat', { id: c.id }] });
  emit('chats');
}

// ---------------------------------------------------------------- player actions in a sell chat
function MODEL_NAME(it) { const t = itemTitle(it); return t.split(',')[0]; }
function showOffer(c, rng) {
  c.offerShown = true;
  if (c.offer < c.ask) c.msgs.push({ f: 'them', tx: line(rng, OFFER, { price: fmt(c.offer) }), t: G.s.t });
  else c.msgs.push({ f: 'them', tx: T(`Готов взять за ${fmt(c.offer)}.`, `Готовий взяти за ${fmt(c.offer)}.`, `Ready to buy for ${fmt(c.offer)}.`), t: G.s.t });
}
// answering the buyer's question: kind = honest | vague | lie | social
export function chatAnswer(c, kind, label) {
  const it = getItem(c.itemId);
  if (!it || !c.q) return;
  const rng = new RNG(`${c.id}:after:${c.asked.length}`);
  applyAnswer(c, it, kind, label);
  c.offer = nicePrice(Math.min(c.offer, Math.max(1, c.maxPay * 0.97)), countryOf(G.s.player.city).cur);
  if (c.patience <= 0 || c.maxPay < c.ask * 0.25) return leave(c);
  if (c.asked.length < 3 && rng.chance(c.asked.length === 1 ? 0.4 : 0.2)) {
    c.q = pickQuestion(rng, it, c.asked); c.asked.push(c.q.topic);
    c.msgs.push({ f: 'them', tx: c.q.tx, t: G.s.t });
  } else if (!c.offerShown) showOffer(c, rng);
  else c.msgs.push({ f: 'them', tx: line(rng, COUNTER, { price: fmt(c.offer) }), t: G.s.t });
  emit('chats');
}
export function chatGreet(c) {
  if (c.greeted) return;
  c.greeted = true;
  c.msgs.push({ f: 'me', tx: L(pickR(ME.hello)), t: G.s.t });
  c.maxPay *= 1.02; c.patience += 0.5;
  if (c.npc.trait === 'scammer') return scamFollowup(c);
  emit('chats');
}
export function chatPersuade(c, score) {
  // score 0..1 from the QTE
  c.persuaded++;
  const ch = charisma() / 100;
  const bump = score >= 0.95 ? 0.035 + 0.045 * ch : score >= 0.6 ? 0.02 + 0.025 * ch : -0.02;
  c.maxPay = Math.min(c.maxPay * (1 + bump), c.ask);
  addCharisma(bump > 0 ? (score >= 0.95 ? 1.5 : 0.7) : -0.6);
  if (bump > 0) c.offer = nicePrice(Math.min(c.maxPay, c.offer * (1 + bump * 0.8)), countryOf(G.s.player.city).cur);
  c.msgs.push({ f: 'me', tx: L(pickR(MY_PITCH)), t: G.s.t });
  if (bump > 0) c.msgs.push({ f: 'them', tx: fill(L(pickR(PERSUADED)), { price: fmt(c.offer) }), t: G.s.t });
  else { c.patience -= 1; c.msgs.push({ f: 'them', tx: L(pickR(PUSHBACK)), t: G.s.t }); }
  if (c.patience <= 0) leave(c);
  emit('chats');
}
export function chatCounter(c, price) {
  const s = G.s;
  const rng = new RNG(c.id + ':ctr:' + c.round);
  c.round++;
  c.msgs.push({ f: 'me', tx: fill(L(rng.pick(ME.counter)), { price: fmt(price) }), t: s.t });
  if (c.npc.trait === 'scammer') return scamFollowup(c);
  if (price <= c.maxPay) {
    c.offer = price;
    c.msgs.push({ f: 'them', tx: L(rng.pick(ACCEPT)), t: s.t });
    c.st = 'agreed';
    maybeRealLink(c);
  } else {
    c.patience -= 1;
    if (c.patience <= 0) return leave(c);
    const mid = nicePrice(Math.min(c.maxPay, (c.offer + price) / 2 + (c.maxPay - c.offer) * 0.3), countryOf(s.player.city).cur);
    if (mid > c.offer) c.offer = mid;
    c.msgs.push({ f: 'them', tx: line(rng, COUNTER, { price: fmt(c.offer) }), t: s.t });
  }
  emit('chats');
}
export function chatAccept(c) {
  c.msgs.push({ f: 'me', tx: T(`Согласен, продам за ${fmt(c.offer)}`, `Згоден, продам за ${fmt(c.offer)}`, `Deal, ${fmt(c.offer)} it is`), t: G.s.t });
  if (c.npc.trait === 'scammer') return scamFollowup(c);
  c.st = 'agreed';
  maybeRealLink(c);
  emit('chats');
}
export function chatDecline(c) {
  c.msgs.push({ f: 'me', tx: T('Нет, спасибо', 'Ні, дякую', 'No, thanks'), t: G.s.t });
  c.st = 'closed';
  emit('chats');
}
function leave(c) {
  c.msgs.push({ f: 'them', tx: L(pickR(c.npc.trait === 'angry' ? ANGRY_LEAVE : DECLINE)), t: G.s.t });
  c.st = 'closed';
  emit('chats');
}
// ---------------------------------------------------------------- links in the chat
// Buyers send links: almost always phishing, but now and then an honest buyer really sends the platform's own
// "safe deal" page. The only way to tell is the address: the real one is exactly <official domain>/… — fakes add
// words, swap letters, hang the real name on another site (oliks.ua.pay-safe.top) or change the zone.
const SITE = { RU: 'aviton.ru', UA: 'oliks.ua', BY: 'kufer.by', KZ: 'olix.kz', PL: 'olix.pl', DE: 'kleinboerse.de', FR: 'lebondeal.fr', IT: 'subitto.it', GB: 'gumbranch.co.uk', US: 'craigboard.com', JP: 'merkaru.jp', CN: 'xianyou.cn', AE: 'dubizzy.ae', TR: 'sahibim.com.tr', GE: 'mybazar.ge', TH: 'kaidii.co.th' };
export const officialSite = (cityId = G.s.player.city) => SITE[countryOf(cityId).id] || 'oliks.ua';
const SAFE_PATHS = ['safe', 'delivery', 'deal', 'pay'];
export function realLink(rng) { return `${officialSite()}/${rng.pick(SAFE_PATHS)}/${rng.int(1000000, 9999999)}`; }
export function fakeLink(rng) {
  const site = officialSite(), dot = site.indexOf('.'), name = site.slice(0, dot), zone = site.slice(dot + 1);
  const path = `${rng.pick(SAFE_PATHS)}/${rng.int(1000000, 9999999)}`;
  if (rng.chance(0.25)) return rng.pick(SCAM_LINKS);
  const swap = (w) => { const m = [['o', '0'], ['l', 'I'], ['i', 'l'], ['a', '@'], ['e', '3'], ['s', 'ss'], ['k', 'kk'], ['r', 'rr'], ['m', 'rn']].filter(([a]) => w.includes(a)); if (!m.length) return w + w.slice(-1); const [a, b] = rng.pick(m); return w.replace(a, b); };
  const bad = rng.pick(['top', 'site', 'online', 'icu', 'click', 'link', 'shop', 'xyz', 'info', 'pro']);
  const word = rng.pick(['pay', 'safe', 'delivery', 'dostavka', 'secure', 'verify', 'confirm', 'help', 'money']);
  return rng.pick([
    () => `${site}.${word}-${rng.pick(['deal', 'pay', 'check', 'form'])}.${bad}/${path}`, // the real name hung on someone else's site
    () => `${name}-${zone.replace(/\./g, '-')}.${bad}/${path}`,
    () => `${name}-${word}.${zone}/${path}`,
    () => `${word}-${name}.${zone}/${path}`,
    () => `${swap(name)}.${zone}/${path}`,
    () => `${name}.${zone === 'com' ? 'net' : 'com'}/${path}`,
    () => `${name}.${zone}-${word}.${bad}/${path}`,
    () => `${name}${rng.pick(['24', '-ua', '-pay', 'pay', '-online'])}.${zone}/${path}`,
  ])();
}
function scamFollowup(c) {
  const rng = new RNG(c.id + ':scam:' + Math.random());
  // most scammers send a link now; the rest ask for a code, show a fake screenshot or "overpay"
  const sc = rng.chance(0.62) ? rng.pick(SCAMS.filter((x) => x.k === 'link')) : rng.pick(SCAMS.filter((x) => x.k !== 'link'));
  const link = sc.k === 'link' ? fakeLink(rng) : '';
  c.scam = link || sc.k; c.scamKind = sc.k;
  c.st = sc.k === 'link' ? 'link' : 'scam';
  if (link) c.link = link;
  c.msgs.push({ f: 'them', tx: fill(L(sc.tx), { link, extra: fmt(Math.max(10, c.offer * 0.3)) }), t: G.s.t, link: link || undefined });
  emit('chats');
}
// an honest buyer who agreed sometimes pays through the platform and sends the real "safe deal" page
const REAL_LINK_P = 0.012;
function maybeRealLink(c) {
  const it = getItem(c.itemId);
  if (!it || c.npc.trait === 'scammer' || c.linkTried) return false;
  c.linkTried = true;
  if (Math.random() >= REAL_LINK_P) return false;
  const rng = new RNG(c.id + ':real:' + Math.random());
  const link = realLink(rng);
  const sc = rng.pick(SCAMS.filter((x) => x.real));
  c.st = 'link'; c.link = link; c.linkReal = true; c.scamKind = 'link';
  c.msgs.push({ f: 'them', tx: fill(L(sc.tx), { link }), t: G.s.t, link });
  return true;
}
// you open the link: the real page confirms the deal (paid through the platform, no fake claims); a fake one
// takes money off your card
export function linkOpen(c) {
  if (!c.linkReal) return { real: false, loss: scamClick(c) };
  c.safeDeal = true; c.st = 'agreed';
  c.msgs.push({ f: 'sys', tx: T(`✅ Открылась страница ${officialSite()}: «Безопасная сделка» настоящая, деньги покупателя заморожены у площадки. Можно отправлять — оплата придёт после получения, а спор без причины покупатель открыть не сможет.`, `✅ Відкрилася сторінка ${officialSite()}: «Безпечна угода» справжня, гроші покупця заморожені в майданчика. Можна відправляти — оплата прийде після отримання, а спір без причини покупець відкрити не зможе.`, `✅ ${officialSite()} opened: the safe deal is real, the buyer’s money is held by the platform. Ship it — you’re paid on delivery, and the buyer can’t open a dispute for nothing.`), t: G.s.t });
  stat('realLinks');
  emit('chats');
  return { real: true };
}
// "it's a scam": right — support bans them (bonus later); wrong — the honest buyer is offended and leaves
export function linkReport(c) {
  if (!c.linkReal) return scamReport(c), { real: false };
  c.msgs.push({ f: 'me', tx: T('Это развод. Пожаловался в поддержку.', 'Це розвод. Поскаржився в підтримку.', 'That’s a scam. Reported.'), t: G.s.t });
  c.msgs.push({ f: 'them', tx: T(`Какой развод?! Это обычная доставка ${PLATFORMS.classifieds.n(countryOf(G.s.player.city))}, посмотрите адрес. Всё, передумал.`, `Який розвод?! Це звичайна доставка ${PLATFORMS.classifieds.n(countryOf(G.s.player.city))}, подивіться адресу. Все, передумав.`, `What scam?! It’s the platform’s normal delivery — look at the address. Forget it.`), t: G.s.t });
  c.msgs.push({ f: 'sys', tx: T(`Поддержка: ссылка официальная (${officialSite()}), жалоба отклонена.`, `Підтримка: посилання офіційне (${officialSite()}), скаргу відхилено.`, `Support: the link is official (${officialSite()}), report rejected.`), t: G.s.t });
  c.st = 'closed';
  emit('chats');
  return { real: true };
}
// don't open it, ask for the usual delivery: an honest buyer shrugs and goes on, a scammer vanishes
export function linkIgnore(c) {
  c.msgs.push({ f: 'me', tx: T('По ссылкам не перехожу. Давайте обычной отправкой или встретимся.', 'За посиланнями не переходжу. Давайте звичайною відправкою або зустрінемось.', 'I don’t open links. Let’s do normal shipping or meet up.'), t: G.s.t });
  if (c.linkReal) {
    c.msgs.push({ f: 'them', tx: T('Ну ладно, как скажете. Давайте обычно.', 'Ну гаразд, як скажете. Давайте звичайно.', 'Fine, have it your way. The usual way then.'), t: G.s.t });
    c.st = 'agreed';
  } else {
    c.msgs.push({ f: 'sys', tx: T('Покупатель перестал отвечать и удалил аккаунт.', 'Покупець перестав відповідати й видалив акаунт.', 'The buyer went quiet and deleted the account.'), t: G.s.t });
    c.st = 'closed'; stat('scamsDodged');
  }
  emit('chats');
}
export function scamClick(c) {
  const s = G.s;
  if (c.scamKind === 'shot') {
    // trusted a fake payment screenshot and shipped: the item is gone, no money comes
    const it = getItem(c.itemId);
    if (it) { unlist(it.id); removeItem(it.id); }
    c.msgs.push({ f: 'sys', tx: T('⚠ Посылка ушла, а денег нет: скрин оплаты был фейковым.', '⚠ Посилка пішла, а грошей немає: скрін оплати був фейковим.', '⚠ Parcel gone, no money: the payment screenshot was fake.'), t: s.t });
    c.st = 'closed'; stat('scammed'); emit('chats'); emit('inv');
    return it ? (it.paid || 0) : 0;
  }
  const loss = Math.min(Math.max(0, s.money), Math.max(20, c.offer * (c.scamKind === 'over' ? 0.3 : 0.6)));
  charge(loss, 'scam', T('Мошенники', 'Шахраї', 'Scammers'));
  c.msgs.push({ f: 'sys', tx: c.scamKind === 'code' ? T(`⚠ По вашему коду с карты списано ${fmt(loss)}.`, `⚠ За вашим кодом з картки списано ${fmt(loss)}.`, `⚠ Using your code, ${fmt(loss)} was taken from your card.`) : c.scamKind === 'over' ? T(`⚠ «Лишние» деньги так и не пришли. Вы потеряли ${fmt(loss)}.`, `⚠ «Зайві» гроші так і не прийшли. Ви втратили ${fmt(loss)}.`, `⚠ The “extra” money never arrived. You lost ${fmt(loss)}.`) : T(`⚠ С карты списано ${fmt(loss)}. Это был фишинг.`, `⚠ З картки списано ${fmt(loss)}. Це був фішинг.`, `⚠ ${fmt(loss)} stolen from your card. Phishing!`), t: s.t });
  c.st = 'closed';
  stat('scammed');
  emit('chats');
  return loss;
}
export function scamReport(c) {
  c.msgs.push({ f: 'me', tx: T('Это развод. Пожаловался в поддержку.', 'Це розвод. Поскаржився в підтримку.', 'That’s a scam. Reported.'), t: G.s.t });
  c.msgs.push({ f: 'sys', tx: T('Жалоба передана в поддержку.', 'Скаргу передано до підтримки.', 'Report sent to support.'), t: G.s.t });
  c.st = 'closed';
  reportScam(c);
  emit('chats');
}

// ---------------------------------------------------------------- closing the sale
// mode: 'ship' | 'meet'; packed: 0..1 quality of packing minigame
export function completeSale(c, mode = 'ship', packed = 0.5) {
  const s = G.s;
  const it = getItem(c.itemId);
  if (!it) { c.st = 'closed'; return false; }
  const l = s.listings.find((x) => x.itemId === it.id);
  const pf = PLATFORMS[l?.platform] || PLATFORMS.classifieds;
  const price = c.offer;
  const fee = price * pf.fee;
  const payout = price - fee;
  const disclose = l ? l.disclose : true;
  // a thing from the Shade: the police may be on to it right at the deal (meeting / courier hand‑over)
  const bust = dealCheck(it, price);
  if (bust) {
    unlist(it.id); removeItem(it.id);
    c.st = 'closed';
    c.msgs.push({ f: 'sys', tx: mode === 'meet' ? T(`🚔 На встречу вместо покупателя пришли оперативники. Вещь изъята, штраф ${fmt(bust.fine)}.`, `🚔 На зустріч замість покупця прийшли оперативники. Річ вилучено, штраф ${fmt(bust.fine)}.`, `🚔 Plain‑clothes police came instead of the buyer. Seized, fine ${fmt(bust.fine)}.`) : T(`🚔 Посылку задержали при отправке — вещь числится в базе. Изъята, штраф ${fmt(bust.fine)}.`, `🚔 Посилку затримали під час відправлення — річ числиться в базі. Вилучено, штраф ${fmt(bust.fine)}.`, `🚔 The parcel was stopped at drop‑off — the item is in the database. Seized, fine ${fmt(bust.fine)}.`), t: s.t });
    for (const o of s.chats) if (o !== c && o.kind === 'sell' && o.itemId === it.id && o.st === 'open') o.st = 'closed';
    emit('chats'); emit('inv');
    return 'busted';
  }
  unlist(it.id);
  removeItem(it.id);
  addFlood(s.player.city, it.m);
  if (it.split && G.s.t - (it.at || 0) < 2880) ymOnSale(it);
  c.st = 'deal';
  const city = s.player.city;
  // which hidden issues the buyer might discover
  const told = new Set(c.told || []);
  const lied = new Set((c.lies || []).flatMap((x) => x.codes));
  const undisclosed = it.defects.filter((d) => !(d.known && disclose) && !told.has(d.c) && DEFECTS[d.c]?.vis !== 'visible');
  let claimP = 1;
  // a defect you lied about in the chat is the first thing the buyer checks
  for (const d of undisclosed) claimP *= 1 - Math.min(0.92, (DEFECTS[d.c]?.sev || 0.1) * (lied.has(d.c) ? 5 : 2.6));
  claimP = 1 - claimP;
  let fakeClaim = 0;
  if (it.fake && !(disclose && it.fakeKnown) && !told.has('fake')) fakeClaim = lied.has('fake') ? 0.95 : it.fake === 2 ? 0.45 : 0.85;
  if (it.lock && !disclose) claimP = Math.max(claimP, 0.9);
  // some buyers try to get money back for nothing
  const bogus = !c.safeDeal && !claimP && !fakeClaim && ['angry', 'greedy', 'scammer'].includes(c.npc.trait) ? 0.1 : 0;
  const sale = { id: uid('S'), itemSnap: it, title: itemTitle(it), price, fee, payout, paid: it.paid || 0, buyer: c.npc, claimP, fakeClaim, bogus, chatId: c.id, packed, lies: c.lies || [], told: [...told], trust: c.trust || 0, at: s.t };
  if (mode === 'meet' && (it.loc || city) === city) {
    finishSale(sale, true);
    c.msgs.push({ f: 'sys', tx: T(`Встретились лично. Получено ${fmt(payout)}.`, `Зустрілися особисто. Отримано ${fmt(payout)}.`, `Met in person. Received ${fmt(payout)}.`), t: s.t });
  } else {
    const from = it.loc || city;
    const eta = s.t + deliveryTime(from, city, isVehicle(it));
    s.deliveries.push({ id: uid('d'), kind: 'out', sale, from, to: city, start: s.t, eta, who: c.npc.name, title: sale.title, item: it });
    c.msgs.push({ f: 'sys', tx: T('Посылка отправлена. Деньги придут после получения.', 'Посилку відправлено. Гроші прийдуть після отримання.', 'Parcel shipped. You’ll be paid on delivery.'), t: s.t });
  }
  // close other chats for this item
  for (const o of s.chats) if (o !== c && o.kind === 'sell' && o.itemId === it.id && o.st === 'open') { o.st = 'closed'; o.msgs.push({ f: 'sys', tx: T('Товар продан другому покупателю', 'Товар продано іншому покупцю', 'Sold to someone else'), t: s.t }); }
  emit('chats'); emit('inv');
  return true;
}
export function finishSale(sale, instant = false) {
  const s = G.s;
  earn(sale.payout, 'sale', sale.title);
  addCharisma(0.3);
  // the deal is closed now: from here the buyer has 3–7 minutes to complain about a Shade item
  noteHotSale(sale.itemSnap, sale.price);
  const profit = sale.payout - sale.paid;
  addProfit(profit);
  stat('sold'); stat('revenue', sale.payout); stat('profit', profit);
  if (profit > (s.stats.bestFlip || 0)) s.stats.bestFlip = profit;
  addXP(10 + Math.max(0, profit) / 15);
  log('sold', `${sale.title} +${fmt(profit)}`);
  // after some time: review or claim
  s.pendingFeedback ||= [];
  const claim = chance(sale.fakeClaim) ? 'fake' : chance(sale.claimP) ? 'defect' : chance(sale.bogus || 0) ? 'bogus' : null;
  s.pendingFeedback.push({ sale, at: s.t + 40 + Math.floor(Math.random() * 120), claim });
  notify('bank', T('Оплата получена', 'Оплату отримано', 'Payment received'), `${sale.title}: ${fmt(sale.payout)} (${profit >= 0 ? '+' : ''}${fmt(profit)})`);
  emit('money');
}
export function feedbackTick() {
  const s = G.s;
  if (!s.pendingFeedback?.length) return;
  const due = s.pendingFeedback.filter((f) => f.at <= s.t);
  if (!due.length) return;
  s.pendingFeedback = s.pendingFeedback.filter((f) => f.at > s.t);
  for (const f of due) {
    const sale = f.sale;
    if (!f.claim && leaksData(sale.itemSnap) && chance(0.45)) {
      const kind = storageKind(sale.itemSnap);
      const where = ['phone', 'tablet'].includes(kind) ? T('в телефоне', 'в телефоні', 'on the phone') : kind === 'laptop' ? T('на ноутбуке', 'на ноутбуці', 'on the laptop') : kind === 'console' ? T('на приставке', 'на приставці', 'on the console') : T('на носителе', 'на носії', 'on the drive');
      addReview(2, T(`Нашёл ${where} чужие фото и документы — продавец даже не стёр. Неприятно.`, `Знайшов ${where} чужі фото й документи — продавець навіть не стер. Неприємно.`, `Found someone’s photos and documents ${where} — the seller didn’t even wipe it.`), { buyer: sale.buyer.name, fair: true });
      notify('market', T('Отзыв: чужие данные', 'Відгук: чужі дані', 'Review: leftover data'), `★★ ${sale.buyer.name}`);
      if (chance(0.12)) { const fine = Math.round(25 + Math.random() * 60); charge(fine, 'fine', T('Штраф за утечку персональных данных', 'Штраф за витік персональних даних', 'Fine for leaking personal data')); notify('gov', T('Штраф', 'Штраф', 'Fine'), T(`Утечка персональных данных: ${fmt(fine)}`, `Витік персональних даних: ${fmt(fine)}`, `Personal data leak: ${fmt(fine)}`)); }
      continue;
    }
    if (!f.claim) {
      const stars = sale.packed > 0.7 || (sale.trust || 0) > 0 ? 5 : chance(0.7) ? 5 : 4;
      addReview(stars, L(pickR(stars === 5 ? [...THANKS, ...REVIEW_GOOD] : REVIEW_OK)), { buyer: sale.buyer.name, fair: true });
      notify('market', T('Новый отзыв', 'Новий відгук', 'New review'), `${'★'.repeat(stars)} ${sale.buyer.name}`);
      continue;
    }
    const it = sale.itemSnap;
    const told = new Set(sale.told || []);
    const lie = (sale.lies || []).find((x) => x.codes.some((code) => code === 'fake' ? it.fake : it.defects.some((d) => d.c === code)));
    const hidden = it.defects.filter((d) => !told.has(d.c) && DEFECTS[d.c]?.vis !== 'visible');
    const d = lie && lie.codes[0] !== 'fake' ? it.defects.find((x) => lie.codes.includes(x.c)) : hidden.sort((a, b) => (DEFECTS[b.c]?.sev || 0) - (DEFECTS[a.c]?.sev || 0))[0];
    let defect = d ? defectName(d.c).toLowerCase() : T('скрытый дефект', 'прихований дефект', 'hidden defect');
    if (f.claim === 'bogus') defect = pickR([T('царапина, которой не было на фото', 'подряпина, якої не було на фото', 'a scratch that wasn’t in the photos'), T('не тот цвет', 'не той колір', 'wrong colour'), T('всё плохо, верните деньги', 'усе погано, поверніть гроші', 'it’s just bad, refund me')]);
    const tx = f.claim === 'fake' ? L(pickR(CLAIM_FAKE)) : lie ? fill(L(pickR(CLAIM_LIE)), { topic: lieTopicName(lie.topic), defect }) : fill(L(pickR(CLAIM)), { defect });
    const c = { id: uid('c'), kind: 'claim', npc: sale.buyer, title: sale.title, sale, claim: f.claim, lie: !!lie, msgs: [{ f: 'them', tx, t: s.t }], st: 'claim', t: s.t, unread: 1 };
    if (f.claim === 'fake' && !(sale.told || []).includes('fake') && risk('fake', 0.22, { fine: sale.price * 0.3, text: sale.title, salt: sale.id })) c.msgs.push({ f: 'sys', tx: T('Покупатель написал заявление в полицию.', 'Покупець написав заяву в поліцію.', 'The buyer went to the police.'), t: s.t });
    else if (lie && risk('fraud', 0.1, { fine: sale.price * 0.2, text: sale.title, salt: sale.id })) c.msgs.push({ f: 'sys', tx: T('Покупатель написал заявление в полицию.', 'Покупець написав заяву в поліцію.', 'The buyer went to the police.'), t: s.t });
    s.chats.unshift(c);
    notify('market', T('Претензия покупателя', 'Претензія покупця', 'Buyer complaint'), tx, { go: ['market', 'chat', { id: c.id }] });
  }
  emit('chats');
}
// resolve: 'refund' | 'partial' | 'refuse'
export function resolveClaim(c, how) {
  const s = G.s;
  const sale = c.sale;
  if (how === 'refund') {
    charge(sale.payout, 'refund', sale.title);
    const it = sale.itemSnap; it.listed = false; it.paid = sale.paid;
    // item is shipped back
    s.deliveries.push({ id: uid('d'), kind: 'in', item: it, from: s.player.city, to: s.player.city, start: s.t, eta: s.t + 120, price: 0, who: c.npc.name, ret: true });
    addReview(3, T('Вернул деньги, но осадок остался.', 'Повернув гроші, але осад лишився.', 'Refunded, but not great.'));
    c.msgs.push({ f: 'me', tx: T('Хорошо, верну деньги — отправьте вещь обратно.', 'Добре, поверну гроші — надішліть річ назад.', 'OK, I’ll refund — send it back.'), t: s.t });
  } else if (how === 'partial') {
    const amt = sale.payout * (c.claim === 'fake' ? 0.5 : 0.25);
    charge(amt, 'refund', sale.title);
    addReview(c.claim === 'fake' ? 2 : 4, T('Продавец компенсировал часть стоимости.', 'Продавець компенсував частину вартості.', 'Seller compensated part of the price.'));
    c.msgs.push({ f: 'me', tx: T(`Предлагаю компенсацию ${fmt(amt)}.`, `Пропоную компенсацію ${fmt(amt)}.`, `I can compensate ${fmt(amt)}.`), t: s.t });
  } else {
    c.msgs.push({ f: 'me', tx: c.claim === 'bogus' ? T('Вещь была в порядке, это видно на фото. Возврата не будет.', 'Річ була в порядку, це видно на фото. Повернення не буде.', 'The item was fine, the photos show it. No refund.') : T('Претензии не принимаются.', 'Претензії не приймаються.', 'No refunds.'), t: s.t });
    c.msgs.push({ f: 'them', tx: T('Тогда открываю спор в поддержке.', 'Тоді відкриваю спір у підтримці.', 'Then I’m opening a dispute with support.'), t: s.t });
    openDispute(c);
  }
  c.st = 'closed';
  emit('chats');
}

// Instant sale to a pawn shop
export function pawnSell(itemId) {
  const it = getItem(itemId);
  if (!it) return 0;
  const v = itemValue(it, G.s.player.city, 'known') * 0.48 * (it.fake && !it.fakeKnown ? 0.15 : 1);
  unlist(itemId);
  noteHotSale(it, v);
  removeItem(itemId);
  earn(v, 'sale', itemTitle(it));
  addProfit(v - (it.paid || 0));
  stat('sold'); stat('pawned');
  addXP(3);
  return v;
}
