// Venues: kiosks, coffee shops, bars, shawarma places, car services, car washes.
// You rent a spot, get a permit, buy equipment, furniture and supplies from the Supplier, hire staff and set the
// menu. Every hour customers come (more in a good spot, with a good rating and fair prices); each order uses up
// the exact supplies of its recipe and wears the equipment it needs. Food goes off (FIFO batches with expiry,
// faster without a working fridge), machines need regular service (descaling, filter cartridges, fryer oil, beer
// lines…) or they break, and the sanitary and fire inspectors drop by.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { uid, clamp } from '../core/util.js';
import { fmt, nicePrice } from '../core/money.js';
import { CITY, countryOf } from '../data/world.js';
import { earn, spend, charge, notify, stat, addXP } from './player.js';
import { npcName } from './npc.js';
import { VENUES, SKUS, EQUIP, SERVICES, SPOTS } from '../data/venues.js';

const DAY = 1440;
export const vstate = () => { const s = G.s; s.venues ||= []; s.vorders ||= []; return s.venues; };
export const venueById = (id) => vstate().find((v) => v.id === id);
export const unlocks = () => (G.s.unlocks ||= { recipes: [], obd: false, supplierUntil: 0 });
export const canOpenVenue = () => ['ip', 'company'].includes(G.s.tax?.regime);
const cityK = (city) => countryOf(city).rent * (CITY[city]?.idx || 1);
export const rentPerDay = (type, spot, city = G.s.player.city) => VENUES[type].rent * (SPOTS.find((x) => x.id === spot)?.rent || 1) * cityK(city);
export const wageOf = (v) => VENUES[v.type].staff.wage * Math.max(0.4, countryOf(v.city).wage);
export const permitFee = (type, city = G.s.player.city) => VENUES[type].permit * Math.max(0.5, countryOf(city).price);
export const openCost = (type, spot, city) => rentPerDay(type, spot, city) * 7 + permitFee(type, city);

