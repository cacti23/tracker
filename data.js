// ...existing code continues (removed invalid character line)...
// ─── data.js ─────────────────────────────────────────────────────────────────
// DSA Notebook — question data, topic modules, and progress storage.
//
// AI INSTRUCTIONS FOR THIS FILE:
// - This file contains ONLY data and data-access helpers. No rendering logic.
// - To add a new topic: append to TOPICS array + TOPIC_MODULES object at the bottom.
// - To add a question: add to the relevant module's questions: {} object.
// - Module schema is documented in the MODULE SCHEMA comment block below.
// - Do NOT add rendering functions, DOM manipulation, or event handlers here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── MASTER DATA REGISTRY ────────────────────────────────────────────────────
// Each topic module is self-contained. Add new topic modules to TOPIC_MODULES.
// TOPICS drives the sidebar and dashboard; each entry's key maps to a module.

const TOPICS = [
  { key: 'sliding-window', icon: '🪟', label: 'Sliding Window' },
  { key: 'two-pointers',   icon: '👉', label: 'Two Pointers'  },
  { key: 'binary-search',  icon: '🔍', label: 'Binary Search'  },
  { key: 'sorting',        icon: '🔃', label: 'Sorting'        },
  { key: 'heap',           icon: '🏔️', label: 'Heap / Priority Queue' },
]

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
const NOTES_KEY = 'dsa-notes-v1'
function getNote(lcKey) {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}')[lcKey] || '' } catch { return '' }
}
function setNote(lcKey, text) {
  try {
    const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}')
    if (text.trim()) notes[lcKey] = text; else delete notes[lcKey]
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {}
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
//                     avoid — traps that look like this pattern but aren't,
//                             with what to use instead
//  interviewTips    : string[] — bullet tips in "Interview Tips" collapsible
//  decisionTree     : { description: string, node: TreeNode }
//    TreeNode: { id, question, yes: Branch, no: Branch }
//    Branch  : { node: TreeNode } | { leaf: TreeLeaf }
//    TreeLeaf: { id, pattern, template, label, exampleProblems? }
//  templates : Array<{ id, name, description, code: string (plain JS, no TS generics) }>
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
    goal: 'Cover 90% of FAANG Sliding Window questions by mastering 4 patterns, 7 templates, and 17 curated problems',
    relatedTopics: ['two-pointers', 'binary-search'],

    tagRegistry: [
      'sliding-window','fixed-window','variable-window','array','string','binary-array',
      'freq-map','hash-map','anagram','counting','exactly-k','deque','monotonic-deque',
      'prefix-sum','negative-numbers','reduction','two-pointers','binary-search'
    ],

    techniqueRegistry: [
      'sliding-window','two-pointers','prefix-sum','binary-search','hash-map','monotonic-deque'
    ],

    interviewTips: [
      "Before writing any code, say your invariant aloud: 'My window is valid when X. I shrink when Y.' If you cannot complete that sentence, you do not have the solution yet. Interviewers score invariant clarity independently.",
      "LC_76 (Minimum Window Substring) is the single most-tested Hard at Meta, Google, Amazon, and Apple. Critical trap: use need.size for `required`, NOT t.length. If t = 'aa', required = 1 not 2 — this single mistake fails the problem.",
      "LC_239 (Sliding Window Maximum) ends candidates who fumble it. In JavaScript, Array.shift() is O(n) — use an index-based head pointer for true O(n). Mention this unprompted before you start coding.",
      "Exactly-K subarrays require a reduction: count(exactly K) = atMost(K) − atMost(K−1). Direct exactly-K sliding window breaks because the window is not monotonically valid. This reduction appears in ~30% of Google and Meta sliding window rounds.",
      "Negative numbers + subarray sum/min/max → stop immediately. Standard sliding window breaks because shrinking no longer monotonically reduces the tracked value. Say: 'Negatives break the shrink invariant — I use prefix sums with a monotonic deque.' LC_862 is the template.",
      "Reformulation = SDE3 signal. LC_1658: min(prefix+suffix summing to X) ≡ max(subarray summing to totalSum−X). Draw the reformulation on the board first — interviewers score the insight separately from the code.",
      "When a question lists alternateApproaches, name the inferior approach and explain why you chose sliding window. This signals breadth over pattern memorisation."
    ],

    whenToUse: {
      use: [
        'Problem involves a CONTIGUOUS subarray or substring — non-contiguous rules out sliding window immediately.',
        'Brute force requires nested loops O(n²) or O(n³) scanning all subarrays — sliding window collapses this to O(n).',
        'The validity condition is MONOTONIC: if a window of size k is invalid, all windows larger than k are also invalid (or vice versa). This monotonicity is what makes shrinking correct.',
        'Keywords in the problem: "longest/shortest subarray", "minimum/maximum window", "find all subarrays where X", "at most K distinct", "exactly K occurrences".',
        'Fixed window size K is stated explicitly — always fixed window (T1/T2). Variable constraints like "at most K" or "sum >= target" — variable window (T3/T4).'
      ],
      avoid: [
        'Array contains NEGATIVE numbers and you need subarray sum/min/max → sliding window breaks. Use Prefix Sum + Monotonic Deque (LC_862 pattern) instead.',
        'Problem asks for NON-CONTIGUOUS elements (subsequences, subsets) → sliding window cannot skip elements. Use DP or two pointers.',
        'You cannot define a clear SHRINK TRIGGER — if you cannot say "I shrink when X", sliding window is wrong. Re-examine whether the condition is monotonic.',
        'Problem asks to COUNT subarrays with EXACTLY K of something directly → direct sliding window breaks. Reduce to atMost(K) - atMost(K-1) first, then apply T5.',
        'Input is a LINKED LIST — sliding window requires index access. Use fast/slow pointers instead.'
      ]
    },

    decisionTree: {
      description: 'Walk this tree top-to-bottom before writing any code. Identify the pattern, then pick the template.',
      node: {
        id: 'root',
        question: 'Is the window size explicitly fixed as K?',
        yes: {
          node: {
            id: 'fixed-freq-check',
            question: 'Does correctness require matching character or element frequencies?',
            yes: { leaf: { id: 'leaf-p1-t2', pattern: 'P1', template: 'T2', label: 'Fixed Window — Frequency Matching', exampleProblems: ['LC_567', 'LC_438'] } },
            no:  { leaf: { id: 'leaf-p1-t1', pattern: 'P1', template: 'T1', label: 'Fixed Window — Basic',              exampleProblems: ['LC_643', 'LC_1456'] } }
          }
        },
        no: {
          node: {
            id: 'counting-check',
            question: 'Are you COUNTING the number of valid subarrays (not finding a max or min length)?',
            yes: {
              node: {
                id: 'exactly-k-check',
                question: 'Is the predicate EXACTLY K occurrences of something?',
                yes: { leaf: { id: 'leaf-p3-t5-exact',   pattern: 'P3', template: 'T5', label: 'Exactly K → atMost(K) - atMost(K-1)',   exampleProblems: ['LC_930', 'LC_992']  } },
                no:  { leaf: { id: 'leaf-p3-t5-atmost',  pattern: 'P3', template: 'T5', label: 'Count with atMost(K) variant',           exampleProblems: ['LC_930', 'LC_992']  } }
              }
            },
            no: {
              node: {
                id: 'negative-check',
                question: 'Does the array contain NEGATIVE numbers?',
                yes: { leaf: { id: 'leaf-p4-t6-prefix', pattern: 'P4', template: 'T6', label: 'Prefix Sum + Monotonic Deque — standard sliding window BREAKS with negatives', exampleProblems: ['LC_862'] } },
                no: {
                  node: {
                    id: 'window-minmax-check',
                    question: 'Do you need window MAX or MIN at every position in O(n)?',
                    yes: {
                      node: {
                        id: 'two-deque-check',
                        question: 'Do you need both window MAX and MIN simultaneously?',
                        yes: { leaf: { id: 'leaf-p4-t7',        pattern: 'P4', template: 'T7', label: 'Two Monotonic Deques',    exampleProblems: ['LC_1438'] } },
                        no:  { leaf: { id: 'leaf-p4-t6-single', pattern: 'P4', template: 'T6', label: 'Single Monotonic Deque', exampleProblems: ['LC_239']  } }
                      }
                    },
                    no: {
                      node: {
                        id: 'maximize-check',
                        question: 'Are you finding LONGEST or MAXIMUM window length?',
                        yes: { leaf: { id: 'leaf-p2-t3', pattern: 'P2', template: 'T3', label: 'Variable Window — Expand always, shrink when VIOLATED', exampleProblems: ['LC_3', 'LC_1004', 'LC_424', 'LC_904'] } },
                        no: {
                          node: {
                            id: 'minimize-check',
                            question: 'Are you finding SHORTEST or MINIMUM window length?',
                            yes: {
                              node: {
                                id: 'both-ends-check',
                                question: 'Does the problem involve picking from BOTH ENDS of the array?',
                                yes: { leaf: { id: 'leaf-p3-reduction', pattern: 'P3', template: 'T3', label: 'Reduction — reframe both-ends as middle subarray, then apply P2', exampleProblems: ['LC_1658'] } },
                                no:  { leaf: { id: 'leaf-p3-t4',        pattern: 'P3', template: 'T4', label: 'Variable Window — Expand until VALID, shrink while VALID',          exampleProblems: ['LC_209', 'LC_76'] } }
                              }
                            },
                            no: { leaf: { id: 'leaf-unknown', pattern: null, template: null, label: 'Non-obvious reduction needed. Try: (1) both-ends → middle subarray, (2) prefix sum reformulation. See LC_1658 (Minimum Operations to Reduce X to Zero) as the canonical example.' } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    templates: [
      {
        id: 'T1', name: 'Basic Fixed Window',
        description: 'Window size is always exactly K. Initialize the first window, then slide by adding the incoming right element and removing the outgoing left element (K positions back). Capture the answer on every iteration.',
        code: 'function fixedWindowBasic(nums, k) {\n  let windowSum = 0;\n  for (let i = 0; i < k; i++) windowSum += nums[i];\n  let result = windowSum;\n\n  for (let i = k; i < nums.length; i++) {\n    windowSum += nums[i];        // add incoming right element\n    windowSum -= nums[i - k];    // remove outgoing left element\n    result = Math.max(result, windowSum);\n  }\n  return result;\n}'
      },
      {
        id: 'T2', name: 'Fixed Window — Frequency Matching',
        description: "Fixed window of size len(pattern). A 'matches' counter tracks how many of the 26 characters have their frequency in the window exactly satisfying the required frequency. Window is a valid anagram when matches === 26. Update matches symmetrically on both right-add and left-remove.",
        code: 'function fixedWindowFrequency(s, p) {\n  if (p.length > s.length) return [];\n\n  const pCount = new Array(26).fill(0);\n  const sCount = new Array(26).fill(0);\n  const a = \'a\'.charCodeAt(0);\n\n  for (const c of p) pCount[c.charCodeAt(0) - a]++;\n\n  let matches = pCount.filter((v, i) => v === sCount[i]).length;\n  const result = [];\n\n  for (let i = 0; i < s.length; i++) {\n    const rc = s.charCodeAt(i) - a;\n    sCount[rc]++;\n    if (sCount[rc] === pCount[rc])          matches++;\n    else if (sCount[rc] === pCount[rc] + 1) matches--;\n\n    if (i >= p.length) {\n      const lc = s.charCodeAt(i - p.length) - a;\n      sCount[lc]--;\n      if (sCount[lc] === pCount[lc])          matches++;\n      else if (sCount[lc] === pCount[lc] - 1) matches--;\n    }\n\n    if (matches === 26) result.push(i - p.length + 1);\n  }\n  return result;\n}'
      },
      {
        id: 'T3', name: 'Variable Window — Maximize / Longest',
        description: 'Expand right on every iteration without condition. Shrink left ONLY when the invariant is VIOLATED. After the shrink loop exits the window is always valid — capture max length there. The entire problem reduces to answering one question: what constitutes a violation?',
        code: 'function variableWindowMaximize(nums, k) {\n  let left = 0;\n  let result = 0;\n  const freq = new Map();\n\n  for (let right = 0; right < nums.length; right++) {\n    freq.set(nums[right], (freq.get(nums[right]) ?? 0) + 1);\n\n    while (freq.size > k /* replace with your violation condition */) {\n      freq.set(nums[left], freq.get(nums[left]) - 1);\n      if (freq.get(nums[left]) === 0) freq.delete(nums[left]);\n      left++;\n    }\n\n    result = Math.max(result, right - left + 1);\n  }\n  return result;\n}'
      },
      {
        id: 'T4', name: 'Variable Window — Minimize / Shortest',
        description: 'Expand right until the window becomes VALID. Then shrink left AS LONG AS the window stays VALID, recording the minimum at each valid state. Then expand again. This is the INVERSE loop logic from T3: T3 shrinks when violated, T4 shrinks while valid.',
        code: 'function variableWindowMinimize(nums, target) {\n  let left = 0;\n  let windowSum = 0;\n  let result = Infinity;\n\n  for (let right = 0; right < nums.length; right++) {\n    windowSum += nums[right];\n\n    while (windowSum >= target /* replace with your valid condition */) {\n      result = Math.min(result, right - left + 1);\n      windowSum -= nums[left];\n      left++;\n    }\n  }\n\n  return result === Infinity ? 0 : result;\n}'
      },
      {
        id: 'T5', name: 'atMost(K) for Counting — exactlyK = atMostK(k) - atMostK(k-1)',
        description: "count(exactly K) = count(atMost K) - count(atMost K-1). atMostK uses T3 mechanics but accumulates a count instead of tracking max length. The line 'result += right - left + 1' counts all valid subarrays ending at right.",
        code: 'function atMostK(nums, k) {\n  if (k < 0) return 0;\n\n  let left = 0;\n  let result = 0;\n  const freq = new Map();\n\n  for (let right = 0; right < nums.length; right++) {\n    freq.set(nums[right], (freq.get(nums[right]) ?? 0) + 1);\n\n    while (freq.size > k) {\n      freq.set(nums[left], freq.get(nums[left]) - 1);\n      if (freq.get(nums[left]) === 0) freq.delete(nums[left]);\n      left++;\n    }\n\n    result += right - left + 1;\n  }\n  return result;\n}\n\nfunction exactlyK(nums, k) {\n  return atMostK(nums, k) - atMostK(nums, k - 1);\n}'
      },
      {
        id: 'T6', name: 'Monotonic Deque — Single (Window Maximum or Prefix Sum variant)',
        description: 'Deque stores INDICES. Values at those indices are in DECREASING order so the front is always the current window maximum. On each new element: evict stale indices from the front; evict dominated (smaller) indices from the back; push current index; emit front when window is formed.',
        code: 'function slidingWindowMaximum(nums, k) {\n  const dq = [];\n  const result = [];\n\n  for (let i = 0; i < nums.length; i++) {\n    while (dq.length > 0 && dq[0] < i - k + 1) dq.shift();\n    while (dq.length > 0 && nums[dq[dq.length - 1]] < nums[i]) dq.pop();\n    dq.push(i);\n    if (i >= k - 1) result.push(nums[dq[0]]);\n  }\n  return result;\n}'
      },
      {
        id: 'T7', name: 'Monotonic Deque — Double (Simultaneous Window Max + Min)',
        description: 'Two deques in parallel: maxDq (decreasing values, front = max) and minDq (increasing values, front = min). Shrink left when the constraint on max - min is violated. On left increment, check both deque fronts independently.',
        code: 'function longestSubarrayWithLimit(nums, limit) {\n  const maxDq = [];\n  const minDq = [];\n  let left = 0;\n  let result = 0;\n\n  for (let right = 0; right < nums.length; right++) {\n    while (maxDq.length > 0 && nums[maxDq[maxDq.length - 1]] <= nums[right]) maxDq.pop();\n    maxDq.push(right);\n\n    while (minDq.length > 0 && nums[minDq[minDq.length - 1]] >= nums[right]) minDq.pop();\n    minDq.push(right);\n\n    while (nums[maxDq[0]] - nums[minDq[0]] > limit) {\n      left++;\n      if (maxDq[0] < left) maxDq.shift();\n      if (minDq[0] < left) minDq.shift();\n    }\n\n    result = Math.max(result, right - left + 1);\n  }\n  return result;\n}'
      }
    ],

    patterns: [
      {
        id: 'P1', name: 'Fixed Size Window',
        recognitionSignals: [
          'Window size K is explicitly given in the problem',
          'Subarray or substring of length exactly K',
          'Every consecutive K elements must be evaluated'
        ],
        mentalModel: 'Window size never changes. Initialize first window of size K. Slide: add right element, remove element K positions back, update answer.',
        questionIds: ['LC_643', 'LC_1456', 'LC_567', 'LC_438']
      },
      {
        id: 'P2', name: 'Variable Window — Maximize / Longest',
        recognitionSignals: [
          'Longest subarray or substring SUCH THAT a condition holds',
          'Maximum length WHERE some property holds',
          'A smaller window is always valid if a larger one is — the condition is monotonic'
        ],
        mentalModel: 'EXPAND right on every iteration without condition. SHRINK left ONLY when the invariant is VIOLATED. After shrink loop exits the window is always valid — capture max length there.',
        keyQuestion: 'What constitutes a violation? Answer that and you have the full solution.',
        questionIds: ['LC_3', 'LC_1004', 'LC_1493', 'LC_424', 'LC_904']
      },
      {
        id: 'P3', name: 'Variable Window — Minimize / Shortest / Count Exactly K',
        recognitionSignals: [
          'Minimum length subarray or substring such that a condition holds',
          'Smallest window containing all of something',
          'COUNT the number of subarrays where something occurs EXACTLY K times'
        ],
        mentalModel: 'Two sub-modes: minimize uses inverse shrink logic from P2; exactly-K counting uses atMost(K) - atMost(K-1) transformation.',
        questionIds: ['LC_209', 'LC_76', 'LC_930', 'LC_992', 'LC_1658']
      },
      {
        id: 'P4', name: 'Deque-based Sliding Window',
        recognitionSignals: [
          'Maximum or minimum of every window of size K needed in O(n)',
          'Array contains NEGATIVE numbers with a subarray sum or length constraint',
          'Standard sliding window breaks because shrinking does not monotonically change the tracked value'
        ],
        mentalModel: 'Deque stores INDICES, not values. The ordering invariant on values at those indices guarantees the front is always the window answer. Evict stale indices from front. Evict dominated indices from back.',
        questionIds: ['LC_239', 'LC_1438', 'LC_862']
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
      'LC_862':  { leetcode: 862,  title: 'Shortest Subarray with Sum at Least K',                 difficulty: 'Hard',   status: 'Pending', templateRefs: ['T6'], tags: ['sliding-window','deque','monotonic-deque','prefix-sum','array','negative-numbers'], keyInsight: 'Negative numbers break standard sliding window. Use prefix sums with a monotonically increasing deque of prefix-sum indices.', shrinkTrigger: 'prefix[right] - prefix[dq[0]] >= k — pop from front while this holds', timeComplexity: 'O(n)', spaceComplexity: 'O(n)', gotcha: 'Prefix sum array has n+1 elements: prefix[0]=0. Off-by-one in sizing is the most common bug.', faangNote: "Say immediately: 'Standard sliding window breaks with negatives. I will use prefix sums with a monotonic deque.'", alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary search on prefix sums gives O(n log n). Deque is strictly O(n).', complexity: 'O(n log n) time, O(n) space' }], link: 'https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/' }
    }
  }
  ,
  'two-pointers': {
    description: 'A technique using two index pointers moving through a data structure to reduce O(n²) brute-force pair/triplet search to O(n) or O(n²) for k-sum. Applicable when the problem involves pairs, in-place modification, partitioning, or linked list traversal where relative pointer speed matters.',
    goal: 'Cover 90% of FAANG Two Pointers questions by mastering 5 patterns, 6 templates, and 20 curated problems',
    relatedTopics: ['sliding-window', 'binary-search'],

    tagRegistry: [
      'two-pointers','converging','fast-slow','write-pointer','three-way-partition',
      'k-sum','array','string','linked-list','sorted-array','freq-map','hash-set',
      'greedy','in-place','merge','partition','prefix-sum','monotonic-stack','dynamic-programming'
    ],

    techniqueRegistry: [
      'two-pointers','sliding-window','prefix-sum','binary-search','hash-map','hash-set','monotonic-stack','sorting'
    ],

    interviewTips: [
      'Before moving a pointer, verbalize WHY the discarded position can never be optimal. That one-sentence proof IS the answer — code follows mechanically. Interviewers score the justification independently of correctness.',
      'LC_42 (Trapping Rain Water): know all three solutions — two pointers O(1) space, prefix-max arrays O(n), monotonic stack O(n). Interviewers always follow up asking for O(1) space after you describe O(n). Lead with O(1).',
      'LC_15 (3Sum): three distinct duplicate-skip guards — outer loop skip, left skip after match, right skip after match. Missing any one produces duplicate triplets. Practice until all three are reflex, not recall.',
      'LC_234 (Palindrome Linked List): offer to restore the second half after checking — unprompted. This is the SDE3 signal that you think about mutation side-effects without being asked.',
      'LC_141 (Linked List Cycle): the expected follow-up is LC_142 — find the cycle ENTRY point, not just detect it. Mention this unprompted if time allows.',
      "Dutch National Flag (T5): asymmetric rule — after swap with high, do NOT advance mid (value just received is unknown); after swap with low, DO advance mid (all values in the low region were already processed). State this rule before writing the loop.",
      'When alternateApproaches lists a hash-set solution, name it and say: "Two pointers achieves the same result in O(1) space given sorted input — that is the trade-off." This shows you chose the approach, not guessed.'
    ],

    whenToUse: {
      use: [
        'Array or string is SORTED (or can be sorted without losing information) and you need pairs/triplets summing to a target — converging pointers replace the O(n²) nested loop.',
        'Problem involves IN-PLACE array modification: removing duplicates, moving elements, partitioning — write pointer pattern eliminates extra space.',
        'Input is a LINKED LIST and you need cycle detection, finding the middle, or checking palindrome — fast/slow pointers are the only O(1) space solution.',
        'Problem involves comparing elements from BOTH ENDS simultaneously — converging pointers are natural.',
        'You need to reduce kSum (3Sum, 4Sum) to a lower dimension — sort + fix outer elements + two-pointer inner loop is always O(n^(k-1)).'
      ],
      avoid: [
        'Array is UNSORTED and sorting would change the answer (e.g. subarray problems where position matters) → two pointers require sorted input or monotonic properties. Use sliding window or prefix sum.',
        'You need ALL pairs, not just existence — two pointers find one optimal pair per outer iteration. If you need counts of ALL valid pairs, use hash map instead.',
        'Problem requires NON-CONTIGUOUS selection (pick any elements, not adjacent) → two pointers only work on contiguous ranges. Use DP or greedy.',
        'Array contains DUPLICATES and you need all unique results — two pointers work but require careful skip logic at every pointer level. If skip logic becomes complex, hash set may be cleaner.',
        'Linked list problem needs random access (find kth from end efficiently with indexing) → fast/slow works but count+iterate is simpler. Fast/slow is specifically for cycle/middle/palindrome patterns.'
      ]
    },
    decisionTree: {
      description: 'Walk this tree before writing any code. Two pointers has five distinct sub-patterns — choosing the wrong one produces O(n²) or worse.',
      node: {
        id: 'root',
        question: 'Is the input a Linked List?',
        yes: {
          node: {
            id: 'll-type-check',
            question: 'Is the goal cycle detection or finding the middle node?',
            yes: { leaf: { id: 'leaf-p2-t3-basic',    pattern: 'P2', template: 'T3', label: 'Fast & Slow Pointers — cycle detection or middle',            exampleProblems: ['LC_141', 'LC_876'] } },
            no:  { leaf: { id: 'leaf-p2-t3-reversal', pattern: 'P2', template: 'T3', label: 'Fast & Slow Pointers + in-place reversal of second half',     exampleProblems: ['LC_234']           } }
          }
        },
        no: {
          node: {
            id: 'inplace-check',
            question: 'Is the goal to MODIFY the array IN-PLACE (remove, move, filter, merge)?',
            yes: {
              node: {
                id: 'merge-check',
                question: 'Are you merging two sorted sequences where one has extra space at the end?',
                yes: { leaf: { id: 'leaf-p3-t4-end',   pattern: 'P3', template: 'T4', label: 'Write Pointer from END — prevents overwriting unread elements',                               exampleProblems: ['LC_88']            } },
                no:  { leaf: { id: 'leaf-p3-t4-front', pattern: 'P3', template: 'T4', label: 'Write Pointer from FRONT — read pointer scans, write pointer places kept elements',           exampleProblems: ['LC_26', 'LC_283']  } }
              }
            },
            no: {
              node: {
                id: 'partition-check',
                question: 'Does the problem require partitioning into 3 or more categories in a SINGLE PASS?',
                yes: { leaf: { id: 'leaf-p5-t5', pattern: 'P5', template: 'T5', label: 'Three-Way Partition — Dutch National Flag (low / mid / high pointers)', exampleProblems: ['LC_75'] } },
                no: {
                  node: {
                    id: 'sorted-check',
                    question: 'Is the array SORTED, or does sorting help without losing required information?',
                    yes: {
                      node: {
                        id: 'ksum-check',
                        question: 'Are you finding k numbers (pairs, triplets, quadruplets) that sum to a target?',
                        yes: { leaf: { id: 'leaf-p4-t6', pattern: 'P4', template: 'T6', label: 'k-Sum Reduction — fix outer loop(s), converge inner two pointers', exampleProblems: ['LC_15', 'LC_16'] } },
                        no: {
                          node: {
                            id: 'skip-check',
                            question: 'Does traversal require skipping characters or elements based on a condition?',
                            yes: { leaf: { id: 'leaf-p1-t2', pattern: 'P1', template: 'T2', label: 'Converging with Skip — inner while loops advance past invalid characters', exampleProblems: ['LC_125', 'LC_680'] } },
                            no:  { leaf: { id: 'leaf-p1-t1', pattern: 'P1', template: 'T1', label: 'Basic Converging — move left or right based on comparison with target',   exampleProblems: ['LC_167', 'LC_11', 'LC_977', 'LC_42'] } }
                          }
                        }
                      }
                    },
                    no: { leaf: { id: 'leaf-unsorted', pattern: null, template: null, label: 'Unsorted, non-linked-list, non-partition problem — two pointers may not apply directly. Consider sorting first (check if sort is allowed), or rethink as sliding-window or prefix-sum.' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    templates: [
      {
        id: 'T1', name: 'Converging Two Pointers — Basic (Sorted Array)',
        description: "Left starts at 0, right starts at end. Move left right when current value is too small; move right left when too large. Terminates when left meets right. Requires sorted input or a monotonic comparison property. The decision of which pointer to move is the core insight for each problem.",
        code: 'function convergingBasic(nums, target) {\n  let left = 0;\n  let right = nums.length - 1;\n\n  while (left < right) {\n    const current = nums[left] + nums[right]; // replace with your evaluation\n\n    if (current === target) {\n      return [left, right];\n    } else if (current < target) {\n      left++;  // need larger — move left right\n    } else {\n      right--; // need smaller — move right left\n    }\n  }\n  return [-1, -1];\n}'
      },
      {
        id: 'T2', name: 'Converging Two Pointers — With Skip Conditions (String)',
        description: "Same structure as T1 but with inner while loops that advance each pointer past invalid characters before the comparison. For problems allowing ONE deletion on mismatch (LC_680 - Valid Palindrome II), call a helper that runs T2 on a substring when a mismatch is first detected.",
        code: 'function isAlphanumeric(c) {\n  return /[a-zA-Z0-9]/.test(c);\n}\n\nfunction convergingWithSkip(s) {\n  let left = 0;\n  let right = s.length - 1;\n\n  while (left < right) {\n    while (left < right && !isAlphanumeric(s[left]))  left++;\n    while (left < right && !isAlphanumeric(s[right])) right--;\n\n    if (s[left].toLowerCase() !== s[right].toLowerCase()) return false;\n    left++;\n    right--;\n  }\n  return true;\n}\n\nfunction isPalindromeRange(s, l, r) {\n  while (l < r) {\n    if (s[l] !== s[r]) return false;\n    l++; r--;\n  }\n  return true;\n}\n\nfunction validPalindromeII(s) {\n  let left = 0;\n  let right = s.length - 1;\n  while (left < right) {\n    if (s[left] !== s[right]) {\n      return isPalindromeRange(s, left + 1, right) ||\n             isPalindromeRange(s, left, right - 1);\n    }\n    left++; right--;\n  }\n  return true;\n}'
      },
      {
        id: 'T3', name: "Fast & Slow Pointers (Floyd's Algorithm)",
        description: "Both pointers start at head. Slow advances 1 step; fast advances 2 steps. If a cycle exists, fast will lap slow and they meet. For finding the middle: when fast reaches null (or fast.next reaches null), slow is at mid. For even-length lists this returns the SECOND middle.",
        code: '// Variant A — Cycle Detection\nfunction hasCycle(head) {\n  let slow = head;\n  let fast = head;\n\n  while (fast !== null && fast.next !== null) {\n    slow = slow.next;\n    fast = fast.next.next;\n    if (slow === fast) return true;\n  }\n  return false;\n}\n\n// Variant B — Find Middle Node\nfunction findMiddle(head) {\n  let slow = head;\n  let fast = head;\n\n  while (fast !== null && fast.next !== null) {\n    slow = slow.next;\n    fast = fast.next.next;\n  }\n  return slow;\n}'
      },
      {
        id: 'T4', name: 'Write Pointer — Same Direction (In-Place Modification)',
        description: "Two pointers both start at the same end. 'read' scans every element; 'write' marks the next position to place a valid (kept) element. For merging from end (LC_88): start read pointers at the back of each array and the write pointer at the very end — this prevents overwriting unread input.",
        code: '// Variant A — Filter in-place (remove duplicates, move zeroes)\nfunction writePointerFilter(nums) {\n  let write = 0;\n\n  for (let read = 0; read < nums.length; read++) {\n    if (nums[read] !== 0 /* replace with KEEP condition */) {\n      nums[write] = nums[read];\n      write++;\n    }\n  }\n  return write;\n}\n\n// Variant B — Merge from end (LC_88)\nfunction mergeSortedFromEnd(nums1, m, nums2, n) {\n  let i = m - 1;\n  let j = n - 1;\n  let write = m + n - 1;\n\n  while (i >= 0 && j >= 0) {\n    if (nums1[i] >= nums2[j]) {\n      nums1[write--] = nums1[i--];\n    } else {\n      nums1[write--] = nums2[j--];\n    }\n  }\n  while (j >= 0) nums1[write--] = nums2[j--];\n}'
      },
      {
        id: 'T5', name: 'Three-Way Partition — Dutch National Flag',
        description: "Three pointers: 'low' is the right boundary of the 0-region; 'mid' is the current element; 'high' is the left boundary of the 2-region. After swapping mid with high, do NOT increment mid — the value that came from high is unknown. After swapping mid with low, it IS safe to increment mid.",
        code: 'function dutchNationalFlag(nums) {\n  let low = 0;\n  let mid = 0;\n  let high = nums.length - 1;\n\n  while (mid <= high) {\n    if (nums[mid] === 0) {\n      [nums[low], nums[mid]] = [nums[mid], nums[low]];\n      low++;\n      mid++; // safe — swapped value is known to be 1\n    } else if (nums[mid] === 1) {\n      mid++;\n    } else {\n      [nums[mid], nums[high]] = [nums[high], nums[mid]];\n      high--;\n      // DO NOT increment mid — must re-examine the swapped value\n    }\n  }\n}'
      },
      {
        id: 'T6', name: 'k-Sum Reduction (Fix Outer, Converge Inner)',
        description: "Sort the array first. Fix (k-2) outer pointers with nested for loops; apply converging two pointers on the remaining subarray. Duplicate skipping is required at ALL pointer levels. The outer loop skips when nums[i] === nums[i-1] (and i > start). After finding a valid k-tuple, both inner pointers skip past their duplicates.",
        code: 'function threeSum(nums) {\n  nums.sort((a, b) => a - b);\n  const result = [];\n\n  for (let i = 0; i < nums.length - 2; i++) {\n    if (i > 0 && nums[i] === nums[i - 1]) continue;\n\n    let left = i + 1;\n    let right = nums.length - 1;\n\n    while (left < right) {\n      const sum = nums[i] + nums[left] + nums[right];\n\n      if (sum === 0) {\n        result.push([nums[i], nums[left], nums[right]]);\n        while (left < right && nums[left] === nums[left + 1]) left++;\n        while (left < right && nums[right] === nums[right - 1]) right--;\n        left++;\n        right--;\n      } else if (sum < 0) {\n        left++;\n      } else {\n        right--;\n      }\n    }\n  }\n  return result;\n}'
      }
    ],

    patterns: [
      {
        id: 'P1', name: 'Converging Two Pointers',
        recognitionSignals: [
          'Array or string problem involving pairs, maxima, or symmetry checks',
          'Input is sorted OR the problem has a monotonic property (moving one pointer always improves or worsens the answer predictably)',
          'Looking for two elements satisfying a condition — shrinking the search space from both ends'
        ],
        mentalModel: "Left starts at 0, right starts at end. At each step, compare or compute based on both pointers. Move whichever pointer makes the next state more promising. The correctness argument depends entirely on proving that the discarded state can never be optimal.",
        keyQuestion: "When I move a pointer, which one do I move and WHY can the discarded option never be optimal? That proof IS the algorithm.",
        questionIds: ['LC_167', 'LC_125', 'LC_680', 'LC_11', 'LC_977', 'LC_42']
      },
      {
        id: 'P2', name: 'Fast & Slow Pointers',
        recognitionSignals: [
          'Linked list problem involving cycles, midpoints, or position-relative checks',
          'Need to find a position that is a fraction (half, one-third) of the list length without knowing the length',
          "Floyd's Tortoise and Hare pattern"
        ],
        mentalModel: 'Slow moves 1 step, fast moves 2 steps per iteration. In a cycle they must eventually meet. Without a cycle, fast reaches null first. When fast reaches end, slow is at the structural midpoint.',
        questionIds: ['LC_141', 'LC_876', 'LC_234', 'LC_142', 'LC_19', 'LC_160', 'LC_287']
      },
      {
        id: 'P3', name: 'Write Pointer — Same Direction',
        recognitionSignals: [
          'In-place array modification: remove elements, move elements, filter elements',
          'Merging two sorted arrays/segments where extra space exists at one end',
          'Two pointers both move left-to-right but at different speeds — read outpaces write'
        ],
        mentalModel: 'Maintain a write pointer to the next valid output position. Read pointer scans everything. Only advance write when a kept element is found. For merge-from-end: start all pointers at their respective backs to prevent overwriting unread data.',
        questionIds: ['LC_26', 'LC_283', 'LC_88']
      },
      {
        id: 'P4', name: 'k-Sum Reduction',
        recognitionSignals: [
          'Find all unique pairs/triplets/quadruplets (k numbers) summing to a target',
          'Array can be sorted without losing the required output information',
          'Brute force is O(n^k) — target is O(n^(k-1))'
        ],
        mentalModel: 'Sort first. Reduce k-sum to (k-1)-sum with a for loop fixing the outermost element. Base case is 2Sum on a sorted array which is O(n) with converging pointers. Duplicate skipping at every pointer level is mandatory.',
        questionIds: ['LC_15', 'LC_16', 'LC_18']
      },
      {
        id: 'P5', name: 'Three-Way Partition',
        recognitionSignals: [
          'Partition array into exactly 3 mutually exclusive categories in a single O(n) pass',
          'Dutch National Flag or similar color/category sort',
          'Cannot use two separate passes — must maintain three boundaries simultaneously'
        ],
        mentalModel: 'Three pointers define four regions: confirmed-low (before low), confirmed-mid (low to mid-1), unexamined (mid to high), confirmed-high (after high). Process mid: swap with low (safe to advance mid), skip (advance mid), or swap with high (do NOT advance mid — incoming value is unknown).',
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
      'LC_88':  { leetcode: 88,  title: 'Merge Sorted Array',                              difficulty: 'Easy',   templateRefs: ['T4'], tags: ['two-pointers','write-pointer','array','sorted-array','merge','in-place'], keyInsight: 'Merge from the END of both arrays into the back of nums1. Merging from the front overwrites elements in nums1 that have not been compared yet. The extra space at the back is exactly the scratch space needed.', shrinkTrigger: null, timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: "After the main while loop: if nums2 still has elements (j >= 0), copy them. If nums1 still has elements (i >= 0), they are already in place — do nothing. Getting this wrong is the most common bug.", faangNote: "State before coding: 'I will merge from the end to avoid overwriting elements in nums1 that I haven't used yet.' That sentence signals experience.", alternateApproaches: [], link: 'https://leetcode.com/problems/merge-sorted-array/' },
      'LC_15':  { leetcode: 15,  title: '3Sum',                                            difficulty: 'Medium', templateRefs: ['T6'], tags: ['two-pointers','converging','k-sum','array','sorting'], keyInsight: 'Sort first — enables both the two-pointer inner loop AND the duplicate-skip logic. Three independent duplicate-skip conditions: (1) skip outer i if nums[i] === nums[i-1], (2) after recording skip left past duplicates, (3) skip right past duplicates. All three are mandatory.', shrinkTrigger: null, timeComplexity: 'O(n²)', spaceComplexity: 'O(1)', gotcha: 'The duplicate skip for i must check `i > 0`. Without this guard, when i=0 you compare nums[0] with nums[-1] which is undefined — the condition fires incorrectly and skips valid solutions.', faangNote: 'Most tested k-sum problem across all FAANG. A correct implementation with all three duplicate skips in the right places is sufficient. Any skip missing produces duplicate triplets — wrong answer.', alternateApproaches: [{ technique: 'hash-map', tradeoff: 'Fix two elements, look up complement in a hash set. Duplicate handling becomes more complex. Two pointers preferred.', complexity: 'O(n²) time, O(n) space' }], link: 'https://leetcode.com/problems/3sum/' },
      'LC_16':  { leetcode: 16,  title: '3Sum Closest',                                   difficulty: 'Medium', templateRefs: ['T6'], tags: ['two-pointers','converging','k-sum','array','sorting'], keyInsight: 'Same T6 structure as LC_15 (3Sum). Track closest sum instead of collecting exact matches. No duplicate-collection logic needed — only one closest value tracked. Update when |sum - target| < |closest - target|.', shrinkTrigger: null, timeComplexity: 'O(n²)', spaceComplexity: 'O(1)', gotcha: 'Initialize closest to nums[0] + nums[1] + nums[2], not Infinity. Return immediately if sum === target — closest possible.', faangNote: 'Solve immediately after LC_15 (3Sum). Same template, simpler because no duplicate collection. Demonstrates pattern recognition — a good signal during interviews.', alternateApproaches: [], link: 'https://leetcode.com/problems/3sum-closest/' },
      'LC_75':  { leetcode: 75,  title: 'Sort Colors',                                    difficulty: 'Medium', templateRefs: ['T5'], tags: ['two-pointers','three-way-partition','array','sorting','in-place'], keyInsight: 'Three-pointer invariant: [0..low-1]=0s, [low..mid-1]=1s, [mid..high]=unexamined, [high+1..n-1]=2s. Process mid: swap with low+increment both (safe); skip+increment mid (already 1); swap with high+decrement high but NOT mid (incoming unknown).', shrinkTrigger: null, timeComplexity: 'O(n) — single pass', spaceComplexity: 'O(1)', gotcha: 'After swapping nums[mid] with nums[high]: do NOT increment mid. The value from high is unknown — could be 0, 1, or 2. After swapping with nums[low]: safe to increment mid because the low-region only contains already-processed 0s so incoming must be 1.', faangNote: "Dijkstra's Dutch National Flag problem. Expected to know by name in senior interviews. The asymmetric increment logic is the precise point interviewers probe.", alternateApproaches: [{ technique: 'sorting', tradeoff: 'Standard sort O(n log n). Two-pass counting sort O(n) but 2 passes. Dutch National Flag is O(n) single pass — always preferred.', complexity: 'O(n log n) time, O(1) space' }], link: 'https://leetcode.com/problems/sort-colors/' },
      'LC_19':  { leetcode: 19,   title: 'Remove Nth Node From End of List',        difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/',        templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list','offset'], alternateApproaches: [{ technique: 'two-pass', moduleRef: null, tradeoff: 'First pass counts length L. Second pass traverses to node L-n. O(2L) time — same asymptotic but two traversals. One-pass offset technique is strictly cleaner.', complexity: 'O(L) time, O(1) space' }], keyInsight: 'Advance fast pointer n+1 steps from a dummy head, then advance both at the same pace. When fast reaches null, slow is exactly at the node BEFORE the target — enabling O(1) deletion via slow.next = slow.next.next.', shrinkTrigger: 'Advance fast n+1 times from dummy. Then: while (fast !== null) advance both. slow.next = slow.next.next.', timeComplexity: 'O(L) — single-pass', spaceComplexity: 'O(1)', gotcha: 'Use a dummy head node pointing to the real head. Without it, removing the head (when n === list length) requires a special case. Advance fast n+1 times (not n) so slow lands BEFORE the target node — one extra step is the entire trick.', faangNote: 'Canonical "offset fast/slow pointers" problem. State: "Advancing fast by n+1 positions slow just before the target — dummy head eliminates the edge case of removing the head." Interviewers probe whether you reach for a dummy head automatically or add conditional logic.' },
      'LC_160': { leetcode: 160,  title: 'Intersection of Two Linked Lists',           difficulty: 'Easy',   difficultyRank: 1, link: 'https://leetcode.com/problems/intersection-of-two-linked-lists/',           templateRefs: ['T3'], tags: ['two-pointers','linked-list','intersection'], alternateApproaches: [{ technique: 'hash-set', moduleRef: null, tradeoff: 'Traverse list A, add all nodes to a Set. Traverse list B — first match is the intersection. O(m) space. Interviewer will ask for O(1).', complexity: 'O(m + n) time, O(m) space' }], keyInsight: 'Redirect each pointer to the OTHER list head when it reaches null. After m+n steps both pointers have traversed equal total distance and converge at the intersection — or both reach null simultaneously if no intersection exists.', shrinkTrigger: 'While (pA !== pB): pA = pA ? pA.next : headB; pB = pB ? pB.next : headA. Return pA.', timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: 'The loop exits cleanly with no intersection — both pointers reach null at the same step after traversing m+n nodes each. Do NOT special-case null; the redirect IS the termination condition when there is no intersection.', faangNote: 'Meta (Facebook) classic. One sentence: "Both pointers walk total distance m+n regardless of start — they synchronize at the intersection." The hash-set approach scores partial credit; the redirect approach demonstrates insight. Interviewers explicitly ask for O(1) space.' },
      'LC_142': { leetcode: 142, title: 'Linked List Cycle II',                            difficulty: 'Medium', templateRefs: ['T3'], tags: ['two-pointers','fast-slow','linked-list','math'], keyInsight: 'Phase 1: detect the meeting point using fast/slow. Phase 2: reset one pointer to head, keep the other at the meeting point, advance both one step at a time — they meet at the cycle entry. The math: distance from head to entry = distance from meeting point to entry (mod cycle length).', shrinkTrigger: null, timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Do NOT reset both pointers to head. Only one goes back to head. The other stays at the meeting point from Phase 1. Moving both pointers one step at a time (not two) is critical in Phase 2.', faangNote: 'Meta and Amazon ask this as the immediate follow-up to LC_141. When you solve 141, proactively say: "The follow-up is finding the cycle entry — reset one pointer to head, advance both at speed 1, they meet at the entry point." That unprompted insight is a strong SDE3 signal.', alternateApproaches: [{ technique: 'hash-set', tradeoff: 'Store visited nodes, return first revisited. O(n) space — interviewer will ask for O(1).', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/linked-list-cycle-ii/' },
      'LC_287': { leetcode: 287, title: 'Find the Duplicate Number', difficulty: 'Medium', templateRefs: ['T3'], tags: ['two-pointers','fast-slow','array','cycle-detection','math'], keyInsight: 'Map the array to a linked list: treat each index i as a node whose "next" pointer is nums[i]. Since all values are in [1,n] and the array has n+1 elements, following next pointers forever must create a cycle. The duplicate is the cycle ENTRY — found by Phase 2 of Floyd\'s algorithm.', shrinkTrigger: 'Phase 1: slow = nums[slow], fast = nums[nums[fast]] until they meet. Phase 2: reset one pointer to index 0; advance both one step at a time until they meet — that index is the duplicate.', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', gotcha: 'Index 0 is the safe "dummy head" entry point — no value in [1,n] ever points back to 0, so following next from 0 always enters the list properly. Do NOT start both pointers at nums[0]; start them at index 0 itself so Phase 2 correctly resets to the list origin.', faangNote: 'The key signal interviewers score separately from the code: "I model this array as a linked list where nums[i] is the next pointer. Since all n+1 values lie in [1,n], every node has a valid successor — guaranteed cycle. The duplicate is the cycle entry." Recognizing the linked-list mapping is the entire insight. Without it, the O(1) space solution is invisible.', alternateApproaches: [{ technique: 'binary-search', tradeoff: 'For each candidate mid in [1,n], count elements ≤ mid. If count > mid, the duplicate is in [1,mid]. O(n log n) — meets the no-modification constraint but fails the O(n) time requirement if stated.', complexity: 'O(n log n) time, O(1) space' }, { technique: 'hash-set', tradeoff: 'Track seen values — return first revisited. O(n) time but O(n) space. Interviewer will ask for O(1) space.', complexity: 'O(n) time, O(n) space' }], link: 'https://leetcode.com/problems/find-the-duplicate-number/' },
      'LC_18':  { leetcode: 18,  title: '4Sum',                                            difficulty: 'Medium', templateRefs: ['T6'], tags: ['two-pointers','converging','k-sum','array','sorting'], keyInsight: 'Direct extension of 3Sum. Two nested for loops fix the outer two elements; converging two pointers solve the inner 2Sum. Duplicate skipping is required at ALL four levels. The outermost check: skip if nums[i] === nums[i-1] (and i > 0), then skip if nums[j] === nums[j-1] (and j > i+1).', shrinkTrigger: null, timeComplexity: 'O(n³)', spaceComplexity: 'O(1)', gotcha: 'The j duplicate skip guard must be j > i+1, NOT j > 0. Using j > 0 skips valid solutions when i advances and j resets to i+1. This is the most common bug — it differs from the 3Sum outer guard by one level of nesting.', faangNote: 'Google and Amazon ask 4Sum as a natural extension of 3Sum to test pattern generalisation. The insight they want: "kSum reduces to (k-1)Sum with a for loop — base case is always 2Sum with two pointers." State the general reduction before writing any code.', alternateApproaches: [], link: 'https://leetcode.com/problems/4sum/' }
    }
  }
  ,
  'binary-search': {
    description: 'A divide-and-conquer search technique that eliminates half the search space at each step. Applicable whenever a monotonic predicate can be defined over a sorted or structured space. The pattern extends beyond sorted arrays to answer spaces, 2D matrices, and structural array properties.',
    goal: 'Cover 90% of FAANG Binary Search questions by mastering 6 patterns, 6 templates, and 16 curated problems',
    relatedTopics: ['two-pointers', 'sliding-window'],

    tagRegistry: [
      'binary-search','exact-search','boundary-search','lower-bound','upper-bound','predicate',
      'rotated-array','answer-space','feasibility','matrix','staircase-search','array',
      'sorted-array','divide-and-conquer','greedy','two-pointers','prefix-sum','math'
    ],

    techniqueRegistry: [
      'binary-search','two-pointers','prefix-sum','sorting','greedy','divide-and-conquer'
    ],

    interviewTips: [
      "Name your template before writing code: 'I need the leftmost true position — left-boundary: while(left < right), right = mid on true.' Template selection is scored as a separate signal from whether the code is correct.",
      'Mid is always `left + Math.floor((right - left) / 2)`. Write it aloud. Even in JavaScript where integer overflow is not a risk at typical scales, stating the derivation shows you understand it.',
      'T2: while(left < right), right = mid on true. T1: while(left <= right), three-way branch. Never mix them — mixing causes infinite loops. Decide the template first; the loop condition follows automatically.',
      'Answer-space (P4): before coding write three lines — lo = smallest possible answer, hi = largest possible answer, isFeasible(mid) = ?. These three lines prove mastery. LC_875, LC_1011, and LC_410 all use the exact same shell.',
      "LC_240 is a deliberate trap. Say: 'This matrix has no row-major property — binary search does not apply. The optimal algorithm is staircase elimination from the top-right: O(m+n).' Recognizing when NOT to use binary search is tested as often as using it.",
      'LC_4 (Median of Two Sorted Arrays): the O(m+n) merge answer is explicitly suboptimal and will be rejected. If you cannot recall the partition invariant, say so clearly and deliver the O(m+n) solution — partial credit is real.',
      'LC_81 (Rotated with Duplicates): state O(n) worst case and give a concrete example ([1,1,1,2,1]) before coding. Never claim guaranteed O(log n) for this problem.',
      "When alternateApproaches lists a worse-complexity approach, name it and explain: 'I could merge in O(m+n) but the problem requires O(log(m+n)) — so I use the partition binary search.' This signals you read the constraint."
    ],

    whenToUse: {
      use: [
        'Input is SORTED (array, matrix with row-major property) and you need to find a target or boundary — binary search is O(log n) vs linear scan O(n).',
        'You can define a MONOTONIC PREDICATE over a search space: a condition that is false for some prefix and true for the rest (or vice versa). Binary search finds the boundary in O(log n).',
        'Problem asks for the MINIMUM value satisfying a condition or MAXIMUM value not violating a condition — answer-space binary search (P4). The answer is a value, not an index.',
        'The search space is an integer range [lo, hi] and you can write an O(n) isFeasible(mid) check — the total complexity becomes O(n log(hi-lo)), far better than brute force.',
        'Problem involves a ROTATED sorted array — binary search still applies because one half is always sorted, enabling you to determine which half the target is in.'
      ],
      avoid: [
        'Array is UNSORTED and cannot be sorted (order matters for the answer) → binary search requires sorted input or monotonic structure. Use linear scan, hash map, or sliding window.',
        'You need to find ALL occurrences, not just one boundary → binary search finds the leftmost and rightmost boundary (T2 + T3) but iterating all results still costs O(k). If k is large, consider hash map.',
        'The predicate is NOT monotonic — condition is true, then false, then true again → binary search requires strict monotonicity. Use a different approach.',
        'Answer-space binary search where isFeasible() is not obvious or correctness is hard to verify → binary search on answer is powerful but the isFeasible function must be provably correct. If you cannot write it confidently, try greedy or DP first.',
        'Matrix does NOT have row-major property (each row\'s last < next row\'s first) — LC_240 (Search a 2D Matrix II) trap. Use staircase two-pointer from top-right instead of binary search.'
      ]
    },
    decisionTree: {
      description: 'Walk this tree before writing any code. Binary search has 6 sub-patterns — applying the wrong template produces infinite loops, off-by-one errors, or missed cases.',
      node: {
        id: 'root',
        question: 'Is the input a 2D MATRIX (not a 1D array)?',
        yes: {
          node: {
            id: 'matrix-type-check',
            question: "Is the matrix row-major sorted — each row's last element < next row's first element?",
            yes: { leaf: { id: 'leaf-p5-t6',         pattern: 'P5', template: 'T6', label: '2D Matrix → 1D index mapping, then classic T1 binary search',          exampleProblems: ['LC_74']  } },
            no:  { leaf: { id: 'leaf-p5-staircase',  pattern: 'P5', template: null, label: 'Staircase elimination from corner — NOT classical binary search. O(m+n). See LC_240 (Search a 2D Matrix II).', exampleProblems: ['LC_240'] } }
          }
        },
        no: {
          node: {
            id: 'answer-space-check',
            question: 'Is the answer a VALUE IN A MATHEMATICAL RANGE (not an index or element in the array)?',
            yes: { leaf: { id: 'leaf-p4-t4', pattern: 'P4', template: 'T4', label: 'Binary Search on Answer Space — define lo, hi, and isFeasible(mid)', exampleProblems: ['LC_875', 'LC_1011', 'LC_410'] } },
            no: {
              node: {
                id: 'rotated-check',
                question: 'Is the array sorted but ROTATED, or does it contain exactly one structural modification?',
                yes: { leaf: { id: 'leaf-p3-t5', pattern: 'P3', template: 'T5', label: 'Rotated Array — determine which half is sorted, check if target is in it', exampleProblems: ['LC_153', 'LC_33', 'LC_81'] } },
                no: {
                  node: {
                    id: 'boundary-check',
                    question: 'Are you finding a BOUNDARY — first or last position satisfying a condition, or does the array have a structural property (peak, parity, single element)?',
                    yes: {
                      node: {
                        id: 'boundary-direction-check',
                        question: 'Do you need the LEFTMOST (first true) position?',
                        yes: { leaf: { id: 'leaf-p2-t2', pattern: 'P2', template: 'T2', label: 'Left Boundary — first position where predicate is true',  exampleProblems: ['LC_35', 'LC_278', 'LC_34', 'LC_162', 'LC_540'] } },
                        no:  { leaf: { id: 'leaf-p2-t3', pattern: 'P2', template: 'T3', label: 'Right Boundary — last position where predicate is true', exampleProblems: ['LC_34'] } }
                      }
                    },
                    no: {
                      node: {
                        id: 'exact-check',
                        question: 'Are you finding an EXACT value and returning its index (or -1 if absent)?',
                        yes: { leaf: { id: 'leaf-p1-t1', pattern: 'P1', template: 'T1', label: 'Classic Exact Binary Search', exampleProblems: ['LC_704'] } },
                        no:  { leaf: { id: 'leaf-unknown', pattern: null, template: null, label: 'Binary search may not apply directly. Revisit: (1) can the problem be reformulated as a feasibility check over a range? (2) can sorting be applied first? (3) is this a two-pointers problem instead?' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    templates: [
      {
        id: 'T1', name: 'Classic Exact Binary Search',
        description: 'Find the exact target in a sorted array. Loop terminates when left > right. Returns the index of target or -1. The three-branch structure (equal / less / greater) is the fundamental form all other templates derive from. Use right = nums.length - 1 (closed interval on both ends). Loop condition is left <= right.',
        code: 'function binarySearchExact(nums, target) {\n  let left = 0;\n  let right = nums.length - 1; // closed interval: both ends inclusive\n\n  while (left <= right) { // <= because both ends are valid candidates\n    const mid = left + Math.floor((right - left) / 2); // overflow-safe\n\n    if (nums[mid] === target) {\n      return mid;\n    } else if (nums[mid] < target) {\n      left = mid + 1;  // target in RIGHT half — discard left incl. mid\n    } else {\n      right = mid - 1; // target in LEFT half — discard right incl. mid\n    }\n  }\n  return -1;\n}'
      },
      {
        id: 'T2', name: 'Left Boundary — First Position Where Predicate is True (Lower Bound)',
        description: "Find the FIRST index where predicate(mid) is true. Predicate must be monotonic: false...false...true...true. Loop condition is left < right (NOT <=). When predicate is true: right = mid (do NOT add 1 — mid could be the answer). When false: left = mid + 1. Set right = nums.length (open right bound) if target may not exist. Returns left.",
        code: '// General left-boundary template\nfunction leftBoundary(nums, target) {\n  let left = 0;\n  let right = nums.length; // open right bound — result can be nums.length\n\n  while (left < right) { // NOT <= — loop converges when left === right\n    const mid = left + Math.floor((right - left) / 2);\n\n    if (nums[mid] < target) {\n      left = mid + 1; // predicate false — discard left half incl. mid\n    } else {\n      right = mid;    // predicate true — mid is a CANDIDATE, keep it\n    }\n  }\n  return left;\n}\n\n// Predicate-based variant (e.g. First Bad Version)\nfunction firstTrue(lo, hi, predicate) {\n  while (lo < hi) {\n    const mid = lo + Math.floor((hi - lo) / 2);\n    if (predicate(mid)) {\n      hi = mid;     // mid satisfies predicate — keep as candidate\n    } else {\n      lo = mid + 1; // mid does not satisfy — discard\n    }\n  }\n  return lo;\n}'
      },
      {
        id: 'T3', name: 'Right Boundary — Last Position Where Predicate is True (Upper Bound)',
        description: "Find the LAST index where predicate(mid) is true using a result-tracking variable. Loop condition is left <= right (closed interval). When predicate is true: record result = mid and move left = mid + 1 to search RIGHT for a later occurrence. When false: move right = mid - 1. Returns result (-1 if predicate was never true).",
        code: 'function rightBoundary(nums, target) {\n  let left = 0;\n  let right = nums.length - 1;\n  let result = -1;\n\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n\n    if (nums[mid] === target) {\n      result = mid;   // record this position — it might be the last\n      left = mid + 1; // keep searching RIGHT for a later occurrence\n    } else if (nums[mid] < target) {\n      left = mid + 1;\n    } else {\n      right = mid - 1;\n    }\n  }\n  return result;\n}'
      },
      {
        id: 'T4', name: 'Binary Search on Answer Space (Feasibility / Minimize the Answer)',
        description: "The answer is not an index — it is a VALUE in a mathematical range [lo, hi]. Define isFeasible(mid): returns true if mid is a valid answer. Binary search finds the MINIMUM feasible value. When feasible: hi = mid (do not discard). When not feasible: lo = mid + 1. Loop is lo < hi. CRITICAL: (1) set lo = smallest possible answer, (2) set hi = largest possible answer, (3) write isFeasible — usually an O(n) greedy check.",
        code: '// Minimize the answer: smallest x in [lo, hi] where isFeasible(x)\nfunction binarySearchOnAnswer(lo, hi, isFeasible) {\n  while (lo < hi) {\n    const mid = lo + Math.floor((hi - lo) / 2);\n\n    if (isFeasible(mid)) {\n      hi = mid;     // mid works — try to find something SMALLER\n    } else {\n      lo = mid + 1; // mid too small — answer must be LARGER\n    }\n  }\n  return lo;\n}\n\n// Example: Koko Eating Bananas — find minimum speed k\nfunction minEatingSpeed(piles, h) {\n  const isFeasible = (speed) => {\n    let hours = 0;\n    for (const pile of piles) hours += Math.ceil(pile / speed);\n    return hours <= h;\n  };\n\n  const lo = 1;\n  const hi = Math.max(...piles);\n  return binarySearchOnAnswer(lo, hi, isFeasible);\n}'
      },
      {
        id: 'T5', name: 'Rotated Sorted Array Binary Search',
        description: "A rotated array has one inflection point. At any mid, EXACTLY ONE of the two halves is fully sorted. Compare nums[left] with nums[mid] to determine which. Check if target falls within the sorted half. For duplicates (LC_81 - Search in Rotated Sorted Array II): when nums[left]===nums[mid]===nums[right] it is impossible to determine — increment left and decrement right and retry (degrades to O(n) worst case).",
        code: '// LC_33 (Search in Rotated Sorted Array) variant (no duplicates)\nfunction searchRotated(nums, target) {\n  let left = 0;\n  let right = nums.length - 1;\n\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    if (nums[mid] === target) return mid;\n\n    if (nums[left] <= nums[mid]) {\n      // LEFT HALF [left..mid] is sorted\n      if (nums[left] <= target && target < nums[mid]) {\n        right = mid - 1; // target in sorted left half\n      } else {\n        left = mid + 1;  // target must be in right half\n      }\n    } else {\n      // RIGHT HALF [mid..right] is sorted\n      if (nums[mid] < target && target <= nums[right]) {\n        left = mid + 1;  // target in sorted right half\n      } else {\n        right = mid - 1; // target must be in left half\n      }\n    }\n  }\n  return -1;\n}\n\n// LC_81 (Search in Rotated Sorted Array II) addition: handle duplicates at boundaries\n// Insert at TOP of while loop before the sorted-half check:\n// if (nums[left] === nums[mid] && nums[mid] === nums[right]) {\n//   left++; right--; continue;\n// }'
      },
      {
        id: 'T6', name: '2D Matrix — Row-Major 1D Index Mapping',
        description: "When a matrix is row-major sorted (each row's last element < next row's first element), it is logically equivalent to a sorted 1D array of rows*cols elements. Map a 1D index mid to 2D coordinates: row = Math.floor(mid / cols), col = mid % cols. Apply T1 exact binary search on the virtual 1D array.",
        code: 'function searchMatrix(matrix, target) {\n  const rows = matrix.length;\n  const cols = matrix[0].length;\n  let left = 0;\n  let right = rows * cols - 1; // treat as 1D array of length rows*cols\n\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    const row = Math.floor(mid / cols); // map 1D → 2D\n    const col = mid % cols;\n    const val = matrix[row][col];\n\n    if (val === target) {\n      return true;\n    } else if (val < target) {\n      left = mid + 1;\n    } else {\n      right = mid - 1;\n    }\n  }\n  return false;\n}'
      }
    ],

    patterns: [
      {
        id: 'P1', name: 'Classic Exact Binary Search',
        recognitionSignals: [
          'Find an exact target value in a sorted array',
          'Return the index of the target or -1 if absent',
          'Three-way branch: found / go left / go right'
        ],
        mentalModel: 'Closed interval [left, right]. Loop while left <= right. Discard mid+1 to right (right=mid-1) when too large; discard left to mid-1 (left=mid+1) when too small. Return mid when hit.',
        keyQuestion: 'Is mid the answer, too large, or too small?',
        questionIds: ['LC_704']
      },
      {
        id: 'P2', name: 'Boundary / Predicate Binary Search',
        recognitionSignals: [
          'Find the FIRST or LAST position satisfying a condition',
          'Search insert position, lower/upper bound',
          'Array has a structural property (peak, single element, parity) enabling binary search even without full sorting'
        ],
        mentalModel: 'Define a boolean predicate P(x) that is monotonic: false...false...true...true (or vice versa). Binary search finds the boundary. For leftmost-true use T2; for rightmost-true use T3.',
        keyQuestion: 'What is my predicate? Is it cheap to evaluate? Is it monotonic over the search space?',
        questionIds: ['LC_35', 'LC_34', 'LC_278', 'LC_162', 'LC_540']
      },
      {
        id: 'P3', name: 'Rotated / Modified Sorted Array',
        recognitionSignals: [
          'Array was sorted but rotated at an unknown pivot',
          'Contains duplicates that complicate the sorted-half determination',
          'Find minimum or search for a target in this modified structure'
        ],
        mentalModel: 'At any mid in a rotated array, exactly one half is fully sorted. Compare nums[left] with nums[mid] to determine which half. Check if target lies in the sorted half. Discard accordingly. Duplicates at boundaries prevent this — shrink both ends and retry.',
        keyQuestion: 'Which half is fully sorted? Is my target in that half?',
        questionIds: ['LC_153', 'LC_33', 'LC_81']
      },
      {
        id: 'P4', name: 'Binary Search on Answer Space',
        recognitionSignals: [
          'The answer is a value in a range, not an index in the array',
          'Problem asks to minimize or maximize a value subject to a constraint',
          "A feasibility check ('can we achieve X?') can be written in O(n) or better"
        ],
        mentalModel: 'Binary search on the ANSWER RANGE [lo, hi]. Define isFeasible(x): can we satisfy the constraint at value x? The feasible region is monotonic. Three design steps: (1) set lo and hi, (2) write isFeasible, (3) apply T4.',
        keyQuestion: 'What are lo and hi? What does isFeasible(mid) check? Which direction expands feasibility?',
        questionIds: ['LC_875', 'LC_1011', 'LC_410', 'LC_719']
      },
      {
        id: 'P5', name: '2D Matrix Search',
        recognitionSignals: [
          'Search in a 2D matrix with sorted rows and/or columns',
          'Determine if binary search applies based on the EXACT sorting structure'
        ],
        mentalModel: "Two distinct matrix structures require different approaches. Row-major sorted (each row's max < next row's min): treat as 1D, apply T6. Row+column sorted independently (LC_240): binary search does NOT apply — use staircase elimination from the top-right corner.",
        keyQuestion: 'Is the matrix row-major sorted (use T6 binary search) or only row+column sorted (use staircase O(m+n))?',
        questionIds: ['LC_74', 'LC_240']
      },
      {
        id: 'P6', name: 'Canonical Hard — Partition-Based Binary Search',
        recognitionSignals: [
          'Finding a statistical property (median, kth element) across multiple sorted arrays',
          'Partitioning two arrays simultaneously to maintain a global sorted invariant'
        ],
        mentalModel: "Binary search on the smaller array's partition index. For each candidate partition of array1, compute the corresponding partition of array2. Check the cross-boundary condition (maxLeft1 <= minRight2 and maxLeft2 <= minRight1). Adjust partition based on which condition fails.",
        keyQuestion: 'Is my partition correct? Which condition fails and which direction do I adjust?',
        questionIds: ['LC_4']
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
      'LC_74':  { leetcode: 74,  title: 'Search a 2D Matrix',                                    difficulty: 'Medium', templateRefs: ['T6'], tags: ['binary-search','matrix','array','sorted-array'], keyInsight: "The row-major property (each row's last < next row's first) means the entire matrix is one sorted sequence read left-to-right, top-to-bottom. Map 1D index mid to (row, col) via T6. Apply T1 on the virtual 1D array of length rows*cols.", shrinkTrigger: 'matrix[row][col] < target → left = mid + 1. matrix[row][col] > target → right = mid - 1.', timeComplexity: 'O(log(m * n))', spaceComplexity: 'O(1)', gotcha: 'Verify the row-major property holds before applying T6. LC_74 guarantees it; LC_240 does NOT. Applying T6 to LC_240 produces wrong answers. This distinction is the interview insight.', faangNote: null, alternateApproaches: [{ technique: 'two-pointers', tradeoff: 'Staircase from top-right: O(m+n). Works on LC_74 but is suboptimal — O(log mn) binary search is better when the row-major property holds.', complexity: 'O(m+n) time, O(1) space' }], link: 'https://leetcode.com/problems/search-a-2d-matrix/' },
      'LC_240': { leetcode: 240, title: 'Search a 2D Matrix II',                                  difficulty: 'Medium', templateRefs: [], tags: ['binary-search','matrix','staircase-search','two-pointers','array'], keyInsight: 'IMPORTANT: This problem does NOT have the row-major property — T6 does NOT apply. Optimal: staircase elimination from the TOP-RIGHT corner: if matrix[row][col] > target, move LEFT (col--); if < target, move DOWN (row++). This is a two-pointer technique, not binary search.', shrinkTrigger: 'matrix[row][col] > target → col--. matrix[row][col] < target → row++. Stop when found or out of bounds.', timeComplexity: 'O(m + n)', spaceComplexity: 'O(1)', gotcha: "State to the interviewer: 'This matrix does not have the row-major property so I cannot use the 1D-mapping approach — I will use staircase elimination instead.' Recognizing when NOT to apply binary search is the actual test.", faangNote: 'Interviewers use LC_240 immediately after LC_74 to test whether you blindly apply binary search or understand its preconditions. The correct answer is the staircase as the optimal approach.', alternateApproaches: [{ technique: 'binary-search', tradeoff: 'Binary search each row independently: O(m log n). Not optimal — staircase is O(m+n).', complexity: 'O(m log n) time, O(1) space' }], link: 'https://leetcode.com/problems/search-a-2d-matrix-ii/' },
      'LC_4':   { leetcode: 4,   title: 'Median of Two Sorted Arrays',                            difficulty: 'Hard',   templateRefs: ['T2'], tags: ['binary-search','boundary-search','divide-and-conquer','array','sorted-array','math'], keyInsight: "Binary search on the smaller array's partition index. For partition i in nums1 and j = (m+n+1)/2 - i in nums2: the partition is correct when maxLeft1 <= minRight2 AND maxLeft2 <= minRight1. If maxLeft1 > minRight2: i too large (right = i - 1). If maxLeft2 > minRight1: i too small (left = i + 1).", shrinkTrigger: 'maxLeft1 > minRight2 → partition of nums1 too far right (right = mid - 1). maxLeft2 > minRight1 → partition of nums1 too far left (left = mid + 1).', timeComplexity: 'O(log(min(m, n)))', spaceComplexity: 'O(1)', gotcha: 'Always binary search on the SMALLER array (swap if needed). Handle edge cases: when a partition is at index 0 (no left elements), maxLeft = -Infinity; when at index n (no right elements), minRight = Infinity.', faangNote: 'The canonical hardest binary search problem. The O(m+n) merge solution is explicitly suboptimal and rejected. The partition invariant is the insight. Draw the four boundary values before coding and walk the interviewer through the invariant — this problem is scored on reasoning clarity.', alternateApproaches: [{ technique: 'two-pointers', tradeoff: 'Merge both arrays, stop at median position. O(m+n) — fails the O(log(m+n)) requirement in the problem statement.', complexity: 'O(m+n) time, O(1) space' }], link: 'https://leetcode.com/problems/median-of-two-sorted-arrays/' },
      'LC_719': { leetcode: 719, title: 'Find K-th Smallest Pair Distance', difficulty: 'Hard', templateRefs: ['T4'], tags: ['binary-search','answer-space','feasibility','sliding-window','sorting','two-pointers','array'], keyInsight: 'Binary search on the ANSWER: distance value in [0, nums[n-1]-nums[0]] after sorting. isFeasible(mid): count pairs with distance <= mid using a sliding window on the sorted array — for each right, advance left while nums[right]-nums[left] > mid, then count += right - left. If count >= k, the k-th smallest distance is <= mid.', shrinkTrigger: 'Sort first. isFeasible(mid): sliding window count — for each right, while nums[right]-nums[left] > mid: left++. count += right - left. If count >= k → hi = mid. Else → lo = mid + 1.', timeComplexity: 'O(n log n + n log W) where W = nums[n-1]-nums[0]', spaceComplexity: 'O(1) excluding sort', gotcha: 'Sort the array first before binary search — the sliding window feasibility check is only correct on sorted input. lo = 0 (duplicates can have zero distance), hi = nums[n-1]-nums[0]. Count pairs in O(n) with the sliding window; a naive O(n^2) count inside isFeasible makes total complexity O(n^2 log W) — too slow.', faangNote: 'The highest-signal binary search problem in FAANG rounds: it forces explicit composition of two modules. Say: "The answer space is [0, max-min]. The feasibility function asks how many pairs have distance <= mid — that is a sliding window COUNT problem on the sorted array. Binary search on the answer space with sliding window as the feasibility check." Recognizing the cross-module composition is the SDE3 signal.', alternateApproaches: [], link: 'https://leetcode.com/problems/find-k-th-smallest-pair-distance/' }
    }
  }
  ,
  'sorting': {
    description: 'A family of algorithms and techniques centered on ordering elements or using sorted order as a structural invariant. In FAANG interviews, sorting appears in three distinct forms: (1) implementing a sort algorithm from scratch to test algorithmic depth, (2) choosing the correct sort key to reduce a hard problem to a simple greedy scan, and (3) recognizing when linear-time or partial sorting is needed to satisfy an O(n) or O(n log n) complexity constraint.',
    goal: 'Cover 90% of FAANG Sorting questions by mastering 6 patterns, 6 templates, and 18 curated problems',
    relatedTopics: ['binary-search', 'two-pointers', 'sliding-window', 'prefix-sum', 'heap'],
    tagRegistry: ['sorting','merge-sort','quicksort','quickselect','bucket-sort','counting-sort','custom-comparator','multi-key-sort','interval','greedy','inversion-count','array','string','linked-list','hash-map','two-pointers','binary-search','prefix-sum','heap','divide-and-conquer','in-place'],
    techniqueRegistry: ['sorting','merge-sort','quickselect','bucket-sort','two-pointers','binary-search','heap','greedy','hash-map'],
    interviewTips: [
      'State your sort key and WHY before writing the comparator. For intervals: \'I sort by end time — the greedy exchange argument shows keeping the earliest-ending interval is strictly better.\' The reasoning is scored as a separate signal from the code.',
      'For kth element: always present both — quickselect O(n) and heap O(n log k) — then choose. Quickselect when O(n) is required and input can be modified. Heap when k << n, data streams, or input must be preserved.',
      'LC_179 (Largest Number) comparator proof: \'It is transitive — if a+b > b+a and b+c > c+b, then a+c > c+a. Without transitivity the sort result is implementation-defined.\' One concrete counterexample for naive approaches closes the argument.',
      'LC_315 (Count of Smaller Numbers) insight: \'When a right-half element merges first, it was smaller than all remaining left-half elements AND originally to their right — each left element gains one count.\' Say this before touching the code.',
      'Merge sort vs quicksort: merge sort for guaranteed O(n log n), stability, and linked lists. Quicksort for O(1) extra space when mutation is allowed. Have a one-sentence justification before you start.',
      'LC_164 (Maximum Gap) Pigeonhole: \'n elements in n-1 buckets — at least one is empty. The maximum gap must cross that empty bucket.\' Without this proof the bucket size formula looks arbitrary and interviewers probe it.',
      'Intervals — sort key is decisive: START for merging overlapping intervals, END for greedy removal or counting non-overlapping ones. Wrong key → wrong greedy → wrong answer. Choose before writing the comparator.',
      'When alternateApproaches shows a worse-complexity option, name it and explain. For LC_347: \'Bucket sort achieves O(n) because frequency is bounded by array length — no element comparisons needed.\' Shows you understand the improvement, not just the code.'
    ],

    whenToUse: {
      use: [
        'Problem requires ORDERING elements and the natural sort order is insufficient — define a custom comparator that expresses the correct ordering relation.',
        'Input is a set of INTERVALS — sort by start for merging, sort by end for minimizing removals or counting overlaps. Sorted order transforms an O(n²) comparison into an O(n) sweep.',
        'You need the KTH largest/smallest element — quickselect O(n) if input can be modified, heap O(n log k) if input must be preserved or k is small.',
        'Problem involves GROUPING elements that are equivalent under some transformation (anagrams, frequency groups) — sort the transformation result as a canonical key.',
        'Brute force is O(n²) due to pairwise comparisons and you can sort first — a single O(n log n) sort often enables a subsequent O(n) greedy scan, giving O(n log n) total.'
      ],
      avoid: [
        'You need O(n) time and sorting would cost O(n log n) — consider bucket sort, counting sort, or hash map instead. LC_347 (Top K Frequent) and LC_164 (Maximum Gap) are canonical examples.',
        'Problem involves SUBARRAYS where position/order matters for the answer — sorting destroys positional information. Use sliding window, prefix sum, or two pointers on the original array.',
        'You need STABLE relative ordering of equal elements AND JavaScript\'s Array.sort() stability is not guaranteed in your target environment — verify or use a stable sort explicitly.',
        'Problem is on a LINKED LIST and you need O(1) extra space — merge sort on linked lists uses O(log n) recursion stack. Bottom-up merge sort achieves O(1) but is complex. Verify space constraint first.',
        'Sorting would require O(n log n) but the problem has an explicit O(n) requirement — this is a signal to look for a linear technique (hash map, counting, bucket sort) instead.'
      ]
    },
    decisionTree: {
      description: 'Walk this tree before writing any code. The wrong sort pattern leads to wrong complexity or incorrect results.',
      node: {
        id: 'root',
        question: 'Are you asked to IMPLEMENT a sort algorithm from scratch (not use built-in sort)?',
        yes: {
          node: {
            id: 'impl-type-check',
            question: 'Is the input a linked list (no random access to elements by index)?',
            yes: { leaf: { id: 'leaf-p1-linkedlist', pattern: 'P1', template: 'T1', label: 'Merge Sort on Linked List — find mid with fast/slow, split, sort halves, merge', exampleProblems: ['LC_148'] } },
            no: {
              node: {
                id: 'augmented-check',
                question: 'Do you need to COUNT something (e.g. inversions) during the sort itself?',
                yes: { leaf: { id: 'leaf-p1-augmented', pattern: 'P1', template: 'T1', label: 'Augmented Merge Sort — track index and count during the merge step', exampleProblems: ['LC_315'] } },
                no:  { leaf: { id: 'leaf-p1-array',     pattern: 'P1', template: 'T1', label: 'Merge Sort on Array — recursive split, merge into temp array, copy back',   exampleProblems: ['LC_912'] } }
              }
            }
          }
        },
        no: {
          node: {
            id: 'partial-sort-check',
            question: 'Do you need only the K-th element (not a fully sorted output)?',
            yes: { leaf: { id: 'leaf-p5-t5', pattern: 'P5', template: 'T5', label: 'Quickselect — partition around pivot, recurse on ONE side only. O(n) expected.', exampleProblems: ['LC_215', 'LC_973'] } },
            no: {
              node: {
                id: 'linear-sort-check',
                question: 'Are the values bounded in a known range or sorting by frequency (not value)?',
                yes: { leaf: { id: 'leaf-p6-t6', pattern: 'P6', template: 'T6', label: 'Bucket / Counting Sort — O(n + k). Bucket index encodes the sort key.', exampleProblems: ['LC_347', 'LC_164'] } },
                no: {
                  node: {
                    id: 'interval-check',
                    question: 'Does the input consist of intervals — pairs of (start, end) values?',
                    yes: {
                      node: {
                        id: 'interval-goal-check',
                        question: 'Are you MERGING overlapping intervals (not counting or removing)?',
                        yes: { leaf: { id: 'leaf-p3-merge', pattern: 'P3', template: 'T3', label: 'Sort by START, greedy merge — expand last interval end when overlap found', exampleProblems: ['LC_56'] } },
                        no:  { leaf: { id: 'leaf-p3-end',   pattern: 'P3', template: 'T3', label: 'Sort by END, greedy count — keep interval ending earliest, skip all overlapping ones', exampleProblems: ['LC_435', 'LC_452'] } }
                      }
                    },
                    no: {
                      node: {
                        id: 'comparator-check',
                        question: 'Is the sort comparison non-trivial — multi-key, string concatenation, or relative ranking?',
                        yes: { leaf: { id: 'leaf-p2-t2', pattern: 'P2', template: 'T2', label: 'Custom Comparator — define a comparison function that encodes the non-obvious sort order', exampleProblems: ['LC_179', 'LC_937', 'LC_406'] } },
                        no: {
                          node: {
                            id: 'enabler-check',
                            question: 'Is sorting used purely as preprocessing — to enable grouping, hashing, or a linear scan?',
                            yes: { leaf: { id: 'leaf-p4-t4', pattern: 'P4', template: 'T4', label: 'Sort as Enabler — sorted form creates canonical key or enables O(n) scan', exampleProblems: ['LC_49', 'LC_274'] } },
                            no:  { leaf: { id: 'leaf-unknown', pattern: null, template: null, label: 'Sorting may not be the primary technique. Reconsider: (1) is this a two-pointers problem on a pre-sorted input? (2) can binary search apply after sorting? (3) is a heap more appropriate for streaming K-th element queries?' } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    templates: [
      {
        id: 'T1', name: 'Merge Sort — Array and Linked List variants',
        description: 'Divide-and-conquer: split array at mid, recursively sort both halves, merge the two sorted halves into a temp buffer and copy back. Guaranteed O(n log n) stable sort. For linked lists: find mid with fast/slow pointers, split by setting mid.next = null, recurse on both halves, merge in-place. For augmented merge sort (LC_315): during the merge step, when a right-half element is placed before remaining left-half elements, those elements each receive a count increment.',
        code: '// --- Array Merge Sort ---\nfunction mergeSort(nums, left, right) {\n  if (left >= right) return;\n  const mid = left + Math.floor((right - left) / 2);\n  mergeSort(nums, left, mid);\n  mergeSort(nums, mid + 1, right);\n  mergeSortedHalves(nums, left, mid, right);\n}\n\nfunction mergeSortedHalves(nums, left, mid, right) {\n  const temp = [];\n  let i = left, j = mid + 1;\n  while (i <= mid && j <= right) {\n    if (nums[i] <= nums[j]) temp.push(nums[i++]); // <= keeps sort STABLE\n    else                    temp.push(nums[j++]);\n  }\n  while (i <= mid)   temp.push(nums[i++]);\n  while (j <= right) temp.push(nums[j++]);\n  for (let k = 0; k < temp.length; k++) nums[left + k] = temp[k];\n}\n// Call: mergeSort(nums, 0, nums.length - 1)\n\n// --- Linked List Merge Sort ---\nfunction sortList(head) {\n  if (!head || !head.next) return head;\n  let slow = head, fast = head.next;\n  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }\n  const rightHead = slow.next;\n  slow.next = null;\n  const left = sortList(head);\n  const right = sortList(rightHead);\n  return mergeTwoLists(left, right);\n}\n\nfunction mergeTwoLists(l1, l2) {\n  const dummy = { val: 0, next: null };\n  let curr = dummy;\n  while (l1 && l2) {\n    if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next; }\n    else                  { curr.next = l2; l2 = l2.next; }\n    curr = curr.next;\n  }\n  curr.next = l1 ?? l2;\n  return dummy.next;\n}'
      },
      {
        id: 'T2', name: 'Custom Comparator Sort',
        description: 'Array.sort() accepts a comparator (a, b) => number. Return negative to place a before b; positive to place b before a. For multi-key sort: check primary key first; if equal, fall through to secondary key. For string concatenation comparator (LC_179): compare b+a against a+b as strings — this is a valid total order (transitivity holds). Always verify transitivity — an invalid comparator silently produces wrong results.',
        code: '// --- Multi-key custom comparator (LC_937) ---\nfunction reorderLogFiles(logs) {\n  const isDigitLog = (log) => /\\d$/.test(log);\n  return logs.sort((a, b) => {\n    const aIsDigit = isDigitLog(a);\n    const bIsDigit = isDigitLog(b);\n    if (!aIsDigit && bIsDigit) return -1;\n    if (aIsDigit && !bIsDigit) return 1;\n    if (aIsDigit && bIsDigit)  return 0;\n    const [aId, ...aContent] = a.split(\' \');\n    const [bId, ...bContent] = b.split(\' \');\n    const contentCmp = aContent.join(\' \').localeCompare(bContent.join(\' \'));\n    if (contentCmp !== 0) return contentCmp;\n    return aId.localeCompare(bId);\n  });\n}\n\n// --- String concatenation comparator (LC_179: Largest Number) ---\nfunction largestNumber(nums) {\n  const strs = nums.map(String);\n  strs.sort((a, b) => (b + a).localeCompare(a + b));\n  if (strs[0] === \'0\') return \'0\';\n  return strs.join(\'\');\n}'
      },
      {
        id: 'T3', name: 'Interval Sort + Greedy',
        description: 'Sorting key determines the greedy strategy. MERGING overlapping intervals: sort by START — a later start can only extend the current merge window. MINIMIZING removals or counting intersections: sort by END — the interval ending earliest leaves the most room for future intervals. The greedy scan runs in O(n) after the O(n log n) sort. Never sort by start for removal/counting problems.',
        code: '// --- Sort by START for merging (LC_56) ---\nfunction mergeIntervals(intervals) {\n  intervals.sort((a, b) => a[0] - b[0]);\n  const result = [intervals[0]];\n  for (let i = 1; i < intervals.length; i++) {\n    const last = result[result.length - 1];\n    if (intervals[i][0] <= last[1]) {\n      last[1] = Math.max(last[1], intervals[i][1]);\n    } else {\n      result.push([...intervals[i]]);\n    }\n  }\n  return result;\n}\n\n// --- Sort by END for minimum removal (LC_435) ---\nfunction eraseOverlapIntervals(intervals) {\n  intervals.sort((a, b) => a[1] - b[1]);\n  let removed = 0;\n  let prevEnd = intervals[0][1];\n  for (let i = 1; i < intervals.length; i++) {\n    if (intervals[i][0] < prevEnd) {\n      removed++;\n    } else {\n      prevEnd = intervals[i][1];\n    }\n  }\n  return removed;\n}'
      },
      {
        id: 'T4', name: 'Sort as Enabler — Canonical Key or Linear Scan',
        description: 'Sorting is a preprocessing step, not the final answer. KEY MODE: sort the characters of each element to produce a canonical hash key (anagrams share the same sorted string). SCAN MODE: sort by the relevant metric, then perform an O(n) scan (H-Index: sort citations descending, scan for the boundary). The sort is O(n log n); the value is in the O(n) step it enables.',
        code: '// --- Key Mode: sorted characters as anagram group key (LC_49) ---\nfunction groupAnagrams(strs) {\n  const map = new Map();\n  for (const s of strs) {\n    const key = s.split(\'\').sort().join(\'\');\n    if (!map.has(key)) map.set(key, []);\n    map.get(key).push(s);\n  }\n  return [...map.values()];\n}\n\n// --- Scan Mode: sort enables O(n) boundary detection (LC_274: H-Index) ---\nfunction hIndex(citations) {\n  citations.sort((a, b) => b - a);\n  let h = 0;\n  for (let i = 0; i < citations.length; i++) {\n    if (citations[i] >= i + 1) h = i + 1;\n    else break;\n  }\n  return h;\n}'
      },
      {
        id: 'T5', name: 'Quickselect — Partial Sort for K-th Element',
        description: 'Partition the array around a pivot so all elements left of pivot are <= pivot and all right are >= pivot. The pivot lands at its final sorted position. If that position equals target (n - k for kth largest), return it. Otherwise recurse on ONLY ONE side. Expected O(n). ALWAYS use a random pivot to prevent O(n²) worst case on sorted input.',
        code: 'function findKthLargest(nums, k) {\n  const target = nums.length - k;\n  let left = 0, right = nums.length - 1;\n  while (left <= right) {\n    const pivotPos = partition(nums, left, right);\n    if (pivotPos === target)     return nums[pivotPos];\n    else if (pivotPos < target)  left  = pivotPos + 1;\n    else                         right = pivotPos - 1;\n  }\n  return -1;\n}\n\nfunction partition(nums, left, right) {\n  const pivotIdx = left + Math.floor(Math.random() * (right - left + 1));\n  [nums[pivotIdx], nums[right]] = [nums[right], nums[pivotIdx]];\n  const pivot = nums[right];\n  let store = left;\n  for (let i = left; i < right; i++) {\n    if (nums[i] <= pivot) {\n      [nums[store], nums[i]] = [nums[i], nums[store]];\n      store++;\n    }\n  }\n  [nums[store], nums[right]] = [nums[right], nums[store]];\n  return store;\n}'
      },
      {
        id: 'T6', name: 'Bucket Sort / Counting Sort (Linear Time)',
        description: 'When the sort key is a bounded integer in range [0, k], use an array of k+1 buckets. Each element is assigned to a bucket by its key in O(1). Reading buckets in order reconstructs sorted sequence in O(n + k). For frequency bucket sort (LC_347): bucket index IS the frequency. For gap problems (LC_164): Pigeonhole proves the maximum gap must span an empty bucket — only check adjacent non-empty buckets.',
        code: '// --- Frequency Bucket Sort (LC_347: Top K Frequent Elements) ---\nfunction topKFrequent(nums, k) {\n  const freq = new Map();\n  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);\n  // Bucket index IS the frequency (max freq = nums.length)\n  const buckets = Array.from({ length: nums.length + 1 }, () => []);\n  for (const [num, count] of freq) buckets[count].push(num);\n  const result = [];\n  for (let i = buckets.length - 1; i >= 1 && result.length < k; i--) {\n    result.push(...buckets[i]);\n  }\n  return result.slice(0, k);\n}\n\n// --- Key insight for LC_164 (Maximum Gap) ---\n// n elements in [min, max] across n-1 buckets → at least one bucket empty (Pigeonhole).\n// Max gap CANNOT be within a single bucket — must cross an empty bucket.\n// Track each bucket min/max only; compare adjacent non-empty buckets.'
      }
    ],
    patterns: [
      {
        id: 'P1', name: 'Merge Sort Internals',
        recognitionSignals: [
          'Problem explicitly asks you to implement a sorting algorithm',
          'Input is a linked list — no random access, merge sort is the only O(n log n) option',
          'Need to COUNT something that happens during the sort (inversions, smaller elements to the right)'
        ],
        mentalModel: 'Split at the midpoint. Recursively sort both halves. Merge by picking the smaller head each time into a temp buffer. For linked lists: fast/slow to find mid, sever the list, recurse, merge in-place. For augmented counting: when a right-half element is placed before left-half elements during merge, each remaining left-half element\'s count increases by 1.',
        keyQuestion: 'What additional information needs to be tracked DURING the merge step?',
        questionIds: ['LC_912', 'LC_148', 'LC_315']
      },
      {
        id: 'P2', name: 'Custom Comparator',
        recognitionSignals: [
          'The natural sort order does not produce the required ordering',
          'Sort requires multiple keys (primary + secondary + ...)',
          'Sort key involves string operations — concatenation, lexicographic with exclusions'
        ],
        mentalModel: 'Define a comparison function (a, b) => number. Negative means a before b. Positive means b before a. For multi-key: cascade through keys with early returns. For string concatenation: compare b+a vs a+b as string lexicographic — this forms a valid transitive total order. ALWAYS verify transitivity on paper before an interview; an invalid comparator silently produces wrong results.',
        keyQuestion: 'What is the exact rule that determines when a should appear before b? Can I express that as a numeric return value?',
        questionIds: ['LC_179', 'LC_937', 'LC_406']
      },
      {
        id: 'P3', name: 'Interval Sort + Greedy',
        recognitionSignals: [
          'Input is a set of intervals (pairs of start and end values)',
          'Goal involves merging, counting overlaps, or minimizing removal of overlapping intervals',
          'A sweep from left to right after sorting becomes a simple O(n) scan'
        ],
        mentalModel: 'The sort key determines the greedy strategy. Sort by START when merging — a new interval can only extend the current one. Sort by END when minimizing removals — always keeping the interval ending soonest is optimal by greedy exchange argument. Sorting by start for removal problems is a common wrong approach that produces incorrect greedy decisions.',
        keyQuestion: 'Am I merging (sort by start) or minimizing/counting (sort by end)?',
        questionIds: ['LC_56', 'LC_435', 'LC_452', 'LC_57', 'LC_253']
      },
      {
        id: 'P4', name: 'Sort as Enabler',
        recognitionSignals: [
          'Grouping elements that are equivalent under some transformation',
          'Sorting by a computed metric enables a single O(n) boundary scan',
          'The answer cannot be directly computed but becomes obvious once the array is in sorted order'
        ],
        mentalModel: 'Two sub-modes: KEY MODE — sort the internal characters/digits of each element to produce a canonical key for hashing (all anagrams map to the same sorted string). SCAN MODE — sort by the relevant metric, then scan linearly for the first boundary violation. The sort does the heavy work so the scan only needs O(n).',
        keyQuestion: 'Is sorting creating a canonical key (key mode) or enabling a linear boundary scan (scan mode)?',
        questionIds: ['LC_49', 'LC_274']
      },
      {
        id: 'P5', name: 'Quickselect — Partial Sort',
        recognitionSignals: [
          'Find the k-th largest or smallest element — full sort is not required',
          'Find k elements closest to a target or origin — exact order among those k does not matter',
          'O(n) expected time is required — O(n log n) full sort is acceptable but interviewer may ask for better'
        ],
        mentalModel: 'Partition around a random pivot. Pivot lands at its final sorted position. If that position equals the target index, return. Otherwise recurse on ONLY ONE side. Expected O(n) because each partition eliminates ~half the array on average. Random pivot is mandatory — without it, O(n²) worst case on sorted input makes the approach worse than full sort.',
        keyQuestion: 'What is the target index (n-k for kth largest)? After partition, is the pivot to the left or right of target?',
        questionIds: ['LC_215', 'LC_973']
      },
      {
        id: 'P6', name: 'Linear-Time Sort — Bucket / Counting',
        recognitionSignals: [
          'Values or frequencies are bounded in a known range [0, k]',
          'Comparison-based O(n log n) sort is explicitly or implicitly too slow',
          'Maximum gap or spread problem — Pigeonhole principle suggests empty buckets exist'
        ],
        mentalModel: 'Assign each element to a bucket by its bounded key. Each assignment is O(1). Reading all buckets in order is O(n + k). For frequency bucket sort: bucket index IS the frequency value. For gap problems: Pigeonhole guarantees the max gap spans an empty bucket — only adjacent non-empty bucket boundaries need to be compared.',
        keyQuestion: 'What is the bucket index formula? What does each bucket store? What is the range k?',
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
      'LC_253': { leetcode: 253, title: 'Meeting Rooms II', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/meeting-rooms-ii/', templateRefs: ['T3'], tags: ['sorting','interval','greedy','heap','array'], alternateApproaches: [{ technique: 'heap', tradeoff: 'Min-heap of end times. For each meeting sorted by start: if heap top <= current start, pop (that room is free). Always push current end. Heap size at end = min rooms needed. O(n log n) same asymptotic but more intuitive.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Sort by start time. Use a min-heap of end times — the heap represents currently occupied rooms, ordered by when they free up. For each new meeting: if the earliest-ending room is free (heap.top <= start), reuse it (pop and push new end). Otherwise, open a new room (just push). Answer is final heap size.', shrinkTrigger: 'Reuse condition: minHeap.top() <= intervals[i][0]. Pop old end, push new end. Otherwise just push new end.', timeComplexity: 'O(n log n)', spaceComplexity: 'O(n)', gotcha: 'Sort by START time, not end time. The heap tracks end times of active meetings — it is the sort key for the heap, not for the initial array. Mixing up the two sort keys is the single most common bug on this problem.', faangNote: 'Meta phone screen staple — appears in 30%+ of Meta rounds. The heap solution generalises to any "minimum resources" scheduling problem. Say: "The heap represents rooms in use, ordered by when they free up. I greedily reuse the soonest-available room."' },
      'LC_49':  { leetcode: 49,  title: 'Group Anagrams', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/group-anagrams/', templateRefs: ['T4'], tags: ['sorting','hash-map','string','array'], alternateApproaches: [{ technique: 'hash-map', moduleRef: null, tradeoff: 'Use a character frequency array of length 26 as the canonical key instead of sorting. O(n * L) time vs O(n * L log L) for sort-based. Preferred if L is large.', complexity: 'O(n * L) time, O(n * L) space' }], keyInsight: 'Sorting the characters of each string produces the same canonical key for all anagrams. Use this sorted string as a HashMap key. All strings sharing the same sorted key are anagrams of each other.', shrinkTrigger: null, timeComplexity: 'O(n * L log L) where L = average string length', spaceComplexity: 'O(n * L) — map storage', gotcha: 'For better performance with long strings, use a character-count array [0..25] as the key. Convert with counts.join(\'#\') — the \'#\' separator prevents key collisions from distributions sharing the same digit string.', faangNote: null },
      'LC_274': { leetcode: 274, title: 'H-Index', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/h-index/', templateRefs: ['T4'], tags: ['sorting','array','greedy','binary-search'], alternateApproaches: [{ technique: 'binary-search', moduleRef: 'binary-search', tradeoff: 'After sorting, binary search for the boundary index. Same O(n log n) with added complexity and no benefit. Linear scan after sorting is simpler and equally fast.', complexity: 'O(n log n) time, O(1) space' }, { technique: 'counting-sort', moduleRef: null, tradeoff: 'Counting sort on citation counts achieves O(n) total. Only worth it if O(n log n) is too slow.', complexity: 'O(n) time, O(n) space' }], keyInsight: 'Sort citations descending. At index i, there are i+1 papers with at least citations[i] citations. H-index is the largest (i+1) such that citations[i] >= i+1. Stop on the first index where this fails.', shrinkTrigger: null, timeComplexity: 'O(n log n) — sort dominates', spaceComplexity: 'O(1) — in-place sort, single scan', gotcha: 'Return h (not i) at the end. If the loop completes without breaking, h-index is n (all papers qualify). Missing the full-loop case returns 0 instead of n.', faangNote: null },
      'LC_215': { leetcode: 215, title: 'Kth Largest Element in an Array', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/kth-largest-element-in-an-array/', templateRefs: ['T5'], tags: ['sorting','quickselect','heap','divide-and-conquer','array'], alternateApproaches: [{ technique: 'heap', moduleRef: 'heap', tradeoff: 'Min-heap of size k: push each element, pop when size > k. O(n log k) time, O(k) space. Better when k << n. Use heap if input must not be modified.', complexity: 'O(n log k) time, O(k) space' }, { technique: 'sorting', moduleRef: null, tradeoff: 'Full sort then return index n-k. O(n log n) — strictly worse than O(n) quickselect.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Map kth largest to (n-k)th smallest (0-indexed). Partition around a random pivot. Pivot lands at its final sorted position. If that equals target index, return. Otherwise recurse on exactly one side.', shrinkTrigger: 'If pivotPos === target return nums[pivotPos]. If pivotPos < target recurse RIGHT. If pivotPos > target recurse LEFT.', timeComplexity: 'O(n) expected, O(n²) worst case without random pivot', spaceComplexity: 'O(1) — in-place partition, O(log n) recursion stack', gotcha: 'Random pivot is NOT optional. Without it, a sorted input causes pivotPos to always equal left — O(n²) total. State this explicitly in the interview.', faangNote: 'Know both approaches (quickselect and min-heap) and choose based on constraints. Stating the trade-off is a strong signal.' },
      'LC_973': { leetcode: 973, title: 'K Closest Points to Origin', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/k-closest-points-to-origin/', templateRefs: ['T5'], tags: ['sorting','quickselect','heap','array','divide-and-conquer'], alternateApproaches: [{ technique: 'heap', moduleRef: 'heap', tradeoff: 'Max-heap of size k: if current distance < heap max, pop max and push current. O(n log k) — preferred when k is small and input must not be modified.', complexity: 'O(n log k) time, O(k) space' }, { technique: 'sorting', moduleRef: null, tradeoff: 'Sort all points by distance, return first k. O(n log n) — acceptable for small n but suboptimal.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Quickselect on squared Euclidean distance (avoid sqrt). Target index is k-1. After partitioning, return ALL elements from 0 to k-1 — not necessarily in sorted order, but that is not required.', shrinkTrigger: 'Distance comparator: compare x*x + y*y of pivot against each element. Recurse on the side containing index k-1.', timeComplexity: 'O(n) expected', spaceComplexity: 'O(1) excluding output', gotcha: 'Compare squared distances (x*x + y*y) to avoid floating-point sqrt errors. The k elements in [0..k-1] are in any order — add a sort if ordered output is required.', faangNote: '\'I use quickselect with squared Euclidean distance — same technique as Kth Largest, targeting index k-1 instead of n-k.\' Recognizing this pattern connection is the mastery signal.' },
      'LC_347': { leetcode: 347, title: 'Top K Frequent Elements', difficulty: 'Medium', difficultyRank: 2, link: 'https://leetcode.com/problems/top-k-frequent-elements/', templateRefs: ['T6'], tags: ['sorting','bucket-sort','hash-map','heap','array'], alternateApproaches: [{ technique: 'heap', moduleRef: 'heap', tradeoff: 'Min-heap of size k tracking (frequency, element) pairs. O(n log k) time, O(n + k) space. Better when k is small. Bucket sort is O(n) but requires O(n) bucket space.', complexity: 'O(n log k) time, O(n + k) space' }, { technique: 'sorting', moduleRef: null, tradeoff: 'Count frequencies with a map, sort by frequency descending, return first k. O(n log n) — dominated by O(n) bucket sort.', complexity: 'O(n log n) time, O(n) space' }], keyInsight: 'Bucket index IS the frequency. Create n+1 buckets (index 0 unused, max frequency = n). Place each element into the bucket matching its frequency. Scan from high index to low, collect elements until k are gathered.', shrinkTrigger: null, timeComplexity: 'O(n) — counting and bucket assignment each O(n), scan O(n)', spaceComplexity: 'O(n) — frequency map and buckets', gotcha: 'Create n+1 buckets (indices 0 to n inclusive). Maximum possible frequency is n (all elements identical). Using n buckets misses frequency = n — off-by-one produces array-out-of-bounds.', faangNote: 'The O(n) bucket sort solution signals mastery. Know both bucket sort and heap and state the trade-off.' },
      'LC_164': { leetcode: 164, title: 'Maximum Gap', difficulty: 'Hard', difficultyRank: 3, link: 'https://leetcode.com/problems/maximum-gap/', templateRefs: ['T6'], tags: ['sorting','bucket-sort','array'], alternateApproaches: [{ technique: 'sorting', moduleRef: null, tradeoff: 'Comparison-based sort then scan adjacent pairs. O(n log n) — fails the O(n) time requirement. This is the suboptimal solution the problem is designed to rule out.', complexity: 'O(n log n) time, O(1) space' }], keyInsight: 'Pigeonhole principle: n elements in range [min, max] placed into n-1 buckets means at least one bucket is empty. The maximum gap CANNOT be between two elements in the same bucket — must cross an empty bucket. Compare each bucket min against the previous non-empty bucket max.', shrinkTrigger: 'Bucket index: Math.floor((num - min) / bucketSize) where bucketSize = Math.ceil((max - min) / (n - 1)). Track each bucket\'s min and max only.', timeComplexity: 'O(n) — bucket assignment and scan each O(n)', spaceComplexity: 'O(n) — n-1 buckets', gotcha: 'If all elements are equal (max === min), return 0 before computing bucketSize. Division by zero occurs: bucketSize = ceil(0 / (n-1)) = 0.', faangNote: '\'With n elements across n-1 buckets, at least one bucket is empty by Pigeonhole. The max gap must cross an empty bucket — track each bucket\'s min and max only.\' The Pigeonhole argument IS the interview.' },
      'LC_220': { leetcode: 220, title: 'Contains Duplicate III', difficulty: 'Hard', templateRefs: ['T6'], tags: ['sorting','bucket-sort','sliding-window','array','hash-map'], keyInsight: 'Create buckets of size t+1. Element x maps to bucket id = floor(x/(t+1)). Two elements in the same bucket are guaranteed within t of each other. Also check left and right adjacent buckets with one comparison each. Maintain at most k active buckets — delete the bucket of the outgoing element on every window slide.', shrinkTrigger: 'Window slide: when i >= k, delete bucket of nums[i-k]. Check new element: same bucket exists, OR left bucket has element with |diff| <= t, OR right bucket has element with |diff| <= t.', timeComplexity: 'O(n) — each element inserted and deleted at most once', spaceComplexity: 'O(min(n, k)) — at most k active buckets', gotcha: 'JavaScript Math.floor on negative numbers rounds toward -Infinity. Use: id = x >= 0 ? Math.floor(x / (t+1)) : Math.floor((x + 1) / (t + 1)) - 1. Without this fix, negative values get wrong bucket ids and the same-bucket guarantee breaks.', faangNote: 'Know both approaches: bucket sort O(n) and sorted-set O(n log k). The interview signal: "Bucket sort maps VALUE proximity to ARRAY INDEX equality — two elements in the same bucket are automatically within t, no explicit comparison needed. Adjacent buckets still need one comparison each." The zero-comparison property for same-bucket elements is the O(n) insight.', alternateApproaches: [{ technique: 'sorted-set', tradeoff: 'Maintain a sorted window of k most recent elements. For each new element x, binary search for any element in [x-t, x+t]. O(n log k) time, O(k) space. Simpler to reason about but requires a BST sorted set not native to JavaScript.', complexity: 'O(n log k) time, O(k) space' }], link: 'https://leetcode.com/problems/contains-duplicate-iii/' }
    }
  }
  ,
  'heap': {
    description: 'A complete binary tree stored as an array that maintains the heap property: parent is always smaller than its children (min-heap) or larger (max-heap). In FAANG interviews, heap appears in four distinct forms: (1) maintaining the K largest/smallest elements from a stream in O(log k) per insertion, (2) merging K sorted sequences efficiently, (3) maintaining a dynamic median by partitioning a stream into two halves, and (4) greedy algorithms requiring the globally best remaining choice at each step. JavaScript and TypeScript have no built-in heap — you must implement one or simulate using sorted structures.',
    goal: 'Cover 90% of FAANG Heap questions by mastering 4 patterns, 5 templates, and 16 curated problems',
    relatedTopics: ['sorting', 'binary-search', 'greedy'],
    tagRegistry: ['heap','min-heap','max-heap','priority-queue','top-k','k-way-merge','two-heaps','median','greedy','lazy-expansion','streaming','scheduling','array','string','linked-list','matrix','sliding-window','hash-map','sorting','binary-search'],
    techniqueRegistry: ['heap','greedy','sorting','two-pointers','sliding-window','binary-search','hash-map'],
    interviewTips: [
      'State min or max heap and WHY in one sentence before coding. \'I need a min-heap of size k because the heap top is always the k-th largest — anything smaller gets ejected.\' That sentence is its own scoring signal.',
      'JavaScript has no built-in heap. In an interview: (1) implement MinHeap from T1 in 3 minutes, or (2) ask \'Can I assume a PriorityQueue exists?\' and declare its interface. Clarify before starting — never assume silently.',
      'LC_295 (Median from Stream): articulate BOTH invariants before writing a single line — (1) lower.top ≤ upper.top, (2) |lower.size − upper.size| ≤ 1. Missing either produces wrong medians. Interviewers explicitly probe both.',
      'LC_480 (Sliding Window Median): the term to name is lazy deletion. Say: \'Heaps have no O(log n) arbitrary removal. I mark evicted elements in a deleteMap and discard them lazily when they surface as the heap top.\' Full explanation before the code.',
      'LC_1642 (Furthest Building) regret-based greedy: \'I assign ladders optimistically to every climb. When ladders run out, I swap the cheapest past ladder-use for bricks via the min-heap — retroactively fixing the most affordable mistake.\' Say the strategy before writing code.',
      "When alternateApproaches lists bucket sort vs heap (e.g. LC_347): say 'Bucket sort is O(n) here because frequency is bounded by array length. Heap is O(n log k) but generalises to any ranked collection — I lead with heap unless O(n) is explicitly required.'"
    ],

    whenToUse: {
      use: [
        'You need repeated access to the MINIMUM or MAXIMUM of a dynamic set — heap gives O(log n) insert and O(1) peek, O(log n) extract. Sorting once is O(n log n) but does not handle dynamic insertions.',
        'Problem involves maintaining the TOP K elements from a stream or large array — min-heap of size k ejects the smallest on every overflow, keeping exactly the k largest at all times.',
        'You need to MERGE K sorted sequences and extract elements in global sorted order — K-way merge with a heap gives O(n log k) vs O(nk) naive.',
        'Problem requires a RUNNING MEDIAN or partitioning a dynamic stream into two balanced halves — two-heap pattern (max-heap lower half + min-heap upper half) gives O(log n) insert and O(1) median.'
      ],
      avoid: [
        'You need the kth element from a STATIC array and O(n) time is acceptable — quickselect is strictly better (O(n) expected, O(1) space). Heap is O(n log k) and uses O(k) space.',
        'All elements are known UPFRONT and you only need the top k once — sort descending and take the first k. O(n log n) sort is simpler than heap management when no streaming is needed.',
        'You need to DELETE an ARBITRARY element efficiently — heaps only support O(1) delete of the top. Arbitrary deletion is O(n) unless you use lazy deletion (mark + skip). For frequent arbitrary deletes, consider a balanced BST.',
        'Problem requires the EXACT sorted order of all elements — heap only guarantees the top is optimal. For full sorted output use merge sort O(n log n). Extracting all n elements from a heap is O(n log n) — same as sorting but with more overhead.'
      ]
    },
    decisionTree: {
      description: 'Walk this tree before writing any code. Every heap pattern uses a different heap structure — wrong choice produces wrong complexity or incorrect results.',
      node: {
        id: 'root',
        question: 'Do you need a RUNNING MEDIAN or must you efficiently partition a dynamic stream into two equal halves?',
        yes: { leaf: { id: 'leaf-p3-t4', pattern: 'P3', template: 'T4', label: 'Two Heaps — max-heap for lower half, min-heap for upper half, balance after each insert', exampleProblems: ['LC_295', 'LC_480'] } },
        no: {
          node: {
            id: 'kway-check',
            question: 'Are there MULTIPLE SORTED SEQUENCES (lists, arrays, matrix rows) to merge or extract the global minimum from?',
            yes: { leaf: { id: 'leaf-p2-t3', pattern: 'P2', template: 'T3', label: 'K-Way Merge — push one element per sorted source into a min-heap, always pop global min and push its successor', exampleProblems: ['LC_23', 'LC_378', 'LC_632'] } },
            no: {
              node: {
                id: 'greedy-check',
                question: 'Is the problem about SCHEDULING, REORGANIZING, or making greedy choices where the globally most frequent or largest remaining element determines the next step?',
                yes: { leaf: { id: 'leaf-p4-t5', pattern: 'P4', template: 'T5', label: 'Greedy + Max Heap — always process the highest-frequency or highest-value element next. Use a cooldown queue if re-insertion is delayed.', exampleProblems: ['LC_767', 'LC_621', 'LC_1642'] } },
                no: {
                  node: {
                    id: 'topk-check',
                    question: 'Are you finding the K-TH element or maintaining the TOP K elements from a stream or large array?',
                    yes: {
                      node: {
                        id: 'topk-lazy-check',
                        question: 'Are candidates generated lazily — new candidates depend on previously extracted minimums (not all candidates known upfront)?',
                        yes: { leaf: { id: 'leaf-p1-lazy',  pattern: 'P1', template: 'T2', label: 'Top K with Lazy Expansion — push seed elements, pop minimum, push its neighbours', exampleProblems: ['LC_373'] } },
                        no:  { leaf: { id: 'leaf-p1-mink',  pattern: 'P1', template: 'T2', label: 'Top K with Min-Heap of Size K — maintain a min-heap; eject smallest when size exceeds K', exampleProblems: ['LC_703', 'LC_215', 'LC_347'] } }
                      }
                    },
                    no: { leaf: { id: 'leaf-unknown', pattern: null, template: null, label: 'Heap may not be the primary technique. Reconsider: (1) is this a sorting problem? (2) is this a monotonic stack/deque problem? (3) is O(n log n) acceptable — if so, sorting may be simpler.' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    templates: [
      {
        id: 'T1', name: 'MinHeap — Generic Implementation',
        description: 'JavaScript and TypeScript have no built-in heap. This MinHeap accepts a comparator so it can serve as both a min-heap and a max-heap (negate the comparator). bubbleUp runs after push; sinkDown runs after pop. Both are O(log n). Comparator contract: return negative if a should be at the top (extracted first), positive if b should be at the top.',
        code: 'class MinHeap {\n  constructor(comparator) {\n    this.heap = [];\n    this.comparator = comparator;\n  }\n\n  push(val) {\n    this.heap.push(val);\n    this._bubbleUp(this.heap.length - 1);\n  }\n\n  pop() {\n    if (this.heap.length === 0) return undefined;\n    const top = this.heap[0];\n    const last = this.heap.pop();\n    if (this.heap.length > 0) {\n      this.heap[0] = last;\n      this._sinkDown(0);\n    }\n    return top;\n  }\n\n  peek()    { return this.heap[0]; }\n  size()    { return this.heap.length; }\n  isEmpty() { return this.heap.length === 0; }\n\n  _bubbleUp(i) {\n    while (i > 0) {\n      const parent = Math.floor((i - 1) / 2);\n      if (this.comparator(this.heap[i], this.heap[parent]) < 0) {\n        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];\n        i = parent;\n      } else break;\n    }\n  }\n\n  _sinkDown(i) {\n    const n = this.heap.length;\n    while (true) {\n      let best = i;\n      const left  = 2 * i + 1;\n      const right = 2 * i + 2;\n      if (left  < n && this.comparator(this.heap[left],  this.heap[best]) < 0) best = left;\n      if (right < n && this.comparator(this.heap[right], this.heap[best]) < 0) best = right;\n      if (best === i) break;\n      [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];\n      i = best;\n    }\n  }\n}\n\n// Min-heap by value:  new MinHeap((a, b) => a - b)\n// Max-heap by value:  new MinHeap((a, b) => b - a)\n// Min-heap by .freq:  new MinHeap((a, b) => a.freq - b.freq)'
      },
      {
        id: 'T2', name: 'Top K Pattern — Min-Heap of Size K',
        description: 'Maintain a min-heap of EXACTLY K elements. The heap top is always the K-th largest seen so far. For each new element: push it; if heap size exceeds K, pop the minimum. For LAZY EXPANSION (candidates generated dynamically): push only seed elements initially, then after each pop push that element\'s valid neighbours.',
        code: '// --- Standard Top K: min-heap of size K ---\nfunction findKthLargest(nums, k) {\n  const minHeap = new MinHeap((a, b) => a - b);\n  for (const num of nums) {\n    minHeap.push(num);\n    if (minHeap.size() > k) minHeap.pop();\n  }\n  return minHeap.peek(); // K-th largest\n}\n\n// --- Lazy Expansion: push neighbours on pop (LC_373) ---\nfunction kSmallestPairs(nums1, nums2, k) {\n  if (!nums1.length || !nums2.length) return [];\n  // Seed: first column of the implicit sum grid\n  const minHeap = new MinHeap((a, b) => a[0] - b[0]); // [sum, i, j]\n  for (let i = 0; i < Math.min(nums1.length, k); i++) {\n    minHeap.push([nums1[i] + nums2[0], i, 0]);\n  }\n  const result = [];\n  while (result.length < k && !minHeap.isEmpty()) {\n    const [, i, j] = minHeap.pop();\n    result.push([nums1[i], nums2[j]]);\n    if (j + 1 < nums2.length) minHeap.push([nums1[i] + nums2[j + 1], i, j + 1]);\n  }\n  return result;\n}'
      },
      {
        id: 'T3', name: 'K-Way Merge',
        description: 'Given K sorted sequences, maintain a min-heap with exactly one element per sequence — always the current minimum of that sequence. Pop the global minimum; push its successor from the same sequence. Total complexity O(n log K) where n = total elements.',
        code: '// --- K-Way Merge on Linked Lists (LC_23) ---\nfunction mergeKLists(lists) {\n  // [value, listIndex, node]\n  const minHeap = new MinHeap((a, b) => a[0] - b[0]);\n  for (let i = 0; i < lists.length; i++) {\n    if (lists[i]) minHeap.push([lists[i].val, i, lists[i]]);\n  }\n  const dummy = { val: 0, next: null };\n  let curr = dummy;\n  while (!minHeap.isEmpty()) {\n    const [, , node] = minHeap.pop();\n    curr.next = node;\n    curr = curr.next;\n    if (node.next) minHeap.push([node.next.val, 0, node.next]);\n  }\n  return dummy.next;\n}\n\n// --- K-Way Merge on Matrix (LC_378) ---\nfunction kthSmallestMatrix(matrix, k) {\n  const n = matrix.length;\n  const minHeap = new MinHeap((a, b) => a[0] - b[0]); // [value, row, col]\n  for (let r = 0; r < n; r++) minHeap.push([matrix[r][0], r, 0]);\n  let result = 0;\n  for (let count = 0; count < k; count++) {\n    const [val, r, c] = minHeap.pop();\n    result = val;\n    if (c + 1 < n) minHeap.push([matrix[r][c + 1], r, c + 1]);\n  }\n  return result;\n}'
      },
      {
        id: 'T4', name: 'Two Heaps — Dynamic Median',
        description: 'Lower half in a max-heap (top = largest in lower half). Upper half in a min-heap (top = smallest in upper half). Invariant after every insert: (1) lower.top <= upper.top, (2) sizes differ by at most 1. Median: average of both tops (even count) or lower.top (odd count). For sliding window, use lazy deletion via a deleteMap to handle removals.',
        code: 'class MedianFinder {\n  constructor() {\n    this.lower = new MinHeap((a, b) => b - a); // max-heap\n    this.upper = new MinHeap((a, b) => a - b); // min-heap\n  }\n\n  addNum(num) {\n    this.lower.push(num); // always push to lower first\n    // Enforce cross-heap invariant\n    if (!this.upper.isEmpty() && this.lower.peek() > this.upper.peek()) {\n      this.upper.push(this.lower.pop());\n    }\n    // Rebalance sizes\n    if (this.lower.size() > this.upper.size() + 1) {\n      this.upper.push(this.lower.pop());\n    } else if (this.upper.size() > this.lower.size()) {\n      this.lower.push(this.upper.pop());\n    }\n  }\n\n  findMedian() {\n    if (this.lower.size() === this.upper.size()) {\n      return (this.lower.peek() + this.upper.peek()) / 2;\n    }\n    return this.lower.peek();\n  }\n}\n\n// Lazy deletion note (LC_480 sliding window median):\n// Maintain a Map deleteCount tracking elements to skip.\n// When popping, discard elements in deleteCount (decrement; remove when 0).\n// Track effective sizes separately (physical size minus pending deletions).'
      },
      {
        id: 'T5', name: 'Greedy + Max Heap (Scheduling / Reorganizing)',
        description: 'Greedy problems where the next choice should always be the globally most frequent or highest-value remaining element. Use a max-heap keyed by frequency or value. For COOLDOWN scheduling: hold used elements in a queue for n steps before re-pushing. For REGRET-BASED greedy (LC_1642): maintain a min-heap of past choices — swap the current expensive choice with the cheapest past one when the expensive resource runs out.',
        code: '// --- Reorganize String (LC_767) ---\nfunction reorganizeString(s) {\n  const freq = new Map();\n  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);\n  const maxHeap = new MinHeap((a, b) => b[0] - a[0]); // [count, char]\n  for (const [char, count] of freq) maxHeap.push([count, char]);\n  let result = \'\';\n  while (maxHeap.size() >= 2) {\n    const [cnt1, ch1] = maxHeap.pop();\n    const [cnt2, ch2] = maxHeap.pop();\n    result += ch1 + ch2;\n    if (cnt1 - 1 > 0) maxHeap.push([cnt1 - 1, ch1]);\n    if (cnt2 - 1 > 0) maxHeap.push([cnt2 - 1, ch2]);\n  }\n  if (!maxHeap.isEmpty()) {\n    const [cnt, ch] = maxHeap.pop();\n    if (cnt > 1) return \'\';\n    result += ch;\n  }\n  return result;\n}\n\n// --- Task Scheduler with cooldown (LC_621) ---\nfunction leastInterval(tasks, n) {\n  const freq = new Array(26).fill(0);\n  for (const t of tasks) freq[t.charCodeAt(0) - 65]++;\n  const maxHeap = new MinHeap((a, b) => b - a);\n  for (const f of freq) if (f > 0) maxHeap.push(f);\n  let time = 0;\n  const cooldownQueue = []; // [remaining_count, earliest_reuse_time]\n  while (!maxHeap.isEmpty() || cooldownQueue.length > 0) {\n    time++;\n    if (!maxHeap.isEmpty()) {\n      const cnt = maxHeap.pop() - 1;\n      if (cnt > 0) cooldownQueue.push([cnt, time + n]);\n    }\n    if (cooldownQueue.length > 0 && cooldownQueue[0][1] === time) {\n      maxHeap.push(cooldownQueue.shift()[0]);\n    }\n  }\n  return time;\n}'
      }
    ],
    patterns: [
      {
        id: 'P1', name: 'Top K / Kth Element with Min-Heap',
        recognitionSignals: [
          'Find the K-th largest or smallest element',
          'Maintain the top K elements from a stream or large array without sorting everything',
          'New candidates are generated lazily — each extracted minimum generates the next candidates'
        ],
        mentalModel: 'A min-heap of size K acts as a filter: the heap top is always the K-th largest. Any new element larger than the top displaces it; smaller elements are ignored. For lazy expansion: push only seeds initially; after each pop, push that element\'s valid successors to avoid materialising all O(n²) candidates.',
        keyQuestion: 'Are all candidates known upfront (standard min-heap of size K) or generated dynamically (lazy expansion — push neighbours on pop)?',
        questionIds: ['LC_703', 'LC_215', 'LC_347', 'LC_373', 'LC_355', 'LC_1167']
      },
      {
        id: 'P2', name: 'K-Way Merge',
        recognitionSignals: [
          'Multiple sorted lists, arrays, or matrix rows that must be merged or searched globally',
          'Finding the K-th smallest across K sorted sequences',
          'The input is a set of sorted sources — extracting elements one by one in global sorted order'
        ],
        mentalModel: 'Seed the heap with one element from each sorted source (the current minimum of each). Pop the global minimum; push its successor from the same source. The heap always holds one representative per active source. Total cost: O(n log K) where n = total elements and K = number of sources.',
        keyQuestion: 'What is each source? What is the successor of a popped element within its source?',
        questionIds: ['LC_23', 'LC_378', 'LC_632']
      },
      {
        id: 'P3', name: 'Two Heaps — Dynamic Median',
        recognitionSignals: [
          'Find the running median of a growing stream',
          'Sliding window median — add and remove elements dynamically',
          'Partition a dynamic dataset into two halves where both halves need their extreme value quickly'
        ],
        mentalModel: 'Lower half in a max-heap (top = largest lower element). Upper half in a min-heap (top = smallest upper element). Invariant: lower.top <= upper.top AND |lower.size - upper.size| <= 1. Insert: always to lower first, then fix the cross-heap invariant, then rebalance sizes. Median is either lower.top (odd total) or average of both tops (even total).',
        keyQuestion: 'After inserting, does the cross-heap invariant still hold? Are the sizes balanced?',
        questionIds: ['LC_295', 'LC_480']
      },
      {
        id: 'P4', name: 'Greedy + Max Heap',
        recognitionSignals: [
          'Scheduling tasks with cooldowns or constraints — always process the most frequent task next',
          'Reorganizing elements so no two identical elements are adjacent',
          'At each step, the globally best remaining choice must be made — heap provides O(log n) argmax'
        ],
        mentalModel: 'Max-heap ensures the best available option is O(log n) accessible. For cooldown scheduling: hold elements in a queue; re-insert once cooldown expires. For regret-based greedy (LC_1642): maintain a min-heap of past choices — if the current step is too expensive, swap it with the cheapest past choice.',
        keyQuestion: 'What is the best element at each step? Does it need a cooldown before it can be reused? Can a past decision be reversed?',
        questionIds: ['LC_767', 'LC_621', 'LC_1642', 'LC_502', 'LC_218']
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
      'LC_1167': { leetcode: 1167, title: 'Minimum Cost to Connect Sticks', difficulty: 'Medium', templateRefs: ['T2'], tags: ['heap','min-heap','greedy','array'], keyInsight: 'Always combine the two shortest sticks first (Huffman greedy). Pop the two minimums, compute cost = their sum, push the sum back, and add cost to the running total. The combined stick participates in future combinations — the heap feedback loop is the pattern. Each of the n-1 combination steps is O(log n).', shrinkTrigger: 'While heap.size() > 1: pop a and b (two minimums). cost += a + b. push(a + b). Return total cost.', timeComplexity: 'O(n log n) — n-1 pop-pairs and n-1 pushes', spaceComplexity: 'O(n) — heap', gotcha: 'The sum pushed back IS a valid input for future steps — do not discard it after adding to cost. This feedback (output of step i becomes input of step i+1) is the defining property of the pattern and what distinguishes it from a simple one-pass top-K problem.', faangNote: 'Amazon asks this in ~20% of heap rounds. The pattern name interviewers expect: Huffman coding greedy. Say: "Combining cheapest sticks first minimizes total cost because every stick participates in all future combinations it merges into — deferring cheap combinations is never better." The pop-combine-push feedback loop applies to any minimum-cost aggregation problem.', alternateApproaches: [], link: 'https://leetcode.com/problems/minimum-cost-to-connect-sticks/' }
    }
  }
  // ← Add new topic modules here
}
/* ═══ END DATA.JS ═══════════════════════════════════════════════════════════ */