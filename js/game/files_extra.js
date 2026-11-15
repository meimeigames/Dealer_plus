// More of what people leave on their devices. deviceFiles() calls extraFiles() after its own finds: everyday
// folders that depend on the kind of device (screenshots, Telegram, notes, torrents, backups, projects, RAW shots,
// console clips, CCTV…) and "loot" — gift cards, game accounts, seed phrases, tickets, licence keys, someone's
// novel, lottery tickets… Each loot file has one-time actions in its preview, some honest, some risky.
// Everything is rolled on its own RNG, so the older finds of a device never change.
import { G, emit } from '../core/state.js';
import { T, L } from '../core/i18n.js';
import { RNG } from '../core/rng.js';
import { PHOTO_FILES } from '../data/photos.js';
import { earn, charge, spend, addItem, addXP, addReview, stat, notify } from './player.js';
import { makeItem, itemTitle, itemValue } from './items.js';
import { MODELS, modelValue } from '../data/catalog.js';
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
  sc('🧾', 'Чек из ресторана на троих (платил один)', 'Чек з ресторану на трьох (платив один)', 'Dinner bill for three (one paid)'), sc('📉', 'Портфель акций −42 %', 'Портфель акцій −42 %', 'Stock portfolio −42 %'),
  sc('🐶', 'Собака соседа в моих тапках', 'Собака сусіда в моїх капцях', 'The neighbour’s dog in my slippers'), sc('🛞', 'Вмятина «до» — для страховой', 'Вмʼятина «до» — для страхової', 'The dent “before” — for insurance'),
  sc('🎟', 'Билет на концерт (не пошёл)', 'Квиток на концерт (не пішов)', 'Concert ticket (didn’t go)'), sc('🧸', 'Список желаний ребёнка (14 пунктов)', 'Список бажань дитини (14 пунктів)', 'A kid’s wishlist (14 items)'),
  sc('🍲', 'Борщ, который удался', 'Борщ, який вдався', 'The borscht that worked out'), sc('🧳', 'Заявка о потере багажа', 'Заява про втрату багажу', 'Lost luggage claim'),
  sc('🏠', 'Квартира мечты за 400 тыс $', 'Квартира мрії за 400 тис $', 'Dream flat for $400k'), sc('🧮', 'Расчёт: «если не есть 3 года — хватит на машину»', 'Розрахунок: «якщо не їсти 3 роки — вистачить на машину»', 'Maths: “skip food for 3 years = a car”'),
  sc('📵', 'Скрин блокировки бывшего', 'Скрин блокування колишнього', 'Blocking an ex'), sc('🪴', 'Фикус: день 1 и день 90', 'Фікус: день 1 і день 90', 'Ficus: day 1 vs day 90'),
];
const VOICES = [
  ['«Купи хлеба и не забудь про собаку»', '«Купи хліба й не забудь про собаку»', '“Buy bread and don’t forget the dog”'],
  ['«Я опаздываю, начинайте без меня»', '«Я запізнююсь, починайте без мене»', '“Running late, start without me”'],
  ['«Перезвони, это срочно!»', '«Передзвони, це терміново!»', '“Call me back, it’s urgent!”'],
  ['«Ключи под ковриком, кот накормлен»', '«Ключі під килимком, кіт нагодований»', '“Keys under the mat, the cat is fed”'],
  ['Кто‑то поёт в душе. Фальшиво.', 'Хтось співає в душі. Фальшиво.', 'Someone singing in the shower. Off key.'],
  ['«Сколько можно ждать мастера?!»', '«Скільки можна чекати майстра?!»', '“How long do we wait for the repairman?!”'],
  ['«Мам, я сдал! Сдал!!»', '«Мам, я здав! Здав!!»', '“Mum, I passed! I passed!!”'],
  ['«Это не я поцарапал машину, честно»', '«Це не я подряпав машину, чесно»', '“I didn’t scratch the car, honest”'],
  ['Голосовое на 7 минут: тётя рассказывает про давление', 'Голосове на 7 хвилин: тітка розповідає про тиск', 'A 7‑minute voice note: auntie on her blood pressure'],
  ['«Ты забыл выключить утюг. Я выключила. Целую»', '«Ти забув вимкнути праску. Я вимкнула. Цілую»', '“You left the iron on. I turned it off. Love you”'],
  ['Собака лает три минуты, потом — тишина', 'Собака гавкає три хвилини, потім — тиша', 'A dog barks for three minutes, then silence'],
  ['«Сынок, это мама. Перезвони. Это мама»', '«Синку, це мама. Передзвони. Це мама»', '“Son, it’s Mum. Call me back. It’s Mum”'],
  ['Шёпот: «не бери трубку, это коллекторы»', 'Шепіт: «не бери слухавку, це колектори»', 'Whisper: “don’t answer, it’s the debt collectors”'],
  ['Караоке в 2 ночи, все поют «Районы‑кварталы»', 'Караоке о 2 ночі, усі співають хором', 'Karaoke at 2 a.m., everyone singing'],
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
  ['Пароль от Wi‑Fi: на роутере. Роутер: у мамы.', 'Пароль від Wi‑Fi: на роутері. Роутер: у мами.', 'Wi‑Fi password: on the router. Router: at mum’s.'],
  ['План на жизнь: 1) похудеть 2) уволиться 3) Бали', 'План на життя: 1) схуднути 2) звільнитися 3) Балі', 'Life plan: 1) lose weight 2) quit 3) Bali'],
  ['Кому должен я: никому. Кто должен мне: все.', 'Кому винен я: нікому. Хто винен мені: усі.', 'Who I owe: nobody. Who owes me: everyone.'],
  ['Шиномонтаж, который «не обманывает»: Игорь, 097…', 'Шиномонтаж, що «не дурить»: Ігор, 097…', 'The tyre guy who “doesn’t cheat”: Igor, 097…'],
  ['Люди, которые взяли книги и не вернули: 7 имён', 'Люди, які взяли книжки й не повернули: 7 імен', 'People who borrowed books and never returned them: 7 names'],
  ['Тост на свадьбу брата (черновик №4): «Помню, как в 2009‑м…»', 'Тост на весілля брата (чернетка №4): «Памʼятаю, як у 2009‑му…»', 'Toast for my brother’s wedding (draft 4): “I remember back in 2009…”'],
  ['Что продать: велик, гитару, бывшего парня', 'Що продати: велик, гітару, колишнього', 'To sell: the bike, the guitar, my ex'],
  ['Сон: я снова сдаю экзамен по химии. Мне 38.', 'Сон: я знову складаю іспит з хімії. Мені 38.', 'Dream: sitting a chemistry exam again. I’m 38.'],
];
const DIPLOMA = [['Диплом_Иванов_v7_ФИНАЛ.docx', 'Диплом_Іванов_v7_ФІНАЛ.docx', 'Thesis_v7_FINAL.docx'], ['Презентация на защиту.pptx', 'Презентація на захист.pptx', 'Defence slides.pptx'], ['Курсовая по сопромату.docx', 'Курсова з опору матеріалів.docx', 'Strength of materials essay.docx'], ['Реферат «История края».doc', 'Реферат «Історія краю».doc', 'Report “Local history”.doc']];
const MOVIES = ['Бригада', 'Матрица', 'Брат 2', 'Шрек', 'Аватар', 'Интерстеллар', 'Ирония судьбы', 'Начало', 'Гладиатор', 'Пираты Карибского моря', 'Титаник', 'Однажды в Голливуде'];
const SERIES = ['Друзья', 'Во все тяжкие', 'Игра престолов', 'Шерлок', 'Офис', 'Сваты', 'Кухня', 'Ведьмак'];
const GAMES = ['Сталкер', 'Ведьмак 3', 'GTA San Andreas', 'Counter‑Strike 1.6', 'Героes III', 'NFS Most Wanted', 'Minecraft', 'Fallaut 4', 'Скайрим', 'Dota 2', 'Сапёр'];
const MOBGAMES = ['Brawl Starz', 'Clash of Clons', 'PUBG Mobail', 'Genshin Impakt', 'Стэндофф 2', 'Roblocks', 'Сабвэй Серф'];
const CONGAMES = ['FEFA 24', 'Call of Duti', 'Grand Theft Avto V', 'Fortnait', 'God of Wor', 'Spider‑Mann 2', 'Mario Kart 8'];
const SHOPS = ['Розетко', 'Фокстрот', 'Цитрус', 'Комфи', 'Эльдорадо', 'М.Видос'];