// ---------------------------------------------------------------- opening / closing
export function openVenue(type, spot) {
  const s = G.s, def = VENUES[type];
  if (!def) return { ok: false };
  if (!canOpenVenue()) return { ok: false, msg: T('Сначала оформите ИП / ФОП или компанию в «Госуслугах»', 'Спочатку оформіть ФОП або компанію в «Держпослугах»', 'Register as self‑employed or a company first (Gov app)') };
  const cost = openCost(type, spot);
  if (!spend(cost, 'biz', T(`Открытие: ${L(def.n)}`, `Відкриття: ${L(def.n)}`, `Opening: ${L(def.n)}`))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  const v = { id: uid('vn'), type, spot, city: s.player.city, name: `${L(def.n)} «${(s.biz?.name || s.player.name || 'Мой').slice(0, 18)}»`, permitAt: s.t + DAY, eq: [], stock: [], prices: {}, off: {}, staff: [], clean: 100, rating: 3.5, closedUntil: 0, pestUntil: 0, wasteUntil: 0, oilUntil: 0, open: true, log: [], day: { rev: 0, n: 0, lost: 0, cost: 0 }, hist: [], nextSES: s.t + DAY * new RNG(uid('ses')).int(4, 8), nextFire: s.t + DAY * new RNG(uid('fire')).int(6, 12), opened: s.t, rentPaid: s.t + 7 * DAY };
  vstate().push(v); stat('venuesOpened'); addXP(40);
  vlog(v, T(`Аренда на 7 дней и разрешение (будет через сутки): ${fmt(cost)}`, `Оренда на 7 днів і дозвіл (буде за добу): ${fmt(cost)}`, `7 days' rent and the permit (ready in a day): ${fmt(cost)}`));
  emit('biz');
  return { ok: true, v };
}
export function closeVenue(id) {
  const s = G.s, v = venueById(id); if (!v) return 0;
  // equipment sold off at 35 %
  const back = v.eq.reduce((a, e) => a + (EQUIP[e.id]?.price || 0) * 0.35 * (e.broken ? 0.4 : e.cond / 100), 0);
  if (back > 0) earn(back, 'sale', T(`Продажа оборудования: ${v.name}`, `Продаж обладнання: ${v.name}`, `Equipment sold: ${v.name}`));
  s.venues = s.venues.filter((x) => x !== v);
  s.vorders = s.vorders.filter((o) => o.venue !== id);
  emit('biz');
  return back;
}
function vlog(v, tx) { v.log.unshift({ t: G.s.t, tx }); v.log.length = Math.min(v.log.length, 40); }

// ---------------------------------------------------------------- equipment
export const eqCount = (v, id) => v.eq.filter((e) => e.id === id && !e.broken && (!e.exp || e.exp > G.s.t)).length;
export const hasEq = (v, id) => eqCount(v, id) > 0;
export const svcDue = (e) => { const d = EQUIP[e.id]?.svc; return d ? Math.max(0, e.svcAt + d.every * DAY - G.s.t) : Infinity; };
export const svcOverdue = (e) => svcDue(e) === 0;
export function installEq(v, id) { v.eq.push({ id, uid: uid('eq'), cond: 100, broken: false, svcAt: G.s.t, exp: EQUIP[id]?.expire ? G.s.t + EQUIP[id].expire * DAY : 0 }); }
export function serviceEq(v, eqUid) {
  const e = v.eq.find((x) => x.uid === eqUid); const d = EQUIP[e?.id]?.svc; if (!e || !d) return { ok: false };
  if (d.sku) { if (!take(v, { [d.sku]: 1 })) return { ok: false, msg: T(`Нет на складе: ${L(SKUS[d.sku].n)}`, `Немає на складі: ${L(SKUS[d.sku].n)}`, `Out of stock: ${L(SKUS[d.sku].n)}`), need: d.sku }; }
  else if (!spend(d.cost * Math.max(0.5, countryOf(v.city).price), 'biz', `${L(d.n)}: ${v.name}`)) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  e.svcAt = G.s.t; e.cond = Math.min(100, e.cond + 30);
  vlog(v, `🛠 ${L(d.n)} — ${L(EQUIP[e.id].n)}`);
  emit('biz');
  return { ok: true };
}
export const repairCost = (e) => SERVICES.repair.price + (EQUIP[e.id]?.price || 0) * 0.08;
export function repairEq(v, eqUid) {
  const e = v.eq.find((x) => x.uid === eqUid); if (!e?.broken) return { ok: false };
  if (!spend(repairCost(e) * Math.max(0.5, countryOf(v.city).price), 'biz', T(`Ремонт: ${L(EQUIP[e.id].n)}`, `Ремонт: ${L(EQUIP[e.id].n)}`, `Repair: ${L(EQUIP[e.id].n)}`))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  e.broken = false; e.cond = Math.max(e.cond, 65); e.svcAt = G.s.t;
  vlog(v, `🔧 ${T('Отремонтировано', 'Відремонтовано', 'Repaired')}: ${L(EQUIP[e.id].n)}`);
  emit('biz');
  return { ok: true };
}

// ---------------------------------------------------------------- stock (FIFO batches with expiry)
export function addStock(v, sku, packs) {
  const d = SKUS[sku]; if (!d) return;
  v.stock.push({ sku, q: packs, exp: d.life ? G.s.t + d.life * DAY : 0 });
}
export const stockOf = (v, sku) => v.stock.filter((b) => b.sku === sku).reduce((a, b) => a + b.q, 0);
export const expiredOf = (v) => v.stock.filter((b) => b.exp && b.exp <= G.s.t && b.q > 1e-6);
export const soonOf = (v) => v.stock.filter((b) => b.exp && b.exp > G.s.t && b.exp - G.s.t < DAY && b.q > 1e-6);
// take the shares of packs a recipe needs; false (and nothing taken) when anything is short. Sets take.stale
// when some of it came from an expired batch (the staff just grab the oldest pack on the shelf).
export function take(v, uses) {
  for (const [sku, q] of Object.entries(uses)) if (stockOf(v, sku) + 1e-9 < q) { take.short = sku; return false; }
  take.stale = false;
  for (const [sku, q0] of Object.entries(uses)) {
    let q = q0;
    for (const b of v.stock.filter((x) => x.sku === sku).sort((a, b) => (a.exp || 1e15) - (b.exp || 1e15))) {
      if (q <= 0) break;
      const n = Math.min(b.q, q); b.q -= n; q -= n;
      if (b.exp && b.exp <= G.s.t && n > 0) take.stale = true;
    }
  }
  v.stock = v.stock.filter((b) => b.q > 1e-6);
  return true;
}
export function writeOff(v) {
  const ex = expiredOf(v); if (!ex.length) return 0;
  const lost = ex.reduce((a, b) => a + b.q * (SKUS[b.sku]?.price || 0), 0);
  v.stock = v.stock.filter((b) => !(b.exp && b.exp <= G.s.t));
  vlog(v, T(`Списана просрочка на ${fmt(lost)}`, `Списано прострочку на ${fmt(lost)}`, `Expired stock written off: ${fmt(lost)}`));
  emit('biz');
  return lost;
}

// ---------------------------------------------------------------- staff
export function hireStaff(v) {
  const r = new RNG(uid('st'));
  const { name } = npcName(r, v.city);
  // a spare health certificate bought earlier goes to the new hire
  const med = v.medSpare > 0 ? (v.medSpare--, G.s.t + 365 * DAY) : 0;
  v.staff.push({ id: uid('sf'), name, since: G.s.t, medUntil: med, skill: r.float(0.85, 1.15) });
  vlog(v, `👋 ${T('Нанят', 'Найнято', 'Hired')}: ${name}`);
  emit('biz');
}
export function fireStaff(v, id) { v.staff = v.staff.filter((x) => x.id !== id); emit('biz'); }

// ---------------------------------------------------------------- menu
export const itemUnlocked = (v, it) => !it.unlock || (it.unlock === 'obd' ? unlocks().obd : unlocks().recipes.includes(it.unlock));
export const priceOf = (v, it) => v.prices[it.id] ?? nicePrice(it.price * Math.max(0.5, countryOf(v.city).price), countryOf(v.city).cur);
export const stdPrice = (v, it) => it.price * Math.max(0.5, countryOf(v.city).price);
export function whyNot(v, it) {
  if (!itemUnlocked(v, it)) return 'locked';
  for (const e of it.eq) if (!hasEq(v, e)) return 'eq:' + e;
  for (const [sku, q] of Object.entries(it.uses)) if (stockOf(v, sku) + 1e-9 < q) return 'sku:' + sku;
  return null;
}

// ---------------------------------------------------------------- what's wrong (shown on the venue page)
const isOpenHour = (def, h) => (def.open[0] < def.open[1] ? h >= def.open[0] && h < def.open[1] : h >= def.open[0] || h < def.open[1] % 24);
export function problems(v) {
  const s = G.s, def = VENUES[v.type], out = [];
  if (v.permitAt > s.t) out.push({ k: 'permit', sev: 2 });
  for (const id of def.need) if (!hasEq(v, id)) out.push({ k: 'need', id, sev: 2 });
  if (v.closedUntil > s.t) out.push({ k: 'closed', sev: 2 });
  if (!v.staff.length) out.push({ k: 'staff', sev: 1 });
  for (const e of v.eq) { if (e.broken) out.push({ k: 'broken', e, sev: 2 }); else if (svcOverdue(e)) out.push({ k: 'svc', e, sev: 1 }); else if (e.exp && e.exp <= s.t) out.push({ k: 'expired_eq', e, sev: 1 }); }
  const ex = expiredOf(v); if (ex.length) out.push({ k: 'expired', n: ex.length, sev: 2 });
  if (def.food && v.pestUntil <= s.t) out.push({ k: 'pest', sev: 1 });
  if (def.food) { const noMed = v.staff.filter((x) => (x.medUntil || 0) <= s.t).length; if (noMed) out.push({ k: 'med', n: noMed, sev: 1 }); }
  if (v.clean < 45) out.push({ k: 'dirty', sev: v.clean < 25 ? 2 : 1 });
  if (def.garage && v.type === 'sto' && v.oilUntil <= s.t) out.push({ k: 'oilwaste', sev: 1 });
  if (v.wasteUntil <= s.t) out.push({ k: 'waste', sev: 0 });
  const fire = fireGaps(v); if (fire.length) out.push({ k: 'fire', n: fire.length, sev: 1 });
  return out;
}
export const operating = (v) => { const s = G.s; return v.open && v.permitAt <= s.t && v.closedUntil <= s.t && VENUES[v.type].need.every((id) => hasEq(v, id)); };
export function fireGaps(v) {
  const def = VENUES[v.type], s = G.s, gaps = [];
  const ext = v.eq.filter((e) => e.id === 'extinguisher' && e.exp > s.t).length;
  if (ext < def.size) gaps.push({ k: 'extinguisher', need: def.size - ext });
  if (def.size >= 2 && !hasEq(v, 'alarm')) gaps.push({ k: 'alarm' });
  if (!hasEq(v, 'evacplan')) gaps.push({ k: 'evacplan' });
  if (!hasEq(v, 'exitsign')) gaps.push({ k: 'exitsign' });
  if (!v.eq.some((e) => e.id === 'firstaid' && e.exp > s.t)) gaps.push({ k: 'firstaid' });
  return gaps;
}
export function sanitaryGaps(v) {
  const def = VENUES[v.type], s = G.s, g = [];
  if (!def.food) return g;
  const ex = expiredOf(v); if (ex.length) g.push({ k: 'expired', n: ex.length, fine: 60 * Math.min(3, ex.length) });
  if (v.pestUntil <= s.t) g.push({ k: 'pest', fine: 80 });
  const noMed = v.staff.filter((x) => (x.medUntil || 0) <= s.t).length; if (noMed) g.push({ k: 'med', n: noMed, fine: 40 * noMed });
  const chilled = Object.values(def.menu).some((m) => Object.keys(m.uses).some((k) => SKUS[k]?.fridge));
  if (chilled && !v.eq.some((e) => EQUIP[e.id]?.fridge && !e.broken)) g.push({ k: 'fridge', fine: 50 });
  if (!hasEq(v, 'thermo')) g.push({ k: 'thermo', fine: 30 });
  if (v.clean < 40) g.push({ k: 'dirty', fine: 70 });
  if (stockOf(v, 'disinfect') < 0.05) g.push({ k: 'disinfect', fine: 30 });
  if (v.eq.some((e) => e.id === 'fryer' && svcOverdue(e))) g.push({ k: 'fryoil', fine: 40 });
  if (stockOf(v, 'gloves') < 0.01 && v.type === 'shawarma') g.push({ k: 'gloves', fine: 20 });
  return g;
}

// ---------------------------------------------------------------- the hour
export function venueHourly() {
  const s = G.s; if (!s.venues?.length) return;
  const h = Math.floor((s.t % DAY) / 60);
  for (const v of s.venues) {
    const def = VENUES[v.type];
    inspections(v);
    if (!operating(v) || !isOpenHour(def, h)) continue;
    // staff: paid every open hour; nobody hired → you stand there yourself only when you're in town (40 %)
    const here = s.player.city === v.city;
    const staffN = v.staff.length;
    const wages = staffN * wageOf(v);
    if (wages > 0) charge(wages, 'wages', T(`Зарплаты: ${v.name}`, `Зарплати: ${v.name}`, `Wages: ${v.name}`));
    v.day.cost += wages;
    let cap = staffN ? v.staff.reduce((a, x) => a + def.staff.per * x.skill, 0) : here ? def.staff.per * 0.4 : 0;
    if (!def.garage) { const seats = v.eq.reduce((a, e) => a + (EQUIP[e.id]?.seats || 0), 0); cap = Math.min(cap, 6 + seats * 1.6); }
    else cap = Math.min(cap, Math.max(1, v.eq.filter((e) => ['lift', 'hpw', 'tirechanger', 'vacuum'].includes(e.id) && !e.broken).length) * def.staff.per); // bays / posts
    if (cap <= 0) continue;
    // demand: the spot, the rating, the look of the place and the time of day
    const spot = SPOTS.find((x) => x.id === v.spot) || SPOTS[0];
    const look = v.eq.reduce((a, e) => a + (EQUIP[e.id]?.look || 0), 0);
    const peak = def.garage ? 1 : [7, 8, 9, 12, 13, 18, 19, 20, 21, 22].includes(h) ? 1.4 : 0.9;
    const lam = def.base * spot.traffic * (0.45 + v.rating * 0.18) * (1 + Math.min(0.25, look)) * peak * (v.adsUntil > s.t ? 1.3 : 1);
    const r = new RNG(`vh|${v.id}|${s.t}`);
    let n = Math.min(Math.round(cap), poisson(r, lam));
    const items = def.menu.filter((m) => !v.off[m.id] && itemUnlocked(v, m));
    if (!items.length) continue;
    const ws = items.map((m) => m.pop * clamp(Math.pow(stdPrice(v, m) / Math.max(0.01, priceOf(v, m)), 2.2), 0.05, 3));
    let rev = 0, served = 0, lost = 0, stale = 0; const outOf = new Set();
    for (let i = 0; i < n; i++) {
      let m = r.weighted(items, (x) => ws[items.indexOf(x)]);
      // what they wanted isn't there (no milk, broken grinder…) → most pick something else, some just leave
      if (whyNot(v, m)) {
        const w = whyNot(v, m); if (w.startsWith('sku:')) outOf.add(w.slice(4));
        const alt = items.filter((x) => !whyNot(v, x));
        if (!alt.length || r.chance(0.35)) { lost++; continue; }
        m = r.weighted(alt, (x) => ws[items.indexOf(x)]);
      }
      if (!take(v, m.uses)) { lost++; outOf.add(take.short); continue; }
      if (take.stale) stale++;
      rev += priceOf(v, m); served++;
      // wear: every order wears what it used; skipped service wears faster and breaks more
      for (const id of m.eq) {
        const e = v.eq.find((x) => x.id === id && !x.broken); if (!e) continue;
        const over = svcOverdue(e);
        e.cond = Math.max(0, e.cond - (def.garage ? 0.12 : 0.018) * (over ? 3 : 1));
        if (e.cond < 40 && r.chance((over ? 0.012 : 0.004) * (1 + (40 - e.cond) / 20))) { e.broken = true; vlog(v, `💥 ${T('Сломалось', 'Зламалося', 'Broke down')}: ${L(EQUIP[e.id].n)}`); notify('business', v.name, T(`Сломалось: ${L(EQUIP[e.id].n)}`, `Зламалося: ${L(EQUIP[e.id].n)}`, `Broke down: ${L(EQUIP[e.id].n)}`)); }
      }
    }
    v.clean = clamp(v.clean - served * 0.3 + (staffN ? Math.min(staffN, 2) * 2.5 * (stockOf(v, 'disinfect') > 0 ? 1 : 0.3) : 0), 0, 100);
    if (staffN && stockOf(v, 'disinfect') > 0) take(v, { disinfect: Math.min(stockOf(v, 'disinfect'), 0.01) });
    if (rev > 0) earn(rev, 'biz', v.name);
    v.day.rev += rev; v.day.n += served; v.day.lost += lost;
    if (outOf.size && !v.warned?.day) { (v.warned ||= {}).day = 1; notify('business', v.name, T(`Закончилось: ${[...outOf].map((k) => L(SKUS[k]?.n || [k, k, k]).split(' (')[0]).join(', ')}. Закажите у Поставщика.`, `Закінчилося: ${[...outOf].map((k) => L(SKUS[k]?.n || [k, k, k]).split(' (')[0]).join(', ')}. Замовте в Постачальника.`, `Ran out of: ${[...outOf].map((k) => L(SKUS[k]?.n || [k, k, k]).split(' (')[0]).join(', ')}. Order from the Supplier.`), { go: ['supplier', 'main', { venue: v.id, cat: 'food' }] }); }
    if (outOf.size && !v.warned?.[h]) { (v.warned ||= {})[h] = 1; vlog(v, `📦 ${T('Закончилось', 'Закінчилося', 'Ran out of')}: ${[...outOf].map((k) => L(SKUS[k]?.n || [k, k, k])).join(', ')}`); }
    // rating drifts towards how the hour went
    const ok = served / Math.max(1, served + lost);
    const quality = v.eq.length ? v.eq.filter((e) => !EQUIP[e.id]?.seats).reduce((a, e) => a + (e.broken ? 0 : e.cond / 100) * (svcOverdue(e) ? 0.7 : 1), 0) / Math.max(1, v.eq.filter((e) => !EQUIP[e.id]?.seats).length) : 0.5;
    const fair = items.reduce((a, m) => a + clamp(stdPrice(v, m) / priceOf(v, m), 0.5, 1.3), 0) / items.length;
    const target = clamp(1.6 + 1.3 * ok + 0.9 * (v.clean / 100) + 0.8 * quality + Math.min(0.4, look) + (fair - 1) * 1.5 - stale * 0.25, 1, 5);
    v.rating = clamp(v.rating + (target - v.rating) * 0.06, 1, 5);
    if (stale && r.chance(0.25 * stale)) { v.rating = Math.max(1, v.rating - 0.15); vlog(v, `🤢 ${T('Жалоба: несвежие продукты', 'Скарга: несвіжі продукти', 'Complaint: stale food')}`); v.complaints = (v.complaints || 0) + 1; }
  }
  if (h === 0) venueDaily();
}
function poisson(r, lam) { const L0 = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r.f(); } while (p > L0 && k < 400); return k - 1; }
function venueDaily() {
  const s = G.s;
  for (const v of s.venues) {
    // rent, every day
    const rent = rentPerDay(v.type, v.spot, v.city);
    if (v.rentPaid <= s.t) { charge(rent, 'rent', T(`Аренда: ${v.name}`, `Оренда: ${v.name}`, `Rent: ${v.name}`)); v.rentPaid = s.t + DAY; }
    // without a working fridge / freezer chilled and frozen stock goes off by tomorrow
    const fridge = v.eq.some((e) => EQUIP[e.id]?.fridge && !e.broken), freezer = v.eq.some((e) => EQUIP[e.id]?.freeze && !e.broken);
    for (const b of v.stock) { const d = SKUS[b.sku]; if ((d?.fridge && !fridge) || (d?.freeze && !freezer)) b.exp = b.exp ? Math.min(b.exp, s.t + DAY) : s.t + DAY; }
    v.hist.unshift({ ...v.day }); v.hist.length = Math.min(v.hist.length, 14);
    v.day = { rev: 0, n: 0, lost: 0, cost: rent };
    v.warned = {};
  }
}
function inspections(v) {
  const s = G.s, def = VENUES[v.type], cur = countryOf(v.city).cur, k = Math.max(0.5, countryOf(v.city).price);
  if (v.permitAt > s.t) return;
  if (def.food && s.t >= v.nextSES) {
    v.nextSES = s.t + DAY * new RNG(uid('ses')).int(5, 10);
    const g = sanitaryGaps(v);
    const fine = nicePrice(g.reduce((a, x) => a + x.fine, 0) * k, cur);
    if (!g.length) { vlog(v, `✅ ${T('СЭС: нарушений нет', 'СЕС: порушень немає', 'Sanitary check: all good')}`); notify('business', v.name, T('Проверка СЭС пройдена', 'Перевірку СЕС пройдено', 'Sanitary check passed'), { noBadge: true }); v.rating = Math.min(5, v.rating + 0.1); }
    else {
      charge(fine, 'fine', T(`Штраф СЭС: ${v.name}`, `Штраф СЕС: ${v.name}`, `Sanitary fine: ${v.name}`));
      const close = g.length >= 3 || g.some((x) => x.k === 'dirty' && v.clean < 20);
      if (close) v.closedUntil = s.t + DAY;
      vlog(v, `🧪 ${T('СЭС', 'СЕС', 'Sanitary')}: ${g.map((x) => gapName(x)).join(', ')} — ${fmt(fine)}${close ? ' · ' + T('закрыто на сутки', 'зачинено на добу', 'closed for a day') : ''}`);
      notify('business', T('Проверка СЭС', 'Перевірка СЕС', 'Sanitary inspection'), `${v.name}: ${g.length} ${T('нарушений', 'порушень', 'violations')}, ${T('штраф', 'штраф', 'fine')} ${fmt(fine)}${close ? ' · ' + T('закрыто на сутки', 'зачинено на добу', 'closed for a day') : ''}`);
    }
  }
  if (s.t >= v.nextFire) {
    v.nextFire = s.t + DAY * new RNG(uid('fire')).int(8, 15);
    const g = fireGaps(v);
    const fine = nicePrice(g.reduce((a, x) => a + ({ extinguisher: 60 * (x.need || 1), alarm: 150, evacplan: 40, exitsign: 30, firstaid: 20 }[x.k] || 30), 0) * k, cur);
    if (!g.length) { vlog(v, `✅ ${T('Пожарная проверка: всё в порядке', 'Пожежна перевірка: усе гаразд', 'Fire inspection: all good')}`); }
    else {
      charge(fine, 'fine', T(`Штраф пожарной инспекции: ${v.name}`, `Штраф пожежної інспекції: ${v.name}`, `Fire inspection fine: ${v.name}`));
      const close = g.length >= 3;
      if (close) v.closedUntil = s.t + DAY;
      vlog(v, `🧯 ${T('Пожарная', 'Пожежна', 'Fire')}: ${g.map((x) => gapName(x)).join(', ')} — ${fmt(fine)}${close ? ' · ' + T('закрыто на сутки', 'зачинено на добу', 'closed for a day') : ''}`);
      notify('business', T('Пожарная проверка', 'Пожежна перевірка', 'Fire inspection'), `${v.name}: ${g.length} ${T('нарушений', 'порушень', 'violations')}, ${T('штраф', 'штраф', 'fine')} ${fmt(fine)}`);
    }
  }
}
export function gapName(x) {
  const m = {
    expired: T(`просрочка (${x.n})`, `прострочка (${x.n})`, `expired stock (${x.n})`), pest: T('нет договора дезинсекции', 'немає договору дезінсекції', 'no pest control'), med: T(`без медкнижек: ${x.n}`, `без медкнижок: ${x.n}`, `no health certificates: ${x.n}`),
    fridge: T('холодильник не работает', 'холодильник не працює', 'no working fridge'), thermo: T('нет журнала температур', 'немає журналу температур', 'no temperature log'), dirty: T('грязно', 'брудно', 'dirty'),
    disinfect: T('нет дезсредств', 'немає деззасобів', 'no disinfectant'), fryoil: T('старое масло во фритюре', 'стара олія у фритюрі', 'old frying oil'), gloves: T('нет перчаток', 'немає рукавичок', 'no gloves'),
    extinguisher: T(`огнетушители: не хватает ${x.need}`, `вогнегасники: бракує ${x.need}`, `extinguishers: ${x.need} short`), alarm: T('нет сигнализации', 'немає сигналізації', 'no fire alarm'), evacplan: T('нет плана эвакуации', 'немає плану евакуації', 'no evacuation plan'),
    exitsign: T('нет таблички «Выход»', 'немає таблички «Вихід»', 'no exit sign'), firstaid: T('нет аптечки', 'немає аптечки', 'no first‑aid kit'),
  };
  return m[x.k] || x.k;
}
export function deepClean(v) { const have = stockOf(v, 'disinfect'); if (have < 0.05) return false; take(v, { disinfect: Math.min(0.3, have) }); v.clean = Math.min(100, v.clean + 45); vlog(v, `🧽 ${T('Генеральная уборка', 'Генеральне прибирання', 'Deep clean')}`); emit('biz'); return true; }
export function runVenueAds(v) { const p = 25 * cityK(v.city); if (!spend(p, 'biz', T(`Реклама: ${v.name}`, `Реклама: ${v.name}`, `Ads: ${v.name}`))) return false; v.adsUntil = Math.max(v.adsUntil || 0, G.s.t) + 3 * DAY; emit('biz'); return true; }

// ---------------------------------------------------------------- the Supplier: orders delivered to a venue
export const supplierDiscount = () => (unlocks().supplierUntil > G.s.t ? 0.1 : 0);
export const linePrice = (kind, id, venue) => {
  const k = Math.max(0.55, countryOf(venue?.city || G.s.player.city).price) * (1 - supplierDiscount());
  const base = kind === 'sku' ? SKUS[id]?.price : kind === 'eq' ? EQUIP[id]?.price : SERVICES[id]?.price;
  return (base || 0) * k;
};
export function placeOrder(venueId, lines) {
  const s = G.s, v = venueById(venueId);
  if (!v || !lines.length) return { ok: false };
  const total = lines.reduce((a, l) => a + linePrice(l.kind, l.id, v) * l.qty, 0) + 4;
  if (!spend(total, 'biz', T(`Поставщик → ${v.name}`, `Постачальник → ${v.name}`, `Supplier → ${v.name}`))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  const eta = s.t + new RNG(uid('vo')).int(120, 480);
  s.vorders.push({ id: uid('vo'), venue: venueId, lines, eta, total });
  vlog(v, `🚚 ${T('Заказ у Поставщика', 'Замовлення в Постачальника', 'Supplier order')}: ${lines.length} ${T('поз.', 'поз.', 'lines')}, ${fmt(total)}`);
  emit('biz');
  return { ok: true, total, eta };
}
export function vordersTick() {
  const s = G.s; if (!s.vorders?.length) return;
  const due = s.vorders.filter((o) => o.eta <= s.t); if (!due.length) return;
  s.vorders = s.vorders.filter((o) => o.eta > s.t);
  for (const o of due) {
    const v = venueById(o.venue); if (!v) continue;
    for (const l of o.lines) {
      if (l.kind === 'sku') addStock(v, l.id, l.qty);
      else if (l.kind === 'eq') for (let i = 0; i < l.qty; i++) { const ex = EQUIP[l.id]?.expire && v.eq.find((e) => e.id === l.id && e.exp <= s.t); if (ex) { ex.exp = s.t + EQUIP[l.id].expire * DAY; } else installEq(v, l.id); }
      else applyService(v, l.id, l.qty);
    }
    vlog(v, `📦 ${T('Привезли заказ', 'Привезли замовлення', 'Order delivered')}`);
    notify('supplier', T('Поставщик', 'Постачальник', 'Supplier'), T(`Доставлено в «${v.name}»`, `Доставлено в «${v.name}»`, `Delivered to “${v.name}”`), { noBadge: true });
  }
  emit('biz');
}
function applyService(v, id, qty) {
  const s = G.s, d = SERVICES[id]; if (!d) return;
  if (id === 'pest') v.pestUntil = Math.max(v.pestUntil, s.t) + d.days * DAY * qty;
  if (id === 'waste') v.wasteUntil = Math.max(v.wasteUntil, s.t) + d.days * DAY * qty;
  if (id === 'oilwaste') v.oilUntil = Math.max(v.oilUntil, s.t) + d.days * DAY * qty;
  if (id === 'medbook') { let n = qty; for (const x of v.staff) if (n > 0 && (x.medUntil || 0) <= s.t) { x.medUntil = s.t + 365 * DAY; n--; } v.medSpare = (v.medSpare || 0) + n; }
  if (id === 'deepclean') v.clean = 100;
  if (id === 'repair') for (const e of v.eq) if (e.broken) { e.broken = false; e.cond = Math.max(e.cond, 65); e.svcAt = s.t; }
}
export const pendingOrders = (venueId) => (G.s.vorders || []).filter((o) => o.venue === venueId);
