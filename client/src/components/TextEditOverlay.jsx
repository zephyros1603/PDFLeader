import React, { useState, useEffect, useRef } from 'react'

export default function TextEditOverlay({ textItems, pageIndex, zoom, edits, onEdit }) {
  const [activeId, setActiveId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (activeId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [activeId])

  const startEdit = (item) => {
    setActiveId(item.id)
    setEditValue(edits[item.id]?.newStr ?? item.str)
  }

  const commitEdit = (item) => {
    onEdit(item.id, {
      originalStr: item.str,
      newStr: editValue,
      pdfX: item.pdfX,
      pdfY: item.pdfY,
      pdfWidth: item.pdfWidth,
      pdfFontSize: item.pdfFontSize,
    })
    setActiveId(null)
  }

  const cancelEdit = () => setActiveId(null)

  if (!textItems || textItems.length === 0) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 12, pointerEvents: 'none' }}>
          No selectable text found on this page
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, pointerEvents: 'none' }}>
      {textItems.map(item => {
        const isActive = activeId === item.id
        const edit = edits[item.id]
        const isModified = edit && edit.newStr !== item.str

        return (
          <div
            key={item.id}
            title={isModified ? `Changed: "${edit.newStr}"` : `Click to edit: "${item.str}"`}
            style={{
              position: 'absolute',
              left: item.screenX,
              top: item.screenY,
              width: Math.max(item.screenWidth, 20),
              height: Math.max(item.screenHeight, 10),
              border: isActive
                ? '2px solid #5B4CF5'
                : isModified
                  ? '1.5px dashed #10B981'
                  : '1px dashed rgba(91,76,245,0.45)',
              background: isActive
                ? 'rgba(255,255,255,0.97)'
                : isModified
                  ? 'rgba(16,185,129,0.06)'
                  : 'transparent',
              cursor: 'text',
              pointerEvents: 'auto',
              boxSizing: 'border-box',
              zIndex: isActive ? 200 : 1,
              borderRadius: 2,
              boxShadow: isActive
                ? '0 0 0 3px rgba(91,76,245,0.18), 0 4px 12px rgba(0,0,0,0.12)'
                : 'none',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onClick={(e) => { e.stopPropagation(); if (!isActive) startEdit(item) }}
          >
            {isActive && (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitEdit(item)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(item) }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                  e.stopPropagation()
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: `${item.screenFontSize}px`,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  padding: '0 2px',
                  color: '#000',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              />
            )}

            {/* Modified indicator dot */}
            {isModified && !isActive && (
              <div style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10B981',
                border: '1.5px solid white',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
