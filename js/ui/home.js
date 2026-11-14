// Home screen like an iPhone: swipeable pages, widgets in three sizes, every installed app placed on a page,
// long press = edit mode: drag icons and widgets between pages and in/out of the dock, add/remove widgets,
// change the wallpaper, uninstall apps. Everything else comes from the App Store.
import { G, emit } from '../core/state.js';
import { T, L, clockDur, fmtDate } from '../core/i18n.js';
import { esc, clamp, $ } from '../core/util.js';
import { fmt } from '../core/money.js';
import { netWorth } from '../game/player.js';
import { isInstalled, isSystem, vpnActive } from '../game/phone.js';
import { APP_META } from '../data/appmeta.js';
import { feedFor } from '../game/market.js';
import { itemTitle } from '../game/items.js';
import { ensureDaily, questProgress, questText } from '../game/quests.js';
import { jobById } from '../game/jobs.js';
import { itemSVG } from './art.js';
import { morphHTML } from './morph.js';
import { UI, iconHTML, gameClock, gameDate, dayNum, sheet, resolveSheet, confirmBox, toast, appName } from './shell.js';
import { CITY } from '../data/world.js';
import { icon } from './icons.js';

const ROWS = 6, COLS = 4;
const CELLS = { s: 4, m: 8, l: 16 };
export const HOME = { edit: false, page: 0 };

const W = (name, sizes, app, render) => ({ name, sizes, app, render });
export const WIDGETS = {
  clock: W(['Часы', 'Годинник', 'Clock'], ['s', 'm'], null, (sz) => {
    const s = G.s;
    return `<div class="wc-time">${gameClock()}</div><div class="wc-date">${esc(fmtDate(gameDate()))}</div><div class="wc-day">${T('День', 'День', 'Day')} ${dayNum()}${sz === 'm' ? ` · ${esc(L(cityName()))}` : ''}</div>${sz === 'm' ? `<div class="wc-money">${T('баланс', 'баланс', 'balance')} <b data-live="money">${fmt(s.money)}</b></div>` : ''}`;
  }),
  log: W(['Журнал событий', 'Журнал подій', 'Event log'], ['m', 'l'], 'news', (sz) => {
    const n = sz === 'l' ? 11 : 4;
    const lines = G.s.log.slice(-n).map((l) => `<div class="tl"><span class="tg">[${esc(l.tag)}]</span> ${esc(l.text)}</div>`).join('') || `<div class="tl">&gt; ${T('система готова', 'система готова', 'system ready')}</div>`;
    return `${lines}<div class="tl">&gt; <span class="cur"></span></div>`;
  }),
  needs: W(['Состояние', 'Стан', 'Status'], ['s', 'm'], 'profile', (sz) => {
    const s = G.s;
    const lvlP = Math.round((s.xp / (60 * Math.pow(s.level, 1.75))) * 100);
    const row = (ic, label, v, live, col) => `<div class="wn"><span>${ic}${sz === 'm' ? ' ' + label : ''}</span><b ${live ? `data-live="${live}"` : ''}>${v}</b><div class="bar"><i ${live ? `data-live="${live}bar"` : ''} style="width:${clamp(+v || 0, 0, 100)}%;background:${col}"></i></div></div>`;
    return row('⚡', T('Энергия', 'Енергія', 'Energy'), Math.round(s.energy), 'energy', s.energy < 25 ? 'var(--red)' : 'var(--acc)') + row('🍔', T('Сытость', 'Ситість', 'Food'), Math.round(s.food), 'food', s.food < 25 ? 'var(--red)' : 'var(--yel)') + `<div class="wn"><span>★${sz === 'm' ? ' ' + T('Уровень', 'Рівень', 'Level') : ''}</span><b>${s.level}</b><div class="bar"><i style="width:${lvlP}%;background:var(--acc2)"></i></div></div>`;
  }),
  money: W(['Баланс', 'Баланс', 'Balance'], ['s', 'm'], 'bank', (sz) => `<small>${T('на карте', 'на картці', 'on card')}</small><b class="wm" data-live="money">${fmt(G.s.money)}</b><small>${T('капитал', 'капітал', 'net worth')} <span data-live="worth">${fmt(netWorth(), { short: true })}</span></small>${sz === 'm' ? `<div class="wtiny">${(G.s.bank?.hist || []).slice(0, 2).map((h) => `${esc(h.note || h.kind)} <b class="${h.amt >= 0 ? 'g' : 'r'}">${h.amt >= 0 ? '+' : ''}${fmt(h.amt)}</b>`).join('<br>')}</div>` : ''}`),
  market: W(['Свежие объявления', 'Свіжі оголошення', 'Fresh listings'], ['m', 'l'], 'market', (sz) => {
    const f = (feedFor().items || []).filter((l) => !l.sold).slice(0, sz === 'l' ? 4 : 2);
    return `<div class="wl ${sz}">${f.map((l) => `<div class="wli"><div class="th">${itemSVG(l.item, { lite: true })}</div><b>${fmt(l.price)}</b><span>${esc(itemTitle(l.item))}</span></div>`).join('')}</div>`;
  }),
  deliveries: W(['Посылки', 'Посилки', 'Parcels'], ['s', 'm'], 'delivery', (sz) => {
    const d = G.s.deliveries.slice().sort((a, b) => a.eta - b.eta);
    if (!d.length) return `<div class="wbig">📦</div><small>${T('Посылок нет', 'Посилок немає', 'No parcels')}</small>`;
    return `<div class="wbig">📦 ${d.length}</div>${d.slice(0, sz === 'm' ? 3 : 1).map((x) => `<small>${x.kind === 'out' ? '📤' : '📥'} <span data-cd="${x.eta}"></span> · ${esc((x.title || (x.item ? itemTitle(x.item) : '')).slice(0, 22))}</small>`).join('')}`;
  }),
  jobs: W(['Работа', 'Робота', 'Work'], ['s', 'm'], 'jobs', (sz) => {
    const j = G.s.job;
    const pend = j.apps.filter((a) => a.st === 'sent');
    const cur = j.cur ? jobById(j.cur) : null;
    let h = cur ? `<div class="wbig">${cur.icon}</div><small>${esc(L(cur.n))}</small><small>${j.next > G.s.t ? `${T('смена через', 'зміна через', 'next shift in')} <span data-cd="${j.next}"></span>` : T('можно на смену', 'можна на зміну', 'shift available')}</small>` : `<div class="wbig">💼</div><small>${T('Без работы', 'Без роботи', 'Unemployed')}</small>`;
    if (pend.length) h += `<small>📄 ${T('ответ через', 'відповідь через', 'reply in')} <span data-cd="${pend[0].respond}"></span>${sz === 'm' && pend.length > 1 ? ` (+${pend.length - 1})` : ''}</small>`;
    return h;
  }),
  quests: W(['Задания', 'Завдання', 'Quests'], ['m'], 'quests', () => ensureDaily().slice(0, 3).map((q) => { const p = Math.min(1, questProgress(q) / q.target); return `<div class="wq"><span>${q.done ? '✅' : '▫️'} ${esc(questText(q))}</span><div class="bar"><i style="width:${Math.round(p * 100)}%;background:var(--yel)"></i></div></div>`; }).join('')),
  chats: W(['Сообщения', 'Повідомлення', 'Messages'], ['s'], 'market', () => {
    const open = G.s.chats.filter((c) => c.unread && c.st !== 'closed');
    const last = open[0];
    return `<div class="wbig">💬 ${open.length}</div><small>${last ? esc(`${last.npc.name}: ${last.msgs[last.msgs.length - 1]?.tx || ''}`.slice(0, 44)) : T('Новых нет', 'Нових немає', 'Nothing new')}</small>`;
  }),
  repair: W(['Мастерская', 'Майстерня', 'Workshop'], ['s'], 'repair', () => {
    const r = G.s.repairs[0];
    return `<div class="wbig">🛠 ${G.s.repairs.length}</div><small>${r ? `<span data-cd="${r.done}"></span>` : T('Свободно', 'Вільно', 'Idle')}</small>`;
  }),
  vpn: W(['VPN', 'VPN', 'VPN'], ['s'], 'vpn', () => `<div class="wbig">${vpnActive() ? '🛡' : '⚠️'}</div><small>${vpnActive() ? T('Защищено', 'Захищено', 'Protected') : T('Не защищено', 'Не захищено', 'Unprotected')}</small>${vpnActive() ? `<small><span data-cd="${G.s.vpn.until}" data-fmt="long"></span></small>` : ''}`),
};
const cityName = () => CITY[G.s.player.city]?.name || ['', '', ''];
export const widgetAvailable = (k) => !WIDGETS[k].app || isInstalled(WIDGETS[k].app);

