/**
 * UI Module: DOM Rendering, Zero-Click Instant Feedback,
 * Web Speech Audio Pronunciation, and Modals.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

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
    const isActive = g === currentGroup;

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
          <span>${groupWords.length}/30 từ</span>
          <span>${masteredCount} thành thạo</span>
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
}) {
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

  stage.innerHTML = `
    <div class="dashboard-container animate-fade-in">
      <div class="dashboard-header">
        <div class="dashboard-title-group">
          <h1>Group ${group} Vocabulary</h1>
          <p>30 từ vựng học thuật chuẩn GRE - Tiến độ thành thạo: <strong>${masteryPercent}%</strong> (${masteredCount}/${groupWords.length} từ L3-L4)</p>
        </div>
        <div class="dashboard-actions">
          <button id="btn-start-speed-drill" class="btn-secondary">
            Luyện Speed Match
          </button>
          <button id="btn-start-adaptive" class="btn-primary">
            ${ICONS.arrowRight} Bắt đầu Phiên học
          </button>
        </div>
      </div>

      <div class="word-table-container">
        <table class="word-table">
          <thead>
            <tr>
              <th style="width: 25%;">Từ vựng</th>
              <th style="width: 10%;">Từ loại</th>
              <th style="width: 35%;">Nghĩa tiếng Việt</th>
              <th style="width: 15%;">Cấp độ SRS</th>
              <th style="width: 15%; text-align: right;">Thao tác</th>
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
                      <span>${w.word}</span>
                      <button class="icon-btn audio-btn" data-word="${w.word}" title="Phát âm (P)">
                        ${ICONS.audio}
                      </button>
                    </div>
                  </td>
                  <td><span class="badge badge-muted">${w.pos}</span></td>
                  <td><span style="font-weight: 500; color: var(--text-body);">${w.vi_gloss || (w.definitions && w.definitions[0]) || ''}</span></td>
                  <td>
                    <span class="level-pill level-pill-${lvl}">
                      Level ${lvl}
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

  // Bind Buttons
  document.getElementById('btn-start-adaptive')?.addEventListener('click', onStartSession);
  document.getElementById('btn-start-speed-drill')?.addEventListener('click', onStartSpeedMatch);

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
        <div style="text-align: center; padding: 60px 20px; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
          <div style="font-size: 16px; font-weight: 600; color: var(--text-title); margin-bottom: 8px;">Không có từ nào trong Sổ tay Câu sai!</div>
          <div style="font-size: 14px; color: var(--text-muted);">Các từ chọn sai hoặc bấm phím 'S' trong phiên học sẽ tự động được lưu vào đây.</div>
        </div>
      `
          : `
        <div class="word-table-container">
          <table class="word-table">
            <thead>
              <tr>
                <th>Từ vựng</th>
                <th>Group</th>
                <th>Từ loại</th>
                <th>Nghĩa tiếng Việt</th>
                <th>Số lần sai</th>
                <th style="text-align: right;">Gỡ ghim</th>
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
                        <span>${w.word}</span>
                        <button class="icon-btn audio-btn" data-word="${w.word}">
                          ${ICONS.audio}
                        </button>
                      </div>
                    </td>
                    <td>Group ${w.group}</td>
                    <td><span class="badge badge-muted">${w.pos}</span></td>
                    <td>${w.vi_gloss || (w.definitions && w.definitions[0]) || ''}</td>
                    <td><span class="badge badge-red">${rec.mistake_count || 1} lần</span></td>
                    <td style="text-align: right;">
                      <button class="action-chip-btn flag-btn flagged" data-id="${w.id}">
                        ${ICONS.close} Bỏ ghim
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
export function renderSessionProgressHeader({ current, total, isRedemption, streak, results = [], theme = 'dark' }) {
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
              <div class="speed-match-card" data-side="left" data-id="${w.id}" data-key="${w.keycap}">
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
      // Correct Match
      selectedLeft.classList.remove('selected');
      selectedRight.classList.remove('selected');
      selectedLeft.classList.add('matched');
      selectedRight.classList.add('matched');

      matchedCount++;
      onPairMatched(leftId);

      selectedLeft = null;
      selectedRight = null;

      if (matchedCount >= question.pairs.length) {
        // Complete Speed Match: Auto-advance after 350ms
        setTimeout(() => {
          onComplete();
        }, 350);
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
      if (card.classList.contains('matched')) return;
      const side = card.dataset.side;

      if (side === 'left') {
        if (selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = card;
        card.classList.add('selected');
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
    const card = stage.querySelector(`.speed-match-card[data-key="${k}"]:not(.matched)`);
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
          <span class="question-domain-tag">Flash Recall</span>
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
          <span class="question-domain-tag">${question.domain}</span>
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
export function renderSessionSummary({ metrics, onRestartSession, onReturnHome, onUnlockNextGroup }) {
  const stage = document.getElementById('main-stage');
  const progressHeader = document.getElementById('session-progress-header');
  if (progressHeader) progressHeader.style.display = 'none';

  stage.innerHTML = `
    <div class="summary-container animate-fade-in">
      <div class="summary-header">
        <div class="summary-title">Hoàn thành Phiên học!</div>
        <div class="summary-subtitle">Dữ liệu tiến độ SRS đã được tự động lưu vào bộ nhớ trình duyệt.</div>
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
          <div class="stat-value">${metrics.groupMasteryPercent}%</div>
          <div class="stat-label">Tiến độ Group</div>
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
            Bạn đã đạt trên 85% từ vựng Level 3 trở lên trong Group hiện tại.
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
          ${ICONS.arrowRight} Luyện tiếp phiên mới
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-summary-home')?.addEventListener('click', onReturnHome);
  document.getElementById('btn-summary-restart')?.addEventListener('click', onRestartSession);
  document.getElementById('btn-unlock-next-group')?.addEventListener('click', onUnlockNextGroup);
}
