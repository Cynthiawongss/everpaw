/* EverPaw Home — everything around the room. The room fills the window; controls float over it and step back when you stop moving. */
import { createWorld, ROOMS, THINGS, SHOP, SPECIES, coatFromPhoto } from './world.js?v=48';
import { STR, ROOM_TEXT, THING_TEXT, SPECIES_TEXT, PATTERNS } from './data.js?v=48';
import { createSound } from './sound.js?v=48';

const KEY = 'everpaw.home.v3', LKEY = 'everpaw.lang', SKEY = 'everpaw.sound';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* nothing stored */ } } };

/* ---------- language ---------- */

let lang = store.get(LKEY) === 'zh' ? 'zh' : 'en';
const zh = () => lang === 'zh';
const L = (pair) => pair[zh() ? 1 : 0];
function t(k, v) { let s = L(STR[k] || [k, k]); if (v) for (const p in v) s = s.split('{' + p + '}').join(v[p]); return s; }
const money = (n) => '$' + n.toFixed(2);
const day = (ts, long) => new Date(ts).toLocaleDateString(zh() ? 'zh-CN' : 'en-US', long ? { year: 'numeric', month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric' });
const lower = (s) => (zh() ? s : s.charAt(0).toLowerCase() + s.slice(1));
const tn = (id) => lower(L(THING_TEXT[id].name)), rn = (id) => lower(L(ROOM_TEXT[id].name));

/* ---------- state ---------- */

let S = null;
const ui = { caption: '', sel: null, trial: null, draft: null, step: 0, panel: null, modal: false };
let toastTimer = null, quietTimer = null;
function load() { try { const s = JSON.parse(store.get(KEY)); if (s && s.v === 3 && s.pet) return migrate(s); } catch (e) { /* none */ } return null; }
/* Homes saved before the rooms were rebuilt: move them into the nearest new room; their things go to the cupboard, nothing is lost. */
function migrate(s) {
  const map = { nook: 'bay', garden: 'glass', dusk: 'attic' }, to = (id) => (ROOMS[id] ? id : map[id] || 'bay');
  if (!ROOMS[s.room]) { s.room = to(s.room); s.rooms = {}; }
  (s.journal || []).forEach((e) => { if (e.room) e.room = to(e.room); });
  return s;
}
function save() { if (!store.set(KEY, JSON.stringify(S))) toast(t('save_fail')); }
const n = () => S.pet.name;
const forced = new URLSearchParams(location.search).get('light');
function phase() { if (forced) return forced; const h = new Date().getHours(); return h >= 20 || h < 6 ? 'night' : h >= 17 ? 'evening' : 'day'; }
const wide = () => window.innerWidth > 900;

function defaults(roomId) { const R = ROOMS[roomId]; return R.items.map(([id, x, z, r]) => ({ id, x, z, r })).concat([{ id: 'water', x: R.spots.water[0], z: R.spots.water[1], r: 0 }, { id: 'food', x: R.spots.food[0], z: R.spots.food[1], r: 0 }]); }
function layout() { S.rooms = S.rooms || {}; return S.rooms[S.room] || (S.rooms[S.room] = defaults(S.room)); }
const placed = (id) => layout().find((i) => i.id === id);
const available = () => [...new Set(ROOMS[S.room].items.map((i) => i[0]).concat(S.owned.map((i) => i.id)))];
const fitsPet = (id) => !THING_TEXT[id].only || THING_TEXT[id].only === S.pet.species;
const making = () => !S;

/* ---------- sound ---------- */

const sound = createSound();
sound.setOn(store.get(SKEY) !== 'off');
document.addEventListener('pointerdown', () => sound.wake(), { capture: true });

/* ---------- the 3D world ---------- */

let W = null;
try { W = createWorld(); } catch (e) { if (window.console) console.warn('3D failed to start:', e && e.message); }
const shown = { room: null, pet: null, items: null, photo: undefined };
const thumbs = new Map();
function thumb(kind, id, extra) {
  if (kind === 'room') return 'rooms/' + id + '_preview.png?v=48';
  const key = kind + ':' + id + ':' + (extra || '');
  if (!thumbs.has(key) && W) { try { thumbs.set(key, kind === 'thing' ? W.snapThing(id, extra) : W.snapPet(JSON.parse(id))); } catch (e) { thumbs.set(key, ''); } }
  return thumbs.get(key) || '';
}
const petDef = (p) => ({ species: p.species, look: p.look, scale: p.scale || 1 });
const petKey = (p) => JSON.stringify(petDef(p));
const current = () => (making() ? { room: ui.draft.room, pet: ui.draft, items: defaults(ui.draft.room), fedAt: 0 } : { room: S.room, pet: S.pet, items: layout(), fedAt: S.fedAt });

function syncWorld() {
  if (!W) return;
  const src = current(), photo = src.pet.photo || null, pk = petKey(src.pet), ik = JSON.stringify(src.items);
  if (shown.photo !== photo) { shown.photo = photo; W.setPhoto(photo); }
  if (shown.room !== src.room) { shown.room = src.room; W.setRoom(src.room); shown.items = null; }
  if (shown.items !== ik) { shown.items = ik; W.setItems(src.items); }
  if (shown.pet !== pk) { shown.pet = pk; W.setPet(petDef(src.pet)); }
  W.setPhase(phase()); W.setFed(src.fedAt ? src.fedAt + 6 * 36e5 : 0); sound.setPhase(phase());
  const b = document.body; b.style.setProperty('--bg1', ROOMS[src.room].bg[0]); b.style.setProperty('--bg2', ROOMS[src.room].bg[1]); b.dataset.phase = phase();
}
/* Keep the room in the part of the window that is not covered by a panel. */
function frameWorld(now) {
  if (!W) return;
  const hasPanel = making() || ui.panel, el = making() ? $('.maker') : $('#drawer'), size = el ? el.getBoundingClientRect() : { width: 0, height: 0 };
  if (wide()) W.setInsets(making() ? { l: size.width + 24, t: 20, b: 60 } : { r: ui.panel ? size.width : 0, t: 70, b: 120 }, now);
  else W.setInsets({ t: 64, b: hasPanel ? size.height : 150 }, now);
}
if (W) {
  $('#scene').appendChild(W.canvas);
  window.addEventListener('resize', () => { W.resize(); frameWorld(true); });
  W.on('status', (k, v) => { if (making()) return; ui.caption = statusText(k, v); $$('[data-caption]').forEach((el) => { el.textContent = ui.caption; }); });
  W.on('select', (id) => { ui.sel = id; paintBar(); });
  W.on('moved', (id, x, z, r) => { if (making() || ui.trial === id) return; const it = placed(id); if (it) { Object.assign(it, { x, z, r }); shown.items = JSON.stringify(layout()); save(); sound.play('place'); } });
  W.on('sfx', (name) => sound.play(name));
} else $('#scene').innerHTML = `<p class="no3d">${t('no3d')}</p>`;
function statusText(k, v) { const vars = { n: n() }; if (v && v.on) vars.on = tn(v.on); if (v && v.toy) vars.toy = tn(v.toy); return t(k, vars); }

/* ---------- small parts ---------- */

const ICON = {
  drop: '<path d="M12 3.5c-3.6 4.4-5.6 7.4-5.6 10.3a5.6 5.6 0 0 0 11.2 0c0-2.9-2-5.9-5.6-10.3z"/>',
  bowl: '<path d="M3.5 11h17l-1.6 6.2a2 2 0 0 1-2 1.5H7.1a2 2 0 0 1-2-1.5z"/><path d="M8 7.5c1-1.2 2-1.2 3 0s2 1.2 3 0"/>',
  ball: '<circle cx="12" cy="12" r="8.4"/><path d="M5.6 6.6c3 2.4 3 8.4 0 10.8M18.4 6.6c-3 2.4-3 8.4 0 10.8"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.4 4.4L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  cam: '<path d="M4 8.5h3.2l1.6-2.5h6.4l1.6 2.5H20v10H4z"/><circle cx="12" cy="13.2" r="3.2"/>',
  turn: '<path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.5 4.5v4h-4"/>', box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  chair: '<path d="M7 11V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V11"/><path d="M5 11h14v4.5H5zM7 15.5V20M17 15.5V20"/>',
  book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13.5H6.5A1.5 1.5 0 0 0 5 19z"/><path d="M5 19a1.5 1.5 0 0 0 1.5 1.5H19"/>',
  sound: '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4"/>', mute: '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5"/>',
  dots: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>', back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
};
const ic = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const logo = () => `<svg viewBox="0 0 64 64" class="mark" aria-hidden="true"><rect width="64" height="64" rx="20" fill="#FFD84D"/><g fill="#111"><ellipse cx="32" cy="41" rx="13" ry="10"/><circle cx="17" cy="29" r="5.5"/><circle cx="27" cy="20" r="5.5"/><circle cx="38" cy="20" r="5.5"/><circle cx="48" cy="29" r="5.5"/></g></svg>`;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3600); }
const face = (p) => (p.photo ? `<img src="${p.photo}" alt="">` : `<img class="snap" src="${thumb('pet', petKey(p))}" alt="">`);
const tools = () => `<div class="tools">
  <button class="tool" data-act="sound" aria-pressed="${sound.isOn()}" aria-label="${t('sound_label')}" title="${t(sound.isOn() ? 'sound_on' : 'sound_off')}">${ic(sound.isOn() ? 'sound' : 'mute')}</button>
  <button class="tool text" data-act="lang" aria-label="${t('lang_label')}">${t('lang_switch')}</button>
  ${making() ? '' : `<button class="tool" data-act="menu" aria-label="${t('menu_label')}" aria-haspopup="true">${ic('dots')}</button>`}</div>`;
