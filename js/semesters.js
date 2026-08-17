/* ============================================================
   semesters.js
   ------------------------------------------------------------
   Manages the Academic Year → Semester → Period (Midterm/Final)
   tree, and which one is "current".

   IMPORTANT CONCEPT:
   We never delete old attendance records when a new period
   starts. Instead, every attendance record is tagged with
   yearId + semesterId + periodId. "Starting a new period" just
   means changing which period is "current" — the blacklist
   counter then only looks at records tagged with that period,
   so old history is untouched but also doesn't affect the new
   count. See Attendance.getRecordsForPeriod().
   ============================================================ */

const Semesters = {
  getYears() {
    return DataStore.getYears();
  },

  getYearById(yearId) {
    return this.getYears().find((y) => y.id === yearId) || null;
  },

  getSemester(yearId, semesterId) {
    const year = this.getYearById(yearId);
    if (!year) return null;
    return year.semesters.find((s) => s.id === semesterId) || null;
  },

  getPeriod(yearId, semesterId, periodId) {
    const semester = this.getSemester(yearId, semesterId);
    if (!semester) return null;
    return semester.periods.find((p) => p.id === periodId) || null;
  },

  // The year/semester/period currently selected in the top bar
  getCurrent() {
    return DataStore.getCurrentPeriod();
  },

  // Human readable labels for the currently selected period
  getCurrentLabels() {
    const cur = this.getCurrent();
    const year = this.getYearById(cur.yearId);
    const semester = year
      ? year.semesters.find((s) => s.id === cur.semesterId)
      : null;
    const period = semester
      ? semester.periods.find((p) => p.id === cur.periodId)
      : null;
    return {
      yearLabel: year ? year.label : "-",
      semesterLabel: semester ? semester.label : "-",
      periodLabel: period ? period.label : "-",
      yearId: cur.yearId,
      semesterId: cur.semesterId,
      periodId: cur.periodId,
    };
  },

  // Switches which period is "current". This is how a Final period
  // "starts" — the counter naturally resets because the dashboard
  // only counts records tagged with the new periodId.
  setCurrent(yearId, semesterId, periodId) {
    DataStore.saveCurrentPeriod({ yearId, semesterId, periodId });
  },

  // Adds a brand new academic year with the standard
  // Semester 1/2 -> Midterm/Final structure.
  addYear(label) {
    const years = this.getYears();
    const suffix = makeId("ay").slice(-6);
    const year = {
      id: "ay_" + suffix,
      label: label.trim(),
      semesters: [
        {
          id: "sem1_" + suffix,
          label: "Semester 1",
          periods: [
            { id: "s1mid_" + suffix, label: "Midterm" },
            { id: "s1final_" + suffix, label: "Final" },
          ],
        },
        {
          id: "sem2_" + suffix,
          label: "Semester 2",
          periods: [
            { id: "s2mid_" + suffix, label: "Midterm" },
            { id: "s2final_" + suffix, label: "Final" },
          ],
        },
      ],
    };
    years.push(year);
    DataStore.saveYears(years);
    return year;
  },

  removeYear(yearId) {
    const years = this.getYears().filter((y) => y.id !== yearId);
    DataStore.saveYears(years);
  },

  // Flat list of every period across every year, useful for filters.
  // Each entry: { yearId, yearLabel, semesterId, semesterLabel, periodId, periodLabel }
  getAllPeriodsFlat() {
    const out = [];
    this.getYears().forEach((y) => {
      y.semesters.forEach((s) => {
        s.periods.forEach((p) => {
          out.push({
            yearId: y.id,
            yearLabel: y.label,
            semesterId: s.id,
            semesterLabel: s.label,
            periodId: p.id,
            periodLabel: p.label,
          });
        });
      });
    });
    return out;
  },
};
