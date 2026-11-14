// Profile customization: avatar, colour, frame, banner, title, bio and badges. Frames, banners and titles
// unlock with level, net worth and achievements. The public part goes to the online leaderboard (gr_set_profile).
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { CITY } from '../data/world.js';
import { netWorth, getStat } from './player.js';
import { ACH, achTier, SETS, setProgress } from './quests.js';

export const AVATARS = ['😎', '🤑', '🦊', '🐺', '🦁', '🐯', '🐼', '🐸', '🐵', '🦈', '🐉', '🦅', '🐍', '🦄', '👑', '💎', '🔥', '⚡', '🚀', '🎩', '🕶', '🧢', '🤠', '🥷', '🧑‍💻', '👨‍💼', '👩‍💼', '🧔', '💰', '💵', '📱', '🚗', '🏎', '⌚', '👟', '🎮', '🎲', '🃏', '🧿', '☠️', '👽', '🤖', '🍀', '🌚', '🎯', '🏆'];
export const COLORS = ['#2ef2a0', '#4da3ff', '#a78bfa', '#ff5c8a', '#ffb020', '#ff6a3d', '#22d3ee', '#f5d04a', '#e5e7eb', '#34d399', '#f472b6', '#94a3b8', '#ef4444', '#8b5cf6', '#14b8a6', '#eab308'];
const W = (x) => netWorth() >= x;
const lv = (n) => (G.s?.level || 1) >= n;
// need() → true when unlocked; hint → what it takes
export const FRAMES = [
  { id: 'none', n: ['Без рамки', 'Без рамки', 'No frame'], need: () => true },
  { id: 'silver', n: ['Серебро', 'Срібло', 'Silver'], need: () => lv(3), hint: () => T('3 уровень', '3 рівень', 'Level 3') },
  { id: 'gold', n: ['Золото', 'Золото', 'Gold'], need: () => lv(8), hint: () => T('8 уровень', '8 рівень', 'Level 8') },
  { id: 'neon', n: ['Неон', 'Неон', 'Neon'], need: () => lv(12), hint: () => T('12 уровень', '12 рівень', 'Level 12') },
  { id: 'fire', n: ['Огонь', 'Вогонь', 'Fire'], need: () => lv(18), hint: () => T('18 уровень', '18 рівень', 'Level 18') },
  { id: 'ice', n: ['Лёд', 'Лід', 'Ice'], need: () => lv(25), hint: () => T('25 уровень', '25 рівень', 'Level 25') },
  { id: 'cash', n: ['Деньги', 'Гроші', 'Cash'], need: () => W(250000), hint: () => T('капитал $250 000', 'капітал $250 000', 'net worth $250,000') },
  { id: 'diamond', n: ['Бриллиант', 'Діамант', 'Diamond'], need: () => W(1e6), hint: () => T('капитал $1 000 000', 'капітал $1 000 000', 'net worth $1,000,000') },
  { id: 'rainbow', n: ['Радуга', 'Веселка', 'Rainbow'], need: () => lv(40), hint: () => T('40 уровень', '40 рівень', 'Level 40') },
];
const WALL = (id) => `url(assets/walls/${id}.jpg) center/cover`;
export const BANNERS = [
  { id: 'night', n: ['Ночь', 'Ніч', 'Night'], css: 'linear-gradient(135deg,#0f172a,#1e3a8a)', need: () => true },
  { id: 'sunset', n: ['Закат', 'Захід', 'Sunset'], css: 'linear-gradient(135deg,#f97316,#db2777 60%,#7c3aed)', need: () => true },
  { id: 'ocean', n: ['Океан', 'Океан', 'Ocean'], css: 'linear-gradient(135deg,#0ea5e9,#0f766e)', need: () => true },
  { id: 'forest', n: ['Лес', 'Ліс', 'Forest'], css: 'linear-gradient(135deg,#14532d,#65a30d)', need: () => true },
  { id: 'lava', n: ['Лава', 'Лава', 'Lava'], css: 'linear-gradient(135deg,#450a0a,#dc2626 55%,#f59e0b)', need: () => lv(5), hint: () => T('5 уровень', '5 рівень', 'Level 5') },
  { id: 'aurora', n: ['Сияние', 'Сяйво', 'Aurora'], css: 'linear-gradient(135deg,#022c22,#10b981 40%,#6366f1 80%,#a855f7)', need: () => lv(10), hint: () => T('10 уровень', '10 рівень', 'Level 10') },
  { id: 'w_synthwave', n: ['Синтвейв', 'Синтвейв', 'Synthwave'], css: WALL('synthwave'), need: () => lv(6), hint: () => T('6 уровень', '6 рівень', 'Level 6') },
  { id: 'w_milkyway', n: ['Млечный путь', 'Чумацький шлях', 'Milky Way'], css: WALL('milkyway'), need: () => lv(9), hint: () => T('9 уровень', '9 рівень', 'Level 9') },
  { id: 'w_neonrain', n: ['Неоновый дождь', 'Неоновий дощ', 'Neon rain'], css: WALL('neonrain'), need: () => lv(14), hint: () => T('14 уровень', '14 рівень', 'Level 14') },
  { id: 'w_supercar', n: ['Суперкар', 'Суперкар', 'Supercar'], css: WALL('supercar'), need: () => (G.s?.inv || []).some((x) => x.cat === 'cars'), hint: () => T('своя машина', 'своє авто', 'own a car') },
  { id: 'w_bridge', n: ['Ночной город', 'Нічне місто', 'Night city'], css: WALL('bridge'), need: () => W(50000), hint: () => T('капитал $50 000', 'капітал $50 000', 'net worth $50,000') },
  { id: 'w_cash', n: ['Пачки денег', 'Пачки грошей', 'Cash stacks'], css: WALL('cash'), need: () => W(500000), hint: () => T('капитал $500 000', 'капітал $500 000', 'net worth $500,000') },
  { id: 'w_gold', n: ['Золото', 'Золото', 'Gold'], css: WALL('gold'), need: () => W(5e6), hint: () => T('капитал $5 000 000', 'капітал $5 000 000', 'net worth $5,000,000') },
];
export const TITLES = [
  { id: 'newbie', n: ['Новичок', 'Новачок', 'Rookie'], need: () => true },
  { id: 'hustler', n: ['Перекупщик', 'Перекупник', 'Hustler'], need: () => getStat('sold') >= 10, hint: () => T('10 продаж', '10 продажів', '10 sales') },
  { id: 'dealer', n: ['Барыга', 'Барига', 'Wheeler‑dealer'], need: () => getStat('sold') >= 100, hint: () => T('100 продаж', '100 продажів', '100 sales') },
  { id: 'king', n: ['Король объявлений', 'Король оголошень', 'King of classifieds'], need: () => getStat('sold') >= 500, hint: () => T('500 продаж', '500 продажів', '500 sales') },
  { id: 'fixer', n: ['Мастер ремонта', 'Майстер ремонту', 'Fixer'], need: () => getStat('repairs') >= 50, hint: () => T('50 ремонтов', '50 ремонтів', '50 repairs') },
  { id: 'detective', n: ['Детектор фейков', 'Детектор фейків', 'Fake detector'], need: () => getStat('legit') >= 50, hint: () => T('50 легит‑чеков', '50 легіт‑чеків', '50 legit checks') },
  { id: 'honest', n: ['Честный продавец', 'Чесний продавець', 'Honest seller'], need: () => (G.s?.rep?.n || 0) >= 20 && G.s.rep.sum / G.s.rep.n >= 4.8, hint: () => T('20 отзывов, ★4.8+', '20 відгуків, ★4.8+', '20 reviews, ★4.8+') },
  { id: 'traveler', n: ['Путешественник', 'Мандрівник', 'Globetrotter'], need: () => getStat('abroad') >= 10, hint: () => T('10 поездок за границу', '10 поїздок за кордон', '10 trips abroad') },
  { id: 'collector', n: ['Коллекционер', 'Колекціонер', 'Collector'], need: () => SETS.some((x) => setProgress(x).done), hint: () => T('собрать коллекцию', 'зібрати колекцію', 'complete a collection') },
  { id: 'shark', n: ['Акула рынка', 'Акула ринку', 'Market shark'], need: () => W(100000), hint: () => T('капитал $100 000', 'капітал $100 000', 'net worth $100,000') },
  { id: 'boss', n: ['Босс сети', 'Бос мережі', 'Chain boss'], need: () => (G.s?.biz?.shops?.length || 0) >= 3, hint: () => T('3 магазина', '3 магазини', '3 stores') },
  { id: 'mogul', n: ['Магнат', 'Магнат', 'Mogul'], need: () => W(1e6), hint: () => T('капитал $1 000 000', 'капітал $1 000 000', 'net worth $1,000,000') },
  { id: 'tycoon', n: ['Олигарх', 'Олігарх', 'Tycoon'], need: () => W(1e8), hint: () => T('капитал $100 000 000', 'капітал $100 000 000', 'net worth $100,000,000') },
];
const BADGE_IC = { sold: '🏷', profit: '💰', repairs: '🛠', freebies: '🎁', legit: '🔍', shifts: '💼', auctionsWon: '🔨', boxes: '🎲', scamsCaught: '🛡', abroad: '✈️', shopSales: '🏪', rareFound: '💎' };
const TIER_C = ['', '#cd7f32', '#c0c0c0', '#ffd34d', '#7dd3fc'];
export const findIn = (list, id) => list.find((x) => x.id === id) || list[0];

