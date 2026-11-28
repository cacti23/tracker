// 📓 Notebook (index.html) · The Notes tab and note saving.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── NOTES TAB ────────────────────────────────────────────────────────────────
// Standalone "things to remember" notes, scoped to the current topic. Storage +
// accessors live in data.js (TOPIC_NOTES_KEY / getTopicNotes / upsertTopicNote …).
let _editingNoteId = null   // null = not editing; '__new__' = adding; else a note id

// The open editor's text, per topic: { [topicKey]: { id, title, body } }. The inputs alone are not
// enough — every re-render (pinning or deleting another note, a topic switch, a reload) rebuilt
// them from the SAVED note and silently threw away what you'd typed. Kept in sessionStorage so a
// reload of this tab brings it back; not localStorage, because a half-typed draft isn't data to sync.
const NOTE_DRAFTS_KEY = 'dsa-note-drafts-v1'
let _noteDraftsMem = null
let _noteEditorTopic = null   // topic whose editor inputs are in the page right now (null = none)
function _noteDrafts() {
  if (!_noteDraftsMem) {
    try { _noteDraftsMem = JSON.parse(sessionStorage.getItem(NOTE_DRAFTS_KEY) || '{}') || {} } catch { _noteDraftsMem = {} }
  }
  return _noteDraftsMem
}
function _setNoteDraft(topicKey, draft) {
  const all = _noteDrafts()
  if (draft) all[topicKey] = draft; else delete all[topicKey]
  try { sessionStorage.setItem(NOTE_DRAFTS_KEY, JSON.stringify(all)) } catch {}
}
// Copy the open editor's inputs into the draft (oninput does this on every keystroke; this also
// runs before any re-render, so nothing typed is lost even if an input event was missed).
function _captureNoteDraft() {
  if (!_editingNoteId || !currentTopicKey || _noteEditorTopic !== currentTopicKey) return
  const t = document.getElementById('note-edit-title')
  const b = document.getElementById('note-edit-body')
  if (!t || !b) return
  _setNoteDraft(currentTopicKey, { id: _editingNoteId, title: t.value, body: b.value })
}
// Leaving a topic: keep its draft only if it says something the saved note doesn't (an untouched
// editor just closes, as before).
function _parkNoteDraft() {
  _captureNoteDraft()
  _noteEditorTopic = null   // the topic page is about to be rebuilt
  if (!currentTopicKey) return
  const d = _noteDrafts()[currentTopicKey]
  if (!d) return
  const saved = d.id === '__new__' ? { title: '', body: '' } : getTopicNotes(currentTopicKey).find(x => x.id === d.id)
  const same = saved && (d.title || '') === (saved.title || '') && (d.body || '') === (saved.body || '')
  if (same || !saved) _setNoteDraft(currentTopicKey, null)
}

