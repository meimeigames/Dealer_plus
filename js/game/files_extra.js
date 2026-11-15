// More of what people leave on their devices. deviceFiles() calls extraFiles() after its own finds: everyday
// folders that depend on the kind of device (screenshots, Telegram, notes, torrents, backups, projects, RAW shots,
// console clips, CCTV…) and "loot" — gift cards, game accounts, seed phrases, tickets, licence keys, someone's
// novel, lottery tickets… Each loot file has one-time actions in its preview, some honest, some risky.
// Everything is rolled on its own RNG, so the older finds of a device never change.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { PHOTO_FILES } from '../data/photos.js';
import { earn, addXP, addReview, stat, notify } from './player.js';
import { fmt } from '../core/money.js';
import { policeFine } from './crime.js';
import { findApp } from './shadow.js';
import { limitedSkins, unlockSkin } from './cardskins.js';

const pad = (n, k = 4) => String(n).padStart(k, '0');
const sc = (e, ru, uk, en) => [e, ru, uk, en];
const tx = (a) => T(a[0], a[1], a[2]);
const pic = (r) => { const c = PHOTO_FILES.clean || []; return c.length ? `assets/photos/clean/${r.pick(c)}.webp` : ''; };

// ---------------------------------------------------------------- content pools
const SHOTS = [
  sc('💸', 'Чек перевода маме', 'Чек переказу мамі', 'Transfer receipt to mum'), sc('🗺', 'Маршрут до дачи', 'Маршрут до дачі', 'Route to the cottage'),
  sc('🐱', 'Мем с котом', 'Мем з котом', 'Cat meme'), sc('🛒', 'Корзина маркетплейса', 'Кошик маркетплейсу', 'Marketplace cart'),
  sc('💬', 'Переписка «ну ты где?»', 'Листування «ну ти де?»', 'Chat: “where are you?”'), sc('🏨', 'Бронь отеля', 'Бронювання готелю', 'Hotel booking'),
  sc('🎮', 'Рекорд в игре', 'Рекорд у грі', 'Game high score'), sc('🍰', 'Рецепт торта из ТикТока', 'Рецепт торта з ТікТоку', 'Cake recipe from TikTok'),
  sc('📦', 'Трек‑номер посылки', 'Трек‑номер посилки', 'Parcel tracking number'), sc('🏋️', 'Программа тренировок', 'Програма тренувань', 'Workout plan'),
  sc('📈', 'График биткоина', 'Графік біткоїна', 'Bitcoin chart'), sc('🚗', 'Штраф за парковку', 'Штраф за паркування', 'Parking ticket'),
  sc('❤️', 'Сторис бывшей', 'Сторіс колишньої', 'An ex’s story'), sc('🧾', 'Квитанция за свет', 'Квитанція за світло', 'Electricity bill'),
  sc('✈️', 'Посадочный талон', 'Посадковий талон', 'Boarding pass'), sc('🍕', 'Заказ пиццы', 'Замовлення піци', 'Pizza order'),
  sc('📚', 'Расписание пар', 'Розклад пар', 'Class timetable'), sc('🛋', 'Диван с объявления', 'Диван з оголошення', 'A sofa from an ad'),
];
const VOICES = [
  ['«Купи хлеба и не забудь про собаку»', '«Купи хліба й не забудь про собаку»', '“Buy bread and don’t forget the dog”'],
  ['«Я опаздываю, начинайте без меня»', '«Я запізнююсь, починайте без мене»', '“Running late, start without me”'],
  ['«Перезвони, это срочно!»', '«Передзвони, це терміново!»', '“Call me back, it’s urgent!”'],
  ['«Ключи под ковриком, кот накормлен»', '«Ключі під килимком, кіт нагодований»', '“Keys under the mat, the cat is fed”'],
  ['Кто‑то поёт в душе. Фальшиво.', 'Хтось співає в душі. Фальшиво.', 'Someone singing in the shower. Off key.'],
  ['«Сколько можно ждать мастера?!»', '«Скільки можна чекати майстра?!»', '“How long do we wait for the repairman?!”'],
  ['«Мам, я сдал! Сдал!!»', '«Мам, я здав! Здав!!»', '“Mum, I passed! I passed!!”'],
];
const NOTES = [
  ['Подарки на НГ: маме — плед, папе — набор отвёрток, Лёше — ???', 'Подарунки на НР: мамі — плед, татові — набір викруток, Льоші — ???', 'New Year gifts: mum — a blanket, dad — screwdrivers, Lyosha — ???'],
  ['Долги: Вася — 500, Серёга — 1200 (не отдаст)', 'Борги: Вася — 500, Сергій — 1200 (не віддасть)', 'Debts: Vasya — 500, Seryoga — 1200 (won’t pay)'],
  ['Идея бизнеса: шаурма на колёсах. Посчитать аренду и патент.', 'Ідея бізнесу: шаурма на колесах. Порахувати оренду й патент.', 'Business idea: a shawarma truck. Work out rent and licence.'],
  ['Тренировки: пн — грудь, ср — спина, пт — ноги (пропустил)', 'Тренування: пн — груди, ср — спина, пт — ноги (пропустив)', 'Workouts: Mon chest, Wed back, Fri legs (skipped)'],
  ['В поход: палатка, спальник, тушёнка, павербанк, НЕ ЗАБЫТЬ СПИЧКИ', 'У похід: намет, спальник, тушонка, павербанк, НЕ ЗАБУТИ СІРНИКИ', 'Camping: tent, sleeping bag, canned meat, power bank, DON’T FORGET MATCHES'],
  ['Окно в зале: 145 × 230. Шторы — блэкаут.', 'Вікно у залі: 145 × 230. Штори — блекаут.', 'Living room window: 145 × 230. Blackout curtains.'],
  ['Досмотреть: «Во все тяжкие» 4 сезон, «Чернобыль»', 'Додивитися: «Пуститися берега» 4 сезон, «Чорнобиль»', 'To finish: Breaking Bad S4, Chernobyl'],
  ['Ремонт: плитка 380/м², работа 450/м², клей 6 мешков', 'Ремонт: плитка 380/м², робота 450/м², клей 6 мішків', 'Renovation: tiles 380/m², labour 450/m², 6 bags of glue'],
  ['Сны: опять опоздал на поезд. К чему это?', 'Сни: знову запізнився на потяг. До чого це?', 'Dreams: missed the train again. What does it mean?'],
  ['Не звонить Оле до пятницы. Держаться.', 'Не дзвонити Олі до пʼятниці. Триматися.', 'Don’t call Olya till Friday. Stay strong.'],
];
const DIPLOMA = [['Диплом_Иванов_v7_ФИНАЛ.docx', 'Диплом_Іванов_v7_ФІНАЛ.docx', 'Thesis_v7_FINAL.docx'], ['Презентация на защиту.pptx', 'Презентація на захист.pptx', 'Defence slides.pptx'], ['Курсовая по сопромату.docx', 'Курсова з опору матеріалів.docx', 'Strength of materials essay.docx'], ['Реферат «История края».doc', 'Реферат «Історія краю».doc', 'Report “Local history”.doc']];
const MOVIES = ['Бригада', 'Матрица', 'Брат 2', 'Шрек', 'Аватар', 'Интерстеллар', 'Ирония судьбы', 'Начало', 'Гладиатор', 'Пираты Карибского моря', 'Титаник', 'Однажды в Голливуде'];
const SERIES = ['Друзья', 'Во все тяжкие', 'Игра престолов', 'Шерлок', 'Офис', 'Сваты', 'Кухня', 'Ведьмак'];
const GAMES = ['Сталкер', 'Ведьмак 3', 'GTA San Andreas', 'Counter‑Strike 1.6', 'Героes III', 'NFS Most Wanted', 'Minecraft', 'Fallaut 4', 'Скайрим', 'Dota 2', 'Сапёр'];
const MOBGAMES = ['Brawl Starz', 'Clash of Clons', 'PUBG Mobail', 'Genshin Impakt', 'Стэндофф 2', 'Roblocks', 'Сабвэй Серф'];
const CONGAMES = ['FEFA 24', 'Call of Duti', 'Grand Theft Avto V', 'Fortnait', 'God of Wor', 'Spider‑Mann 2', 'Mario Kart 8'];
const SHOPS = ['Розетко', 'Фокстрот', 'Цитрус', 'Комфи', 'Эльдорадо', 'М.Видос'];

