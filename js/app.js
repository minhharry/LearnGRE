/**
 * Application Entry Point & Global Orchestrator
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

import {
  loadProgressData,
  saveProgressData,
  ensureWordRecord,
  isBackupDue,
  exportProgressJson,
  importProgressJson,
} from './storage.js';
import { evaluateWordAnswer } from './srs.js';
import { SessionManager } from './session.js';
import {
  playPronunciation,
  renderTopBar,
  renderSidebarGroups,
  renderGroupDashboard,
  renderErrorNotebook,
  renderSessionProgressHeader,
  updateProgressSegment,
  applyStreakAccent,
  renderSpeedMatchQuestion,
  renderFlashRecallQuestion,
  renderTcQuestion,
  renderTcRationale,
  renderFlashFeedback,
  renderFlashMistakeFeedback,
  renderSessionSummary,
  renderThemeButton,
} from './ui.js';

class AppController {
  constructor() {
    this.vocabList = [];
    this.questionTemplates = [];
    this.storageData = loadProgressData();
    this.currentGroup = this.storageData.progression.current_group || 1;
    this.activeSession = null;
    this.currentQuestionState = null;
    this.currentView = 'dashboard'; // 'dashboard' | 'session' | 'errors'
    this.questionStartTime = 0;
    this.isWaitingForContinue = false;
  }

  async init() {
    this.bindGlobalEvents();
    this.bindSplitResizer();
    this.applySidebarWidth();

    // Apply stored theme (default to dark theme modeled after VS Code)
    const initialTheme = this.storageData.ui_prefs.theme || 'dark';
    this.applyTheme(initialTheme);

    // Apply initial streak accent color
    applyStreakAccent(this.storageData.progression.daily_streak || 1);

    // Check backup due status
    renderTopBar(this.storageData, isBackupDue(this.storageData.last_backup));

    // Load Data
    await this.loadDataFiles();

    // Render initial view
    this.renderSidebar();
    this.renderCurrentView();
  }

  /**
   * Loads vocab.jsonl and question_templates.jsonl asynchronously.
   */
  async loadDataFiles() {
    try {
      const [vocabRes, questionsRes] = await Promise.all([
        fetch('data/vocab.jsonl'),
        fetch('data/question_templates.jsonl'),
      ]);

      if (!vocabRes.ok || !questionsRes.ok) {
        throw new Error('Data files could not be loaded over network.');
      }

      const vocabText = await vocabRes.text();
      const questionsText = await questionsRes.text();

      this.vocabList = vocabText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));

      this.questionTemplates = questionsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch (err) {
      console.warn('Network fetch error (likely running under file:// or offline):', err);
      // Fallback notification in stage if completely empty
      const stage = document.getElementById('main-stage');
      if (stage && this.vocabList.length === 0) {
        stage.innerHTML = `
          <div style="padding: 40px; max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
            <h2 style="margin-bottom: 12px;">Đang tải dữ liệu từ vựng...</h2>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px;">
              Nếu bạn đang mở file trực tiếp bằng giao thức file://, trình duyệt có thể chặn fetch.
              Hãy chạy máy chủ tĩnh cục bộ (ví dụ: <code>npx serve</code> hoặc <code>python -m http.server</code>).
            </p>
          </div>
        `;
      }
    }
  }

  renderSidebar(searchQuery = '') {
    renderSidebarGroups({
      vocabList: this.vocabList,
      storageData: this.storageData,
      currentGroup: this.currentGroup,
      searchQuery,
      onSelectGroup: (g) => {
        this.currentGroup = g;
        this.storageData.progression.current_group = g;
        saveProgressData(this.storageData);
        this.currentView = 'dashboard';
        this.renderSidebar();
        this.renderCurrentView();
        this.closeDrawer();
      },
    });

    renderTopBar(this.storageData, isBackupDue(this.storageData.last_backup));
  }

  renderCurrentView() {
    const progressHeader = document.getElementById('session-progress-header');
    if (progressHeader && this.currentView !== 'session') {
      progressHeader.style.display = 'none';
    }
    document.body.classList.toggle('in-session', this.currentView === 'session');

    const navAll = document.getElementById('nav-all-groups');
    const navErr = document.getElementById('nav-error-notebook');
    if (navAll && navErr) {
      if (this.currentView === 'errors') {
        navErr.classList.add('active');
        navAll.classList.remove('active');
      } else {
        navAll.classList.add('active');
        navErr.classList.remove('active');
      }
    }

    if (this.currentView === 'dashboard') {
      renderGroupDashboard({
        group: this.currentGroup,
        vocabList: this.vocabList,
        storageData: this.storageData,
        onStartSession: () => this.startSession('standard'),
        onStartSpeedMatch: () => this.startSession('speed_match_only'),
        onToggleFlag: (wordId) => this.toggleWordFlag(wordId),
      });
    } else if (this.currentView === 'errors') {
      renderErrorNotebook({
        vocabList: this.vocabList,
        storageData: this.storageData,
        onStartErrorSession: () => this.startSession('errors'),
        onToggleFlag: (wordId) => this.toggleWordFlag(wordId),
      });
    }
  }

  toggleWordFlag(wordId) {
    const rec = ensureWordRecord(this.storageData, wordId);
    rec.flagged_error = !rec.flagged_error;
    saveProgressData(this.storageData);
    this.renderSidebar();
    this.renderCurrentView();
  }

  /**
   * Starts a new practice session.
   */
  startSession(mode = 'standard') {
    this.currentView = 'session';
    document.body.classList.add('in-session');
    this.activeSession = new SessionManager({
      group: this.currentGroup,
      vocabList: this.vocabList,
      questionTemplates: this.questionTemplates,
      storageData: this.storageData,
      mode,
    });

    this.advanceToNextQuestion();
  }

  /**
   * Advances session queue to next question.
   */
  advanceToNextQuestion() {
    this.isWaitingForContinue = false;
    const { question, isRedemption, done } = this.activeSession.nextQuestion();

    if (done) {
      // Session finished! Render summary
      const metrics = this.activeSession.getSummaryMetrics();
      if (metrics.canUnlockNext && metrics.nextGroup && metrics.nextGroup <= 32) {
        const nextG = metrics.nextGroup;
        if (!this.storageData.progression.unlocked_groups.includes(nextG)) {
          this.storageData.progression.unlocked_groups.push(nextG);
          saveProgressData(this.storageData);
        }
      }

      renderSessionSummary({
        metrics,
        onRestartSession: () => this.startSession('standard'),
        onReturnHome: () => {
          this.currentView = 'dashboard';
          document.body.classList.remove('in-session');
          this.renderSidebar();
          this.renderCurrentView();
        },
        onUnlockNextGroup: () => {
          if (metrics.nextGroup && metrics.nextGroup <= 32) {
            this.currentGroup = metrics.nextGroup;
            this.storageData.progression.current_group = this.currentGroup;
            saveProgressData(this.storageData);
            this.currentView = 'dashboard';
            document.body.classList.remove('in-session');
            this.renderSidebar();
            this.renderCurrentView();
          }
        },
      });
      return;
    }

    this.currentQuestionState = question;
    this.questionStartTime = Date.now();

    const stats = this.activeSession.getProgressStats();
    renderSessionProgressHeader({
      current: stats.current,
      total: stats.total,
      isRedemption,
      streak: this.storageData.progression.daily_streak || 1,
      results: this.activeSession.results,
    });

    document.getElementById('btn-exit-session')?.addEventListener('click', () => {
      this.currentView = 'dashboard';
      document.body.classList.remove('in-session');
      this.renderSidebar();
      this.renderCurrentView();
    });

    const isFlagged = question.targetWord
      ? (this.storageData.words[question.targetWord.id] || {}).flagged_error
      : false;

    if (question.type === 'SPEED_MATCH') {
      renderSpeedMatchQuestion({
        question,
        onPairMatched: (wordId) => {
          // Play subtle sound or telemetry
        },
        onPairFailed: () => {
          // Failure telemetry
        },
        onComplete: () => {
          const elapsed = Date.now() - this.questionStartTime;
          updateProgressSegment(this.activeSession.currentIndex, true);
          this.activeSession.recordResult({
            questionType: 'SPEED_MATCH',
            targetId: question.targetId,
            isCorrect: true,
            reaction: 'fluent',
            elapsedMs: elapsed,
          });
          this.advanceToNextQuestion();
        },
      });
    } else if (question.type === 'FLASH') {
      renderFlashRecallQuestion({
        question,
        isFlagged,
        onToggleFlag: () => this.toggleCurrentQuestionWordFlag(),
        onSelectOption: ({ isCorrect }) => {
          const elapsed = Date.now() - this.questionStartTime;
          this.handleQuestionAnswer({
            isCorrect,
            responseTimeMs: elapsed,
            questionType: 'FLASH',
            sentenceText: '',
          });

          // Always show answer key and feedback even if right
          this.isWaitingForContinue = true;
          renderFlashFeedback({
            question,
            isCorrect,
            onContinue: () => this.advanceToNextQuestion(),
          });
        },
      });
    } else if (question.type === 'TC') {
      renderTcQuestion({
        question,
        isFlagged,
        onToggleFlag: () => this.toggleCurrentQuestionWordFlag(),
        onSelectOption: ({ isCorrect }) => {
          const elapsed = Date.now() - this.questionStartTime;
          this.handleQuestionAnswer({
            isCorrect,
            responseTimeMs: elapsed,
            questionType: 'TC',
            sentenceText: question.sentence,
          });

          this.isWaitingForContinue = true;
          renderTcRationale({
            question,
            isCorrect,
            onContinue: () => this.advanceToNextQuestion(),
          });
        },
      });
    }
  }

  toggleCurrentQuestionWordFlag() {
    if (!this.currentQuestionState || !this.currentQuestionState.targetWord) return;
    const wId = this.currentQuestionState.targetWord.id;
    this.toggleWordFlag(wId);

    // Re-render flag state on button
    const flagBtn = document.querySelector('.question-card-actions .action-chip-btn.flagged, .question-card-actions .action-chip-btn');
    if (flagBtn) {
      const rec = this.storageData.words[wId] || {};
      if (rec.flagged_error) {
        flagBtn.classList.add('flagged');
        flagBtn.querySelector('span').textContent = 'Đã ghim (S)';
      } else {
        flagBtn.classList.remove('flagged');
        flagBtn.querySelector('span').textContent = 'Ghim (S)';
      }
    }
  }

  /**
   * Processes evaluation per SRS state machine and checkpoints immediately to localStorage.
   */
  handleQuestionAnswer({ isCorrect, responseTimeMs, questionType, sentenceText }) {
    const word = this.currentQuestionState.targetWord;
    if (!word) return;

    const wordRec = ensureWordRecord(this.storageData, word.id);
    const hasBeenPromoted = this.activeSession.promotedWordIds.has(word.id);

    const { updatedRecord, reaction, levelPromoted, retestNeeded } = evaluateWordAnswer(
      wordRec,
      isCorrect,
      responseTimeMs,
      questionType,
      sentenceText,
      wordRec.level === 0,
      hasBeenPromoted
    );

    this.storageData.words[word.id] = updatedRecord;

    if (levelPromoted) {
      this.activeSession.promotedWordIds.add(word.id);
    }

    if (retestNeeded) {
      this.activeSession.queueRedemption(word);
    }

    // Update visual progress segment immediately
    updateProgressSegment(this.activeSession.currentIndex, isCorrect);

    this.activeSession.recordResult({
      questionType,
      targetId: word.id,
      isCorrect,
      reaction,
      elapsedMs: responseTimeMs,
    });

    // Per-Question Checkpoint Persistence
    saveProgressData(this.storageData);
    renderTopBar(this.storageData, isBackupDue(this.storageData.last_backup));
  }

  /**
   * Binds Unified Mouseless Keyboard Navigation.
   */
  bindGlobalEvents() {
    // Mode Switcher buttons
    document.getElementById('mode-guided-btn')?.addEventListener('click', () => {
      this.storageData.ui_prefs.study_mode = 'guided';
      saveProgressData(this.storageData);
      this.renderSidebar();
    });

    document.getElementById('mode-cram-btn')?.addEventListener('click', () => {
      this.storageData.ui_prefs.study_mode = 'cram';
      saveProgressData(this.storageData);
      this.renderSidebar();
    });

    // Brand Logo Button
    document.getElementById('brand-home-btn')?.addEventListener('click', () => {
      this.currentView = 'dashboard';
      this.renderCurrentView();
      this.closeDrawer();
    });

    // Nav Item: All Groups
    document.getElementById('nav-all-groups')?.addEventListener('click', () => {
      this.currentView = 'dashboard';
      this.renderCurrentView();
      this.closeDrawer();
    });

    // Nav Item: Error Notebook
    document.getElementById('nav-error-notebook')?.addEventListener('click', () => {
      this.currentView = 'errors';
      this.renderCurrentView();
      this.closeDrawer();
    });

    // Search bar in sidebar
    const searchInput = document.getElementById('sidebar-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.renderSidebar(e.target.value);
    });

    // Theme Toggle Button (VS Code Dark / Light)
    document.getElementById('topbar-theme-btn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
    });

    // Modals
    const shortcutsModal = document.getElementById('shortcuts-modal');
    const backupModal = document.getElementById('backup-modal');

    document.getElementById('topbar-shortcuts-btn')?.addEventListener('click', () => {
      shortcutsModal.classList.add('active');
    });

    document.getElementById('topbar-backup-btn')?.addEventListener('click', () => {
      backupModal.classList.add('active');
    });

    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        shortcutsModal.classList.remove('active');
        backupModal.classList.remove('active');
      });
    });

    // Backup Export / Import
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      exportProgressJson(this.storageData);
      renderTopBar(this.storageData, false);
      backupModal.classList.remove('active');
    });

    const fileInput = document.getElementById('import-file-input');
    document.getElementById('btn-trigger-import')?.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const res = importProgressJson(evt.target.result);
        if (res.success) {
          this.storageData = res.data;
          this.renderSidebar();
          this.renderCurrentView();
          backupModal.classList.remove('active');
          alert('Khôi phục dữ liệu tiến độ thành công!');
        } else {
          alert('Lỗi định dạng file: ' + res.error);
        }
      };
      reader.readAsText(file);
    });

    // Responsive Drawer Toggle
    const drawerToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    drawerToggleBtn?.addEventListener('click', () => {
      sidebar.classList.toggle('drawer-open');
      backdrop.classList.toggle('active');
    });

    backdrop?.addEventListener('click', () => {
      this.closeDrawer();
    });

    // Global Keyboard Handler
    window.addEventListener('keydown', (e) => {
      // Don't intercept if typing in search input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // Escape key: close modal or exit session
      if (e.key === 'Escape') {
        if (shortcutsModal.classList.contains('active') || backupModal.classList.contains('active')) {
          shortcutsModal.classList.remove('active');
          backupModal.classList.remove('active');
          return;
        }
        if (this.currentView === 'session') {
          this.currentView = 'dashboard';
          this.renderSidebar();
          this.renderCurrentView();
          return;
        }
      }

      // Help key '?'
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        shortcutsModal.classList.toggle('active');
        return;
      }

      // If in active session
      if (this.currentView === 'session') {
        const q = this.currentQuestionState;
        if (!q) return;

        // If waiting for continue (Space / Enter)
        if (this.isWaitingForContinue) {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.advanceToNextQuestion();
          }
          return;
        }

        // Key P: Pronunciation
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          const word = q.targetWord ? q.targetWord.word : q.promptWord || q.correctWord;
          playPronunciation(word);
          return;
        }

        // Key S: Toggle Flag in Error Notebook
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          this.toggleCurrentQuestionWordFlag();
          return;
        }

        // Keys 1 - 4
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          if (q.type === 'SPEED_MATCH') {
            if (window.__speedMatchTrigger) window.__speedMatchTrigger(e.key);
          } else {
            if (window.__choiceOptionTrigger) window.__choiceOptionTrigger(e.key);
          }
          return;
        }

        // Keys Q, W, E, R (Speed Match right column)
        if (q.type === 'SPEED_MATCH' && ['q', 'w', 'e', 'r', 'Q', 'W', 'E', 'R'].includes(e.key)) {
          e.preventDefault();
          if (window.__speedMatchTrigger) window.__speedMatchTrigger(e.key.toUpperCase());
          return;
        }
      }
    });
  }

  closeDrawer() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('drawer-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  /**
   * Draggable split-pane width resizer with bounds and local persistence.
   */
  bindSplitResizer() {
    const handle = document.getElementById('split-handle');
    const sidebar = document.getElementById('sidebar');
    if (!handle || !sidebar) return;

    let isDragging = false;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const newWidth = Math.min(Math.max(e.clientX, 260), 460);
      sidebar.style.width = `${newWidth}px`;
      this.storageData.ui_prefs.sidebar_width = newWidth;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveProgressData(this.storageData);
      }
    });
  }

  applySidebarWidth() {
    const sidebar = document.getElementById('sidebar');
    const width = this.storageData.ui_prefs.sidebar_width || 320;
    if (sidebar) {
      sidebar.style.width = `${width}px`;
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.storageData.ui_prefs.theme = theme;
    saveProgressData(this.storageData);
    renderThemeButton(theme);
  }
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
