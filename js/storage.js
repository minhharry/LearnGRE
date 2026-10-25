/**
 * Storage Module: Manages localStorage persistence, schema migration,
 * streaks, and JSON Import/Export.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

export const STORAGE_KEY = 'GRE_PROGRESS_DATA';
export const BACKUP_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export function getTodayDateString() {
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
  const today = getTodayDateString();
  return {
    version: '4.0',
    last_backup: new Date().toISOString(),
    progression: {
      current_group: 1,
      unlocked_groups: [1],
      daily_streak: 1,
      last_active_date: today,
      today_sessions_count: 0,
      today_sessions_date: today,
    },
    ui_prefs: {
      sidebar_width: 320,
      study_mode: 'guided', // 'guided' | 'cram'
      theme: 'dark', // 'dark' | 'light' (VS Code palette)
    },
    words: {},
    activity: {},
  };
}

/**
 * Seeds baseline activity records if user has an active streak or words learned.
 */
function seedBaselineActivityIfEmpty(data) {
  if (!data.activity) {
    data.activity = {};
  }
  const activityKeys = Object.keys(data.activity);
  const streak = data.progression?.daily_streak || 1;
  const wordCount = Object.keys(data.words || {}).length;

  if (activityKeys.length === 0 && (streak > 0 || wordCount > 0)) {
    const now = new Date();
    const daysToSeed = Math.max(streak, 1);
    for (let i = 0; i < daysToSeed; i++) {
      const pastDate = new Date(now);
      pastDate.setDate(now.getDate() - i);
      const year = pastDate.getFullYear();
      const month = String(pastDate.getMonth() + 1).padStart(2, '0');
      const day = String(pastDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const simulatedCount = i === 0
        ? Math.max((data.progression.today_sessions_count || 0) * 15, 8)
        : ((i * 7 + 11) % 18) + 6;
      data.activity[dateStr] = simulatedCount;
    }
  }
}

/**
 * Loads and validates progress data from localStorage, calculating streaks.
 */
export function loadProgressData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const freshState = createDefaultState();
      seedBaselineActivityIfEmpty(freshState);
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
      if (!migratedState.activity) {
        migratedState.activity = {};
      }
      seedBaselineActivityIfEmpty(migratedState);
      saveProgressData(migratedState);
      return migratedState;
    }

    if (!data.activity || typeof data.activity !== 'object') {
      data.activity = {};
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

    // Ensure today_sessions fields are initialized and reset on new day
    if (!data.progression.today_sessions_date || data.progression.today_sessions_date !== today) {
      data.progression.today_sessions_count = 0;
      data.progression.today_sessions_date = today;
      saveProgressData(data);
    }

    seedBaselineActivityIfEmpty(data);
    saveProgressData(data);

    return data;
  } catch (error) {
    console.error('Failed to parse progress data from storage:', error);
    const freshState = createDefaultState();
    seedBaselineActivityIfEmpty(freshState);
    saveProgressData(freshState);
    return freshState;
  }
}

/**
 * Records an activity count for a given date (defaults to today).
 */
export function recordDailyActivity(storageData, count = 1, targetDate = null) {
  if (!storageData) return;
  if (!storageData.activity) {
    storageData.activity = {};
  }
  const dateKey = targetDate || getTodayDateString();
  storageData.activity[dateKey] = (storageData.activity[dateKey] || 0) + count;
  saveProgressData(storageData);
}

/**
 * Records completion of a study session today and returns current count.
 */
export function recordCompletedSession(storageData) {
  const today = getTodayDateString();
  if (!storageData.progression.today_sessions_date || storageData.progression.today_sessions_date !== today) {
    storageData.progression.today_sessions_count = 1;
    storageData.progression.today_sessions_date = today;
  } else {
    storageData.progression.today_sessions_count = (storageData.progression.today_sessions_count || 0) + 1;
  }
  recordDailyActivity(storageData, 10, today);
  saveProgressData(storageData);
  return storageData.progression.today_sessions_count;
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
 * Encodes progress data to a compact base64-encoded gzip string.
 * Data -> JSON -> Gzip (CompressionStream) -> Base64
 */
export async function encodeProgressCode(data) {
  data.last_backup = new Date().toISOString();
  saveProgressData(data);

  const jsonString = JSON.stringify(data);
  const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressedBuffer = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(compressedBuffer);

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Decodes progress data from a base64-encoded gzip string.
 * Base64 -> Gzip bytes -> Decompress (DecompressionStream) -> JSON -> Data
 */
export async function decodeProgressCode(base64Code) {
  try {
    const cleanCode = (base64Code || '').trim();
    if (!cleanCode) {
      throw new Error('Mã chia sẻ không được để trống.');
    }
    const binary = atob(cleanCode);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const decompressedText = await new Response(stream).text();
    const parsed = JSON.parse(decompressedText);
    if (!parsed || typeof parsed !== 'object' || !parsed.words) {
      throw new Error('Dữ liệu không đúng định dạng: thiếu danh sách từ.');
    }
    parsed.version = '4.0';
    parsed.last_backup = new Date().toISOString();
    saveProgressData(parsed);
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

/**
 * Returns all word items from vocabList that are currently due for SRS review across all groups.
 */
export function getDueWordsAcrossAllGroups(vocabList, storageData) {
  const now = Date.now();
  if (!storageData || !storageData.words || !Array.isArray(vocabList)) return [];
  return vocabList.filter((word) => {
    const record = storageData.words[word.id];
    if (!record || !record.level || record.level <= 0 || !record.next_review) return false;
    const reviewTime = new Date(record.next_review).getTime();
    return !isNaN(reviewTime) && reviewTime <= now;
  });
}

/**
 * Counts total words due for SRS review across all groups.
 */
export function countDueWords(storageData) {
  const now = Date.now();
  let count = 0;
  if (!storageData || !storageData.words) return 0;
  for (const wordId of Object.keys(storageData.words)) {
    const record = storageData.words[wordId];
    if (record && record.level > 0 && record.next_review) {
      const reviewTime = new Date(record.next_review).getTime();
      if (!isNaN(reviewTime) && reviewTime <= now) {
        count++;
      }
    }
  }
  return count;
}
