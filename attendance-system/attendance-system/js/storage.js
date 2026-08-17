/* ============================================================
   storage.js
   ------------------------------------------------------------
   Everything that touches localStorage lives in this file.
   Every other file asks THIS file to read/write data — nothing
   else is allowed to call localStorage directly. That way, if
   we ever swap localStorage for a real server, we only have to
   change this one file.
   ============================================================ */

// A single prefix so we never collide with other sites' data
const STORAGE_PREFIX = "setec_attendance_";

// The list of "tables" we store, each as its own localStorage key
const KEYS = {
  PROFILE: STORAGE_PREFIX + "profile",
  SUBJECTS: STORAGE_PREFIX + "subjects",
  YEARS: STORAGE_PREFIX + "academic_years",
  RECORDS: STORAGE_PREFIX + "attendance_records",
  SETTINGS: STORAGE_PREFIX + "settings",
  CURRENT: STORAGE_PREFIX + "current_period",
};

/* ---------- low level helpers ---------- */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read", key, err);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error("Failed to write", key, err);
    return false;
  }
}

/* ---------- default data (first run only) ---------- */

function defaultProfile() {
  return {
    name: "",
    studentId: "",
    university: "SETEC Institute",
    major: "",
    year: "",
    className: "",
    academicYear: "2026-2027",
  };
}

function defaultSettings() {
  return {
    maxAllowedAbsences: 19, // "Allowed Absences"
    // status = BLACKLIST when absences > blacklistThreshold
    blacklistThreshold: 19,
  };
}

// One academic year, containing two semesters, each with Midterm & Final
function defaultYears() {
  return [
    {
      id: "ay-2026-2027",
      label: "2026-2027",
      semesters: [
        {
          id: "sem-1",
          label: "Semester 1",
          periods: [
            { id: "s1-mid", label: "Midterm" },
            { id: "s1-final", label: "Final" },
          ],
        },
        {
          id: "sem-2",
          label: "Semester 2",
          periods: [
            { id: "s2-mid", label: "Midterm" },
            { id: "s2-final", label: "Final" },
          ],
        },
      ],
    },
  ];
}

function defaultCurrentPeriod() {
  return {
    yearId: "ay-2026-2027",
    semesterId: "sem-1",
    periodId: "s1-mid",
  };
}

/* ---------- public getters / setters ---------- */

const DataStore = {
  KEYS,

  // Called once on app start to make sure every key exists
  init() {
    if (localStorage.getItem(KEYS.PROFILE) === null) {
      writeJSON(KEYS.PROFILE, defaultProfile());
    }
    if (localStorage.getItem(KEYS.SUBJECTS) === null) {
      writeJSON(KEYS.SUBJECTS, []);
    }
    if (localStorage.getItem(KEYS.YEARS) === null) {
      writeJSON(KEYS.YEARS, defaultYears());
    }
    if (localStorage.getItem(KEYS.RECORDS) === null) {
      writeJSON(KEYS.RECORDS, []);
    }
    if (localStorage.getItem(KEYS.SETTINGS) === null) {
      writeJSON(KEYS.SETTINGS, defaultSettings());
    }
    if (localStorage.getItem(KEYS.CURRENT) === null) {
      writeJSON(KEYS.CURRENT, defaultCurrentPeriod());
    }
  },

  // Profile
  getProfile() {
    return readJSON(KEYS.PROFILE, defaultProfile());
  },
  saveProfile(profile) {
    return writeJSON(KEYS.PROFILE, profile);
  },

  // Subjects
  getSubjects() {
    return readJSON(KEYS.SUBJECTS, []);
  },
  saveSubjects(subjects) {
    return writeJSON(KEYS.SUBJECTS, subjects);
  },

  // Academic years / semesters / periods
  getYears() {
    return readJSON(KEYS.YEARS, defaultYears());
  },
  saveYears(years) {
    return writeJSON(KEYS.YEARS, years);
  },

  // Attendance records (the full history, never trimmed)
  getRecords() {
    return readJSON(KEYS.RECORDS, []);
  },
  saveRecords(records) {
    return writeJSON(KEYS.RECORDS, records);
  },

  // Settings (the blacklist rule lives here, not hard-coded)
  getSettings() {
    return readJSON(KEYS.SETTINGS, defaultSettings());
  },
  saveSettings(settings) {
    return writeJSON(KEYS.SETTINGS, settings);
  },

  // Which year/semester/period is currently selected
  getCurrentPeriod() {
    return readJSON(KEYS.CURRENT, defaultCurrentPeriod());
  },
  saveCurrentPeriod(current) {
    return writeJSON(KEYS.CURRENT, current);
  },

  /* ---------- backup / restore ---------- */

  // Bundles every table into one object for export
  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      subjects: this.getSubjects(),
      years: this.getYears(),
      records: this.getRecords(),
      settings: this.getSettings(),
      currentPeriod: this.getCurrentPeriod(),
    };
  },

  // Overwrites every table from a previously exported object
  importAll(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid backup file");
    }
    if (data.profile) writeJSON(KEYS.PROFILE, data.profile);
    if (data.subjects) writeJSON(KEYS.SUBJECTS, data.subjects);
    if (data.years) writeJSON(KEYS.YEARS, data.years);
    if (data.records) writeJSON(KEYS.RECORDS, data.records);
    if (data.settings) writeJSON(KEYS.SETTINGS, data.settings);
    if (data.currentPeriod) writeJSON(KEYS.CURRENT, data.currentPeriod);
    return true;
  },

  // Wipes everything and puts the defaults back (used by Settings > Reset)
  wipeAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    this.init();
  },
};

// Small id generator used across modules (subjects, records, years...)
function makeId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}