// ---------------------------------------------------------------- layout: explicit order like on an iPhone
// s.home.lay = { pages: [[key…]…], dock: [appId…] }, key = 'a:<appId>' | 'w:<widgetId>'
const DOCK_PREF = ['market', 'bank', 'inventory', 'jobs', 'map', 'appstore', 'profile', 'settings'];
const CAP = ROWS * COLS;
export const MAX_PAGES = 5;
const cellsOf = (key) => { if (key.startsWith('a:')) return 1; const w = G.s.home.widgets.find((x) => 'w:' + x.id === key); return w ? CELLS[w.size] : 0; };
const validApp = (id) => !!UI.apps[id] && !UI.apps[id].hidden && isInstalled(id);
export function syncLayout() {
  const s = G.s, h = s.home;
  const apps = (s.installed || []).filter(validApp);
  const wids = h.widgets.filter((w) => WIDGETS[w.k] && widgetAvailable(w.k));
  if (!h.lay) {
    const dock = DOCK_PREF.filter((id) => apps.includes(id)).slice(0, 4);
    const pages = [];
    for (const w of wids) (pages[w.page || 0] ||= []).push('w:' + w.id);
    for (let i = 0; i < pages.length; i++) pages[i] ||= [];
    if (!pages.length) pages.push([]);
    for (const id of apps) if (!dock.includes(id)) pages[pages.length - 1].push('a:' + id);
    h.lay = { pages, dock };
  }
  const L2 = h.lay;
  const ok = (k) => (k.startsWith('a:') ? apps.includes(k.slice(2)) : wids.some((w) => 'w:' + w.id === k));
  L2.dock = L2.dock.filter((id) => apps.includes(id)).slice(0, 4);
  L2.pages = L2.pages.map((pg) => pg.filter((k, i, arr) => ok(k) && arr.indexOf(k) === i && !(k.startsWith('a:') && L2.dock.includes(k.slice(2)))));
  const placed = new Set([...L2.pages.flat(), ...L2.dock.map((id) => 'a:' + id)]);
  // newly installed apps and new widgets go to the first free spot from the end
  for (const w of wids) if (!placed.has('w:' + w.id)) { const pg = L2.pages[Math.min(HOME.page, L2.pages.length - 1)] || (L2.pages[0] ||= []); pg.unshift('w:' + w.id); }
  for (const id of apps) if (!placed.has('a:' + id)) { if (!L2.pages.length) L2.pages.push([]); L2.pages[L2.pages.length - 1].push('a:' + id); }
  // overflow → next page
  for (let i = 0; i < L2.pages.length; i++) {
    let used = 0; const keep = [], spill = [];
    for (const k of L2.pages[i]) { const c = cellsOf(k); if (used + c <= CAP) { keep.push(k); used += c; } else spill.push(k); }
    L2.pages[i] = keep;
    if (spill.length) (L2.pages[i + 1] ||= []).unshift(...spill);
  }
  if (HOME.edit) {
    // while you arrange the screen there are always five pages to drop things on
    while (L2.pages.length < MAX_PAGES) L2.pages.push([]);
  } else {
    // done arranging: empty pages go away (the page you're looking at keeps its place)
    const cur = L2.pages[HOME.page];
    L2.pages = L2.pages.filter((pg) => pg.length);
    if (!L2.pages.length) L2.pages.push([]);
    const at = cur ? L2.pages.indexOf(cur) : -1;
    const np = at >= 0 ? at : Math.min(HOME.page, L2.pages.length - 1);
    if (np !== HOME.page) { HOME.page = np; requestAnimationFrame(() => { const h2 = $('#home'); if (h2) h2.scrollLeft = np * h2.clientWidth; }); }
  }
  return L2;
}
export const dockApps = () => (G.s?.home?.lay ? G.s.home.lay.dock : DOCK_PREF.filter((id) => isInstalled(id) && UI.apps[id]).slice(0, 4));
function widgetHTML(w) {
  const def = WIDGETS[w.k];
  let inner = '';
  try { inner = def.render(w.size); } catch (e) { console.error('widget', w.k, e); }
  const open = def.app && !HOME.edit ? `data-a="open" data-v="${def.app}"` : '';
  return `<div class="wdg wdg-${w.k} ${w.size}" data-key="${w.id}" data-hk="w:${w.id}" ${open}>${HOME.edit ? `<button class="wx" data-a="homeDelW" data-v="${w.id}">−</button>` : ''}<div class="wbody">${inner}</div><div class="wname">${esc(L(def.name))}</div></div>`;
}
const appIcon = (id, dock) => iconHTML(UI.apps[id], dock, HOME.edit && !isSystem(id)).replace('<button class="ic', `<button data-hk="a:${id}" class="ic`);
// wallpapers
export const WALLS = {
  hacker: { n: ['Хакер', 'Хакер', 'Hacker'], css: 'radial-gradient(520px 380px at 12% 8%, rgba(255,138,61,.28), transparent 60%), radial-gradient(520px 520px at 100% 40%, rgba(139,92,255,.32), transparent 60%), radial-gradient(600px 500px at 30% 100%, rgba(42,99,255,.35), transparent 60%), linear-gradient(180deg, #0c0f1c, #160f2c 50%, #0b1230)', grid: true },
  aurora: { n: ['Северное сияние', 'Північне сяйво', 'Aurora'], css: 'radial-gradient(700px 400px at 20% 20%, rgba(46,242,160,.45), transparent 60%), radial-gradient(600px 500px at 90% 30%, rgba(77,163,255,.45), transparent 60%), radial-gradient(500px 400px at 50% 90%, rgba(139,92,255,.5), transparent 60%), linear-gradient(180deg, #03141a, #071029 60%, #0e0a24)' },
  sunset: { n: ['Закат', 'Захід сонця', 'Sunset'], css: 'linear-gradient(180deg, #2b1055 0%, #7b2869 35%, #d5486a 60%, #f78f48 80%, #fbc96b 100%)' },
  ocean: { n: ['Океан', 'Океан', 'Ocean'], css: 'radial-gradient(800px 500px at 50% 0%, rgba(110,200,255,.55), transparent 60%), linear-gradient(180deg, #0a4d8c, #063767 50%, #021c38)' },
  forest: { n: ['Лес', 'Ліс', 'Forest'], css: 'radial-gradient(600px 500px at 30% 10%, rgba(180,230,140,.35), transparent 60%), linear-gradient(180deg, #1f4a2c, #12301d 55%, #081a10)' },
  graphite: { n: ['Графит', 'Графіт', 'Graphite'], css: 'radial-gradient(600px 500px at 50% 0%, #3a3d45, transparent 70%), linear-gradient(180deg, #24262c, #111214)' },
  dune: { n: ['Дюны', 'Дюни', 'Dunes'], css: 'linear-gradient(170deg, #f3d9b1 0%, #e0a96d 40%, #b8693f 70%, #6b3a26 100%)' },
  candy: { n: ['Конфета', 'Цукерка', 'Candy'], css: 'radial-gradient(500px 400px at 20% 20%, #ff9ad5, transparent 60%), radial-gradient(500px 500px at 80% 70%, #8fd3ff, transparent 60%), linear-gradient(160deg, #ffb3c7, #c5a3ff)' },
  neon: { n: ['Неон', 'Неон', 'Neon'], css: 'radial-gradient(400px 300px at 0% 30%, rgba(255,0,153,.55), transparent 60%), radial-gradient(400px 300px at 100% 70%, rgba(0,229,255,.55), transparent 60%), linear-gradient(180deg, #07010f, #10031f)' },
  mono: { n: ['Чёрный', 'Чорний', 'Black'], css: '#000' },
  space: { n: ['Космос', 'Космос', 'Space'], css: 'radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff, transparent), radial-gradient(1px 1px at 85% 60%, #fff, transparent), radial-gradient(1px 1px at 10% 85%, #fff, transparent), radial-gradient(600px 400px at 70% 80%, rgba(120,60,255,.45), transparent 60%), linear-gradient(180deg, #02030a, #0a0820)' },
  mint: { n: ['Мята', 'Мʼята', 'Mint'], css: 'linear-gradient(160deg, #b8f5e0, #5fd3b3 50%, #1f8f7a)' },
  lava: { n: ['Лава', 'Лава', 'Lava'], css: 'radial-gradient(500px 400px at 80% 15%, rgba(255,196,0,.55), transparent 60%), linear-gradient(165deg, #ff512f 0%, #dd2476 55%, #3a0b2e 100%)' },
  grape: { n: ['Виноград', 'Виноград', 'Grape'], css: 'radial-gradient(520px 420px at 15% 20%, rgba(255,120,220,.45), transparent 60%), linear-gradient(160deg, #41295a, #2f0743)' },
  peach: { n: ['Персик', 'Персик', 'Peach'], css: 'linear-gradient(165deg, #ffecd2 0%, #fcb69f 55%, #ff8a80 100%)' },
  emerald: { n: ['Изумруд', 'Смарагд', 'Emerald'], css: 'radial-gradient(520px 420px at 80% 10%, rgba(120,255,214,.4), transparent 60%), linear-gradient(170deg, #0f3d3e, #0a2a2b 60%, #041414)' },
  midnight: { n: ['Полночь', 'Північ', 'Midnight'], css: 'radial-gradient(600px 420px at 50% 0%, rgba(86,120,255,.4), transparent 65%), linear-gradient(180deg, #0b1026, #05060f)' },
  sunrise: { n: ['Рассвет', 'Світанок', 'Sunrise'], css: 'linear-gradient(180deg, #1e3c72 0%, #6a82fb 35%, #fc9d9a 70%, #fce38a 100%)' },
  ice: { n: ['Лёд', 'Лід', 'Ice'], css: 'radial-gradient(520px 400px at 20% 15%, rgba(255,255,255,.7), transparent 60%), linear-gradient(165deg, #e0f7ff, #9ad8f5 50%, #4a9fd4)' },
  rosegold: { n: ['Розовое золото', 'Рожеве золото', 'Rose gold'], css: 'linear-gradient(160deg, #f6d5c9 0%, #e8a598 45%, #b76e79 100%)' },
  matrix: { n: ['Матрица', 'Матриця', 'Matrix'], css: 'repeating-linear-gradient(90deg, rgba(46,242,160,.10) 0 2px, transparent 2px 18px), repeating-linear-gradient(0deg, rgba(46,242,160,.06) 0 1px, transparent 1px 22px), linear-gradient(180deg, #021a10, #000)' },
  stripes: { n: ['Полосы', 'Смуги', 'Stripes'], css: 'repeating-linear-gradient(135deg, #1f2233 0 26px, #272b40 26px 52px)' },
  dots: { n: ['Горошек', 'Горошок', 'Dots'], css: 'radial-gradient(circle, rgba(255,255,255,.16) 2.5px, transparent 3px) 0 0 / 26px 26px, linear-gradient(160deg, #3a1c71, #d76d77 60%, #ffaf7b)' },
  grid: { n: ['Сетка', 'Сітка', 'Grid'], css: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 100% 34px, linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 34px 100%, linear-gradient(180deg, #141a2e, #0a0d18)' },
  cherry: { n: ['Вишня', 'Вишня', 'Cherry'], css: 'radial-gradient(460px 360px at 25% 20%, rgba(255,90,120,.5), transparent 60%), linear-gradient(170deg, #5e0f1c, #2a060c)' },
  sky: { n: ['Небо', 'Небо', 'Sky'], css: 'radial-gradient(420px 260px at 70% 18%, rgba(255,255,255,.75), transparent 62%), linear-gradient(180deg, #4facfe, #a6e3ff 70%, #eaf9ff)' },
  p_city: { n: ['Ночной город', 'Нічне місто', 'City at night'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/city.jpg) center / cover no-repeat', photo: 'assets/walls/city.jpg' },
  p_mountains: { n: ['Горное озеро', 'Гірське озеро', 'Mountain lake'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/mountains.jpg) center / cover no-repeat', photo: 'assets/walls/mountains.jpg' },
  p_tokyo: { n: ['Неоновая улица', 'Неонова вулиця', 'Neon street'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/tokyo.jpg) center / cover no-repeat', photo: 'assets/walls/tokyo.jpg' },
  p_waves: { n: ['Океан сверху', 'Океан згори', 'Ocean from above'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/waves.jpg) center / cover no-repeat', photo: 'assets/walls/waves.jpg' },
  p_fog: { n: ['Туманный лес', 'Туманний ліс', 'Foggy forest'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/fog.jpg) center / cover no-repeat', photo: 'assets/walls/fog.jpg' },
  p_dunes: { n: ['Пустыня', 'Пустеля', 'Desert'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/dunes.jpg) center / cover no-repeat', photo: 'assets/walls/dunes.jpg' },
  p_aurora2: { n: ['Сияние в горах', 'Сяйво в горах', 'Aurora peaks'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/aurora2.jpg) center / cover no-repeat', photo: 'assets/walls/aurora2.jpg' },
  p_liquid: { n: ['Жидкое стекло', 'Рідке скло', 'Liquid glass'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/liquid.jpg) center / cover no-repeat', photo: 'assets/walls/liquid.jpg' },
  p_sakura: { n: ['Сакура', 'Сакура', 'Cherry blossom'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/sakura.jpg) center / cover no-repeat', photo: 'assets/walls/sakura.jpg' },
  p_pines: { n: ['Сосновый лес', 'Сосновий ліс', 'Pine forest'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/pines.jpg) center / cover no-repeat', photo: 'assets/walls/pines.jpg' },
  p_beach: { n: ['Закат на пляже', 'Захід на пляжі', 'Beach sunset'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/beach.jpg) center / cover no-repeat', photo: 'assets/walls/beach.jpg' },
  p_milkyway: { n: ['Млечный путь', 'Чумацький шлях', 'Milky Way'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/milkyway.jpg) center / cover no-repeat', photo: 'assets/walls/milkyway.jpg' },
  p_neonrain: { n: ['Неон под дождём', 'Неон під дощем', 'Neon rain'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/neonrain.jpg) center / cover no-repeat', photo: 'assets/walls/neonrain.jpg' },
  p_fluid: { n: ['Флюид', 'Флюїд', 'Fluid art'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/fluid.jpg) center / cover no-repeat', photo: 'assets/walls/fluid.jpg' },
  p_icecave: { n: ['Ледяная пещера', 'Крижана печера', 'Ice cave'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/icecave.jpg) center / cover no-repeat', photo: 'assets/walls/icecave.jpg' },
  p_canyon: { n: ['Каньон', 'Каньйон', 'Canyon'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/canyon.jpg) center / cover no-repeat', photo: 'assets/walls/canyon.jpg' },
  p_peaks: { n: ['Снежные вершины', 'Снігові вершини', 'Snowy peaks'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/peaks.jpg) center / cover no-repeat', photo: 'assets/walls/peaks.jpg' },
  p_towers: { n: ['Небоскрёбы', 'Хмарочоси', 'Skyscrapers'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/towers.jpg) center / cover no-repeat', photo: 'assets/walls/towers.jpg' },
  p_marble: { n: ['Чёрный мрамор', 'Чорний мармур', 'Black marble'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/marble.jpg) center / cover no-repeat', photo: 'assets/walls/marble.jpg' },
  p_clouds: { n: ['Над облаками', 'Над хмарами', 'Above the clouds'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/clouds.jpg) center / cover no-repeat', photo: 'assets/walls/clouds.jpg' },
  p_autumn: { n: ['Осенняя аллея', 'Осіння алея', 'Autumn alley'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/autumn.jpg) center / cover no-repeat', photo: 'assets/walls/autumn.jpg' },
  p_supercar: { n: ['Ночной суперкар', 'Нічний суперкар', 'Night supercar'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/supercar.jpg) center / cover no-repeat', photo: 'assets/walls/supercar.jpg' },
  p_gold: { n: ['Золото', 'Золото', 'Gold'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/gold.jpg) center / cover no-repeat', photo: 'assets/walls/gold.jpg' },
  p_bridge: { n: ['Мост ночью', 'Міст уночі', 'Bridge at night'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/bridge.jpg) center / cover no-repeat', photo: 'assets/walls/bridge.jpg' },
  p_glasswaves: { n: ['Стеклянные волны', 'Скляні хвилі', 'Glass waves'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/glasswaves.jpg) center / cover no-repeat', photo: 'assets/walls/glasswaves.jpg' },
  p_synthwave: { n: ['Синтвейв', 'Синтвейв', 'Synthwave'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/synthwave.jpg) center / cover no-repeat', photo: 'assets/walls/synthwave.jpg' },
  p_monstera: { n: ['Монстера', 'Монстера', 'Monstera'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/monstera.jpg) center / cover no-repeat', photo: 'assets/walls/monstera.jpg' },
  p_lavender: { n: ['Лавандовое поле', 'Лавандове поле', 'Lavender field'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/lavender.jpg) center / cover no-repeat', photo: 'assets/walls/lavender.jpg' },
  p_underwater: { n: ['Под водой', 'Під водою', 'Underwater'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/underwater.jpg) center / cover no-repeat', photo: 'assets/walls/underwater.jpg' },
  p_carbon: { n: ['Карбон', 'Карбон', 'Carbon'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/carbon.jpg) center / cover no-repeat', photo: 'assets/walls/carbon.jpg' },
  p_nightroad: { n: ['Ночная трасса', 'Нічна траса', 'Night road'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/nightroad.jpg) center / cover no-repeat', photo: 'assets/walls/nightroad.jpg' },
  p_cash: { n: ['Наличка', 'Готівка', 'Cash'], css: 'linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.28)), url(assets/walls/cash.jpg) center / cover no-repeat', photo: 'assets/walls/cash.jpg' },
};
// your own wallpapers: a photo from your gallery (kept in the browser, not in the save) and a builder
const PHOTO_KEY = 'gr_wall_photo';
let photoCache = null;
export const myPhoto = () => { if (photoCache === null) { try { photoCache = localStorage.getItem(PHOTO_KEY) || ''; } catch { photoCache = ''; } } return photoCache; };
export function setMyPhoto(dataUrl) { photoCache = dataUrl || ''; try { if (dataUrl) localStorage.setItem(PHOTO_KEY, dataUrl); else localStorage.removeItem(PHOTO_KEY); return true; } catch { return false; } }
export const BUILD_STYLES = { linear: ['Градиент', 'Градієнт', 'Gradient'], glow: ['Свечение', 'Світіння', 'Glow'], mesh: ['Пятна', 'Плями', 'Mesh'], split: ['Пополам', 'Навпіл', 'Split'] };
export const BUILD_PATTERNS = { none: ['Без узора', 'Без візерунка', 'No pattern'], dots: ['Горошек', 'Горошок', 'Dots'], grid: ['Сетка', 'Сітка', 'Grid'], stripes: ['Полосы', 'Смуги', 'Stripes'], stars: ['Звёзды', 'Зірки', 'Stars'] };
export const defaultBuild = () => ({ c1: '#ff512f', c2: '#6a11cb', c3: '#0b1026', style: 'linear', angle: 160, pattern: 'none' });
export function buildCss(b) {
  const B = { ...defaultBuild(), ...(b || {}) };
  const pat = { none: '', dots: 'radial-gradient(circle, rgba(255,255,255,.18) 2.5px, transparent 3px) 0 0 / 26px 26px, ', grid: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px) 0 0 / 100% 34px, linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px) 0 0 / 34px 100%, ', stripes: 'repeating-linear-gradient(135deg, rgba(255,255,255,.07) 0 22px, transparent 22px 44px), ', stars: 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff, transparent), radial-gradient(1px 1px at 85% 60%, #fff, transparent), radial-gradient(1px 1px at 10% 85%, #fff, transparent), radial-gradient(1.5px 1.5px at 55% 45%, #fff, transparent), radial-gradient(1px 1px at 30% 12%, #fff, transparent), ' }[B.pattern] || '';
  const base = B.style === 'glow' ? `radial-gradient(560px 420px at 25% 18%, ${B.c1}, transparent 62%), radial-gradient(520px 480px at 85% 75%, ${B.c2}, transparent 62%), linear-gradient(180deg, ${B.c3}, ${B.c3})`
    : B.style === 'mesh' ? `radial-gradient(420px 380px at 15% 15%, ${B.c1}, transparent 60%), radial-gradient(440px 400px at 90% 35%, ${B.c2}, transparent 60%), radial-gradient(480px 420px at 40% 95%, ${B.c1}, transparent 60%), linear-gradient(180deg, ${B.c3}, ${B.c3})`
      : B.style === 'split' ? `linear-gradient(${B.angle}deg, ${B.c1} 0 50%, ${B.c2} 50% 100%)`
        : `linear-gradient(${B.angle}deg, ${B.c1} 0%, ${B.c2} 55%, ${B.c3} 100%)`;
  return pat + base;
}
export function wallCss(id = G.s.home.wall) {
  if (id === 'my') return buildCss(G.s.home.myWall);
  if (id === 'photo' && myPhoto()) return `linear-gradient(rgba(0,0,0,.1), rgba(0,0,0,.26)), url(${myPhoto()}) center / cover no-repeat`;
  return (WALLS[id] || WALLS.hacker).css;
}
function applyWall() {
  const css = wallCss();
  const home = $('#home');
  if (home._wall === css) return;
  home._wall = css;
  home.style.background = css;
  home.classList.toggle('nogrid', !WALLS[G.s.home.wall]?.grid);
}
export function renderHomeScreen() {
  const s = G.s; if (!s) return;
  const lay = syncLayout();
  applyWall();
  const html = lay.pages.map((pg, i) => `<div class="hpage" data-key="p${i}" data-page="${i}"><div class="hgrid">${pg.map((k) => { if (k.startsWith('a:')) return appIcon(k.slice(2), false); const w = s.home.widgets.find((x) => 'w:' + x.id === k); return w ? widgetHTML(w) : ''; }).join('')}</div></div>`).join('');
  const home = $('#home');
  home.classList.toggle('editing', HOME.edit);
  morphHTML(home, html);
  const dots = lay.pages.length > 1 ? `<div class="pdots">${lay.pages.map((_, i) => `<i class="${i === HOME.page ? 'on' : ''}" data-a="homePage" data-v="${i}"></i>`).join('')}</div>` : '';
  const bar = HOME.edit ? `<div class="hedit"><button data-a="homeAddW">＋ ${T('Виджет', 'Віджет', 'Widget')}</button><button data-a="homeWall">🖼 ${T('Обои', 'Шпалери', 'Wallpaper')}</button><button data-a="homeDone" class="on">${T('Готово', 'Готово', 'Done')}</button></div>` : '';
  $('#dockbar').classList.toggle('editing', HOME.edit);
  morphHTML($('#dockbar'), `${bar}${dots}<div class="dock" data-dock="1">${lay.dock.map((id) => appIcon(id, true)).join('')}${HOME.edit && lay.dock.length < 4 ? '<i class="dslot"></i>'.repeat(4 - lay.dock.length) : ''}</div>`);
}

// ---------------------------------------------------------------- interactions
function moveKey(key, toPage, before) {
  const lay = G.s.home.lay;
  const isApp = key.startsWith('a:');
  lay.pages = lay.pages.map((pg) => pg.filter((k) => k !== key));
  if (isApp) lay.dock = lay.dock.filter((id) => 'a:' + id !== key);
  if (toPage === 'dock') {
    if (!isApp) return false;
    let i = before ? lay.dock.indexOf(before.slice(2)) : lay.dock.length;
    if (i < 0) i = lay.dock.length;
    lay.dock.splice(i, 0, key.slice(2));
    while (lay.dock.length > 4) { const out = lay.dock.splice(i === 4 ? 3 : 4, 1)[0]; (lay.pages[HOME.page] ||= []).push('a:' + out); }
    return true;
  }
  const pg = (lay.pages[toPage] ||= []);
  let i = before ? pg.indexOf(before) : pg.length;
  if (i < 0) i = pg.length;
  pg.splice(i, 0, key);
  return true;
}
let dragging = false;
function startDrag(el, e) {
  const key = el.dataset.hk;
  // the finger that holds the icon; any other finger swiping sideways flips the pages (like on an iPhone)
  const pid = e.pointerId;
  const others = new Map();
  dragging = true; document.body.classList.add('hdrag');
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.classList.add('hghost');
  ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
  document.body.appendChild(ghost);
  const dx = e.clientX - r.left, dy = e.clientY - r.top;
  const home = $('#home');
  let lastT = 0, lastTarget = '', edgeT = 0;
  const mark = () => document.querySelectorAll(`[data-hk="${CSS.escape(key)}"]`).forEach((x) => x.classList.add('dragging'));
  mark();
  const flip = (dir) => {
    const W = home.clientWidth;
    const np = clamp(HOME.page + dir, 0, G.s.home.lay.pages.length - 1);
    if (np !== HOME.page && moveKey(key, np, null)) { HOME.page = np; renderHomeScreen(); home.scrollTo({ left: np * W, behavior: 'smooth' }); mark(); navigator.vibrate?.(8); }
  };
  const odown = (ev) => { if (ev.pointerId !== pid) others.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, done: false }); };
  const omove = (ev) => {
    const o = others.get(ev.pointerId); if (!o || o.done) return;
    const dx = ev.clientX - o.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(ev.clientY - o.y)) { o.done = true; flip(dx < 0 ? 1 : -1); }
  };
  const move = (ev) => {
    if (ev.pointerId !== undefined && ev.pointerId !== pid) return omove(ev);
    ghost.style.transform = `translate(${ev.clientX - dx}px, ${ev.clientY - dy}px) scale(1.08)`;
    const now = performance.now();
    const W = home.clientWidth, hr = home.getBoundingClientRect();
    // hover at the screen edge → flip the page
    const edge = ev.clientX < hr.left + 22 ? -1 : ev.clientX > hr.left + W - 22 ? 1 : 0;
    if (edge) {
      if (!edgeT) edgeT = now;
      else if (now - edgeT > 650) {
        edgeT = now;
        const np = clamp(HOME.page + edge, 0, G.s.home.lay.pages.length - 1);
        if (np !== HOME.page) { if (moveKey(key, np, null)) { HOME.page = np; renderHomeScreen(); home.scrollTo({ left: np * W, behavior: 'smooth' }); mark(); } }
      }
      return;
    }
    edgeT = 0;
    if (now - lastT < 110) return;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const tgt = under?.closest('[data-hk]');
    const inDock = under?.closest('[data-dock]');
    let sig = '';
    if (inDock && key.startsWith('a:')) sig = 'dock:' + (tgt?.dataset.hk || '');
    else if (tgt && tgt.dataset.hk !== key && tgt.closest('.hpage')) sig = 'pg:' + tgt.dataset.hk + (ev.clientX > tgt.getBoundingClientRect().left + tgt.getBoundingClientRect().width / 2 ? '>' : '<');
    else if (under?.closest('.hgrid') && !tgt) sig = 'end:' + HOME.page;
    if (!sig || sig === lastTarget) return;
    lastTarget = sig; lastT = now;
    if (sig.startsWith('dock:')) moveKey(key, 'dock', tgt && tgt.closest('[data-dock]') ? tgt.dataset.hk : null);
    else if (sig.startsWith('end:')) moveKey(key, HOME.page, null);
    else {
      const t = tgt.dataset.hk, after = sig.endsWith('>');
      const pi = +tgt.closest('.hpage').dataset.page;
      const pg = G.s.home.lay.pages[pi];
      const idx = pg.indexOf(t) + (after ? 1 : 0);
      moveKey(key, pi, pg.filter((k) => k !== key)[idx - (pg.indexOf(key) >= 0 && pg.indexOf(key) < idx ? 1 : 0)] || null);
    }
    renderHomeScreen(); mark();
  };
  const up = (ev) => {
    if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) { others.delete(ev.pointerId); return; }
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('pointerdown', odown, true);
    dragging = false; document.body.classList.remove('hdrag');
    ghost.remove();
    document.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging'));
    renderHomeScreen();
    emit('home');
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); window.addEventListener('pointerdown', odown, true);
  move(e);
}
export function initHome() {
  const home = $('#home');
  home.addEventListener('scroll', () => {
    const p = Math.round(home.scrollLeft / Math.max(1, home.clientWidth));
    if (p !== HOME.page) { HOME.page = p; for (const [i, d] of [...document.querySelectorAll('.pdots i')].entries()) d.classList.toggle('on', i === p); }
  }, { passive: true });
  // long press anywhere on the home screen = edit mode (like holding the wallpaper or an icon on an iPhone)
  let t = null, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(t); t = null; };
  home.addEventListener('touchstart', (e) => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; cancel(); t = setTimeout(() => { t = null; if (!HOME.edit) { HOME.edit = true; navigator.vibrate?.(15); renderHomeScreen(); } }, 550); }, { passive: true });
  home.addEventListener('touchmove', (e) => { const p = e.touches[0]; if (Math.hypot(p.clientX - sx, p.clientY - sy) > 10) cancel(); }, { passive: true });
  home.addEventListener('touchend', cancel, { passive: true });
  home.addEventListener('contextmenu', (e) => { e.preventDefault(); HOME.edit = true; renderHomeScreen(); });
  // drag icons and widgets in edit mode — on the pages and in/out of the dock
  const down = (e) => {
    if (!HOME.edit || e.button > 0 || dragging) return;
    const el = e.target.closest('[data-hk]');
    if (!el || e.target.closest('.wx')) return;
    const x0 = e.clientX, y0 = e.clientY;
    const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 7) { off(); startDrag(el, ev); } };
    const off = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', off); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', off);
  };
  home.addEventListener('pointerdown', down);
  $('#dockbar').addEventListener('pointerdown', down);
}
// a photo from the gallery → cropped to the screen shape and shrunk so it fits in the browser storage
function pickPhoto() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files?.[0]; if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const W = 540, H = 1170, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k;
      cv.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      let data = cv.toDataURL('image/jpeg', 0.72);
      if (data.length > 420000) data = cv.toDataURL('image/jpeg', 0.5);
      if (!setMyPhoto(data)) return toast(T('Не хватило места, чтобы сохранить фото', 'Не вистачило місця, щоб зберегти фото', 'Not enough space to keep the photo'), 'r');
      G.s.home.wall = 'photo'; $('#home')._wall = null; renderHomeScreen();
      toast(T('Обои установлены', 'Шпалери встановлено', 'Wallpaper set'), 'g');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast(T('Не получилось открыть картинку', 'Не вдалося відкрити картинку', 'Couldn’t open the image'), 'r'); };
    img.src = url;
  };
  inp.click();
}
// build your own: three colours, a style, an angle and a pattern, with a live preview
async function buildWall() {
  const b = { ...defaultBuild(), ...(G.s.home.myWall || {}) };
  const chips = (key, map) => Object.entries(map).map(([k, n]) => `<button class="chip${b[key] === k ? ' on' : ''}" data-bk="${key}" data-bv="${k}">${esc(L(n))}</button>`).join('');
  const PRESETS = [['#ff512f', '#dd2476', '#3a0b2e'], ['#00c6ff', '#0072ff', '#03102b'], ['#f7971e', '#ffd200', '#5a2d00'], ['#11998e', '#38ef7d', '#052a22'], ['#8e2de2', '#4a00e0', '#0b0320'], ['#ff9a9e', '#fad0c4', '#ffd1ff'], ['#232526', '#414345', '#000000'], ['#fc466b', '#3f5efb', '#0a0f2c']];
  const r = await sheet(`<h2>🎨 ${T('Свои обои', 'Свої шпалери', 'My wallpaper')}</h2><div class="wb"><div class="wb-prev"><i></i></div><div class="wb-ctl">
      <div class="wb-cols"><label>${T('Цвет 1', 'Колір 1', 'Colour 1')}<input type="color" data-bc="c1" value="${b.c1}"></label><label>${T('Цвет 2', 'Колір 2', 'Colour 2')}<input type="color" data-bc="c2" value="${b.c2}"></label><label>${T('Цвет 3', 'Колір 3', 'Colour 3')}<input type="color" data-bc="c3" value="${b.c3}"></label></div>
      <div class="wb-pre">${PRESETS.map((p, i) => `<button data-bp="${i}" style="background:linear-gradient(135deg,${p[0]},${p[1]})"></button>`).join('')}</div>
      <small>${T('Стиль', 'Стиль', 'Style')}</small><div class="chips wrap">${chips('style', BUILD_STYLES)}</div>
      <small>${T('Узор', 'Візерунок', 'Pattern')}</small><div class="chips wrap">${chips('pattern', BUILD_PATTERNS)}</div>
      <small>${T('Угол', 'Кут', 'Angle')}: <b class="wb-ang">${b.angle}°</b></small><input type="range" min="0" max="360" step="5" value="${b.angle}" data-ba="1">
    </div></div><button class="btn block mt" data-wbok="1">${T('Поставить на экран', 'Поставити на екран', 'Set as wallpaper')}</button>`, { after(el) {
    const prev = el.querySelector('.wb-prev i');
    const upd = () => { prev.style.background = buildCss(b); el.querySelector('.wb-ang').textContent = b.angle + '°'; };
    upd();
    el.addEventListener('input', (e) => { const t = e.target; if (t.dataset.bc) b[t.dataset.bc] = t.value; if (t.dataset.ba) b.angle = +t.value; upd(); });
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-bk],[data-bp],[data-wbok]'); if (!t) return;
      if (t.dataset.wbok) return resolveSheet('ok');
      if (t.dataset.bp != null) { const p = PRESETS[+t.dataset.bp]; [b.c1, b.c2, b.c3] = p; el.querySelectorAll('[data-bc]').forEach((x) => { x.value = b[x.dataset.bc]; }); }
      if (t.dataset.bk) { b[t.dataset.bk] = t.dataset.bv; el.querySelectorAll(`[data-bk="${t.dataset.bk}"]`).forEach((x) => x.classList.toggle('on', x === t)); }
      upd();
    });
  } });
  if (r !== 'ok') return;
  G.s.home.myWall = b; G.s.home.wall = 'my'; renderHomeScreen();
  toast(T('Обои установлены', 'Шпалери встановлено', 'Wallpaper set'), 'g');
}
export const homeActions = {
  homeDone: () => { HOME.edit = false; renderHomeScreen(); },
  homePage: (v) => { const home = $('#home'); home.scrollTo({ left: +v * home.clientWidth, behavior: 'smooth' }); },
  homeDelW: (id, el, ev) => { ev?.stopPropagation(); G.s.home.widgets = G.s.home.widgets.filter((w) => w.id !== id); renderHomeScreen(); },
  homeUninstall: async (id, el, ev) => {
    ev?.stopPropagation();
    const a = UI.apps[id];
    if (!a || isSystem(id)) return;
    const nm = appName(a);
    if (!(await confirmBox(T(`Удалить «${nm}»?`, `Видалити «${nm}»?`, `Remove “${nm}”?`), T('Данные игры сохранятся, приложение можно скачать снова.', 'Дані гри збережуться, застосунок можна завантажити знову.', 'Your progress stays; you can download it again.'), T('Удалить', 'Видалити', 'Remove'), undefined, true))) return;
    const { uninstall } = await import('../game/phone.js');
    uninstall(id); renderHomeScreen();
  },
  homeWall: async () => {
    const cur = G.s.home.wall || 'hacker';
    const tile = (k, css, name, extra = '') => `<button class="${k === cur ? 'on' : ''}" data-a="resolve" data-v="${k}"><i style="background:${css}"></i><small>${esc(name)}</small>${extra}</button>`;
    const entries = Object.entries(WALLS);
    const v = await sheet(`<h2>${T('Обои', 'Шпалери', 'Wallpaper')}</h2>
      <div class="wall-own"><button data-a="resolve" data-v="__photo">📷 ${T('Своё фото', 'Своє фото', 'My photo')}</button><button data-a="resolve" data-v="__build">🎨 ${T('Создать свои', 'Створити свої', 'Build my own')}</button></div>
      <div class="walls">${myPhoto() ? tile('photo', wallCss('photo'), T('Моё фото', 'Моє фото', 'My photo')) : ''}${G.s.home.myWall ? tile('my', buildCss(G.s.home.myWall), T('Мои обои', 'Мої шпалери', 'My wallpaper')) : ''}</div>
      <h3 class="sub">${T('Фото', 'Фото', 'Photos')} · ${entries.filter(([, w]) => w.photo).length}</h3><div class="walls">${entries.filter(([, w]) => w.photo).map(([k, w]) => tile(k, `url(${w.photo}) center / cover`, L(w.n))).join('')}</div>
      <h3 class="sub">${T('Цвета и узоры', 'Кольори й візерунки', 'Colours and patterns')} · ${entries.filter(([, w]) => !w.photo).length}</h3><div class="walls">${entries.filter(([, w]) => !w.photo).map(([k, w]) => tile(k, w.css, L(w.n))).join('')}</div>`);
    if (!v) return;
    if (v === '__photo') return pickPhoto();
    if (v === '__build') return buildWall();
    G.s.home.wall = v; renderHomeScreen();
  },
  homeAddW: async () => {
    const list = Object.entries(WIDGETS).filter(([k]) => widgetAvailable(k));
    const SZ = { s: T('Малый', 'Малий', 'Small'), m: T('Средний', 'Середній', 'Medium'), l: T('Большой', 'Великий', 'Large') };
    const v = await sheet(`<h2>${T('Добавить виджет', 'Додати віджет', 'Add a widget')}</h2><p class="p">${T('Виджеты приложений появляются после их установки. После добавления его можно перетащить.', 'Віджети застосунків зʼявляються після їх встановлення. Після додавання його можна перетягнути.', 'App widgets appear once the app is installed. Drag it anywhere after adding.')}</p><div class="wgal">${list.map(([k, d]) => `<div class="card"><b>${esc(L(d.name))}</b><div class="btns">${d.sizes.map((sz) => `<button class="btn xs dark" data-a="resolve" data-v="${k}:${sz}">${SZ[sz]}</button>`).join('')}</div></div>`).join('')}</div>`);
    if (!v) return;
    const [k, size] = v.split(':');
    G.s.home.widgets.push({ id: 'w' + Date.now().toString(36), k, size, page: HOME.page, app: WIDGETS[k].app });
    toast(T('Виджет добавлен', 'Віджет додано', 'Widget added'), 'g');
    renderHomeScreen();
  },
};