function entryText(e) {
  if (e.kind === 'opened') return t('e_opened', { n: esc(n()) });
  if (e.kind === 'room') return t('e_room', { t: esc(rn(e.room)) });
  return t('e_bought', { t: tn(e.item) });
}

/* ---------- at home: the floating controls ---------- */

function hudHTML() {
  const p = S.pet;
  return `<div class="hud-top"><button class="who" data-act="panel" data-id="about" aria-label="${esc(t('about_open', { n: p.name }))}">
      <span class="portrait">${face(p)}</span><span class="who-text"><strong>${esc(p.name)}</strong><em data-caption aria-live="polite">${esc(ui.caption)}</em></span></button>${tools()}</div>
    <div class="hud-bottom"><div data-tray></div><div data-bar>${barHTML()}</div><p class="hint">${t('hint', { n: esc(p.name) })} <span class="zoom">${t('zoom_hint')}</span></p></div>`;
}
function barHTML() {
  if (ui.panel === 'decorate') return selBarHTML();
  const b = (act, icon, label, extra) => `<button class="dock-btn" data-act="${act}" ${extra || ''}>${ic(icon)}<span>${label}</span></button>`;
  return `<div class="dock" role="toolbar" aria-label="${t('care_label')}">${b('water', 'drop', t('care_water'))}${b('feed', 'bowl', t('care_feed'))}${b('playtray', 'ball', t('care_play'), 'aria-haspopup="true"')}
    <i class="sep"></i>${b('panel', 'chair', t('nav_decorate'), 'data-id="decorate"')}${b('panel', 'book', t('nav_keep'), 'data-id="keep"')}</div>`;
}
function paintBar() { const b = $('[data-bar]'); if (b) b.innerHTML = barHTML(); }
function trayHTML() {
  const toys = layout().filter((i) => THINGS[i.id].toy);
  if (!toys.length) return `<div class="tray" role="dialog"><p>${t('no_toys')}</p><button class="tray-more" data-act="panel" data-id="decorate">${ic('plus')}${t('find_toy')}</button></div>`;
  return `<div class="tray" role="menu" aria-label="${t('choose_toy')}">${toys.map((i) => `<button role="menuitem" data-act="play" data-id="${i.id}"><span class="mini"><img src="${thumb('thing', i.id, S.room)}" alt=""></span><strong>${esc(L(THING_TEXT[i.id].name))}</strong></button>`).join('')}</div>`;
}
function selBarHTML() {
  if (ui.trial) {
    const T = THING_TEXT[ui.trial];
    return `<div class="selbar trying"><div><strong>${t('trying')}: ${esc(L(T.name))}</strong><span>${esc(L(T.does).replace('{n}', n()))}</span></div>
      <div class="selbar-actions"><button class="btn icon" data-act="turn" aria-label="${t('turn')}" title="${t('turn')}">${ic('turn')}</button><button class="btn" data-act="trial-out">${t('take_out')}</button><button class="btn primary" data-act="trial-keep">${t('keep_it', { p: money(T.price) })}</button></div></div>`;
  }
  if (!ui.sel || !placed(ui.sel)) return `<div class="selbar empty"><span>${ic('move')}${t('sel_none')}</span></div>`;
  return `<div class="selbar"><div><strong>${esc(L(THING_TEXT[ui.sel].name))}</strong></div><div class="selbar-actions">
    <button class="btn" data-act="turn">${ic('turn')}${t('turn')}</button>${THINGS[ui.sel].fixed ? '' : `<button class="btn" data-act="store" data-id="${ui.sel}">${ic('box')}${t('put_away')}</button>`}</div></div>`;
}

