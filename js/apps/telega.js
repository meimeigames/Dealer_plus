// «Телега» — styled after Telegram: a left drawer (profile, contacts, settings, night mode), chat folders,
// channels / groups / private chats with bubbles, a group's info page with its members and admins, your own
// profile with a unique @username (the server makes sure only one player holds it), and selling through a
// channel admin: agree their cut, the post goes out, a buyer writes, you meet in person.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { fmt } from '../core/money.js';
import { rerender, toast, choose, confirmBox, openApp, go, UI, sheet, resolveSheet } from '../ui/shell.js';
import { img } from '../ui/comp.js';
import { itemTitle, knownDefects, defectName } from '../game/items.js';
import { sfx } from '../ui/sfx.js';
import {
  CHANNELS, chName, tgState, joined, entryFee, join, postsOf, buyPost, requests, matchesFor, fulfil,
  adminOf, chKind, tgMe, membersOf, dmOf, openDm, dmSay, dmList, tgDeals, dealById, eligibleFor, proposeSale,
  haggleShare, setDealPrice, agreeDeal, cancelDeal, declineBuyer, meetBuyer,
} from '../game/tg.js';
import { onlineEnabled, isRegistered, tgCheck, tgClaim, tgRelease, TG_NAME_RE } from '../game/online.js';

