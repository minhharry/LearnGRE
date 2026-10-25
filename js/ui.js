/**
 * UI Module: DOM Rendering, Zero-Click Instant Feedback,
 * Web Speech Audio Pronunciation, and Modals.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

import { countDueWords } from './storage.js';

// Clean SVG icon definitions (Strictly no emojis)
export const ICONS = {
  streak: `<svg class="svg-icon streak-icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  audio: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  flag: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  lock: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  check: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
  close: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  keyboard: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="10" y1="12" x2="10.01" y2="12"/><line x1="14" y1="12" x2="14.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>`,
  database: `<svg class="svg-icon" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  search: `<svg class="svg-icon svg-icon-sm sidebar-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  arrowRight: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  book: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  menu: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  sun: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  clock: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  checkCircle: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  bolt: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  chart: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  activity: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  layers: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  target: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="6" r="6"/><circle cx="12" cy="2" r="2"/></svg>`,
  grid: `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
};

/**
 * Text-To-Speech Pronunciation using native Web Speech API.
 */
export function playPronunciation(word) {
  if (!('speechSynthesis' in window) || !word) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

/**
 * Updates top bar UI items (streak, backup reminder, mode).
 */
export function renderTopBar(data, isBackupDue) {
  const streakChip = document.getElementById('topbar-streak');
  const streakCount = document.getElementById('streak-count');
  const backupBtn = document.getElementById('topbar-backup-btn');
  const modeGuidedBtn = document.getElementById('mode-guided-btn');
  const modeCramBtn = document.getElementById('mode-cram-btn');
  const errorBadge = document.getElementById('error-nav-count');
  const dueBadge = document.getElementById('due-nav-count');

  const streak = data.progression.daily_streak || 1;
  streakCount.textContent = streak;
  applyStreakAccent(streak);

  if (streak >= 5) {
    streakChip.classList.add('streak-active');
  } else {
    streakChip.classList.remove('streak-active');
  }

  // Count flagged words
  let flaggedCount = 0;
  for (const wId of Object.keys(data.words)) {
    if (data.words[wId] && data.words[wId].flagged_error) {
      flaggedCount++;
    }
  }
  if (errorBadge) {
    errorBadge.textContent = flaggedCount;
    errorBadge.style.display = flaggedCount > 0 ? 'inline-flex' : 'none';
  }

  // Count words due for review across all groups
  const dueCount = countDueWords(data);
  if (dueBadge) {
    dueBadge.textContent = dueCount;
    dueBadge.style.display = dueCount > 0 ? 'inline-flex' : 'none';
  }

  if (backupBtn) {
    if (isBackupDue) {
      backupBtn.classList.add('backup-alert-badge');
      backupBtn.title = 'Sao lưu dữ liệu định kỳ (hơn 3 ngày chưa sao lưu)';
    } else {
      backupBtn.classList.remove('backup-alert-badge');
      backupBtn.title = 'Quản lý Dữ liệu và Sao lưu';
    }
  }

  const mode = data.ui_prefs.study_mode || 'guided';
  if (modeGuidedBtn && modeCramBtn) {
    if (mode === 'cram') {
      modeCramBtn.classList.add('active');
      modeGuidedBtn.classList.remove('active');
    } else {
      modeGuidedBtn.classList.add('active');
      modeCramBtn.classList.remove('active');
    }
  }

  // Update theme toggle icon
  renderThemeButton(data.ui_prefs.theme || 'dark');
}

/**
 * Updates Theme Toggle Button Icon based on current theme.
 */
export function renderThemeButton(theme) {
  const isDark = theme === 'dark';
  const iconHtml = isDark ? ICONS.sun : ICONS.moon;
  const tooltip = isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối (VS Code theme)';

  const topbarBtn = document.getElementById('topbar-theme-btn');
  if (topbarBtn) {
    topbarBtn.innerHTML = iconHtml;
    topbarBtn.title = tooltip;
  }

  const sessionBtn = document.getElementById('session-theme-btn');
  if (sessionBtn) {
    sessionBtn.innerHTML = iconHtml;
    sessionBtn.title = tooltip;
  }
}

/**
 * Renders the 32 Groups in the left sidebar.
 */
export function renderSidebarGroups({
  vocabList,
  storageData,
  currentGroup,
  currentView = 'dashboard',
  onSelectGroup,
  searchQuery = '',
}) {
  const container = document.getElementById('groups-list-container');
  if (!container) return;

  const totalGroups = 32;
  const isCramMode = storageData.ui_prefs.study_mode === 'cram';
  const unlocked = new Set(storageData.progression.unlocked_groups || [1]);

  let html = '';

  for (let g = 1; g <= totalGroups; g++) {
    const groupWords = vocabList.filter((w) => w.group === g);
    const hasData = groupWords.length > 0;

    // Filter by search query if present
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matches = groupWords.some(
        (w) => w.word.toLowerCase().includes(q) || (w.vi_gloss && w.vi_gloss.toLowerCase().includes(q))
      );
      if (!matches) continue;
    }

    const isLocked = !isCramMode && !unlocked.has(g);
    const isActive = currentView === 'dashboard' && g === currentGroup;

    // Calculate mastery % for group
    let masteredCount = 0;
    for (const w of groupWords) {
      const rec = storageData.words[w.id];
      if (rec && rec.level >= 3) {
        masteredCount++;
      }
    }
    const totalCount = groupWords.length || 30;
    const masteryPercent = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

    html += `
      <div class="group-item-card ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" data-group="${g}">
        <div class="group-item-header">
          <div class="group-item-name">
            ${isLocked ? ICONS.lock : ''}
            <span>Group ${g}</span>
            ${!hasData ? '<span class="brand-tag">Đang nạp</span>' : ''}
          </div>
          <span class="group-item-mastery">${masteryPercent}%</span>
        </div>
        <div class="group-progress-track">
          <div class="group-progress-fill" style="width: ${masteryPercent}%; background-color: ${
      masteryPercent >= 85 ? 'var(--success-border)' : 'var(--accent-color)'
    };"></div>
        </div>
        <div class="group-item-meta">
          <span class="group-item-mastery-count">${masteredCount}/${totalCount} thành thạo</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Bind click handlers
  container.querySelectorAll('.group-item-card').forEach((el) => {
    el.addEventListener('click', () => {
      const g = parseInt(el.dataset.group, 10);
      const isLocked = el.classList.contains('locked');
      if (!isLocked) {
        onSelectGroup(g);
      }
    });
  });
}

let countdownInterval = null;

/**
 * Stops any active countdown timer.
 */
export function stopCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/**
 * Formats remaining milliseconds into HH:MM:SS or Xd HH:MM:SS.
 */
export function formatCountdownTime(remainingMs) {
  if (remainingMs <= 0) return '00:00:00';
  const totalSec = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${String(remHours).padStart(2, '0')}:${mStr}:${sStr}`;
  }
  return `${hStr}:${mStr}:${sStr}`;
}

/**
 * Formats timestamp for human-friendly deadline description.
 */
export function formatTargetDateTime(timestamp) {
  const targetDate = new Date(timestamp);
  const today = new Date();
  const isToday =
    targetDate.getDate() === today.getDate() &&
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getFullYear() === today.getFullYear();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    targetDate.getDate() === tomorrow.getDate() &&
    targetDate.getMonth() === tomorrow.getMonth() &&
    targetDate.getFullYear() === tomorrow.getFullYear();

  const hours = String(targetDate.getHours()).padStart(2, '0');
  const minutes = String(targetDate.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) return `Hôm nay lúc ${timeStr}`;
  if (isTomorrow) return `Ngày mai lúc ${timeStr}`;
  const day = String(targetDate.getDate()).padStart(2, '0');
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  return `${day}/${month} lúc ${timeStr}`;
}

/**
 * Inspects storageData to calculate SRS review deadlines.
 */
export function getNextReviewInfo(storageData, currentGroup, vocabList) {
  const now = Date.now();
  const wordsWithReview = [];

  for (const w of vocabList) {
    const rec = storageData.words[w.id];
    if (rec && rec.next_review) {
      const reviewTime = new Date(rec.next_review).getTime();
      if (!isNaN(reviewTime)) {
        wordsWithReview.push({
          id: w.id,
          word: w.word,
          group: w.group,
          level: rec.level,
          reviewTime,
        });
      }
    }
  }

  const dueWords = wordsWithReview.filter((item) => item.reviewTime <= now);
  const upcomingWords = wordsWithReview.filter((item) => item.reviewTime > now);
  upcomingWords.sort((a, b) => a.reviewTime - b.reviewTime);

  const groupDueWords = dueWords.filter((item) => item.group === currentGroup);

  if (dueWords.length > 0) {
    return {
      status: 'due',
      dueCount: dueWords.length,
      groupDueCount: groupDueWords.length,
      nearestTimestamp: null,
      upcomingWordsCount: 0,
      nearestGroup: null,
    };
  }

  if (upcomingWords.length > 0) {
    const nearest = upcomingWords[0];
    const batchWords = upcomingWords.filter(
      (item) => Math.abs(item.reviewTime - nearest.reviewTime) < 60000
    );
    return {
      status: 'upcoming',
      dueCount: 0,
      groupDueCount: 0,
      nearestTimestamp: nearest.reviewTime,
      upcomingWordsCount: batchWords.length,
      nearestGroup: nearest.group,
      totalScheduledCount: upcomingWords.length,
    };
  }

  return {
    status: 'none',
    dueCount: 0,
    groupDueCount: 0,
    nearestTimestamp: null,
    upcomingWordsCount: 0,
    nearestGroup: null,
  };
}

