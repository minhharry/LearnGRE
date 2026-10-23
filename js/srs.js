/**
 * SRS Module: Cram-Mode Leitner 4-Level State Machine,
 * Behavioral Telemetry & Error Notebook Logic.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

export const SRS_CONFIG = {
  intervals_hours: {
    level_1: 4,
    level_2: 24,
    level_3: 48,
    level_4: 72,
  },
  level_4_extension_hours: 120, // 5 days
  penalty_reset_hours: 1,
  mastery_consecutive_correct: 3,
  fluent_recall_multiplier: 1.8,
  blind_tap_threshold_seconds: 1.2,
  flash_recall_expected_seconds: 3.0,
  text_completion_base_expected_seconds: 3.5,
  text_completion_word_time_multiplier: 0.18,
};

/**
 * Calculates expected response time (in seconds) for telemetry.
 */
export function calculateExpectedTimeSeconds(questionType, sentenceText = '') {
  if (questionType === 'TC') {
    const wordCount = sentenceText ? sentenceText.trim().split(/\s+/).length : 20;
    return (
      SRS_CONFIG.text_completion_base_expected_seconds +
      wordCount * SRS_CONFIG.text_completion_word_time_multiplier
    );
  }
  // Default for Flash Recall & Speed Match pair
  return SRS_CONFIG.flash_recall_expected_seconds;
}

/**
 * Evaluates behavioral telemetry: 'fluent', 'hesitant', or 'blind_tap'.
 */
export function classifyTelemetry(elapsedSeconds, expectedSeconds, questionType, isFirstEncounter = false) {
  if (
    questionType === 'TC' &&
    isFirstEncounter &&
    elapsedSeconds < SRS_CONFIG.blind_tap_threshold_seconds
  ) {
    return 'blind_tap';
  }

  if (elapsedSeconds <= expectedSeconds * SRS_CONFIG.fluent_recall_multiplier) {
    return 'fluent';
  }
  return 'hesitant';
}

/**
 * Helper to compute future timestamp in ISO string.
 */
function getFutureIsoTimestamp(hoursAhead) {
  const future = new Date();
  future.setTime(future.getTime() + hoursAhead * 60 * 60 * 1000);
  return future.toISOString();
}

/**
 * Evaluates question answer and updates word record according to Leitner 4-Level table.
 *
 * @param {Object} wordRecord - Current progress object of the target word.
 * @param {boolean} isCorrect - Whether user chose the right answer.
 * @param {number} responseTimeMs - Time taken in milliseconds.
 * @param {string} questionType - 'TC' | 'FLASH' | 'SPEED_MATCH'.
 * @param {string} sentenceText - The sentence text for TC (to compute expected time).
 * @param {boolean} isFirstEncounter - Whether this is the first encounter.
 * @param {boolean} hasBeenPromotedThisSession - Whether word was already promoted this session.
 * @returns {Object} { updatedRecord, reaction, levelPromoted, retestNeeded }
 */
export function evaluateWordAnswer(
  wordRecord,
  isCorrect,
  responseTimeMs,
  questionType,
  sentenceText = '',
  isFirstEncounter = false,
  hasBeenPromotedThisSession = false
) {
  const currentRecord = { ...wordRecord };
  const elapsedSeconds = responseTimeMs / 1000.0;
  const expectedSeconds = calculateExpectedTimeSeconds(questionType, sentenceText);
  const reaction = classifyTelemetry(elapsedSeconds, expectedSeconds, questionType, isFirstEncounter);

  // Update rolling average response time
  const totalAnswers = (currentRecord.consecutive_correct || 0) + (currentRecord.mistake_count || 0) + 1;
  const oldAvg = currentRecord.avg_response_ms || responseTimeMs;
  currentRecord.avg_response_ms = Math.round((oldAvg * (totalAnswers - 1) + responseTimeMs) / totalAnswers);

  let levelPromoted = false;
  let retestNeeded = false;
  const currentLevel = currentRecord.level || 0;

  if (isCorrect) {
    if (reaction === 'fluent') {
      currentRecord.consecutive_correct = (currentRecord.consecutive_correct || 0) + 1;

      // Check Session Level Cap (max +1 level per word per session)
      const canPromote = !hasBeenPromotedThisSession;

      if (currentLevel === 0) {
        currentRecord.level = 1;
        currentRecord.status = 'learning';
        currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_1);
        levelPromoted = true;
      } else if (currentLevel === 1) {
        if (canPromote) {
          currentRecord.level = 2;
          currentRecord.status = 'learning';
          currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_2);
          levelPromoted = true;
        } else {
          currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_1);
        }
      } else if (currentLevel === 2) {
        if (canPromote) {
          currentRecord.level = 3;
          currentRecord.status = 'reviewing';
          currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_3);
          levelPromoted = true;
        } else {
          currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_2);
        }
      } else if (currentLevel === 3) {
        if (currentRecord.consecutive_correct >= SRS_CONFIG.mastery_consecutive_correct && canPromote) {
          currentRecord.level = 4;
          currentRecord.status = 'mastered';
          currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_4);
          levelPromoted = true;
        } else {
          currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_3);
        }
      } else if (currentLevel === 4) {
        // Extend Level 4
        currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.level_4_extension_hours);
      }

      // Auto-Unflag if consecutive_correct >= 3 with Fluent Recall
      if (currentRecord.consecutive_correct >= SRS_CONFIG.mastery_consecutive_correct) {
        currentRecord.flagged_error = false;
      }
    } else {
      // Hesitant or Blind Tap: Keep Level, queue for re-test, reset next_review per Leitner table
      retestNeeded = true;
      if (currentLevel === 0) {
        currentRecord.level = 1;
        currentRecord.status = 'learning';
        currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_1);
        levelPromoted = true;
      } else if (currentLevel === 1) {
        currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_1);
      } else if (currentLevel === 2) {
        currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_2);
      } else if (currentLevel === 3) {
        currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_3);
      }
      // Level 4: maintain current cycle
    }
  } else {
    // Incorrect answer
    retestNeeded = true;
    currentRecord.mistake_count = (currentRecord.mistake_count || 0) + 1;
    currentRecord.consecutive_correct = 0;

    // Error Notebook Auto-Flagging:
    // 1. False Confidence: TC mistake with delta_t <= 3.5s
    // 2. Repeated mistake (mistake_count >= 2) or previous level >= 3
    if (
      (questionType === 'TC' && responseTimeMs <= 3500) ||
      currentRecord.mistake_count >= 2 ||
      currentLevel >= 3
    ) {
      currentRecord.flagged_error = true;
    }

    // Leitner Demotion
    if (currentLevel === 0) {
      currentRecord.level = 1;
      currentRecord.status = 'learning';
      currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.penalty_reset_hours);
    } else if (currentLevel === 1) {
      currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.penalty_reset_hours);
    } else if (currentLevel === 2) {
      currentRecord.level = 1;
      currentRecord.status = 'learning';
      currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_1);
    } else if (currentLevel === 3) {
      currentRecord.level = 1;
      currentRecord.status = 'learning';
      currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_1);
    } else if (currentLevel === 4) {
      currentRecord.level = 2;
      currentRecord.status = 'learning';
      currentRecord.next_review = getFutureIsoTimestamp(SRS_CONFIG.intervals_hours.level_2);
    }
  }

  return {
    updatedRecord: currentRecord,
    reaction,
    levelPromoted,
    retestNeeded,
  };
}
