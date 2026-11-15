// Venues you can open (Business → Venues) and everything the Supplier sells for them.
// Prices are in USD (shown in the local currency); pack = what one order line brings; life = shelf life in days
// (0 = doesn't go off); fridge/freeze = needs a working fridge / freezer to keep.
const N = (ru, uk, en) => [ru, uk, en];

// ---------------------------------------------------------------- consumables, food, packaging, cleaning, safety
export const SKUS = {
  // coffee
  beans: { n: N('Кофе в зёрнах 1 кг (арабика)', 'Кава в зернах 1 кг (арабіка)', 'Coffee beans 1 kg (arabica)'), cat: 'food', price: 14, life: 120, u: N('кг', 'кг', 'kg') },
  milk: { n: N('Молоко 3,2 % 1 л', 'Молоко 3,2 % 1 л', 'Milk 3.2 % 1 L'), cat: 'food', price: 1.1, life: 5, fridge: 1, u: N('л', 'л', 'L') },
  cream: { n: N('Сливки 10 % 1 л', 'Вершки 10 % 1 л', 'Cream 10 % 1 L'), cat: 'food', price: 2.6, life: 7, fridge: 1, u: N('л', 'л', 'L') },
  oatmilk: { n: N('Овсяное молоко 1 л', 'Вівсяне молоко 1 л', 'Oat milk 1 L'), cat: 'food', price: 2.9, life: 30, u: N('л', 'л', 'L') },
  sugar: { n: N('Сахар в стиках (1000 шт)', 'Цукор у стіках (1000 шт)', 'Sugar sticks (1000)'), cat: 'food', price: 8, life: 0, u: N('уп', 'уп', 'pk') },
  syrup: { n: N('Сироп (ваниль/карамель) 1 л', 'Сироп (ваніль/карамель) 1 л', 'Syrup (vanilla/caramel) 1 L'), cat: 'food', price: 6, life: 180, u: N('л', 'л', 'L') },
  lavsyrup: { n: N('Сироп лавандовый 1 л', 'Сироп лавандовий 1 л', 'Lavender syrup 1 L'), cat: 'food', price: 7.5, life: 180, u: N('л', 'л', 'L'), unlock: 'lavender' },
  cocoa: { n: N('Какао‑порошок 1 кг', 'Какао‑порошок 1 кг', 'Cocoa powder 1 kg'), cat: 'food', price: 9, life: 365, u: N('кг', 'кг', 'kg') },
  matcha: { n: N('Матча 100 г', 'Матча 100 г', 'Matcha 100 g'), cat: 'food', price: 12, life: 180, u: N('уп', 'уп', 'pk'), unlock: 'matcha' },
  tea: { n: N('Чай в пакетиках (100 шт)', 'Чай у пакетиках (100 шт)', 'Tea bags (100)'), cat: 'food', price: 5, life: 365, u: N('уп', 'уп', 'pk') },
  croissant: { n: N('Круассаны замороженные (20 шт)', 'Круасани заморожені (20 шт)', 'Frozen croissants (20)'), cat: 'food', price: 9, life: 60, freeze: 1, u: N('уп', 'уп', 'pk') },
  cheesecake: { n: N('Чизкейк (12 порций)', 'Чізкейк (12 порцій)', 'Cheesecake (12 slices)'), cat: 'food', price: 16, life: 4, fridge: 1, u: N('шт', 'шт', 'pc') },
  lemons: { n: N('Лимоны 1 кг', 'Лимони 1 кг', 'Lemons 1 kg'), cat: 'food', price: 2, life: 10, u: N('кг', 'кг', 'kg') },
  mint: { n: N('Мята (10 пучков)', 'Мʼята (10 пучків)', 'Mint (10 bunches)'), cat: 'food', price: 3, life: 4, fridge: 1, u: N('уп', 'уп', 'pk') },
  tonic: { n: N('Тоник 1 л ×6', 'Тонік 1 л ×6', 'Tonic 1 L ×6'), cat: 'food', price: 6, life: 270, u: N('уп', 'уп', 'pk'), unlock: 'tonic' },
  // kiosk
  water: { n: N('Вода 0,5 л ×12', 'Вода 0,5 л ×12', 'Water 0.5 L ×12'), cat: 'food', price: 3, life: 365, u: N('уп', 'уп', 'pk') },
  soda: { n: N('Газировка 0,5 л ×12', 'Газування 0,5 л ×12', 'Soda 0.5 L ×12'), cat: 'food', price: 6, life: 270, u: N('уп', 'уп', 'pk') },
  energy: { n: N('Энергетик ×24', 'Енергетик ×24', 'Energy drink ×24'), cat: 'food', price: 18, life: 365, u: N('уп', 'уп', 'pk') },
  chips: { n: N('Чипсы ×20', 'Чипси ×20', 'Crisps ×20'), cat: 'food', price: 10, life: 120, u: N('уп', 'уп', 'pk') },
  choco: { n: N('Шоколадные батончики ×30', 'Шоколадні батончики ×30', 'Chocolate bars ×30'), cat: 'food', price: 12, life: 240, u: N('уп', 'уп', 'pk') },
  gum: { n: N('Жвачка ×100', 'Жуйка ×100', 'Chewing gum ×100'), cat: 'food', price: 15, life: 365, u: N('уп', 'уп', 'pk') },
  icecream: { n: N('Мороженое ×24', 'Морозиво ×24', 'Ice cream ×24'), cat: 'food', price: 14, life: 120, freeze: 1, u: N('уп', 'уп', 'pk') },
  sausage: { n: N('Сосиски 1 кг (~20 шт)', 'Сосиски 1 кг (~20 шт)', 'Sausages 1 kg (~20)'), cat: 'food', price: 6, life: 10, fridge: 1, u: N('кг', 'кг', 'kg') },
  buns: { n: N('Булочки для хот‑догов ×20', 'Булочки для хот‑догів ×20', 'Hot dog buns ×20'), cat: 'food', price: 3, life: 3, u: N('уп', 'уп', 'pk') },
  ketchup: { n: N('Кетчуп и горчица 1 кг', 'Кетчуп і гірчиця 1 кг', 'Ketchup & mustard 1 kg'), cat: 'food', price: 3, life: 60, u: N('кг', 'кг', 'kg') },
  coffee3: { n: N('Кофе 3в1 ×100', 'Кава 3в1 ×100', '3‑in‑1 coffee ×100'), cat: 'food', price: 6, life: 365, u: N('уп', 'уп', 'pk') },
  // bar
  keg: { n: N('Кега пива 30 л', 'Кега пива 30 л', 'Beer keg 30 L'), cat: 'food', price: 55, life: 30, fridge: 1, u: N('кега', 'кега', 'keg') },
  cider: { n: N('Сидр 0,5 л ×12', 'Сидр 0,5 л ×12', 'Cider 0.5 L ×12'), cat: 'food', price: 14, life: 180, u: N('уп', 'уп', 'pk') },
  whisky: { n: N('Виски 0,7 л', 'Віскі 0,7 л', 'Whisky 0.7 L'), cat: 'food', price: 18, life: 0, u: N('бут', 'пл', 'btl') },
  rum: { n: N('Ром белый 0,7 л', 'Ром білий 0,7 л', 'White rum 0.7 L'), cat: 'food', price: 15, life: 0, u: N('бут', 'пл', 'btl') },
  gin: { n: N('Джин + вермут + биттер (набор)', 'Джин + вермут + біттер (набір)', 'Gin + vermouth + bitter (set)'), cat: 'food', price: 42, life: 0, u: N('наб', 'наб', 'set'), unlock: 'negroni' },
  wine: { n: N('Красное вино 1 л + специи', 'Червоне вино 1 л + спеції', 'Red wine 1 L + spices'), cat: 'food', price: 7, life: 0, u: N('л', 'л', 'L'), unlock: 'mulled' },
  cola: { n: N('Кола 1,5 л ×6', 'Кола 1,5 л ×6', 'Cola 1.5 L ×6'), cat: 'food', price: 6, life: 180, u: N('уп', 'уп', 'pk') },
  lime: { n: N('Лайм 1 кг', 'Лайм 1 кг', 'Limes 1 kg'), cat: 'food', price: 4, life: 10, u: N('кг', 'кг', 'kg') },
  nachos: { n: N('Начос 1 кг', 'Начос 1 кг', 'Nachos 1 kg'), cat: 'food', price: 6, life: 90, u: N('кг', 'кг', 'kg') },
  cheese: { n: N('Сыр 1 кг', 'Сир 1 кг', 'Cheese 1 kg'), cat: 'food', price: 8, life: 14, fridge: 1, u: N('кг', 'кг', 'kg') },
  croutons: { n: N('Гренки ×20 порций', 'Грінки ×20 порцій', 'Croutons ×20 portions'), cat: 'food', price: 5, life: 90, u: N('уп', 'уп', 'pk') },
  wings: { n: N('Крылышки 1 кг', 'Крильця 1 кг', 'Chicken wings 1 kg'), cat: 'food', price: 7, life: 4, fridge: 1, u: N('кг', 'кг', 'kg') },
  salt: { n: N('Соль 1 кг', 'Сіль 1 кг', 'Salt 1 kg'), cat: 'food', price: 0.5, life: 0, u: N('кг', 'кг', 'kg') },
  glasses: { n: N('Стаканы и бокалы ×12 (бой)', 'Склянки й келихи ×12 (бій)', 'Glasses ×12 (breakage)'), cat: 'pack', price: 8, life: 0, u: N('уп', 'уп', 'pk') },
  // shawarma / fast food
  chicken: { n: N('Курица (бедро) 1 кг', 'Курка (стегно) 1 кг', 'Chicken thigh 1 kg'), cat: 'food', price: 4, life: 3, fridge: 1, u: N('кг', 'кг', 'kg') },
  lavash: { n: N('Лаваш ×20', 'Лаваш ×20', 'Flatbread ×20'), cat: 'food', price: 3, life: 4, u: N('уп', 'уп', 'pk') },
  veg: { n: N('Овощи (капуста, томаты, огурцы) 1 кг', 'Овочі (капуста, томати, огірки) 1 кг', 'Vegetables 1 kg'), cat: 'food', price: 2, life: 5, fridge: 1, u: N('кг', 'кг', 'kg') },
  sauce: { n: N('Соус чесночный 1 кг', 'Соус часниковий 1 кг', 'Garlic sauce 1 kg'), cat: 'food', price: 3, life: 20, fridge: 1, u: N('кг', 'кг', 'kg') },
  fries: { n: N('Картофель фри замороженный 2,5 кг', 'Картопля фрі заморожена 2,5 кг', 'Frozen fries 2.5 kg'), cat: 'food', price: 7, life: 180, freeze: 1, u: N('уп', 'уп', 'pk') },
  fryoil: { n: N('Масло для фритюра 10 л', 'Олія для фритюру 10 л', 'Frying oil 10 L'), cat: 'food', price: 18, life: 365, u: N('кан', 'кан', 'can') },
  // packaging
  cups250: { n: N('Стаканчики 250 мл ×100', 'Стаканчики 250 мл ×100', 'Cups 250 ml ×100'), cat: 'pack', price: 6, life: 0, u: N('уп', 'уп', 'pk') },
  cups350: { n: N('Стаканчики 350 мл ×100', 'Стаканчики 350 мл ×100', 'Cups 350 ml ×100'), cat: 'pack', price: 7.5, life: 0, u: N('уп', 'уп', 'pk') },
  lids: { n: N('Крышки для стаканов ×100', 'Кришки для стаканів ×100', 'Cup lids ×100'), cat: 'pack', price: 3, life: 0, u: N('уп', 'уп', 'pk') },
  straws: { n: N('Трубочки ×500', 'Трубочки ×500', 'Straws ×500'), cat: 'pack', price: 4, life: 0, u: N('уп', 'уп', 'pk') },
  stirrers: { n: N('Размешиватели ×1000', 'Розмішувачі ×1000', 'Stirrers ×1000'), cat: 'pack', price: 3, life: 0, u: N('уп', 'уп', 'pk') },
  napkins: { n: N('Салфетки ×500', 'Серветки ×500', 'Napkins ×500'), cat: 'pack', price: 2, life: 0, u: N('уп', 'уп', 'pk') },
  foil: { n: N('Крафт‑пакеты и фольга ×100', 'Крафт‑пакети й фольга ×100', 'Kraft bags & foil ×100'), cat: 'pack', price: 4, life: 0, u: N('уп', 'уп', 'pk') },
  bags: { n: N('Пакеты‑майки ×100', 'Пакети‑майки ×100', 'Carrier bags ×100'), cat: 'pack', price: 2, life: 0, u: N('уп', 'уп', 'pk') },
  // garage
  oil: { n: N('Моторное масло 5W‑30, 4 л', 'Моторна олива 5W‑30, 4 л', 'Engine oil 5W‑30, 4 L'), cat: 'parts', price: 28, life: 0, u: N('кан', 'кан', 'can') },
  oilf: { n: N('Масляный фильтр', 'Оливний фільтр', 'Oil filter'), cat: 'parts', price: 5, life: 0, u: N('шт', 'шт', 'pc') },
  airf: { n: N('Воздушный фильтр', 'Повітряний фільтр', 'Air filter'), cat: 'parts', price: 6, life: 0, u: N('шт', 'шт', 'pc') },
  pads: { n: N('Тормозные колодки (комплект)', 'Гальмівні колодки (комплект)', 'Brake pads (set)'), cat: 'parts', price: 25, life: 0, u: N('компл', 'компл', 'set') },
  weights: { n: N('Балансировочные грузики ×100', 'Балансувальні тягарці ×100', 'Wheel weights ×100'), cat: 'parts', price: 6, life: 0, u: N('уп', 'уп', 'pk') },
  brakeclean: { n: N('Очиститель тормозов 500 мл', 'Очищувач гальм 500 мл', 'Brake cleaner 500 ml'), cat: 'parts', price: 4, life: 0, u: N('бал', 'бал', 'can') },
  rags: { n: N('Ветошь 1 кг', 'Ганчір’я 1 кг', 'Rags 1 kg'), cat: 'clean', price: 2, life: 0, u: N('кг', 'кг', 'kg') },
  // car wash
  shampoo: { n: N('Автошампунь 5 л', 'Автошампунь 5 л', 'Car shampoo 5 L'), cat: 'clean', price: 12, life: 0, u: N('кан', 'кан', 'can') },
  foam: { n: N('Активная пена 20 л', 'Активна піна 20 л', 'Snow foam 20 L'), cat: 'clean', price: 35, life: 0, u: N('кан', 'кан', 'can') },
  wax: { n: N('Воск для кузова 5 л', 'Віск для кузова 5 л', 'Body wax 5 L'), cat: 'clean', price: 20, life: 0, u: N('кан', 'кан', 'can') },
  microfiber: { n: N('Микрофибра ×10', 'Мікрофібра ×10', 'Microfibre cloths ×10'), cat: 'clean', price: 8, life: 0, u: N('уп', 'уп', 'pk') },
  interior: { n: N('Химия для салона 5 л', 'Хімія для салону 5 л', 'Interior cleaner 5 L'), cat: 'clean', price: 18, life: 0, u: N('кан', 'кан', 'can') },
  // hygiene & service consumables
  gloves: { n: N('Перчатки нитриловые ×100', 'Рукавички нітрилові ×100', 'Nitrile gloves ×100'), cat: 'clean', price: 4, life: 0, u: N('уп', 'уп', 'pk') },
  disinfect: { n: N('Дезсредство 1 л', 'Деззасіб 1 л', 'Disinfectant 1 L'), cat: 'clean', price: 6, life: 365, u: N('л', 'л', 'L') },
  descaler: { n: N('Средство от накипи для кофемашины', 'Засіб від накипу для кавомашини', 'Coffee machine descaler'), cat: 'clean', price: 9, life: 0, u: N('уп', 'уп', 'pk') },
  cleantabs: { n: N('Таблетки для чистки кофемашины ×100', 'Таблетки для чищення кавомашини ×100', 'Coffee machine cleaning tabs ×100'), cat: 'clean', price: 12, life: 0, u: N('уп', 'уп', 'pk') },
  filtercart: { n: N('Картридж фильтра для воды', 'Картридж фільтра для води', 'Water filter cartridge'), cat: 'clean', price: 25, life: 0, u: N('шт', 'шт', 'pc') },
  linecleaner: { n: N('Средство для промывки пивных линий', 'Засіб для промивання пивних ліній', 'Beer line cleaner'), cat: 'clean', price: 14, life: 0, u: N('уп', 'уп', 'pk') },
};