/* ---------- the side panel: decorate, keepsakes, about ---------- */

function roomsHTML(cur, act) {
  return Object.keys(ROOMS).map((id) => `<button type="button" class="place ${cur === id ? 'on' : ''}" data-act="${act}" data-id="${id}" aria-pressed="${cur === id}">
    <span class="place-art" style="background:linear-gradient(160deg, ${ROOMS[id].bg[0]}, ${ROOMS[id].bg[1]})"><img src="${thumb('room', id)}" alt=""></span><strong>${L(ROOM_TEXT[id].name)}</strong><em>${L(ROOM_TEXT[id].note)}</em></button>`).join('');
}
function decorateHTML() {
  const have = available(), list = SHOP.filter((id) => fitsPet(id) && !have.includes(id)), away = have.filter((id) => !placed(id) && fitsPet(id));
  const card = (id, sub, act, on) => `<button class="card ${on ? 'on' : ''}" data-act="${act}" data-id="${id}" aria-pressed="${!!on}"><span class="card-art"><img src="${thumb('thing', id, S.room)}" alt="" loading="lazy"></span><strong>${esc(L(THING_TEXT[id].name))}</strong><em>${sub}</em></button>`;
  return `<p class="lead">${t('dec_p', { n: esc(n()) })}</p>
    <section><h3>${t('add_h')}</h3><p class="fine">${t('add_p')}</p><div class="cards">${list.map((id) => card(id, money(THING_TEXT[id].price), 'try', ui.trial === id)).join('')}</div></section>
    ${away.length ? `<section><h3>${t('away_h')}</h3><div class="cards">${away.map((id) => card(id, t('bring_back'), 'unstore')).join('')}</div></section>` : ''}
    <section><h3>${t('room_h')}</h3><p class="fine">${t('room_p')}</p><div class="places">${roomsHTML(S.room, 'room')}</div></section>`;
}
function keepHTML() {
  return `<p class="lead">${t('keep_p')}</p><ol class="timeline">${S.journal.slice().reverse().map((e) => {
    const r = e.kind === 'room' ? e.room : e.kind === 'opened' ? (e.room || S.room) : null;
    const art = e.item ? `<span class="mini big"><img src="${thumb('thing', e.item, S.room)}" alt=""></span>` : `<span class="mini big room" style="background:linear-gradient(160deg, ${ROOMS[r].bg[0]}, ${ROOMS[r].bg[1]})"><img src="${thumb('room', r)}" alt=""></span>`;
    return `<li>${art}<span><time>${day(e.t, true)}</time><strong>${entryText(e)}</strong></span></li>`;
  }).join('')}</ol>`;
}
function aboutHTML() {
  const p = S.pet;
  return `<div class="who-card"><span class="portrait big">${face(p)}</span><div><p class="meta">${p.years ? esc(p.years) + ' · ' : ''}${esc(L(SPECIES_TEXT[p.species]))} · ${esc(L(ROOM_TEXT[S.room].name))}</p></div></div>
    <section><div class="row"><h3>${t('words_h')}</h3><button class="link" data-act="words">${t('edit')}</button></div>${p.words ? `<blockquote>${esc(p.words)}</blockquote>` : `<p class="fine">${t('words_empty')}</p>`}</section>
    <section><h3>${t('inhome_h')}</h3>${S.owned.length ? `<ul class="things">${S.owned.slice().reverse().map((i) => `<li><span class="mini"><img src="${thumb('thing', i.id, S.room)}" alt=""></span><span><strong>${esc(L(THING_TEXT[i.id].name))}</strong><em>${t('from_you')} · ${day(i.at)}</em></span></li>`).join('')}</ul>` : `<p class="fine">${t('inhome_empty')}</p>`}</section>
    <div class="stack"><button class="btn" data-act="look">${t('m_look')}</button></div>`;
}
function drawerHTML() {
  const title = ui.panel === 'decorate' ? t('dec_h', { n: esc(n()) }) : ui.panel === 'keep' ? t('keep_h', { n: esc(n()) }) : esc(n());
  const body = ui.panel === 'decorate' ? decorateHTML() : ui.panel === 'keep' ? keepHTML() : aboutHTML();
  return `<div class="drawer-head"><h2>${title}</h2><button class="tool" data-act="panel-close" aria-label="${t('drawer_close')}">${ic('x')}</button></div><div class="drawer-body" data-drawer-body>${body}</div>`;
}
function paintDrawer() { const b = $('[data-drawer-body]'); if (b && ui.panel === 'decorate') b.innerHTML = decorateHTML(); paintBar(); }

