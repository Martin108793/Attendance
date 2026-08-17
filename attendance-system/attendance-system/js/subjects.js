/* ============================================================
   subjects.js
   ------------------------------------------------------------
   Everything about managing the list of subjects (name, code,
   teacher, schedule...). No localStorage calls here directly —
   we always go through DataStore.
   ============================================================ */

const Subjects = {
  // Returns all subjects, newest first
  getAll() {
    return DataStore.getSubjects().sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },

  getById(id) {
    return DataStore.getSubjects().find((s) => s.id === id) || null;
  },

  // data = { name, code, teacher, day, startTime, endTime, room }
  add(data) {
    const subjects = DataStore.getSubjects();
    const subject = {
      id: makeId("subj"),
      name: data.name.trim(),
      code: (data.code || "").trim(),
      teacher: (data.teacher || "").trim(),
      day: data.day || "Monday",
      startTime: data.startTime || "",
      endTime: data.endTime || "",
      room: (data.room || "").trim(),
      createdAt: new Date().toISOString(),
    };
    subjects.push(subject);
    DataStore.saveSubjects(subjects);
    return subject;
  },

  update(id, data) {
    const subjects = DataStore.getSubjects();
    const idx = subjects.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    subjects[idx] = { ...subjects[idx], ...data };
    DataStore.saveSubjects(subjects);
    return subjects[idx];
  },

  // Deleting a subject also removes its attendance records so
  // the history never points at a subject that no longer exists.
  remove(id) {
    const subjects = DataStore.getSubjects().filter((s) => s.id !== id);
    DataStore.saveSubjects(subjects);
    const records = DataStore.getRecords().filter((r) => r.subjectId !== id);
    DataStore.saveRecords(records);
  },

  // Subjects scheduled for a given weekday, e.g. "Monday"
  getByDay(day) {
    return this.getAll().filter((s) => s.day === day);
  },

  // Subjects scheduled for today (based on the browser's date)
  getToday() {
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const today = dayNames[new Date().getDay()];
    return this.getByDay(today).sort((a, b) =>
      (a.startTime || "").localeCompare(b.startTime || "")
    );
  },
};
