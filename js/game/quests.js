// Daily quests, the story path ("from zero to empire"), achievements and collections.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { countryOf } from '../data/world.js';
import { MODEL, MODELS } from '../data/catalog.js';
import { earn, addXP, notify, getStat, netWorth, stat } from './player.js';
import { countriesWithShops } from './business.js';
import { day } from './economy.js';
import { fmt } from '../core/money.js';

const DQ = [
  { stat: 'sold', n: ['Продай {n} вещ.', 'Продай {n} реч.', 'Sell {n} items'], base: [1, 3] },
  { stat: 'bought', n: ['Купи {n} вещ.', 'Купи {n} реч.', 'Buy {n} items'], base: [1, 3] },
  { stat: 'shifts', n: ['Отработай {n} смен(ы)', 'Відпрацюй {n} змін(и)', 'Work {n} shifts'], base: [1, 3] },
  { stat: 'repairs', n: ['Почини {n} вещ.', 'Полагодь {n} реч.', 'Repair {n} items'], base: [1, 2] },
  { stat: 'inspections', n: ['Проведи {n} осмотр(а)', 'Проведи {n} огляд(и)', 'Do {n} inspections'], base: [1, 3] },
  { stat: 'freebies', n: ['Забери {n} бесплатн. вещь', 'Забери {n} безкоштовн. річ', 'Grab {n} free items'], base: [1, 2] },
  { stat: 'listed', n: ['Выставь {n} объявл.', 'Виклади {n} оголош.', 'Post {n} listings'], base: [1, 3] },
  { stat: 'legit', n: ['Проверь подлинность {n} раз', 'Перевір справжність {n} раз', 'Run {n} legit checks'], base: [1, 2], lvl: 2 },
  { stat: 'bids', n: ['Сделай {n} ставк. на аукционе', 'Зроби {n} ставк. на аукціоні', 'Place {n} auction bids'], base: [1, 3], lvl: 3 },
  { stat: 'boxes', n: ['Открой {n} мистери‑бокс', 'Відкрий {n} містері‑бокс', 'Open {n} mystery box'], base: [1, 1], lvl: 2 },
  { stat: 'profitDay', n: ['Заработай {money} прибыли', 'Заробі {money} прибутку', 'Make {money} profit'], money: true },
];
// rewards were raised ×8 — today's list from an older save gets the new numbers too
export const QUEST_K = 8;
export function ensureDaily() {
  const s = G.s;
  const d = day();
  if (s.quests.day === d) { for (const q of s.quests.list || []) if (!q.k8) { q.k8 = true; if (!q.done) q.reward = Math.round(q.reward * QUEST_K); } return s.quests.list; }
  const rng = new RNG(`${s.id}:dq:${d}`);
  const pool = DQ.filter((q) => !q.lvl || s.level >= q.lvl);
  const picks = rng.sample(pool, 3);
  const wage = countryOf(s.player.city).wage;
  s.quests.list = picks.map((q, i) => {
    const target = q.money ? Math.round(30 * Math.pow(s.level, 1.5) * wage) : rng.int(q.base[0], q.base[1]) + Math.floor(s.level / 4);
    return { id: `${d}_${i}`, stat: q.stat, n: q.n, target, money: !!q.money, reward: Math.round((12 + s.level * 9) * wage * (q.money ? 1.5 : 1) * QUEST_K), xp: 20 + s.level * 6, done: false, k8: true };
  });
  s.quests.day = d;
  return s.quests.list;
}
export function questProgress(q) { return q.stat === 'profitDay' ? Math.max(0, G.s.daily.profit || 0) : G.s.daily[q.stat] || 0; }
export const questText = (q) => L(q.n).replace('{n}', q.target).replace('{money}', fmt(q.target));
export function claimQuest(q) {
  if (q.done || questProgress(q) < q.target) return false;
  q.done = true;
  earn(q.reward, 'quest', T('Задание', 'Завдання', 'Quest'));
  addXP(q.xp);
  stat('quests');
  emit('quests');
  return true;
}