// Tiny safe markdown: escape first, then apply - bullets, **bold**, `code`.
// Markdown → HTML for notes. Escapes first (XSS-safe even though notes sync via gist),
// then handles: # headings, **bold**, *italic*, `code`, ```fenced blocks```, - / 1. lists,
// > blockquotes, --- rules, ~~strike~~, [text](url), GFM | pipe | tables |. Code spans/blocks
// are protected so inline markup inside them (and things like snake_case) are never reformatted.
function renderNoteBody(text) {
  if (!text || !text.trim()) return '<p class="text-faint">(empty)</p>'
  const esc = escHtml(text)

  // 1) Pull fenced code blocks out so their contents are never touched.
  // Language on the fence (```typescript) becomes both a header label and a Prism
  // language-xxx class — the autoloader plugin fetches whatever grammar that names.
  const blocks = []
  const src = esc.replace(/```([^\n]*)\n?([\s\S]*?)```/g, (_, lang, c) => {
    const tag = lang.trim().toLowerCase()
    return '@@CB' + (blocks.push(
      '<div class="note-code-wrap">' +
      (tag ? '<div class="note-code-lang">' + tag + '</div>' : '') +
      '<pre class="note-code"><code class="language-' + (tag || 'none') + '">' + c.replace(/\n$/, '') + '</code></pre>' +
      '</div>'
    ) - 1) + '@@'
  })

  // 2) Inline formatting — protect `code` spans first so * / ** inside them are left alone.
  const inline = s => {
    const spans = []
    s = s.replace(/`([^`]+)`/g, (_, c) => '@@CS' + (spans.push('<code>' + c + '</code>') - 1) + '@@')
    s = s
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    return s.replace(/@@CS(\d+)@@/g, (_, i) => spans[+i])
  }

  // 3) Block-level pass.
  let html = '', listType = null
  const closeList = () => { if (listType) { html += listType === 'ol' ? '</ol>' : '</ul>'; listType = null } }
  // GFM pipe-table row → cells (strip optional outer pipes, split, trim). No escaped-pipe support.
  const splitRow = line => { let s = line.trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|')) s = s.slice(0, -1); return s.split('|').map(c => c.trim()) }
  const tableSep = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/
  let m
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const cb = raw.match(/^@@CB(\d+)@@$/)
    if (cb) { closeList(); html += blocks[+cb[1]]; continue }
    const t = raw.trim()
    if (!t) { closeList(); continue }
    if (t.includes('|') && lines[i + 1] && tableSep.test(lines[i + 1].trim())) {                            // pipe-table: header + separator row
      closeList()
      const header = splitRow(t)
      const aligns = splitRow(lines[i + 1].trim()).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : '')
      const rows = []
      let j = i + 2
      while (j < lines.length && lines[j].trim().includes('|')) { rows.push(splitRow(lines[j])); j++ }
      const cell = (tag, c, k) => '<' + tag + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(c || '') + '</' + tag + '>'
      html += '<table class="note-table"><thead><tr>' + header.map((c, k) => cell('th', c, k)).join('') + '</tr></thead>'
      if (rows.length) html += '<tbody>' + rows.map(r => '<tr>' + header.map((_, k) => cell('td', r[k], k)).join('') + '</tr>').join('') + '</tbody>'
      html += '</table>'
      i = j - 1
      continue
    }
    if (/^([-*_])(\s*\1){2,}$/.test(t)) { closeList(); html += '<hr class="note-hr">'; continue }            // --- *** ___
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) { closeList(); const l = m[1].length; html += '<h' + l + ' class="note-h note-h' + l + '">' + inline(m[2]) + '</h' + l + '>'; continue }
    if ((m = t.match(/^&gt;\s?(.*)$/)))    { closeList(); html += '<blockquote class="note-quote">' + inline(m[1]) + '</blockquote>'; continue }  // > is &gt; after escHtml
    if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) { if (listType !== 'ol') { closeList(); html += '<ol class="note-bullets">'; listType = 'ol' } html += '<li>' + inline(m[2]) + '</li>'; continue }
    if ((m = t.match(/^[-*+•]\s+(.*)$/)))  { if (listType !== 'ul') { closeList(); html += '<ul class="note-bullets">'; listType = 'ul' } html += '<li>' + inline(m[1]) + '</li>'; continue }
    closeList(); html += '<p>' + inline(t) + '</p>'
  }
  closeList()
  // Safety net: restore any fenced-block placeholders that weren't on their own line.
  html = html.replace(/@@CB(\d+)@@/g, (_, i) => blocks[+i])
  return html || '<p class="text-faint">(empty)</p>'
}

// Accordion open/closed state — per-device UI preference (not synced), keyed by topic.
// No stored entry for a topic = first visit → pinned notes default open.
const NOTES_OPEN_KEY = 'dsa-notes-open-v1'
let _noteQuery = ''   // live search filter; reset on topic switch

function _openNoteSet(notes) {
  try {
    const all = _readMap(NOTES_OPEN_KEY)
    if (Object.prototype.hasOwnProperty.call(all, currentTopicKey)) return new Set(all[currentTopicKey])
  } catch {}
  return new Set(notes.filter(n => n.pinned).map(n => n.id))
}
function _saveOpenNoteSet(set) {
  try {
    const all = _readMap(NOTES_OPEN_KEY)
    all[currentTopicKey] = [...set]
    localStorage.setItem(NOTES_OPEN_KEY, JSON.stringify(all))
  } catch {}
}

function toggleNoteOpen(id) {
  const open = _openNoteSet(getTopicNotes(currentTopicKey))
  open.has(id) ? open.delete(id) : open.add(id)
  _saveOpenNoteSet(open)
  _renderNotesList()
}

function toggleAllNotes() {
  const notes = getTopicNotes(currentTopicKey)
  const open = _openNoteSet(notes)
  const allOpen = notes.length > 0 && notes.every(n => open.has(n.id))
  _saveOpenNoteSet(allOpen ? new Set() : new Set(notes.map(n => n.id)))
  _renderNotesList()
}

function _onNoteSearch(v) { _noteQuery = v; _renderNotesList() }

// Escape-safe title highlighting: match on the raw string, escape the pieces.
function _hlNoteTitle(title, q) {
  if (!q) return escHtml(title)
  const lower = title.toLowerCase()
  let out = '', i = 0, j
  while ((j = lower.indexOf(q, i)) !== -1) {
    out += escHtml(title.slice(i, j)) + '<mark>' + escHtml(title.slice(j, j + q.length)) + '</mark>'
    i = j + q.length
  }
  return out + escHtml(title.slice(i))
}

function noteAccItem(n, isOpen, q) {
  // n.id comes from storage, and storage can be filled by an imported backup or the gist, so it
  // is escaped like any other data: as an HTML attribute, and as a JS string inside onclick.
  const idAttr = escHtml(n.id)
  const date = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
  return '<div class="note-acc' + (isOpen ? ' open' : '') + (n.pinned ? ' pinned' : '') + '" id="note-card-' + idAttr + '">' +
    '<div class="note-acc-head" data-click="toggleNoteOpen" data-args="' + Actions.attrArgs([String(n.id)]) + '">' +
    '<span class="note-acc-chev">▶</span>' +
    '<span class="note-acc-title">' + (n.pinned ? '📌 ' : '') + _hlNoteTitle(n.title || 'Untitled', q) + '</span>' +
    '<span class="note-acc-meta">' + date + '</span>' +
    '<span class="note-card-actions" data-click="stop" data-stop>' +
    '<button title="' + (n.pinned ? 'Unpin' : 'Pin to top') + '" data-click="toggleTopicNotePin" data-args="' + Actions.attrArgs([String(n.id)]) + '">📌</button>' +
    '<button title="Print" data-click="printTopicNote" data-args="' + Actions.attrArgs([String(n.id)]) + '">🖨️</button>' +
    '<button title="Edit" data-click="editTopicNote" data-args="' + Actions.attrArgs([String(n.id)]) + '">✏️</button>' +
    '<button title="Delete" data-click="removeTopicNote" data-args="' + Actions.attrArgs([String(n.id)]) + '">🗑️</button>' +
    '</span></div>' +
    '<div class="note-acc-body"><div class="note-card-body">' + renderNoteBody(n.body) + '</div></div>' +
    '</div>'
}

// Print a single note: fill #print-note-host with just this note's title + rendered body,
// hide the rest of the app via body.print-note-mode (see @media print CSS), then trigger the
// browser's native print dialog. afterprint cleans the mode back off (also on cancel).
function printTopicNote(id) {
  const n = getTopicNotes(currentTopicKey).find(x => x.id === id)
  const host = document.getElementById('print-note-host')
  if (!n || !host) return
  host.innerHTML = '<div class="note-card-body">' +
    '<h1 class="note-h note-h1">' + escHtml(n.title || 'Untitled') + '</h1>' +
    renderNoteBody(n.body) +
    '</div>'
  if (window.Prism) Prism.highlightAllUnder(host)
  document.body.classList.add('print-note-mode')
  window.print()
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-note-mode'))

// Renders only the accordion list + toggle-all label. Called on every search
// keystroke, so the search input itself must live outside this host (focus).
function _renderNotesList() {
  const host = document.getElementById('notes-acc-host')
  if (!host) return
  const notes = getTopicNotes(currentTopicKey)
  const q = _noteQuery.trim().toLowerCase()
  const open = _openNoteSet(notes)

  const btn = document.getElementById('btn-notes-toggle-all')
  if (btn) btn.textContent = notes.length > 0 && notes.every(n => open.has(n.id)) ? '⊟ Collapse all' : '⊞ Expand all'

  if (!notes.length) {
    host.innerHTML = '<div class="notes-empty text-center py-5 text-secondary">' +
      '<div style="font-size:2rem">🗒️</div>' +
      '<p class="small mt-2 mb-0">No notes yet. Capture key insights, gotchas, and patterns as you learn.</p></div>'
    return
  }

  const shown = q
    ? notes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q))
    : notes
  if (!shown.length) {
    host.innerHTML = '<p class="text-faint text-center py-4 mb-0">No notes match “' + escHtml(_noteQuery.trim()) + '”</p>'
    return
  }
  // While searching, body matches open automatically so you can see the hit.
  host.innerHTML = '<div class="notes-acc">' + shown.map(n => {
    const isOpen = open.has(n.id) || (q !== '' && (n.body || '').toLowerCase().includes(q))
    return noteAccItem(n, isOpen, q)
  }).join('') + '</div>'
  // Syntax-highlight any fenced code blocks in the notes we just inserted (autoloader
  // fetches whichever language grammar the fence names, e.g. ```typescript).
  if (window.Prism) Prism.highlightAllUnder(host)
}

