/* auramaxx – your lifemaxxing tracker
   Everything runs in the browser. Data lives in localStorage, photos in IndexedDB.
   All visible text comes from i18n.js (T = current language).
   Layout: helpers → constants → data → calculations → views → actions → dialogs → start. */
(() => {
  'use strict';

  /* ================= Helpers ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const shift = (s, n) => iso(addDays(parse(s), n));
  const mondayOf = s => { const x = parse(s); return iso(addDays(x, -((x.getDay() + 6) % 7))); };
  const todayIso = () => iso(new Date());
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const numOrNull = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };

  /* ================= Language ================= */
  const { LANGS, FLAGS, dict } = window.I18N;
  let T = dict.en;
  const num = (n, d = 0) => Number(n).toLocaleString(T.locale, { maximumFractionDigits: d });
  const wd = s => (parse(s).getDay() + 6) % 7;
  const fullDate = s => { const x = parse(s); return T.fullDate(wd(s), x.getDate(), x.getMonth()); };
  const shortDate = s => { const x = parse(s); return T.shortDate(x.getDate(), x.getMonth()); };
  function relLabel(s) {
    const t = todayIso();
    if (s === t) return T.today;
    if (s === shift(t, -1)) return T.yesterday;
    return `${T.short[wd(s)]}, ${shortDate(s)}`;
  }
  function weekNo(s) {
    const t = parse(s); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const j = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7);
  }
  function detectLang() {
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map(l => String(l).slice(0, 2).toLowerCase());
    return prefs.find(l => LANGS.includes(l)) || 'en';
  }

  /* ================= Constants ================= */
  const KEY = 'auramaxx.v1';
  const AURA = { habit: 10, meal: 5, water: 2, workout: 25, checkin: 10, journal: 10, photo: 15 };
  const DAILY_GOAL = 100;
  const LEVEL_AT = [0, 150, 400, 900, 1800, 3500, 6500, 11000];
  const CAT_IDS = ['body', 'mind', 'focus', 'glow', 'social'];
  // Names and goals of the templates come from T.templates (same order)
  const TEMPLATES = [
    { emoji: '📖', cat: 'mind', perWeek: 7 }, { emoji: '🚶', cat: 'body', perWeek: 7 }, { emoji: '📵', cat: 'focus', perWeek: 7 },
    { emoji: '🧊', cat: 'body', perWeek: 5 }, { emoji: '🧘', cat: 'mind', perWeek: 7 }, { emoji: '🌅', cat: 'focus', perWeek: 5 },
    { emoji: '✨', cat: 'glow', perWeek: 7 }, { emoji: '✍️', cat: 'mind', perWeek: 7 }, { emoji: '🎯', cat: 'focus', perWeek: 5 },
    { emoji: '☀️', cat: 'body', perWeek: 7 }, { emoji: '🛏️', cat: 'focus', perWeek: 7 }, { emoji: '🗣️', cat: 'social', perWeek: 2 },
    { emoji: '🧠', cat: 'mind', perWeek: 5 }
  ];
  const tpl = i => Object.assign({}, TEMPLATES[i], { name: T.templates[i][0], goal: T.templates[i][1] });
  const EMOJIS = ['⭐', '💧', '📖', '🚶', '📵', '🧊', '🧘', '🌅', '✨', '✍️', '🎯', '☀️', '🛏️', '🗣️', '🧠', '💪', '🥗', '🦷', '💰', '🎸', '🧹', '🙏'];
  const MEAL_TYPES = [{ id: 'breakfast', e: '🍳' }, { id: 'lunch', e: '🥗' }, { id: 'dinner', e: '🍝' }, { id: 'snack', e: '🍎' }];
  const MEAL_TAGS = [{ id: 'veg', e: '🥦' }, { id: 'home', e: '🏠' }, { id: 'protein', e: '💪' }, { id: 'sweet', e: '🍫' }, { id: 'fast', e: '🍔' }];
  const WO_TYPES = [{ id: 'strength', e: '🏋️' }, { id: 'run', e: '🏃' }, { id: 'cardio', e: '🚴' }, { id: 'sport', e: '⚽' }, { id: 'mobility', e: '🧘' }, { id: 'walk', e: '🚶' }];
  const DIST_TYPES = ['run', 'cardio', 'walk'];
  const MOOD_E = ['😩', '😕', '😐', '🙂', '🤩'];
  const mealType = id => MEAL_TYPES.find(t => t.id === id) || MEAL_TYPES[3];
  const mealLabel = id => T.mealTypes[mealType(id).id];
  const woType = id => WO_TYPES.find(t => t.id === id) || WO_TYPES[0];
  const woLabel = id => T.woTypes[woType(id).id];
  const catCls = id => 'c-' + (CAT_IDS.includes(id) ? id : 'mind');

  /* ================= Data ================= */
  const fresh = () => ({ v: 1, profile: null, habits: [], days: {}, photos: [], settings: { theme: 'auto', lang: null }, lastLevel: null });
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const p = JSON.parse(raw); if (p && p.v === 1) { const s = Object.assign(fresh(), p); s.settings = Object.assign({ theme: 'auto', lang: null }, p.settings); return s; } }
    } catch (e) { /* ignore */ }
    return fresh();
  }
  let S = load();
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast(T.saveFail); }
  }
  const goals = () => Object.assign({ water: 8, protein: 0, workouts: 3 }, S.profile && S.profile.goals);
  const getDay = d => S.days[d] || { water: 0, meals: [], workouts: [] };
  function ensureDay(d) {
    if (!S.days[d]) S.days[d] = { water: 0, meals: [], workouts: [] };
    const x = S.days[d]; x.meals = x.meals || []; x.workouts = x.workouts || []; x.water = x.water || 0;
    return x;
  }
  const findHabit = id => S.habits.find(h => h.id === id);
  const newHabit = t => ({ id: uid(), emoji: t.emoji || '⭐', name: t.name, goal: t.goal || '', cat: t.cat || 'mind', perWeek: t.perWeek || 7, done: [], created: todayIso() });

  /* Photos in IndexedDB */
  const idb = (() => {
    let p = null;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('auramaxx', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('photos', mode); const req = fn(t.objectStore('photos'));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    }));
    return {
      get: id => tx('readonly', s => s.get(id)),
      put: (id, blob) => tx('readwrite', s => s.put(blob, id)),
      del: id => tx('readwrite', s => s.delete(id)),
      clear: () => tx('readwrite', s => s.clear())
    };
  })();
  const photoURLs = new Map();
  async function photoURL(id) {
    if (photoURLs.has(id)) return photoURLs.get(id);
    const b = await idb.get(id);
    if (!b) return null;
    const u = URL.createObjectURL(b); photoURLs.set(id, u); return u;
  }

  /* ================= Calculations ================= */
  const has = (h, d) => h.done.indexOf(d) !== -1;
  function toggleDone(h, d) { const i = h.done.indexOf(d); if (i < 0) { h.done.push(d); return true; } h.done.splice(i, 1); return false; }
  function countWeek(h, d) { const m = mondayOf(d); let c = 0; for (let i = 0; i < 7; i++) if (has(h, shift(m, i))) c++; return c; }
  function dueOn(h, d) {
    if (has(h, d)) return true;
    if (h.created && d < h.created) return false;
    if (h.perWeek >= 7) return true;
    return countWeek(h, d) < h.perWeek;
  }
  function habitStreak(h) {
    const t = todayIso(); let n = 0;
    if (h.perWeek >= 7) {
      let d = has(h, t) ? t : shift(t, -1);
      while (has(h, d) && n < 3650) { n++; d = shift(d, -1); }
      return { n, unit: T.dayUnit(n) };
    }
    let w = mondayOf(t);
    if (countWeek(h, w) >= h.perWeek) n++;
    w = shift(w, -7);
    while (countWeek(h, w) >= h.perWeek && n < 520) { n++; w = shift(w, -7); }
    return { n, unit: T.weekUnit(n) };
  }
  function auraFor(d) {
    const x = getDay(d); const G = goals(); let a = 0;
    for (const h of S.habits) if (has(h, d)) a += AURA.habit;
    a += Math.min(x.meals.length, 6) * AURA.meal;
    a += Math.min(x.water || 0, G.water) * AURA.water;
    a += Math.min(x.workouts.length, 2) * AURA.workout;
    if (x.mood) a += AURA.checkin;
    if ((x.win || '').trim() || (x.journal || '').trim()) a += AURA.journal;
    if (S.photos.some(p => p.date === d)) a += AURA.photo;
    return a;
  }
  function allDates() {
    const set = new Set(Object.keys(S.days));
    S.habits.forEach(h => h.done.forEach(d => set.add(d)));
    S.photos.forEach(p => set.add(p.date));
    return Array.from(set).sort();
  }
  const totalAura = () => allDates().reduce((s, d) => s + auraFor(d), 0);
  function level(total) {
    let i = 0; while (i + 1 < LEVEL_AT.length && total >= LEVEL_AT[i + 1]) i++;
    const next = LEVEL_AT[i + 1];
    return { n: i + 1, i, name: T.levels[i], from: LEVEL_AT[i], to: next != null ? next : null, nextName: next != null ? T.levels[i + 1] : null, p: next != null ? (total - LEVEL_AT[i]) / (next - LEVEL_AT[i]) : 1, total };
  }
  function docStreak() {
    let d = todayIso(); if (auraFor(d) === 0) d = shift(d, -1);
    let n = 0; while (auraFor(d) > 0 && n < 3650) { n++; d = shift(d, -1); }
    return n;
  }
  function bestStreak() {
    const ds = allDates().filter(d => auraFor(d) > 0); let best = 0, cur = 0, prev = null;
    for (const d of ds) { cur = prev && daysBetween(prev, d) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
    return best;
  }
  function startDate() {
    const ds = allDates(); const st = S.profile && S.profile.start ? S.profile.start : todayIso();
    return ds.length && ds[0] < st ? ds[0] : st;
  }
  const dayNumber = d => Math.max(1, daysBetween(startDate(), d) + 1);
  const proteinOf = x => x.meals.reduce((s, m) => s + (m.protein || 0), 0);
  const kcalOf = x => x.meals.reduce((s, m) => s + (m.kcal || 0), 0);
  const minutesOf = x => x.workouts.reduce((s, w) => s + (w.duration || 0), 0);
  function allWorkouts() {
    const out = [];
    for (const [d, x] of Object.entries(S.days)) (x.workouts || []).forEach(w => out.push({ d, w }));
    return out.sort((a, b) => (b.d + (b.w.time || '')).localeCompare(a.d + (a.w.time || '')));
  }
  function maxKg(name, excludeId) {
    const n = name.trim().toLowerCase(); let m = 0;
    for (const { w } of allWorkouts()) if (w.id !== excludeId) for (const e of w.exercises || []) if (e.name.trim().toLowerCase() === n && e.kg > m) m = e.kg;
    return m;
  }
  function prList() {
    const map = new Map();
    for (const { d, w } of allWorkouts()) for (const e of w.exercises || []) {
      if (!(e.kg > 0)) continue;
      const k = e.name.trim().toLowerCase(); const cur = map.get(k);
      if (!cur || e.kg > cur.kg || (e.kg === cur.kg && d < cur.d)) map.set(k, { name: e.name.trim(), kg: e.kg, reps: e.reps, d });
    }
    return Array.from(map.values()).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 8);
  }
  function recentMeals() {
    const seen = new Set(), out = [];
    const ds = Object.keys(S.days).sort().reverse();
    for (const d of ds) for (const m of (S.days[d].meals || []).slice().reverse()) {
      const k = m.name.trim().toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(m);
      if (out.length >= 6) return out;
    }
    return out;
  }
  function exerciseNames() {
    const set = new Set(T.exercises);
    for (const { w } of allWorkouts()) for (const e of w.exercises || []) if (e.name.trim()) set.add(e.name.trim());
    return Array.from(set);
  }
  function exSummary(e) {
    let s = e.name;
    if (e.sets && e.reps) s += ` ${e.sets}×${e.reps}`; else if (e.sets) s += ' ' + T.setsN(e.sets); else if (e.reps) s += ' ' + T.repsN(e.reps);
    if (e.kg) s += ` · ${num(e.kg, 1)} kg`;
    return s;
  }
  function greeting() {
    const h = new Date().getHours();
    return T.greetings[h < 5 ? 0 : h < 11 ? 1 : h < 17 ? 2 : h < 22 ? 3 : 4];
  }

  /* ================= UI state ================= */
  let view = 'today';
  let viewDate = todayIso();
  let lastToday = todayIso();

  /* ================= Building blocks ================= */
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function ring(p, label, big, sub) {
    const v = clamp(p, 0, 1) * 100;
    return `<div class="ring" role="img" aria-label="${esc(label)}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="52"/>
      <circle class="ring-fill${v === 0 ? ' zero' : ''}" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${v.toFixed(1)} 100" transform="rotate(-90 60 60)"/></svg>
      <div class="ring-center" aria-hidden="true"><b>${big}</b><span>${sub}</span></div></div>`;
  }
  const bar = (p, cls = '') => `<div class="bar ${cls}" aria-hidden="true"><i style="width:${(clamp(p, 0, 1) * 100).toFixed(1)}%"></i></div>`;
  const emptyState = (e, t) => `<div class="empty"><span class="e" aria-hidden="true">${e}</span>${t}</div>`;
  const freqLabel = n => (n >= 7 ? T.daily : T.perWeek(n));

  function habitRow(h, d, withWeek) {
    const on = has(h, d), s = habitStreak(h);
    let week = '';
    if (withWeek) {
      const m = mondayOf(d), t = todayIso(); let cells = '';
      for (let i = 0; i < 7; i++) {
        const di = shift(m, i), dn = has(h, di), fut = di > t;
        cells += `<button type="button" class="d${dn ? ' done' : ''}${di === d ? ' sel' : ''}" data-action="day-toggle" data-id="${h.id}" data-date="${di}" data-k="dt-${h.id}-${i}" aria-pressed="${dn}" aria-label="${esc(h.name)}, ${T.days[i]} ${shortDate(di)}"${fut ? ' disabled' : ''}><i></i><span aria-hidden="true">${T.short[i]}</span></button>`;
      }
      week = `<div class="days">${cells}</div>` + (h.perWeek < 7 ? `<p class="week-note">${T.weekNote(countWeek(h, d), h.perWeek)}</p>` : '');
    }
    return `<li class="habit">
      <button type="button" class="tick" data-action="tick" data-id="${h.id}" data-k="tk-${h.id}" aria-pressed="${on}" aria-label="${esc(T.doneAria(h.name))}">${CHECK}</button>
      <button type="button" class="meta" data-action="edit-habit" data-id="${h.id}" data-k="ed-${h.id}" aria-label="${esc(T.editAria(h.name))}">
        <span class="h-name"><span aria-hidden="true">${esc(h.emoji)}</span> ${esc(h.name)}</span>
        <span class="h-goal ${catCls(h.cat)}"><span class="dot"></span>${esc(h.goal || freqLabel(h.perWeek))}${h.goal ? ' · ' + freqLabel(h.perWeek) : ''}</span>
      </button>
      <div class="streak"><b aria-hidden="true">${s.n}</b><span aria-hidden="true">🔥 ${s.unit}</span><span class="sr-only">${T.streakSr(s.n, s.unit)}</span></div>
      ${week}
    </li>`;
  }

  /* ================= View: Today ================= */
  function heroHTML(d) {
    const a = auraFor(d), streak = docStreak(), isT = d === todayIso();
    const due = S.habits.filter(h => dueOn(h, d)), doneN = due.filter(h => has(h, d)).length;
    const name = S.profile && S.profile.name ? `, ${esc(S.profile.name)}` : '';
    return `<div>
        <p class="eyebrow">${(isT ? greeting() : T.lookingBack) + name}</p>
        <h1 class="display">Day ${dayNumber(d)}</h1>
        <p class="goal-note">${a >= DAILY_GOAL ? T.heroDone : T.heroLeft(DAILY_GOAL - a)}</p>
        <div class="pills">
          <span class="pill">🔥 ${T.streakPill(streak)}</span>
          <span class="pill">✅ ${T.habitsPill(doneN, due.length)}</span>
        </div>
      </div>
      ${ring(a / DAILY_GOAL, T.auraAria(a, DAILY_GOAL), a, 'Aura')}`;
  }
  function dayLog(d) {
    const x = getDay(d), out = [];
    x.meals.forEach(m => out.push({ t: m.time, e: mealType(m.type).e, txt: m.name, sub: mealLabel(m.type) }));
    x.workouts.forEach(w => out.push({ t: w.time, e: woType(w.type).e, txt: T.logWo(woLabel(w.type), w.duration), sub: w.distance ? `${num(w.distance, 1)} km` : '' }));
    S.habits.filter(h => has(h, d)).forEach(h => out.push({ t: '', e: h.emoji, txt: h.name, sub: T.habit }));
    if (x.water) out.push({ t: '', e: '💧', txt: T.waterLog(x.water), sub: '' });
    if (x.mood) out.push({ t: '', e: MOOD_E[x.mood - 1], txt: T.checkinLog(T.moods[x.mood - 1]), sub: x.sleep != null ? T.sleepLog(num(x.sleep, 1)) : '' });
    if ((x.win || '').trim()) out.push({ t: '', e: '🏆', txt: x.win.trim(), sub: T.winOfDay });
    S.photos.filter(p => p.date === d).forEach(() => out.push({ t: '', e: '📸', txt: T.progressPhoto, sub: '' }));
    return out.sort((a, b) => (a.t || '99:99').localeCompare(b.t || '99:99'));
  }
  function renderToday() {
    const d = viewDate, x = getDay(d), G = goals();
    const due = S.habits.filter(h => dueOn(h, d));
    const log = dayLog(d);
    const moodBtns = MOOD_E.map((e, i) => `<button type="button" data-action="mood" data-v="${i + 1}" data-k="mood-${i + 1}" aria-pressed="${x.mood === i + 1}" aria-label="${esc(T.moods[i])}"><span aria-hidden="true">${e}</span></button>`).join('');
    const energyBtns = [1, 2, 3, 4, 5].map(v => `<button type="button" data-action="energy" data-v="${v}" data-k="en-${v}" aria-pressed="${x.energy === v}" aria-label="${esc(T.energyAria(v))}">${v}</button>`).join('');
    const photosToday = S.photos.filter(p => p.date === d).length;
    $('#view-today').innerHTML = `
      <section class="card hero" id="todayHero" aria-live="polite">${heroHTML(d)}</section>

      <section aria-label="${esc(T.quickLog)}">
        <div class="quick">
          <button type="button" data-action="add-meal" data-k="q-meal"><span class="qe" aria-hidden="true">🍽️</span>${T.food}<small>${T.nToday(x.meals.length)}</small></button>
          <button type="button" data-action="water-delta" data-v="1" data-k="q-water" aria-label="${esc(T.drinkAria(x.water, G.water))}"><span class="qe" aria-hidden="true">💧</span>${T.water}<small aria-hidden="true">${x.water}/${G.water}</small></button>
          <button type="button" data-action="add-workout" data-k="q-wo"><span class="qe" aria-hidden="true">🏋️</span>${T.workout}<small>${minutesOf(x) ? minutesOf(x) + ' min' : '–'}</small></button>
          <button type="button" data-action="goto-checkin" data-k="q-ci"><span class="qe" aria-hidden="true">🧠</span>${T.checkin}<small>${x.mood ? MOOD_E[x.mood - 1] : T.open}</small></button>
          <button type="button" data-action="add-photo" data-k="q-ph"><span class="qe" aria-hidden="true">📸</span>${T.photo}<small>${photosToday || '–'}</small></button>
        </div>
      </section>

      <section class="card" aria-labelledby="h-th">
        <div class="sec-head"><h2 id="h-th">${T.habits}</h2><button type="button" class="link" data-action="nav" data-view="habits">${T.seeAll}</button></div>
        ${due.length ? `<ul class="hlist compact">${due.map(h => habitRow(h, d, false)).join('')}</ul>`
          : emptyState('🌱', S.habits.length ? T.nothingPlanned : T.noHabitsToday)}
      </section>

      <section class="card" id="checkin" aria-labelledby="h-ci">
        <h2 id="h-ci">${T.checkin}</h2>
        <div class="q"><p class="q-label" id="l-mood">${T.howFeeling}</p><div class="seg5" role="group" aria-labelledby="l-mood">${moodBtns}</div></div>
        <div class="q"><p class="q-label" id="l-en">${T.energy}</p><div class="seg5 num" role="group" aria-labelledby="l-en">${energyBtns}</div></div>
        <div class="q"><p class="q-label" id="l-sl">${T.sleepLast}</p>
          <div class="stepper" role="group" aria-labelledby="l-sl">
            <button type="button" class="icon-btn" data-action="sleep" data-v="-0.5" data-k="sl-m" aria-label="${esc(T.halfLess)}">−</button>
            <output aria-live="polite">${x.sleep != null ? num(x.sleep, 1) + ' h' : '– h'}</output>
            <button type="button" class="icon-btn" data-action="sleep" data-v="0.5" data-k="sl-p" aria-label="${esc(T.halfMore)}">+</button>
          </div>
        </div>
        <div class="q"><label class="field">${T.winLabel}
          <input type="text" data-field="win" data-k="f-win" maxlength="120" placeholder="${esc(T.winPh)}" value="${esc(x.win || '')}" autocomplete="off"></label></div>
        <div class="q"><label class="field">${T.journalLabel}
          <textarea data-field="journal" data-k="f-jr" rows="3" maxlength="3000" placeholder="${esc(T.journalPh)}">${esc(x.journal || '')}</textarea></label></div>
      </section>

      <section class="card" aria-labelledby="h-log">
        <div class="sec-head"><h2 id="h-log">${T.yourLog}</h2><span class="muted small">${T.nEntries(log.length)}</span></div>
        ${log.length ? `<ul class="log">${log.map(l => `<li>${l.t ? `<time>${esc(l.t)}</time>` : '<span class="nt" aria-hidden="true">•</span>'}<span class="le" aria-hidden="true">${esc(l.e)}</span><span>${esc(l.txt)}${l.sub ? ` <small>· ${esc(l.sub)}</small>` : ''}</span></li>`).join('')}</ul>`
          : emptyState('🗒️', T.nothingLogged)}
      </section>

      <button type="button" class="btn btn-primary wide" data-action="share" data-k="share">${T.shareBtn}</button>`;
  }

  /* ================= View: Habits ================= */
  function renderHabits() {
    const d = viewDate;
    const names = new Set(S.habits.map(h => h.name.trim().toLowerCase()));
    const ideas = TEMPLATES.map((_, i) => ({ t: tpl(i), i })).filter(o => !names.has(o.t.name.toLowerCase()));
    const done = S.habits.filter(h => has(h, d)).length;
    $('#view-habits').innerHTML = `
      <div class="view-head"><h1>${T.habits}</h1><button type="button" class="btn btn-primary sm" data-action="new-habit" data-k="nh">${T.newBtn}</button></div>
      <p class="view-sub">${T.habitsSub(weekNo(d), done, S.habits.length)}</p>
      <section class="card">
        ${S.habits.length ? `<ul class="hlist">${S.habits.map(h => habitRow(h, d, true)).join('')}</ul>` : emptyState('🌱', T.noHabits)}
      </section>
      ${ideas.length ? `<section class="card" aria-labelledby="h-ideas"><h2 id="h-ideas">${T.ideasTitle}</h2>
        <div class="chips">${ideas.map(o => `<button type="button" class="chip" data-action="add-template" data-i="${o.i}" data-k="tpl-${o.i}" aria-label="${esc(T.addAria(o.t.name))}"><span aria-hidden="true">${o.t.emoji}</span>${esc(o.t.name)}<span class="plus" aria-hidden="true">+</span></button>`).join('')}</div></section>` : ''}
      <p class="hint">${T.tip}</p>`;
  }

  /* ================= View: Food ================= */
  function renderFood() {
    const d = viewDate, x = getDay(d), G = goals();
    const glasses = Math.max(G.water, x.water);
    let gl = '';
    for (let i = 0; i < glasses; i++) gl += `<button type="button" class="glass${i < x.water ? ' full' : ''}" data-action="water-set" data-v="${i + 1}" data-k="gl-${i}" aria-label="${esc(T.nGlasses(i + 1))}" aria-pressed="${i < x.water}"></button>`;
    const prot = proteinOf(x), kcal = kcalOf(x);
    const groups = MEAL_TYPES.map(t => ({ t, list: x.meals.filter(m => m.type === t.id) })).filter(g => g.list.length);
    // Weekly recap: the 7 days up to the selected day
    let wWater = 0, wProt = 0, wProtDays = 0, wVeg = 0, wHome = 0, wMeals = 0;
    for (let i = 0; i < 7; i++) {
      const y = getDay(shift(d, -i)); wWater += y.water || 0; wMeals += y.meals.length;
      if (y.meals.length) { wProt += proteinOf(y); wProtDays++; }
      y.meals.forEach(m => { if ((m.tags || []).includes('veg')) wVeg++; if ((m.tags || []).includes('home')) wHome++; });
    }
    $('#view-food').innerHTML = `
      <div class="view-head"><h1>${T.food}</h1><button type="button" class="btn btn-primary sm" data-action="add-meal" data-k="am">${T.addMeal}</button></div>
      <section class="card" aria-labelledby="h-water">
        <div class="sec-head"><h2 id="h-water">💧 ${T.water}</h2><span class="big-num">${num(x.water * 0.25, 2)} L</span></div>
        <div class="glasses" role="group" aria-label="${esc(T.waterGroupAria(x.water, G.water))}">${gl}</div>
        <div class="row-between">
          <button type="button" class="icon-btn" data-action="water-delta" data-v="-1" data-k="w-m" aria-label="${esc(T.oneLess)}"${x.water ? '' : ' disabled'}>−</button>
          <span class="muted small">${T.glassesOf(x.water, G.water)}</span>
          <button type="button" class="icon-btn" data-action="water-delta" data-v="1" data-k="w-p" aria-label="${esc(T.oneMore)}">+</button>
        </div>
      </section>
      ${G.protein > 0 ? `<section class="card" aria-labelledby="h-prot">
        <div class="sec-head"><h2 id="h-prot">💪 ${T.protein}</h2><span class="big-num">${num(prot)} <span class="muted small">/ ${G.protein} g</span></span></div>
        ${bar(prot / G.protein)}
        <p class="hint" style="margin-top:8px">${prot >= G.protein ? T.protDone : T.protLeft(num(G.protein - prot))}${kcal ? ' · ' + T.kcalLogged(num(kcal)) : ''}</p>
      </section>` : ''}
      <section class="card" aria-labelledby="h-meals">
        <div class="sec-head"><h2 id="h-meals">${T.meals}</h2><span class="muted small">${T.nLogged(x.meals.length)}${!G.protein && kcal ? ` · ${num(kcal)} kcal` : ''}</span></div>
        ${groups.length ? groups.map(g => `<p class="group-label">${T.mealTypes[g.t.id]}</p><ul class="items">${g.list.map(m => `<li>
            <button type="button" class="item" data-action="edit-meal" data-id="${m.id}" data-k="ml-${m.id}">
              <span class="ic" aria-hidden="true">${g.t.e}</span>
              <span style="min-width:0"><b>${esc(m.name)}</b><small>${esc(m.time || '')}${(m.tags || []).length ? ' · ' + m.tags.map(t => T.mealTags[t]).filter(Boolean).join(', ') : ''}</small></span>
              <span class="side">${m.protein ? num(m.protein) + ' g' : ''}${m.kcal ? `<small>${num(m.kcal)} kcal</small>` : ''}</span>
            </button></li>`).join('')}</ul>`).join('')
          : emptyState('🍽️', T.noMeals)}
      </section>
      <section class="card" aria-labelledby="h-fw">
        <h2 id="h-fw">${T.last7}</h2>
        <div class="stats three">
          <div class="stat"><b>${num(wWater / 7 * 0.25, 1)} L</b><span>${T.avgWater}</span></div>
          <div class="stat"><b>${wProtDays ? num(wProt / wProtDays) + ' g' : '–'}</b><span>${T.avgProtein}</span></div>
          <div class="stat"><b>${wMeals}</b><span>${T.mealsLower}</span></div>
          <div class="stat"><b>${wVeg}</b><span>${T.withVeg}</span></div>
          <div class="stat"><b>${wHome}</b><span>${T.homeCooked}</span></div>
          <div class="stat"><b>${wMeals ? Math.round((wVeg / wMeals) * 100) + ' %' : '–'}</b><span>${T.vegRate}</span></div>
        </div>
      </section>`;
  }

  /* ================= View: Training ================= */
  function renderTrain() {
    const d = viewDate, x = getDay(d), G = goals(), m = mondayOf(d);
    const mins = [], sessions = [];
    for (let i = 0; i < 7; i++) { const y = getDay(shift(m, i)); mins.push(minutesOf(y)); sessions.push(y.workouts.length); }
    const wkSessions = sessions.reduce((a, b) => a + b, 0), wkMin = mins.reduce((a, b) => a + b, 0), max = Math.max(60, ...mins);
    const bars = mins.map((v, i) => `<div class="wbar${shift(m, i) === d ? ' sel' : ''}"><em>${v || ''}</em><div class="col-wrap"><div class="col${v ? '' : ' zero'}" style="height:${v ? Math.max(6, v / max * 100) : 4}%"></div></div><span>${T.short[i]}</span></div>`).join('');
    const prs = prList(), hist = allWorkouts().filter(o => o.d !== d).slice(0, 6);
    const woItem = (w, date) => `<li><button type="button" class="item" data-action="edit-workout" data-id="${w.id}" data-date="${date}" data-k="wo-${w.id}">
        <span class="ic" aria-hidden="true">${woType(w.type).e}</span>
        <span style="min-width:0"><b>${woLabel(w.type)}${w.distance ? ` · ${num(w.distance, 1)} km` : ''}</b>
          <small>${date !== d ? relLabel(date) + ' · ' : ''}${esc(w.time || '')}${(w.exercises || []).length ? ' · ' + esc(w.exercises.map(exSummary).join(', ')) : w.note ? ' · ' + esc(w.note) : ''}</small></span>
        <span class="side">${w.duration} min<small>${'●'.repeat(w.intensity || 0)}${'○'.repeat(5 - (w.intensity || 0))}</small></span>
      </button></li>`;
    $('#view-train').innerHTML = `
      <div class="view-head"><h1>${T.training}</h1><button type="button" class="btn btn-primary sm" data-action="add-workout" data-k="aw">${T.addWorkout}</button></div>
      <section class="card" aria-labelledby="h-tw">
        <h2 id="h-tw">${relLabel(d)}</h2>
        ${x.workouts.length ? `<ul class="items">${x.workouts.map(w => woItem(w, d)).join('')}</ul>`
          : emptyState('🏋️', d === todayIso() ? T.noWoToday : T.noWoDay)}
      </section>
      <section class="card" aria-labelledby="h-wk">
        <div class="sec-head"><h2 id="h-wk">${T.weekN(weekNo(d))}</h2><span class="muted small">${T.wkSummary(wkSessions, G.workouts, wkMin)}</span></div>
        ${bar(wkSessions / G.workouts)}
        <div class="wbars" role="img" aria-label="${esc(T.minutesAria + ': ' + mins.map((v, i) => `${T.days[i]} ${v}`).join(', '))}" style="margin-top:16px">${bars}</div>
      </section>
      <section class="card" aria-labelledby="h-pr">
        <h2 id="h-pr">${T.prs}</h2>
        ${prs.length ? `<ul class="items">${prs.map(p => `<li><div class="item" style="cursor:default"><span class="ic" aria-hidden="true">💪</span><span style="min-width:0"><b>${esc(p.name)}</b><small>${shortDate(p.d)}${p.reps ? ' · ' + T.repsN(p.reps) : ''}</small></span><span class="side">${num(p.kg, 1)} kg</span></div></li>`).join('')}</ul>`
          : emptyState('📈', T.noPRs)}
      </section>
      ${hist.length ? `<section class="card" aria-labelledby="h-hist"><h2 id="h-hist">${T.recentWo}</h2><ul class="items">${hist.map(o => woItem(o.w, o.d)).join('')}</ul></section>` : ''}`;
  }

  /* ================= View: Progress ================= */
  function heatmapHTML() {
    const t = todayIso(), start = shift(mondayOf(t), -77); let cells = '', docDays = 0;
    for (let i = 0; i < 84; i++) {
      const d = shift(start, i);
      if (d > t) { cells += '<i class="fut"></i>'; continue; }
      const a = auraFor(d); if (a > 0) docDays++;
      const l = a === 0 ? '' : a < 30 ? 'l1' : a < 60 ? 'l2' : a < DAILY_GOAL ? 'l3' : 'l4';
      cells += `<i class="${l}${d === t ? ' now' : ''}" title="${esc(shortDate(d))}: ${a} Aura"></i>`;
    }
    return `<div class="heat" role="img" aria-label="${esc(T.heatAria(docDays))}">${cells}</div>
      <div class="legend" aria-hidden="true">${T.less} <i style="background:var(--surface-2)"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> ${T.more}</div>`;
  }
  function chartHTML() {
    const t = todayIso(), pts = [];
    for (let i = 13; i >= 0; i--) { const d = shift(t, -i), x = getDay(d); pts.push({ d, mood: x.mood || null, sleep: x.sleep == null ? null : x.sleep }); }
    const W = 320, H = 150, L = 26, R = 8, T0 = 10, B = 22, iw = W - L - R, ih = H - T0 - B;
    const xp = i => L + iw * i / 13;
    const ym = v => T0 + ih * (1 - (v - 1) / 4);
    const ys = v => T0 + ih * (1 - clamp(v, 0, 12) / 12);
    const line = (k, f) => { let s = '', pen = false; pts.forEach((p, i) => { if (p[k] == null) { pen = false; return; } s += `${pen ? 'L' : 'M'}${xp(i).toFixed(1)} ${f(p[k]).toFixed(1)} `; pen = true; }); return s; };
    const dots = (k, f, c) => pts.map((p, i) => p[k] == null ? '' : `<circle class="${c}" cx="${xp(i).toFixed(1)}" cy="${f(p[k]).toFixed(1)}" r="3.5"/>`).join('');
    const moods = pts.filter(p => p.mood), sleeps = pts.filter(p => p.sleep != null);
    const am = moods.length ? moods.reduce((s, p) => s + p.mood, 0) / moods.length : null;
    const as = sleeps.length ? sleeps.reduce((s, p) => s + p.sleep, 0) / sleeps.length : null;
    if (!moods.length && !sleeps.length) return emptyState('📉', T.chartEmpty);
    const label = T.chartLabel(am ? num(am, 1) : '', as != null ? num(as, 1) : '');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
        ${[1, 3, 5].map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${ym(v)}" y2="${ym(v)}"/><text x="0" y="${ym(v) + 3}">${MOOD_E[v - 1]}</text>`).join('')}
        <path class="l-sleep" d="${line('sleep', ys)}"/>${dots('sleep', ys, 'p-sleep')}
        <path class="l-mood" d="${line('mood', ym)}"/>${dots('mood', ym, 'p-mood')}
        <text x="${L}" y="${H - 4}">${esc(shortDate(pts[0].d))}</text>
        <text x="${xp(7)}" y="${H - 4}" text-anchor="middle">${esc(shortDate(pts[7].d))}</text>
        <text x="${W - R}" y="${H - 4}" text-anchor="end">${T.todayLower}</text>
      </svg>
      <div class="keys"><span><i></i>${T.mood}${am ? ` ${T.avg} ${num(am, 1)}` : ''}</span><span><i class="dash"></i>${T.sleep}${as != null ? ` ${T.avg} ${num(as, 1)} h` : ''}</span></div></div>`;
  }
  function renderProgress() {
    const L = level(totalAura()), ds = allDates();
    const documented = ds.filter(d => auraFor(d) > 0).length;
    const habitsDone = S.habits.reduce((s, h) => s + h.done.length, 0);
    const workouts = allWorkouts().length;
    const photos = S.photos.slice().sort((a, b) => b.date.localeCompare(a.date));
    const oldest = photos[photos.length - 1], newest = photos[0];
    const wins = Object.keys(S.days).sort().reverse().filter(d => (S.days[d].win || '').trim() || (S.days[d].journal || '').trim()).slice(0, 8);
    let ladder = ''; for (let i = 0; i < LEVEL_AT.length; i++) ladder += `<i class="${i <= L.i ? 'on' : ''}"></i>`;
    $('#view-progress').innerHTML = `
      <div class="view-head"><h1>${T.progress}</h1></div>
      <section class="card lvl-card" aria-labelledby="h-lvl">
        <div class="lvl-top">
          <div class="lvl-badge" aria-hidden="true"><small>${T.level}</small><b>${L.n}</b></div>
          <div><h2 class="lvl-name" id="h-lvl">${esc(L.name)}</h2><p class="muted">${T.auraCollected(num(L.total))}</p></div>
        </div>
        ${bar(L.p)}
        <p class="hint" style="margin-top:8px">${L.to != null ? T.auraTo(num(L.to - L.total), esc(L.nextName)) : T.maxLevel}</p>
        <div class="ladder" role="img" aria-label="${esc(T.levelOf(L.n, LEVEL_AT.length))}">${ladder}</div>
      </section>
      <section class="stats" aria-label="${esc(T.stats)}">
        <div class="stat"><b>${documented}</b><span>${T.daysLogged}</span></div>
        <div class="stat"><b>${bestStreak()}</b><span>${T.longestStreak}</span></div>
        <div class="stat"><b>${habitsDone}</b><span>${T.habitsChecked}</span></div>
        <div class="stat"><b>${workouts}</b><span>${T.workoutsLower}</span></div>
      </section>
      <section class="card" aria-labelledby="h-heat"><h2 id="h-heat">${T.consistency}</h2>${heatmapHTML()}</section>
      <section class="card" aria-labelledby="h-chart"><h2 id="h-chart">${T.moodSleep}</h2>${chartHTML()}</section>
      <section class="card" aria-labelledby="h-ph">
        <div class="sec-head"><h2 id="h-ph">${T.photos}</h2><button type="button" class="btn sm" data-action="add-photo" data-k="ph-add">${T.addPhoto}</button></div>
        ${photos.length >= 2 ? `<div class="compare">
            <figure><img data-photo="${oldest.id}" alt="${esc(T.firstPhoto(fullDate(oldest.date)))}"><figcaption>Day ${dayNumber(oldest.date)}</figcaption></figure>
            <figure><img data-photo="${newest.id}" alt="${esc(T.latestPhoto(fullDate(newest.date)))}"><figcaption>Day ${dayNumber(newest.date)}</figcaption></figure>
          </div>` : ''}
        ${photos.length ? `<div class="photos">${photos.map(p => `<button type="button" class="photo-btn" data-action="view-photo" data-id="${p.id}" data-k="pv-${p.id}" aria-label="${esc(T.viewPhoto(fullDate(p.date)))}"><img data-photo="${p.id}" alt=""><span class="cap" aria-hidden="true">Day ${dayNumber(p.date)}</span></button>`).join('')}</div>`
          : emptyState('🤳', T.noPhotos)}
      </section>
      <section class="card" aria-labelledby="h-wins">
        <h2 id="h-wins">${T.wins}</h2>
        ${wins.length ? `<ul class="wins">${wins.map(d => { const x = S.days[d]; return `<li><time datetime="${d}">${fullDate(d)} · Day ${dayNumber(d)}</time>${(x.win || '').trim() ? `<p><strong>${esc(x.win.trim())}</strong></p>` : ''}${(x.journal || '').trim() ? `<p class="muted">${esc(x.journal.trim())}</p>` : ''}</li>`; }).join('')}</ul>`
          : emptyState('✍️', T.noWins)}
      </section>`;
  }

  /* ================= Render ================= */
  const VIEWS = { today: renderToday, habits: renderHabits, food: renderFood, train: renderTrain, progress: renderProgress };
  function renderChrome() {
    $$('.tabbar [data-view]').forEach(b => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    const isT = viewDate === todayIso();
    $('#datebar').hidden = view === 'progress';
    $('#dateLabel').textContent = relLabel(viewDate);
    $('#dateSub').textContent = fullDate(viewDate);
    $('#dateNext').disabled = isT;
    $('#dateToday').hidden = isT;
    const L = level(totalAura());
    const chip = $('#levelChip');
    chip.innerHTML = `<span class="lv">Lv ${L.n}</span>${esc(L.name)}`;
    chip.setAttribute('aria-label', T.levelAria(L.n, L.name));
  }
  function render() {
    if (viewDate > todayIso()) viewDate = todayIso();
    const ae = document.activeElement, k = ae && ae.dataset ? ae.dataset.k : null;
    renderChrome();
    VIEWS[view]();
    if (k) { const el = document.querySelector(`[data-k="${CSS.escape(k)}"]`); if (el && el !== document.activeElement && !el.disabled) el.focus({ preventScroll: true }); }
    if (view === 'progress') hydratePhotos();
  }
  async function hydratePhotos() {
    for (const img of $$('img[data-photo]')) {
      try { const u = await photoURL(img.dataset.photo); if (u) img.src = u; } catch (e) { /* photo missing */ }
    }
  }
  function refreshHero() {
    const h = $('#todayHero'); if (h) h.innerHTML = heroHTML(viewDate);
    renderChrome();
  }

  /* ================= Feedback ================= */
  let toastTimer = null;
  function toast(msg, big) {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('big', !!big); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), big ? 3800 : 2600);
  }
  function confetti() {
    if (reduceMotion()) return;
    const wrap = document.createElement('div'); wrap.className = 'confetti'; wrap.setAttribute('aria-hidden', 'true');
    const cols = ['#c8ff3e', '#a891ff', '#ff7ab3', '#5fd7f5', '#ffab52'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * .5 + 's'; p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap); setTimeout(() => wrap.remove(), 2600);
  }
  function celebrate(msg) { toast(msg, true); confetti(); if (navigator.vibrate) try { navigator.vibrate([18, 40, 18]); } catch (e) { /* fine */ } }
  function checkLevel() {
    const L = level(totalAura());
    if (S.lastLevel == null || L.n < S.lastLevel) { S.lastLevel = L.n; save(); return false; }
    if (L.n > S.lastLevel) { S.lastLevel = L.n; save(); celebrate(T.levelUp(L.name)); return true; }
    return false;
  }
  function commit(msg) {
    save(); render();
    const leveled = checkLevel();
    if (msg && !leveled) toast(msg);
  }

  /* ================= Actions ================= */
  const actions = {
    nav(el) { view = el.dataset.view; render(); window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); },
    'date-prev'() { viewDate = shift(viewDate, -1); render(); },
    'date-next'() { if (viewDate < todayIso()) { viewDate = shift(viewDate, 1); render(); } },
    'date-today'() { viewDate = todayIso(); render(); const b = $('#datePrev'); if (b) b.focus({ preventScroll: true }); },
    tick(el) {
      const h = findHabit(el.dataset.id); if (!h) return;
      const on = toggleDone(h, viewDate);
      const due = S.habits.filter(x => dueOn(x, viewDate));
      const all = on && due.length > 1 && due.every(x => has(x, viewDate));
      save(); render();
      if (checkLevel()) return;
      if (all) celebrate(T.allHabitsDone);
      else if (on) toast(`+${AURA.habit} Aura · ${h.name} ✅`);
    },
    'day-toggle'(el) { const h = findHabit(el.dataset.id); if (!h) return; const on = toggleDone(h, el.dataset.date); commit(on ? T.loggedFor(h.name, T.days[wd(el.dataset.date)]) : null); },
    'new-habit'() { openHabit(null); },
    'edit-habit'(el) { openHabit(findHabit(el.dataset.id)); },
    'add-template'(el) { const i = Number(el.dataset.i); if (!TEMPLATES[i]) return; const t = tpl(i); S.habits.push(newHabit(t)); commit(T.added(`${t.emoji} ${t.name}`)); },
    'add-meal'() { openMeal(null); },
    'edit-meal'(el) { openMeal(getDay(viewDate).meals.find(m => m.id === el.dataset.id)); },
    'water-delta'(el) {
      const x = ensureDay(viewDate), G = goals(), before = x.water;
      x.water = clamp(before + Number(el.dataset.v), 0, 30);
      const msg = x.water > before ? (x.water === G.water ? T.waterGoalMaxx : x.water < G.water ? `+${AURA.water} Aura · ${T.glassesProgress(x.water, G.water)}` : T.nGlasses(x.water)) : null;
      commit(msg);
    },
    'water-set'(el) {
      const x = ensureDay(viewDate); let v = Number(el.dataset.v); if (v === x.water) v -= 1;
      x.water = clamp(v, 0, 30); commit(x.water === goals().water ? T.waterGoal : null);
    },
    'add-workout'() { openWorkout(null, viewDate); },
    'edit-workout'(el) { const d = el.dataset.date || viewDate; openWorkout((getDay(d).workouts || []).find(w => w.id === el.dataset.id), d); },
    mood(el) { const x = ensureDay(viewDate), v = Number(el.dataset.v), first = !x.mood; x.mood = x.mood === v ? null : v; commit(first && x.mood ? `+${AURA.checkin} Aura · ${T.checkinSaved}` : null); },
    energy(el) { const x = ensureDay(viewDate), v = Number(el.dataset.v); x.energy = x.energy === v ? null : v; commit(); },
    sleep(el) { const x = ensureDay(viewDate); x.sleep = x.sleep == null ? 7.5 : clamp(x.sleep + Number(el.dataset.v), 0, 16); commit(); },
    'goto-checkin'() {
      const c = $('#checkin'); if (!c) return;
      c.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      const b = $('#checkin [data-action="mood"]'); if (b) setTimeout(() => b.focus({ preventScroll: true }), reduceMotion() ? 0 : 350);
    },
    'add-photo'() { $('#photoInput').click(); },
    'view-photo'(el) { openPhoto(el.dataset.id); },
    share() { openShare(viewDate); },
    settings() { openSettings(); }
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if (!el || el.disabled) return;
    const fn = actions[el.dataset.action]; if (!fn) return;
    e.preventDefault(); fn(el, e);
  });
  // Win & journal: save while typing, update Aura when leaving the field
  document.addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.field; if (!f) return;
    ensureDay(viewDate)[f] = e.target.value;
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 400);
  });
  document.addEventListener('change', e => {
    if (!(e.target.dataset && e.target.dataset.field)) return;
    save(); refreshHero(); checkLevel();
  });

  /* ================= Dialogs: shared ================= */
  function radios(container, name, items, labelFn) {
    const cur = radioVal(name);
    $(container).innerHTML = items.map(it => `<label><input type="radio" name="${name}" value="${esc(it.id)}"><span>${labelFn(it)}</span></label>`).join('');
    if (cur) setRadio(name, cur);
  }
  const setRadio = (name, val) => { const el = document.querySelector(`input[name="${name}"][value="${CSS.escape(String(val))}"]`); if (el) el.checked = true; };
  const radioVal = name => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : null; };
  let lastFocus = null;
  function show(sel, focusSel) {
    const dlg = $(sel); lastFocus = document.activeElement;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.scrollTop = 0;
    if (focusSel) { const f = $(focusSel); if (f) setTimeout(() => f.focus(), 30); }
  }
  function hide(dlg) { if (typeof dlg === 'string') dlg = $(dlg); if (dlg.open) dlg.close(); }
  $$('dialog').forEach(dlg => {
    dlg.addEventListener('click', e => { if (e.target === dlg) hide(dlg); if (e.target.closest('[data-close]')) hide(dlg); });
    dlg.addEventListener('close', () => {
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      else if (lastFocus && lastFocus.dataset && lastFocus.dataset.k) { const el = document.querySelector(`[data-k="${CSS.escape(lastFocus.dataset.k)}"]`); if (el) el.focus({ preventScroll: true }); }
    });
  });
  // Two-step delete: first tap asks, second tap deletes
  function armDelete(btn, label) { btn.textContent = label; btn.dataset.armed = ''; }
  function confirmStep(btn, label) {
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = T.reallyDelete; return false; }
    btn.dataset.armed = ''; btn.textContent = label; return true;
  }

  /* Dialog pieces that depend on the language */
  function buildDialogParts() {
    radios('#hCat', 'hcat', CAT_IDS.map(id => ({ id })), it => esc(T.cats[it.id]));
    radios('#hFreq', 'hfreq', [1, 2, 3, 4, 5, 6, 7].map(n => ({ id: String(n) })), it => it.id);
    $('#hEmojiPick').innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}" aria-label="${esc(T.emojiAria(e))}" aria-pressed="false">${e}</button>`).join('');
    radios('#mType', 'mtype', MEAL_TYPES, it => `<span aria-hidden="true">${it.e}</span>${esc(T.mealTypes[it.id])}`);
    const checked = $$('#mTags input:checked').map(i => i.value);
    $('#mTags').innerHTML = MEAL_TAGS.map(t => `<label><input type="checkbox" name="mtag" value="${t.id}"${checked.includes(t.id) ? ' checked' : ''}><span><span aria-hidden="true">${t.e}</span>${esc(T.mealTags[t.id])}</span></label>`).join('');
    radios('#wType', 'wtype', WO_TYPES, it => `<span aria-hidden="true">${it.e}</span>${esc(T.woTypes[it.id])}`);
    radios('#wInt', 'wint', [1, 2, 3, 4, 5].map(n => ({ id: String(n) })), it => it.id);
    const langLabel = it => `${FLAGS[it.id]()}<span lang="${it.id}">${esc(dict[it.id].langName)}</span>`;
    radios('#sLang', 'lang', LANGS.map(id => ({ id })), langLabel);
    radios('#oLang', 'olang', LANGS.map(id => ({ id })), langLabel);
  }

  /* ================= Dialog: Habit ================= */
  let editingHabit = null;
  function syncEmojiPick() { const v = $('#hEmoji').value.trim(); $$('#hEmojiPick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.emoji === v))); }
  $('#hEmojiPick').addEventListener('click', e => { const b = e.target.closest('[data-emoji]'); if (!b) return; $('#hEmoji').value = b.dataset.emoji; syncEmojiPick(); });
  $('#hEmoji').addEventListener('input', syncEmojiPick);
  function freqNote() { const n = Number(radioVal('hfreq') || 7); $('#hFreqNote').textContent = n === 7 ? T.everyDay : T.freqNote(n); }
  $('#hFreq').addEventListener('change', freqNote);
  function openHabit(h) {
    editingHabit = h || null;
    const src = h || { emoji: '⭐', name: '', goal: '', cat: 'mind', perWeek: 7 };
    $('#hTitle').textContent = h ? T.editHabit : T.newHabit;
    $('#hSave').textContent = h ? T.save : T.add;
    $('#hEmoji').value = src.emoji; $('#hName').value = src.name; $('#hGoal').value = src.goal || '';
    setRadio('hcat', src.cat); setRadio('hfreq', String(src.perWeek)); freqNote(); syncEmojiPick();
    $('#hDelete').hidden = !h; armDelete($('#hDelete'), T.delete);
    show('#dlgHabit', h ? null : '#hName');
  }
  $('#hDelete').addEventListener('click', function () {
    if (!editingHabit || !confirmStep(this, T.delete)) return;
    const name = editingHabit.name; S.habits = S.habits.filter(h => h.id !== editingHabit.id);
    hide('#dlgHabit'); commit(T.deleted(name));
  });
  $('#formHabit').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#hName').value.trim(); if (!name) { $('#hName').focus(); return; }
    const data = { emoji: $('#hEmoji').value.trim() || '⭐', name, goal: $('#hGoal').value.trim(), cat: radioVal('hcat') || 'mind', perWeek: Number(radioVal('hfreq') || 7) };
    if (editingHabit) Object.assign(editingHabit, data); else S.habits.push(newHabit(data));
    const isNew = !editingHabit; hide('#dlgHabit'); commit(isNew ? T.added(`${data.emoji} ${name}`) : T.saved);
  });

  /* ================= Dialog: Meal ================= */
  let editingMeal = null, recentCache = [];
  function defaultMealType() { const n = new Date(), h = n.getHours() + n.getMinutes() / 60; return h < 10.5 ? 'breakfast' : h < 14.5 ? 'lunch' : h < 17.5 ? 'snack' : 'dinner'; }
  function fillMeal(m) {
    setRadio('mtype', m.type || defaultMealType()); $('#mName').value = m.name || '';
    $('#mProtein').value = m.protein != null ? m.protein : ''; $('#mKcal').value = m.kcal != null ? m.kcal : '';
    $$('#mTags input').forEach(i => { i.checked = (m.tags || []).includes(i.value); });
  }
  function openMeal(m) {
    editingMeal = m || null;
    $('#mTitle').textContent = m ? T.editMeal : T.logMeal;
    fillMeal(m || {});
    $('#mTime').value = m ? (m.time || '') : (viewDate === todayIso() ? nowTime() : '12:00');
    recentCache = m ? [] : recentMeals();
    $('#mRecent').innerHTML = recentCache.length ? `<p class="q-label" style="margin-bottom:8px">${T.logAgain}</p><div class="chips">${recentCache.map((r, i) => `<button type="button" class="chip" data-recent="${i}"><span aria-hidden="true">${mealType(r.type).e}</span>${esc(r.name)}</button>`).join('')}</div>` : '';
    $('#mRecent').hidden = !recentCache.length;
    $('#mDelete').hidden = !m; armDelete($('#mDelete'), T.delete);
    show('#dlgMeal', m ? null : '#mName');
  }
  $('#mRecent').addEventListener('click', e => {
    const b = e.target.closest('[data-recent]'); if (!b) return;
    const r = recentCache[Number(b.dataset.recent)]; if (!r) return;
    fillMeal(Object.assign({}, r, { type: defaultMealType() })); $('#mName').focus();
  });
  $('#mDelete').addEventListener('click', function () {
    if (!editingMeal || !confirmStep(this, T.delete)) return;
    const x = ensureDay(viewDate); x.meals = x.meals.filter(m => m.id !== editingMeal.id);
    hide('#dlgMeal'); commit(T.mealDeleted);
  });
  $('#formMeal').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#mName').value.trim(); if (!name) { $('#mName').focus(); return; }
    const p = numOrNull($('#mProtein').value), k = numOrNull($('#mKcal').value);
    const meal = {
      id: editingMeal ? editingMeal.id : uid(), type: radioVal('mtype') || defaultMealType(), name,
      time: $('#mTime').value || '', protein: p == null ? null : clamp(Math.round(p), 0, 300), kcal: k == null ? null : clamp(Math.round(k), 0, 5000),
      tags: $$('#mTags input:checked').map(i => i.value)
    };
    const x = ensureDay(viewDate);
    if (editingMeal) { const i = x.meals.findIndex(m => m.id === editingMeal.id); if (i >= 0) x.meals[i] = meal; else x.meals.push(meal); }
    else x.meals.push(meal);
    x.meals.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const isNew = !editingMeal; hide('#dlgMeal');
    commit(isNew ? (x.meals.length <= 6 ? `+${AURA.meal} Aura · ${T.logged(name)}` : T.logged(name)) : T.saved);
  });

  /* ================= Dialog: Workout ================= */
  let editingWo = null, editingWoDate = null;
  function exRowHTML(e, i) {
    return `<input class="ex-name" list="exList" placeholder="${esc(T.exPh)}" aria-label="${esc(T.exName(i))}" value="${esc(e.name || '')}" autocomplete="off">
      <input class="ex-sets" type="number" inputmode="numeric" min="1" max="30" placeholder="3" aria-label="${esc(T.exSets(i))}" value="${e.sets != null ? e.sets : ''}">
      <input class="ex-reps" type="number" inputmode="numeric" min="1" max="300" placeholder="10" aria-label="${esc(T.exReps(i))}" value="${e.reps != null ? e.reps : ''}">
      <input class="ex-kg" type="number" inputmode="decimal" min="0" max="999" step="0.5" placeholder="kg" aria-label="${esc(T.exKg(i))}" value="${e.kg != null ? e.kg : ''}">
      <button type="button" class="icon-btn sm" data-ex-remove aria-label="${esc(T.removeEx(i))}">×</button>`;
  }
  function addExRow(e) {
    const wrap = $('#wEx'), div = document.createElement('div');
    div.className = 'ex-row'; div.innerHTML = exRowHTML(e || {}, wrap.children.length + 1); wrap.appendChild(div);
    return div;
  }
  function renumberEx() {
    $$('#wEx .ex-row').forEach((row, i) => {
      const n = i + 1;
      row.querySelector('.ex-name').setAttribute('aria-label', T.exName(n));
      row.querySelector('.ex-name').setAttribute('placeholder', T.exPh);
      row.querySelector('.ex-sets').setAttribute('aria-label', T.exSets(n));
      row.querySelector('.ex-reps').setAttribute('aria-label', T.exReps(n));
      row.querySelector('.ex-kg').setAttribute('aria-label', T.exKg(n));
      row.querySelector('[data-ex-remove]').setAttribute('aria-label', T.removeEx(n));
    });
  }
  $('#wAddEx').addEventListener('click', () => { addExRow().querySelector('.ex-name').focus(); });
  $('#wEx').addEventListener('click', e => {
    const b = e.target.closest('[data-ex-remove]'); if (!b) return;
    b.closest('.ex-row').remove(); if (!$('#wEx').children.length) addExRow(); renumberEx(); $('#wAddEx').focus();
  });
  function updateWoFields() { const t = radioVal('wtype'); $('#wDistWrap').hidden = !DIST_TYPES.includes(t); $('#wExWrap').hidden = t !== 'strength'; }
  $('#wType').addEventListener('change', updateWoFields);
  function openWorkout(w, date) {
    editingWo = w || null; editingWoDate = date || viewDate;
    const last = allWorkouts()[0];
    $('#wTitle').textContent = w ? T.editWorkout : T.logWorkout;
    setRadio('wtype', w ? w.type : (last ? last.w.type : 'strength'));
    $('#wDur').value = w ? w.duration : (last ? last.w.duration : 45);
    $('#wTime').value = w ? (w.time || '') : (editingWoDate === todayIso() ? nowTime() : '18:00');
    setRadio('wint', String(w ? (w.intensity || 3) : 3));
    $('#wDist').value = w && w.distance != null ? w.distance : '';
    $('#wNote').value = w ? (w.note || '') : '';
    $('#wEx').innerHTML = '';
    (w && w.exercises && w.exercises.length ? w.exercises : [{}]).forEach(addExRow);
    $('#exList').innerHTML = exerciseNames().map(n => `<option value="${esc(n)}"></option>`).join('');
    updateWoFields();
    $('#wDelete').hidden = !w; armDelete($('#wDelete'), T.delete);
    show('#dlgWorkout');
  }
  $('#wDelete').addEventListener('click', function () {
    if (!editingWo || !confirmStep(this, T.delete)) return;
    const x = ensureDay(editingWoDate); x.workouts = x.workouts.filter(w => w.id !== editingWo.id);
    hide('#dlgWorkout'); commit(T.workoutDeleted);
  });
  $('#formWorkout').addEventListener('submit', e => {
    e.preventDefault();
    const dur = Math.round(numOrNull($('#wDur').value) || 0); if (dur < 1) { $('#wDur').focus(); return; }
    const type = radioVal('wtype') || 'strength';
    const exercises = type !== 'strength' ? [] : $$('#wEx .ex-row').map(r => ({
      name: r.querySelector('.ex-name').value.trim(),
      sets: numOrNull(r.querySelector('.ex-sets').value), reps: numOrNull(r.querySelector('.ex-reps').value), kg: numOrNull(r.querySelector('.ex-kg').value)
    })).filter(x => x.name);
    const id = editingWo ? editingWo.id : uid();
    // New personal record?
    let pr = null;
    for (const ex of exercises) { if (!(ex.kg > 0)) continue; const prev = maxKg(ex.name, id); if (prev > 0 && ex.kg > prev && (!pr || ex.kg - prev > pr.diff)) pr = { name: ex.name, kg: ex.kg, diff: ex.kg - prev }; }
    const dist = numOrNull($('#wDist').value);
    const wo = { id, type, duration: clamp(dur, 1, 600), time: $('#wTime').value || '', intensity: Number(radioVal('wint') || 3), distance: DIST_TYPES.includes(type) && dist ? clamp(dist, 0, 500) : null, exercises, note: $('#wNote').value.trim() };
    const x = ensureDay(editingWoDate);
    if (editingWo) { const i = x.workouts.findIndex(w => w.id === id); if (i >= 0) x.workouts[i] = wo; else x.workouts.push(wo); }
    else x.workouts.push(wo);
    x.workouts.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const isNew = !editingWo; hide('#dlgWorkout');
    save(); render();
    if (checkLevel()) return;
    if (pr) celebrate(T.newPR(pr.name, num(pr.kg, 1)));
    else toast(isNew ? `+${AURA.workout} Aura · ${T.logWo(woLabel(type), wo.duration)} 💪` : T.saved);
  });

  /* ================= Photos ================= */
  async function compress(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const sc = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', .84));
    } finally { URL.revokeObjectURL(url); }
  }
  $('#photoInput').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const date = view === 'progress' ? todayIso() : viewDate;
    try {
      const first = !S.photos.some(p => p.date === date);
      const blob = await compress(f), id = 'p' + uid();
      await idb.put(id, blob); S.photos.push({ id, date });
      commit(first ? `+${AURA.photo} Aura · ${T.photoSaved}` : T.photoSaved);
    } catch (err) { toast(T.photoFail); }
  });
  let viewingPhoto = null;
  async function openPhoto(id) {
    const p = S.photos.find(x => x.id === id); if (!p) return;
    viewingPhoto = p; $('#pTitle').textContent = `Day ${dayNumber(p.date)} · ${fullDate(p.date)}`;
    const img = $('#pImg'); img.removeAttribute('src'); img.alt = T.photoAlt(fullDate(p.date));
    armDelete($('#pDelete'), T.delete); show('#dlgPhoto');
    try { const u = await photoURL(id); if (u) img.src = u; } catch (e) { /* ignore */ }
  }
  $('#pDelete').addEventListener('click', async function () {
    if (!viewingPhoto || !confirmStep(this, T.delete)) return;
    const id = viewingPhoto.id;
    try { await idb.del(id); } catch (e) { /* remove anyway */ }
    if (photoURLs.has(id)) { URL.revokeObjectURL(photoURLs.get(id)); photoURLs.delete(id); }
    S.photos = S.photos.filter(p => p.id !== id); hide('#dlgPhoto'); commit(T.photoDeleted);
  });

  /* ================= Shareable day card ================= */
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function fitFont(g, text, max, size, weight, fam) { let s = size; do { g.font = `${weight} ${s}px ${fam}`; s -= 2; } while (g.measureText(text).width > max && s > 18); }
  function wrapLines(g, text, max, maxLines) {
    const words = text.split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ' …'; }
    return lines;
  }
  async function makeCard(d) {
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    try { await Promise.race([document.fonts.load('800 100px "Bricolage Grotesque"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* system font */ }
    const FD = '"Bricolage Grotesque", system-ui, sans-serif', FB = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const x = getDay(d), a = auraFor(d), L = level(totalAura()), G = goals();
    const due = S.habits.filter(h => dueOn(h, d)), done = due.filter(h => has(h, d)).length;
    const INK = '#f3f3f7', LIME = '#c8ff3e', MUTED = 'rgba(243,243,247,.62)';
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0b12'); bg.addColorStop(1, '#150e28');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = (gx, gy, r, col) => { const rg = g.createRadialGradient(gx, gy, 0, gx, gy, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); };
    glow(900, 380, 640, 'rgba(200,255,62,.26)'); glow(100, 1560, 760, 'rgba(150,120,255,.26)');
    // Header
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = `800 54px ${FD}`; g.fillStyle = INK; g.fillText('aura', 80, 150);
    const aw = g.measureText('aura').width; g.fillStyle = LIME; g.fillText('maxx', 80 + aw, 150);
    g.textAlign = 'right'; g.fillStyle = MUTED; fitFont(g, fullDate(d), 560, 34, 600, FB); g.fillText(fullDate(d), W - 80, 146);
    // Day
    g.textAlign = 'left'; g.fillStyle = LIME; g.font = `800 58px ${FD}`; g.fillText('DAY', 80, 330);
    g.fillStyle = INK; fitFont(g, String(dayNumber(d)), 920, 300, 800, FD); g.fillText(String(dayNumber(d)), 70, 610);
    // Ring
    const cx = W / 2, cy = 960, r = 200, p = clamp(a / DAILY_GOAL, 0, 1);
    g.lineWidth = 38; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.1)';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    if (p > 0) { g.strokeStyle = LIME; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke(); }
    g.textAlign = 'center'; g.fillStyle = INK; g.font = `800 150px ${FD}`; g.fillText(String(a), cx, cy + 44);
    g.font = `700 32px ${FB}`; g.fillStyle = MUTED; g.fillText(T.cardAura, cx, cy + 100);
    if (a >= DAILY_GOAL) { g.textAlign = 'right'; g.fillStyle = LIME; fitFont(g, T.dayMaxxed, 560, 44, 800, FD); g.fillText(T.dayMaxxed, W - 80, 330); }
    // Stats
    const mins = minutesOf(x), prot = proteinOf(x);
    const stats = [
      ['✅', `${done}/${due.length}`, T.habits],
      ['💧', `${x.water}/${G.water}`, T.cardWater],
      ['🏋️', mins ? `${mins} min` : '–', T.workout],
      G.protein > 0 ? ['💪', `${num(prot)} g`, T.protein] : ['🍽️', String(x.meals.length), T.meals],
      [x.mood ? MOOD_E[x.mood - 1] : '🫥', x.mood ? T.moods[x.mood - 1] : '–', T.mood],
      ['😴', x.sleep != null ? `${num(x.sleep, 1)} h` : '–', T.sleep]
    ];
    const bx = 80, by = 1250, gap = 20, bw = (W - 160 - gap * 2) / 3, bh = 196;
    stats.forEach((s, i) => {
      const X = bx + (i % 3) * (bw + gap), Y = by + Math.floor(i / 3) * (bh + gap);
      rrect(g, X, Y, bw, bh, 34); g.fillStyle = 'rgba(255,255,255,.075)'; g.fill();
      g.textAlign = 'left'; g.fillStyle = INK; g.font = `48px ${FB}`; g.fillText(s[0], X + 28, Y + 70);
      fitFont(g, s[1], bw - 56, 46, 800, FD); g.fillStyle = INK; g.fillText(s[1], X + 28, Y + 132);
      g.fillStyle = MUTED; fitFont(g, s[2], bw - 56, 26, 600, FB); g.fillText(s[2], X + 28, Y + 170);
    });
    // Win
    const win = (x.win || '').trim();
    if (win) {
      g.textAlign = 'left'; g.font = `700 40px ${FB}`; g.fillStyle = INK;
      wrapLines(g, '🏆 ' + win, W - 160, 2).forEach((ln, i) => g.fillText(ln, 80, 1745 + i * 54));
    }
    // Footer
    g.textAlign = 'center'; g.font = `700 30px ${FB}`; g.fillStyle = MUTED;
    g.fillText(`Lv ${L.n} ${L.name}  ·  #lifemaxxing  ·  #auramaxx`, W / 2, 1868);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
  }
  let shareBlob = null, shareURL = null, shareDay = null;
  async function openShare(d) {
    shareDay = d; const img = $('#shareImg'); img.removeAttribute('src'); img.alt = '';
    $('#shareStatus').textContent = T.creatingCard; $('#shareBtn').hidden = true;
    show('#dlgShare');
    try {
      shareBlob = await makeCard(d);
      if (shareURL) URL.revokeObjectURL(shareURL);
      shareURL = URL.createObjectURL(shareBlob);
      img.src = shareURL; img.alt = T.cardAlt(dayNumber(d), auraFor(d));
      const dl = $('#shareDl'); dl.href = shareURL; dl.download = `auramaxx-day-${dayNumber(d)}.png`;
      const file = new File([shareBlob], dl.download, { type: 'image/png' });
      $('#shareBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
      $('#shareStatus').textContent = '';
    } catch (e) { $('#shareStatus').textContent = T.cardFail; }
  }
  $('#shareBtn').addEventListener('click', async () => {
    if (!shareBlob) return;
    try { await navigator.share({ files: [new File([shareBlob], `auramaxx-day-${dayNumber(shareDay)}.png`, { type: 'image/png' })], text: `Day ${dayNumber(shareDay)} ✨ #lifemaxxing #auramaxx` }); }
    catch (e) { /* cancelled */ }
  });

  /* ================= Language: apply ================= */
  function applyLang() {
    const code = LANGS.includes(S.settings.lang) ? S.settings.lang : detectLang();
    T = dict[code];
    document.documentElement.lang = code;
    document.title = T.metaTitle;
    $$('[data-i18n]').forEach(el => { const v = T[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });
    $$('[data-i18n-ph]').forEach(el => { const v = T[el.dataset.i18nPh]; if (typeof v === 'string') el.setAttribute('placeholder', v); });
    $$('[data-i18n-aria]').forEach(el => { const v = T[el.dataset.i18nAria]; if (typeof v === 'string') el.setAttribute('aria-label', v); });
    buildDialogParts();
    setRadio('lang', code); setRadio('olang', code);
    freqNote(); renumberEx();
  }

  /* ================= Settings ================= */
  function applyTheme() {
    const t = S.settings && S.settings.theme || 'auto', root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = t;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#09090d' : '#f4f4ef');
  }
  function openSettings() {
    const G = goals();
    $('#sName').value = S.profile && S.profile.name || ''; $('#sWater').value = G.water; $('#sProtein').value = G.protein; $('#sWorkouts').value = G.workouts;
    setRadio('theme', S.settings.theme || 'auto'); setRadio('lang', document.documentElement.lang);
    armDelete($('#sReset'), T.resetAll);
    show('#dlgSettings');
  }
  $('#formSettings').addEventListener('submit', e => {
    e.preventDefault();
    S.profile = S.profile || { start: todayIso() };
    S.profile.name = $('#sName').value.trim();
    S.profile.goals = {
      water: clamp(Math.round(numOrNull($('#sWater').value) || 8), 2, 20),
      protein: clamp(Math.round(numOrNull($('#sProtein').value) || 0), 0, 400),
      workouts: clamp(Math.round(numOrNull($('#sWorkouts').value) || 3), 1, 14)
    };
    S.settings.theme = radioVal('theme') || 'auto'; applyTheme();
    hide('#dlgSettings'); commit(T.settingsSaved);
  });
  $('#sTheme').addEventListener('change', () => { S.settings.theme = radioVal('theme') || 'auto'; applyTheme(); save(); });
  // Language switches right away, so you can see the change while the dialog is open
  function switchLang(name) {
    const code = radioVal(name); if (!code || !LANGS.includes(code)) return;
    S.settings.lang = code; save(); applyLang(); render(); armDelete($('#sReset'), T.resetAll);
    if (!S.profile) onboardChips();
    const r = document.querySelector(`input[name="${name}"][value="${code}"]`); if (r) r.focus();
  }
  $('#sLang').addEventListener('change', () => switchLang('lang'));
  $('#oLang').addEventListener('change', () => switchLang('olang'));
  $('#sExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `auramaxx-backup-${todayIso()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(T.backupDownloaded);
  });
  $('#sImport').addEventListener('click', () => $('#importInput').click());
  $('#importInput').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (!p || p.v !== 1 || !Array.isArray(p.habits) || typeof p.days !== 'object') throw new Error('format');
      p.photos = S.photos; // photos only live on this device
      S = Object.assign(fresh(), p); S.settings = Object.assign({ theme: 'auto', lang: null }, p.settings);
      applyTheme(); applyLang(); hide('#dlgSettings'); commit(T.backupImported);
    } catch (err) { toast(T.notBackup); }
  });
  $('#sReset').addEventListener('click', async function () {
    if (!confirmStep(this, T.resetAll)) return;
    try { await idb.clear(); } catch (e) { /* fine */ }
    photoURLs.forEach(u => URL.revokeObjectURL(u)); photoURLs.clear();
    const lang = S.settings.lang;
    S = fresh(); S.settings.lang = lang; save(); applyTheme(); applyLang();
    hide('#dlgSettings'); view = 'today'; viewDate = todayIso(); render(); openOnboarding();
  });

  /* ================= Onboarding ================= */
  const ONBOARD_DEFAULT = [0, 1, 2, 4];
  // Labels the habit chips in the current language and keeps the selection
  function onboardChips() {
    const wrap = $('#oHabits'), sel = wrap.children.length ? $$('#oHabits [aria-pressed="true"]').map(b => Number(b.dataset.tpl)) : ONBOARD_DEFAULT;
    wrap.innerHTML = TEMPLATES.map((t, i) => `<button type="button" class="chip" data-tpl="${i}" aria-pressed="${sel.includes(i)}"><span aria-hidden="true">${t.emoji}</span>${esc(T.templates[i][0])}</button>`).join('');
  }
  function openOnboarding() {
    $('#oHabits').innerHTML = '';
    onboardChips();
    show('#dlgOnboard', '#oName');
  }
  $('#oHabits').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
  function finishOnboarding(fromForm) {
    if (S.profile) return;
    const picked = fromForm ? $$('#oHabits [aria-pressed="true"]').map(b => tpl(Number(b.dataset.tpl))) : ONBOARD_DEFAULT.map(tpl);
    S.profile = {
      name: fromForm ? $('#oName').value.trim() : '', start: todayIso(),
      goals: { water: fromForm ? clamp(Math.round(numOrNull($('#oWater').value) || 8), 2, 20) : 8, protein: fromForm ? clamp(Math.round(numOrNull($('#oProtein').value) || 0), 0, 400) : 0, workouts: 3 }
    };
    S.habits = picked.map(newHabit); S.lastLevel = 1;
    save(); render();
  }
  $('#formOnboard').addEventListener('submit', e => {
    e.preventDefault(); finishOnboarding(true); hide('#dlgOnboard');
    toast(T.letsGo(S.profile.name), true);
  });
  $('#dlgOnboard').addEventListener('close', () => finishOnboarding(false));

  /* ================= Start ================= */
  applyTheme();
  applyLang();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  render();
  if (!S.profile) openOnboarding();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); return; }
    const t = todayIso();
    if (t !== lastToday) { if (viewDate === lastToday) viewDate = t; lastToday = t; }
    render();
  });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
