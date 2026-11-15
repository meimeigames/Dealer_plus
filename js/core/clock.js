// Game clock speed. `speed` = game minutes that pass in one real minute (60 = the old 1 s → 1 min, a game day in
// 24 real minutes). The default is 12: a game day lasts 2 real hours. Things the player thinks of in real minutes
// (a job application cooldown, a buyer's complaint window, wholesale box refreshes) use rt(), so they keep their
// real length at any speed.
import { G } from './state.js';
import { setTimeK } from './i18n.js';

export const DEFAULT_SPEED = 12;
export const SPEEDS = [
  { v: 60, n: ['24 мин', '24 хв', '24 min'] },
  { v: 24, n: ['1 час', '1 година', '1 hour'] },
  { v: 12, n: ['2 часа', '2 години', '2 hours'] },
  { v: 4, n: ['6 часов', '6 годин', '6 hours'] },
  { v: 1, n: ['24 часа', '24 години', '24 hours'] },
];
export const speed = () => { const v = +G.s?.settings?.speed; return SPEEDS.some((x) => x.v === v) ? v : DEFAULT_SPEED; };
// game minutes that pass during `realMin` real minutes
export const rt = (realMin) => Math.max(1, Math.round(realMin * speed()));
// keeps the duration formatter (real time on screen) in step with the clock; `mult` = difficulty speed‑up
export const syncClock = (mult = 1) => setTimeK(60 / (speed() * mult));
