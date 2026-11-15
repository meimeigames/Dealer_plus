// Messages (every notification, grouped by sender) and Telega (channels + members' requests).
import { G, emit } from '../core/state.js';
import { T, L, dur } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { fmt } from '../core/money.js';
import { CITY } from '../data/world.js';
import { rerender, toast, choose, confirmBox, openApp, go, UI, gameClock } from '../ui/shell.js';
import { img, empty } from '../ui/comp.js';
import { itemTitle, knownDefects, defectName } from '../game/items.js';
import { sfx } from '../ui/sfx.js';
import { CHANNELS, chName, tgState, joined, entryFee, join, postsOf, buyPost, requests, matchesFor, fulfil } from '../game/tg.js';

// ---------------------------------------------------------------- Messages
const SENDER = { quests: ['Задания', 'Завдання', 'Quests', '#f59e0b'], gov: ['Госуслуги', 'Держпослуги', 'Government', '#3c7bf0'], bank: ['Банк', 'Банк', 'Bank', '#10b981'], market: ['Объявления', 'Оголошення', 'Classifieds', '#0ea5e9'], sys: ['Система', 'Система', 'System', '#64748b'], tg: ['Телега', 'Телега', 'Telega', '#229ed9'], build: ['Сборка', 'Збірка', 'PC Build', '#ff7a3d'], supplier: ['Поставщик', 'Постачальник', 'Supplier', '#ea580c'], auto: ['Авторынок', 'Авторинок', 'Car market', '#e11d48'], ymarket: ['АлиБаоЭкспресс', 'АліБаоЕкспрес', 'AliBaoExpress', '#ff5a1f'] };
const senderOf = (app) => SENDER[app] || [UI.apps[app] ? (typeof UI.apps[app].name === 'function' ? UI.apps[app].name() : L(UI.apps[app].name)) : app, '', '', '#8b5cf6'];
const sName = (app) => { const x = senderOf(app); return x[1] ? L(x) : x[0]; };
export function ensureInbox() {
  const s = G.s;
  if (!s.welcomed && !(s.inbox || []).some((m) => m.id === 'm0')) { (s.inbox ||= []).unshift({ id: 'm0', app: 'sys', title: T('Добро пожаловать', 'Ласкаво просимо', 'Welcome'), text: T(`Добро пожаловать, ${s.player.name}! Ваш город: ${L(CITY[s.player.city].name)}.`, `Ласкаво просимо, ${s.player.name}! Ваше місто: ${L(CITY[s.player.city].name)}.`, `Welcome, ${s.player.name}! Your city: ${L(CITY[s.player.city].name)}.`), t: 0, read: false }); }
  s.welcomed = true; // once deleted, the welcome message stays deleted
  s.inbox ||= [];
  return s.inbox;
}
const MV = { thread: null };
function msgMain() {
  const box = ensureInbox();
  if (MV.thread) {
    const list = box.filter((m) => m.app === MV.thread);
    for (const m of list) m.read = true;
    const c = senderOf(MV.thread);
    return `<div class="ms-thead"><button class="btn xs dark" data-a="msback">‹</button><span class="ms-ava" style="background:${c[3]}">${esc(sName(MV.thread)[0])}</span><b>${esc(sName(MV.thread))}</b></div>` + list.map((m) => `<div class="sw-wrap"><div class="ms-bub" data-swipe="msdelone" data-v="${m.id}"><b>${esc(m.title)}</b><span>${esc(m.text)}</span><small>${ago(m.t)}</small>${m.go ? `<button class="btn xs mt" data-a="msgo" data-v="${m.id}">${T('Открыть', 'Відкрити', 'Open')} ›</button>` : ''}</div></div>`).join('') + `<p class="tiny m center">${T('Смахните сообщение влево, чтобы удалить', 'Змахніть повідомлення вліво, щоб видалити', 'Swipe a message left to delete it')}</p>`;
  }
  const threads = {};
  for (const m of box) { const th = (threads[m.app] ||= { app: m.app, last: m, unread: 0 }); if (!m.read) th.unread++; }
  const list = Object.values(threads).sort((a, b) => b.last.t - a.last.t);
  if (!list.length) return empty('chat', T('Сообщений нет', 'Повідомлень немає', 'No messages'));
  return list.map((th) => { const c = senderOf(th.app); return `<div class="sw-wrap"><div class="ms-row" data-a="msopen" data-v="${esc(th.app)}" data-swipe="msdel"><span class="ms-ava" style="background:${c[3]}">${esc(sName(th.app)[0])}</span><div class="grow"><div class="row between"><b>${esc(sName(th.app))}</b><small class="m">${ago(th.last.t)}</small></div><small class="m">${esc(th.last.title)}: ${esc(th.last.text)}</small></div>${th.unread ? `<span class="ms-badge">${th.unread}</span>` : ''}</div></div>`; }).join('') + `<p class="tiny m center">${T('Смахните переписку влево, чтобы удалить', 'Змахніть листування вліво, щоб видалити', 'Swipe a conversation left to delete it')}</p><button class="btn xs dark block" data-a="msclear">${T('Очистить все сообщения', 'Очистити всі повідомлення', 'Clear all messages')}</button>`;
}
const ago = (t) => { const d = G.s.t - t; return d < 2 ? T('сейчас', 'зараз', 'now') : d < 60 ? `${d} ${T('мин', 'хв', 'min')}` : d < 1440 ? `${Math.floor(d / 60)} ${T('ч', 'год', 'h')}` : `${Math.floor(d / 1440)} ${T('д', 'д', 'd')}`; };
export const msgApp = {
  id: 'msgs', glyph: 'msg', lvl: 1,
  name: ['Сообщения', 'Повідомлення', 'Messages'], colors: ['#34c759', '#1f9a43'], glyphColor: '#fff',
  views: { main: msgMain },
  onOpen: () => { MV.thread = null; },
  actions: {
    msopen: (app) => { MV.thread = app; rerender(); },
    msback: () => { MV.thread = null; rerender(); },
    msdel: (app) => { G.s.inbox = ensureInbox().filter((m) => m.app !== app); emit('badges'); rerender(); },
    msdelone: (id) => { G.s.inbox = ensureInbox().filter((m) => m.id !== id); if (MV.thread && !G.s.inbox.some((m) => m.app === MV.thread)) MV.thread = null; emit('badges'); rerender(); },
    msclear: async () => { if (!(await confirmBox(T('Удалить все сообщения?', 'Видалити всі повідомлення?', 'Delete all messages?'), '', T('Удалить', 'Видалити', 'Delete'), undefined, true))) return; G.s.inbox = []; MV.thread = null; emit('badges'); rerender(); },
    msgo: (id) => { const m = ensureInbox().find((x) => x.id === id); if (m?.go) openApp(...m.go); },
  },
};