export function prof() {
  const s = G.s;
  s.prof ||= { av: '', c: COLORS[0], fr: 'none', bn: 'night', t: 'newbie', bio: '' };
  return s.prof;
}
// earned badges: the best tier of each achievement (highest first), e.g. "sold3"
export function myBadges() {
  return ACH.map((a) => ({ stat: a.stat, t: achTier(a) })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t).slice(0, 8).map((x) => x.stat + x.t);
}
export function publicProfile() {
  const p = prof();
  const ok = (list, id) => (findIn(list, id).need() ? id : list[0].id);
  return { av: p.av || '', c: p.c, fr: ok(FRAMES, p.fr), bn: ok(BANNERS, p.bn), t: ok(TITLES, p.t), bio: (p.bio || '').slice(0, 90), bd: myBadges(), best: Math.round(G.s.stats.bestFlip || 0), city: L(CITY[G.s.player.city]?.name || ['', '', '']).slice(0, 24) };
}
export function setProf(patch) {
  Object.assign(prof(), patch);
  G.s.online ||= {};
  G.s.online.profDirty = true;
  emit('online'); emit('quests');
}

// ---------------------------------------------------------------- rendering (shared by the board, profiles and the editor)
const hueOf = (nick) => ((String(nick || '?').charCodeAt(0) || 63) * 37) % 360;
// p = public profile ({ av, c, fr, ... }); size: '' | 'md' | 'xl'
export function pAvatar(p, nick, size = '') {
  const c = /^#[0-9a-f]{6}$/i.test(p?.c || '') ? p.c : `hsl(${hueOf(nick)} 80% 65%)`;
  const inner = p?.av ? `<span class="pav-e">${esc(p.av)}</span>` : `<span class="pav-l">${esc(String(nick || '?')[0].toUpperCase())}</span>`;
  const fr = /^[a-z]+$/.test(p?.fr || '') && p.fr !== 'none' ? ` fr-${p.fr}` : '';
  return `<div class="pav ${size}${fr}" style="--pc:${c}">${inner}</div>`;
}
export const titleName = (id) => (id && id !== 'newbie' ? L(findIn(TITLES, id).n) : '');
export const titleChip = (p) => (p?.t && p.t !== 'newbie' && TITLES.some((x) => x.id === p.t) ? `<span class="ptitle" style="--pc:${/^#[0-9a-f]{6}$/i.test(p.c || '') ? p.c : '#2ef2a0'}">${esc(titleName(p.t))}</span>` : '');
export const bannerCss = (id) => (BANNERS.find((x) => x.id === id) || BANNERS[0]).css;
export function badgeHtml(code) {
  const m = /^([a-zA-Z]+)(\d)$/.exec(code || '');
  if (!m || !BADGE_IC[m[1]]) return '';
  const a = ACH.find((x) => x.stat === m[1]);
  return `<span class="pbadge" style="--bc:${TIER_C[+m[2]] || '#999'}" title="${esc(a ? L(a.n) : '')}">${BADGE_IC[m[1]]}<i>${'★'.repeat(+m[2])}</i></span>`;
}