function renderTopicNotes() {
  const host = document.getElementById('tab-notes')
  if (!host) return
  const topic = TOPICS.find(t => t.key === currentTopicKey)
  const notes = getTopicNotes(currentTopicKey)
  _captureNoteDraft()   // the inputs are about to be rebuilt
  _noteEditorTopic = null

  let html = '<div class="notes-head d-flex align-items-center justify-content-between mb-3">' +
    '<div><h6 class="mb-0">📝 Notes' + (topic ? ' — ' + escHtml(topic.label) : '') +
    (notes.length ? ' <span class="text-faint" style="font-weight:400">(' + notes.length + ')</span>' : '') + '</h6>' +
    '<span class="text-faint" style="font-size:var(--fs-xs)">Concise things to remember for this topic</span></div>' +
    '<button class="btn-add-note" data-click="startNewTopicNote">＋ New note</button>' +
    '</div>'

  html += '<div id="note-editor-host"></div>'

  if (notes.length) {
    html += '<div class="notes-toolbar">' +
      '<input class="note-search" id="note-search" type="search" placeholder="🔍 Search notes — title or body…" value="' + escHtml(_noteQuery) + '"' +
      ' data-input="_onNoteSearch" data-keydown="_clearNoteSearchOnEscape" data-args="' + Actions.attrArgs(['$value', '$event', '$this']) + '">' +
      '<button class="btn-notes-toggle-all" id="btn-notes-toggle-all" data-click="toggleAllNotes"></button>' +
      '</div>'
  }

  html += '<div id="notes-acc-host"></div>'
  host.innerHTML = html
  _renderNotesList()

  // Re-open the editor if we were mid-edit when a re-render happened — with what you'd typed,
  // not the saved note.
  const draft = _noteDrafts()[currentTopicKey]
  if (draft) _editingNoteId = draft.id
  if (_editingNoteId === '__new__') renderNoteEditor(draft || { id: null, title: '', body: '' })
  else if (_editingNoteId) {
    const n = notes.find(x => x.id === _editingNoteId)
    if (n) renderNoteEditor(draft || n)
    else { _editingNoteId = null; _setNoteDraft(currentTopicKey, null) }   // the note itself is gone
  }
}