// ---------------------------------------------------------------- story path
const W = (x) => netWorth() >= x;
export const STORY = [
  { n: ['Найди первую работу', 'Знайди першу роботу', 'Find your first job'], d: ['Приложение «Работа»: отправь отклик и пройди собеседование.', 'Застосунок «Робота»: надішли відгук і пройди співбесіду.', 'Jobs app: apply and pass the interview.'], ok: () => !!G.s.job.cur || G.s.job.past.length > 0, r: 10 },
  { n: ['Отработай 3 смены', 'Відпрацюй 3 зміни', 'Work 3 shifts'], d: ['Смены — это мини‑игры. Чем лучше результат, тем выше зарплата.', 'Зміни — це міні‑ігри. Що кращий результат, то вища зарплата.', 'Shifts are minigames; better score = better pay.'], ok: () => getStat('shifts') >= 3, r: 15 },
  { n: ['Забери вещь даром', 'Забери річ безкоштовно', 'Grab something for free'], d: ['«Даром»: люди отдают ненужное. Успей раньше других.', '«Даром»: люди віддають непотрібне. Встигни раніше за інших.', 'Freebies app: be faster than others.'], ok: () => getStat('freebies') >= 1, r: 10 },
  { n: ['Купи первую вещь', 'Купи першу річ', 'Buy your first item'], d: ['Ищи метку «Ниже рынка» и торгуйся.', 'Шукай мітку «Нижче ринку» і торгуйся.', 'Look for “Below market” and haggle.'], ok: () => getStat('bought') >= 1, r: 15 },
  { n: ['Почини или почисти вещь', 'Полагодь або почисти річ', 'Repair or clean an item'], d: ['Мастерская: ремонт своими руками дешевле.', 'Майстерня: ремонт своїми руками дешевший.', 'Workshop: DIY repairs are cheaper.'], ok: () => getStat('repairs') + getStat('cleaned') >= 1, r: 20 },
  { n: ['Выставь объявление', 'Виклади оголошення', 'Post a listing'], d: ['Склад → вещь → «Продать».', 'Склад → річ → «Продати».', 'Storage → item → “Sell”.'], ok: () => getStat('listed') >= 1, r: 10 },
  { n: ['Продай с прибылью', 'Продай з прибутком', 'Sell at a profit'], d: ['Торгуйся в чате с покупателями.', 'Торгуйся в чаті з покупцями.', 'Haggle with buyers in chat.'], ok: () => getStat('profit') > 0, r: 25 },
  { n: ['Сними жильё', 'Зніми житло', 'Rent a place'], d: ['«Недвижимость»: жильё даёт склад и нормальный сон.', '«Нерухомість»: житло дає склад і нормальний сон.', 'Real estate: home = storage + proper sleep.'], ok: () => G.s.house.type !== 'none', r: 30 },
  { n: ['Капитал $1 000', 'Капітал $1 000', 'Net worth $1,000'], d: ['Деньги + стоимость вещей.', 'Гроші + вартість речей.', 'Cash + item value.'], ok: () => W(1000), r: 50 },
  { n: ['Найди редкую вещь', 'Знайди рідкісну річ', 'Find a rare item'], d: ['Редкость «Редкий» и выше. Ищи на барахолке, в контейнерах и боксах.', 'Рідкість «Рідкісний» і вище.', 'Rarity Rare or higher.'], ok: () => getStat('rareFound') >= 1, r: 60 },
  { n: ['Зарегистрируй ИП', 'Зареєструй ФОП', 'Register a business'], d: ['«Госуслуги» → налоговый режим.', '«Держпослуги» → податковий режим.', 'Gov app → tax regime.'], ok: () => ['ip', 'company'].includes(G.s.tax.regime), r: 50 },
  { n: ['Открой первый магазин', 'Відкрий перший магазин', 'Open your first store'], d: ['Купи или арендуй точку и открой бизнес.', 'Купи або орендуй точку й відкрий бізнес.', 'Buy or rent a spot and open a store.'], ok: () => G.s.biz.shops.length >= 1, r: 150 },
  { n: ['Найми сотрудника', 'Найми співробітника', 'Hire an employee'], d: ['Продавец работает, пока тебя нет.', 'Продавець працює, поки тебе немає.', 'A clerk sells while you’re away.'], ok: () => getStat('hires') >= 1, r: 100 },
  { n: ['Купи машину', 'Купи авто', 'Get a car'], d: ['Машина ускоряет поездки и открывает работу в такси.', 'Авто прискорює поїздки й відкриває роботу в таксі.', 'A car speeds up trips and unlocks taxi work.'], ok: () => !!G.s.car, r: 120 },
  { n: ['Съезди в другую страну', 'Зʼїзди в іншу країну', 'Travel abroad'], d: ['Покупай там, где дешевле, продавай там, где дороже.', 'Купуй там, де дешевше, продавай там, де дорожче.', 'Buy cheap there, sell high here.'], ok: () => getStat('abroad') >= 1, r: 150 },
  { n: ['Капитал $100 000', 'Капітал $100 000', 'Net worth $100,000'], d: ['Ты уже серьёзный игрок.', 'Ти вже серйозний гравець.', 'You’re a serious player now.'], ok: () => W(100000), r: 1500 },
  { n: ['Магазины в 2 странах', 'Магазини у 2 країнах', 'Stores in 2 countries'], d: ['Международная сеть.', 'Міжнародна мережа.', 'International chain.'], ok: () => countriesWithShops() >= 2, r: 3000 },
  { n: ['Капитал $1 000 000', 'Капітал $1 000 000', 'Net worth $1,000,000'], d: ['Торговая империя построена. Но это не предел!', 'Торгова імперія збудована. Але це не межа!', 'The empire is built. But there’s more!'], ok: () => W(1e6), r: 20000 },
];
export function storyTick() {
  const s = G.s;
  const st = STORY[s.quests.story];
  if (!st) return;
  if (st.ok()) {
    s.quests.story++;
    const r = st.r * QUEST_K * countryOf(s.player.city).wage;
    earn(r, 'quest', L(st.n));
    addXP(30 + s.quests.story * 15);
    notify('quests', T('Этап пройден!', 'Етап пройдено!', 'Milestone done!'), `${L(st.n)} → +${fmt(r)}`);
    emit('quests');
  }
}

