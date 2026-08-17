/* ============================================================
   app.js
   ------------------------------------------------------------
   The main controller. It:
   1. Boots the app (DataStore.init)
   2. Renders the sidebar + top bar
   3. Switches between "views" (Dashboard, Daily Attendance...)
   4. Wires up forms, modals and buttons

   Each view has a render function: renderDashboard(), renderDaily()
   etc. They return an HTML string that gets dropped into
   #view-root, then a matching "afterX()" function attaches event
   listeners for that view.
   ============================================================ */

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STATUS_COLORS = {
  Present: "var(--present)",
  Absent: "var(--absent)",
  Late: "var(--late)",
  Permission: "var(--permission)",
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: iconDashboard() },
  { id: "daily", label: "Daily Attendance", icon: iconCheck() },
  { id: "calendar", label: "Calendar", icon: iconCalendar() },
  { id: "subjects", label: "Subjects", icon: iconBook() },
  { id: "statistics", label: "Statistics", icon: iconChart() },
  { id: "history", label: "History", icon: iconClock() },
  { id: "semesters", label: "Semesters", icon: iconLayers() },
  { id: "profile", label: "Profile", icon: iconUser() },
  { id: "settings", label: "Settings", icon: iconGear() },
  { id: "backup", label: "Backup & Restore", icon: iconBackup() },
];

let currentView = "dashboard";
let calendarViewDate = new Date(); // month currently shown on the calendar
let historyFilters = { yearId: "", semesterId: "", periodId: "", subjectId: "", status: "", date: "" };
let subjectSort = { key: "name", dir: "asc" };

