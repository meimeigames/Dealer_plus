// Venues inside the Business app, and the new Supplier app (equipment, furniture, supplies, services).
import { G } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { esc, clamp } from '../core/util.js';
import { fmt, nicePrice } from '../core/money.js';
import { CITY, countryOf } from '../data/world.js';
import { go, rerender, toast, askPrice, confirmBox, choose, sheet, resolveSheet, openApp, UI } from '../ui/shell.js';
import { empty, bar } from '../ui/comp.js';
import { sfx } from '../ui/sfx.js';
import { VENUES, SKUS, EQUIP, SERVICES, SPOTS, SUP_CATS } from '../data/venues.js';
import {
  vstate, venueById, canOpenVenue, rentPerDay, openCost, openVenue, closeVenue, problems, operating, eqCount, hasEq, svcDue, svcOverdue, serviceEq, repairEq, repairCost,
  stockOf, expiredOf, soonOf, writeOff, hireStaff, fireStaff, wageOf, itemUnlocked, priceOf, stdPrice, whyNot, fireGaps, sanitaryGaps, gapName, deepClean, runVenueAds,
  supplierDiscount, linePrice, placeOrder, pendingOrders, unlocks,
} from '../game/venues.js';

const DAY = 1440;
const VS = { tab: 'over' };
const dleft = (t) => { const m = t - G.s.t; return m <= 0 ? T('просрочено', 'прострочено', 'overdue') : m < DAY ? T(`${Math.ceil(m / 60)} ч`, `${Math.ceil(m / 60)} год`, `${Math.ceil(m / 60)} h`) : T(`${Math.round(m / DAY)} дн`, `${Math.round(m / DAY)} дн`, `${Math.round(m / DAY)} d`); };
const stars = (r) => `★ ${r.toFixed(1)}`;
const probText = (p) => ({
  permit: T('Разрешение оформляется', 'Дозвіл оформлюється', 'Permit pending'), need: `${T('Нет для работы', 'Немає для роботи', 'Missing to open')}: ${esc(L(EQUIP[p.id]?.n || ['', '', '']))}`,
  closed: T('Закрыто по решению инспекции', 'Зачинено за рішенням інспекції', 'Closed by inspectors'), staff: T('Нет персонала — работает только когда вы в городе', 'Немає персоналу — працює лише коли ви в місті', 'No staff — runs only while you are in town'),
  broken: `💥 ${T('Сломано', 'Зламано', 'Broken')}: ${esc(L(EQUIP[p.e?.id]?.n || ['', '', '']))}`, svc: `🛠 ${T('Пора обслужить', 'Час обслугувати', 'Service due')}: ${esc(L(EQUIP[p.e?.id]?.n || ['', '', '']))}`,
  expired_eq: `⌛ ${T('Истёк срок', 'Минув термін', 'Expired')}: ${esc(L(EQUIP[p.e?.id]?.n || ['', '', '']))}`, expired: `🦠 ${T('Просрочка на складе', 'Прострочка на складі', 'Expired stock')}: ${p.n}`,
  pest: T('Нет договора дезинсекции (СЭС)', 'Немає договору дезінсекції (СЕС)', 'No pest control (sanitary)'), med: `${T('Без медкнижек', 'Без медкнижок', 'No health certificates')}: ${p.n}`,
  dirty: T('Грязно — нужна уборка', 'Брудно — потрібне прибирання', 'Dirty — needs cleaning'), oilwaste: T('Нет договора на утилизацию отработки', 'Немає договору на утилізацію відпрацювання', 'No used‑oil disposal'),
  waste: T('Нет вывоза отходов', 'Немає вивезення відходів', 'No waste collection'), fire: `🧯 ${T('Пожарная безопасность', 'Пожежна безпека', 'Fire safety')}: ${p.n}`,
}[p.k] || p.k);

// ---------------------------------------------------------------- list (on the Business main screen)
export function venuesSection() {
  const list = vstate();
  let h = `<h2 class="sec">🍽 ${T('Заведения', 'Заклади', 'Venues')}</h2>`;
  h += list.map((v) => { const d = VENUES[v.type]; const pr = problems(v).filter((p) => p.sev >= 2); return `<div class="card click vn-card" data-a="go" data-v="venue" data-id="${v.id}"><div class="row between"><b>${d.ic} ${esc(v.name)}</b><span class="tag ${operating(v) ? 'g' : 'r'}">${operating(v) ? T('работает', 'працює', 'open') : T('не работает', 'не працює', 'closed')}</span></div><div class="small m">${esc(L(CITY[v.city]?.name || ['', '', '']))} · ${esc(L(SPOTS.find((x) => x.id === v.spot)?.n || ['', '', '']))} · ${stars(v.rating)} · ${T('сегодня', 'сьогодні', 'today')} ${fmt(v.day.rev)}</div>${pr.length ? `<div class="small r mt">⚠️ ${esc(probText(pr[0]))}${pr.length > 1 ? ` +${pr.length - 1}` : ''}</div>` : ''}</div>`; }).join('');
  h += `<button class="btn block" data-a="vnew">＋ ${T('Открыть заведение: киоск, кофейня, бар, шаурмичная, СТО, автомойка', 'Відкрити заклад: кіоск, кавʼярня, бар, шаурмічна, СТО, автомийка', 'Open a venue: kiosk, café, bar, shawarma, garage, car wash')}</button>`;
  return h;
}

