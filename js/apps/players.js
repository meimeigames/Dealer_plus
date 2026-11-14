// Public player profiles (tap a row on the Leaderboard) and the profile editor (avatar, colour, frame, banner,
// title, bio). Profiles load from the server (gr_profile) and are cached; your own shows your live numbers.
import { G } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { fmt } from '../core/money.js';
import { COUNTRY, countryOf, CITY } from '../data/world.js';
import { rerender, toast, openApp, UI } from '../ui/shell.js';
import { netWorth, repScore } from '../game/player.js';
import { onlineEnabled, isRegistered, homeData, playerProfile, cachedProfile, friendRequestNick, friendRespond, nudge, errText, sync, pushProfile } from '../game/online.js';
import { AVATARS, COLORS, FRAMES, BANNERS, TITLES, findIn, prof, setProf, publicProfile, myBadges, pAvatar, titleChip, bannerCss, badgeHtml } from '../game/profile.js';
import { sfx } from '../ui/sfx.js';

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return T('только что', 'щойно', 'just now');
  if (s < 3600) return T(`${Math.round(s / 60)} мин назад`, `${Math.round(s / 60)} хв тому`, `${Math.round(s / 60)} min ago`);
  if (s < 86400) return T(`${Math.round(s / 3600)} ч назад`, `${Math.round(s / 3600)} год тому`, `${Math.round(s / 3600)} h ago`);
  return T(`${Math.round(s / 86400)} дн назад`, `${Math.round(s / 86400)} дн тому`, `${Math.round(s / 86400)} d ago`);
};
const hrs = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} ${T('ч', 'год', 'h')} ${Math.round((sec % 3600) / 60)} ${T('мин', 'хв', 'min')}` : `${Math.round(sec / 60)} ${T('мин', 'хв', 'min')}`);
const tile = (label, val) => `<div class="pp-st"><small>${label}</small><b>${val}</b></div>`;
const isMe = (nick) => isRegistered() && nick === G.s.online.nick || (!isRegistered() && nick === G.s.player.name);

// the board row for a nickname (instant data while the full profile loads)
function rowFor(nick) {
  const b = homeData()?.boards || {};
  for (const k of ['global', 'region', 'friends']) { const r = (b[k] || []).find((x) => x.nick === nick); if (r) return r; }
  return null;
}
export function playerView(p) {
  const nick = p.nick || '';
  const me = isMe(nick);
  const c = cachedProfile(nick);
  if (onlineEnabled() && (!c || Date.now() - (c.at || 0) > 20000) && !c?.busy) setTimeout(() => playerProfile(nick, true), 0);
  const d = c?.data || null, row = rowFor(nick);
  const s = G.s;
  const pp = me ? publicProfile() : d?.profile || row?.p || {};
  const st = me ? { sold: s.stats.sold || 0, profit: Math.round(s.stats.profit || 0), shops: s.biz.shops.length, rep: repScore() || 0, reviews: s.rep.n || 0, best: Math.round(s.stats.bestFlip || 0), repairs: s.stats.repairs || 0 } : d?.stats || {};
  const worth = me ? netWorth() : +(d?.worth ?? row?.worth ?? 0);
  const level = me ? s.level : d?.level ?? row?.level ?? '—';
  const region = me ? countryOf(s.player.city).id : d?.region || row?.region || '';
  const online = me || d?.online || row?.on;
  const flag = COUNTRY[region]?.flag || '🌐';
  let h = `<div class="pp-hero" style="background:${bannerCss(pp.bn)}"></div><div class="pp-head">${pAvatar(pp, nick, 'xl')}<div class="grow"><b class="pp-nick">${esc(nick)}</b>${titleChip(pp)}
    <div class="small m">${flag} ${esc(pp.city || region)} · ${online ? `<span class="g">● ${T('в сети', 'у мережі', 'online')}</span>` : d?.seen ? `${T('был(а)', 'був(ла)', 'seen')} ${ago(d.seen)}` : T('не в сети', 'не в мережі', 'offline')}</div></div></div>`;
  if (pp.bio) h += `<div class="pp-bio">${esc(pp.bio)}</div>`;
  if (!me && !d && c?.err) h += `<div class="small r mb">${esc(c.err)}</div>`;
  if (!me && !d && !c?.err) h += `<div class="small m mb">${T('Загружаем профиль…', 'Завантажуємо профіль…', 'Loading profile…')}</div>`;
  h += `<div class="pp-grid">${tile(T('Капитал', 'Капітал', 'Net worth'), `<span class="g">${fmt(worth, { short: true })}</span>`)}${tile(T('Уровень', 'Рівень', 'Level'), level)}
    ${d?.rank ? tile(T('Место в мире', 'Місце у світі', 'World rank'), '#' + d.rank) : ''}${d?.rank_region ? tile(`${flag} ${T('В стране', 'У країні', 'In country')}`, '#' + d.rank_region) : ''}
    ${tile(T('Продаж', 'Продажів', 'Sales'), st.sold ?? 0)}${tile(T('Прибыль', 'Прибуток', 'Profit'), fmt(st.profit || 0, { short: true }))}
    ${st.best ? tile(T('Лучшая сделка', 'Найкраща угода', 'Best flip'), fmt(st.best, { short: true })) : ''}${tile(T('Магазинов', 'Магазинів', 'Stores'), st.shops ?? 0)}
    ${tile(T('Отзывы', 'Відгуки', 'Reviews'), st.rep ? `★ ${(+st.rep).toFixed(2)}${st.reviews ? ` <small>(${st.reviews})</small>` : ''}` : '—')}${st.repairs ? tile(T('Ремонтов', 'Ремонтів', 'Repairs'), st.repairs) : ''}
    ${d?.friends != null ? tile(T('Друзей', 'Друзів', 'Friends'), d.friends) : ''}${d?.playtime ? tile(T('В игре', 'У грі', 'Played'), hrs(d.playtime)) : me ? tile(T('В игре', 'У грі', 'Played'), hrs(s.playSec || 0)) : ''}</div>`;
  const bd = (me ? myBadges() : pp.bd || []).map(badgeHtml).join('');
  if (bd) h += `<h3 class="sub">${T('Значки', 'Значки', 'Badges')}</h3><div class="pp-badges">${bd}</div>`;
  if (d?.since) h += `<div class="tiny m mt">${T('В рейтинге с', 'У рейтингу з', 'On the board since')} ${new Date(d.since).toLocaleDateString()}</div>`;
  // actions
  let a = '';
  if (me) a += `<button class="btn block" data-a="open" data-v="profile" data-w="custom">🎨 ${T('Настроить свой профиль', 'Налаштувати свій профіль', 'Customize your profile')}</button>`;
  else if (isRegistered() && d) {
    if (d.friend === 'no') a += `<button class="btn block" data-a="pfadd" data-v="${esc(nick)}">➕ ${T('Добавить в друзья', 'Додати в друзі', 'Add friend')}</button>`;
    if (d.friend === 'sent') a += `<button class="btn dark block" disabled>⏳ ${T('Заявка отправлена', 'Заявку надіслано', 'Request sent')}</button>`;
    if (d.friend === 'incoming') a += `<button class="btn green block" data-a="pfacc" data-v="${esc(nick)}">✓ ${T('Принять заявку в друзья', 'Прийняти заявку в друзі', 'Accept friend request')}</button>`;
    if (d.friend === 'yes' && d.pid) a += `<div class="btns"><button class="btn" data-a="sendf" data-v="${d.pid}">💸 ${T('Перевести', 'Переказати', 'Send money')}</button><button class="btn dark" data-a="nudge" data-v="${d.pid}">👋 ${T('Привет', 'Привіт', 'Wave')}</button></div>`;
  } else if (!isRegistered() && onlineEnabled()) a += `<div class="small m">${T('Войдите в онлайн‑рейтинг, чтобы добавлять игроков в друзья.', 'Увійдіть в онлайн‑рейтинг, щоб додавати гравців у друзі.', 'Join the online board to add friends.')}</div>`;
  return h + (a ? `<div class="mt">${a}</div>` : '');
}
export const playerActions = {
  pview: (nick) => import('../ui/shell.js').then(({ go }) => go('player', { nick })),
  pfadd: async (nick) => { try { const r = await friendRequestNick(nick); sfx('ok'); toast(r?.status === 'accepted' ? T('Теперь вы друзья!', 'Тепер ви друзі!', 'Now friends!') : T('Заявка отправлена', 'Заявку надіслано', 'Request sent'), 'g'); } catch (e) { toast(errText(e), 'r'); } await playerProfile(nick, true); sync().catch(() => {}); },
  pfacc: async (nick) => { const d = cachedProfile(nick)?.data; if (!d?.pid) return; try { await friendRespond(d.pid, true); sfx('win'); toast(T('Теперь вы друзья!', 'Тепер ви друзі!', 'Now friends!'), 'g'); } catch (e) { toast(errText(e), 'r'); } await playerProfile(nick, true); sync().catch(() => {}); },
};

// ---------------------------------------------------------------- editor (Profile app → "custom")
const lockTip = (x) => (x.need() ? '' : `<small>🔒 ${esc(x.hint ? x.hint() : '')}</small>`);
export function customView() {
  const p = prof(), pub = publicProfile(), nick = isRegistered() ? G.s.online.nick : G.s.player.name;
  let h = `<div class="pp-card"><div class="pp-hero sm" style="background:${bannerCss(pub.bn)}"></div><div class="pp-head">${pAvatar(pub, nick, 'xl')}<div class="grow"><b class="pp-nick">${esc(nick)}</b>${titleChip(pub)}<div class="small m">${countryOf(G.s.player.city).flag} ${esc(pub.city)}</div></div></div>${pub.bio ? `<div class="pp-bio">${esc(pub.bio)}</div>` : ''}</div>`;
  h += `<div class="small m mb">${isRegistered() ? T('Так вас видят другие игроки в рейтинге. Изменения уходят на сервер сразу.', 'Так вас бачать інші гравці в рейтингу. Зміни йдуть на сервер одразу.', 'This is how other players see you. Changes go online right away.') : T('Войдите в онлайн‑рейтинг, чтобы профиль видели другие.', 'Увійдіть в онлайн‑рейтинг, щоб профіль бачили інші.', 'Join the online board so others can see it.')}</div>`;
  h += `<h3 class="sub">${T('Аватар', 'Аватар', 'Avatar')}</h3><div class="pc-grid av"><button class="pc-opt ${!p.av ? 'on' : ''}" data-a="pset" data-k="av" data-v="">${esc(String(nick)[0].toUpperCase())}</button>${AVATARS.map((e) => `<button class="pc-opt ${p.av === e ? 'on' : ''}" data-a="pset" data-k="av" data-v="${e}">${e}</button>`).join('')}</div>`;
  h += `<h3 class="sub">${T('Цвет', 'Колір', 'Colour')}</h3><div class="pc-grid col">${COLORS.map((c) => `<button class="pc-sw ${p.c === c ? 'on' : ''}" style="background:${c}" data-a="pset" data-k="c" data-v="${c}"></button>`).join('')}</div>`;
  h += `<h3 class="sub">${T('Рамка', 'Рамка', 'Frame')}</h3><div class="pc-grid fr">${FRAMES.map((f) => `<button class="pc-fr ${pub.fr === f.id ? 'on' : ''} ${f.need() ? '' : 'locked'}" data-a="pset" data-k="fr" data-v="${f.id}">${pAvatar({ ...pub, fr: f.id }, nick, 'md')}<span>${esc(L(f.n))}</span>${lockTip(f)}</button>`).join('')}</div>`;
  h += `<h3 class="sub">${T('Баннер', 'Банер', 'Banner')}</h3><div class="pc-grid bn">${BANNERS.map((b) => `<button class="pc-bn ${pub.bn === b.id ? 'on' : ''} ${b.need() ? '' : 'locked'}" style="background:${b.css}" data-a="pset" data-k="bn" data-v="${b.id}"><span>${esc(L(b.n))}</span>${lockTip(b)}</button>`).join('')}</div>`;
  h += `<h3 class="sub">${T('Титул', 'Титул', 'Title')}</h3><div class="pc-titles">${TITLES.map((t) => `<button class="pc-t ${pub.t === t.id ? 'on' : ''} ${t.need() ? '' : 'locked'}" data-a="pset" data-k="t" data-v="${t.id}">${esc(L(t.n))}${lockTip(t)}</button>`).join('')}</div>`;
  h += `<h3 class="sub">${T('О себе', 'Про себе', 'About')}</h3><textarea class="input" id="pbio" maxlength="90" rows="2" placeholder="${T('Пара слов о себе (до 90 знаков)', 'Кілька слів про себе (до 90 знаків)', 'A few words (up to 90 chars)')}">${esc(p.bio || '')}</textarea><button class="btn block mt" data-a="pbio">${T('Сохранить', 'Зберегти', 'Save')}</button>`;
  const bd = myBadges().map(badgeHtml).join('');
  h += `<h3 class="sub">${T('Значки', 'Значки', 'Badges')}</h3>${bd ? `<div class="pp-badges">${bd}</div>` : `<div class="small m">${T('Значки появляются за достижения в «Заданиях».', 'Значки зʼявляються за досягнення в «Завданнях».', 'Badges come from achievements in Quests.')}</div>`}`;
  return h;
}
export const customActions = {
  pset: (v, el) => {
    const k = el.dataset.k;
    const list = { fr: FRAMES, bn: BANNERS, t: TITLES }[k];
    if (list) { const x = findIn(list, v); if (!x.need()) { toast(`🔒 ${x.hint ? x.hint() : ''}`, 'r'); return; } }
    setProf({ [k]: v }); sfx('tap'); rerender();
    if (isRegistered()) setTimeout(() => pushProfile().catch(() => {}), 600);
  },
  pbio: () => { const v = (document.getElementById('pbio')?.value || '').replace(/\s+/g, ' ').trim().slice(0, 90); setProf({ bio: v }); toast(T('Сохранено', 'Збережено', 'Saved'), 'g'); rerender(); if (isRegistered()) pushProfile().catch(() => {}); },
};