/* ---------- boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  DataStore.init();
  renderShell();
  navigateTo("dashboard");
});

function renderShell() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-mark">S</div>
          <div class="brand-text">
            <strong>SETEC Institute</strong>
            <span>Attendance Register</span>
          </div>
        </div>
        <nav class="nav" id="nav">
          ${NAV_ITEMS.map(
            (item) => `
            <button class="nav-item" data-view="${item.id}">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </button>`
          ).join("")}
        </nav>
        <div class="sidebar-footer">
          <div id="sidebar-status" class="sidebar-status"></div>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <button class="icon-btn" id="menu-toggle" aria-label="Toggle menu">${iconMenu()}</button>
          <div class="topbar-period" id="topbar-period"></div>
          <div class="topbar-right">
            <div class="today-pill" id="today-pill"></div>
          </div>
        </header>
        <main class="view-root" id="view-root"></main>
      </div>
    </div>

    <div class="modal-overlay" id="modal-overlay" hidden>
      <div class="modal" id="modal"></div>
    </div>

    <div class="toast-stack" id="toast-stack"></div>
  `;

  document.getElementById("nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    navigateTo(btn.dataset.view);
    document.getElementById("sidebar").classList.remove("open");
  });

  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });

  document.getElementById("today-pill").textContent = formatLongDate(new Date());
}

function navigateTo(viewId) {
  currentView = viewId;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
  renderTopbarPeriod();
  renderSidebarStatus();

  const root = document.getElementById("view-root");
  const renderers = {
    dashboard: renderDashboard,
    daily: renderDaily,
    calendar: renderCalendar,
    subjects: renderSubjects,
    statistics: renderStatistics,
    history: renderHistory,
    semesters: renderSemesters,
    profile: renderProfile,
    settings: renderSettings,
    backup: renderBackup,
  };
  root.innerHTML = renderers[viewId] ? renderers[viewId]() : "<p>Not found</p>";

  const after = {
    dashboard: afterDashboard,
    daily: afterDaily,
    calendar: afterCalendar,
    subjects: afterSubjects,
    statistics: afterStatistics,
    history: afterHistory,
    semesters: afterSemesters,
    profile: afterProfile,
    settings: afterSettings,
    backup: afterBackup,
  };
  if (after[viewId]) after[viewId]();
}

function renderTopbarPeriod() {
  const labels = Semesters.getCurrentLabels();
  document.getElementById("topbar-period").innerHTML = `
    <span class="crumb">${escapeHtml(labels.yearLabel)}</span>
    <span class="crumb-sep">›</span>
    <span class="crumb">${escapeHtml(labels.semesterLabel)}</span>
    <span class="crumb-sep">›</span>
    <span class="crumb crumb-strong">${escapeHtml(labels.periodLabel)}</span>
  `;
}

function renderSidebarStatus() {
  const status = Attendance.getCurrentStatus();
  const el = document.getElementById("sidebar-status");
  el.innerHTML = `
    <div class="mini-status mini-status--${status.isBlacklisted ? "blacklist" : "safe"}">
      <span class="mini-status-dot"></span>
      <div>
        <div class="mini-status-label">${status.status}</div>
        <div class="mini-status-sub">${status.absences}/${status.allowed} absences</div>
      </div>
    </div>
  `;
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {
  const profile = DataStore.getProfile();
  const labels = Semesters.getCurrentLabels();
  const records = Attendance.getCurrentPeriodRecords();
  const summary = Attendance.summarize(records);
  const status = Attendance.getCurrentStatus();
  const warning = Attendance.getWarning(status);
  const todaySubjects = Subjects.getToday();
  const todayDate = toDateInputValue(new Date());
  const todayRecords = Attendance.getByDate(todayDate);
  const recordedSubjectIds = new Set(todayRecords.map((r) => r.subjectId));

  const meterPercent = status.allowed > 0
    ? Math.min((status.absences / status.allowed) * 100, 100)
    : 0;

  return `
    <div class="view-header">
      <div>
        <h1>Welcome back${profile.name ? ", " + escapeHtml(profile.name) : ""}</h1>
        <p class="muted">${escapeHtml(labels.yearLabel)} · ${escapeHtml(labels.semesterLabel)} · ${escapeHtml(labels.periodLabel)}</p>
      </div>
      <button class="btn btn-primary" id="dash-mark-btn">${iconCheck()} Mark today's attendance</button>
    </div>

    ${warning ? `
      <div class="banner banner--${warning.level}">
        <span class="banner-icon">${warning.icon}</span>
        <span>${warning.message}</span>
      </div>` : ""}

    <div class="grid grid-3">
      <div class="card card-stamp">
        <div class="card-label">Blacklist Meter</div>
        <div class="stamp stamp--${status.isBlacklisted ? "blacklist" : (meterPercent >= 75 ? "warning" : "safe")}">
          <svg viewBox="0 0 120 120" class="stamp-ring">
            <circle cx="60" cy="60" r="52" class="stamp-ring-track" />
            <circle cx="60" cy="60" r="52" class="stamp-ring-fill"
              style="stroke-dasharray:${2 * Math.PI * 52}; stroke-dashoffset:${2 * Math.PI * 52 * (1 - meterPercent / 100)};" />
          </svg>
          <div class="stamp-center">
            <div class="stamp-number">${status.absences}</div>
            <div class="stamp-of">of ${status.allowed}</div>
          </div>
        </div>
        <div class="stamp-caption">
          <span class="tag tag--${status.isBlacklisted ? "blacklist" : "safe"}">${status.status}</span>
          <span class="muted">${status.remaining} absence${status.remaining === 1 ? "" : "s"} remaining</span>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Attendance Summary</div>
        <div class="summary-rows">
          <div class="summary-row"><span>Total Classes</span><strong>${summary.total}</strong></div>
          <div class="summary-row"><span class="dot" style="background:${STATUS_COLORS.Present}"></span><span>Present</span><strong>${summary.Present}</strong></div>
          <div class="summary-row"><span class="dot" style="background:${STATUS_COLORS.Absent}"></span><span>Absent</span><strong>${summary.Absent}</strong></div>
          <div class="summary-row"><span class="dot" style="background:${STATUS_COLORS.Late}"></span><span>Late</span><strong>${summary.Late}</strong></div>
          <div class="summary-row"><span class="dot" style="background:${STATUS_COLORS.Permission}"></span><span>Permission</span><strong>${summary.Permission}</strong></div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Today's Classes</div>
        ${todaySubjects.length === 0 ? `<p class="muted small">No classes scheduled today.</p>` : `
          <ul class="today-list">
            ${todaySubjects.map((s) => `
              <li class="today-item">
                <div>
                  <strong>${escapeHtml(s.name)}</strong>
                  <div class="muted small">${escapeHtml(s.startTime || "")} - ${escapeHtml(s.endTime || "")} · ${escapeHtml(s.room || "")}</div>
                </div>
                ${recordedSubjectIds.has(s.id)
                  ? `<span class="tag tag--present">Recorded</span>`
                  : `<button class="btn btn-sm" data-quick-mark="${s.id}">Mark</button>`}
              </li>
            `).join("")}
          </ul>
        `}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-label">Present vs Absent</div>
        <canvas id="dash-donut" class="chart-canvas chart-canvas--donut"></canvas>
        <div class="legend">
          <span><span class="dot" style="background:${STATUS_COLORS.Present}"></span>Present</span>
          <span><span class="dot" style="background:${STATUS_COLORS.Absent}"></span>Absent</span>
          <span><span class="dot" style="background:${STATUS_COLORS.Late}"></span>Late</span>
          <span><span class="dot" style="background:${STATUS_COLORS.Permission}"></span>Permission</span>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Recent Activity</div>
        ${renderRecentActivity()}
      </div>
    </div>
  `;
}

function renderRecentActivity() {
  const records = [...DataStore.getRecords()]
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
    .slice(0, 6);
  if (records.length === 0) return `<p class="muted small">No attendance recorded yet.</p>`;
  return `
    <ul class="activity-list">
      ${records.map((r) => {
        const subj = Subjects.getById(r.subjectId);
        return `
          <li class="activity-item">
            <span class="status-dot status-dot--${r.status.toLowerCase()}"></span>
            <div class="activity-body">
              <strong>${escapeHtml(subj ? subj.name : "Unknown subject")}</strong>
              <div class="muted small">${formatDisplayDate(r.date)} · ${r.status}</div>
            </div>
          </li>`;
      }).join("")}
    </ul>
  `;
}

function afterDashboard() {
  const records = Attendance.getCurrentPeriodRecords();
  const summary = Attendance.summarize(records);
  const donutCanvas = document.getElementById("dash-donut");
  if (donutCanvas) {
    Statistics.drawDonut(donutCanvas, [
      { label: "Present", value: summary.Present, color: "#2F9E64" },
      { label: "Absent", value: summary.Absent, color: "#E5484D" },
      { label: "Late", value: summary.Late, color: "#F0A93B" },
      { label: "Permission", value: summary.Permission, color: "#3B82C4" },
    ]);
  }

  document.getElementById("dash-mark-btn").addEventListener("click", () => navigateTo("daily"));

  document.querySelectorAll("[data-quick-mark]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAttendanceModal({ subjectId: btn.dataset.quickMark, date: toDateInputValue(new Date()) });
    });
  });
}

/* ============================================================
   DAILY ATTENDANCE
   ============================================================ */

function renderDaily() {
  const subjects = Subjects.getAll();
  const todayVal = toDateInputValue(new Date());

  return `
    <div class="view-header">
      <div>
        <h1>Daily Attendance</h1>
        <p class="muted">Record how each class went, day by day.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-label">Mark Attendance</div>
      ${subjects.length === 0 ? `
        <p class="muted small">You haven't added any subjects yet. Go to <strong>Subjects</strong> to add your first class.</p>
        <button class="btn btn-primary" id="daily-goto-subjects">Add a subject</button>
      ` : `
        <form id="daily-form" class="form-grid">
          <label class="field">
            <span>Date</span>
            <input type="date" name="date" value="${todayVal}" required />
          </label>
          <label class="field">
            <span>Subject</span>
            <select name="subjectId" required>
              ${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.code || "-")})</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Class / Section</span>
            <input type="text" name="className" placeholder="e.g. IT-2B" />
          </label>
          <label class="field">
            <span>Status</span>
            <div class="status-choice">
              ${Object.values(Attendance.STATUS).map((s, i) => `
                <label class="status-option status-option--${s.toLowerCase()}">
                  <input type="radio" name="status" value="${s}" ${i === 0 ? "checked" : ""}/>
                  <span>${s}</span>
                </label>
              `).join("")}
            </div>
          </label>
          <label class="field field-wide">
            <span>Note (optional)</span>
            <input type="text" name="note" placeholder="e.g. Normal class" />
          </label>
          <div class="field-wide">
            <button type="submit" class="btn btn-primary">${iconCheck()} Save attendance</button>
          </div>
        </form>
      `}
    </div>

    <div class="card">
      <div class="card-label">Today (${formatDisplayDate(todayVal)})</div>
      ${renderDayList(todayVal)}
    </div>
  `;
}