// ---------------------------------------------------------------- one venue
export function venueView(p) {
  const v = venueById(p.id); if (!v) return empty('store', T('Заведения нет', 'Закладу немає', 'No such venue'));
  const d = VENUES[v.type], s = G.s;
  const tabs = [['over', T('Обзор', 'Огляд', 'Overview')], ['menu', T('Меню', 'Меню', 'Menu')], ['stock', T('Склад', 'Склад', 'Stock')], ['eq', T('Техника', 'Техніка', 'Equipment')], ['staff', T('Люди', 'Люди', 'Staff')], ['safe', T('Проверки', 'Перевірки', 'Inspections')], ['log', T('Журнал', 'Журнал', 'Log')]];
  let h = `<div class="vn-hero vn-${v.type}"><span>${d.ic}</span><div><b>${esc(v.name)}</b><small>${esc(L(SPOTS.find((x) => x.id === v.spot)?.n || ['', '', '']))} · ${d.open[0]}:00–${d.open[1] % 24}:00 · ${stars(v.rating)}</small></div></div>`;
  h += `<div class="seg wrap">${tabs.map(([k, n]) => `<button class="${VS.tab === k ? 'on' : ''}" data-a="vtab" data-v="${k}">${n}</button>`).join('')}</div>`;
  const pend = pendingOrders(v.id);
  if (VS.tab === 'over') {
    const pr = problems(v);
    const last7 = v.hist.slice(0, 7), sum7 = last7.reduce((a, x) => a + x.rev, 0), cost7 = last7.reduce((a, x) => a + x.cost, 0);
    h += `<div class="stats"><div class="stat"><small>${T('Сегодня', 'Сьогодні', 'Today')}</small><b>${fmt(v.day.rev)}</b><small>${v.day.n} ${T('заказов', 'замовлень', 'orders')}${v.day.lost ? ` · ${v.day.lost} ${T('ушли', 'пішли', 'left')}` : ''}</small></div><div class="stat"><small>${T('7 дней', '7 днів', '7 days')}</small><b>${fmt(sum7)}</b><small>${T('расходы', 'витрати', 'costs')} ${fmt(cost7)}</small></div></div>`;
    h += `<div class="card"><div class="kv"><span>${T('Чистота', 'Чистота', 'Cleanliness')}</span><b>${Math.round(v.clean)}%</b></div>${bar(v.clean, v.clean < 40 ? 'var(--red)' : '')}<div class="kv mt"><span>${T('Аренда в день', 'Оренда за день', 'Rent / day')}</span><b>${fmt(rentPerDay(v.type, v.spot, v.city))}</b></div><div class="kv"><span>${T('Зарплата сотрудника в час', 'Зарплата працівника за годину', 'Staff wage / hour')}</span><b>${fmt(wageOf(v))}</b></div>${v.permitAt > s.t ? `<div class="kv"><span>📄 ${T('Разрешение будет через', 'Дозвіл буде через', 'Permit in')}</span><b>${dleft(v.permitAt)}</b></div>` : ''}</div>`;
    h += pr.length ? `<div class="card"><b>${T('Что нужно сделать', 'Що потрібно зробити', 'To do')}</b>${pr.map((x) => `<div class="small ${x.sev >= 2 ? 'r' : x.sev ? 'o' : 'm'} mt">• ${probText(x)}</div>`).join('')}</div>` : `<div class="card small g">✅ ${T('Всё в порядке', 'Усе гаразд', 'All good')}</div>`;
    if (pend.length) h += `<div class="card small">🚚 ${T('Едут заказы', 'Їдуть замовлення', 'Orders on the way')}: ${pend.map((o) => `${o.lines.length} ${T('поз.', 'поз.', 'lines')} · ⏳ <span data-cd="${o.eta}"></span>`).join(' · ')}</div>`;
    h += `<div class="btns"><button class="btn" data-a="open" data-v="supplier" data-p='${JSON.stringify({ venue: v.id })}'>🚚 ${T('Поставщик', 'Постачальник', 'Supplier')}</button><button class="btn dark" data-a="vclean">🧽 ${T('Уборка', 'Прибирання', 'Clean')}</button></div>`;
    h += `<div class="btns"><button class="btn dark" data-a="vads">📣 ${T('Реклама 3 дня', 'Реклама 3 дні', 'Ads 3 days')}${v.adsUntil > s.t ? ' ✓' : ''}</button><button class="btn dark" data-a="vtoggle">${v.open ? T('Закрыть на время', 'Зачинити тимчасово', 'Close for now') : T('Открыть', 'Відкрити', 'Open')}</button></div>`;
    h += `<button class="btn dark block mt" data-a="vrename">✎ ${T('Переименовать', 'Перейменувати', 'Rename')}</button><button class="btn red block mt" data-a="vclose">${T('Закрыть заведение навсегда', 'Закрити заклад назавжди', 'Shut it down')}</button>`;
  }
  if (VS.tab === 'menu') {
    h += `<p class="small m">${T('Цены сравниваются с обычными по городу: дороже — меньше заказов и ниже рейтинг. Каждая позиция расходует свои продукты и упаковку и изнашивает нужную технику.', 'Ціни порівнюються зі звичайними по місту: дорожче — менше замовлень і нижчий рейтинг. Кожна позиція витрачає свої продукти й пакування та зношує потрібну техніку.', 'Prices are compared with the usual ones in town: dearer means fewer orders and a lower rating. Each item uses its own ingredients and packaging and wears the equipment it needs.')}</p>`;
    h += d.menu.map((m) => {
      const lock = !itemUnlocked(v, m), why = whyNot(v, m), on = !v.off[m.id];
      const uses = Object.entries(m.uses).map(([k, q]) => `${esc(L(SKUS[k].n).split(' (')[0].split(',')[0])}`).join(', ');
      return `<div class="card vn-item ${lock ? 'locked' : ''}"><div class="row between"><b>${esc(L(m.n))}</b>${lock ? `<span class="small m">🔒 ${m.unlock === 'obd' ? T('нужен дилерский софт (находка на ноутбуках)', 'потрібен дилерський софт (знахідка на ноутбуках)', 'needs dealer software (found on laptops)') : T('рецепт — находка на флешках и ноутбуках', 'рецепт — знахідка на флешках і ноутбуках', 'recipe — found on drives and laptops')}</span>` : `<button class="btn xs ${on ? '' : 'dark'}" data-a="vprice" data-v="${m.id}">${fmt(priceOf(v, m))}</button>`}</div>
        <div class="tiny m">${T('Обычно', 'Зазвичай', 'Usually')} ${fmt(stdPrice(v, m))} · ${uses || '—'}${m.eq.length ? ` · ⚙️ ${m.eq.map((e) => EQUIP[e].ic).join('')}` : ''}</div>
        ${lock ? '' : `<div class="row between mt"><span class="small ${why ? 'r' : 'g'}">${why ? (why.startsWith('eq:') ? `${T('нет техники', 'немає техніки', 'no equipment')}: ${esc(L(EQUIP[why.slice(3)].n))}` : `${T('нет на складе', 'немає на складі', 'out of stock')}: ${esc(L(SKUS[why.slice(4)].n))}`) : T('готово к продаже', 'готово до продажу', 'ready to sell')}</span><button class="btn xs dark" data-a="vmenu" data-v="${m.id}">${on ? T('Убрать', 'Прибрати', 'Hide') : T('В меню', 'У меню', 'Show')}</button></div>`}</div>`;
    }).join('');
  }
  if (VS.tab === 'stock') {
    const ex = expiredOf(v), soon = soonOf(v);
    if (ex.length) h += `<div class="card warn"><b>🦠 ${T('Просрочено', 'Прострочено', 'Expired')}: ${ex.length}</b><div class="small">${T('Персонал берёт с полки то, что старше. Просрочка в заказах — жалобы, а на проверке СЭС — штраф.', 'Персонал бере з полиці старіше. Прострочка в замовленнях — скарги, а на перевірці СЕС — штраф.', 'Staff grab the oldest pack. Expired food in orders means complaints, and a sanitary fine.')}</div><button class="btn red block mt" data-a="vwriteoff">${T('Списать просрочку', 'Списати прострочку', 'Write off expired')}</button></div>`;
    if (soon.length) h += `<div class="card small o">⌛ ${T('Истекает в ближайшие сутки', 'Спливає протягом доби', 'Expires within a day')}: ${[...new Set(soon.map((b) => L(SKUS[b.sku].n).split(' (')[0]))].map(esc).join(', ')}</div>`;
    const skus = [...new Set([...v.stock.map((b) => b.sku), ...d.menu.flatMap((m) => Object.keys(m.uses))])];
    h += skus.map((k) => { const q = stockOf(v, k), sd = SKUS[k]; const bs = v.stock.filter((b) => b.sku === k).sort((a, b) => (a.exp || 1e15) - (b.exp || 1e15)); const next = bs.find((b) => b.exp); return `<div class="kv vn-stock"><span>${esc(L(sd.n))}${sd.fridge ? ' 🧊' : sd.freeze ? ' ❄️' : ''}</span><b class="${q < 0.05 ? 'r' : q < 0.3 ? 'o' : ''}">${q < 0.005 ? '—' : q.toFixed(q < 1 ? 2 : 1)} ${esc(L(sd.u))}${next ? ` <small class="${next.exp <= G.s.t ? 'r' : 'm'}">· ${dleft(next.exp)}</small>` : ''}</b></div>`; }).join('');
    h += `<button class="btn block mt" data-a="open" data-v="supplier" data-p='${JSON.stringify({ venue: v.id, cat: 'food' })}'>🚚 ${T('Заказать у Поставщика', 'Замовити в Постачальника', 'Order from the Supplier')}</button>`;
  }
  if (VS.tab === 'eq') {
    const need = d.need.filter((id) => !hasEq(v, id));
    if (need.length) h += `<div class="card warn small">${T('Без этого не открыться', 'Без цього не відкритися', 'Needed to open')}: ${need.map((id) => `${EQUIP[id].ic} ${esc(L(EQUIP[id].n))}`).join(', ')}</div>`;
    const seats = v.eq.reduce((a, e) => a + (EQUIP[e.id]?.seats || 0), 0);
    if (!d.garage) h += `<div class="small m mb">🪑 ${T('Посадочных мест', 'Посадкових місць', 'Seats')}: ${seats} · ${T('пропускная способность', 'пропускна здатність', 'capacity')} ~${Math.round(6 + seats * 1.6)}/${T('ч', 'год', 'h')}</div>`;
    // furniture and safety gear: one row per kind (×N, the soonest expiry)
    const flat = (e) => ['furn', 'safety'].includes(EQUIP[e.id]?.cat);
    const groups = {}; for (const e of v.eq.filter(flat)) (groups[e.id] ||= []).push(e);
    const grpHTML = Object.entries(groups).map(([id, es]) => { const ed = EQUIP[id]; const ex = es.filter((e) => e.exp).sort((a, b) => a.exp - b.exp)[0]; return `<div class="kv"><span>${ed.ic} ${esc(L(ed.n))}${es.length > 1 ? ` ×${es.length}` : ''}</span><b class="small ${ex && ex.exp <= G.s.t ? 'r' : 'm'}">${ex ? `${T('годен', 'придатний', 'valid')} ${dleft(ex.exp)}` : '✓'}</b></div>`; }).join('');
    h += v.eq.length ? v.eq.filter((e) => !flat(e)).map((e) => { const ed = EQUIP[e.id], sv = ed.svc; const due = sv ? svcDue(e) : null; return `<div class="card vn-eq"><div class="row between"><b>${ed.ic} ${esc(L(ed.n))}</b>${e.broken ? `<button class="btn xs red" data-a="vrepair" data-v="${e.uid}">🔧 ${fmt(repairCost(e) * Math.max(0.5, countryOf(v.city).price))}</button>` : sv ? `<button class="btn xs ${svcOverdue(e) ? '' : 'dark'}" data-a="vsvc" data-v="${e.uid}">🛠 ${esc(L(sv.n))}</button>` : ''}</div>${ed.seats || ed.cat === 'safety' || ed.cat === 'furn' ? (e.exp ? `<div class="tiny ${e.exp <= G.s.t ? 'r' : 'm'}">${T('годен ещё', 'придатний ще', 'valid for')} ${dleft(e.exp)}</div>` : '') : `<div class="tiny m">${T('Состояние', 'Стан', 'Condition')} ${Math.round(e.cond)}%${sv ? ` · ${esc(L(sv.n))}: ${due === 0 ? `<b class="r">${T('просрочено', 'прострочено', 'overdue')}</b>` : `${T('через', 'через', 'in')} ${dleft(G.s.t + due)}`}${sv.sku ? ` (${esc(L(SKUS[sv.sku].n))}: ${stockOf(v, sv.sku).toFixed(1)})` : ''}` : ''}</div>${bar(e.broken ? 0 : e.cond, e.broken || e.cond < 40 ? 'var(--red)' : '')}`}</div>`; }).join('') + (grpHTML ? `<div class="card">${grpHTML}</div>` : '') : empty('box', T('Техники пока нет — закажите у Поставщика', 'Техніки поки немає — замовте в Постачальника', 'No equipment yet — order from the Supplier'));
    h += `<button class="btn block mt" data-a="open" data-v="supplier" data-p='${JSON.stringify({ venue: v.id, cat: 'equip' })}'>🚚 ${T('Техника и мебель у Поставщика', 'Техніка й меблі в Постачальника', 'Equipment & furniture')}</button>`;
  }
  if (VS.tab === 'staff') {
    h += `<p class="small m">${T(`${L(d.staff.n)}: зарплата ${fmt(wageOf(v))} в час работы. Один сотрудник обслуживает ~${d.staff.per} заказов в час и понемногу убирает. ${d.food ? 'Для общепита у каждого должна быть медкнижка.' : ''}`, `${L(d.staff.n)}: зарплата ${fmt(wageOf(v))} за годину роботи. Один працівник обслуговує ~${d.staff.per} замовлень на годину й потроху прибирає. ${d.food ? 'Для громадського харчування в кожного має бути медкнижка.' : ''}`, `${L(d.staff.n)}: ${fmt(wageOf(v))} per working hour. One person handles ~${d.staff.per} orders an hour and tidies up. ${d.food ? 'Food venues need a health certificate for everyone.' : ''}`)}</p>`;
    h += v.staff.map((x) => `<div class="list-item"><div class="grow"><b>${esc(x.name)}</b><div class="small ${d.food && (x.medUntil || 0) <= G.s.t ? 'r' : 'm'}">${d.food ? ((x.medUntil || 0) > G.s.t ? `🩺 ${T('медкнижка ещё', 'медкнижка ще', 'certificate for')} ${dleft(x.medUntil)}` : `🩺 ${T('нет медкнижки', 'немає медкнижки', 'no health certificate')}`) : ''} · ${T('скорость', 'швидкість', 'speed')} ×${x.skill.toFixed(2)}</div></div><button class="btn xs dark" data-a="vfire" data-v="${x.id}">✕</button></div>`).join('') || `<p class="p">${T('Никого', 'Нікого', 'Nobody yet')}</p>`;
    h += `<button class="btn block" data-a="vhire">＋ ${T('Нанять', 'Найняти', 'Hire')}: ${esc(L(d.staff.n))}</button>`;
    if (d.food) h += `<button class="btn dark block mt" data-a="open" data-v="supplier" data-p='${JSON.stringify({ venue: v.id, cat: 'svc' })}'>🩺 ${T('Медкнижки — у Поставщика (услуги)', 'Медкнижки — у Постачальника (послуги)', 'Health certificates — Supplier (services)')}</button>`;
  }
  if (VS.tab === 'safe') {
    const fg = fireGaps(v), sg = sanitaryGaps(v);
    if (d.food) h += `<div class="card"><b>🧪 ${T('Санэпидстанция', 'Санепідемстанція', 'Sanitary inspection')}</b><div class="tiny m">${T('Следующая проверка — без предупреждения', 'Наступна перевірка — без попередження', 'Next visit — unannounced')}</div>${sg.length ? sg.map((x) => `<div class="small r mt">✗ ${esc(gapName(x))} · ${fmt(x.fine * Math.max(0.5, countryOf(v.city).price))}</div>`).join('') : `<div class="small g mt">✓ ${T('Нарушений не видно', 'Порушень не видно', 'No violations')}</div>`}<div class="tiny m mt">${T('Проверяют: просрочку, договор дезинсекции, медкнижки, холодильники и журнал температур, чистоту, дезсредства, масло во фритюре.', 'Перевіряють: прострочку, договір дезінсекції, медкнижки, холодильники й журнал температур, чистоту, деззасоби, олію у фритюрі.', 'They check: expired food, pest control, health certificates, fridges and the temperature log, cleanliness, disinfectant, frying oil.')}</div></div>`;
    h += `<div class="card"><b>🧯 ${T('Пожарная инспекция', 'Пожежна інспекція', 'Fire inspection')}</b>${fg.length ? fg.map((x) => `<div class="small r mt">✗ ${esc(gapName(x))}</div>`).join('') : `<div class="small g mt">✓ ${T('Всё по нормам', 'Усе за нормами', 'All to code')}</div>`}<div class="tiny m mt">${T(`Нужно: огнетушители (${d.size} шт, на год), ${d.size >= 2 ? 'сигнализация, ' : ''}план эвакуации, табличка «Выход», аптечка.`, `Потрібно: вогнегасники (${d.size} шт, на рік), ${d.size >= 2 ? 'сигналізація, ' : ''}план евакуації, табличка «Вихід», аптечка.`, `Needed: extinguishers (${d.size}, yearly), ${d.size >= 2 ? 'an alarm, ' : ''}an evacuation plan, an exit sign, a first‑aid kit.`)}</div></div>`;
    h += `<div class="card small">${d.food ? `🐀 ${T('Дезинсекция', 'Дезінсекція', 'Pest control')}: ${v.pestUntil > G.s.t ? `✓ ${T('ещё', 'ще', 'for')} ${dleft(v.pestUntil)}` : `<b class="r">✗</b>`}<br>` : ''}🗑 ${T('Вывоз отходов', 'Вивезення відходів', 'Waste collection')}: ${v.wasteUntil > G.s.t ? `✓ ${dleft(v.wasteUntil)}` : '✗'}${v.type === 'sto' ? `<br>🛢 ${T('Утилизация отработки', 'Утилізація відпрацювання', 'Used oil disposal')}: ${v.oilUntil > G.s.t ? `✓ ${dleft(v.oilUntil)}` : '✗'}` : ''}</div>`;
    h += `<button class="btn block" data-a="open" data-v="supplier" data-p='${JSON.stringify({ venue: v.id, cat: 'safety' })}'>🧯 ${T('Безопасность и договоры у Поставщика', 'Безпека й договори в Постачальника', 'Safety & contracts at the Supplier')}</button>`;
  }
  if (VS.tab === 'log') h += v.log.map((l) => `<div class="kv"><span class="small">${esc(l.tx)}</span></div>`).join('') || `<p class="p">—</p>`;
  return h;
}
export const venueActions = {
  vnew: async () => {
    if (!canOpenVenue()) return toast(T('Сначала оформите ИП / ФОП или компанию в «Госуслугах»', 'Спочатку оформіть ФОП або компанію в «Держпослугах»', 'Register as self‑employed or a company first (Gov app)'), 'r');
    const type = await choose(T('Какое заведение?', 'Який заклад?', 'Which venue?'), Object.entries(VENUES).map(([k, d]) => ({ v: k, label: `${d.ic} ${L(d.n)}`, sub: T(`с ${d.open[0]}:00 до ${d.open[1] % 24}:00 · для старта: ${d.need.map((id) => L(EQUIP[id].n).split(' ')[0].toLowerCase()).join(', ')}`, `з ${d.open[0]}:00 до ${d.open[1] % 24}:00 · для старту: ${d.need.map((id) => L(EQUIP[id].n).split(' ')[0].toLowerCase()).join(', ')}`, `${d.open[0]}:00–${d.open[1] % 24}:00 · to start: ${d.need.map((id) => L(EQUIP[id].n).split(' ')[0].toLowerCase()).join(', ')}`) })));
    if (!type) return;
    const spot = await choose(T('Где открыть?', 'Де відкрити?', 'Where?'), SPOTS.map((x) => ({ v: x.id, label: `${L(x.n)} · ×${x.traffic} ${T('людей', 'людей', 'people')}`, sub: `${T('аренда', 'оренда', 'rent')} ${fmt(rentPerDay(type, x.id))}/${T('день', 'день', 'day')} · ${T('старт', 'старт', 'start')} ${fmt(openCost(type, x.id))}` })));
    if (!spot) return;
    if (!(await confirmBox(T('Открыть?', 'Відкрити?', 'Open it?'), T(`${L(VENUES[type].n)}: аренда на 7 дней вперёд и разрешение — ${fmt(openCost(type, spot))}. Технику, мебель и продукты закажите у Поставщика.`, `${L(VENUES[type].n)}: оренда на 7 днів наперед і дозвіл — ${fmt(openCost(type, spot))}. Техніку, меблі й продукти замовте в Постачальника.`, `${L(VENUES[type].n)}: 7 days' rent up front and a permit — ${fmt(openCost(type, spot))}. Order equipment, furniture and supplies from the Supplier.`)))) return;
    const r = openVenue(type, spot);
    if (!r.ok) return toast(r.msg || '—', 'r');
    sfx('win'); VS.tab = 'over'; go('venue', { id: r.v.id });
  },
  vtab: (v) => { VS.tab = v; rerender(); },
  vmenu: (id) => { const v = venueById(UI.params.id); if (!v) return; v.off[id] = !v.off[id]; rerender(); },
  vprice: async (id) => { const v = venueById(UI.params.id); const m = VENUES[v.type].menu.find((x) => x.id === id); const p = await askPrice({ title: L(m.n), sub: `${T('обычно', 'зазвичай', 'usually')} ${fmt(stdPrice(v, m))}`, value: priceOf(v, m), min: 0.1, max: stdPrice(v, m) * 4 }); if (p) { v.prices[id] = p; rerender(); } },
  vwriteoff: () => { const v = venueById(UI.params.id); const lost = writeOff(v); if (lost) { sfx('tap'); toast(T(`Списано на ${fmt(lost)}`, `Списано на ${fmt(lost)}`, `Written off: ${fmt(lost)}`)); } rerender(); },
  vsvc: (uid2) => { const v = venueById(UI.params.id); const r = serviceEq(v, uid2); if (r.ok) { sfx('ok'); toast(T('Обслужено', 'Обслуговано', 'Serviced'), 'g'); } else { toast(r.msg || '—', 'r'); if (r.need) openApp('supplier', 'main', { venue: v.id, cat: 'clean' }); } rerender(); },
  vrepair: (uid2) => { const v = venueById(UI.params.id); const r = repairEq(v, uid2); if (r.ok) { sfx('ok'); toast(T('Починили', 'Полагодили', 'Fixed'), 'g'); } else toast(r.msg || '—', 'r'); rerender(); },
  vhire: () => { const v = venueById(UI.params.id); hireStaff(v); sfx('ok'); rerender(); },
  vfire: async (id) => { const v = venueById(UI.params.id); if (await confirmBox(T('Уволить?', 'Звільнити?', 'Let go?'), '', T('Уволить', 'Звільнити', 'Let go'), undefined, true)) { fireStaff(v, id); rerender(); } },
  vclean: () => { const v = venueById(UI.params.id); if (deepClean(v)) { sfx('ok'); toast(T('Чисто', 'Чисто', 'Clean'), 'g'); } else toast(T('Нужно дезсредство — закажите у Поставщика', 'Потрібен деззасіб — замовте в Постачальника', 'You need disinfectant — order it from the Supplier'), 'r'); rerender(); },
  vads: () => { const v = venueById(UI.params.id); if (runVenueAds(v)) { sfx('ok'); toast(T('Реклама запущена', 'Рекламу запущено', 'Ads running'), 'g'); } else toast(T('Не хватает денег', 'Не вистачає грошей', 'Not enough money'), 'r'); rerender(); },
  vtoggle: () => { const v = venueById(UI.params.id); v.open = !v.open; rerender(); },
  vrename: async () => { const v = venueById(UI.params.id); const n = await sheet(`<h2>${T('Название', 'Назва', 'Name')}</h2><input class="input" id="vnn" maxlength="40" value="${esc(v.name)}" data-enter='[data-r="ok"]'><button class="btn block mt" data-r="ok">OK</button>`, { after(el) { el.querySelector('[data-r]').onclick = () => resolveSheet(el.querySelector('#vnn').value.trim()); } }); if (n) { v.name = n; rerender(); } },
  vclose: async () => { const v = venueById(UI.params.id); if (!(await confirmBox(T('Закрыть навсегда?', 'Закрити назавжди?', 'Shut it down?'), T('Технику продадим за ~35 % цены, склад пропадёт.', 'Техніку продамо за ~35 % ціни, склад пропаде.', 'Equipment sells for ~35 %, the stock is lost.'), T('Закрыть', 'Закрити', 'Shut down'), undefined, true))) return; const back = closeVenue(v.id); toast(`+${fmt(back)}`); go('main'); },
};