/* ---------- making a home: three short steps beside the room ---------- */

function newDraft() { return { purpose: 'memory', species: 'cat', name: '', years: '', photo: null, look: Object.assign({}, SPECIES.cat.look), scale: 1, room: 'bay', photoNote: '' }; }
function lookHTML(p) {
  const quad = !SPECIES[p.species].biped && !SPECIES[p.species].shell, K = p.look;
  const col = (key, label) => `<label class="swatch"><input type="color" value="${K[key]}" data-col="${key}"><span>${label}</span></label>`;
  const seg = (act, opts, cur) => `<div class="seg">${opts.map(([v, lab]) => `<button type="button" data-act="${act}" data-id="${v}" aria-pressed="${String(cur) === String(v)}">${lab}</button>`).join('')}</div>`;
  return `<div class="look"><div class="swatches">${col('base', t('col_base'))}${col('second', t('col_second'))}${col('dark', t('col_dark'))}</div>
    ${quad ? `<div class="field tight"><span>${t('f_pattern')}</span>${seg('pattern', Object.keys(PATTERNS).map((k) => [k, L(PATTERNS[k])]), K.pattern)}</div>` : ''}
    ${p.species === 'dog' ? `<div class="field tight"><span>${t('f_ears')}</span>${seg('ear', [['auto', t('ear_flop')], ['point', t('ear_point')]], K.ear || 'auto')}</div>` : ''}
    <div class="field tight"><span>${t('f_size')}</span>${seg('scale', [[0.85, t('size_s')], [1, t('size_m')], [1.18, t('size_l')]], p.scale || 1)}</div></div>`;
}
function makerHTML() {
  const d = ui.draft, mem = d.purpose === 'memory', step = ui.step, names = ['step_who', 'step_look', 'step_home'];
  const echo = `<span data-name-echo>${esc(d.name || t('c_them'))}</span>`;
  const body = step === 0 ? `
      <div class="field"><span>${t('f_purpose')}</span><div class="choice">${[['memory', 'pur_memory'], ['new', 'pur_new']].map(([v, k]) => `<button type="button" data-act="purpose" data-id="${v}" aria-pressed="${d.purpose === v}"><strong>${t(k)}</strong><em>${t(k + '_s')}</em></button>`).join('')}</div></div>
      <div class="field"><span>${t('f_species')}</span><div class="species">${Object.keys(SPECIES).map((k) => `<button type="button" data-act="species" data-id="${k}" aria-pressed="${d.species === k}"><img src="${thumb('pet', JSON.stringify({ species: k, look: SPECIES[k].look, scale: 1 }))}" alt=""><strong>${L(SPECIES_TEXT[k])}</strong></button>`).join('')}</div></div>
      <label class="field"><span>${t('f_name')}</span><input type="text" name="name" value="${esc(d.name)}" maxlength="24" autocomplete="off" placeholder="Maple"></label>
      ${mem ? `<label class="field"><span>${t('f_years')} <i>${t('optional')}</i></span><input type="text" name="years" value="${esc(d.years)}" maxlength="24" autocomplete="off" placeholder="${t('f_years_ph')}"></label>` : ''}`
    : step === 1 ? `
      <div class="field"><span>${t('f_photo')} <i>${t('optional')}</i></span><p class="fine">${t('f_photo_p')}</p>
        <label class="photo ${d.photo ? 'has' : ''}"><input type="file" accept="image/*" data-photo>${d.photo ? `<img src="${d.photo}" alt=""><strong>${t('photo_change')}</strong>` : `${ic('cam')}<strong>${t('photo_add')}</strong>`}</label>
        <p class="fine ok" data-photo-note>${esc(d.photoNote)}</p></div>
      <div class="field"><span>${t('f_look')}</span><div data-look>${lookHTML(d)}</div></div>`
    : `<div class="field"><span>${t('f_room')}</span><div class="places">${roomsHTML(d.room, 'droom')}</div></div>
      <ul class="promises"><li>${ic('check')}${t('promise1')}</li><li>${ic('check')}${t('promise2')}</li><li>${ic('check')}${t('promise3')}</li></ul>`;
  return `<form class="maker" data-form novalidate>
      <div class="maker-top"><span class="logo">${logo()}<span>EverPaw</span></span>${tools()}</div>
      <p class="steps">${t('step_of', { a: step + 1, b: 3 })} · ${t(names[step])}</p>
      <h1>${t(mem ? 'c_h_memory' : 'c_h_new', { n: echo })}</h1>
      <div class="maker-body">${body}</div>
      <p class="form-error" data-error role="alert"></p>
      <div class="maker-actions">${step ? `<button class="btn" type="button" data-act="step-back">${ic('back')}${t('back')}</button>` : ''}
        <button class="btn primary big" type="submit" data-submit>${step < 2 ? t('next') : d.name ? t('c_open', { n: esc(d.name) }) : t('c_open_plain')}</button></div>
    </form>
    <p class="maker-cap">${esc(d.name ? t('prev_cap', { n: d.name }) : t('prev_cap_plain'))}</p>`;
}
function refreshMaker() { const m = $('.maker'), y = m ? m.scrollTop : 0; $('#hud').innerHTML = makerHTML(); const m2 = $('.maker'); if (m2) m2.scrollTop = y; syncWorld(); frameWorld(); }
function readPhoto(file, done) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const k = Math.min(1, 480 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); done(c.toDataURL('image/jpeg', 0.84), coatFromPhoto(img)); };
  img.onerror = () => { URL.revokeObjectURL(url); done(null); };
  img.src = url;
}

