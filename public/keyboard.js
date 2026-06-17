const KEYS = [
  '1234567890'.split(''),
  'qwertyuiop'.split(''),
  'asdfghjkl'.split(''),
  'zxcvbnm'.split(''),
];
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mountKeyboard({ initial = '', onType, onSubmit, onCancel }) {
  let value = initial;
  const root = el(`<div class="overlay"><div class="modal kb">
    <h3>Email this degree sheet to you</h3>
    <div class="kb-display"></div>
    <div class="kb-keys"></div>
    <div class="kb-actions">
      <button class="kb-cancel">Cancel</button>
      <button class="kb-send" disabled>Send it</button>
    </div></div></div>`);
  const display = root.querySelector('.kb-display');
  const keys = root.querySelector('.kb-keys');
  const send = root.querySelector('.kb-send');

  const refresh = () => { display.textContent = value || ' '; send.disabled = !EMAIL_RE.test(value); onType?.(value); };
  const press = (ch) => { value += ch; refresh(); };

  for (const row of KEYS) {
    const r = el(`<div class="kb-row"></div>`);
    for (const k of row) { const b = el(`<button class="kb-key">${k}</button>`); b.onclick = () => press(k); r.appendChild(b); }
    keys.appendChild(r);
  }
  const util = el(`<div class="kb-row">
    <button class="kb-key wide">@</button><button class="kb-key wide">.</button>
    <button class="kb-key wide">.com</button><button class="kb-key wide">.edu</button>
    <button class="kb-key del">DELETE</button></div>`);
  const [at, dot, dcom, dedu, del] = util.querySelectorAll('button');
  at.onclick = () => press('@'); dot.onclick = () => press('.');
  dcom.onclick = () => press('.com'); dedu.onclick = () => press('.edu');
  del.onclick = () => { value = value.slice(0, -1); refresh(); };
  keys.appendChild(util);

  root.querySelector('.kb-cancel').onclick = () => onCancel?.();
  send.onclick = () => onSubmit?.(value);
  root.onclick = (e) => { if (e.target === root) onCancel?.(); };
  refresh();
  return root;
}
