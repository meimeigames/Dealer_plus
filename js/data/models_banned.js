// Forbidden goods — only ever sold in the Shade (nogen: they never show up in normal feeds, boxes or containers).
// banned: what kind of contraband it is (used for flavour and for which traces it carries).
export function buildBanned(add) {
  const e = (name, price, year, t, banned, o = {}) => add('electronics', o.brand || '', name, price, year, { t }, { colors: ['black'], vars: [['', 1]], nogen: true, banned, fixed: true, ...o });
  const x = (name, price, year, sprite, banned, o = {}) => add('misc', o.brand || '', name, price, year, { sprite }, { colors: ['col'], vars: [['', 1]], nogen: true, banned, fixed: true, tier: 'cheap', ...o });
  e('Глушилка связи «Тишина‑8»', 180, 2023, 'keyfob', 'jammer', { brand: 'NoSignal' });
  e('Шпионская камера‑ручка', 60, 2023, 'keyfob', 'spy', { brand: 'SpyPen' });
  e('Антирадар с подавителем лазера', 240, 2022, 'keyfob', 'radar', { brand: 'Stelth' });
  e('Сканер полицейских раций', 320, 2021, 'keyfob', 'scanner', { brand: 'Uniden‑X' });
  e('Корректор пробега («скрутка»)', 210, 2022, 'keyfob', 'odometer', { brand: 'MileFix' });
  e('Электрошокер без сертификата', 70, 2023, 'keyfob', 'shocker', { brand: 'Молния' });
  x('Рамки‑невидимки для номеров', 90, 2023, 'x1_lighter', 'plates', { brand: 'AntiCam' });
  x('Стробоскопы‑«мигалки» для авто', 110, 2023, 'x1_lighter', 'strobes', { brand: 'FlashPro' });
  x('Пиротехника без сертификата (ящик)', 150, 2024, 'x1_lighter', 'fireworks', { brand: 'Салют‑Опт' });
  x('Немаркированные сигареты (50 блоков)', 400, 2024, 'x1_lighter', 'cigs', { brand: '' });
  x('Красная икра без маркировки (1 кг)', 260, 2024, 'x1_lighter', 'caviar', { brand: '' });
  // wholesale boxes: a lot of forbidden goods in one box — expensive, and buyers snap them up (liquid: faster buyers)
  const o = (name, price, kind, bulk, unit) => x(name, price, 2025, 'x1_lighter', 'opt_' + kind, { brand: '', bulk, unit, liquid: 1.8, tier: 'mid' });
  o('Коробки немаркированных сигарет (500 блоков)', 3800, 'cigs', 500, ['блоков', 'блоків', 'cartons']);
  o('Ящики немаркированного алкоголя (60 бутылок)', 1300, 'alco', 60, ['бутылок', 'пляшок', 'bottles']);
  o('Партия поддельного парфюма (80 флаконов)', 2600, 'perfume', 80, ['флаконов', 'флаконів', 'bottles']);
  o('Коробки вейпов без сертификата (300 шт)', 2200, 'vapes', 300, ['шт', 'шт', 'pcs']);
  o('Партия глушилок связи (20 шт)', 3400, 'jammer', 20, ['шт', 'шт', 'pcs']);
  o('Партия антирадаров с подавителем (25 шт)', 5200, 'radar', 25, ['шт', 'шт', 'pcs']);
  o('Партия контрафактных кроссовок (40 пар)', 2800, 'sneakers', 40, ['пар', 'пар', 'pairs']);
  o('Паллета пиротехники без сертификата (12 ящиков)', 1700, 'fireworks', 12, ['ящиков', 'ящиків', 'crates']);
  o('Партия красной икры без маркировки (25 кг)', 5900, 'caviar', 25, ['кг', 'кг', 'kg']);
  o('Партия «серых» смартфонов без пошлины (15 шт)', 6500, 'phones', 15, ['шт', 'шт', 'pcs']);
}
// photo prompts for scripts/gen_photos_fal.py (clean shots)
export const BANNED_PROMPTS = {
  jammer: 'a black handheld cell phone signal jammer with six antennas, on a wooden table, amateur photo for a second-hand listing',
  spy: 'a black ballpoint pen with a tiny hidden camera lens near the clip, on a desk next to a USB cable, amateur listing photo',
  radar: 'a car radar detector device with a small display, mounted on a windshield bracket, amateur listing photo on a car seat',
  scanner: 'a handheld police radio scanner with a long rubber antenna and keypad, on a table, amateur listing photo',
  odometer: 'a small black OBD diagnostic tool box with cables and connectors, on a garage workbench, amateur listing photo',
  shocker: 'a black handheld electric stun device with two metal prongs on top, on a table, amateur listing photo',
  plates: 'two black plastic license plate frames with tinted covers, on a garage floor, amateur listing photo',
  strobes: 'a set of red and blue LED strobe lights for a car dashboard with a cable, on a car seat, amateur listing photo',
  fireworks: 'a cardboard box full of fireworks rockets and firecrackers without labels, in a garage, amateur listing photo',
  cigs: 'a big cardboard box filled with cartons of cigarettes without excise stamps, in a garage, amateur listing photo',
  caviar: 'a one kilogram tin can of red salmon caviar without labels, opened, on a kitchen table, amateur listing photo',
  opt_cigs: 'a stack of big brown cardboard boxes, the top one open and full of cigarette cartons without excise stamps, in a dim garage, amateur phone photo',
  opt_alco: 'several cardboard crates of vodka and whisky bottles without excise stamps or labels, on a garage floor, amateur phone photo',
  opt_perfume: 'an open cardboard box packed with dozens of identical perfume bottles in plain boxes, on a warehouse table, amateur phone photo',
  opt_vapes: 'an open cardboard box filled with hundreds of colourful disposable vape pens in plastic packs, on a garage workbench, amateur phone photo',
  opt_jammer: 'an open cardboard box with twenty identical black handheld signal jammers with antennas wrapped in bubble wrap, on a table, amateur phone photo',
  opt_radar: 'an open cardboard box full of identical car radar detectors in retail boxes, in the trunk of a car, amateur phone photo',
  opt_sneakers: 'a pile of cardboard boxes with counterfeit sneakers, the top box open with white sneakers inside, in a garage, amateur phone photo',
  opt_fireworks: 'a pallet with a dozen cardboard crates of fireworks without labels, wrapped in stretch film, in a warehouse, amateur phone photo',
  opt_caviar: 'an open styrofoam box with ice and many unlabeled tin cans of red caviar, on a garage table, amateur phone photo',
  opt_phones: 'an open cardboard box with fifteen sealed smartphone retail boxes stacked inside, on a car seat, amateur phone photo',
};