function startCountdownTimer(targetTimestamp, onTick, onComplete) {
  stopCountdownTimer();
  if (!targetTimestamp) return;

  function tick() {
    const remaining = targetTimestamp - Date.now();
    if (remaining <= 0) {
      stopCountdownTimer();
      onComplete();
    } else {
      onTick(remaining);
    }
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

/**
 * Renders the Comprehensive System Dashboard with Aggregated Metrics,
 * Leitner SRS Distribution, 32 Groups Matrix, and GitHub-like Activity Heatmap.
 */
export function renderOverviewDashboard({
  vocabList,
  storageData,
  onSelectGroup,
  onStartGroupSession,
  onStartSpeedMatch,
  onStartAllDueSession,
  onViewErrorNotebook,
}) {
  stopCountdownTimer();

  const stage = document.getElementById('main-stage');
  if (!stage) return;

  const totalWords = vocabList.length || 960;
  let level0Count = 0;
  let level1Count = 0;
  let level2Count = 0;
  let level3Count = 0;
  let level4Count = 0;
  let flaggedCount = 0;

  for (const w of vocabList) {
    const rec = storageData.words[w.id];
    const lvl = rec ? (rec.level || 0) : 0;
    if (lvl === 4) level4Count++;
    else if (lvl === 3) level3Count++;
    else if (lvl === 2) level2Count++;
    else if (lvl === 1) level1Count++;
    else level0Count++;

    if (rec && (rec.flagged_error || (rec.mistake_count && rec.mistake_count > 0))) {
      flaggedCount++;
    }
  }

  const masteredCount = level3Count + level4Count;
  const learningCount = level1Count + level2Count;
  const masteredPercent = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;
  const learningPercent = totalWords > 0 ? Math.round((learningCount / totalWords) * 100) : 0;
  const unseenPercent = totalWords > 0 ? Math.round((level0Count / totalWords) * 100) : 0;
  const dueCount = countDueWords(storageData);
  const todaySessions = storageData.progression.today_sessions_count || 0;
  const streak = storageData.progression.daily_streak || 1;
  const currentGroup = storageData.progression.current_group || 1;
  const unlockedGroups = new Set(storageData.progression.unlocked_groups || [1]);
  const isCramMode = storageData.ui_prefs?.study_mode === 'cram';

  // --------------------------------------------------------------------------
  // GitHub-Style Activity Heatmap Calculations (Past 52 Weeks / 364 Days)
  // --------------------------------------------------------------------------
  const today = new Date();
  const endDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
  const daysUntilSaturday = 6 - endDayOfWeek;
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilSaturday);

  const totalWeeks = 52;
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (totalWeeks * 7 - 1));

  const activityMap = storageData.activity || {};
  let annualTotalActivity = 0;
  let activeDaysCount = 0;
  let maxDayActivity = 0;
  let maxDayDateStr = '';
  let longestStreak = streak;
  let rollingStreak = 0;

  const VI_MONTH_NAMES = [
    'Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6',
    'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'
  ];

  const VI_DAY_NAMES = [
    'Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'
  ];

  const weeksData = [];
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 0; w < totalWeeks; w++) {
    const daysInWeek = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (w * 7 + d));
      const cellTime = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()).getTime();
      const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const isFuture = cellTime > todayTime;

      const year = cellDate.getFullYear();
      const month = String(cellDate.getMonth() + 1).padStart(2, '0');
      const day = String(cellDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const count = isFuture ? 0 : (activityMap[dateStr] || 0);

      if (!isFuture) {
        annualTotalActivity += count;
        if (count > 0) {
          activeDaysCount++;
          rollingStreak++;
          if (rollingStreak > longestStreak) longestStreak = rollingStreak;
          if (count > maxDayActivity) {
            maxDayActivity = count;
            maxDayDateStr = dateStr;
          }
        } else {
          rollingStreak = 0;
        }
      }

      // Record month label at start of each month or week 0
      if (d === 0) {
        const m = cellDate.getMonth();
        if (m !== lastMonth) {
          monthLabels.push({ weekIndex: w, label: VI_MONTH_NAMES[m] });
          lastMonth = m;
        }
      }

      let level = 0;
      if (!isFuture) {
        if (count >= 20) level = 4;
        else if (count >= 10) level = 3;
        else if (count >= 5) level = 2;
        else if (count >= 1) level = 1;
      }

      daysInWeek.push({
        date: cellDate,
        dateStr,
        count,
        level,
        isFuture,
        dayOfWeek: d,
      });
    }
    weeksData.push(daysInWeek);
  }

  // --------------------------------------------------------------------------
  // Build Heatmap HTML
  // --------------------------------------------------------------------------
  let monthLabelsHtml = '';
  monthLabels.forEach((m) => {
    monthLabelsHtml += `<span class="heatmap-month-label" style="left: ${m.weekIndex * 14}px;">${m.label}</span>`;
  });

  let columnsHtml = '';
  weeksData.forEach((week) => {
    let weekCellsHtml = '';
    week.forEach((day) => {
      weekCellsHtml += `
        <div class="heatmap-cell level-${day.level} ${day.isFuture ? 'is-future' : ''}"
             data-date="${day.dateStr}"
             data-count="${day.count}"
             data-future="${day.isFuture}"></div>
      `;
    });
    columnsHtml += `<div class="heatmap-week-column">${weekCellsHtml}</div>`;
  });

  // --------------------------------------------------------------------------
  // Build 32 Groups Matrix HTML
  // --------------------------------------------------------------------------
  let groupsMatrixHtml = '';
  for (let g = 1; g <= 32; g++) {
    const groupWords = vocabList.filter((w) => w.group === g);
    let gMastered = 0;
    for (const w of groupWords) {
      const rec = storageData.words[w.id];
      if (rec && rec.level >= 3) gMastered++;
    }
    const gTotal = groupWords.length || 30;
    const gPct = gTotal > 0 ? Math.round((gMastered / gTotal) * 100) : 0;
    const isLocked = !isCramMode && !unlockedGroups.has(g);
    const isCurrent = g === currentGroup;
    const isMastered = gPct >= 85;

    groupsMatrixHtml += `
      <div class="matrix-group-btn ${isCurrent ? 'is-current' : ''} ${isLocked ? 'is-locked' : ''} ${isMastered ? 'is-mastered' : ''}" data-group="${g}" title="Group ${g}: ${gMastered}/${gTotal} từ thành thạo (${gPct}%)">
        <div class="matrix-group-top">
          <span>G${String(g).padStart(2, '0')}</span>
          <span class="matrix-group-pct">${gPct}%</span>
        </div>
        <div class="matrix-group-bar">
          <div class="matrix-group-bar-fill" style="width: ${gPct}%;"></div>
        </div>
        <div class="matrix-group-meta">
          ${isLocked ? 'Đang khóa' : `${gMastered}/${gTotal} từ`}
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Full Dashboard Assembly
  // --------------------------------------------------------------------------
  stage.innerHTML = `
    <div class="overview-container animate-fade-in">
      <!-- Dashboard Header -->
      <div class="overview-header">
        <div class="overview-title-group">
          <div class="overview-tag">
            ${ICONS.chart}
            <span>Hệ thống Báo cáo Tổng hợp &bull; LearnGRE</span>
          </div>
          <h1 class="overview-title">Dashboard Thống kê Học tập</h1>
          <p class="overview-subtitle">
            Tổng quan tiến độ 960 từ vựng GRE, chu kỳ Leitner SRS và lịch sử đóng góp hoạt động thời gian thực.
          </p>
        </div>

        <div class="overview-actions">
          <button id="btn-overview-continue-group" class="btn-primary" title="Vào học tiếp Group ${currentGroup}">
            ${ICONS.arrowRight} <span>Tiếp tục Group ${currentGroup}</span>
          </button>
          <button id="btn-overview-all-due" class="btn-due-review ${dueCount > 0 ? 'has-due' : ''}" title="Tổng ôn toàn bộ các từ đã đến hạn (Phím tắt: R)">
            ${ICONS.clock} <span>Tổng ôn tới hạn</span>
            <span class="due-badge-pill">${dueCount}</span>
          </button>
          <button id="btn-overview-speed-match" class="btn-secondary" title="Luyện phản xạ nghĩa từ">
            ${ICONS.bolt} <span>Speed Match</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards Grid -->
      <div class="overview-kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-label">Tổng từ đã học</span>
            <span class="kpi-icon">${ICONS.book}</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value">${totalWords - level0Count}</span>
            <span class="kpi-subval">/ ${totalWords}</span>
          </div>
          <div class="kpi-subtext">Đã tiếp cận ${100 - unseenPercent}% kho từ vựng</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-label">Thành thạo (L3 - L4)</span>
            <span class="kpi-badge kpi-badge-green">${masteredPercent}%</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value" style="color: var(--success-border);">${masteredCount}</span>
            <span class="kpi-subval">từ vựng</span>
          </div>
          <div class="kpi-subtext">Chu kỳ nhớ dài hạn (3 - 7 ngày)</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-label">Đang ghi nhớ (L1 - L2)</span>
            <span class="kpi-badge kpi-badge-blue">${learningPercent}%</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value" style="color: var(--accent-color);">${learningCount}</span>
            <span class="kpi-subval">từ vựng</span>
          </div>
          <div class="kpi-subtext">Chu kỳ nhớ ngắn hạn (4 - 24 giờ)</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-label">Chuỗi Streak</span>
            <span class="kpi-badge kpi-badge-orange">${streak} ngày</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value" style="color: var(--streak-color);">${streak}</span>
            <span class="kpi-subval">ngày liên tục</span>
          </div>
          <div class="kpi-subtext">Chuỗi dài nhất: ${longestStreak} ngày</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-label">Phiên hôm nay</span>
            <span class="kpi-icon">${ICONS.checkCircle}</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value">${todaySessions}</span>
            <span class="kpi-subval">phiên</span>
          </div>
          <div class="kpi-subtext">${todaySessions > 0 ? 'Đã đạt chỉ tiêu học tập hôm nay' : 'Chưa hoàn thành phiên nào'}</div>
        </div>

        <div class="kpi-card" id="kpi-card-errors" style="cursor: pointer;" title="Bấm để xem Sổ tay câu sai">
          <div class="kpi-header">
            <span class="kpi-label">Sổ tay câu sai</span>
            <span class="kpi-badge kpi-badge-red">${flaggedCount} từ</span>
          </div>
          <div class="kpi-value-row">
            <span class="kpi-value" style="color: #f87171;">${flaggedCount}</span>
            <span class="kpi-subval">cần củng cố</span>
          </div>
          <div class="kpi-subtext">Từ bị gắn cờ hoặc trả lời sai</div>
        </div>
      </div>

      <!-- GitHub-like Activity Heatmap Card -->
      <div class="github-heatmap-card">
        <div class="heatmap-card-header">
          <div class="heatmap-card-title-group">
            <h2 class="heatmap-card-title">
              ${ICONS.activity}
              <span>Biểu đồ Hoạt động & Đóng góp (52 tuần gần nhất)</span>
            </h2>
          </div>
          <div class="heatmap-card-stats">
            <div class="heatmap-stat-item">
              <span>Tổng hoạt động:</span>
              <strong>${annualTotalActivity}</strong>
            </div>
            <div class="heatmap-stat-item">
              <span>Ngày học tập:</span>
              <strong>${activeDaysCount} ngày</strong>
            </div>
            <div class="heatmap-stat-item">
              <span>Chuỗi hiện tại:</span>
              <strong>${streak} ngày</strong>
            </div>
          </div>
        </div>

        <!-- Mobile Horizontal Scroll Hint -->
        <div class="heatmap-mobile-swipe-hint">
          <span>Vuốt ngang để xem toàn bộ 52 tuần &bull; Chạm vào ô để xem chi tiết</span>
        </div>

        <!-- Heatmap Board Container -->
        <div class="heatmap-scroll-area">
          <div class="heatmap-board">
            <!-- Day of Week Labels (T2, T4, T6) -->
            <div class="heatmap-days-legend">
              <span class="heatmap-day-label"></span>
              <span class="heatmap-day-label">T2</span>
              <span class="heatmap-day-label"></span>
              <span class="heatmap-day-label">T4</span>
              <span class="heatmap-day-label"></span>
              <span class="heatmap-day-label">T6</span>
              <span class="heatmap-day-label"></span>
            </div>

            <!-- Heatmap Columns Matrix -->
            <div class="heatmap-matrix">
              <!-- Month Labels Along the Top -->
              <div class="heatmap-months-row">
                ${monthLabelsHtml}
              </div>

              <!-- 52 Week Columns -->
              <div class="heatmap-grid-columns" id="heatmap-cells-container">
                ${columnsHtml}
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile Touch Info Bar -->
        <div id="heatmap-selected-info" class="heatmap-selected-info">
          <span>Chạm vào ô ngày bất kỳ để xem chi tiết hoạt động</span>
        </div>

        <!-- Heatmap Footer with Legend -->
        <div class="heatmap-card-footer">
          <div style="font-size: 12px; color: var(--text-muted);">
            Mỗi ô đại diện cho 1 ngày; hoạt động tính theo số câu hỏi và phiên luyện tập SRS được ghi nhận.
          </div>
          <div class="heatmap-legend">
            <span>Ít</span>
            <div class="heatmap-legend-cells">
              <div class="heatmap-cell level-0" title="0 hoạt động"></div>
              <div class="heatmap-cell level-1" title="1 - 4 hoạt động"></div>
              <div class="heatmap-cell level-2" title="5 - 9 hoạt động"></div>
              <div class="heatmap-cell level-3" title="10 - 19 hoạt động"></div>
              <div class="heatmap-cell level-4" title="20+ hoạt động"></div>
            </div>
            <span>Nhiều</span>
          </div>
        </div>
      </div>

      <!-- Floating Tooltip Element for Heatmap -->
      <div id="heatmap-floating-tooltip" class="heatmap-floating-tooltip"></div>

      <!-- Leitner SRS Level Breakdown Card -->
      <div class="leitner-distribution-card">
        <div class="leitner-card-header">
          <h2 class="leitner-card-title">
            ${ICONS.layers}
            <span>Phân bổ 5 Cấp độ Spaced Repetition (Leitner SRS)</span>
          </h2>
          <span style="font-size: 12px; color: var(--text-muted);">Tổng cộng: <strong>${totalWords} từ vựng GRE</strong></span>
        </div>

        <!-- Stacked Multi-Segment Progress Bar -->
        <div class="mastery-stacked-bar" title="L0: ${level0Count} | L1: ${level1Count} | L2: ${level2Count} | L3: ${level3Count} | L4: ${level4Count}">
          <div class="mastery-segment seg-l0" style="width: ${(level0Count / totalWords) * 100}%;"></div>
          <div class="mastery-segment seg-l1" style="width: ${(level1Count / totalWords) * 100}%;"></div>
          <div class="mastery-segment seg-l2" style="width: ${(level2Count / totalWords) * 100}%;"></div>
          <div class="mastery-segment seg-l3" style="width: ${(level3Count / totalWords) * 100}%;"></div>
          <div class="mastery-segment seg-l4" style="width: ${(level4Count / totalWords) * 100}%;"></div>
        </div>

        <!-- 5 Level Cards Grid -->
        <div class="leitner-levels-grid">
          <div class="leitner-level-card card-l0">
            <div class="leitner-level-title">
              <span>Level 0 &bull; Chưa học</span>
              <span class="leitner-level-interval">Kho dự trữ</span>
            </div>
            <div class="leitner-level-count">${level0Count} <span style="font-size: 12px; font-weight: 500; color: var(--text-muted);">(${unseenPercent}%)</span></div>
            <div class="leitner-level-desc">Từ vựng chưa từng xuất hiện trong phiên làm bài.</div>
          </div>

          <div class="leitner-level-card card-l1">
            <div class="leitner-level-title">
              <span>Level 1 &bull; Khởi động</span>
              <span class="leitner-level-interval">SRS: 4 giờ</span>
            </div>
            <div class="leitner-level-count">${level1Count} <span style="font-size: 12px; font-weight: 500; color: var(--text-muted);">(${Math.round((level1Count / totalWords) * 100)}%)</span></div>
            <div class="leitner-level-desc">Vừa tiếp cận hoặc vừa làm sai, cần ôn lại ngay sau 4h.</div>
          </div>

          <div class="leitner-level-card card-l2">
            <div class="leitner-level-title">
              <span>Level 2 &bull; Đang nhớ</span>
              <span class="leitner-level-interval">SRS: 24 giờ</span>
            </div>
            <div class="leitner-level-count">${level2Count} <span style="font-size: 12px; font-weight: 500; color: var(--text-muted);">(${Math.round((level2Count / totalWords) * 100)}%)</span></div>
            <div class="leitner-level-desc">Đã trả lời đúng 1 lần liên tiếp, chu kỳ ôn 1 ngày.</div>
          </div>

          <div class="leitner-level-card card-l3">
            <div class="leitner-level-title">
              <span>Level 3 &bull; Củng cố sâu</span>
              <span class="leitner-level-interval">SRS: 3 ngày</span>
            </div>
            <div class="leitner-level-count">${level3Count} <span style="font-size: 12px; font-weight: 500; color: var(--text-muted);">(${Math.round((level3Count / totalWords) * 100)}%)</span></div>
            <div class="leitner-level-desc">Nhớ ổn định (2 lần đúng liên tiếp), chu kỳ ôn 3 ngày.</div>
          </div>

          <div class="leitner-level-card card-l4">
            <div class="leitner-level-title">
              <span>Level 4 &bull; Thành thạo</span>
              <span class="leitner-level-interval">SRS: 7 ngày</span>
            </div>
            <div class="leitner-level-count">${level4Count} <span style="font-size: 12px; font-weight: 500; color: var(--text-muted);">(${Math.round((level4Count / totalWords) * 100)}%)</span></div>
            <div class="leitner-level-desc">Trí nhớ dài hạn vững chắc (3 lần đúng liên tiếp).</div>
          </div>
        </div>
      </div>

      <!-- 32 Groups Overview Matrix -->
      <div class="groups-matrix-card">
        <div class="groups-matrix-header">
          <h2 class="groups-matrix-title">
            ${ICONS.grid}
            <span>Ma trận Tiến độ 32 Groups Từ vựng</span>
          </h2>
          <span style="font-size: 12px; color: var(--text-muted);">Bấm vào bất kỳ Group nào để chuyển đến chi tiết học tập</span>
        </div>

        <div class="groups-matrix-grid">
          ${groupsMatrixHtml}
        </div>
      </div>
    </div>
  `;

  // --------------------------------------------------------------------------
  // Attach Event Handlers
  // --------------------------------------------------------------------------
  document.getElementById('btn-overview-continue-group')?.addEventListener('click', () => {
    onStartGroupSession(currentGroup);
  });

  document.getElementById('btn-overview-all-due')?.addEventListener('click', () => {
    onStartAllDueSession();
  });

  document.getElementById('btn-overview-speed-match')?.addEventListener('click', () => {
    onStartSpeedMatch(currentGroup);
  });

  document.getElementById('kpi-card-errors')?.addEventListener('click', () => {
    onViewErrorNotebook();
  });

  // Group matrix click handlers
  stage.querySelectorAll('.matrix-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = parseInt(btn.dataset.group, 10);
      const isLocked = btn.classList.contains('is-locked');
      if (!isLocked) {
        onSelectGroup(g);
      }
    });
  });

  // Auto-scroll heatmap to the right so latest activity (today) is immediately visible on mobile
  const scrollArea = stage.querySelector('.heatmap-scroll-area');
  if (scrollArea) {
    requestAnimationFrame(() => {
      scrollArea.scrollLeft = scrollArea.scrollWidth;
    });
  }

  // Heatmap Tooltip & Touch Event Listeners
  const tooltip = document.getElementById('heatmap-floating-tooltip');
  const infoEl = document.getElementById('heatmap-selected-info');
  const cells = stage.querySelectorAll('.heatmap-cell');

  cells.forEach((cell) => {
    // Touch / Click selection (works seamlessly on mobile and desktop)
    cell.addEventListener('click', () => {
      const isFuture = cell.dataset.future === 'true';
      if (isFuture) return;
      const dateStr = cell.dataset.date;
      const count = parseInt(cell.dataset.count, 10) || 0;

      const [y, m, d] = dateStr.split('-').map(Number);
      const cellDate = new Date(y, m - 1, d);
      const dayName = VI_DAY_NAMES[cellDate.getDay()];
      const formattedDate = `${dayName}, ${d}/${m}/${y}`;

      const countText = count === 0
        ? 'Chưa có hoạt động học tập'
        : `<strong>${count}</strong> hoạt động học tập SRS`;

      cells.forEach((c) => c.classList.remove('is-selected'));
      cell.classList.add('is-selected');

      if (infoEl) {
        infoEl.innerHTML = `<span class="heatmap-info-date">${formattedDate}:</span> <span class="heatmap-info-count">${countText}</span>`;
        infoEl.classList.add('has-data');
      }
    });

    if (tooltip) {
      cell.addEventListener('mouseenter', () => {
        const isFuture = cell.dataset.future === 'true';
        const dateStr = cell.dataset.date;
        const count = parseInt(cell.dataset.count, 10) || 0;

        if (isFuture) {
          tooltip.classList.remove('visible');
          return;
        }

        const [y, m, d] = dateStr.split('-').map(Number);
        const cellDate = new Date(y, m - 1, d);
        const dayName = VI_DAY_NAMES[cellDate.getDay()];
        const formattedDate = `${dayName}, ngày ${d}/${m}/${y}`;

        const countText = count === 0
          ? 'Chưa có hoạt động học tập'
          : `<strong>${count}</strong> hoạt động học tập SRS`;

        tooltip.innerHTML = `<div>${countText}</div><div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${formattedDate}</div>`;

        const rect = cell.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top}px`;
        tooltip.classList.add('visible');
      });

      cell.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
      });
    }
  });
}

