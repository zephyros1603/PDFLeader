import React, { useRef, useState, useEffect, useCallback } from 'react'

const ERASER_RADIUS = 20

export default function AnnotationCanvas({
  pageIndex,
  pageWidth,
  pageHeight,
  zoom,
  activeTool,
  activeColor,
  lineWidth,
  fontSize,
  annotations,
  onAnnotationAdd,
  pendingSignature
}) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState(null)
  const [currentPath, setCurrentPath] = useState([])
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: '', pixelX: 0, pixelY: 0 })
  const textRef = useRef(null)

  const getCursor = () => {
    switch (activeTool) {
      case 'text': return 'text'
      case 'pen': case 'highlighter': return 'crosshair'
      case 'eraser': return 'cell'
      case 'rect': case 'ellipse': case 'line': case 'arrow': return 'crosshair'
      case 'signature': return 'copy'
      case 'select': return 'default'
      default: return 'default'
    }
  }

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, nx: 0, ny: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    return {
      px,
      py,
      nx: px / canvas.width,
      ny: py / canvas.height
    }
  }, [])

  const drawAnnotationsToCtx = useCallback((ctx, anns, w, h) => {
    if (!anns || anns.length === 0) return
    anns.forEach(ann => {
      ctx.save()
      const hexToRgb = (hex) => {
        if (!hex || !hex.startsWith('#')) return { r: 0, g: 0, b: 0 }
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return { r, g, b }
      }

      if (ann.type === 'text') {
        const x = ann.x * w
        const y = ann.y * h
        const { r, g, b } = hexToRgb(ann.color)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.font = `${ann.fontSize || 16}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
        ctx.fillText(ann.text, x, y)
      } else if (ann.type === 'drawing') {
        if (!ann.points || ann.points.length < 2) { ctx.restore(); return }
        const { r, g, b } = hexToRgb(ann.color)
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        ctx.lineWidth = ann.lineWidth || 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h)
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h)
        }
        ctx.stroke()
      } else if (ann.type === 'highlighter') {
        if (!ann.points || ann.points.length < 2) { ctx.restore(); return }
        const { r, g, b } = hexToRgb(ann.color)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`
        ctx.lineWidth = (ann.lineWidth || 2) * 4
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h)
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h)
        }
        ctx.stroke()
      } else if (ann.type === 'rect') {
        const x = ann.x * w
        const y = ann.y * h
        const rw = ann.w * w
        const rh = ann.h * h
        const { r, g, b } = hexToRgb(ann.color)
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        ctx.lineWidth = ann.lineWidth || 2
        ctx.strokeRect(x, y, rw, rh)
      } else if (ann.type === 'ellipse') {
        const cx = ann.cx * w
        const cy = ann.cy * h
        const rx = ann.rx * w
        const ry = ann.ry * h
        const { r, g, b } = hexToRgb(ann.color)
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        ctx.lineWidth = ann.lineWidth || 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (ann.type === 'highlight') {
        const x = ann.x * w
        const y = ann.y * h
        const rw = ann.w * w
        const rh = ann.h * h
        ctx.fillStyle = 'rgba(255, 255, 0, 0.35)'
        ctx.fillRect(x, y, rw, rh)
      } else if (ann.type === 'line') {
        const { r, g, b } = hexToRgb(ann.color)
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        ctx.lineWidth = ann.lineWidth || 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ann.x1 * w, ann.y1 * h)
        ctx.lineTo(ann.x2 * w, ann.y2 * h)
        ctx.stroke()
      } else if (ann.type === 'arrow') {
        const { r, g, b } = hexToRgb(ann.color)
        const x1 = ann.x1 * w
        const y1 = ann.y1 * h
        const x2 = ann.x2 * w
        const y2 = ann.y2 * h
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.lineWidth = ann.lineWidth || 2
        ctx.lineCap = 'round'
        // Line
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1)
        const arrowSize = Math.max(10, (ann.lineWidth || 2) * 4)
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6))
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6))
        ctx.closePath()
        ctx.fill()
      } else if (ann.type === 'signature') {
        const img = new Image()
        img.src = ann.imageData
        const x = ann.x * w
        const y = ann.y * h
        const sw = ann.w * w
        const sh = ann.h * h
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x, y, sw, sh)
        } else {
          img.onload = () => {
            const c = canvasRef.current
            if (c) {
              const ctx2 = c.getContext('2d')
              ctx2.drawImage(img, x, y, sw, sh)
            }
          }
        }
      }
      ctx.restore()
    })
  }, [])

  // Redraw whenever annotations change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawAnnotationsToCtx(ctx, annotations, canvas.width, canvas.height)
  }, [annotations, drawAnnotationsToCtx, pageWidth, pageHeight])

  const onMouseDown = useCallback((e) => {
    if (activeTool === 'select') return
    e.preventDefault()
    const { px, py, nx, ny } = getCanvasCoords(e)

    if (activeTool === 'text') {
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      setTextInput({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pixelX: nx,
        pixelY: ny,
        value: ''
      })
      setTimeout(() => textRef.current?.focus(), 0)
      return
    }

    if (activeTool === 'signature' && pendingSignature) {
      const sigW = 200 / pageWidth
      const sigH = 80 / pageHeight
      onAnnotationAdd({
        type: 'signature',
        x: nx,
        y: ny,
        w: sigW,
        h: sigH,
        imageData: pendingSignature,
        pageIndex
      })
      return
    }

    if (activeTool === 'eraser') {
      eraseNear(nx, ny)
      setIsDrawing(true)
      return
    }

    setIsDrawing(true)
    setStartPoint({ px, py, nx, ny })

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setCurrentPath([{ x: nx, y: ny }])
    }
  }, [activeTool, pendingSignature, pageIndex, pageWidth, pageHeight, onAnnotationAdd, getCanvasCoords])

  const eraseNear = useCallback((nx, ny) => {
    // Implemented via parent component by filtering annotations
    // We'll dispatch a custom event approach via callback
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!isDrawing || activeTool === 'select') return
    e.preventDefault()
    const { px, py, nx, ny } = getCanvasCoords(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    if (activeTool === 'eraser') {
      // Draw eraser indicator
      ctx.clearRect(0, 0, w, h)
      drawAnnotationsToCtx(ctx, annotations, w, h)
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(px, py, ERASER_RADIUS, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.restore()
      return
    }

    if (activeTool === 'pen') {
      setCurrentPath(prev => {
        const newPath = [...prev, { x: nx, y: ny }]
        // Draw incrementally
        ctx.save()
        ctx.strokeStyle = activeColor
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        if (prev.length > 0) {
          const last = prev[prev.length - 1]
          ctx.beginPath()
          ctx.moveTo(last.x * w, last.y * h)
          ctx.lineTo(nx * w, ny * h)
          ctx.stroke()
        }
        ctx.restore()
        return newPath
      })
      return
    }

    if (activeTool === 'highlighter') {
      setCurrentPath(prev => {
        const newPath = [...prev, { x: nx, y: ny }]
        ctx.save()
        const { r, g, b } = hexToRgba(activeColor)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`
        ctx.lineWidth = lineWidth * 4
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        if (prev.length > 0) {
          const last = prev[prev.length - 1]
          ctx.beginPath()
          ctx.moveTo(last.x * w, last.y * h)
          ctx.lineTo(nx * w, ny * h)
          ctx.stroke()
        }
        ctx.restore()
        return newPath
      })
      return
    }

    if (!startPoint) return

    // Preview shapes
    ctx.clearRect(0, 0, w, h)
    drawAnnotationsToCtx(ctx, annotations, w, h)

    const sx = startPoint.px
    const sy = startPoint.py
    ctx.save()

    if (activeTool === 'rect') {
      const { r, g, b } = hexToRgba(activeColor)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth = lineWidth
      ctx.strokeRect(sx, sy, px - sx, py - sy)
    } else if (activeTool === 'ellipse') {
      const cx = (sx + px) / 2
      const cy = (sy + py) / 2
      const rx = Math.abs(px - sx) / 2
      const ry = Math.abs(py - sy) / 2
      const { r, g, b } = hexToRgba(activeColor)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
      ctx.stroke()
    } else if (activeTool === 'highlight') {
      ctx.fillStyle = 'rgba(255,255,0,0.35)'
      ctx.fillRect(sx, sy, px - sx, py - sy)
    } else if (activeTool === 'line') {
      const { r, g, b } = hexToRgba(activeColor)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(px, py)
      ctx.stroke()
    } else if (activeTool === 'arrow') {
      const { r, g, b } = hexToRgba(activeColor)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(px, py)
      ctx.stroke()
      const angle = Math.atan2(py - sy, px - sx)
      const arrowSize = Math.max(10, lineWidth * 4)
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px - arrowSize * Math.cos(angle - Math.PI / 6), py - arrowSize * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(px - arrowSize * Math.cos(angle + Math.PI / 6), py - arrowSize * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }, [isDrawing, activeTool, startPoint, activeColor, lineWidth, annotations, drawAnnotationsToCtx, getCanvasCoords])

  const onMouseUp = useCallback((e) => {
    if (!isDrawing || activeTool === 'select') return
    e.preventDefault()
    setIsDrawing(false)
    const { nx, ny } = getCanvasCoords(e)
    const canvas = canvasRef.current
    if (!canvas) return

    if (activeTool === 'eraser') {
      const erRadius = ERASER_RADIUS / canvas.width
      const erRadiusY = ERASER_RADIUS / canvas.height
      // Nothing more - erase handled in mousedown/move via annotation filtering
      setStartPoint(null)
      setCurrentPath([])
      return
    }

    if (activeTool === 'pen' && currentPath.length > 1) {
      onAnnotationAdd({
        type: 'drawing',
        points: currentPath,
        color: activeColor,
        lineWidth,
        pageIndex
      })
    } else if (activeTool === 'highlighter' && currentPath.length > 1) {
      onAnnotationAdd({
        type: 'highlighter',
        points: currentPath,
        color: activeColor,
        lineWidth,
        pageIndex
      })
    } else if (startPoint) {
      const snx = startPoint.nx
      const sny = startPoint.ny

      if (activeTool === 'rect') {
        const w = nx - snx
        const h = ny - sny
        if (Math.abs(w) > 0.005 || Math.abs(h) > 0.005) {
          onAnnotationAdd({
            type: 'rect',
            x: Math.min(snx, nx),
            y: Math.min(sny, ny),
            w: Math.abs(w),
            h: Math.abs(h),
            color: activeColor,
            lineWidth,
            pageIndex
          })
        }
      } else if (activeTool === 'ellipse') {
        const rx = Math.abs(nx - snx) / 2
        const ry = Math.abs(ny - sny) / 2
        if (rx > 0.005 || ry > 0.005) {
          onAnnotationAdd({
            type: 'ellipse',
            cx: (snx + nx) / 2,
            cy: (sny + ny) / 2,
            rx,
            ry,
            color: activeColor,
            lineWidth,
            pageIndex
          })
        }
      } else if (activeTool === 'highlight') {
        const w = nx - snx
        const h = ny - sny
        if (Math.abs(w) > 0.005 || Math.abs(h) > 0.005) {
          onAnnotationAdd({
            type: 'highlight',
            x: Math.min(snx, nx),
            y: Math.min(sny, ny),
            w: Math.abs(w),
            h: Math.abs(h),
            color: 'rgba(255,255,0,0.35)',
            pageIndex
          })
        }
      } else if (activeTool === 'line') {
        const dist = Math.sqrt((nx - snx) ** 2 + (ny - sny) ** 2)
        if (dist > 0.01) {
          onAnnotationAdd({
            type: 'line',
            x1: snx, y1: sny,
            x2: nx, y2: ny,
            color: activeColor,
            lineWidth,
            pageIndex
          })
        }
      } else if (activeTool === 'arrow') {
        const dist = Math.sqrt((nx - snx) ** 2 + (ny - sny) ** 2)
        if (dist > 0.01) {
          onAnnotationAdd({
            type: 'arrow',
            x1: snx, y1: sny,
            x2: nx, y2: ny,
            color: activeColor,
            lineWidth,
            pageIndex
          })
        }
      }
    }

    setStartPoint(null)
    setCurrentPath([])
  }, [isDrawing, activeTool, startPoint, currentPath, activeColor, lineWidth, pageIndex, onAnnotationAdd, getCanvasCoords])

  const onMouseLeave = useCallback((e) => {
    if (isDrawing && (activeTool === 'pen' || activeTool === 'highlighter') && currentPath.length > 1) {
      if (activeTool === 'pen') {
        onAnnotationAdd({ type: 'drawing', points: currentPath, color: activeColor, lineWidth, pageIndex })
      } else {
        onAnnotationAdd({ type: 'highlighter', points: currentPath, color: activeColor, lineWidth, pageIndex })
      }
      setIsDrawing(false)
      setCurrentPath([])
      setStartPoint(null)
    }
  }, [isDrawing, activeTool, currentPath, activeColor, lineWidth, pageIndex, onAnnotationAdd])

  const handleEraserMove = useCallback((e) => {
    if (!isDrawing || activeTool !== 'eraser') return
    const { nx, ny } = getCanvasCoords(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const erRadiusX = ERASER_RADIUS / canvas.width
    const erRadiusY = ERASER_RADIUS / canvas.height
    // Signal parent to remove nearby annotations
    // We'll implement eraser by emitting a special annotation type
    // Actually emit as a delete request via custom annotation
    onAnnotationAdd({ type: '_erase', nx, ny, rx: erRadiusX, ry: erRadiusY })
  }, [isDrawing, activeTool, getCanvasCoords, onAnnotationAdd])

  const commitText = useCallback(() => {
    if (!textInput.visible || !textInput.value.trim()) {
      setTextInput(t => ({ ...t, visible: false }))
      return
    }
    onAnnotationAdd({
      type: 'text',
      x: textInput.pixelX,
      y: textInput.pixelY,
      text: textInput.value,
      fontSize,
      color: activeColor,
      pageIndex
    })
    setTextInput(t => ({ ...t, visible: false, value: '' }))
  }, [textInput, fontSize, activeColor, pageIndex, onAnnotationAdd])

  return (
    <div style={{ position: 'relative', width: pageWidth, height: pageHeight }}>
      <canvas
        ref={canvasRef}
        width={pageWidth}
        height={pageHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: getCursor(),
          touchAction: 'none'
        }}
        onMouseDown={onMouseDown}
        onMouseMove={(e) => {
          onMouseMove(e)
          if (activeTool === 'eraser' && isDrawing) handleEraserMove(e)
        }}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      {/* Text input overlay */}
      {textInput.visible && (
        <textarea
          ref={textRef}
          className="canvas-text-input"
          style={{
            position: 'absolute',
            left: textInput.x,
            top: textInput.y,
            fontSize: `${fontSize}px`,
            color: activeColor,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            lineHeight: 1.2,
            zIndex: 50,
            minWidth: 120,
            minHeight: fontSize + 8
          }}
          value={textInput.value}
          onChange={e => setTextInput(t => ({ ...t, value: e.target.value }))}
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitText()
            }
            if (e.key === 'Escape') {
              setTextInput(t => ({ ...t, visible: false, value: '' }))
            }
          }}
          rows={1}
          autoFocus
        />
      )}
    </div>
  )
}

function hexToRgba(hex) {
  if (!hex || !hex.startsWith('#')) return { r: 0, g: 0, b: 0, a: 1 }
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b, a: 1 }
}
