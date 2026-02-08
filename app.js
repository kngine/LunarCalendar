(function () {
  'use strict';

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const NOTES_KEY = 'lunar-calendar-notes';
  const DISPLAY_OPTIONS_KEY = 'lunar-calendar-display';

  var displayOptions = { lunar: true, usHolidays: true, weekNum: false, jieQi: false, lunarFestivals: true };

  function getDisplayOptions() {
    try {
      const raw = localStorage.getItem(DISPLAY_OPTIONS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        displayOptions = { ...displayOptions, ...o };
      }
    } catch (_) {}
    return displayOptions;
  }

  function saveDisplayOptions() {
    localStorage.setItem(DISPLAY_OPTIONS_KEY, JSON.stringify(displayOptions));
  }

  function getNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function setNote(dateKey, text) {
    const notes = getNotes();
    if (text.trim()) {
      notes[dateKey] = text.trim();
    } else {
      delete notes[dateKey];
    }
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** US Federal holidays: fixed date or rule (nth weekday of month). */
  function getUSHolidays(year) {
    const list = [];

    function add(name, monthOneBased, dayOfMonth) {
      const date = new Date(year, monthOneBased - 1, dayOfMonth);
      list.push({ name, date });
    }
    function nthWeekday(n, weekday, monthOneBased) {
      // n: 1=first, 2=second, 4=fourth, -1=last; weekday 0=Sun..6=Sat
      const first = new Date(year, monthOneBased - 1, 1);
      const last = new Date(year, monthOneBased, 0);
      let d;
      if (n === -1) {
        d = new Date(last);
        while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
      } else {
        d = new Date(first);
        let count = 0;
        while (d.getMonth() === monthOneBased - 1) {
          if (d.getDay() === weekday) count++;
          if (count === n) break;
          d.setDate(d.getDate() + 1);
        }
      }
      return d.getDate();
    }

    add('New Year\'s Day', 1, 1);
    add('Martin Luther King Jr. Day', 1, nthWeekday(3, 1, 1));
    add('Presidents\' Day', 2, nthWeekday(3, 1, 2));
    add('Memorial Day', 5, nthWeekday(-1, 1, 5));
    add('Juneteenth', 6, 19);
    add('Independence Day', 7, 4);
    add('Labor Day', 9, nthWeekday(1, 1, 9));
    add('Columbus Day', 10, nthWeekday(2, 1, 10));
    add('Veterans Day', 11, 11);
    add('Thanksgiving', 11, nthWeekday(4, 4, 11));
    add('Christmas Day', 12, 25);

    return list.map(h => ({
      name: h.name,
      key: `${h.date.getFullYear()}-${String(h.date.getMonth() + 1).padStart(2, '0')}-${String(h.date.getDate()).padStart(2, '0')}`
    }));
  }

  function getLunarString(year, month, day) {
    try {
      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      var m = lunar.getMonthInChinese();
      return (m.endsWith('月') ? m : m + '月') + lunar.getDayInChinese();
    } catch (_) {
      return '';
    }
  }

  /** Lunar (农历) festivals for a solar date, e.g. 春节、端午. */
  function getLunarFestivals(year, month, day) {
    try {
      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      if (typeof lunar.getFestivals === 'function') {
        var list = lunar.getFestivals();
        return Array.isArray(list) ? list : (list ? [list] : []);
      }
    } catch (_) {}
    return [];
  }

  /** 24 solar terms: approximate (month, day) for a given year (formula: day can vary ±1). */
  var JIEQI_TERMS = [
    [1, 6, '小寒'], [1, 20, '大寒'], [2, 4, '立春'], [2, 19, '雨水'], [3, 6, '惊蛰'], [3, 21, '春分'],
    [4, 5, '清明'], [4, 20, '谷雨'], [5, 6, '立夏'], [5, 21, '小满'], [6, 6, '芒种'], [6, 21, '夏至'],
    [7, 7, '小暑'], [7, 23, '大暑'], [8, 8, '立秋'], [8, 23, '处暑'], [9, 8, '白露'], [9, 23, '秋分'],
    [10, 8, '寒露'], [10, 23, '霜降'], [11, 8, '立冬'], [11, 23, '小雪'], [12, 7, '大雪'], [12, 22, '冬至']
  ];

  function getJieQiMapFallback(year) {
    var map = {};
    for (var i = 0; i < JIEQI_TERMS.length; i++) {
      var term = JIEQI_TERMS[i];
      var mo = term[0], da = term[1], name = term[2];
      var key = year + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0');
      map[key] = name;
    }
    return map;
  }

  /** Map of dateKey -> 节气 name for a year (24 solar terms). Uses library if available, else approximate dates. */
  function getJieQiMap(year) {
    var map = {};
    try {
      if (typeof LunarYear !== 'undefined' && LunarYear.fromYear) {
        var ly = LunarYear.fromYear(year);
        if (ly && typeof ly.getJieQi === 'function') {
          var table = ly.getJieQi();
          if (table && typeof table === 'object') {
            for (var name in table) {
              var s = table[name];
              if (s && typeof s.getYear === 'function') {
                var y = s.getYear(), mo = s.getMonth(), da = s.getDay();
                var key = y + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0');
                map[key] = name;
              }
            }
          }
        }
      }
    } catch (_) {}
    if (Object.keys(map).length < 24) map = getJieQiMapFallback(year);
    return map;
  }

  /** ISO week number (1–53). */
  function getISOWeekNumber(date) {
    var d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderCalendar(year, month) {
    var opts = getDisplayOptions();
    var grid = document.getElementById('calendarGrid');
    var weekdaysRow = document.getElementById('weekdaysRow');
    if (!grid) return;
    grid.innerHTML = '';

    var weekLabel = weekdaysRow ? weekdaysRow.querySelector('.weekday-week') : null;
    if (opts.weekNum) {
      grid.style.gridTemplateColumns = 'auto repeat(7, 1fr)';
      weekdaysRow.style.gridTemplateColumns = 'auto repeat(7, 1fr)';
      if (weekLabel) { weekLabel.textContent = '周'; weekLabel.style.display = ''; }
    } else {
      grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
      weekdaysRow.style.gridTemplateColumns = 'repeat(7, 1fr)';
      if (weekLabel) { weekLabel.textContent = ''; weekLabel.style.display = 'none'; }
    }

    var first = new Date(year, month - 1, 1);
    var last = new Date(year, month, 0);
    var startOffset = first.getDay();
    var daysInMonth = last.getDate();

    var today = new Date();
    var todayKey = dateKey(today);
    var holidaysByDate = {};
    getUSHolidays(year).forEach(function (h) { holidaysByDate[h.key] = h.name; });
    var notes = getNotes();
    var jieQiMap = {};
    if (opts.jieQi) {
      try {
        jieQiMap = getJieQiMap(year) || {};
        var prevYear = month === 1 ? year - 1 : year;
        var nextYear = month === 12 ? year + 1 : year;
        if (month === 1) Object.assign(jieQiMap, getJieQiMap(prevYear) || {});
        if (month === 12) Object.assign(jieQiMap, getJieQiMap(nextYear) || {});
      } catch (_) {}
    }

    var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    for (var i = 0; i < totalCells; i++) {
      if (opts.weekNum && i % 7 === 0) {
        var rowFirstDate = (function () {
          if (i < startOffset) {
            var pm = month === 1 ? 12 : month - 1;
            var py = month === 1 ? year - 1 : year;
            var pl = new Date(py, pm, 0);
            var day = pl.getDate() - (startOffset - 1 - i);
            return new Date(py, pm - 1, day);
          } else if (i >= startOffset + daysInMonth) {
            var nm = month === 12 ? 1 : month + 1;
            var ny = month === 12 ? year + 1 : year;
            var day = i - startOffset + 1 - daysInMonth;
            return new Date(ny, nm - 1, day);
          } else {
            return new Date(year, month - 1, i - startOffset + 1);
          }
        })();
        var weekCell = document.createElement('div');
        weekCell.className = 'week-num';
        weekCell.textContent = '第' + getISOWeekNumber(rowFirstDate) + '周';
        grid.appendChild(weekCell);
      }

      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.tabIndex = 0;

      var y, m, d, key;
      if (i < startOffset) {
        var prevMonth = month === 1 ? 12 : month - 1;
        var prevYear = month === 1 ? year - 1 : year;
        var prevLast = new Date(prevYear, prevMonth, 0);
        d = prevLast.getDate() - (startOffset - 1 - i);
        y = prevYear;
        m = prevMonth;
        cell.classList.add('other-month');
        key = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        cell.dataset.date = key;
        cell.innerHTML = buildCellContent(y, m, d, key, false, false, holidaysByDate, notes, jieQiMap, opts);
      } else {
        d = i - startOffset + 1;
        if (d > daysInMonth) {
          var nextMonth = month === 12 ? 1 : month + 1;
          var nextYear = month === 12 ? year + 1 : year;
          d = d - daysInMonth;
          y = nextYear;
          m = nextMonth;
          cell.classList.add('other-month');
          key = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          cell.dataset.date = key;
          cell.innerHTML = buildCellContent(y, m, d, key, false, false, holidaysByDate, notes, jieQiMap, opts);
        } else {
          y = year;
          m = month;
          key = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var isToday = key === todayKey;
          if (isToday) cell.classList.add('today');
          if (holidaysByDate[key]) cell.classList.add('holiday');
          if (notes[key]) cell.classList.add('has-note');
          cell.dataset.date = key;
          cell.innerHTML = buildCellContent(y, m, d, key, isToday, !!holidaysByDate[key], holidaysByDate, notes, jieQiMap, opts);
        }
      }
      grid.appendChild(cell);
    }

    grid.querySelectorAll('.cell').forEach(function (cell) {
      cell.addEventListener('click', function () { openNoteModal(cell.dataset.date); });
      cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNoteModal(cell.dataset.date); } });
    });
  }

  function buildCellContent(year, month, day, key, isToday, isHoliday, holidaysByDate, notes, jieQiMap, opts) {
    opts = opts || {};
    var html = '<span class="day-num">' + String(day) + '</span>';

    var lunar = '';
    if (opts.lunar !== false) {
      try { lunar = getLunarString(year, month, day) || ''; } catch (_) {}
    }
    if (lunar) html += '<span class="lunar">' + lunar + '</span>';

    var holidayName = '';
    if (opts.usHolidays !== false && holidaysByDate && holidaysByDate[key]) holidayName = holidaysByDate[key];
    if (holidayName) html += '<span class="holiday-name">' + escapeHtml(holidayName) + '</span>';

    var jieQiName = '';
    if (opts.jieQi) {
      try {
        jieQiName = (jieQiMap && jieQiMap[key]) ? jieQiMap[key] : getJieQiForDay(year, month, day);
        jieQiName = jieQiName ? String(jieQiName) : '';
      } catch (_) {}
    }
    if (jieQiName) html += '<span class="cell-jieqi">' + escapeHtml(jieQiName) + '</span>';

    var lunarFests = [];
    if (opts.lunarFestivals !== false) {
      try { lunarFests = getLunarFestivals(year, month, day) || []; } catch (_) {}
    }
    if (lunarFests.length) html += '<span class="cell-lunar-festival">' + escapeHtml(lunarFests.join(' ')) + '</span>';

    var notePreview = '';
    if (notes && notes[key]) {
      try {
        var note = escapeHtml(notes[key]);
        notePreview = note.length > 20 ? note.slice(0, 20) + '…' : note;
      } catch (_) {}
    }
    if (notePreview) html += '<span class="cell-note" title="' + escapeHtml(notes[key]) + '">' + notePreview + '</span>';

    return html;
  }

  function fillSelects(year, month) {
    var monthSelect = document.getElementById('monthSelect');
    var yearSelect = document.getElementById('yearSelect');
    if (!monthSelect || !yearSelect) return;

    monthSelect.innerHTML = MONTHS.map(function (m, i) {
      var v = i + 1;
      return '<option value="' + v + '">' + m + '</option>';
    }).join('');
    monthSelect.value = String(month);

    var currentYear = new Date().getFullYear();
    var years = [];
    for (var y = currentYear - 100; y <= currentYear + 20; y++) years.push(y);
    yearSelect.innerHTML = years.map(function (y) {
      return '<option value="' + y + '">' + y + '</option>';
    }).join('');
    yearSelect.value = String(year);
  }

  function setCalendarState(year, month) {
    fillSelects(year, month);
    renderCalendar(year, month);
  }

  var stateYear = new Date().getFullYear();
  var stateMonth = new Date().getMonth() + 1;

  function onPrevMonth() {
    if (stateMonth === 1) { stateYear--; stateMonth = 12; } else { stateMonth--; }
    setCalendarState(stateYear, stateMonth);
  }
  function onNextMonth() {
    if (stateMonth === 12) { stateYear++; stateMonth = 1; } else { stateMonth++; }
    setCalendarState(stateYear, stateMonth);
  }
  function onMonthChange(e) {
    var v = e.target && e.target.value;
    if (v != null) { stateMonth = Number(v); setCalendarState(stateYear, stateMonth); }
  }
  function onYearChange(e) {
    var v = e.target && e.target.value;
    if (v != null) { stateYear = Number(v); setCalendarState(stateYear, stateMonth); }
  }
  function onGoToday() {
    var now = new Date();
    stateYear = now.getFullYear();
    stateMonth = now.getMonth() + 1;
    setCalendarState(stateYear, stateMonth);
  }

  var prevBtn = document.getElementById('prevMonth');
  var nextBtn = document.getElementById('nextMonth');
  var monthSelect = document.getElementById('monthSelect');
  var yearSelect = document.getElementById('yearSelect');
  var todayBtn = document.getElementById('goToday');
  if (prevBtn) prevBtn.addEventListener('click', onPrevMonth);
  if (nextBtn) nextBtn.addEventListener('click', onNextMonth);
  if (monthSelect) monthSelect.addEventListener('change', onMonthChange);
  if (yearSelect) yearSelect.addEventListener('change', onYearChange);
  if (todayBtn) todayBtn.addEventListener('click', onGoToday);

  function formatDateLabel(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return MONTHS[m - 1] + ' ' + d + ', ' + y;
  }

  let currentNoteDateKey = null;

  function openNoteModal(dateKey) {
    currentNoteDateKey = dateKey;
    const modal = document.getElementById('noteModal');
    document.getElementById('noteModalDate').textContent = formatDateLabel(dateKey);
    document.getElementById('noteModalText').value = getNotes()[dateKey] || '';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    document.getElementById('noteModalText').focus();
  }

  function closeNoteModal() {
    currentNoteDateKey = null;
    const modal = document.getElementById('noteModal');
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
  }

  document.getElementById('noteModalSave').addEventListener('click', function () {
    if (!currentNoteDateKey) return;
    setNote(currentNoteDateKey, document.getElementById('noteModalText').value);
    setCalendarState(stateYear, stateMonth);
    closeNoteModal();
  });

  document.getElementById('noteModalClear').addEventListener('click', function () {
    if (!currentNoteDateKey) return;
    setNote(currentNoteDateKey, '');
    document.getElementById('noteModalText').value = '';
    setCalendarState(stateYear, stateMonth);
  });

  document.getElementById('noteModalClose').addEventListener('click', closeNoteModal);

  document.getElementById('noteModal').addEventListener('click', function (e) {
    if (e.target === this) closeNoteModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNoteModal();
  });

  function toggleSettingsPanel() {
    var panel = document.getElementById('settingsPanel');
    var hidden = panel.getAttribute('aria-hidden') !== 'false';
    panel.setAttribute('aria-hidden', hidden ? 'false' : 'true');
    panel.classList.toggle('open', hidden);
  }

  var settingsBtn = document.getElementById('toggleSettings');
  if (settingsBtn) settingsBtn.addEventListener('click', function (e) {
    e.preventDefault();
    toggleSettingsPanel();
  });

  var optToKey = { optLunar: 'lunar', optUSHolidays: 'usHolidays', optWeekNum: 'weekNum', optJieQi: 'jieQi', optLunarFestivals: 'lunarFestivals' };
  Object.keys(optToKey).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var key = optToKey[id];
    el.checked = displayOptions[key] !== false;
    el.addEventListener('change', function () {
      displayOptions[key] = el.checked;
      saveDisplayOptions();
      setCalendarState(stateYear, stateMonth);
    });
  });

  getDisplayOptions();
  setCalendarState(stateYear, stateMonth);
})();