/* ---------- overlays ---------- */

function openModal(html) { ui.modal = true; const l = $('#layer'); l.innerHTML = html; const m = $('.modal, .menu', l); if (m) m.focus(); wakeHud(); }
function closeModal() { if (!ui.modal) return; ui.modal = false; $('#layer').innerHTML = ''; }
const modalShell = (body) => `<div class="scrim" data-act="close"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" tabindex="-1"><button class="tool close" data-act="close" aria-label="${t('close')}">${ic('x')}</button>${body}</div>`;
function payModal(id) {
  const T = THING_TEXT[id];
  return modalShell(`<div class="modal-body"><div class="pay-art"><img src="${thumb('thing', id, S.room)}" alt=""></div><h2 id="mt">${t('pay_h', { t: tn(id) })}</h2>
    <p class="what">${esc(L(T.does).replace('{n}', n()))}</p>
    <dl class="bill"><div><dt>${esc(L(T.name))}</dt><dd>${money(T.price)}</dd></div><div class="total"><dt>${t('total')}</dt><dd>${money(T.price)}</dd></div></dl>
    <p class="note">${t('pay_note')}</p>
    <div class="modal-actions"><button class="btn primary big" data-act="pay" data-id="${id}">${t('pay_go', { p: money(T.price) })}</button><button class="btn" data-act="close">${t('cancel')}</button></div></div>`);
}
function wordsModal() {
  const p = S.pet;
  return modalShell(`<form class="modal-body" data-words><h2 id="mt">${esc(p.name)}</h2>
    <label class="field"><span>${t('f_name')}</span><input type="text" name="name" value="${esc(p.name)}" maxlength="24" required></label>
    <label class="field"><span>${t('f_years')} <i>${t('optional')}</i></span><input type="text" name="years" value="${esc(p.years || '')}" maxlength="24" placeholder="${t('f_years_ph')}"></label>
    <label class="field"><span>${t('words_h')} <i>${t('optional')}</i></span><textarea name="words" rows="3" maxlength="200" placeholder="${t('words_ph')}">${esc(p.words || '')}</textarea></label>
    <div class="modal-actions"><button class="btn primary big" type="submit">${t('save')}</button></div></form>`);
}
const lookModal = () => modalShell(`<div class="modal-body"><h2 id="mt">${t('m_look')}</h2><div data-look>${lookHTML(S.pet)}</div><div class="modal-actions"><button class="btn primary big" data-act="close">${t('done')}</button></div></div>`);
const menuHTML = () => `<div class="scrim clear" data-act="close"></div><div class="menu" role="menu" tabindex="-1">
  <button role="menuitem" data-act="words">${t('m_words')}</button><button role="menuitem" data-act="look">${t('m_look')}</button><button role="menuitem" data-act="export">${t('m_export')}</button>
  <p>${t('m_remind')}</p><button role="menuitem" class="danger" data-act="delete">${t('m_delete')}</button></div>`;