// ---------------------------------------------------------------- equipment, furniture, safety (installed at a venue)
// svc: regular maintenance — every N days, using a SKU from stock (sku) or a paid call (cost); skipped → lower
// quality, faster wear, more breakdowns. fridge/freeze: keeps chilled / frozen stock good.
export const EQUIP = {
  pos: { n: N('Касса с фискальным регистратором', 'Каса з фіскальним реєстратором', 'Till with fiscal printer'), cat: 'equip', price: 180, ic: '🧾' },
  terminal: { n: N('Терминал для оплаты картой', 'Термінал для оплати карткою', 'Card terminal'), cat: 'equip', price: 90, ic: '💳' },
  espresso: { n: N('Кофемашина рожковая, 2 группы', 'Кавомашина ріжкова, 2 групи', 'Espresso machine, 2 groups'), cat: 'equip', price: 2400, ic: '☕', svc: { every: 7, sku: 'descaler', n: N('Чистка от накипи', 'Чищення від накипу', 'Descale') } },
  grinder: { n: N('Кофемолка профессиональная', 'Кавомолка професійна', 'Pro coffee grinder'), cat: 'equip', price: 450, ic: '⚙️', svc: { every: 60, cost: 40, n: N('Замена жерновов', 'Заміна жорен', 'New burrs') } },
  waterfilter: { n: N('Система фильтрации воды', 'Система фільтрації води', 'Water filtration'), cat: 'equip', price: 200, ic: '💧', svc: { every: 30, sku: 'filtercart', n: N('Замена картриджа', 'Заміна картриджа', 'New cartridge') } },
  fridge: { n: N('Холодильник', 'Холодильник', 'Fridge'), cat: 'equip', price: 500, ic: '🧊', fridge: 1 },
  showcase: { n: N('Витрина‑холодильник для десертов', 'Вітрина‑холодильник для десертів', 'Dessert display fridge'), cat: 'equip', price: 700, ic: '🍰', fridge: 1 },
  drinkfridge: { n: N('Холодильник‑витрина для напитков', 'Холодильник‑вітрина для напоїв', 'Drinks display fridge'), cat: 'equip', price: 450, ic: '🥤', fridge: 1 },
  freezer: { n: N('Морозильный ларь', 'Морозильна скриня', 'Chest freezer'), cat: 'equip', price: 350, ic: '❄️', freeze: 1 },
  icemaker: { n: N('Льдогенератор', 'Льодогенератор', 'Ice maker'), cat: 'equip', price: 600, ic: '🧊' },
  blender: { n: N('Блендер барный', 'Блендер барний', 'Bar blender'), cat: 'equip', price: 120, ic: '🌀' },
  dishwasher: { n: N('Посудомоечная машина', 'Посудомийна машина', 'Dishwasher'), cat: 'equip', price: 900, ic: '🫧' },
  oven: { n: N('Конвекционная печь', 'Конвекційна піч', 'Convection oven'), cat: 'equip', price: 650, ic: '🔥' },
  hotdog: { n: N('Гриль для хот‑догов', 'Гриль для хот‑догів', 'Hot dog grill'), cat: 'equip', price: 160, ic: '🌭' },
  kettle: { n: N('Кипятильник / кулер', 'Кип’ятильник / кулер', 'Water boiler'), cat: 'equip', price: 60, ic: '🫖' },
  beertap: { n: N('Пивная установка на 2 крана', 'Пивна установка на 2 крани', 'Beer tap, 2 lines'), cat: 'equip', price: 1200, ic: '🍺', svc: { every: 7, sku: 'linecleaner', n: N('Промывка линий', 'Промивання ліній', 'Line cleaning') } },
  fryer: { n: N('Фритюрница', 'Фритюрниця', 'Deep fryer'), cat: 'equip', price: 300, ic: '🍟', svc: { every: 3, sku: 'fryoil', n: N('Замена масла', 'Заміна олії', 'Oil change') } },
  music: { n: N('Акустика и микшер', 'Акустика й мікшер', 'Speakers & mixer'), cat: 'equip', price: 160, ic: '🔊' },
  shawgrill: { n: N('Гриль для шаурмы', 'Гриль для шаурми', 'Shawarma grill'), cat: 'equip', price: 700, ic: '🥙' },
  hood: { n: N('Вытяжка с фильтрами', 'Витяжка з фільтрами', 'Extractor hood'), cat: 'equip', price: 500, ic: '💨', svc: { every: 30, cost: 30, n: N('Замена жироуловителей', 'Заміна жироуловлювачів', 'New grease filters') } },
  lift: { n: N('Подъёмник двухстоечный', 'Підйомник двостійковий', 'Two‑post lift'), cat: 'equip', price: 3500, ic: '🏗', svc: { every: 90, cost: 80, n: N('Техосмотр подъёмника', 'Техогляд підйомника', 'Lift inspection') } },
  compressor: { n: N('Компрессор', 'Компресор', 'Compressor'), cat: 'equip', price: 600, ic: '🌬', svc: { every: 60, cost: 25, n: N('Замена масла компрессора', 'Заміна оливи компресора', 'Compressor oil') } },
  tirechanger: { n: N('Шиномонтажный станок', 'Шиномонтажний верстат', 'Tyre changer'), cat: 'equip', price: 1500, ic: '🛞' },
  balancer: { n: N('Балансировочный станок', 'Балансувальний верстат', 'Wheel balancer'), cat: 'equip', price: 1300, ic: '⚖️' },
  alignment: { n: N('Стенд развал‑схождения 3D', 'Стенд розвал‑сходження 3D', '3D wheel alignment'), cat: 'equip', price: 6000, ic: '📐' },
  tools: { n: N('Набор инструментов', 'Набір інструментів', 'Tool kit'), cat: 'equip', price: 500, ic: '🧰' },
  obdscan: { n: N('Диагностический OBD‑сканер', 'Діагностичний OBD‑сканер', 'OBD scanner'), cat: 'equip', price: 250, ic: '📟' },
  oilcollect: { n: N('Маслосборник', 'Мастилозбірник', 'Oil drain unit'), cat: 'equip', price: 180, ic: '🛢' },
  hpw: { n: N('Аппарат высокого давления', 'Апарат високого тиску', 'Pressure washer'), cat: 'equip', price: 1200, ic: '🚿', svc: { every: 30, cost: 40, n: N('Обслуживание помпы', 'Обслуговування помпи', 'Pump service') } },
  vacuum: { n: N('Пылесос моечный', 'Пилосос мийний', 'Wash vacuum'), cat: 'equip', price: 350, ic: '🌪' },
  foamgun: { n: N('Пеногенератор', 'Піногенератор', 'Foam lance'), cat: 'equip', price: 250, ic: '🫧' },
  watertreat: { n: N('Очистные сооружения', 'Очисні споруди', 'Water treatment'), cat: 'equip', price: 1500, ic: '♻️', svc: { every: 60, cost: 60, n: N('Чистка очистных', 'Чищення очисних', 'Treatment service') } },
  // furniture & look
  table: { n: N('Стол', 'Стіл', 'Table'), cat: 'furn', price: 80, ic: '🪵' },
  chair: { n: N('Стул', 'Стілець', 'Chair'), cat: 'furn', price: 35, ic: '🪑', seats: 1 },
  barstool: { n: N('Барный стул', 'Барний стілець', 'Bar stool'), cat: 'furn', price: 60, ic: '🪑', seats: 1 },
  sofa: { n: N('Диван', 'Диван', 'Sofa'), cat: 'furn', price: 350, ic: '🛋', seats: 3 },
  counter: { n: N('Барная стойка', 'Барна стійка', 'Bar counter'), cat: 'furn', price: 600, ic: '🧱' },
  shelf: { n: N('Стеллаж', 'Стелаж', 'Shelving'), cat: 'furn', price: 90, ic: '🗄' },
  sign: { n: N('Вывеска с подсветкой', 'Вивіска з підсвіткою', 'Lit sign'), cat: 'furn', price: 250, ic: '🪧', look: 0.08 },
  light: { n: N('Освещение зала', 'Освітлення залу', 'Hall lighting'), cat: 'furn', price: 120, ic: '💡', look: 0.05 },
  ac: { n: N('Кондиционер', 'Кондиціонер', 'Air conditioner'), cat: 'furn', price: 450, ic: '❄️', look: 0.06 },
  plants: { n: N('Растения и декор', 'Рослини й декор', 'Plants & decor'), cat: 'furn', price: 90, ic: '🪴', look: 0.04 },
  cams: { n: N('Камеры видеонаблюдения', 'Камери відеоспостереження', 'CCTV cameras'), cat: 'furn', price: 200, ic: '📹' },
  // safety
  extinguisher: { n: N('Огнетушитель ОП‑5 (на 1 год)', 'Вогнегасник ВП‑5 (на 1 рік)', 'Extinguisher (1 year)'), cat: 'safety', price: 18, ic: '🧯', expire: 365 },
  alarm: { n: N('Пожарная сигнализация', 'Пожежна сигналізація', 'Fire alarm'), cat: 'safety', price: 300, ic: '🚨' },
  exitsign: { n: N('Табличка «Выход» с подсветкой', 'Табличка «Вихід» з підсвіткою', 'Lit exit sign'), cat: 'safety', price: 25, ic: '🚪' },
  evacplan: { n: N('План эвакуации', 'План евакуації', 'Evacuation plan'), cat: 'safety', price: 30, ic: '🗺' },
  firstaid: { n: N('Аптечка (на 1 год)', 'Аптечка (на 1 рік)', 'First‑aid kit (1 year)'), cat: 'safety', price: 10, ic: '🩹', expire: 365 },
  thermo: { n: N('Термометры + журнал температур', 'Термометри + журнал температур', 'Thermometers + temperature log'), cat: 'safety', price: 8, ic: '🌡' },
};