// a set of extra folders for each kind of device; each maker returns [folderName, files]
function makers(ctx) {
  const { r, f, year, couple, firm, pet } = ctx;
  const ph = (n, prefix, cam, scenes, o = {}) => Array.from({ length: n }, () => { const real = r.chance(o.real ?? 0.3); return f(`${prefix}${pad(r.int(1000, 9999))}.${o.ext || 'jpg'}`, 'photo', +(r.float(o.lo || 1.5, o.hi || 6)).toFixed(1), { cam, scene: real ? null : r.pick(scenes), img: real ? pic(r) : '', personal: !!o.personal }); });
  const vid = (name, mb, dur, o = {}) => f(name, 'video', mb, { dur, ...o });
  const txt = (name, text, o = {}) => f(name, 'text', 0.002, { text, ...o });
  const doc = (name, text, o = {}) => f(name, 'doc', +(r.float(0.1, 3)).toFixed(1), { text, ...o });
  const FAMILY = [sc('🎂', 'День рождения', 'День народження', 'Birthday'), sc('🏖', 'Море', 'Море', 'At the sea'), sc('🎄', 'Новый год', 'Новий рік', 'New Year'), sc('👶', 'Первые шаги', 'Перші кроки', 'First steps'), sc('🐶', 'Собака на даче', 'Собака на дачі', 'Dog at the cottage'), sc('🏔', 'Горы', 'Гори', 'Mountains'), sc('💒', 'Свадьба друзей', 'Весілля друзів', 'Friends’ wedding'), sc('🎓', 'Выпускной', 'Випускний', 'Graduation')];
  return {
    shots: () => [T('Скриншоты', 'Скріншоти', 'Screenshots'), r.sample(SHOTS, r.int(3, 8)).map((s) => f(`Screenshot_${year}${pad(r.int(101, 1231))}-${pad(r.int(0, 2359))}.png`, 'photo', 0.6, { scene: s, personal: s[0] === '💳' || s[0] === '❤️' }))],
    telegram: () => ['Telegram', [f(T('Стикерпак «Котики» (48).tgs', 'Стікерпак «Котики» (48).tgs', 'Sticker pack “Cats” (48).tgs'), 'archive', 2.1), f(`voice_${pad(r.int(1, 999), 3)}.ogg`, 'audio', 0.3, { dur: `0:${pad(r.int(5, 59), 2)}`, text: tx(r.pick(VOICES)), personal: true }), vid(T('Видеокружок.mp4', 'Відеокружечок.mp4', 'Video note.mp4'), 4, '0:38', { scene: r.pick(FAMILY), personal: true }), doc(T('Документ от бухгалтера.pdf', 'Документ від бухгалтера.pdf', 'From the accountant.pdf'), T('Акт сверки за квартал. Подпись, печать.', 'Акт звірки за квартал. Підпис, печатка.', 'Quarterly reconciliation. Signed and stamped.'))]],
    viber: () => ['Viber', [f('IMG-' + year + pad(r.int(101, 1231)) + '-V' + pad(r.int(1, 99), 2) + '.jpg', 'photo', 0.4, { img: pic(r) }), f(T('Открытка «С Днём Ангела».gif', 'Листівка «З Днем Ангела».gif', 'Greeting card.gif'), 'photo', 0.9, { scene: sc('🌹', 'Открытка от тёти', 'Листівка від тітки', 'A card from an aunt') }), f(T('Голосовое от бабушки.m4a', 'Голосове від бабусі.m4a', 'Grandma’s voice note.m4a'), 'audio', 0.4, { dur: '2:14', text: T('«…и шапку надень, там холодно!»', '«…і шапку вдягни, там холодно!»', '“…and wear a hat, it’s cold!”'), personal: true })]],
    voice: () => [T('Диктофон', 'Диктофон', 'Recorder'), Array.from({ length: r.int(2, 5) }, (_, i) => f(T(`Запись ${i + 1}.m4a`, `Запис ${i + 1}.m4a`, `Recording ${i + 1}.m4a`), 'audio', +(r.float(0.2, 9)).toFixed(1), { dur: `${r.int(0, 14)}:${pad(r.int(0, 59), 2)}`, text: tx(r.pick([...VOICES, ['Разговор с начальником про отпуск. Неловко.', 'Розмова з начальником про відпустку. Ніяково.', 'Talking to the boss about leave. Awkward.'], ['Песня в караоке. Громко.', 'Пісня в караоке. Гучно.', 'Karaoke. Loud.']])) }))],
    notes: () => [T('Заметки', 'Нотатки', 'Notes'), r.sample(NOTES, r.int(2, 4)).map((n, i) => txt(T(`Заметка ${i + 2}.txt`, `Нотатка ${i + 2}.txt`, `Note ${i + 2}.txt`), tx(n)))],
    passnote: () => [T('Заметки', 'Нотатки', 'Notes'), [txt(T('пароли.txt', 'паролі.txt', 'passwords.txt'), T(`почта: ${couple[1].toLowerCase()}1987 · инста: ${pet[1]}2015 · банк — НЕ ЗАПИСЫВАТЬ`, `пошта: ${couple[1].toLowerCase()}1987 · інста: ${pet[1]}2015 · банк — НЕ ЗАПИСУВАТИ`, `mail: ${couple[1].toLowerCase()}1987 · insta: ${pet[1]}2015 · bank — DON’T WRITE IT`), { personal: true })]],
    calendar: () => [T('Календарь', 'Календар', 'Calendar'), [txt(T('События.ics', 'Події.ics', 'Events.ics'), T(`ДР мамы — 14 марта · ТО машины — май · Стоматолог — вт 9:30 · Годовщина с ${couple[0]} — 2 августа`, `ДН мами — 14 березня · ТО авто — травень · Стоматолог — вт 9:30 · Річниця з ${couple[0]} — 2 серпня`, `Mum’s birthday — 14 March · Car service — May · Dentist — Tue 9:30 · Anniversary with ${couple[0]} — 2 August`), { personal: true })]],
    health: () => { const k = r.int(2, 12), k2 = pad(r.int(0, 999), 3), h = r.int(5, 7), mn = r.int(0, 59); return [T('Здоровье', 'Здоровʼя', 'Health'), [txt(T('Шаги.csv', 'Кроки.csv', 'Steps.csv'), T(`В среднем ${k} ${k2} шагов в день. Рекорд — в день переезда.`, `У середньому ${k} ${k2} кроків на день. Рекорд — у день переїзду.`, `Avg ${k},${k2} steps a day. Record — moving day.`)), txt(T('Сон.csv', 'Сон.csv', 'Sleep.csv'), T(`Спит в среднем ${h} ч ${mn} мин. Ложится после часа ночи.`, `Спить у середньому ${h} год ${mn} хв. Лягає після першої ночі.`, `Sleeps ${h} h ${mn} min on average. Goes to bed after 1 am.`))]]; },
    apps: () => [T('Приложения', 'Застосунки', 'Apps'), r.sample(MOBGAMES, r.int(2, 4)).map((g) => f(`${g} — ${T('уровень', 'рівень', 'level')} ${r.int(3, 180)}`, 'game', r.int(300, 4000))).concat([((k) => txt('Duolingo', T(`Серия: ${k} дней подряд. Испанский.`, `Серія: ${k} днів поспіль. Іспанська.`, `Streak: ${k} days. Spanish.`)))(r.int(3, 700))])],
    videos: () => [T('Видео', 'Відео', 'Videos'), r.sample([
      vid(T('Концерт (с 20-го ряда).mp4', 'Концерт (з 20-го ряду).mp4', 'Concert (row 20).mp4'), r.int(200, 900), `${r.int(1, 6)}:${pad(r.int(0, 59), 2)}`, { scene: sc('🎤', 'Концерт', 'Концерт', 'Concert') }),
      vid(T('Салют.mp4', 'Салют.mp4', 'Fireworks.mp4'), r.int(50, 300), '0:52', { scene: sc('🎆', 'Салют', 'Салют', 'Fireworks') }),
      vid(T('Первые шаги.mp4', 'Перші кроки.mp4', 'First steps.mp4'), r.int(40, 200), '0:31', { scene: FAMILY[3], personal: true }),
      vid(T('Таймлапс заката.mp4', 'Таймлапс заходу.mp4', 'Sunset timelapse.mp4'), r.int(60, 400), '0:20', { scene: sc('🌅', 'Закат', 'Захід сонця', 'Sunset') }),
      vid(T('Кот и лазер.mp4', 'Кіт і лазер.mp4', 'Cat vs laser.mp4'), r.int(20, 120), '0:44', { scene: sc('🐈', 'Кот гоняет лазер', 'Кіт ганяє лазер', 'Cat chasing a laser') }),
      vid(T('Сосед сверлит.mp4', 'Сусід свердлить.mp4', 'Neighbour drilling.mp4'), r.int(10, 60), '0:15', { scene: sc('🔨', 'Доказательство для ОСББ', 'Доказ для ОСББ', 'Proof for the HOA') }),
    ], r.int(2, 4))],
    selfies: () => [T('Селфи', 'Селфі', 'Selfies'), ph(r.int(4, 9), 'IMG_', 'Front camera', [sc('🤳', 'Селфи в лифте', 'Селфі в ліфті', 'Lift selfie'), sc('🤳', 'Селфи с котом', 'Селфі з котом', 'Selfie with the cat'), sc('🤳', 'Новая стрижка', 'Нова стрижка', 'New haircut')], { personal: true, real: 0 })],
    family: () => [((y) => T(`Отпуск ${y}`, `Відпустка ${y}`, `Holiday ${y}`))(year - r.int(0, 5)), ph(r.int(5, 12), 'IMG_', 'Phone', FAMILY, { personal: true, real: 0.25 })],
    // computers and hard drives
    projects: () => [T('Проекты', 'Проєкти', 'Projects'), r.sample([
      doc(tx(r.pick(DIPLOMA)), T('Глава 1. Литературный обзор… (на полях — «переписать!!»)', 'Розділ 1. Огляд літератури… (на полях — «переписати!!»)', 'Chapter 1. Literature review… (margin note: “rewrite!!”)')),
      doc(T('Бизнес-план кофейни.docx', 'Бізнес-план кавʼярні.docx', 'Coffee shop plan.docx'), T('Окупаемость: 14 месяцев (оптимистично). Аренда — 900 $/мес.', 'Окупність: 14 місяців (оптимістично). Оренда — 900 $/міс.', 'Payback: 14 months (optimistic). Rent — $900/mo.')),
      doc(T('Смета ремонта.xlsx', 'Кошторис ремонту.xlsx', 'Renovation estimate.xlsx'), T('Итого: в 2 раза больше, чем планировали.', 'Разом: удвічі більше, ніж планували.', 'Total: twice what was planned.')),
      f(T('Чертёж дома.dwg', 'Креслення будинку.dwg', 'House drawing.dwg'), 'doc', 14),
      f(T('Сайт пиццерии (исходники).zip', 'Сайт піцерії (вихідники).zip', 'Pizzeria website (source).zip'), 'archive', 38),
      doc(T('Презентация инвесторам.pptx', 'Презентація інвесторам.pptx', 'Investor deck.pptx'), T('Слайд 7: «Мы — Uber для кошек».', 'Слайд 7: «Ми — Uber для котів».', 'Slide 7: “We’re Uber for cats”.')),
    ], r.int(2, 4))],
    torrents: () => [T('Торренты', 'Торенти', 'Torrents'), [f(`*.torrent (${r.int(12, 140)})`, 'archive', 1.2), vid(`${r.pick(SERIES)} S01–S${pad(r.int(3, 10), 2)} 1080p`, r.int(20000, 90000), `${r.int(30, 120)} ${T('серий', 'серій', 'eps')}`), f(`${r.pick(GAMES)} RePack by Xatab`, 'game', r.int(3000, 40000)), vid(`${r.pick(MOVIES)} (${r.int(1995, 2020)}) BDRip.mkv`, r.int(1400, 9000), `2:${pad(r.int(0, 59), 2)}:00`)]],
    backups: () => [T('Бэкапы', 'Бекапи', 'Backups'), [f(`iPhone Backup ${year - r.int(1, 5)}`, 'archive', r.int(4000, 60000), { personal: true }), f('WhatsApp_backup.crypt14', 'archive', r.int(200, 3000), { personal: true }), f(T('Фото с телефона (старое).zip', 'Фото з телефона (старе).zip', 'Old phone photos.zip'), 'archive', r.int(800, 9000), { personal: true })]],
    browser: () => [T('Браузер', 'Браузер', 'Browser'), [txt(T('Закладки.html', 'Закладки.html', 'Bookmarks.html'), T('Объявления, госуслуги, рецепты, «как сбросить пароль», «болит спина что делать»', 'Оголошення, Дія, рецепти, «як скинути пароль», «болить спина що робити»', 'Classifieds, gov services, recipes, “how to reset a password”, “back pain what to do”')), ((k) => txt(T('Пароли браузера.csv', 'Паролі браузера.csv', 'Browser passwords.csv'), T(`${k} сохранённых паролей: почта, банк, соцсети, маркетплейсы…`, `${k} збережених паролів: пошта, банк, соцмережі, маркетплейси…`, `${k} saved passwords: mail, bank, social, shops…`), { personal: true }))(r.int(18, 90)), txt(T('История.txt', 'Історія.txt', 'History.txt'), T('Последний запрос: «как удалить историю браузера»', 'Останній запит: «як видалити історію браузера»', 'Last search: “how to delete browser history”'))]],
    study: () => [T('Учёба', 'Навчання', 'Study'), [vid(T('Курс Python (48 уроков)', 'Курс Python (48 уроків)', 'Python course (48 lessons)'), r.int(4000, 16000), `${r.int(18, 40)} ${T('ч', 'год', 'h')}`), doc(T('Английский за 30 дней.pdf', 'Англійська за 30 днів.pdf', 'English in 30 days.pdf'), T('Открыт на 3-й странице.', 'Відкрито на 3-й сторінці.', 'Bookmarked at page 3.')), doc(T('Билеты к экзамену.docx', 'Білети до іспиту.docx', 'Exam questions.docx'), T('62 вопроса. Выучено — 9.', '62 питання. Вивчено — 9.', '62 questions. Learned — 9.'))]],
    edit: () => [T('Монтаж', 'Монтаж', 'Editing'), [f(`Vlog_${r.int(3, 40)}.prproj`, 'doc', 2.4), vid(T('Исходники GoPro', 'Вихідники GoPro', 'GoPro footage'), r.int(8000, 60000), `${r.int(1, 5)}:${pad(r.int(0, 59), 2)}:00`, { scene: sc('🚵', 'Велопоход', 'Велопохід', 'Bike trip') }), f(T('Превью для YouTube.psd', 'Превʼю для YouTube.psd', 'YouTube thumbnail.psd'), 'photo', 48, { scene: sc('😱', 'Превью: «ВЫ НЕ ПОВЕРИТЕ»', 'Превʼю: «ВИ НЕ ПОВІРИТЕ»', 'Thumbnail: “YOU WON’T BELIEVE”') })]],
    work: () => [T('Работа', 'Робота', 'Work'), [((k) => doc(T('Отчёт за квартал.xlsx', 'Звіт за квартал.xlsx', 'Quarterly report.xlsx'), T(`${firm}: план выполнен на ${k}%.`, `${firm}: план виконано на ${k}%.`, `${firm}: plan ${k}% done.`)))(r.int(61, 104)), doc(T('Прайс поставщика.xlsx', 'Прайс постачальника.xlsx', 'Supplier prices.xlsx'), T('Закупочные цены на 300 позиций.', 'Закупівельні ціни на 300 позицій.', 'Purchase prices for 300 items.')), f(T('Подпись (скан).png', 'Підпис (скан).png', 'Signature (scan).png'), 'photo', 0.2, { scene: sc('✍️', 'Скан подписи', 'Скан підпису', 'Signature scan'), personal: true })]],
    design: () => [T('Дизайн', 'Дизайн', 'Design'), [f(T('Логотип_финал_финал2.psd', 'Логотип_фінал_фінал2.psd', 'Logo_final_final2.psd'), 'photo', 62, { scene: sc('🎨', 'Логотип шаурмичной', 'Логотип шаурмічної', 'A shawarma place logo') }), ((k) => f(T(`Шрифты (${k})`, `Шрифти (${k})`, `Fonts (${k})`), 'archive', r.int(40, 900)))(r.int(80, 600)), f(T('Мемы для паблика', 'Меми для пабліка', 'Memes for the channel'), 'photo', 2, { scene: sc('🤣', 'Мемы', 'Меми', 'Memes') })]],
    tax: () => [T('ФЛП и налоги', 'ФОП і податки', 'Taxes'), [doc(T('Декларация.xml', 'Декларація.xml', 'Tax return.xml'), T('Доход за год, 3‑я группа, 5%.', 'Дохід за рік, 3‑тя група, 5%.', 'Annual income, flat 5% tax.'), { personal: true }), doc(T('Выписка из банка.pdf', 'Виписка з банку.pdf', 'Bank statement.pdf'), T('Все поступления и траты за год. Много доставки еды.', 'Усі надходження й витрати за рік. Багато доставки їжі.', 'All income and spending for a year. Lots of food delivery.'), { personal: true })]],
    pcgames: () => [T('Игры', 'Ігри', 'Games'), r.sample(GAMES, r.int(2, 5)).map((g) => f(`${g}/`, 'game', r.int(300, 60000))).concat([f(T('Сохранения Minecraft — мир «Дом»', 'Збереження Minecraft — світ «Дім»', 'Minecraft saves — world “Home”'), 'save', 120)])],
    cctv: () => [T('Видеонаблюдение', 'Відеоспостереження', 'CCTV'), Array.from({ length: r.int(3, 7) }, () => vid(`CAM${r.int(1, 8)}_${year}${pad(r.int(101, 1231))}_${pad(r.int(0, 2359))}.h264`, r.int(200, 2000), '1:00:00', { scene: sc('📹', r.pick(['Подъезд', 'Парковка', 'Склад', 'Касса']), 'Камера', 'Camera') }))],
    // flash drives
    usbmix: () => [T('Разное', 'Різне', 'Misc'), r.sample([
      doc(tx(r.pick(DIPLOMA)), T('Титульный лист и 40 страниц текста.', 'Титульний аркуш і 40 сторінок тексту.', 'Title page and 40 pages.')),
      f(T('Драйвера принтера HP', 'Драйвери принтера HP', 'HP printer drivers'), 'archive', 140), f(T('Загрузочная Windows 10.iso', 'Завантажувальна Windows 10.iso', 'Windows 10 boot.iso'), 'archive', 4700),
      f(T('Караоке хиты (MIDI)', 'Караоке хіти (MIDI)', 'Karaoke hits (MIDI)'), 'music', 9), vid(T('Фильм в дорогу.mkv', 'Фільм у дорогу.mkv', 'Movie for the trip.mkv'), r.int(700, 2500), '1:52:00'),
      f(T('Прошивка роутера.bin', 'Прошивка роутера.bin', 'Router firmware.bin'), 'archive', 16), doc(T('Документы на визу.pdf', 'Документи на візу.pdf', 'Visa documents.pdf'), T('Анкета, справка с работы, выписка — всё с паспортными данными.', 'Анкета, довідка з роботи, виписка — усе з паспортними даними.', 'Form, job letter, bank statement — all with passport details.'), { personal: true }),
      doc(T('Список гостей на свадьбу.xlsx', 'Список гостей на весілля.xlsx', 'Wedding guest list.xlsx'), T('120 человек. Тётю Свету не звать!', '120 людей. Тітку Свєту не кликати!', '120 people. Do NOT invite aunt Sveta!'), { personal: true }),
      f(T('Портфолио.pdf', 'Портфоліо.pdf', 'Portfolio.pdf'), 'doc', 24), doc(T('Сканы трудовой книжки.pdf', 'Скани трудової книжки.pdf', 'Employment record scans.pdf'), T('Все места работы с 2004 года.', 'Усі місця роботи з 2004 року.', 'Every job since 2004.'), { personal: true }),
    ], r.int(2, 4))],
    // cameras, cards, drones
    raw: () => ['RAW', Array.from({ length: r.int(4, 12) }, () => f(`${r.pick(['IMG_', 'DSC_', '_MG_'])}${pad(r.int(1000, 9999))}.${r.pick(['CR2', 'NEF', 'ARW', 'RAF'])}`, 'photo', +(r.float(18, 42)).toFixed(1), { cam: 'RAW', img: r.chance(0.5) ? pic(r) : '', scene: r.pick([sc('🏙', 'Город ночью', 'Місто вночі', 'City at night'), sc('🌲', 'Лес', 'Ліс', 'Forest'), sc('🛍', 'Съёмка товара', 'Зйомка товару', 'Product shot'), sc('👰', 'Свадебная съёмка', 'Весільна зйомка', 'Wedding shoot')]) }))],
    timelapse: () => [T('Таймлапс', 'Таймлапс', 'Timelapse'), [f(`TL_${pad(r.int(1, 99), 2)} (${r.int(300, 1500)} ${T('кадров', 'кадрів', 'frames')})`, 'archive', r.int(2000, 12000)), vid(T('Таймлапс облаков.mp4', 'Таймлапс хмар.mp4', 'Clouds timelapse.mp4'), r.int(100, 500), '0:24', { scene: sc('☁️', 'Облака', 'Хмари', 'Clouds') })]],
    aerial: () => [T('Аэросъёмка', 'Аерозйомка', 'Aerial'), [vid('DJI_' + pad(r.int(1, 999), 4) + '.MP4', r.int(400, 3000), `${r.int(1, 9)}:${pad(r.int(0, 59), 2)}`, { scene: sc('🏞', 'Карпаты с высоты', 'Карпати з висоти', 'Mountains from above') }), f('PANO_' + pad(r.int(1, 99), 4) + '.jpg', 'photo', 12, { scene: sc('🏡', 'Участок под продажу', 'Ділянка на продаж', 'A plot for sale') })]],
    // consoles
    clips: () => [T('Клипы', 'Кліпи', 'Clips'), Array.from({ length: r.int(2, 6) }, () => vid(`${r.pick(CONGAMES)} — ${r.pick([T('эпичный момент', 'епічний момент', 'epic moment'), T('баг', 'баг', 'glitch'), T('победа', 'перемога', 'victory'), T('фейл', 'фейл', 'fail')])}.mp4`, r.int(20, 300), `${r.int(0, 2)}:${pad(r.int(5, 59), 2)}`, { scene: sc('🎮', 'Геймплей', 'Геймплей', 'Gameplay') }))],
    trophies: () => { const a = r.int(0, 9), b = r.int(40, 900), g = r.pick(CONGAMES), fr = r.int(3, 180); return [T('Достижения', 'Досягнення', 'Trophies'), [txt(T('Трофеи', 'Трофеї', 'Trophies'), T(`Платины: ${a} · всего ${b} трофеев · последняя игра ${g}`, `Платини: ${a} · усього ${b} трофеїв · остання гра ${g}`, `Platinums: ${a} · ${b} trophies · last played ${g}`)), txt(T('Друзья', 'Друзі', 'Friends'), T(`${fr} друзей, сообщения: «го катку»`, `${fr} друзів, повідомлення: «го катку»`, `${fr} friends, messages: “one more game?”`), { personal: true })]]; },
    // dashcams, office, discs, tapes
    parking: () => ['Parking', Array.from({ length: r.int(2, 6) }, () => vid(`PARK_${year}${pad(r.int(101, 1231))}_${pad(r.int(0, 2359))}.MP4`, r.int(20, 90), '0:30', { dashcam: true, text: tx(r.pick([['Кто‑то паркуется вплотную.', 'Хтось паркується впритул.', 'Someone parks too close.'], ['Кот прошёл по капоту.', 'Кіт пройшов по капоту.', 'A cat walked over the bonnet.'], ['Удар дверью соседней машины.', 'Удар дверима сусіднього авто.', 'A door ding from the next car.']])) }))],
    gps: () => { const k = r.int(3, 40); return ['GPS', [txt(`track_${year}.gpx`, T(`Маршруты за год: ${k} тыс. км, чаще всего — дом ↔ работа.`, `Маршрути за рік: ${k} тис. км, найчастіше — дім ↔ робота.`, `Routes for a year: ${k}k km, mostly home ↔ work.`), { personal: true })]]; },
    officeMisc: () => [T('Сканы', 'Скани', 'Scans'), [doc(T('Накладные_2021.pdf', 'Накладні_2021.pdf', 'Waybills_2021.pdf'), T('Сотни накладных на поставки.', 'Сотні накладних на поставки.', 'Hundreds of delivery notes.')), doc(T('Табель.xlsx', 'Табель.xlsx', 'Timesheet.xlsx'), T('Кто когда опаздывал. Подробно.', 'Хто коли запізнювався. Детально.', 'Who was late and when. In detail.'), { personal: true }), doc(T('Инструкция по ТБ.doc', 'Інструкція з ТБ.doc', 'Safety manual.doc'), T('Подписи сотрудников: 2 из 40.', 'Підписи працівників: 2 з 40.', 'Staff signatures: 2 of 40.'))]],
    oldcd: () => [T('Бонус', 'Бонус', 'Extras'), [r.pick([f(T('Энциклопедия Кирилла и Мефодия', 'Енциклопедія Кирила і Мефодія', 'Old encyclopedia CD'), 'archive', 600), f(T('Антивирус 2005 (ключ на коробке)', 'Антивірус 2005 (ключ на коробці)', 'Antivirus 2005 (key on the box)'), 'archive', 90), f('Kodak Picture CD', 'archive', 120)]), r.pick([doc('README.TXT', T('Спасибо за покупку! Техподдержка: 8‑800‑…', 'Дякуємо за покупку! Техпідтримка: 0‑800‑…', 'Thanks for buying! Support: 0‑800‑…')), f('SETUP.ICO', 'photo', 0.01, { scene: sc('💿', 'Иконка установщика', 'Іконка інсталятора', 'Installer icon') })])]],
    floppy: () => ['A:\\', [doc('REFERAT.DOC', T('Реферат по истории, 1998. Шрифт Times, 14 кегль.', 'Реферат з історії, 1998. Шрифт Times, 14 кегль.', 'History essay, 1998. Times, 14pt.')), f('TETRIS.EXE', 'exe', 0.05), txt('AUTOEXEC.BAT', '@ECHO OFF\nPROMPT $P$G\nC:\\NC\\NC.EXE'), f(T('BUH1997.DBF', 'BUH1997.DBF', 'BUH1997.DBF'), 'doc', 0.8)]],
    tapes: () => [T('Записи', 'Записи', 'Recordings'), r.sample([f(T('Запись с радио (1997)', 'Запис з радіо (1997)', 'Radio recording (1997)'), 'audio', 0, { dur: '45:00' }), f(T('Голос бабушки', 'Голос бабусі', 'Grandma’s voice'), 'audio', 0, { dur: '12:40', personal: true, text: T('«…а вот в наше время…»', '«…а от у наш час…»', '“…back in our day…”') }), f(T('Уроки английского, кассета 3', 'Уроки англійської, касета 3', 'English lessons, tape 3'), 'audio', 0, { dur: '30:00' }), f(T('Футбол 1998 (финал)', 'Футбол 1998 (фінал)', 'Football 1998 (final)'), 'video', 0, { dur: '1:50:00', scene: sc('⚽', 'Футбол', 'Футбол', 'Football') }), f(T('Мультфильмы с ТВ', 'Мультфільми з ТБ', 'Cartoons off the TV'), 'video', 0, { dur: '2:40:00', scene: sc('📺', 'Мультики', 'Мультики', 'Cartoons') })], r.int(1, 3))],
    pods: () => [T('Подкасты', 'Подкасти', 'Podcasts'), Array.from({ length: r.int(2, 5) }, (_, i) => f(`${T('Выпуск', 'Випуск', 'Episode')} ${r.int(1, 240)}.mp3`, 'audio', +(r.float(20, 90)).toFixed(0), { dur: `${r.int(30, 120)}:00` }))],
    books: () => [T('Аудиокниги', 'Аудіокниги', 'Audiobooks'), [f(T('Мастер и Маргарита (12 ч)', 'Майстер і Маргарита (12 год)', 'The Master and Margarita (12 h)'), 'audio', 340, { dur: '12:00:00' }), f(T('Богатый папа, бедный папа', 'Багатий тато, бідний тато', 'Rich Dad Poor Dad'), 'audio', 210, { dur: '7:30:00' })]],
  };
}
const POOLS = {
  phone: ['shots', 'telegram', 'viber', 'voice', 'notes', 'passnote', 'calendar', 'health', 'apps', 'videos', 'selfies', 'family'],
  tablet: ['shots', 'telegram', 'notes', 'apps', 'videos', 'family', 'study', 'books'],
  laptop: ['projects', 'torrents', 'backups', 'browser', 'study', 'edit', 'work', 'design', 'tax', 'pcgames', 'family'],
  hdd: ['projects', 'torrents', 'backups', 'edit', 'work', 'design', 'pcgames', 'family', 'cctv'],
  nas: ['backups', 'torrents', 'cctv', 'family', 'work'],
  office: ['officeMisc', 'cctv', 'work', 'tax'], tape: ['officeMisc'],
  usb: ['usbmix', 'family', 'projects', 'study'], secure: ['usbmix', 'work', 'tax'],
  card: ['raw', 'timelapse', 'family'], camera: ['raw', 'timelapse', 'family'], drone: ['aerial', 'timelapse'],
  console: ['clips', 'trophies'], dashcam: ['parking', 'gps'],
  cd: ['oldcd'], dvd: ['tapes', 'oldcd'], gamecd: ['oldcd'], floppy: ['floppy'], cassette: ['tapes'], vhs: ['tapes'], ipod: ['pods', 'books'], dictaphone: ['voice'],
};
const COUNT = { phone: [3, 6], tablet: [2, 4], laptop: [3, 6], hdd: [2, 5], nas: [2, 4], office: [1, 3], usb: [1, 2], secure: [1, 2], card: [1, 2], camera: [1, 2], drone: [1, 2], console: [1, 2], dashcam: [1, 2] };

