// Card designs, like the paid designs in mono: a card keeps its perks, only the look changes. Some are free,
// most cost a little, a few (limited editions) can only be found on old drives and phones.
import { G, emit } from '../core/state.js';
import { T } from '../core/i18n.js';
import { spend } from './player.js';

const W = (id) => `url(assets/walls/${id}.jpg) center/cover`;
export const CARD_SKINS = [
  { id: 'matte', n: ['Матовый чёрный', 'Матовий чорний', 'Matte black'], css: 'linear-gradient(145deg,#1c1c1f,#0b0b0d)', fg: '#f1f1f1', price: 0 },
  { id: 'snow', n: ['Белый', 'Білий', 'White'], css: 'linear-gradient(145deg,#ffffff,#e6e8ee)', fg: '#111', price: 0 },
  { id: 'iris', n: ['Перламутр', 'Перламутр', 'Iridescent'], css: 'linear-gradient(120deg,#f8d6ff,#c3e7ff 35%,#d7ffe6 65%,#fff1c7)', fg: '#2a2340', price: 3 },
  { id: 'gold', n: ['Золото', 'Золото', 'Gold'], css: 'linear-gradient(135deg,#fff3b0,#d4a017 45%,#fff0a8 60%,#b8860b)', fg: '#3a2a00', price: 6 },
  { id: 'carbon', n: ['Карбон', 'Карбон', 'Carbon'], css: 'repeating-linear-gradient(45deg,#1b1d22 0 6px,#111216 6px 12px)', fg: '#e5e7eb', price: 4 },
  { id: 'marble', n: ['Мрамор', 'Мармур', 'Marble'], css: `${W('marble')}`, fg: '#f5e7c8', price: 5 },
  { id: 'neon', n: ['Неон', 'Неон', 'Neon'], css: 'linear-gradient(135deg,#0f0c29,#302b63 50%,#24243e),radial-gradient(circle at 80% 20%,#ff00cc 0,transparent 40%)', fg: '#7ef9ff', price: 4 },
  { id: 'aurora', n: ['Северное сияние', 'Північне сяйво', 'Aurora'], css: 'linear-gradient(135deg,#022c22,#10b981 40%,#6366f1 80%,#a855f7)', fg: '#ecfeff', price: 4 },
  { id: 'sakura', n: ['Сакура', 'Сакура', 'Sakura'], css: W('sakura'), fg: '#5a1033', price: 5 },
  { id: 'space', n: ['Космос', 'Космос', 'Space'], css: W('milkyway'), fg: '#e0e7ff', price: 5 },
  { id: 'synth', n: ['Синтвейв', 'Синтвейв', 'Synthwave'], css: W('synthwave'), fg: '#fff', price: 6 },
  { id: 'cash', n: ['Пачки денег', 'Пачки грошей', 'Cash stacks'], css: W('cash'), fg: '#fff', price: 8 },
  { id: 'car', n: ['Суперкар', 'Суперкар', 'Supercar'], css: W('supercar'), fg: '#fff', price: 7 },
  { id: 'cat', n: ['Котики', 'Котики', 'Cats'], css: "radial-gradient(circle at 20% 30%,#ffd6e7 0 12%,transparent 13%),radial-gradient(circle at 70% 70%,#ffd6e7 0 10%,transparent 11%),linear-gradient(135deg,#ff9ac7,#ff5c8a)", fg: '#4a0d23', price: 3, deco: '🐱' },
  { id: 'pixel', n: ['8‑бит', '8‑біт', '8‑bit'], css: 'repeating-conic-gradient(#3b82f6 0 25%,#1d4ed8 0 50%) 0 0/16px 16px', fg: '#fff', price: 3, deco: '👾' },
  { id: 'camo', n: ['Камуфляж', 'Камуфляж', 'Camo'], css: 'radial-gradient(circle at 20% 30%,#4d5b2e 0 18%,transparent 19%),radial-gradient(circle at 70% 60%,#2e3a1c 0 22%,transparent 23%),radial-gradient(circle at 40% 80%,#7a6a3f 0 15%,transparent 16%),#5f6b3a', fg: '#f4f1e1', price: 3 },
  // limited editions: only found on drives (files_extra loot)
  { id: 'glitch', n: ['Глитч (лимитка)', 'Глітч (лімітка)', 'Glitch (limited)'], css: 'linear-gradient(90deg,#000 0 30%,#ff0050 30% 32%,#000 32% 60%,#00f0ff 60% 61%,#000 61%)', fg: '#fff', price: -1, deco: '⚡' },
  { id: 'holo', n: ['Голограмма (лимитка)', 'Голограма (лімітка)', 'Hologram (limited)'], css: 'conic-gradient(from 45deg,#ff9a9e,#fad0c4,#a1c4fd,#c2e9fb,#d4fc79,#96e6a1,#ff9a9e)', fg: '#1f2937', price: -1, deco: '✨' },
  { id: 'founder', n: ['Основатель (лимитка)', 'Засновник (лімітка)', 'Founder (limited)'], css: 'linear-gradient(135deg,#111 0,#111 60%,#d4af37 60%,#f7e7a1 75%,#d4af37 90%)', fg: '#f7e7a1', price: -1, deco: '👑' },
];
const B = () => G.s.bank;
export const skinState = () => (B().skins ||= { own: [], on: {} });
export const findSkin = (id) => CARD_SKINS.find((x) => x.id === id) || null;
export const skinOn = (key) => findSkin(skinState().on[key]);
export const ownsSkin = (id) => { const k = findSkin(id); return !!k && (k.price === 0 || skinState().own.includes(id)); };
export const limitedSkins = () => CARD_SKINS.filter((x) => x.price < 0);
export function buySkin(id) {
  const k = findSkin(id);
  if (!k || k.price < 0) return { ok: false };
  if (ownsSkin(id)) return { ok: true };
  if (!spend(k.price, 'bank', T(`Дизайн карты «${k.n[0]}»`, `Дизайн картки «${k.n[1]}»`, `Card design “${k.n[2]}”`))) return { ok: false, msg: T('Не хватает денег', 'Не вистачає грошей', 'Not enough money') };
  skinState().own.push(id); emit('bank');
  return { ok: true };
}
export function setSkin(key, id) {
  if (id && !ownsSkin(id)) return false;
  if (id) skinState().on[key] = id; else delete skinState().on[key];
  emit('bank');
  return true;
}
export function unlockSkin(id) { const st = skinState(); if (!st.own.includes(id)) st.own.push(id); emit('bank'); }
// inline style + class for a card slide wearing a design
export const skinAttr = (key) => { const k = skinOn(key); return k ? { cls: 'skinned', style: `--skin:${k.css};--skin-fg:${k.fg}`, deco: k.deco || '' } : { cls: '', style: '', deco: '' }; };
