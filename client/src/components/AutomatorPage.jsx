import React, { useState, useMemo, useEffect, useCallback } from 'react'
import axios from 'axios'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS  = ['Mo','Tu','We','Th','Fr','Sa','Su']

const FIELD_TYPE_META = {
  date:  { label: 'Date',   color: '#5B4CF5', bg: '#EEF2FF' },
  price: { label: 'Amount', color: '#059669', bg: '#ECFDF5' },
  name:  { label: 'Name',   color: '#2563EB', bg: '#EFF6FF' },
  id:    { label: 'ID',     color: '#6B7280', bg: '#F3F4F6' },
  text:  { label: 'Text',   color: '#D97706', bg: '#FFFBEB' },
  time:  { label: 'Time',   color: '#0891B2', bg: '#ECFEFF' },
  phone: { label: 'Phone',  color: '#7C3AED', bg: '#F5F3FF' },
}

const FONT_PREVIEW_STYLE = {
  auto:                    'Georgia, "Times New Roman", serif',
  TimesNewRoman:           '"Times New Roman", Georgia, serif',
  TimesNewRomanBold:       '"Times New Roman", Georgia, serif',
  TimesNewRomanItalic:     '"Times New Roman", Georgia, serif',
  Arial:                   'Arial, "Open Sans", sans-serif',
  ArialBold:               'Arial, "Open Sans", sans-serif',
}
const FONT_WEIGHT = { TimesNewRomanBold: 'bold', ArialBold: 'bold' }

function fmt12h(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = hhmm.split(':')
  let h = parseInt(hStr, 10); const m = parseInt(mStr, 10)
  const p = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12
  return `${h}:${String(m).padStart(2,'0')} ${p}`
}

function toDateKey(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function Calendar({ year, month, excludeWeekdays, excludedDates, onToggleDate, pdfCount }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayMon = (new Date(year, month, 1).getDay() + 6) % 7

  const availableKeys = useMemo(() => {
    const keys = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay()
      if (excludeWeekdays && dow >= 1 && dow <= 5) continue
      const k = toDateKey(year, month, d)
      if (!excludedDates.includes(k)) keys.push(k)
    }
    return keys
  }, [year, month, excludeWeekdays, excludedDates, daysInMonth])

  const cells = []
  for (let i = 0; i < firstDayMon; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="auto-calendar">
      <div className="auto-cal-grid">
        {DAY_LABELS.map(l => <div key={l} className={`auto-cal-header ${l==='Sa'||l==='Su'?'weekend':'weekday'}`}>{l}</div>)}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="auto-cal-cell empty" />
          const dow = new Date(year, month, day).getDay()
          const key = toDateKey(year, month, day)
          const isWorking  = dow >= 1 && dow <= 5 && excludeWeekdays
          const isExcluded = excludedDates.includes(key)
          const isAvail    = !isWorking && !isExcluded
          let assigned = 0
          if (isAvail && availableKeys.length > 0 && pdfCount > 0) {
            const di = availableKeys.indexOf(key)
            for (let i = di; i < pdfCount; i += availableKeys.length) assigned++
          }
          return (
            <div key={day}
              className={`auto-cal-cell ${isWorking?'working':isExcluded?'excluded':'available'}`}
              onClick={() => !isWorking && onToggleDate(key)}
              title={isWorking ? 'Working day' : isExcluded ? 'Click to include' : 'Click to exclude'}
            >
              <span className="auto-cal-day">{day}</span>
              {isAvail && assigned > 0 && <span className="auto-cal-badge">{assigned}</span>}
            </div>
          )
        })}
      </div>
      <div className="auto-cal-legend">
        <span className="legend-item"><span className="legend-dot available"/>Available</span>
        <span className="legend-item"><span className="legend-dot working"/>Working day</span>
        <span className="legend-item"><span className="legend-dot excluded"/>Excluded</span>
      </div>
    </div>
  )
}