// ---- more everyday content (folders below pick from these)
const SEARCH = [
  ['как понять, что сосед ворует электричество', 'як зрозуміти, що сусід краде електрику', 'how to tell the neighbour steals electricity'], ['болит левый бок что это', 'болить лівий бік що це', 'pain in left side what is it'],
  ['курс доллара завтра', 'курс долара завтра', 'dollar rate tomorrow'], ['как вернуть бывшую за 3 дня', 'як повернути колишню за 3 дні', 'get your ex back in 3 days'],
  ['можно ли коту огурец', 'чи можна коту огірок', 'can cats eat cucumber'], ['перекупить айфон и продать дороже', 'перекупити айфон і продати дорожче', 'flip an iPhone for profit'],
  ['телефон упал в унитаз что делать', 'телефон впав в унітаз що робити', 'phone fell in the toilet what now'], ['почему кот ночью смотрит в угол', 'чому кіт уночі дивиться в кут', 'why does my cat stare at the corner at night'],
  ['как удалить историю поиска навсегда', 'як видалити історію пошуку назавжди', 'delete search history forever'], ['сколько стоит забрать машину со штрафплощадки', 'скільки коштує забрати авто зі штрафмайданчика', 'impound release cost'],
  ['рецепт борща как у бабушки', 'рецепт борщу як у бабусі', 'borscht recipe like grandma’s'], ['вернуть деньги за курс «стань миллионером»', 'повернути гроші за курс «стань мільйонером»', 'refund “become a millionaire” course'],
  ['как починить кран без сантехника', 'як полагодити кран без сантехніка', 'fix a tap without a plumber'], ['что подарить девушке недорого', 'що подарувати дівчині недорого', 'cheap gift for girlfriend'],
  ['кто звонил с номера 044…', 'хто дзвонив з номера 044…', 'who called from 044…'], ['сон где выпадают зубы', 'сон де випадають зуби', 'dream teeth falling out meaning'],
];
const CALLS = [
  ['Мама — 47 пропущенных', 'Мама — 47 пропущених', 'Mum — 47 missed calls'], ['Неизвестный — в 3:12 ночи, 4 сек', 'Невідомий — о 3:12 ночі, 4 сек', 'Unknown — 3:12 a.m., 4 sec'],
  ['«Банк» (спам) — 14 раз за день', '«Банк» (спам) — 14 разів за день', '“Bank” (spam) — 14 times a day'], ['Любимый ❤️ — 2 ч 14 мин', 'Коханий ❤️ — 2 год 14 хв', 'Love ❤️ — 2 h 14 min'],
  ['Вася Гараж — «перезвони по колёсам»', 'Вася Гараж — «передзвони щодо коліс»', 'Vasya Garage — “call me about the tyres”'], ['Начальник — сброшен 6 раз', 'Начальник — скинуто 6 разів', 'Boss — declined 6 times'],
  ['Доставка пиццы — каждую пятницу', 'Доставка піци — щопʼятниці', 'Pizza delivery — every Friday'], ['Бывшая — исходящий, 0 сек, 02:40', 'Колишня — вихідний, 0 сек, 02:40', 'Ex — outgoing, 0 sec, 02:40'],
  ['«Не брать» — 9 пропущенных', '«Не брати» — 9 пропущених', '“Don’t answer” — 9 missed'], ['Бабушка — 1 ч 40 мин (про давление и соседку)', 'Бабуся — 1 год 40 хв (про тиск і сусідку)', 'Grandma — 1 h 40 min (blood pressure, the neighbour)'],
];
const PLACES = [
  ['Дом', 'Дім', 'Home'], ['Работа', 'Робота', 'Work'], ['Та самая шаурма ★★★★★', 'Та сама шаурма ★★★★★', 'THE shawarma place ★★★★★'], ['Гараж', 'Гараж', 'Garage'],
  ['Где оставил машину (3 года назад)', 'Де залишив машину (3 роки тому)', 'Where I parked (3 years ago)'], ['Тёща — объезжать', 'Теща — обʼїжджати', 'Mother‑in‑law — avoid'],
  ['Рыбалка — клюёт тут', 'Риболовля — клює тут', 'Fishing — they bite here'], ['Шиномонтаж 24/7', 'Шиномонтаж 24/7', '24/7 tyre shop'], ['Секретное место (не говорить Свете)', 'Секретне місце (не казати Світлані)', 'Secret spot (don’t tell Sveta)'],
  ['Барахолка по воскресеньям', 'Барахолка щонеділі', 'Sunday flea market'], ['Банкомат без комиссии', 'Банкомат без комісії', 'Fee‑free ATM'],
];
const CHATS = [
  ['Родительский чат 5‑Б: 412 непрочитанных, «кто сдаёт на шторы?»', 'Батьківський чат 5‑Б: 412 непрочитаних, «хто здає на штори?»', 'Parents’ chat 5B: 412 unread, “who’s paying for curtains?”'],
  ['ОСББ: «чья машина опять на газоне?!»', 'ОСББ: «чия машина знову на газоні?!»', 'HOA: “whose car is on the lawn AGAIN?!”'], ['Семья: мама переслала 14 открыток «Доброе утро»', 'Сімʼя: мама переслала 14 листівок «Доброго ранку»', 'Family: mum forwarded 14 “Good morning” cards'],
  ['Работа: «можешь выйти в субботу? буквально на часик»', 'Робота: «можеш вийти в суботу? буквально на годинку»', 'Work: “can you come in Saturday? just an hour”'], ['Друзья: «го на шашлыки» — 230 сообщений, никто не поехал', 'Друзі: «го на шашлики» — 230 повідомлень, ніхто не поїхав', 'Friends: “BBQ?” — 230 messages, nobody went'],
  ['Барахолка района: «отдам кота в добрые руки (кот против)»', 'Барахолка району: «віддам кота в добрі руки (кіт проти)»', 'Local flea chat: “free cat to good home (the cat disagrees)”'], ['Риелтор: «квартира как на фото, только меньше»', 'Ріелтор: «квартира як на фото, тільки менша»', 'Realtor: “like the photos, only smaller”'],
  ['Перекупы города: «беру айфоны с iCloud, дорого»', 'Перекупи міста: «беру айфони з iCloud, дорого»', 'City flippers: “buying iCloud‑locked iPhones, top price”'], ['Клиенты: «а скидка будет? а если два?»', 'Клієнти: «а знижка буде? а якщо два?»', 'Customers: “any discount? what if I take two?”'],
];
const DOWNLOADS = [
  ['Инструкция к мультиварке.pdf', 'Інструкція до мультиварки.pdf', 'Slow cooker manual.pdf'], ['Билет на поезд Киев — Одесса.pdf', 'Квиток на потяг Київ — Одеса.pdf', 'Train ticket Kyiv — Odesa.pdf'],
  ['Договор_кредита_НЕ_ЧИТАТЬ.pdf', 'Договір_кредиту_НЕ_ЧИТАТИ.pdf', 'Loan_contract_DONT_READ.pdf'], ['Меню_доставки_суши.pdf', 'Меню_доставки_суші.pdf', 'Sushi_delivery_menu.pdf'],
  ['Справка_для_бассейна.jpg', 'Довідка_для_басейну.jpg', 'Pool_medical_note.jpg'], ['Раскраска для ребёнка (40 стр.).pdf', 'Розмальовка для дитини (40 стор.).pdf', 'Kids colouring book (40 p).pdf'],
  ['Курс «Инвестиции с нуля» (урок 1 из 40).mp4', 'Курс «Інвестиції з нуля» (урок 1 з 40).mp4', '“Investing from zero” (lesson 1 of 40).mp4'], ['Гороскоп_на_год.pdf', 'Гороскоп_на_рік.pdf', 'Horoscope_for_the_year.pdf'],
];
const MP3 = ['Linkin Perk — Numb (remix DJ Vasya).mp3', 'Неизвестен — Трек 01.mp3', 'Нокиа — рингтон.mid', 'Rammstain — Du hast (live 2001).mp3', 'Океан Ельзи — Без бою (концерт).mp3', 'Skuter — Hyper Hyper.mp3', 'Руки Вверх — 18 мне уже.mp3', 'Eminen — Lose Yourself.mp3', 'Тату — Нас не догонят.mp3', 'Gorillas — Feel Good Inc.mp3', 'Haddawey — What Is Love (Extended).mp3', 'Бумбокс — Вахтёрам.mp3', 'Неизвестен — Трек 14 (2).mp3'];
const SMARTHOME = [
  ['Входная дверь: открыта в 03:14, движения в квартире нет', 'Вхідні двері: відчинено о 03:14, руху в квартирі немає', 'Front door: opened at 03:14, no motion inside'],
  ['Робот‑пылесос: застрял под диваном 412 раз', 'Робот‑пилосос: застряг під диваном 412 разів', 'Robot vacuum: stuck under the sofa 412 times'], ['Термостат: 26° круглый год', 'Термостат: 26° цілий рік', 'Thermostat: 26° all year'],
  ['Умная колонка: 1 800 раз «включи звук дождя»', 'Розумна колонка: 1 800 разів «увімкни звук дощу»', 'Smart speaker: “play rain sounds” ×1,800'], ['Камера в прихожей: кот выходит в 02:00 и смотрит на дверь', 'Камера в передпокої: кіт виходить о 02:00 і дивиться на двері', 'Hall camera: the cat comes out at 2 a.m. and stares at the door'],
  ['Датчик протечки: сработал 1 раз («это я цветы полил»)', 'Датчик протікання: спрацював 1 раз («це я квіти полив»)', 'Leak sensor: once (“I was watering the plants”)'], ['Свет в детской включался сам 6 ночей подряд', 'Світло в дитячій вмикалося само 6 ночей поспіль', 'The nursery light turned itself on 6 nights in a row'],
];
const INCIDENTS = [
  ['Подрезали на кольце, водитель показал жест', 'Підрізали на колі, водій показав жест', 'Cut off at a roundabout, rude gesture included'], ['Яма на всю полосу — минус колпак', 'Яма на всю смугу — мінус ковпак', 'A lane‑wide pothole — goodbye hubcap'],
  ['Голубь атакует капот 4 минуты', 'Голуб атакує капот 4 хвилини', 'A pigeon attacks the bonnet for 4 minutes'], ['Ехал за машиной без номеров 20 км', 'Їхав за машиною без номерів 20 км', 'Followed a car with no plates for 20 km'],
  ['Лось на трассе ночью', 'Лось на трасі вночі', 'An elk on the highway at night'], ['Водитель автобуса поёт за рулём', 'Водій автобуса співає за кермом', 'A bus driver singing at the wheel'],
  ['Самокатчик против трамвая (оба живы)', 'Самокатник проти трамвая (обидва живі)', 'Scooter vs tram (both fine)'], ['Гаишник машет — оказалось, просит прикурить', 'Поліцейський махає — виявилося, просить прикурити', 'A cop flags you down — wants a light'],
];

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
    // ---- more everyday folders
    calls: () => [T('Звонки', 'Дзвінки', 'Calls'), [txt(T('Журнал вызовов.log', 'Журнал викликів.log', 'Call log.log'), r.sample(CALLS, r.int(3, 6)).map(tx).join(' · '), { personal: true })]],
    search: () => [T('Браузер', 'Браузер', 'Browser'), [txt(T('История поиска.txt', 'Історія пошуку.txt', 'Search history.txt'), r.sample(SEARCH, r.int(4, 7)).map((x) => `«${tx(x)}»`).join(' · '))]],
    alarms: () => { const h = r.int(5, 8); const t = (m) => `${h}:${pad(m, 2)}`; return [T('Часы', 'Годинник', 'Clock'), [txt(T('Будильники.txt', 'Будильники.txt', 'Alarms.txt'), `${t(0)} · ${t(5)} · ${t(10)} · ${t(15)} · ${t(20)} ${T('«ВСТАВАЙ»', '«ВСТАВАЙ»', '“GET UP”')} · ${t(25)} ${T('«ПОСЛЕДНИЙ»', '«ОСТАННІЙ»', '“LAST ONE”')} · ${t(40)} ${T('«ВСЁ, ОПОЗДАЛ»', '«УСЕ, ЗАПІЗНИВСЯ»', '“THAT’S IT, LATE”')}`)]]; },
    places: () => [T('Карты', 'Мапи', 'Maps'), [txt(T('Сохранённые места.kml', 'Збережені місця.kml', 'Saved places.kml'), r.sample(PLACES, r.int(4, 7)).map(tx).join(' · '), { personal: true })]],
    chats: () => [T('Чаты', 'Чати', 'Chats'), r.sample(CHATS, r.int(2, 4)).map((c, i) => txt(`chat_${pad(r.int(1, 999), 3)}.txt`, tx(c)))],
    downloads: () => [T('Загрузки', 'Завантаження', 'Downloads'), r.sample(DOWNLOADS, r.int(2, 4)).map((d) => f(tx(d), 'doc', +(r.float(0.2, 40)).toFixed(1)))],
    newfolder: () => [T('Новая папка (3)', 'Нова папка (3)', 'New folder (3)'), [f(T('Новая папка (2)', 'Нова папка (2)', 'New folder (2)'), 'archive', 0.1), txt(T('Новый текстовый документ.txt', 'Новий текстовий документ.txt', 'New Text Document.txt'), T('аааааа', 'аааааа', 'aaaaaa')), doc(T('бухгалтерия_НАСТОЯЩАЯ.xlsx', 'бухгалтерія_СПРАВЖНЯ.xlsx', 'accounts_REAL.xlsx'), T('Вторая бухгалтерия. Первая — для налоговой.', 'Друга бухгалтерія. Перша — для податкової.', 'The second set of books. The first one is for the tax office.'), { personal: true })]],
    mp3: () => [T('Музыка', 'Музика', 'Music'), r.sample(MP3, r.int(4, 8)).map((m) => f(m, 'audio', +(r.float(3, 9)).toFixed(1), { dur: `${r.int(2, 6)}:${pad(r.int(0, 59), 2)}` }))],
    memes: () => [T('Мемы', 'Меми', 'Memes'), [f(T(`Мемы (${r.int(300, 4000)} шт.)`, `Меми (${r.int(300, 4000)} шт.)`, `Memes (${r.int(300, 4000)})`), 'archive', r.int(200, 3000)), f(T('мем_про_перекупов.jpg', 'мем_про_перекупів.jpg', 'flipper_meme.jpg'), 'photo', 0.2, { scene: sc('😂', '«Купил за 100 — продал за 100. Зато опыт»', '«Купив за 100 — продав за 100. Зате досвід»', '“Bought for 100, sold for 100. Experience though”') })]],
    resume: () => [T('Поиск работы', 'Пошук роботи', 'Job hunt'), [doc(T('Резюме_v12.docx', 'Резюме_v12.docx', 'CV_v12.docx'), T('Стрессоустойчивость: высокая. Опыт: «разный».', 'Стресостійкість: висока. Досвід: «різний».', 'Stress tolerance: high. Experience: “varied”.'), { personal: true }), doc(T('Сопроводительное_шаблон.docx', 'Супровідний_шаблон.docx', 'Cover_letter_template.docx'), T('«Всю жизнь мечтал работать именно в [НАЗВАНИЕ КОМПАНИИ]».', '«Усе життя мріяв працювати саме в [НАЗВА КОМПАНІЇ]».', '“I have always dreamed of working at [COMPANY NAME].”'))]],
    freelance: () => [T('Фриланс', 'Фриланс', 'Freelance'), [doc(T('Счёт_клиенту (не оплачен 3 мес).pdf', 'Рахунок_клієнту (не оплачено 3 міс).pdf', 'Invoice (unpaid 3 months).pdf'), T(`${firm}: «оплатим на следующей неделе» — с марта.`, `${firm}: «оплатимо наступного тижня» — з березня.`, `${firm}: “we’ll pay next week” — since March.`)), doc(T('ТЗ_клиента.docx', 'ТЗ_клієнта.docx', 'Client_brief.docx'), T('«Сделайте как у Apple, но ярче. Бюджет 50 $. Вчера».', '«Зробіть як в Apple, але яскравіше. Бюджет 50 $. Вчора».', '“Make it like Apple, but brighter. Budget $50. Yesterday.”'))]],
    wedding: () => [T('Свадьба', 'Весілля', 'Wedding'), [vid(T('Свадьба_монтаж_FINAL.mp4', 'Весілля_монтаж_FINAL.mp4', 'Wedding_edit_FINAL.mp4'), r.int(3000, 9000), `2:${pad(r.int(10, 59), 2)}:00`, { personal: true }), doc(T('Конкурсы тамады.docx', 'Конкурси тамади.docx', 'MC games.docx'), T('Конкурс №7: «Найди невесту по коленке». Не повторять.', 'Конкурс №7: «Знайди наречену по коліну». Не повторювати.', 'Game #7: “find the bride by her knee”. Never again.'))]],
    nokia: () => [T('Бэкап Nokia (2004)', 'Бекап Nokia (2004)', 'Nokia backup (2004)'), [txt(T('Контакты.vcf', 'Контакти.vcf', 'Contacts.vcf'), T('«Вася Гараж», «Мама», «НЕ БРАТЬ», «Лёха Долг», «Такси», «Света Вторая»', '«Вася Гараж», «Мама», «НЕ БРАТИ», «Льоха Борг», «Таксі», «Світлана Друга»', '“Vasya Garage”, “Mum”, “DON’T ANSWER”, “Lyokha Debt”, “Taxi”, “Sveta Two”')), txt('SMS.txt', T('«Пополни счёт, я в роуминге» · «Ты где?» · «Абонент звонил вам 3 раза»', '«Поповни рахунок, я в роумінгу» · «Ти де?» · «Абонент дзвонив вам 3 рази»', '“Top me up, I’m roaming” · “Where are you?” · “This number called you 3 times”')), f('Snake II — рекорд 4120', 'game', 0.01)]],
    hr: () => [T('Отдел кадров', 'Відділ кадрів', 'HR'), [doc(T('Ведомость_зарплата.xlsx', 'Відомість_зарплата.xlsx', 'Payroll.xlsx'), T(`${firm}: 23 сотрудника, у директора «премия» больше, чем у всех вместе.`, `${firm}: 23 працівники, у директора «премія» більша, ніж у всіх разом.`, `${firm}: 23 staff; the director’s “bonus” beats everyone else combined.`), { personal: true }), f(T(`Резюме кандидатов (${r.int(20, 140)})`, `Резюме кандидатів (${r.int(20, 140)})`, `Applicant CVs (${r.int(20, 140)})`), 'archive', r.int(10, 90), { personal: true }), doc(T('Приказ о премиях (отменён).docx', 'Наказ про премії (скасовано).docx', 'Bonus order (cancelled).docx'), T('«В связи с кризисом…»', '«У звʼязку з кризою…»', '“Due to the crisis…”'))]],
    contracts: () => [T('Договоры', 'Договори', 'Contracts'), [doc(T(`Договор поставки №${r.int(10, 400)}.pdf`, `Договір поставки №${r.int(10, 400)}.pdf`, `Supply contract #${r.int(10, 400)}.pdf`), T('Штраф за просрочку: 0,1 % в день. Просрочка: 214 дней.', 'Штраф за прострочку: 0,1 % на день. Прострочка: 214 днів.', 'Late fee 0.1 %/day. Days late: 214.')), doc(T('Акт сверки.xlsx', 'Акт звірки.xlsx', 'Reconciliation.xlsx'), T('Не сходится на 3 копейки. Ищем второй месяц.', 'Не сходиться на 3 копійки. Шукаємо другий місяць.', 'Off by 3 cents. Second month of searching.'))]],
    smarthome: () => [T('Умный дом', 'Розумний дім', 'Smart home'), [txt(T('События.log', 'Події.log', 'Events.log'), r.sample(SMARTHOME, r.int(3, 5)).map(tx).join(' · '))]],
    plex: () => [T('Медиасервер', 'Медіасервер', 'Media server'), [f(T(`Фильмы (${r.int(80, 600)})`, `Фільми (${r.int(80, 600)})`, `Movies (${r.int(80, 600)})`), 'archive', r.int(200000, 900000)), f(T('Мультики для детей', 'Мультики для дітей', 'Cartoons for the kids'), 'archive', r.int(20000, 90000)), f(T('Сериалы «на потом» (не начаты)', 'Серіали «на потім» (не почато)', 'Shows “for later” (never started)'), 'archive', r.int(50000, 300000))]],
    wedshoot: () => [T('Заказ: свадьба', 'Замовлення: весілля', 'Job: wedding'), [f(T(`Свадьба_Ковальчуки (${r.int(400, 1200)} кадров)`, `Весілля_Ковальчуки (${r.int(400, 1200)} кадрів)`, `Kovalchuk_wedding (${r.int(400, 1200)} shots)`), 'archive', r.int(8000, 30000), { personal: true }), txt(T('заметка.txt', 'нотатка.txt', 'note.txt'), T('Невеста моргает на каждом третьем кадре. Отдать до пятницы, иначе — суд.', 'Наречена кліпає на кожному третьому кадрі. Віддати до пʼятниці, інакше — суд.', 'The bride blinks in every third frame. Deliver by Friday or it’s court.'))]],
    wildlife: () => [T('Природа', 'Природа', 'Wildlife'), ph(r.int(3, 8), 'DSC_', 'Telephoto', [sc('🦉', 'Сова на ветке', 'Сова на гілці', 'An owl on a branch'), sc('🦊', 'Лиса у дороги', 'Лисиця біля дороги', 'A fox by the road'), sc('🦢', 'Лебеди на озере', 'Лебеді на озері', 'Swans on a lake'), sc('🐿', 'Белка ворует орех', 'Білка краде горіх', 'A squirrel stealing a nut')], { real: 0.4 })],
    astro: () => [T('Астрофото', 'Астрофото', 'Astro'), [f(T('Луна 1/4000 с.CR2', 'Місяць 1/4000 с.CR2', 'Moon 1-4000s.CR2'), 'photo', 28, { scene: sc('🌕', 'Луна в кратерах', 'Місяць у кратерах', 'The Moon, every crater') }), f(T('Млечный путь (стек 60 кадров).tif', 'Чумацький шлях (стек 60 кадрів).tif', 'Milky Way (60‑frame stack).tif'), 'photo', 240, { scene: sc('🌌', 'Млечный путь над полем', 'Чумацький шлях над полем', 'The Milky Way over a field') }), txt(T('странное.txt', 'дивне.txt', 'weird.txt'), T('Кадр 41: яркая точка остановилась и повернула. Самолёты так не умеют.', 'Кадр 41: яскрава точка зупинилася й повернула. Літаки так не вміють.', 'Frame 41: a bright dot stopped and turned. Planes can’t do that.'))]],
    roofs: () => [T('Заказы', 'Замовлення', 'Jobs'), [vid(T('Осмотр крыши для страховой.MP4', 'Огляд даху для страхової.MP4', 'Roof survey for insurance.MP4'), r.int(400, 2000), `${r.int(3, 12)}:00`, { scene: sc('🏚', 'Крыша дачи с дырой', 'Дах дачі з діркою', 'A cottage roof with a hole') }), txt(T('Рыбные места.kml', 'Рибні місця.kml', 'Fishing spots.kml'), T('6 меток на водохранилище, у одной — «ТУТ СОМ, НИКОМУ».', '6 міток на водосховищі, біля однієї — «ТУТ СОМ, НІКОМУ».', '6 pins on the reservoir, one says “CATFISH HERE, TELL NO ONE”.'))]],
    incidents: () => [T('События', 'Події', 'Events'), r.sample(INCIDENTS, r.int(2, 4)).map((x) => vid(`EVENT_${year}${pad(r.int(101, 1231))}_${pad(r.int(0, 2359))}.MP4`, r.int(30, 120), '1:00', { dashcam: true, text: tx(x) }))],
    saves: () => [T('Сохранения', 'Збереження', 'Saves'), [f(T(`Сохранение: ${r.int(120, 900)} ч, ур. 99 — до сих пор пролог`, `Збереження: ${r.int(120, 900)} год, рів. 99 — досі пролог`, `Save: ${r.int(120, 900)} h, lvl 99 — still in the prologue`), 'game', 2), f(T('Сохранение «НЕ УДАЛЯТЬ — ПАПИНО»', 'Збереження «НЕ ВИДАЛЯТИ — ТАТОВЕ»', 'Save “DO NOT DELETE — DAD’S”'), 'game', 1, { personal: true })]],
    carmusic: () => [T('Музыка в машину', 'Музика в машину', 'Car music'), [f(T(`Музыка в машину 2009 (${r.int(200, 900)} треков)`, `Музика в машину 2009 (${r.int(200, 900)} треків)`, `Car music 2009 (${r.int(200, 900)} tracks)`), 'audio', r.int(1000, 6000)), f(T('Дискотека 90‑х (лучшее).mp3', 'Дискотека 90‑х (найкраще).mp3', '90s disco (best of).mp3'), 'audio', 120, { dur: '1:20:00' })]],
    portable: () => [T('Portable', 'Portable', 'Portable'), [f('Opera 9.64 Portable', 'exe', 12), f('Total Commander 7.04a', 'exe', 4), f('uTorrent 1.8.2', 'exe', 0.3), txt(T('ключи.txt', 'ключі.txt', 'keys.txt'), T('Серийники к программам 2008 года. Половина не работает.', 'Серійники до програм 2008 року. Половина не працює.', 'Serials for 2008 software. Half don’t work.'))]],
  };
}
const POOLS = {
  phone: ['shots', 'telegram', 'viber', 'voice', 'notes', 'passnote', 'calendar', 'health', 'apps', 'videos', 'selfies', 'family', 'calls', 'search', 'alarms', 'places', 'chats', 'downloads'],
  tablet: ['shots', 'telegram', 'notes', 'apps', 'videos', 'family', 'study', 'books', 'search', 'downloads', 'chats'],
  laptop: ['projects', 'torrents', 'backups', 'browser', 'study', 'edit', 'work', 'design', 'tax', 'pcgames', 'family', 'newfolder', 'mp3', 'memes', 'resume', 'freelance', 'wedding', 'nokia', 'search', 'downloads'],
  hdd: ['projects', 'torrents', 'backups', 'edit', 'work', 'design', 'pcgames', 'family', 'cctv', 'newfolder', 'mp3', 'memes', 'wedding', 'nokia', 'plex'],
  nas: ['backups', 'torrents', 'cctv', 'family', 'work', 'smarthome', 'plex'],
  office: ['officeMisc', 'cctv', 'work', 'tax', 'hr', 'contracts', 'newfolder'], tape: ['officeMisc'],
  usb: ['usbmix', 'family', 'projects', 'study', 'carmusic', 'portable', 'mp3', 'resume'], secure: ['usbmix', 'work', 'tax', 'contracts', 'hr'],
  card: ['raw', 'timelapse', 'family', 'wedshoot', 'wildlife', 'astro'], camera: ['raw', 'timelapse', 'family', 'wedshoot', 'wildlife', 'astro'], drone: ['aerial', 'timelapse', 'roofs'],
  console: ['clips', 'trophies', 'saves'], dashcam: ['parking', 'gps', 'incidents'],
  cd: ['oldcd'], dvd: ['tapes', 'oldcd'], gamecd: ['oldcd'], floppy: ['floppy'], cassette: ['tapes'], vhs: ['tapes'], ipod: ['pods', 'books'], dictaphone: ['voice'],
};
const COUNT = { phone: [4, 8], tablet: [3, 5], laptop: [4, 8], hdd: [3, 6], nas: [2, 5], office: [2, 4], usb: [1, 3], secure: [1, 3], card: [1, 3], camera: [1, 3], drone: [1, 2], console: [1, 3], dashcam: [1, 3] };

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
  if (res.retry) { delete data['loot_' + key]; return res; } // e.g. not enough money yet — the find stays
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
// ---------------------------------------------------------------- even darker cases and new ways to make money
// Creepy: the honest path (police, rescuers, family) pays and makes the news; deleting gives an unsettling epilogue.
// Money: legit buyers pay fair, the greedy path (fraud, leaks, blackmail) pays 2–4× but often ends in a fine.
const tri = (x) => T(x[0], x[1], x[2]);
const WHO_BIG = [['бизнесмена Гордиенко', 'бізнесмена Гордієнка', 'businessman Gordienko'], ['депутата Ляшенко', 'депутата Ляшенка', 'MP Lyashenko'], ['судью Коваля', 'суддю Коваля', 'Judge Koval'], ['владельца рынка Ткача', 'власника ринку Ткача', 'market owner Tkach']];
const WHO_MASK = [['депутат горсовета', 'депутат міськради', 'a city councillor'], ['главврач областной больницы', 'головлікар обласної лікарні', 'the regional hospital’s chief doctor'], ['известный телеведущий', 'відомий телеведучий', 'a famous TV host'], ['прокурор района', 'прокурор району', 'the district prosecutor']];
LOOT.push(
  { key: 'basement', kinds: ['nas', 'dashcam', 'card', 'hdd', 'camera'], p: 0.05, ic: '🕳', personal: true,
    roll: (r) => ({ days: r.int(20, 300), usd: Math.round(r.float(150, 500)), alive: r.chance(0.7) }),
    file: (d) => [T('камера_подвал_4.mp4', 'камера_підвал_4.mp4', 'cam_basement_4.mp4'), 'video', T(`Камера в подвале частного дома. На стене ${d.days} зарубок. Кто‑то в углу каждую ночь добавляет новую и смотрит прямо в объектив. В свойствах файла — адрес и дата: прошлый месяц.`, `Камера в підвалі приватного будинку. На стіні ${d.days} зарубок. Хтось у кутку щоночі додає нову й дивиться просто в обʼєктив. У властивостях файлу — адреса й дата: минулий місяць.`, `A camera in a private basement. ${d.days} tally marks on the wall. Every night someone in the corner adds one and stares straight into the lens. File properties: an address, dated last month.`)],
    acts: (d) => [['police', T(`🚓 Срочно в полицию · ~${fmt(d.usd)}`, `🚓 Терміново в поліцію · ~${fmt(d.usd)}`, `🚓 Police, now · ~${fmt(d.usd)}`)], ['del', T('🗑 Это постановка, удалить', '🗑 Це постановка, видалити', '🗑 It’s staged, delete')]],
    act: (it, d, a) => {
      if (a === 'del') return { msg: T('Удалено. Через неделю в новостях: «В подвале частного дома нашли…». Вы не стали дочитывать.', 'Видалено. За тиждень у новинах: «У підвалі приватного будинку знайшли…». Ви не стали дочитувати.', 'Deleted. A week later the news: “In the basement of a private house they found…”. You don’t read on.'), cls: '' };
      addXP(60); stat('goodDeeds');
      if (d.alive) { pay(d.usd, T('Вознаграждение: освобождён пленник', 'Винагорода: звільнено бранця', 'Reward: a captive freed')); notify('news', T('Из подвала освободили человека', 'З підвалу звільнили людину', 'A captive freed from a basement'), T(`Он провёл там ${d.days} дней. Полицию навела запись с проданного накопителя.`, `Він провів там ${d.days} днів. Поліцію навів запис із проданого накопичувача.`, `He spent ${d.days} days there. A recording on a resold drive led the police.`)); return ok(T(`По адресу из записи нашли живого человека. Вознаграждение +${fmt(d.usd)}`, `За адресою із запису знайшли живу людину. Винагорода +${fmt(d.usd)}`, `They found a living man at the address. Reward +${fmt(d.usd)}`)); }
      const u = pay(Math.round(d.usd * 0.3), T('Полиция: за информацию', 'Поліція: за інформацію', 'Police: for the tip'));
      return { msg: T(`Дом пустой. Зарубок на стене стало на одну больше — свежая. +${fmt(u)}`, `Будинок порожній. Зарубок на стіні стало на одну більше — свіжа. +${fmt(u)}`, `The house is empty. There is one more tally mark — fresh. +${fmt(u)}`), cls: '' };
    } },
  { key: 'doll', kinds: ['phone', 'camera', 'card', 'tablet'], p: 0.025, ic: '🪆',
    roll: (r) => ({ n: r.int(8, 30), usd: Math.round(r.float(40, 220)), back: r.chance(0.3) }),
    file: (d) => [T(`Кукла_ночь (${d.n} фото)`, `Лялька_ніч (${d.n} фото)`, `Doll_night (${d.n} photos)`), 'archive', T(`${d.n} ночных фото одной фарфоровой куклы. На каждом она в другой комнате и всё ближе к кровати. Последнее снято изнутри шкафа. Судя по переписке, хозяин продал квартиру за полцены и уехал.`, `${d.n} нічних фото однієї порцелянової ляльки. На кожному вона в іншій кімнаті й усе ближче до ліжка. Останнє знято зсередини шафи. Судячи з листування, власник продав квартиру за півціни й поїхав.`, `${d.n} night photos of one porcelain doll. In each it’s in another room, closer to the bed. The last one was taken from inside the wardrobe. The owner sold the flat at half price and left.`)],
    acts: (d) => [['sell', T(`🏚 Продать коллекционеру «проклятых вещей» · ${fmt(d.usd)}`, `🏚 Продати колекціонеру «проклятих речей» · ${fmt(d.usd)}`, `🏚 Sell to a “cursed things” collector · ${fmt(d.usd)}`)], ['del', T('🔥 Стереть всё', '🔥 Стерти все', '🔥 Wipe it all')]],
    act: (it, d, a) => {
      if (a === 'del') return { msg: T('Стёрто. Удалились все фото, кроме одного — нового, снятого сегодня ночью.', 'Стерто. Видалилися всі фото, крім одного — нового, знятого сьогодні вночі.', 'Wiped. Every photo is gone except one — a new one, taken tonight.'), cls: '' };
      pay(d.usd, T('Коллекционер «проклятых вещей»', 'Колекціонер «проклятих речей»', 'Cursed‑things collector'));
      return ok(T(`Коллекционер заплатил и попросил не звонить после полуночи. +${fmt(d.usd)}${d.back ? '. Утром на коврике у двери стояла маленькая фарфоровая туфелька.' : ''}`, `Колекціонер заплатив і попросив не дзвонити після опівночі. +${fmt(d.usd)}${d.back ? '. Вранці на килимку біля дверей стояла маленька порцелянова туфелька.' : ''}`, `The collector paid and asked you never to call after midnight. +${fmt(d.usd)}${d.back ? '. In the morning a tiny porcelain shoe sat on your doormat.' : ''}`));
    } },
  { key: 'obituary', kinds: ['laptop', 'office', 'usb', 'hdd'], p: 0.035, ic: '⚰️',
    roll: (r) => ({ who: r.pick(WHO_BIG), usd: Math.round(r.float(120, 600)), saved: r.chance(0.6) }),
    file: (d) => [T('Некрологи_заранее.docx', 'Некрологи_заздалегідь.docx', 'Obituaries_in_advance.docx'), 'doc', T(`12 некрологов, написанных заранее. Даты — в будущем. Первый — на ${tri(d.who)}, датирован завтрашним днём, с пометкой «согласовать с заказчиком».`, `12 некрологів, написаних заздалегідь. Дати — у майбутньому. Перший — на ${tri(d.who)}, датований завтрашнім днем, з позначкою «погодити із замовником».`, `12 obituaries written in advance, all dated in the future. The first is for ${tri(d.who)}, dated tomorrow, marked “confirm with the client”.`)],
    acts: (d) => [['warn', T(`📞 Предупредить его охрану · ~${fmt(d.usd)}`, `📞 Попередити його охорону · ~${fmt(d.usd)}`, `📞 Warn his security · ~${fmt(d.usd)}`)], ['press', T(`📰 Отдать журналистам · ${fmt(Math.round(d.usd * 0.5))}`, `📰 Віддати журналістам · ${fmt(Math.round(d.usd * 0.5))}`, `📰 Give it to journalists · ${fmt(Math.round(d.usd * 0.5))}`)], ['del', T('🗑 Не моё дело', '🗑 Не моя справа', '🗑 Not my business')]],
    act: (it, d, a) => {
      if (a === 'del') return { msg: T('Удалено. Через день вы видите этот некролог в новостях — слово в слово.', 'Видалено. Наступного дня ви бачите цей некролог у новинах — слово в слово.', 'Deleted. Next day you read that obituary in the news — word for word.'), cls: '' };
      if (a === 'press') { const u = pay(Math.round(d.usd * 0.5), T('Гонорар от редакции', 'Гонорар від редакції', 'Fee from the newsroom')); return ok(T(`Статья вышла с заголовком «Список смертников». +${fmt(u)}`, `Стаття вийшла із заголовком «Список смертників». +${fmt(u)}`, `The story ran as “The Death List”. +${fmt(u)}`)); }
      addXP(50); stat('goodDeeds');
      if (d.saved) { pay(d.usd, T('Благодарность за предупреждение', 'Подяка за попередження', 'Thanks for the warning')); notify('news', T('Покушение предотвращено', 'Замах відвернуто', 'An assassination foiled'), T(`Охрана задержала исполнителя у подъезда ${tri(d.who)}.`, `Охорона затримала виконавця біля підʼїзду ${tri(d.who)}.`, `Security caught the hitman outside ${tri(d.who)}’s door.`)); return ok(T(`Исполнителя взяли у подъезда. Вам перевели +${fmt(d.usd)} «за бдительность».`, `Виконавця взяли біля підʼїзду. Вам переказали +${fmt(d.usd)} «за пильність».`, `They caught the hitman at the door. You got +${fmt(d.usd)} “for vigilance”.`)); }
      const u = pay(Math.round(d.usd * 0.15), T('Полиция: файл как улика', 'Поліція: файл як доказ', 'Police: the file as evidence'));
      return { msg: T(`Охрана не поверила. Утром некролог вышел слово в слово. Полиция забрала файл как улику: +${fmt(u)}`, `Охорона не повірила. Вранці некролог вийшов слово в слово. Поліція забрала файл як доказ: +${fmt(u)}`, `Security didn’t believe you. The obituary ran next morning, word for word. Police took the file as evidence: +${fmt(u)}`), cls: '' };
    } },
  { key: 'organs', kinds: ['secure', 'office', 'laptop', 'hdd', 'usb'], p: 0.035, ic: '🫀', personal: true,
    roll: (r) => ({ usd: Math.round(r.float(300, 900)), dark: Math.round(r.float(1200, 3500)), caught: r.chance(0.6) }),
    file: () => [T('прайс_клиника_доноры.xlsx', 'прайс_клініка_донори.xlsx', 'clinic_donors_prices.xlsx'), 'doc', T('Прайс «чёрной трансплантологии»: почка, печень, «срочно». Графа «донор согласен?» везде пустая. Название частной клиники и номера машин перевозки.', 'Прайс «чорної трансплантології»: нирка, печінка, «терміново». Графа «донор згоден?» скрізь порожня. Назва приватної клініки й номери машин перевезення.', 'A black‑market transplant price list: kidney, liver, “urgent”. The “donor consent?” column is empty everywhere. A private clinic’s name and the plates of its vans.')],
    acts: (d) => [['police', T(`🚓 В полицию и прессу · ~${fmt(d.usd)}`, `🚓 У поліцію й пресу · ~${fmt(d.usd)}`, `🚓 Police and press · ~${fmt(d.usd)}`)], ['dark', T(`🕶 Продать «конкурентам» в Тени · ~${fmt(d.dark)}`, `🕶 Продати «конкурентам» у Тіні · ~${fmt(d.dark)}`, `🕶 Sell to “competitors” in the Shade · ~${fmt(d.dark)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'police') { pay(d.usd, T('Вознаграждение: накрыта подпольная клиника', 'Винагорода: накрито підпільну клініку', 'Reward: an illegal clinic busted')); addXP(70); stat('goodDeeds'); notify('news', T('Накрыли подпольную клинику', 'Накрили підпільну клініку', 'Illegal clinic busted'), T('Главврача задержали на выезде из города. В подвале клиники нашли трёх человек без документов.', 'Головлікаря затримали на виїзді з міста. У підвалі клініки знайшли трьох людей без документів.', 'The head doctor was caught leaving town. Three people without papers were found in the basement.')); return ok(T(`Клинику закрыли, людей спасли. +${fmt(d.usd)}`, `Клініку закрили, людей врятували. +${fmt(d.usd)}`, `The clinic is shut, people saved. +${fmt(d.usd)}`)); }
      if (d.caught) { const fine = Math.round(d.dark * 1.2); policeFine('leak', fine, T('торговля данными клиники', 'торгівля даними клініки', 'selling a clinic’s records')); return bad(T(`«Конкуренты» оказались оперативниками. Штраф ${fmt(fine)} и пометка в деле.`, `«Конкуренти» виявилися оперативниками. Штраф ${fmt(fine)} і позначка у справі.`, `The “competitors” were detectives. Fine ${fmt(fine)} and a mark on your record.`)); }
      earn(d.dark, 'other', T('Продажа данных в Тени', 'Продаж даних у Тіні', 'Data sold in the Shade')); return ok(T(`+${fmt(d.dark)}. Деньги пахнут хлоркой.`, `+${fmt(d.dark)}. Гроші пахнуть хлоркою.`, `+${fmt(d.dark)}. The money smells of bleach.`));
    } },
  { key: 'ritual', kinds: ['camera', 'card', 'phone', 'drone'], p: 0.02, ic: '🎭',
    roll: (r) => ({ who: r.pick(WHO_MASK), usd: Math.round(r.float(100, 400)), caught: r.chance(0.5) }),
    file: (d) => [T('заброшенная_больница_полночь.mp4', 'покинута_лікарня_північ.mp4', 'abandoned_hospital_midnight.mp4'), 'video', T(`Ночная съёмка в заброшенной больнице: люди в белых масках стоят кругом, кто‑то читает по бумажке. Когда маски снимают, один из них — ${tri(d.who)}. В конце камера падает, слышен крик, запись обрывается.`, `Нічна зйомка в покинутій лікарні: люди в білих масках стоять колом, хтось читає з папірця. Коли маски знімають, один із них — ${tri(d.who)}. Наприкінці камера падає, чути крик, запис уривається.`, `Night footage in an abandoned hospital: people in white masks stand in a circle while someone reads from a sheet. When the masks come off, one of them is ${tri(d.who)}. The camera falls, someone screams, the recording cuts.`)],
    acts: (d) => [['press', T(`📰 Журналистам · ${fmt(d.usd)}`, `📰 Журналістам · ${fmt(d.usd)}`, `📰 To journalists · ${fmt(d.usd)}`)], ['black', T(`💰 «Поговорить» с ним лично · ~${fmt(d.usd * 3)}`, `💰 «Поговорити» з ним особисто · ~${fmt(d.usd * 3)}`, `💰 Have a “talk” with him · ~${fmt(d.usd * 3)}`), 'red'], ['del', T('🗑 Удалить', '🗑 Видалити', '🗑 Delete')]],
    act: (it, d, a) => {
      if (a === 'del') return { msg: T('Удалено. Вечером под дверью — белая маска. Без записки.', 'Видалено. Увечері під дверима — біла маска. Без записки.', 'Deleted. That evening a white mask lies outside your door. No note.'), cls: '' };
      if (a === 'press') { pay(d.usd, T('Гонорар от редакции', 'Гонорар від редакції', 'Fee from the newsroom')); addXP(35); notify('news', T('Ночные ритуалы в заброшенной больнице', 'Нічні ритуали в покинутій лікарні', 'Night rituals in an abandoned hospital'), T(`На видео узнали: ${tri(d.who)}. Он пока не комментирует.`, `На відео впізнали: ${tri(d.who)}. Він поки не коментує.`, `People recognised ${tri(d.who)} on the video. No comment so far.`)); return ok(`+${fmt(d.usd)}`); }
      if (d.caught) { const fine = d.usd * 2; policeFine('fraud', fine, T('шантаж', 'шантаж', 'blackmail')); return bad(T(`На встречу он пришёл с полицией. Шантаж: штраф ${fmt(fine)}.`, `На зустріч він прийшов із поліцією. Шантаж: штраф ${fmt(fine)}.`, `He came to the meeting with the police. Blackmail: fine ${fmt(fine)}.`)); }
      pay(d.usd * 3, T('«Договорились»', '«Домовилися»', '“Settled”')); return ok(T(`Конверт и совет забыть дорогу к больнице. +${fmt(d.usd * 3)}`, `Конверт і порада забути дорогу до лікарні. +${fmt(d.usd * 3)}`, `An envelope and advice to forget the way to that hospital. +${fmt(d.usd * 3)}`));
    } },
  { key: 'ghostcall', kinds: ['phone'], p: 0.025, ic: '📞',
    roll: (r) => ({ n: r.int(12, 60), usd: Math.round(r.float(30, 150)) }),
    file: (d) => [T(`Голосовые_номер_отключён (${d.n})`, `Голосові_номер_вимкнено (${d.n})`, `Voicemails_disconnected_number (${d.n})`), 'music', T(`${d.n} голосовых с номера, который отключили в 1998 году. Женский голос каждый раз называет адрес — каждый раз ближе. В последнем сообщении — ваш адрес.`, `${d.n} голосових з номера, який вимкнули 1998 року. Жіночий голос щоразу називає адресу — щоразу ближче. В останньому повідомленні — ваша адреса.`, `${d.n} voicemails from a number disconnected in 1998. A woman’s voice names an address each time, each one closer. The last one is your address.`)],
    acts: (d) => [['pod', T(`🎧 Продать хоррор‑подкасту · ${fmt(d.usd)}`, `🎧 Продати хорор‑подкасту · ${fmt(d.usd)}`, `🎧 Sell to a horror podcast · ${fmt(d.usd)}`)], ['del', T('🗑 Удалить и заблокировать номер', '🗑 Видалити й заблокувати номер', '🗑 Delete and block the number')]],
    act: (it, d, a) => (a === 'del' ? { msg: T('Номер заблокирован. Ночью телефон всё равно завибрировал: «1 пропущенный».', 'Номер заблоковано. Уночі телефон однаково завібрував: «1 пропущений».', 'Number blocked. At night the phone buzzed anyway: “1 missed call”.'), cls: '' } : (pay(d.usd, T('Хоррор‑подкаст купил записи', 'Хорор‑подкаст купив записи', 'A horror podcast bought the recordings')), ok(T(`Подкаст купил записи. Ведущий потом написал: «Нам тоже позвонили». +${fmt(d.usd)}`, `Подкаст купив записи. Ведучий потім написав: «Нам теж зателефонували». +${fmt(d.usd)}`, `The podcast bought them. The host wrote later: “They called us too.” +${fmt(d.usd)}`)))) },
  { key: 'lastvideo', kinds: ['camera', 'drone', 'card', 'phone'], p: 0.025, ic: '🏔', personal: true,
    roll: (r) => ({ usd: Math.round(r.float(120, 450)), tv: Math.round(r.float(300, 900)) }),
    file: () => [T('последняя_запись_перевал.mp4', 'останній_запис_перевал.mp4', 'last_recording_pass.mp4'), 'video', T('Экшн‑камера группы туристов, пропавших в горах два года назад. Последние минуты: палатка разрезана изнутри, все бегут в темноту без обуви. Что‑то светится за деревьями. Координаты в метаданных точные.', 'Екшн‑камера групи туристів, що зникли в горах два роки тому. Останні хвилини: намет розрізаний зсередини, усі біжать у темряву без взуття. Щось світиться за деревами. Координати в метаданих точні.', 'The action cam of hikers who vanished in the mountains two years ago. The last minutes: the tent is cut open from inside, everyone runs barefoot into the dark. Something glows behind the trees. Exact coordinates in the metadata.')],
    acts: (d) => [['rescue', T(`⛑ Спасателям и родным · ~${fmt(d.usd)}`, `⛑ Рятувальникам і рідним · ~${fmt(d.usd)}`, `⛑ To rescuers and families · ~${fmt(d.usd)}`)], ['tv', T(`📺 Продать ТВ‑каналу · ${fmt(d.tv)}`, `📺 Продати ТБ‑каналу · ${fmt(d.tv)}`, `📺 Sell to a TV channel · ${fmt(d.tv)}`)]],
    act: (it, d, a) => {
      if (a === 'tv') { earn(d.tv, 'other', T('ТВ‑канал купил запись', 'ТБ‑канал купив запис', 'A TV channel bought the footage')); return ok(T(`Запись показали в прайм‑тайм. Родные узнали обо всём из телевизора… +${fmt(d.tv)}`, `Запис показали в прайм‑тайм. Рідні дізналися про все з телевізора… +${fmt(d.tv)}`, `It aired in prime time. The families learned everything from TV… +${fmt(d.tv)}`)); }
      pay(d.usd, T('Благодарность от родных пропавших', 'Подяка від рідних зниклих', 'Thanks from the families')); addXP(60); stat('goodDeeds');
      notify('news', T('Найден лагерь пропавших туристов', 'Знайдено табір зниклих туристів', 'Missing hikers’ camp found'), T('Спасатели вышли на место по координатам с проданной камеры. Причину гибели установить не удалось.', 'Рятувальники вийшли на місце за координатами з проданої камери. Причину загибелі встановити не вдалося.', 'Rescuers reached the spot using a resold camera’s coordinates. The cause of death remains unknown.'));
      return ok(T(`По координатам нашли лагерь. Родные смогли попрощаться и прислали благодарность: +${fmt(d.usd)}`, `За координатами знайшли табір. Рідні змогли попрощатися й надіслали подяку: +${fmt(d.usd)}`, `The camp was found. The families could say goodbye and sent their thanks: +${fmt(d.usd)}`));
    } },
  { key: 'cult', kinds: ['laptop', 'usb', 'secure', 'hdd', 'phone'], p: 0.025, ic: '🔺',
    roll: (r) => ({ usd: Math.round(r.float(100, 350)), coins: Math.round(r.float(800, 3000)), hunted: r.chance(0.45) }),
    file: () => [T('пожертвования_Орден_Рассвета.xlsx', 'пожертви_Орден_Світанку.xlsx', 'donations_Order_of_Dawn.xlsx'), 'doc', T('Бухгалтерия секты «Орден Рассвета»: квартиры, «пожертвованные» пенсионерами, и ключ от криптокошелька, куда уходили все деньги. На полях: «Брат №7 слишком много спрашивает».', 'Бухгалтерія секти «Орден Світанку»: квартири, «пожертвувані» пенсіонерами, і ключ від криптогаманця, куди йшли всі гроші. На полях: «Брат №7 забагато питає».', 'The books of the “Order of Dawn” cult: flats “donated” by pensioners and the key to the crypto wallet where all the money went. In the margin: “Brother #7 asks too many questions.”')],
    acts: (d) => [['police', T(`🚓 Сдать полиции · ~${fmt(d.usd)}`, `🚓 Здати поліції · ~${fmt(d.usd)}`, `🚓 Hand to the police · ~${fmt(d.usd)}`)], ['take', T(`🔑 Перевести крипту себе · ~${fmt(d.coins)}`, `🔑 Перевести крипту собі · ~${fmt(d.coins)}`, `🔑 Move the crypto to yourself · ~${fmt(d.coins)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'police') { pay(d.usd, T('Вознаграждение: секта раскрыта', 'Винагорода: секту викрито', 'Reward: a cult exposed')); addXP(50); stat('goodDeeds'); notify('news', T('Пенсионерам вернут квартиры', 'Пенсіонерам повернуть квартири', 'Pensioners will get their flats back'), T('Лидера «Ордена Рассвета» задержали в аэропорту.', 'Лідера «Ордену Світанку» затримали в аеропорту.', 'The “Order of Dawn” leader was arrested at the airport.')); return ok(`+${fmt(d.usd)}`); }
      if (d.hunted) { const loss = Math.round(Math.min(Math.max(G.s.money, 0), d.coins * 0.3) + 30); charge(loss, 'other', T('«Пожертвование» Ордену', '«Пожертва» Ордену', 'A “donation” to the Order')); return bad(T(`Кошелёк оказался пуст, а через час в дверь позвонили люди в белом. Пришлось «пожертвовать» ${fmt(loss)}.`, `Гаманець виявився порожнім, а за годину в двері подзвонили люди в білому. Довелося «пожертвувати» ${fmt(loss)}.`, `The wallet was empty, and an hour later people in white rang your bell. You “donated” ${fmt(loss)}.`)); }
      earn(d.coins, 'other', T('Крипта секты', 'Крипта секти', 'The cult’s crypto')); return ok(T(`+${fmt(d.coins)}. Теперь вы — Брат №8.`, `+${fmt(d.coins)}. Тепер ви — Брат №8.`, `+${fmt(d.coins)}. Now you are Brother #8.`));
    } },
  { key: 'ratcam', kinds: ['laptop', 'phone', 'tablet'], p: 0.025, ic: '📸', personal: true,
    roll: (r) => ({ usd: Math.round(r.float(60, 250)), cams: r.int(20, 140) }),
    file: () => [T('rat_log_webcam.txt', 'rat_log_webcam.txt', 'rat_log_webcam.txt'), 'text', T('Лог трояна удалённого доступа: кто‑то месяцами включал камеру этого ноутбука, пока хозяйка спала. В логе — IP и ник наблюдателя.', 'Лог трояна віддаленого доступу: хтось місяцями вмикав камеру цього ноутбука, поки господиня спала. У лозі — IP і нік спостерігача.', 'A remote‑access trojan log: for months someone turned on this laptop’s camera while its owner slept. The log has the watcher’s IP and nickname.')],
    acts: (d) => [['cyber', T(`🛡 В киберполицию · ~${fmt(d.usd)}`, `🛡 У кіберполіцію · ~${fmt(d.usd)}`, `🛡 To the cyber police · ~${fmt(d.usd)}`)], ['del', T('🗑 Удалить', '🗑 Видалити', '🗑 Delete')]],
    act: (it, d, a) => (a === 'del' ? { msg: T('Удалено. Вы на всякий случай заклеили камеру на своём ноутбуке.', 'Видалено. Ви про всяк випадок заклеїли камеру на своєму ноутбуці.', 'Deleted. Just in case, you tape over your own webcam.'), cls: '' } : (pay(d.usd, T('Киберполиция: вознаграждение', 'Кіберполіція: винагорода', 'Cyber police reward')), addXP(40), stat('goodDeeds'), ok(T(`Наблюдателя задержали: у него были «трансляции» с ${d.cams} чужих камер. +${fmt(d.usd)}`, `Спостерігача затримали: у нього були «трансляції» з ${d.cams} чужих камер. +${fmt(d.usd)}`, `The watcher was arrested — he had “streams” from ${d.cams} other cameras. +${fmt(d.usd)}`)))) },
  { key: 'sos', kinds: ['phone'], p: 0.02, ic: '🆘', personal: true,
    roll: (r) => ({ n: r.int(40, 300), usd: Math.round(r.float(150, 600)), yrs: r.int(1, 4) }),
    file: (d) => [T(`Неотправленные (${d.n}).sms`, `Ненадіслані (${d.n}).sms`, `Unsent (${d.n}).sms`), 'text', T(`${d.n} неотправленных SMS: «помогите», «я в багажнике», «мы едем за город», «он остановился». Последняя геометка — ${d.yrs} г. назад, лесополоса за городом. Дело, судя по новостям, так и не раскрыли.`, `${d.n} ненадісланих SMS: «допоможіть», «я в багажнику», «ми їдемо за місто», «він зупинився». Остання геомітка — ${d.yrs} р. тому, лісосмуга за містом. Справу, судячи з новин, так і не розкрили.`, `${d.n} unsent texts: “help”, “I’m in the trunk”, “we’re leaving town”, “he stopped”. The last geotag is ${d.yrs} yr old — a tree line outside town. The case, the news says, was never solved.`)],
    acts: (d) => [['police', T(`🚓 Отдать следователю · ~${fmt(d.usd)}`, `🚓 Віддати слідчому · ~${fmt(d.usd)}`, `🚓 Give it to a detective · ~${fmt(d.usd)}`)], ['del', T('🗑 Удалить', '🗑 Видалити', '🗑 Delete')]],
    act: (it, d, a) => {
      if (a === 'del') return { msg: T('Удалено. Но строчка «он остановился» ещё долго всплывает перед сном.', 'Видалено. Але рядок «він зупинився» ще довго спливає перед сном.', 'Deleted. But “he stopped” keeps coming back at bedtime.'), cls: '' };
      pay(d.usd, T('Вознаграждение: раскрыто старое дело', 'Винагорода: розкрито стару справу', 'Reward: a cold case solved')); addXP(70); stat('goodDeeds');
      notify('news', T(`Раскрыто дело ${d.yrs}-летней давности`, `Розкрито справу ${d.yrs}-річної давності`, `A ${d.yrs}-year‑old case solved`), T('Подозреваемого задержали по геометкам из SMS на перепроданном телефоне.', 'Підозрюваного затримали за геомітками з SMS на перепроданому телефоні.', 'A suspect was arrested using geotags from texts on a resold phone.'));
      return ok(T(`Подозреваемого взяли. Семья наконец узнала правду. +${fmt(d.usd)}`, `Підозрюваного взяли. Родина нарешті дізналася правду. +${fmt(d.usd)}`, `The suspect is caught. The family finally knows. +${fmt(d.usd)}`));
    } },
  { key: 'lookalike', kinds: ['camera', 'card', 'phone', 'hdd'], p: 0.018, ic: '👥',
    roll: (r) => ({ n: r.int(20, 90), usd: Math.round(r.float(40, 200)) }),
    file: (d) => [T(`ДВОЙНИК (${d.n} фото)`, `ДВІЙНИК (${d.n} фото)`, `DOUBLE (${d.n} photos)`), 'archive', T(`${d.n} фото человека, который выглядит точь‑в‑точь как вы. Он стоит в местах, где вы никогда не были. Даты в EXIF — следующая неделя.`, `${d.n} фото людини, яка виглядає точнісінько як ви. Вона стоїть у місцях, де ви ніколи не були. Дати в EXIF — наступний тиждень.`, `${d.n} photos of someone who looks exactly like you, standing in places you have never been. The EXIF dates are next week.`)],
    acts: (d) => [['blog', T(`📼 Продать блогеру‑мистику · ${fmt(d.usd)}`, `📼 Продати блогеру‑містику · ${fmt(d.usd)}`, `📼 Sell to a mystery blogger · ${fmt(d.usd)}`)], ['del', T('🗑 Стереть', '🗑 Стерти', '🗑 Wipe')]],
    act: (it, d, a) => (a === 'del' ? { msg: T('Стёрто. В отражении витрины вы на секунду задержались дольше, чем надо.', 'Стерто. У відображенні вітрини ви на секунду затрималися довше, ніж треба.', 'Wiped. Your reflection in a shop window lingers a second too long.'), cls: '' } : (pay(d.usd, T('Блогер‑мистик купил фото', 'Блогер‑містик купив фото', 'A mystery blogger bought the photos')), ok(T(`Блогер в восторге. Вечером бариста спросил: «Вы же уже заходили сегодня?» +${fmt(d.usd)}`, `Блогер у захваті. Увечері бариста спитав: «Ви ж уже заходили сьогодні?» +${fmt(d.usd)}`, `The blogger loves it. That evening the barista asks: “Weren’t you in here earlier?” +${fmt(d.usd)}`)))) },
  // ---- money
  { key: 'btcwallet', kinds: ['hdd', 'laptop', 'usb', 'nas'], p: 0.035, ic: '₿',
    roll: (r) => { const x = r.f(); return { res: x < 0.1 ? 'big' : x < 0.62 ? 'small' : 'none', usd: x < 0.1 ? Math.round(r.float(1500, 6000)) : Math.round(r.float(40, 300)), sell: Math.round(r.float(20, 80)) }; },
    file: () => [T('wallet.dat (2011)', 'wallet.dat (2011)', 'wallet.dat (2011)'), 'archive', T('Биткоин‑кошелёк 2011 года, зашифрован. Рядом файл «пароль_подсказка.txt»: «как кота звали + год».', 'Біткоїн‑гаманець 2011 року, зашифрований. Поруч файл «пароль_підказка.txt»: «як кота звали + рік».', 'A 2011 Bitcoin wallet, encrypted. Next to it, “password_hint.txt”: “the cat’s name + year”.')],
    acts: (d) => [['brute', T(`🧮 Подобрать пароль (аренда GPU ${fmt(30)})`, `🧮 Підібрати пароль (оренда GPU ${fmt(30)})`, `🧮 Crack the password (GPU rent ${fmt(30)})`)], ['sell', T(`💽 Продать файл охотникам за кошельками · ${fmt(d.sell)}`, `💽 Продати файл мисливцям за гаманцями · ${fmt(d.sell)}`, `💽 Sell the file to wallet hunters · ${fmt(d.sell)}`)]],
    act: (it, d, a) => {
      if (a === 'sell') { earn(d.sell, 'sale', T('Продажа wallet.dat', 'Продаж wallet.dat', 'Sold a wallet.dat')); return ok(`+${fmt(d.sell)}`); }
      charge(30, 'other', T('Аренда GPU для перебора', 'Оренда GPU для перебору', 'GPU rent for cracking'));
      if (d.res === 'none') return bad(T(`Перебор ничего не дал: кота, похоже, звали очень длинно. −${fmt(30)}`, `Перебір нічого не дав: кота, схоже, звали дуже довго. −${fmt(30)}`, `Nothing found — the cat had a very long name. −${fmt(30)}`));
      earn(d.usd, 'other', T('Старый биткоин‑кошелёк', 'Старий біткоїн‑гаманець', 'An old Bitcoin wallet'));
      return ok(d.res === 'big' ? T(`Пароль «Barsik2011» подобран за 41 минуту. На кошельке забытые монеты: +${fmt(d.usd)} 🤯`, `Пароль «Barsik2011» підібрано за 41 хвилину. На гаманці забуті монети: +${fmt(d.usd)} 🤯`, `“Barsik2011” cracked in 41 minutes. Forgotten coins inside: +${fmt(d.usd)} 🤯`) : T(`Пароль подобран. На кошельке немного сдачи с 2011‑го: +${fmt(d.usd)}`, `Пароль підібрано. На гаманці трохи решти з 2011‑го: +${fmt(d.usd)}`, `Cracked. A little change left from 2011: +${fmt(d.usd)}`));
    } },
  { key: 'pixelart', kinds: ['laptop', 'hdd', 'usb', 'tablet'], p: 0.035, ic: '🖼',
    roll: (r) => ({ artist: r.pick(['Pixel Hamster', 'NeonBabka', 'Kyiv8bit', 'Glitch Monk']), usd: Math.round(r.float(200, 900)), fake: r.chance(0.3) }),
    file: (d) => [T(`исходники_${d.artist}_2014.psd`, `сирці_${d.artist}_2014.psd`, `${d.artist}_sources_2014.psd`), 'archive', T(`Исходники ранних работ художника ${d.artist}, чьи NFT сейчас уходят за тысячи. Подпись в слоях выглядит настоящей.`, `Сирці ранніх робіт художника ${d.artist}, чиї NFT зараз ідуть за тисячі. Підпис у шарах виглядає справжнім.`, `Early source files by ${d.artist}, whose NFTs now sell for thousands. The signature in the layers looks real.`)],
    acts: (d) => [['auction', T(`🔨 Выставить на аукцион · ~${fmt(d.usd)}`, `🔨 Виставити на аукціон · ~${fmt(d.usd)}`, `🔨 Put up for auction · ~${fmt(d.usd)}`)], ['return', T(`🎨 Вернуть художнику · ${fmt(Math.round(d.usd * 0.4))}`, `🎨 Повернути художнику · ${fmt(Math.round(d.usd * 0.4))}`, `🎨 Return to the artist · ${fmt(Math.round(d.usd * 0.4))}`)]],
    act: (it, d, a) => {
      if (a === 'return') { const u = pay(Math.round(d.usd * 0.4), T(`${d.artist}: благодарность`, `${d.artist}: подяка`, `${d.artist}: thank‑you`)); addXP(30); addReview(5, T('Вернул мои ранние работы, огромное спасибо! Подписанный принт уже едет 🎨', 'Повернув мої ранні роботи, величезне дякую! Підписаний принт уже їде 🎨', 'Returned my early work, huge thanks! A signed print is on its way 🎨')); return ok(T(`${d.artist} прислал благодарность и подписанный принт. +${fmt(u)}`, `${d.artist} надіслав подяку й підписаний принт. +${fmt(u)}`, `${d.artist} sent thanks and a signed print. +${fmt(u)}`)); }
      if (d.fake) { const u = Math.round(d.usd * 0.1); earn(u, 'sale', T('Аукцион: работы подражателя', 'Аукціон: роботи наслідувача', 'Auction: an imitator’s work')); return bad(T(`Эксперты аукциона: это работы подражателя. Ушло за копейки: +${fmt(u)}`, `Експерти аукціону: це роботи наслідувача. Пішло за копійки: +${fmt(u)}`, `The auction’s experts: an imitator’s work. Sold for pennies: +${fmt(u)}`)); }
      earn(d.usd, 'sale', T(`Аукцион: ранние работы ${d.artist}`, `Аукціон: ранні роботи ${d.artist}`, `Auction: early ${d.artist}`)); return ok(T(`Торги шли до последней секунды. +${fmt(d.usd)}`, `Торги йшли до останньої секунди. +${fmt(d.usd)}`, `Bidding went to the last second. +${fmt(d.usd)}`));
    } },
  { key: 'royalty', kinds: ['laptop', 'office', 'hdd', 'usb'], p: 0.035, ic: '🎼',
    roll: (r) => ({ usd: Math.round(r.float(150, 500)), fraud: Math.round(r.float(600, 2000)), caught: r.chance(0.55) }),
    file: () => [T('Договор_роялти_хит_1996.pdf', 'Договір_роялті_хіт_1996.pdf', 'Royalty_contract_hit_1996.pdf'), 'doc', T('Договор на отчисления за хит 90‑х и логин в кабинет правообладателя. Автор умер, наследники, похоже, ничего не знают — на счету копятся деньги.', 'Договір на відрахування за хіт 90‑х і логін у кабінет правовласника. Автор помер, спадкоємці, схоже, нічого не знають — на рахунку збираються гроші.', 'A royalty contract for a 90s hit and the login to the rights holder’s account. The author died; the heirs seem to know nothing while money piles up.')],
    acts: (d) => [['heirs', T(`👪 Найти наследников · ~${fmt(d.usd)}`, `👪 Знайти спадкоємців · ~${fmt(d.usd)}`, `👪 Find the heirs · ~${fmt(d.usd)}`)], ['fraud', T(`✍️ Переоформить на себя · ~${fmt(d.fraud)}`, `✍️ Переоформити на себе · ~${fmt(d.fraud)}`, `✍️ Sign it over to yourself · ~${fmt(d.fraud)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'heirs') { pay(d.usd, T('Наследники: процент за находку', 'Спадкоємці: відсоток за знахідку', 'Heirs: a finder’s fee')); addXP(40); stat('goodDeeds'); addReview(5, T('Мы и не знали, что папины песни до сих пор приносят деньги. Спасибо!', 'Ми й не знали, що татові пісні досі приносять гроші. Дякуємо!', 'We never knew Dad’s songs still earned money. Thank you!')); return ok(T(`Дочь автора плакала в трубку. Процент за находку: +${fmt(d.usd)}`, `Донька автора плакала в слухавку. Відсоток за знахідку: +${fmt(d.usd)}`, `The author’s daughter cried on the phone. Finder’s fee: +${fmt(d.usd)}`)); }
      if (d.caught) { const fine = Math.round(d.fraud * 0.8); policeFine('fraud', fine, T('подделка документов на права', 'підробка документів на права', 'forged rights documents')); return bad(T(`Юристы лейбла заметили подделку. Штраф ${fmt(fine)}.`, `Юристи лейбла помітили підробку. Штраф ${fmt(fine)}.`, `The label’s lawyers spotted the forgery. Fine ${fmt(fine)}.`)); }
      earn(d.fraud, 'other', T('Роялти за чужой хит', 'Роялті за чужий хіт', 'Royalties for someone else’s hit')); return ok(T(`Деньги пришли. По радио как раз играет «ваша» песня. +${fmt(d.fraud)}`, `Гроші прийшли. По радіо якраз грає «ваша» пісня. +${fmt(d.fraud)}`, `The money arrived. “Your” song is on the radio. +${fmt(d.fraud)}`));
    } },
  { key: 'treasure', kinds: ['phone', 'laptop', 'usb', 'card'], p: 0.025, ic: '🗺',
    roll: (r) => { const x = r.f(); return { res: x < 0.4 ? 'coins' : x < 0.75 ? 'empty' : 'cops', usd: Math.round(r.float(150, 900)), sell: Math.round(r.float(30, 120)) }; },
    file: () => [T('карта_деда_мельница.jpg', 'мапа_діда_млин.jpg', 'grandpa_map_mill.jpg'), 'photo', T('Скан самодельной карты: «у старой мельницы, 40 шагов от дуба, под камнем». На обороте: «1943. Не для чужих».', 'Скан саморобної мапи: «біля старого млина, 40 кроків від дуба, під каменем». На звороті: «1943. Не для чужих».', 'A scanned hand‑drawn map: “by the old mill, 40 steps from the oak, under the stone”. On the back: “1943. Not for strangers.”')],
    acts: (d) => [['dig', T('⛏ Поехать копать', '⛏ Поїхати копати', '⛏ Go and dig')], ['sell', T(`🗺 Продать на форуме копателей · ${fmt(d.sell)}`, `🗺 Продати на форумі копачів · ${fmt(d.sell)}`, `🗺 Sell on a diggers’ forum · ${fmt(d.sell)}`)]],
    act: (it, d, a) => {
      if (a === 'sell') { earn(d.sell, 'sale', T('Карта клада', 'Мапа скарбу', 'Treasure map')); return ok(`+${fmt(d.sell)}`); }
      if (d.res === 'coins') { earn(d.usd, 'other', T('Клад у старой мельницы', 'Скарб біля старого млина', 'A hoard by the old mill')); addXP(30); return ok(T(`Под камнем — жестяная банка: старые монеты и серебряный портсигар. +${fmt(d.usd)}`, `Під каменем — бляшанка: старі монети й срібний портсигар. +${fmt(d.usd)}`, `Under the stone, a tin can: old coins and a silver cigarette case. +${fmt(d.usd)}`)); }
      if (d.res === 'empty') return { msg: T('Только корни и ржавая каска. Кто‑то копал здесь до вас — и, кажется, недавно.', 'Тільки коріння й іржава каска. Хтось копав тут до вас — і, здається, нещодавно.', 'Only roots and a rusty helmet. Someone dug here before you — recently.'), cls: '' };
      const fine = Math.round(d.usd * 0.3 + 40); policeFine('wallet', fine, T('незаконные раскопки', 'незаконні розкопки', 'illegal digging'));
      return bad(T(`Мельница оказалась памятником. Патруль, протокол «чёрного копателя», штраф ${fmt(fine)}.`, `Млин виявився памʼяткою. Патруль, протокол «чорного копача», штраф ${fmt(fine)}.`, `The mill is a protected monument. A patrol, an illegal‑digging report, fine ${fmt(fine)}.`));
    } },
  { key: 'insurance', kinds: ['dashcam', 'card', 'phone'], p: 0.03, ic: '🚗',
    roll: (r) => ({ usd: Math.round(r.float(120, 450)), caught: r.chance(0.4) }),
    file: () => [T('подстава_ДТП_репетиция.mp4', 'підстава_ДТП_репетиція.mp4', 'staged_crash_rehearsal.mp4'), 'video', T('Регистратор «автоподставщиков»: репетиция аварии, разговор «бьём в правый бок, страховая заплатит» и номера трёх машин.', 'Реєстратор «автопідставників»: репетиція аварії, розмова «бʼємо в правий бік, страхова заплатить» і номери трьох машин.', 'A crash‑for‑cash gang’s dashcam: a rehearsed collision, “hit the right side, insurance will pay” and three plates.')],
    acts: (d) => [['insurer', T(`🧾 Отправить страховой · ~${fmt(d.usd)}`, `🧾 Надіслати страховій · ~${fmt(d.usd)}`, `🧾 Send to the insurer · ~${fmt(d.usd)}`)], ['black', T(`💰 Потребовать долю · ~${fmt(Math.round(d.usd * 2.5))}`, `💰 Вимагати частку · ~${fmt(Math.round(d.usd * 2.5))}`, `💰 Demand a cut · ~${fmt(Math.round(d.usd * 2.5))}`), 'red']],
    act: (it, d, a) => {
      if (a === 'insurer') { pay(d.usd, T('Страховая: за наводку', 'Страхова: за наводку', 'Insurer: for the tip')); addXP(35); stat('goodDeeds'); return ok(T(`Страховая отказала банде в выплатах и заплатила вам за наводку: +${fmt(d.usd)}`, `Страхова відмовила банді у виплатах і заплатила вам за наводку: +${fmt(d.usd)}`, `The insurer refused the gang’s claims and paid you for the tip: +${fmt(d.usd)}`)); }
      const b = Math.round(d.usd * 2.5);
      if (d.caught) { const fine = b; policeFine('fraud', fine, T('соучастие в страховом мошенничестве', 'співучасть у страховому шахрайстві', 'complicity in insurance fraud')); return bad(T(`Подставщики сдали вас первыми. Штраф ${fmt(fine)} и пометка в деле.`, `Підставники здали вас першими. Штраф ${fmt(fine)} і позначка у справі.`, `The gang gave you up first. Fine ${fmt(fine)} and a mark on your record.`)); }
      earn(b, 'other', T('Доля «автоподставщиков»', 'Частка «автопідставників»', 'A cut from the crash gang')); return ok(`+${fmt(b)}`);
    } },
  { key: 'lottery', kinds: ['laptop', 'usb', 'hdd'], p: 0.04, ic: '🎰',
    roll: (r) => { const x = r.f(); return { res: x < 0.05 ? 'big' : x < 0.4 ? 'small' : 'none', usd: x < 0.05 ? Math.round(r.float(1000, 4000)) : Math.round(r.float(60, 300)), sell: Math.round(r.float(40, 150)) }; },
    file: () => [T('алгоритм_лотерея_v3.py', 'алгоритм_лотерея_v3.py', 'lottery_algorithm_v3.py'), 'text', T('Скрипт какого‑то программиста «предсказывает» номера городской лотереи по прошлым тиражам. В комментариях: «сработало 2 раза из 9. Не трогать до пятницы».', 'Скрипт якогось програміста «передбачає» номери міської лотереї за минулими тиражами. У коментарях: «спрацювало 2 рази з 9. Не чіпати до пʼятниці».', 'Some programmer’s script “predicts” the city lottery from past draws. Comment: “worked 2 times out of 9. Don’t touch until Friday.”')],
    acts: (d) => [['play', T(`🎟 Сыграть по алгоритму · ставка ${fmt(25)}`, `🎟 Зіграти за алгоритмом · ставка ${fmt(25)}`, `🎟 Play by the algorithm · stake ${fmt(25)}`)], ['sell', T(`💾 Продать скрипт · ${fmt(d.sell)}`, `💾 Продати скрипт · ${fmt(d.sell)}`, `💾 Sell the script · ${fmt(d.sell)}`)]],
    act: (it, d, a) => {
      if (a === 'sell') { earn(d.sell, 'sale', T('Продажа «лотерейного» скрипта', 'Продаж «лотерейного» скрипта', 'Sold a “lottery” script')); return ok(`+${fmt(d.sell)}`); }
      charge(25, 'other', T('Лотерея: ставка', 'Лотерея: ставка', 'Lottery stake'));
      if (d.res === 'none') return bad(T(`Совпало 2 числа из 6. Похоже, это был 7‑й раз из 9. −${fmt(25)}`, `Збіглося 2 числа з 6. Схоже, це був 7‑й раз із 9. −${fmt(25)}`, `2 of 6 matched — this was one of the 7 failures. −${fmt(25)}`));
      earn(d.usd, 'other', T('Выигрыш в лотерею', 'Виграш у лотерею', 'Lottery win'));
      return ok(d.res === 'big' ? T(`Совпали 5 из 6! Выигрыш +${fmt(d.usd)} 🎉`, `Збіглися 5 із 6! Виграш +${fmt(d.usd)} 🎉`, `5 of 6! You won +${fmt(d.usd)} 🎉`) : T(`Совпали 4 числа. Выигрыш +${fmt(d.usd)}`, `Збіглися 4 числа. Виграш +${fmt(d.usd)}`, `4 numbers matched. You won +${fmt(d.usd)}`));
    } },
  { key: 'voicebank', kinds: ['laptop', 'hdd', 'usb', 'nas'], p: 0.035, ic: '🗣',
    roll: (r) => ({ h: r.int(6, 40), usd: Math.round(r.float(150, 600)), deep: Math.round(r.float(500, 1500)), caught: r.chance(0.5) }),
    file: (d) => [T(`голос_диктора_${d.h}ч.wav`, `голос_диктора_${d.h}год.wav`, `announcer_voice_${d.h}h.wav`), 'music', T(`${d.h} часов чистых записей известного диктора. Хватит, чтобы научить нейросеть говорить его голосом.`, `${d.h} годин чистих записів відомого диктора. Вистачить, щоб навчити нейромережу говорити його голосом.`, `${d.h} hours of clean recordings of a famous announcer — enough to teach an AI his voice.`)],
    acts: (d) => [['return', T(`🎙 Вернуть диктору · ${fmt(Math.round(d.usd * 0.4))}`, `🎙 Повернути диктору · ${fmt(Math.round(d.usd * 0.4))}`, `🎙 Return to him · ${fmt(Math.round(d.usd * 0.4))}`)], ['ai', T(`🤖 Продать стартапу озвучки · ${fmt(d.usd)}`, `🤖 Продати стартапу озвучення · ${fmt(d.usd)}`, `🤖 Sell to a voice‑AI startup · ${fmt(d.usd)}`)], ['fake', T(`📞 Дипфейк‑звонок в банк · ~${fmt(d.deep)}`, `📞 Діпфейк‑дзвінок у банк · ~${fmt(d.deep)}`, `📞 Deepfake call to a bank · ~${fmt(d.deep)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'return') { const u = pay(Math.round(d.usd * 0.4), T('Диктор: благодарность', 'Диктор: подяка', 'The announcer’s thanks')); addXP(30); addReview(5, T('Вернул мои записи, пока их не украли нейросети. Человечище!', 'Повернув мої записи, поки їх не вкрали нейромережі. Людина!', 'Returned my recordings before an AI stole them. A real one!')); return ok(T(`Диктор записал вам голосовое «спасибо» тем самым голосом. +${fmt(u)}`, `Диктор записав вам голосове «дякую» тим самим голосом. +${fmt(u)}`, `He sent you a voice “thank you” in that famous voice. +${fmt(u)}`)); }
      if (a === 'ai') { earn(d.usd, 'sale', T('Продажа датасета голоса', 'Продаж датасету голосу', 'Sold a voice dataset')); return ok(T(`Стартап купил датасет. Через месяц этот голос читает рекламу шаурмы. +${fmt(d.usd)}`, `Стартап купив датасет. За місяць цей голос читає рекламу шаурми. +${fmt(d.usd)}`, `The startup bought it. A month later that voice is advertising kebabs. +${fmt(d.usd)}`)); }
      if (d.caught) { const fine = d.deep; policeFine('fraud', fine, T('дипфейк‑мошенничество', 'діпфейк‑шахрайство', 'deepfake fraud')); return bad(T(`Банк записал звонок, киберполиция нашла вас за день. Штраф ${fmt(fine)}.`, `Банк записав дзвінок, кіберполіція знайшла вас за день. Штраф ${fmt(fine)}.`, `The bank recorded the call; cyber police found you in a day. Fine ${fmt(fine)}.`)); }
      earn(d.deep, 'other', T('Дипфейк‑звонок', 'Діпфейк‑дзвінок', 'Deepfake call')); return ok(`+${fmt(d.deep)}`);
    } },
  { key: 'gamesrc', kinds: ['laptop', 'hdd', 'secure', 'usb'], p: 0.035, ic: '🕹',
    roll: (r) => ({ studio: r.pick(['4A Gamez', 'Frogwares Lite', 'Tiny Cossack', 'Night Pixel']), usd: Math.round(r.float(200, 700)), sue: r.chance(0.45) }),
    file: (d) => [T(`${d.studio}_unreleased_source.zip`, `${d.studio}_unreleased_source.zip`, `${d.studio}_unreleased_source.zip`), 'archive', T(`Исходники инди‑игры, которую студия ${d.studio} делает пять лет и ещё не анонсировала. Билд запускается — и он прекрасен.`, `Сирці інді‑гри, яку студія ${d.studio} робить пʼять років і ще не анонсувала. Білд запускається — і він чудовий.`, `Source code of an indie game ${d.studio} has made for five years and never announced. The build runs — and it’s beautiful.`)],
    acts: (d) => [['return', T(`🏢 Вернуть студии · ${fmt(Math.round(d.usd * 0.5))}`, `🏢 Повернути студії · ${fmt(Math.round(d.usd * 0.5))}`, `🏢 Return to the studio · ${fmt(Math.round(d.usd * 0.5))}`)], ['sell', T(`💼 Продать издателю‑конкуренту · ~${fmt(Math.round(d.usd * 2.5))}`, `💼 Продати видавцю‑конкуренту · ~${fmt(Math.round(d.usd * 2.5))}`, `💼 Sell to a rival publisher · ~${fmt(Math.round(d.usd * 2.5))}`), 'red']],
    act: (it, d, a) => {
      if (a === 'return') { const u = pay(Math.round(d.usd * 0.5), T(`${d.studio}: благодарность`, `${d.studio}: подяка`, `${d.studio}: thanks`)); addXP(35); addReview(5, T('Вернул исходники нашей игры. Ты в титрах, бро!', 'Повернув сирці нашої гри. Ти в титрах, бро!', 'Returned our game’s source. You’re in the credits, bro!')); return ok(T(`Студия вписала вас в титры и прислала ключ от игры. +${fmt(u)}`, `Студія вписала вас у титри й надіслала ключ від гри. +${fmt(u)}`, `The studio put you in the credits and sent a key. +${fmt(u)}`)); }
      const b = Math.round(d.usd * 2.5);
      if (d.sue) { const fine = Math.round(d.usd * 1.5); policeFine('leak', fine, T('кража исходного кода', 'крадіжка вихідного коду', 'stolen source code')); return bad(T(`Студия нашла утечку по водяным знакам в билде. Штраф ${fmt(fine)}.`, `Студія знайшла витік за водяними знаками в білді. Штраф ${fmt(fine)}.`, `The studio traced the leak by watermarks in the build. Fine ${fmt(fine)}.`)); }
      earn(b, 'sale', T('Исходники игры конкуренту', 'Сирці гри конкуренту', 'Game source to a rival')); return ok(`+${fmt(b)}`);
    } },
  { key: 'bonds', kinds: ['office', 'hdd', 'laptop', 'usb'], p: 0.035, ic: '📜',
    roll: (r) => ({ usd: Math.round(r.float(100, 400)), cash: Math.round(r.float(700, 2500)), caught: r.chance(0.5) }),
    file: () => [T('облигации_скан_1996.pdf', 'облігації_скан_1996.pdf', 'bonds_scan_1996.pdf'), 'doc', T('Сканы облигаций и акций завода на предъявителя, 1996 год. Завод теперь — крупный холдинг, бумаги, похоже, до сих пор действительны.', 'Скани облігацій і акцій заводу на предʼявника, 1996 рік. Завод тепер — великий холдинг, папери, схоже, досі дійсні.', 'Scans of a factory’s bearer bonds and shares from 1996. The factory is now a big holding, and the papers seem still valid.')],
    acts: (d) => [['heirs', T(`👪 Вернуть семье владельца · ~${fmt(d.usd)}`, `👪 Повернути родині власника · ~${fmt(d.usd)}`, `👪 Return to the owner’s family · ~${fmt(d.usd)}`)], ['cash', T(`🏦 Предъявить к выплате самому · ~${fmt(d.cash)}`, `🏦 Предʼявити до виплати самому · ~${fmt(d.cash)}`, `🏦 Cash them in yourself · ~${fmt(d.cash)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'heirs') { pay(d.usd, T('Семья владельца облигаций', 'Родина власника облігацій', 'The bondholder’s family')); addXP(35); stat('goodDeeds'); return ok(T(`Семья получила выплату по бумагам деда и отблагодарила вас: +${fmt(d.usd)}`, `Родина отримала виплату за паперами діда й віддячила вам: +${fmt(d.usd)}`, `The family got their grandfather’s payout and thanked you: +${fmt(d.usd)}`)); }
      if (d.caught) { const fine = Math.round(d.cash * 0.6); policeFine('fraud', fine, T('предъявление чужих ценных бумаг', 'предʼявлення чужих цінних паперів', 'presenting someone else’s securities')); return bad(T(`Банк запросил оригиналы и паспорт владельца. Протокол и штраф ${fmt(fine)}.`, `Банк запросив оригінали й паспорт власника. Протокол і штраф ${fmt(fine)}.`, `The bank asked for originals and the owner’s passport. A report and a fine of ${fmt(fine)}.`)); }
      earn(d.cash, 'other', T('Выплата по старым облигациям', 'Виплата за старими облігаціями', 'Old bonds paid out')); return ok(T(`Холдинг выплатил по бумагам без вопросов. +${fmt(d.cash)}`, `Холдинг виплатив за паперами без питань. +${fmt(d.cash)}`, `The holding paid out, no questions asked. +${fmt(d.cash)}`));
    } },
);

// ---------------------------------------------------------------- finds that turn into real things
// A locker receipt, a pawn ticket, a pre‑order, a key to a garage, a flash sale… — these put actual items into the
// inventory (or ask for money first). `retry: true` keeps the find unused when the player can't pay yet.
const gift = (seed, o, paid = 0) => { const x = makeItem(new RNG('loot|' + seed), { fakeRate: 0, ...o }); addItem(x, paid, 'found'); return x; };
// paid finds must be worth more than the price: try a few rolls until the real value clears `minUsd`
const giftWorth = (seed, o, minUsd, paid = 0) => {
  let best = null, bv = -1;
  for (let k = 0; k < 30; k++) {
    const x = makeItem(new RNG(`loot|${seed}|${k}`), { fakeRate: 0, ...o });
    if (o.cond) x.cond = Math.max(x.cond, o.cond);
    if (o.worn) x.cond = Math.min(x.cond, 60);
    const v = itemValue(x, G.s.player.city, 'true');
    if (v >= minUsd) { best = x; break; }
    if (v > bv) { bv = v; best = x; }
  }
  addItem(best, paid, 'found'); return best;
};
const GPUS = () => MODELS.filter((m) => m.cat === 'electronics' && /^(Nvidio|Radeen)$/.test(m.brand));
const name = (x) => itemTitle(x);
const short = (usd) => ({ msg: T(`Не хватает денег: нужно ${fmt(usd)}. Находка подождёт.`, `Не вистачає грошей: треба ${fmt(usd)}. Знахідка почекає.`, `Not enough money: you need ${fmt(usd)}. The find will wait.`), cls: 'r', retry: true });
LOOT.push(
  { key: 'locker', kinds: ['phone', 'tablet'], p: 0.035, ic: '🧳',
    roll: (r) => ({ seed: r.int(1, 1e9), num: r.int(100, 399), sting: r.chance(0.22), usd: Math.round(r.float(20, 60)), fine: Math.round(r.float(80, 250)) }),
    file: (d) => [T(`Квитанция_камера_хранения_№${d.num}.jpg`, `Квитанція_камера_схову_№${d.num}.jpg`, `Left_luggage_receipt_${d.num}.jpg`), 'photo', T(`Квитанция автоматической камеры хранения на вокзале, ячейка №${d.num}. Оплачено до конца недели, код — на фото. Хозяин, похоже, так и не вернулся.`, `Квитанція автоматичної камери схову на вокзалі, комірка №${d.num}. Оплачено до кінця тижня, код — на фото. Власник, схоже, так і не повернувся.`, `A station left‑luggage receipt, locker #${d.num}. Paid till the end of the week, the code is in the photo. The owner never came back.`)],
    acts: (d) => [['open', T('🧳 Забрать, что в ячейке', '🧳 Забрати, що в комірці', '🧳 Take what’s in the locker')], ['lost', T(`🏢 Отдать в бюро находок · ~${fmt(d.usd)}`, `🏢 Віддати в бюро знахідок · ~${fmt(d.usd)}`, `🏢 Hand it to lost & found · ~${fmt(d.usd)}`)]],
    act: (it, d, a) => {
      if (a === 'lost') { pay(d.usd, T('Бюро находок: благодарность хозяина', 'Бюро знахідок: подяка власника', 'Lost & found: the owner’s thanks')); addXP(20); stat('goodDeeds'); return ok(T(`Хозяин нашёлся и оставил благодарность: +${fmt(d.usd)}`, `Власник знайшовся й залишив подяку: +${fmt(d.usd)}`, `The owner turned up and left a thank‑you: +${fmt(d.usd)}`)); }
      if (d.sting) { policeFine('stolen', d.fine, T('вещи из чужой ячейки', 'речі з чужої комірки', 'someone else’s locker')); return bad(T(`У ячейки ждали двое в штатском: вещи в розыске. Штраф ${fmt(d.fine)}.`, `Біля комірки чекали двоє в цивільному: речі в розшуку. Штраф ${fmt(d.fine)}.`, `Two plain‑clothes officers were waiting: the contents were wanted. Fine ${fmt(d.fine)}.`)); }
      const x = gift(d.seed, { cats: ['bags', 'watches', 'electronics', 'jewelry', 'perfume', 'sneakers'], maxVal: 900 });
      return ok(T(`В ячейке — ${name(x)}. Уже в инвентаре.`, `У комірці — ${name(x)}. Уже в інвентарі.`, `Inside: ${name(x)}. It’s in your inventory.`));
    } },
  { key: 'pawn', kinds: ['phone', 'laptop', 'usb', 'tablet'], p: 0.035, ic: '🏷',
    roll: (r) => ({ seed: r.int(1, 1e9), fee: Math.round(r.float(40, 380)), fake: r.chance(0.2), days: r.int(1, 3) }),
    file: (d) => [T('Залоговый_билет.pdf', 'Заставний_квиток.pdf', 'Pawn_ticket.pdf'), 'doc', T(`Залоговый билет ломбарда: вещь сдана под залог, выкуп — ${fmt(d.fee)}, срок истекает через ${d.days} дн. Билет на предъявителя, хозяин о нём явно забыл.`, `Заставний квиток ломбарду: річ здано під заставу, викуп — ${fmt(d.fee)}, строк спливає за ${d.days} дн. Квиток на предʼявника, власник про нього явно забув.`, `A pawn ticket: redeem for ${fmt(d.fee)}, expires in ${d.days} days. Bearer ticket — the owner forgot about it.`)],
    acts: (d) => [['buy', T(`💵 Выкупить за ${fmt(d.fee)}`, `💵 Викупити за ${fmt(d.fee)}`, `💵 Redeem for ${fmt(d.fee)}`)], ['skip', T('🤷 Пусть ломбард продаёт', '🤷 Хай ломбард продає', '🤷 Let the pawnshop sell it')]],
    act: (it, d, a) => {
      if (a === 'skip') return { msg: T('Билет просрочился. Кто‑то купит это на витрине ломбарда.', 'Квиток прострочився. Хтось купить це на вітрині ломбарду.', 'The ticket expired. Someone will buy it in the shop window.'), cls: '' };
      if (!spend(d.fee, 'other', T('Выкуп из ломбарда', 'Викуп із ломбарду', 'Pawn redemption'))) return short(d.fee);
      const o = { cats: ['watches', 'jewelry', 'electronics', 'instruments'], minVal: d.fee * 1.3, maxVal: d.fee * 3, cond: 70 };
      const x = d.fake ? gift(d.seed, { ...o, fakeRate: 1 }, d.fee) : giftWorth(d.seed, o, d.fee * 1.3, d.fee);
      return d.fake ? bad(T(`Выкупили ${name(x)}… а дома лупа показала: подделка. Ломбард тоже не заметил.`, `Викупили ${name(x)}… а вдома лупа показала: підробка. Ломбард теж не помітив.`, `You redeemed ${name(x)}… then the loupe at home said: fake. The pawnshop missed it too.`)) : ok(T(`Выкуплено: ${name(x)} — стоит заметно больше залога. В инвентаре.`, `Викуплено: ${name(x)} — коштує помітно більше застави. В інвентарі.`, `Redeemed: ${name(x)} — worth well over the loan. In your inventory.`));
    } },
  { key: 'preorder', kinds: ['phone', 'laptop', 'tablet'], p: 0.025, ic: '📦',
    roll: (r) => ({ seed: r.int(1, 1e9), usd: Math.round(r.float(30, 120)), caught: r.chance(0.45), fine: Math.round(r.float(150, 450)), code: r.int(1000, 9999) }),
    file: (d) => [T('Предзаказ_подтверждение.pdf', 'Передзамовлення_підтвердження.pdf', 'Preorder_confirmation.pdf'), 'doc', T(`Предзаказ нового смартфона оплачен полностью. Код получения в пункте выдачи — ${d.code}. Забрать до 20‑го.`, `Передзамовлення нового смартфона оплачено повністю. Код отримання в пункті видачі — ${d.code}. Забрати до 20‑го.`, `A new phone pre‑order, paid in full. Pickup code ${d.code}. Collect by the 20th.`)],
    acts: (d) => [['owner', T(`📞 Сообщить владельцу · ~${fmt(d.usd)}`, `📞 Повідомити власнику · ~${fmt(d.usd)}`, `📞 Tell the owner · ~${fmt(d.usd)}`)], ['take', T('📦 Забрать по коду самому', '📦 Забрати за кодом самому', '📦 Pick it up yourself'), 'red']],
    act: (it, d, a) => {
      if (a === 'owner') { pay(d.usd, T('Благодарность за предзаказ', 'Подяка за передзамовлення', 'Thanks for the pre‑order')); addXP(25); stat('goodDeeds'); addReview(5, T('Предупредил, что мой предзаказ остался на старом телефоне. Успел забрать!', 'Попередив, що моє передзамовлення лишилося на старому телефоні. Встиг забрати!', 'Warned me my pre‑order was on my old phone. Got it in time!')); return ok(T(`Хозяин успел забрать телефон и перевёл +${fmt(d.usd)}`, `Власник встиг забрати телефон і переказав +${fmt(d.usd)}`, `The owner collected it in time and sent +${fmt(d.usd)}`)); }
      if (d.caught) { policeFine('fraud', d.fine, T('получение чужого заказа', 'отримання чужого замовлення', 'collecting someone else’s order')); return bad(T(`Хозяин уже заблокировал заказ: на выдаче попросили паспорт и вызвали охрану. Штраф ${fmt(d.fine)}.`, `Власник уже заблокував замовлення: на видачі попросили паспорт і викликали охорону. Штраф ${fmt(d.fine)}.`, `The owner had blocked it: they asked for ID and called security. Fine ${fmt(d.fine)}.`)); }
      const x = gift(d.seed, { cats: ['phones'], minVal: 400 }); x.box = true; x.sealed = true; x.cond = 100;
      return ok(T(`Выдали без вопросов: ${name(x)}, запечатан. В инвентаре.`, `Видали без питань: ${name(x)}, запечатаний. В інвентарі.`, `Handed over, no questions: ${name(x)}, sealed. In your inventory.`));
    } },
  { key: 'garage31', kinds: ['phone', 'usb', 'laptop'], p: 0.025, ic: '🔑',
    roll: (r) => ({ seed: r.int(1, 1e9), two: r.chance(0.45), usd: Math.round(r.float(40, 150)) }),
    file: () => [T('ключ_гараж_31.jpg', 'ключ_гараж_31.jpg', 'key_garage_31.jpg'), 'photo', T('Фото ключа и записка: «Гараж №31 в кооперативе „Мотор“. Там дедово добро — забирай что хочешь, я уехал насовсем». Записке три года.', 'Фото ключа й записка: «Гараж №31 у кооперативі „Мотор“. Там дідове добро — забирай що хочеш, я поїхав назовсім». Записці три роки.', 'A photo of a key and a note: “Garage 31, ‘Motor’ co‑op. Grandpa’s stuff — take what you like, I’ve left for good.” The note is three years old.')],
    acts: (d) => [['go', T('🔦 Съездить в гараж', '🔦 Зʼїздити в гараж', '🔦 Go to the garage')], ['call', T(`📞 Найти автора записки · ~${fmt(d.usd)}`, `📞 Знайти автора записки · ~${fmt(d.usd)}`, `📞 Find who wrote it · ~${fmt(d.usd)}`)]],
    act: (it, d, a) => {
      if (a === 'call') { pay(d.usd, T('«За честность»', '«За чесність»', '“For honesty”')); addXP(25); stat('goodDeeds'); return ok(T(`Он давно в другой стране, попросил всё раздать и прислал «за честность» +${fmt(d.usd)}`, `Він давно в іншій країні, попросив усе роздати й надіслав «за чесність» +${fmt(d.usd)}`, `He lives abroad now, asked you to give it all away and sent +${fmt(d.usd)} “for honesty”`)); }
      const cats = ['bikes', 'antiques', 'instruments', 'misc', 'collectibles', 'gear'];
      const xs = [gift(d.seed, { cats, maxVal: 1200 })]; if (d.two) xs.push(gift(d.seed + 1, { cats, maxVal: 800 }));
      return ok(T(`Пыль, банки с огурцами и… ${xs.map(name).join(', ')}. Уже в инвентаре.`, `Пил, банки з огірками і… ${xs.map(name).join(', ')}. Уже в інвентарі.`, `Dust, jars of pickles and… ${xs.map(name).join(', ')}. In your inventory.`));
    } },
  { key: 'giveaway', kinds: ['laptop', 'phone', 'tablet'], p: 0.025, ic: '🎸',
    roll: (r) => ({ seed: r.int(1, 1e9), gone: r.chance(0.3) }),
    file: () => [T('Отдам_даром_черновик.txt', 'Віддам_даром_чернетка.txt', 'Free_to_good_home_draft.txt'), 'text', T('Черновик объявления: «Переезжаю, отдам гитару и всё по музыке даром, лишь бы не на помойку». Так и не опубликовано, адрес в конце.', 'Чернетка оголошення: «Переїжджаю, віддам гітару й усе для музики даром, аби не на смітник». Так і не опубліковано, адреса в кінці.', 'A draft ad: “Moving, giving away my guitar and music gear for free, just not to the dump.” Never posted; the address is at the end.')],
    acts: () => [['go', T('🎸 Приехать и забрать', '🎸 Приїхати й забрати', '🎸 Go and pick it up')]],
    act: (it, d) => {
      if (d.gone) return { msg: T('Хозяин уже раздал всё соседям, но налил чаю и рассказал про гастроли 1998 года.', 'Власник уже роздав усе сусідам, але налив чаю й розповів про гастролі 1998 року.', 'He’d already given it all to the neighbours, but poured you tea and told you about the 1998 tour.'), cls: '' };
      const x = gift(d.seed, { cats: ['instruments'], maxVal: 1500 }); addXP(15);
      return ok(T(`«Пусть играет у хороших людей». ${name(x)} — в инвентаре.`, `«Хай грає в добрих людей». ${name(x)} — в інвентарі.`, `“Let it play for good people.” ${name(x)} is in your inventory.`));
    } },
  { key: 'collection', kinds: ['laptop', 'tablet', 'usb'], p: 0.025, ic: '🃏',
    roll: (r) => ({ seed: r.int(1, 1e9), usd: Math.round(r.float(80, 300)) }),
    file: (d) => [T('Опись_коллекции.xlsx', 'Опис_колекції.xlsx', 'Collection_inventory.xlsx'), 'doc', T(`Опись коллекции: карточки, комиксы, редкие выпуски с пометкой «★». Внизу: «Продать за ${fmt(d.usd)}, пока мама не видит». Номер телефона автора — там же.`, `Опис колекції: картки, комікси, рідкісні випуски з позначкою «★». Внизу: «Продати за ${fmt(d.usd)}, поки мама не бачить». Номер автора — там само.`, `A collection list: cards, comics, rare issues marked “★”. At the bottom: “Sell for ${fmt(d.usd)} before Mum sees.” The author’s number is there too.`)],
    acts: (d) => [['buy', T(`💵 Выкупить коллекцию · ${fmt(d.usd)}`, `💵 Викупити колекцію · ${fmt(d.usd)}`, `💵 Buy the collection · ${fmt(d.usd)}`)], ['skip', T('🤷 Не интересно', '🤷 Не цікаво', '🤷 Not interested')]],
    act: (it, d, a) => {
      if (a === 'skip') return { msg: T('Пропустили. Через неделю коллекцию продали на аукционе втрое дороже.', 'Пропустили. За тиждень колекцію продали на аукціоні втричі дорожче.', 'Skipped. A week later it went for triple at an auction.'), cls: '' };
      if (!spend(d.usd, 'other', T('Покупка коллекции', 'Купівля колекції', 'Bought a collection'))) return short(d.usd);
      const cats = ['cards', 'comics', 'collectibles', 'toys'];
      const xs = [giftWorth(d.seed, { cats, minVal: d.usd * 0.7, maxVal: d.usd * 1.8, cond: 70 }, d.usd * 0.75, Math.round(d.usd / 2)), giftWorth(d.seed + 7, { cats, minVal: d.usd * 0.5, maxVal: d.usd * 1.4, cond: 70 }, d.usd * 0.55, Math.round(d.usd / 2))];
      return ok(T(`Сделка в подъезде. В инвентаре: ${xs.map(name).join(', ')}.`, `Угода в підʼїзді. В інвентарі: ${xs.map(name).join(', ')}.`, `Deal done on the stairs. In your inventory: ${xs.map(name).join(', ')}.`));
    } },
  { key: 'minefarm', kinds: ['laptop', 'hdd', 'usb'], p: 0.03, ic: '⛏',
    roll: (r) => ({ seed: r.int(1, 1e9), fee: Math.round(r.float(150, 500)), worn: r.chance(0.35) }),
    file: (d) => [T('ферма_распродажа.txt', 'ферма_розпродаж.txt', 'farm_selloff.txt'), 'text', T(`Переписка: «Ферму сворачиваем, видеокарты отдаём за полцены — ${fmt(d.fee)} штука, только быстро, пока не пришли за светом». Адрес склада.`, `Листування: «Ферму згортаємо, відеокарти віддаємо за півціни — ${fmt(d.fee)} штука, тільки швидко, поки не прийшли за світло». Адреса складу.`, `Chat: “Shutting the farm down, GPUs at half price — ${fmt(d.fee)} each, quick before they come about the power bill.” A warehouse address.`)],
    acts: (d) => [['buy', T(`🖥 Купить видеокарту · ${fmt(d.fee)}`, `🖥 Купити відеокарту · ${fmt(d.fee)}`, `🖥 Buy a GPU · ${fmt(d.fee)}`)], ['skip', T('🤷 Майнинговые — не беру', '🤷 Майнінгові — не беру', '🤷 No mining cards for me')]],
    act: (it, d, a) => {
      if (a === 'skip') return { msg: T('Разумно. Хотя…', 'Розумно. Хоча…', 'Sensible. Although…'), cls: '' };
      if (!spend(d.fee, 'other', T('Видеокарта с фермы', 'Відеокарта з ферми', 'A GPU from a mining farm'))) return short(d.fee);
      const gp = GPUS(), fit = gp.filter((m) => modelValue(m) >= d.fee * 1.4 && modelValue(m) <= d.fee * 2.8);
      const m = (fit.length ? fit : gp)[d.seed % (fit.length || gp.length)];
      const x = giftWorth(d.seed, { model: m.id, cond: d.worn ? 0 : 85, worn: d.worn }, d.fee * (d.worn ? 1.1 : 1.3), d.fee);
      if (d.worn) { return ok(T(`${name(x)} — после двух лет майнинга: вентиляторы шумят, но работает. В инвентаре.`, `${name(x)} — після двох років майнінгу: вентилятори шумлять, але працює. В інвентарі.`, `${name(x)} — two years of mining: loud fans, still works. In your inventory.`)); }
      return ok(T(`${name(x)} почти как новая. В инвентаре.`, `${name(x)} майже як нова. В інвентарі.`, `${name(x)}, almost like new. In your inventory.`));
    } },
  { key: 'receipt', kinds: ['phone', 'laptop', 'tablet', 'console'], p: 0.07, ic: '🧾',
    roll: () => ({}),
    file: () => [T('Чек_и_гарантия.pdf', 'Чек_і_гарантія.pdf', 'Receipt_and_warranty.pdf'), 'doc', T('Скан чека и гарантийного талона на это самое устройство. С документами покупатели платят больше.', 'Скан чека й гарантійного талона на цей самий пристрій. З документами покупці платять більше.', 'A scan of the receipt and warranty for this very device. Buyers pay more with papers.')],
    acts: () => [['print', T('🖨 Распечатать и приложить к вещи', '🖨 Роздрукувати й додати до речі', '🖨 Print and keep with the item')]],
    act: (it) => {
      if (it.docs) return { msg: T('Документы и так были — теперь есть ещё и копия.', 'Документи й так були — тепер є ще й копія.', 'It already had papers — now there’s a copy too.'), cls: '' };
      it.docs = true; addXP(5);
      return ok(T('Чек и гарантия приложены: с документами вещь стоит дороже.', 'Чек і гарантію додано: з документами річ коштує дорожче.', 'Receipt and warranty attached: it’s worth more with papers.'));
    } },
  { key: 'heirloom', kinds: ['laptop', 'office', 'usb', 'phone'], p: 0.025, ic: '🏺',
    roll: (r) => ({ seed: r.int(1, 1e9), usd: Math.round(r.float(60, 250)) }),
    file: () => [T('Опись_вещей_бабушки.docx', 'Опис_речей_бабусі.docx', 'Grandmas_items_list.docx'), 'doc', T('Опись вещей из бабушкиной квартиры для оценщика: самовар, часы с боем, сервиз. Напротив одной позиции: «ЭТО ПРОДАТЬ ТИХО, родне не говорить». И номер внука.', 'Опис речей із бабусиної квартири для оцінювача: самовар, годинник із боєм, сервіз. Навпроти однієї позиції: «ЦЕ ПРОДАТИ ТИХО, рідні не казати». І номер онука.', 'A valuer’s list of items from grandma’s flat: a samovar, a chiming clock, a tea set. Next to one line: “SELL THIS QUIETLY, don’t tell the family.” And the grandson’s number.')],
    acts: (d) => [['family', T(`👵 Предупредить семью · ~${fmt(d.usd)}`, `👵 Попередити родину · ~${fmt(d.usd)}`, `👵 Warn the family · ~${fmt(d.usd)}`)], ['buy', T(`💵 Купить у внука · ${fmt(d.usd * 2)}`, `💵 Купити в онука · ${fmt(d.usd * 2)}`, `💵 Buy from the grandson · ${fmt(d.usd * 2)}`), 'red']],
    act: (it, d, a) => {
      if (a === 'family') { pay(d.usd, T('Семья: благодарность', 'Родина: подяка', 'The family’s thanks')); addXP(30); stat('goodDeeds'); return ok(T(`Внук хотел тайком продать фамильную вещь. Семья благодарна: +${fmt(d.usd)}`, `Онук хотів потай продати родинну річ. Родина вдячна: +${fmt(d.usd)}`, `The grandson meant to sell an heirloom behind their backs. The family thanks you: +${fmt(d.usd)}`)); }
      if (!spend(d.usd * 2, 'other', T('Покупка у внука', 'Купівля в онука', 'Bought from the grandson'))) return short(d.usd * 2);
      const x = giftWorth(d.seed, { cats: ['antiques', 'watches', 'art'], minVal: d.usd * 2.6, maxVal: d.usd * 6, cond: 70 }, d.usd * 2.6, d.usd * 2);
      return ok(T(`Внук нервничал и торопился. ${name(x)} — в инвентаре. Бабушке не говорите.`, `Онук нервував і поспішав. ${name(x)} — в інвентарі. Бабусі не кажіть.`, `The grandson was nervous and in a hurry. ${name(x)} is in your inventory. Don’t tell grandma.`));
    } },
  { key: 'raffle', kinds: ['phone'], p: 0.03, ic: '👟',
    roll: (r) => ({ seed: r.int(1, 1e9), fee: Math.round(r.float(120, 260)) }),
    file: (d) => [T('Выигрыш_в_раффле.png', 'Виграш_у_раффлі.png', 'Raffle_win.png'), 'photo', T(`Скрин: «Поздравляем! Вы выиграли право купить лимитированные кроссовки по ретейлу — ${fmt(d.fee)}». Оплатить можно ещё сегодня.`, `Скрин: «Вітаємо! Ви виграли право купити лімітовані кросівки за ретейлом — ${fmt(d.fee)}». Оплатити можна ще сьогодні.`, `Screenshot: “Congrats! You won the right to buy limited sneakers at retail — ${fmt(d.fee)}.” Payable today.`)],
    acts: (d) => [['buy', T(`👟 Оплатить по ретейлу · ${fmt(d.fee)}`, `👟 Оплатити за ретейлом · ${fmt(d.fee)}`, `👟 Pay retail · ${fmt(d.fee)}`)], ['skip', T('🤷 Пропустить', '🤷 Пропустити', '🤷 Skip')]],
    act: (it, d, a) => {
      if (a === 'skip') return { msg: T('Пропустили. Ресейл этой пары — втрое дороже. Ну и ладно.', 'Пропустили. Ресейл цієї пари — утричі дорожче. Ну й гаразд.', 'Skipped. That pair resells for triple. Oh well.'), cls: '' };
      if (!spend(d.fee, 'other', T('Кроссовки по ретейлу', 'Кросівки за ретейлом', 'Sneakers at retail'))) return short(d.fee);
      const x = giftWorth(d.seed, { cats: ['sneakers'], minVal: d.fee * 1.5, cond: 100 }, d.fee * 1.4, d.fee); x.box = true;
      return ok(T(`Курьер привёз ${name(x)} — новые, в коробке. Ресейл — заметно выше.`, `Курʼєр привіз ${name(x)} — нові, у коробці. Ресейл — помітно вищий.`, `The courier brought ${name(x)} — new, boxed. Resale is well above retail.`));
    } },
);

// the lookup by key covers every find above (built last, so later LOOT.push blocks are included)
for (const x of LOOT) LOOT_BY[x.key] ||= x;
