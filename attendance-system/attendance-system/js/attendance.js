/* ============================================================
   attendance.js
   ------------------------------------------------------------
   Everything about individual attendance records, and the
   blacklist math that reads them. This file never hard-codes
   the "19" limit — it always reads it from DataStore.getSettings().
   ============================================================ */

const STATUS = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  PERMISSION: "Permission",
};

const Attendance = {
  STATUS,

  getAllRecords() {
    return DataStore.getRecords();
  },

  // data = { date, subjectId, status, note, className }
  // Automatically tags the record with whatever period is
  // currently selected, so it lands in the right bucket.
  add(data) {
    const records = DataStore.getRecords();
    const cur = Semesters.getCurrent();
    const record = {
      id: makeId("rec"),
      date: data.date,
      subjectId: data.subjectId,
      className: data.className || "",
      status: data.status,
      note: (data.note || "").trim(),
      yearId: cur.yearId,
      semesterId: cur.semesterId,
      periodId: cur.periodId,
      createdAt: new Date().toISOString(),
    };
    records.push(record);
    DataStore.saveRecords(records);
    return record;
  },

  update(id, data) {
    const records = DataStore.getRecords();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...data };
    DataStore.saveRecords(records);
    return records[idx];
  },

  remove(id) {
    const records = DataStore.getRecords().filter((r) => r.id !== id);
    DataStore.saveRecords(records);
  },

  getById(id) {
    return DataStore.getRecords().find((r) => r.id === id) || null;
  },

  // Records for one specific date (any period) — used by the calendar
  getByDate(date) {
    return DataStore.getRecords().filter((r) => r.date === date);
  },

  // THE key filter: only records belonging to one exact period.
  // This is what makes old semesters/periods invisible to the
  // current blacklist count without ever deleting them.
  getRecordsForPeriod(yearId, semesterId, periodId) {
    return DataStore.getRecords().filter(
      (r) =>
        r.yearId === yearId &&
        r.semesterId === semesterId &&
        r.periodId === periodId
    );
  },

  // Records for whichever period is currently selected
  getCurrentPeriodRecords() {
    const cur = Semesters.getCurrent();
    return this.getRecordsForPeriod(cur.yearId, cur.semesterId, cur.periodId);
  },

  /* ---------- blacklist / status calculation ---------- */

  // Core rule, reading the limit from Settings instead of
  // hard-coding it. Returns a full status object the UI can render.
  calculateStatus(records) {
    const settings = DataStore.getSettings();
    const allowed = settings.maxAllowedAbsences;
    const threshold = settings.blacklistThreshold;

    const absences = records.filter((r) => r.status === STATUS.ABSENT).length;
    const remaining = Math.max(allowed - absences, 0); // never negative
    const isBlacklisted = absences > threshold;

    return {
      absences,
      allowed,
      remaining,
      isBlacklisted,
      status: isBlacklisted ? "BLACKLIST" : "SAFE",
    };
  },

  // Convenience wrapper for "the current period's status"
  getCurrentStatus() {
    return this.calculateStatus(this.getCurrentPeriodRecords());
  },

  // Returns a warning message object based on how close to the
  // limit the student is. Returns null when no warning is needed.
  getWarning(statusObj) {
    const { absences, allowed, isBlacklisted } = statusObj;
    if (isBlacklisted) {
      return {
        level: "blacklist",
        icon: "🚨",
        message: "BLACKLIST — you have exceeded the allowed absence limit.",
      };
    }
    if (absences === allowed) {
      return {
        level: "final",
        icon: "⚠",
        message: "Final warning: you have reached the maximum allowed absences.",
      };
    }
    const left = allowed - absences;
    if (left <= 5) {
      return {
        level: "warning",
        icon: "⚠",
        message: `Warning: only ${left} absence${left === 1 ? "" : "s"} remaining.`,
      };
    }
    return null;
  },

  /* ---------- summaries ---------- */

  // Present / Absent / Late / Permission counts for a set of records
  summarize(records) {
    const summary = {
      total: records.length,
      Present: 0,
      Absent: 0,
      Late: 0,
      Permission: 0,
    };
    records.forEach((r) => {
      if (summary[r.status] !== undefined) summary[r.status]++;
    });
    return summary;
  },

  // Per-subject breakdown for the current period
  summarizeBySubject(records) {
    const bySubject = {};
    records.forEach((r) => {
      if (!bySubject[r.subjectId]) {
        bySubject[r.subjectId] = {
          subjectId: r.subjectId,
          total: 0,
          Present: 0,
          Absent: 0,
          Late: 0,
          Permission: 0,
        };
      }
      const entry = bySubject[r.subjectId];
      entry.total++;
      if (entry[r.status] !== undefined) entry[r.status]++;
    });
    return Object.values(bySubject);
  },

  // Attendance counts grouped by calendar month (YYYY-MM), for charts
  summarizeByMonth(records) {
    const byMonth = {};
    records.forEach((r) => {
      const month = r.date.slice(0, 7); // "YYYY-MM"
      if (!byMonth[month]) {
        byMonth[month] = { month, total: 0, Present: 0, Absent: 0, Late: 0, Permission: 0 };
      }
      byMonth[month].total++;
      if (byMonth[month][r.status] !== undefined) byMonth[month][r.status]++;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  },
};