// ---------------------------------------------------------------- achievements
export const ACH = [
  { stat: 'sold', tiers: [1, 10, 100, 1000], n: ['Продавец', 'Продавець', 'Seller'] },
  { stat: 'profit', tiers: [100, 10000, 1e6, 1e8], n: ['Прибыль', 'Прибуток', 'Profit'], money: true },
  { stat: 'repairs', tiers: [1, 25, 150, 600], n: ['Мастер на все руки', 'Майстер на всі руки', 'Handyman'] },
  { stat: 'freebies', tiers: [1, 15, 80, 300], n: ['Халявщик', 'Халявник', 'Freebie hunter'] },
  { stat: 'legit', tiers: [1, 20, 100, 500], n: ['Детектор фейков', 'Детектор фейків', 'Fake detector'] },
  { stat: 'shifts', tiers: [1, 20, 120, 500], n: ['Трудоголик', 'Трудоголік', 'Workaholic'] },
  { stat: 'auctionsWon', tiers: [1, 10, 50, 200], n: ['Молоток', 'Молоток', 'Gavel'] },
  { stat: 'boxes', tiers: [1, 20, 100, 500], n: ['Азарт', 'Азарт', 'Thrill seeker'] },
  { stat: 'scamsCaught', tiers: [1, 5, 25, 100], n: ['Антифрод', 'Антифрод', 'Anti‑fraud'] },
  { stat: 'abroad', tiers: [1, 5, 25, 100], n: ['Путешественник', 'Мандрівник', 'Globetrotter'] },
  { stat: 'shopSales', tiers: [1, 50, 500, 5000], n: ['Ритейлер', 'Ритейлер', 'Retailer'] },
  { stat: 'rareFound', tiers: [1, 5, 25, 100], n: ['Охотник за редкостями', 'Мисливець за рідкостями', 'Rarity hunter'] },
  { stat: 'bought', tiers: [1, 25, 250, 2500], n: ['Скупщик', 'Скупник', 'Buyer'], ic: '🛒' },
  { stat: 'inspections', tiers: [1, 25, 150, 800], n: ['Зоркий глаз', 'Пильне око', 'Eagle eye'], ic: '🔍' },
  { stat: 'disputesWon', tiers: [1, 5, 25, 100], n: ['Юрист', 'Юрист', 'Lawyer'], ic: '⚖️' },
  { stat: 'taxPaid', tiers: [100, 10000, 1e6, 1e8], n: ['Честный налогоплательщик', 'Чесний платник податків', 'Honest taxpayer'], money: true, ic: '🧾' },
  { stat: 'containersOpened', tiers: [1, 10, 50, 200], n: ['Контейнерщик', 'Контейнерник', 'Container king'], ic: '🚢' },
  { stat: 'boxesOpened', tiers: [1, 10, 50, 200], n: ['Распаковщик опта', 'Розпаковувач опту', 'Box opener'], ic: '📦' },
  { stat: 'pcBuilt', tiers: [1, 10, 50, 200], n: ['Сборщик ПК', 'Збирач ПК', 'PC builder'], ic: '🖥' },
  { stat: 'jailbreaks', tiers: [1, 10, 50, 200], n: ['Хакер', 'Хакер', 'Hacker'], ic: '🔓' },
  { stat: 'devicesOpened', tiers: [1, 25, 150, 600], n: ['Цифровой археолог', 'Цифровий археолог', 'Digital archaeologist'], ic: '💾' },
  { stat: 'lootFound', tiers: [1, 10, 50, 200], n: ['Кладоискатель', 'Шукач скарбів', 'Treasure hunter'], ic: '💎' },
  { stat: 'virusRemoved', tiers: [1, 10, 50, 200], n: ['Антивирус', 'Антивірус', 'Antivirus'], ic: '🛡' },
  { stat: 'venuesOpened', tiers: [1, 2, 4, 6], n: ['Ресторатор', 'Ресторатор', 'Restaurateur'], ic: '🍽' },
  { stat: 'homesBought', tiers: [1, 3, 10, 30], n: ['Девелопер', 'Девелопер', 'Developer'], ic: '🏠' },
  { stat: 'renovations', tiers: [1, 5, 25, 100], n: ['Прораб', 'Виконроб', 'Foreman'], ic: '🧱' },
  { stat: 'trips', tiers: [1, 10, 50, 200], n: ['Турист', 'Турист', 'Tourist'], ic: '✈️' },
  { stat: 'auctionSold', tiers: [1, 20, 100, 500], n: ['Аукционист', 'Аукціоніст', 'Auctioneer'], ic: '🔨' },
  { stat: 'casinoWin', tiers: [1, 25, 150, 800], n: ['Везунчик', 'Щасливчик', 'Lucky one'], ic: '🎰' },
  { stat: 'numbersSold', tiers: [1, 10, 50, 200], n: ['Красивые номера', 'Гарні номери', 'Golden numbers'], ic: '📱' },
  { stat: 'dumpster', tiers: [1, 25, 150, 600], n: ['Король помойки', 'Король смітника', 'Dumpster king'], ic: '🗑' },
  { stat: 'wholesale', tiers: [1, 10, 50, 200], n: ['Оптовик', 'Оптовик', 'Wholesaler'], ic: '🏭' },
  { stat: 'tgSold', tiers: [1, 10, 50, 200], n: ['Через админа', 'Через адміна', 'Via the admin'], ic: '✈️' },
  { stat: 'vinChecks', tiers: [1, 10, 50, 200], n: ['Автоэксперт', 'Автоексперт', 'Car expert'], ic: '🚗' },
  { stat: 'cleaned', tiers: [1, 25, 150, 600], n: ['Чистюля', 'Чистюля', 'Neat freak'], ic: '🧽' },
  { stat: 'quests', tiers: [1, 25, 150, 600], n: ['Исполнитель', 'Виконавець', 'Go‑getter'], ic: '✅' },
  // shadow achievements: only visible (and claimable) with a VPN on — Quests → «Shadow»
  { stat: 'darkBuys', tiers: [1, 10, 50, 200], n: ['Клиент Тени', 'Клієнт Тіні', 'Shade customer'], ic: '🕶', shadow: true },
  { stat: 'tracesWiped', tiers: [1, 15, 80, 300], n: ['Чистильщик следов', 'Чистильник слідів', 'Trace cleaner'], ic: '🧤', shadow: true },
  { stat: 'bannedSold', tiers: [1, 10, 50, 200], n: ['Контрабандист', 'Контрабандист', 'Smuggler'], ic: '⛔', shadow: true },
  { stat: 'fenced', tiers: [1, 10, 50, 200], n: ['Друг скупщика', 'Друг скупника', 'Fence’s friend'], ic: '🤝', shadow: true },
  { stat: 'darkOrders', tiers: [1, 10, 50, 200], n: ['Под заказ', 'Під замовлення', 'Made to order'], ic: '📋', shadow: true },
  { stat: 'shadowFound', tiers: [1, 2, 3, 4], n: ['Ссылки из тьмы', 'Посилання з темряви', 'Links from the dark'], ic: '🕳', shadow: true },
  { stat: 'probes', tiers: [1, 10, 50, 200], n: ['Пробивщик', 'Пробивник', 'Background checker'], ic: '🔎', shadow: true },
  { stat: 'tgPosted', tiers: [1, 10, 50, 200], n: ['Свой у админов', 'Свій в адмінів', 'Admins’ friend'], ic: '📣', shadow: true },
  { stat: 'reflash', tiers: [1, 10, 50, 200], n: ['Перепрошивщик', 'Перепрошивальник', 'Reflasher'], ic: '📟', shadow: true },
  { stat: 'arrests', tiers: [1, 5, 20, 50], n: ['Завсегдатай обезьянника', 'Завсідник мавпятника', 'Holding‑cell regular'], ic: '🚔', shadow: true },
  { stat: 'stings', tiers: [1, 3, 10, 25], n: ['Попался на подставу', 'Попався на підставу', 'Fell for a sting'], ic: '🪤', shadow: true },
  { stat: 'burned', tiers: [1, 3, 10, 25], n: ['Засветился', 'Засвітився', 'Got burned'], ic: '📡', shadow: true },
  { stat: 'hotCaught', tiers: [1, 3, 10, 25], n: ['Под колпаком', 'Під ковпаком', 'Under watch'], ic: '👮', shadow: true },
  { stat: 'shady', tiers: [1, 10, 50, 200], n: ['Серые схемы', 'Сірі схеми', 'Grey schemes'], ic: '🌫', shadow: true },
];
// how to get each achievement (Quests → tap an achievement)
export const ACH_HOW = {
  sold: ['Продавайте вещи: Оликс, Авитон, аукцион, магазины, Телега — любая продажа считается.', 'Продавайте речі: Олікс, Авітон, аукціон, магазини, Телега — будь‑який продаж рахується.', 'Sell things anywhere: Oliks, auctions, shops, Telega — every sale counts.'],
  profit: ['Сумма прибыли со всех продаж (цена продажи минус цена покупки).', 'Сума прибутку з усіх продажів (ціна продажу мінус ціна купівлі).', 'Total profit from all sales (sale price minus purchase price).'],
  repairs: ['Чините вещи в «Мастерской» или сами — каждая починка.', 'Лагодьте речі в «Майстерні» або самі — кожен ремонт.', 'Repair things in the Workshop or yourself — every repair.'],
  freebies: ['Забирайте вещи в «Даром» (кто успел — того и вещь).', 'Забирайте речі в «Даром» (хто встиг — того й річ).', 'Grab items in Freebies.'],
  legit: ['Проверяйте подлинность в «Легит‑чеке».', 'Перевіряйте справжність у «Легіт‑чеку».', 'Authenticate items in Legit check.'],
  shifts: ['Отрабатывайте смены в «Работе».', 'Відпрацьовуйте зміни в «Роботі».', 'Work shifts in Jobs.'],
  auctionsWon: ['Выигрывайте лоты на аукционе.', 'Вигравайте лоти на аукціоні.', 'Win auction lots.'],
  boxes: ['Открывайте коробки и лутбоксы.', 'Відкривайте коробки й лутбокси.', 'Open mystery boxes.'],
  scamsCaught: ['Распознавайте мошенников в переписке (ссылки, предоплата) и не ведитесь.', 'Розпізнавайте шахраїв у листуванні (посилання, передоплата) й не ведіться.', 'Spot scammers in chats (links, prepayment) and don’t fall for it.'],
  abroad: ['Продавайте и покупайте в других странах.', 'Продавайте й купуйте в інших країнах.', 'Trade in other countries.'],
  shopSales: ['Продажи в ваших магазинах («Бизнес»).', 'Продажі у ваших магазинах («Бізнес»).', 'Sales in your own shops (Business).'],
  rareFound: ['Находите редкие вещи (★ редкость) на рынках, свалках, в контейнерах.', 'Знаходьте рідкісні речі (★ рідкість) на ринках, звалищах, у контейнерах.', 'Find rare items (★) at markets, dumps, containers.'],
  bought: ['Покупайте вещи где угодно.', 'Купуйте речі будь‑де.', 'Buy things anywhere.'],
  inspections: ['Осматривайте вещи перед покупкой (мини‑игра осмотра).', 'Оглядайте речі перед купівлею (міні‑гра огляду).', 'Inspect items before buying (inspection mini‑game).'],
  disputesWon: ['Выигрывайте споры в поддержке площадки.', 'Вигравайте суперечки в підтримці майданчика.', 'Win disputes with platform support.'],
  taxPaid: ['Платите налоги в «Госуслугах» (сумма за всё время).', 'Сплачуйте податки в «Держпослугах» (сума за весь час).', 'Pay taxes in the Gov app (all‑time total).'],
  containersOpened: ['Вскрывайте контейнеры на аукционах и в порту.', 'Розкривайте контейнери на аукціонах і в порту.', 'Open containers from auctions and the port.'],
  boxesOpened: ['Открывайте опт‑боксы из «АлиБаоЭкспресс» → «Опт с Китая».', 'Відкривайте опт‑бокси з «АліБаоЕкспрес» → «Опт з Китаю».', 'Open wholesale boxes from AliBaoExpress → China wholesale.'],
  pcBuilt: ['Собирайте ПК, ноутбуки и консоли из запчастей («Сборка»).', 'Збирайте ПК, ноутбуки й консолі з запчастин («Збірка»).', 'Build PCs, laptops and consoles from parts (Build).'],
  jailbreaks: ['Делайте джейлбрейк, рут и прошивки в «Phone Lab».', 'Робіть джейлбрейк, рут і прошивки в «Phone Lab».', 'Jailbreak, root and flash in Phone Lab.'],
  devicesOpened: ['Подключайте найденные накопители и телефоны к ПК и смотрите содержимое.', 'Підключайте знайдені накопичувачі й телефони до ПК і дивіться вміст.', 'Connect found drives and phones to the PC and look inside.'],
  lootFound: ['Используйте находки на накопителях (папка «Находки»).', 'Використовуйте знахідки на накопичувачах (тека «Знахідки»).', 'Use finds on drives (the «Finds» folder).'],
  virusRemoved: ['Удаляйте вирусы на «Моём ПК» (Диспетчер задач, антивирус).', 'Видаляйте віруси на «Моєму ПК» (Диспетчер завдань, антивірус).', 'Remove viruses on My PC (Task Manager, antivirus).'],
  venuesOpened: ['Открывайте заведения: «Бизнес» → «Заведения».', 'Відкривайте заклади: «Бізнес» → «Заклади».', 'Open venues: Business → Venues.'],
  homesBought: ['Покупайте недвижимость в «Недвижимости».', 'Купуйте нерухомість у «Нерухомості».', 'Buy property in Real estate.'],
  renovations: ['Делайте ремонты в квартирах и домах.', 'Робіть ремонти в квартирах і будинках.', 'Renovate flats and houses.'],
  trips: ['Путешествуйте между городами и странами.', 'Подорожуйте між містами й країнами.', 'Travel between cities and countries.'],
  auctionSold: ['Продавайте свои лоты на аукционе.', 'Продавайте свої лоти на аукціоні.', 'Sell your own lots at auction.'],
  casinoWin: ['Выигрывайте ставки в казино.', 'Вигравайте ставки в казино.', 'Win casino bets.'],
  numbersSold: ['Продавайте красивые номера телефонов.', 'Продавайте гарні номери телефонів.', 'Sell golden phone numbers.'],
  dumpster: ['Обыскивайте мусорки и свалки.', 'Обшукуйте смітники й звалища.', 'Search dumpsters and dumps.'],
  wholesale: ['Выкупайте оптовые партии.', 'Викуповуйте оптові партії.', 'Buy wholesale lots.'],
  tgSold: ['Продавайте через админов каналов в Телеге: группа → название → админ → «Разместить товар».', 'Продавайте через адмінів каналів у Телезі: група → назва → адмін → «Розмістити товар».', 'Sell via Telega admins: group → name → admin → Post an item.'],
  vinChecks: ['Пробивайте машины по VIN на «Авторынке».', 'Пробивайте машини за VIN на «Авторинку».', 'Run VIN checks on the Car Market.'],
  cleaned: ['Чистите вещи в «Мастерской» перед продажей.', 'Чистіть речі в «Майстерні» перед продажем.', 'Clean items in the Workshop before selling.'],
  quests: ['Выполняйте ежедневные задания.', 'Виконуйте щоденні завдання.', 'Complete daily quests.'],
  darkBuys: ['Покупайте товар в Тени (нужен VPN).', 'Купуйте товар у Тіні (потрібен VPN).', 'Buy goods in the Shade (VPN needed).'],
  tracesWiped: ['Убирайте следы с краденого: сами или через «мастеров».', 'Прибирайте сліди з краденого: самі або через «майстрів».', 'Wipe traces off stolen goods, yourself or via masters.'],
  bannedSold: ['Сбывайте запрещёнку: Тень → «Сбыт», Телега или Оликс под видом безопасного.', 'Збувайте заборонене: Тінь → «Збут», Телега або Олікс під виглядом безпечного.', 'Sell forbidden goods: Shade → Sell, Telega or disguised on Oliks.'],
  fenced: ['Отдавайте краденое скупщику в Тени.', 'Віддавайте крадене скупнику в Тіні.', 'Sell stolen goods to the Shade fence.'],
  darkOrders: ['Выполняйте заказы в Тени («Заказы»).', 'Виконуйте замовлення в Тіні («Замовлення»).', 'Fill Shade orders.'],
  shadowFound: ['Находите ссылки на скрытые приложения на чужих флешках, дисках и телефонах.', 'Знаходьте посилання на приховані застосунки на чужих флешках, дисках і телефонах.', 'Find links to hidden apps on other people’s drives and phones.'],
  probes: ['Пробивайте вещи и людей в «Пробиве».', 'Пробивайте речі й людей у «Пробиві».', 'Run lookups in Probiv.'],
  tgPosted: ['Договаривайтесь с админами Телеги о постах.', 'Домовляйтеся з адмінами Телеги про пости.', 'Get Telega admins to post your items.'],
  reflash: ['Перепрошивайте телефоны в «Phone Lab».', 'Перепрошивайте телефони в «Phone Lab».', 'Reflash phones in Phone Lab.'],
  arrests: ['Попадайте в обезьянник. Да, это тоже «достижение».', 'Потрапляйте в мавпятник. Так, це теж «досягнення».', 'End up in the holding cell. Yes, it counts.'],
  stings: ['Попадайтесь на контрольные закупки в Тени.', 'Попадайтеся на контрольні закупівлі в Тіні.', 'Fall for police stings in the Shade.'],
  burned: ['Заходите в скрытые приложения без VPN и засвечивайтесь.', 'Заходьте в приховані застосунки без VPN і засвічуйтеся.', 'Open hidden apps without a VPN and get burned.'],
  hotCaught: ['Попадайтесь полиции с краденым или запрещёнкой.', 'Попадайтеся поліції з краденим або забороненим.', 'Get caught with stolen or forbidden goods.'],
  shady: ['Совершайте сомнительные действия (присвоить кошелёк, продать подделку…) — даже если не поймали.', 'Робіть сумнівні дії (привласнити гаманець, продати підробку…) — навіть якщо не впіймали.', 'Do shady things (keep a wallet, sell a fake…) — even if you aren’t caught.'],
};
export function achTier(a) { const v = getStat(a.stat); let t = 0; for (const x of a.tiers) if (v >= x) t++; return t; }
// every achievement tier pays once: 🥉 $60 · 🥈 $500 · 🥇 $4 000 · 💎 $30 000 (× local wage level)
export const ACH_PAY = [0, 60, 500, 4000, 30000];
export const achClaimed = (a) => G.s.quests.claimed?.['ach_' + a.stat] || 0;
export function achReward(a) { const w = countryOf(G.s.player.city).wage; let sum = 0; for (let t = achClaimed(a) + 1; t <= achTier(a); t++) sum += ACH_PAY[t] * w; return Math.round(sum); }
export function claimAch(a) {
  const got = achReward(a);
  if (!got) return 0;
  (G.s.quests.claimed ||= {})['ach_' + a.stat] = achTier(a);
  earn(got, 'quest', T(`Достижение «${L(a.n)}»`, `Досягнення «${L(a.n)}»`, `Achievement “${L(a.n)}”`));
  addXP(40 * achTier(a));
  emit('quests');
  return got;
}
// the badge counts shadow achievements only while a VPN is on (they can't be seen or claimed otherwise)
export const achBadge = (shadowOk = false) => ACH.filter((a) => (!a.shadow || shadowOk) && achReward(a) > 0).length;

