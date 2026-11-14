// On‑screen keyboard (iOS / Android): while it is open the phone screen is fitted into the visible area above it,
// so sheets, dialogs, the PC lock screen and mini‑games with inputs move up instead of hiding behind the keys.
// Enter in a field presses the main button next to it (no more swiping down to reach "OK").
const vv = typeof window !== 'undefined' ? window.visualViewport : null;
const root = document.documentElement;
const typing = () => !!document.activeElement?.matches?.('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]), textarea');
function upd() {
  if (!vv) return;
  const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  const open = kb > 90 && typing();
  document.body.classList.toggle('kb-open', open);
  root.style.setProperty('--vvtop', (open ? Math.round(vv.offsetTop) : 0) + 'px');
  root.style.setProperty('--vvh', (open ? Math.round(vv.height) : window.innerHeight) + 'px');
}
function onEnter(e) {
  if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;
  const t = e.target;
  if (!t?.matches?.('input') || t.dataset.pin != null) return; // the PC desktop handles its own fields
  let btn = t.dataset.enter ? document.querySelector(t.dataset.enter) : null;
  if (!btn) {
    const box = t.closest('.row, .lk-in, .sheet, .dialog, .card, .mini');
    btn = box && [...box.querySelectorAll('button')].find((b) => !b.disabled && !b.classList.contains('dark') && !b.closest('.mhead'));
  }
  if (!btn) return;
  e.preventDefault();
  btn.click();
}
export function initKeyboard() {
  if (vv) { vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd); }
  document.addEventListener('focusin', (e) => {
    if (!e.target.matches?.('input, textarea')) return;
    for (const ms of [60, 320, 650]) setTimeout(() => { upd(); if (document.body.classList.contains('kb-open') && document.activeElement === e.target) e.target.scrollIntoView?.({ block: 'nearest' }); }, ms);
  });
  document.addEventListener('focusout', () => setTimeout(upd, 150));
  document.addEventListener('keydown', onEnter, true);
  upd();
}