/**
 * Renders the Group Overview / Dashboard screen.
 */
export function renderGroupDashboard({
  group,
  vocabList,
  storageData,
  onStartSession,
  onStartSpeedMatch,
  onToggleFlag,
  onStartAllDueSession,
  onViewOverview,
}) {
  stopCountdownTimer();

  const stage = document.getElementById('main-stage');
  const groupWords = vocabList.filter((w) => w.group === group);

  let masteredCount = 0;
  let learningCount = 0;
  let unseenCount = 0;

  for (const w of groupWords) {
    const rec = storageData.words[w.id];
    const lvl = rec ? rec.level : 0;
    if (lvl >= 3) masteredCount++;
    else if (lvl > 0) learningCount++;
    else unseenCount++;
  }

  const masteryPercent = groupWords.length > 0 ? Math.round((masteredCount / groupWords.length) * 100) : 0;
  const reviewInfo = getNextReviewInfo(storageData, group, vocabList);
  const totalDueCount = countDueWords(storageData);
  const todaySessionsCount = storageData.progression.today_sessions_count || 0;

  // Render initial countdown widget state
  let countdownInitialVal = '--:--:--';
  let countdownValClass = 'widget-metric-val font-mono';
  let badgeClass = 'widget-badge badge-idle';
  let badgeText = 'Chưa có lịch';
  let subtextHtml = 'Chưa có từ trong chu kỳ SRS. Hãy hoàn thành 1 phiên học.';

  if (reviewInfo.status === 'due') {
    countdownInitialVal = 'Đến hạn ôn!';
    countdownValClass = 'widget-metric-val font-mono text-accent';
    badgeClass = 'widget-badge badge-due';
    badgeText = 'Đến hạn ngay';
    const gNote = reviewInfo.groupDueCount > 0
      ? ` (Group ${group} có ${reviewInfo.groupDueCount} từ)`
      : ` (Group ${group} hiện chưa có từ tới hạn)`;
    subtextHtml = `Có <strong>${reviewInfo.dueCount} từ</strong> đến hạn ôn toàn hệ thống${gNote}.`;
  } else if (reviewInfo.status === 'upcoming') {
    countdownInitialVal = formatCountdownTime(reviewInfo.nearestTimestamp - Date.now());
    badgeClass = 'widget-badge badge-countdown';
    badgeText = 'Đang đếm ngược';
    const formattedTarget = formatTargetDateTime(reviewInfo.nearestTimestamp);
    const gNote = reviewInfo.nearestGroup === group ? 'Group này' : `Group ${reviewInfo.nearestGroup}`;
    subtextHtml = `Hạn ôn tiếp theo: <strong>${formattedTarget}</strong> (${reviewInfo.upcomingWordsCount} từ ${gNote}).`;
  }

  stage.innerHTML = `
    <div class="dashboard-container animate-fade-in">
      <div class="dashboard-header">
        <div class="dashboard-title-group">
          <div class="dashboard-group-tag">Học thuật GRE &bull; Luyện cấp tốc</div>
          <h1 class="dashboard-title">Group ${group} Vocabulary</h1>
          <div class="dashboard-metrics-row">
            <div class="metric-pill">
              <span class="metric-label">Quy mô:</span>
              <span class="metric-value">30 từ</span>
            </div>
            <div class="metric-pill">
              <span class="metric-label">Thành thạo (L3-L4):</span>
              <span class="metric-value text-accent">${masteryPercent}% (${masteredCount}/30)</span>
            </div>
            <div class="metric-pill">
              <span class="metric-label">Đang học:</span>
              <span class="metric-value">${learningCount}</span>
            </div>
            ${unseenCount > 0 ? `<div class="metric-pill"><span class="metric-label">Chưa học:</span><span class="metric-value">${unseenCount}</span></div>` : ''}
          </div>
        </div>
        <div class="dashboard-actions">
          <button id="btn-goto-overview" class="btn-secondary" title="Xem Dashboard Thống kê & Biểu đồ Heatmap (Phím tắt: D)">
            ${ICONS.chart} <span>Thống kê</span>
          </button>
          <button id="btn-start-all-due" class="btn-due-review ${totalDueCount > 0 ? 'has-due' : ''}" title="Tổng ôn tập toàn bộ từ đã đến hạn ôn của tất cả các group (Phím tắt: R)">
            ${ICONS.clock} <span>Tổng ôn tới hạn</span>
            <span class="due-badge-pill">${totalDueCount}</span>
          </button>
          <button id="btn-start-speed-drill" class="btn-secondary" title="Luyện phản xạ nghĩa từ (Phím tắt: M)">
            ${ICONS.bolt} <span>Speed Match</span>
          </button>
          <button id="btn-start-adaptive" class="btn-primary" title="Bắt đầu phiên học thích ứng (Phím tắt: Space)">
            ${ICONS.arrowRight} <span>Vào Phiên học</span>
          </button>
        </div>
      </div>

      <!-- Overview Metric Cards: Next Review Countdown & Today Sessions -->
      <div class="dashboard-widgets-grid">
        <div class="dashboard-widget-card" id="widget-next-review">
          <div class="widget-header">
            <div class="widget-title">
              ${ICONS.clock}
              <span>Lần ôn tiếp theo</span>
            </div>
            <span class="${badgeClass}" id="widget-review-badge">${badgeText}</span>
          </div>
          <div class="widget-body">
            <div class="${countdownValClass}" id="widget-countdown-val">${countdownInitialVal}</div>
          </div>
          <div class="widget-info-row" id="widget-countdown-subtext">
            ${subtextHtml}
          </div>
          <div class="widget-cta-row" id="widget-cta-container">
            ${
              reviewInfo.status === 'due'
                ? `<button id="btn-widget-review-due" class="btn-widget-cta">${ICONS.arrowRight} <span>Ôn tập ngay ${reviewInfo.dueCount} từ tới hạn</span></button>`
                : ''
            }
          </div>
        </div>

        <div class="dashboard-widget-card" id="widget-today-sessions">
          <div class="widget-header">
            <div class="widget-title">
              ${ICONS.checkCircle}
              <span>Phiên học hôm nay</span>
            </div>
            <span class="widget-badge ${todaySessionsCount >= 3 ? 'badge-success' : todaySessionsCount > 0 ? 'badge-active' : 'badge-idle'}">
              ${todaySessionsCount >= 3 ? 'Đạt mục tiêu' : todaySessionsCount > 0 ? 'Đang học tốt' : 'Mục tiêu: 2-3'}
            </span>
          </div>
          <div class="widget-body">
            <div class="widget-metric-val font-mono">
              <span class="widget-number">${todaySessionsCount}</span>
              <span class="widget-unit">/ 3 phiên</span>
            </div>
          </div>
          <div class="widget-session-tracker">
            <div class="session-step-dot ${todaySessionsCount >= 1 ? 'completed' : 'pending'}" title="Phiên 1">
              <span class="step-num">1</span>
            </div>
            <div class="session-step-line ${todaySessionsCount >= 2 ? 'completed' : ''}"></div>
            <div class="session-step-dot ${todaySessionsCount >= 2 ? 'completed' : 'pending'}" title="Phiên 2">
              <span class="step-num">2</span>
            </div>
            <div class="session-step-line ${todaySessionsCount >= 3 ? 'completed' : ''}"></div>
            <div class="session-step-dot ${todaySessionsCount >= 3 ? 'completed' : 'pending'}" title="Phiên 3">
              <span class="step-num">3</span>
            </div>
          </div>
          <div class="widget-info-row">
            <span>${todaySessionsCount >= 3 ? 'Xuất sắc! Bạn đã hoàn thành chỉ tiêu ôn luyện hôm nay.' : todaySessionsCount > 0 ? `Đã hoàn thành ${todaySessionsCount}/3 phiên. Hãy tiếp tục phát huy!` : 'Chưa có phiên nào hôm nay. Hãy bắt đầu ngay để duy trì chuỗi học!'}</span>
          </div>
        </div>
      </div>

      <div class="word-table-container">
        <table class="word-table">
          <thead>
            <tr>
              <th style="width: 25%;">Từ vựng</th>
              <th style="width: 10%;">Từ loại</th>
              <th style="width: 36%;">Nghĩa tiếng Việt</th>
              <th style="width: 16%;">Cấp độ SRS</th>
              <th style="width: 13%; text-align: right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${groupWords
              .map((w) => {
                const rec = storageData.words[w.id] || { level: 0, flagged_error: false };
                const lvl = rec.level;
                return `
                <tr>
                  <td>
                    <div class="table-word-cell">
                      <span class="word-primary-text">${w.word}</span>
                      <button class="icon-btn audio-btn" data-word="${w.word}" title="Phát âm (P)">
                        ${ICONS.audio}
                      </button>
                    </div>
                  </td>
                  <td><span class="pos-badge">${w.pos}</span></td>
                  <td><span class="gloss-text">${w.vi_gloss || (w.definitions && w.definitions[0]) || ''}</span></td>
                  <td>
                    <span class="level-pill level-pill-${lvl}">
                      <span class="level-dot"></span>
                      <span>Level ${lvl}</span>
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="action-chip-btn flag-btn ${rec.flagged_error ? 'flagged' : ''}" data-id="${w.id}">
                      ${ICONS.flag} <span>${rec.flagged_error ? 'Đã ghim' : 'Ghim'}</span>
                    </button>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Start live countdown timer if review is upcoming
  if (reviewInfo.status === 'upcoming') {
    startCountdownTimer(
      reviewInfo.nearestTimestamp,
      (remainingMs) => {
        const valEl = document.getElementById('widget-countdown-val');
        if (valEl) {
          valEl.textContent = formatCountdownTime(remainingMs);
        }
      },
      () => {
        const valEl = document.getElementById('widget-countdown-val');
        const badgeEl = document.getElementById('widget-review-badge');
        const subtextEl = document.getElementById('widget-countdown-subtext');
        const ctaEl = document.getElementById('widget-cta-container');
        if (valEl) {
          valEl.textContent = 'Đến hạn ôn!';
          valEl.className = 'widget-metric-val font-mono text-accent';
        }
        if (badgeEl) {
          badgeEl.className = 'widget-badge badge-due';
          badgeEl.textContent = 'Đến hạn ngay';
        }
        if (subtextEl) {
          subtextEl.innerHTML = 'Có từ đã đến hạn ôn tập ngay bây giờ.';
        }
        if (ctaEl) {
          ctaEl.innerHTML = `
            <button id="btn-widget-review-due" class="btn-widget-cta">
              ${ICONS.arrowRight} <span>Ôn tập ngay các từ tới hạn</span>
            </button>
          `;
          document.getElementById('btn-widget-review-due')?.addEventListener('click', onStartAllDueSession);
        }
        const allDueBtn = document.getElementById('btn-start-all-due');
        if (allDueBtn) {
          allDueBtn.classList.add('has-due');
          const pill = allDueBtn.querySelector('.due-badge-pill');
          if (pill) {
            const currentVal = parseInt(pill.textContent, 10) || 0;
            pill.textContent = currentVal + 1;
          }
        }
      }
    );
  }

  // Bind Buttons
  document.getElementById('btn-goto-overview')?.addEventListener('click', onViewOverview);
  document.getElementById('btn-start-adaptive')?.addEventListener('click', onStartSession);
  document.getElementById('btn-start-speed-drill')?.addEventListener('click', onStartSpeedMatch);
  document.getElementById('btn-start-all-due')?.addEventListener('click', onStartAllDueSession);
  document.getElementById('btn-widget-review-due')?.addEventListener('click', onStartAllDueSession);

  // Bind Audio & Flag
  stage.querySelectorAll('.audio-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPronunciation(btn.dataset.word);
    });
  });

  stage.querySelectorAll('.flag-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggleFlag(btn.dataset.id);
    });
  });
}

