import React, { useRef } from 'react'

const tools = [
  {
    group: 'Selection',
    items: [
      { id: 'select', label: 'Select', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4l7 19 3-7 7-3z"/><line x1="14" y1="14" x2="20" y2="20"/>
        </svg>
      )},
    ]
  },
  {
    group: 'Markup',
    items: [
      { id: 'text', label: 'Add Text', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/>
          <line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
      )},
      { id: 'editText', label: 'Edit Text', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      )},
      { id: 'highlighter', label: 'Highlight', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      )},
      { id: 'pen', label: 'Draw', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      )},
      { id: 'eraser', label: 'Eraser', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H7L3 16l11-11 7 7-1 8z"/><line x1="6" y1="14" x2="14" y2="6"/>
        </svg>
      )},
    ]
  },
  {
    group: 'Shapes',
    items: [
      { id: 'rect', label: 'Rectangle', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2"/>
        </svg>
      )},
      { id: 'ellipse', label: 'Ellipse', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="12" rx="10" ry="7"/>
        </svg>
      )},
      { id: 'line', label: 'Line', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="20" x2="20" y2="4"/>
        </svg>
      )},
      { id: 'arrow', label: 'Arrow', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="19" x2="19" y2="5"/>
          <polyline points="9 5 19 5 19 15"/>
        </svg>
      )},
    ]
  },
  {
    group: 'Insert',
    items: [
      { id: 'signature', label: 'Signature', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 17c3-3 5-5 7-3s4 4 7 0"/><line x1="3" y1="20" x2="21" y2="20"/>
        </svg>
      )},
    ]
  },
  {
    group: 'Page',
    items: [
      { id: 'crop', label: 'Crop', icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
          <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
        </svg>
      )},
    ]
  },
]

export default function Toolbar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  lineWidth,
  setLineWidth,
  fontSize,
  setFontSize,
  onSignature,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) {
  const colorInputRef = useRef(null)
  const imageInputRef = useRef(null)

  const handleToolClick = (toolId) => {
    if (toolId === 'signature') { onSignature(); return }
    setActiveTool(toolId)
  }

  return (
    <div className="toolbar">
      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button className="tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo"
          style={{ opacity: canUndo ? 1 : 0.3 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.29"/>
          </svg>
          <span className="tooltip">Undo</span>
        </button>
        <button className="tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo"
          style={{ opacity: canRedo ? 1 : 0.3 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.29"/>
          </svg>
          <span className="tooltip">Redo</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Tool groups */}
      {tools.map((group, gi) => (
        <React.Fragment key={group.group}>
          <div className="toolbar-group-label">{group.group}</div>
          <div className="toolbar-group">
            {group.items.map(tool => (
              <button
                key={tool.id}
                className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                onClick={() => handleToolClick(tool.id)}
                title={tool.label}
              >
                {tool.icon}
                <span className="tool-btn-label">{tool.label}</span>
                <span className="tooltip">{tool.label}</span>
              </button>
            ))}
          </div>
          {gi < tools.length - 1 && <div className="toolbar-divider" />}
        </React.Fragment>
      ))}

      {/* Image insert */}
      <div className="toolbar-group-label">Media</div>
      <div className="toolbar-group">
        <label className="tool-btn" title="Insert Image" style={{ cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span className="tool-btn-label">Image</span>
          <span className="tooltip">Insert Image</span>
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { e.target.value = '' }} />
        </label>
      </div>

      <div className="toolbar-divider" />

      {/* Color */}
      <div className="toolbar-group-label">Color</div>
      <div className="toolbar-group" style={{ gap: 6 }}>
        <button
          className="color-picker-btn"
          onClick={() => colorInputRef.current?.click()}
          title="Custom color"
        >
          <div className="color-swatch" style={{ background: activeColor }} />
          <input ref={colorInputRef} type="color" value={activeColor}
            onChange={e => setActiveColor(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
        </button>
        <div className="toolbar-quick-colors">
          {['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#FFFFFF'].map(color => (
            <button key={color} className={`quick-color ${activeColor === color ? 'active' : ''}`}
              onClick={() => setActiveColor(color)} title={color}
              style={{ background: color }} />
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Width */}
      <div className="toolbar-group-label">Stroke</div>
      <div className="toolbar-slider-container">
        <input type="range" min="1" max="20" value={lineWidth}
          onChange={e => setLineWidth(parseInt(e.target.value))} className="toolbar-slider"
          style={{ background: `linear-gradient(90deg, #5B4CF5 ${(lineWidth-1)/19*100}%, #E5E7EB ${(lineWidth-1)/19*100}%)` }} />
        <div className="toolbar-slider-value">{lineWidth}px</div>
      </div>

      {/* Font size — only when text tool active */}
      {activeTool === 'text' && (
        <>
          <div className="toolbar-group-label">Font</div>
          <div className="toolbar-slider-container">
            <input type="range" min="8" max="72" value={fontSize}
              onChange={e => setFontSize(parseInt(e.target.value))} className="toolbar-slider"
              style={{ background: `linear-gradient(90deg, #5B4CF5 ${(fontSize-8)/64*100}%, #E5E7EB ${(fontSize-8)/64*100}%)` }} />
            <div className="toolbar-slider-value">{fontSize}px</div>
          </div>
        </>
      )}
    </div>
  )
}
