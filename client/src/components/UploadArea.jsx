import React, { useState, useRef, useCallback } from 'react'

export default function UploadArea({ onUpload, onMerge }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.')
      return
    }
    setIsUploading(true)
    try {
      await onUpload(file)
    } finally {
      setIsUploading(false)
    }
  }, [onUpload])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleClick = () => {
    if (!isUploading) fileInputRef.current?.click()
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="upload-area">
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#5B4CF5"/>
            <path d="M12 10h10l8 8v16a2 2 0 01-2 2H12a2 2 0 01-2-2V12a2 2 0 012-2z" fill="white" opacity="0.9"/>
            <path d="M22 10l8 8h-6a2 2 0 01-2-2v-6z" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#1F2937' }}>PDF Leader</span>
        </div>
        <p style={{ fontSize: 15, color: '#6B7280' }}>Professional PDF editing in your browser</p>
      </div>

      {/* Upload zone */}
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        {isUploading ? (
          <>
            <div className="upload-spinner" />
            <p style={{ color: '#6B7280', fontSize: 15 }}>Uploading PDF...</p>
          </>
        ) : (
          <>
            <div className="upload-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h2>Open a PDF</h2>
            <p>Drag & drop your PDF here, or click to browse</p>
            <button className="btn-primary-lg" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Choose PDF File
            </button>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>PDF files only, up to 50MB</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* Quick actions */}
      <div className="quick-actions">
        <div className="quick-action-card" onClick={onMerge}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          <span>Merge PDFs</span>
        </div>

        <div className="quick-action-card" onClick={() => fileInputRef.current?.click()}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          <span>Edit PDF</span>
        </div>

        <div className="quick-action-card" onClick={() => fileInputRef.current?.click()}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <span>Split PDF</span>
        </div>

        <div className="quick-action-card" onClick={() => fileInputRef.current?.click()}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
            <path d="M3 17c3-3 5-5 7-3s4 4 7 0"/>
            <line x1="3" y1="20" x2="21" y2="20"/>
          </svg>
          <span>Sign PDF</span>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'flex', gap: 24, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
        {[
          { icon: '🔒', text: 'Files processed locally' },
          { icon: '⚡', text: 'Fast & lightweight' },
          { icon: '🎨', text: 'Full annotation suite' },
          { icon: '📱', text: 'Works on any device' },
        ].map(f => (
          <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280' }}>
            <span>{f.icon}</span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
