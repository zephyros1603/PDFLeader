import React, { useRef, useState, useEffect, useCallback } from 'react'

export default function SignaturePad({ onSave, onClose }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const lastPoint = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 360
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const getPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    if (e.touches) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height)
      }
    }
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    }
  }

  const startDraw = useCallback((e) => {
    e.preventDefault()
    setIsDrawing(true)
    const canvas = canvasRef.current
    const pt = getPoint(e, canvas)
    lastPoint.current = pt
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 1, 0, Math.PI * 2)
    ctx.fillStyle = '#1F2937'
    ctx.fill()
    setHasContent(true)
  }, [])

  const draw = useCallback((e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const pt = getPoint(e, canvas)
    const ctx = canvas.getContext('2d')

    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.strokeStyle = '#1F2937'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPoint.current = pt
    setHasContent(true)
  }, [isDrawing])

  const stopDraw = useCallback((e) => {
    if (e) e.preventDefault()
    setIsDrawing(false)
    lastPoint.current = null
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
  }

  const handleSave = () => {
    if (!hasContent) return
    const canvas = canvasRef.current
    const dataURL = canvas.toDataURL('image/png')
    onSave(dataURL)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="signature-modal" onClick={e => e.stopPropagation()}>
        <div className="signature-header">
          <h3>Draw Signature</h3>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="signature-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="signature-canvas"
            style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          {!hasContent && (
            <div className="signature-placeholder">Sign here</div>
          )}
        </div>

        <div style={{ padding: '0 20px 8px', display: 'flex', gap: 8 }}>
          <div style={{ height: 1, flex: 1, background: '#E5E7EB', alignSelf: 'center' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Draw your signature above</span>
          <div style={{ height: 1, flex: 1, background: '#E5E7EB', alignSelf: 'center' }} />
        </div>

        <div className="signature-footer">
          <button className="btn-danger" onClick={clearCanvas}>
            Clear
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!hasContent}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Use Signature
          </button>
        </div>
      </div>
    </div>
  )
}