// Remember the size the user drags the note editor to, so every note opens that big.
// Per-device UI preference (not synced).
const NOTE_EDITOR_H_KEY = 'dsa-note-editor-h-v1'
function _noteEditorHeightStyle() {
  try { const h = localStorage.getItem(NOTE_EDITOR_H_KEY); return h ? ' style="height:' + h + '"' : '' } catch { return '' }
}
function _saveNoteEditorHeight(el) {
  // Only remember pixel heights from a manual drag — never the Expand button's vh height.
  try { const h = el && el.style.height; if (h && /px$/.test(h)) localStorage.setItem(NOTE_EDITOR_H_KEY, h) } catch {}
}
function _toggleNoteEditorExpand(btn) {
  const ta = document.getElementById('note-edit-body')
  if (!ta) return
  if (ta.dataset.expanded === '1') {
    ta.dataset.expanded = '0'
    let saved = '220px'; try { saved = localStorage.getItem(NOTE_EDITOR_H_KEY) || '220px' } catch {}
    ta.style.height = saved
    btn.textContent = '⤢ Expand'
  } else {
    ta.dataset.expanded = '1'
    ta.style.height = '75vh'
    btn.textContent = '⤡ Shrink'
  }
}

function renderNoteEditor(n) {
  const host = document.getElementById('note-editor-host')
  if (!host) return
  _noteEditorTopic = currentTopicKey
  host.innerHTML =
    '<div class="note-editor">' +
    '<input class="note-editor-title" id="note-edit-title" placeholder="Note title (e.g. Topological sort)" data-input="_captureNoteDraft" value="' + escHtml(n.title || '') + '">' +
    '<textarea class="note-editor-body" id="note-edit-body"' + _noteEditorHeightStyle() + ' data-input="_captureNoteDraft" data-args="' + Actions.attrArgs(['$this']) + '" data-mouseup="_saveNoteEditorHeight" placeholder="Markdown supported — # heading · **bold** · *italic* · `code` · ```block``` - bullets · 1. list · &gt; quote · [link](url). Drag the bottom-right corner to resize.">' + escHtml(n.body || '') + '</textarea>' +
    '<div class="note-editor-actions">' +
    '<button class="btn-note-expand" data-click="_toggleNoteEditorExpand" data-args="' + Actions.attrArgs(['$this']) + '" title="Expand / shrink the editor">⤢ Expand</button>' +
    '<span class="note-editor-hint">**bold** · `code` · drag the ▝ corner to resize</span>' +
    '<button class="btn-note-cancel" data-click="cancelNoteEditor">Cancel</button>' +
    '<button class="btn-note-save" data-click="saveTopicNoteFromEditor">Save</button>' +
    '</div></div>'
  const t = document.getElementById('note-edit-title')
  if (t) t.focus()
}