function FieldTypeBadge({ type }) {
  const meta = FIELD_TYPE_META[type] || { label: type, color: '#6B7280', bg: '#F3F4F6' }
  return (
    <span className="auto-field-type-badge" style={{ color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}

export default function AutomatorPage() {
  const now = new Date()
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  const [inputFolder,  setInputFolder]  = useState('')
  const [outputFolder, setOutputFolder] = useState('')
  const [excludeWeekdays, setExcludeWeekdays] = useState(true)
  const [excludedDates,   setExcludedDates]   = useState([])
  const [timeRange1, setTimeRange1] = useState({ start: '13:00', end: '14:00' })
  const [timeRange2, setTimeRange2] = useState({ start: '23:00', end: '23:30' })
  const [fontKey, setFontKey] = useState('auto')
  const [detectedFontKey,  setDetectedFontKey]  = useState(null)
  const [detectedFontName, setDetectedFontName] = useState(null)

  // Universal field detection
  const [detectedFields, setDetectedFields] = useState([])
  const [fieldConfigs,   setFieldConfigs]   = useState([])
  const [analyzing, setAnalyzing] = useState(false)

  const [pdfCount, setPdfCount] = useState(null)
  const [folderOk, setFolderOk] = useState(null)
  const [running,  setRunning]  = useState(false)
  const [results,  setResults]  = useState(null)
  const [runError, setRunError] = useState(null)

  const availableDates = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const dates = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth, d)
      const dow  = date.getDay()
      if (excludeWeekdays && dow >= 1 && dow <= 5) continue
      const key = toDateKey(calYear, calMonth, d)
      if (!excludedDates.includes(key)) dates.push(key)
    }
    return dates
  }, [calYear, calMonth, excludeWeekdays, excludedDates])

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11) } else setCalMonth(m => m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0) } else setCalMonth(m => m+1) }
  const toggleDate = useCallback(key => setExcludedDates(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]), [])

  // Initialize field configs when detected fields change
  useEffect(() => {
    if (!detectedFields.length) { setFieldConfigs([]); return }
    setFieldConfigs(detectedFields.map(f => {
      const enabled = ['date', 'price', 'name'].includes(f.type)
      const base = { fieldId: f.id, label: f.label, type: f.type, enabled, locator: f.locator }
      if (f.type === 'price') return { ...base, min: 80, max: 120 }
      if (f.type === 'name' || f.type === 'text') return { ...base, value: f.value || '' }
      return base
    }))
  }, [detectedFields])

  const updateFieldConfig = useCallback((idx, patch) => {
    setFieldConfigs(prev => prev.map((fc, i) => i === idx ? { ...fc, ...patch } : fc))
  }, [])

  // Debounced folder scan
  useEffect(() => {
    if (!inputFolder.trim()) {
      setPdfCount(null); setFolderOk(null); setDetectedFontKey(null)
      setDetectedFontName(null); setDetectedFields([])
      return
    }
    const t = setTimeout(async () => {
      setAnalyzing(true)
      try {
        const [listRes, analyzeRes] = await Promise.all([
          axios.post('/api/automator/list-files', { inputFolder: inputFolder.trim() }),
          axios.post('/api/automator/analyze',    { inputFolder: inputFolder.trim() }),
        ])
        const { count, exists, detectedFontKey: dfk, detectedFontName: dfn } = listRes.data
        setPdfCount(count); setFolderOk(exists)
        if (dfk) { setDetectedFontKey(dfk); setDetectedFontName(dfn) }
        setDetectedFields(analyzeRes.data.fields || [])
      } catch {
        setPdfCount(null); setFolderOk(false); setDetectedFields([])
      } finally {
        setAnalyzing(false)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [inputFolder])

  const handleRun = async () => {
    setRunning(true); setResults(null); setRunError(null)
    try {
      const r = await axios.post('/api/automator/run', {
        inputFolder:  inputFolder.trim(),
        outputFolder: outputFolder.trim(),
        config: {
          fieldConfigs,
          excludeWeekdays, excludedDates,
          year: calYear, month: calMonth,
          timeRange1: { start: timeRange1.start, end: timeRange1.end },
          timeRange2: { start: timeRange2.start, end: timeRange2.end },
          fontKey,
        },
      })
      setResults(r.data)
    } catch (err) {
      setRunError(err.response?.data?.error || err.message)
    } finally {
      setRunning(false)
    }
  }

  const hasEnabledDate = fieldConfigs.some(fc => fc.enabled && fc.type === 'date')
  const hasAnyEnabled  = fieldConfigs.some(fc => fc.enabled)
  const canRun = folderOk && pdfCount > 0 && !running && hasAnyEnabled
    && (!hasEnabledDate || availableDates.length > 0)

  return (
    <div className="automator-page">
      <div className="automator-header">
        <h1 className="automator-title">Batch PDF Automator</h1>
        <p className="automator-subtitle">Scan any PDF folder — detected fields are auto-configured for batch replacement</p>
      </div>

      <div className="automator-body">
        {/* ── Left column ── */}
        <div className="automator-left">

          {/* Folders */}
          <div className="auto-card">
            <div className="auto-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Folders
            </div>
            <div className="auto-field">
              <label className="auto-label">Input Folder <span className="auto-label-hint">(PDFs to process)</span></label>
              <div className="auto-input-row">
                <input
                  className={`auto-input ${folderOk===false?'error':folderOk===true?'ok':''}`}
                  type="text" placeholder="/path/to/input/folder"
                  value={inputFolder} onChange={e => setInputFolder(e.target.value)}
                />
                {analyzing && <span className="auto-folder-badge scanning">Scanning…</span>}
                {!analyzing && folderOk===true  && <span className="auto-folder-badge ok">{pdfCount} PDF{pdfCount!==1?'s':''}</span>}
                {!analyzing && folderOk===false && inputFolder && <span className="auto-folder-badge err">Not found</span>}
              </div>
            </div>
            <div className="auto-field">
              <label className="auto-label">Output Folder <span className="auto-label-hint">(blank = /output subfolder)</span></label>
              <input
                className="auto-input" type="text"
                placeholder={inputFolder ? `${inputFolder}/output` : '/path/to/output/folder'}
                value={outputFolder} onChange={e => setOutputFolder(e.target.value)}
              />
            </div>
          </div>

          {/* Detected Fields */}
          {(analyzing || detectedFields.length > 0) && (
            <div className="auto-card">
              <div className="auto-card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Detected Fields
                {analyzing && <span className="auto-scanning-dot" />}
              </div>

              {analyzing ? (
                <div className="auto-analyzing">
                  <div className="auto-spin" />
                  Analysing sample PDF…
                </div>
              ) : (
                <div className="auto-field-cards">
                  {fieldConfigs.map((fc, idx) => {
                    const field = detectedFields.find(f => f.id === fc.fieldId)
                    const meta  = FIELD_TYPE_META[fc.type] || FIELD_TYPE_META.text
                    const isConfigurable = ['price', 'name', 'text'].includes(fc.type)
                    return (
                      <div key={fc.fieldId} className={`auto-fcard ${fc.enabled ? 'enabled' : 'off'}`}>
                        <div className="auto-fcard-header">
                          <FieldTypeBadge type={fc.type} />
                          <span className="auto-fcard-label">{fc.label || <em style={{color:'#9CA3AF'}}>unlabelled</em>}</span>
                          <span className="auto-fcard-current" title="Current value in sample PDF">
                            "{field?.value}"
                          </span>
                          <label className="auto-fcard-toggle" title={fc.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
                            <input type="checkbox" checked={fc.enabled} onChange={e => updateFieldConfig(idx, { enabled: e.target.checked })} />
                            <span className="auto-fcard-track" style={fc.enabled ? { background: meta.color } : {}} />
                          </label>
                        </div>

                        {fc.enabled && (
                          <div className="auto-fcard-controls">
                            {fc.type === 'date' && (
                              <span className="auto-fcard-hint">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Date assigned from calendar &amp; time range config →
                              </span>
                            )}
                            {fc.type === 'price' && (
                              <div className="auto-fcard-range">
                                <span className="auto-fcard-range-lbl">Random range</span>
                                <input type="number" className="auto-fcard-num" min="0" value={fc.min ?? 80}
                                  onChange={e => updateFieldConfig(idx, { min: Number(e.target.value) })} />
                                <span className="auto-fcard-range-sep">–</span>
                                <input type="number" className="auto-fcard-num" min="0" value={fc.max ?? 120}
                                  onChange={e => updateFieldConfig(idx, { max: Number(e.target.value) })} />
                              </div>
                            )}
                            {(fc.type === 'name' || fc.type === 'text') && (
                              <input
                                className="auto-input auto-fcard-text-input"
                                type="text"
                                placeholder={`Replace "${field?.value}" with…`}
                                value={fc.value || ''}
                                onChange={e => updateFieldConfig(idx, { value: e.target.value })}
                              />
                            )}
                            {fc.type === 'id' && (
                              <span className="auto-fcard-hint muted">ID fields are preserved as-is</span>
                            )}
                            {fc.type === 'time' && (
                              <span className="auto-fcard-hint muted">Standalone time — use time range config →</span>
                            )}
                            {fc.type === 'phone' && (
                              <span className="auto-fcard-hint muted">Phone numbers are preserved as-is</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Font */}
          <div className="auto-card">
            <div className="auto-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              Font
            </div>
            <div className="auto-field">
              <label className="auto-label">
                Font Family
                {detectedFontName && <span className="auto-detected-font-badge">Detected: {detectedFontName}</span>}
              </label>
              <select className="auto-input auto-font-select" value={fontKey} onChange={e => setFontKey(e.target.value)}>
                <option value="auto">Auto (match each PDF's font)</option>
                <optgroup label="Serif — Times New Roman">
                  <option value="TimesNewRoman">Times New Roman</option>
                  <option value="TimesNewRomanBold">Times New Roman Bold</option>
                  <option value="TimesNewRomanItalic">Times New Roman Italic</option>
                </optgroup>
                <optgroup label="Sans-serif — Arial / Open Sans">
                  <option value="Arial">Arial / Open Sans Regular</option>
                  <option value="ArialBold">Arial / Open Sans Bold</option>
                </optgroup>
              </select>
              <div className="auto-font-preview" style={{ fontFamily: FONT_PREVIEW_STYLE[fontKey], fontWeight: FONT_WEIGHT[fontKey]||'normal', fontStyle: fontKey==='TimesNewRomanItalic'?'italic':'normal' }}>
                July 22nd 2026, 1:31 PM  ·  Name  ·  88
              </div>
            </div>
          </div>

          {/* Time Ranges — only shown when a date field is enabled */}
          {hasEnabledDate && (
            <div className="auto-card">
              <div className="auto-card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Time Ranges
              </div>
              <p className="auto-time-hint">Random time picked within each range. Range 1 = single-PDF days &amp; <strong>1st PDF</strong>; Range 2 = <strong>2nd PDF</strong> on 2-per-day dates.</p>
              <div className="auto-time-ranges">
                {[
                  { badge: 'occ1', label: '1st', range: timeRange1, setter: setTimeRange1 },
                  { badge: 'occ2', label: '2nd', range: timeRange2, setter: setTimeRange2 },
                ].map(({ badge, label, range, setter }) => (
                  <div key={label} className="auto-time-range-block">
                    <div className="auto-time-range-label">
                      <span className={`auto-occurrence-badge ${badge}`}>{label}</span>
                      Range {label === '1st' ? '1' : '2'}
                    </div>
                    <div className="auto-time-inputs">
                      <div className="auto-time-input-group">
                        <label className="auto-label">From</label>
                        <input type="time" className="auto-input auto-time-input" value={range.start}
                          onChange={e => setter(r => ({ ...r, start: e.target.value }))} />
                      </div>
                      <span className="auto-time-sep">–</span>
                      <div className="auto-time-input-group">
                        <label className="auto-label">To</label>
                        <input type="time" className="auto-input auto-time-input" value={range.end}
                          onChange={e => setter(r => ({ ...r, end: e.target.value }))} />
                      </div>
                    </div>
                    <div className="auto-time-preview">{fmt12h(range.start)} – {fmt12h(range.end)}</div>
                    {label === '1st' && <div className="auto-time-range-divider" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary + Run */}
          <div className="auto-card auto-summary-card">
            <div className="auto-summary-row">
              <div className="auto-stat">
                <span className="auto-stat-val">{pdfCount ?? '—'}</span>
                <span className="auto-stat-lbl">PDFs</span>
              </div>
              <div className="auto-stat-divider" />
              <div className="auto-stat">
                <span className="auto-stat-val">{hasEnabledDate ? availableDates.length : '—'}</span>
                <span className="auto-stat-lbl">Dates</span>
              </div>
              <div className="auto-stat-divider" />
              <div className="auto-stat">
                <span className="auto-stat-val">{fieldConfigs.filter(fc => fc.enabled).length}</span>
                <span className="auto-stat-lbl">Fields active</span>
              </div>
            </div>
            {!folderOk && inputFolder && !analyzing && <p className="auto-warn">Input folder not found.</p>}
            {folderOk && pdfCount === 0 && <p className="auto-warn">No PDF files found in the input folder.</p>}
            {hasEnabledDate && availableDates.length === 0 && <p className="auto-warn">No available dates — uncheck some exclusions.</p>}
            {!hasAnyEnabled && fieldConfigs.length > 0 && <p className="auto-warn">Enable at least one field to run.</p>}
            <button className="auto-run-btn" onClick={handleRun} disabled={!canRun}>
              {running ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="15"/></svg>Processing…</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run Automator</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right column — calendar (only when date field is enabled) ── */}
        <div className="automator-right">
          {hasEnabledDate ? (
            <div className="auto-card auto-cal-card">
              <div className="auto-cal-top">
                <div className="auto-cal-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Date Assignment
                </div>
                <div className="auto-month-nav">
                  <button className="auto-month-btn" onClick={prevMonth}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
                  <span className="auto-month-label">{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button className="auto-month-btn" onClick={nextMonth}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
                </div>
              </div>
              <div className="auto-toggle-row">
                <label className="auto-toggle">
                  <input type="checkbox" checked={excludeWeekdays} onChange={e => setExcludeWeekdays(e.target.checked)} />
                  <span className="auto-toggle-track" />
                  <span className="auto-toggle-label">Skip working days (Mon – Fri)</span>
                </label>
              </div>
              <Calendar year={calYear} month={calMonth} excludeWeekdays={excludeWeekdays}
                excludedDates={excludedDates} onToggleDate={toggleDate} pdfCount={pdfCount || 0} />
              {excludedDates.length > 0 && (
                <button className="auto-clear-btn" onClick={() => setExcludedDates([])}>
                  Clear {excludedDates.length} manual exclusion{excludedDates.length!==1?'s':''}
                </button>
              )}
            </div>
          ) : (
            <div className="auto-card auto-cal-disabled-card">
              <div className="auto-cal-disabled-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <p className="auto-cal-disabled-msg">Date changes are off</p>
              <p className="auto-cal-disabled-sub">Enable the <strong>Date</strong> field in Detected Fields to assign dates from the calendar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {(results || runError) && (
        <div className="auto-results">
          {runError && (
            <div className="auto-error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {runError}
            </div>
          )}
          {results && (
            <>
              <div className="auto-results-header">
                <span className="auto-results-title">Results — {results.totalFiles} file{results.totalFiles!==1?'s':''} processed</span>
                <span className="auto-results-out">Saved to: <code>{results.outputFolder}</code></span>
              </div>
              <div className="auto-results-table-wrap">
                <table className="auto-results-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>#</th>
                      <th>Changed Fields</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r, i) => (
                      <tr key={i} className={r.ok ? '' : 'row-error'}>
                        <td className="auto-filename">{r.file}</td>
                        <td>{r.date || '—'}</td>
                        <td className="auto-time-cell">{r.time || <span style={{color:'#9CA3AF'}}>—</span>}</td>
                        <td>
                          {r.ok && r.occurrence != null
                            ? <span className={`auto-occurrence-badge ${r.occurrence===1?'occ1':'occ2'}`}>{r.occurrence===1?'1st':'2nd'}</span>
                            : '—'}
                        </td>
                        <td>
                          {r.ok && r.changedFields?.length > 0 ? (
                            <div className="auto-changed-fields">
                              {r.changedFields.map((cf, ci) => (
                                <span key={ci} className="auto-changed-chip" title={`${cf.from} → ${cf.to}`}>
                                  <FieldTypeBadge type={cf.type} />
                                  {cf.label || cf.type}
                                </span>
                              ))}
                            </div>
                          ) : r.ok ? <span className="tag-miss">None</span> : '—'}
                        </td>
                        <td>{r.ok ? <span className="tag-ok">OK</span> : <span className="tag-err">{r.error}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
