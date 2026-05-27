// ─── data.js ─────────────────────────────────────────────────────────────────
// DSA Notebook — question data, topic modules, and progress storage.
//
// AI INSTRUCTIONS FOR THIS FILE:
// - This file contains ONLY data and data-access helpers. No rendering logic.
// - To add a new topic: append to TOPICS array + TOPIC_MODULES object at the bottom.
// - To add a question: add to the relevant module\'s questions: {} object.
// - Module schema is documented in the MODULE SCHEMA comment block below.
// - Do NOT add rendering functions, DOM manipulation, or event handlers here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── MASTER DATA REGISTRY ────────────────────────────────────────────────────
// Each topic module is self-contained. Add new topic modules to TOPIC_MODULES.
// TOPICS drives the sidebar and dashboard; each entry\'s key maps to a module.

const TOPICS = [
  { key: 'sliding-window', icon: '🪟', label: 'Sliding Window' },
  { key: 'two-pointers',   icon: '👉', label: 'Two Pointers'  },
  { key: 'binary-search',  icon: '🔍', label: 'Binary Search'  },
  { key: 'sorting',        icon: '🔃', label: 'Sorting'        },
  { key: 'heap',           icon: '🏔️', label: 'Heap / Priority Queue' },
  { key: 'recursion',      icon: '🔁', label: 'Recursion'      },
  { key: 'backtracking',        icon: '🔙', label: 'Backtracking'          },
  { key: 'dynamic-programming', icon: '🧮', label: 'Dynamic Programming'   },
  { key: 'graph',               icon: '🕸️', label: 'Graph'                 },
];

// Per-question user progress (persisted in localStorage)
// shape: { [lcKey]: { status: 'Solved'|'In Progress'|'Pending' } }
const PROGRESS_KEY = 'dsa-progress-v1'
let _progressCache = null
function loadProgress() {
  if (_progressCache) return _progressCache
  try { _progressCache = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') } catch { _progressCache = {} }
  return _progressCache
}
function saveProgress(p) { _progressCache = p; localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)) }
function getStatus(lcKey) { return loadProgress()[lcKey]?.status ?? 'Pending' }
function setStatus(lcKey, status) {
  const p = loadProgress()
  p[lcKey] = { status }
  saveProgress(p)
}

// Per-question personal notes (persisted in localStorage)
// shape: { [lcKey]: string }
const NOTES_KEY = 'dsa-notes-v1';
let _notesCache = null;
function loadNotes() {
  if (_notesCache) return _notesCache;
  try { _notesCache = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch { _notesCache = {}; }
  return _notesCache;
}
function saveNotes(n) { _notesCache = n; localStorage.setItem(NOTES_KEY, JSON.stringify(n)); }
function getNote(lcKey) {
  return loadNotes()[lcKey] || '';
}
function setNote(lcKey, text) {
  const n = loadNotes();
  if (text.trim()) n[lcKey] = text; else delete n[lcKey];
  saveNotes(n);
}

// Invalidate caches on cross-tab updates
window.addEventListener('storage', (e) => {
  if (e.key === PROGRESS_KEY) _progressCache = null;
  if (e.key === NOTES_KEY) _notesCache = null;
});

// Per-question pins (persisted in localStorage)
// shape: string[] (array of lcKeys stored as JSON array)
const PINS_KEY = 'dsa-pins-v1'
function getPins() {
  try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]')) } catch { return new Set() }
}
function isPinned(lcKey) { return getPins().has(lcKey) }
function togglePin(lcKey) {
  const pins = getPins()
  if (pins.has(lcKey)) pins.delete(lcKey); else pins.add(lcKey)
  localStorage.setItem(PINS_KEY, JSON.stringify([...pins]))
  return pins.has(lcKey)
}

// Per-question practice solve counts (persisted in localStorage)
// shape: { [lcKey]: number }
const SOLVE_COUNT_KEY = 'dsa-solve-counts-v1'
function getSolveCount(lcKey) {
  try { return JSON.parse(localStorage.getItem(SOLVE_COUNT_KEY) || '{}')[lcKey] || 0 } catch { return 0 }
}
function incSolveCount(lcKey) {
  try {
    const counts = JSON.parse(localStorage.getItem(SOLVE_COUNT_KEY) || '{}')
    counts[lcKey] = (counts[lcKey] || 0) + 1
    localStorage.setItem(SOLVE_COUNT_KEY, JSON.stringify(counts))
    return counts[lcKey]
  } catch { return 0 }
}

// ─── GLOBAL SEARCH ──────────────────────────────────────────────────────────
// Search across all topics by title, tags, difficulty, status, notes
function searchGlobalQuestions(query) {
  if (!query || query.trim().length === 0) return []
  
  const q = query.trim().toLowerCase()
  const results = []
  
  // Iterate through all topics and all questions
  TOPICS.forEach(topic => {
    const mod = TOPIC_MODULES[topic.key]
    if (!mod) return
    
    Object.entries(mod.questions).forEach(([lcKey, question]) => {
      const title = (question.title || '').toLowerCase()
      const keyInsight = (question.keyInsight || '').toLowerCase()
      const tags = (question.tags || []).map(t => t.toLowerCase()).join(' ')
      const difficulty = (question.difficulty || '').toLowerCase()
      const status = getStatus(lcKey).toLowerCase()
      const notes = getNote(lcKey).toLowerCase()
      
      // Check if query matches any of: title, tags, difficulty, status, notes, keyInsight
      const matches = title.includes(q) || tags.includes(q) || difficulty.includes(q) || 
                      status.includes(q) || notes.includes(q) || keyInsight.includes(q)
      
      if (matches) {
        results.push({
          topicKey: topic.key,
          topicLabel: topic.label,
          topicIcon: topic.icon,
          lcKey,
          question,
          status: getStatus(lcKey)
        })
      }
    })
  })
  
  return results
}

// ─── DAILY QUESTION ─────────────────────────────────────────────────────────
// Get daily question (randomly selected, persists per day)
function getDailyQuestion() {
  const today = new Date().toDateString()
  const dailyKey = 'dsa-daily-question-' + today
  let stored = null
  try {
    stored = JSON.parse(localStorage.getItem(dailyKey) || 'null')
  } catch {}
  
  // If we already selected one today, return it
  if (stored && stored.lcKey) {
    const topicMod = TOPIC_MODULES[stored.topicKey]
    if (topicMod && topicMod.questions[stored.lcKey]) {
      return {
        topicKey: stored.topicKey,
        topicLabel: stored.topicLabel,
        topicIcon: stored.topicIcon,
        lcKey: stored.lcKey,
        question: topicMod.questions[stored.lcKey],
        status: getStatus(stored.lcKey),
        isToday: true
      }
    }
  }
  
  // Otherwise, pick a random question
  const allQuestions = []
  TOPICS.forEach(topic => {
    const mod = TOPIC_MODULES[topic.key]
    if (!mod) return
    Object.entries(mod.questions).forEach(([lcKey, question]) => {
      allQuestions.push({
        topicKey: topic.key,
        topicLabel: topic.label,
        topicIcon: topic.icon,
        lcKey,
        question
      })
    })
  })
  
  if (allQuestions.length === 0) return null
  
  const rnd = Math.floor(Math.random() * allQuestions.length)
  const selected = allQuestions[rnd]
  
  // Store for today
  try {
    localStorage.setItem(dailyKey, JSON.stringify({
      topicKey: selected.topicKey,
      topicLabel: selected.topicLabel,
      topicIcon: selected.topicIcon,
      lcKey: selected.lcKey
    }))
  } catch {}
  
  return {
    ...selected,
    status: getStatus(selected.lcKey),
    isToday: true
  }
}

// Get a random daily question excluding a specific one
function getRandomDailyQuestion(excludeLcKey) {
  const allQuestions = []
  TOPICS.forEach(topic => {
    const mod = TOPIC_MODULES[topic.key]
    if (!mod) return
    Object.entries(mod.questions).forEach(([lcKey, question]) => {
      // Skip the excluded question
      if (lcKey !== excludeLcKey) {
        allQuestions.push({
          topicKey: topic.key,
          topicLabel: topic.label,
          topicIcon: topic.icon,
          lcKey,
          question
        })
      }
    })
  })
  
  if (allQuestions.length === 0) return null
  
  const rnd = Math.floor(Math.random() * allQuestions.length)
  const selected = allQuestions[rnd]
  
  // Store as today's new selection
  const today = new Date().toDateString()
  const dailyKey = 'dsa-daily-question-' + today
  try {
    localStorage.setItem(dailyKey, JSON.stringify({
      topicKey: selected.topicKey,
      topicLabel: selected.topicLabel,
      topicIcon: selected.topicIcon,
      lcKey: selected.lcKey
    }))
  } catch {}
  
  return {
    ...selected,
    status: getStatus(selected.lcKey),
    isToday: true
  }
}

// ─── TOPIC MODULE REGISTRY ──────────────────────────────────────────────────
// SOLID / EXTENSIBILITY CONTRACT
// ───────────────────────────────
// Open/Closed: Add new topics by appending to TOPICS + TOPIC_MODULES.
//   No existing rendering code needs to change.
//
// Cross-topic status sync (automatic):
//   Progress is stored by lcKey (e.g. 'LC_643') in ONE global localStorage
//   entry (PROGRESS_KEY). The same lcKey in multiple modules shares status
//   automatically — getStatus / setStatus are topic-agnostic.
//
// ── MODULE SCHEMA ─────────────────────────────────────────────────────────────
//  description      : string
//  goal             : string   — shown in the per-topic tracker card
//  relatedTopics    : string[] — keys into TOPICS
//  tagRegistry      : string[] — all tag strings used in this module
//  techniqueRegistry: string[] — all technique strings used
//  whenToUse        : { use: string[], avoid: string[] }
//                     use   — signals/clues that point TO this pattern
//                     avoid — traps that look like this pattern but aren\'t,
//                             with what to use instead
//  interviewTips    : string[] — bullet tips in "Interview Tips" collapsible
//  patterns  : Array<{ id, name, recognitionSignals: string[], mentalModel, keyQuestion?, questionIds: string[] }>
//  questions : { [lcKey]: Question }
//    Question: { leetcode, title, difficulty ('Easy'|'Medium'|'Hard'),
//               templateRefs: string[], tags: string[], keyInsight, shrinkTrigger,
//               timeComplexity, spaceComplexity, gotcha, faangNote,
//               alternateApproaches: Array<{ technique, tradeoff, complexity }>, link }
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_MODULES = {
  'sliding-window': {
    description: 'A technique for reducing O(n²) brute-force subarray iteration to O(n) by maintaining a window of elements and sliding it across the array. Applicable when the problem involves contiguous subarrays or substrings and the validity condition is monotonic.',
    goal: 'Cover 95% of FAANG Sliding Window questions by mastering 4 patterns, 8 templates, and 26 curated problems (including Meta, Google, Apple, Microsoft, Netflix recent interviews 2023-2024)',
    relatedTopics: ['two-pointers', 'binary-search'],

    tagRegistry: [
      'sliding-window','fixed-window','variable-window','array','string','binary-array',
      'freq-map','hash-map','anagram','counting','exactly-k','deque','monotonic-deque',
      'prefix-sum','negative-numbers','reduction','two-pointers','binary-search'
    ],

    techniqueRegistry: [
      'sliding-window','two-pointers','prefix-sum','binary-search','hash-map','monotonic-deque'
    ],
    patterns: [
      {
        id: 'P1', name: 'Fixed Size Window',
        recognitionSignals: [
          'Window size K is explicitly given in the problem',
          'Subarray or substring of length exactly K',
          'Every consecutive K elements must be evaluated',
          'Apply operation to every window (recolor, average, substring count)'
        ],
        questionIds: ['LC_643', 'LC_1456', 'LC_567', 'LC_438', 'LC_2090', 'LC_2379', 'LC_1100']
      },
      {
        id: 'P2', name: 'Variable Window — Maximize / Longest',
        recognitionSignals: [
          'Longest subarray or substring SUCH THAT a condition holds',
          'Maximum length WHERE some property holds',
          'A smaller window is always valid if a larger one is — the condition is monotonic',
          'At most K distinct characters / at most K constraint',
          'Product-based or multiplication-based window (not addition)'
        ],
        questionIds: ['LC_3', 'LC_1004', 'LC_1493', 'LC_424', 'LC_904', 'LC_340', 'LC_1695', 'LC_713']
      },
      {
        id: 'P3', name: 'Variable Window — Minimize / Shortest / Count Exactly K',
        recognitionSignals: [
          'Minimum length subarray or substring such that a condition holds',
          'Smallest window containing all of something',
          'COUNT the number of subarrays where something occurs EXACTLY K times',
          'At least K repeating characters (each character appears ≥K times)',
          'Multi-pass technique where unique count varies'
        ],
        questionIds: ['LC_209', 'LC_76', 'LC_930', 'LC_992', 'LC_1658', 'LC_395']
      },
      {
        id: 'P4', name: 'Deque-based Sliding Window',
        recognitionSignals: [
          'Maximum or minimum of every window of size K needed in O(n)',
          'Array contains NEGATIVE numbers with a subarray sum or length constraint',
          'Standard sliding window breaks because shrinking does not monotonically change the tracked value',
          'Monotonic deque for tracking max/min across windows',
          'Visibility or range-based problems with monotonic ordering'
        ],
        questionIds: ['LC_239', 'LC_1438', 'LC_862', 'LC_1610']
      }
    ],

    questions: {
      'LC_643':  { leetcode: 643,  title: 'Maximum Average Subarray I',                            difficulty: 'Easy',   status: 'Pending', templateRefs: ['T1'], tags: ['sliding-window','fixed-window','array'], keyInsight: 'Baseline T1 template. Maximize sum over window of size k, divide by k only at return — not inside the loop.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Do NOT divide inside the loop. Accumulate integer sums and divide only at return.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/maximum-average-subarray-i/' },
      'LC_1456': { leetcode: 1456, title: 'Max Vowels in Substring of Given Length',               difficulty: 'Medium', status: 'Pending', templateRefs: ['T1'], tags: ['sliding-window','fixed-window','string'], keyInsight: 'T1 template tracking vowel count instead of sum. On slide: if removed char is a vowel decrement; if added char is a vowel increment.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: "Use `new Set(['a','e','i','o','u'])` for vowel lookup rather than `'aeiou'.includes(c)` — signals O(1) lookup intent.", faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/maximum-number-of-vowels-in-a-substring-of-given-length/' },
      'LC_567':  { leetcode: 567,  title: 'Permutation in String',                                 difficulty: 'Medium', status: 'Pending', templateRefs: ['T2'], tags: ['sliding-window','fixed-window','string','freq-map','anagram'], keyInsight: "Fixed window of size len(p). 'matches' counter tracks how many of 26 characters are fully satisfied. Valid permutation when matches === 26.", shrinkTrigger: 'Strict fixed window — remove left whenever i >= len(p)', timeComplexity: 'O(n + m)', spaceComplexity: 'O(1)', gotcha: 'Update matches AFTER incrementing/decrementing the count, not before.', faangNote: 'Lead with the int[26] array solution, not a HashMap. O(1) space is expected.', alternateApproaches: [{ technique: 'two-pointers', tradeoff: 'Equivalent mechanics. Sliding window is cleaner framing for fixed-size window.', complexity: 'O(n+m) time, O(1) space' }], link: 'https://leetcode.com/problems/permutation-in-string/' },
      'LC_438':  { leetcode: 438,  title: 'Find All Anagrams in a String',                         difficulty: 'Medium', status: 'Pending', templateRefs: ['T2'], tags: ['sliding-window','fixed-window','string','freq-map','anagram'], keyInsight: 'Identical template to LC_567. Only difference: collect ALL start indices where matches === 26.', shrinkTrigger: 'Strict fixed window — remove left whenever i >= len(p)', timeComplexity: 'O(n + m)', spaceComplexity: 'O(1)', gotcha: "Push `i - p.length + 1` (start index), NOT `i` (end index).", faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/find-all-anagrams-in-a-string/' },
      'LC_3':    { leetcode: 3,    title: 'Longest Substring Without Repeating Characters',        difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','string','hash-map'], keyInsight: 'Shrink when the character just added creates a duplicate. Keep shrinking until the duplicate resolves.', shrinkTrigger: 'freq.get(s[right])! > 1', timeComplexity: 'O(n)', spaceComplexity: 'O(min(n, charset))', gotcha: 'Use a while loop to shrink, not an if. A single removal is not guaranteed to resolve the violation.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
      'LC_1004': { leetcode: 1004, title: 'Max Consecutive Ones III',                              difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','array','binary-array'], keyInsight: 'K allowed flips = at most K zeros in the window. Track zerosCount as a plain integer.', shrinkTrigger: 'zerosInWindow > k', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Answer is right - left + 1 (inclusive), not right - left. Single most common mistake.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/max-consecutive-ones-iii/' },
      'LC_1493': { leetcode: 1493, title: 'Longest Subarray of 1s After Deleting One Element',     difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','array','binary-array'], keyInsight: 'LC_1004 with k=1 hardcoded. Return right - left (not +1) because the deleted zero occupies one slot.', shrinkTrigger: 'zerosInWindow > 1', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Return `right - left`, not `right - left + 1`.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/longest-subarray-of-1s-after-deleting-one-element/' },
      'LC_424':  { leetcode: 424,  title: 'Longest Repeating Character Replacement',               difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','string','freq-map'], keyInsight: 'Replacements needed = windowSize - maxFreq. Shrink when this exceeds K. maxFreq intentionally never decreases on shrink.', shrinkTrigger: '(right - left + 1) - maxFreq > k', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'The stale maxFreq is INTENTIONAL, not a bug.', faangNote: 'Hardest invariant in P2. Interviewers probe why maxFreq stays stale.', alternateApproaches: [], link: 'https://leetcode.com/problems/longest-repeating-character-replacement/' },
      'LC_904':  { leetcode: 904,  title: 'Fruit Into Baskets',                                    difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','array','hash-map'], keyInsight: 'Two baskets = at most 2 distinct values in the window. Same T3 template as LC_3.', shrinkTrigger: 'freq.size > 2', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Only delete a fruit type from the map when its count reaches 0.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/fruit-into-baskets/' },
      'LC_209':  { leetcode: 209,  title: 'Minimum Size Subarray Sum',                             difficulty: 'Medium', status: 'Pending', templateRefs: ['T4'], tags: ['sliding-window','variable-window','array'], keyInsight: 'Expand until sum >= target. Shrink while sum still >= target, recording minimum at each valid shrink.', shrinkTrigger: 'windowSum >= target', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Initialize result to Infinity. Return `result === Infinity ? 0 : result`.', faangNote: null, alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary search on prefix sums gives O(n log n) — strictly worse.', complexity: 'O(n log n) time, O(n) space' }], link: 'https://leetcode.com/problems/minimum-size-subarray-sum/' },
      'LC_76':   { leetcode: 76,   title: 'Minimum Window Substring',                              difficulty: 'Hard',   status: 'Pending', templateRefs: ['T4'], tags: ['sliding-window','variable-window','string','freq-map'], keyInsight: "required = need.size (UNIQUE chars in t), NOT t.length. 'formed' counter tracks unique chars that are fully satisfied.", shrinkTrigger: 'formed === required', timeComplexity: 'O(n + m)', spaceComplexity: 'O(1)', gotcha: "Use need.size NOT t.length for required. If t = 'aa', need = {a:2}, required = 1 not 2.", faangNote: 'Most tested Hard sliding window problem across Meta, Google, Amazon, Apple. Know this cold.', alternateApproaches: [], link: 'https://leetcode.com/problems/minimum-window-substring/' },
      'LC_930':  { leetcode: 930,  title: 'Binary Subarrays With Sum',                             difficulty: 'Medium', status: 'Pending', templateRefs: ['T5'], tags: ['sliding-window','variable-window','counting','exactly-k','binary-array'], keyInsight: 'count(exactly K ones) = atMostK(K) - atMostK(K-1). Best first problem for learning T5.', shrinkTrigger: 'windowSum > k (inside atMostK)', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'atMostK must return 0 immediately when k < 0. Without this guard, atMostK(-1) counts all subarrays incorrectly.', faangNote: null, alternateApproaches: [{ technique: 'prefix-sum', tradeoff: 'Prefix sum + hash map also works O(n) but uses O(n) space.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/binary-subarrays-with-sum/' },
      'LC_992':  { leetcode: 992,  title: 'Subarrays with K Different Integers',                   difficulty: 'Hard',   status: 'Pending', templateRefs: ['T5'], tags: ['sliding-window','variable-window','counting','exactly-k','hash-map'], keyInsight: 'Direct exactly-K-distinct window is not monotonically valid. atMostK(k) - atMostK(k-1) is the only O(n) solution.', shrinkTrigger: 'freq.size > k (inside atMostK)', timeComplexity: 'O(n)', spaceComplexity: 'O(k)', gotcha: 'Same k < 0 guard as LC_930 — not optional.', faangNote: 'Google and Meta favourite. Tests whether you independently recognise that exactly-K is not directly solvable.', alternateApproaches: [], link: 'https://leetcode.com/problems/subarrays-with-k-different-integers/' },
      'LC_1658': { leetcode: 1658, title: 'Minimum Operations to Reduce X to Zero',                difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','array','reduction'], keyInsight: 'REDUCTION: min prefix+suffix with sum X = n - (max subarray with sum totalSum-X). Reformulate to longest subarray with exact target sum.', shrinkTrigger: 'windowSum > (totalSum - x)', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Check totalSum - x < 0 before the loop. Return -1 immediately if true.', faangNote: 'Differentiates SDE2 from SDE3. Reformulate first, then code.', alternateApproaches: [], link: 'https://leetcode.com/problems/minimum-operations-to-reduce-x-to-zero/' },
      'LC_239':  { leetcode: 239,  title: 'Sliding Window Maximum',                                difficulty: 'Hard',   status: 'Pending', templateRefs: ['T6'], tags: ['sliding-window','fixed-window','deque','monotonic-deque','array'], keyInsight: 'Deque stores indices in decreasing value order. Front is always the current window max.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(k)', gotcha: 'Array.shift() is O(n) in JavaScript. Use a head pointer for true O(n). Mention this in the interview.', faangNote: 'Table stakes. Know algorithm, O(n) proof, and the JS shift() caveat cold.', alternateApproaches: [], link: 'https://leetcode.com/problems/sliding-window-maximum/' },
      'LC_1438': { leetcode: 1438, title: 'Longest Continuous Subarray With Absolute Diff ≤ Limit', difficulty: 'Medium', status: 'Pending', templateRefs: ['T7'], tags: ['sliding-window','variable-window','deque','monotonic-deque','array'], keyInsight: 'Two deques in parallel: maxDq and minDq. Shrink while max - min > limit.', shrinkTrigger: 'nums[maxDq[0]] - nums[minDq[0]] > limit', timeComplexity: 'O(n)', spaceComplexity: 'O(k)', gotcha: 'Check both deque fronts independently on left increment. Do not assume both need eviction simultaneously.', faangNote: 'Common Meta and Google variant — teaches two-deque as a distinct sub-skill.', alternateApproaches: [], link: 'https://leetcode.com/problems/longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit/' },
      'LC_862':  { leetcode: 862,  title: 'Shortest Subarray with Sum at Least K',                 difficulty: 'Hard',   status: 'Pending', templateRefs: ['T6'], tags: ['sliding-window','deque','monotonic-deque','prefix-sum','array','negative-numbers'], keyInsight: 'Negative numbers break standard sliding window. Use prefix sums with a monotonically increasing deque of prefix-sum indices.', shrinkTrigger: 'prefix[right] - prefix[dq[0]] >= k — pop from front while this holds', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', gotcha: 'Prefix sum array has n+1 elements: prefix[0]=0. Off-by-one in sizing is the most common bug.', faangNote: "Say immediately: 'Standard sliding window breaks with negatives. I will use prefix sums with a monotonic deque.'", alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary search on prefix sums gives O(n log n). Deque is strictly O(n).', complexity: 'O(n log n) time, O(n) space' }], link: 'https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/' },
      'LC_340':  { leetcode: 340,  title: 'Longest Substring with At Most K Distinct Characters',   difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','string','hash-map','k-constraint'], keyInsight: 'Exact same T3 template as LC_3. Shrink when freq.size > k. Teaches K-constraint variation of distinct character problems.', shrinkTrigger: 'freq.size > k', timeComplexity: 'O(n)', spaceComplexity: 'O(min(n, k))', gotcha: 'K is given as input; do not confuse with \"at most 2 distinct\" hardcoded variants.', faangNote: 'Common follow-up question after LC_3. Google, Meta interviewers probe your ability to generalize from unbounded to bounded K.', alternateApproaches: [], link: 'https://leetcode.com/problems/longest-substring-with-at-most-k-distinct-characters/' },
      'LC_395':  { leetcode: 395,  title: 'Longest Substring with At Least K Repeating Characters',  difficulty: 'Hard',   status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','string','hash-map','multi-pass','frequency'], keyInsight: 'Key insight: Iterate on targetUnique (1 to 26). For each, solve the T3 variant \"at most targetUnique distinct chars with each ≥ k count\". Take max across all passes.', shrinkTrigger: '(for each unique-count pass) freq.size > uniqueTarget OR any char has freq < k', timeComplexity: 'O(26n)', spaceComplexity: 'O(1)', gotcha: 'The multi-pass technique is non-obvious. Many candidates try direct sliding window and fail.', faangNote: 'Google favorite. Tests whether you think beyond single-pass patterns and recognize structural transformations.', alternateApproaches: [], link: 'https://leetcode.com/problems/longest-substring-with-at-least-k-repeating-characters/' },
      'LC_1695': { leetcode: 1695, title: 'Maximum Erasure of Subarray',                            difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','array','hash-set','sum-maximization'], keyInsight: 'Identical T3 template to LC_3 (longest distinct subarray). Difference: maximize the SUM of distinct elements, not length.', shrinkTrigger: 'freq.get(nums[right]) > 1', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', gotcha: 'The template is identical to LC_3. Only the optimization metric changes from length to sum.', faangNote: 'Meta asked in 2023. Good warm-up before harder P3 problems.', alternateApproaches: [], link: 'https://leetcode.com/problems/maximum-erasure-of-subarray/' },
      'LC_2090': { leetcode: 2090, title: 'K Radius Subarray Averages',                             difficulty: 'Easy',   status: 'Pending', templateRefs: ['T1'], tags: ['sliding-window','fixed-window','array'], keyInsight: 'Fixed window of size 2*k+1 centered at each index. Compute average only if valid (k elements exist on both sides). Cleaner entry-level fixed-window.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(n)', gotcha: 'Initialize result array with -1 for invalid positions. Only compute averages where i >= k AND i < n - k.', faangNote: 'Apple, Microsoft easy-level screening. Better didactic problem than LC_643.', alternateApproaches: [], link: 'https://leetcode.com/problems/k-radius-subarray-averages/' },
      'LC_2379': { leetcode: 2379, title: 'Minimum Recolors to Get K Consecutive Black Blocks',     difficulty: 'Easy',   status: 'Pending', templateRefs: ['T1'], tags: ['sliding-window','fixed-window','string','counting'], keyInsight: 'Fixed window of size K. Count white blocks in each window. Minimum count = minimum recolors needed. Clean application of fixed window to operation-counting.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Track count of 1s (or 0s depending on encoding). Answer is min count of opposite value in any window.', faangNote: 'Meta 2024 easy-level screening. Tests fixed-window application to different problem types.', alternateApproaches: [], link: 'https://leetcode.com/problems/minimum-recolors-to-get-k-consecutive-black-blocks/' },
      'LC_713':  { leetcode: 713,  title: 'Subarray Product Less Than K',                          difficulty: 'Medium', status: 'Pending', templateRefs: ['T3'], tags: ['sliding-window','variable-window','array','multiplication','subarray-count'], keyInsight: 'P2 but with MULTIPLICATION instead of addition. Key: when window [L,R] is valid, ALL subarrays ending at R with start ≥ L are valid. Count = R - L + 1.', shrinkTrigger: 'product >= k', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Subarray counting trick: if [L,R] is valid, add (R - L + 1) to result, not just 1.', faangNote: 'Amazon, Microsoft favorite. Teaches multiplication-based window and subarray-count optimization.', alternateApproaches: [], link: 'https://leetcode.com/problems/subarray-product-less-than-k/' },
      'LC_1100': { leetcode: 1100, title: 'Find K-Length Substrings With No Repeated Characters',   difficulty: 'Easy',   status: 'Pending', templateRefs: ['T1'], tags: ['sliding-window','fixed-window','string','validity-check'], keyInsight: 'Fixed window of size K. For each position, check if all K characters are unique (freq.size === K). Teaches fixed window with validity constraint.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Must verify EVERY character in the window is unique, not just track uniqueness count.', faangNote: 'Teaching purpose: fixed window with validity checking (not just aggregation).', alternateApproaches: [], link: 'https://leetcode.com/problems/find-k-length-substrings-with-no-repeated-characters/' },
      'LC_1610': { leetcode: 1610, title: 'Maximum Number of Visible People in a Queue',            difficulty: 'Hard',   status: 'Pending', templateRefs: ['T6'], tags: ['sliding-window','deque','monotonic-stack','array','visibility'], keyInsight: 'Deque variant: instead of tracking max/min in window, track indices of decreasing heights. For each person, count how many taller people are visible on the right.', shrinkTrigger: 'heights[dq.back()] < heights[i] — pop back while this holds', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', gotcha: 'Each element is pushed/popped exactly once (amortized). Pop front when outside window, pop back when smaller than current.', faangNote: 'Google 2024. Harder conceptually than LC_239. Tests deque mastery and re-adaptation to non-window problems.', alternateApproaches: [], link: 'https://leetcode.com/problems/maximum-number-of-visible-people-in-a-queue/' },
      'LC_1044': { leetcode: 1044, title: 'Longest Duplicate Substring',                            difficulty: 'Hard',   status: 'Pending', templateRefs: ['T1'], tags: ['sliding-window','fixed-window','binary-search','rolling-hash','string'], keyInsight: 'Combines sliding window with binary search + rolling hash. Binary search on answer length. For each length, use rolling hash in a sliding window to detect duplicates in O(n).', shrinkTrigger: null, timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'Rolling hash must handle large numbers (use modulo). Collision handling is essential. Hash the substring, not character-by-character.', faangNote: 'Google advanced variant (2023-2024). Tests that you know sliding window is a building block, not always the complete solution.', alternateApproaches: [{ technique: 'Suffix Array + LCP', tradeoff: 'Linear time but much harder to code. Rolling hash + binary search is preferred.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/longest-duplicate-substring/' }
    }
  }
  ,
  'two-pointers': {
    description: 'A technique using two index pointers moving through a data structure to reduce O(n²) brute-force pair/triplet search to O(n) or O(n²) for k-sum. Applicable when the problem involves pairs, in-place modification, partitioning, or linked list traversal where relative pointer speed matters.',
    goal: 'Cover 90% of FAANG Two Pointers questions by mastering 5 patterns, 6 templates, and 21 curated problems',
    relatedTopics: ['sliding-window', 'binary-search'],

    tagRegistry: [
      'two-pointers','converging','fast-slow','write-pointer','three-way-partition',
      'k-sum','array','string','linked-list','sorted-array','freq-map','hash-set',
      'greedy','in-place','merge','partition','prefix-sum','monotonic-stack','dynamic-programming'
    ],

    techniqueRegistry: [
      'two-pointers','sliding-window','prefix-sum','binary-search','hash-map','hash-set','monotonic-stack','sorting'
    ],
    patterns: [
      {
        id: 'P1', name: 'Converging Two Pointers',
        recognitionSignals: [
          'Array or string problem involving pairs, maxima, or symmetry checks',
          'Input is sorted OR the problem has a monotonic property (moving one pointer always improves or worsens the answer predictably)',
          'Looking for two elements satisfying a condition — shrinking the search space from both ends'
        ],
        questionIds: ['LC_167', 'LC_125', 'LC_680', 'LC_11', 'LC_977', 'LC_42', 'LC_986']
      },
      {
        id: 'P2', name: 'Fast & Slow Pointers',
        recognitionSignals: [
          'Linked list problem involving cycles, midpoints, or position-relative checks',
          'Need to find a position that is a fraction (half, one-third) of the list length without knowing the length',
          "Floyd\'s Tortoise and Hare pattern"
        ],
        questionIds: ['LC_141', 'LC_876', 'LC_234', 'LC_142', 'LC_19', 'LC_160', 'LC_287']
      },
      {
        id: 'P3', name: 'Write Pointer — Same Direction',
        recognitionSignals: [
          'In-place array modification: remove elements, move elements, filter elements',
          'Merging two sorted arrays/segments where extra space exists at one end',
          'Two pointers both move left-to-right but at different speeds — read outpaces write'
        ],
        questionIds: ['LC_26', 'LC_283', 'LC_88']
      },
      {
        id: 'P4', name: 'k-Sum Reduction',
        recognitionSignals: [
          'Find all unique pairs/triplets/quadruplets (k numbers) summing to a target',
          'Array can be sorted without losing the required output information',
          'Brute force is O(n^k) — target is O(n^(k-1))'
        ],
        questionIds: ['LC_15', 'LC_16', 'LC_18']
      },
      {
        id: 'P5', name: 'Three-Way Partition',
        recognitionSignals: [
          'Partition array into exactly 3 mutually exclusive categories in a single O(n) pass',
          'Dutch National Flag or similar color/category sort',
          'Cannot use two separate passes — must maintain three boundaries simultaneously'
        ],
        questionIds: ['LC_75']
      }
    ],

    questions: {
      'LC_167': { leetcode: 167, title: 'Two Sum II — Input Array Is Sorted',              difficulty: 'Easy',   templateRefs: ['T1'], tags: ['two-pointers','converging','array','sorted-array'], keyInsight: 'Sorted array makes the converging pointer decision deterministic: sum < target → move left right; sum > target → move right left.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'The problem is 1-indexed — return [left + 1, right + 1]. Reading the problem statement before coding is not optional here.', faangNote: null, alternateApproaches: [{ technique: 'binary-search', tradeoff: 'For each element, binary search its complement. O(n log n) — strictly worse.', complexity: 'O(n log n) time, O(1) space' }], link: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/' },
      'LC_125': { leetcode: 125, title: 'Valid Palindrome',                                 difficulty: 'Easy',   templateRefs: ['T2'], tags: ['two-pointers','converging','string'], keyInsight: 'Inner while loops advance each pointer independently past non-alphanumeric characters before every comparison. After skipping, check left < right AGAIN before comparing.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'After the inner skip loops, check `left < right` AGAIN before comparing s[left] and s[right]. If both loops ran to completion they may have crossed — a false mismatch would result.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/valid-palindrome/' },
      'LC_680': { leetcode: 680, title: 'Valid Palindrome II',                              difficulty: 'Easy',   templateRefs: ['T2'], tags: ['two-pointers','converging','string','greedy'], keyInsight: 'On the FIRST mismatch, try both options linearly — skip s[left] OR skip s[right] — and check if either remaining range is a palindrome. The helper must NOT recurse — must stay O(n).', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Do NOT make the helper recursive with a deletion counter. `isPalindromeRange` must be a plain linear scan. Recursive deletion counting blows up to O(n²).', faangNote: 'Google and Meta frequently give this as the follow-up to LC_125 in the same round. Expect it immediately after you solve the first problem.', alternateApproaches: [], link: 'https://leetcode.com/problems/valid-palindrome-ii/' },
      'LC_11':  { leetcode: 11,  title: 'Container With Most Water',                       difficulty: 'Medium', templateRefs: ['T1'], tags: ['two-pointers','converging','array','greedy'], keyInsight: 'Always move the SHORTER bar inward. Proof: moving the taller bar decreases width AND height is still bounded by the shorter bar — water can only decrease. Moving the shorter bar at least gives a chance of improvement.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'When both bars are equal height, move either pointer — both choices are correct. Do not get stuck treating this as a special case.', faangNote: "Interviewers expect you to PROVE the greedy choice. Say: 'Moving the taller bar decreases width without any possibility of increasing height since height is min(left, right). Moving the shorter bar gives a non-zero chance of improvement.'", alternateApproaches: [], link: 'https://leetcode.com/problems/container-with-most-water/' },
      'LC_977': { leetcode: 977, title: 'Squares of a Sorted Array',                       difficulty: 'Easy',   templateRefs: ['T1'], tags: ['two-pointers','converging','array','sorted-array'], keyInsight: 'The largest squares come from either end. Converge from both ends and FILL the result array from the back (index n-1 downward). Filling from the front forces you to shift elements.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(n)', gotcha: 'Fill result from n-1 down to 0. Almost everyone instinctively fills from index 0 upward, which requires knowing the smallest element first. Filling from the back picks the LARGEST remaining square each time.', faangNote: null, alternateApproaches: [{ technique: 'sorting', tradeoff: 'Square all elements then sort. O(n log n) — worse than O(n) two pointers.', complexity: 'O(n log n) time, O(n) space' }], link: 'https://leetcode.com/problems/squares-of-a-sorted-array/' },
      'LC_42':  { leetcode: 42,  title: 'Trapping Rain Water',                             difficulty: 'Hard',   templateRefs: ['T1'], tags: ['two-pointers','converging','array','dynamic-programming','prefix-sum','monotonic-stack'], keyInsight: 'Water at i = min(maxLeft, maxRight) - height[i]. Process whichever side has the SMALLER current max. If leftMax ≤ rightMax, water at left is fully determined by leftMax. Maintain leftMax and rightMax as running maximums — no arrays.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Process the side with the SMALLER max. If leftMax < rightMax, water at `left` is leftMax - height[left] because rightMax >= leftMax is guaranteed.', faangNote: 'Most common Hard two-pointer problem. Know all three approaches (prefix arrays, two pointers, monotonic stack) and their trade-offs. Interviewers often ask for O(1) space explicitly.', alternateApproaches: [{ technique: 'prefix-sum', tradeoff: 'Precompute leftMax[] and rightMax[] arrays. Easier to understand but O(n) space.', complexity: 'O(n) time, O(n) space' }, { technique: 'monotonic-stack', tradeoff: 'Process water in horizontal layers. More complex to implement.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/trapping-rain-water/' },
      'LC_141': { leetcode: 141, title: 'Linked List Cycle',                               difficulty: 'Easy',   templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list'], keyInsight: 'If a cycle exists, fast laps slow inside the cycle — they must meet. If no cycle, fast exits via null. The meeting point is NOT necessarily the cycle entry.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Check `fast !== null && fast.next !== null` — BOTH conditions before advancing. If fast.next is null and you call fast.next.next, you get a runtime error.', faangNote: 'Table stakes. The expected follow-up is LC_142 (find the cycle entry) — mention it unprompted.', alternateApproaches: [{ technique: 'hash-set', tradeoff: 'Store visited nodes in a Set. Conceptually simpler but O(n) extra memory. Interviewer will ask for the O(1) solution.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/linked-list-cycle/' },
      'LC_876': { leetcode: 876, title: 'Middle of the Linked List',                       difficulty: 'Easy',   templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list'], keyInsight: 'When fast reaches null (odd) or fast.next reaches null (even), slow is at the middle. For even-length lists this gives the SECOND middle — what LC_234 (Palindrome Linked List) and merge problems require.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Even-length list [1,2,3,4] returns node 3 (second middle), not node 2. For FIRST middle use `while (fast.next !== null && fast.next.next !== null)` as loop condition instead.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/middle-of-the-linked-list/' },
      'LC_234': { leetcode: 234, title: 'Palindrome Linked List',                          difficulty: 'Medium', templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list','in-place'], keyInsight: 'Three steps: (1) find middle with fast/slow, (2) reverse second half in-place from middle.next, (3) compare first half against reversed second half. For odd length, the true middle node is not compared — correct by design.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: "Interviewers specifically ask: 'Can you restore the original list after checking?' Always mention this upfront — it shows production code awareness. Restore by reversing the second half again after the check.", faangNote: 'Meta and Amazon favourite. Tests fast/slow + list reversal in a single problem. Proactively offering to restore the list is a concrete SDE3 signal.', alternateApproaches: [{ technique: 'hash-map', tradeoff: 'Copy values to an array, then use converging two pointers. Simpler but O(n) space.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/palindrome-linked-list/' },
      'LC_26':  { leetcode: 26,  title: 'Remove Duplicates from Sorted Array',             difficulty: 'Easy',   templateRefs: ['T4'], tags: ['two-pointers','write-pointer','array','sorted-array','in-place'], keyInsight: 'Write pointer tracks the next position for a unique element. Read pointer scans; only writes when nums[read] !== nums[write - 1]. Array is sorted so duplicates are always adjacent.', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Elements beyond the write pointer final position do NOT need to be cleared. The problem requires only returning the new length — content past that index is explicitly irrelevant.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array/' },
      'LC_283': { leetcode: 283, title: 'Move Zeroes',                                     difficulty: 'Easy',   templateRefs: ['T4'], tags: ['two-pointers','write-pointer','array','in-place'], keyInsight: 'Write pointer collects all non-zero elements in-place preserving order. After the write pass, fill positions from write to n-1 with zeros. Two linear passes, both O(n).', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Overwrite (not swap) in the first pass. After the pass, explicitly zero-fill the tail. Swapping works but requires careful reasoning — two passes is cleaner and easier to defend.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/move-zeroes/' },
      'LC_88':  { leetcode: 88,  title: 'Merge Sorted Array',                              difficulty: 'Easy',   templateRefs: ['T4'], tags: ['two-pointers','write-pointer','array','sorted-array','merge','in-place'], keyInsight: 'Merge from the END of both arrays into the back of nums1. Merging from the front overwrites elements in nums1 that have not been compared yet. The extra space at the back is exactly the scratch space needed.', shrinkTrigger: null, timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: "After the main while loop: if nums2 still has elements (j >= 0), copy them. If nums1 still has elements (i >= 0), they are already in place — do nothing. Getting this wrong is the most common bug.", faangNote: "State before coding: 'I will merge from the end to avoid overwriting elements in nums1 that I haven\'t used yet.' That sentence signals experience.", alternateApproaches: [], link: 'https://leetcode.com/problems/merge-sorted-array/' },
      'LC_15':  { leetcode: 15,  title: '3Sum',                                            difficulty: 'Medium', templateRefs: ['T6'], tags: ['two-pointers','converging','k-sum','array','sorting'], keyInsight: 'Sort first — enables both the two-pointer inner loop AND the duplicate-skip logic. Three independent duplicate-skip conditions: (1) skip outer i if nums[i] === nums[i-1], (2) after recording skip left past duplicates, (3) skip right past duplicates. All three are mandatory.', shrinkTrigger: null, timeComplexity: 'O(n²)', spaceComplexity: 'O(1)', gotcha: 'The duplicate skip for i must check `i > 0`. Without this guard, when i=0 you compare nums[0] with nums[-1] which is undefined — the condition fires incorrectly and skips valid solutions.', faangNote: 'Most tested k-sum problem across all FAANG. A correct implementation with all three duplicate skips in the right places is sufficient. Any skip missing produces duplicate triplets — wrong answer.', alternateApproaches: [{ technique: 'hash-map', tradeoff: 'Fix two elements, look up complement in a hash set. Duplicate handling becomes more complex. Two pointers preferred.', complexity: 'O(n²) time, O(n) space' }], link: 'https://leetcode.com/problems/3sum/' },
      'LC_16':  { leetcode: 16,  title: '3Sum Closest',                                   difficulty: 'Medium', templateRefs: ['T6'], tags: ['two-pointers','converging','k-sum','array','sorting'], keyInsight: 'Same T6 structure as LC_15 (3Sum). Track closest sum instead of collecting exact matches. No duplicate-collection logic needed — only one closest value tracked. Update when |sum - target| < |closest - target|.', shrinkTrigger: null, timeComplexity: 'O(n²)', spaceComplexity: 'O(1)', gotcha: 'Initialize closest to nums[0] + nums[1] + nums[2], not Infinity. Return immediately if sum === target — closest possible.', faangNote: 'Solve immediately after LC_15 (3Sum). Same template, simpler because no duplicate collection. Demonstrates pattern recognition — a good signal during interviews.', alternateApproaches: [], link: 'https://leetcode.com/problems/3sum-closest/' },
      'LC_75':  { leetcode: 75,  title: 'Sort Colors',                                    difficulty: 'Medium', templateRefs: ['T5'], tags: ['two-pointers','three-way-partition','array','sorting','in-place'], keyInsight: 'Three-pointer invariant: [0..low-1]=0s, [low..mid-1]=1s, [mid..high]=unexamined, [high+1..n-1]=2s. Process mid: swap with low+increment both (safe); skip+increment mid (already 1); swap with high+decrement high but NOT mid (incoming unknown).', shrinkTrigger: null, timeComplexity: 'O(n) — single pass', spaceComplexity: 'O(1)', gotcha: 'After swapping nums[mid] with nums[high]: do NOT increment mid. The value from high is unknown — could be 0, 1, or 2. After swapping with nums[low]: safe to increment mid because the low-region only contains already-processed 0s so incoming must be 1.', faangNote: "Dijkstra\'s Dutch National Flag problem. Expected to know by name in senior interviews. The asymmetric increment logic is the precise point interviewers probe.", alternateApproaches: [{ technique: 'sorting', tradeoff: 'Standard sort O(n log n). Two-pass counting sort O(n) but 2 passes. Dutch National Flag is O(n) single pass — always preferred.', complexity: 'O(n log n) time, O(1) space' }], link: 'https://leetcode.com/problems/sort-colors/' },
      'LC_19':  { leetcode: 19,   title: 'Remove Nth Node From End of List',        difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/',        templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list','offset'], alternateApproaches: [{ technique: 'two-pass', moduleRef: null, tradeoff: 'First pass counts length L. Second pass traverses to node L-n. O(2L) time — same asymptotic but two traversals. One-pass offset technique is strictly cleaner.', complexity: 'O(L) time, O(1) space' }], keyInsight: 'Advance fast pointer n+1 steps from a dummy head, then advance both at the same pace. When fast reaches null, slow is exactly at the node BEFORE the target — enabling O(1) deletion via slow.next = slow.next.next.', shrinkTrigger: 'Advance fast n+1 times from dummy. Then: while (fast !== null) advance both. slow.next = slow.next.next.', timeComplexity: 'O(L) — single-pass', spaceComplexity: 'O(1)', gotcha: 'Use a dummy head node pointing to the real head. Without it, removing the head (when n === list length) requires a special case. Advance fast n+1 times (not n) so slow lands BEFORE the target node — one extra step is the entire trick.', faangNote: 'Canonical "offset fast/slow pointers" problem. State: "Advancing fast by n+1 positions slow just before the target — dummy head eliminates the edge case of removing the head." Interviewers probe whether you reach for a dummy head automatically or add conditional logic.' },
      'LC_160': { leetcode: 160,  title: 'Intersection of Two Linked Lists',           difficulty: 'Easy',   difficultyRank: 1, link: 'https://leetcode.com/problems/intersection-of-two-linked-lists/',           templateRefs: ['T3'], tags: ['two-pointers','linked-list','intersection'], alternateApproaches: [{ technique: 'hash-set', moduleRef: null, tradeoff: 'Traverse list A, add all nodes to a Set. Traverse list B — first match is the intersection. O(m) space. Interviewer will ask for O(1).', complexity: 'O(m + n) time, O(m) space' }], keyInsight: 'Redirect each pointer to the OTHER list head when it reaches null. After m+n steps both pointers have traversed equal total distance and converge at the intersection — or both reach null simultaneously if no intersection exists.', shrinkTrigger: 'While (pA !== pB): pA = pA ? pA.next : headB; pB = pB ? pB.next : headA. Return pA.', timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: 'The loop exits cleanly with no intersection — both pointers reach null at the same step after traversing m+n nodes each. Do NOT special-case null; the redirect IS the termination condition when there is no intersection.', faangNote: 'Meta (Facebook) classic. One sentence: "Both pointers walk total distance m+n regardless of start — they synchronize at the intersection." The hash-set approach scores partial credit; the redirect approach demonstrates insight. Interviewers explicitly ask for O(1) space.' },
      'LC_142': { leetcode: 142, title: 'Linked List Cycle II',                            difficulty: 'Medium', templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list','math'], keyInsight: 'Phase 1: detect the meeting point using fast/slow. Phase 2: reset one pointer to head, keep the other at the meeting point, advance both one step at a time — they meet at the cycle entry. The math: distance from head to entry = distance from meeting point to entry (mod cycle length).', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Do NOT reset both pointers to head. Only one goes back to head. The other stays at the meeting point from Phase 1. Moving both pointers one step at a time (not two) is critical in Phase 2.', faangNote: 'Meta and Amazon ask this as the immediate follow-up to LC_141. When you solve 141, proactively say: "The follow-up is finding the cycle entry — reset one pointer to head, advance both at speed 1, they meet at the entry point." That unprompted insight is a strong SDE3 signal.', alternateApproaches: [{ technique: 'hash-set', tradeoff: 'Store visited nodes, return first revisited. O(n) space — interviewer will ask for O(1).', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/linked-list-cycle-ii/' },
      'LC_287': { leetcode: 287, title: 'Find the Duplicate Number', difficulty: 'Medium', templateRefs: ['T3'], tags: ['two-pointers','fast-slow','array','cycle-detection','math'], keyInsight: 'Map the array to a linked list: treat each index i as a node whose "next" pointer is nums[i]. Since all values are in [1,n] and the array has n+1 elements, following next pointers forever must create a cycle. The duplicate is the cycle ENTRY — found by Phase 2 of Floyd\'s algorithm.', shrinkTrigger: 'Phase 1: slow = nums[slow], fast = nums[nums[fast]] until they meet. Phase 2: reset one pointer to index 0; advance both one step at a time until they meet — that index is the duplicate.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Index 0 is the safe "dummy head" entry point — no value in [1,n] ever points back to 0, so following next from 0 always enters the list properly. Do NOT start both pointers at nums[0]; start them at index 0 itself so Phase 2 correctly resets to the list origin.', faangNote: 'The key signal interviewers score separately from the code: "I model this array as a linked list where nums[i] is the next pointer. Since all n+1 values lie in [1,n], every node has a valid successor — guaranteed cycle. The duplicate is the cycle entry." Recognizing the linked-list mapping is the entire insight. Without it, the O(1) space solution is invisible.', alternateApproaches: [{ technique: 'binary-search', tradeoff: 'For each candidate mid in [1,n], count elements ≤ mid. If count > mid, the duplicate is in [1,mid]. O(n log n) — meets the no-modification constraint but fails the O(n) time requirement if stated.', complexity: 'O(n log n) time, O(1) space' }, { technique: 'hash-set', tradeoff: 'Track seen values — return first revisited. O(n) time but O(n) space. Interviewer will ask for O(1) space.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/find-the-duplicate-number/' },
      'LC_986': { leetcode: 986, title: 'Interval List Intersections', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/interval-list-intersections/', templateRefs: ['T1'], tags: ['two-pointers','converging','array','interval','sorting'], alternateApproaches: [], keyInsight: 'Two pointers, one per list. Compute intersection as [max(a.start, b.start), min(a.end, b.end)] — record it if lo <= hi. Advance the pointer whose interval ends FIRST (it cannot contribute to future intersections with the other list).', shrinkTrigger: 'Advance i if firstList[i].end <= secondList[j].end, else advance j. Terminates when either list is exhausted.', timeComplexity: 'O(m + n)', spaceComplexity: 'O(1) — output list aside', gotcha: 'Advance the pointer with the EARLIER end time, not the earlier start. Proof: the earlier-ending interval cannot intersect any future interval from the other list — those all start at or after the current pointer position.', faangNote: 'Meta screener staple. Tests two-pointer converging logic across two independent arrays. The SD3 signal: stating "advance whichever ends first" with the proof before touching the keyboard.' },

      'LC_18':  { leetcode: 18,  title: '4Sum',                                            difficulty: 'Medium', templateRefs: ['T6'], tags: ['two-pointers','converging','k-sum','array','sorting'], keyInsight: 'Direct extension of 3Sum. Two nested for loops fix the outer two elements; converging two pointers solve the inner 2Sum. Duplicate skipping is required at ALL four levels. The outermost check: skip if nums[i] === nums[i-1] (and i > 0), then skip if nums[j] === nums[j-1] (and j > i+1).', shrinkTrigger: null, timeComplexity: 'O(n³)', spaceComplexity: 'O(1)', gotcha: 'The j duplicate skip guard must be j > i+1, NOT j > 0. Using j > 0 skips valid solutions when i advances and j resets to i+1. This is the most common bug — it differs from the 3Sum outer guard by one level of nesting.', faangNote: 'Google and Amazon ask 4Sum as a natural extension of 3Sum to test pattern generalisation. The insight they want: "kSum reduces to (k-1)Sum with a for loop — base case is always 2Sum with two pointers." State the general reduction before writing any code.', alternateApproaches: [], link: 'https://leetcode.com/problems/4sum/' }
    }
  }
  ,
  'binary-search': {
    description: 'A divide-and-conquer search technique that eliminates half the search space at each step. Applicable whenever a monotonic predicate can be defined over a sorted or structured space. The pattern extends beyond sorted arrays to answer spaces, 2D matrices, and structural array properties.',
    goal: 'Cover 90% of FAANG Binary Search questions by mastering 6 patterns, 6 templates, and 21 curated problems',
    relatedTopics: ['two-pointers', 'sliding-window'],

    tagRegistry: [
      'binary-search','exact-search','boundary-search','lower-bound','upper-bound','predicate',
      'rotated-array','answer-space','feasibility','matrix','staircase-search','array',
      'sorted-array','divide-and-conquer','greedy','two-pointers','prefix-sum','math'
    ],

    techniqueRegistry: [
      'binary-search','two-pointers','prefix-sum','sorting','greedy','divide-and-conquer'
    ],
    patterns: [
      {
        id: 'P1', name: 'Classic Exact Binary Search',
        recognitionSignals: [
          'Find an exact target value in a sorted array',
          'Return the index of the target or -1 if absent',
          'Three-way branch: found / go left / go right'
        ],
        questionIds: ['LC_704']
      },
      {
        id: 'P2', name: 'Boundary / Predicate Binary Search',
        recognitionSignals: [
          'Find the FIRST or LAST position satisfying a condition',
          'Search insert position, lower/upper bound',
          'Array has a structural property (peak, single element, parity) enabling binary search even without full sorting'
        ],
        questionIds: ['LC_35', 'LC_34', 'LC_278', 'LC_162', 'LC_540', 'LC_658']
      },
      {
        id: 'P3', name: 'Rotated / Modified Sorted Array',
        recognitionSignals: [
          'Array was sorted but rotated at an unknown pivot',
          'Contains duplicates that complicate the sorted-half determination',
          'Find minimum or search for a target in this modified structure'
        ],
        questionIds: ['LC_153', 'LC_33', 'LC_81']
      },
      {
        id: 'P4', name: 'Binary Search on Answer Space',
        recognitionSignals: [
          'The answer is a value in a range, not an index in the array',
          'Problem asks to minimize or maximize a value subject to a constraint',
          "A feasibility check ('can we achieve X?') can be written in O(n) or better"
        ],
        questionIds: ['LC_875', 'LC_1011', 'LC_410', 'LC_719', 'LC_1482']
      },
      {
        id: 'P5', name: '2D Matrix Search',
        recognitionSignals: [
          'Search in a 2D matrix with sorted rows and/or columns',
          'Determine if binary search applies based on the EXACT sorting structure'
        ],
        questionIds: ['LC_74', 'LC_240', 'LC_378', 'LC_1351']
      },
      {
        id: 'P6', name: 'Canonical Hard — Partition-Based Binary Search',
        recognitionSignals: [
          'Finding a statistical property (median, kth element) across multiple sorted arrays',
          'Partitioning two arrays simultaneously to maintain a global sorted invariant'
        ],
        questionIds: ['LC_4', 'LC_786']
      }
    ],

    questions: {
      'LC_704': { leetcode: 704, title: 'Binary Search',                                          difficulty: 'Easy',   templateRefs: ['T1'], tags: ['binary-search','exact-search','array','sorted-array'], keyInsight: 'Pure T1 baseline. Master the exact template — `while (left <= right)`, `right = mid - 1` and `left = mid + 1` (never `mid`), return -1 if loop exits. Every other binary search template derives from this.', shrinkTrigger: 'nums[mid] < target → left = mid + 1. nums[mid] > target → right = mid - 1.', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'Always compute mid as `left + Math.floor((right - left) / 2)`, not `Math.floor((left + right) / 2)`. The latter can overflow in languages with fixed-width integers. Use the safe idiom in every binary search — interviewers notice.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/binary-search/' },
      'LC_35':  { leetcode: 35,  title: 'Search Insert Position',                                difficulty: 'Easy',   templateRefs: ['T2'], tags: ['binary-search','boundary-search','lower-bound','array','sorted-array'], keyInsight: 'This is pure lower_bound: find the first index where nums[x] >= target. Use T2 with right = nums.length (open right bound). If target is larger than all elements, result is nums.length — a valid insertion point. This subroutine recurs in dozens of harder problems.', shrinkTrigger: 'nums[mid] < target → lo = mid + 1. nums[mid] >= target → mid is a candidate, keep it (hi = mid).', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'T2 uses `while (left < right)` NOT `left <= right`. Using `<=` causes an infinite loop when the update rule is `right = mid`. The two templates have DIFFERENT loop conditions for structural reasons — never mix them.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/search-insert-position/' },
      'LC_34':  { leetcode: 34,  title: 'Find First and Last Position of Element in Sorted Array', difficulty: 'Medium', templateRefs: ['T2','T3'], tags: ['binary-search','boundary-search','lower-bound','upper-bound','array','sorted-array'], keyInsight: 'Two independent binary searches: (1) T2 to find the leftmost index, (2) T3 to find the rightmost. Do not try to combine into one pass. If T2 returns an index but nums[that index] !== target, return [-1, -1].', shrinkTrigger: 'Left: nums[mid] < target → left = mid + 1; >= target → right = mid. Right: nums[mid] === target → result = mid, left = mid + 1; > target → right = mid - 1.', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'After the left-boundary search, always validate: `if (left === nums.length || nums[left] !== target) return [-1, -1]`. Skipping this causes a false positive when target is absent.', faangNote: 'Tests both T2 and T3 in sequence. Interviewers expect exactly two binary searches. Attempting a single merged search always produces off-by-one errors.', alternateApproaches: [], link: 'https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/' },
      'LC_278': { leetcode: 278, title: 'First Bad Version',                                      difficulty: 'Easy',   templateRefs: ['T2'], tags: ['binary-search','boundary-search','predicate','lower-bound'], keyInsight: 'The predicate is `isBadVersion(mid)`. Sequence is always good...good...bad...bad (monotonic). Apply the `firstTrue` variant of T2 directly. This problem teaches the predicate abstraction — the array is irrelevant; only the predicate matters.', shrinkTrigger: 'isBadVersion(mid) === true → mid is a candidate, keep it (hi = mid). isBadVersion(mid) === false → discard left (lo = mid + 1).', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'Minimize API calls — the explicit constraint. Never call isBadVersion more than once per iteration (e.g., on mid-1 or mid+1). The template calls it exactly once per loop iteration.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/first-bad-version/' },
      'LC_162': { leetcode: 162, title: 'Find Peak Element',                                      difficulty: 'Medium', templateRefs: ['T2'], tags: ['binary-search','boundary-search','predicate','array'], keyInsight: 'The array is NOT fully sorted, yet binary search works due to a structural guarantee. If nums[mid] < nums[mid+1], a peak exists in [mid+1, n-1]. If nums[mid] > nums[mid+1], a peak exists in [left, mid]. Predicate: `nums[mid] > nums[mid+1]`.', shrinkTrigger: 'nums[mid] < nums[mid+1] → peak is RIGHT (lo = mid + 1). nums[mid] > nums[mid+1] → peak is at mid or LEFT (hi = mid).', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'Binary search works here because of the implicit boundary conditions: nums[-1] = nums[n] = -∞. This guarantees a peak exists in every valid subarray. State this assumption to the interviewer before coding.', faangNote: 'Teaches that binary search does not require a fully sorted array — only a monotonic predicate. Mastering this unlocks LC_540 (Single Element in a Sorted Array) and similar structural property problems.', alternateApproaches: [], link: 'https://leetcode.com/problems/find-peak-element/' },
      'LC_540': { leetcode: 540, title: 'Single Element in a Sorted Array',                       difficulty: 'Medium', templateRefs: ['T2'], tags: ['binary-search','boundary-search','predicate','array','sorted-array'], keyInsight: 'Before the single element, pairs occupy even-odd index positions: nums[0]===nums[1], nums[2]===nums[3], etc. After the single element, parity flips. Predicate: if mid is even and nums[mid]===nums[mid+1], single element is to the RIGHT. Always normalize mid to be even.', shrinkTrigger: 'mid is even and nums[mid] === nums[mid+1] → single is RIGHT (lo = mid + 2). Otherwise → single is at mid or LEFT (hi = mid).', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'Force mid to be even: `if (mid % 2 === 1) mid--`. This normalizes the parity check. Without this, the condition depends on whether mid is even or odd — two asymmetric cases instead of one.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/single-element-in-a-sorted-array/' },
      'LC_153': { leetcode: 153, title: 'Find Minimum in Rotated Sorted Array',                   difficulty: 'Medium', templateRefs: ['T5'], tags: ['binary-search','rotated-array','array','sorted-array'], keyInsight: 'Compare nums[mid] with nums[right] (not nums[left]). If nums[mid] > nums[right], minimum is in the RIGHT half. If nums[mid] < nums[right], minimum is in the LEFT half including mid. Loop terminates when left === right — that is the minimum.', shrinkTrigger: 'nums[mid] > nums[right] → minimum is RIGHT (left = mid + 1). nums[mid] <= nums[right] → mid could be minimum, keep it (right = mid).', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: 'Compare against nums[right], NOT nums[left]. Comparing against nums[left] breaks for the non-rotated case (pivot at index 0). Comparing against nums[right] is always unambiguous.', faangNote: null, alternateApproaches: [], link: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/' },
      'LC_33':  { leetcode: 33,  title: 'Search in Rotated Sorted Array',                         difficulty: 'Medium', templateRefs: ['T5'], tags: ['binary-search','rotated-array','array','sorted-array'], keyInsight: 'At any mid, left half [left..mid] is sorted if nums[left] <= nums[mid]. Check if target is in the sorted half using a range check. Two nested branches, each checking range membership.', shrinkTrigger: 'Left sorted + target in [nums[left], nums[mid]) → right = mid - 1. Left sorted + target not in range → left = mid + 1. Right sorted + target in (nums[mid], nums[right]] → left = mid + 1. Right sorted + target not in range → right = mid - 1.', timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', gotcha: "The sorted-half check uses `nums[left] <= nums[mid]` with `<=` (not strict `<`). When left === mid (two-element subarray), left half is trivially sorted — the `<=` handles this. Using strict `<` misclassifies two-element subarrays.", faangNote: 'Most tested rotated array problem across all FAANG. Draw it on the whiteboard — interviewers want to see the reasoning, not just the code.', alternateApproaches: [], link: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
      'LC_81':  { leetcode: 81,  title: 'Search in Rotated Sorted Array II',                      difficulty: 'Medium', templateRefs: ['T5'], tags: ['binary-search','rotated-array','array','sorted-array'], keyInsight: 'LC_33 (Search in Rotated Sorted Array) with duplicates. When nums[left] === nums[mid] === nums[right], it is impossible to determine which half is sorted. Solution: shrink both ends (left++, right--) and retry. This is the ONLY code change from LC_33.', shrinkTrigger: 'nums[left] === nums[mid] === nums[right] → cannot determine sorted half, shrink both ends. Otherwise identical to LC_33.', timeComplexity: 'O(log n) average, O(n) worst case — when all elements are duplicates', spaceComplexity: 'O(1)', gotcha: 'State the O(n) worst case to the interviewer BEFORE coding. Example: [1,1,1,1,1,1,2,1,1,1,1]. Never claim O(log n) unconditionally for this problem.', faangNote: 'The value of this problem is the O(n) worst-case discussion, not the implementation. Solve LC_33 first; the only code delta is the three-equality guard.', alternateApproaches: [], link: 'https://leetcode.com/problems/search-in-rotated-sorted-array-ii/' },
      'LC_875': { leetcode: 875, title: 'Koko Eating Bananas',                                    difficulty: 'Medium', templateRefs: ['T4'], tags: ['binary-search','answer-space','feasibility','array','greedy'], keyInsight: 'Answer space: [1, max(piles)]. isFeasible(speed): sum of ceil(pile/speed) for all piles <= h. Monotonic: if speed k works, k+1 also works. Binary search finds the minimum k.', shrinkTrigger: 'isFeasible(mid) === true → try smaller speed (hi = mid). isFeasible(mid) === false → must go faster (lo = mid + 1).', timeComplexity: 'O(n log m) where m = max(piles)', spaceComplexity: 'O(1)', gotcha: 'Use `Math.ceil(pile / speed)` not `Math.floor(pile / speed) + 1`. The floor+1 version overcounts when pile is exactly divisible by speed. Alternative: `Math.floor((pile + speed - 1) / speed)`.', faangNote: 'The canonical first problem for learning P4. Once you solve this, LC_1011 and LC_410 follow the exact same three steps: identify lo/hi, write isFeasible, apply T4.', alternateApproaches: [], link: 'https://leetcode.com/problems/koko-eating-bananas/' },
      'LC_1011':{ leetcode: 1011,title: 'Capacity To Ship Packages Within D Days',               difficulty: 'Medium', templateRefs: ['T4'], tags: ['binary-search','answer-space','feasibility','array','greedy'], keyInsight: 'Answer space: [max(weights), sum(weights)]. lo = largest single weight (minimum possible capacity). hi = total sum. isFeasible(capacity): simulate shipping greedily — accumulate weights, start new day when current load would exceed capacity. Count days; check <= d.', shrinkTrigger: 'isFeasible(mid) === true → try smaller capacity (hi = mid). isFeasible(mid) === false → capacity too small (lo = mid + 1).', timeComplexity: 'O(n log(sum(weights)))', spaceComplexity: 'O(1)', gotcha: 'lo must be max(weights), not 1. A capacity smaller than the heaviest package makes the problem unsolvable — the feasibility check always fails but the binary search would not terminate correctly. Incorrect lo is the #1 bug in P4 problems.', faangNote: 'Solve immediately after LC_875. The isFeasible function differs but the three-step structure is identical. This confirms you have internalized P4 as a pattern.', alternateApproaches: [], link: 'https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/' },
      'LC_410': { leetcode: 410, title: 'Split Array Largest Sum',                                difficulty: 'Hard',   templateRefs: ['T4'], tags: ['binary-search','answer-space','feasibility','array','greedy','prefix-sum'], keyInsight: 'Answer space: [max(nums), sum(nums)]. isFeasible(maxSum): can you split nums into at most k subarrays where each sum <= maxSum? Greedy check: accumulate elements, start new subarray when adding the next would exceed maxSum. If subarrays needed <= k, feasible.', shrinkTrigger: 'isFeasible(mid) === true → try smaller max sum (hi = mid). isFeasible(mid) === false → max sum too small (lo = mid + 1).', timeComplexity: 'O(n log(sum(nums)))', spaceComplexity: 'O(1)', gotcha: 'Since lo = max(nums), every individual element always fits within the capacity — the case of a single element exceeding maxSum cannot occur. This simplifies the greedy check.', faangNote: 'The P4 Hard benchmark. Demonstrating that you can construct the greedy isFeasible for this problem proves P4 mastery. Interviewers also accept DP but expect you to recognize binary search is better.', alternateApproaches: [{ technique: 'prefix-sum', tradeoff: 'DP solution O(n²k) or O(nk) with prefix sums. Binary search + greedy is O(n log(sum)) — strictly better.', complexity: 'O(n * k) time, O(n * k) space' }], link: 'https://leetcode.com/problems/split-array-largest-sum/' },
      'LC_74':  { leetcode: 74,  title: 'Search a 2D Matrix',                                    difficulty: 'Medium', templateRefs: ['T6'], tags: ['binary-search','matrix','array','sorted-array'], keyInsight: "The row-major property (each row\'s last < next row\'s first) means the entire matrix is one sorted sequence read left-to-right, top-to-bottom. Map 1D index mid to (row, col) via T6. Apply T1 on the virtual 1D array of length rows*cols.", shrinkTrigger: 'matrix[row][col] < target → left = mid + 1. matrix[row][col] > target → right = mid - 1.', timeComplexity: 'O(log(m * n))', spaceComplexity: 'O(1)', gotcha: 'Verify the row-major property holds before applying T6. LC_74 guarantees it; LC_240 does NOT. Applying T6 to LC_240 produces wrong answers. This distinction is the interview insight.', faangNote: null, alternateApproaches: [{ technique: 'two-pointers', tradeoff: 'Staircase from top-right: O(m+n). Works on LC_74 but is suboptimal — O(log mn) binary search is better when the row-major property holds.', complexity: 'O(m+n) time, O(1) space' }], link: 'https://leetcode.com/problems/search-a-2d-matrix/' },
      'LC_240': { leetcode: 240, title: 'Search a 2D Matrix II',                                  difficulty: 'Medium', templateRefs: [], tags: ['binary-search','matrix','staircase-search','two-pointers','array'], keyInsight: 'IMPORTANT: This problem does NOT have the row-major property — T6 does NOT apply. Optimal: staircase elimination from the TOP-RIGHT corner: if matrix[row][col] > target, move LEFT (col--); if < target, move DOWN (row++). This is a two-pointer technique, not binary search.', shrinkTrigger: 'matrix[row][col] > target → col--. matrix[row][col] < target → row++. Stop when found or out of bounds.', timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: "State to the interviewer: 'This matrix does not have the row-major property so I cannot use the 1D-mapping approach — I will use staircase elimination instead.' Recognizing when NOT to apply binary search is the actual test.", faangNote: 'Interviewers use LC_240 immediately after LC_74 to test whether you blindly apply binary search or understand its preconditions. The correct answer is the staircase as the optimal approach.', alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary search each row independently: O(m log n). Not optimal — staircase is O(m+n).', complexity: 'O(m log n) time, O(1) space' }], link: 'https://leetcode.com/problems/search-a-2d-matrix-ii/' },
      'LC_4':   { leetcode: 4,   title: 'Median of Two Sorted Arrays',                            difficulty: 'Hard',   templateRefs: ['T2'], tags: ['binary-search','boundary-search','divide-and-conquer','array','sorted-array','math'], keyInsight: "Binary search on the smaller array\'s partition index. For partition i in nums1 and j = (m+n+1)/2 - i in nums2: the partition is correct when maxLeft1 <= minRight2 AND maxLeft2 <= minRight1. If maxLeft1 > minRight2: i too large (right = i - 1). If maxLeft2 > minRight1: i too small (left = i + 1).", shrinkTrigger: 'maxLeft1 > minRight2 → partition of nums1 too far right (right = mid - 1). maxLeft2 > minRight1 → partition of nums1 too far left (left = mid + 1).', timeComplexity: 'O(log(min(m, n)))', spaceComplexity: 'O(1)', gotcha: 'Always binary search on the SMALLER array (swap if needed). Handle edge cases: when a partition is at index 0 (no left elements), maxLeft = -Infinity; when at index n (no right elements), minRight = Infinity.', faangNote: 'The canonical hardest binary search problem. The O(m+n) merge solution is explicitly suboptimal and rejected. The partition invariant is the insight. Draw the four boundary values before coding and walk the interviewer through the invariant — this problem is scored on reasoning clarity.', alternateApproaches: [{ technique: 'two-pointers', tradeoff: 'Merge both arrays, stop at median position. O(m+n) — fails the O(log(m+n)) requirement in the problem statement.', complexity: 'O(m+n) time, O(1) space' }], link: 'https://leetcode.com/problems/median-of-two-sorted-arrays/' },
      'LC_1482': { leetcode: 1482, title: 'Minimum Number of Days to Make m Bouquets', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/minimum-number-of-days-to-make-m-bouquets/', templateRefs: ['T4'], tags: ['binary-search','answer-space','feasibility','array'], alternateApproaches: [], keyInsight: 'Binary search on the answer (number of days) in [min(bloomDay), max(bloomDay)]. isFeasible(days): linear scan counting consecutive bloomed flowers, accumulating complete bouquets of size k. If total bouquets >= m, feasible.', shrinkTrigger: 'If feasible(mid): hi = mid. Else: lo = mid + 1. First day where feasible is the answer.', timeComplexity: 'O(n log D) where D = max(bloomDay)', spaceComplexity: 'O(1)', gotcha: 'Early exit: if m * k > n return -1 immediately — not enough flowers regardless of days. Missing this produces wrong output instead of -1 on impossible inputs.', faangNote: 'Teaches the compound feasibility check pattern — the check itself contains non-trivial linear logic (consecutive grouping), not just a single comparison. Contrasting this with LC_875 (single comparison check) is a strong interview signal.' },

      'LC_786': { leetcode: 786, title: 'K-th Smallest Prime Fraction', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/k-th-smallest-prime-fraction/', templateRefs: ['T6'], tags: ['binary-search','answer-space','feasibility','math','array','two-pointers'], alternateApproaches: [{ technique: 'min-heap', tradeoff: 'Push fractions with smallest denominator per numerator. Pop k times. O(n + k log n) — worse for large k.', complexity: 'O(n + k log n) time, O(n) space' }], keyInsight: 'Binary search on a FLOATING-POINT answer in [0.0, 1.0]. isFeasible(mid): for each numerator arr[i], two-pointer counts fractions arr[i]/arr[j] <= mid and tracks the largest such fraction (the candidate answer). When count == k exactly, return the tracked candidate.', shrinkTrigger: 'If count < k: lo = mid. If count > k: hi = mid. Terminate when hi - lo < 1e-9 (fixed ~100 iterations).', timeComplexity: 'O(n log(1/eps)) — roughly O(n * 100) for double precision', spaceComplexity: 'O(1)', gotcha: 'Termination is NOT lo > hi. Use a fixed iteration count (~100-200) or hi - lo < 1e-9. Integer-style termination never exits on floating-point values.', faangNote: 'P6 distinguishing problem: shows binary search answers need not be integers and that the feasibility check can itself embed two-pointer logic. Google uses this to test whether candidates can compose two techniques inside one solution.' },

      'LC_719': { leetcode: 719, title: 'Find K-th Smallest Pair Distance', difficulty: 'Hard', templateRefs: ['T4'], tags: ['binary-search','answer-space','feasibility','sliding-window','sorting','two-pointers','array'], keyInsight: 'Binary search on the ANSWER: distance value in [0, nums[n-1]-nums[0]] after sorting. isFeasible(mid): count pairs with distance <= mid using a sliding window on the sorted array — for each right, advance left while nums[right]-nums[left] > mid, then count += right - left. If count >= k, the k-th smallest distance is <= mid.', shrinkTrigger: 'Sort first. isFeasible(mid): sliding window count — for each right, while nums[right]-nums[left] > mid: left++. count += right - left. If count >= k → hi = mid. Else → lo = mid + 1.', timeComplexity: 'O(n log n + n log W) where W = nums[n-1]-nums[0]', spaceComplexity: 'O(1) excluding sort', gotcha: 'Sort the array first before binary search — the sliding window feasibility check is only correct on sorted input. lo = 0 (duplicates can have zero distance), hi = nums[n-1]-nums[0]. Count pairs in O(n) with the sliding window; a naive O(n^2) count inside isFeasible makes total complexity O(n^2 log W) — too slow.', faangNote: 'The highest-signal binary search problem in FAANG rounds: it forces explicit composition of two modules. Say: "The answer space is [0, max-min]. The feasibility function asks how many pairs have distance <= mid — that is a sliding window COUNT problem on the sorted array. Binary search on the answer space with sliding window as the feasibility check." Recognizing the cross-module composition is the SDE3 signal.', alternateApproaches: [], link: 'https://leetcode.com/problems/find-k-th-smallest-pair-distance/' },
      'LC_378':  { leetcode: 378,  title: 'Kth Smallest Element in a Sorted Matrix',       difficulty: 'Medium', tags: ['binary-search','answer-space','staircase-search','matrix','sorted-array'], keyInsight: 'Binary search on the VALUE range [matrix[0][0], matrix[n-1][n-1]]. For candidate mid, count elements <= mid using staircase: start at top-right (row=0, col=n-1). If matrix[row][col] <= mid: count += col+1, row++. Else: col--. If count >= k → hi = mid. Else → lo = mid + 1.', shrinkTrigger: 'countLeqMid >= k → hi = mid. countLeqMid < k → lo = mid + 1.', timeComplexity: 'O(n log(max−min))', spaceComplexity: 'O(1)', gotcha: 'The staircase count starts at TOP-RIGHT and adds whole columns (count += col+1 means columns 0..col all <= mid on that row). lo and hi must equal actual matrix values so that the final lo is always a real element in the matrix — guaranteed termination on a valid answer.', faangNote: 'Bridge problem between P4 (answer-space binary search) and P6 staircase. Recognizing that the feasibility function is a staircase count is the SDE3 signal. Interviewers accept a min-heap O(k log n) but the binary search solution demonstrates deeper pattern mastery.', alternateApproaches: [{ technique: 'heap', tradeoff: 'Min-heap with initial row: O(k log n). Simpler code but worse when k is large.', complexity: 'O(k log n) time, O(n) space' }], link: 'https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/' },
      'LC_1351': { leetcode: 1351, title: 'Count Negative Numbers in a Sorted Matrix',     difficulty: 'Easy',   tags: ['staircase-search','matrix','two-pointers','binary-search'], keyInsight: 'Staircase from BOTTOM-LEFT: start at grid[m-1][0]. If negative: all elements to the right on this row are also negative → count += (n - col), row--. If non-negative: move right (col++). Each step eliminates a row or a column → O(m+n).', shrinkTrigger: 'grid[row][col] < 0 → count += (n − col), row--. grid[row][col] >= 0 → col++.', timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: 'Starting from bottom-left is cleaner here because rows are non-increasing left-to-right and top-to-bottom. The staircase traces the boundary between non-negative and negative values. Binary search per row is O(m log n) — correct but suboptimal; interviewers expect the staircase.', faangNote: 'Use this as a warm-up before LC_240. Teaches the staircase principle in its simplest form: one pointer, two directions, guaranteed O(m+n). Master bottom-left here, then recognize when to use top-right (LC_240, LC_378).', alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary search each row for first negative index: O(m log n). Correct but not optimal when m ≈ n.', complexity: 'O(m log n) time, O(1) space' }], link: 'https://leetcode.com/problems/count-negative-numbers-in-a-sorted-matrix/' },
      'LC_658':  { leetcode: 658,  title: 'Find K Closest Elements',                               difficulty: 'Medium', templateRefs: ['T2'], tags: ['binary-search','boundary-search','lower-bound','array','sorted-array','two-pointers'], keyInsight: 'Binary search on the LEFT BOUNDARY of the k-element window. Compare target - nums[mid] against nums[mid+k] - target. If the right side is strictly closer, shift window right (lo = mid + 1). Otherwise mid is a valid candidate for the window start (hi = mid). Window is nums[lo..lo+k-1].', shrinkTrigger: 'target - nums[mid] > nums[mid + k] - target → lo = mid + 1. Otherwise → hi = mid.', timeComplexity: 'O(log(n-k) + k)', spaceComplexity: 'O(k) — output window', gotcha: 'Set right = n - k (not n - 1) so the window of size k always fits. The comparison is strict > — equal distances are left-biased because hi = mid preserves the leftmost valid window. Do not use absolute values; the signed difference is the correct comparison.', faangNote: 'Amazon and Microsoft upgrade from LC_35. State upfront: "I do not binary search the target — I binary search the start index of the k-length window." Interviewers probe the left-bias rule and why right = n - k not n - 1.', alternateApproaches: [{ technique: 'two-pointers', tradeoff: 'Converge from both ends, removing the farther element each step. O(n-k) time — strictly worse than O(log(n-k)) binary search.', complexity: 'O(n - k) time, O(k) space' }], link: 'https://leetcode.com/problems/find-k-closest-elements/' }
    }
  }
  ,
  'sorting': {
    description: 'A family of algorithms and techniques centered on ordering elements or using sorted order as a structural invariant. In FAANG interviews, sorting appears in three distinct forms: (1) implementing a sort algorithm from scratch to test algorithmic depth, (2) choosing the correct sort key to reduce a hard problem to a simple greedy scan, and (3) recognizing when linear-time or partial sorting is needed to satisfy an O(n) or O(n log n) complexity constraint.',
    goal: 'Cover 90% of FAANG Sorting questions by mastering 6 patterns, 6 templates, and 21 curated problems',
    relatedTopics: ['binary-search', 'two-pointers', 'sliding-window', 'prefix-sum', 'heap'],
    tagRegistry: ['sorting','merge-sort','quicksort','quickselect','bucket-sort','counting-sort','custom-comparator','multi-key-sort','interval','greedy','inversion-count','array','string','linked-list','hash-map','two-pointers','binary-search','prefix-sum','heap','divide-and-conquer','in-place'],
    techniqueRegistry: ['sorting','merge-sort','quickselect','bucket-sort','two-pointers','binary-search','heap','greedy','hash-map'],
    patterns: [
      {
        id: 'P1', name: 'Merge Sort Internals',
        recognitionSignals: [
          'Problem explicitly asks you to implement a sorting algorithm',
          'Input is a linked list — no random access, merge sort is the only O(n log n) option',
          'Need to COUNT something that happens during the sort (inversions, smaller elements to the right)'
        ],
        questionIds: ['LC_912', 'LC_148', 'LC_315', 'LC_493']
      },
      {
        id: 'P2', name: 'Custom Comparator',
        recognitionSignals: [
          'The natural sort order does not produce the required ordering',
          'Sort requires multiple keys (primary + secondary + ...)',
          'Sort key involves string operations — concatenation, lexicographic with exclusions'
        ],
        questionIds: ['LC_179', 'LC_937', 'LC_406']
      },
      {
        id: 'P3', name: 'Interval Sort + Greedy',
        recognitionSignals: [
          'Input is a set of intervals (pairs of start and end values)',
          'Goal involves merging, counting overlaps, or minimizing removal of overlapping intervals',
          'A sweep from left to right after sorting becomes a simple O(n) scan'
        ],
        questionIds: ['LC_56', 'LC_435', 'LC_452', 'LC_57', 'LC_253']
      },
      {
        id: 'P4', name: 'Sort as Enabler',
        recognitionSignals: [
          'Grouping elements that are equivalent under some transformation',
          'Sorting by a computed metric enables a single O(n) boundary scan',
          'The answer cannot be directly computed but becomes obvious once the array is in sorted order'
        ],
        questionIds: ['LC_49', 'LC_274', 'LC_1200', 'LC_561']
      },
      {
        id: 'P5', name: 'Quickselect — Partial Sort',
        recognitionSignals: [
          'Find the k-th largest or smallest element — full sort is not required',
          'Find k elements closest to a target or origin — exact order among those k does not matter',
          'O(n) expected time is required — O(n log n) full sort is acceptable but interviewer may ask for better'
        ],
        questionIds: ['LC_215', 'LC_973']
      },
      {
        id: 'P6', name: 'Linear-Time Sort — Bucket / Counting',
        recognitionSignals: [
          'Values or frequencies are bounded in a known range [0, k]',
          'Comparison-based O(n log n) sort is explicitly or implicitly too slow',
          'Maximum gap or spread problem — Pigeonhole principle suggests empty buckets exist'
        ],
        questionIds: ['LC_347', 'LC_164', 'LC_220']
      }
    ],
    questions: {
      'LC_912': { leetcode: 912, title: 'Sort an Array', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/sort-an-array/', templateRefs: ['T1'], tags: ['sorting','merge-sort','divide-and-conquer','array'], alternateApproaches: [{ technique: 'quicksort', moduleRef: null, tradeoff: 'Quicksort is O(n log n) average but O(n²) worst case on sorted input without random pivot. Merge sort is O(n log n) guaranteed and stable. For an interview implement-a-sort question, merge sort is harder to break with adversarial inputs.', complexity: 'O(n log n) average, O(n²) worst case time, O(log n) space' }], keyInsight: 'The merge step is the algorithm — splitting is mechanical. Use <= in the merge comparison (not <) to keep the sort stable. Merge into a temp array, then copy back. The copy-back is O(n) per level, O(n log n) total.', shrinkTrigger: 'Merge condition: if left[i] <= right[j] take from left, otherwise take from right. The <= ensures stability — equal elements from the left half appear before those from the right half.', timeComplexity: 'O(n log n) — guaranteed, all cases', spaceComplexity: 'O(n) — temp buffer used during merge', gotcha: 'Do not use in-place merge (O(n²) to shift elements). Always merge into a separate temp array. The O(n) extra space is expected and acceptable — attempting in-place merge produces an O(n²) algorithm.', faangNote: 'When asked to sort without built-in sort, always choose merge sort over quicksort in an interview. It is O(n log n) guaranteed, stable, and easier to reason about correctness.' },
      'LC_148': { leetcode: 148, title: 'Sort List', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/sort-list/', templateRefs: ['T1'], tags: ['sorting','merge-sort','linked-list','two-pointers','divide-and-conquer'], alternateApproaches: [{ technique: 'two-pointers', moduleRef: 'two-pointers', tradeoff: 'Fast/slow pointer finds the midpoint — this IS part of the merge sort algorithm here, not an alternative. The two-pointer technique is a sub-component, not a competing approach.', complexity: 'Integrated within merge sort — O(n log n) total' }], keyInsight: 'Merge sort is the only O(n log n) sort applicable to linked lists — quicksort requires random access, merge sort does not. Set fast = head.next (not head) so slow lands on the FIRST middle for even-length lists.', shrinkTrigger: 'Split condition: set slow.next = null to sever the list at mid. This gives two independent sublists for recursion.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(log n) — recursion stack depth. Bottom-up merge sort achieves O(1) space if required.', gotcha: 'Start fast at head.next, NOT head. Starting at head makes slow land on the SECOND middle for even-length lists, causing infinite recursion on two-element inputs.', faangNote: 'Interviewers often follow up: \'Can you do it in O(1) space?\' Answer: bottom-up iterative merge sort — merge sublists of size 1, then 2, then 4, without recursion. Mention proactively if time allows.' },
      'LC_315': { leetcode: 315, title: 'Count of Smaller Numbers After Self', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/count-of-smaller-numbers-after-self/', templateRefs: ['T1'], tags: ['sorting','merge-sort','inversion-count','divide-and-conquer','array','binary-search'], alternateApproaches: [{ technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'Binary indexed tree (Fenwick tree) or segment tree also solves this in O(n log n). Both are more complex to implement. Augmented merge sort reuses the T1 template directly and is more accessible in an interview.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Augment each element with its original index as (value, originalIndex) pairs. During the merge step: when a right-half element is merged before remaining left-half elements, each of those left-half elements gains one count (smaller number to its right found).', shrinkTrigger: 'Increment condition: when right[j] < left[i], ALL remaining left[i..] each get count += 1 because right[j] is smaller and was originally to their right.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n) — augmented index pairs and temp buffer', gotcha: 'The count increments by the number of right-half elements ALREADY TAKEN before this left element. Track rightMergedCount that increments each time a right-half element is taken — add this to each left-half element when it is taken.', faangNote: 'Google and Meta Hard. Tests whether you recognize that information can be computed DURING a sort, not just after.' },
      'LC_179': { leetcode: 179, title: 'Largest Number', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/largest-number/', templateRefs: ['T2'], tags: ['sorting','custom-comparator','greedy','string','array'], alternateApproaches: [], keyInsight: 'Compare two numbers a and b by comparing strings a+b vs b+a. Whichever concatenation is lexicographically larger determines which number comes first. This is a valid total order — transitivity holds. Do NOT compare by value, digit count, or leading digit alone — all produce counterexamples.', shrinkTrigger: 'Comparator return: if (b + a).localeCompare(a + b) > 0, place b before a.', timeComplexity: 'O(n log n) for sorting, each comparison O(L) where L = max digit length', spaceComplexity: 'O(n) — string array conversion', gotcha: 'Edge case — all zeros: return \'0\' not \'000\'. After sorting, if strs[0] === \'0\', the entire number is zero — return \'0\'.', faangNote: 'To prove the comparator: \'If a+b > b+a and b+c > c+b, then a+c > c+a — transitivity holds, making it a valid sort comparator.\' Drawing counterexamples for naive approaches signals depth.' },
      'LC_937': { leetcode: 937, title: 'Reorder Data in Log Files', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/reorder-data-in-log-files/', templateRefs: ['T2'], tags: ['sorting','custom-comparator','multi-key-sort','string','array'], alternateApproaches: [], keyInsight: 'Three-tier sort: (1) letter logs before digit logs, (2) letter logs sorted by content, (3) letter logs with identical content sorted by identifier. Digit logs preserve relative original order (stable sort).', shrinkTrigger: 'Comparator cascade: check log type first (return -1/1). For two letter logs: compare content, fall through to identifier if content matches. For two digit logs: return 0 to preserve order.', timeComplexity: 'O(m * n log n) where m = average log length, n = number of logs', spaceComplexity: 'O(m * n) — string splitting', gotcha: 'JavaScript\'s Array.sort() is stable in modern engines (V8 uses TimSort since Node 11). The comparator returning 0 for two digit logs preserves their relative order.', faangNote: 'Amazon classic. Tests multi-key comparator design and sort stability awareness.' },
      'LC_406': { leetcode: 406, title: 'Queue Reconstruction by Height', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/queue-reconstruction-by-height/', templateRefs: ['T2'], tags: ['sorting','custom-comparator','greedy','array','in-place'], alternateApproaches: [], keyInsight: 'Sort descending by height, break ties by ascending k-value. Then insert each person at index k in the result array. When inserting, only taller (or same-height) people are already placed — so the k-value exactly matches the insertion index.', shrinkTrigger: 'Sort rule: (a, b) => a[0] !== b[0] ? b[0] - a[0] : a[1] - b[1]. After sorting, insert each [h, k] at position k in the result array.', timeComplexity: 'O(n²) — each insertion is O(n) due to shift, called n times', spaceComplexity: 'O(n) — result array', gotcha: 'The greedy correctness relies entirely on the sort order. Processing shortest people first breaks because a short person\'s k-count includes taller people not yet placed.', faangNote: 'Tests the ability to see that the sort order IS the algorithm — not a preprocessing step.' },
      'LC_56':  { leetcode: 56,  title: 'Merge Intervals', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/merge-intervals/', templateRefs: ['T3'], tags: ['sorting','interval','greedy','array'], alternateApproaches: [], keyInsight: 'Sort by start time. For each new interval: if start <= last.end, extend last.end to Math.max(last.end, current.end). Otherwise push a new entry.', shrinkTrigger: 'Merge condition: intervals[i][0] <= last[1]. Use Math.max for the new end — the incoming interval could be entirely contained inside the last merged interval.', timeComplexity: 'O(n log n) — sort dominates', spaceComplexity: 'O(n) — result array', gotcha: 'Use Math.max(last[1], intervals[i][1]) for the new end. Using just intervals[i][1] fails when the incoming interval is fully contained (e.g., last=[1,10], current=[2,3] — result should end at 10 not 3).', faangNote: null },
      'LC_435': { leetcode: 435, title: 'Non-overlapping Intervals', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/non-overlapping-intervals/', templateRefs: ['T3'], tags: ['sorting','interval','greedy','array'], alternateApproaches: [], keyInsight: 'Sort by END time. Greedy: always keep the interval ending earliest — it leaves maximum room for future intervals. When two intervals overlap, remove the one with the later end. Count removals.', shrinkTrigger: 'Overlap condition: intervals[i][0] < prevEnd. Increment removed. No overlap: update prevEnd = intervals[i][1].', timeComplexity: 'O(n log n) — sort dominates', spaceComplexity: 'O(1) — only prevEnd tracked', gotcha: 'Sort by END, not start. Sorting by start and removing the longer interval on overlap fails on cases like [[1,100],[11,22],[11,33]]. Sort by end guarantees the kept interval always ends as early as possible.', faangNote: 'Interviewers expect the greedy exchange argument: \'Any solution that removes the interval ending later in a conflict is at least as good as one that removes the interval ending earlier.\'' },
      'LC_452': { leetcode: 452, title: 'Minimum Number of Arrows to Burst Balloons', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/', templateRefs: ['T3'], tags: ['sorting','interval','greedy','array'], alternateApproaches: [], keyInsight: 'Sort by END. Shoot an arrow at the first balloon end — hits all balloons starting at or before that end. If the next balloon starts AFTER the current arrow position, fire a new arrow.', shrinkTrigger: 'New arrow condition: points[i][0] > arrowPos. Fire a new arrow at points[i][1].', timeComplexity: 'O(n log n)', spaceComplexity: 'O(1)', gotcha: 'Overlap condition uses strict > not >=. Balloons touching at a single point (e.g. [[1,2],[2,3]]) can be burst with one arrow at x=2. Using >= incorrectly requires two arrows.', faangNote: 'Solve immediately after LC_435. The template is identical — only the boundary condition differs (< vs >). Recognizing this pattern connection is the SDE3 signal.' },
      'LC_57':  { leetcode: 57,  title: 'Insert Interval', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/insert-interval/', templateRefs: ['T3'], tags: ['sorting','interval','greedy','array'], alternateApproaches: [], keyInsight: 'Three phases in one pass: (1) add all intervals that end before the new interval starts, (2) merge all overlapping intervals into the new one by expanding its bounds, (3) add all remaining intervals. No sort needed — input is already sorted.', shrinkTrigger: 'Overlap check: existing.end >= newInterval.start AND existing.start <= newInterval.end. Merge by taking Math.min of starts and Math.max of ends.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — result array', gotcha: 'The input is ALREADY sorted — do not sort again. The three-phase structure avoids re-sorting. The merge condition uses >= not > for end comparison: an interval ending exactly where the new one starts ([1,2] and [2,3]) DOES overlap.', faangNote: 'Google and Meta high-frequency. The no-sort O(n) solution is expected — state it upfront. Interviewers use this to test whether you recognise the input is pre-sorted and skip unnecessary work.' },
      'LC_253': { leetcode: 253, title: 'Meeting Rooms II', difficulty: 'Medium', difficultyRank: 2, link: 'https://www.lintcode.com/problem/919/', templateRefs: ['T3'], tags: ['sorting','interval','greedy','heap','array'], alternateApproaches: [{ technique: 'heap', tradeoff: 'Min-heap of end times. For each meeting sorted by start: if heap top <= current start, pop (that room is free). Always push current end. Heap size at end = min rooms needed. O(n log n) same asymptotic but more intuitive.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Sort by start time. Use a min-heap of end times — the heap represents currently occupied rooms, ordered by when they free up. For each new meeting: if the earliest-ending room is free (heap.top <= start), reuse it (pop and push new end). Otherwise, open a new room (just push). Answer is final heap size.', shrinkTrigger: 'Reuse condition: minHeap.top() <= intervals[i][0]. Pop old end, push new end. Otherwise just push new end.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'Sort by START time, not end time. The heap tracks end times of active meetings — it is the sort key for the heap, not for the initial array. Mixing up the two sort keys is the single most common bug on this problem.', faangNote: 'Meta phone screen staple — appears in 30%+ of Meta rounds. The heap solution generalises to any "minimum resources" scheduling problem. Say: "The heap represents rooms in use, ordered by when they free up. I greedily reuse the soonest-available room."' },
      'LC_49':  { leetcode: 49,  title: 'Group Anagrams', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/group-anagrams/', templateRefs: ['T4'], tags: ['sorting','hash-map','string','array'], alternateApproaches: [{ technique: 'hash-map', moduleRef: null, tradeoff: 'Use a character frequency array of length 26 as the canonical key instead of sorting. O(n * L) time vs O(n * L log L) for sort-based. Preferred if L is large.', complexity: 'O(n * L) time, O(n * L) space' }], keyInsight: 'Sorting the characters of each string produces the same canonical key for all anagrams. Use this sorted string as a HashMap key. All strings sharing the same sorted key are anagrams of each other.', shrinkTrigger: null, timeComplexity: 'O(n * L log L) where L = average string length', spaceComplexity: 'O(n * L) — map storage', gotcha: 'For better performance with long strings, use a character-count array [0..25] as the key. Convert with counts.join(\'#\') — the \'#\' separator prevents key collisions from distributions sharing the same digit string.', faangNote: null },
      'LC_274': { leetcode: 274, title: 'H-Index', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/h-index/', templateRefs: ['T4'], tags: ['sorting','array','greedy','binary-search'], alternateApproaches: [{ technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'After sorting, binary search for the boundary index. Same O(n log n) with added complexity and no benefit. Linear scan after sorting is simpler and equally fast.', complexity: 'O(n log n) time, O(1) space' }, { technique: 'counting-sort', moduleRef: null, tradeoff: 'Counting sort on citation counts achieves O(n) total. Only worth it if O(n log n) is too slow.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'Sort citations descending. At index i, there are i+1 papers with at least citations[i] citations. H-index is the largest (i+1) such that citations[i] >= i+1. Stop on the first index where this fails.', shrinkTrigger: null, timeComplexity: 'O(n log n) — sort dominates', spaceComplexity: 'O(1) — in-place sort, single scan', gotcha: 'Return h (not i) at the end. If the loop completes without breaking, h-index is n (all papers qualify). Missing the full-loop case returns 0 instead of n.', faangNote: null },
      'LC_215': { leetcode: 215, title: 'Kth Largest Element in an Array', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/kth-largest-element-in-an-array/', templateRefs: ['T5'], tags: ['sorting','quickselect','heap','divide-and-conquer','array'], alternateApproaches: [{ technique: 'heap', moduleRef: 'heap', tradeoff: 'Min-heap of size k: push each element, pop when size > k. O(n log k) time, O(k) space. Better when k << n. Use heap if input must not be modified.', complexity: 'O(n log k) time, O(k) space' }, { technique: 'sorting', moduleRef: null, tradeoff: 'Full sort then return index n-k. O(n log n) — strictly worse than O(n) quickselect.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Map kth largest to (n-k)th smallest (0-indexed). Partition around a random pivot. Pivot lands at its final sorted position. If that equals target index, return. Otherwise recurse on exactly one side.', shrinkTrigger: 'If pivotPos === target return nums[pivotPos]. If pivotPos < target recurse RIGHT. If pivotPos > target recurse LEFT.', timeComplexity: 'O(n) expected, O(n²) worst case without random pivot', spaceComplexity: 'O(1) — in-place partition, O(log n) recursion stack', gotcha: 'Random pivot is NOT optional. Without it, a sorted input causes pivotPos to always equal left — O(n²) total. State this explicitly in the interview.', faangNote: 'Know both approaches (quickselect and min-heap) and choose based on constraints. Stating the trade-off is a strong signal.' },
      'LC_973': { leetcode: 973, title: 'K Closest Points to Origin', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/k-closest-points-to-origin/', templateRefs: ['T5'], tags: ['sorting','quickselect','heap','array','divide-and-conquer'], alternateApproaches: [{ technique: 'heap', moduleRef: 'heap', tradeoff: 'Max-heap of size k: if current distance < heap max, pop max and push current. O(n log k) — preferred when k is small and input must not be modified.', complexity: 'O(n log k) time, O(k) space' }, { technique: 'sorting', moduleRef: null, tradeoff: 'Sort all points by distance, return first k. O(n log n) — acceptable for small n but suboptimal.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Quickselect on squared Euclidean distance (avoid sqrt). Target index is k-1. After partitioning, return ALL elements from 0 to k-1 — not necessarily in sorted order, but that is not required.', shrinkTrigger: 'Distance comparator: compare x*x + y*y of pivot against each element. Recurse on the side containing index k-1.', timeComplexity: 'O(n) expected', spaceComplexity: 'O(1) excluding output', gotcha: 'Compare squared distances (x*x + y*y) to avoid floating-point sqrt errors. The k elements in [0..k-1] are in any order — add a sort if ordered output is required.', faangNote: '\'I use quickselect with squared Euclidean distance — same technique as Kth Largest, targeting index k-1 instead of n-k.\' Recognizing this pattern connection is the mastery signal.' },
      'LC_347': { leetcode: 347, title: 'Top K Frequent Elements', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/top-k-frequent-elements/', templateRefs: ['T6'], tags: ['sorting','bucket-sort','hash-map','heap','array'], alternateApproaches: [{ technique: 'heap', moduleRef: 'heap', tradeoff: 'Min-heap of size k tracking (frequency, element) pairs. O(n log k) time, O(n + k) space. Better when k is small. Bucket sort is O(n) but requires O(n) bucket space.', complexity: 'O(n log k) time, O(n + k) space' }, { technique: 'sorting', moduleRef: null, tradeoff: 'Count frequencies with a map, sort by frequency descending, return first k. O(n log n) — dominated by O(n) bucket sort.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Bucket index IS the frequency. Create n+1 buckets (index 0 unused, max frequency = n). Place each element into the bucket matching its frequency. Scan from high index to low, collect elements until k are gathered.', shrinkTrigger: null, timeComplexity: 'O(n) — counting and bucket assignment each O(n), scan O(n)', spaceComplexity: 'O(n) — frequency map and buckets', gotcha: 'Create n+1 buckets (indices 0 to n inclusive). Maximum possible frequency is n (all elements identical). Using n buckets misses frequency = n — off-by-one produces array-out-of-bounds.', faangNote: 'The O(n) bucket sort solution signals mastery. Know both bucket sort and heap and state the trade-off.' },
      'LC_164': { leetcode: 164, title: 'Maximum Gap', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/maximum-gap/', templateRefs: ['T6'], tags: ['sorting','bucket-sort','array'], alternateApproaches: [{ technique: 'sorting', moduleRef: null, tradeoff: 'Comparison-based sort then scan adjacent pairs. O(n log n) — fails the O(n) time requirement. This is the suboptimal solution the problem is designed to rule out.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Pigeonhole principle: n elements in range [min, max] placed into n-1 buckets means at least one bucket is empty. The maximum gap CANNOT be between two elements in the same bucket — must cross an empty bucket. Compare each bucket min against the previous non-empty bucket max.', shrinkTrigger: 'Bucket index: Math.floor((num - min) / bucketSize) where bucketSize = Math.ceil((max - min) / (n - 1)). Track each bucket\'s min and max only.', timeComplexity: 'O(n) — bucket assignment and scan each O(n)', spaceComplexity: 'O(n) — n-1 buckets', gotcha: 'If all elements are equal (max === min), return 0 before computing bucketSize. Division by zero occurs: bucketSize = ceil(0 / (n-1)) = 0.', faangNote: '\'With n elements across n-1 buckets, at least one bucket is empty by Pigeonhole. The max gap must cross an empty bucket — track each bucket\'s min and max only.\' The Pigeonhole argument IS the interview.' },
      'LC_220': { leetcode: 220, title: 'Contains Duplicate III', difficulty: 'Hard', templateRefs: ['T6'], tags: ['sorting','bucket-sort','sliding-window','array','hash-map'], keyInsight: 'Create buckets of size t+1. Element x maps to bucket id = floor(x/(t+1)). Two elements in the same bucket are guaranteed within t of each other. Also check left and right adjacent buckets with one comparison each. Maintain at most k active buckets — delete the bucket of the outgoing element on every window slide.', shrinkTrigger: 'Window slide: when i >= k, delete bucket of nums[i-k]. Check new element: same bucket exists, OR left bucket has element with |diff| <= t, OR right bucket has element with |diff| <= t.', timeComplexity: 'O(n) — each element inserted and deleted at most once', spaceComplexity: 'O(min(n, k)) — at most k active buckets', gotcha: 'JavaScript Math.floor on negative numbers rounds toward -Infinity. Use: id = x >= 0 ? Math.floor(x / (t+1)) : Math.floor((x + 1) / (t + 1)) - 1. Without this fix, negative values get wrong bucket ids and the same-bucket guarantee breaks.', faangNote: 'Know both approaches: bucket sort O(n) and sorted-set O(n log k). The interview signal: "Bucket sort maps VALUE proximity to ARRAY INDEX equality — two elements in the same bucket are automatically within t, no explicit comparison needed. Adjacent buckets still need one comparison each." The zero-comparison property for same-bucket elements is the O(n) insight.', alternateApproaches: [{ technique: 'sorted-set', tradeoff: 'Maintain a sorted window of k most recent elements. For each new element x, binary search for any element in [x-t, x+t]. O(n log k) time, O(k) space. Simpler to reason about but requires a BST sorted set not native to JavaScript.', complexity: 'O(n log k) time, O(k) space' }], link: 'https://leetcode.com/problems/contains-duplicate-iii/' },
      'LC_1200': { leetcode: 1200, title: 'Minimum Absolute Difference', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/minimum-absolute-difference/', templateRefs: ['T4'], tags: ['sorting','array'], alternateApproaches: [], keyInsight: 'Sort the array. The minimum absolute difference must occur between adjacent elements in sorted order — any non-adjacent pair has a larger or equal difference. Single scan of adjacent pairs: track running minimum, collect all pairs matching it.', shrinkTrigger: 'No recursion. Sort then O(n) scan.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(1) — output list aside', gotcha: 'When a new minimum is found during the scan, CLEAR the result list and restart collection. Accumulating without clearing produces pairs from superseded minimums.', faangNote: 'Simplest "sort enables O(n)" problem. Solve before LC_274. State WHY sorting helps before coding: "Sorting guarantees the minimum difference is always between neighbours — I only need one pass." That framing is the SD3 signal.' },

      'LC_561': { leetcode: 561, title: 'Array Partition', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/array-partition/', templateRefs: ['T4'], tags: ['sorting','array','greedy'], alternateApproaches: [], keyInsight: 'Sort the array. Pair adjacent elements: (nums[0],nums[1]), (nums[2],nums[3])... Taking min of each pair = nums[0], nums[2], nums[4]... Sum of even-indexed elements after sorting is the maximum possible sum of minimums. Proof: sorting ensures we discard the smallest possible values as the wasted maxima.', shrinkTrigger: 'No recursion. Sort then sum even-indexed elements — one line.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(1)', gotcha: 'Result is always even-indexed sum after sorting — this is a one-liner. Greedy without sorting produces wrong answers because unsorted pairs may discard large values unnecessarily.', faangNote: '"Sorting creates optimal pairing structure" is the P4 insight this problem teaches most cleanly. State the framing first: "After sorting, adjacent pairing is always optimal because it minimises wasted values." That sentence is the full proof.' },

      'LC_493':  { leetcode: 493,  title: 'Reverse Pairs',                                         difficulty: 'Hard',   templateRefs: ['T1'], tags: ['sorting','merge-sort','inversion-count','divide-and-conquer','array','binary-search'], keyInsight: 'Augmented merge sort with two SEPARATE phases per merge step: (1) COUNT — while both halves are still sorted, use a two-pointer to count i-j pairs where nums[i] > 2 * nums[j] (left i position, right j position). (2) MERGE normally with <= for stability. The phases must be separate because the 2x condition and sort-order condition fire at different thresholds.', shrinkTrigger: 'Count phase: for each i in [left..mid], advance r from mid+1 while nums[i] > 2 * nums[r]; count += r - (mid+1). Then merge phase: standard merge into temp buffer with the <= comparison.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n) — temp buffer', gotcha: 'Do NOT count and merge simultaneously (unlike LC_315). Merging rearranges elements so the 2x condition and the sort-order condition would fire at different times — counting inline produces double-counts or missed pairs. Count first while both halves are sorted, then merge.', faangNote: 'LC_315 teaches the augmented merge sort template. LC_493 tests whether you understand WHY it works — the 2x multiplier breaks the LC_315 inline-count trick and forces the two-phase approach. If LC_315 felt like following a recipe, LC_493 forces re-derivation.', alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary indexed tree (Fenwick tree) with coordinate compression. O(n log n) same asymptotic but requires implementing a BIT — augmented merge sort reuses the T1 template directly.', complexity: 'O(n log n) time, O(n) space' }], link: 'https://leetcode.com/problems/reverse-pairs/' },
    }
  }
  ,
  'heap': {
    description: 'A complete binary tree stored as an array that maintains the heap property: parent is always smaller than its children (min-heap) or larger (max-heap). In FAANG interviews, heap appears in four distinct forms: (1) maintaining the K largest/smallest elements from a stream in O(log k) per insertion, (2) merging K sorted sequences efficiently, (3) maintaining a dynamic median by partitioning a stream into two halves, and (4) greedy algorithms requiring the globally best remaining choice at each step. JavaScript and TypeScript have no built-in heap — you must implement one or simulate using sorted structures.',
    goal: 'Cover 95% of FAANG Heap questions by mastering 4 patterns, 5 templates, and 25 curated problems',
    relatedTopics: ['sorting', 'binary-search', 'greedy'],
    tagRegistry: ['heap','min-heap','max-heap','priority-queue','top-k','k-way-merge','two-heaps','median','greedy','lazy-expansion','streaming','scheduling','array','string','linked-list','matrix','sliding-window','hash-map','sorting','binary-search'],
    techniqueRegistry: ['heap','greedy','sorting','two-pointers','sliding-window','binary-search','hash-map'],
    patterns: [
      {
        id: 'P1', name: 'Top K / Kth Element with Min-Heap',
        recognitionSignals: [
          'Find the K-th largest or smallest element',
          'Maintain the top K elements from a stream or large array without sorting everything',
          'New candidates are generated lazily — each extracted minimum generates the next candidates'
        ],
        questionIds: ['LC_703', 'LC_215', 'LC_347', 'LC_373', 'LC_355', 'LC_1167', 'LC_2462', 'LC_1337', 'LC_264', 'LC_658']
      },
      {
        id: 'P2', name: 'K-Way Merge',
        recognitionSignals: [
          'Multiple sorted lists, arrays, or matrix rows that must be merged or searched globally',
          'Finding the K-th smallest across K sorted sequences',
          'The input is a set of sorted sources — extracting elements one by one in global sorted order'
        ],
        questionIds: ['LC_23', 'LC_378', 'LC_632', 'LC_759', 'LC_1439']
      },
      {
        id: 'P3', name: 'Two Heaps — Dynamic Median',
        recognitionSignals: [
          'Find the running median of a growing stream',
          'Sliding window median — add and remove elements dynamically',
          'Partition a dynamic dataset into two halves where both halves need their extreme value quickly'
        ],
        questionIds: ['LC_295', 'LC_480', 'LC_1357']
      },
      {
        id: 'P4', name: 'Greedy + Max Heap',
        recognitionSignals: [
          'Scheduling tasks with cooldowns or constraints — always process the most frequent task next',
          'Reorganizing elements so no two identical elements are adjacent',
          'At each step, the globally best remaining choice must be made — heap provides O(log n) argmax'
        ],
        questionIds: ['LC_767', 'LC_621', 'LC_1642', 'LC_502', 'LC_218', 'LC_1675', 'LC_1046', 'LC_1357']
      }
    ],
    questions: {
      'LC_703':  { leetcode: 703,  title: 'Kth Largest Element in a Stream',       difficulty: 'Easy',   difficultyRank: 1, link: 'https://leetcode.com/problems/kth-largest-element-in-a-stream/',       templateRefs: ['T2'], tags: ['heap','min-heap','top-k','streaming','array'], alternateApproaches: [], keyInsight: 'Min-heap of size exactly K. The heap top is always the K-th largest seen so far — everything below it is larger, everything not in the heap was smaller and has been ejected. On each add: push the new element, pop if size > K, return peek.', shrinkTrigger: 'Push new element. If heap.size() > k, pop the minimum. Heap top is the answer.', timeComplexity: 'O(log k) per add call', spaceComplexity: 'O(k)', gotcha: 'The constructor receives the initial list. Push ALL of them through the add logic (not raw push) to ensure the heap maintains size k throughout initialisation. Bypassing add for constructor elements risks a heap of size > k.', faangNote: null },
      'LC_215':  { leetcode: 215,  title: 'Kth Largest Element in an Array',       difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/kth-largest-element-in-an-array/',       templateRefs: ['T2'], tags: ['heap','min-heap','top-k','array','sorting','quickselect'], alternateApproaches: [{ technique: 'quickselect', moduleRef: 'sorting', tradeoff: 'Quickselect achieves O(n) expected time and O(1) space but modifies the input and has O(n²) worst case without random pivot. Min-heap achieves O(n log k) guaranteed and preserves input. When k << n, heap is actually better; when k ≈ n, quickselect wins.', complexity: 'O(n) expected, O(n²) worst case, O(1) space' }, { technique: 'sorting', moduleRef: 'sorting', tradeoff: 'Full sort then index n-k. O(n log n) — dominated by both heap and quickselect.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Min-heap of size K: push every element, eject minimum when size exceeds K. After processing all elements, heap top is the K-th largest.', shrinkTrigger: 'After each push: if heap.size() > k, pop the minimum.', timeComplexity: 'O(n log k)', spaceComplexity: 'O(k)', gotcha: 'State the trade-off between heap and quickselect to the interviewer before choosing. If asked for O(n) time, quickselect is required. If input must not be modified, heap is required.', faangNote: 'This question bridges the sorting and heap modules. Interviewers use it to test whether you know both approaches and can articulate the trade-off.' },
      'LC_347':  { leetcode: 347,  title: 'Top K Frequent Elements',               difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/top-k-frequent-elements/',               templateRefs: ['T2'], tags: ['heap','min-heap','top-k','hash-map','array','sorting','bucket-sort'], alternateApproaches: [{ technique: 'bucket-sort', moduleRef: 'sorting', tradeoff: 'Bucket sort indexed by frequency achieves O(n). Strictly better than O(n log k) heap. Heap approach is the default interview answer because it generalises to any ranked collection not bounded by array length.', complexity: 'O(n) time, O(n) space' }, { technique: 'sorting', moduleRef: 'sorting', tradeoff: 'Count with map, sort by frequency descending, take first k. O(n log n) — dominated by heap.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Count frequencies with a map. Push (frequency, element) tuples into a min-heap keyed by frequency. Eject when size exceeds K. Min-heap keyed by frequency acts as the frequency-rank filter.', shrinkTrigger: 'After each push of (count, element): if heap.size() > k, pop the tuple with the smallest frequency.', timeComplexity: 'O(n log k)', spaceComplexity: 'O(n) — frequency map', gotcha: 'The heap comparator must be keyed by FREQUENCY, not element value. A common bug is pushing raw element values — the heap then ranks by value, not frequency, producing wrong answers.', faangNote: 'When asked, say: \'Bucket sort achieves O(n) by using frequency as a direct array index — the optimal approach here. However heap in O(n log k) generalises to any ranking problem — I will lead with heap unless O(n) is explicitly required.\'' },
      'LC_373':  { leetcode: 373,  title: 'Find K Pairs with Smallest Sums',       difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/find-k-pairs-with-smallest-sums/',       templateRefs: ['T2'], tags: ['heap','min-heap','top-k','lazy-expansion','array'], alternateApproaches: [], keyInsight: 'There are n*m potential pairs — pushing all upfront is O(nm log nm). Instead seed with (nums1[i], nums2[0]) for all i. On each pop (i, j), push (i, j+1) — the next element in nums2 for that row. Lazy expansion only generates candidates adjacent to confirmed minimums.', shrinkTrigger: 'On pop of (sum, i, j): push (nums1[i] + nums2[j+1], i, j+1) if j+1 < nums2.length.', timeComplexity: 'O(k log k) — at most k pops and k pushes', spaceComplexity: 'O(k + min(n, k))', gotcha: 'Seed with at most min(nums1.length, k) entries. If nums1.length > k, the (k+1)th smallest sum cannot come from rows beyond index k-1 since nums2[0] is the smallest in nums2. Seeding all n rows when n >> k wastes space.', faangNote: 'The lazy expansion pattern (pop minimum, push its successor) is the key insight that separates O(k log k) from O(nm). Say: \'Pushing all pairs upfront is O(nm log nm). I use the sorted structure of each row — after extracting the minimum from row i, the next candidate is immediately available.\'' },
      'LC_23':   { leetcode: 23,   title: 'Merge K Sorted Lists',                  difficulty: 'Hard',   difficultyRank: 3, link: 'https://leetcode.com/problems/merge-k-sorted-lists/',                  templateRefs: ['T3'], tags: ['heap','min-heap','k-way-merge','linked-list','divide-and-conquer','sorting'], alternateApproaches: [{ technique: 'divide-and-conquer', moduleRef: 'sorting', tradeoff: 'Repeatedly merge pairs of lists using Merge Sort merge step. O(n log k) same asymptotic. Avoids the heap constant factor but harder to implement correctly for an odd number of lists.', complexity: 'O(n log k) time, O(log k) space — recursion stack' }], keyInsight: 'Push one node (current head) from each list into the min-heap. Pop the global minimum; attach to result; push that node\'s next if present. The heap always contains the current front element of each active list — the K-way merge invariant.', shrinkTrigger: 'On pop of node: if node.next exists, push node.next into the heap.', timeComplexity: 'O(n log k) where n = total nodes, k = number of lists', spaceComplexity: 'O(k) — heap holds at most one node per list', gotcha: 'The heap comparator compares node VALUES. Store [value, listIndex, node] tuples to avoid comparator ambiguity when two nodes from different lists have equal values.', faangNote: 'Table stakes — every FAANG loop tests this. Know both approaches (heap and divide-and-conquer). Heap is O(k) extra space; divide-and-conquer is O(log k). Heap is more intuitive to explain on a whiteboard.' },
      'LC_378':  { leetcode: 378,  title: 'Kth Smallest Element in a Sorted Matrix', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/', templateRefs: ['T3'], tags: ['heap','min-heap','k-way-merge','matrix','binary-search'], alternateApproaches: [{ technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'Binary search on value range [matrix[0][0], matrix[n-1][n-1]]. Count elements <= mid in O(n) using staircase technique. O(n log(max-min)) time, O(1) space — better space than heap but more complex to implement.', complexity: 'O(n log(max - min)) time, O(1) space' }], keyInsight: 'Treat each row as a sorted sequence. Seed with (matrix[r][0], r, 0) for all rows. Pop k times; on each pop of (val, r, c), push (matrix[r][c+1], r, c+1) if c+1 < n. The k-th pop is the answer.', shrinkTrigger: 'On pop of (val, r, c): push (matrix[r][c+1], r, c+1) if c+1 < matrix[0].length.', timeComplexity: 'O(k log n) where n = matrix dimension', spaceComplexity: 'O(n) — one entry per row in the heap', gotcha: 'Seed ALL rows — not just the first row. The global k-th smallest can come from any row. Seeding only row 0 forces linear traversal before considering any other row, producing wrong results.', faangNote: 'Know both approaches: heap in O(k log n) and binary search in O(n log(max-min)). State the trade-off: \'Heap is simpler and optimal when k is small. For large k approaching n², binary search on the value range with O(1) space may be preferred.\'' },
      'LC_632':  { leetcode: 632,  title: 'Smallest Range Covering Elements from K Lists', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/smallest-range-covering-elements-from-k-lists/', templateRefs: ['T3'], tags: ['heap','min-heap','k-way-merge','sliding-window','array'], alternateApproaches: [], keyInsight: 'The minimum valid range must contain at least one element from each list. Maintain K-way merge heap (one element per list). Track CURRENT MAXIMUM across all heap elements. Range = [heap.min, currentMax]. To shrink: pop minimum (the bottleneck), advance its list. Track best range seen.', shrinkTrigger: 'On pop of min element: push its successor. Update currentMax = max(currentMax, newElement). Update best range if (currentMax - newMin) < (bestRight - bestLeft).', timeComplexity: 'O(n log k) where n = total elements', spaceComplexity: 'O(k)', gotcha: 'Track currentMax SEPARATELY from the heap — the heap gives O(log k) minimum, but maximum requires O(k) scan if not tracked separately. Initialize currentMax to the max among all seeded elements. Update it only when a new element is pushed.', faangNote: 'The combined insight — K-way merge minimum + separately tracked maximum forms a sliding window over sorted structure — is the FAANG Hard signal. Say: \'The minimum of the current window is the heap top O(log k). The maximum is tracked separately. I advance the minimum to narrow the range.\'' },
      'LC_295':  { leetcode: 295,  title: 'Find Median from Data Stream',           difficulty: 'Hard',   difficultyRank: 3, link: 'https://leetcode.com/problems/find-median-from-data-stream/',           templateRefs: ['T4'], tags: ['heap','min-heap','max-heap','two-heaps','median','streaming'], alternateApproaches: [], keyInsight: 'Lower half in max-heap; upper half in min-heap. Insert always to lower first, then enforce: (1) cross-heap order — lower.top <= upper.top; if violated, move lower.top to upper. (2) size balance — lower can have at most 1 more element. Median = lower.top (odd) or average of both tops (even).', shrinkTrigger: 'After push to lower: if lower.top > upper.top → pop lower, push to upper. Then: if lower.size > upper.size + 1 → pop lower, push to upper. If upper.size > lower.size → pop upper, push to lower.', timeComplexity: 'O(log n) per addNum, O(1) per findMedian', spaceComplexity: 'O(n)', gotcha: 'Always push to the LOWER half first, even if the element seems to belong to upper. Then let invariant enforcement move it. Directly routing to upper first breaks the rebalancing logic.', faangNote: 'Canonical two-heap problem. Both invariants (cross-order and size balance) must be enforced on every insert — missing either produces incorrect medians. Articulate both before writing code.' },
      'LC_480':  { leetcode: 480,  title: 'Sliding Window Median',                 difficulty: 'Hard',   difficultyRank: 3, link: 'https://leetcode.com/problems/sliding-window-median/',                 templateRefs: ['T4'], tags: ['heap','min-heap','max-heap','two-heaps','median','sliding-window','lazy-expansion'], alternateApproaches: [], keyInsight: 'LC_295 extended with removal. Since heaps do not support arbitrary deletion, use LAZY DELETION: maintain a deleteMap tracking evicted elements. When a heap top matches a deleteMap entry, discard it. After each window slide: insert new element, mark outgoing element, prune lazy-deleted tops, rebalance.', shrinkTrigger: 'On window slide: (1) mark outgoing element in deleteMap. (2) push incoming element. (3) prune lazy-deleted tops from both heaps. (4) rebalance sizes (using effective sizes). (5) compute median.', timeComplexity: 'O(n log k) where k = window size', spaceComplexity: 'O(n) — lazy delete map', gotcha: 'After marking for lazy deletion, track EFFECTIVE SIZE (physical size minus pending deletions) for rebalancing. Using physical size produces incorrect rebalancing and wrong medians.', faangNote: 'The hardest practical heap problem in FAANG rounds. Tests lazy deletion mastery. Say: \'Heaps do not support O(log n) arbitrary removal. I use lazy deletion: mark evicted elements in a map and discard them when they surface as the top during standard pop operations.\'' },
      'LC_767':  { leetcode: 767,  title: 'Reorganize String',                     difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/reorganize-string/',                     templateRefs: ['T5'], tags: ['heap','max-heap','greedy','string','hash-map'], alternateApproaches: [{ technique: 'sorting', moduleRef: 'sorting', tradeoff: 'Sort characters by frequency descending, then interleave. O(n log n) — same result but harder to generalise to cooldown variants. Heap approach generalises directly to LC_621.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'On each step, pick the two most frequent remaining characters and place them consecutively. This prevents two identical characters from being adjacent. If only one character remains with count > 1, the task is impossible.', shrinkTrigger: 'Pop top two from max-heap. Append both. Re-push each with decremented count if > 0. If only one element remains after a pop and its count > 1, return empty string.', timeComplexity: 'O(n log c) where c = distinct characters (at most 26)', spaceComplexity: 'O(c)', gotcha: 'Impossibility check: if any character\'s frequency exceeds ceil(n/2), return \'\' immediately. Checking upfront avoids getting halfway through the loop before discovering impossibility.', faangNote: 'Solve before LC_621. The greedy insight — always pair the most frequent with the second most frequent — transfers directly to cooldown scheduling. The only difference in LC_621 is re-insertion is delayed by n steps instead of 1 step.' },
      'LC_621':  { leetcode: 621,  title: 'Task Scheduler',                        difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/task-scheduler/',                        templateRefs: ['T5'], tags: ['heap','max-heap','greedy','scheduling','array','hash-map'], alternateApproaches: [{ technique: 'greedy', moduleRef: null, tradeoff: 'Mathematical formula: answer = max(tasks.length, (maxFreq-1)*(n+1) + countOfMaxFreq). O(n) time, O(1) space. Elegant but hard to derive under interview pressure. Heap simulation is O(n log k) but easy to reason about correctly.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'Max-heap of remaining task counts. Each CPU cycle: pop most frequent, execute it, push to cooldown queue with (count-1, releaseTime = currentTime + n). Re-push tasks whose cooldown has expired. If heap empty but cooldown queue not, CPU idles — time still advances.', shrinkTrigger: 'Each cycle: pop from heap if non-empty, decrement count, push to cooldown if count > 0. Re-push cooldown entries whose release time equals current time.', timeComplexity: 'O(total_time * log k) where k = distinct task types', spaceComplexity: 'O(k)', gotcha: 'CPU idles when heap is empty but cooldown queue is non-empty. Time still increments during idle — do not skip idle cycles. The loop must continue as long as EITHER heap or cooldown queue is non-empty.', faangNote: 'Know both heap simulation and the O(1) formula. Interviewers ask: \'Can you do better than O(n log k)?\' Derive: answer = max(n_tasks, (maxFreq-1)*(n+1) + countOfMaxFreq) by reasoning about the frame structure of the optimal schedule.' },
      'LC_1642': { leetcode: 1642, title: 'Furthest Building You Can Reach',       difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/furthest-building-you-can-reach/',       templateRefs: ['T5'], tags: ['heap','min-heap','greedy','array'], alternateApproaches: [{ technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'Binary search on the answer with greedy feasibility check. O(n log n) — same asymptotic but harder to implement correctly. Heap greedy is simpler and more natural.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Greedy with regret: always use a ladder for the current climb. Maintain a min-heap of ladder-assigned climbs. When ladders run out (heap.size > ladders), un-assign the smallest ladder-climb and replace it with bricks. If bricks insufficient for that swap, return current index.', shrinkTrigger: 'On each positive height difference: push to min-heap. If heap.size() > ladders, pop minimum. If bricksRemaining < popped value, return current index.', timeComplexity: 'O(n log L) where L = number of ladders', spaceComplexity: 'O(L)', gotcha: 'The min-heap stores HEIGHT DIFFERENCES of ladder-assigned climbs, not building indices. When you swap a ladder for bricks, you swap the CHEAPEST past ladder use (min in heap) — not the current climb. Pop the minimum, spend those bricks on it; the current climb keeps its ladder.', faangNote: 'The regret-based greedy pattern — assign the expensive resource optimistically, swap retroactively when budget runs out — is a reusable FAANG technique. Say: \'I greedily allocate ladders to every climb, then retroactively swap the cheapest ladder use for bricks when ladders are exhausted.\'' },
      'LC_502': { leetcode: 502,  title: 'IPO',                                         difficulty: 'Hard',   difficultyRank: 3, link: 'https://leetcode.com/problems/ipo/',                                         templateRefs: ['T5'], tags: ['heap','min-heap','max-heap','greedy','two-heaps','sorting','array'], alternateApproaches: [], keyInsight: 'Sort projects by capital requirement. Use a min-heap of (capitalRequired, profit) for locked projects and a max-heap of profits for currently affordable ones. Each round: move all projects with capitalRequired ≤ current capital from min-heap to max-heap, then pick the highest profit.', shrinkTrigger: 'Each round: while minCapHeap non-empty AND minCapHeap.top()[0] <= currentCapital, pop and push profit to maxProfitHeap. Then: currentCapital += maxProfitHeap.pop(). If maxProfitHeap is empty, break early.', timeComplexity: 'O(n log n + k log n)', spaceComplexity: 'O(n)', gotcha: 'If maxProfitHeap is empty at the start of a round, no affordable project exists — break early. The min-heap is keyed by capital; the max-heap is keyed by profit — do not mix. Capital only grows, so min-heap entries once processed are never re-visited.', faangNote: 'The canonical problem where two heaps serve different roles: one gates feasibility, the other maximizes selection. Say: "The min-heap frontier advances monotonically as capital only grows — I never re-visit processed projects." Contrasts with LC_295 where both heaps partition the same value space.' },
      'LC_355':  { leetcode: 355,  title: 'Design Twitter',                         difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/design-twitter/',                         templateRefs: ['T2'], tags: ['heap','min-heap','top-k','design','hash-map','linked-list'], alternateApproaches: [], keyInsight: 'Each user has a tweet list. getNewsFeed merges the 10 most recent tweets from the user and all followees — exactly a K-way merge top-10 problem. Seed the heap with the most recent tweet from each relevant user. On each pop, push that tweet\'s predecessor if it exists.', shrinkTrigger: 'Pop up to 10 times. On each pop of (timestamp, userId, tweetNode): if tweetNode.next exists, push (tweetNode.next.timestamp, userId, tweetNode.next).', timeComplexity: 'O(F log F) per getNewsFeed where F = number of followees', spaceComplexity: 'O(U + T) where U = users, T = total tweets', gotcha: 'Use a global timestamp counter that increments on every postTweet call — not system time. System time has millisecond granularity and two rapid posts could collide. A simple integer counter guarantees strict ordering.', faangNote: 'Meta interview classic. Tests whether you can apply K-way merge (LC_23) in a design context. The insight: "getNewsFeed is just merging K sorted lists of tweets — I use the same heap pattern as Merge K Sorted Lists." Stating that connection explicitly signals strong pattern recognition.' },
      'LC_218':  { leetcode: 218,  title: 'The Skyline Problem',                    difficulty: 'Hard',   difficultyRank: 3, link: 'https://leetcode.com/problems/the-skyline-problem/',                    templateRefs: ['T4'], tags: ['heap','max-heap','sweep-line','sorting','divide-and-conquer'], alternateApproaches: [{ technique: 'divide-and-conquer', tradeoff: 'Merge skylines like merge sort — split buildings, recurse, merge result arrays. O(n log n) same asymptotic but harder to implement correctly for overlapping ranges.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Sweep line: convert each building [l, r, h] into two events — enter at l with height h, exit at r with height h. Sort events by x (tie-break: entries before exits, taller entries first). Use a max-heap of active heights. At each event: add or remove height. Record a key point whenever the current max height changes.', shrinkTrigger: 'Height change condition: maxHeap.top() !== prevMaxHeight. Record [x, maxHeap.top()] as a key point.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'Tie-breaking in event sorting is critical: (1) same x, both entries — sort taller first (avoids false intermediate drop). (2) same x, both exits — sort shorter first. (3) same x, entry vs exit — entry first. Getting any tie-break wrong produces spurious key points.', faangNote: 'Google Hard. The sweep-line + max-heap combination appears in many Google Hard problems. Master the event-generation + heap-maintenance pattern here — it transfers directly to problems like "maximum overlap" and "minimum platforms." The tie-breaking rules are the precise test of understanding.' },
      'LC_1167': { leetcode: 1167, title: 'Minimum Cost to Connect Sticks', difficulty: 'Medium', templateRefs: ['T2'], tags: ['heap','min-heap','greedy','array'], keyInsight: 'Always combine the two shortest sticks first (Huffman greedy). Pop the two minimums, compute cost = their sum, push the sum back, and add cost to the running total. The combined stick participates in future combinations — the heap feedback loop is the pattern. Each of the n-1 combination steps is O(log n).', shrinkTrigger: 'While heap.size() > 1: pop a and b (two minimums). cost += a + b. push(a + b). Return total cost.', timeComplexity: 'O(n log n) — n-1 pop-pairs and n-1 pushes', spaceComplexity: 'O(n) — heap', gotcha: 'The sum pushed back IS a valid input for future steps — do not discard it after adding to cost. This feedback (output of step i becomes input of step i+1) is the defining property of the pattern and what distinguishes it from a simple one-pass top-K problem.', faangNote: 'Amazon asks this in ~20% of heap rounds. The pattern name interviewers expect: Huffman coding greedy. Say: "Combining cheapest sticks first minimizes total cost because every stick participates in all future combinations it merges into — deferring cheap combinations is never better." The pop-combine-push feedback loop applies to any minimum-cost aggregation problem.', alternateApproaches: [], link: 'https://leetcode.com/problems/minimum-cost-to-connect-sticks/' },
      'LC_2462': { leetcode: 2462, title: 'Total Cost to Hire K Workers',                          difficulty: 'Medium', templateRefs: ['T2'], tags: ['heap','min-heap','top-k','greedy','two-pointers','array'], keyInsight: 'Two min-heaps: leftHeap seeded with first `candidates` workers, rightHeap seeded with last `candidates` workers. Each hiring round: compare both heap tops, pop the minimum (left on tie). Expand the depleted side: left hire → push workers[leftBound++]; right hire → push workers[rightBound--]. Guard leftBound <= rightBound before any push.', shrinkTrigger: 'Hire round: pop smaller of leftHeap.top() vs rightHeap.top() (left on tie). Expand: if from left → push workers[leftBound++]; if from right → push workers[rightBound--]. Guard: leftBound <= rightBound.', timeComplexity: 'O((k + candidates) log candidates)', spaceComplexity: 'O(candidates) — both heaps combined', gotcha: 'Guard leftBound <= rightBound before pushing to either heap. Without this guard, boundaries cross and a single worker enters BOTH heaps — causing a duplicate hire and a wrong total cost. This is the single most common bug in this problem.', faangNote: 'Meta OA 2023–2024 repeated this ~15 times. The two-ended heap generalises to any problem requiring optimal selection from either end without exhausting a candidate window. Say: "I maintain two separate min-heaps — one from each end — and greedily hire the cheapest candidate across both, refilling from the same side after each hire."', alternateApproaches: [], link: 'https://leetcode.com/problems/total-cost-to-hire-k-workers/' },
      'LC_759':  { leetcode: 759,  title: 'Employee Free Time',                                    difficulty: 'Hard',   templateRefs: ['T3'], tags: ['heap','min-heap','k-way-merge','interval','sorting','array'], keyInsight: 'K-way merge all employee schedules into a single sorted interval stream using a min-heap (one entry per employee). Then sweep: whenever current.start > prevEnd, record free-time gap [prevEnd, current.start]. Update prevEnd = Math.max(prevEnd, current.end) — same merge logic as LC_56. Push next interval from same employee after each pop.', shrinkTrigger: 'On pop (start, eIdx, iIdx): if start > prevEnd → record Interval(prevEnd, start). prevEnd = Math.max(prevEnd, end). Push next interval from employee eIdx if available.', timeComplexity: 'O(n log k) where n = total intervals, k = number of employees', spaceComplexity: 'O(k) — heap holds one interval per employee', gotcha: 'Use Math.max(prevEnd, current.end) when updating prevEnd — identical to LC_56 merge logic. If an interval is fully contained inside the previous one, prevEnd must NOT shrink. Without Math.max, a fully-contained interval incorrectly generates a false free-time gap.', faangNote: 'Google and LinkedIn Hard. Tests composition of K-way merge (LC_23) + interval merging (LC_56). Say: "I run a K-way merge heap over all employee schedule lists, then apply the same merge-and-gap logic as Merge Intervals to identify the free periods."', alternateApproaches: [{ technique: 'sorting', tradeoff: 'Flatten all intervals, sort by start, sweep for gaps. O(n log n) same asymptotic but does not demonstrate K-way merge — Google interviewers expect the heap approach.', complexity: 'O(n log n) time, O(n) space' }], link: 'https://www.lintcode.com/problem/850/' },

      'LC_1675': { leetcode: 1675, title: 'Minimize Deviation in Array', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/minimize-deviation-in-array/', templateRefs: ['T4'], tags: ['heap','max-heap','greedy','array','math'], alternateApproaches: [], keyInsight: 'Normalize first: multiply ALL odd numbers by 2 (the only allowed odd operation). Now every element can only decrease (divide by 2 if even). Push all into a max-heap, track running minimum. Repeatedly pop the max; if even, divide by 2 and push back, updating min. Record deviation = heapMax - min after every pop. Stop when heap top is odd — cannot reduce further.', shrinkTrigger: 'Stop when heap top is odd. Each pop either terminates or reduces the global maximum.', timeComplexity: 'O(n log n * log(max)) — at most log(max) divisions per element', spaceComplexity: 'O(n) — heap', gotcha: 'Pre-multiplying all odds is not optional. It ensures all operations are reductions only, making greedy monotonic. Without normalization, elements could still increase later and the running minimum breaks entirely.', faangNote: "Google's most-asked heap Hard. The interviewer signal: stating 'I normalize all odds by doubling first so every operation only reduces the maximum' within the first 30 seconds. Candidates who skip normalization spend the interview confused about when to multiply vs divide." },
      'LC_1046': { leetcode: 1046, title: 'Last Stone Weight', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/last-stone-weight/', templateRefs: ['T5'], tags: ['heap','max-heap','greedy','array','simulation'], alternateApproaches: [], keyInsight: 'Classic max-heap simulation. Pop the two heaviest stones. If they differ, push their difference back. Continue until ≤1 stone remains. The max-heap ensures you always grab the heaviest available — the greedy choice that minimizes what remains.', shrinkTrigger: 'While heap.size() > 1: pop two heaviest. If unequal, push difference. Return remaining stone weight or 0.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'Correctly implement max-heap pop order. JavaScript does not have a built-in max-heap — use a min-heap with negate values or implement custom comparator. Missing this detail is an automatic test failure.', faangNote: 'Apple and Google loops ask this as a warm-up. Tests: (1) max-heap implementation speed, (2) loop termination condition (size ≤ 1 not size == 0). Solve in under 5 minutes to signal efficiency.' },
      'LC_1337': { leetcode: 1337, title: 'The K Weakest Rows in a Binary Matrix', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/the-k-weakest-rows-in-a-binary-matrix/', templateRefs: ['T2'], tags: ['heap','min-heap','top-k','array','matrix','sorting'] , alternateApproaches: [{ technique: 'sorting', moduleRef: 'sorting', tradeoff: 'Count 1s in each row with binary search (O(log n) per row), store in tuples (count, index), sort ascending. O(m log(n) + m log m) same asymptotic. Heap is slightly cleaner on a whiteboard.', complexity: 'O(m log n + m log m) time, O(m) space' }], keyInsight: 'Parse each row as a binary number (1s followed by 0s). Count 1s — this is the strength. Build tuples (strength, rowIndex). Use a max-heap keyed by strength. Eject when size > k. Return remaining indices in order. The max-heap filters out rows with higher strength, keeping the K weakest.', shrinkTrigger: 'For each row: count 1s. Push (count, index). If heap.size() > k: pop max (strongest). Then pop k times and sort returned indices.', timeComplexity: 'O(m log n) for counting + O(m log k) for heap = O(m log n)', spaceComplexity: 'O(k) — heap', gotcha: 'The heap is keyed by (count, index) — use index as secondary sort for tie-breaking (lower index is weaker tie-break). Standard library heaps may not break ties correctly. Explicitly define comparator.', faangNote: 'Meta and Apple use this as a calibration problem — easy if you grasp custom heap comparators, tedious if you skip comparator specification. Say: "I use a max-heap keyed by strength, keeping only K weakest by repeatedly ejecting the strongest."' },
      'LC_264': { leetcode: 264, title: 'Ugly Number II', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/ugly-number-ii/', templateRefs: ['T2'], tags: ['heap','min-heap','top-k','DP','array','math','lazy-expansion'], alternateApproaches: [{ technique: 'DP with pointers', moduleRef: 'dynamic-programming', tradeoff: 'Maintain three pointers into the result array, multiplied by 2, 3, 5. Track next candidates and pick the minimum. O(n) time, O(n) space. Slightly faster and more elegant than heap but requires DP insight first.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'Generate ugly numbers lazily with a min-heap. Seed with 1. Pop the minimum ugly number u; for each prime p ∈ {2, 3, 5}, push u*p (if not a duplicate). Use a set to avoid re-processing the same ugly number multiple times. The n-th pop is the answer.', shrinkTrigger: 'Pop min ugly number u. For each prime p: if u*p not seen, mark as seen and push u*p.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'Deduplication is essential. Without tracking seen numbers, the heap explodes exponentially with duplicates (e.g., 2*3 == 3*2). The set prevents re-queueing identical values.', faangNote: 'Amazon and LinkedIn use this to test heap vs DP insights. Say: "Heap solution is O(n log n) intuitive generation with visible pruning. DP solution is O(n) optimal but less obvious upfront. I will lead with heap unless O(n) is required."' },
      'LC_658': { leetcode: 658, title: 'Find K Closest Elements', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/find-k-closest-elements/', templateRefs: ['T2'], tags: ['heap','min-heap','top-k','array','sorting','two-pointers','sliding-window'], alternateApproaches: [{ technique: 'two-pointers', moduleRef: 'two-pointers', tradeoff: 'Slide a k-window over sorted array, compute range width at each position, track minimum range. O(n). Strictly better than heap but requires sliding-window insight. Use two-pointers on a whiteboard to signal algorithmic maturity.', complexity: 'O(n) time, O(1) extra space' }, { technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'Binary search for insertion point of x. Expand k-window left and right from that pivot. O(log n + k) time. Hybrid approach — good middle ground.', complexity: 'O(log n + k) time, O(k) space' }], keyInsight: 'Max-heap by distance from x. For each element, compute distance = |arr[i] - x|. Push (distance, value). Eject when size > k. Return remaining values sorted. Max-heap keyed by distance filters to K closest.', shrinkTrigger: 'For each element: compute distance. Push (distance, arr[i]). If heap.size() > k, pop (max distance). Extract values and sort before returning.', timeComplexity: 'O(n log k + k log k)', spaceComplexity: 'O(k) — heap', gotcha: 'For ties (same distance), prefer the smaller value. The comparator must be (distance, -value) or define explicit tie-break: if distances equal, smaller value wins. Missing tie-break produces wrong results on edge cases.', faangNote: 'When asked, say: "The heap approach is O(n log k) intuitive. However, the two-pointers sliding window achieves O(n) and is the intended solution. I use heap if range/interval processing is unexpectedly needed; otherwise, I pivot to two-pointers."' },
      'LC_1357': { leetcode: 1357, title: 'Apply Discount Every n Orders', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/apply-discount-every-n-orders/', templateRefs: ['T5'], tags: ['heap','design','hash-map','simulation','priority-queue'], alternateApproaches: [], keyInsight: 'Simulate order processing. Track item-to-price map and total orders count. Every n-th order, fetch all items in a max-heap by price, apply 20% discount to the top k items popped. Recalculate total. Non-nth orders: sum prices directly. The heap is used only when discount triggers.', shrinkTrigger: 'On getBill(itemId, k): if totalOrders%n==0, use max-heap to select k highest-price items and discount. Return total (with or without discount).', timeComplexity: 'O(k log k) per discount order, O(1) amortized per non-discount order', spaceComplexity: 'O(m) where m = unique items', gotcha: 'Resetting the heap on each discount order is correct — do not keep state across orders. Also, the discount only applies during the NEXT order after totalOrders reaches a multiple of n (timing detail in problem statement).', faangNote: 'LinkedIn OA 2023–2024 repeated this. Tests: (1) heap usage is conditional/event-driven, (2) state management across method calls (object design), (3) edge case: discount on first order if n==1. Say: "I use a max-heap opportunistically — only when a discount order triggers. Between discount events, heap is unnecessary."' },
      'LC_1439': { leetcode: 1439, title: 'Find the Kth Smallest Sum of Matrix Rows', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/find-kth-smallest-sum-of-matrix-rows/', templateRefs: ['T3'], tags: ['heap','min-heap','k-way-merge','matrix','lazy-expansion','binary-search'], alternateApproaches: [{ technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'Binary search on the result range. Count how many row-sum combinations produce a sum ≤ mid. O(m * n^m * log(maxSum)) is prohibitive; pruning strategies required. Heap avoids this complexity.', complexity: 'Too complex without careful pruning' }], keyInsight: 'Each row contributes exactly one value to each row-sum. Represent a row-sum as a tuple (sum, indices). Seed with (row1[0] + row2[0] + ... + rowm[0], [0, 0, ..., 0]). Pop k-1 times; on each pop (sum, indices), generate successors by incrementing each index position: (sum - row[idx] + row[idx+1], indices with idx incremented). Lazy expand only reachable successors. The k-th pop is the answer.', shrinkTrigger: 'On pop of (sum, indices): for each row i where indices[i] < len(mat[i])-1, generate successor (sum - mat[i][indices[i]] + mat[i][indices[i]+1], new_indices).', timeComplexity: 'O(k * m log(km)) where m = number of rows. Lazy expansion bounds queue size to O(km).', spaceComplexity: 'O(km)', gotcha: 'Avoid duplicate successors. When expanding, indices must be a tuple (hashable). Use set to track seen (sum, indices) pairs — pushing the same successor twice is the primary bug.', faangNote: 'Google Hard systems interview. Tests: (1) lazy expansion mastery from LC_373, (2) multi-dimensional indexing, (3) deduplication logic for Cartesian-product expansion. Say: "I seed with the smallest possible row-sum, then systematically generate the next-smallest successors by incrementing one position at a time. This avoids exploring all m^n combinations upfront."' }
    }
  },

  'recursion': {
    description: 'Recursion is the core skill of expressing a problem in terms of a smaller version of itself, defining exact base cases, and trusting the call stack to handle the rest. This module covers pure recursion only — structural recursion, halving, divide-and-conquer, parsing, and classic insight-driven problems. Backtracking, trees, and DP each have their own dedicated modules.',
    goal: 'Build a complete recursive mental model through 23 curated problems spanning 6 core patterns: call stack mechanics, halving, linked list chunk processing, recursive parsing, divide-and-conquer, and classic insight-driven recursion',
    relatedTopics: ['sorting', 'heap', 'backtracking'],

    tagRegistry: [
      'recursion', 'divide-and-conquer', 'linked-list', 'math', 'string', 'array',
      'fast-exponentiation', 'parsing', 'nested', 'stack', 'bit-manipulation', 'two-pointers', 'halving',
      'sorting', 'classic-recursion', 'mathematical-recursion', 'grid', 'dfs', 'matrix', 'binary-search'
    ],

    techniqueRegistry: [
      'recursion', 'divide-and-conquer', 'fast-exponentiation', 'recursive-parsing', 'linked-list-recursion',
      'sorting', 'insight-recursion', 'mathematical-recurrence', 'grid-dfs', 'binary-search'
    ],

    whenToUse: {
      use: [
        'The problem can be broken into smaller identical subproblems',
        'You need to process a recursive or nested structure (linked list, nested string, expression)',
        'The input size halves at each step — fast exponentiation, binary recursion, binary search',
        'A divide-and-conquer split produces independent subproblems that combine at the end',
        'You need to explore all connected cells/nodes in a 2D grid — recursion naturally expresses all 4 directions'
      ],
      avoid: [
        'Recursion depth exceeds ~10,000 — stack overflow risk; use iteration with an explicit stack instead',
        'Subproblems overlap AND results can be cached — use DP (memoized recursion) instead of pure recursion',
        'You need to explore all possibilities/permutations — that is backtracking, not pure recursion'
      ]
    },

    interviewTips: [
      'Always state the base case(s) FIRST before writing the recursive step — interviewers score this separately',
      'Verbalize the "trust the recursion" principle: "Assume the recursive call returns the correct answer for the subproblem. What do I do with it?"',
      'For linked list recursion: the canonical shape is node.next = recurse(node.next); return node — master this before LC_92 or LC_25',
      'For halving recursion: always handle negative exponents/indices — this is the most common edge case miss',
      'For parsing recursion: draw the call tree on the whiteboard BEFORE coding — interviewers at Google and Meta reward this',
      'Space complexity for recursion is at minimum O(depth) due to the call stack — always mention this',
      'For classic insight problems (Tower of Hanoi, Josephus): verbalize the key decomposition BEFORE writing code — interviewers at SD3 level score the insight statement independently from the implementation'
    ],

    patterns: [
      {
        id: 'P1', name: 'Foundation — Call Stack Mechanics',
        recognitionSignals: [
          'Problem involves processing a sequential structure (linked list, sequence) until the end',
          'The operation at each step depends ONLY on the current element and the result of the rest',
          'Base case is clearly a single trivial answer (empty, zero)'
        ],
        questionIds: ['GFG_FACTORIAL', 'LC_509', 'LC_206', 'LC_203', 'LC_21']
      },
      {
        id: 'P2', name: 'Halving Recursion — Divide at Each Step',
        recognitionSignals: [
          'The problem size halves at each step naturally',
          'The answer for n can be expressed using the answer for n/2',
          'Divide-and-conquer split where halves are independent'
        ],
        questionIds: ['LC_704', 'LC_50', 'LC_779', 'LC_1545']
      },
      {
        id: 'P3', name: 'Linked List Recursion — Traversal & Chunk Processing',
        recognitionSignals: [
          'Linked list operation that feels natural as "do something to head, then recurse on the rest"',
          'Operation involves reversing or processing a fixed-size group within a list',
          'List has a branching/child pointer — recursion naturally handles each depth level independently'
        ],
        questionIds: ['LC_24', 'LC_25', 'LC_430']
      },
      {
        id: 'P4', name: 'Recursive Parsing — Nested Structures',
        recognitionSignals: [
          'String or expression has nested structure — balanced brackets, recursive grammar',
          'The structure can be defined as: element = literal | open ELEMENT close',
          'An iterative approach would require a counter tracking nesting depth — that is a sign to use recursion instead'
        ],
        questionIds: ['LC_38', 'LC_394']
      },
      {
        id: 'P5', name: 'Divide-and-Conquer',
        recognitionSignals: [
          'Problem splits into independent subproblems that are combined after solving',
          'The answer for the full input derives from answers for non-overlapping halves',
          'No shared state between subproblems — each half can be solved independently'
        ],
        questionIds: ['LC_241', 'GFG_MERGE_SORT', 'GFG_QUICK_SORT', 'LC_2698']
      },
      {
        id: 'P6', name: 'Classic Insight-Driven Recursion',
        recognitionSignals: [
          'Problem has a well-known recursive decomposition not obvious from the statement',
          'The key insight is a mathematical recurrence or structural decomposition',
          'Recognising the pattern drastically simplifies the implementation'
        ],
        questionIds: ['GFG_STACK_REVERSE', 'GFG_TOWER_OF_HANOI', 'LC_1823']
      }
    ],

    questions: {
      'LC_509': { leetcode: 509, title: 'Fibonacci Number', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/fibonacci-number/', templateRefs: ['P1'], tags: ['recursion','math'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Bottom-up O(n) time, O(1) space — no call stack overhead. Preferred in production. Recursive form here is for building the mental model.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'F(n) = F(n-1) + F(n-2) with F(0)=0, F(1)=1. The problem IS the recursive definition — write the definition as code. Two base cases, one recursive case.', shrinkTrigger: 'n reduces by 1 or 2 on each call. Base case: n <= 1 returns n directly (F(0)=0, F(1)=1 — both covered by returning n).', timeComplexity: 'O(2^n) naive recursion — exponential due to overlapping subproblems', spaceComplexity: 'O(n) — call stack depth', gotcha: 'Two base cases: F(0) = 0, F(1) = 1. A single guard n <= 1 returns n handles both — verify: F(0) returns 0 ✓, F(1) returns 1 ✓. Missing the F(0)=0 case is the most common off-by-one.', faangNote: 'Never asked alone in a real FAANG interview, but every recruiter uses it as a warm-up to watch how you think about base cases and call stack depth. Always state the exponential complexity and offer the iterative O(1)-space solution as a follow-up.' },

      'LC_206': { leetcode: 206, title: 'Reverse Linked List', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/reverse-linked-list/', templateRefs: ['P1'], tags: ['recursion','linked-list'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Three-pointer (prev, curr, next) in O(1) space. Preferred in production — recursive approach uses O(n) stack space.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'Recurse to the end. On the way back, redirect each node\'s next pointer backward. After recurse(head.next) returns the new head: head.next.next = head (redirect); head.next = null (sever). Return the new head unchanged all the way up.', shrinkTrigger: 'Base case: head == null or head.next == null — return head. Each call processes one node and recurses on the rest.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack', gotcha: 'Set head.next.next = head BEFORE head.next = null. Reversing the order severs the forward pointer before you can use it — you lose the rest of the list.', faangNote: 'The recursive form teaches the call stack clearly. Every FAANG interviewer accepts it but will ask about the O(n) space cost. Always offer the iterative O(1) space solution as a follow-up.' },

      'LC_203': { leetcode: 203, title: 'Remove Linked List Elements', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/remove-linked-list-elements/', templateRefs: ['P1'], tags: ['recursion','linked-list'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Sentinel/dummy head pattern — O(1) space. More production-appropriate.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'Universal linked list recursion shape: recurse first, then decide what to return. Set head.next = recurse(head.next). If head.val == val, skip head by returning head.next. Else keep head by returning head.', shrinkTrigger: 'Base case: head == null → return null. Each call processes one node.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack', gotcha: 'The assignment head.next = recurse(head.next) happens BEFORE the decision to return head or head.next. This correctly stitches the new tail onto head regardless of whether head is kept or skipped.', faangNote: 'Internalise the universal shape here: node.next = recurse(node.next); return condition ? node.next : node. This exact shape recurs in every linked list recursion problem. Master it at Easy difficulty so it feels automatic at Hard.' },

      'LC_21': { leetcode: 21, title: 'Merge Two Sorted Lists', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/merge-two-sorted-lists/', templateRefs: ['P1'], tags: ['recursion','linked-list','two-pointers'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Dummy head, iterative pointer advancement. O(1) space. Preferred in production.', complexity: 'O(n+m) time, O(1) space' }], keyInsight: 'Compare heads. The smaller head is the next node in the merged result. Attach it to the result of merging the rest: smallerHead.next = merge(smallerHead.next, otherHead). A clean two-way choice at each recursive step.', shrinkTrigger: 'Base cases: list1 == null → return list2; list2 == null → return list1. Each call reduces total node count by 1.', timeComplexity: 'O(n + m)', spaceComplexity: 'O(n + m) — call stack', gotcha: 'The LARGER head is not modified — only the smaller head\'s next pointer is updated. The larger head stays unchanged and is passed recursively. A common bug is advancing both pointers.', faangNote: 'Table stakes at FAANG. This merge logic is the core of Merge Sort (sorting topic), Merge K Sorted Lists (heap topic), and Sort List. Connecting these dots explicitly scores highly — say: "This is the merge step of merge sort applied recursively."' },

      'LC_50': { leetcode: 50, title: 'Pow(x, n)', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/powx-n/', templateRefs: ['P2'], tags: ['recursion','math','fast-exponentiation','divide-and-conquer'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Bit-manipulation iterative fast power. O(log n) time, O(1) space — same asymptotic as recursive but no call stack overhead.', complexity: 'O(log n) time, O(1) space' }], keyInsight: 'x^n = (x^(n/2))^2 when n is even; x^n = x * (x^(n/2))^2 when n is odd. Compute half = recurse(x, n/2) ONCE, then return half*half or x*half*half. Reusing the same recursive call result is what achieves O(log n) instead of O(n).', shrinkTrigger: 'n halves on each even call. Base case: n == 0 → return 1.0.', timeComplexity: 'O(log n)', spaceComplexity: 'O(log n) — call stack depth', gotcha: 'Negative n: negate n and compute, then return 1.0 / result. n = Integer.MIN_VALUE overflows when negated in 32-bit — cast to long first.', faangNote: 'Asked verbatim at Google, Meta, and Amazon screeners. O(n) repeated multiplication is an automatic fail signal. Lead with: "I can compute x^n in O(log n) by halving the exponent at each step and reusing the result for the even case."' },

      'LC_779': { leetcode: 779, title: 'K-th Symbol in Grammar', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/k-th-symbol-in-grammar/', templateRefs: ['P2'], tags: ['recursion','bit-manipulation','math'], alternateApproaches: [], keyInsight: 'Each element in row n comes from row n-1: parent of position k (1-indexed) is at position ceil(k/2). If k is odd, the child equals the parent. If k is even, the child is the flipped parent. Recurse to row 1 — base case is 0.', shrinkTrigger: 'Base case: n == 1 → return 0. Each call reduces n by 1.', timeComplexity: 'O(n) — n recursive calls', spaceComplexity: 'O(n) — call stack', gotcha: 'k is 1-indexed. Parent of k is Math.ceil(k/2). The flip condition is k % 2 == 0 (even position = flipped parent value). Off-by-one on the index here produces wrong answers on most inputs.', faangNote: 'Pure recursive reasoning problem — there is no iterative shortcut that is simpler. The insight is recognizing the parent-child structure. A candidate who figures this out without a hint signals strong recursive thinking — interviewers note this explicitly.' },

      'LC_24': { leetcode: 24, title: 'Swap Nodes in Pairs', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/swap-nodes-in-pairs/', templateRefs: ['P3'], tags: ['recursion','linked-list'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Process pairs with prev/first/second pointers. O(1) space.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'Take the first two nodes. second.next = recurse(third). first.next = second. Return second as the new head. Three pointer reassignments per pair — recursion handles the rest.', shrinkTrigger: 'Base case: head == null or head.next == null → return head. Each call processes 2 nodes.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack', gotcha: 'Save second = head.next BEFORE any pointer mutations. Assign second.next = recurse(third) BEFORE first.next = second. Wrong order creates a cycle in the list.', faangNote: 'The "process chunk, recurse on rest" pattern with chunk size 2. Interviewers use this as a warm-up before LC_25 (chunk size k). Solve this first — the pattern for LC_25 becomes immediately obvious.' },

      'LC_38': { leetcode: 38, title: 'Count and Say', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/count-and-say/', templateRefs: ['P4'], tags: ['recursion','string'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Build each string from the previous iteratively. O(1) auxiliary space per step.', complexity: 'O(n * L) where L = output length of step n' }], keyInsight: 'countAndSay(n) = runLengthEncode(countAndSay(n-1)). Get the previous string via recursion, then scan it to produce the run-length encoding. Two-pointer scan: count consecutive identical digits, append count then digit.', shrinkTrigger: 'Base case: n == 1 → return "1". Each call reduces n by 1.', timeComplexity: 'O(n * L_max) where L_max is the output length of the nth term', spaceComplexity: 'O(L_max) per level on the call stack', gotcha: 'Run-length encoding groups consecutive identical characters — "1211" encodes as "111221" (one 1, one 2, two 1s). Do not merge non-consecutive runs of the same digit even if they have the same value.', faangNote: 'Amazon and Microsoft use this as a string recursion warm-up. The recursive form — get previous term recursively, then process — is cleaner than building all strings iteratively and makes the structure explicit.' },

      'LC_394': { leetcode: 394, title: 'Decode String', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/decode-string/', templateRefs: ['P4'], tags: ['recursion','string','parsing','nested','stack'], alternateApproaches: [{ technique: 'stack', tradeoff: 'Explicit stack instead of call stack. O(n) space same asymptotic but iterative — avoids recursion depth limits for deeply nested inputs.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'Maintain a shared index into the string. Parse: read digits to get k. Expect [. Recurse to parse the inner string until ]. Repeat inner string k times. Each recursive call returns the decoded inner string AND has advanced the shared index past the closing ].', shrinkTrigger: 'Base case: index == s.length or s[index] == \']\' — return empty string. Nesting depth equals recursive call depth.', timeComplexity: 'O(n * max_k) — proportional to the expanded output length', spaceComplexity: 'O(n) — call stack plus output string', gotcha: 'The number before [ can be multi-digit (e.g. "10[abc]") — parse a full integer with a while loop accumulating digits, not just a single character.', faangNote: 'Very high Meta and Google frequency. The shared index pattern is the key insight — substring splitting creates O(n²) copies. State: "I use a shared index advanced as a side effect of each recursive call — this keeps parsing O(n)."' },

      'LC_241': { leetcode: 241, title: 'Different Ways to Add Parentheses', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/different-ways-to-add-parentheses/', templateRefs: ['P5'], tags: ['recursion','divide-and-conquer','math','string'], alternateApproaches: [{ technique: 'memoization', tradeoff: 'Cache [start][end] results to avoid recomputing overlapping substrings. Input size is small (≤20 chars) so pure recursion is accepted in interviews, but memoization is the production answer.', complexity: 'O(n * Catalan(n)) time and space with memoization' }], keyInsight: 'For each operator in the expression, it could be the LAST operation evaluated. Split at every operator: left = all results for left substring, right = all results for right substring. Apply the operator to every (left, right) pair and collect all results.', shrinkTrigger: 'Base case: string contains no operator — it is a pure number. Parse and return [number] as a single-element list.', timeComplexity: 'O(n * Catalan(n)) — exponential but input is small', spaceComplexity: 'O(n * Catalan(n))', gotcha: 'Base case is detecting a pure number — check if NO operator exists in the string. Checking length == 1 breaks on multi-digit numbers like "12".', faangNote: 'The "split at the last operator" frame — what is the last operation evaluated? — appears in LC_95 (Unique BSTs II) and LC_96. Stating this framing before coding earns extra points from interviewers.' },

      'LC_25': { leetcode: 25, title: 'Reverse Nodes in k-Group', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/reverse-nodes-in-k-group/', templateRefs: ['P3'], tags: ['recursion','linked-list'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Process k-groups iteratively with careful pointer management. O(1) space. Complex to implement — four pointer variables needed per group.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'Count k nodes. If fewer than k remain, return head unchanged (base case — do not reverse incomplete groups). Reverse exactly k nodes. Connect the tail of the reversed group to recurse(remaining list). Return the new head of the reversed group.', shrinkTrigger: 'Base case: fewer than k nodes remain → return head. Each call reduces the list by k nodes.', timeComplexity: 'O(n)', spaceComplexity: 'O(n/k) — recursion depth', gotcha: 'After reversing k nodes in-place, the original head node IS the tail of the reversed group. Its next pointer must be assigned to the recursive result — missing this leaves the tail pointing directly to the (k+1)th node, skipping all subsequent reversed groups.', faangNote: 'Meta and Google Hard. Interviewers expect the recursive form first, then ask for O(1) space iterative as a follow-up. Say: "Each recursive call processes one k-group. Call stack depth is n/k — roughly 100 frames for n=1000, k=10, well within limits."' },

      'LC_273': { leetcode: 273, title: 'Integer to English Words', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/integer-to-english-words/', templateRefs: ['P4'], tags: ['recursion','math','string'], alternateApproaches: [], keyInsight: 'Split the number into 3-digit chunks (ones, thousands, millions, billions). For each non-zero chunk, call a helper that handles 1–999 recursively: hundreds digit, then recurse on the remainder (tens + ones). Combine chunk results with the appropriate magnitude word.', shrinkTrigger: 'Helper base case: num == 0 → return "". Numbers below 20: direct lookup. Numbers 20–99: tens word + recurse on ones. Numbers 100–999: hundreds + "Hundred" + recurse on remainder.', timeComplexity: 'O(1) — number of digits is bounded (max 10 digits for a 32-bit integer)', spaceComplexity: 'O(1)', gotcha: 'Special case: num == 0 at the top level must return "Zero". The inner helper returns "" for 0 but the entry point must handle zero differently. This is the single most commonly missed edge case.', faangNote: 'Google and Amazon screener classic. Expected answer is recursive chunking — candidates who try to handle every case in one flat loop fail. Say: "I split into billions, millions, thousands, ones groups and recurse on each 3-digit chunk independently."' },

      'LC_224': { leetcode: 224, title: 'Basic Calculator', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/basic-calculator/', templateRefs: ['P4'], tags: ['recursion','string','parsing','stack','math'], alternateApproaches: [{ technique: 'stack', tradeoff: 'Explicit stack of (result, sign) pairs. Same O(n) time and space but iterative — avoids recursion depth limits for extremely deeply nested expressions.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'Recursive descent parser. Maintain a shared index. Per level: accumulate numbers with sign tracking. On + or -: apply sign to current number and update sign. On (: recurse into inner expression, add its return value. On ) or end: return current accumulated result.', shrinkTrigger: 'Base case: index reaches end of string or hits ) — return the accumulated result for this level. Recursion depth equals parenthesis nesting depth.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack depth equals nesting depth', gotcha: 'Track sign as +1 or -1, not as a character. A minus sign applies to everything at the current nesting level until the next operator. On (, the inner result is returned with its own sign applied — the outer level then applies its current sign to that returned value.', faangNote: 'Google Hard — tests whether you can model a grammar recursively. The recursive parser is the SD3 signal. Say: "Each parenthesized subexpression is a subproblem. I recurse into it and return its evaluated value. The call stack models the nesting depth directly."' },

      // ── P2: Halving additions (binary search) ────────────────────────────────────
      'LC_704': { leetcode: 704, title: 'Binary Search (Recursive)', difficulty: 'Easy', difficultyRank: 1, link: 'https://leetcode.com/problems/binary-search/', templateRefs: ['P2'], tags: ['recursion','binary-search','array','halving'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Two pointers lo/hi in a while loop. O(1) space — no call stack. Preferred in production.', complexity: 'O(log n) time, O(1) space' }], keyInsight: 'Halve the search space at every call: compute mid, compare target to nums[mid]. If equal → found. If target < nums[mid] → recurse on left half (hi = mid-1). If target > nums[mid] → recurse on right half (lo = mid+1). Recurrence: T(n) = T(n/2) + O(1) → O(log n).', shrinkTrigger: 'Base case: lo > hi → return -1 (not found). Search space halves on every call.', timeComplexity: 'O(log n)', spaceComplexity: 'O(log n) — call stack depth. This is the key contrast with iterative O(1) space.', gotcha: 'Compute mid as lo + Math.floor((hi - lo) / 2), NOT Math.floor((lo + hi) / 2). The latter overflows for large indices in 32-bit languages. Interviewers check this explicitly.', faangNote: 'Asked as a recursion warm-up at Google and Amazon screeners: "Implement binary search recursively and state the recurrence relation." The expected answer is T(n) = T(n/2) + O(1) → O(log n) by Master Theorem. Failing to give the recurrence is a red flag at SDE2+.' },

      // ── P1: Foundation additions ───────────────────────────────────────────────
      'GFG_FACTORIAL': { leetcode: null, title: 'Factorial of a Number', difficulty: 'Easy', difficultyRank: 1, link: 'https://www.geeksforgeeks.org/program-for-factorial-of-a-number/', templateRefs: ['P1'], tags: ['recursion','math'], alternateApproaches: [{ technique: 'iteration', tradeoff: 'Simple for-loop, O(1) space. Preferred in production. The recursive form is here purely for building the mental model.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'fact(n) = n * fact(n-1) with base case fact(0) = 1. The single-step reduction: one base case, one recursive case. The simplest possible recursive function — start here before every other problem.', shrinkTrigger: 'n reduces by 1 on each call. Base case: n == 0 → return 1.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack depth', gotcha: 'Base case is n == 0, not n == 1. fact(0) = 1 by definition. A guard of n <= 1 returning 1 also works. Missing n == 0 causes infinite recursion or wrong output for fact(0).', faangNote: 'Never asked standalone in a FAANG interview but every recursion discussion starts here. Use it to demonstrate: state base case first, state recursive step, state call stack depth, and offer the iterative O(1)-space version as a follow-up.' },

      // ── P2: Halving additions ──────────────────────────────────────────────────
      'LC_1545': { leetcode: 1545, title: 'Find Kth Bit in Nth Binary String', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/find-kth-bit-in-nth-binary-string/', templateRefs: ['P2'], tags: ['recursion','string','bit-manipulation','halving'], alternateApproaches: [], keyInsight: 'S_n has length 2^n - 1. The middle position is mid = 2^(n-1). If k == mid → return "1". If k < mid → recurse on S_{n-1} with same k (left half is identical). If k > mid → position mirrors from the left half AND is flipped: recurse(n-1, 2^n - k) then flip the result.', shrinkTrigger: 'Base case: n == 1 → return "0". Each call reduces n by 1.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack', gotcha: 'The mirrored position formula is 2^n - k, NOT 2^(n-1) - k. Off-by-one on the mirror formula produces wrong answers on nearly every input. Derive it: the right half is the reverse of S_{n-1}, so position k in the right half maps to position (len - (k - mid - 1)) in S_{n-1}.', faangNote: 'Structural sibling of LC_779 (K-th Symbol in Grammar) — both use parent-child position mapping across recursion levels. If you solved LC_779 first, state this connection explicitly: "Same halving + parent-child structure; the only difference is the mirror-and-flip rule for the right half."' },

      // ── P3: Linked List additions ──────────────────────────────────────────────
      'LC_430': { leetcode: 430, title: 'Flatten a Multilevel Doubly Linked List', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/flatten-a-multilevel-doubly-linked-list/', templateRefs: ['P3'], tags: ['recursion','linked-list','divide-and-conquer'], alternateApproaches: [{ technique: 'stack', tradeoff: 'Explicit stack to defer tails when a child branch is encountered. O(n) space. Iterative and avoids recursion depth issues for very deeply nested lists.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'When a node has a child: recursively flatten the child list (returns the tail of the flattened child). Insert the flattened child between current and current.next by wiring four pointers. Continue traversal from the child tail. The call stack naturally handles nesting depth.', shrinkTrigger: 'Base case: node == null → return null. Each level of nesting reduces to a flat list via one recursive call.', timeComplexity: 'O(n) — each node visited exactly once', spaceComplexity: 'O(d) — call stack depth equals nesting depth d', gotcha: 'Save current.next BEFORE setting current.next = child. After flattening the child you need the saved reference to wire childTail.next → savedNext. Missing the save permanently loses the original tail.', faangNote: 'Tests recursive thinking on a non-standard data structure. The key signal interviewers want: "When I encounter a child I recursively flatten it to get its tail — then I wire four pointers to splice it in. I continue traversal from the child tail, not from the child head."' },

      // ── P5: Divide & Conquer additions ────────────────────────────────────────
      'GFG_MERGE_SORT': { leetcode: null, title: 'Merge Sort', difficulty: 'Medium', difficultyRank: 2, link: 'https://www.geeksforgeeks.org/merge-sort/', templateRefs: ['P5'], tags: ['recursion','divide-and-conquer','sorting','array'], alternateApproaches: [{ technique: 'bottom-up iterative merge sort', tradeoff: 'Merge sublists of size 1, then 2, then 4 — no recursion. O(1) stack space. Same O(n log n) time but harder to implement.', complexity: 'O(n log n) time, O(1) extra stack space' }], keyInsight: 'Split array at midpoint into two independent halves. Recursively sort each half. Merge the two sorted halves into one. The SPLIT is trivial — the MERGE is the only non-trivial work. Work happens on the way BACK UP the call stack (post-order combination).', shrinkTrigger: 'Base case: array size 0 or 1 is already sorted. Each call halves the input → O(log n) depth.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n) — auxiliary array for merge; O(log n) — call stack', gotcha: 'Compute mid as left + Math.floor((right - left) / 2), NOT Math.floor((left + right) / 2). The latter overflows for large indices in 32-bit languages. This is a common interview trap.', faangNote: 'Canonical D&C problem. Interviewers expect you to trace the call tree and explain O(n log n): O(log n) levels × O(n) work per merge level. Lead with the call tree on the whiteboard, not the code. Also know: merge sort is the only O(n log n) sort for linked lists — quicksort requires random access.' },

      'GFG_QUICK_SORT': { leetcode: null, title: 'Quick Sort', difficulty: 'Medium', difficultyRank: 2, link: 'https://www.geeksforgeeks.org/quick-sort-algorithm/', templateRefs: ['P5'], tags: ['recursion','divide-and-conquer','sorting','array'], alternateApproaches: [{ technique: 'three-way partition (Dutch National Flag)', tradeoff: 'Handles arrays with many duplicates efficiently — reduces O(n²) with duplicates to O(n) average case.', complexity: 'O(n log n) average' }], keyInsight: 'Pick a pivot and PARTITION: all elements < pivot go left, all > pivot go right. After partitioning the pivot is at its FINAL sorted position. Recurse on left subarray and right subarray independently. NO merge step needed — partitioning does the combining inline.', shrinkTrigger: 'Base case: lo >= hi → return. Partition is NOT guaranteed 50-50 — random pivot avoids worst-case O(n²).', timeComplexity: 'O(n log n) average; O(n²) worst case without random pivot', spaceComplexity: 'O(log n) call stack average; O(n) worst case', gotcha: 'Without random pivot selection, a sorted or reverse-sorted input causes the pivot to always be the min/max, producing O(n²) behaviour. Always randomize the pivot and state this explicitly in an interview.', faangNote: 'Compare Merge Sort vs Quick Sort cold: Merge Sort is O(n log n) guaranteed, stable, uses O(n) extra space. Quick Sort is in-place (O(1) auxiliary space) but O(n²) worst case and not stable. Know which to choose for which constraint.' },

      'LC_2698': { leetcode: 2698, title: 'Find the Punishment Number of Integers', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/find-the-punishment-number-of-an-integer/', templateRefs: ['P5'], tags: ['recursion','math','string','divide-and-conquer'], alternateApproaches: [], keyInsight: 'For each i from 1 to n, check if i² can be partitioned into contiguous digit substrings whose INTEGER sum equals i. The partition check is recursive D&C: try every split point of the digit string, take the left part as a number, recurse on the right remainder with reduced target (target - leftNum).', shrinkTrigger: 'Base case: remaining string is empty and target == 0 → valid. Prune: parsed integer of remaining string > target → impossible. Each call reduces string length.', timeComplexity: 'O(n × d²) where d = digits in i² (at most 6)', spaceComplexity: 'O(d) — recursion depth is bounded by digit count', gotcha: 'Work on the string representation of i², not on the integer directly. Partitioning an integer requires modular arithmetic that is error-prone; string slicing at each split point is clean and direct.', faangNote: 'Tests recursive partitioning — structurally identical to LC_241 (split an expression at operators) but applied to digit strings. Interviewers award points for stating this connection: "The partition check is the same split-and-recurse pattern as in Different Ways to Add Parentheses."' },

      // ── P6: Classic Structural Recursion additions ─────────────────────────────
      'GFG_STACK_REVERSE': { leetcode: null, title: 'Reverse a Stack Using Recursion', difficulty: 'Medium', difficultyRank: 2, link: 'https://www.geeksforgeeks.org/reverse-a-stack-using-recursion/', templateRefs: ['P6'], tags: ['recursion','stack','classic-recursion'], alternateApproaches: [{ technique: 'auxiliary stack', tradeoff: 'Pop into a second stack — O(n) space but O(1) per operation, iterative, simpler.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'Two recursive functions: (1) reverse(stack): pop top, recursively reverse the rest, call insertAtBottom(stack, top). (2) insertAtBottom(stack, item): if empty → push item; else pop top, insertAtBottom(stack, item), push top back. The call stack IS the auxiliary storage — no extra data structure needed.', shrinkTrigger: 'reverse: base case = empty stack. insertAtBottom: base case = empty stack → push.', timeComplexity: 'O(n²) — n calls to insertAtBottom, each O(n)', spaceComplexity: 'O(n) — call stack depth', gotcha: 'Two separate recursive functions are required. Attempting to merge them into one function conflates two distinct responsibilities (reverse vs insert-at-bottom) and always produces wrong or incomplete code. Accept the two-function structure.', faangNote: 'The deepest insight this problem teaches: the call stack IS a stack data structure. When the call frame unwinds, it is equivalent to popping a physical stack. This mental model directly explains how iterative DFS, tree traversal, and balanced-bracket checking relate to recursion.' },

      'GFG_TOWER_OF_HANOI': { leetcode: null, title: 'Tower of Hanoi', difficulty: 'Medium', difficultyRank: 2, link: 'https://www.geeksforgeeks.org/c-program-for-tower-of-hanoi/', templateRefs: ['P6'], tags: ['recursion','math','classic-recursion'], alternateApproaches: [], keyInsight: 'To move n disks from source to destination via auxiliary: (1) Move top n-1 disks from source to auxiliary. (2) Move the largest disk directly to destination. (3) Move n-1 disks from auxiliary to destination. Three sub-problems; the middle one is trivially a single move. Total moves = 2^n - 1 (provably optimal).', shrinkTrigger: 'Base case: n == 1 → move disk directly. Each call reduces n by 1.', timeComplexity: 'O(2^n) — provably optimal, cannot be done in fewer moves', spaceComplexity: 'O(n) — call stack depth', gotcha: 'The ORDER of the three recursive calls is critical. Step 1 uses auxiliary as destination; step 3 uses auxiliary as source. Swapping calls 1 and 3 produces an invalid sequence. Always label the three pegs by ROLE (source, destination, auxiliary) not by fixed name (A, B, C).', faangNote: 'The canonical "trust the recursion" problem. Step 1 says: move n-1 disks to the spare peg. You do not need to know HOW — you trust the recursive call handles it correctly. Verbalizing this trust explicitly ("I do not need to trace the n-1 sub-problem — I assume it is correct and build on it") is the SD3 signal for recursive thinking.' },

      'LC_1823': { leetcode: 1823, title: 'Find the Winner of a Circular Game', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/find-the-winner-of-the-circular-game/', templateRefs: ['P6'], tags: ['recursion','math','array','mathematical-recursion'], alternateApproaches: [{ technique: 'simulation', tradeoff: 'Use a queue: rotate k-1 positions, remove front. O(n*k) time — too slow for large n and k.', complexity: 'O(n*k) time, O(n) space' }, { technique: 'iterative Josephus', tradeoff: 'Bottom-up recurrence: pos = 0 for n=1; pos = (pos + k) % i for i = 2..n. Equivalent to recursion but O(1) stack space — the preferred production form.', complexity: 'O(n) time, O(1) space' }], keyInsight: 'Josephus problem. Recurrence (0-indexed): winner(1, k) = 0; winner(n, k) = (winner(n-1, k) + k) % n. The winner position in a group of n maps from the winner position in a group of n-1 by shifting k positions modulo n. Recurse down to 1, propagate positions back up, then add 1 for 1-indexed output.', shrinkTrigger: 'Base case: n == 1 → return 0. Each call reduces n by 1.', timeComplexity: 'O(n)', spaceComplexity: 'O(n) — call stack', gotcha: 'The recursion returns a 0-indexed position. Add 1 ONLY at the outermost call for 1-indexed output. Adding 1 inside the recursion corrupts all intermediate position computations.', faangNote: 'Demonstrates that a mathematical recurrence can reduce an O(n*k) simulation to O(n). Knowing the Josephus formula differentiates candidates who have studied mathematical recursion from those who only know structural recursion. Always offer the iterative O(1)-space version as a follow-up.' }
    }
  }
  // ← Add new topic modules here
    ,
    'backtracking': {
      description: 'A systematic algorithm technique that builds candidates to a solution incrementally and abandons a candidate ("backtracks") as soon as it determines the candidate cannot lead to a valid solution. In FAANG interviews, backtracking appears in six distinct forms: subset/combination generation, permutation generation, string partitioning, grid/graph path finding, constraint satisfaction on boards, and constructive enumeration with pruning.',
      goal: 'Cover 95% of FAANG Backtracking questions by mastering 6 patterns, 6 templates, and 21 curated problems',
      relatedTopics: ['recursion', 'binary-search', 'sorting'],
      tagRegistry: [
        'backtracking', 'subset', 'combination', 'permutation',
        'duplicate-handling', 'pruning', 'partition', 'string',
        'grid', 'dfs', 'constraint-satisfaction', 'visited',
        'start-index', 'target-sum', 'graph', 'path-enumeration',
        'bucket-filling', 'expression-building', 'memoization',
        'array', 'board', 'in-place',
        'hashset-dedup', 'subsequence', 'trie', 'word-break', 'dictionary', 'dag'
      ],
      techniqueRegistry: [
        'backtracking', 'dfs', 'pruning', 'visited-array',
        'start-index', 'in-place-marking', 'memoization',
        'constraint-propagation', 'bucket-filling',
        'expression-building', 'multiplication-undo',
        'hashset-per-level', 'trie-pruning', 'memoized-backtracking'
      ],
      whenToUse: {
        use: [
          'Problem asks for ALL valid combinations, subsets, or permutations',
          'Problem asks you to BUILD a solution incrementally and validate at each step',
          'Search space is exponential but heavy pruning makes it tractable',
          'Problem involves choosing from a set of options at each step with constraints',
          'Keywords: "all possible", "generate all", "find all valid", "enumerate"'
        ],
        avoid: [
          'Only ONE optimal answer needed — use DP or Greedy instead',
          'Problem has overlapping subproblems without enumeration need — use DP instead',
          'Graph traversal without path tracking — use plain DFS/BFS instead',
          'Counting solutions only without enumerating them — use DP instead',
          'If the backtracking state space has overlapping subproblems AND you only need a count or boolean — memoize the state and use top-down DP instead (e.g., Word Break, Target Sum as count)',
          'If n > 20 and no aggressive pruning is possible — pure backtracking will TLE; consider bitmask DP or mathematical approach'
        ]
      },
      interviewTips: [
        'Always verbalize the choose → explore → unchoose rhythm before writing code.',
        'Draw the decision tree on the whiteboard first. Two minutes drawing saves ten minutes debugging.',
        'State your pruning conditions explicitly before coding.',
        'For duplicate handling: always sort first, then skip nums[i] === nums[i-1] at the same recursion level (i > start).',
        'Distinguish i vs i+1 in recursive calls: i allows reuse, i+1 moves forward.',
        'Time complexity is almost always O(2^n) or O(n!) — state this proactively.',
        'In grid backtracking, prefer in-place marking to save O(m*n) space.',
        'If pure backtracking TLEs, mention memoization on start index as next optimization step.'
      ],
      patterns: [
          {
            id: 'P1',
            name: 'Binary Decision / Include-Exclude',
            recognitionSignals: [
              'Problem asks for ALL subsets or power set',
              'Each element has a binary in/out decision',
              'No ordering constraint on the output'
            ],
            questionIds: ['LC_78', 'LC_90', 'LC_491']
          },
          {
            id: 'P2',
            name: 'For-loop Choice / Combination with Start Index',
            recognitionSignals: [
              'Problem asks for combinations where order does NOT matter',
              'A target sum must be reached',
              'Elements may or may not be reused',
              'Keywords: "combinations that sum to", "choose k from n"'
            ],
            questionIds: ['LC_77', 'LC_39', 'LC_40', 'LC_216']
          },
          {
            id: 'P3',
            name: 'Permutation / Visited-State Backtracking',
            recognitionSignals: [
              'Problem asks for ALL permutations or arrangements',
              'Order matters in the output',
              'Every element must be used exactly once per permutation'
            ],
            questionIds: ['LC_46', 'LC_47']
          },
          {
            id: 'P4',
            name: 'Partition / Cut-the-String Backtracking',
            recognitionSignals: [
              'Input is a string that must be split into valid segments',
              'Each segment must satisfy a constraint (palindrome, valid number, dictionary word)',
              'All valid partitions must be returned'
            ],
            questionIds: ['LC_131', 'LC_93', 'LC_17', 'LC_140']
          },
          {
            id: 'P5',
            name: 'Grid / Graph Path Backtracking',
            recognitionSignals: [
              'Search for a path or all paths in a 2D grid or graph',
              'Each cell or node can only be used once per path',
              'Must track the path itself, not just reachability'
            ],
            questionIds: ['LC_79', 'LC_797', 'LC_212']
          },
          {
            id: 'P6',
            name: 'Constraint Satisfaction / Board Backtracking',
            recognitionSignals: [
              'Fill a board or grid under strict placement rules',
              'Each placement must be validated against multiple constraints simultaneously',
              'Keywords: "valid placement", "no conflict", "fill the board"'
            ],
            questionIds: ['LC_51', 'LC_37', 'LC_698']
          }
        ],
      questions: {
          'LC_78': {
            leetcode: 78,
            title: 'Subsets',
            difficulty: 'Medium',
            status: 'Pending',
            link: 'https://leetcode.com/problems/subsets/',
            templateRefs: ['P1'],
            tags: ['backtracking', 'subset', 'array'],
            keyInsight: 'The core backtracking skeleton lives here. Result is recorded at EVERY node of the tree, not just leaves. The choose → explore → unchoose rhythm must be internalized from this problem before moving to any other.',
            shrinkTrigger: 'Add current snapshot to result. Loop from start to end: push nums[i], recurse with i+1, pop nums[i].',
            timeComplexity: 'O(n * 2^n)',
            spaceComplexity: 'O(n)',
            gotcha: 'Record result.push([...current]) — not result.push(current). JavaScript arrays are passed by reference. Pushing current directly means every recorded entry points to the same array object. When backtracking unwinds and empties the array, ALL previously recorded entries become empty arrays.',
            faangNote: 'Asked as a warm-up at Google and Meta to verify the candidate knows the backtracking skeleton before harder problems.',
            alternateApproaches: [
              {
                technique: 'Iterative bit masking',
                tradeoff: 'Same complexity, no recursion, but harder to extend to constrained variants',
                complexity: 'O(n * 2^n)'
              }
            ]
          },

                'LC_90': {
                  leetcode: 90,
                  title: 'Subsets II',
                  difficulty: 'Medium',
                  status: 'Pending',
                  link: 'https://leetcode.com/problems/subsets-ii/',
                  templateRefs: ['P1'],
                  tags: ['backtracking', 'subset', 'array', 'duplicate-handling'],
                  keyInsight: 'Sort first. Skip duplicate siblings at the same recursion depth using: if (i > start && nums[i] === nums[i-1]) continue. The sort ensures duplicates are adjacent so this check works.',
                  shrinkTrigger: 'Record snapshot at every node. Loop from start: skip if i > start && nums[i] === nums[i-1]. Push, recurse i+1, pop.',
                  timeComplexity: 'O(n * 2^n)',
                  spaceComplexity: 'O(n)',
                  gotcha: 'The skip condition is i > start, NOT i > 0. Using i > 0 incorrectly skips valid elements at deeper recursion levels. This is the single most common bug in this problem.',
                  faangNote: 'Google and Meta use this to test duplicate-handling awareness. The i > start vs i > 0 distinction is a direct SD3 signal.',
                  alternateApproaches: [
                    {
                      technique: 'Iterative with set deduplication',
                      tradeoff: 'Use a Set to deduplicate results. Simpler logic but O(n * 2^n) extra space.',
                      complexity: 'O(n * 2^n)'
                    }
                  ]
                },

          'LC_46': {
            leetcode: 46,
            title: 'Permutations',
            difficulty: 'Medium',
            status: 'Pending',
            link: 'https://leetcode.com/problems/permutations/',
            templateRefs: ['P3'],
            tags: ['backtracking', 'permutation', 'visited', 'array'],
            keyInsight: 'Unlike subsets, permutations loop from index 0 every time. A visited[] array replaces the start index. This is the structural difference between combination-style and permutation-style backtracking.',
            shrinkTrigger: 'If current.length === nums.length → record result. Else loop all indices: skip if visited[i], mark visited, push, recurse, pop, unmark.',
            timeComplexity: 'O(n * n!)',
            spaceComplexity: 'O(n)',
            gotcha: 'You must unmark visited[i] = false after the recursive call. Forgetting this means subsequent branches incorrectly see elements as used.',
            faangNote: 'Asked at every major FAANG company. The visited array pattern appears in many harder problems — master it here.',
            alternateApproaches: [
              {
                technique: 'Swap-based in-place',
                tradeoff: 'O(1) extra space but output order differs and harder to extend to duplicates',
                complexity: 'O(n * n!)'
              }
            ]
          },

          'LC_47': {
            leetcode: 47,
            title: 'Permutations II',
            difficulty: 'Medium',
            status: 'Pending',
            link: 'https://leetcode.com/problems/permutations-ii/',
            templateRefs: ['P3'],
            tags: ['backtracking', 'permutation', 'duplicate-handling', 'visited', 'array'],
            keyInsight: 'Sort first. Duplicate skip condition for permutations: if (i > 0 && nums[i] === nums[i-1] && !visited[i-1]) continue. The !visited[i-1] part ensures we only use the first of identical elements at each level.',
            shrinkTrigger: 'Same as LC_46 but add duplicate skip: if (i > 0 && nums[i] === nums[i-1] && !visited[i-1]) continue.',
            timeComplexity: 'O(n * n!)',
            spaceComplexity: 'O(n)',
            gotcha: 'The condition !visited[i-1] is counterintuitive. It means: if the previous identical element is NOT currently in our path, skip this one. This enforces a fixed ordering among duplicates.',
            faangNote: 'Common follow-up to LC_46. Tests whether you truly understand visited-based backtracking vs just memorizing LC_46.',
            alternateApproaches: []
          },

          'LC_77': {
            leetcode: 77,
            title: 'Combinations',
            difficulty: 'Medium',
            status: 'Pending',
            link: 'https://leetcode.com/problems/combinations/',
            templateRefs: ['P2'],
            tags: ['backtracking', 'combination', 'start-index', 'array'],
            keyInsight: 'The purest form of the start-index pattern. Choose exactly k numbers from 1 to n. No target sum, no reuse — just the forward-only loop with a size constraint. Master this before Combination Sum adds target complexity on top.',
            shrinkTrigger: 'If current.length === k → record result. Else loop from start to n: push i, recurse with i+1, pop i.',
            timeComplexity: 'O(k * C(n,k))',
            spaceComplexity: 'O(k)',
            gotcha: 'Pruning opportunity: loop only up to n - (k - current.length) + 1. If fewer elements remain than needed to fill k slots, stop early. This is a strong optimization signal in interviews.',
            faangNote: 'Often asked before Combination Sum to verify the candidate understands the start-index pattern in isolation.',
            alternateApproaches: []
          },
  'LC_39': {
    leetcode: 39,
    title: 'Combination Sum',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/combination-sum/',
    templateRefs: ['P2'],
    tags: ['backtracking', 'combination', 'target-sum', 'pruning', 'array'],
    keyInsight: 'Passing i instead of i+1 in the recursive call allows reuse of the same element. Sort the array first so you can break early when candidates[i] > remaining. This pruning is what makes the solution efficient.',
    shrinkTrigger: 'If remaining === 0 → record result. If remaining < 0 → return. Loop from start: push candidates[i], recurse with i and remaining - candidates[i], pop.',
    timeComplexity: 'O(n^(target/min)) — exponential but pruned heavily in practice',
    spaceComplexity: 'O(target/min) recursion depth',
    gotcha: 'Pass i not i+1 to allow reuse. If you pass i+1 here you are solving LC_40 not this problem. This single character difference is a common interview mistake.',
    faangNote: 'One of the highest frequency backtracking questions at Amazon and Google. The i vs i+1 distinction is always probed by interviewers.',
    alternateApproaches: []
  },

  'LC_40': {
    leetcode: 40,
    title: 'Combination Sum II',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/combination-sum-ii/',
    templateRefs: ['P2'],
    tags: ['backtracking', 'combination', 'target-sum', 'duplicate-handling', 'pruning', 'array'],
    keyInsight: 'Combines two concepts: pass i+1 (no reuse) AND skip duplicates at same level (i > start && candidates[i] === candidates[i-1]). Sort first. This problem is the convergence point of the combination and duplicate-handling patterns.',
    shrinkTrigger: 'Sort first. If remaining === 0 → record. Loop from start: skip if (i > start && candidates[i] === candidates[i-1]). Push, recurse with i+1 and remaining - candidates[i], pop.',
    timeComplexity: 'O(2^n)',
    spaceComplexity: 'O(n)',
    gotcha: 'You need BOTH i+1 (no reuse) AND the duplicate skip condition. Missing either one produces wrong results. Write both conditions explicitly before coding the recursion body.',
    faangNote: 'Mastering this problem means you can solve LC_39, LC_40, LC_90 as a family. Interviewers use this to test depth of understanding vs surface memorization.',
    alternateApproaches: []
  },

  'LC_216': {
    leetcode: 216,
    title: 'Combination Sum III',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/combination-sum-iii/',
    templateRefs: ['P2'],
    tags: ['backtracking', 'combination', 'target-sum', 'pruning', 'array'],
    keyInsight: 'Constrained combination: exactly k numbers from 1-9 summing to n. No duplicates in input, no reuse. The small fixed search space (digits 1-9 only) makes pruning extremely aggressive and the solution very clean.',
    shrinkTrigger: 'If current.length === k && sum === n → record. If current.length > k or sum > n → return. Loop from start to 9: push i, recurse with i+1 and sum+i, pop.',
    timeComplexity: 'O(C(9,k)) — at most C(9,4) = 126 combinations',
    spaceComplexity: 'O(k)',
    gotcha: 'Prune on BOTH conditions: current.length > k AND sum > n. Pruning only one condition misses half the optimization. Both checks should appear at the top of the function.',
    faangNote: 'Good warm-up problem. If you have solved LC_39 and LC_40 this should take under 10 minutes — a strong positive signal to the interviewer.',
    alternateApproaches: []
  },

  'LC_131': {
    leetcode: 131,
    title: 'Palindrome Partitioning',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/palindrome-partitioning/',
    templateRefs: ['P4'],
    tags: ['backtracking', 'partition', 'string', 'pruning'],
    keyInsight: 'The foundational partition template. Loop end from start+1 to len+1. Take slice s[start:end], check if palindrome. If yes: push, recurse with end as new start, pop. Base case: start === s.length means full string consumed.',
    shrinkTrigger: 'If start === s.length → record result. Loop end from start+1 to s.length+1: if isPalindrome(s, start, end-1) → push slice, recurse with end, pop.',
    timeComplexity: 'O(n * 2^n)',
    spaceComplexity: 'O(n)',
    gotcha: 'The isPalindrome check can be precomputed with a 2D DP table to avoid O(n) check per call. Mention this optimization proactively — it shows you think beyond the naive solution.',
    faangNote: 'Google and Meta favourite. Tests partition template AND string processing simultaneously. Very common in phone screens.',
    alternateApproaches: [
      {
        technique: 'Precompute palindrome DP table',
        tradeoff: 'O(n^2) preprocessing eliminates repeated palindrome checks. Overall still O(n * 2^n) but with smaller constant factor.',
        complexity: 'O(n^2) preprocessing + O(n * 2^n) backtracking'
      }
    ]
  },

  'LC_93': {
    leetcode: 93,
    title: 'Restore IP Addresses',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/restore-ip-addresses/',
    templateRefs: ['P4'],
    tags: ['backtracking', 'partition', 'string', 'pruning'],
    keyInsight: 'Partition template with hard constraints: exactly 4 segments, each segment 0-255, no leading zeros. Aggressive pruning: if segments === 4 and start === s.length → valid. If segments === 4 but string not consumed → invalid. If remaining string length is impossible for remaining segments → prune.',
    shrinkTrigger: 'If segments === 4 && start === s.length → record. Loop length 1 to 3: take s[start:start+len], validate (no leading zero, value <= 255), push, recurse with start+len and segments+1, pop.',
    timeComplexity: 'O(1) — at most 3^4 = 81 combinations to check',
    spaceComplexity: 'O(1) — fixed recursion depth of 4',
    gotcha: 'Leading zero check: if segment length > 1 and first char is "0" → invalid. The value check (<=255) alone does not catch "01" or "001". Both checks are required.',
    faangNote: 'Frequently asked at Amazon. Tests partition template with domain-specific validation. Real-world flavor makes it a consistent interview favourite.',
    alternateApproaches: []
  },

  'LC_17': {
    leetcode: 17,
    title: 'Letter Combinations of a Phone Number',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/letter-combinations-of-a-phone-number/',
    templateRefs: ['P4'],
    tags: ['backtracking', 'partition', 'string', 'array'],
    keyInsight: 'Cartesian product via backtracking. At each index, loop through the mapped characters for digits[index]. No pruning needed — every complete path is valid. The mapping table is the only domain-specific knowledge required.',
    shrinkTrigger: 'If index === digits.length → record current string. Else loop chars in phoneMap[digits[index]]: push char, recurse with index+1, pop char.',
    timeComplexity: 'O(4^n * n) — at most 4 choices per digit (7 and 9 map to 4 chars)',
    spaceComplexity: 'O(n)',
    gotcha: 'Handle empty input: if digits is empty return [] immediately. Forgetting this causes index out of bounds on the first recursive call.',
    faangNote: 'Top 3 most asked backtracking question across all FAANG companies. Often used as the opening backtracking question to warm up the candidate.',
    alternateApproaches: [
      {
        technique: 'Iterative BFS queue',
        tradeoff: 'Build combinations level by level using a queue. Same complexity but less natural — backtracking is the expected approach.',
        complexity: 'O(4^n * n)'
      }
    ]
  },

  'LC_22': {
    leetcode: 22,
    title: 'Generate Parentheses',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/generate-parentheses/',
    templateRefs: ['P2'],
    tags: ['backtracking', 'string', 'pruning', 'constraint-satisfaction'],
    keyInsight: 'State-based pruning replaces a choices array. Two counters — open and close — drive all decisions. Add "(" if open < n. Add ")" if close < open. Base case: current.length === 2*n. No explicit loop needed — just two conditional recursive calls.',
    shrinkTrigger: 'If current.length === 2*n → record. If open < n → recurse with open+1. If close < open → recurse with close+1.',
    timeComplexity: 'O(4^n / sqrt(n)) — the nth Catalan number',
    spaceComplexity: 'O(n)',
    gotcha: 'There is no loop here unlike most backtracking problems. The two conditional calls ARE the branching. Students who force a loop pattern onto this problem overcomplicate it significantly.',
    faangNote: 'Top 3 most asked backtracking question at FAANG. Interviewers love it because it tests whether you can identify state-based pruning vs brute force generation and filtering.',
    alternateApproaches: [
      {
        technique: 'Generate all then filter',
        tradeoff: 'Generate all 2^(2n) strings then filter valid ones. Exponentially worse — never do this in an interview.',
        complexity: 'O(2^(2n) * n)'
      }
    ]
  },

  'LC_51': {
    leetcode: 51,
    title: 'N-Queens',
    difficulty: 'Hard',
    status: 'Pending',
    link: 'https://leetcode.com/problems/n-queens/',
    templateRefs: ['P6'],
    tags: ['backtracking', 'constraint-satisfaction', 'board', 'pruning'],
    keyInsight: 'Three sets track conflicts: cols, diag1 (row-col), diag2 (row+col). Process one row at a time — no need to check rows since we place exactly one queen per row. For each column in the current row check all three sets before placing.',
    shrinkTrigger: 'If row === n → record board snapshot. Loop col 0 to n-1: if col not in cols AND (row-col) not in diag1 AND (row+col) not in diag2 → place queen, add to all three sets, recurse row+1, remove from all three sets.',
    timeComplexity: 'O(n!) — n choices for row 1, n-2 for row 2 and so on',
    spaceComplexity: 'O(n)',
    gotcha: 'Diagonal keys: diag1 uses row-col (constant along top-left to bottom-right diagonal), diag2 uses row+col (constant along top-right to bottom-left diagonal). Mixing these two up produces incorrect conflict detection that is very hard to debug.',
    faangNote: 'Classic hard backtracking question asked directly at Google and Meta for senior roles. The interviewer wants to see the three-set optimization — not a brute force board scan for conflicts on every placement.',
    alternateApproaches: [
      {
        technique: 'Bitmask for conflict tracking',
        tradeoff: 'Replace three sets with three integers and bitwise operations. Marginal performance gain but impressive to mention as an optimization.',
        complexity: 'O(n!)'
      }
    ]
  },

  'LC_79': {
    leetcode: 79,
    title: 'Word Search',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/word-search/',
    templateRefs: ['P5'],
    tags: ['backtracking', 'grid', 'dfs', 'in-place', 'visited'],
    keyInsight: 'In-place visited marking: set board[r][c] = "#" before recursing, restore board[r][c] = word[index] after. This avoids a separate O(m*n) visited array. The four-directional DFS with immediate return on first match is the key efficiency.',
    shrinkTrigger: 'If index === word.length → return true. If out of bounds or board[r][c] !== word[index] → return false. Mark board[r][c] = "#". Try all 4 directions. Restore board[r][c] = word[index]. Return result.',
    timeComplexity: 'O(m * n * 4^L) where L is word length',
    spaceComplexity: 'O(L) recursion stack',
    gotcha: 'Restore the cell value to word[index] not to some saved original. Since you only enter the cell when board[r][c] === word[index] these are the same value. Writing word[index] makes the intent explicit and avoids confusion during interviews.',
    faangNote: 'One of the most asked medium backtracking problems across all FAANG. The in-place marking trick is expected knowledge at SDE2 level and above.',
    alternateApproaches: [
      {
        technique: 'Separate visited boolean matrix',
        tradeoff: 'Cleaner code but O(m*n) extra space. In-place marking is the preferred approach in interviews.',
        complexity: 'O(m * n * 4^L)'
      }
    ]
  },

  'LC_37': {
    leetcode: 37,
    title: 'Sudoku Solver',
    difficulty: 'Hard',
    status: 'Pending',
    link: 'https://leetcode.com/problems/sudoku-solver/',
    templateRefs: ['P6'],
    tags: ['backtracking', 'constraint-satisfaction', 'board', 'pruning', 'in-place'],
    keyInsight: 'Three constraint sets per digit: rows[r], cols[c], boxes[boxIndex]. Box index formula: Math.floor(r/3)*3 + Math.floor(c/3). Find next empty cell, try digits 1-9, validate all three constraints, place and recurse, undo if recursion returns false.',
    shrinkTrigger: 'Find next empty cell. If none found → return true (solved). Try digits 1-9: if digit valid in row + col + box → place digit, recurse, if recurse returns true → return true, else remove digit. If no digit works → return false (trigger backtrack).',
    timeComplexity: 'O(9^m) where m is number of empty cells',
    spaceComplexity: 'O(m) recursion stack',
    gotcha: 'Box index formula is Math.floor(r/3)*3 + Math.floor(c/3). This maps each cell to one of 9 boxes. Getting this formula wrong means box constraints are never correctly enforced — the board will appear to solve but produce invalid sudoku.',
    faangNote: 'Natural progression after N-Queens. Both are constraint satisfaction problems — N-Queens has simpler constraints, Sudoku has three simultaneous constraints. Mention this relationship to the interviewer.',
    alternateApproaches: [
      {
        technique: 'Constraint propagation before backtracking',
        tradeoff: 'Propagate naked singles and hidden singles before backtracking. Dramatically reduces search space for hard sudoku boards but significantly more complex to implement.',
        complexity: 'O(9^m) worst case but much faster in practice'
      }
    ]
  },

  'LC_797': {
    leetcode: 797,
    title: 'All Paths From Source to Target',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/all-paths-from-source-to-target/',
    templateRefs: ['P5'],
    tags: ['backtracking', 'graph', 'path-enumeration', 'dag'],
    keyInsight: 'DAG path enumeration via backtracking. Push current node to path, recurse all neighbors, pop current node. No visited array needed because the graph is a DAG — no cycles means no infinite loops. Base case: current node === n-1 (target reached).',
    shrinkTrigger: 'If node === n-1 → record path snapshot. Else loop neighbors of node: push neighbor, recurse with neighbor, pop neighbor.',
    timeComplexity: 'O(2^n * n) — at most 2^n paths each of length n',
    spaceComplexity: 'O(n) recursion stack',
    gotcha: 'No visited array is needed here because the input is guaranteed to be a DAG. Adding a visited array is not wrong but signals to the interviewer that you did not notice the DAG property — always state this observation explicitly.',
    faangNote: 'Underrated problem that bridges DFS and backtracking. FAANG interviews increasingly blur this boundary. Solving this cleanly shows you understand backtracking as a general technique beyond just arrays and strings.',
    alternateApproaches: [
      {
        technique: 'BFS with path tracking',
        tradeoff: 'BFS stores entire path per queue entry — O(2^n * n) space vs O(n) for DFS backtracking. DFS is strictly better here.',
        complexity: 'O(2^n * n) time and space'
      }
    ]
  },

  'LC_698': {
    leetcode: 698,
    title: 'Partition to K Equal Sum Subsets',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/partition-to-k-equal-sum-subsets/',
    templateRefs: ['P6'],
    tags: ['backtracking', 'bucket-filling', 'pruning', 'array'],
    keyInsight: 'Bucket-filling backtracking. Create k buckets each targeting sum/k. Try placing each number into each bucket. Prune: skip buckets with the same current sum (identical state — no point trying again). Sort descending first so large numbers fail fast.',
    shrinkTrigger: 'If index === nums.length → check all buckets equal target → return true. Loop k buckets: if buckets[i] + nums[index] <= target → add to bucket, recurse with index+1, remove from bucket. Skip if buckets[i] === buckets[i-1] (duplicate bucket state).',
    timeComplexity: 'O(k^n) worst case — pruning makes it much faster in practice',
    spaceComplexity: 'O(n) recursion stack',
    gotcha: 'This is classic backtracking with pruning, but unlike path-tracking, there is no explicit "undo" of a path array. Instead, you fill and unfill buckets directly. The key difference from path-tracking is that the return-phase does not build up a solution array; it only checks feasibility. Pruning by skipping duplicate bucket states is the entire performance story for this problem.',
    faangNote: 'Strong FAANG-style problem that tests bucket-filling backtracking — a distinct pattern not covered by any other question in this list. Sort descending before backtracking and always mention the duplicate bucket pruning explicitly.',
    alternateApproaches: [
      {
        technique: 'Bitmask DP',
        tradeoff: 'O(2^n * n) time with O(2^n) space. More complex to implement but polynomial in n. Mention as follow-up if interviewer asks about optimization.',
        complexity: 'O(2^n * n) time, O(2^n) space'
      }
    ],
    keyInsight: 'Bucket-filling backtracking. Create k buckets each targeting sum/k. Try placing each number into each bucket. Prune: skip buckets with the same current sum (identical state — no point trying again). Sort descending first so large numbers fail fast.',
    shrinkTrigger: 'If index === nums.length → check all buckets equal target → return true. Loop k buckets: if buckets[i] + nums[index] <= target → add to bucket, recurse with index+1, remove from bucket. Skip if buckets[i] === buckets[i-1] (duplicate bucket state).',
    timeComplexity: 'O(k^n) worst case — pruning makes it much faster in practice',
    spaceComplexity: 'O(n) recursion stack',
    gotcha: 'This is classic backtracking with pruning, but unlike path-tracking, there is no explicit "undo" of a path array. Instead, you fill and unfill buckets directly. The key difference from path-tracking is that the return-phase does not build up a solution array; it only checks feasibility. Pruning by skipping duplicate bucket states is the entire performance story for this problem.',
    faangNote: 'Strong FAANG-style problem that tests bucket-filling backtracking — a distinct pattern not covered by any other question in this list. Sort descending before backtracking and always mention the duplicate bucket pruning explicitly.',
    alternateApproaches: [
      {
        technique: 'Bitmask DP',
        tradeoff: 'O(2^n * n) time with O(2^n) space. More complex to implement but polynomial in n. Mention as follow-up if interviewer asks about optimization.',
        complexity: 'O(2^n * n) time, O(2^n) space'
      }
    ]
  },

  'LC_282': {
    leetcode: 282,
    title: 'Expression Add Operators',
    difficulty: 'Hard',
    status: 'Pending',
    link: 'https://leetcode.com/problems/expression-add-operators/',
    templateRefs: ['P2'],
    tags: ['backtracking', 'expression-building', 'string', 'pruning'],
    keyInsight: 'Build expression by inserting +, -, * between digits. Track three values during backtracking: current accumulated value, previous operand (for multiplication undo), and the expression string. On multiplication: undo previous addition then apply multiplication using the previous operand.',
    shrinkTrigger: 'If index === num.length → if current value === target → record expression. Else loop end from index+1 to num.length: take num[index:end] as current number, try +, -, * operators, recurse with updated value and prev operand.',
    timeComplexity: 'O(4^n * n) — 4 choices per digit position (no op, +, -, *)',
    spaceComplexity: 'O(n)',
    gotcha: 'Multiplication requires undoing the previous operation: newValue = currentValue - prev + prev * currentNum. This is the single hardest insight in the problem. Without tracking prev separately, multiplication cannot be handled correctly.',
    faangNote: 'Hard differentiator question asked at Google and Meta for senior and staff roles. The prev-value trick for multiplication is the key insight interviewers are testing. State it explicitly before coding: "I need to track the previous operand to handle multiplication precedence."',
    alternateApproaches: []
  },

  'LC_491': {
    leetcode: 491,
    title: 'Non-decreasing Subsequences',
    difficulty: 'Medium',
    status: 'Pending',
    link: 'https://leetcode.com/problems/non-decreasing-subsequences/',
    templateRefs: ['P1'],
    tags: ['backtracking', 'subset', 'array', 'hashset-dedup', 'subsequence'],
    keyInsight: 'You cannot sort the input — that would change the original element ordering and produce wrong subsequences. Use a HashSet per recursion level to track which values have already been tried as a branch choice at the current depth. Two separate pruning conditions: (1) skip if nums[i] < last element in current path (violates non-decreasing), (2) skip if nums[i] is already in the level Set (duplicate branch). Both must coexist.',
    shrinkTrigger: 'If current.length >= 2 → record snapshot. const seen = new Set() at the start of each call. Loop from start: if nums[i] < current.at(-1) OR seen.has(nums[i]) → skip. seen.add(nums[i]). Push nums[i], recurse with i+1, pop.',
    timeComplexity: 'O(n * 2^n)',
    spaceComplexity: 'O(n) recursion stack + O(n) per level for the Set',
    gotcha: 'The Set must be declared INSIDE the recursive function — created fresh at each call frame, not outside. A Set declared outside would block valid branches at deeper recursion levels. Each level independently tracks which values it has tried branching on — that is the entire deduplication contract.',
    faangNote: 'Amazon uses this immediately after LC_90 to test whether you understand WHEN sorting is valid for dedup. Reaching for sort+skip here fails the follow-up. The HashSet-per-level pattern reappears in graph enumeration problems — internalizing it here pays dividends across the entire backtracking section.',
    alternateApproaches: []
  },

  'LC_140': {
    leetcode: 140,
    title: 'Word Break II',
    difficulty: 'Hard',
    status: 'Pending',
    link: 'https://leetcode.com/problems/word-break-ii/',
    templateRefs: ['P4'],
    tags: ['backtracking', 'partition', 'string', 'memoization', 'word-break', 'dictionary'],
    keyInsight: 'Partition template with memoization on the start index. At each position, try every word in the dictionary as the next segment. If s.startsWith(word, start), recurse on the remainder (start + word.length). Base case: start === s.length → return [\'\'] (one empty sentence tail). Memoize the RETURN VALUE — an array of valid suffix sentences — not just a boolean.',
    shrinkTrigger: 'Build a Set from wordDict for O(L) lookup. If memo[start] exists → return it. If start === s.length → return [\'\']. result = []. For each word: if s.startsWith(word, start) → for each suffix in recurse(start + word.length): result.push(word + (suffix ? \' \' + suffix : \'\')). memo[start] = result. Return result.',
    timeComplexity: 'O(n^2 * 2^n) worst case — memoization eliminates redundant recomputation of overlapping suffixes',
    spaceComplexity: 'O(2^n * n) — up to 2^n distinct sentences each of length O(n)',
    gotcha: 'Unlike classic backtracking with path push/pop (choose → explore → unchoose), here the solution is built during the return phase by concatenating strings from recursive calls. There is no explicit path array to undo. Memoization stores lists of results, not booleans. This is the key difference from path-tracking backtracking.',
    faangNote: 'Very high frequency at Amazon, Meta, and Google. Interviewers use this to shatter the misconception that memoization only works for count or boolean problems. The correct framing to state before coding: "Overlapping subproblems here produce lists, not scalars — I memoize the list." If you cannot make that observation unprompted, you will not pass SD3 bar.',
    alternateApproaches: [
      {
        technique: 'Build wordSet for O(1) word existence check',
        tradeoff: 'Convert wordDict to a Set before backtracking. Reduces segment validation from O(W) list scan to O(L) hash lookup per candidate. Always do this — there is no downside.',
        complexity: 'Same asymptotic, smaller constant factor per node'
      }
    ]
  },

  'LC_212': {
    leetcode: 212,
    title: 'Word Search II',
    difficulty: 'Hard',
    status: 'Pending',
    link: 'https://leetcode.com/problems/word-search-ii/',
    templateRefs: ['P5'],
    tags: ['backtracking', 'grid', 'dfs', 'trie', 'pruning', 'in-place'],
    keyInsight: 'Build a Trie from the entire word list before starting any DFS. During grid backtracking, traverse the Trie simultaneously — one Trie node per grid cell visited. If the current character has no matching child in the Trie, prune the entire DFS branch immediately. When a Trie node is marked end-of-word, record the word then set node.word = null to prevent duplicate results from alternate paths.',
    shrinkTrigger: 'Build Trie from words. DFS from every cell (r, c) starting at Trie root. At each step: if out of bounds OR board[r][c] === "#" OR no Trie child for board[r][c] → return. Move to Trie child node. If node.word → results.push(node.word), node.word = null. Mark board[r][c] = "#". Recurse all 4 directions. Restore board[r][c].',
    timeComplexity: 'O(m * n * 4^L) where L is max word length — Trie prefix pruning eliminates the vast majority of branches in practice',
    spaceComplexity: 'O(W * L) for the Trie where W is number of words and L is average word length',
    gotcha: 'The node.word = null trick after recording a word is essential. Without it, the same word is added to results multiple times if it can be reached via multiple grid paths. This is cleaner than a separate results Set and eliminates post-processing deduplication entirely.',
    faangNote: 'Google asks this at L5/L6 as the capstone backtracking question. The expected signal before writing a single line: "Running LC_79 for each word individually is O(W * m * n * 4^L) — too slow. I will build a Trie to prune entire DFS branches that cannot match any word prefix." If you cannot derive the Trie optimization unprompted, you are below SD3 bar for Google backtracking rounds.',
    alternateApproaches: [
      {
        technique: 'Trie leaf pruning after word is found',
        tradeoff: 'After completing the DFS, walk back up and prune Trie nodes that have no remaining children (their words are all found). Reduces Trie traversal cost significantly when many words share a common prefix and the grid is large. Mention as a follow-up optimization — do not implement during the initial solution.',
        complexity: 'Same asymptotic, dramatically faster on large dense word lists'
      }
    ],
    templateRefs: ['P5'],
    tags: ['backtracking', 'grid', 'dfs', 'trie', 'pruning', 'in-place'],
    keyInsight: 'Build a Trie from the entire word list before starting any DFS. During grid backtracking, traverse the Trie simultaneously — one Trie node per grid cell visited. If the current character has no matching child in the Trie, prune the entire DFS branch immediately. When a Trie node is marked end-of-word, record the word then set node.word = null to prevent duplicate results from alternate paths.',
    shrinkTrigger: 'Build Trie from words. DFS from every cell (r, c) starting at Trie root. At each step: if out of bounds OR board[r][c] === "#" OR no Trie child for board[r][c] → return. Move to Trie child node. If node.word → results.push(node.word), node.word = null. Mark board[r][c] = "#". Recurse all 4 directions. Restore board[r][c].',
    timeComplexity: 'O(m * n * 4^L) where L is max word length — Trie prefix pruning eliminates the vast majority of branches in practice',
    spaceComplexity: 'O(W * L) for the Trie where W is number of words and L is average word length',
    gotcha: 'The node.word = null trick after recording a word is essential. Without it, the same word is added to results multiple times if it can be reached via multiple grid paths. This is cleaner than a separate results Set and eliminates post-processing deduplication entirely.',
    faangNote: 'Google asks this at L5/L6 as the capstone backtracking question. The expected signal before writing a single line: "Running LC_79 for each word individually is O(W * m * n * 4^L) — too slow. I will build a Trie to prune entire DFS branches that cannot match any word prefix." If you cannot derive the Trie optimization unprompted, you are below SD3 bar for Google backtracking rounds.',
    alternateApproaches: [
      {
        technique: 'Trie leaf pruning after word is found',
        tradeoff: 'After completing the DFS, walk back up and prune Trie nodes that have no remaining children (their words are all found). Reduces Trie traversal cost significantly when many words share a common prefix and the grid is large. Mention as a follow-up optimization — do not implement during the initial solution.',
        complexity: 'Same asymptotic, dramatically faster on large dense word lists'
      }
    ]
  }
        }
    }
  ,
  'dynamic-programming': {
    description: 'Dynamic programming converts exponential recursion to polynomial time by storing and reusing subproblem results. In FAANG interviews, DP appears in three forms: (1) 1D DP on arrays or strings where each state depends on a constant number of prior states, (2) 2D DP on two sequences or a grid where each state depends on a submatrix of prior states, and (3) structured DP on trees, intervals, or bitmasks where the state space requires a domain-specific encoding.',
    goal: 'Cover 95% of FAANG Dynamic Programming questions by mastering 13 patterns and 35 curated problems',
    relatedTopics: ['recursion', 'backtracking', 'binary-search'],

    tagRegistry: [
      'dynamic-programming', 'linear-dp', 'knapsack', '0-1-knapsack', 'unbounded-knapsack',
      'string-dp', 'interval-dp', 'state-machine', 'grid-dp', 'tree-dp',
      'subsequence', 'bitmask-dp', 'pattern-matching', 'greedy', 'memoization',
      'bottom-up', 'space-optimisation', 'array', 'string', 'tree', 'matrix',
      'kadane', 'rolling-array', 'prefix-sum', 'binary-search', 'bit-manipulation',
      'dfs', 'graph', 'recursion', 'counting', 'math', 'combinatorics'
    ],

    techniqueRegistry: [
      'dynamic-programming', 'memoization', 'bottom-up', 'space-optimisation',
      'greedy', 'binary-search', 'dfs', 'prefix-sum', 'bit-manipulation'
    ],

    whenToUse: {
      use: [
        'Problem asks for an OPTIMAL value (max, min, count) over all valid configurations',
        'A brute-force recursion has OVERLAPPING subproblems — the same (i, j, state) is computed multiple times',
        'The answer for a larger input can be expressed entirely in terms of answers for smaller inputs (optimal substructure)',
        'Keywords: "maximum", "minimum", "number of ways", "can you achieve", "longest", "shortest path"'
      ],
      avoid: [
        'The problem asks for ALL solutions (enumerate) — use backtracking instead',
        'No overlapping subproblems exist — pure divide-and-conquer suffices',
        'The greedy choice is provably optimal at every step — DP is unnecessary overhead',
        'Input size is tiny (n ≤ 20) and DP state space would be exponential — bitmask DP or backtracking may be cleaner'
      ]
    },

    interviewTips: [
      'Always define the state before writing code: "dp[i] represents the maximum X considering the first i elements."',
      'Derive the recurrence from the last decision: "At index i, I either include or exclude it — which gives the recurrence."',
      'Identify the base cases explicitly before the loop — wrong base cases silently corrupt every result.',
      'For 2D DP on two strings: process in row-major order; dp[i][j] always depends on dp[i-1][j-1], dp[i-1][j], dp[i][j-1].',
      'Space optimization: if dp[i] only depends on dp[i-1] and dp[i-2], use two rolling variables instead of a full array.',
      'For interval DP: always loop by increasing gap length (len from 2 to n), not by left boundary.',
      'For state machine DP: draw all states and legal transitions as a diagram before coding — the recurrence follows directly.',
      'Memoization (top-down) is easier to derive; bottom-up avoids stack overflow and is slightly faster — know both.'
    ],

    patterns: [
      {
        id: 'P1', name: 'Linear DP',
        recognitionSignals: [
          'Optimal value (max sum, min cost) over a contiguous or non-adjacent subarray',
          'The answer at position i depends only on a constant number of earlier positions',
          'Keywords: "contiguous subarray", "non-adjacent elements", "pick or skip"'
        ],
        questionIds: ['LC_53', 'LC_198', 'LC_213', 'LC_152']
      },
      {
        id: 'P2', name: '0/1 Knapsack',
        recognitionSignals: [
          'Each item (element) is used at most once',
          'A capacity, budget, or target must be exactly met or not exceeded',
          'Keywords: "subset sum", "target sum", "partition equal", "0 or 1 copies of each"'
        ],
        questionIds: ['LC_416', 'LC_494']
      },
      {
        id: 'P3', name: 'Unbounded Knapsack',
        recognitionSignals: [
          'Each item (coin/denomination) can be used an unlimited number of times',
          'A target total must be reached with minimum items, or counted in number of ways',
          'Keywords: "coin change", "denominations", "unlimited uses"'
        ],
        questionIds: ['LC_322', 'LC_518', 'LC_377']
      },
      {
        id: 'P4', name: 'String DP (2D)',
        recognitionSignals: [
          'Problem involves two strings and asks for longest common part, minimum edits, or matching',
          'The answer at (i, j) depends on the relationship between s1[i] and s2[j] AND answers for shorter prefixes',
          'Keywords: "edit distance", "LCS", "longest common", "delete/insert/replace"'
        ],
        questionIds: ['LC_1143', 'LC_72', 'LC_516', 'LC_5', 'LC_115']
      },
      {
        id: 'P5', name: 'String DP (1D)',
        recognitionSignals: [
          'Problem involves decoding, segmenting, or counting ways to interpret a single string',
          'The answer for s[0..i] depends only on the last 1 or 2 characters and earlier dp values',
          'Keywords: "number of ways to decode", "can the string be segmented", "word break"'
        ],
        questionIds: ['LC_91', 'LC_139']
      },
      {
        id: 'P6', name: 'Interval DP',
        recognitionSignals: [
          'The answer for a range [i, j] depends on the answers for sub-ranges',
          'Choosing where to "split last" or "merge last" across a range is the central decision',
          'Keywords: "burst balloons", "matrix chain", "stone merge", "remove boxes"'
        ],
        questionIds: ['LC_312', 'LC_1039', 'LC_1547', 'LC_132']
      },
      {
        id: 'P7', name: 'State Machine DP',
        recognitionSignals: [
          'Problem involves making decisions over time with constraints on consecutive actions',
          'A finite set of "modes" or "states" governs which actions are legal on each step',
          'Keywords: "cooldown", "at most k transactions", "buy and sell", "hold or rest"'
        ],
        questionIds: ['LC_309', 'LC_123', 'LC_714', 'LC_188']
      },
      {
        id: 'P8', name: 'Grid DP',
        recognitionSignals: [
          'Problem is defined on a 2D grid and paths or regions must be counted or evaluated',
          'Movement or expansion is constrained to adjacent cells (up, down, left, right, or diagonal)',
          'Keywords: "unique paths", "minimum path sum", "maximal square", "count paths"'
        ],
        questionIds: ['LC_62', 'LC_63', 'LC_221', 'LC_64', 'LC_741', 'LC_85', 'LC_1289']
      },
      {
        id: 'P9', name: 'Tree DP',
        recognitionSignals: [
          'Problem is defined on a binary tree or general tree',
          'The optimal choice at a node depends on decisions made at its children',
          'Keywords: "house robber on tree", "maximum independent set on tree", "no two adjacent nodes"'
        ],
        questionIds: ['LC_337', 'LC_124']
      },
      {
        id: 'P10', name: 'Subsequence DP',
        recognitionSignals: [
          'Problem asks for the longest subsequence satisfying a monotonic property (increasing, non-decreasing)',
          'Elements can be skipped but their original order must be preserved',
          'Keywords: "longest increasing subsequence", "LIS", "non-decreasing subsequence"'
        ],
        questionIds: ['LC_300', 'LC_354']
      },
      {
        id: 'P11', name: 'Bitmask DP',
        recognitionSignals: [
          'Input size n ≤ 20 (bitmask state space is 2^n)',
          'Subsets of items must be explored and tracked',
          'Keywords: "partition into k groups", "assign to teams", "visit all nodes once"'
        ],
        questionIds: ['LC_698']
      },
      {
        id: 'P12', name: '2D DP (Pattern Matching)',
        recognitionSignals: [
          'Pattern matching with special characters (wildcards, regex-like symbols)',
          'The match status at (i, j) depends on the match status at (i-1, j-1), (i-1, j), or (i, j-1)',
          'Keywords: "wildcard matching", "regular expression matching", "\'?\' matches any single", "\'*\' matches any sequence"'
        ],
        questionIds: ['LC_44', 'LC_10']
      },
      {
        id: 'P13', name: 'DP + Greedy',
        recognitionSignals: [
          'Problem asks for minimum jumps or steps to reach a goal',
          'At each position, you can advance by any amount up to a local value',
          'A greedy "maximum reach" argument eliminates the need for O(n²) DP'
        ],
        questionIds: ['LC_45']
      }
    ],

    questions: {
      'LC_53':  { leetcode: 53,   title: 'Maximum Subarray',                        difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/maximum-subarray/',                        templateRefs: ['P1'],  tags: ['dynamic-programming','linear-dp','kadane','array'], keyInsight: 'Kadane\'s Algorithm: dp[i] = max subarray sum ending at i = Math.max(nums[i], dp[i-1] + nums[i]). Track global max separately. The key insight: if dp[i-1] < 0, starting fresh at nums[i] is always better.', shrinkTrigger: 'dp[i] = Math.max(nums[i], dp[i-1] + nums[i]). Answer = Math.max(...dp).', timeComplexity: 'O(n)', spaceComplexity: 'O(1) with rolling variable', gotcha: 'dp[i] is the max sum ending AT i, not the global max. A separate max variable must track the best dp[i] seen so far. Returning dp[n-1] directly gives wrong answers when the optimal subarray does not end at the last index.', faangNote: 'Table stakes. Every FAANG round may start here. Lead with: "Kadane\'s is O(n) DP — if the running sum goes negative, restart from the current element." Interviewers expect O(1) space.', alternateApproaches: [{ technique: 'divide-and-conquer', tradeoff: 'Split at midpoint, solve each half, combine crossing-sum in O(n). O(n log n) — worse than O(n) Kadane\'s.', complexity: 'O(n log n) time, O(log n) space' }] },

      'LC_198': { leetcode: 198,  title: 'House Robber',                              difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/house-robber/',                              templateRefs: ['P1'],  tags: ['dynamic-programming','linear-dp','array'], keyInsight: 'dp[i] = max money robbing up to house i = Math.max(nums[i] + dp[i-2], dp[i-1]). Either rob house i (add prev2) or skip it (take prev1). Space-optimize to two rolling variables.', shrinkTrigger: 'prev2=0, prev1=0. For each num: curr = Math.max(num + prev2, prev1); prev2=prev1; prev1=curr. Return prev1.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'prev1 represents the best result up to the previous house — it already accounts for skipping that house. You do NOT need a separate "skip" flag; the recurrence handles it. Off-by-one: initialize both prev1 and prev2 to 0 before iterating (not nums[0] and 0).', faangNote: 'The canonical linear DP warmup. State: "At each house I choose between robbing it (nums[i] + best-two-back) or skipping it (best-one-back). Two rolling variables give O(1) space." Sets up House Robber II — expect it as a follow-up immediately.', alternateApproaches: [] },

      'LC_213': { leetcode: 213,  title: 'House Robber II',                          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/house-robber-ii/',                          templateRefs: ['P1'],  tags: ['dynamic-programming','linear-dp','array'], keyInsight: 'The circular constraint: house 0 and house n-1 cannot both be robbed. Run two independent House Robber I passes — once on nums[0..n-2] (exclude last) and once on nums[1..n-1] (exclude first). Return the max of the two results.', shrinkTrigger: 'rob(nums[0..n-2]) and rob(nums[1..n-1]). rob(arr): prev2=0, prev1=arr[0]; for i≥1: curr = max(arr[i]+prev2, prev1); prev2=prev1; prev1=curr. Return prev1.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Do NOT try to handle the circular constraint inline with a single pass — it produces complex conditional logic that is error-prone. Two clean independent passes is the standard solution.', faangNote: 'Follow-up to House Robber I. Interviewers test whether you cleanly reduce the circular constraint to two linear subproblems.', alternateApproaches: [] },

      'LC_152': { leetcode: 152,  title: 'Maximum Product Subarray',                 difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/maximum-product-subarray/',                 templateRefs: ['P1'],  tags: ['dynamic-programming','linear-dp','array'], keyInsight: 'Track both maxSoFar and minSoFar ending at i — a negative × negative flips min to max. At each step: newMax = max(nums[i], curMax*nums[i], curMin*nums[i]); newMin = min(nums[i], curMax*nums[i], curMin*nums[i]). Use the PREVIOUS curMax and curMin to compute both simultaneously.', shrinkTrigger: 'curMax=nums[0], curMin=nums[0], ans=nums[0]. For i=1..n-1: [curMax,curMin]=[Math.max(nums[i],curMax*nums[i],curMin*nums[i]), Math.min(nums[i],curMax*nums[i],curMin*nums[i])]; ans=Math.max(ans,curMax).', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Must update curMax and curMin SIMULTANEOUSLY using the old values. If you overwrite curMax first and then use the new curMax to compute curMin, you get wrong answers. Use destructuring assignment or temp variables to capture both before writing either.', faangNote: 'Universal Kadane follow-up at every FAANG company. State: "Unlike sum, a negative × negative can become the maximum — so I track both max and min product ending at each index and consider all three candidates: nums[i] alone, curMax*nums[i], curMin*nums[i]." Simultaneous-update discipline is what interviewers score.', alternateApproaches: [] },

      'LC_416': { leetcode: 416,  title: 'Partition Equal Subset Sum',               difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/partition-equal-subset-sum/',               templateRefs: ['P2'],  tags: ['dynamic-programming','0-1-knapsack','array'], keyInsight: '0/1 Knapsack boolean variant: can any subset sum to totalSum/2? dp[w] = true if subset summing to w exists. Iterate RIGHT TO LEFT to prevent reuse. Return dp[target].', shrinkTrigger: 'target = sum/2. dp[0]=true, rest false. For each num: for w from target down to num: dp[w] |= dp[w-num].', timeComplexity: 'O(n * sum)', spaceComplexity: 'O(sum)', gotcha: 'If totalSum is odd, return false immediately — no integer target exists. If any element > target, also return false immediately. RIGHT TO LEFT iteration is mandatory to prevent the same element being used twice.', faangNote: 'The canonical 0/1 Knapsack problem at FAANG. Lead with the two early exits (odd sum, element > target) before the DP loop. Interviewers score the direction of iteration explicitly.', alternateApproaches: [] },

      'LC_494': { leetcode: 494,  title: 'Target Sum',                               difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/target-sum/',                               templateRefs: ['P2'],  tags: ['dynamic-programming','0-1-knapsack','counting','array'], keyInsight: 'Algebraic reduction: sum(P) = (totalSum + target) / 2. Count subsets with sum = (totalSum + target) / 2 using 0/1 knapsack counting variant. dp[w] = number of ways to achieve sum w. Iterate RIGHT TO LEFT.', shrinkTrigger: 'target2 = (totalSum + target) / 2. dp[0]=1, rest 0. For each num: for w from target2 down to num: dp[w] += dp[w-num].', timeComplexity: 'O(n * sum)', spaceComplexity: 'O(sum)', gotcha: 'If (totalSum + target) is odd or target > totalSum, return 0 immediately — no valid assignment exists. RIGHT TO LEFT iteration prevents reusing the same element. The recurrence is += (counting), not |= (boolean).', faangNote: 'Tests whether you can derive the algebraic reduction independently. State: "I reduce to counting subsets with sum (total+target)/2 — that is a 0/1 knapsack count problem." Candidates who jump to backtracking miss the O(n*sum) DP solution.', alternateApproaches: [{ technique: 'backtracking', tradeoff: 'DFS with memoization on (index, remaining). O(n * sum) with memo — same asymptotic but larger constant. DP is cleaner.', complexity: 'O(n * sum) time, O(n * sum) space' }] },

      'LC_322': { leetcode: 322,  title: 'Coin Change',                              difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/coin-change/',                              templateRefs: ['P3'],  tags: ['dynamic-programming','unbounded-knapsack','array'], keyInsight: 'Unbounded Knapsack (minimum): dp[w] = fewest coins to make amount w. LEFT TO RIGHT iteration allows reuse. dp[w] = Math.min(dp[w], dp[w - coin] + 1). Return dp[amount] === Infinity ? -1 : dp[amount].', shrinkTrigger: 'dp[0]=0, rest Infinity. For each coin: for w from coin to amount: dp[w] = Math.min(dp[w], dp[w-coin]+1).', timeComplexity: 'O(amount * coins)', spaceComplexity: 'O(amount)', gotcha: 'Initialize with Infinity (or amount+1), not -1. Return -1 only AFTER the loop if dp[amount] is still Infinity. LEFT TO LEFT is correct for unbounded — do not accidentally write right-to-left.', faangNote: 'Most common DP question across all FAANG companies. Master both outer-coins inner-amount and outer-amount inner-coins loop orders and know they produce the same result for this problem.', alternateApproaches: [{ technique: 'BFS', tradeoff: 'BFS on amounts treats each coin as an edge. O(amount * coins) same complexity but O(amount) queue space — DP is cleaner.', complexity: 'O(amount * coins) time, O(amount) space' }] },

      'LC_518': { leetcode: 518,  title: 'Coin Change II',                           difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/coin-change-ii/',                           templateRefs: ['P3'],  tags: ['dynamic-programming','unbounded-knapsack','counting','array'], keyInsight: 'Unbounded Knapsack (counting combinations): dp[w] = number of combinations to make amount w. Outer loop over COINS, inner loop over amounts LEFT TO RIGHT. dp[w] += dp[w - coin]. Return dp[amount].', shrinkTrigger: 'dp[0]=1, rest 0. For each coin: for w from coin to amount: dp[w] += dp[w-coin].', timeComplexity: 'O(amount * coins)', spaceComplexity: 'O(amount)', gotcha: 'Outer-coins, inner-amounts = COMBINATIONS (each coin ordering counted once). Outer-amounts, inner-coins = PERMUTATIONS ([1,2] and [2,1] counted separately). The problem asks for combinations — outer loop MUST be over coins.', faangNote: 'Interviewers probe the combinations vs permutations distinction. State it explicitly before the loop: "Outer loop over coins ensures each denomination is considered in a fixed order — counting combinations, not permutations."', alternateApproaches: [] },

      'LC_377': { leetcode: 377,  title: 'Combination Sum IV',                       difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/combination-sum-iv/',                       templateRefs: ['P3'],  tags: ['dynamic-programming','unbounded-knapsack','counting','array'], keyInsight: 'Unbounded Knapsack — counting PERMUTATIONS. dp[w] = number of ordered sequences that sum to w. Outer loop over AMOUNTS, inner loop over NUMS left to right. dp[w] += dp[w - num]. Opposite loop order to LC_518 which counts combinations.', shrinkTrigger: 'dp[0]=1, rest 0. For w=1..target: for each num: if w>=num: dp[w]+=dp[w-num]. Return dp[target].', timeComplexity: 'O(target * n)', spaceComplexity: 'O(target)', gotcha: 'Outer-amounts, inner-coins = PERMUTATIONS ([1,2] and [2,1] are counted separately). Outer-coins, inner-amounts = COMBINATIONS (LC_518). This is the EXACT FLIP of LC_518. Internalizing this distinction — which loop is outer — is what interviewers test when they pair this with LC_518.', faangNote: 'Always presented as the follow-up to LC_518 at Amazon and Meta. State before coding: "LC_518 asks for combinations — outer loop is coins. This problem asks for ordered sequences (permutations) — outer loop must be amounts so every coin is considered at each capacity step." One sentence, one loop swap, that is the entire interview answer.', alternateApproaches: [{ technique: 'memoized recursion', tradeoff: 'Top-down on remaining target. Same O(target*n) — bottom-up DP avoids stack overhead.', complexity: 'O(target * n) time, O(target) space' }] },

      'LC_1143':{ leetcode: 1143, title: 'Longest Common Subsequence',               difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/longest-common-subsequence/',               templateRefs: ['P4'],  tags: ['dynamic-programming','string-dp','string'], keyInsight: '2D string DP. dp[i][j] = LCS length of text1[0..i-1] and text2[0..j-1]. If text1[i-1] === text2[j-1]: dp[i][j] = dp[i-1][j-1] + 1. Else: dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]).', shrinkTrigger: 'dp[0][j]=dp[i][0]=0. For i=1..m, j=1..n: if match → dp[i][j]=dp[i-1][j-1]+1; else → max(dp[i-1][j], dp[i][j-1]).', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with rolling array', gotcha: 'Use 1-indexed strings (loop from 1 to m/n inclusive). dp[0][*] and dp[*][0] are base cases representing empty prefixes — all zeros. Forgetting to allocate dp as (m+1)×(n+1) causes index out-of-bounds.', faangNote: 'Foundation of all 2D string DP. Interviewers expect O(n) space optimization — use a 1D rolling array where prev holds the old diagonal value.', alternateApproaches: [] },

      'LC_72':  { leetcode: 72,   title: 'Edit Distance',                            difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/edit-distance/',                            templateRefs: ['P4'],  tags: ['dynamic-programming','string-dp','string'], keyInsight: 'dp[i][j] = min operations to convert word1[0..i-1] to word2[0..j-1]. If chars match: dp[i][j] = dp[i-1][j-1]. Else: min(dp[i-1][j-1]+1 replace, dp[i-1][j]+1 delete, dp[i][j-1]+1 insert).', shrinkTrigger: 'dp[0][j]=j, dp[i][0]=i. For i=1..m, j=1..n: if word1[i-1]===word2[j-1] → dp[i][j]=dp[i-1][j-1]; else → min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]) + 1.', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with rolling array', gotcha: 'Base cases: dp[i][0] = i (delete all i chars from word1) and dp[0][j] = j (insert j chars to match word2). These are NOT zeros — forgetting them corrupts every cell in the first row and column.', faangNote: 'Google and Amazon Hard. The three operations map directly to three DP transitions — state this mapping before coding. Interviewers probe the base case initialization explicitly.', alternateApproaches: [] },

      'LC_516': { leetcode: 516,  title: 'Longest Palindromic Subsequence',          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/longest-palindromic-subsequence/',          templateRefs: ['P4'],  tags: ['dynamic-programming','string-dp','string'], keyInsight: 'Interval DP on a single string. dp[i][j] = LPS length in s[i..j]. If s[i]===s[j]: dp[i][j] = dp[i+1][j-1] + 2. Else: dp[i][j] = Math.max(dp[i+1][j], dp[i][j-1]). Fill by increasing gap length.', shrinkTrigger: 'Base: dp[i][i]=1. Fill by gap len=2..n: for i=0..n-gap-1, j=i+gap: if match → dp[i][j]=dp[i+1][j-1]+2; else → max(dp[i+1][j], dp[i][j-1]).', timeComplexity: 'O(n²)', spaceComplexity: 'O(n²); O(n) with rolling array', gotcha: 'Fill by GAP LENGTH not by row. Filling row by row leaves dp[i+1][j-1] uncomputed when you need it. Alternatively: run LCS(s, reverse(s)) — the LPS length equals the LCS of s and its reverse.', faangNote: 'Alternatively solvable as LCS(s, reverse(s)) — state this connection. Interval DP fill order (by gap) is the key technical point interviewers probe.', alternateApproaches: [{ technique: 'LCS on s and reverse(s)', tradeoff: 'Same O(n²) time. LCS is arguably cleaner to implement — avoids the interval DP fill-order subtlety.', complexity: 'O(n²) time, O(n) space' }] },

      'LC_5':   { leetcode: 5,    title: 'Longest Palindromic Substring',            difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/longest-palindromic-substring/',            templateRefs: ['P4'],  tags: ['dynamic-programming','string-dp','string','expand-around-center'], keyInsight: 'Expand-around-center (preferred): for each of the 2n-1 centers (n single-char, n-1 two-char), expand outward while s[l]===s[r]. Track the longest window found. O(n²) time, O(1) space. Alternatively: 2D DP where dp[i][j] = is s[i..j] a palindrome, fill diagonally.', shrinkTrigger: 'ans="". For c=0..2n-2: l=c>>1; r=(c+1)>>1; while l>=0&&r<n&&s[l]===s[r]: l--; r++; if r-l-1>ans.length: ans=s.slice(l+1,r).', timeComplexity: 'O(n²)', spaceComplexity: 'O(1) for expand-around-center; O(n²) for 2D DP', gotcha: 'Two types of centers: odd-length palindromes (single character center) and even-length palindromes (two adjacent identical characters). Missing even-length centers produces wrong answers for inputs like "abba" or "cbbd". The 2n-1 center encoding handles both: center c gives l=c>>1, r=(c+1)>>1.', faangNote: 'Amazon and Meta screener — top-5 frequency across all FAANG DP problems. Always lead with expand-around-center (O(n²) time, O(1) space) over 2D DP — cleaner and space-optimal. If pressed on follow-up, mention Manacher\'s algorithm achieves O(n) by reusing palindrome symmetry.', alternateApproaches: [{ technique: 'Manacher\'s Algorithm', tradeoff: 'O(n) time, O(n) space. Rarely asked to code fully — but naming it and explaining the symmetry reuse is a strong SDE3 signal.', complexity: 'O(n) time, O(n) space' }] },

      'LC_115': { leetcode: 115,  title: 'Distinct Subsequences',                    difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/distinct-subsequences/',                    templateRefs: ['P4'],  tags: ['dynamic-programming','string-dp','string','counting'], keyInsight: '2D string DP — counting variant. dp[i][j] = number of distinct subsequences of s[0..i-1] that equal t[0..j-1]. If s[i-1]===t[j-1]: dp[i][j] = dp[i-1][j-1] + dp[i-1][j] (use this char OR skip it). Else: dp[i][j] = dp[i-1][j] (must skip s[i-1]).', shrinkTrigger: 'dp[i][0]=1 for all i (empty t matched by any prefix of s). dp[0][j]=0 for j>0. For i=1..m, j=1..n: if s[i-1]===t[j-1] → dp[i][j]=dp[i-1][j-1]+dp[i-1][j]; else → dp[i][j]=dp[i-1][j].', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with rolling array', gotcha: 'When characters match there are TWO choices — use s[i-1] (diagonal dp[i-1][j-1]) OR skip s[i-1] (dp[i-1][j]). Both are valid and must be ADDED together. The skip-case dp[i-1][j] applies regardless of whether characters match or not. Base case: dp[i][0]=1 because the empty string is always a subsequence of any string.', faangNote: 'Google and Meta Hard — completes the four-quadrant of 2D string DP: LCS (longest), Edit Distance (min ops), LPS (palindrome), and Distinct Subsequences (count). State: "When characters match I have two independent choices — use it or skip it — and I ADD both contributions. When they differ I can only skip." The ADD-on-match recurrence is the single differentiator from LCS.', alternateApproaches: [{ technique: 'memoized recursion', tradeoff: 'Top-down on (i, j) with memo. Same O(m*n) complexity — bottom-up avoids stack overhead and is cleaner.', complexity: 'O(m*n) time, O(m*n) space' }] },

      'LC_91':  { leetcode: 91,   title: 'Decode Ways',                              difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/decode-ways/',                              templateRefs: ['P5'],  tags: ['dynamic-programming','linear-dp','string','counting'], keyInsight: 'dp[i] = number of ways to decode s[0..i-1]. dp[i] += dp[i-1] if s[i-1] is a valid one-digit decode (\'1\'–\'9\'). dp[i] += dp[i-2] if s[i-2..i-1] is a valid two-digit decode (\'10\'–\'26\').', shrinkTrigger: 'dp[0]=1, dp[1]=(s[0]!==\'0\'?1:0). For i=2..n: oneDigit=parseInt(s[i-1]); twoDigit=parseInt(s.slice(i-2,i)); if 1<=oneDigit<=9: dp[i]+=dp[i-1]; if 10<=twoDigit<=26: dp[i]+=dp[i-2].', timeComplexity: 'O(n)', spaceComplexity: 'O(n); O(1) with rolling variables', gotcha: '"0" alone is not a valid encoding. "30", "40", etc. are also invalid two-digit encodings. Only "10"–"26" are valid two-digit decodings. Validate BOTH one-digit and two-digit conditions separately — do not rely on a single range check.', faangNote: 'Amazon and Meta screener favourite. Structurally identical to Fibonacci with validity gates. State: "This is Fibonacci DP — dp[i] = dp[i-1] + dp[i-2] with each addend gated by a validity check."', alternateApproaches: [] },

      'LC_139': { leetcode: 139,  title: 'Word Break',                               difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/word-break/',                               templateRefs: ['P5'],  tags: ['dynamic-programming','linear-dp','string'], keyInsight: 'dp[i] = true if s[0..i-1] can be segmented using wordDict. For each i, try all split points j < i: if dp[j] && wordSet.has(s.slice(j, i)) → dp[i] = true.', shrinkTrigger: 'wordSet = new Set(wordDict). dp[0]=true, rest false. For i=1..n: for j=0..i-1: if dp[j] && wordSet.has(s.slice(j,i)): dp[i]=true; break.', timeComplexity: 'O(n² * L) where L = max word length', spaceComplexity: 'O(n + W * L) for dp and Set', gotcha: 'Use a Set for O(1) word lookup — not an array scan which is O(W) per check. The break after finding a valid split is an optimization, not correctness-critical. Outer loop is over end index i, inner loop is over split point j.', faangNote: 'Google and Meta classic. Connect to unbounded knapsack: "words are items, string positions are capacities, dp[i] means capacity i can be filled." Candidates who use backtracking without memoization fail on long inputs.', alternateApproaches: [{ technique: 'memoized backtracking', tradeoff: 'Top-down recursion with memo on start index. Same O(n²*L) complexity but recursive — bottom-up DP is cleaner.', complexity: 'O(n² * L) time, O(n) space' }] },

      'LC_312': { leetcode: 312,  title: 'Burst Balloons',                           difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/burst-balloons/',                           templateRefs: ['P6'],  tags: ['dynamic-programming','interval-dp','array'], keyInsight: 'Think LAST BURST: dp[i][j] = max coins from bursting all balloons between i and j (exclusive, padded sentinels). For each k in (i,j): dp[i][j] = max(dp[i][k] + dp[k][j] + nums[i]*nums[k]*nums[j]). Pad nums with 1 at both ends.', shrinkTrigger: 'nums = [1, ...nums, 1]. dp is (n+2)×(n+2) zeroed. For len=2..n+1: for i=0..n+1-len: j=i+len: for k=i+1..j-1: dp[i][j]=max(dp[i][j], dp[i][k]+dp[k][j]+nums[i]*nums[k]*nums[j]).', timeComplexity: 'O(n³)', spaceComplexity: 'O(n²)', gotcha: 'dp[i][j] covers the OPEN interval (i, j) — balloons at i and j are boundaries that are NOT burst in this subproblem. The "last burst" framing ensures that when k is burst last, nums[i] and nums[j] are guaranteed to still exist.', faangNote: 'Google Hard. The "last burst" reframe is the only insight — state it before any code. "I think about which balloon is burst LAST in a range, not first. This freezes the boundaries and gives a clean O(n³) recurrence."', alternateApproaches: [] },

      'LC_1039':{ leetcode: 1039, title: 'Minimum Score Triangulation of Polygon', difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/minimum-score-triangulation-of-polygon/', templateRefs: ['P6'],  tags: ['dynamic-programming','interval-dp','array'], keyInsight: 'This IS Matrix Chain Multiplication. dp[i][j] = min score to triangulate using only vertices i..j. For each apex k in (i+1..j-1): dp[i][j] = min(dp[i][j], dp[i][k] + dp[k][j] + values[i]*values[k]*values[j]). Base: dp[i][i+1] = 0 (adjacent vertices, no triangle). Loop by increasing gap length starting at len=2.', shrinkTrigger: 'n=values.length. dp=n×n zeros. For len=2..n-1: for i=0..n-1-len: j=i+len: dp[i][j]=Infinity: for k=i+1..j-1: dp[i][j]=Math.min(dp[i][j], dp[i][k]+dp[k][j]+values[i]*values[k]*values[j]). Return dp[0][n-1].', timeComplexity: 'O(n³)', spaceComplexity: 'O(n²)', gotcha: 'Initialize dp[i][j] to Infinity before the inner k-loop — not 0. Gap starts at len=2 (three vertices form the first triangle). The circular polygon structure is handled implicitly: fixing edge (0, n-1) as the outer boundary ensures every triangulation touches both endpoints; no need to handle circularity explicitly.', faangNote: 'The purest MCM template on LeetCode. When you see "minimum cost to split a range where cost involves both endpoints AND the split point", you are looking at MCM. Say: "This reduces to Matrix Chain Multiplication — I try every vertex k as the apex of the triangle containing the fixed outer edge (i, j)." A strong signal at Google and Meta.', alternateApproaches: [] },

      'LC_1547':{ leetcode: 1547, title: 'Minimum Cost to Cut a Stick',              difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/minimum-cost-to-cut-a-stick/',              templateRefs: ['P6'],  tags: ['dynamic-programming','interval-dp','array'], keyInsight: 'Sort cuts, add 0 and n as sentinels. dp[i][j] = min cost to make ALL cuts strictly between cuts[i] and cuts[j]. For each intermediate cut k in (i,j): dp[i][j] = min(dp[i][j], dp[i][k] + dp[k][j] + cuts[j] - cuts[i]). The cost per sub-problem is always the current segment length — independent of where inside k falls.', shrinkTrigger: 'cuts=[0,...cuts,n].sort((a,b)=>a-b). m=cuts.length. dp=m×m zeros. For len=2..m-1: for i=0..m-1-len: j=i+len: dp[i][j]=Infinity: for k=i+1..j-1: dp[i][j]=Math.min(dp[i][j], dp[i][k]+dp[k][j]+cuts[j]-cuts[i]). Return dp[0][m-1].', timeComplexity: 'O(m³) where m = cuts.length + 2', spaceComplexity: 'O(m²)', gotcha: 'Sorting cuts is MANDATORY — interval DP requires dp[i][k] and dp[k][j] to represent disjoint contiguous sub-segments. Without sorting, k does not split [i,j] into valid sub-intervals. Adding 0 and n as sentinels eliminates all boundary checks: cost formula cuts[j]-cuts[i] always equals the current segment length.', faangNote: 'MCM variant where cost is segment length, not a product. Say: "This is Interval DP — the key insight is the sub-problem cost is always cuts[j]-cuts[i] regardless of where inside I cut. I sort first to make the interval structure valid, then apply the MCM recurrence." Seen in Google and Meta Hard rounds.', alternateApproaches: [] },

      'LC_309': { leetcode: 309,  title: 'Best Time to Buy and Sell Stock with Cooldown', difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/', templateRefs: ['P7'],  tags: ['dynamic-programming','state-machine','array'], keyInsight: 'Three states: HELD (holding stock), SOLD (just sold today), REST (cooldown or never bought). Transitions: HELD → HELD (hold) or SOLD (sell); REST → HELD (buy) or REST (rest); SOLD → REST only (forced cooldown). Space-optimize to O(1) with three variables.', shrinkTrigger: 'held=-Infinity, sold=0, rest=0. For each price: newHeld=max(held, rest-price); newSold=held+price; newRest=max(rest,sold); held=newHeld; sold=newSold; rest=newRest. Return max(sold, rest).', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'SOLD and REST must be distinct states. Merging them into one "not holding" state misses the cooldown constraint — you can buy on the day after REST but not after SOLD. Draw the transition diagram before coding.', faangNote: 'The state machine diagram is the answer. Say: "I draw three states — HELD, SOLD, REST — and derive the recurrence from the legal transitions. The code follows directly from the diagram."', alternateApproaches: [] },

      'LC_123': { leetcode: 123,  title: 'Best Time to Buy and Sell Stock III',      difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iii/',      templateRefs: ['P7'],  tags: ['dynamic-programming','state-machine','array'], keyInsight: 'Four states: hold1 (holding 1st stock), sold1 (completed 1st sale), hold2 (holding 2nd stock), sold2 (completed 2nd sale). sold2 is the answer. Update in REVERSE order to avoid using today\'s price twice.', shrinkTrigger: 'hold1=-Infinity, sold1=0, hold2=-Infinity, sold2=0. For each price: sold2=max(sold2,hold2+price); hold2=max(hold2,sold1-price); sold1=max(sold1,hold1+price); hold1=max(hold1,-price). Return sold2.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Update in reverse order (sold2 first, hold1 last). Updating hold1 first would use today\'s price twice — allowing a buy and immediate sell on the same day. The reverse update order prevents this.', faangNote: 'The reverse update order is the critical interview point. Explain: "Updating from sold2 down to hold1 uses yesterday\'s values throughout one day\'s update — no double-dipping on a single day\'s price."', alternateApproaches: [] },

      'LC_714': { leetcode: 714,  title: 'Best Time to Buy and Sell Stock with Transaction Fee', difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-transaction-fee/', templateRefs: ['P7'],  tags: ['dynamic-programming','state-machine','array'], keyInsight: 'Two-state machine: CASH (not holding) and HELD (holding stock). Transitions: CASH → HELD (buy: cash - price); HELD → CASH (sell: held + price - fee). Unlimited transactions, one fee per complete transaction. Space-optimize to two variables.', shrinkTrigger: 'cash=0, held=-Infinity. For each price: newCash=Math.max(cash, held+price-fee); newHeld=Math.max(held, cash-price); cash=newCash; held=newHeld. Return cash.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Apply the fee on the SELL side (held+price-fee), not the buy side — both are mathematically equivalent but sell-side is more natural and avoids confusion with negative held initialization. Update cash and held SIMULTANEOUSLY using the old values to prevent using today\'s price twice in one transition.', faangNote: 'Most frequently asked stock DP medium at Amazon and Google after LC_122 (unlimited no-fee). State: "Two states — CASH and HELD. At each price I ask: should I buy, sell, or hold? The fee is subtracted at the point of sale. Space: two variables." The simultaneous-update discipline (same as LC_123) is what separates SDE2 from SDE3 answers.', alternateApproaches: [{ technique: 'greedy', tradeoff: 'Accumulate price[i]-price[i-1] whenever positive, then subtract fee each time accumulated profit would cover it. O(n) but harder to reason about correctly — DP is clearer.', complexity: 'O(n) time, O(1) space' }] },

      'LC_62':  { leetcode: 62,   title: 'Unique Paths',                              difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/unique-paths/',                              templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','math','combinatorics'], keyInsight: 'dp[r][c] = number of paths from (0,0) to (r,c) moving only right or down. dp[r][c] = dp[r-1][c] + dp[r][c-1]. First row and column are all 1s (only one way to reach any edge cell). Alternatively: every path uses exactly (m-1) down-moves and (n-1) right-moves, so the answer is C(m+n-2, n-1) — pure combinatorics.', shrinkTrigger: 'dp[0][c]=1 for all c; dp[r][0]=1 for all r. For r=1..m-1, c=1..n-1: dp[r][c]=dp[r-1][c]+dp[r][c-1]. Return dp[m-1][n-1]. Or: C(m+n-2, n-1).', timeComplexity: 'O(m * n) for DP; O(min(m,n)) for combinatorics', spaceComplexity: 'O(n) with 1D rolling array; O(1) for combinatorics', gotcha: 'The combinatorics answer C(m+n-2, n-1): total moves = m+n-2, choose n-1 of them to be right-moves. Compute iteratively to avoid overflow: result=1; for i=0..n-2: result=result*(m+n-2-i)/(i+1). Integer division must be deferred — compute as floating point and round, or verify divisibility at each step.', faangNote: 'The #1 most-asked Grid DP question across all FAANG companies. Every interview loop that touches DP includes this. Deliver O(n) space DP first, then immediately offer C(m+n-2, n-1) as the follow-up — transitioning from DP to combinatorics in one sentence is the SDE2→SDE3 signal Meta and Google specifically test for.', alternateApproaches: [{ technique: 'combinatorics', tradeoff: 'C(m+n-2, n-1) computed in O(min(m,n)) time, O(1) space. Always offer this after the DP solution.', complexity: 'O(min(m,n)) time, O(1) space' }] },

      'LC_63':  { leetcode: 63,   title: 'Unique Paths II',                          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/unique-paths-ii/',                          templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','matrix'], keyInsight: 'dp[r][c] = number of distinct paths from (0,0) to (r,c) avoiding obstacles. dp[r][c] = 0 if obstacle. Else dp[r][c] = dp[r-1][c] + dp[r][c-1]. Initialize first row and column carefully — an obstacle blocks all cells after it in that row/column.', shrinkTrigger: 'dp[0][0] = obstacleGrid[0][0] === 1 ? 0 : 1. First row: dp[0][c] = obstacleGrid[0][c]===1 ? 0 : dp[0][c-1]. First col: similar. Inner: if obstacle → 0; else → dp[r-1][c] + dp[r][c-1].', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with 1D rolling array', gotcha: 'When initializing the first row, STOP after an obstacle — all cells to its right must be 0. Writing dp[0][c] = obstacleGrid[0][c] ? 0 : 1 ignores the blocking effect of a left-side obstacle.', faangNote: null, alternateApproaches: [] },

      'LC_221': { leetcode: 221,  title: 'Maximal Square',                           difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/maximal-square/',                           templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','matrix'], keyInsight: 'dp[r][c] = side length of the largest all-1s square with bottom-right corner at (r,c). If matrix[r][c] = \'1\': dp[r][c] = Math.min(dp[r-1][c], dp[r][c-1], dp[r-1][c-1]) + 1. Track maxSide. Return maxSide².', shrinkTrigger: 'dp[r][c] = matrix[r][c]===\'1\' ? Math.min(dp[r-1][c], dp[r][c-1], dp[r-1][c-1]) + 1 : 0. Answer = Math.max over all dp[r][c], squared.', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with 1D rolling array', gotcha: 'Return maxSide² (area), not maxSide (side length). The problem asks for AREA. The min-of-three recurrence is non-intuitive — the bottleneck is the smallest neighboring square: if any one is smaller, the current square cannot extend past it.', faangNote: 'Amazon and Meta favourite. Explain the min(top, left, diagonal) recurrence with the "bottleneck corner" proof: the current square can only be as large as the smallest of its three neighboring squares allows.', alternateApproaches: [] },

      'LC_64':  { leetcode: 64,   title: 'Minimum Path Sum',                          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/minimum-path-sum/',                          templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','matrix'], keyInsight: 'dp[r][c] = minimum cost path from (0,0) to (r,c) moving only right or down. dp[r][c] = grid[r][c] + Math.min(dp[r-1][c], dp[r][c-1]). Base: first row and first column are prefix sums (only one direction to travel). No obstacles — every cell is reachable.', shrinkTrigger: 'dp[0][0]=grid[0][0]. First row: dp[0][c]=dp[0][c-1]+grid[0][c]. First col: dp[r][0]=dp[r-1][0]+grid[r][0]. Inner: dp[r][c]=grid[r][c]+Math.min(dp[r-1][c], dp[r][c-1]).', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with 1D rolling array', gotcha: 'First row is a prefix sum (you can only go right) and first column is a prefix sum (you can only go down) — they are NOT all initialized to the same value. Initializing dp[0][c]=grid[0][c] for all c ignores the accumulated cost from cells to the left.', faangNote: 'Amazon and Google warm-up — always paired with Unique Paths. State: "Unique Paths counted routes; this problem accumulates cost on the same grid. The recurrence flips from addition of two predecessors to minimum of two predecessors plus current cell cost." O(n) space with a 1D array is the expected follow-up optimization.', alternateApproaches: [{ technique: 'in-place modification', tradeoff: 'Modify grid directly — O(1) extra space but mutates input, which is usually undesirable. Use 1D rolling array instead.', complexity: 'O(m * n) time, O(1) extra space' }] },

      'LC_337': { leetcode: 337,  title: 'House Robber III',                         difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/house-robber-iii/',                         templateRefs: ['P9'],  tags: ['dynamic-programming','tree-dp','dfs','tree'], keyInsight: 'Post-order DFS returning [robThis, skipThis] per node. robThis = node.val + left.skipThis + right.skipThis. skipThis = max(left) + max(right). Each child\'s contribution is independent. Answer = max of root\'s pair.', shrinkTrigger: 'function dfs(node): if !node → [0,0]. [lr, ls] = dfs(left); [rr, rs] = dfs(right). robThis = node.val + ls + rs; skipThis = max(lr,ls) + max(rr,rs). Return [robThis, skipThis].', timeComplexity: 'O(n)', spaceComplexity: 'O(h) call stack where h = tree height', gotcha: 'skipThis = max(left) + max(right) — NOT left.skipThis + right.skipThis. When you skip a parent, each child can independently be robbed or skipped — take the max for each child separately.', faangNote: 'Tests whether you can extend the linear House Robber recurrence to tree topology. The post-order pair return is the key pattern — reusable across all tree DP problems.', alternateApproaches: [{ technique: 'memoization on node reference', tradeoff: 'Cache results by node in a Map. Same O(n) time but adds O(n) space overhead for the map — not needed since post-order DFS visits each node exactly once.', complexity: 'O(n) time, O(n) space' }] },

      'LC_124': { leetcode: 124,  title: 'Binary Tree Maximum Path Sum',              difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/',              templateRefs: ['P9'],  tags: ['dynamic-programming','tree-dp','dfs','tree'], keyInsight: 'Post-order DFS. Each call returns the max GAIN through ONE arm (left or right) that the parent can extend. Locally at each node, the best FULL PATH through it = node.val + max(0, leftGain) + max(0, rightGain). Update a global max with this full path but return only the single-arm gain to the parent.', shrinkTrigger: 'let ans = -Infinity. function dfs(node): if !node → 0. L=Math.max(0,dfs(left)); R=Math.max(0,dfs(right)); ans=Math.max(ans, node.val+L+R); return node.val+Math.max(L,R). dfs(root); return ans.', timeComplexity: 'O(n)', spaceComplexity: 'O(h) call stack', gotcha: 'The key split: what you RETURN to the parent (single arm: node.val + max(L,R)) vs what you RECORD globally (full path: node.val + L + R). Returning the full path breaks the tree structure — a parent cannot extend a path that already branches left and right below it. Clamp negative gains to 0: if a subtree has a negative max gain, it is always better to not extend through it.', faangNote: 'Top-3 most asked tree Hard at Google, Meta, and Amazon. The single differentiator: stating "I return the single-arm gain to the parent, but I record the full path (both arms) as a candidate for the global answer" BEFORE writing any code. This distinction is the SDE3 signal — most SDE2 candidates conflate return value and global update until the interviewer corrects them.', alternateApproaches: [] },

      'LC_300': { leetcode: 300,  title: 'Longest Increasing Subsequence',           difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/longest-increasing-subsequence/',           templateRefs: ['P10'], tags: ['dynamic-programming','subsequence','binary-search','array'], keyInsight: 'O(n²) DP: dp[i] = LIS length ending at i = 1 + max(dp[j] for j<i where nums[j]<nums[i]). O(n log n): maintain a sorted "tails" array; use binary search to find the replacement position for each element.', shrinkTrigger: 'O(n log n): tails=[]. For each num: pos = lowerBound(tails, num); if pos===tails.length → tails.push(num); else → tails[pos]=num. Return tails.length.', timeComplexity: 'O(n log n) with binary search', spaceComplexity: 'O(n)', gotcha: 'The tails array does NOT store the actual LIS — it is a running monotone structure for length computation only. To reconstruct the actual LIS, you need parent pointers on the dp array — not on tails.', faangNote: 'Lead with O(n²) DP for clarity, then offer O(n log n) patience sorting as an optimization. Stating "tails[i] is the smallest tail element of all LIS of length i+1" is the key invariant interviewers want to hear.', alternateApproaches: [{ technique: 'O(n²) DP', tradeoff: 'Simpler to implement and explain. Acceptable for n ≤ 2500. O(n log n) binary search variant preferred for larger inputs.', complexity: 'O(n²) time, O(n) space' }] },

      'LC_354': { leetcode: 354,  title: 'Russian Doll Envelopes',                   difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/russian-doll-envelopes/',                   templateRefs: ['P10'], tags: ['dynamic-programming','subsequence','binary-search','array'], keyInsight: 'Disguised LIS. Sort by width ascending, then by height DESCENDING for equal widths. Run O(n log n) LIS on heights only. The descending-height sort for equal widths prevents selecting two envelopes with the same width — no two heights from the same width group can form an increasing subsequence.', shrinkTrigger: 'envelopes.sort((a,b)=>a[0]!==b[0]?a[0]-b[0]:b[1]-a[1]). heights=envelopes.map(e=>e[1]). Return LIS(heights) using patience sorting (binary search on tails array).', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'The descending sort on height for equal widths is the ONLY non-obvious step — without it, two envelopes with width=3, heights=[2,5] would both be selected (heights 2 < 5 is increasing), violating the strict width constraint. Descending height ensures at most one envelope per width group can enter the LIS.', faangNote: 'Google Hard — the canonical LIS-in-disguise problem. The interview moment: when you say "I sort by width ascending and height descending for ties, then run O(n log n) LIS on heights," the interviewer knows you have internalized the pattern-recognition layer of DP. Candidates who go straight to O(n²) DP without the sort trick get partial credit at best.', alternateApproaches: [{ technique: 'O(n²) DP', tradeoff: 'dp[i] = LIS length ending at envelope i, checking all j < i. O(n²) time — TLEs for large inputs. Sorting trick + patience sorting is required for full credit.', complexity: 'O(n²) time, O(n) space' }] },

      'LC_698': { leetcode: 698,  title: 'Partition to K Equal Sum Subsets',         difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/partition-to-k-equal-sum-subsets/',         templateRefs: ['P11'], tags: ['dynamic-programming','bitmask-dp','bit-manipulation','array'], keyInsight: 'Bitmask DP: dp[mask] = current sum of the in-progress bucket when bits in mask are already placed. For each mask, find the next unset bit i and try adding nums[i]. When current bucket sum reaches target, reset to 0 for the next bucket.', shrinkTrigger: 'target=sum/k. dp[0]=0, rest -1. For each mask: if dp[mask]<0 → skip. For each unset bit i: nextMask = mask|(1<<i); nextSum = (dp[mask]+nums[i])%target; dp[nextMask] = nextSum. Return dp[(1<<n)-1] >= 0.', timeComplexity: 'O(2^n * n)', spaceComplexity: 'O(2^n)', gotcha: 'dp[mask] stores (current_bucket_sum % target) — NOT the total sum. The modulo automatically resets the bucket counter when it fills to target. If dp[(1<<n)-1] is non-negative (reached), all k buckets were filled exactly.', faangNote: 'The bitmask DP approach is the O(2^n * n) upgrade over O(k^n) pure backtracking. State: "n ≤ 16 here, so 2^n = 65536 states — bitmask DP is feasible. Pure backtracking is O(k^n) which is too slow without heavy pruning."', alternateApproaches: [{ technique: 'backtracking with pruning', tradeoff: 'O(k^n) worst case but heavy pruning (sort descending, skip duplicate bucket sums) makes it fast in practice. Simpler to implement. See backtracking module for full treatment.', complexity: 'O(k^n) worst case, fast in practice' }] },

      'LC_44':  { leetcode: 44,   title: 'Wildcard Matching',                        difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/wildcard-matching/',                        templateRefs: ['P12'], tags: ['dynamic-programming','string-dp','pattern-matching','string'], keyInsight: 'dp[i][j] = does pattern[0..i-1] match s[0..j-1]? If pattern[i-1] is \'?\' or chars match: dp[i][j] = dp[i-1][j-1]. If pattern[i-1] is \'*\': dp[i][j] = dp[i-1][j] (star=empty) || dp[i][j-1] (star extends).', shrinkTrigger: 'dp[0][0]=true. dp[i][0]=true if pattern[0..i-1] all stars. For i=1..m, j=1..n: if p[i-1]===\'?\' or match → dp[i][j]=dp[i-1][j-1]; if p[i-1]===\'*\' → dp[i][j]=dp[i-1][j]||dp[i][j-1].', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with rolling array', gotcha: 'Do NOT conflate LC_44 with LC_10 (Regex Matching). In LC_44, \'*\' matches any sequence standalone. In LC_10, \'*\' means zero-or-more of the preceding character. The star transitions are fundamentally different.', faangNote: 'Google and Amazon Hard. The two star transitions (match-zero = up, match-one-more = left) must be stated before coding. Interviewers probe the base case dp[i][0] for all-star patterns.', alternateApproaches: [{ technique: 'greedy two-pointer', tradeoff: 'O(m*n) worst case for adversarial inputs. DP is strictly cleaner and always O(m*n).', complexity: 'O(m * n) time, O(1) space' }] },

      'LC_10':  { leetcode: 10,   title: 'Regular Expression Matching',               difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/regular-expression-matching/',               templateRefs: ['P12'], tags: ['dynamic-programming','string-dp','pattern-matching','string'], keyInsight: 'dp[i][j] = does p[0..i-1] match s[0..j-1]? Three cases: (1) p[i-1] is literal or \'.\': dp[i][j] = dp[i-1][j-1] && (p[i-1]===\'.\'||p[i-1]===s[j-1]). (2) p[i-1] is \'*\': dp[i][j] = dp[i-2][j] (zero occurrences of p[i-2]) || (dp[i][j-1] && (p[i-2]===\'.\'||p[i-2]===s[j-1])) (one more occurrence).', shrinkTrigger: 'dp[0][0]=true. dp[i][0]=p[i-1]===\'*\'&&dp[i-2][0]. For i=1..m, j=1..n: if p[i-1]!==\'*\': dp[i][j]=dp[i-1][j-1]&&(p[i-1]===\'.\'||p[i-1]===s[j-1]); else: dp[i][j]=dp[i-2][j]||(dp[i][j-1]&&(p[i-2]===\'.\'||p[i-2]===s[j-1])).', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n); O(n) with rolling array', gotcha: 'The \'*\' in LC_10 always refers to the preceding element p[i-2] — you need to look two pattern positions back. The zero-occurrences case is dp[i-2][j] (skip BOTH the \'*\' AND the character before it). Do NOT conflate with LC_44 where \'*\' is a standalone wildcard requiring only dp[i-1][j].', faangNote: "Google's preferred Hard DP in onsite rounds — asked more than LC_44 at Google. State before coding: 'When pattern[i-1] is \"*\", there are two cases: zero occurrences (skip X* entirely: dp[i-2][j]) or one more occurrence (match one char and keep * active: dp[i][j-1] with char check). The recurrence follows directly.' This verbal decomposition is the SDE3 signal.", alternateApproaches: [{ technique: 'memoized recursion', tradeoff: 'Top-down with memo on (i, j). Same O(m*n) complexity — bottom-up DP avoids stack overhead and is preferred.', complexity: 'O(m*n) time, O(m*n) space' }] },

      'LC_45':  { leetcode: 45,   title: 'Jump Game II',                             difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/jump-game-ii/',                             templateRefs: ['P13'], tags: ['dynamic-programming','greedy','array'], keyInsight: 'Greedy BFS: scan left to right. Track farthest reachable index and the end of the current jump level. When i reaches currentEnd, increment jumps and set currentEnd = farthest. O(n) time, O(1) space.', shrinkTrigger: 'jumps=0, currentEnd=0, farthest=0. For i=0..n-2: farthest=max(farthest, i+nums[i]); if i===currentEnd: jumps++; currentEnd=farthest. Return jumps.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Loop only to n-2 (not n-1) — incrementing jumps when i reaches the last index overcounts. The last index is the destination, not a jumping-off point.', faangNote: 'Lead with: "This is greedy BFS — I treat all positions reachable in exactly k jumps as one level. I scan each level once and advance to the next when I exhaust the current level." The O(n²) DP solution exists but is unnecessary.', alternateApproaches: [{ technique: 'O(n²) DP', tradeoff: 'dp[i] = min jumps to reach i. For each i, update all reachable positions. O(n²) — greedy is strictly better.', complexity: 'O(n²) time, O(n) space' }] },

      'LC_741': { leetcode: 741,  title: 'Cherry Pickup',                            difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/cherry-pickup/',                            templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','matrix','path-optimization'], keyInsight: 'Reformulate as two simultaneous paths from top-left to bottom-right collecting cherries. dp[r1][c1][r2] represents max cherries when path1 at (r1,c1) and path2 at (r2,c2) where c2 = r1+c1-r2 (derived from step count). When both reach same cell, count cherries only once. Space-optimize from O(n³) to O(n²) using rolling arrays.', shrinkTrigger: 'Compute steps from (0,0): step = r+c. Both paths move r and c each step. dp[r1][c1][r2] = r1+c1==step && r2+c2==step. Transitions: try all 4 combos of down/right for each path.', timeComplexity: 'O(n³)', spaceComplexity: 'O(n²) with rolling array', gotcha: 'If both paths reach the same cell, count cherries only once (grid[r1][c1], not twice). The key insight: two independent paths forward = one path forward + one path backward conceptually. When r1+c1 == r2+c2 (same step), derive c2 from r2 to save state space.', faangNote: 'Meta and Google Hard 7/10 frequency. Lead with: "I model this as two simultaneous forward paths. To save state space, I use the step count to derive c2 from r2, reducing state dimensions from (r1,c1,r2,c2) to (step,r1,r2)." The rolling array optimization signals SDE3.', alternateApproaches: [] },

      'LC_85':  { leetcode: 85,   title: 'Maximal Rectangle',                        difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/maximal-rectangle/',                        templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','histogram','matrix'], keyInsight: 'Convert each row into a histogram heights problem. For each row i, heights[j] = (matrix[i][j]==\'1\' ? heights[j]+1 : 0). Run "Largest Rectangle in Histogram" on each row\'s height array. Answer is the max area across all rows.', shrinkTrigger: 'heights = new Array(cols).fill(0). For each row: for j: heights[j] = matrix[i][j]==\'1\' ? heights[j]+1 : 0. maxArea = max(largestRectangleInHistogram(heights)). Use monotonic stack for histogram in O(n).', timeComplexity: 'O(m * n)', spaceComplexity: 'O(n)', gotcha: 'The heights array is cumulative — reset to 0 only if matrix[i][j]==\'0\'. If you reset the entire row upon encountering a zero, you lose the cumulative benefit. Largest Rectangle in Histogram uses a monotonic increasing stack.', faangNote: 'Google 8/10, Meta 7/10. The pattern recognition moment: "I reduce 2D to 1D by computing histogram heights per row, then apply the 1D largest-rectangle algorithm." Candidates who see this pattern unprompted signal SDE3 immediately.', alternateApproaches: [{ technique: 'pure 2D DP', tradeoff: 'dp[i][j] = largest square with bottom-right at (i,j). O(m*n) but max area is limited to squares. Histogram approach finds arbitrary rectangles.', complexity: 'O(m * n) time, O(n) space' }] },

      'LC_1289':{ leetcode: 1289, title: 'Minimum Falling Path Sum II',             difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/minimum-falling-path-sum-ii/',             templateRefs: ['P8'],  tags: ['dynamic-programming','grid-dp','matrix','optimization'], keyInsight: 'Grid DP with constraint: each step must move to a DIFFERENT column (not directly below). Naive: dp[i][j] = matrix[i][j] + min(dp[i-1][k] for k != j) = O(m * n²). Optimization: track min1 and min2 (smallest and second-smallest from previous row). If prev-min is in a different column, use it; else use prev-min2.', shrinkTrigger: 'Compute min1, min2 from row i-1. For row i, j: if min1_col != j: dp[i][j] = matrix[i][j] + min1; else: dp[i][j] = matrix[i][j] + min2. Update next min1, min2.', timeComplexity: 'O(m * n)', spaceComplexity: 'O(n)', gotcha: 'The two-min optimization requires tracking not just the value but also the COLUMN INDEX of the min. If the current column equals the previous min column, use min2 instead. Forgetting to track columns gives wrong answers.', faangNote: 'Meta 7/10, Google 6/10. Tests optimization discipline: naive O(m*n²) passes small inputs but TLEs on large. O(m*n) min-tracking is the expected solution. State: "I track min1 and min2 plus their column indices from the previous row — O(n) space, O(m*n) time."', alternateApproaches: [{ technique: 'naive O(m*n²)', tradeoff: 'dp[i][j] = matrix[i][j] + min(dp[i-1][k] for k != j). Works for small n but TLEs for n > 100. Use two-min optimization for full credit.', complexity: 'O(m * n²) time, O(n) space' }] },

      'LC_188': { leetcode: 188,  title: 'Best Time to Buy and Sell Stock IV',      difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/',      templateRefs: ['P7'],  tags: ['dynamic-programming','state-machine','array'], keyInsight: 'Generalized state machine: k is variable (up to n/2 transactions). If k >= n/2 (unlimited), reduce to LC_122 (unlimited transactions). Else: dp[t][0] = max profit after at most t transactions, currently holding. dp[t][1] = max profit after at most t transactions, currently not holding. For each price: dp[t][1] = max(dp[t][1], dp[t-1][0] + price); dp[t][0] = max(dp[t][0], dp[t][1] - price).', shrinkTrigger: 'if k >= n/2: solve as unlimited (greedy sum of differences). Else: buy[t]=[-Infinity]*k, sell[t]=[0]*k. For each price: for t from k-1 down to 0: sell[t]=max(sell[t], buy[t]+price); buy[t]=max(buy[t], sell[t-1]-price). Return sell[k-1].', timeComplexity: 'O(n * k)', spaceComplexity: 'O(k)', gotcha: 'Update from high t down to low t prevents using today\'s price twice in the same transaction. The unlimited case: if k >= n/2 (more transactions allowed than days), simply sum all positive differences — no explicit DP needed.', faangNote: 'Amazon 8/10, Google 7/10 as a follow-up to LC_123. State: "This is LC_123 generalized to k transactions. If k >= n/2, reduce to unlimited. Otherwise, track buy and sell state for each transaction count t."', alternateApproaches: [] },

      'LC_132': { leetcode: 132,  title: 'Palindrome Partitioning II',               difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/palindrome-partitioning-ii/',               templateRefs: ['P6'],  tags: ['dynamic-programming','interval-dp','string'], keyInsight: 'Interval DP combined with string DP. dp[i] = minimum cuts needed to partition s[0..i]. For each i, check all j <= i: if s[j..i] is a palindrome, then dp[i] = min(dp[i], dp[j-1] + 1). Precompute isPalin[i][j] using 2D DP to check palindromes in O(1).', shrinkTrigger: 'isPalin[i][j] = (s[i]==s[j] && (i+1>j-1 || isPalin[i+1][j-1])). Fill by increasing length. dp[i] = i (worst case: cut every char). For i=0..n-1: for j=0..i: if isPalin[j][i]: dp[i]=min(dp[i], dp[j-1]+1).', timeComplexity: 'O(n²)', spaceComplexity: 'O(n²)', gotcha: 'Precompute palindromes first — checking them on-the-fly in the outer loop makes the solution O(n³) or requires a palindrome-checking subroutine. Initialize dp[i] to i (worst case) then decrement. Handle j-1 < 0 when j=0 (no cut needed for s[0..i] if it\'s a palindrome).', faangNote: 'Google 7/10. The interval DP recurrence is standard, but the key optimization is precomputing palindromes. State: "I precompute a 2D palindrome table in O(n²), then use interval DP to find minimum cuts in O(n²)." Candidates who compute palindromes on-the-fly without memoization don\'t pass time limits.', alternateApproaches: [] }
    }
  }
  ,
  'graph': {
    description: 'Graph problems require navigating networks of nodes and edges to find paths, detect cycles, identify connected components, or solve optimization tasks. In FAANG interviews, graph problems appear in three forms: (1) Explicit graphs where adjacency lists/matrices are provided, (2) Implicit graphs where state transformations define edges (word ladder, genetic mutations), and (3) Matrix/grid graphs where cell adjacencies form edges. Mastery combines traversal patterns (BFS/DFS), data structures (Union-Find), and specialized algorithms (Dijkstra, topological sort).',
    goal: 'Cover 95% of FAANG Graph questions by mastering 9 patterns and 26 curated problems',
    relatedTopics: ['dynamic-programming', 'recursion', 'backtracking'],

    tagRegistry: [
      'graph','bfs','dfs','traversal','connected-components','cycle-detection','union-find','topological-sort',
      'shortest-path','dijkstra','multi-source-bfs','implicit-graph','state-transformation','adjacency-list',
      'memoization','backtracking','greedy','priority-queue','matrix','grid','coloring','path-reconstruction',
      'optimization','tree-validation','grouping','hybrid-pattern','weighted-graph','constraint-graph','division-relationships',
      'graph-coloring','2-coloring','bipartite-checking','safe-nodes','color-marking','directed-graph',
      'mst','minimum-spanning-tree','kruskal','prim','euclidean-distance','geometry',
      'back-edge','white-gray-black','undirected-cycle','directed-cycle','dfs-coloring'
    ],

    techniqueRegistry: [
      'bfs','dfs','union-find','topological-sort','dijkstra','bellman-ford','bitmask-dp','backtracking',
      'priority-queue','cycle-detection','coloring','memoization'
    ],

    whenToUse: {
      use: [
        'Problem involves nodes and edges — explicit graph or implicit state-transformation graph',
        'Finding shortest path, connected components, cycles, or topological ordering',
        'Multiple ways to reach a state — graph traversal eliminates redundant exploration',
        'Keywords: "path", "connection", "network", "dependency", "reachable", "distance", "component"'
      ],
      avoid: [
        'Simple linear or 2D array problems without graph structure (use array DP instead)',
        'Only one valid path exists — standard iteration suffices',
        'No edges or transitions — might be a simple enumeration problem'
      ]
    },

    interviewTips: [
      'Always clarify: is the graph explicit (adjacency list given) or implicit (state transformation)?',
      'Identify the traversal pattern: unweighted shortest path (BFS), weighted shortest path (Dijkstra), all paths (DFS), connected components (Union-Find or DFS), or ordering (topological sort).',
      'Matrix/grid problems are graphs — adjacency is implicit in cell neighbors.',
      'For cycle detection: undirected (Union-Find or DFS with visited), directed (DFS with color marking), DAG (topological sort).',
      'Multi-source BFS: initialize queue with all sources at once, not one at a time.',
      'Dijkstra requires non-negative weights; Bellman-Ford handles negatives but is slower.',
      'Topological sort: both Kahn\'s (BFS on in-degrees) and DFS post-order work; know both.',
      'Bitmask DP on graphs: use when n ≤ 20 and all subsets matter (visiting all nodes).'
    ],

    patterns: [
      {
        id: 'P1', name: 'BFS (Unweighted Shortest Path & Level-Order)',
        recognitionSignals: [
          'Shortest path in an unweighted graph or implicit graph (each transition costs 1)',
          'Multi-source BFS: multiple starting points, find closest source or level-order from all sources',
          'Level-order exploration where each level represents nodes at distance k from source',
          'Keywords: "shortest path", "minimum steps", "distance", "level-order", "rotting"'
        ],
        questionIds: ['LC_127', 'LC_994', 'LC_1091']
      },
      {
        id: 'P2', name: 'DFS & Connected Components',
        recognitionSignals: [
          'Traversing an entire connected region or all reachable nodes from a source',
          'No ordering constraint — just visit all connected nodes',
          'Backtracking through a graph to find all paths or detect patterns',
          'Graph coloring and bipartite detection via 2-coloring DFS',
          'Keywords: "connected component", "region", "all paths", "clone", "islands", "bipartite"'
        ],
        questionIds: ['LC_200', 'LC_133', 'LC_797', 'LC_261', 'LC_785']
      },
      {
        id: 'P3', name: 'Union-Find (Disjoint Set Union)',
        recognitionSignals: [
          'Detecting cycles or merging disjoint components efficiently',
          'Equivalence class problems — grouping items into connected sets',
          'Each operation (union, find) should be ~O(α(n)) amortized',
          'Keywords: "connected", "merge", "component", "union", "cycle", "redundant"'
        ],
        questionIds: ['LC_323', 'LC_547', 'LC_684', 'LC_721']
      },
      {
        id: 'P4', name: 'Topological Sort (DAG Ordering)',
        recognitionSignals: [
          'Problem specifies dependencies, prerequisites, or ordering constraints on a DAG',
          'Must process nodes in a specific order respecting all incoming edges',
          'Detects cycles in directed graphs — a valid topological ordering proves the graph is acyclic',
          'Keywords: "prerequisite", "dependency", "order", "course", "task scheduling", "alien dictionary"'
        ],
        questionIds: ['LC_207', 'LC_210', 'LC_269', 'LC_802']
      },
      {
        id: 'P5', name: 'Dijkstra & Weighted Shortest Path',
        recognitionSignals: [
          'Shortest path in a weighted graph with non-negative edge weights',
          'Priority queue to always expand the closest unexplored node',
          'Single-source shortest path to all reachable nodes',
          'Keywords: "weighted path", "minimum cost", "distance", "delay", "flights", "stops"'
        ],
        questionIds: ['LC_743', 'LC_787', 'LC_1976', 'LC_399']
      },
      {
        id: 'P6', name: 'Matrix as Implicit Graph',
        recognitionSignals: [
          'A 2D grid where cells are nodes and adjacency (up, down, left, right or diagonal) defines edges',
          'Water flow, boundary exploration, or region marking problems on grids',
          'Multi-source BFS or DFS starting from all cells of a certain type',
          'Keywords: "matrix", "grid", "flow", "water", "surrounded", "boundary", "region"'
        ],
        questionIds: ['LC_417', 'LC_130']
      },
      {
        id: 'P7', name: 'Bitmask DP on Graphs (Advanced)',
        recognitionSignals: [
          'Visit all nodes exactly once and return to start (Traveling Salesman variant)',
          'State includes both current node AND set of visited nodes — bitmask encodes visited set',
          'n ≤ 20 so 2^n state space is feasible',
          'Keywords: "visit all nodes", "shortest path visiting", "TSP", "all nodes"'
        ],
        questionIds: ['LC_847']
      },
      {
        id: 'P8', name: 'Minimum Spanning Tree (MST)',
        recognitionSignals: [
          'Find a subset of edges connecting all vertices with minimum total weight',
          'Two canonical algorithms: Kruskal\'s (greedy + Union-Find) and Prim\'s (greedy + min-heap)',
          'Problem asks for "all connected" with "minimum cost" or "cheapest path"',
          'Keywords: "connect all points", "minimum spanning tree", "MST", "cables", "roads"'
        ],
        questionIds: ['LC_1584']
      },
      {
        id: 'P9', name: 'Cycle Detection (Undirected & Directed)',
        recognitionSignals: [
          'Detect if a cycle exists in an undirected graph using DFS or Union-Find (back-edge)',
          'Detect if a cycle exists in a directed graph using 3-color DFS (white→gray→black)',
          'Undirected: back-edge connects two nodes in the same DFS tree (neither is ancestor of other)',
          'Directed: back-edge connects node to an ancestor (gray node) — indicates a cycle',
          'Keywords: "cycle", "detect cycle", "redundant edge", "safe nodes", "eventual safe", "back edge"'
        ],
        questionIds: ['GFG_CYCLE_UNDIRECTED', 'GFG_CYCLE_DIRECTED']
      }
    ],

    questions: {
      'LC_127': { leetcode: 127,  title: 'Word Ladder',                             difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/word-ladder/',                             templateRefs: ['P1'],  tags: ['graph','bfs','implicit-graph','state-transformation','string'], keyInsight: 'Implicit graph where each word is a node; edges connect words differing by one letter. BFS from start word → find shortest path to end word. Build neighbors on-the-fly by generating all one-letter transformations and checking wordSet membership.', shrinkTrigger: 'queue=[start]. visited={start}. For each word: generate all neighbors (change each position to a-z). If neighbor in wordSet and not visited: add to queue. If neighbor==end: return level. Return 0 if unreachable.', timeComplexity: 'O(n * L² * 26) where n=word count, L=word length (building neighbors for each word)', spaceComplexity: 'O(n * L)', gotcha: 'Building neighbors by iterating through all 26 letters at each position is O(26*L) per word — this is the only efficient approach. Pre-building an adjacency list is O(n²*L) comparison time, which is worse.', faangNote: 'Google 8/10, Amazon 7/10. Classic implicit graph recognition test. Lead with: "This is an implicit graph where words are nodes and one-letter edits define edges. BFS finds the shortest path."', alternateApproaches: [{ technique: 'bidirectional BFS', tradeoff: 'Start from both start and end simultaneously, meet in the middle. Reduces search space but adds complexity. Same asymptotic O(n*L²*26) but faster in practice.', complexity: 'O(n * L² * 26) time, O(n * L) space' }] },

      'LC_994': { leetcode: 994,  title: 'Rotting Oranges',                         difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/rotting-oranges/',                         templateRefs: ['P1'],  tags: ['graph','bfs','multi-source-bfs','matrix','grid'], keyInsight: 'Multi-source BFS: rotten oranges (value 2) are all sources. In each minute, rotten oranges spread to adjacent fresh oranges (value 1 → 2). Enqueue all rotten oranges at the start, process level-by-level, count minutes until no fresh oranges remain.', shrinkTrigger: 'Find all initial rotten cells; enqueue them. While queue: for each cell in this level: spread to unvisited fresh neighbors. Increment time each level. After BFS, check if any fresh orange remains (unreachable).', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n)', gotcha: 'The answer is minutes elapsed, not the queue size. After processing all sources, if fresh oranges remain, return -1. A fresh orange surrounded by walls never rots — the BFS will not reach it.', faangNote: 'Amazon and Google 8/10. Multi-source BFS recognition is critical — state upfront: "All rotten oranges are sources in a multi-source BFS. I initialize the queue with all of them simultaneously."', alternateApproaches: [] },

      'LC_1091': { leetcode: 1091, title: 'Shortest Path in Binary Matrix',           difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/shortest-path-in-binary-matrix/',           templateRefs: ['P1'],  tags: ['graph','bfs','multi-source-bfs','matrix','grid','optimization'], keyInsight: 'Multi-source BFS from any empty cell to find shortest path to any empty cell in an 8-directional grid (up, down, left, right, and 4 diagonals). BFS guarantees shortest distance. Handle edge case: if grid[0][0] or grid[n-1][m-1] is 1 (obstacle), return -1.', shrinkTrigger: 'If grid[0][0]==1 or grid[n-1][m-1]==1: return -1. queue=[(0,0,1)]. visited={(0,0)}. While queue: for each cell: if (r,c)==(n-1,m-1): return distance. Spread to 8 unvisited neighbors with obstacles skipped.', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n)', gotcha: '8-directional movement (diagonal steps allowed) — must check all 8 neighbors, not just 4. Common bugs: forgetting to check destination immediately after dequeueing (return early if reached), or miscounting diagonal movements as longer.', faangNote: 'Amazon 8/10, Google 7/10, Meta 7/10. More frequently asked than LC_286. Tests 8-directional grid navigation. State: "I use BFS with 8-directional movement. Each distance level guarantees the shortest path."', alternateApproaches: [{ technique: '0-1 BFS / Deque optimization', tradeoff: 'If edge weights differ (0 or 1), use deque: 0-weight edges to front, 1-weight edges to back. Overkill for uniform 1-cost here but is a generalization.', complexity: 'O(m * n) time, O(m * n) space' }] },

      'LC_200': { leetcode: 200,  title: 'Number of Islands',                       difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/number-of-islands/',                       templateRefs: ['P2'],  tags: ['graph','dfs','connected-components','matrix','grid'], keyInsight: 'Connected components on a 2D grid. DFS from each unvisited land cell (1) to mark all connected land cells. Each DFS call represents one island. Increment island count for each new DFS initiated. Space-optimize by marking visited cells as 0 during DFS (in-place).', shrinkTrigger: 'count=0. For each cell: if grid[r][c]==\'1\': dfs(r,c); count++. dfs marks cell as \'0\' and recurses to all unvisited land neighbors. Return count.', timeComplexity: 'O(m * n)', spaceComplexity: 'O(1) if in-place marking allowed; O(m * n) with separate visited array', gotcha: 'The grid is modified in-place during DFS (1→0) to avoid revisiting. If in-place modification is not allowed, use a separate visited set or array. BFS instead of DFS works identically — both find all connected cells.', faangNote: 'Amazon 9/10, Google 8/10, Meta 8/10. Canonical connected-components problem. Lead with: "This is counting connected components on a grid. DFS from each unvisited cell marks the entire connected region."', alternateApproaches: [{ technique: 'Union-Find', tradeoff: 'For each cell, union it with its right and bottom neighbors. Count the number of distinct components at the end. Same asymptotic but more overhead.', complexity: 'O(m * n * α(m*n)) time, O(m * n) space' }] },

      'LC_133': { leetcode: 133,  title: 'Clone Graph',                             difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/clone-graph/',                             templateRefs: ['P2'],  tags: ['graph','dfs','deep-copy','traversal'], keyInsight: 'Deep-copy a graph: create a copy of each node and all edges. Use a map to track already-cloned nodes (prevents infinite loops). DFS from start node: for each unvisited node, create a clone, map original→clone, then recursively clone all neighbors.', shrinkTrigger: 'map={}. dfs(node): if node in map: return map[node]. create clone of node; map[node]=clone. for each neighbor: clone.neighbors.push(dfs(neighbor)). Return clone. dfs(startNode).', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V)', gotcha: 'The map prevents infinite loops in cyclic graphs. Without it, DFS on a graph with cycles will recurse forever. Must create the clone BEFORE recursing on neighbors to break cycles.', faangNote: 'Meta 7/10, Google 6/10. Tests deep-copy discipline and cycle handling. State upfront: "I use a map to track cloned nodes. When I see a node already in the map, I return its clone instead of re-cloning it — this breaks cycles."', alternateApproaches: [{ technique: 'BFS with queue', tradeoff: 'Same logic but level-order instead of depth-first. Identical complexity.', complexity: 'O(V + E) time, O(V) space' }] },

      'LC_797': { leetcode: 797,  title: 'All Paths From Source to Target',          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/all-paths-from-source-to-target/',          templateRefs: ['P2'],  tags: ['graph','dfs','backtracking','path-reconstruction','dag'], keyInsight: 'DAG (directed acyclic graph) backtracking: find all paths from source (0) to target (n-1). DFS maintains current path; when reaching target, record a copy of the path. Backtrack by removing the current node from the path.', shrinkTrigger: 'paths=[]. dfs(node, path): if node==n-1: paths.push([...path]). For each neighbor: path.push(neighbor); dfs(neighbor, path); path.pop(). dfs(0, [0]).', timeComplexity: 'O(2^n * n) worst case (exponential paths, linear to copy each)', spaceComplexity: 'O(n) for recursion stack', gotcha: 'Must copy the path when recording (paths.push([...path]) not paths.push(path)). Otherwise all paths reference the same mutable array.', faangNote: 'Google 6/10. Tests backtracking and path reconstruction. The DAG constraint means no cycles — only one direction of travel (lower node indices).', alternateApproaches: [{ technique: 'BFS with queue', tradeoff: 'BFS with (node, path) tuples works but is less natural. DFS backtracking is the canonical approach for path enumeration.', complexity: 'O(2^n * n) time, O(n) space' }] },

      'LC_323': { leetcode: 323,  title: 'Number of Connected Components',           difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/', templateRefs: ['P3'],  tags: ['graph','union-find','connected-components','dfs'], keyInsight: 'Union-Find (Disjoint Set Union): Initialize n separate sets (one per node). For each edge, union the two endpoints. Count the number of distinct root parents at the end — each root represents one connected component.', shrinkTrigger: 'parent=[0..n-1]. For each edge (u,v): union(u, v). Return count of distinct find(i) for i=0..n-1 (or maintain componentCount, decrement on each successful union).', timeComplexity: 'O(n + e * α(n)) where e=edges, α=inverse Ackermann (nearly constant)', spaceComplexity: 'O(n)', gotcha: 'Union-Find requires path compression and union-by-rank for amortized O(α(n)) per operation. Without these optimizations, naive union-find degrades to O(n) per operation. Maintain a componentCount variable, decrement only on a successful union (not in find).', faangNote: 'Amazon 7/10, Google 7/10. Union-Find is underrated; always offer it as the O(n+e) baseline over DFS O(n+e). State: "I use union-find with path compression and union-by-rank — O(n + e * α(n)) is effectively linear."', alternateApproaches: [{ technique: 'DFS', tradeoff: 'Visit each node once, count connected regions. O(n + e) same complexity but union-find is cleaner for component counting.', complexity: 'O(n + e) time, O(n) space' }] },

      'LC_547': { leetcode: 547,  title: 'Friend Circles',                          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/number-of-provinces/',                           templateRefs: ['P3'],  tags: ['graph','union-find','connected-components','adjacency-matrix'], keyInsight: 'Adjacency matrix represents friendships. Union-Find: union friends in each row; count distinct root parents. Alternatively, DFS from each unvisited person marks entire friend circle. Both are O(n²) due to the adjacency matrix, not O(n+e) like sparse graphs.', shrinkTrigger: 'parent=[0..n-1]. For each i: for each j>i: if isConnected[i][j]: union(i, j). Return count of distinct find(i).', timeComplexity: 'O(n² * α(n))', spaceComplexity: 'O(n)', gotcha: 'Adjacency matrix is O(n²) to scan, so union-find is O(n² * α(n)) not linear. Path compression and union-by-rank are essential. This is called "Friend Circles" on old LeetCode; renamed to "Number of Provinces."', faangNote: 'Google 7/10, Meta 6/10. Tests union-find mastery. Also teaches adjacency matrix vs adjacency list complexity.', alternateApproaches: [{ technique: 'DFS', tradeoff: 'DFS from each unvisited person, mark entire circle. Same O(n²) complexity, slightly simpler code.', complexity: 'O(n²) time, O(n) space' }] },

      'LC_684': { leetcode: 684,  title: 'Redundant Connection',                    difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/redundant-connection/',                    templateRefs: ['P3'],  tags: ['graph','union-find','cycle-detection','undirected-graph'], keyInsight: 'Detect a cycle in an undirected graph. Union-Find: process edges in order. If both endpoints of an edge are already in the same component, that edge creates a cycle. Return the first (last in problem statement) edge that creates a cycle.', shrinkTrigger: 'parent=[0..n]. For each edge (u, v): if find(u)==find(v): return [u, v] (cycle found). Else: union(u, v). Return [] if no cycle (but problem guarantees a cycle exists).', timeComplexity: 'O(n * α(n))', spaceComplexity: 'O(n)', gotcha: 'The problem guarantees exactly one redundant edge (one cycle). Return THE edge that completes the cycle. If multiple edges close cycles, return the last one processed.', faangNote: 'Apple 6/10, Amazon 6/10. Canonical cycle-detection in undirected graphs. Union-Find is the natural solution — DFS also works but is less elegant.', alternateApproaches: [{ technique: 'DFS cycle detection', tradeoff: 'Track visited nodes and parent; detect back edges. Same O(n) complexity but requires careful parent tracking.', complexity: 'O(n) time, O(n) space' }] },

      'LC_207': { leetcode: 207,  title: 'Course Schedule',                         difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/course-schedule/',                         templateRefs: ['P4'],  tags: ['graph','topological-sort','cycle-detection','dag','directed-graph'], keyInsight: 'Detect cycle in a directed graph (prerequisite graph). Kahn\'s algorithm (BFS on in-degrees): enqueue nodes with in-degree 0, process and decrement in-degrees of neighbors. If a cycle exists, some nodes remain unprocessed (impossible to reach in-degree 0).', shrinkTrigger: 'Compute in-degrees. Queue = nodes with in-degree 0. While queue: dequeue node; for each neighbor: decrement in-degree. If in-degree becomes 0, enqueue. If processed < n: cycle exists (return false). Else: no cycle (return true).', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V + E)', gotcha: 'Topological sort proves acyclicity. If fewer than n nodes reach in-degree 0, a cycle must exist. Do NOT use DFS with color marking (more error-prone) unless you explicitly understand the states: white (unvisited), gray (in-progress), black (finished).', faangNote: 'Amazon 9/10, Google 8/10. Kahn\'s algorithm is the canonical cycle-detection + topological sort baseline. Always lead with Kahn\'s; mention DFS as alternative only if asked.', alternateApproaches: [{ technique: 'DFS with color marking', tradeoff: 'White=unvisited, gray=in-progress (stack), black=finished. Back edge to gray node = cycle. More complex but equally valid.', complexity: 'O(V + E) time, O(V) space' }] },

      'LC_210': { leetcode: 210,  title: 'Course Schedule II',                      difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/course-schedule-ii/',                      templateRefs: ['P4'],  tags: ['graph','topological-sort','cycle-detection','dag','path-reconstruction'], keyInsight: 'LC_207 follow-up: return the topological order (course sequence) if acyclic, or empty if cycle. Kahn\'s algorithm: dequeue and record each node — the dequeue order is the topological sort.', shrinkTrigger: 'Same as LC_207 but append to result each time a node is dequeued. Return result if length==n, else [].', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V + E)', gotcha: 'The order matters: Kahn\'s BFS gives one valid topological order (in-degree based). DFS post-order gives another valid order. Both are correct; problem accepts any valid order.', faangNote: 'Google 8/10, Amazon 8/10. Immediate follow-up to LC_207. State: "Topological sort is a linear ordering of a DAG. Any node with in-degree 0 can start; I use Kahn\'s to output one valid order."', alternateApproaches: [{ technique: 'DFS post-order', tradeoff: 'DFS visits all nodes; the reverse of post-order is a valid topological sort. Same asymptotic complexity.', complexity: 'O(V + E) time, O(V) space' }] },

      'LC_269': { leetcode: 269,  title: 'Alien Dictionary',                        difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/alien-dictionary/',                        templateRefs: ['P4'],  tags: ['graph','topological-sort','dag','character-graph','ordering'], keyInsight: 'Build a character dependency graph by comparing consecutive words. The first differing character defines an edge (earlier char→later char in alien order). Topological sort on this character graph yields the alien alphabet order.', shrinkTrigger: 'Build graph: for each pair of consecutive words, find first differing character and add edge. Topological sort using Kahn\'s. If all characters are processed, return sorted order; else invalid (cycle or contradiction).', timeComplexity: 'O(n * L + 26 + e) where n=words, L=max word length, e=edges (at most 26)', spaceComplexity: 'O(1) (only 26 characters)', gotcha: 'If word1 is a prefix of word2 and word1 comes first, the input is invalid — return "". Must validate this edge case. Also handle words that don\'t add constraints (identical or no differing char within max length).', faangNote: 'Google 8/10, Meta 6/10. Tests pattern recognition: "The problem is ordering characters, not words. I reduce it to a topological sort on a character graph." Handling edge cases correctly is what separates SDE3 from SDE2.', alternateApproaches: [{ technique: 'DFS post-order', tradeoff: 'DFS on character graph, return reverse of post-order. Same complexity.', complexity: 'O(n * L + 26 + e) time, O(1) space' }] },

      'LC_743': { leetcode: 743,  title: 'Network Delay Time',                       difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/network-delay-time/',                       templateRefs: ['P5'],  tags: ['graph','dijkstra','shortest-path','weighted-graph','priority-queue'], keyInsight: 'Dijkstra\'s algorithm: find shortest path from source node to all nodes in a weighted graph. Use a min-heap (priority queue) to always expand the closest unexplored node. Answer is the maximum distance to any reachable node (last node to receive the signal).', shrinkTrigger: 'dist = {k: ∞ for all nodes}; dist[k] = 0. minHeap = [(0, k)]. While heap: pop (d, u). If d > dist[u]: skip (stale entry). For each edge (u, v, w): if dist[u] + w < dist[v]: dist[v] = dist[u] + w; push (dist[v], v). Return max(dist.values()).', timeComplexity: 'O((V + E) log V)', spaceComplexity: 'O(V + E)', gotcha: 'Dijkstra requires non-negative edge weights. With negative weights, use Bellman-Ford instead. Skip stale heap entries (relaxed distances) — do not re-process. The answer is the maximum distance to any node, not the distance to a specific target.', faangNote: 'Amazon 7/10, Apple 7/10, Google 6/10. Canonical Dijkstra baseline. State upfront: "I use Dijkstra\'s with a min-heap to find shortest paths from source to all nodes."', alternateApproaches: [{ technique: 'Bellman-Ford', tradeoff: 'Handles negative weights but O(V*E) is slower for non-negative graphs. Use Dijkstra for this problem.', complexity: 'O(V * E) time, O(V) space' }] },

      'LC_787': { leetcode: 787,  title: 'Cheapest Flights Within K Stops',         difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/cheapest-flights-within-k-stops/',         templateRefs: ['P5'],  tags: ['graph','dijkstra','shortest-path','weighted-graph','constraint'], keyInsight: 'Dijkstra variant with an additional constraint: at most k stops. State is (node, stops_used). Priority queue: (cost, node, stops). Relax edges: if cost to neighbor is cheaper AND stops <= k, update neighbor.', shrinkTrigger: 'dist = {(n, 0): 0}; minHeap = [(0, src, 0)]. While heap: pop (cost, node, stops). For each edge (node, next, price): if cost + price < dist[(next, stops+1)] and stops < k: dist[(next, stops+1)] = cost + price; push (new_cost, next, stops+1). Return min(dist[(dst, s)] for all s).', timeComplexity: 'O((V * k + E) log(V * k))', spaceComplexity: 'O(V * k)', gotcha: 'State is (node, stops) not just node. Must track which node you\'re at AND how many stops you\'ve used. The constraint "at most k stops" means k+1 nodes visited or k flights taken.', faangNote: 'Google 6/10. Tests Dijkstra adaptation to multi-dimensional state space. "I extend Dijkstra to track stops as part of the state — state is (node, stops_used)."', alternateApproaches: [{ technique: 'BFS with price tracking', tradeoff: 'Level-order by stops; within each level, track minimum price per node. Identical complexity but less standard.', complexity: 'O((V * k + E) log(V * k)) time, O(V * k) space' }] },

      'LC_1976': { leetcode: 1976, title: 'Number of Ways to Arrive at Destination', difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/number-of-ways-to-arrive-at-destination/', templateRefs: ['P5'],  tags: ['graph','dijkstra','shortest-path','counting','modular-arithmetic'], keyInsight: 'Dijkstra + counting: find shortest path from source to destination, then count how many different shortest paths exist. Maintain ways[node] = number of ways to reach node with minimum distance. When relaxing edges, if new distance equals old distance, add to ways[neighbor].', shrinkTrigger: 'dist = {src: 0}; ways = {src: 1}; minHeap = [(0, src)]. While heap: pop (d, u). For each (u, v, w): if d + w < dist[v]: dist[v] = d + w; ways[v] = ways[u]; push (d + w, v). Else if d + w == dist[v]: ways[v] += ways[u]. Return ways[dst] % MOD.', timeComplexity: 'O((V + E) log V)', spaceComplexity: 'O(V + E)', gotcha: 'When a new shortest path is found, REPLACE ways[v] with ways[u]. When an equal-distance path is found, ADD ways[u] to ways[v]. Must use modulo (10^9+7) to prevent overflow.', faangNote: 'Google 7/10, Meta 6/10. Tests Dijkstra adaptation for counting. "After finding shortest distances, I count the number of ways to reach each node at that distance by updating ways[v] when distances match."', alternateApproaches: [{ technique: 'DFS + memoization', tradeoff: 'Top-down DFS from destination back to source, counting paths. Less standard than Dijkstra.', complexity: 'O((V + E) log V) time, O(V + E) space' }] },

      'LC_417': { leetcode: 417,  title: 'Pacific Atlantic Water Flow',             difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/pacific-atlantic-water-flow/',             templateRefs: ['P6'],  tags: ['graph','dfs','multi-source-dfs','matrix','grid','boundary'], keyInsight: 'Water flows downhill (to cells with lower or equal height). Find cells where water can reach BOTH oceans. Trick: reverse the logic — start from ocean boundaries and flow uphill. If a cell can reach both oceans, include it in the result.', shrinkTrigger: 'pacific_cells = all cells reachable (uphill) from Pacific boundary. atlantic_cells = all cells reachable (uphill) from Atlantic boundary. Result = pacific_cells ∩ atlantic_cells.', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n)', gotcha: 'Reversing the flow direction (uphill instead of downhill) avoids the need to check all possible paths. Start DFS from ALL boundary cells simultaneously (multi-source DFS conceptually, but implemented as two separate DFS passes). A cell on the boundary can reach both oceans if it has a path connecting its two boundary DFS result sets.', faangNote: 'Google 7/10, Meta 6/10. The boundary-reversal insight is the key. State: "Instead of checking downhill paths from each cell, I reverse the flow: start from ocean boundaries and move uphill. Cells reachable from both boundaries are the answer."', alternateApproaches: [{ technique: 'BFS from all boundary cells', tradeoff: 'Same logic, BFS instead of DFS. Identical complexity.', complexity: 'O(m * n) time, O(m * n) space' }] },

      'LC_130': { leetcode: 130,  title: 'Surrounded Regions',                      difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/surrounded-regions/',                      templateRefs: ['P6'],  tags: ['graph','dfs','boundary','matrix','grid','region-marking'], keyInsight: 'Mark all \'O\' cells connected to the boundary — these cannot be surrounded. All other \'O\' cells are surrounded and must be flipped to \'X\'. DFS from boundary \'O\' cells to mark them as visited. Then flip all remaining unvisited \'O\' to \'X\'.', shrinkTrigger: 'For each \'O\' on the boundary: DFS to mark all connected \'O\' cells. After DFS, flip all unvisited \'O\' to \'X\', restore visited \'O\' (or use a visited set and flip unmarked cells).', timeComplexity: 'O(m * n)', spaceComplexity: 'O(m * n)', gotcha: 'Only \'O\' cells connected to the boundary are safe. Must explicitly start DFS from boundary cells, not interior cells. Use a visited set or mark cells temporarily during DFS.', faangNote: 'Apple 6/10, Amazon 5/10. Teaches boundary-based DFS recognition. "Connected components that touch the boundary are safe; all others are surrounded."', alternateApproaches: [{ technique: 'BFS from boundary', tradeoff: 'Same logic, queue-based traversal. Identical complexity.', complexity: 'O(m * n) time, O(m * n) space' }] },

      'LC_847': { leetcode: 847,  title: 'Shortest Path Visiting All Nodes',        difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/shortest-path-visiting-all-nodes/',        templateRefs: ['P7'],  tags: ['graph','bitmask-dp','shortest-path','bfs','state-compression'], keyInsight: 'TSP variant: visit all n nodes and minimize steps. State: (node, visited_set). Use bitmask to encode visited_set (2^n states). BFS with state (node, mask) — for each state, explore neighbors not yet visited. Answer is the first time all nodes are visited (mask == 2^n - 1).', shrinkTrigger: 'mask_all = (1 << n) - 1. queue = [(node, 1 << node) for each node]. visited = set(). While queue: pop (node, mask). If mask == mask_all: return steps. For each neighbor: new_mask = mask | (1 << neighbor). If (neighbor, new_mask) not visited: mark visited; push to queue. steps++.', timeComplexity: 'O(2^n * n²)', spaceComplexity: 'O(2^n * n)', gotcha: 'Each state is (node, visited_mask). A stale entry with the same (node, mask) but more steps is redundant — use visited set to prune. The mask encodes which nodes have been visited; only update if we reach a state with fewer steps.', faangNote: 'Google 8/10, Meta 7/10. Advanced problem — bitmask DP on graphs. Lead with: "This is a shortest path with state compression. State is (current node, set of visited nodes). I use a bitmask for the visited set to achieve 2^n states."', alternateApproaches: [{ technique: 'DFS with memoization', tradeoff: 'Top-down DP on (node, mask) tracking minimum steps. Same complexity, recursive instead of iterative.', complexity: 'O(2^n * n²) time, O(2^n * n) space' }] },

      'LC_261': { leetcode: 261,  title: 'Graph Valid Tree',                        difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/graph-valid-tree/',                        templateRefs: ['P2'],  tags: ['graph','dfs','cycle-detection','tree-validation','connected-components'], keyInsight: 'A valid tree has exactly three properties: (1) n nodes, (2) n-1 edges, (3) all connected (one component). Use DFS to detect cycles and count components. If cycle found OR multiple components: invalid tree.', shrinkTrigger: 'Build adjacency list. If edges != n-1: return false. DFS from node 0, tracking parent to avoid back-edge confusion. If back-edge (neighbor != parent) found: cycle exists, return false. After DFS, check if all n nodes visited (connected).', timeComplexity: 'O(V + E) = O(n + (n-1))', spaceComplexity: 'O(n)', gotcha: 'A back-edge in undirected graphs is an edge to an already-visited node that is NOT the parent. Must track the parent to avoid counting the edge just traversed as a back-edge. Alternatively: Union-Find detects cycles more naturally than DFS for this problem.', faangNote: 'Google 6/10, Apple 6/10. Foundation for understanding tree vs graph. Tests understanding that a tree is a connected acyclic graph. State: "A tree has n nodes and n-1 edges and is fully connected. Any cycle violates the tree structure."', alternateApproaches: [{ technique: 'Union-Find', tradeoff: 'Process edges: if both endpoints in same component before union, cycle exists. More elegant than DFS parent-tracking for cycle detection.', complexity: 'O(n * α(n)) time, O(n) space' }] },

      'LC_721': { leetcode: 721,  title: 'Accounts Merge',                          difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/accounts-merge/',                          templateRefs: ['P3'],  tags: ['graph','union-find','dfs','grouping','hybrid-pattern'], keyInsight: 'Hybrid Union-Find + DFS: group emails that belong to the same person. Union all emails in each account (assuming person ID is implicit from account index). Use Union-Find to merge email groups. Then DFS within each component to collect emails for that person. Sort emails and return with person name.', shrinkTrigger: 'parent = {email: parent_email}. For each account: union all emails together. Group emails by root parent. For each group: DFS to collect all emails in that component, sort, prepend person name, add to result.', timeComplexity: 'O((n * k) * α + (n * k) log(n * k)) where n=accounts, k=emails per account, α=inverse Ackermann', spaceComplexity: 'O(n * k)', gotcha: 'Must union ALL emails within an account before processing (not just pairs). The owner name comes from the first account with that email — track name-to-email mapping separately. Common bug: losing the owner name when grouping by email.', faangNote: 'Amazon 7/10, Meta 7/10. Canonical hybrid pattern combining Union-Find for grouping and DFS for component traversal. State: "I union emails within each account, then DFS each component to collect merged emails. The name comes from the first account contributing to that component."', alternateApproaches: [{ technique: 'pure DFS', tradeoff: 'Build email adjacency graph; DFS from each unvisited email. Same asymptotic complexity but more tedious to track which account owns which email.', complexity: 'O((n * k) log(n * k)) time, O(n * k) space' }] },

      'LC_399': { leetcode: 399,  title: 'Evaluate Division',                       difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/evaluate-division/',                       templateRefs: ['P5'],  tags: ['graph','weighted-graph','dfs','constraint-graph','division-relationships'], keyInsight: 'Model division relationships as a weighted undirected graph: a/b = c means edges a→b (weight c) and b→a (weight 1/c). Query x/y means finding a path from x to y. Multiply all edge weights along the path. If path doesn\'t exist or x or y unknown, return -1.', shrinkTrigger: 'Build graph: graph[a] = [(b, c)] where a/b = c. For each query (x, y): DFS from x to y tracking product. multiply edge weights. If path found return product; else return -1.', timeComplexity: 'O(n + q*n) where n=equations, q=queries (DFS per query)', spaceComplexity: 'O(n)', gotcha: 'Bidirectional edges with reciprocal weights: if a/b = c, also add b→a with weight 1/c. Query x/x should return 1 if x is known, -1 if x unknown. Floating-point comparison: use epsilon check or avoid it by storing fractions as (numerator, denominator) pairs.', faangNote: 'Google 8/10, Meta 7/10. Tests graph modeling of non-standard problems. The key insight: "This is not shortest-path, it\'s constraint propagation. Edges carry division ratios; paths combine them algebraically."', alternateApproaches: [{ technique: 'Union-Find with weights', tradeoff: 'Each node stores value relative to its root; union merges roots with weight adjustment. O(α(n)) per operation — more efficient but complex to implement.', complexity: 'O(n * α(n) + q * α(n)) time, O(n) space' }] },

      'LC_785': { leetcode: 785,  title: 'Is Graph Bipartite?',                      difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/is-graph-bipartite/',                      templateRefs: ['P2'],  tags: ['graph','dfs','graph-coloring','2-coloring','bipartite-checking'], keyInsight: 'A graph is bipartite if and only if it is 2-colorable — no adjacent nodes share the same color. DFS/BFS from each unvisited node: assign color 0, then alternate colors for neighbors. If a neighbor already has the same color, return false.', shrinkTrigger: 'color = [-1]*n. For each unvisited node: dfs(node, 0). dfs(node, c): color[node]=c. For each neighbor: if unvisited: dfs(neighbor, 1-c). If already visited AND color[neighbor]==color[node]: return false. If all nodes processed: return true.', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V)', gotcha: 'Disconnected components: must iterate from every unvisited node, not just start from node 0. An isolated node is trivially bipartite and needs coloring. Colors must alternate for ALL neighbors, including those in different connected components.', faangNote: 'Google 8/10, Meta 8/10. Tests understanding of graph properties beyond traversal. State: "A graph is bipartite if it is 2-colorable. I use DFS to assign alternating colors; if any conflict arises, it\'s not bipartite."', alternateApproaches: [{ technique: 'BFS with queue', tradeoff: 'Same 2-coloring logic, queue-based level-order instead of recursion. Identical complexity.', complexity: 'O(V + E) time, O(V) space' }] },

      'LC_802': { leetcode: 802,  title: 'Find Eventual Safe States',               difficulty: 'Medium', status: 'Pending', link: 'https://leetcode.com/problems/find-eventual-safe-states/',               templateRefs: ['P4'],  tags: ['graph','dfs','cycle-detection','directed-graph','safe-nodes','color-marking'], keyInsight: 'A node is "safe" if all outgoing paths eventually reach a terminal node with no outgoing edges and no cycles. DFS with 3-color marking: white (unvisited), gray (in-progress), black (safe or unsafe determined). If gray node revisits gray node: cycle detected, mark unsafe. Return all nodes marked black AND safe.', shrinkTrigger: 'color=[0]*n. For each node: if not visited: dfs(node). dfs(node): if color[node]==1 (gray): return false (cycle). color[node]=1 (gray). For each neighbor: if not dfs(neighbor): return false. color[node]=2 (black, safe). Return true. Return indices where color[i]==2.', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V)', gotcha: 'Gray (1) = currently in DFS stack (in-progress). Black (2) = fully explored and safe. Back-edge to gray = cycle = unsafe. Nodes must visit ALL outgoing nodes; a single cycle path makes the node unsafe. A terminal node (out-degree 0) is always safe.', faangNote: 'Amazon 7/10, Google 7/10. Advanced cycle detection in directed graphs. State: "I use 3-color DFS: white=unvisited, gray=in-progress, black=complete and safe. A back-edge to gray detects cycles; any cycled nodes are unsafe."', alternateApproaches: [{ technique: 'reverse graph + topological sort', tradeoff: 'Reverse edges, find terminal nodes (in-degree 0), do reverse topological sort. Works but less intuitive than 3-color DFS.', complexity: 'O(V + E) time, O(V) space' }] },

      'LC_1584': { leetcode: 1584, title: 'Min Cost to Connect All Points',         difficulty: 'Hard',   status: 'Pending', link: 'https://leetcode.com/problems/min-cost-to-connect-all-points/',         templateRefs: ['P8'],  tags: ['graph','mst','minimum-spanning-tree','kruskal','union-find','geometry','euclidean-distance'], keyInsight: 'Minimum Spanning Tree (MST) on a complete graph where edge weights are Euclidean distances between points. Use Kruskal\'s algorithm: sort all edges by weight, union-find to detect cycles, greedily add edges that don\'t form cycles. Alternative: Prim\'s algorithm with min-heap starting from any point.', shrinkTrigger: 'Build edge list: for all pairs (i,j): distance = |x[i]-x[j]| + |y[i]-y[j]|. Sort edges by distance. parent=[0..n-1]. For each edge: if find(u)!=find(v): add to MST, union(u,v), cost += edge_weight. Return total cost.', timeComplexity: 'O(n² log n) for sorting all O(n²) edges', spaceComplexity: 'O(n²) for edge list', gotcha: 'Distance metric is Manhattan distance (|dx| + |dy|), not Euclidean. All n(n-1)/2 pairs must be considered initially; Kruskal\'s then selects n-1 of them. Union-Find determines which edges to skip (cycles). Time bottleneck is sorting, not the union-find operations.', faangNote: 'Google 7/10, Amazon 7/10. MST is table-stakes at every tech company. State upfront: "I model this as MST on a complete graph with Manhattan distances. Kruskal\'s with Union-Find: sort edges, greedily add non-cycle edges."', alternateApproaches: [{ technique: 'Prim\'s algorithm', tradeoff: 'Start from any point, maintain min-heap of edges from visited nodes. O(n² log n) same complexity but different implementation. Often used when graph is sparse or already given as adjacency list.', complexity: 'O(n² log n) time, O(n²) space' }] },

      'GFG_CYCLE_UNDIRECTED': { leetcode: null, title: 'Detect Cycle in Undirected Graph (GFG)',  difficulty: 'Easy',   status: 'Pending', link: 'https://www.geeksforgeeks.org/detect-cycle-undirected-graph/',  templateRefs: ['P9'],  tags: ['graph','dfs','cycle-detection','undirected-cycle','back-edge'], keyInsight: 'DFS from each unvisited node. Track visited status and parent. If we reach a visited node that is NOT the parent, a back-edge exists — cycle detected. Union-Find alternative: if both endpoints already in same component, the edge creates a cycle.', shrinkTrigger: 'visited[node]=true. For each neighbor: if neighbor==parent: skip (not a back-edge). Else if visited[neighbor]: return true (back-edge). Else: recurse. For all starting nodes, if any recurse returns true, graph has a cycle.', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V)', gotcha: 'Critical: skip the parent node check. If you don\'t skip parent, every undirected edge is traversed twice and falsely reports cycles. For undirected, an edge (u,v) creates two entries in adjacency: u→v and v→u; when DFS visits v from u, don\'t count the u→v back as a cycle — that\'s the edge we came from.', faangNote: 'GFG Cycle Detection (Undirected). Foundational problem. Amazon 6/10, Google 6/10. Always mention: "I use DFS with parent tracking to distinguish back-edges from tree edges. Back-edges to non-parent nodes indicate a cycle." Union-Find is equally valid.', alternateApproaches: [{ technique: 'Union-Find', tradeoff: 'For each edge (u,v): if find(u)==find(v), cycle detected. O(V + E * α(V)). DFS is slightly faster in practice and more intuitive for cycle detection specifically.', complexity: 'O((V + E) * α(V)) time, O(V) space' }] },

      'GFG_CYCLE_DIRECTED': { leetcode: null, title: 'Detect Cycle in Directed Graph (GFG)', difficulty: 'Easy',   status: 'Pending', link: 'https://www.geeksforgeeks.org/detect-cycle-in-a-graph/', templateRefs: ['P9'],  tags: ['graph','dfs','cycle-detection','directed-cycle','dfs-coloring','white-gray-black'], keyInsight: '3-color DFS marking: white (unvisited), gray (in-progress/in stack), black (finished). If we encounter a gray node during DFS, it means we\'ve found a back-edge to an ancestor in the current DFS path — cycle exists. Back-edge in directed graph → cycle. Forward/cross edges → no cycle.', shrinkTrigger: 'color[node]=gray. For each neighbor: if color[neighbor]==gray: return true (back-edge, cycle). Else if color[neighbor]==white: if recurse returns true: return true. After loop: color[node]=black. Return false.', timeComplexity: 'O(V + E)', spaceComplexity: 'O(V)', gotcha: 'Only GRAY nodes indicate a cycle — a back-edge to a gray (in-stack) node. Forward edges to BLACK nodes and cross edges are legal in DAGs. Confusing gray/black is the #1 bug. Mark node gray BEFORE recursing neighbors (not after).', faangNote: 'GFG Cycle Detection (Directed). Topological sort alternates (LC_207, LC_210 both detect DAG cycles). Amazon 7/10, Google 7/10. State: "I use 3-color DFS: white=unvisited, gray=in-progress, black=done. A back-edge to a gray node indicates a cycle. Only back-edges create cycles; forward and cross edges are acyclic."', alternateApproaches: [{ technique: 'Khan\'s Algorithm (Topological Sort)', tradeoff: 'Compute in-degrees; queue nodes with in-degree 0; dequeue and reduce neighbors\' in-degrees. If final count < V, there\'s a cycle. O(V+E) same complexity. Some prefer it for DAG problems where topological order is also needed.', complexity: 'O(V + E) time, O(V) space' }] }
    }
  }
}
/* ═══ END DATA.JS ═══════════════════════════════════════════════════════════ */