/* ---------- putting it on screen ---------- */

function render() {
  document.documentElement.lang = zh() ? 'zh-CN' : 'en';
  if (making() && !ui.draft) ui.draft = newDraft();
  if (ui.trial && W) { W.removeItem(ui.trial); shown.items = null; } ui.trial = null; ui.sel = null;
  document.body.dataset.mode = making() ? 'making' : 'home'; document.body.dataset.panel = ui.panel || '';
  syncWorld();
  $('#hud').innerHTML = making() ? makerHTML() : hudHTML();
  const dr = $('#drawer'); dr.innerHTML = !making() && ui.panel ? drawerHTML() : ''; dr.classList.toggle('open', !making() && !!ui.panel); dr.setAttribute('aria-hidden', String(!ui.panel));
  if (W) { W.setMode(ui.panel === 'decorate' ? 'edit' : 'live'); W.resize(); W.start(); frameWorld(); }
  if (!making() && W && W.status()) { const st = W.status(); ui.caption = statusText(st[0], st[1]); $$('[data-caption]').forEach((el) => { el.textContent = ui.caption; }); }
  document.title = S ? `${n()} · EverPaw` : 'EverPaw Home'; wakeHud();
}
function wipe() { store.del(KEY); S = null; ui.draft = null; ui.step = 0; ui.panel = null; ui.caption = ''; closeModal(); render(); }