const TV = { folder: 'all', drawer: false, q: '', search: false };
const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n));
const hm = (t) => { const m = ((t % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const when = (t) => { const d = Math.floor(G.s.t / 1440) - Math.floor(t / 1440); return d <= 0 ? hm(t) : d === 1 ? T('вчера', 'вчора', 'yesterday') : `${d} ${T('дн', 'дн', 'd')}`; };
const COLS = ['#e17076', '#7bc862', '#e5ca77', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];
const colOf = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLS[h % COLS.length]; };
const ini = (name) => esc(Array.from(String(name || '?').replace(/^[@_\s.\-]+/, ''))[0]?.toUpperCase() || '?');
const ava = (name, o = {}) => `<span class="tgx-ava ${o.cls || ''}" style="background:${o.col || colOf(name)}">${o.ic || ini(name)}</span>`;
const isLight = () => !!tgState().light;
const top = (left, mid, right = '') => `<div class="tgx-top">${left}${mid}${right}</div>`;
const backBtn = `<button class="tgx-ib" data-a="back">‹</button>`;
const statusTx = (seen) => (seen === 'online' ? `<span class="tgx-on">${T('в сети', 'у мережі', 'online')}</span>` : seen === 'week' ? T('был(а) на этой неделе', 'був(ла) цього тижня', 'last seen this week') : T('был(а) недавно', 'був(ла) нещодавно', 'last seen recently'));
// after a reply in a private chat: re-render and stay at the newest message
const rr = () => { rerender(); setTimeout(() => { const b = document.querySelector('#appwin .abody'); if (b && UI.view === 'dm') b.scrollTop = b.scrollHeight; }, 90); };
const wrap = (h) => `<div class="tgx${isLight() ? ' light' : ''}">${h}</div>`;

// ---------------------------------------------------------------- chat list
function unreadCh(c) { const st = tgState(); if (!joined(c)) return 0; const seen = st.seen[c.id] || 0; return postsOf(c).filter((p) => p.at > seen).length; }
function chatRows() {
  const rows = [];
  for (const c of CHANNELS) {
    const posts = postsOf(c), last = posts[0];
    const kind = chKind(c);
    rows.push({ key: 'ch_' + c.id, kind, name: chName(c), ic: c.ic, col: c.col, lock: !!c.fee && !joined(c), at: last?.at ?? 0, prev: last ? (last.news || `${last.handle ? `${esc(last.handle.replace('@', ''))}: ` : ''}${itemTitle(last.it)} — ${fmt(last.price)}`) : T('Пока тихо', 'Поки тихо', 'Quiet'), unread: unreadCh(c), act: 'tgopen', v: c.id, muted: kind === 'channel' });
  }
  for (const d of dmList()) {
    const last = d.msgs[d.msgs.length - 1];
    rows.push({ key: 'dm_' + d.id, kind: 'dm', name: d.who, at: d.at, prev: last ? `${last.me ? `<span class="tgx-you">${T('Вы', 'Ви', 'You')}:</span> ` : ''}${esc(last.tx)}` : '', unread: d.unread || 0, act: 'tgdm', v: d.id, check: last?.me });
  }
  return rows.sort((a, b) => b.at - a.at);
}
function mainView() {
  const st = tgState(), me = tgMe();
  const folders = [['all', T('Все', 'Усі', 'All')], ['dm', T('Личные', 'Особисті', 'Personal')], ['group', T('Группы', 'Групи', 'Groups')], ['channel', T('Каналы', 'Канали', 'Channels')], ['rq', T('Заказы', 'Замовлення', 'Orders')]];
  const rows = chatRows();
  const cnt = (f) => rows.filter((r) => r.kind === f).reduce((a, r) => a + (r.unread ? 1 : 0), 0);
  let h = top(`<button class="tgx-ib" data-a="tgdrawer">☰</button>`, `<div class="tgx-title">${T('Телега', 'Телега', 'Telega')}</div>`, `<button class="tgx-ib" data-a="tgsearch">🔍</button>`);
  if (TV.search) h += `<div class="tgx-search"><input class="tgx-in" placeholder="${T('Поиск', 'Пошук', 'Search')}" value="${esc(TV.q)}" data-in="tgq" autocomplete="off"></div>`;
  h += `<div class="tgx-folders">${folders.map(([f, n]) => { const c = f === 'all' || f === 'rq' ? 0 : cnt(f); return `<button class="${TV.folder === f ? 'on' : ''}" data-a="tgfolder" data-v="${f}">${n}${c ? ` <i>${c}</i>` : ''}</button>`; }).join('')}</div>`;
  if (TV.folder === 'rq') h += requestsList();
  else {
    const q = TV.q.trim().toLowerCase();
    const list = rows.filter((r) => (TV.folder === 'all' || r.kind === TV.folder) && (!q || r.name.toLowerCase().includes(q)));
    h += `<div class="tgx-list">${list.map((r) => `<div class="tgx-row" data-a="${r.act}" data-v="${esc(r.v)}" data-key="${r.key}">${ava(r.name, { ic: r.ic, col: r.col })}<div class="tgx-mid"><div class="tgx-l1"><b>${r.kind === 'channel' ? '📢 ' : r.kind === 'group' ? '👥 ' : ''}${esc(r.name)}${r.lock ? ' 🔒' : ''}${r.muted ? ' <span class="tgx-mute">🔇</span>' : ''}</b><small>${r.check ? '<span class="tgx-chk">✓✓</span> ' : ''}${r.at ? when(r.at) : ''}</small></div><div class="tgx-l2"><span>${r.prev}</span>${r.unread ? `<i class="tgx-badge${r.muted ? ' mute' : ''}">${r.unread}</i>` : ''}</div></div></div>`).join('') || `<p class="tgx-empty">${T('Ничего не найдено', 'Нічого не знайдено', 'Nothing found')}</p>`}</div>`;
  }
  h += `<button class="tgx-fab" data-a="tgcompose">✏️</button>`;
  if (TV.drawer) h += drawer(me);
  return wrap(h);
}
function drawer(me) {
  const st = tgState();
  return `<div class="tgx-dim" data-a="tgdrawer"></div><aside class="tgx-drawer">
    <div class="tgx-dhead" data-a="go" data-v="me">${ava(me.name, { ic: me.av, col: me.col, cls: 'lg' })}<div><b>${esc(me.name)}</b><small>${me.user ? '@' + esc(me.user) : T('Задайте имя пользователя', 'Задайте імʼя користувача', 'Set a username')}</small></div></div>
    <div class="tgx-ditem" data-a="go" data-v="me">👤 ${T('Мой профиль', 'Мій профіль', 'My profile')}</div>
    <div class="tgx-ditem" data-a="tgfolder" data-v="dm">💬 ${T('Личные чаты', 'Особисті чати', 'Private chats')}</div>
    <div class="tgx-ditem" data-a="go" data-v="contacts">👥 ${T('Контакты', 'Контакти', 'Contacts')}</div>
    <div class="tgx-ditem" data-a="go" data-v="deals">💼 ${T('Мои сделки через каналы', 'Мої угоди через канали', 'My channel deals')}${tgDeals().filter((d) => ['offer', 'posted', 'buyer'].includes(d.st)).length ? ` <i class="tgx-badge">${tgDeals().filter((d) => ['offer', 'posted', 'buyer'].includes(d.st)).length}</i>` : ''}</div>
    <div class="tgx-ditem" data-a="tgfolder" data-v="rq">📦 ${T('Заказы участников', 'Замовлення учасників', 'Members’ orders')}</div>
    <div class="tgx-ditem" data-a="go" data-v="me">⚙️ ${T('Настройки', 'Налаштування', 'Settings')}</div>
    <div class="tgx-ditem" data-a="tgnight">🌙 ${T('Ночной режим', 'Нічний режим', 'Night mode')}<span class="tgx-sw ${!isLight() ? 'on' : ''}"><i></i></span></div>
    <div class="tgx-dfoot">Telega for iPhone · v11.4</div>
  </aside>`;
}
function requestsList() {
  const rqs = requests();
  return `<div class="tgx-pad"><p class="tgx-hint">${T('Участники чатов ищут конкретные вещи. Есть такая на складе — продайте сразу по их цене.', 'Учасники чатів шукають конкретні речі. Є така на складі — продайте одразу за їхньою ціною.', 'Chat members want specific things. Have one in storage? Sell it right away at their price.')}</p>` + rqs.map((rq) => { const has = matchesFor(rq).length; return `<div class="tgx-card"><div class="row between"><b>${esc(rq.who)}</b><span class="tgx-pay">${fmt(rq.budget)}</span></div><div>${T('Ищу', 'Шукаю', 'Looking for')}: ${esc(rq.title)}</div>${rq.done ? `<div class="small g">✅ ${T('Продано', 'Продано', 'Sold')}</div>` : has ? `<button class="tgx-btn" data-a="tgfill" data-v="${rq.id}">${T(`Продать (${has} шт на складе)`, `Продати (${has} шт на складі)`, `Sell (${has} in storage)`)}</button>` : `<div class="small m">${T('Такой вещи у вас нет', 'Такої речі у вас немає', 'You don’t have one')}</div>`}</div>`; }).join('') + '</div>';
}

// ---------------------------------------------------------------- a channel / group
function postBubble(p, c, locked, group) {
  const t = hm(p.at);
  if (p.news) return `<div class="tgx-msg in"><div class="tgx-bub">${group ? '' : `<b class="tgx-from" style="color:${c.col}">${esc(chName(c))}</b>`}📣 ${esc(p.news)}${p.go ? `<div class="tgx-ikb"><button data-a="open" data-v="${p.go}">${T('Открыть', 'Відкрити', 'Open')} ›</button></div>` : ''}<span class="tgx-meta">👁 ${k(p.views)} · ${t}</span></div></div>`;
  const kd = knownDefects(p.it).map((d) => defectName(d.c).toLowerCase());
  const cond = kd.length ? kd.slice(0, 2).join(', ') : p.it.cond >= 85 ? T('отличное состояние', 'відмінний стан', 'great condition') : T('потёртости и царапины', 'потертості й подряпини', 'scuffs and scratches');
  const from = group ? `<b class="tgx-from" style="color:${colOf(p.handle)}">${esc(p.handle.replace('@', ''))}</b>` : `<b class="tgx-from" style="color:${c.col}">${esc(chName(c))}</b>`;
  const btn = locked ? `<div class="tgx-lock">🔒 ${T('Вступите, чтобы купить', 'Вступіть, щоб купити', 'Join to buy')}</div>` : p.sold ? `<div class="tgx-lock">✅ ${T('Продано', 'Продано', 'Sold')}</div>` : `<div class="tgx-ikb"><button data-a="tgbuy" data-v="${p.id}" data-w="${c.id}">${T('Купить', 'Купити', 'Buy')} · ${fmt(p.price)}</button>${p.handle && !c.contra ? '' : ''}</div>`;
  return `<div class="tgx-msg in${group ? ' g' : ''}">${group ? ava(p.handle, { cls: 'xs' }) : ''}<div class="tgx-bub ${locked ? 'locked' : ''}">${from}<div class="tgx-img">${img(p.it)}</div>• ${esc(itemTitle(p.it))} · ${esc(cond)}<br>${esc(p.note || '')}<br>💰 <b>${fmt(p.price)}</b> <s>${fmt(p.mkt)}</s>${btn}<span class="tgx-meta">👁 ${k(p.views)} · ${t}</span></div></div>`;
}
function chatView(p) {
  const c = CHANNELS.find((x) => x.id === p.id); if (!c) return mainView();
  const st = tgState(), lock = !joined(c), kind = chKind(c), group = kind === 'group';
  st.seen[c.id] = G.s.t;
  const posts = postsOf(c).slice().reverse();
  const mine = tgDeals().filter((d) => d.ch === c.id && ['posted', 'buyer'].includes(d.st));
  let h = top(backBtn, `<div class="tgx-hd" data-a="go" data-v="info" data-id="${c.id}">${ava(chName(c), { ic: c.ic, col: c.col, cls: 'sm' })}<div><b>${esc(chName(c))}${c.fee ? ' 🔒' : ''}</b><small>${k(c.members)} ${group ? T('участников', 'учасників', 'members') : T('подписчиков', 'підписників', 'subscribers')}</small></div></div>`, `<button class="tgx-ib" data-a="go" data-v="info" data-id="${c.id}">⋮</button>`);
  h += `<div class="tgx-feed">`;
  if (lock) h += `<div class="tgx-sys">${T('Что сейчас в чате:', 'Що зараз у чаті:', 'In the chat now:')}</div>`;
  h += (lock ? posts.slice(-2) : posts).map((x) => postBubble(x, c, lock, group)).join('') || `<div class="tgx-sys">${T('Пока тихо', 'Поки тихо', 'Quiet for now')}</div>`;
  h += mine.map((d) => `<div class="tgx-msg in${group ? ' g' : ''}">${group ? ava(adminOf(c).name, { cls: 'xs' }) : ''}<div class="tgx-bub"><b class="tgx-from" style="color:${c.col}">${esc(adminOf(c).name)}</b>🔥 ${esc(d.title)}<br>💰 <b>${fmt(d.price)}</b><br>✍️ ${T('Писать', 'Писати', 'DM')} ${esc(tgMe().user ? '@' + tgMe().user : tgMe().name)}<span class="tgx-meta">${T('ваш пост', 'ваш пост', 'your post')} · ${hm(d.at)}</span></div></div>`).join('');
  h += `</div>`;
  if (lock) h += `<div class="tgx-bottom"><button class="tgx-join" data-a="tgjoin" data-v="${c.id}">${T(`Вступить за ${fmt(entryFee(c))}`, `Вступити за ${fmt(entryFee(c))}`, `Join for ${fmt(entryFee(c))}`)}</button></div>`;
  else if (!group) h += `<div class="tgx-bottom"><button class="tgx-join ghost" data-a="go" data-v="info" data-id="${c.id}">🔇 ${T('Без звука', 'Без звуку', 'Mute')}</button></div>`;
  else h += `<div class="tgx-bottom tgx-inputbar"><span>📎</span><div class="tgx-fake" data-a="tgadmin" data-v="${c.id}">${T('Хотите продать? Напишите админу…', 'Хочете продати? Напишіть адміну…', 'Want to sell? Message the admin…')}</div><span>🎤</span></div>`;
  return wrap(h);
}
function infoView(p) {
  const c = CHANNELS.find((x) => x.id === p.id); if (!c) return mainView();
  const a = adminOf(c), group = chKind(c) === 'group';
  let h = top(backBtn, `<div class="tgx-title">${group ? T('Группа', 'Група', 'Group') : T('Канал', 'Канал', 'Channel')}</div>`);
  h += `<div class="tgx-prof">${ava(chName(c), { ic: c.ic, col: c.col, cls: 'xl' })}<b>${esc(chName(c))}</b><small>${k(c.members)} ${group ? T('участников', 'учасників', 'members') : T('подписчиков', 'підписників', 'subscribers')}</small></div>`;
  h += `<div class="tgx-sec"><div class="tgx-kv"><small>${T('Описание', 'Опис', 'About')}</small>${esc(L(c.about))}</div><div class="tgx-kv"><small>${T('Ссылка', 'Посилання', 'Link')}</small><span class="tgx-link">t.me/${c.fee ? '+' + c.id.toUpperCase() + 'x9Kq' : c.id + '_' + (G.s.player.city || '').slice(0, 3)}</span></div></div>`;
  const accepts = { shade: T('берёт любой товар, в т.ч. краденое и запрещёнку', 'бере будь‑який товар, зокрема крадене й заборонене', 'takes anything, stolen and forbidden too'), banned: T('берёт опт и запрещёнку', 'бере опт і заборонене', 'takes wholesale and forbidden goods'), legal: T('только легальные вещи', 'лише легальні речі', 'legal things only'), none: T('рекламу не размещает', 'рекламу не розміщує', 'no ads') }[a.accepts];
  if (group) {
    h += `<div class="tgx-sec"><div class="tgx-sech">${k(c.members)} ${T('участников', 'учасників', 'members')}</div>` + membersOf(c).map((m) => `<div class="tgx-mem" ${m.role ? `data-a="tgadmin" data-v="${c.id}"` : ''}>${ava(m.name)}<div class="grow"><b>${esc(m.name)}</b><small>${statusTx(m.seen)}</small></div>${m.role ? `<span class="tgx-role">${m.role === 'owner' ? T('владелец', 'власник', 'owner') : T('админ', 'адмін', 'admin')}</span>` : ''}</div>`).join('') + `<div class="tgx-more">${T(`и ещё ${k(Math.max(0, c.members - 12))}`, `і ще ${k(Math.max(0, c.members - 12))}`, `and ${k(Math.max(0, c.members - 12))} more`)}</div></div>`;
  } else {
    h += `<div class="tgx-sec"><div class="tgx-sech">${T('Администраторы', 'Адміністратори', 'Admins')}</div><div class="tgx-mem" data-a="tgadmin" data-v="${c.id}">${ava(a.name)}<div class="grow"><b>${esc(a.name)}</b><small>${esc(a.handle)}</small></div><span class="tgx-role">${T('админ', 'адмін', 'admin')}</span></div></div>`;
  }
  h += `<div class="tgx-hint tgx-pad">💼 ${T('Продать через этот чат: напишите админу', 'Продати через цей чат: напишіть адміну', 'To sell here, message the admin')} (${esc(a.handle)}) — ${accepts}${a.share[1] ? `, ${T('доля', 'частка', 'cut')} ${a.share[0]}–${a.share[1]}%` : ''}.</div>`;
  return wrap(h);
}

// ---------------------------------------------------------------- private chats
function quickReplies(d) {
  const out = [];
  if (d.role === 'admin') {
    const c = CHANNELS.find((x) => x.id === d.ch), a = adminOf(c);
    const deal = tgDeals().filter((x) => x.ch === d.ch && ['offer', 'posted', 'buyer'].includes(x.st)).pop();
    if (a.accepts === 'none') return out;
    if (!deal) out.push(['tgsell', d.ch, `💼 ${T('Разместить товар', 'Розмістити товар', 'Post an item')}`]);
    else if (deal.st === 'offer') {
      out.push(['tgagree', deal.id, `✅ ${T('Договорились', 'Домовились', 'Deal')}`]);
      if (!deal.haggled) out.push(['tghaggle', deal.id, `🤝 ${T(`Давай ${Math.max(3, deal.share - 5)}%`, `Давай ${Math.max(3, deal.share - 5)}%`, `${Math.max(3, deal.share - 5)}%?`)}`]);
      out.push(['tgprice', deal.id + ':1.12', `💰 ${T('Цену +12%', 'Ціну +12%', 'Price +12%')}`], ['tgprice', deal.id + ':0.92', `💰 ${T('Цену −8%', 'Ціну −8%', 'Price −8%')}`], ['tgcancel', deal.id, `✖ ${T('Передумал', 'Передумав', 'Never mind')}`]);
    } else if (deal.st === 'posted') out.push(['tgcancel', deal.id, `✖ ${T('Снять пост', 'Зняти пост', 'Take it down')}`]);
  }
  if (d.role === 'buyer') {
    const deal = dealById(d.deal);
    if (deal?.st === 'buyer') out.push(['tgmeet', deal.id, `🤝 ${T(`Встретиться · ${fmt(deal.buyer.offer)}`, `Зустрітися · ${fmt(deal.buyer.offer)}`, `Meet up · ${fmt(deal.buyer.offer)}`)}`], ['tgdecline', deal.id, `✖ ${T('Отказать', 'Відмовити', 'Decline')}`]);
  }
  return out;
}
function dmView(p) {
  const d = dmOf(p.id); if (!d) return mainView();
  d.unread = 0;
  const deal = d.deal ? dealById(d.deal) : null;
  const seen = d.role === 'admin' ? 'online' : 'recent';
  let h = top(backBtn, `<div class="tgx-hd">${ava(d.who, { cls: 'sm' })}<div><b>${esc(d.who)}</b><small>${statusTx(seen)}</small></div></div>`, `<button class="tgx-ib">📞</button>`);
  h += `<div class="tgx-feed">`;
  let day = -1;
  for (const m of d.msgs) {
    const dd = Math.floor(m.t / 1440);
    if (dd !== day) { day = dd; h += `<div class="tgx-sys">${dd === Math.floor(G.s.t / 1440) ? T('Сегодня', 'Сьогодні', 'Today') : `${T('День', 'День', 'Day')} ${dd + 1}`}</div>`; }
    h += `<div class="tgx-msg ${m.me ? 'out' : 'in'}"><div class="tgx-bub">${esc(m.tx)}<span class="tgx-meta">${hm(m.t)}${m.me ? ' <span class="tgx-chk">✓✓</span>' : ''}</span></div></div>`;
  }
  if (deal?.st === 'busted') h += `<div class="tgx-sys r">🚔 ${T('Сделка сорвалась: покупатель оказался полицейским', 'Угода зірвалася: покупець виявився поліцейським', 'The deal fell through: the buyer was a cop')}</div>`;
  h += `</div>`;
  const qr = quickReplies(d);
  h += `<div class="tgx-dock"><div class="tgx-qr">${qr.map(([a, v, n]) => `<button data-a="${a}" data-v="${esc(v)}">${n}</button>`).join('')}</div>`;
  h += `<div class="tgx-bottom tgx-inputbar"><span>📎</span><div class="tgx-fake">${T('Сообщение', 'Повідомлення', 'Message')}</div><span>🎤</span></div></div>`;
  return wrap(h);
}
function contactsView() {
  const list = dmList();
  let h = top(backBtn, `<div class="tgx-title">${T('Контакты', 'Контакти', 'Contacts')}</div>`);
  h += `<div class="tgx-list">${list.map((d) => `<div class="tgx-row" data-a="tgdm" data-v="${esc(d.id)}">${ava(d.who)}<div class="tgx-mid"><div class="tgx-l1"><b>${esc(d.who)}</b></div><div class="tgx-l2"><span>${esc(d.handle || '')} · ${d.role === 'admin' ? T('админ канала', 'адмін каналу', 'channel admin') : T('покупатель', 'покупець', 'buyer')}</span></div></div></div>`).join('') || `<p class="tgx-empty">${T('Контактов пока нет — напишите админу какого‑нибудь чата', 'Контактів поки немає — напишіть адміну якогось чату', 'No contacts yet — message a chat admin')}</p>`}</div>`;
  return wrap(h);
}
function dealsView() {
  const ds = tgDeals().slice().reverse();
  const stName = { offer: T('обсуждаем', 'обговорюємо', 'negotiating'), posted: T('пост висит, ждём покупателя', 'пост висить, чекаємо покупця', 'posted, waiting for a buyer'), buyer: T('покупатель ждёт встречи', 'покупець чекає зустрічі', 'buyer waiting to meet'), done: T('продано', 'продано', 'sold'), busted: T('задержание', 'затримання', 'busted'), cancel: T('отменено', 'скасовано', 'cancelled') };
  let h = top(backBtn, `<div class="tgx-title">${T('Сделки через каналы', 'Угоди через канали', 'Channel deals')}</div>`);
  h += `<div class="tgx-pad">` + (ds.map((d) => { const c = CHANNELS.find((x) => x.id === d.ch); return `<div class="tgx-card" data-a="tgdm" data-v="${d.st === 'buyer' ? 'buy_' + d.id : 'adm_' + d.ch}"><div class="row between"><b>${esc(d.title)}</b><span class="${d.st === 'done' ? 'g' : d.st === 'busted' ? 'r' : 'm'} small">${stName[d.st]}</span></div><div class="small m">${c.ic} ${esc(chName(c))} · ${T('доля админа', 'частка адміна', 'admin cut')} ${d.share}% · ${fmt(d.buyer?.offer || d.price)}${d.net ? ` · ${T('вам', 'вам', 'you')} ${fmt(d.net)}` : ''}</div></div>`; }).join('') || `<p class="tgx-empty">${T('Пока нет. Зайдите в группу → нажмите на название → напишите админу.', 'Поки немає. Зайдіть у групу → натисніть на назву → напишіть адміну.', 'None yet. Open a group → tap its name → message the admin.')}</p>`) + `</div>`;
  return wrap(h);
}

// ---------------------------------------------------------------- my profile & settings
const AVS = ['🙂', '😎', '🦊', '🐺', '🦁', '🐯', '🐸', '🐼', '👽', '🤖', '💀', '🎩', '🕶', '💸', '🔥', '⚡', '🚗', '📦', '🎮', '🍀'];
function meView() {
  const me = tgMe(), st = tgState();
  let h = top(backBtn, `<div class="tgx-title">${T('Настройки', 'Налаштування', 'Settings')}</div>`, `<button class="tgx-ib" data-a="tgedit" data-v="name">✎</button>`);
  h += `<div class="tgx-prof">${ava(me.name, { ic: me.av, col: me.col, cls: 'xl' })}<b>${esc(me.name)}</b><small class="tgx-on">${T('в сети', 'у мережі', 'online')}</small></div>`;
  h += `<div class="tgx-sec"><div class="tgx-sech">${T('Аккаунт', 'Акаунт', 'Account')}</div>
    <div class="tgx-kv click" data-a="tgedit" data-v="phone"><b>+${esc(phoneOf())}</b><small>${T('Нажмите, чтобы изменить номер', 'Натисніть, щоб змінити номер', 'Tap to change number')}</small></div>
    <div class="tgx-kv click" data-a="tgedit" data-v="user"><b>${me.user ? '@' + esc(me.user) : T('Не задано', 'Не задано', 'Not set')}</b><small>${T('Имя пользователя', 'Імʼя користувача', 'Username')}${me.user ? (me.claimed ? ` · ✅ ${T('закреплено за вами на сервере', 'закріплено за вами на сервері', 'reserved for you on the server')}` : ` · ⚠️ ${T('не закреплено (нет онлайна)', 'не закріплено (немає онлайну)', 'not reserved (offline)')}`) : ''}</small></div>
    <div class="tgx-kv click" data-a="tgedit" data-v="bio"><b>${me.bio ? esc(me.bio) : T('О себе', 'Про себе', 'Bio')}</b><small>${T('Несколько слов о себе', 'Кілька слів про себе', 'A few words about you')}</small></div></div>`;
  h += `<div class="tgx-sec"><div class="tgx-sech">${T('Аватар', 'Аватар', 'Avatar')}</div><div class="tgx-avs">${AVS.map((a) => `<button class="${me.av === a ? 'on' : ''}" data-a="tgav" data-v="${a}">${a}</button>`).join('')}</div><div class="tgx-cols">${COLS.map((c) => `<button class="${me.col === c ? 'on' : ''}" style="background:${c}" data-a="tgcol" data-v="${c}"></button>`).join('')}</div></div>`;
  h += `<div class="tgx-sec"><div class="tgx-sech">${T('Настройки', 'Налаштування', 'Settings')}</div>
    <div class="tgx-ditem" data-a="tgnight">🌙 ${T('Ночной режим', 'Нічний режим', 'Night mode')}<span class="tgx-sw ${!isLight() ? 'on' : ''}"><i></i></span></div>
    <div class="tgx-ditem" data-a="tgmute">🔔 ${T('Уведомления', 'Сповіщення', 'Notifications')}<span class="tgx-sw ${st.mute ? '' : 'on'}"><i></i></span></div>
    <div class="tgx-ditem" data-a="open" data-v="settings">🌐 ${T('Язык', 'Мова', 'Language')}<span class="m small">${T('Русский', 'Українська', 'English')}</span></div>
    <div class="tgx-ditem">🔒 ${T('Конфиденциальность', 'Конфіденційність', 'Privacy')}<span class="m small">${T('номер скрыт', 'номер приховано', 'number hidden')}</span></div></div>`;
  h += `<div class="tgx-dfoot">${T('Имя пользователя уникально: если его занял другой игрок, выберите другое.', 'Імʼя користувача унікальне: якщо його зайняв інший гравець, оберіть інше.', 'Usernames are unique: if another player holds it, pick another.')}</div>`;
  return wrap(h);
}
const phoneOf = () => { const s = G.s; let h = 7; for (const ch of String(s.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const st = tgState(); return st.phone || `380 ${String(h % 100).padStart(2, '0')} ${String((h >>> 7) % 1000).padStart(3, '0')} ${String((h >>> 13) % 100).padStart(2, '0')} ${String((h >>> 19) % 100).padStart(2, '0')}`; };

// ---------------------------------------------------------------- the app
export const tgApp = {
  id: 'tg', glyph: 'plane2', lvl: 1,
  name: ['Телега', 'Телега', 'Telega'], colors: ['#37aee2', '#1e96c8'], glyphColor: '#fff', dark: true,
  bare: true,
  statusBar: () => (isLight() ? { bg: '#ffffff', light: true } : { bg: '#17212b', light: false }),
  views: { main: mainView, chat: chatView, info: infoView, dm: dmView, me: meView, contacts: contactsView, deals: dealsView },
  onOpen: () => { TV.drawer = false; },
  // chats open at the latest message, like Telegram; while you're at the bottom new messages keep it there
  after: (v, nb, p) => {
    if (v !== 'dm' && v !== 'chat') return;
    const key = v + ':' + (p?.id || '');
    if (TV.opened !== key) { TV.opened = key; nb.scrollTop = nb.scrollHeight; requestAnimationFrame(() => { nb.scrollTop = nb.scrollHeight; }); }
  },
  inputs: { tgq: (v) => { TV.q = v; clearTimeout(TV.qt); TV.qt = setTimeout(() => rerender(), 150); } },
  actions: {
    tgdrawer: () => { TV.drawer = !TV.drawer; rerender(); },
    tgsearch: () => { TV.search = !TV.search; if (!TV.search) TV.q = ''; rerender(); setTimeout(() => document.querySelector('.tgx-search input')?.focus(), 50); },
    tgfolder: (v) => { TV.folder = v; TV.drawer = false; if (UI.view !== 'main') go('main'); else rerender(); },
    tgnight: () => { const st = tgState(); st.light = !st.light; rerender(); },
    tgmute: () => { const st = tgState(); st.mute = !st.mute; rerender(); },
    tgcompose: () => { TV.folder = 'group'; rerender(); toast(T('Чтобы продать — откройте группу и напишите админу', 'Щоб продати — відкрийте групу й напишіть адміну', 'To sell, open a group and message the admin')); },
    tgopen: (id) => { TV.opened = null; go('chat', { id }); },
    tgdm: (id) => { TV.opened = null; go('dm', { id }); },
    tgadmin: (chId) => {
      const c = CHANNELS.find((x) => x.id === chId), a = adminOf(c);
      const d = openDm('adm_' + chId, a.name, a.handle, { ch: chId, role: 'admin' });
      if (!d.msgs.length) dmSay(d, false, { shade: T('Здорово. Что есть? Беру всё — и «серое», и что погорячее, но долю свою имею.', 'Здоров. Що є? Беру все — і «сіре», і що гарячіше, але частку свою маю.', 'Hey. What have you got? I take anything, grey or hot, but I take my cut.'), banned: T('Работаю с оптом: коробки, партии, без бумажек. Что везёшь? Деньги только при встрече.', 'Працюю з оптом: коробки, партії, без папірців. Що везеш? Гроші лише при зустрічі.', 'I do wholesale: boxes, lots, no paperwork. What have you got? Cash in person only.'), legal: T('Здравствуйте! Размещаем только легальные вещи — без краденого и запрещёнки. Что продаёте?', 'Вітаю! Розміщуємо лише легальні речі — без краденого й забороненого. Що продаєте?', 'Hello! Legal items only — nothing stolen or forbidden. What are you selling?'), none: T('Это новостной канал, рекламу и продажи не размещаем.', 'Це новинний канал, рекламу й продажі не розміщуємо.', 'This is a news channel, no ads or sales.') }[a.accepts], { silent: true });
      go('dm', { id: d.id });
    },
    tgsell: async (chId) => {
      const c = CHANNELS.find((x) => x.id === chId);
      const list = eligibleFor(c);
      if (!list.length) return toast(adminOf(c).accepts === 'legal' ? T('Нечего предложить: админ берёт только легальные вещи', 'Нічого запропонувати: адмін бере лише легальні речі', 'Nothing to offer: this admin takes legal items only') : adminOf(c).accepts === 'banned' ? T('Нечего предложить: тут берут опт и запрещёнку (купите в Тени)', 'Нічого запропонувати: тут беруть опт і заборонене (купіть у Тіні)', 'Nothing to offer: they take wholesale and forbidden goods (buy in the Shade)') : T('Склад пуст', 'Склад порожній', 'Storage is empty'), 'r');
      const v = await choose(T('Что разместить?', 'Що розмістити?', 'What to post?'), list.slice(0, 30).map((it) => ({ v: it.id, label: `${it.banned ? '⛔ ' : it.hot ? '🔥 ' : ''}${itemTitle(it)}`, sub: it.banned ? T('запрещёнка', 'заборонене', 'forbidden') : '' })));
      if (!v) return;
      proposeSale(chId, v); sfx('note'); rr();
    },
    tgagree: (id) => { const r = agreeDeal(id); if (r.ok) { sfx('ok'); toast(T('Пост вышел — ждите покупателя в личке', 'Пост вийшов — чекайте покупця в особистих', 'Posted — wait for a buyer to DM you'), 'g'); } rr(); },
    tghaggle: (id) => { const ok = haggleShare(id); sfx(ok ? 'win' : 'err'); rr(); },
    tgprice: (v) => { const [id, kk] = v.split(':'); setDealPrice(id, +kk); rr(); },
    tgcancel: (id) => { cancelDeal(id); rr(); },
    tgdecline: (id) => { declineBuyer(id); rr(); },
    tgmeet: async (id) => {
      const d = dealById(id); if (!d) return;
      if (!(await confirmBox(T('Встреча с покупателем', 'Зустріч із покупцем', 'Meet the buyer'), T(`${esc(d.title)} за ${fmt(d.buyer.offer)}, админу ${d.share}%. Только наличные, при встрече.${d.item?.banned || d.item?.hot ? ' С таким товаром на встречу иногда приходит полиция (~5 %).' : ''}`, `${esc(d.title)} за ${fmt(d.buyer.offer)}, адміну ${d.share}%. Лише готівка, при зустрічі.${d.item?.banned || d.item?.hot ? ' З таким товаром на зустріч іноді приходить поліція (~5 %).' : ''}`, `${esc(d.title)} for ${fmt(d.buyer.offer)}, ${d.share}% to the admin. Cash in person only.${d.item?.banned || d.item?.hot ? ' With goods like this the police sometimes show up (~5 %).' : ''}`), T('Ехать', 'Їхати', 'Go')))) return;
      const r = meetBuyer(id);
      if (!r.ok) return toast(r.msg || '—', 'r');
      if (r.busted) { sfx('lose'); toast(T(`🚔 Покупатель оказался полицейским. Товар изъят, штраф ${fmt(r.fine)}`, `🚔 Покупець виявився поліцейським. Товар вилучено, штраф ${fmt(r.fine)}`, `🚔 The buyer was a cop. Goods seized, fine ${fmt(r.fine)}`), 'r'); }
      else { sfx('cash'); toast(T(`+${fmt(r.price)}, админу ${fmt(r.cut)} → вам ${fmt(r.net)}`, `+${fmt(r.price)}, адміну ${fmt(r.cut)} → вам ${fmt(r.net)}`, `+${fmt(r.price)}, admin ${fmt(r.cut)} → you ${fmt(r.net)}`), 'g'); }
      rr();
    },
    tgjoin: async (id) => { const c = CHANNELS.find((x) => x.id === id); if (!(await confirmBox(chName(c), T(`Вход ${fmt(entryFee(c))}. Здесь дешевле рынка, но бывает краденое и кидалы.`, `Вхід ${fmt(entryFee(c))}. Тут дешевше за ринок, але буває крадене й кидали.`, `Entry ${fmt(entryFee(c))}. Cheaper than the market, but stolen goods and scammers happen.`), T('Вступить', 'Вступити', 'Join')))) return; const r = join(c); if (!r.ok) return toast(r.msg, 'r'); sfx('ok'); rerender(); },
    tgbuy: async (pid, el) => {
      const c = CHANNELS.find((x) => x.id === el.dataset.w); const p = postsOf(c).find((x) => x.id === pid); if (!p) return;
      const opts = [{ v: 'meet', label: T(`Встреча: ${fmt(p.price)}`, `Зустріч: ${fmt(p.price)}`, `Meet: ${fmt(p.price)}`), sub: T('осмотрите на месте, платите при встрече', 'оглянете на місці, платите при зустрічі', 'inspect on the spot, pay in person') }];
      if (!c.contra) opts.push({ v: 'prepay', label: T(`Предоплата: ${fmt(Math.round(p.price * 0.95))}`, `Передоплата: ${fmt(Math.round(p.price * 0.95))}`, `Prepay: ${fmt(Math.round(p.price * 0.95))}`), sub: T('дешевле, но могут кинуть', 'дешевше, але можуть кинути', 'cheaper, but you may get scammed'), cls: 'dark' });
      const v = await choose(itemTitle(p.it), opts);
      if (!v) return;
      const r = buyPost(p, v);
      if (!r.ok) return toast(r.msg, 'r');
      if (r.sting) { sfx('lose'); toast(T(`🚔 Продавец оказался полицейским. Штраф ${fmt(r.fine)}`, `🚔 Продавець виявився поліцейським. Штраф ${fmt(r.fine)}`, `🚔 The seller was a cop. Fine ${fmt(r.fine)}`), 'r'); }
      else if (r.scam) { sfx('err'); toast(T(`${p.handle} пропал с деньгами`, `${p.handle} зник із грошима`, `${p.handle} vanished with the money`), 'r'); }
      else { sfx('cash'); toast(v === 'meet' ? T('Забрали, вещь на складе', 'Забрали, річ на складі', 'Picked up — it’s in storage') : T('Оплачено, ждите посылку', 'Оплачено, чекайте посилку', 'Paid — parcel on the way'), 'g'); }
      rerender();
    },
    tgfill: async (id) => {
      const rq = requests().find((x) => x.id === id); if (!rq) return;
      const list = matchesFor(rq);
      const v = list.length === 1 ? list[0].id : await choose(T('Какую отдать?', 'Яку віддати?', 'Which one?'), list.map((it) => ({ v: it.id, label: itemTitle(it), sub: `${it.cond}%` })));
      if (!v) return;
      if (!(await confirmBox(T(`Продать ${rq.who}?`, `Продати ${rq.who}?`, `Sell to ${rq.who}?`), fmt(rq.budget), T('Продать', 'Продати', 'Sell')))) return;
      if (fulfil(rq, v).ok) { sfx('cash'); toast(`+${fmt(rq.budget)}`, 'g'); }
      rerender();
    },
    tgav: (v) => { tgMe().av = v; rerender(); },
    tgcol: (v) => { tgMe().col = v; rerender(); },
    tgedit: async (what) => {
      const me = tgMe(), st = tgState();
      if (what === 'user') return editUsername();
      const cfg = { name: [T('Имя', 'Імʼя', 'Name'), me.name, 32], bio: [T('О себе', 'Про себе', 'Bio'), me.bio, 70], phone: [T('Номер телефона', 'Номер телефону', 'Phone number'), st.phone || phoneOf(), 20] }[what];
      const v = await sheet(`<h2>${cfg[0]}</h2><input class="input" id="tge" maxlength="${cfg[2]}" value="${esc(cfg[1])}" data-enter='[data-r="ok"]'><button class="btn block mt" data-r="ok">${T('Готово', 'Готово', 'Done')}</button>`, { after(el) { el.querySelector('[data-r]').onclick = () => resolveSheet(el.querySelector('#tge').value.trim()); } });
      if (v == null) return;
      if (what === 'name' && v) me.name = v;
      if (what === 'bio') me.bio = v;
      if (what === 'phone' && v) st.phone = v.replace(/[^\d ]/g, '').trim() || st.phone;
      rerender();
    },
  },
};
// choosing a @username: 5–32 latin letters, digits or _, starting with a letter; one player per name (server)
async function editUsername() {
  const me = tgMe();
  const online = onlineEnabled() && isRegistered();
  const v = await sheet(`<h2>${T('Имя пользователя', 'Імʼя користувача', 'Username')}</h2>
    <div class="tgx-uname"><span>@</span><input class="input" id="tgu" maxlength="32" value="${esc(me.user)}" autocomplete="off" autocapitalize="off" spellcheck="false" data-enter='[data-r="ok"]'></div>
    <div class="small m mt" id="tgu-st">${T('5–32 символа: латинские буквы, цифры и _, первая — буква.', '5–32 символи: латинські літери, цифри та _, перша — літера.', '5–32 characters: latin letters, digits and _, starting with a letter.')}</div>
    <p class="small m mt">${online ? T('Имя закрепляется за вами на сервере — другой игрок не сможет его занять.', 'Імʼя закріплюється за вами на сервері — інший гравець не зможе його зайняти.', 'The name is reserved for you on the server — no other player can take it.') : T('Без онлайна имя сохранится только у вас и не будет закреплено. Войдите в онлайн‑рейтинг, чтобы закрепить.', 'Без онлайну імʼя збережеться лише у вас і не буде закріплене. Увійдіть в онлайн‑рейтинг, щоб закріпити.', 'Offline the name stays on this device and isn’t reserved. Join the online leaderboard to reserve it.')}</p>
    <div class="btns mt"><button class="btn dark" data-r="check">${T('Проверить', 'Перевірити', 'Check')}</button><button class="btn" data-r="ok">${T('Сохранить', 'Зберегти', 'Save')}</button></div>${me.user ? `<button class="btn red block mt" data-r="clear">${T('Удалить имя пользователя', 'Видалити імʼя користувача', 'Remove username')}</button>` : ''}`, {
    after(el) {
      const inp = el.querySelector('#tgu'), stx = el.querySelector('#tgu-st');
      el.querySelector('[data-r="check"]').onclick = async () => {
        const n = inp.value.trim().replace(/^@/, '');
        if (!TG_NAME_RE.test(n)) { stx.innerHTML = `<span class="r">${T('Неверный формат', 'Невірний формат', 'Invalid format')}</span>`; return; }
        if (!onlineEnabled()) { stx.textContent = T('Формат подходит (проверка занятости — только онлайн)', 'Формат підходить (перевірка зайнятості — лише онлайн)', 'Format OK (availability needs online)'); return; }
        stx.textContent = T('Проверяем…', 'Перевіряємо…', 'Checking…');
        try { const r = await tgCheck(n); stx.innerHTML = r?.free ? `<span class="g">✓ @${esc(n)} ${T('свободно', 'вільне', 'is available')}</span>` : `<span class="r">✗ @${esc(n)} ${T('уже занято другим игроком', 'вже зайняте іншим гравцем', 'is taken by another player')}</span>`; } catch { stx.textContent = T('Сервер не ответил', 'Сервер не відповів', 'No response from the server'); }
      };
      el.querySelector('[data-r="ok"]').onclick = () => resolveSheet(inp.value.trim().replace(/^@/, ''));
      el.querySelector('[data-r="clear"]')?.addEventListener('click', () => resolveSheet('\u0000'));
    },
  });
  if (v == null) return;
  if (v === '\u0000') { try { await tgRelease(); } catch {} me.user = ''; me.claimed = false; rerender(); return; }
  if (!TG_NAME_RE.test(v)) return toast(T('5–32 символа: латиница, цифры, _, первая — буква', '5–32 символи: латиниця, цифри, _, перша — літера', '5–32 chars: latin, digits, _, starting with a letter'), 'r');
  if (v === me.user && me.claimed) return;
  try {
    const r = await tgClaim(v);
    if (r?.ok) { me.user = v; me.claimed = !r.local; sfx('win'); toast(r.local ? T(`@${v} сохранено (не закреплено — нет онлайна)`, `@${v} збережено (не закріплено — немає онлайну)`, `@${v} saved (not reserved — offline)`) : T(`@${v} теперь ваше`, `@${v} тепер ваше`, `@${v} is yours now`), 'g'); }
    else toast(r?.err === 'taken' ? T('Это имя уже занято другим игроком', 'Це імʼя вже зайняте іншим гравцем', 'This username is taken by another player') : T('Неверный формат имени', 'Невірний формат імені', 'Invalid username'), 'r');
  } catch (e) { toast(T('Сервер не ответил, попробуйте позже', 'Сервер не відповів, спробуйте пізніше', 'No response from the server, try later'), 'r'); }
  rerender();
}
