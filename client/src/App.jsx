import React, { useState, useCallback } from 'react'
import axios from 'axios'
import Header from './components/Header.jsx'
import Toolbar from './components/Toolbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import PDFViewer from './components/PDFViewer.jsx'
import SignaturePad from './components/SignaturePad.jsx'
import UploadArea from './components/UploadArea.jsx'

export default function App() {
  const [uploadedFile, setUploadedFile] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const [activeTool, setActiveTool] = useState('select')
  const [activeColor, setActiveColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(2)
  const [fontSize, setFontSize] = useState(16)
  const [annotations, setAnnotations] = useState({})
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [pendingSignature, setPendingSignature] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [activePanel, setActivePanel] = useState('edit')
  const [isMergeOpen, setIsMergeOpen] = useState(false)
  const [isSplitOpen, setIsSplitOpen] = useState(false)
  // textEdits: { [pageIndex]: { [itemId]: { originalStr, newStr, pdfX, pdfY, pdfWidth, pdfFontSize } } }
  const [textEdits, setTextEdits] = useState({})

  const handleTextEdit = useCallback((pageIndex, itemId, editData) => {
    setTextEdits(prev => ({
      ...prev,
      [pageIndex]: { ...(prev[pageIndex] || {}), [itemId]: editData }
    }))
  }, [])

  const pendingTextChanges = Object.values(textEdits).reduce((total, pageEdits) =>
    total + Object.values(pageEdits).filter(e => e.newStr !== e.originalStr).length, 0)

  const handleSaveTextEdits = useCallback(async () => {
    const changes = []
    Object.entries(textEdits).forEach(([pageIdx, pageEdits]) => {
      Object.values(pageEdits).forEach(edit => {
        if (edit.newStr !== edit.originalStr) {
          changes.push({ pageIndex: parseInt(pageIdx), ...edit })
        }
      })
    })

    if (changes.length === 0) {
      setActiveTool('select')
      return
    }

    setIsExporting(true)
    try {
      await axios.post('/api/update-text', { filename: uploadedFile.filename, changes })
      // Force PDF viewer to reload the updated file
      setUploadedFile(prev => ({ ...prev, url: `/api/pdf/${prev.filename}?t=${Date.now()}` }))
      setTextEdits({})
      setActiveTool('select')
    } catch (err) {
      console.error('Save text edits error:', err)
      alert('Failed to save text changes. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [textEdits, uploadedFile])

  const handleCancelTextEdits = useCallback(() => {
    setTextEdits({})
    setActiveTool('select')
  }, [])

  const addAnnotation = useCallback((pageIndex, annotation) => {
    setAnnotations(prev => {
      const pageAnns = prev[pageIndex] ? [...prev[pageIndex]] : []
      const newAnnotations = { ...prev, [pageIndex]: [...pageAnns, annotation] }
      setHistory(h => {
        const newHistory = h.slice(0, historyIndex + 1)
        newHistory.push(newAnnotations)
        setHistoryIndex(newHistory.length - 1)
        return newHistory
      })
      return newAnnotations
    })
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(i => i - 1)
      setAnnotations(history[historyIndex - 1])
    } else if (historyIndex === 0) {
      setHistoryIndex(-1)
      setAnnotations({})
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setAnnotations(history[newIndex])
    }
  }, [history, historyIndex])

  const handleFileUpload = useCallback(async (file) => {
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const { filename, originalName } = response.data
      setUploadedFile({ filename, originalName, url: `/api/pdf/${filename}` })
      setCurrentPage(1)
      setAnnotations({})
      setHistory([])
      setHistoryIndex(-1)
      setPendingSignature(null)
      setActiveTool('select')
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload PDF. Please try again.')
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!uploadedFile) return
    setIsExporting(true)
    try {
      const flatAnnotations = []
      Object.entries(annotations).forEach(([pageIndex, anns]) => {
        anns.forEach(ann => flatAnnotations.push({ ...ann, pageIndex: parseInt(pageIndex) }))
      })
      const response = await axios.post('/api/export', {
        filename: uploadedFile.filename,
        annotations: flatAnnotations
      }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = uploadedFile.originalName || 'exported.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [uploadedFile, annotations])

  const handleMerge = useCallback(async (files) => {
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('pdfs', f))
      const response = await axios.post('/api/merge', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'merged.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setIsMergeOpen(false)
    } catch (err) {
      console.error('Merge error:', err)
      alert('Failed to merge PDFs.')
    }
  }, [])

  const handleSplit = useCallback(async () => {
    if (!uploadedFile) return
    try {
      const response = await axios.post('/api/split', { filename: uploadedFile.filename })
      const { pages } = response.data
      pages.forEach(({ page, data }) => {
        const bytes = atob(data)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        const blob = new Blob([arr], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `page-${page}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      })
      setIsSplitOpen(false)
    } catch (err) {
      console.error('Split error:', err)
      alert('Failed to split PDF.')
    }
  }, [uploadedFile])

  const handleCompress = useCallback(async () => {
    if (!uploadedFile) return
    try {
      const response = await axios.post('/api/compress', { filename: uploadedFile.filename }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'compressed.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Compress error:', err)
      alert('Failed to compress PDF.')
    }
  }, [uploadedFile])

  const handleAddPageNumbers = useCallback(async (position) => {
    if (!uploadedFile) return
    try {
      const response = await axios.post('/api/add-page-numbers', { filename: uploadedFile.filename, position }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'numbered.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Add page numbers error:', err)
      alert('Failed to add page numbers.')
    }
  }, [uploadedFile])

  const handleRotatePage = useCallback(async (pageIndex, angle) => {
    if (!uploadedFile) return
    try {
      await axios.post('/api/rotate', { filename: uploadedFile.filename, pageIndex, angle })
      // Force re-render by updating the URL with a cache buster
      setUploadedFile(prev => ({ ...prev, url: `/api/pdf/${prev.filename}?t=${Date.now()}` }))
    } catch (err) {
      console.error('Rotate error:', err)
      alert('Failed to rotate page.')
    }
  }, [uploadedFile])

  const handleDeletePage = useCallback(async (pageIndex) => {
    if (!uploadedFile) return
    try {
      const response = await axios.post('/api/delete-page', { filename: uploadedFile.filename, pageIndex })
      setTotalPages(response.data.pageCount)
      if (currentPage > response.data.pageCount) setCurrentPage(response.data.pageCount)
      setUploadedFile(prev => ({ ...prev, url: `/api/pdf/${prev.filename}?t=${Date.now()}` }))
      // Remove annotations for deleted page and shift others
      setAnnotations(prev => {
        const newAnnotations = {}
        Object.entries(prev).forEach(([pi, anns]) => {
          const p = parseInt(pi)
          if (p < pageIndex) newAnnotations[p] = anns
          else if (p > pageIndex) newAnnotations[p - 1] = anns
        })
        return newAnnotations
      })
    } catch (err) {
      console.error('Delete page error:', err)
      alert('Failed to delete page.')
    }
  }, [uploadedFile, currentPage])

  return (
    <div className="app">
      <Header
        uploadedFile={uploadedFile}
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        showSidebar={showSidebar}
        onZoomChange={setZoom}
        onPageChange={setCurrentPage}
        onToggleSidebar={() => setShowSidebar(s => !s)}
        onExport={handleExport}
        onShowMerge={() => setIsMergeOpen(true)}
        onShowSplit={handleSplit}
        onCompress={handleCompress}
        onAddPageNumbers={handleAddPageNumbers}
        filename={uploadedFile?.originalName}
        isExporting={isExporting}
      />
      <div className="app-body">
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeColor={activeColor}
          setActiveColor={setActiveColor}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth}
          fontSize={fontSize}
          setFontSize={setFontSize}
          onSignature={() => setShowSignaturePad(true)}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyIndex >= 0}
          canRedo={historyIndex < history.length - 1}
        />
        <main className="main-content" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0 }}>
          {/* Text Edit Mode bar */}
          {activeTool === 'editText' && uploadedFile && (
            <div className="text-edit-bar">
              <div className="text-edit-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>Click any text block to edit it inline</span>
                {pendingTextChanges > 0 && (
                  <span className="text-changes-badge">{pendingTextChanges} change{pendingTextChanges !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="text-edit-actions">
                <button className="btn-secondary btn-sm" onClick={handleCancelTextEdits}>
                  Cancel
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleSaveTextEdits}
                  disabled={isExporting}
                >
                  {isExporting ? 'Saving...' : pendingTextChanges > 0 ? `Save & Close (${pendingTextChanges})` : 'Close'}
                </button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20, background: '#F3F4F6' }}>
            {!uploadedFile ? (
              <UploadArea onUpload={handleFileUpload} onMerge={() => setIsMergeOpen(true)} />
            ) : (
              <PDFViewer
                fileUrl={uploadedFile.url}
                currentPage={currentPage}
                zoom={zoom}
                activeTool={activeTool}
                activeColor={activeColor}
                lineWidth={lineWidth}
                fontSize={fontSize}
                annotations={annotations}
                onAnnotationAdd={addAnnotation}
                pendingSignature={pendingSignature}
                onTotalPages={setTotalPages}
                onRotatePage={handleRotatePage}
                onDeletePage={handleDeletePage}
                setAnnotations={setAnnotations}
                textEdits={textEdits}
                onTextEdit={handleTextEdit}
              />
            )}
          </div>
        </main>
        {showSidebar && uploadedFile && (
          <Sidebar
            fileUrl={uploadedFile.url}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onRotatePage={handleRotatePage}
            onDeletePage={handleDeletePage}
          />
        )}
      </div>

      {showSignaturePad && (
        <SignaturePad
          onSave={(sig) => {
            setPendingSignature(sig)
            setShowSignaturePad(false)
            setActiveTool('signature')
          }}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {isMergeOpen && (
        <MergeModal onMerge={handleMerge} onClose={() => setIsMergeOpen(false)} />
      )}
    </div>
  )
}

function MergeModal({ onMerge, onClose }) {
  const [files, setFiles] = useState([])
  const handleFiles = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.type === 'application/pdf')
    setFiles(prev => [...prev, ...selected])
  }
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i))
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Merge PDFs</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <label className="merge-upload-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Add PDFs
            <input type="file" multiple accept=".pdf" onChange={handleFiles} style={{ display: 'none' }} />
          </label>
          <div className="merge-file-list">
            {files.map((f, i) => (
              <div key={i} className="merge-file-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>{f.name}</span>
                <button onClick={() => removeFile(i)} className="remove-file-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            {files.length === 0 && <p className="empty-merge">No PDFs selected yet.</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onMerge(files)} disabled={files.length < 2}>
            Merge {files.length} PDFs
          </button>
        </div>
      </div>
    </div>
  )
}