/**
 * Renders the Error Notebook View.
 */
export function renderErrorNotebook({ vocabList, storageData, onStartErrorSession, onToggleFlag }) {
  const stage = document.getElementById('main-stage');
  const flaggedWords = vocabList.filter((w) => {
    const rec = storageData.words[w.id];
    return rec && rec.flagged_error;
  });

  stage.innerHTML = `
    <div class="dashboard-container animate-fade-in">
      <div class="dashboard-header">
        <div class="dashboard-title-group">
          <h1>Sổ tay Câu sai (Error Notebook)</h1>
          <p>Tập hợp các từ bị nhớ nhầm hoặc thao tác sai tốc độ cao cần củng cố phản xạ.</p>
        </div>
        <div class="dashboard-actions">
          <button id="btn-practice-errors" class="btn-primary" ${flaggedWords.length === 0 ? 'disabled' : ''}>
            ${ICONS.arrowRight} Luyện tập các câu sai (${flaggedWords.length})
          </button>
        </div>
      </div>

      ${
        flaggedWords.length === 0
          ? `
        <div style="text-align: center; padding: 60px 20px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
          <div style="font-size: 16px; font-weight: 600; color: var(--text-title); margin-bottom: 8px;">Không có từ nào trong Sổ tay Câu sai!</div>
          <div style="font-size: 14px; color: var(--text-muted);">Các từ chọn sai hoặc bấm phím 'S' trong phiên học sẽ tự động được lưu vào đây.</div>
        </div>
      `
          : `
        <div class="word-table-container">
          <table class="word-table">
            <thead>
              <tr>
                <th style="width: 25%;">Từ vựng</th>
                <th style="width: 12%;">Group</th>
                <th style="width: 10%;">Từ loại</th>
                <th style="width: 33%;">Nghĩa tiếng Việt</th>
                <th style="width: 10%;">Số lần sai</th>
                <th style="width: 10%; text-align: right;">Gỡ ghim</th>
              </tr>
            </thead>
            <tbody>
              ${flaggedWords
                .map((w) => {
                  const rec = storageData.words[w.id];
                  return `
                  <tr>
                    <td>
                      <div class="table-word-cell">
                        <span class="word-primary-text">${w.word}</span>
                        <button class="icon-btn audio-btn" data-word="${w.word}">
                          ${ICONS.audio}
                        </button>
                      </div>
                    </td>
                    <td><span class="domain-tag">Group ${w.group}</span></td>
                    <td><span class="pos-badge">${w.pos}</span></td>
                    <td><span class="gloss-text">${w.vi_gloss || (w.definitions && w.definitions[0]) || ''}</span></td>
                    <td><span class="mistake-count-badge">${rec.mistake_count || 1} lần</span></td>
                    <td style="text-align: right;">
                      <button class="action-chip-btn flag-btn flagged" data-id="${w.id}">
                        ${ICONS.close} <span>Bỏ ghim</span>
                      </button>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      }
    </div>
  `;

  document.getElementById('btn-practice-errors')?.addEventListener('click', onStartErrorSession);

  stage.querySelectorAll('.audio-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPronunciation(btn.dataset.word);
    });
  });

  stage.querySelectorAll('.flag-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggleFlag(btn.dataset.id);
    });
  });
}

