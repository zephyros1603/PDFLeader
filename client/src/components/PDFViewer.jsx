import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'
import AnnotationCanvas from './AnnotationCanvas.jsx'
import TextEditOverlay from './TextEditOverlay.jsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function PDFViewer({
  fileUrl,
  currentPage,
  zoom,
  activeTool,
  activeColor,
  lineWidth,
  fontSize,
  annotations,
  onAnnotationAdd,
  pendingSignature,
  onTotalPages,
  onRotatePage,
  onDeletePage,
  setAnnotations,
  textEdits,
  onTextEdit,
}) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(false)
  const renderTasksRef = useRef({})
  const pdfDocRef = useRef(null)

  useEffect(() => {
    if (!fileUrl) return
    setLoading(true)
    setLoadError(null)

    Object.values(renderTasksRef.current).forEach(task => {
      try { task.cancel() } catch {}
    })
    renderTasksRef.current = {}

    const loadingTask = pdfjsLib.getDocument(fileUrl)
    loadingTask.promise.then(doc => {
      pdfDocRef.current = doc
      setPdfDoc(doc)
      onTotalPages(doc.numPages)
      setLoading(false)
    }).catch(err => {
      console.error('PDF load error:', err)
      setLoadError('Failed to load PDF. Please try again.')
      setLoading(false)
    })

    return () => { loadingTask.destroy?.() }
  }, [fileUrl])

  if (loading) {
    return (
      <div className="loading-page">
        <div className="upload-spinner" />
        <span style={{ marginLeft: 12, color: '#6B7280', fontSize: 14 }}>Loading PDF...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="loading-page" style={{ flexDirection: 'column', gap: 8 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ color: '#EF4444' }}>{loadError}</p>
      </div>
    )
  }

  if (!pdfDoc) return null

  const totalPages = pdfDoc.numPages

  return (
    <div className="pdf-viewer">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
        <PageRenderer
          key={`${fileUrl}-${pageNum}`}
          pageNum={pageNum}
          pdfDoc={pdfDoc}
          zoom={zoom}
          isCurrentPage={pageNum === currentPage}
          activeTool={activeTool}
          activeColor={activeColor}
          lineWidth={lineWidth}
          fontSize={fontSize}
          annotations={annotations[pageNum - 1] || []}
          onAnnotationAdd={(ann) => onAnnotationAdd(pageNum - 1, ann)}
          pendingSignature={pendingSignature}
          onRotatePage={onRotatePage}
          onDeletePage={onDeletePage}
          totalPages={totalPages}
          textEdits={textEdits ? (textEdits[pageNum - 1] || {}) : {}}
          onTextEdit={(itemId, data) => onTextEdit && onTextEdit(pageNum - 1, itemId, data)}
        />
      ))}
    </div>
  )
}