function renderDayList(dateVal) {
  const records = Attendance.getByDate(dateVal);
  if (records.length === 0) return `<p class="muted small">No attendance recorded for this date yet.</p>`;
  return `
    <ul class="record-list">
      ${records.map((r) => {
        const subj = Subjects.getById(r.subjectId);
        return `
        <li class="record-item">
          <span class="status-dot status-dot--${r.status.toLowerCase()}"></span>
          <div class="record-body">
            <strong>${escapeHtml(subj ? subj.name : "Unknown subject")}</strong>
            <div class="muted small">${r.status}${r.note ? " · " + escapeHtml(r.note) : ""}</div>
          </div>
          <div class="record-actions">
            <button class="icon-btn" data-edit-record="${r.id}" aria-label="Edit">${iconEdit()}</button>
            <button class="icon-btn icon-btn--danger" data-delete-record="${r.id}" aria-label="Delete">${iconTrash()}</button>
          </div>
        </li>`;
      }).join("")}
    </ul>
  `;
}

function afterDaily() {
  const gotoBtn = document.getElementById("daily-goto-subjects");
  if (gotoBtn) gotoBtn.addEventListener("click", () => navigateTo("subjects"));

  const form = document.getElementById("daily-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        date: fd.get("date"),
        subjectId: fd.get("subjectId"),
        className: fd.get("className"),
        status: fd.get("status"),
        note: fd.get("note"),
      };
      Attendance.add(data);
      showToast("Attendance saved.");
      const status = Attendance.getCurrentStatus();
      const warning = Attendance.getWarning(status);
      if (warning && warning.level !== "warning") {
        showToast(warning.icon + " " + warning.message, warning.level === "blacklist" ? "danger" : "warning");
      }
      renderSidebarStatus();
      navigateTo("daily");
    });
  }

  wireRecordListActions();
}

function wireRecordListActions() {
  document.querySelectorAll("[data-edit-record]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const record = Attendance.getById(btn.dataset.editRecord);
      if (record) openAttendanceModal(record, true);
    });
  });
  document.querySelectorAll("[data-delete-record]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction("Delete this attendance record? This cannot be undone.", () => {
        Attendance.remove(btn.dataset.deleteRecord);
        showToast("Record deleted.");
        renderSidebarStatus();
        navigateTo(currentView);
      });
    });
  });
}