/**
 * Applies dynamic accent color transition to orange (#f97316) when streak >= 5 per SPEC 2.1.
 */
export function applyStreakAccent(streak) {
  const isHigh = streak >= 5;
  document.documentElement.classList.toggle('streak-high', isHigh);
  if (isHigh) {
    document.documentElement.style.setProperty('--accent-color', '#f97316');
    document.documentElement.style.setProperty('--accent-hover', '#ea580c');
    document.documentElement.style.setProperty('--accent-light', '#fff7ed');
    document.documentElement.style.setProperty('--accent-border', '#fed7aa');
  } else {
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.style.removeProperty('--accent-hover');
    document.documentElement.style.removeProperty('--accent-light');
    document.documentElement.style.removeProperty('--accent-border');
  }
}

/**
 * Renders Session Progress Header with correct / incorrect segment status.
 */
export function renderSessionProgressHeader({ current, total, isRedemption, streak, results = [], theme = 'dark', isAllDue = false }) {
  const progressHeader = document.getElementById('session-progress-header');
  if (!progressHeader) return;

  progressHeader.style.display = 'flex';
  applyStreakAccent(streak);

  let segmentsHtml = '';
  for (let i = 0; i < total; i++) {
    let statusClass = '';
    if (i === current - 1) {
      statusClass = 'active';
    } else if (i < current - 1) {
      if (results[i] && results[i].isCorrect === false) {
        statusClass = 'incorrect';
      } else {
        statusClass = 'correct';
      }
    }
    segmentsHtml += `<div class="progress-segment ${statusClass}" id="seg-${i}"></div>`;
  }

  const isDark = theme === 'dark';

  progressHeader.innerHTML = `
    <div class="session-progress-left">
      <button id="session-home-btn" class="session-home-btn brand-logo-icon" title="Quay lại trang chủ" aria-label="Quay lại trang chủ">G</button>
      ${isAllDue ? '<span class="badge badge-yellow" style="font-size: 11px; font-weight: 700;">Tổng ôn tới hạn</span>' : ''}
      ${isRedemption ? '<span class="badge badge-amber" style="font-size: 10.5px;">Gỡ lỗi</span>' : ''}
      <span class="session-counter-text">Câu ${current}/${total}</span>
    </div>
    <div class="session-progress-track">
      ${segmentsHtml}
    </div>
    <div class="session-progress-right">
      <button id="session-theme-btn" class="icon-btn session-theme-toggle" title="${isDark ? 'Giao diện Sáng' : 'Giao diện Tối'}">
        ${isDark ? ICONS.sun : ICONS.moon}
      </button>
      <button id="btn-exit-session" class="icon-btn" title="Thoát phiên (Esc)">
        ${ICONS.close}
      </button>
    </div>
  `;
}