// ---------------------------------------------------------------- loot: one‑time finds with actions
// act(it, data) returns { msg, cls }; money in USD
const LOOT = [
  { key: 'gift', kinds: ['phone', 'tablet', 'laptop', 'usb'], p: 0.05, ic: '🎁',
    roll: (r) => ({ usd: r.pick([8, 12, 15, 20, 30, 50]), shop: r.pick(SHOPS), ok: r.chance(0.65) }),
    file: (d) => [T(`Сертификат ${d.shop} на ${fmt(d.usd)}.png`, `Сертифікат ${d.shop} на ${fmt(d.usd)}.png`, `${d.shop} gift card ${fmt(d.usd)}.png`), 'photo', T('Подарочный сертификат с кодом. Неизвестно, активирован ли.', 'Подарунковий сертифікат із кодом. Невідомо, чи активований.', 'A gift card with a code. No idea if it’s been used.')],
    acts: (d) => [['use', T('🎁 Активировать код', '🎁 Активувати код', '🎁 Redeem the code')]],
    act: (it, d) => (d.ok ? (earn(d.usd, 'other', T(`Сертификат ${d.shop}`, `Сертифікат ${d.shop}`, `${d.shop} gift card`)), { msg: T(`Код сработал: +${fmt(d.usd)}`, `Код спрацював: +${fmt(d.usd)}`, `Code worked: +${fmt(d.usd)}`), cls: 'g' }) : { msg: T('Код уже кто‑то активировал', 'Код уже хтось активував', 'Someone already used the code'), cls: 'r' }) },
  { key: 'gameacc', kinds: ['phone', 'tablet', 'console', 'laptop'], p: 0.045, ic: '🎮', personal: true,
    roll: (r, c) => ({ game: c.kind === 'console' ? r.pick(CONGAMES) : r.pick(MOBGAMES), usd: Math.round(r.float(15, 160)), back: Math.round(r.float(5, 25)), caught: r.chance(0.3) }),
    file: (d) => [T(`Аккаунт ${d.game} (логин+пароль).txt`, `Акаунт ${d.game} (логін+пароль).txt`, `${d.game} account (login+password).txt`), 'text', T(`Прокачанный аккаунт ${d.game}: скины, донат. Владелец, похоже, забыл выйти.`, `Прокачаний акаунт ${d.game}: скіни, донат. Власник, схоже, забув вийти.`, `A levelled‑up ${d.game} account: skins, paid items. The owner forgot to log out.`)],
    acts: (d) => [['back', T(`🤝 Написать владельцу и вернуть · +${fmt(d.back)}`, `🤝 Написати власнику й повернути · +${fmt(d.back)}`, `🤝 Return it to the owner · +${fmt(d.back)}`)], ['sell', T(`🕶 Продать аккаунт · ~${fmt(d.usd)}`, `🕶 Продати акаунт · ~${fmt(d.usd)}`, `🕶 Sell the account · ~${fmt(d.usd)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'back') { earn(d.back, 'other', T('Благодарность за аккаунт', 'Подяка за акаунт', 'Thanks for the account')); addXP(15); addReview(5, T('Вернул мой игровой аккаунт, хотя мог продать. Уважаю!', 'Повернув мій ігровий акаунт, хоча міг продати. Поважаю!', 'Gave my game account back when he could have sold it. Respect!')); return { msg: T(`Владелец счастлив: +${fmt(d.back)}`, `Власник щасливий: +${fmt(d.back)}`, `The owner is happy: +${fmt(d.back)}`), cls: 'g' }; }
      if (d.caught) { const fine = Math.round(d.usd * 1.3 + 20); policeFine('leak', fine, d.game); return { msg: T(`Владелец восстановил доступ и написал заявление. Штраф ${fmt(fine)}`, `Власник відновив доступ і написав заяву. Штраф ${fmt(fine)}`, `The owner got the account back and reported you. Fine ${fmt(fine)}`), cls: 'r' }; }
      earn(d.usd, 'other', T(`Продажа аккаунта ${d.game}`, `Продаж акаунта ${d.game}`, `Sold a ${d.game} account`)); return { msg: `+${fmt(d.usd)}`, cls: 'g' };
    } },
  { key: 'seed', kinds: ['phone', 'laptop', 'hdd', 'usb'], p: 0.025, ic: '🔑', y: 2015,
    roll: (r) => { const x = r.next(); return { usd: x < 0.72 ? 0 : x < 0.95 ? Math.round(r.float(15, 140)) : Math.round(r.float(300, 1600)), words: r.sample(['apple', 'river', 'ocean', 'tiger', 'velvet', 'castle', 'rocket', 'maple', 'silver', 'garden', 'piano', 'winter', 'orbit', 'candle', 'forest', 'shadow'], 12).join(' ') }; },
    file: (d) => ['seed.txt', 'text', T(`12 слов: ${d.words}`, `12 слів: ${d.words}`, `12 words: ${d.words}`)],
    acts: () => [['check', T('🔎 Восстановить кошелёк и проверить', '🔎 Відновити гаманець і перевірити', '🔎 Restore the wallet and check')]],
    act: (it, d) => (d.usd ? (earn(d.usd, 'stock', T('Вывод с найденной seed‑фразы', 'Виведення зі знайденої seed‑фрази', 'Cashed out a found seed phrase')), stat('walletsFound'), addXP(20), { msg: T(`На кошельке было ${fmt(d.usd)} — выведено!`, `На гаманці було ${fmt(d.usd)} — виведено!`, `The wallet held ${fmt(d.usd)} — cashed out!`), cls: 'g' }) : { msg: T('Кошелёк пустой — всё вывели до вас', 'Гаманець порожній — усе вивели до вас', 'Empty — someone got there first'), cls: '' }) },
  { key: 'ticket', kinds: ['phone', 'tablet', 'laptop'], p: 0.04, ic: '🎫',
    roll: (r) => ({ what: r.pick([['концерт', 'концерт', 'a concert'], ['футбол', 'футбол', 'a football match'], ['театр', 'театр', 'the theatre'], ['стендап', 'стендап', 'a stand‑up show'], ['фестиваль', 'фестиваль', 'a festival']]), usd: Math.round(r.float(15, 95)), used: r.chance(0.35) }),
    file: (d) => [T(`Билет на ${d.what[0]} (QR).pdf`, `Квиток на ${d.what[1]} (QR).pdf`, `Ticket to ${d.what[2]} (QR).pdf`), 'doc', T('Электронный билет. Дата — на этой неделе.', 'Електронний квиток. Дата — цього тижня.', 'An e‑ticket. The date is this week.')],
    acts: (d) => [['sell', T(`🎫 Продать билет · ${fmt(d.usd)}`, `🎫 Продати квиток · ${fmt(d.usd)}`, `🎫 Sell the ticket · ${fmt(d.usd)}`)]],
    act: (it, d) => (d.used ? { msg: T('Покупателя не пустили: билет уже сдан. Пришлось вернуть деньги.', 'Покупця не пустили: квиток уже здано. Довелося повернути гроші.', 'The buyer was turned away — the ticket was refunded already. Money returned.'), cls: 'r' } : (earn(d.usd, 'sale', T('Продажа билета', 'Продаж квитка', 'Sold a ticket')), { msg: `+${fmt(d.usd)}`, cls: 'g' })) },
  { key: 'keys', kinds: ['laptop', 'hdd', 'usb', 'office'], p: 0.05, ic: '🔐',
    roll: (r) => ({ usd: Math.round(r.float(6, 45)), dead: r.chance(0.4), n: r.int(2, 9) }),
    file: (d) => [T('Ключи Windows и Office.txt', 'Ключі Windows і Office.txt', 'Windows & Office keys.txt'), 'text', T(`${d.n} лицензионных ключей. Активированы или нет — непонятно.`, `${d.n} ліцензійних ключів. Активовані чи ні — незрозуміло.`, `${d.n} licence keys. Used or not — who knows.`)],
    acts: (d) => [['sell', T(`💻 Продать ключи · ~${fmt(d.usd)}`, `💻 Продати ключі · ~${fmt(d.usd)}`, `💻 Sell the keys · ~${fmt(d.usd)}`)]],
    act: (it, d) => (d.dead ? { msg: T('Ключи заблокированы — покупатель вернул', 'Ключі заблоковано — покупець повернув', 'Keys are blocked — the buyer wants a refund'), cls: 'r' } : (earn(d.usd, 'sale', T('Продажа ключей', 'Продаж ключів', 'Sold licence keys')), { msg: `+${fmt(d.usd)}`, cls: 'g' })) },
  { key: 'novel', kinds: ['laptop', 'usb', 'hdd'], p: 0.02, ic: '📖',
    roll: (r, c) => ({ back: Math.round(r.float(20, 90)), author: c.couple[1], steal: r.chance(0.5) }),
    file: (d) => [T('Роман_черновик_главы_1-23.docx', 'Роман_чернетка_розділи_1-23.docx', 'Novel_draft_ch1-23.docx'), 'doc', T(`Чей‑то роман: 23 главы, 400 страниц. Автор — ${d.author}. Копии, похоже, нет.`, `Чийсь роман: 23 розділи, 400 сторінок. Автор — ${d.author}. Копії, схоже, немає.`, `Someone’s novel: 23 chapters, 400 pages. By ${d.author}. Probably no other copy.`)],
    acts: (d) => [['back', T(`📬 Найти автора и вернуть · +${fmt(d.back)}`, `📬 Знайти автора й повернути · +${fmt(d.back)}`, `📬 Find the author and return it · +${fmt(d.back)}`)], ['pub', T('🖋 Издать под своим именем', '🖋 Видати під своїм іменем', '🖋 Publish it as your own'), 'red']],
    act: (it, d, a) => {
      if (a === 'back') { earn(d.back, 'other', T('Благодарность автора', 'Подяка автора', 'The author’s thanks')); addXP(30); addReview(5, T('Вернул рукопись, над которой я работал 3 года. Спасибо!!', 'Повернув рукопис, над яким я працював 3 роки. Дякую!!', 'Returned the manuscript I spent 3 years on. Thank you!!')); return { msg: T(`${d.author} плачет от счастья: +${fmt(d.back)}`, `${d.author} плаче від щастя: +${fmt(d.back)}`, `${d.author} is in tears: +${fmt(d.back)}`), cls: 'g' }; }
      if (d.steal) { const fine = d.back * 4; policeFine('fraud', fine, T('плагиат', 'плагіат', 'plagiarism')); return { msg: T(`Автор узнал свой текст и подал в суд. Штраф ${fmt(fine)}`, `Автор упізнав свій текст і подав до суду. Штраф ${fmt(fine)}`, `The author recognised the text and sued. Fine ${fmt(fine)}`), cls: 'r' }; }
      earn(d.back * 3, 'other', T('Гонорар за книгу', 'Гонорар за книжку', 'Book royalties')); return { msg: `+${fmt(d.back * 3)}`, cls: 'g' };
    } },
  { key: 'bonus', kinds: ['phone'], p: 0.06, ic: '💳',
    roll: (r) => ({ usd: Math.round(r.float(3, 25)), pts: r.int(300, 6000) }),
    file: (d) => [T(`Бонусная карта (QR, ${d.pts} баллов).png`, `Бонусна картка (QR, ${d.pts} балів).png`, `Loyalty card (QR, ${d.pts} pts).png`), 'photo', T('Скидочная карта супермаркета, баллы не потрачены.', 'Знижкова картка супермаркету, бали не витрачені.', 'A supermarket loyalty card with unspent points.')],
    acts: (d) => [['use', T(`🛒 Потратить баллы · ${fmt(d.usd)}`, `🛒 Витратити бали · ${fmt(d.usd)}`, `🛒 Spend the points · ${fmt(d.usd)}`)]],
    act: (it, d) => (earn(d.usd, 'other', T('Баллы бонусной карты', 'Бали бонусної картки', 'Loyalty points')), { msg: T(`Сэкономили ${fmt(d.usd)} на продуктах`, `Заощадили ${fmt(d.usd)} на продуктах`, `Saved ${fmt(d.usd)} on groceries`), cls: 'g' }) },
  { key: 'lotto', kinds: ['phone', 'laptop', 'usb'], p: 0.03, ic: '🎟',
    roll: (r) => { const x = r.next(); return { usd: x < 0.012 ? Math.round(r.float(300, 2000)) : x < 0.13 ? Math.round(r.float(5, 40)) : 0, no: `${pad(r.int(0, 999999), 6)}` }; },
    file: (d) => [T(`Лотерейный билет №${d.no}.jpg`, `Лотерейний квиток №${d.no}.jpg`, `Lottery ticket #${d.no}.jpg`), 'photo', T('Фото билета. Тираж уже прошёл, проверяли ли его — неизвестно.', 'Фото квитка. Тираж уже пройшов, чи перевіряли — невідомо.', 'A photo of a ticket. The draw is over; nobody knows if it was checked.')],
    acts: () => [['check', T('🎟 Проверить тираж', '🎟 Перевірити тираж', '🎟 Check the draw')]],
    act: (it, d) => (d.usd ? (earn(d.usd, 'other', T('Выигрыш в лотерею', 'Виграш у лотерею', 'Lottery win')), addXP(d.usd > 200 ? 40 : 5), { msg: T(`Билет выиграл ${fmt(d.usd)}!`, `Квиток виграв ${fmt(d.usd)}!`, `The ticket won ${fmt(d.usd)}!`), cls: 'g' }) : { msg: T('Без выигрыша', 'Без виграшу', 'No win'), cls: '' }) },
  { key: 'cctv', kinds: ['nas', 'office', 'dashcam', 'hdd'], p: 0.04, ic: '📹',
    roll: (r) => ({ usd: Math.round(r.float(25, 120)), what: r.pick([['вскрывают машину', 'розкривають машину', 'breaking into a car'], ['крадут велосипед', 'крадуть велосипед', 'stealing a bike'], ['выносят коробки со склада', 'виносять коробки зі складу', 'carrying boxes out of a warehouse']]) }),
    file: (d) => [T(`Камера: кто‑то ${d.what[0]}.mp4`, `Камера: хтось ${d.what[1]}.mp4`, `Camera: someone ${d.what[2]}.mp4`), 'video', T('Лицо и номер машины хорошо видны.', 'Обличчя й номер машини добре видно.', 'Face and plate clearly visible.')],
    acts: (d) => [['police', T(`🚓 Отдать в полицию · +${fmt(d.usd)}`, `🚓 Віддати в поліцію · +${fmt(d.usd)}`, `🚓 Hand it to the police · +${fmt(d.usd)}`)]],
    act: (it, d) => (earn(d.usd, 'other', T('Вознаграждение от полиции', 'Винагорода від поліції', 'Police reward')), addXP(25), { msg: T(`Вора нашли. Вознаграждение +${fmt(d.usd)}`, `Злодія знайшли. Винагорода +${fmt(d.usd)}`, `The thief was caught. Reward +${fmt(d.usd)}`), cls: 'g' }) },
  { key: 'beats', kinds: ['laptop', 'hdd', 'usb'], p: 0.03, ic: '🎹',
    roll: (r) => ({ usd: Math.round(r.float(15, 140)), n: r.int(5, 16) }),
    file: (d) => [T(`Биты_неизданное (${d.n} треков)`, `Біти_невидане (${d.n} треків)`, `Beats_unreleased (${d.n} tracks)`), 'music', T('Неизданные биты местного битмейкера. Звучат неплохо.', 'Невидані біти місцевого бітмейкера. Звучать непогано.', 'Unreleased beats by a local producer. Not bad at all.')],
    acts: (d) => [['back', T('📬 Найти автора', '📬 Знайти автора', '📬 Find the producer')], ['sell', T(`💽 Продать рэперам · ${fmt(d.usd)}`, `💽 Продати реперам · ${fmt(d.usd)}`, `💽 Sell to rappers · ${fmt(d.usd)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'back') { const b = Math.round(d.usd * 0.3); earn(b, 'other', T('Битмейкер благодарит', 'Бітмейкер дякує', 'The producer says thanks')); addXP(20); return { msg: T(`Битмейкер скинул ${fmt(b)} и позвал на концерт`, `Бітмейкер скинув ${fmt(b)} і покликав на концерт`, `The producer sent ${fmt(b)} and an invite to his gig`), cls: 'g' }; }
      earn(d.usd, 'sale', T('Продажа битов', 'Продаж бітів', 'Sold beats')); return { msg: `+${fmt(d.usd)}`, cls: 'g' };
    } },
  { key: 'stock', kinds: ['card', 'camera', 'drone', 'laptop'], p: 0.04, ic: '📸',
    roll: (r) => ({ usd: Math.round(r.float(20, 150)), back: Math.round(r.float(10, 40)), claim: r.chance(0.35) }),
    file: (d) => [T('Портфолио фотографа (RAW, 240 шт.)', 'Портфоліо фотографа (RAW, 240 шт.)', 'Photographer portfolio (RAW, 240)'), 'archive', T('Заказная съёмка: свадьба и предметка. На карте — визитка фотографа.', 'Замовна зйомка: весілля й предметка. На карті — візитка фотографа.', 'Client work: a wedding and product shots. The photographer’s card is in the folder.')],
    acts: (d) => [['back', T(`🤝 Вернуть фотографу · +${fmt(d.back)}`, `🤝 Повернути фотографу · +${fmt(d.back)}`, `🤝 Return to the photographer · +${fmt(d.back)}`)], ['sell', T(`🖼 Залить на фотосток как свои · ~${fmt(d.usd)}`, `🖼 Залити на фотосток як свої · ~${fmt(d.usd)}`, `🖼 Upload to a stock site as yours · ~${fmt(d.usd)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'back') { earn(d.back, 'other', T('Фотограф благодарит', 'Фотограф дякує', 'The photographer’s thanks')); addXP(20); addReview(5, T('Вернул карту со свадебной съёмкой. Спас мне репутацию!', 'Повернув карту з весільною зйомкою. Врятував мені репутацію!', 'Returned the card with a wedding shoot. Saved my reputation!')); return { msg: `+${fmt(d.back)}`, cls: 'g' }; }
      if (d.claim) { const fine = Math.round(d.usd * 1.5); policeFine('fraud', fine, T('авторские права', 'авторські права', 'copyright')); return { msg: T(`Жалоба за авторские права. Штраф ${fmt(fine)}`, `Скарга за авторські права. Штраф ${fmt(fine)}`, `Copyright complaint. Fine ${fmt(fine)}`), cls: 'r' }; }
      earn(d.usd, 'sale', T('Продажи на фотостоке', 'Продажі на фотостоку', 'Stock photo sales')); return { msg: `+${fmt(d.usd)}`, cls: 'g' };
    } },
  { key: 'promo', kinds: ['phone', 'tablet'], p: 0.05, ic: '🚕',
    roll: (r) => ({ usd: Math.round(r.float(3, 15)), what: r.pick([['такси −50%', 'таксі −50%', 'taxi −50%'], ['доставка еды −30%', 'доставка їжі −30%', 'food delivery −30%'], ['кино 2 по цене 1', 'кіно 2 за ціною 1', 'cinema 2 for 1']]) }),
    file: (d) => [T(`Промокод ${d.what[0]}.png`, `Промокод ${d.what[1]}.png`, `Promo code ${d.what[2]}.png`), 'photo', T('Промокод ещё действует.', 'Промокод ще діє.', 'The code is still valid.')],
    acts: (d) => [['use', T(`🎉 Использовать · ${fmt(d.usd)}`, `🎉 Використати · ${fmt(d.usd)}`, `🎉 Use it · ${fmt(d.usd)}`)]],
    act: (it, d) => (earn(d.usd, 'other', T('Промокод', 'Промокод', 'Promo code')), { msg: T(`Сэкономили ${fmt(d.usd)}`, `Заощадили ${fmt(d.usd)}`, `Saved ${fmt(d.usd)}`), cls: 'g' }) },
  { key: 'sub', kinds: ['console'], p: 0.08, ic: '🕹',
    roll: (r) => ({ usd: Math.round(r.float(8, 40)), dead: r.chance(0.25) }),
    file: () => [T('Код подписки (не активирован)', 'Код підписки (не активований)', 'Subscription code (unused)'), 'text', T('Код на 12 месяцев онлайн‑подписки. Похоже, забыли активировать.', 'Код на 12 місяців онлайн‑підписки. Схоже, забули активувати.', 'A 12‑month online subscription code. Looks unused.')],
    acts: (d) => [['sell', T(`💸 Продать код · ${fmt(d.usd)}`, `💸 Продати код · ${fmt(d.usd)}`, `💸 Sell the code · ${fmt(d.usd)}`)]],
    act: (it, d) => (d.dead ? { msg: T('Код уже активирован', 'Код уже активовано', 'Already redeemed'), cls: 'r' } : (earn(d.usd, 'sale', T('Продажа кода подписки', 'Продаж коду підписки', 'Sold a subscription code')), { msg: `+${fmt(d.usd)}`, cls: 'g' })) },
  { key: 'scans', kinds: ['usb', 'laptop', 'office'], p: 0.04, ic: '🪪', personal: true,
    roll: (r) => ({ usd: Math.round(r.float(20, 80)), caught: r.chance(0.45), n: r.int(12, 400) }),
    file: (d) => [T(`Сканы паспортов клиентов (${d.n}).zip`, `Скани паспортів клієнтів (${d.n}).zip`, `Client passport scans (${d.n}).zip`), 'archive', T('Чужие паспорта. С этим лучше не шутить.', 'Чужі паспорти. З цим краще не жартувати.', 'Other people’s passports. Not something to joke with.')],
    acts: (d) => [['del', T('🗑 Удалить навсегда', '🗑 Видалити назавжди', '🗑 Delete for good')], ['sell', T(`🕶 Продать базу · ~${fmt(d.usd)}`, `🕶 Продати базу · ~${fmt(d.usd)}`, `🕶 Sell the data · ~${fmt(d.usd)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'del') { addXP(10); return { msg: T('Удалено. Правильное решение.', 'Видалено. Правильне рішення.', 'Deleted. The right call.'), cls: 'g' }; }
      if (d.caught) { const fine = Math.round(d.usd * 3 + 40); policeFine('leak', fine, T('сканы паспортов', 'скани паспортів', 'passport scans')); return { msg: T(`Покупатель оказался из киберполиции. Штраф ${fmt(fine)}`, `Покупець виявився з кіберполіції. Штраф ${fmt(fine)}`, `The buyer was cyber police. Fine ${fmt(fine)}`), cls: 'r' }; }
      earn(d.usd, 'other', T('Продажа данных', 'Продаж даних', 'Sold data')); return { msg: `+${fmt(d.usd)}`, cls: 'g' };
    } },
];
// ---------------------------------------------------------------- useful finds (apps, VPN, designs, things for your business)
const SHADOW_NAMES = { dark: ['Тень', 'Тінь', 'Shade'], lab: ['Phone Lab', 'Phone Lab', 'Phone Lab'], probiv: ['Пробив', 'Пробив', 'Probiv'], radar: ['Радар', 'Радар', 'Radar'] };
const PAID_APPS = { legit: ['Легит‑чек', 'Легіт‑чек', 'Legit check'], stocks: ['Биржа', 'Біржа', 'Stocks'], vpn: ['VPN', 'VPN', 'VPN'] };
const unl = () => (G.s.unlocks ||= { recipes: [], obd: false, supplierUntil: 0 });
LOOT.push(
  { key: 'installer', kinds: ['phone', 'laptop', 'usb', 'hdd', 'secure', 'tablet', 'nas'], p: 0.05, ic: '🕳',
    roll: (r) => ({ app: r.pick(Object.keys(SHADOW_NAMES)) }),
    file: (d) => [T(`ссылка_${d.app}.onion.txt`, `посилання_${d.app}.onion.txt`, `link_${d.app}.onion.txt`), 'text', T(`Ссылка на скрытое приложение «${L(SHADOW_NAMES[d.app])}». Открывается только через VPN.`, `Посилання на прихований застосунок «${L(SHADOW_NAMES[d.app])}». Відкривається лише через VPN.`, `A link to the hidden app “${L(SHADOW_NAMES[d.app])}”. Opens only over a VPN.`)],
    acts: (d) => [['save', T(`🕳 Сохранить ссылку «${L(SHADOW_NAMES[d.app])}»`, `🕳 Зберегти посилання «${L(SHADOW_NAMES[d.app])}»`, `🕳 Save the “${L(SHADOW_NAMES[d.app])}” link`)]],
    act: (it, d) => { if (!findApp(d.app)) { earn(8, 'other', T('Продал лишнюю ссылку', 'Продав зайве посилання', 'Sold a spare link')); return { msg: T('Эта ссылка у вас уже есть — продали её знакомому за 8 $', 'Це посилання у вас уже є — продали його знайомому за 8 $', 'You already had it — sold it on for $8'), cls: '' }; } return { msg: T(`Нашли ссылку на «${L(SHADOW_NAMES[d.app])}» — скачайте в App Market (раздел «Скрытые», нужен VPN)`, `Знайшли посилання на «${L(SHADOW_NAMES[d.app])}» — завантажте в App Market (розділ «Приховані», потрібен VPN)`, `Found a link to “${L(SHADOW_NAMES[d.app])}” — get it in App Market (Hidden, needs a VPN)`), cls: 'g' }; } },
  { key: 'vpncfg', kinds: ['laptop', 'usb', 'phone', 'tablet'], p: 0.04, ic: '🛡',
    roll: (r) => ({ days: r.pick([3, 5, 7, 14]) }),
    file: (d) => [`wg0_${d.days}d.conf`, 'text', T(`Конфиг VPN с оплаченным периодом: ещё ${d.days} дн.`, `Конфіг VPN з оплаченим періодом: ще ${d.days} дн.`, `A VPN config with ${d.days} paid days left.`)],
    acts: (d) => [['use', T(`🛡 Подключить VPN на ${d.days} дн.`, `🛡 Підключити VPN на ${d.days} дн.`, `🛡 Use the VPN for ${d.days} days`)]],
    act: (it, d) => { const s = G.s; s.vpn = { ...(s.vpn || {}), on: true, until: Math.max(s.vpn?.until || 0, s.t) + d.days * 1440 }; emit('apps'); return { msg: T(`VPN работает ещё ${d.days} дн.`, `VPN працює ще ${d.days} дн.`, `VPN on for ${d.days} more days`), cls: 'g' }; } },
  { key: 'cardskin', kinds: ['phone', 'usb', 'laptop', 'tablet'], p: 0.03, ic: '💳',
    roll: (r) => ({ id: r.pick(limitedSkins().map((x) => x.id)) }),
    file: (d) => [T(`Дизайн_карты_${d.id}.png`, `Дизайн_картки_${d.id}.png`, `Card_design_${d.id}.png`), 'photo', T('Макет лимитированного дизайна банковской карты с кодом активации.', 'Макет лімітованого дизайну банківської картки з кодом активації.', 'A limited bank card design with an activation code.')],
    acts: () => [['use', T('💳 Активировать дизайн', '💳 Активувати дизайн', '💳 Activate the design')]],
    act: (it, d) => { unlockSkin(d.id); return { msg: T('Новый дизайн карты в банке → «🎨 Дизайн»', 'Новий дизайн картки в банку → «🎨 Дизайн»', 'New card design in the bank → “🎨 Design”'), cls: 'g' }; } },
  { key: 'appkey', kinds: ['laptop', 'usb', 'hdd'], p: 0.03, ic: '🔓',
    roll: (r) => ({ app: r.pick(Object.keys(PAID_APPS)) }),
    file: (d) => [T(`Лицензия ${L(PAID_APPS[d.app])}.key`, `Ліцензія ${L(PAID_APPS[d.app])}.key`, `${L(PAID_APPS[d.app])} licence.key`), 'text', T('Неиспользованный ключ лицензии на платное приложение.', 'Невикористаний ключ ліцензії на платний застосунок.', 'An unused licence key for a paid app.')],
    acts: (d) => [['use', T(`🔓 Активировать «${L(PAID_APPS[d.app])}»`, `🔓 Активувати «${L(PAID_APPS[d.app])}»`, `🔓 Activate “${L(PAID_APPS[d.app])}”`)]],
    act: (it, d) => { const s = G.s; if ((s.bought || []).includes(d.app)) { earn(10, 'sale', T('Продажа ключа', 'Продаж ключа', 'Sold a key')); return { msg: T('Уже куплено — ключ продали за 10 $', 'Уже куплено — ключ продали за 10 $', 'Already bought — sold the key for $10'), cls: '' }; } (s.bought ||= []).push(d.app); emit('apps'); return { msg: T('Приложение теперь бесплатно — качайте в App Market', 'Застосунок тепер безкоштовний — завантажуйте в App Market', 'The app is free for you now — get it in App Market'), cls: 'g' }; } },
  { key: 'recipes', kinds: ['laptop', 'usb', 'tablet', 'phone'], p: 0.03, ic: '☕',
    roll: (r) => ({ id: r.pick(['raf', 'lavender', 'tonic', 'mulled', 'negroni', 'shawarma_cheese', 'matcha']) }),
    file: () => [T('Рецепты фирменных напитков.docx', 'Рецепти фірмових напоїв.docx', 'Signature recipes.docx'), 'doc', T('Техкарты бариста и бармена: граммовки, подача, себестоимость.', 'Техкарти баристи й бармена: грамовки, подача, собівартість.', 'Barista and bartender tech cards: grams, serving, cost.')],
    acts: () => [['use', T('☕ Добавить рецепт в меню заведений', '☕ Додати рецепт у меню закладів', '☕ Add the recipe to your venues’ menus')]],
    act: (it, d) => { const u = unl(); if (!u.recipes.includes(d.id)) u.recipes.push(d.id); emit('biz'); return { msg: T('Новая позиция в меню кофейни / бара / шаурмичной', 'Нова позиція в меню кавʼярні / бару / шаурмичної', 'A new item on your café / bar / shawarma menu'), cls: 'g' }; } },
  { key: 'suppliers', kinds: ['laptop', 'usb', 'office', 'hdd'], p: 0.03, ic: '📇',
    roll: (r) => ({ days: r.pick([5, 7, 10]) }),
    file: () => [T('Контакты поставщиков (прайс).xlsx', 'Контакти постачальників (прайс).xlsx', 'Supplier contacts (prices).xlsx'), 'doc', T('Прямые контакты дистрибьюторов: техника, расходники, мебель — со скидкой.', 'Прямі контакти дистрибʼюторів: техніка, витратні матеріали, меблі — зі знижкою.', 'Direct distributor contacts: equipment, supplies, furniture — at a discount.')],
    acts: (d) => [['use', T(`📇 Скидка 10 % у Поставщика на ${d.days} дн.`, `📇 Знижка 10 % у Постачальника на ${d.days} дн.`, `📇 10 % off at the Supplier for ${d.days} days`)]],
    act: (it, d) => { const u = unl(); u.supplierUntil = Math.max(u.supplierUntil || 0, G.s.t) + d.days * 1440; emit('biz'); return { msg: T('Скидка у Поставщика включена', 'Знижку в Постачальника ввімкнено', 'Supplier discount on'), cls: 'g' }; } },
  { key: 'obd', kinds: ['laptop', 'usb'], p: 0.025, ic: '🔧',
    roll: () => ({}),
    file: () => [T('Дилерский софт диагностики (OBD).iso', 'Дилерський софт діагностики (OBD).iso', 'Dealer diagnostics software (OBD).iso'), 'archive', T('Полная версия дилерской программы диагностики авто.', 'Повна версія дилерської програми діагностики авто.', 'Full dealer car diagnostics software.')],
    acts: () => [['use', T('🔧 Установить на СТО (услуга «Компьютерная диагностика»)', '🔧 Встановити на СТО (послуга «Компʼютерна діагностика»)', '🔧 Install at your garage (“Computer diagnostics” service)')]],
    act: () => { unl().obd = true; emit('biz'); return { msg: T('На СТО появилась компьютерная диагностика', 'На СТО зʼявилася компʼютерна діагностика', 'Your garage now offers computer diagnostics'), cls: 'g' }; } },
);
const LOOT_BY = {}; // filled at the end of the file, after every LOOT.push
export const lootIcon = (key) => LOOT_BY[key]?.ic || '✨';

// called by deviceFiles(): adds folders and loot to `base`
export function extraFiles(it, c) {
  const { kind, year, base, F, dir } = c;
  const r = new RNG(`fx|${it.seed || 1}|${it.m}`);
  const date = () => `${pad(r.int(1, 28), 2)}.${pad(r.int(1, 12), 2)}.${r.int(Math.max(1990, year - 3), Math.max(1990, year))}`;
  const f = (name, type, size, o = {}) => F(name, type, size, { date: date(), ...o });
  const add = (name, files) => { if (!files?.length) return; const ex = base.dirs.find((x) => x.name === name); if (ex) ex.files.push(...files); else dir(name, files); };
  const M = makers({ ...c, r, f });
  const pool = POOLS[kind] || [];
  const [lo, hi] = COUNT[kind] || [0, 1];
  for (const k of r.sample(pool, Math.min(pool.length, r.int(lo, hi)))) { const [name, files] = M[k](); add(name, files); }
  // loot: at most two per device
  let n = 0;
  for (const L of LOOT) {
    if (n >= 3 || !L.kinds.includes(kind) || (L.y && year < L.y)) continue;
    if (!r.chance(L.p)) continue;
    n++;
    const d = L.roll(r, c);
    (base.finds.loot ||= {})[L.key] = d;
    const [name, type, text] = L.file(d);
    add(T('Находки', 'Знахідки', 'Finds'), [f(name, type, +(r.float(0.01, 4)).toFixed(2), { flag: 'loot:' + L.key, text, personal: !!L.personal })]);
  }
}

// ---------------------------------------------------------------- loot actions
export function lootButtons(it, key, files) {
  const L = LOOT_BY[key], d = files?.finds?.loot?.[key], done = it.data?.['loot_' + key];
  if (!L || !d) return { done: true, btn: [] };
  if (done) return { done: true, btn: [] };
  return { done: false, btn: L.acts(d).map(([a, label, cls = '']) => [`loot:${key}:${a}`, label, cls]) };
}
export function lootAct(it, files, key, a) {
  const L = LOOT_BY[key], d = files?.finds?.loot?.[key];
  const data = (it.data ||= {});
  if (!L || !d || data['loot_' + key]) return null;
  data['loot_' + key] = a;
  const res = L.act(it, d, a) || { msg: '', cls: '' };
  stat('lootFound');
  if (res.cls === 'g') notify('market', T('Находка на устройстве', 'Знахідка на пристрої', 'Device find'), res.msg, { noBadge: true });
  emit('inv'); emit('money');
  return res;
}

// ---------------------------------------------------------------- dark, strange and lucrative finds
// Creepy ones mostly pay through the right people (police, families, podcasts, journalists); the greedy choice
// pays more and sometimes ends with a fine.
const ok = (msg) => ({ msg, cls: 'g' });
const bad = (msg) => ({ msg, cls: 'r' });
const pay = (usd, why) => { earn(usd, 'other', why); return usd; };
LOOT.push(
  { key: 'diary', kinds: ['phone', 'laptop', 'tablet'], p: 0.025, ic: '📓', personal: true,
    roll: (r, c) => ({ who: c.couple[1], usd: Math.round(r.float(60, 260)), alive: r.chance(0.8), days: r.int(3, 40) }),
    file: (d) => [T(`Дневник_${d.who}.txt`, `Щоденник_${d.who}.txt`, `${d.who}_diary.txt`), 'doc', T(`Последние записи ${d.days} дней назад: «Опять та же серая машина под окнами». «Он знает, где я работаю». «Если со мной что‑то случится — это он». Потом записи обрываются. В новостях: ${d.who} пропала без вести.`, `Останні записи ${d.days} днів тому: «Знову та сама сіра машина під вікнами». «Він знає, де я працюю». «Якщо зі мною щось станеться — це він». Потім записи обриваються. У новинах: ${d.who} зникла безвісти.`, `Last entries ${d.days} days ago: “That grey car under the windows again.” “He knows where I work.” “If anything happens to me, it was him.” Then nothing. The news says ${d.who} is missing.`)],
    acts: (d) => [['police', T(`🚓 Отнести в полицию · вознаграждение ~${fmt(d.usd)}`, `🚓 Віднести в поліцію · винагорода ~${fmt(d.usd)}`, `🚓 Take it to the police · reward ~${fmt(d.usd)}`)], ['del', T('🗑 Не лезть в это, удалить', '🗑 Не лізти в це, видалити', '🗑 Stay out of it, delete')]],
    act: (it, d, a) => {
      if (a === 'del') return { msg: T('Удалено. Но мысль о той серой машине не отпускает.', 'Видалено. Але думка про ту сіру машину не відпускає.', 'Deleted. The grey car stays on your mind.'), cls: '' };
      addXP(40); stat('goodDeeds');
      if (d.alive) { pay(d.usd, T('Вознаграждение за помощь в поиске', 'Винагорода за допомогу в пошуку', 'Reward for helping the search')); notify('news', T('Пропавшую нашли живой', 'Зниклу знайшли живою', 'Missing woman found alive'), T(`${d.who} нашли благодаря записям с найденного устройства. Преследователь задержан.`, `${d.who} знайшли завдяки записам зі знайденого пристрою. Переслідувача затримано.`, `${d.who} was found thanks to notes on a found device. The stalker was arrested.`)); return ok(T(`Её нашли живой. Семья передала +${fmt(d.usd)}`, `Її знайшли живою. Родина передала +${fmt(d.usd)}`, `She was found alive. The family sent +${fmt(d.usd)}`)); }
      const u = pay(Math.round(d.usd * 0.3), T('Вознаграждение от полиции', 'Винагорода від поліції', 'Police reward'));
      return { msg: T(`Записи помогли задержать подозреваемого. Её так и не нашли… +${fmt(u)}`, `Записи допомогли затримати підозрюваного. Її так і не знайшли… +${fmt(u)}`, `The notes helped arrest a suspect. She was never found… +${fmt(u)}`), cls: '' };
    } },
  { key: 'windows', kinds: ['camera', 'card', 'laptop', 'hdd'], p: 0.025, ic: '🪟', personal: true,
    roll: (r) => ({ n: r.int(300, 2400), usd: Math.round(r.float(40, 160)) }),
    file: (d) => [T(`ОНА (${d.n} фото)`, `ВОНА (${d.n} фото)`, `HER (${d.n} photos)`), 'archive', T(`${d.n} снимков одних и тех же окон на третьем этаже. Снято из машины, ночью, почти каждый день за два года. В EXIF — время и координаты. На последних фото — дверь её подъезда изнутри.`, `${d.n} знімків тих самих вікон на третьому поверсі. Знято з машини, вночі, майже щодня за два роки. В EXIF — час і координати. На останніх фото — двері її підʼїзду зсередини.`, `${d.n} shots of the same third‑floor windows. Taken from a car at night, nearly every day for two years. EXIF has times and coordinates. The last ones show her building’s door — from the inside.`)],
    acts: (d) => [['police', T(`🚓 Сдать в полицию · ~${fmt(d.usd)}`, `🚓 Здати в поліцію · ~${fmt(d.usd)}`, `🚓 Hand it to the police · ~${fmt(d.usd)}`)], ['del', T('🗑 Стереть и забыть', '🗑 Стерти й забути', '🗑 Wipe it and forget')]],
    act: (it, d, a) => (a === 'del' ? { msg: T('Стёрто. Вы ещё долго проверяете замок на двери.', 'Стерто. Ви ще довго перевіряєте замок на дверях.', 'Wiped. You check your own door lock twice tonight.'), cls: '' } : (pay(d.usd, T('Вознаграждение: задержан преследователь', 'Винагорода: затримано переслідувача', 'Reward: a stalker arrested')), addXP(35), stat('goodDeeds'), ok(T(`По координатам вышли на владельца камеры. Его задержали. +${fmt(d.usd)}`, `За координатами вийшли на власника камери. Його затримали. +${fmt(d.usd)}`, `The coordinates led to the camera’s owner. Arrested. +${fmt(d.usd)}`)))) },
  { key: 'yourname', kinds: ['usb', 'hdd', 'card', 'phone'], p: 0.02, ic: '👁',
    roll: (r) => ({ usd: Math.round(r.float(30, 140)) }),
    file: () => [T('ты_следующий.txt', 'ти_наступний.txt', 'you_are_next.txt'), 'text', T(`Создан вчера в 03:12. Внутри — ваше имя, ваш город и одна строка: «Не включай свет». На флешке больше никогда не было других файлов… но вы точно видели папку «Фото». Её больше нет.`, `Створено вчора о 03:12. Усередині — ваше імʼя, ваше місто й один рядок: «Не вмикай світло». На флешці більше ніколи не було інших файлів… але ви точно бачили теку «Фото». Її більше немає.`, `Created yesterday at 03:12. Inside: your name, your city and one line: “Don’t turn on the light.” There were never other files on it… but you definitely saw a “Photos” folder. It’s gone.`)],
    acts: (d) => [['blog', T(`📼 Продать блогеру‑страшилочнику · ${fmt(d.usd)}`, `📼 Продати блогеру‑страшилкарю · ${fmt(d.usd)}`, `📼 Sell to a horror YouTuber · ${fmt(d.usd)}`)], ['burn', T('🔥 Сжечь флешку', '🔥 Спалити флешку', '🔥 Burn the drive')]],
    act: (it, d, a) => (a === 'burn' ? { msg: T('Флешка горела зелёным пламенем. Наверное, пластик такой.', 'Флешка горіла зеленим полумʼям. Мабуть, пластик такий.', 'The drive burned with a green flame. Must be the plastic.'), cls: '' } : (pay(d.usd, T('Блогер купил «проклятую флешку»', 'Блогер купив «прокляту флешку»', 'A blogger bought the “cursed drive”')), ok(T(`Видео набрало 2 млн просмотров. Вам +${fmt(d.usd)}. Блогер с тех пор не выходит на связь.`, `Відео набрало 2 млн переглядів. Вам +${fmt(d.usd)}. Блогер відтоді не виходить на звʼязок.`, `The video hit 2M views. +${fmt(d.usd)} for you. The blogger hasn’t been in touch since.`)))) },
  { key: 'tape333', kinds: ['phone', 'usb', 'laptop', 'tablet'], p: 0.025, ic: '🎙',
    roll: (r) => ({ n: r.int(30, 140), usd: Math.round(r.float(25, 110)) }),
    file: (d) => [T(`Диктофон_03-33 (${d.n} записей)`, `Диктофон_03-33 (${d.n} записів)`, `Recorder_03-33 (${d.n} files)`), 'music', T(`${d.n} записей, каждая начата ровно в 03:33 в пустой квартире. Тишина, скрип пола и шёпот, который на последних записях становится ближе. Последняя запись: шёпот прямо у микрофона называет имя хозяина телефона.`, `${d.n} записів, кожен почато рівно о 03:33 у порожній квартирі. Тиша, скрип підлоги й шепіт, що на останніх записах наближається. Останній запис: шепіт просто біля мікрофона називає імʼя власника телефону.`, `${d.n} recordings, each started at exactly 03:33 in an empty flat. Silence, creaking floors and a whisper that gets closer. The last one: the whisper right at the mic says the owner’s name.`)],
    acts: (d) => [['pod', T(`🎧 Продать хоррор‑подкасту · ${fmt(d.usd)}`, `🎧 Продати хорор‑подкасту · ${fmt(d.usd)}`, `🎧 Sell to a horror podcast · ${fmt(d.usd)}`)], ['del', T('🗑 Удалить, не слушая', '🗑 Видалити, не слухаючи', '🗑 Delete without listening')]],
    act: (it, d, a) => (a === 'del' ? { msg: T('Удалено. В 03:33 вы почему‑то проснулись.', 'Видалено. О 03:33 ви чомусь прокинулися.', 'Deleted. You woke up at 03:33 for some reason.'), cls: '' } : (pay(d.usd, T('Хоррор‑подкаст купил записи', 'Хорор‑подкаст купив записи', 'A horror podcast bought the tapes')), ok(T(`Выпуск стал самым популярным в сезоне. +${fmt(d.usd)}`, `Випуск став найпопулярнішим у сезоні. +${fmt(d.usd)}`, `The episode became the season’s hit. +${fmt(d.usd)}`)))) },
  { key: 'confess', kinds: ['phone', 'usb', 'hdd'], p: 0.02, ic: '🕯',
    roll: (r) => ({ street: r.pick(['Лесной', 'Заводской', 'Садовой', 'Речной', 'Тупиковой']), usd: Math.round(r.float(120, 480)), cash: r.chance(0.5), stash: Math.round(r.float(150, 900)) }),
    file: (d) => [T('ЕСЛИ_ВЫ_ЭТО_СЛЫШИТЕ.m4a', 'ЯКЩО_ВИ_ЦЕ_ЧУЄТЕ.m4a', 'IF_YOU_HEAR_THIS.m4a'), 'music', T(`Голосовое: «Если вы это слышите — меня уже нет. Всё, что они ищут, — в гараже на ${d.street}, номер 14. Не открывайте ночью».`, `Голосове: «Якщо ви це чуєте — мене вже немає. Усе, що вони шукають, — у гаражі на ${d.street}, номер 14. Не відчиняйте вночі».`, `Voice note: “If you hear this, I’m already gone. Everything they’re looking for is in the garage on ${d.street} St, number 14. Don’t open it at night.”`)],
    acts: (d) => [['police', T(`🚓 Передать полиции · ~${fmt(d.usd)}`, `🚓 Передати поліції · ~${fmt(d.usd)}`, `🚓 Give it to the police · ~${fmt(d.usd)}`)], ['go', T('🔦 Поехать в гараж самому', '🔦 Поїхати в гараж самому', '🔦 Go to the garage yourself'), 'red']],
    act: (it, d, a) => {
      if (a === 'police') { pay(d.usd, T('Вознаграждение: раскрыто дело', 'Винагорода: розкрито справу', 'Reward: a case solved')); addXP(45); stat('goodDeeds'); return ok(T(`В гараже нашли склад краденого и пропавшие документы. Дело раскрыто. +${fmt(d.usd)}`, `У гаражі знайшли склад краденого й зниклі документи. Справу розкрито. +${fmt(d.usd)}`, `The garage held a stash of stolen goods and missing papers. Case solved. +${fmt(d.usd)}`)); }
      if (d.cash) { pay(d.stash, T('Находка в гараже', 'Знахідка в гаражі', 'Found in a garage')); addXP(20); return ok(T(`Замок поддался. В старом сейфе — пачка денег: +${fmt(d.stash)}. Уходя, вы слышите, как к гаражам подъезжает машина без фар.`, `Замок піддався. У старому сейфі — пачка грошей: +${fmt(d.stash)}. Ідучи, ви чуєте, як до гаражів підʼїжджає машина без фар.`, `The lock gave. An old safe with a wad of cash: +${fmt(d.stash)}. Leaving, you hear a car with no lights pull up.`)); }
      const fine = Math.round(d.stash * 0.4 + 40); policeFine('stolen', fine, T('проникновение в чужой гараж', 'проникнення в чужий гараж', 'breaking into a garage'));
      return bad(T(`Гараж пустой, а через минуту — патруль: соседи вызвали полицию. Штраф ${fmt(fine)} и пометка в деле.`, `Гараж порожній, а за хвилину — патруль: сусіди викликали поліцію. Штраф ${fmt(fine)} і позначка в справі.`, `Empty garage — and a patrol a minute later: the neighbours called. Fine ${fmt(fine)} and a mark on your record.`));
    } },
  { key: 'nanny', kinds: ['nas', 'card', 'camera', 'phone'], p: 0.03, ic: '👶',
    roll: (r) => ({ usd: Math.round(r.float(30, 150)) }),
    file: () => [T('Радионяня_архив_ночь.mp4', 'Радіоняня_архів_ніч.mp4', 'Babycam_archive_night.mp4'), 'video', T('Пустая детская, 02:40. Кресло‑качалка начинает качаться само. В 02:51 игрушки на полке медленно поворачиваются к камере. Семья, судя по файлам, переехала на следующий день.', 'Порожня дитяча, 02:40. Крісло‑гойдалка починає гойдатися само. О 02:51 іграшки на полиці повільно повертаються до камери. Родина, судячи з файлів, переїхала наступного дня.', 'An empty nursery, 02:40. The rocking chair starts rocking on its own. At 02:51 the toys on the shelf slowly turn to face the camera. Judging by the files, the family moved out the next day.')],
    acts: (d) => [['tv', T(`📺 Продать ТВ‑шоу про паранормальное · ${fmt(d.usd)}`, `📺 Продати ТБ‑шоу про паранормальне · ${fmt(d.usd)}`, `📺 Sell to a paranormal TV show · ${fmt(d.usd)}`)]],
    act: (it, d) => (pay(d.usd, T('ТВ‑шоу купило запись', 'ТБ‑шоу купило запис', 'A TV show bought the footage')), ok(T(`Эксперты шоу назвали запись «подлинной». +${fmt(d.usd)}`, `Експерти шоу назвали запис «справжнім». +${fmt(d.usd)}`, `The show’s experts called it “genuine”. +${fmt(d.usd)}`))) },
  { key: 'hitrun', kinds: ['dashcam', 'card', 'phone'], p: 0.04, ic: '🚑',
    roll: (r) => ({ usd: Math.round(r.float(60, 260)), plate: `${r.pick(['АА', 'КА', 'ВС', 'АІ', 'А'])}${r.int(1000, 9999)}${r.pick(['ВХ', 'ОМ', 'КТ', 'ЕР'])}`, caught: r.chance(0.4) }),
    file: (d) => [T(`ДТП_виновник_скрылся_${d.plate}.mp4`, `ДТП_винуватець_втік_${d.plate}.mp4`, `crash_hit_and_run_${d.plate}.mp4`), 'video', T(`Ночная запись регистратора: машина ${d.plate} сбивает пешехода на переходе и уезжает. Номер читается чётко.`, `Нічний запис реєстратора: машина ${d.plate} збиває пішохода на переході й їде. Номер читається чітко.`, `Night dashcam footage: car ${d.plate} hits a pedestrian on a crossing and drives off. The plate is clear.`)],
    acts: (d) => [['police', T(`🚓 В полицию и семье пострадавшего · ~${fmt(d.usd)}`, `🚓 У поліцію й родині потерпілого · ~${fmt(d.usd)}`, `🚓 To the police and the victim’s family · ~${fmt(d.usd)}`)], ['black', T(`💰 Шантажировать водителя · ~${fmt(d.usd * 3)}`, `💰 Шантажувати водія · ~${fmt(d.usd * 3)}`, `💰 Blackmail the driver · ~${fmt(d.usd * 3)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'police') { pay(d.usd, T('Вознаграждение от семьи пострадавшего', 'Винагорода від родини потерпілого', 'Reward from the victim’s family')); addXP(40); stat('goodDeeds'); return ok(T(`Водителя задержали. Семья пострадавшего благодарит: +${fmt(d.usd)}`, `Водія затримали. Родина потерпілого дякує: +${fmt(d.usd)}`, `The driver was arrested. The family thanks you: +${fmt(d.usd)}`)); }
      if (d.caught) { const fine = d.usd * 3; policeFine('fraud', fine, T('вымогательство', 'вимагання', 'extortion')); return bad(T(`Водитель пошёл в полицию сам. Вымогательство: штраф ${fmt(fine)}.`, `Водій пішов у поліцію сам. Вимагання: штраф ${fmt(fine)}.`, `The driver went to the police himself. Extortion: fine ${fmt(fine)}.`)); }
      pay(d.usd * 3, T('«Договорились» с водителем', '«Домовилися» з водієм', '“Settled” with the driver')); return ok(T(`Он заплатил +${fmt(d.usd * 3)}. Совесть — не заплатила.`, `Він заплатив +${fmt(d.usd * 3)}. Совість — не заплатила.`, `He paid +${fmt(d.usd * 3)}. Your conscience didn’t.`));
    } },
  { key: 'compromat', kinds: ['office', 'hdd', 'laptop', 'secure', 'usb'], p: 0.03, ic: '🗃',
    roll: (r) => ({ usd: Math.round(r.float(150, 600)), caught: r.chance(0.45) }),
    file: () => [T('Откаты_тендеры_2019-2025.xlsx', 'Відкати_тендери_2019-2025.xlsx', 'Kickbacks_tenders_2019-2025.xlsx'), 'doc', T('Таблица «откатов» по городским тендерам: суммы, даты, фамилия заместителя мэра и номера счетов. Похоже на настоящую бухгалтерию.', 'Таблиця «відкатів» за міськими тендерами: суми, дати, прізвище заступника мера й номери рахунків. Схоже на справжню бухгалтерію.', 'A spreadsheet of kickbacks on city tenders: sums, dates, the deputy mayor’s name and account numbers. Looks like real books.')],
    acts: (d) => [['press', T(`📰 Отдать журналистам‑расследователям · ${fmt(Math.round(d.usd * 0.6))}`, `📰 Віддати журналістам‑розслідувачам · ${fmt(Math.round(d.usd * 0.6))}`, `📰 Give to investigative journalists · ${fmt(Math.round(d.usd * 0.6))}`)], ['black', T(`💼 Предложить чиновнику «выкупить» · ~${fmt(d.usd * 4)}`, `💼 Запропонувати чиновнику «викупити» · ~${fmt(d.usd * 4)}`, `💼 Offer the official a “buy‑back” · ~${fmt(d.usd * 4)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'press') { const u = pay(Math.round(d.usd * 0.6), T('Гонорар от редакции', 'Гонорар від редакції', 'Fee from the newsroom')); addXP(40); notify('news', T('Громкое расследование', 'Гучне розслідування', 'A big investigation'), T('Журналисты опубликовали схему откатов в мэрии. Заместитель мэра задержан.', 'Журналісти оприлюднили схему відкатів у мерії. Заступника мера затримано.', 'Journalists exposed a kickback scheme at city hall. The deputy mayor was arrested.')); return ok(T(`Расследование вышло. +${fmt(u)}`, `Розслідування вийшло. +${fmt(u)}`, `The story ran. +${fmt(u)}`)); }
      if (d.caught) { const fine = Math.round(d.usd * 2); policeFine('fraud', fine, T('шантаж чиновника', 'шантаж чиновника', 'blackmailing an official')); return bad(T(`На встречу пришли люди в штатском. Шантаж: штраф ${fmt(fine)} и пометка в деле.`, `На зустріч прийшли люди в цивільному. Шантаж: штраф ${fmt(fine)} і позначка в справі.`, `Plain‑clothes officers came to the meet. Blackmail: fine ${fmt(fine)} and a mark.`)); }
      pay(d.usd * 4, T('Чиновник «выкупил» флешку', 'Чиновник «викупив» флешку', 'The official “bought back” the drive')); return ok(T(`Конверт передали в машине без номеров. +${fmt(d.usd * 4)}`, `Конверт передали в машині без номерів. +${fmt(d.usd * 4)}`, `The envelope changed hands in a car without plates. +${fmt(d.usd * 4)}`));
    } },
  { key: 'album', kinds: ['laptop', 'hdd', 'usb', 'secure'], p: 0.022, ic: '💿',
    roll: (r) => ({ artist: r.pick(['Майк Жаксон', 'Нирванна', 'Даффт Панкк', 'МонАтик', 'Скрябен', 'Земфирра']), usd: Math.round(r.float(200, 700)), sue: r.chance(0.45) }),
    file: (d) => [T(`${d.artist}_неизданный_альбом_мастер.wav`, `${d.artist}_невиданий_альбом_мастер.wav`, `${d.artist}_unreleased_album_master.wav`), 'music', T(`Мастер‑копия неизданного альбома: 11 треков, которые фанаты ищут годами.`, `Майстер‑копія невиданого альбому: 11 треків, які фанати шукають роками.`, `A master copy of an unreleased album: 11 tracks fans have hunted for years.`)],
    acts: (d) => [['label', T(`🏷 Вернуть лейблу · ${fmt(Math.round(d.usd * 0.5))}`, `🏷 Повернути лейблу · ${fmt(Math.round(d.usd * 0.5))}`, `🏷 Return to the label · ${fmt(Math.round(d.usd * 0.5))}`)], ['leak', T(`🌐 Продать фанатам · ~${fmt(d.usd * 2)}`, `🌐 Продати фанатам · ~${fmt(d.usd * 2)}`, `🌐 Sell to fans · ~${fmt(d.usd * 2)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'label') { const u = pay(Math.round(d.usd * 0.5), T('Лейбл выкупил мастер‑копию', 'Лейбл викупив майстер‑копію', 'The label bought back the master')); addXP(35); return ok(T(`Лейбл благодарит и шлёт билеты на концерт. +${fmt(u)}`, `Лейбл дякує й надсилає квитки на концерт. +${fmt(u)}`, `The label thanks you with concert tickets. +${fmt(u)}`)); }
      if (d.sue) { const fine = Math.round(d.usd * 1.6); policeFine('leak', fine, T('слив альбома', 'злив альбому', 'leaking an album')); return bad(T(`Лейбл вычислил утечку. Иск и штраф ${fmt(fine)}.`, `Лейбл вирахував витік. Позов і штраф ${fmt(fine)}.`, `The label traced the leak. Lawsuit and fine ${fmt(fine)}.`)); }
      earn(d.usd * 2, 'sale', T('Слив альбома фанатам', 'Злив альбому фанатам', 'Album leaked to fans')); return ok(`+${fmt(d.usd * 2)}`);
    } },
  { key: 'dbdump', kinds: ['secure', 'hdd', 'nas', 'office', 'laptop'], p: 0.035, ic: '🧬', personal: true,
    roll: (r) => ({ n: r.int(20, 900) * 1000, bounty: Math.round(r.float(120, 500)), dark: Math.round(r.float(300, 1200)), caught: r.chance(0.5) }),
    file: (d) => [T(`dump_customers_${d.n}.sql`, `dump_customers_${d.n}.sql`, `dump_customers_${d.n}.sql`), 'archive', T(`Дамп базы интернет‑магазина: ${d.n.toLocaleString('ru')} клиентов, телефоны, адреса, хэши паролей. Магазин, судя по всему, не знает об утечке.`, `Дамп бази інтернет‑магазину: ${d.n.toLocaleString('ru')} клієнтів, телефони, адреси, хеші паролів. Магазин, схоже, не знає про витік.`, `A web shop’s database dump: ${d.n.toLocaleString('en')} customers, phones, addresses, password hashes. The shop doesn’t seem to know.`)],
    acts: (d) => [['bounty', T(`🛡 Сообщить магазину (баг‑баунти) · ${fmt(d.bounty)}`, `🛡 Повідомити магазину (баг‑баунті) · ${fmt(d.bounty)}`, `🛡 Report it to the shop (bug bounty) · ${fmt(d.bounty)}`)], ['dark', T(`🕶 Продать в Тени · ~${fmt(d.dark)}`, `🕶 Продати в Тіні · ~${fmt(d.dark)}`, `🕶 Sell in the Shade · ~${fmt(d.dark)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'bounty') { pay(d.bounty, T('Баг‑баунти: утечка базы', 'Баг‑баунті: витік бази', 'Bug bounty: leaked database')); addXP(45); stat('goodDeeds'); return ok(T(`Магазин закрыл дыру и выплатил баунти: +${fmt(d.bounty)}`, `Магазин закрив діру й виплатив баунті: +${fmt(d.bounty)}`, `The shop patched it and paid a bounty: +${fmt(d.bounty)}`)); }
      if (d.caught) { const fine = Math.round(d.dark * 1.5); policeFine('leak', fine, T('продажа базы клиентов', 'продаж бази клієнтів', 'selling a customer database')); return bad(T(`Покупатель — киберполиция. Штраф ${fmt(fine)}.`, `Покупець — кіберполіція. Штраф ${fmt(fine)}.`, `The buyer was cyber police. Fine ${fmt(fine)}.`)); }
      earn(d.dark, 'other', T('Продажа базы в Тени', 'Продаж бази в Тіні', 'Sold a database in the Shade')); return ok(`+${fmt(d.dark)}`);
    } },
  { key: 'proto', kinds: ['laptop', 'secure', 'usb'], p: 0.02, ic: '📐',
    roll: (r) => ({ brand: r.pick(['Pear', 'Samsong', 'Xiaomo', 'Gugle']), usd: Math.round(r.float(300, 900)), caught: r.chance(0.5) }),
    file: (d) => [T(`${d.brand}_прототип_CONFIDENTIAL.pdf`, `${d.brand}_прототип_CONFIDENTIAL.pdf`, `${d.brand}_prototype_CONFIDENTIAL.pdf`), 'doc', T(`Чертежи и характеристики телефона ${d.brand}, который выйдет только через год. Гриф «Строго конфиденциально».`, `Креслення й характеристики телефону ${d.brand}, який вийде лише через рік. Гриф «Суворо конфіденційно».`, `Drawings and specs of a ${d.brand} phone due next year. Marked “Strictly confidential”.`)],
    acts: (d) => [['return', T(`🏢 Вернуть компании · ${fmt(Math.round(d.usd * 0.4))}`, `🏢 Повернути компанії · ${fmt(Math.round(d.usd * 0.4))}`, `🏢 Return to the company · ${fmt(Math.round(d.usd * 0.4))}`)], ['leak', T(`📢 Продать блогеру‑инсайдеру · ~${fmt(d.usd * 2)}`, `📢 Продати блогеру‑інсайдеру · ~${fmt(d.usd * 2)}`, `📢 Sell to a leaks blogger · ~${fmt(d.usd * 2)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'return') { const u = pay(Math.round(d.usd * 0.4), T('Компания выкупила утечку', 'Компанія викупила витік', 'The company bought back the leak')); addXP(35); return ok(T(`Служба безопасности ${d.brand} благодарит. +${fmt(u)} и NDA на подпись.`, `Служба безпеки ${d.brand} дякує. +${fmt(u)} і NDA на підпис.`, `${d.brand} security thanks you. +${fmt(u)} and an NDA to sign.`)); }
      if (d.caught) { const fine = Math.round(d.usd * 1.8); policeFine('leak', fine, T('коммерческая тайна', 'комерційна таємниця', 'trade secrets')); return bad(T(`Юристы ${d.brand} нашли источник. Штраф ${fmt(fine)}.`, `Юристи ${d.brand} знайшли джерело. Штраф ${fmt(fine)}.`, `${d.brand}’s lawyers found the source. Fine ${fmt(fine)}.`)); }
      earn(d.usd * 2, 'sale', T('Утечка прототипа', 'Витік прототипу', 'Prototype leak')); return ok(T(`Видео‑утечка разлетелась по сети. +${fmt(d.usd * 2)}`, `Відео‑витік розлетівся мережею. +${fmt(d.usd * 2)}`, `The leak went viral. +${fmt(d.usd * 2)}`));
    } },
  { key: 'gifts', kinds: ['phone', 'tablet'], p: 0.05, ic: '🎁',
    roll: (r) => ({ usd: Math.round(r.float(10, 90)), used: r.chance(0.3) }),
    file: () => [T('Подарочные_карты.png', 'Подарункові_картки.png', 'Gift_cards.png'), 'photo', T('Скриншот трёх подарочных карт магазинов электроники с открытыми кодами.', 'Скриншот трьох подарункових карток магазинів електроніки з відкритими кодами.', 'A screenshot of three electronics store gift cards with the codes showing.')],
    acts: (d) => [['use', T(`🛍 Использовать · до ${fmt(d.usd)}`, `🛍 Використати · до ${fmt(d.usd)}`, `🛍 Use them · up to ${fmt(d.usd)}`)]],
    act: (it, d) => (d.used ? bad(T('Две карты уже погашены, третья — на 0 ₽.', 'Дві картки вже погашені, третя — на 0.', 'Two were used, the third has a zero balance.')) : (earn(d.usd, 'other', T('Подарочные карты', 'Подарункові картки', 'Gift cards')), ok(`+${fmt(d.usd)}`))) },
  { key: 'missingcat', kinds: ['phone', 'camera', 'card'], p: 0.03, ic: '🐈',
    roll: (r) => ({ usd: Math.round(r.float(20, 120)), name: r.pick(['Барсик', 'Мурка', 'Граф', 'Пушок', 'Тайсон']) }),
    file: (d) => [T(`ПРОПАЛ_КОТ_${d.name}.jpg`, `ЗНИК_КІТ_${d.name}.jpg`, `LOST_CAT_${d.name}.jpg`), 'photo', T(`Объявление «Пропал кот ${d.name}, вознаграждение». А в той же папке — свежие фото этого кота на чужом балконе, с геометкой.`, `Оголошення «Зник кіт ${d.name}, винагорода». А в тій самій теці — свіжі фото цього кота на чужому балконі, з геоміткою.`, `A “Lost cat ${d.name}, reward” poster. And in the same folder — fresh photos of that cat on someone else’s balcony, geotagged.`)],
    acts: (d) => [['find', T(`🐾 Вернуть кота хозяевам · +${fmt(d.usd)}`, `🐾 Повернути кота господарям · +${fmt(d.usd)}`, `🐾 Bring the cat home · +${fmt(d.usd)}`)]],
    act: (it, d) => (pay(d.usd, T(`Вознаграждение за кота ${d.name}`, `Винагорода за кота ${d.name}`, `Reward for ${d.name} the cat`)), addXP(25), stat('goodDeeds'), addReview(5, T(`Вы вернули нам ${d.name}! Дети счастливы 😭`, `Ви повернули нам ${d.name}! Діти щасливі 😭`, `You brought ${d.name} back! The kids are over the moon 😭`), { buyer: d.name }), ok(T(`${d.name} дома. +${fmt(d.usd)} и пирог в придачу.`, `${d.name} вдома. +${fmt(d.usd)} і пиріг на додачу.`, `${d.name} is home. +${fmt(d.usd)} and a pie.`))) },
);
// the lookup by key covers every find above (built last, so later LOOT.push blocks are included)
for (const x of LOOT) LOOT_BY[x.key] ||= x;
