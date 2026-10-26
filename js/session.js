/**
 * Session Module: Adaptive Session Generator, Speed Match, Flash Recall,
 * Text Completion Coordination, and Redemption Loop.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

import { selectFlashDistractors, shuffleArray } from './distractor.js';
import { ensureWordRecord, getDueWordsAcrossAllGroups } from './storage.js';

export class SessionManager {
  /**
   * @param {Object} options
   * @param {number} options.group - Target group number.
   * @param {Array<Object>} options.vocabList - All vocab items.
   * @param {Array<Object>} options.questionTemplates - Pre-generated TC templates.
   * @param {Object} options.storageData - User's stored progress.
   * @param {string} [options.mode='standard'] - 'standard' | 'errors' | 'speed_match_only' | 'all_due'.
   */
  constructor({ group, vocabList, questionTemplates, storageData, mode = 'standard' }) {
    this.group = group;
    this.allVocab = vocabList;
    this.allQuestions = questionTemplates;
    this.storageData = storageData;
    this.mode = mode;

    this.vocabById = new Map(vocabList.map((w) => [w.id, w]));
    this.vocabByWord = new Map(vocabList.map((w) => [w.word.toLowerCase(), w]));
    this.questionsByTargetId = new Map();
    for (const q of questionTemplates) {
      if (!this.questionsByTargetId.has(q.target_id)) {
        this.questionsByTargetId.set(q.target_id, []);
      }
      this.questionsByTargetId.get(q.target_id).push(q);
    }

    this.queue = [];
    this.redemptionQueue = [];
    this.currentIndex = -1;
    this.currentQuestion = null;

    // Session Telemetry & Tracking
    this.promotedWordIds = new Set();
    this.sessionStartTime = Date.now();
    this.results = []; // { questionType, wordId, isCorrect, reaction, elapsedMs }

    // Words with Level 0 that need introduction before session drills
    this.newWords = [];

    this.buildSessionQueue();
  }

  /**
   * Builds the adaptive question queue according to SPEC.md section 5.2.
   */
  buildSessionQueue() {
    this.queue = [];
    const nowIso = new Date().toISOString();
    const groupWords = this.allVocab.filter((w) => w.group === this.group);

    // If 'all_due' mode: focus on all words due for SRS review across all groups
    if (this.mode === 'all_due') {
      const dueWords = getDueWordsAcrossAllGroups(this.allVocab, this.storageData);
      const selectedWords = dueWords.length > 0 ? shuffleArray(dueWords) : groupWords.slice(0, 8);

      // Warm-up: 1 Speed Match (4 pairs) if >= 4 words
      if (selectedWords.length >= 4) {
        this.queue.push(this.createSpeedMatchQuestion(selectedWords.slice(0, 4)));
      }

      // Core: Interleaved TC and Flash Recall for ALL due words
      for (let i = 0; i < selectedWords.length; i++) {
        const word = selectedWords[i];
        const hasTc = this.questionsByTargetId.has(word.id);
        if (hasTc && (i % 2 === 0 || selectedWords.length < 6)) {
          this.queue.push(this.createTcQuestion(word));
        } else {
          this.queue.push(this.createFlashRecallQuestion(word));
        }
      }
      return;
    }

    // If specific 'errors' mode, practice flagged words
    if (this.mode === 'errors') {
      const flaggedWords = this.allVocab.filter((w) => {
        const rec = this.storageData.words[w.id];
        return rec && rec.flagged_error;
      });

      const selected = flaggedWords.length > 0 ? flaggedWords : groupWords.slice(0, 8);
      for (const word of selected) {
        this.queue.push(this.createQuestionForWord(word));
      }
      return;
    }

    // Partition words into SRS priority pools:
    // 1. Current group words: divided into review, active learning, and new words
    const reviewPool = [];
    const learningPool = [];
    const newWordsPool = [];

    for (const word of groupWords) {
      const rec = ensureWordRecord(this.storageData, word.id);
      if (rec.flagged_error || (rec.next_review && rec.next_review <= nowIso)) {
        reviewPool.push(word);
      } else if (rec.level === 1 || rec.level === 2) {
        learningPool.push(word);
      } else if (rec.level === 0) {
        newWordsPool.push(word);
      }
      // Level 3 and 4 words not yet due remain resting in their SRS cycle
    }

    // 2. Prior groups words (w.group < this.group): collect words that are due for review or flagged
    const priorReviewPool = [];
    if (this.group > 1) {
      const priorWords = this.allVocab.filter((w) => w.group < this.group);
      for (const word of priorWords) {
        const rec = this.storageData.words[word.id];
        if (rec && (rec.flagged_error || (rec.next_review && rec.next_review <= nowIso))) {
          priorReviewPool.push(word);
        }
      }
    }

    // Determine target words for this session (~10 - 14 items)
    const targetWords = [];

    // 1. High priority: Review pool
    // Prioritize current group review words (up to 3-4), then include due review words from prior groups
    const shuffledCurrentReviews = shuffleArray(reviewPool);
    const shuffledPriorReviews = shuffleArray(priorReviewPool);

    // Pick up to 3 from current group reviews
    targetWords.push(...shuffledCurrentReviews.slice(0, 3));

    // Pick due review words from prior groups (up to 3) to prevent forgetting earlier groups
    const remainingForPriorReview = Math.min(3, 5 - targetWords.length);
    if (remainingForPriorReview > 0) {
      targetWords.push(...shuffledPriorReviews.slice(0, remainingForPriorReview));
    }

    // If still room in review allocation (max 5), fill with remaining current group reviews or prior reviews
    if (targetWords.length < 5) {
      const extraCurrent = shuffledCurrentReviews.slice(3);
      const remainingSlots = 5 - targetWords.length;
      targetWords.push(...extraCurrent.slice(0, remainingSlots));
    }
    if (targetWords.length < 5) {
      const extraPrior = shuffledPriorReviews.slice(remainingForPriorReview);
      const remainingSlots = 5 - targetWords.length;
      targetWords.push(...extraPrior.slice(0, remainingSlots));
    }

    // 2. New words pool from current group (prioritized to introduce unseen words in group)
    const remainingForNew = Math.min(newWordsPool.length, 12 - targetWords.length);
    if (remainingForNew > 0) {
      targetWords.push(...shuffleArray(newWordsPool).slice(0, remainingForNew));
    }

    // 3. Active learning drill from current group (words not yet due for formal review)
    const remainingForLearning = 12 - targetWords.length;
    if (remainingForLearning > 0) {
      targetWords.push(...shuffleArray(learningPool).slice(0, remainingForLearning));
    }

    // Fallback if targetWords is small: pick any from group
    if (targetWords.length < 4) {
      targetWords.push(...shuffleArray(groupWords).slice(0, 6));
    }

    // Collect new words (Level 0) present in this session for pre-session flashcard intro
    const seenNewWordIds = new Set();
    this.newWords = [];
    for (const w of targetWords) {
      const rec = this.storageData.words[w.id];
      const isNew = !rec || rec.level === 0;
      if (isNew && !seenNewWordIds.has(w.id)) {
        seenNewWordIds.add(w.id);
        this.newWords.push(w);
      }
    }

    // Mode: Speed Match Only
    if (this.mode === 'speed_match_only') {
      const pool = targetWords.length >= 4 ? targetWords : groupWords;
      const chunks = Math.min(3, Math.floor(pool.length / 4));
      for (let i = 0; i < chunks; i++) {
        const slice = pool.slice(i * 4, (i + 1) * 4);
        this.queue.push(this.createSpeedMatchQuestion(slice));
      }
      return;
    }

    // Warm-up: 1 Speed Match (4 pairs) if >= 4 words available
    if (targetWords.length >= 4) {
      const warmUpWords = targetWords.slice(0, 4);
      this.queue.push(this.createSpeedMatchQuestion(warmUpWords));
    }

    // Core: Interleaved TC and Flash Recall
    for (let i = 0; i < targetWords.length; i++) {
      const word = targetWords[i];
      // Alternate between TC and Flash Recall based on availability of TC template
      const hasTc = this.questionsByTargetId.has(word.id);
      if (hasTc && (i % 2 === 0 || targetWords.length < 6)) {
        this.queue.push(this.createTcQuestion(word));
      } else {
        this.queue.push(this.createFlashRecallQuestion(word));
      }
    }
  }

  /**
   * Creates a Speed Match question with 4 word-definition pairs.
   */
  createSpeedMatchQuestion(fourWords) {
    const pairs = fourWords.map((item) => ({
      id: item.id,
      word: item.word,
      definition: item.vi_gloss || (item.definitions && item.definitions[0]) || item.word,
      matched: false,
    }));

    // Randomize word order and definition order independently
    const leftWords = shuffleArray(
      pairs.map((p) => ({ id: p.id, text: p.word }))
    ).map((w, idx) => ({ ...w, keycap: String(idx + 1) }));

    const defKeycaps = ['Q', 'W', 'E', 'R'];
    const rightDefs = shuffleArray(
      pairs.map((p) => ({ id: p.id, text: p.definition }))
    ).map((d, idx) => ({ ...d, keycap: defKeycaps[idx] }));

    return {
      type: 'SPEED_MATCH',
      targetId: 'speed_match_' + Date.now(),
      targetWord: null,
      pairs,
      leftWords,
      rightDefs,
      totalPairs: pairs.length,
      matchedPairsCount: 0,
    };
  }

  /**
   * Creates a Flash Recall question for a target word.
   */
  createFlashRecallQuestion(targetWord) {
    const distractors = selectFlashDistractors(targetWord, this.allVocab);
    const options = [
      {
        id: targetWord.id,
        word: targetWord.word,
        text: targetWord.vi_gloss || (targetWord.definitions && targetWord.definitions[0]) || '',
        isCorrect: true,
        pos: targetWord.pos,
        vi_gloss: targetWord.vi_gloss || '',
        definition: (targetWord.definitions && targetWord.definitions[0]) || '',
      },
      ...distractors.map((d) => ({
        id: d.id,
        word: d.word,
        text: d.vi_gloss || (d.definitions && d.definitions[0]) || '',
        isCorrect: false,
        pos: d.pos,
        vi_gloss: d.vi_gloss || '',
        definition: (d.definitions && d.definitions[0]) || '',
      })),
    ];

    const shuffled = shuffleArray(options).map((opt, index) => ({
      ...opt,
      keycap: String(index + 1),
    }));

    return {
      type: 'FLASH',
      targetId: targetWord.id,
      targetWord,
      options: shuffled,
      promptWord: targetWord.word,
      pos: targetWord.pos,
    };
  }

  /**
   * Creates a Text Completion (TC) question for a target word.
   */
  createTcQuestion(targetWord) {
    const templates = this.questionsByTargetId.get(targetWord.id) || [];
    if (templates.length === 0) {
      return this.createFlashRecallQuestion(targetWord);
    }

    // Pick a random template variant
    const tpl = templates[Math.floor(Math.random() * templates.length)];

    // Build the 4 options: 1 correct + 3 distractors
    const rawOptions = [
      {
        word: tpl.correct_answer,
        isCorrect: true,
      },
      ...(tpl.distractors || []).map((dWord) => ({
        word: dWord,
        isCorrect: false,
      })),
    ];

    // Enrich options with definitions from vocab dictionary
    const enrichedOptions = rawOptions.map((opt) => {
      const vocabEntry = this.vocabByWord.get(opt.word.toLowerCase());
      return {
        ...opt,
        pos: vocabEntry ? vocabEntry.pos : tpl.pos_required || '',
        vi_gloss: vocabEntry ? vocabEntry.vi_gloss : '',
        definition: vocabEntry && vocabEntry.definitions ? vocabEntry.definitions[0] : '',
      };
    });

    const shuffled = shuffleArray(enrichedOptions).map((opt, index) => ({
      ...opt,
      keycap: String(index + 1),
    }));

    return {
      type: 'TC',
      targetId: targetWord.id,
      targetWord,
      template: tpl,
      sentence: tpl.sentence,
      clue: tpl.clue,
      domain: tpl.domain || 'GRE Verbal',
      rationale: tpl.rationale,
      correctWord: tpl.correct_answer,
      options: shuffled,
    };
  }

  /**
   * Helper to create best question for a word.
   */
  createQuestionForWord(word) {
    if (this.questionsByTargetId.has(word.id)) {
      return this.createTcQuestion(word);
    }
    return this.createFlashRecallQuestion(word);
  }

  /**
   * Pushes word to redemption queue to re-test at session end.
   */
  queueRedemption(word) {
    if (!word) return;
    // Check if not already in redemption
    const exists = this.redemptionQueue.some((q) => q.targetId === word.id);
    if (!exists) {
      // Pick a different question or flash recall
      this.redemptionQueue.push(this.createFlashRecallQuestion(word));
    }
  }

  /**
   * Returns next question from queue or redemption loop.
   */
  nextQuestion() {
    this.currentIndex++;
    if (this.currentIndex < this.queue.length) {
      this.currentQuestion = this.queue[this.currentIndex];
      return { question: this.currentQuestion, isRedemption: false, done: false };
    }

    // Primary queue completed, check redemption queue
    if (this.redemptionQueue.length > 0) {
      this.currentQuestion = this.redemptionQueue.shift();
      return { question: this.currentQuestion, isRedemption: true, done: false };
    }

    this.currentQuestion = null;
    return { question: null, isRedemption: false, done: true };
  }

  /**
   * Total questions in this session including redemption.
   */
  getProgressStats() {
    const total = Math.max(this.queue.length, this.currentIndex + 1 + this.redemptionQueue.length);
    const current = Math.min(this.currentIndex + 1, total);
    return {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    };
  }

  /**
   * Records question result telemetry.
   */
  recordResult({ questionType, targetId, isCorrect, reaction, elapsedMs }) {
    this.results.push({
      questionType,
      targetId,
      isCorrect,
      reaction,
      elapsedMs,
    });
  }

  /**
   * Computes final session summary metrics.
   */
  getSummaryMetrics() {
    const totalAnswered = this.results.length;
    const correctCount = this.results.filter((r) => r.isCorrect).length;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    const totalMs = this.results.reduce((acc, r) => acc + r.elapsedMs, 0);
    const avgResponseSec = totalAnswered > 0 ? (totalMs / totalAnswered / 1000).toFixed(1) : 0;

    // Check if group unlock condition is met:
    // Progressive syllabus: Unlock next group when all 30 words in current group have been introduced (level0 === 0)
    // Mastery milestone: >= 85% of words in current group at Level >= 3
    const groupWords = this.allVocab.filter((w) => w.group === this.group);
    let level3Or4 = 0;
    let level0 = 0;

    for (const w of groupWords) {
      const rec = this.storageData.words[w.id];
      const lvl = rec ? rec.level : 0;
      if (lvl >= 3) level3Or4++;
      if (lvl === 0) level0++;
    }

    const TOTAL_GROUPS = 32;
    const isLastGroup = this.group >= TOTAL_GROUPS;

    const groupMasteryPercent = groupWords.length > 0 ? Math.round((level3Or4 / groupWords.length) * 100) : 0;
    const canUnlockNext = this.mode === 'standard' && level0 === 0 && !isLastGroup;
    const isAllCompleted = this.mode === 'standard' && groupMasteryPercent >= 85 && level0 === 0 && isLastGroup;

    return {
      totalAnswered,
      correctCount,
      accuracy,
      avgResponseSec,
      promotedCount: this.promotedWordIds.size,
      groupMasteryPercent,
      canUnlockNext,
      isAllCompleted,
      isAllDueSession: this.mode === 'all_due',
      nextGroup: !isLastGroup ? this.group + 1 : null,
    };
  }

  /**
   * Retrieves GRE context example sentence and translation for a word.
   */
  getWordExample(word) {
    if (!word) return null;
    const templates = this.questionsByTargetId.get(word.id);
    if (!templates || templates.length === 0) return null;
    const template = templates[0];
    const highlightedSentence = (template.sentence || '').replace(
      /\[BLANK\]/g,
      `<strong class="highlight-target-word">${word.word}</strong>`
    );
    return {
      sentence: highlightedSentence,
      translation: template.rationale || '',
      domain: template.domain || '',
    };
  }
}