/* Controls fade when the pointer has been still for a while, so only the room is left. */
function wakeHud() {
  document.body.classList.remove('quiet'); clearTimeout(quietTimer);
  quietTimer = setTimeout(() => { if (!making() && !ui.panel && !ui.modal && !$('[data-tray]')?.innerHTML) document.body.classList.add('quiet'); }, 7000);
}
['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, wakeHud, { passive: true }));

/* ---------- what each control does ---------- */

const closeTray = () => { const s = $('[data-tray]'); if (s) s.innerHTML = ''; };
const lookTarget = () => (making() ? ui.draft : S.pet);
function lookChanged(repaint) {
  if (!making()) save(); syncWorld();
  if (repaint) { const el = $('[data-look]'); if (el) el.innerHTML = lookHTML(lookTarget()); }
  if (!making()) { const p = $('.who .portrait'); if (p) p.innerHTML = face(S.pet); }
}
function setPanel(id) { closeTray(); ui.panel = ui.panel === id ? null : id; render(); }

const DO = {
  lang() { lang = zh() ? 'en' : 'zh'; store.set(LKEY, lang); closeModal(); render(); },
  sound() { const v = !sound.isOn(); sound.setOn(v); store.set(SKEY, v ? 'on' : 'off'); $$('[data-act=sound]').forEach((b) => { b.setAttribute('aria-pressed', v); b.title = t(v ? 'sound_on' : 'sound_off'); b.innerHTML = ic(v ? 'sound' : 'mute'); }); toast(t(v ? 'sound_on' : 'sound_off')); },
  menu() { openModal(menuHTML()); },
  close() { closeModal(); },
  panel(el) { setPanel(el.dataset.id); },
  'panel-close'() { setPanel(ui.panel); },
  water() { closeTray(); W && W.act('water'); },
  feed() { closeTray(); S.fedAt = Date.now(); save(); W && W.act('feed'); },
  playtray() { const s = $('[data-tray]'); if (s.innerHTML) return closeTray(); s.innerHTML = trayHTML(); const f = $('button', s); if (f) f.focus(); },
  play(el) { closeTray(); W && W.act('play', el.dataset.id); },
  words() { closeModal(); openModal(wordsModal()); },
  look() { closeModal(); openModal(lookModal()); },
  turn() { const id = ui.trial || ui.sel; if (id && W && W.rotateItem(id) === false) toast(t('no_room')); },
  store(el) { const id = el.dataset.id; S.rooms[S.room] = layout().filter((i) => i.id !== id); save(); W.removeItem(id); shown.items = JSON.stringify(layout()); ui.sel = null; toast(t('toast_stored')); paintDrawer(); },
  unstore(el) { const id = el.dataset.id, [x, z] = W.freeSpot(id), it = { id, x, z, r: 0 }; layout().push(it); save(); W.addItem(it); shown.items = JSON.stringify(layout()); W.select(id); sound.play('place'); paintDrawer(); },
  try(el) {
    const id = el.dataset.id; if (ui.trial) { W.removeItem(ui.trial); if (ui.trial === id) { ui.trial = null; return paintDrawer(); } }
    const [x, z] = W.freeSpot(id); ui.trial = id; W.addItem({ id, x, z, r: 0, trial: true }); W.select(id); sound.play('place'); paintDrawer();
  },
  'trial-out'() { W.removeItem(ui.trial); ui.trial = null; paintDrawer(); },
  'trial-keep'() { openModal(payModal(ui.trial)); },
  pay(el) {
    const id = el.dataset.id, now = Date.now(), it = W.items.find((i) => i.id === id) || { x: 4, z: 4, r: 0 };
    S.owned.push({ id, at: now }); layout().push({ id, x: it.x, z: it.z, r: it.r }); S.journal.push({ t: now, kind: 'bought', item: id });
    ui.trial = null; save(); closeModal(); shown.items = null; syncWorld(); W.select(id); sound.play('happy');
    toast(t('toast_added', { t: L(THING_TEXT[id].name), n: n() })); paintDrawer();
  },
  room(el) { const id = el.dataset.id; if (id === S.room) return; S.room = id; S.journal.push({ t: Date.now(), kind: 'room', room: id }); save(); render(); },
  droom(el) { ui.draft.room = el.dataset.id; refreshMaker(); },
  purpose(el) { ui.draft.purpose = el.dataset.id; refreshMaker(); },
  species(el) { const d = ui.draft, k = el.dataset.id, keep = d.photo && d.fromPhoto; d.species = k; d.look = Object.assign({}, SPECIES[k].look, keep ? { base: d.look.base, second: d.look.second, dark: d.look.dark } : {}); refreshMaker(); },
  pattern(el) { lookTarget().look.pattern = el.dataset.id; lookChanged(true); },
  ear(el) { lookTarget().look.ear = el.dataset.id; lookChanged(true); },
  scale(el) { lookTarget().scale = +el.dataset.id; lookChanged(true); },
  'step-back'() { ui.step = Math.max(0, ui.step - 1); refreshMaker(); },
  export() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })); a.download = `${n().toLowerCase()}-home.json`; a.click(); URL.revokeObjectURL(a.href); closeModal(); toast(t('exported')); },
  delete() { if (confirm(t('del_confirm', { n: n() }))) wipe(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && DO[el.dataset.act]) { e.preventDefault(); sound.play('ui'); DO[el.dataset.act](el); return; }
  if (!e.target.closest('[data-tray], [data-act=playtray]')) closeTray();
});
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (ui.modal) closeModal(); else if ($('[data-tray]')?.innerHTML) closeTray(); else if (ui.panel) setPanel(ui.panel); });
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-col]')) { lookTarget().look[e.target.dataset.col] = e.target.value; if (making()) ui.draft.fromPhoto = true; lookChanged(false); return; }
  if (!making() || !e.target.closest('[data-form]')) return;
  if (e.target.name === 'years') ui.draft.years = e.target.value.trim();
  if (e.target.name === 'name') { const v = e.target.value.trim(); ui.draft.name = v; $('[data-name-echo]').textContent = v || t('c_them'); $('[data-error]').textContent = ''; $('.maker-cap').textContent = v ? t('prev_cap', { n: v }) : t('prev_cap_plain'); }
});
document.addEventListener('change', (e) => {
  const f = e.target.matches('[data-photo]') && e.target.files && e.target.files[0]; if (!f) return;
  readPhoto(f, (url, coat) => {
    const d = ui.draft; if (!url) { d.photoNote = t('photo_bad'); return refreshMaker(); }
    d.photo = url;
    if (coat) {
      Object.assign(d.look, { base: coat.base, second: coat.second, dark: coat.dark }); d.fromPhoto = true; d.photoNote = t('photo_read');
      if (!SPECIES[d.species].biped && !SPECIES[d.species].shell && coat.contrast > 60) d.look.pattern = 'belly';
    }
    refreshMaker();
  });
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.matches('[data-words]')) {
    const f = new FormData(e.target), name = String(f.get('name')).trim();
    if (name) S.pet.name = name;
    S.pet.years = String(f.get('years')).trim(); S.pet.words = String(f.get('words')).trim(); save(); closeModal(); render(); return;
  }
  if (!e.target.matches('[data-form]')) return;
  const d = ui.draft;
  if (!d.name) { ui.step = 0; refreshMaker(); $('[data-error]').textContent = t('err_name'); const i = $('input[name=name]'); if (i) i.focus(); return; }
  if (ui.step < 2) { ui.step++; refreshMaker(); $('.maker').scrollTop = 0; return; }
  const now = Date.now();
  S = { v: 3, purpose: d.purpose, room: d.room, opened: now, pet: { name: d.name, years: d.purpose === 'memory' ? d.years : '', species: d.species, look: d.look, scale: d.scale, photo: d.photo, words: '' }, rooms: {}, owned: [], fedAt: 0, journal: [{ t: now, kind: 'opened', room: d.room }] };
  save(); ui.draft = null; ui.step = 0; sound.play('happy'); render();
});

window.everpaw = { world: W }; // handy when checking the room from the console
S = load();
if (S) { S.owned = (S.owned || []).filter((i) => THINGS[i.id]); Object.keys(S.rooms || {}).forEach((k) => { S.rooms[k] = S.rooms[k].filter((i) => THINGS[i.id]); }); }
render();