// ---------------------------------------------------------------- services (Supplier → Services)
export const SERVICES = {
  pest: { n: N('Договор дезинсекции и дератизации (30 дней)', 'Договір дезінсекції та дератизації (30 днів)', 'Pest control contract (30 days)'), price: 45, days: 30, food: 1 },
  waste: { n: N('Вывоз отходов (30 дней)', 'Вивезення відходів (30 днів)', 'Waste collection (30 days)'), price: 30, days: 30 },
  oilwaste: { n: N('Утилизация отработки (30 дней)', 'Утилізація відпрацювання (30 днів)', 'Used oil disposal (30 days)'), price: 25, days: 30, garage: 1 },
  medbook: { n: N('Медкнижка сотруднику (на 1 год)', 'Медкнижка працівнику (на 1 рік)', 'Staff health certificate (1 year)'), price: 15, perStaff: 1 },
  deepclean: { n: N('Клининг: генеральная уборка', 'Клінінг: генеральне прибирання', 'Deep cleaning service'), price: 40, clean: 100 },
  repair: { n: N('Вызов мастера по технике', 'Виклик майстра з техніки', 'Equipment repair call'), price: 60, fix: 1 },
};

// ---------------------------------------------------------------- venue types and their menus
// uses: SKU → share of one pack per order; eq: equipment needed; mins: how long one service takes (garages)
const U = (o) => o;
export const VENUES = {
  kiosk: {
    n: N('Киоск «Напитки и снеки»', 'Кіоск «Напої та снеки»', 'Drinks & snacks kiosk'), ic: '🏪', size: 1, open: [7, 23], base: 9, staff: { n: N('Продавец', 'Продавець', 'Clerk'), wage: 2.6, per: 20 }, rent: 6, food: 1, permit: 60,
    need: ['pos', 'drinkfridge', 'shelf'],
    menu: [
      { id: 'water', n: N('Вода 0,5', 'Вода 0,5', 'Water 0.5'), price: 0.7, pop: 3, uses: U({ water: 1 / 12 }), eq: ['drinkfridge'] },
      { id: 'soda', n: N('Газировка', 'Газування', 'Soda'), price: 1.2, pop: 3, uses: U({ soda: 1 / 12 }), eq: ['drinkfridge'] },
      { id: 'energy', n: N('Энергетик', 'Енергетик', 'Energy drink'), price: 1.8, pop: 2, uses: U({ energy: 1 / 24 }), eq: ['drinkfridge'] },
      { id: 'chips', n: N('Чипсы', 'Чипси', 'Crisps'), price: 1.5, pop: 2, uses: U({ chips: 1 / 20 }), eq: ['shelf'] },
      { id: 'choco', n: N('Шоколадка', 'Шоколадка', 'Chocolate bar'), price: 1.2, pop: 2, uses: U({ choco: 1 / 30 }), eq: ['shelf'] },
      { id: 'gum', n: N('Жвачка', 'Жуйка', 'Gum'), price: 0.8, pop: 1.5, uses: U({ gum: 1 / 100 }), eq: [] },
      { id: 'icecream', n: N('Мороженое', 'Морозиво', 'Ice cream'), price: 1.4, pop: 2, uses: U({ icecream: 1 / 24 }), eq: ['freezer'] },
      { id: 'hotdog', n: N('Хот‑дог', 'Хот‑дог', 'Hot dog'), price: 1.8, pop: 2.5, uses: U({ sausage: 1 / 20, buns: 1 / 20, ketchup: 0.02, napkins: 1 / 500 }), eq: ['hotdog'] },
      { id: 'coffee3', n: N('Кофе 3в1', 'Кава 3в1', '3‑in‑1 coffee'), price: 0.8, pop: 1.5, uses: U({ coffee3: 1 / 100, cups250: 1 / 100, stirrers: 1 / 1000 }), eq: ['kettle'] },
    ],
  },
  coffee: {
    n: N('Кофейня', 'Кавʼярня', 'Coffee shop'), ic: '☕', size: 2, open: [8, 21], base: 14, staff: { n: N('Бариста', 'Бариста', 'Barista'), wage: 3.4, per: 14 }, rent: 16, food: 1, permit: 120,
    need: ['espresso', 'grinder', 'fridge', 'pos', 'counter'],
    menu: [
      { id: 'espresso', n: N('Эспрессо', 'Еспресо', 'Espresso'), price: 1.6, pop: 1.2, uses: U({ beans: 0.009, cups250: 0.01, sugar: 0.001, stirrers: 0.001 }), eq: ['espresso', 'grinder'] },
      { id: 'americano', n: N('Американо', 'Американо', 'Americano'), price: 1.8, pop: 2.4, uses: U({ beans: 0.009, cups350: 0.01, lids: 0.01, sugar: 0.001, stirrers: 0.001 }), eq: ['espresso', 'grinder'] },
      { id: 'cappuccino', n: N('Капучино', 'Капучино', 'Cappuccino'), price: 2.4, pop: 3, uses: U({ beans: 0.009, milk: 0.15, cups350: 0.01, lids: 0.01, sugar: 0.001 }), eq: ['espresso', 'grinder', 'fridge'] },
      { id: 'latte', n: N('Латте', 'Лате', 'Latte'), price: 2.6, pop: 2.8, uses: U({ beans: 0.009, milk: 0.22, cups350: 0.01, lids: 0.01, sugar: 0.001 }), eq: ['espresso', 'grinder', 'fridge'] },
      { id: 'flatwhite', n: N('Флэт уайт', 'Флет вайт', 'Flat white'), price: 2.7, pop: 1.4, uses: U({ beans: 0.016, milk: 0.12, cups250: 0.01, lids: 0.01 }), eq: ['espresso', 'grinder', 'fridge'] },
      { id: 'oatlatte', n: N('Латте на овсяном', 'Лате на вівсяному', 'Oat latte'), price: 3, pop: 1, uses: U({ beans: 0.009, oatmilk: 0.22, cups350: 0.01, lids: 0.01 }), eq: ['espresso', 'grinder'] },
      { id: 'raf', n: N('Раф', 'Раф', 'Raf coffee'), price: 3, pop: 1.6, uses: U({ beans: 0.009, cream: 0.12, syrup: 0.02, cups350: 0.01, lids: 0.01 }), eq: ['espresso', 'grinder', 'fridge'], unlock: 'raf' },
      { id: 'lavender', n: N('Лавандовый раф', 'Лавандовий раф', 'Lavender raf'), price: 3.4, pop: 1.3, uses: U({ beans: 0.009, cream: 0.12, lavsyrup: 0.02, cups350: 0.01, lids: 0.01 }), eq: ['espresso', 'grinder', 'fridge'], unlock: 'lavender' },
      { id: 'matcha', n: N('Матча‑латте', 'Матча‑лате', 'Matcha latte'), price: 3.2, pop: 1.1, uses: U({ matcha: 0.05, milk: 0.2, cups350: 0.01, lids: 0.01 }), eq: ['fridge'], unlock: 'matcha' },
      { id: 'tonic', n: N('Эспрессо‑тоник', 'Еспресо‑тонік', 'Espresso tonic'), price: 3, pop: 1, uses: U({ beans: 0.009, tonic: 1 / 30, cups350: 0.01, straws: 1 / 500 }), eq: ['espresso', 'grinder', 'icemaker'], unlock: 'tonic' },
      { id: 'cocoa', n: N('Какао', 'Какао', 'Hot chocolate'), price: 2.2, pop: 1.2, uses: U({ cocoa: 0.025, milk: 0.22, cups350: 0.01, lids: 0.01 }), eq: ['espresso', 'fridge'] },
      { id: 'tea', n: N('Чай', 'Чай', 'Tea'), price: 1.2, pop: 1, uses: U({ tea: 0.01, lemons: 0.01, cups350: 0.01, sugar: 0.001 }), eq: ['kettle'] },
      { id: 'lemonade', n: N('Лимонад', 'Лимонад', 'Lemonade'), price: 2.5, pop: 1.2, uses: U({ lemons: 0.06, mint: 0.03, syrup: 0.02, cups350: 0.01, straws: 1 / 500 }), eq: ['icemaker'] },
      { id: 'croissant', n: N('Круассан', 'Круасан', 'Croissant'), price: 2, pop: 1.8, uses: U({ croissant: 1 / 20, napkins: 1 / 500 }), eq: ['freezer', 'oven'] },
      { id: 'cheesecake', n: N('Чизкейк', 'Чізкейк', 'Cheesecake'), price: 3.5, pop: 1.2, uses: U({ cheesecake: 1 / 12, napkins: 1 / 500 }), eq: ['showcase'] },
    ],
  },
  bar: {
    n: N('Бар', 'Бар', 'Bar'), ic: '🍺', size: 2, open: [17, 3], base: 12, staff: { n: N('Бармен', 'Бармен', 'Bartender'), wage: 3.8, per: 12 }, rent: 18, food: 1, permit: 200,
    need: ['beertap', 'fridge', 'icemaker', 'pos', 'counter', 'dishwasher'],
    menu: [
      { id: 'beer', n: N('Пиво разливное 0,5', 'Пиво розливне 0,5', 'Draft beer 0.5'), price: 3, pop: 4, uses: U({ keg: 1 / 60, glasses: 0.002 }), eq: ['beertap'] },
      { id: 'cider', n: N('Сидр', 'Сидр', 'Cider'), price: 3.5, pop: 1.5, uses: U({ cider: 1 / 12, glasses: 0.002 }), eq: ['fridge'] },
      { id: 'whiskycola', n: N('Виски‑кола', 'Віскі‑кола', 'Whisky & cola'), price: 5, pop: 2, uses: U({ whisky: 0.07, cola: 1 / 45, glasses: 0.002, straws: 1 / 500 }), eq: ['icemaker'] },
      { id: 'mojito', n: N('Мохито', 'Мохіто', 'Mojito'), price: 5.5, pop: 2, uses: U({ rum: 0.07, lime: 0.05, mint: 0.04, sugar: 0.002, cola: 1 / 90, glasses: 0.002, straws: 1 / 500 }), eq: ['icemaker'] },
      { id: 'negroni', n: N('Негрони', 'Негроні', 'Negroni'), price: 7, pop: 1, uses: U({ gin: 0.05, glasses: 0.002 }), eq: ['icemaker'], unlock: 'negroni' },
      { id: 'mulled', n: N('Глинтвейн', 'Глінтвейн', 'Mulled wine'), price: 4, pop: 1.2, uses: U({ wine: 0.2, lemons: 0.02, glasses: 0.002 }), eq: ['kettle'], unlock: 'mulled' },
      { id: 'nachos', n: N('Начос с сыром', 'Начос із сиром', 'Nachos with cheese'), price: 4, pop: 1.6, uses: U({ nachos: 0.1, cheese: 0.05, napkins: 1 / 500 }), eq: ['oven'] },
      { id: 'croutons', n: N('Гренки', 'Грінки', 'Croutons'), price: 3, pop: 1.8, uses: U({ croutons: 1 / 20, salt: 0.002 }), eq: ['fryer'] },
      { id: 'wings', n: N('Крылышки', 'Крильця', 'Wings'), price: 6, pop: 1.5, uses: U({ wings: 0.25, sauce: 0.03, napkins: 1 / 500 }), eq: ['fryer', 'fridge'] },
    ],
  },
  shawarma: {
    n: N('Шаурмичная', 'Шаурмічна', 'Shawarma place'), ic: '🥙', size: 2, open: [10, 24], base: 13, staff: { n: N('Повар', 'Кухар', 'Cook'), wage: 3, per: 14 }, rent: 12, food: 1, permit: 120,
    need: ['shawgrill', 'fridge', 'pos', 'hood'],
    menu: [
      { id: 'shawarma', n: N('Шаурма классическая', 'Шаурма класична', 'Classic shawarma'), price: 3.5, pop: 5, uses: U({ chicken: 0.15, lavash: 1 / 20, veg: 0.08, sauce: 0.04, foil: 0.01, gloves: 0.005 }), eq: ['shawgrill', 'fridge'] },
      { id: 'shawcheese', n: N('Шаурма с сыром', 'Шаурма з сиром', 'Shawarma with cheese'), price: 4, pop: 2.5, uses: U({ chicken: 0.15, lavash: 1 / 20, veg: 0.08, sauce: 0.04, cheese: 0.04, foil: 0.01, gloves: 0.005 }), eq: ['shawgrill', 'fridge'], unlock: 'shawarma_cheese' },
      { id: 'hotdog', n: N('Хот‑дог', 'Хот‑дог', 'Hot dog'), price: 2, pop: 1.5, uses: U({ sausage: 1 / 20, buns: 1 / 20, ketchup: 0.02, napkins: 1 / 500 }), eq: ['hotdog'] },
      { id: 'fries', n: N('Картофель фри', 'Картопля фрі', 'Fries'), price: 2, pop: 2.5, uses: U({ fries: 0.06, salt: 0.002, foil: 0.01 }), eq: ['fryer', 'freezer'] },
      { id: 'cola', n: N('Кола 0,3', 'Кола 0,3', 'Cola 0.3'), price: 1.2, pop: 2.5, uses: U({ cola: 1 / 30, cups250: 0.01, straws: 1 / 500 }), eq: ['fridge'] },
    ],
  },
  sto: {
    n: N('СТО', 'СТО', 'Car service'), ic: '🔧', size: 4, open: [9, 19], base: 3.4, staff: { n: N('Автомеханик', 'Автомеханік', 'Mechanic'), wage: 4.5, per: 1.6 }, rent: 22, garage: 1, permit: 150,
    need: ['lift', 'compressor', 'tools', 'pos'],
    menu: [
      { id: 'oilchange', n: N('Замена масла и фильтра', 'Заміна оливи та фільтра', 'Oil & filter change'), price: 55, pop: 3, uses: U({ oil: 1, oilf: 1, rags: 0.1, gloves: 0.02 }), eq: ['lift', 'oilcollect', 'tools'] },
      { id: 'tires', n: N('Шиномонтаж 4 колеса', 'Шиномонтаж 4 колеса', 'Tyre fitting ×4'), price: 25, pop: 3, uses: U({ weights: 0.12, gloves: 0.02 }), eq: ['tirechanger', 'balancer', 'compressor'] },
      { id: 'balance', n: N('Балансировка', 'Балансування', 'Wheel balancing'), price: 12, pop: 1.5, uses: U({ weights: 0.08 }), eq: ['balancer'] },
      { id: 'brakes', n: N('Замена тормозных колодок', 'Заміна гальмівних колодок', 'Brake pads'), price: 65, pop: 2, uses: U({ pads: 1, brakeclean: 0.5, rags: 0.1 }), eq: ['lift', 'tools'] },
      { id: 'airfilter', n: N('Замена воздушного фильтра', 'Заміна повітряного фільтра', 'Air filter'), price: 10, pop: 1.5, uses: U({ airf: 1 }), eq: ['tools'] },
      { id: 'align', n: N('Развал‑схождение', 'Розвал‑сходження', 'Wheel alignment'), price: 30, pop: 1.5, uses: U({}), eq: ['alignment', 'lift'] },
      { id: 'diag', n: N('Компьютерная диагностика', 'Компʼютерна діагностика', 'Computer diagnostics'), price: 20, pop: 2, uses: U({}), eq: ['obdscan'], unlock: 'obd' },
    ],
  },
  carwash: {
    n: N('Автомойка', 'Автомийка', 'Car wash'), ic: '🚿', size: 3, open: [8, 21], base: 3.2, staff: { n: N('Мойщик', 'Мийник', 'Washer'), wage: 2.8, per: 2 }, rent: 14, garage: 1, permit: 120,
    need: ['hpw', 'foamgun', 'compressor', 'pos', 'watertreat'],
    menu: [
      { id: 'body', n: N('Мойка кузова', 'Мийка кузова', 'Exterior wash'), price: 8, pop: 4, uses: U({ shampoo: 0.04, foam: 0.015, microfiber: 0.02 }), eq: ['hpw', 'foamgun'] },
      { id: 'complex', n: N('Комплекс: кузов + салон', 'Комплекс: кузов + салон', 'Full wash'), price: 18, pop: 2.5, uses: U({ shampoo: 0.04, foam: 0.015, interior: 0.02, microfiber: 0.04 }), eq: ['hpw', 'foamgun', 'vacuum'] },
      { id: 'wax', n: N('Воск', 'Віск', 'Wax'), price: 12, pop: 1.2, uses: U({ wax: 0.04, microfiber: 0.02 }), eq: ['hpw'] },
      { id: 'interior', n: N('Химчистка салона', 'Хімчистка салону', 'Interior deep clean'), price: 35, pop: 0.8, uses: U({ interior: 0.15, microfiber: 0.1 }), eq: ['vacuum'] },
    ],
  },
};
// where you open it: more people walk by, the rent is higher
export const SPOTS = [
  { id: 'res', n: N('Спальный район', 'Спальний район', 'Residential area'), traffic: 1, rent: 1 },
  { id: 'center', n: N('Центр города', 'Центр міста', 'City centre'), traffic: 1.6, rent: 2.2 },
  { id: 'metro', n: N('У метро / у ТЦ', 'Біля метро / ТЦ', 'By the metro / mall'), traffic: 1.9, rent: 2.8 },
  { id: 'road', n: N('У трассы', 'Біля траси', 'By the highway'), traffic: 1.3, rent: 0.8, garage: 1 },
];
// what the Supplier shows per category
export const SUP_CATS = [
  { id: 'equip', n: N('Техника', 'Техніка', 'Equipment'), ic: '⚙️' },
  { id: 'furn', n: N('Мебель и интерьер', 'Меблі та інтерʼєр', 'Furniture & look'), ic: '🪑' },
  { id: 'food', n: N('Продукты и напитки', 'Продукти й напої', 'Food & drinks'), ic: '🥫' },
  { id: 'pack', n: N('Упаковка и посуда', 'Пакування й посуд', 'Packaging'), ic: '🥤' },
  { id: 'parts', n: N('Автозапчасти и масла', 'Автозапчастини й оливи', 'Car parts & oils'), ic: '🛢' },
  { id: 'clean', n: N('Химия и обслуживание', 'Хімія та обслуговування', 'Cleaning & upkeep'), ic: '🧴' },
  { id: 'safety', n: N('Пожарная безопасность и СЭС', 'Пожежна безпека й СЕС', 'Fire & sanitary safety'), ic: '🧯' },
  { id: 'svc', n: N('Услуги и договоры', 'Послуги й договори', 'Services & contracts'), ic: '📋' },
];
