// Shadow apps and getting burned.
//  * Hidden apps (Shade, Phone Lab, Probiv, Radar) can't be found in the App Market any more: a link to each is
//    found on someone's old drive or phone (files_extra.js loot); after that it downloads through a VPN.
//  * Opening a hidden app without a VPN exposes your connection. To shake it off you have to switch to another
//    Wi‑Fi network AND lie low in another city for a while (6 game hours); the second time it has to be another
//    country. Until then hidden apps stay shut and the police may knock now and then.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { countryOf, CITY } from '../data/world.js';
import { notify, stat } from './player.js';
import { policeFine } from './crime.js';
import { nicePrice, fmt } from '../core/money.js';

export const SHADOW_APPS = ['dark', 'lab', 'probiv', 'radar'];
export const STAY_MIN = 360; // how long to lie low elsewhere
const st = () => {
  const s = G.s;
  if (!s.shadow) s.shadow = { found: SHADOW_APPS.filter((id) => (s.installed || []).includes(id)), burns: 0, lastBurn: -1e9, burn: null };
  return s.shadow;
};
export const isFound = (id) => !SHADOW_APPS.includes(id) || st().found.includes(id) || (G.s.installed || []).includes(id);
export const foundApps = () => st().found.slice();
export function findApp(id) {
  const sh = st();
  if (sh.found.includes(id)) return false;
  sh.found.push(id); stat('shadowFound');
  emit('apps');
  return true;
}

// ---------------------------------------------------------------- Wi‑Fi
const hash = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export function networks() {
  const s = G.s, c = s.player.city, h = hash(c + s.id);
  const hex = (n) => (n >>> 0).toString(16).toUpperCase().slice(-4).padStart(4, '0');
  return [
    { id: 'home', n: `Home_${hex(h)}`, lock: false, mine: true, sig: 3 },
    { id: 'n1', n: `TP-Link_${hex(h * 7)}`, lock: true, sig: 2 },
    { id: 'n2', n: `Keenetic-${(h % 9000) + 1000}`, lock: true, sig: 2 },
    { id: 'n3', n: `ASUS_${hex(h * 13)}_5G`, lock: true, sig: 1 },
    { id: 'cafe', n: T('Кофейня_Free', 'Кавʼярня_Free', 'Cafe_Free'), lock: false, sig: 2 },
    { id: 'mall', n: T('ТЦ_Гостевая', 'ТЦ_Гостьова', 'Mall_Guest'), lock: false, sig: 1 },
    { id: '4g', n: T('Мобильный интернет 4G', 'Мобільний інтернет 4G', 'Mobile data 4G'), lock: false, sig: 3, mobile: true },
  ];
}
export const wifiState = () => (G.s.wifi ||= { net: 'home', known: ['home', 'cafe', 'mall', '4g'] });
export const currentNet = () => networks().find((n) => n.id === wifiState().net) || networks()[0];
export function connectNet(id, cracked = false) {
  const w = wifiState(), n = networks().find((x) => x.id === id);
  if (!n) return { ok: false };
  if (n.lock && !w.known.includes(id) && !cracked) return { ok: false, need: 'pass' };
  if (!w.known.includes(id)) w.known.push(id);
  w.net = id;
  emit('wifi'); emit('apps');
  return { ok: true };
}

// ---------------------------------------------------------------- getting burned
export const burnState = () => st().burn;
export const shadowLocked = () => !!st().burn;
export function burn(appId) {
  const s = G.s, sh = st();
  if (s.t - sh.lastBurn > 7 * 1440) sh.burns = 0; // a week of being careful forgives the past
  sh.burns++; sh.lastBurn = s.t;
  const lvl = sh.burns >= 2 ? 2 : 1;
  sh.burn = { lvl, app: appId, t: s.t, city: s.player.city, country: countryOf(s.player.city).id, net: wifiState().net, stayFrom: null };
  stat('burned');
  notify('gov', T('Вас засекли', 'Вас засікли', 'You got spotted'), lvl === 1
    ? T('Вы зашли в скрытое приложение без VPN — адрес засветился. Смените Wi‑Fi и уезжайте на время в другой город.', 'Ви зайшли в приховане застосування без VPN — адреса засвітилася. Змініть Wi‑Fi і поїдьте на час в інше місто.', 'You opened a hidden app without a VPN — your address leaked. Switch Wi‑Fi and lie low in another city for a while.')
    : T('Снова без VPN — теперь вас ищут серьёзно. Смените Wi‑Fi и уезжайте на время в другую страну.', 'Знову без VPN — тепер вас шукають серйозно. Змініть Wi‑Fi і поїдьте на час в іншу країну.', 'No VPN again — now they are really looking. Switch Wi‑Fi and lie low in another country for a while.'));
  emit('apps');
  return sh.burn;
}
// what still has to be done
export function burnTodo() {
  const b = st().burn; if (!b) return null;
  const s = G.s;
  const wifi = wifiState().net !== b.net;
  const moved = b.lvl >= 2 ? countryOf(s.player.city).id !== b.country : s.player.city !== b.city;
  const left = b.stayFrom != null ? Math.max(0, STAY_MIN - (s.t - b.stayFrom)) : STAY_MIN;
  return { lvl: b.lvl, wifi, moved, left, from: L(CITY[b.city]?.name || ['', '', '']) };
}
export function burnTick() {
  const s = G.s, sh = s.shadow, b = sh?.burn;
  if (!b) return;
  const td = burnTodo();
  if (td.wifi && td.moved) {
    if (b.stayFrom == null) { b.stayFrom = s.t; notify('dark', T('Залегли на дно', 'Залягли на дно', 'Lying low'), T('Новый Wi‑Fi и другой город — переждите здесь 6 часов.', 'Новий Wi‑Fi і інше місто — перечекайте тут 6 годин.', 'New Wi‑Fi and another place — wait here for 6 hours.'), { noBadge: true }); }
    else if (s.t - b.stayFrom >= STAY_MIN) { sh.burn = null; notify('dark', T('Вас потеряли', 'Вас загубили', 'They lost you'), T('Следы остыли — скрытые приложения снова работают, можно возвращаться домой.', 'Сліди охололи — приховані застосунки знову працюють, можна повертатися додому.', 'The trail went cold — hidden apps work again, you can go home.')); emit('apps'); }
    return;
  }
  b.stayFrom = null;
  // still sitting where they spotted you: now and then a knock on the door
  if (s.t % 60 === 0 && new RNG(`burn|${s.id}|${s.t}`).chance(0.06)) {
    const fine = nicePrice(40 + s.level * 6, countryOf(s.player.city).cur);
    policeFine('cyber', fine, T('выход в даркнет без VPN', 'вихід у даркнет без VPN', 'darknet access without a VPN'));
    notify('gov', T('Полиция', 'Поліція', 'Police'), T(`Приходили по вашему адресу из‑за выхода в даркнет. Штраф ${fmt(fine)}. Смените Wi‑Fi и уезжайте.`, `Приходили на вашу адресу через вихід у даркнет. Штраф ${fmt(fine)}. Змініть Wi‑Fi і їдьте.`, `They came to your address over the darknet access. Fine ${fmt(fine)}. Switch Wi‑Fi and leave.`));
  }
}
