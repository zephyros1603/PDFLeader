import React, { useRef, useEffect } from 'react'

export default function TextEditor({ x, y, fontSize, color, onCommit, onCancel }) {
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onCommit(e.target.value)
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  const handleBlur = (e) => {
    onCommit(e.target.value)
  }

  return (
    <textarea
      ref={inputRef}
      className="canvas-text-input"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: `${fontSize}px`,
        color,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        lineHeight: 1.2,
        zIndex: 50,
        minWidth: 120,
        minHeight: fontSize + 10
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      rows={1}
    />
  )
}
