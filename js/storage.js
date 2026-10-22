/**
 * Storage Module: Manages localStorage persistence, schema migration,
 * streaks, and JSON Import/Export.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

export const STORAGE_KEY = 'GRE_PROGRESS_DATA_V4';
export const BACKUP_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates default state conforming to SPEC.md section 3.3.
 */
export function createDefaultState() {
  return {
    version: '4.0',
    last_backup: new Date().toISOString(),
    progression: {
      current_group: 1,
      unlocked_groups: [1],
      daily_streak: 1,
      last_active_date: getTodayDateString(),
    },
    ui_prefs: {
      sidebar_width: 320,
      study_mode: 'guided', // 'guided' | 'cram'
      theme: 'dark', // 'dark' | 'light' (VS Code palette)
    },
    words: {},
  };
}

/**
 * Loads and validates progress data from localStorage, calculating streaks.
 */
export function loadProgressData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const freshState = createDefaultState();
      saveProgressData(freshState);
      return freshState;
    }

    const data = JSON.parse(raw);
    if (!data.version || data.version !== '4.0') {
      // Migrate or re-initialize if version mismatch
      const migratedState = {
        ...createDefaultState(),
        ...data,
        version: '4.0',
      };
      saveProgressData(migratedState);
      return migratedState;
    }

    // Daily streak management
    const today = getTodayDateString();
    const lastActive = data.progression.last_active_date;
    if (lastActive && lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      if (lastActive === yesterdayStr) {
        data.progression.daily_streak = (data.progression.daily_streak || 0) + 1;
      } else {
        data.progression.daily_streak = 1;
      }
      data.progression.last_active_date = today;
      saveProgressData(data);
    }

    return data;
  } catch (error) {
    console.error('Failed to parse progress data from storage:', error);
    const freshState = createDefaultState();
    saveProgressData(freshState);
    return freshState;
  }
}

/**
 * Saves state directly into localStorage.
 */
export function saveProgressData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save progress to localStorage:', error);
  }
}

/**
 * Ensures word record exists in words dictionary.
 */
export function ensureWordRecord(data, wordId) {
  if (!data.words[wordId]) {
    data.words[wordId] = {
      level: 0,
      status: 'unseen', // 'unseen' | 'learning' | 'reviewing' | 'mastered'
      next_review: null,
      avg_response_ms: 0,
      consecutive_correct: 0,
      mistake_count: 0,
      flagged_error: false,
    };
  }
  return data.words[wordId];
}

/**
 * Checks if 3-day backup reminder is due.
 */
export function isBackupDue(lastBackupIso) {
  if (!lastBackupIso) return true;
  const lastTime = Date.parse(lastBackupIso);
  if (isNaN(lastTime)) return true;
  return Date.now() - lastTime > BACKUP_INTERVAL_MS;
}

/**
 * Exports progress data as a downloadable JSON file.
 */
export function exportProgressJson(data) {
  data.last_backup = new Date().toISOString();
  saveProgressData(data);

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStr = getTodayDateString();

  anchor.href = url;
  anchor.download = `LearnGRE_Progress_Backup_${dateStr}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Imports progress data from JSON file content.
 */
export function importProgressJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || !parsed.words) {
      throw new Error('Invalid JSON format: missing words property.');
    }
    parsed.version = '4.0';
    parsed.last_backup = new Date().toISOString();
    saveProgressData(parsed);
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