// Used both for quick-mark from Dashboard and for editing an existing record
function openAttendanceModal(record, isEdit = false) {
  const subjects = Subjects.getAll();
  openModal(`
    <div class="modal-header">
      <h2>${isEdit ? "Edit Attendance" : "Mark Attendance"}</h2>
      <button class="icon-btn" id="modal-close">${iconClose()}</button>
    </div>
    <form id="modal-attendance-form" class="form-grid">
      <label class="field">
        <span>Date</span>
        <input type="date" name="date" value="${record.date || toDateInputValue(new Date())}" required />
      </label>
      <label class="field">
        <span>Subject</span>
        <select name="subjectId" required>
          ${subjects.map((s) => `<option value="${s.id}" ${s.id === record.subjectId ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
        </select>
      </label>
      <label class="field field-wide">
        <span>Status</span>
        <div class="status-choice">
          ${Object.values(Attendance.STATUS).map((s) => `
            <label class="status-option status-option--${s.toLowerCase()}">
              <input type="radio" name="status" value="${s}" ${(record.status || "Present") === s ? "checked" : ""}/>
              <span>${s}</span>
            </label>
          `).join("")}
        </div>
      </label>
      <label class="field field-wide">
        <span>Note (optional)</span>
        <input type="text" name="note" value="${escapeHtml(record.note || "")}" />
      </label>
      <div class="field-wide modal-actions">
        <button type="submit" class="btn btn-primary">${iconCheck()} Save</button>
      </div>
    </form>
  `);

  document.getElementById("modal-attendance-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      date: fd.get("date"),
      subjectId: fd.get("subjectId"),
      status: fd.get("status"),
      note: fd.get("note"),
    };
    if (isEdit && record.id) {
      Attendance.update(record.id, data);
      showToast("Attendance updated.");
    } else {
      Attendance.add(data);
      showToast("Attendance saved.");
    }
    closeModal();
    renderSidebarStatus();
    navigateTo(currentView);
  });
}

/* ============================================================
   CALENDAR
   ============================================================ */

function renderCalendar() {
  return `
    <div class="view-header">
      <div>
        <h1>Attendance Calendar</h1>
        <p class="muted">Every day, color-coded by what happened in class.</p>
      </div>
    </div>
    <div class="card">
      <div class="calendar-header">
        <button class="icon-btn" id="cal-prev">${iconChevronLeft()}</button>
        <h2 id="cal-month-label"></h2>
        <button class="icon-btn" id="cal-next">${iconChevronRight()}</button>
      </div>
      <div class="calendar-legend">
        <span><span class="dot" style="background:${STATUS_COLORS.Present}"></span>Present</span>
        <span><span class="dot" style="background:${STATUS_COLORS.Absent}"></span>Absent</span>
        <span><span class="dot" style="background:${STATUS_COLORS.Late}"></span>Late</span>
        <span><span class="dot" style="background:${STATUS_COLORS.Permission}"></span>Permission</span>
        <span><span class="dot dot--empty"></span>No record</span>
      </div>
      <div class="calendar-grid-labels">
        ${DAY_NAMES.map((d) => `<div>${d.slice(0, 3)}</div>`).join("")}
      </div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </div>
    <div class="card" id="calendar-day-detail"></div>
  `;
}

function afterCalendar() {
  renderCalendarGrid();
  document.getElementById("cal-prev").addEventListener("click", () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
    renderCalendarGrid();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
    renderCalendarGrid();
  });
}

function renderCalendarGrid() {
  const label = calendarViewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  document.getElementById("cal-month-label").textContent = label;

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  // Monday-first offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = cells.map((d) => {
    if (d === null) return `<div class="calendar-cell calendar-cell--empty"></div>`;
    const dateVal = toDateInputValue(new Date(year, month, d));
    const records = Attendance.getByDate(dateVal);
    const isToday = dateVal === toDateInputValue(new Date());
    let dominant = null;
    if (records.length > 0) {
      const priority = ["Absent", "Late", "Permission", "Present"];
      dominant = priority.find((p) => records.some((r) => r.status === p));
    }
    return `
      <button class="calendar-cell ${isToday ? "calendar-cell--today" : ""} ${dominant ? "calendar-cell--status-" + dominant.toLowerCase() : ""}" data-date="${dateVal}">
        <span class="calendar-cell-num">${d}</span>
        ${records.length > 0 ? `<span class="calendar-cell-count">${records.length}</span>` : ""}
      </button>
    `;
  }).join("");

  grid.querySelectorAll("[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => showCalendarDayDetail(btn.dataset.date));
  });

  const firstWithRecords = cells.filter(Boolean).map((d) => toDateInputValue(new Date(year, month, d)))
    .find((dv) => Attendance.getByDate(dv).length > 0);
  showCalendarDayDetail(firstWithRecords || toDateInputValue(new Date(year, month, 1)));
}

function showCalendarDayDetail(dateVal) {
  document.querySelectorAll(".calendar-cell").forEach((c) => c.classList.remove("calendar-cell--selected"));
  const target = document.querySelector(`.calendar-cell[data-date="${dateVal}"]`);
  if (target) target.classList.add("calendar-cell--selected");

  const records = Attendance.getByDate(dateVal);
  const detail = document.getElementById("calendar-day-detail");
  detail.innerHTML = `
    <div class="card-label">${formatDisplayDate(dateVal)}</div>
    ${records.length === 0 ? `<p class="muted small">No attendance recorded for this day.</p>` : renderDayList(dateVal)}
  `;
  wireRecordListActions();
}

/* ============================================================
   SUBJECTS  (management + per-subject attendance table)
   ============================================================ */

function renderSubjects() {
  const subjects = Subjects.getAll();
  const records = Attendance.getCurrentPeriodRecords();
  const bySubject = Attendance.summarizeBySubject(records);
  const settings = DataStore.getSettings();

  let rows = subjects.map((s) => {
    const stat = bySubject.find((b) => b.subjectId === s.id) || { total: 0, Present: 0, Absent: 0, Late: 0, Permission: 0 };
    const isWarn = stat.Absent > 0 && stat.Absent >= Math.ceil(settings.maxAllowedAbsences * 0.6) && stat.Absent <= settings.blacklistThreshold;
    const isBad = stat.Absent > settings.blacklistThreshold;
    const rowStatus = isBad ? "Blacklist" : isWarn ? "Warning" : "Safe";
    return { s, stat, rowStatus };
  });

  rows.sort((a, b) => {
    let av, bv;
    switch (subjectSort.key) {
      case "total": av = a.stat.total; bv = b.stat.total; break;
      case "absent": av = a.stat.Absent; bv = b.stat.Absent; break;
      case "status": av = a.rowStatus; bv = b.rowStatus; break;
      default: av = a.s.name.toLowerCase(); bv = b.s.name.toLowerCase();
    }
    if (av < bv) return subjectSort.dir === "asc" ? -1 : 1;
    if (av > bv) return subjectSort.dir === "asc" ? 1 : -1;
    return 0;
  });

  return `
    <div class="view-header">
      <div>
        <h1>Subjects</h1>
        <p class="muted">Manage your class list and see attendance per subject.</p>
      </div>
      <button class="btn btn-primary" id="add-subject-btn">${iconPlus()} Add subject</button>
    </div>

    ${subjects.length === 0 ? `
      <div class="card empty-state">
        <p>No subjects yet. Add your first class to start tracking attendance.</p>
        <button class="btn btn-primary" id="add-subject-btn-2">${iconPlus()} Add subject</button>
      </div>
    ` : `
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th data-sort="name" class="sortable">Subject</th>
                <th>Schedule</th>
                <th data-sort="total" class="sortable">Total</th>
                <th>Present</th>
                <th data-sort="absent" class="sortable">Absent</th>
                <th>Late</th>
                <th data-sort="status" class="sortable">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(({ s, stat, rowStatus }) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(s.name)}</strong>
                    <div class="muted small">${escapeHtml(s.code || "")}${s.teacher ? " · " + escapeHtml(s.teacher) : ""}</div>
                  </td>
                  <td class="muted small">${escapeHtml(s.day || "-")}${s.startTime ? ", " + escapeHtml(s.startTime) + "-" + escapeHtml(s.endTime) : ""}<br/>${escapeHtml(s.room || "")}</td>
                  <td>${stat.total}</td>
                  <td>${stat.Present}</td>
                  <td>${stat.Absent}</td>
                  <td>${stat.Late}</td>
                  <td><span class="tag tag--${rowStatus.toLowerCase()}">${rowStatus}</span></td>
                  <td class="row-actions">
                    <button class="icon-btn" data-edit-subject="${s.id}" aria-label="Edit">${iconEdit()}</button>
                    <button class="icon-btn icon-btn--danger" data-delete-subject="${s.id}" aria-label="Delete">${iconTrash()}</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;
}

function afterSubjects() {
  ["add-subject-btn", "add-subject-btn-2"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => openSubjectModal());
  });

  document.querySelectorAll("[data-edit-subject]").forEach((btn) => {
    btn.addEventListener("click", () => openSubjectModal(Subjects.getById(btn.dataset.editSubject)));
  });
  document.querySelectorAll("[data-delete-subject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction("Delete this subject? Its attendance records will also be removed.", () => {
        Subjects.remove(btn.dataset.deleteSubject);
        showToast("Subject deleted.");
        navigateTo("subjects");
      });
    });
  });

  document.querySelectorAll("[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (subjectSort.key === key) {
        subjectSort.dir = subjectSort.dir === "asc" ? "desc" : "asc";
      } else {
        subjectSort = { key, dir: "asc" };
      }
      navigateTo("subjects");
    });
  });
}

function openSubjectModal(subject = null) {
  const isEdit = !!subject;
  subject = subject || { name: "", code: "", teacher: "", day: "Monday", startTime: "", endTime: "", room: "" };
  openModal(`
    <div class="modal-header">
      <h2>${isEdit ? "Edit Subject" : "Add Subject"}</h2>
      <button class="icon-btn" id="modal-close">${iconClose()}</button>
    </div>
    <form id="modal-subject-form" class="form-grid">
      <label class="field field-wide">
        <span>Subject name</span>
        <input type="text" name="name" value="${escapeHtml(subject.name)}" placeholder="e.g. MongoDB" required />
      </label>
      <label class="field">
        <span>Subject code</span>
        <input type="text" name="code" value="${escapeHtml(subject.code)}" placeholder="e.g. IT202" />
      </label>
      <label class="field">
        <span>Teacher</span>
        <input type="text" name="teacher" value="${escapeHtml(subject.teacher)}" />
      </label>
      <label class="field">
        <span>Day</span>
        <select name="day">
          ${DAY_NAMES.map((d) => `<option value="${d}" ${subject.day === d ? "selected" : ""}>${d}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>Room</span>
        <input type="text" name="room" value="${escapeHtml(subject.room)}" placeholder="e.g. A101" />
      </label>
      <label class="field">
        <span>Start time</span>
        <input type="time" name="startTime" value="${escapeHtml(subject.startTime)}" />
      </label>
      <label class="field">
        <span>End time</span>
        <input type="time" name="endTime" value="${escapeHtml(subject.endTime)}" />
      </label>
      <div class="field-wide modal-actions">
        <button type="submit" class="btn btn-primary">${iconCheck()} ${isEdit ? "Save changes" : "Add subject"}</button>
      </div>
    </form>
  `);

  document.getElementById("modal-subject-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get("name"),
      code: fd.get("code"),
      teacher: fd.get("teacher"),
      day: fd.get("day"),
      room: fd.get("room"),
      startTime: fd.get("startTime"),
      endTime: fd.get("endTime"),
    };
    if (isEdit) {
      Subjects.update(subject.id, data);
      showToast("Subject updated.");
    } else {
      Subjects.add(data);
      showToast("Subject added.");
    }
    closeModal();
    navigateTo("subjects");
  });
}

/* ============================================================
   STATISTICS
   ============================================================ */

function renderStatistics() {
  const currentRecords = Attendance.getCurrentPeriodRecords();
  const summary = Attendance.summarize(currentRecords);
  const attendancePct = summary.total ? Math.round(((summary.Present + summary.Late) / summary.total) * 100) : 0;
  const absencePct = summary.total ? Math.round((summary.Absent / summary.total) * 100) : 0;

  const bySubject = Attendance.summarizeBySubject(currentRecords)
    .map((b) => ({ ...b, subject: Subjects.getById(b.subjectId) }))
    .filter((b) => b.subject);

  const byMonth = Attendance.summarizeByMonth(DataStore.getRecords());

  const allPeriods = Semesters.getAllPeriodsFlat();
  const semesterComparison = allPeriods.map((p) => {
    const recs = Attendance.getRecordsForPeriod(p.yearId, p.semesterId, p.periodId);
    const s = Attendance.summarize(recs);
    return { ...p, ...s };
  }).filter((p) => p.total > 0);

  return `
    <div class="view-header">
      <div>
        <h1>Statistics</h1>
        <p class="muted">A visual read on how the current period is going.</p>
      </div>
    </div>

    <div class="grid grid-3">
      <div class="card">
        <div class="card-label">Attendance Rate</div>
        <div class="big-stat">${attendancePct}%</div>
        <canvas id="stat-attendance-bar" class="percent-bar"></canvas>
      </div>
      <div class="card">
        <div class="card-label">Absence Rate</div>
        <div class="big-stat" style="color:var(--absent)">${absencePct}%</div>
        <canvas id="stat-absence-bar" class="percent-bar"></canvas>
      </div>
      <div class="card">
        <div class="card-label">Present vs Absent</div>
        <canvas id="stat-donut" class="chart-canvas chart-canvas--donut"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-label">Attendance by Subject</div>
      ${bySubject.length === 0 ? `<p class="muted small">No data yet for this period.</p>` : `<canvas id="stat-subject-bars" class="chart-canvas chart-canvas--wide"></canvas>`}
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-label">Attendance by Month</div>
        ${byMonth.length === 0 ? `<p class="muted small">No records yet.</p>` : `<canvas id="stat-month-bars" class="chart-canvas"></canvas>`}
      </div>
      <div class="card">
        <div class="card-label">Semester Comparison</div>
        ${semesterComparison.length === 0 ? `<p class="muted small">No data across periods yet.</p>` : `
          <ul class="compare-list">
            ${semesterComparison.map((p) => {
              const pct = p.total ? Math.round(((p.Present + p.Late) / p.total) * 100) : 0;
              return `
              <li class="compare-item">
                <div class="compare-label">
                  <strong>${escapeHtml(p.yearLabel)} · ${escapeHtml(p.semesterLabel)} ${escapeHtml(p.periodLabel)}</strong>
                  <span class="muted small">${p.total} classes</span>
                </div>
                <div class="compare-bar-track"><div class="compare-bar-fill" style="width:${pct}%"></div></div>
                <span class="compare-pct">${pct}%</span>
              </li>`;
            }).join("")}
          </ul>
        `}
      </div>
    </div>
  `;
}

function afterStatistics() {
  const currentRecords = Attendance.getCurrentPeriodRecords();
  const summary = Attendance.summarize(currentRecords);
  const attendancePct = summary.total ? Math.round(((summary.Present + summary.Late) / summary.total) * 100) : 0;
  const absencePct = summary.total ? Math.round((summary.Absent / summary.total) * 100) : 0;

  const attBar = document.getElementById("stat-attendance-bar");
  if (attBar) Statistics.drawPercentBar(attBar, attendancePct, "#2F9E64");
  const absBar = document.getElementById("stat-absence-bar");
  if (absBar) Statistics.drawPercentBar(absBar, absencePct, "#E5484D");

  const donut = document.getElementById("stat-donut");
  if (donut) {
    Statistics.drawDonut(donut, [
      { label: "Present", value: summary.Present, color: "#2F9E64" },
      { label: "Absent", value: summary.Absent, color: "#E5484D" },
      { label: "Late", value: summary.Late, color: "#F0A93B" },
      { label: "Permission", value: summary.Permission, color: "#3B82C4" },
    ]);
  }

  const subjBars = document.getElementById("stat-subject-bars");
  if (subjBars) {
    const bySubject = Attendance.summarizeBySubject(currentRecords)
      .map((b) => ({ ...b, subject: Subjects.getById(b.subjectId) }))
      .filter((b) => b.subject);
    Statistics.drawGroupedBars(
      subjBars,
      bySubject.map((b) => b.subject.name.slice(0, 8)),
      [
        { name: "Present", color: "#2F9E64", values: bySubject.map((b) => b.Present) },
        { name: "Absent", color: "#E5484D", values: bySubject.map((b) => b.Absent) },
      ]
    );
  }

  const monthBars = document.getElementById("stat-month-bars");
  if (monthBars) {
    const byMonth = Attendance.summarizeByMonth(DataStore.getRecords());
    Statistics.drawGroupedBars(
      monthBars,
      byMonth.map((m) => m.month.slice(5) + "/" + m.month.slice(2, 4)),
      [
        { name: "Present", color: "#2F9E64", values: byMonth.map((m) => m.Present) },
        { name: "Absent", color: "#E5484D", values: byMonth.map((m) => m.Absent) },
      ]
    );
  }
}

/* ============================================================
   HISTORY
   ============================================================ */

function renderHistory() {
  const periods = Semesters.getAllPeriodsFlat();
  const subjects = Subjects.getAll();
  let records = [...DataStore.getRecords()];

  if (historyFilters.yearId) records = records.filter((r) => r.yearId === historyFilters.yearId);
  if (historyFilters.semesterId) records = records.filter((r) => r.semesterId === historyFilters.semesterId);
  if (historyFilters.periodId) records = records.filter((r) => r.periodId === historyFilters.periodId);
  if (historyFilters.subjectId) records = records.filter((r) => r.subjectId === historyFilters.subjectId);
  if (historyFilters.status) records = records.filter((r) => r.status === historyFilters.status);
  if (historyFilters.date) records = records.filter((r) => r.date === historyFilters.date);

  records.sort((a, b) => b.date.localeCompare(a.date));

  return `
    <div class="view-header">
      <div>
        <h1>Attendance History</h1>
        <p class="muted">Every record you've ever saved, nothing is ever deleted.</p>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <select id="hf-period">
          <option value="">All periods</option>
          ${periods.map((p) => `<option value="${p.yearId}|${p.semesterId}|${p.periodId}" ${historyFilters.yearId === p.yearId && historyFilters.semesterId === p.semesterId && historyFilters.periodId === p.periodId ? "selected" : ""}>${escapeHtml(p.yearLabel)} · ${escapeHtml(p.semesterLabel)} ${escapeHtml(p.periodLabel)}</option>`).join("")}
        </select>
        <select id="hf-subject">
          <option value="">All subjects</option>
          ${subjects.map((s) => `<option value="${s.id}" ${historyFilters.subjectId === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
        </select>
        <select id="hf-status">
          <option value="">All statuses</option>
          ${Object.values(Attendance.STATUS).map((s) => `<option value="${s}" ${historyFilters.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <input type="date" id="hf-date" value="${historyFilters.date}" />
        <button class="btn btn-sm" id="hf-clear">Clear filters</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Subject</th><th>Period</th><th>Status</th><th>Note</th><th></th></tr></thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="6" class="muted small" style="padding:24px;text-align:center;">No records match these filters.</td></tr>` : records.map((r) => {
              const subj = Subjects.getById(r.subjectId);
              const per = periods.find((p) => p.yearId === r.yearId && p.semesterId === r.semesterId && p.periodId === r.periodId);
              return `
                <tr>
                  <td>${formatDisplayDate(r.date)}</td>
                  <td>${escapeHtml(subj ? subj.name : "Unknown")}</td>
                  <td class="muted small">${per ? escapeHtml(per.semesterLabel) + " " + escapeHtml(per.periodLabel) : "-"}</td>
                  <td><span class="tag tag--${r.status.toLowerCase()}">${r.status}</span></td>
                  <td class="muted small">${escapeHtml(r.note || "-")}</td>
                  <td class="row-actions">
                    <button class="icon-btn" data-edit-record="${r.id}" aria-label="Edit">${iconEdit()}</button>
                    <button class="icon-btn icon-btn--danger" data-delete-record="${r.id}" aria-label="Delete">${iconTrash()}</button>
                  </td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function afterHistory() {
  document.getElementById("hf-period").addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) {
      historyFilters.yearId = historyFilters.semesterId = historyFilters.periodId = "";
    } else {
      const [yearId, semesterId, periodId] = val.split("|");
      Object.assign(historyFilters, { yearId, semesterId, periodId });
    }
    navigateTo("history");
  });
  document.getElementById("hf-subject").addEventListener("change", (e) => {
    historyFilters.subjectId = e.target.value;
    navigateTo("history");
  });
  document.getElementById("hf-status").addEventListener("change", (e) => {
    historyFilters.status = e.target.value;
    navigateTo("history");
  });
  document.getElementById("hf-date").addEventListener("change", (e) => {
    historyFilters.date = e.target.value;
    navigateTo("history");
  });
  document.getElementById("hf-clear").addEventListener("click", () => {
    historyFilters = { yearId: "", semesterId: "", periodId: "", subjectId: "", status: "", date: "" };
    navigateTo("history");
  });
  wireRecordListActions();
}

/* ============================================================
   SEMESTERS
   ============================================================ */

function renderSemesters() {
  const years = Semesters.getYears();
  const current = Semesters.getCurrent();

  return `
    <div class="view-header">
      <div>
        <h1>Semesters</h1>
        <p class="muted">Switch periods, or set up a new academic year.</p>
      </div>
      <button class="btn btn-primary" id="add-year-btn">${iconPlus()} Add academic year</button>
    </div>

    ${years.map((year) => `
      <div class="card">
        <div class="card-label-row">
          <div class="card-label">${escapeHtml(year.label)}</div>
          <button class="icon-btn icon-btn--danger" data-delete-year="${year.id}" aria-label="Delete year">${iconTrash()}</button>
        </div>
        <div class="semester-columns">
          ${year.semesters.map((sem) => `
            <div class="semester-col">
              <h3>${escapeHtml(sem.label)}</h3>
              ${sem.periods.map((per) => {
                const recs = Attendance.getRecordsForPeriod(year.id, sem.id, per.id);
                const stat = Attendance.calculateStatus(recs);
                const isCurrent = current.yearId === year.id && current.semesterId === sem.id && current.periodId === per.id;
                return `
                  <div class="period-card ${isCurrent ? "period-card--active" : ""}">
                    <div class="period-card-top">
                      <strong>${escapeHtml(per.label)}</strong>
                      ${isCurrent ? `<span class="tag tag--present">Current</span>` : ""}
                    </div>
                    <div class="muted small">${recs.length} classes recorded · ${stat.absences} absences</div>
                    <span class="tag tag--${stat.isBlacklisted ? "blacklist" : "safe"}">${stat.status}</span>
                    ${!isCurrent ? `<button class="btn btn-sm" data-switch-period="${year.id}|${sem.id}|${per.id}">Switch to this period</button>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          `).join("")}
        </div>
      </div>
    `).join("")}
  `;
}

function afterSemesters() {
  document.getElementById("add-year-btn").addEventListener("click", () => {
    openModal(`
      <div class="modal-header">
        <h2>Add Academic Year</h2>
        <button class="icon-btn" id="modal-close">${iconClose()}</button>
      </div>
      <form id="modal-year-form" class="form-grid">
        <label class="field field-wide">
          <span>Label</span>
          <input type="text" name="label" placeholder="e.g. 2027-2028" required />
        </label>
        <p class="muted small field-wide">This automatically creates Semester 1 and Semester 2, each with a Midterm and Final period.</p>
        <div class="field-wide modal-actions">
          <button type="submit" class="btn btn-primary">${iconCheck()} Create</button>
        </div>
      </form>
    `);
    document.getElementById("modal-year-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const label = new FormData(e.target).get("label");
      Semesters.addYear(label);
      showToast("Academic year created.");
      closeModal();
      navigateTo("semesters");
    });
  });

  document.querySelectorAll("[data-switch-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [yearId, semesterId, periodId] = btn.dataset.switchPeriod.split("|");
      confirmAction("Switch your current period? Today's dashboard and attendance entries will use this period from now on. Old records stay untouched.", () => {
        Semesters.setCurrent(yearId, semesterId, periodId);
        showToast("Current period switched.");
        renderTopbarPeriod();
        renderSidebarStatus();
        navigateTo("semesters");
      });
    });
  });

  document.querySelectorAll("[data-delete-year]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction("Delete this academic year and all its periods? Attendance records already saved under it will remain in your data but won't be reachable from Semesters.", () => {
        Semesters.removeYear(btn.dataset.deleteYear);
        showToast("Academic year deleted.");
        navigateTo("semesters");
      });
    });
  });
}

/* ============================================================
   PROFILE
   ============================================================ */

function renderProfile() {
  const profile = DataStore.getProfile();
  return `
    <div class="view-header">
      <div>
        <h1>Profile</h1>
        <p class="muted">Your personal details.</p>
      </div>
    </div>
    <div class="card card-narrow">
      <form id="profile-form" class="form-grid">
        <label class="field field-wide">
          <span>Student name</span>
          <input type="text" name="name" value="${escapeHtml(profile.name)}" />
        </label>
        <label class="field">
          <span>Student ID</span>
          <input type="text" name="studentId" value="${escapeHtml(profile.studentId)}" />
        </label>
        <label class="field">
          <span>University</span>
          <input type="text" name="university" value="${escapeHtml(profile.university)}" />
        </label>
        <label class="field">
          <span>Major</span>
          <input type="text" name="major" value="${escapeHtml(profile.major)}" />
        </label>
        <label class="field">
          <span>Year</span>
          <input type="text" name="year" value="${escapeHtml(profile.year)}" placeholder="e.g. Year 2" />
        </label>
        <label class="field">
          <span>Class</span>
          <input type="text" name="className" value="${escapeHtml(profile.className)}" placeholder="e.g. IT-2B" />
        </label>
        <label class="field">
          <span>Academic year</span>
          <input type="text" name="academicYear" value="${escapeHtml(profile.academicYear)}" />
        </label>
        <div class="field-wide">
          <button type="submit" class="btn btn-primary">${iconCheck()} Save profile</button>
        </div>
      </form>
    </div>
  `;
}

function afterProfile() {
  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    DataStore.saveProfile({
      name: fd.get("name"),
      studentId: fd.get("studentId"),
      university: fd.get("university"),
      major: fd.get("major"),
      year: fd.get("year"),
      className: fd.get("className"),
      academicYear: fd.get("academicYear"),
    });
    showToast("Profile saved.");
  });
}

/* ============================================================
   SETTINGS
   ============================================================ */

function renderSettings() {
  const settings = DataStore.getSettings();
  return `
    <div class="view-header">
      <div>
        <h1>Settings</h1>
        <p class="muted">Adjust the blacklist rule without touching any code.</p>
      </div>
    </div>
    <div class="card card-narrow">
      <form id="settings-form" class="form-grid">
        <label class="field">
          <span>Maximum allowed absences</span>
          <input type="number" min="0" name="maxAllowedAbsences" value="${settings.maxAllowedAbsences}" required />
        </label>
        <label class="field">
          <span>Blacklist when absences exceed</span>
          <input type="number" min="0" name="blacklistThreshold" value="${settings.blacklistThreshold}" required />
        </label>
        <p class="muted small field-wide">By default both numbers are 19 — meaning 20 absences trigger BLACKLIST. Changing these updates the rule everywhere in the app immediately.</p>
        <div class="field-wide">
          <button type="submit" class="btn btn-primary">${iconCheck()} Save settings</button>
        </div>
      </form>
    </div>

    <div class="card card-narrow">
      <div class="card-label">Danger zone</div>
      <p class="muted small">Erase every subject, record and setting and start fresh. This cannot be undone — export a backup first.</p>
      <button class="btn btn-danger" id="wipe-btn">${iconTrash()} Erase all data</button>
    </div>
  `;
}

function afterSettings() {
  document.getElementById("settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    DataStore.saveSettings({
      maxAllowedAbsences: Number(fd.get("maxAllowedAbsences")),
      blacklistThreshold: Number(fd.get("blacklistThreshold")),
    });
    showToast("Settings saved.");
    renderSidebarStatus();
  });

  document.getElementById("wipe-btn").addEventListener("click", () => {
    confirmAction("Erase ALL data permanently? This deletes your profile, subjects, and every attendance record.", () => {
      DataStore.wipeAll();
      showToast("All data erased.");
      navigateTo("dashboard");
    });
  });
}

/* ============================================================
   BACKUP & RESTORE
   ============================================================ */

function renderBackup() {
  return `
    <div class="view-header">
      <div>
        <h1>Backup & Restore</h1>
        <p class="muted">Your data lives only in this browser — back it up regularly.</p>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-label">Export</div>
        <p class="muted small">Save everything (profile, subjects, records, settings) as a JSON file you can restore later.</p>
        <button class="btn btn-primary" id="export-json-btn">${iconDownload()} Export as JSON</button>
        <div class="divider"></div>
        <p class="muted small">Or export just the attendance records as a spreadsheet-friendly CSV file.</p>
        <button class="btn" id="export-csv-btn">${iconDownload()} Export records as CSV</button>
      </div>
      <div class="card">
        <div class="card-label">Import</div>
        <p class="muted small">Restore from a previously exported JSON backup. This replaces your current data.</p>
        <input type="file" id="import-file" accept="application/json" hidden />
        <button class="btn" id="import-json-btn">${iconUpload()} Choose backup file</button>
      </div>
    </div>
  `;
}

function afterBackup() {
  document.getElementById("export-json-btn").addEventListener("click", () => {
    const data = DataStore.exportAll();
    downloadFile(
      `setec-attendance-backup-${toDateInputValue(new Date())}.json`,
      JSON.stringify(data, null, 2),
      "application/json"
    );
    showToast("Backup exported.");
  });

  document.getElementById("export-csv-btn").addEventListener("click", () => {
    const records = DataStore.getRecords();
    const header = ["Date", "Subject", "Status", "Note", "Academic Year", "Semester", "Period"];
    const periods = Semesters.getAllPeriodsFlat();
    const rows = records.map((r) => {
      const subj = Subjects.getById(r.subjectId);
      const per = periods.find((p) => p.yearId === r.yearId && p.semesterId === r.semesterId && p.periodId === r.periodId);
      return [
        r.date,
        subj ? subj.name : "Unknown",
        r.status,
        r.note || "",
        per ? per.yearLabel : "",
        per ? per.semesterLabel : "",
        per ? per.periodLabel : "",
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadFile(`setec-attendance-records-${toDateInputValue(new Date())}.csv`, csv, "text/csv");
    showToast("CSV exported.");
  });

  document.getElementById("import-json-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        confirmAction("Import this backup? It will replace your current data.", () => {
          DataStore.importAll(data);
          showToast("Backup imported.");
          renderTopbarPeriod();
          renderSidebarStatus();
          navigateTo("dashboard");
        });
      } catch (err) {
        showToast("That file doesn't look like a valid backup.", "danger");
      }
    };
    reader.readAsText(file);
  });
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   SHARED UI HELPERS: modal, toast, confirm
   ============================================================ */

function openModal(html) {
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal");
  modal.innerHTML = html;
  overlay.hidden = false;
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
  document.getElementById("modal").innerHTML = "";
}

function confirmAction(message, onConfirm) {
  openModal(`
    <div class="modal-header">
      <h2>Please confirm</h2>
      <button class="icon-btn" id="modal-close">${iconClose()}</button>
    </div>
    <p>${escapeHtml(message)}</p>
    <div class="modal-actions">
      <button class="btn" id="confirm-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-ok">Confirm</button>
    </div>
  `);
  document.getElementById("confirm-cancel").addEventListener("click", closeModal);
  document.getElementById("confirm-ok").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}

function showToast(message, type = "success") {
  const stack = document.getElementById("toast-stack");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/* ============================================================
   FORMAT / UTIL HELPERS
   ============================================================ */

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Converts a JS Date into "YYYY-MM-DD" for <input type="date">
function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateVal) {
  if (!dateVal) return "-";
  const [y, m, d] = dateVal.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/* ============================================================
   ICONS (small inline SVGs, no external icon font needed)
   ============================================================ */

function icon(pathContent) {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathContent}</svg>`;
}
function iconDashboard() { return icon('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'); }
function iconCheck() { return icon('<path d="M20 6 9 17l-5-5"/>'); }
function iconCalendar() { return icon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'); }
function iconBook() { return icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'); }
function iconChart() { return icon('<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>'); }
function iconClock() { return icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'); }
function iconLayers() { return icon('<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'); }
function iconUser() { return icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'); }
function iconGear() { return icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'); }
function iconBackup() { return icon('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'); }
function iconMenu() { return icon('<path d="M3 12h18M3 6h18M3 18h18"/>'); }
function iconPlus() { return icon('<path d="M12 5v14M5 12h14"/>'); }
function iconEdit() { return icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'); }
function iconTrash() { return icon('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'); }
function iconClose() { return icon('<path d="M18 6 6 18M6 6l12 12"/>'); }
function iconChevronLeft() { return icon('<path d="m15 18-6-6 6-6"/>'); }
function iconChevronRight() { return icon('<path d="m9 18 6-6-6-6"/>'); }
function iconDownload() { return icon('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'); }
function iconUpload() { return icon('<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>'); }