/**
 * Updates a specific progress segment when an answer is evaluated.
 */
export function updateProgressSegment(index, isCorrect) {
  const seg = document.getElementById(`seg-${index}`);
  if (seg) {
    seg.classList.remove('active');
    seg.classList.add(isCorrect ? 'correct' : 'incorrect');
  }
}

/**
 * Renders Speed Match question screen.
 */
export function renderSpeedMatchQuestion({
  question,
  onPairMatched,
  onPairFailed,
  onComplete,
}) {
  const stage = document.getElementById('main-stage');

  stage.innerHTML = `
    <div class="question-viewport animate-fade-in">
      <div class="question-card">
        <div class="question-card-meta">
          <span class="question-domain-tag">Khởi động: Speed Match</span>
          <span style="font-size: 13px; color: var(--text-muted);">Phím 1-4 chọn Từ; Phím Q-W-E-R chọn Nghĩa</span>
        </div>
        <div style="font-size: 15px; color: var(--text-body); margin-bottom: 20px;">
          Ghép các cặp từ vựng và định nghĩa tương ứng (chọn 2 chiều tùy ý):
        </div>

        <div class="speed-match-container">
          <div class="speed-column" id="speed-left-column">
            ${question.leftWords
              .map(
                (w) => `
              <div class="speed-match-card" data-side="left" data-id="${w.id}" data-key="${w.keycap}" data-word="${w.text}">
                <span class="keycap">${w.keycap}</span>
                <span class="speed-card-text word-title">${w.text}</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="speed-column" id="speed-right-column">
            ${question.rightDefs
              .map(
                (d) => `
              <div class="speed-match-card" data-side="right" data-id="${d.id}" data-key="${d.keycap}">
                <span class="keycap">${d.keycap}</span>
                <span class="speed-card-text">${d.text}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  let selectedLeft = null;
  let selectedRight = null;
  let matchedCount = 0;

  const checkMatch = () => {
    if (!selectedLeft || !selectedRight) return;

    const leftId = selectedLeft.dataset.id;
    const rightId = selectedRight.dataset.id;

    if (leftId === rightId) {
      // Correct Match: Flash green first, then fade out
      const elL = selectedLeft;
      const elR = selectedRight;
      elL.classList.remove('selected');
      elR.classList.remove('selected');
      elL.classList.add('correct-flash');
      elR.classList.add('correct-flash');

      matchedCount++;
      onPairMatched(leftId);

      selectedLeft = null;
      selectedRight = null;

      setTimeout(() => {
        elL.classList.remove('correct-flash');
        elR.classList.remove('correct-flash');
        elL.classList.add('matched');
        elR.classList.add('matched');
      }, 300);

      if (matchedCount >= question.pairs.length) {
        // Complete Speed Match: Auto-advance after animation finishes
        setTimeout(() => {
          onComplete();
        }, 550);
      }
    } else {
      // Incorrect Match: Flash red 200ms
      const elL = selectedLeft;
      const elR = selectedRight;
      elL.classList.add('error-shake');
      elR.classList.add('error-shake');

      onPairFailed();

      setTimeout(() => {
        elL.classList.remove('error-shake', 'selected');
        elR.classList.remove('error-shake', 'selected');
      }, 200);

      selectedLeft = null;
      selectedRight = null;
    }
  };

  // Click handlers
  stage.querySelectorAll('.speed-match-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (card.classList.contains('matched') || card.classList.contains('correct-flash')) return;
      const side = card.dataset.side;

      if (side === 'left') {
        if (selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = card;
        card.classList.add('selected');
        if (card.dataset.word) {
          playPronunciation(card.dataset.word);
        }
      } else {
        if (selectedRight) selectedRight.classList.remove('selected');
        selectedRight = card;
        card.classList.add('selected');
      }

      checkMatch();
    });
  });

  // Provide trigger by key helper for keyboard support
  window.__speedMatchTrigger = (key) => {
    const k = key.toUpperCase();
    const card = stage.querySelector(`.speed-match-card[data-key="${k}"]:not(.matched):not(.correct-flash)`);
    if (card) {
      card.click();
    }
  };
}

/**
 * Renders Flash Recall question screen.
 */
export function renderFlashRecallQuestion({
  question,
  onSelectOption,
  isFlagged,
  onToggleFlag,
}) {
  const stage = document.getElementById('main-stage');

  stage.innerHTML = `
    <div class="question-viewport animate-fade-in">
      <div class="question-card">
        <div class="question-card-meta">
          <span class="question-domain-tag">${question.targetWord && question.targetWord.group ? `Group ${question.targetWord.group} - ` : ''}Flash Recall</span>
          <div class="question-card-actions">
            <button id="btn-flash-audio" class="action-chip-btn" title="Phát âm (P)">
              ${ICONS.audio} <span>Nghe (P)</span>
            </button>
            <button id="btn-flash-flag" class="action-chip-btn ${isFlagged ? 'flagged' : ''}" title="Ghi vào Sổ tay câu sai (S)">
              ${ICONS.flag} <span>${isFlagged ? 'Đã ghim (S)' : 'Ghim (S)'}</span>
            </button>
          </div>
        </div>

        <div class="flash-prompt-container">
          <div class="flash-pos-pill">${question.pos}</div>
          <div class="flash-target-word">
            <span>${question.promptWord}</span>
          </div>
        </div>

        <div class="options-grid single-column" id="flash-options-container">
          ${question.options
            .map(
              (opt) => `
            <div class="option-card" data-key="${opt.keycap}" data-correct="${opt.isCorrect}">
              <span class="keycap">${opt.keycap}</span>
              <div class="option-card-label">${opt.text}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div id="flash-feedback-placeholder"></div>
    </div>
  `;

  // Audio & Flag
  document.getElementById('btn-flash-audio')?.addEventListener('click', () => {
    playPronunciation(question.promptWord);
  });
  document.getElementById('btn-flash-flag')?.addEventListener('click', () => {
    onToggleFlag();
  });

  // Tự động phát âm từ vựng khi vào câu Flash Recall
  if (question.promptWord) {
    playPronunciation(question.promptWord);
  }

  let answered = false;

  const handleSelection = (selectedEl) => {
    if (answered) return;
    answered = true;

    // Lock all option cards
    stage.querySelectorAll('.option-card').forEach((c) => c.classList.add('locked'));

    const isCorrect = selectedEl.dataset.correct === 'true';
    if (isCorrect) {
      selectedEl.classList.add('is-correct');
    } else {
      selectedEl.classList.add('is-incorrect');
      // Highlight the correct one
      const correctEl = stage.querySelector('.option-card[data-correct="true"]');
      if (correctEl) correctEl.classList.add('is-correct');
    }

    onSelectOption({
      isCorrect,
      selectedEl,
    });
  };

  stage.querySelectorAll('.option-card').forEach((el) => {
    el.addEventListener('click', () => handleSelection(el));
  });

  window.__choiceOptionTrigger = (numKey) => {
    const el = stage.querySelector(`.option-card[data-key="${numKey}"]:not(.locked)`);
    if (el) handleSelection(el);
  };
}

/**
 * Renders Text Completion (TC) question screen.
 */
export function renderTcQuestion({
  question,
  onSelectOption,
  isFlagged,
  onToggleFlag,
}) {
  const stage = document.getElementById('main-stage');

  // Format sentence replacing [BLANK] with interactive blank element
  const formattedSentence = question.sentence.replace(
    /\[BLANK\]/g,
    `<span class="tc-blank" id="tc-sentence-blank">[BLANK]</span>`
  );

  stage.innerHTML = `
    <div class="question-viewport animate-fade-in">
      <div class="question-card">
        <div class="question-card-meta">
          <span class="question-domain-tag">${question.targetWord && question.targetWord.group ? `Group ${question.targetWord.group} - ` : ''}${question.domain}</span>
          <div class="question-card-actions">
            <button id="btn-tc-audio" class="action-chip-btn" style="display: none;" title="Phát âm từ đúng (P)">
              ${ICONS.audio} <span>Nghe (P)</span>
            </button>
            <button id="btn-tc-flag" class="action-chip-btn ${isFlagged ? 'flagged' : ''}" title="Ghi vào Sổ tay câu sai (S)">
              ${ICONS.flag} <span>${isFlagged ? 'Đã ghim (S)' : 'Ghim (S)'}</span>
            </button>
          </div>
        </div>

        <div class="tc-sentence">
          ${formattedSentence}
        </div>

        <div class="options-grid" id="tc-options-container">
          ${question.options
            .map(
              (opt) => `
            <div class="option-card" data-key="${opt.keycap}" data-word="${opt.word}" data-correct="${opt.isCorrect}">
              <span class="keycap">${opt.keycap}</span>
              <div class="option-card-text">
                <span class="option-card-label">${opt.word}</span>
                <span class="option-card-gloss">${opt.pos}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div id="tc-rationale-placeholder"></div>
    </div>
  `;

  document.getElementById('btn-tc-audio')?.addEventListener('click', () => {
    playPronunciation(question.correctWord);
  });
  document.getElementById('btn-tc-flag')?.addEventListener('click', () => {
    onToggleFlag();
  });

  let answered = false;

  const handleSelection = (selectedEl) => {
    if (answered) return;
    answered = true;

    // Reveal audio pronunciation button now that question has been answered
    const audioBtn = document.getElementById('btn-tc-audio');
    if (audioBtn) {
      audioBtn.style.display = 'inline-flex';
      audioBtn.title = `Phát âm: ${question.correctWord} (P)`;
      const span = audioBtn.querySelector('span');
      if (span) span.textContent = `Nghe (${question.correctWord}) (P)`;
    }

    // Lock options
    stage.querySelectorAll('.option-card').forEach((c) => c.classList.add('locked'));

    const isCorrect = selectedEl.dataset.correct === 'true';
    const chosenWord = selectedEl.dataset.word;
    const blankEl = document.getElementById('tc-sentence-blank');

    if (blankEl) {
      blankEl.textContent = chosenWord;
      blankEl.classList.add(isCorrect ? 'filled-correct' : 'filled-incorrect');
    }

    if (isCorrect) {
      selectedEl.classList.add('is-correct');
    } else {
      selectedEl.classList.add('is-incorrect');
      const correctEl = stage.querySelector('.option-card[data-correct="true"]');
      if (correctEl) correctEl.classList.add('is-correct');
    }

    question.chosenWord = chosenWord;

    onSelectOption({
      isCorrect,
      chosenWord,
    });
  };

  stage.querySelectorAll('.option-card').forEach((el) => {
    el.addEventListener('click', () => handleSelection(el));
  });

  window.__choiceOptionTrigger = (numKey) => {
    const el = stage.querySelector(`.option-card[data-key="${numKey}"]:not(.locked)`);
    if (el) handleSelection(el);
  };
}

/**
 * Shows the Hybrid Rationale card for TC question.
 */
export function renderTcRationale({ question, isCorrect, chosenWord, onContinue }) {
  const container = document.getElementById('tc-rationale-placeholder');
  if (!container) return;

  const viewport = document.querySelector('.question-viewport');
  if (viewport) viewport.classList.add('has-rationale');

  const statusBadge = typeof isCorrect === 'boolean'
    ? (isCorrect
        ? `<span class="badge badge-green">Chính xác!</span>`
        : `<span class="badge badge-red">Chưa chính xác</span>`)
    : '';

  const selectedWord = chosenWord || question.chosenWord;

  container.innerHTML = `
    <div class="rationale-container animate-fade-in" style="margin-top: 12px;">
      <div class="rationale-header">
        <div class="rationale-title">
          ${ICONS.book}
          ${statusBadge}
          <span>Phân tích Ngữ cảnh</span>
          <span class="badge badge-green" style="margin-left: 6px;">Đáp án: ${question.correctWord}</span>
          <button id="btn-tc-rationale-audio" class="action-chip-btn" style="margin-left: 6px; padding: 2px 8px;" title="Nghe phát âm: ${question.correctWord}">
            ${ICONS.audio} <span>Nghe</span>
          </button>
        </div>
      </div>

      <div class="rationale-clue-box">
        <div class="rationale-clue-label">Manh mối ngữ cảnh (Clue):</div>
        <div>"${question.clue}"</div>
      </div>

      <div class="rationale-text">
        ${question.rationale}
      </div>

      <div style="font-weight: 700; font-size: 13px; color: var(--text-title); margin-top: 10px; margin-bottom: 6px;">
        Tra cứu nghĩa 4 lựa chọn:
      </div>

      <div class="vocab-lookup-grid">
        ${question.options
          .map((opt) => {
            const isSelectedWrong =
              !isCorrect &&
              selectedWord &&
              opt.word.toLowerCase() === selectedWord.toLowerCase();
            const highlightClass = opt.isCorrect
              ? 'highlight-correct'
              : (isSelectedWrong ? 'highlight-incorrect' : '');

            return `
          <div class="vocab-lookup-item ${highlightClass}">
            <div class="lookup-word-row">
              <span class="lookup-word">${opt.word}</span>
              <button class="lookup-audio-btn" data-word="${opt.word}" title="Nghe phát âm: ${opt.word}">
                ${ICONS.audio}
              </button>
            </div>
            <span class="lookup-pos">${opt.pos}</span>
            <span class="lookup-vi">${opt.vi_gloss || ''}</span>
            <span class="lookup-en">${opt.definition || ''}</span>
          </div>
        `;
          })
          .join('')}
      </div>

      <div class="session-footer-bar">
        <button id="btn-tc-continue" class="btn-primary">
          Tiếp tục <span class="keycap" style="background: rgba(255,255,255,0.2); color: white; border-color: transparent;">Space</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-tc-continue')?.addEventListener('click', onContinue);
  document.getElementById('btn-tc-rationale-audio')?.addEventListener('click', () => {
    playPronunciation(question.correctWord);
  });
  container.querySelectorAll('.lookup-audio-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPronunciation(btn.dataset.word);
    });
  });

  // Tự động phát âm từ đáp án đúng khi hiển thị phân tích/đáp án câu TC
  if (question.correctWord) {
    playPronunciation(question.correctWord);
  }

  // Smooth scroll so explanation starts cleanly in view without clipping top or bottom
  setTimeout(() => {
    const mainStage = document.getElementById('main-stage');
    if (mainStage && container) {
      const targetScroll = container.offsetTop - 12;
      mainStage.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }, 50);
}

/**
 * Shows definition feedback and answer key for Flash Recall question.
 */
export function renderFlashFeedback({ question, isCorrect = false, onContinue }) {
  const container = document.getElementById('flash-feedback-placeholder');
  if (!container) return;

  const viewport = document.querySelector('.question-viewport');
  if (viewport) viewport.classList.add('has-rationale');

  const statusBadge = isCorrect
    ? `<span class="badge badge-green">Chính xác!</span>`
    : `<span class="badge badge-red">Chưa chính xác</span>`;

  container.innerHTML = `
    <div class="rationale-container animate-fade-in" style="margin-top: 12px;">
      <div class="rationale-header">
        <div class="rationale-title">
          ${ICONS.book}
          ${statusBadge}
          <span>Đáp án:</span>
          <span class="badge badge-green" style="margin-left: 6px;">${question.promptWord}</span>
        </div>
      </div>

      <div class="vocab-lookup-grid">
        <div class="vocab-lookup-item highlight-correct">
          <div class="lookup-word-row">
            <span class="lookup-word">${question.targetWord.word}</span>
            <button class="lookup-audio-btn" data-word="${question.targetWord.word}" title="Nghe phát âm: ${question.targetWord.word}">
              ${ICONS.audio}
            </button>
          </div>
          <span class="lookup-pos">${question.targetWord.pos}</span>
          <span class="lookup-vi">${question.targetWord.vi_gloss}</span>
          <span class="lookup-en">${(question.targetWord.definitions && question.targetWord.definitions[0]) || ''}</span>
        </div>
      </div>

      <div class="session-footer-bar">
        <button id="btn-flash-continue" class="btn-primary">
          Tiếp tục <span class="keycap" style="background: rgba(255,255,255,0.2); color: white; border-color: transparent;">Space</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-flash-continue')?.addEventListener('click', onContinue);
  container.querySelectorAll('.lookup-audio-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPronunciation(btn.dataset.word);
    });
  });

  setTimeout(() => {
    const mainStage = document.getElementById('main-stage');
    if (mainStage && container) {
      const targetScroll = container.offsetTop - 12;
      mainStage.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }, 50);
}

export const renderFlashMistakeFeedback = renderFlashFeedback;

/**
 * Renders the Session Summary screen.
 */
export function renderSessionSummary({ metrics, todaySessions = 0, onRestartSession, onReturnHome, onUnlockNextGroup }) {
  const stage = document.getElementById('main-stage');
  const progressHeader = document.getElementById('session-progress-header');
  if (progressHeader) progressHeader.style.display = 'none';

  const isAllDue = Boolean(metrics.isAllDueSession);

  stage.innerHTML = `
    <div class="summary-container animate-fade-in">
      <div class="summary-header">
        <div class="summary-title">${isAllDue ? 'Hoàn tất Tổng ôn tập tới hạn!' : 'Hoàn thành Phiên học!'}</div>
        <div class="summary-subtitle">
          ${
            isAllDue
              ? 'Tất cả các từ vựng đến hạn trên toàn bộ các Group đã được củng cố và kéo dài chu kỳ ghi nhớ SRS.'
              : `${todaySessions > 0 ? `Bạn đã hoàn thành <strong>${todaySessions} phiên</strong> hôm nay. ` : ''}Dữ liệu tiến độ SRS đã được tự động lưu vào bộ nhớ trình duyệt.`
          }
        </div>
      </div>

      <div class="summary-stats-grid">
        <div class="stat-card">
          <div class="stat-value" style="color: ${metrics.accuracy >= 80 ? 'var(--success-border)' : 'var(--text-title)'};">
            ${metrics.accuracy}%
          </div>
          <div class="stat-label">Độ chính xác</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">${metrics.avgResponseSec}s</div>
          <div class="stat-label">Tốc độ phản xạ</div>
        </div>

        <div class="stat-card">
          <div class="stat-value" style="color: var(--accent-color);">${metrics.promotedCount}</div>
          <div class="stat-label">Từ thăng cấp</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">${isAllDue ? `${metrics.correctCount}/${metrics.totalAnswered}` : `${metrics.groupMasteryPercent}%`}</div>
          <div class="stat-label">${isAllDue ? 'Từ tới hạn hoàn thành' : 'Tiến độ Group'}</div>
        </div>
      </div>

      ${
        metrics.canUnlockNext
          ? `
        <div style="background-color: var(--success-bg); border: 1px solid var(--success-border); border-radius: var(--radius-md); padding: 16px; text-align: center; margin-bottom: 24px;">
          <div style="font-weight: 700; color: var(--success-text); font-size: 15px; margin-bottom: 4px;">
            Đã mở khóa Group ${metrics.nextGroup}!
          </div>
          <div style="font-size: 13px; color: var(--success-text);">
            Bạn đã nạp toàn bộ 30 từ vựng trong Group này và sẵn sàng cho Group tiếp theo.
          </div>
          <button id="btn-unlock-next-group" class="btn-primary" style="margin-top: 12px; background-color: var(--success-border);">
            Chuyển sang Group ${metrics.nextGroup} ngay
          </button>
        </div>
      `
          : metrics.isAllCompleted
          ? `
        <div style="background-color: var(--success-bg); border: 1px solid var(--success-border); border-radius: var(--radius-md); padding: 16px; text-align: center; margin-bottom: 24px;">
          <div style="font-weight: 700; color: var(--success-text); font-size: 16px; margin-bottom: 4px;">
            Chúc mừng! Bạn đã hoàn thành toàn bộ 32 Groups!
          </div>
          <div style="font-size: 13px; color: var(--success-text);">
            Bạn đã thành thạo toàn bộ 960 từ vựng GRE cốt lõi. Hãy tiếp tục duy trì chu kỳ ôn tập hàng ngày!
          </div>
        </div>
      `
          : ''
      }

      <div class="summary-actions">
        <button id="btn-summary-home" class="btn-secondary">
          Quay lại Danh sách Từ
        </button>
        <button id="btn-summary-restart" class="btn-primary">
          ${ICONS.arrowRight} ${isAllDue ? 'Tiếp tục Ôn tập' : 'Luyện tiếp phiên mới'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-summary-home')?.addEventListener('click', onReturnHome);
  document.getElementById('btn-summary-restart')?.addEventListener('click', onRestartSession);
  document.getElementById('btn-unlock-next-group')?.addEventListener('click', onUnlockNextGroup);
}

/**
 * Displays a non-intrusive floating toast notification.
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type} animate-fade-in`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3200);
}
