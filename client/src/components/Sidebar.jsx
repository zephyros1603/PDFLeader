import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function Sidebar({ fileUrl, totalPages, currentPage, onPageChange, onRotatePage, onDeletePage }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [thumbnails, setThumbnails] = useState([])
  const containerRef = useRef(null)
  const canvasRefs = useRef({})

  useEffect(() => {
    if (!fileUrl) return
    setPdfDoc(null)
    setThumbnails([])
    const task = pdfjsLib.getDocument(fileUrl)
    task.promise.then(doc => {
      setPdfDoc(doc)
    }).catch(err => {
      console.error('Sidebar PDF load error:', err)
    })
    return () => { task.destroy?.() }
  }, [fileUrl])

  useEffect(() => {
    if (!pdfDoc) return
    const numPages = pdfDoc.numPages
    const newThumbnails = []
    for (let i = 0; i < numPages; i++) newThumbnails.push(i + 1)
    setThumbnails(newThumbnails)
  }, [pdfDoc])

  useEffect(() => {
    if (!pdfDoc || thumbnails.length === 0) return
    thumbnails.forEach(pageNum => {
      const canvas = canvasRefs.current[pageNum]
      if (!canvas) return
      renderThumbnail(pdfDoc, pageNum, canvas)
    })
  }, [pdfDoc, thumbnails])

  // Scroll to current page
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-page="${currentPage}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentPage])

  const renderThumbnail = async (doc, pageNum, canvas) => {
    try {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 0.2 })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.error('Thumbnail render error:', err)
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Pages {totalPages > 0 ? `(${totalPages})` : ''}</h3>
      </div>
      <div className="sidebar-pages" ref={containerRef}>
        {thumbnails.map(pageNum => (
          <div
            key={pageNum}
            data-page={pageNum}
            className={`page-thumbnail ${currentPage === pageNum ? 'active' : ''}`}
            onClick={() => onPageChange(pageNum)}
          >
            <canvas
              ref={el => { if (el) canvasRefs.current[pageNum] = el }}
              style={{ maxWidth: '140px', borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
            />
            <div className="thumbnail-actions">
              <button
                className="thumbnail-action-btn"
                onClick={(e) => { e.stopPropagation(); onRotatePage(pageNum - 1, -90) }}
                title="Rotate left"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.29"/>
                </svg>
              </button>
              <button
                className="thumbnail-action-btn"
                onClick={(e) => { e.stopPropagation(); onRotatePage(pageNum - 1, 90) }}
                title="Rotate right"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.29"/>
                </svg>
              </button>
              {totalPages > 1 && (
                <button
                  className="thumbnail-action-btn danger"
                  onClick={(e) => { e.stopPropagation(); onDeletePage(pageNum - 1) }}
                  title="Delete page"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="page-thumbnail-num">{pageNum}</div>
          </div>
        ))}
        {thumbnails.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Loading pages...
          </div>
        )}
      </div>
    </div>
  )
}