function PageRenderer({
  pageNum,
  pdfDoc,
  zoom,
  isCurrentPage,
  activeTool,
  activeColor,
  lineWidth,
  fontSize,
  annotations,
  onAnnotationAdd,
  pendingSignature,
  onRotatePage,
  onDeletePage,
  totalPages,
  textEdits,
  onTextEdit,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const renderTaskRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [textItems, setTextItems] = useState([])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let cancelled = false
    const scale = zoom * 1.5

    const doRender = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel() } catch {}
        renderTaskRef.current = null
      }

      try {
        const page = await pdfDoc.getPage(pageNum)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        const ctx = canvas.getContext('2d')
        const renderTask = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise
        if (cancelled) return
        renderTaskRef.current = null

        setDimensions({ width: viewport.width, height: viewport.height })

        // Extract text items for the Edit Text overlay
        const textContent = await page.getTextContent()
        if (cancelled) return

        const extracted = textContent.items
          .filter(item => item.str && item.str.trim().length > 0)
          .map((item, idx) => {
            const [a, b, , , pdfX, pdfY] = item.transform
            const pdfFontSize = Math.max(Math.sqrt(a * a + b * b), 1)
            const screenFontSize = pdfFontSize * scale

            // viewport.convertToViewportPoint maps PDF user-space → canvas pixels
            const [screenX, screenBaseline] = viewport.convertToViewportPoint(pdfX, pdfY)

            return {
              id: `p${pageNum}-i${idx}`,
              str: item.str,
              // Position the box so its bottom aligns with the text baseline
              screenX,
              screenY: screenBaseline - screenFontSize,
              screenWidth: Math.max((item.width || 0) * scale, Math.max(screenFontSize * 0.4, 8)),
              screenHeight: Math.max(screenFontSize * 1.25, 10),
              screenFontSize,
              // PDF-space coordinates sent to the server on save
              pdfX,
              pdfY,
              pdfWidth: item.width || 0,
              pdfFontSize,
              fontName: item.fontName,
            }
          })
        setTextItems(extracted)
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err)
        }
      }
    }

    doRender()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel() } catch {}
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNum, zoom])

  const isEditTextMode = activeTool === 'editText'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        boxShadow: isCurrentPage
          ? '0 0 0 2px #5B4CF5, 0 4px 20px rgba(0,0,0,0.15)'
          : '0 4px 20px rgba(0,0,0,0.12)',
        borderRadius: 4,
        overflow: 'visible',
        background: 'white',
        display: 'inline-block',
        marginBottom: 4,
        cursor: isEditTextMode ? 'text' : 'default',
      }}
      id={`page-${pageNum}`}
    >
      <div style={{
        position: 'absolute',
        top: -24,
        left: 0,
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: 500,
      }}>
        Page {pageNum}
      </div>

      <canvas ref={canvasRef} className="pdf-canvas" />

      {dimensions.width > 0 && (
        <>
          {/* Annotation canvas — disabled in editText mode */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: dimensions.width,
            height: dimensions.height,
            pointerEvents: activeTool === 'select' || isEditTextMode ? 'none' : 'auto',
          }}>
            <AnnotationCanvas
              pageIndex={pageNum - 1}
              pageWidth={dimensions.width}
              pageHeight={dimensions.height}
              zoom={zoom}
              activeTool={activeTool}
              activeColor={activeColor}
              lineWidth={lineWidth}
              fontSize={fontSize}
              annotations={annotations}
              onAnnotationAdd={onAnnotationAdd}
              pendingSignature={pendingSignature}
            />
          </div>

          {/* Text edit overlay — only in editText mode */}
          {isEditTextMode && (
            <TextEditOverlay
              textItems={textItems}
              pageIndex={pageNum - 1}
              zoom={zoom}
              edits={textEdits}
              onEdit={onTextEdit}
            />
          )}
        </>
      )}

      {/* Hover page controls (rotate / delete) */}
      <div
        className="page-controls"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 4,
          opacity: 0,
          transition: 'opacity 0.15s',
          zIndex: 10,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
      >
        <PageControlsInner
          pageNum={pageNum}
          onRotate={(angle) => onRotatePage(pageNum - 1, angle)}
          onDelete={() => onDeletePage(pageNum - 1)}
          totalPages={totalPages}
        />
      </div>
    </div>
  )
}

function PageControlsInner({ onRotate, onDelete, totalPages }) {
  return (
    <>
      <button onClick={() => onRotate(-90)} style={ctrlBtn} title="Rotate left"
        onMouseEnter={e => Object.assign(e.currentTarget.style, ctrlBtnHover)}
        onMouseLeave={e => Object.assign(e.currentTarget.style, ctrlBtn)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.29"/>
        </svg>
      </button>
      <button onClick={() => onRotate(90)} style={ctrlBtn} title="Rotate right"
        onMouseEnter={e => Object.assign(e.currentTarget.style, ctrlBtnHover)}
        onMouseLeave={e => Object.assign(e.currentTarget.style, ctrlBtn)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.29"/>
        </svg>
      </button>
      {totalPages > 1 && (
        <button
          onClick={onDelete}
          style={{ ...ctrlBtn, borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444' }}
          title="Delete page"
          onMouseEnter={e => Object.assign(e.currentTarget.style, { ...ctrlBtnHover, background: 'rgba(239,68,68,0.9)', color: 'white' })}
          onMouseLeave={e => Object.assign(e.currentTarget.style, { ...ctrlBtn, borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444' })}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      )}
    </>
  )
}

const ctrlBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 5,
  border: '1px solid rgba(255,255,255,0.4)',
  background: 'rgba(0,0,0,0.55)', color: 'white',
  cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 0.15s',
}
const ctrlBtnHover = { ...ctrlBtn, background: 'rgba(0,0,0,0.8)' }