// ---------------------------------------------------------------- the Supplier app
const SP = { venue: null, cat: 'equip', all: false, cart: {} };
const cartKey = (kind, id) => `${kind}:${id}`;
const venueForSup = () => venueById(SP.venue) || vstate()[0] || null;
function relevant(v, kind, id) {
  if (!v) return true;
  const d = VENUES[v.type];
  const eqs = new Set([...d.need, ...d.menu.flatMap((m) => m.eq), ...v.eq.map((e) => e.id)]);
  if (kind === 'sku') return d.menu.some((m) => m.uses[id]) || id === 'disinfect' || id === 'gloves' || [...eqs].some((e) => EQUIP[e]?.svc?.sku === id);
  if (kind === 'eq') { const e = EQUIP[id]; if (e.cat === 'safety') return true; if (e.cat === 'furn') return !d.garage || !e.seats || id === 'chair'; return eqs.has(id) || id === 'terminal' || (id === 'cams'); }
  if (kind === 'svc') { const sv = SERVICES[id]; return (!sv.food || d.food) && (!sv.garage || v.type === 'sto') && (!sv.perStaff || d.food); }
  return true;
}
function supLines(v) {
  const c = SP.cat;
  if (c === 'svc') return Object.keys(SERVICES).map((id) => ({ kind: 'svc', id }));
  if (c === 'equip' || c === 'furn' || c === 'safety') return Object.keys(EQUIP).filter((id) => EQUIP[id].cat === c).map((id) => ({ kind: 'eq', id }));
  return Object.keys(SKUS).filter((id) => SKUS[id].cat === c && (!SKUS[id].unlock || unlocks().recipes.includes(SKUS[id].unlock))).map((id) => ({ kind: 'sku', id }));
}
function supMainB2B(p) {
  if (p?.venue) { SP.venue = p.venue; if (p.cat) SP.cat = p.cat; p.venue = null; }
  const list = vstate(), v = venueForSup();
  if (!list.length) return `<div class="sup2-hero"><b>${T('Поставщик для бизнеса', 'Постачальник для бізнесу', 'Business supplier')}</b><small>${T('Техника, мебель, продукты, упаковка, химия, пожарная безопасность и договоры для киосков, кофеен, баров, шаурмичных, СТО и автомоек.', 'Техніка, меблі, продукти, пакування, хімія, пожежна безпека й договори для кіосків, кавʼярень, барів, шаурмічних, СТО й автомийок.', 'Equipment, furniture, food, packaging, cleaning, fire safety and contracts for kiosks, cafés, bars, shawarma places, garages and car washes.')}</small></div>${empty('store', T('Сначала откройте заведение', 'Спочатку відкрийте заклад', 'Open a venue first'), T('«Бизнес» → «Заведения». Опт телефонов из Шэньчжэня теперь в «Ё.Маркете» → «АлиБаоЭкспресс».', '«Бізнес» → «Заклади». Опт телефонів із Шеньчженя тепер у «Ё.Маркеті» → «АліБаоЕкспрес».', 'Business → Venues. Phone wholesale from Shenzhen is now in Yo.Market → AliBaoExpress.'))}<button class="btn block" data-a="open" data-v="business">🍽 ${T('Открыть заведение', 'Відкрити заклад', 'Open a venue')}</button><button class="btn dark block mt" data-a="open" data-v="ymarket" data-w="ali">🇨🇳 ${T('АлиБаоЭкспресс', 'АліБаоЕкспрес', 'AliBaoExpress')}</button>`;
  const disc = supplierDiscount();
  let h = `<div class="sup2-hero"><b>${T('Поставщик для бизнеса', 'Постачальник для бізнесу', 'Business supplier')}</b><small>${T('Доставка за 2–8 часов прямо в заведение', 'Доставка за 2–8 годин прямо в заклад', 'Delivered to the venue in 2–8 hours')}${disc ? ` · <b>−${Math.round(disc * 100)} %</b> ${T('по контактам с флешки', 'за контактами з флешки', 'via the contacts you found')}` : ''}</small></div>`;
  h += `<div class="chips wrap">${list.map((x) => `<button class="chip${x.id === v.id ? ' on' : ''}" data-a="spven" data-v="${x.id}">${VENUES[x.type].ic} ${esc(x.name.slice(0, 26))}</button>`).join('')}</div>`;
  const need = VENUES[v.type].need.filter((id) => !hasEq(v, id) && !pendingOrders(v.id).some((o) => o.lines.some((l) => l.id === id)));
  if (need.length) h += `<div class="card hl"><b>🚀 ${T('Для открытия не хватает', 'Для відкриття бракує', 'Missing to open')}</b><div class="small">${need.map((id) => `${EQUIP[id].ic} ${esc(L(EQUIP[id].n))}`).join(', ')}</div><button class="btn block mt" data-a="spstarter">${T('Положить всё нужное в корзину', 'Покласти все потрібне в кошик', 'Put it all in the cart')}</button></div>`;
  h += `<div class="chips">${SUP_CATS.filter((c) => c.id !== 'parts' || VENUES[v.type].garage || SP.all).map((c) => `<button class="chip${SP.cat === c.id ? ' on' : ''}" data-a="spcat" data-v="${c.id}">${c.ic} ${esc(L(c.n))}</button>`).join('')}</div>`;
  h += `<button class="chip${SP.all ? ' on' : ''}" data-a="spall" style="margin:2px 0 8px">${SP.all ? '☑' : '☐'} ${T('Показывать всё, а не только нужное этому заведению', 'Показувати все, а не лише потрібне цьому закладу', 'Show everything, not just what this venue needs')}</button>`;
  const lines = supLines(v).filter((l) => SP.all || relevant(v, l.kind, l.id));
  h += lines.map((l) => {
    const d = l.kind === 'sku' ? SKUS[l.id] : l.kind === 'eq' ? EQUIP[l.id] : SERVICES[l.id];
    const q = SP.cart[cartKey(l.kind, l.id)] || 0;
    const have = l.kind === 'sku' ? stockOf(v, l.id) : l.kind === 'eq' ? v.eq.filter((e) => e.id === l.id).length : null;
    const meta = l.kind === 'sku' ? [d.life ? `⌛ ${d.life} ${T('дн', 'дн', 'd')}` : T('не портится', 'не псується', 'keeps'), d.fridge ? '🧊' : '', d.freeze ? '❄️' : '', have ? `${T('на складе', 'на складі', 'in stock')} ${have.toFixed(1)}` : ''] : l.kind === 'eq' ? [d.svc ? `🛠 ${L(d.svc.n).toLowerCase()} ${T('раз в', 'раз на', 'every')} ${d.svc.every} ${T('дн', 'дн', 'd')}` : '', d.expire ? `⌛ ${T('на год', 'на рік', '1 year')}` : '', d.seats ? `🪑 ${d.seats}` : '', have ? `${T('есть', 'є', 'have')} ${have}` : ''] : [d.days ? `${d.days} ${T('дн', 'дн', 'd')}` : '', d.perStaff ? T('на 1 сотрудника', 'на 1 працівника', 'per person') : ''];
    return `<div class="sup2-row" data-key="sp_${l.kind}_${l.id}"><span class="sup2-ic">${l.kind === 'eq' ? d.ic : l.kind === 'svc' ? '📋' : { food: '🥫', pack: '🥤', clean: '🧴', parts: '🛢' }[d.cat] || '📦'}</span><div class="grow"><b>${esc(L(d.n))}</b><div class="tiny m">${meta.filter(Boolean).join(' · ')}</div></div><div class="sup2-buy"><b>${fmt(linePrice(l.kind, l.id, v))}</b><div class="sup2-step">${q ? `<button data-a="spminus" data-v="${cartKey(l.kind, l.id)}">−</button><span>${q}</span>` : ''}<button data-a="spplus" data-v="${cartKey(l.kind, l.id)}">＋</button>${l.kind === 'sku' ? `<button class="x10" data-a="spplus" data-v="${cartKey(l.kind, l.id)}" data-n="10">+10</button>` : ''}</div></div></div>`;
  }).join('') || `<p class="p">—</p>`;
  const cart = Object.entries(SP.cart).filter(([, q]) => q > 0);
  if (cart.length) { const total = cart.reduce((a, [k, q]) => { const [kind, id] = k.split(':'); return a + linePrice(kind, id, v) * q; }, 0) + 4; h += `<div class="sup2-cart"><span>🛒 ${cart.length} ${T('поз.', 'поз.', 'lines')} · ${fmt(total)} ${T('с доставкой', 'з доставкою', 'incl. delivery')}</span><button class="btn" data-a="sporder">${T('Заказать', 'Замовити', 'Order')}</button></div>`; }
  return h;
}
export const supplierB2BApp = {
  id: 'supplier', glyph: 'truck', lvl: 3,
  name: ['Поставщик', 'Постачальник', 'Supplier'], colors: ['#ff7a1a', '#e2480f'], glyphColor: '#fff',
  views: { main: supMainB2B },
  actions: {
    spven: (id) => { SP.venue = id; SP.cart = {}; rerender(); },
    spcat: (c) => { SP.cat = c; rerender(); },
    spall: () => { SP.all = !SP.all; rerender(); },
    spplus: (k, el) => { SP.cart[k] = (SP.cart[k] || 0) + (+el?.dataset.n || 1); sfx('tap'); rerender(); },
    spminus: (k) => { SP.cart[k] = Math.max(0, (SP.cart[k] || 0) - 1); rerender(); },
    spstarter: () => { const v = venueForSup(); for (const id of VENUES[v.type].need) if (!hasEq(v, id)) SP.cart[cartKey('eq', id)] = Math.max(1, SP.cart[cartKey('eq', id)] || 0); sfx('ok'); rerender(); },
    sporder: async () => {
      const v = venueForSup(); const lines = Object.entries(SP.cart).filter(([, q]) => q > 0).map(([k, q]) => { const [kind, id] = k.split(':'); return { kind, id, qty: q }; });
      if (!lines.length) return;
      const r = placeOrder(v.id, lines);
      if (!r.ok) return toast(r.msg || '—', 'r');
      SP.cart = {}; sfx('cash'); toast(T(`Заказ на ${fmt(r.total)} — привезут через ${Math.round((r.eta - G.s.t) / 60)} ч`, `Замовлення на ${fmt(r.total)} — привезуть за ${Math.round((r.eta - G.s.t) / 60)} год`, `Order of ${fmt(r.total)} — arrives in ${Math.round((r.eta - G.s.t) / 60)} h`), 'g'); rerender();
    },
  },
};
