(function () {
  'use strict';

  var STORE_KEY = 'tagwerk.v1';

  var ICONS = {
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    dumbbell: '<path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/>',
    drop: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
    leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19 13 11"/>'
  };

  var WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  var WEEKDAY_SHORT = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  /* ---------- Datum ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function mondayOf(d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

  /* ---------- Speicher ---------- */
  function uid() { return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function seed() {
    return [
      { id: uid(), name: 'Lesen', goal: '20 Seiten', icon: 'book', perWeek: 7, done: [] },
      { id: uid(), name: 'Sport', goal: '4× pro Woche', icon: 'dumbbell', perWeek: 4, done: [] },
      { id: uid(), name: 'Wasser', goal: '2 Liter', icon: 'drop', perWeek: 7, done: [] }
    ];
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* ignorieren */ }
    return seed();
  }

  var habits = load();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(habits)); } catch (e) { /* ignorieren */ }
  }

  /* ---------- Logik ---------- */
  function isDone(h, dateIso) { return h.done.indexOf(dateIso) !== -1; }

  function toggle(h, dateIso) {
    var i = h.done.indexOf(dateIso);
    if (i === -1) h.done.push(dateIso); else h.done.splice(i, 1);
  }

  function weekCount(h, monday) {
    var c = 0;
    for (var i = 0; i < 7; i++) if (isDone(h, iso(addDays(monday, i)))) c++;
    return c;
  }

  function streak(h) {
    var today = startOfDay(new Date());
    var n = 0;
    if (h.perWeek >= 7) {
      var d = today;
      if (!isDone(h, iso(d))) d = addDays(d, -1);
      while (isDone(h, iso(d))) { n++; d = addDays(d, -1); }
      return { n: n, unit: n === 1 ? 'Tag' : 'Tage' };
    }
    var wk = mondayOf(today);
    if (weekCount(h, wk) >= h.perWeek) n++;
    wk = addDays(wk, -7);
    while (weekCount(h, wk) >= h.perWeek && n < 520) { n++; wk = addDays(wk, -7); }
    return { n: n, unit: n === 1 ? 'Woche' : 'Wochen' };
  }

  function progress() {
    var today = iso(startOfDay(new Date()));
    var monday = mondayOf(new Date());
    var due = 0, done = 0;
    habits.forEach(function (h) {
      var doneToday = isDone(h, today);
      var isDue = h.perWeek >= 7 || doneToday || weekCount(h, monday) < h.perWeek;
      if (isDue) { due++; if (doneToday) done++; }
    });
    return { due: due, done: done, pct: due === 0 ? 100 : Math.round(done / due * 100) };
  }

  /* ---------- Rendering ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function iconSvg(key) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[key] || ICONS.leaf) + '</svg>';
  }

  var $ = function (id) { return document.getElementById(id); };

  function renderHeader() {
    var now = new Date();
    $('weekday').textContent = WEEKDAYS[(now.getDay() + 6) % 7];
    $('date').textContent = now.getDate() + '. ' + MONTHS[now.getMonth()];

    var p = progress();
    $('progressFill').style.width = p.pct + '%';
    $('progressLabel').textContent = p.pct + ' %';
    $('progress').setAttribute('aria-valuenow', String(p.pct));
    $('status').textContent = habits.length === 0 ? ''
      : (p.pct === 100 ? 'alles geschafft' : p.done + ' von ' + p.due + ' erledigt');
  }

  function renderCard(h) {
    var today = startOfDay(new Date());
    var todayIso = iso(today);
    var monday = mondayOf(today);
    var s = streak(h);
    var count = weekCount(h, monday);

    var days = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(monday, i);
      var di = iso(d);
      var cls = 'day';
      if (isDone(h, di)) cls += ' done';
      if (di === todayIso) cls += ' today';
      var future = d > today;
      if (future) cls += ' future';
      days += '<button class="' + cls + '" data-date="' + di + '" data-id="' + h.id + '"' +
        (future ? ' disabled' : '') + ' aria-label="' + WEEKDAYS[i] + '">' +
        '<span class="dot"></span><span class="lbl">' + WEEKDAY_SHORT[i] + '</span></button>';
    }

    var doneToday = isDone(h, todayIso);
    var info = h.perWeek >= 7 ? '' : count + ' von ' + h.perWeek + ' diese Woche';

    return '<article class="card">' +
      '<div class="card-head">' +
        '<div class="icon-box">' + iconSvg(h.icon) + '</div>' +
        '<button class="titles" data-edit="' + h.id + '">' +
          '<span class="name">' + esc(h.name) + '</span>' +
          '<span class="goal">' + esc(h.goal || '') + '</span>' +
        '</button>' +
        '<button class="check' + (doneToday ? ' on' : '') + '" data-check="' + h.id + '" aria-label="Heute erledigt">' +
          '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="week">' + days + '</div>' +
      '<div class="card-foot"><span class="pill">' + info + '</span>' +
        '<span class="streak"><b>' + s.n + '</b>' + s.unit + '</span></div>' +
    '</article>';
  }

  function render() {
    $('list').innerHTML = habits.map(renderCard).join('');
    $('empty').hidden = habits.length > 0;
    renderHeader();
  }

  /* ---------- Interaktion ---------- */
  function find(id) {
    for (var i = 0; i < habits.length; i++) if (habits[i].id === id) return habits[i];
    return null;
  }

  $('list').addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    var h;
    if (t.dataset.check) {
      h = find(t.dataset.check);
      if (h) { toggle(h, iso(startOfDay(new Date()))); save(); render(); }
    } else if (t.dataset.date && !t.disabled) {
      h = find(t.dataset.id);
      if (h) { toggle(h, t.dataset.date); save(); render(); }
    } else if (t.dataset.edit) {
      openDialog(find(t.dataset.edit));
    }
  });

  /* ---------- Dialog ---------- */
  var dialog = $('dialog');
  var editing = null;

  (function buildPickers() {
    var html = '';
    Object.keys(ICONS).forEach(function (k, i) {
      html += '<label><input type="radio" name="icon" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="pick">' + iconSvg(k) + '</span></label>';
    });
    $('iconPicker').innerHTML = html;

    var opts = '';
    for (var n = 1; n <= 7; n++) opts += '<option value="' + n + '">' + (n === 7 ? 'Täglich' : n + '× pro Woche') + '</option>';
    $('fPerWeek').innerHTML = opts;
  })();

  function openDialog(h) {
    editing = h || null;
    $('dialogTitle').textContent = h ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit';
    $('fName').value = h ? h.name : '';
    $('fGoal').value = h ? (h.goal || '') : '';
    $('fPerWeek').value = String(h ? h.perWeek : 7);
    var radios = document.querySelectorAll('input[name=icon]');
    var wanted = h ? h.icon : 'book';
    radios.forEach(function (r) { r.checked = (r.value === wanted); });
    $('deleteBtn').style.display = h ? '' : 'none';
    dialog.showModal();
    $('fName').focus();
  }

  $('addBtn').addEventListener('click', function () { openDialog(null); });
  $('cancelBtn').addEventListener('click', function () { dialog.close(); });

  $('deleteBtn').addEventListener('click', function () {
    if (!editing) return;
    if (window.confirm('„' + editing.name + '“ wirklich löschen?')) {
      habits = habits.filter(function (h) { return h.id !== editing.id; });
      save();
      dialog.close();
      render();
    }
  });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('fName').value.trim();
    if (!name) return;
    var icon = document.querySelector('input[name=icon]:checked').value;
    var perWeek = parseInt($('fPerWeek').value, 10) || 7;
    var goal = $('fGoal').value.trim();

    if (editing) {
      editing.name = name;
      editing.goal = goal;
      editing.icon = icon;
      editing.perWeek = perWeek;
    } else {
      habits.push({ id: uid(), name: name, goal: goal, icon: icon, perWeek: perWeek, done: [] });
    }
    save();
    dialog.close();
    render();
  });

  /* ---------- Start ---------- */
  render();

  // Beim Tageswechsel neu zeichnen, wenn die App im Hintergrund war
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) render();
  });
})();