function startNewTopicNote() {
  _editingNoteId = '__new__'
  _setNoteDraft(currentTopicKey, null)
  renderNoteEditor({ id: null, title: '', body: '' })
  document.getElementById('note-editor-host')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function editTopicNote(id) {
  const n = getTopicNotes(currentTopicKey).find(x => x.id === id)
  if (!n) return
  _editingNoteId = id
  _setNoteDraft(currentTopicKey, null)
  renderNoteEditor(n)
  document.getElementById('note-editor-host')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function cancelNoteEditor() {
  _editingNoteId = null
  _noteEditorTopic = null
  _setNoteDraft(currentTopicKey, null)
  const h = document.getElementById('note-editor-host')
  if (h) h.innerHTML = ''
}

function saveTopicNoteFromEditor() {
  const title = (document.getElementById('note-edit-title')?.value || '').trim()
  const body  = (document.getElementById('note-edit-body')?.value || '').trim()
  if (!title && !body) { cancelNoteEditor(); return }
  const existing = (_editingNoteId && _editingNoteId !== '__new__')
    ? getTopicNotes(currentTopicKey).find(x => x.id === _editingNoteId)
    : null
  const note = {
    id: existing ? existing.id : 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    body,
    pinned: existing ? !!existing.pinned : false,
    updatedAt: Date.now(),
  }
  upsertTopicNote(currentTopicKey, note)
  _editingNoteId = null
  _setNoteDraft(currentTopicKey, null)
  // Open the note you just saved so the result is visible.
  const open = _openNoteSet(getTopicNotes(currentTopicKey))
  open.add(note.id)
  _saveOpenNoteSet(open)
  renderTopicNotes()
}

function toggleTopicNotePin(id) {
  const n = getTopicNotes(currentTopicKey).find(x => x.id === id)
  if (!n) return
  upsertTopicNote(currentTopicKey, { ...n, pinned: !n.pinned, updatedAt: n.updatedAt || Date.now() })
  renderTopicNotes()
}

function removeTopicNote(id) {
  if (!confirm('Delete this note?')) return
  deleteTopicNote(currentTopicKey, id)
  if (_editingNoteId === id) { _editingNoteId = null; _setNoteDraft(currentTopicKey, null) }
  renderTopicNotes()
}

// ─── SAVE NOTE ────────────────────────────────────────────────────────────────
// Saving only on blur lost whatever was typed if the tab was closed or reloaded (or the app
// re-rendered the card) before focus left the box, so typing also saves after a short pause.
// That save is quiet: the "Saved" flash stays for blur, where it always appeared.
const NOTE_SAVE_DELAY_MS = 600
const _noteSaveTimers = {}
function _queueNoteSave(lcKey) {
  clearTimeout(_noteSaveTimers[lcKey])
  _noteSaveTimers[lcKey] = setTimeout(() => saveNoteFromTextarea(lcKey, true), NOTE_SAVE_DELAY_MS)
}
function _flushNoteSaves() {
  Object.keys(_noteSaveTimers).forEach(k => saveNoteFromTextarea(k, true))
}
function saveNoteFromTextarea(lcKey, quiet) {
  clearTimeout(_noteSaveTimers[lcKey]); delete _noteSaveTimers[lcKey]
  const ta = document.getElementById('note-' + lcKey)
  if (!ta) return
  setNote(lcKey, ta.value)
  // Update the 📝 badge in the accordion header without a full re-render
  const item = ta.closest('.accordion-item')
  if (item) {
    const meta = item.querySelector('.q-meta')
    if (meta) {
      const existing = meta.querySelector('[title="Has notes"]')
      if (ta.value.trim() && !existing) {
        meta.insertAdjacentHTML('beforeend',
          '<span class="q-badge-sep"></span><span class="badge bg-secondary q-badge" title="Has notes">📝</span>')
      } else if (!ta.value.trim() && existing) {
        const sep = existing.previousElementSibling
        if (sep && sep.classList.contains('q-badge-sep')) sep.remove()
        existing.remove()
      }
    }
  }
  const flash = quiet ? null : document.getElementById('note-flash-' + lcKey)
  if (flash) {
    flash.classList.add('show')
    setTimeout(() => flash.classList.remove('show'), 1500)
  }
}
