/**
 * Distractor Engine: Selects pedagogical distractors for Flash Recall
 * based on POS, synonyms graph exclusion, and definition overlap filters.
 * System: LearnGRE Zero-Friction Desktop-Web App
 */

const DEFAULT_STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as',
  'is', 'are', 'was', 'were', 'be', 'being', 'been', 'have', 'has', 'had',
  'and', 'or', 'but', 'not', 'so', 'that', 'this', 'from', 'into', 'over',
  'lacking', 'without', 'person', 'quality', 'state', 'feeling', 'make',
  'cause', 'having', 'tendency', 'related', 'relating', 'someone', 'something',
  'characterized', 'act', 'process', 'condition', 'manner', 'nature',
  'của', 'và', 'hoặc', 'cho', 'với', 'trong', 'người', 'sự', 'tính', 'việc', 'có', 'làm'
]);

/**
 * Normalizes text and extracts significant keywords.
 */
function extractSignificantKeywords(textList) {
  const words = new Set();
  for (const text of textList) {
    if (!text) continue;
    const tokens = text.toLowerCase().split(/[\s,.;:()/"'—–-]+/);
    for (const token of tokens) {
      if (token.length > 2 && !DEFAULT_STOPWORDS.has(token)) {
        words.add(token);
      }
    }
  }
  return words;
}

/**
 * Fisher-Yates array shuffle.
 */
export function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const ACADEMIC_FALLBACK_RECORDS = {
  noun: [
    { id: 'fb_n01', word: 'paradox', pos: 'noun', vi_gloss: 'nghịch lý, sự ngược đời', definitions: ['a seemingly contradictory statement that may nonetheless be true'], group: 0 },
    { id: 'fb_n02', word: 'controversy', pos: 'noun', vi_gloss: 'sự tranh luận, bất đồng ý kiến', definitions: ['disagreement, typically prolonged, public, and heated'], group: 0 },
    { id: 'fb_n03', word: 'hypothesis', pos: 'noun', vi_gloss: 'giả thuyết khoa học', definitions: ['a proposed explanation made on the basis of limited evidence'], group: 0 },
    { id: 'fb_n04', word: 'dilemma', pos: 'noun', vi_gloss: 'tình thế tiến thoái lưỡng nan', definitions: ['a situation in which a difficult choice has to be made'], group: 0 },
    { id: 'fb_n05', word: 'catalyst', pos: 'noun', vi_gloss: 'chất xúc tác, tác nhân thúc đẩy', definitions: ['a person or thing that precipitates an event or change'], group: 0 },
    { id: 'fb_n06', word: 'dichotomy', pos: 'noun', vi_gloss: 'sự phân đôi, phép lưỡng phân', definitions: ['a division or contrast between two things represented as opposed'], group: 0 },
    { id: 'fb_n07', word: 'anomaly', pos: 'noun', vi_gloss: 'sự bất thường, dị thường', definitions: ['something that deviates from what is standard or normal'], group: 0 },
    { id: 'fb_n08', word: 'consensus', pos: 'noun', vi_gloss: 'sự đồng thuận, nhất trí', definitions: ['a general agreement among a group of people'], group: 0 },
    { id: 'fb_n09', word: 'pinnacle', pos: 'noun', vi_gloss: 'đỉnh cao, điểm cực thịnh', definitions: ['the most successful or highest point of something'], group: 0 },
    { id: 'fb_n10', word: 'reticence', pos: 'noun', vi_gloss: 'tính trầm lặng, sự kín đáo', definitions: ['the quality of being reserved or restrained in speech'], group: 0 },
    { id: 'fb_n11', word: 'pragmatism', pos: 'noun', vi_gloss: 'thuyết thực dụng, tính thực tiễn', definitions: ['an approach assessing value by practical application'], group: 0 },
    { id: 'fb_n12', word: 'antipathy', pos: 'noun', vi_gloss: 'ác cảm, sự thù ghét', definitions: ['a deep-seated feeling of dislike or aversion'], group: 0 },
    { id: 'fb_n13', word: 'veracity', pos: 'noun', vi_gloss: 'sự thật thà, tính chân thực', definitions: ['conformity to facts, accuracy, habitual truthfulness'], group: 0 },
    { id: 'fb_n14', word: 'panacea', pos: 'noun', vi_gloss: 'thuốc chữa bách bệnh, giải pháp vạn năng', definitions: ['a solution or remedy for all difficulties or diseases'], group: 0 },
    { id: 'fb_n15', word: 'hierarchy', pos: 'noun', vi_gloss: 'hệ thống cấp bậc, thứ bậc', definitions: ['a system in which members are ranked according to status'], group: 0 },
  ],
  verb: [
    { id: 'fb_v01', word: 'belie', pos: 'verb', vi_gloss: 'che giấu, làm sai lệch, mâu thuẫn với', definitions: ['fail to give a true impression of; contradict'], group: 0 },
    { id: 'fb_v02', word: 'bolster', pos: 'verb', vi_gloss: 'củng cố, tăng cường, nâng đỡ', definitions: ['support or strengthen, prop up'], group: 0 },
    { id: 'fb_v03', word: 'corroborate', pos: 'verb', vi_gloss: 'chứng thực, xác thực lời khai', definitions: ['confirm or give support to a statement or theory'], group: 0 },
    { id: 'fb_v04', word: 'delineate', pos: 'verb', vi_gloss: 'phác họa, mô tả chi tiết', definitions: ['describe or portray something precisely'], group: 0 },
    { id: 'fb_v05', word: 'mitigate', pos: 'verb', vi_gloss: 'giảm nhẹ, xoa dịu nỗi đau', definitions: ['make less severe, serious, or painful'], group: 0 },
    { id: 'fb_v06', word: 'reproach', pos: 'verb', vi_gloss: 'khiển trách, trách mắng', definitions: ['address someone in such a way as to express disapproval'], group: 0 },
    { id: 'fb_v07', word: 'repudiate', pos: 'verb', vi_gloss: 'bác bỏ, từ chối công nhận', definitions: ['refuse to accept or be associated with'], group: 0 },
    { id: 'fb_v08', word: 'undermine', pos: 'verb', vi_gloss: 'làm suy yếu, hủy hoại dần', definitions: ['lessen the effectiveness, power, or ability of'], group: 0 },
    { id: 'fb_v09', word: 'vindicate', pos: 'verb', vi_gloss: 'minh oan, chứng minh là đúng', definitions: ['clear someone of blame or suspicion'], group: 0 },
    { id: 'fb_v10', word: 'vacillate', pos: 'verb', vi_gloss: 'dao dao, ngập ngừng lưỡng lự', definitions: ['alternate or waver between different opinions or actions'], group: 0 },
    { id: 'fb_v11', word: 'exacerbate', pos: 'verb', vi_gloss: 'làm trầm trọng thêm, làm xấu đi', definitions: ['make a problem or bad situation worse'], group: 0 },
    { id: 'fb_v12', word: 'alleviate', pos: 'verb', vi_gloss: 'làm dịu bớt, giảm bớt khó khăn', definitions: ['make suffering or deficiency less severe'], group: 0 },
    { id: 'fb_v13', word: 'repugn', pos: 'verb', vi_gloss: 'phản kháng, đối kháng lại', definitions: ['fight against, oppose, be inconsistent with'], group: 0 },
    { id: 'fb_v14', word: 'substantiate', pos: 'verb', vi_gloss: 'chứng minh bằng bằng chứng xác thực', definitions: ['provide evidence to support or prove the truth of'], group: 0 },
    { id: 'fb_v15', word: 'venerate', pos: 'verb', vi_gloss: 'sùng kính, tôn kính', definitions: ['regard with great respect, revere'], group: 0 },
  ],
  adj: [
    { id: 'fb_a01', word: 'austere', pos: 'adj', vi_gloss: 'khắc khổ, giản dị, nghiêm khắc', definitions: ['severe or strict in manner or appearance; extremely plain'], group: 0 },
    { id: 'fb_a02', word: 'didactic', pos: 'adj', vi_gloss: 'có tính giáo huấn, răn dạy đạo đức', definitions: ['intended to teach, particularly in having moral instruction'], group: 0 },
    { id: 'fb_a03', word: 'homogeneous', pos: 'adj', vi_gloss: 'đồng nhất, cùng một bản chất', definitions: ['of the same kind, alike throughout'], group: 0 },
    { id: 'fb_a04', word: 'pragmatic', pos: 'adj', vi_gloss: 'thực tế, chú trọng tính ứng dụng', definitions: ['dealing with things sensibly and realistically'], group: 0 },
    { id: 'fb_a05', word: 'tenuous', pos: 'adj', vi_gloss: 'mong manh, yếu ớt, mỏng manh', definitions: ['very weak or slight, insubstantial'], group: 0 },
    { id: 'fb_a06', word: 'ubiquitous', pos: 'adj', vi_gloss: 'nhan nhản, có mặt khắp mọi nơi', definitions: ['present, appearing, or found everywhere'], group: 0 },
    { id: 'fb_a07', word: 'lucid', pos: 'adj', vi_gloss: 'rõ ràng, minh bạch, dễ hiểu', definitions: ['expressed clearly, easy to understand'], group: 0 },
    { id: 'fb_a08', word: 'esoteric', pos: 'adj', vi_gloss: 'uyên thâm, bí truyền, chỉ thiểu số hiểu', definitions: ['intended for or likely to be understood by only a few'], group: 0 },
    { id: 'fb_a09', word: 'equivocal', pos: 'adj', vi_gloss: 'mập mờ, nước đôi, khó đoán định', definitions: ['open to more than one interpretation, ambiguous'], group: 0 },
    { id: 'fb_a10', word: 'reticent', pos: 'adj', vi_gloss: 'kín đáo, dè dặt, kiệm lời', definitions: ['not revealing one’s thoughts or feelings readily'], group: 0 },
    { id: 'fb_a11', word: 'ephemeral', pos: 'adj', vi_gloss: 'phù du, sớm nở tối tàn, ngắn ngủi', definitions: ['lasting for a very short time'], group: 0 },
    { id: 'fb_a12', word: 'dogmatic', pos: 'adj', vi_gloss: 'giáo điều, võ đoán, áp đặt', definitions: ['inclined to lay down principles as incontrovertibly true'], group: 0 },
    { id: 'fb_a13', word: 'tacit', pos: 'adj', vi_gloss: 'ngầm hiểu, không cần nói ra', definitions: ['understood or implied without being stated'], group: 0 },
    { id: 'fb_a14', word: 'spurious', pos: 'adj', vi_gloss: 'giả mạo, sai lệch, không chân thực', definitions: ['not being what it purports to be, false or fake'], group: 0 },
    { id: 'fb_a15', word: 'copious', pos: 'adj', vi_gloss: 'dồi dào, phong phú, số lượng lớn', definitions: ['abundant in supply or quantity'], group: 0 },
  ],
  adv: [
    { id: 'fb_ad01', word: 'ostensibly', pos: 'adv', vi_gloss: 'bề ngoài ra vẻ là', definitions: ['apparently or purportedly, but perhaps not actually'], group: 0 },
    { id: 'fb_ad02', word: 'meticulously', pos: 'adv', vi_gloss: 'tỉ mỉ, cẩn thận từng li từng tí', definitions: ['in a way that shows great attention to detail'], group: 0 },
    { id: 'fb_ad03', word: 'subversively', pos: 'adv', vi_gloss: 'có tính phá hoại ngầm, lật đổ', definitions: ['in a way that seeks to subvert an established system'], group: 0 },
    { id: 'fb_ad04', word: 'tacitly', pos: 'adv', vi_gloss: 'ngầm hiểu, lặng lẽ đồng thuận', definitions: ['in a way that is understood without being directly stated'], group: 0 },
    { id: 'fb_ad05', word: 'equivocally', pos: 'adv', vi_gloss: 'một cách mập mờ, nước đôi', definitions: ['in a way that is open to multiple interpretations'], group: 0 },
    { id: 'fb_ad06', word: 'precariously', pos: 'adv', vi_gloss: 'bấp bênh, nguy hiểm', definitions: ['in a way that is likely to fall or fail, dangerously'], group: 0 },
    { id: 'fb_ad07', word: 'inadvertently', pos: 'adv', vi_gloss: 'vô tình, không cố ý', definitions: ['without intention, accidentally'], group: 0 },
    { id: 'fb_ad08', word: 'prospiciently', pos: 'adv', vi_gloss: 'nhìn xa trông rộng, có tính toán', definitions: ['with foresight, looking forward'], group: 0 },
    { id: 'fb_ad09', word: 'perfunctorily', pos: 'adv', vi_gloss: 'đại khái, chiếu lệ, làm cho có', definitions: ['carried out with minimum effort or reflection'], group: 0 },
    { id: 'fb_ad10', word: 'dogmatically', pos: 'adv', vi_gloss: 'một cách giáo điều, độc đoán', definitions: ['in a dogmatic manner, asserting without proof'], group: 0 },
  ],
};

/**
 * Selects 3 high-quality distractors for Flash Recall for a target word.
 *
 * @param {Object} targetWord - The target vocabulary item.
 * @param {Array<Object>} allVocabList - Full list of loaded vocabulary items.
 * @returns {Array<Object>} Array of 3 distractor word objects.
 */
export function selectFlashDistractors(targetWord, allVocabList) {
  const targetId = targetWord.id;
  const targetPos = targetWord.pos;
  const targetGroup = targetWord.group || 1;

  // Build target synonym set
  const targetSynonyms = new Set(
    (targetWord.synonyms || []).map((s) => s.toLowerCase().trim())
  );
  targetSynonyms.add(targetWord.word.toLowerCase().trim());

  // Build target family forms set
  const targetForms = new Set();
  if (targetWord.forms) {
    for (const formKey of Object.keys(targetWord.forms)) {
      const list = targetWord.forms[formKey];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item) targetForms.add(item.toLowerCase().trim());
        }
      }
    }
  }

  // Target definition keywords
  const targetDefKeywords = extractSignificantKeywords([
    ...(targetWord.definitions || []),
    targetWord.vi_gloss || '',
  ]);

  // Filter candidates
  const isCandidateValid = (candidate) => {
    if (!candidate || candidate.id === targetId) return false;
    const candWord = candidate.word.toLowerCase().trim();

    // Word must not match target word
    if (candWord === targetWord.word.toLowerCase().trim()) return false;

    // CRITICAL: Strictly prohibit words from future groups (Group > targetGroup)
    if (candidate.group && candidate.group > targetGroup) {
      return false;
    }

    // 1. Cannot be in target synonyms or lemma forms
    if (targetSynonyms.has(candWord) || targetForms.has(candWord)) {
      return false;
    }

    // 2. Candidate synonyms cannot contain target word
    if (candidate.synonyms && Array.isArray(candidate.synonyms)) {
      for (const syn of candidate.synonyms) {
        if (targetSynonyms.has(syn.toLowerCase().trim())) {
          return false;
        }
      }
    }

    // 3. Definition keyword overlap check
    const candKeywords = extractSignificantKeywords([
      ...(candidate.definitions || []),
      candidate.vi_gloss || '',
    ]);

    let overlapCount = 0;
    for (const kw of candKeywords) {
      if (targetDefKeywords.has(kw)) {
        overlapCount++;
        if (overlapCount >= 2) return false; // Overlap threshold
      }
    }

    return true;
  };

  // Bucket candidates strictly from current or prior groups
  const intraGroupMatches = [];
  const priorGroupMatches = [];
  const intraGroupOtherPos = [];
  const priorGroupOtherPos = [];

  for (const candidate of allVocabList) {
    if (!candidate || !candidate.group) continue;
    // Strictly skip any candidate from future group
    if (candidate.group > targetGroup) continue;

    if (!isCandidateValid(candidate)) continue;

    if (candidate.pos === targetPos) {
      if (candidate.group === targetGroup) {
        intraGroupMatches.push(candidate);
      } else {
        priorGroupMatches.push(candidate);
      }
    } else {
      if (candidate.group === targetGroup) {
        intraGroupOtherPos.push(candidate);
      } else {
        priorGroupOtherPos.push(candidate);
      }
    }
  }

  // Gather distractors according to SPEC.md section 5.3 priority:
  // Priority 1: Intra-Group same POS
  // Priority 2: Cumulative Prior-Groups same POS (Group < targetGroup)
  // Priority 3: Academic Core Fallback same POS (scripts/config.json)
  // Priority 3b: Academic Core Fallback across other POS
  // Priority 4: Intra-Group other POS
  // Priority 5: Prior-Group other POS
  // STRICT RULE: Never pick any candidate from Group > targetGroup.
  const chosen = [];
  const chosenIds = new Set();
  const chosenWords = new Set();

  const addPool = (pool) => {
    const shuffled = shuffleArray(pool);
    for (const item of shuffled) {
      if (chosen.length >= 3) break;
      const w = item.word.toLowerCase().trim();
      if (!chosenIds.has(item.id) && !chosenWords.has(w) && isCandidateValid(item)) {
        chosen.push(item);
        chosenIds.add(item.id);
        chosenWords.add(w);
      }
    }
  };

  // Priority 1: Intra-group same POS
  addPool(intraGroupMatches);

  // Priority 2: Prior-group same POS
  if (chosen.length < 3) {
    addPool(priorGroupMatches);
  }

  // Priority 3: Academic Core Fallback same POS
  if (chosen.length < 3) {
    const fallbackSamePos = ACADEMIC_FALLBACK_RECORDS[targetPos] || [];
    addPool(fallbackSamePos);
  }

  // Priority 3b: Academic Core Fallback across other POS
  if (chosen.length < 3) {
    for (const [posKey, records] of Object.entries(ACADEMIC_FALLBACK_RECORDS)) {
      if (posKey !== targetPos) {
        addPool(records);
        if (chosen.length >= 3) break;
      }
    }
  }

  // Priority 4: Intra-group other POS
  if (chosen.length < 3) {
    addPool(intraGroupOtherPos);
  }

  // Priority 5: Prior-group other POS
  if (chosen.length < 3) {
    addPool(priorGroupOtherPos);
  }

  return chosen.slice(0, 3);
}