// ---------------------------------------------------------------- collections
const rx = (r) => (m) => r.test(m.id);
const named = (...parts) => (m) => parts.some((p) => m.id.includes(p));
export const SETS = [
  { id: 'ifone', n: ['Эволюция iFone', 'Еволюція iFone', 'iFone evolution'], cat: 'phones', slots: ['ifone_4', 'ifone_5s', 'ifone_6', 'ifone_7', 'ifone_8', 'ifone_x', 'ifone_11', 'ifone_12', 'ifone_13', 'ifone_14', 'ifone_15', 'ifone_16'], bonus: 0.05 },
  { id: 'retro', n: ['Ретро‑телефоны', 'Ретро‑телефони', 'Retro phones'], cat: 'phones', slots: ['nokla_3310', 'nokla_8800', 'nokla_n95', 'motorolla_raze_v3', 'blackberri_bold'], bonus: 0.06 },
  { id: 'aj1', n: ['Коллекция Air Jordon 1', 'Колекція Air Jordon 1', 'Air Jordon 1 collection'], cat: 'sneakers', slots: ['air_jordon_1_high_og_chicago', 'air_jordon_1_high_og_bred', 'air_jordon_1_high_og_university', 'air_jordon_1_high_og_dark_mocha', 'air_jordon_1_high_og_shadow', 'air_jordon_1_high_og_royal'], bonus: 0.06 },
  { id: 'watches', n: ['Часы‑легенды', 'Годинники‑легенди', 'Legendary watches'], cat: 'watches', slots: ['submarine_date', 'daytrona', 'speedmeister_moonwatch', 'nautilos', 'royal_oaker_15500', 'santo'], bonus: 0.05 },
  { id: 'ps', n: ['Все PlayStatien', 'Усі PlayStatien', 'Every PlayStatien'], cat: 'consoles', slots: ['playstatien_1', 'playstatien_2_fat', 'playstatien_3_fat', 'playstatien_4', 'playstatien_5'], bonus: 0.06 },
  { id: 'nin', n: ['Ретро Nintendu', 'Ретро Nintendu', 'Retro Nintendu'], cat: 'consoles', slots: ['nintendu_nes', 'super_nes', 'n64', 'gamecub', 'gameboi_1989', 'gameboi_color'], bonus: 0.06 },
  { id: 'base', n: ['Base Set Pocketmon', 'Base Set Pocketmon', 'Pocketmon Base Set'], cat: 'cards', slots: ['charizzard_holo_base_set', 'blastoize', 'venusaurr', 'mewtoo', 'raichoo', 'gyaradoss', 'pikachoo_жёлтые'], bonus: 0.08 },
  { id: 'ussr', n: ['Советская классика', 'Радянська класика', 'Soviet classics'], cat: 'cars', slots: ['2101', '2106', '2107', 'газ_21', 'москвичок', 'запорожик'], bonus: 0.05 },
  { id: 'bags', n: ['Сумки мечты', 'Сумки мрії', 'Dream bags'], cat: 'bags', slots: ['birkan', 'kelli', 'classic_flap', 'speedi', 'saddle'], bonus: 0.05 },
  { id: 'sw', n: ['Брики Star Warz', 'Брики Star Warz', 'Star Warz bricks'], cat: 'toys', slots: ['75192', '10179', '75159', '75313'], bonus: 0.07 },
  { id: 'golden', n: ['Золотой век комиксов', 'Золота доба коміксів', 'Golden age comics'], cat: 'comics', slots: ['action_comix_1', 'detective_comix_27', 'batmann_1', 'wonder_womann_1'], bonus: 0.1 },
  { id: 'nostalgia', n: ['Ностальгия 90‑х', 'Ностальгія 90‑х', '90s nostalgia'], cat: 'collectibles', cats: ['toys', 'collectibles', 'consoles'], slots: ['tamagochi', 'fyrby', 'love_is', 'tazos', 'киндер', 'денди'], bonus: 0.08 },
];
export function slotMatch(slot, modelId) { return modelId.includes(slot); }
export function setProgress(set) {
  const s = G.s;
  const filled = s.coll[set.id] || {};
  return { filled, n: Object.keys(filled).length, total: set.slots.length, done: Object.keys(filled).length >= set.slots.length };
}
export function slotsFor(it) {
  const out = [];
  for (const set of SETS) {
    if (!(set.cats || [set.cat]).includes(it.cat)) continue;
    for (const slot of set.slots) if (slotMatch(slot, it.m) && !(G.s.coll[set.id] || {})[slot]) out.push({ set, slot });
  }
  return out;
}
export function putInCollection(it, set, slot) {
  const s = G.s;
  (s.coll[set.id] ||= {})[slot] = { ...it, coll: set.id };
  s.inv = s.inv.filter((x) => x.id !== it.id);
  const p = setProgress(set);
  if (p.done && !s.quests.claimed['set_' + set.id]) {
    s.quests.claimed['set_' + set.id] = true;
    addXP(300);
    const pay = Math.round(set.slots.length * 400 * countryOf(s.player.city).wage);
    earn(pay, 'quest', T(`Коллекция «${L(set.n)}»`, `Колекція «${L(set.n)}»`, `Collection “${L(set.n)}”`));
    notify('collections', T('Коллекция собрана!', 'Колекцію зібрано!', 'Collection complete!'), `${L(set.n)}: +${Math.round(set.bonus * 100)}% · +${fmt(pay)}`);
  }
  emit('inv');
}
export function takeFromCollection(set, slot) {
  const s = G.s;
  const it = s.coll[set.id]?.[slot];
  if (!it) return;
  delete s.coll[set.id][slot];
  delete it.coll;
  s.inv.unshift(it);
  emit('inv');
}
export function collectionBonus(cat) {
  let b = 0;
  for (const set of SETS) if ((set.cats || [set.cat]).includes(cat) && setProgress(set).done) b += set.bonus;
  return b;
}
