import React, { useState } from 'react'

export default function Header({
  uploadedFile,
  currentPage,
  totalPages,
  zoom,
  showSidebar,
  onZoomChange,
  onPageChange,
  onToggleSidebar,
  onExport,
  onShowMerge,
  onShowSplit,
  onCompress,
  onAddPageNumbers,
  filename,
  isExporting,
  activePage,
  onNavigate,
}) {
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const [showPageNumModal, setShowPageNumModal] = useState(false)
  const [pageNumPosition, setPageNumPosition] = useState('bottom-center')

  const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

  const handleZoomIn = () => {
    const idx = zoomLevels.findIndex(z => z >= zoom)
    if (idx < zoomLevels.length - 1) onZoomChange(zoomLevels[idx + 1])
    else onZoomChange(Math.min(zoom + 0.25, 3.0))
  }

  const handleZoomOut = () => {
    const idx = zoomLevels.findIndex(z => z >= zoom)
    if (idx > 0) onZoomChange(zoomLevels[idx - 1])
    else onZoomChange(Math.max(zoom - 0.25, 0.25))
  }

  const handleAddPageNumbers = () => {
    setShowPageNumModal(true)
    setShowToolsMenu(false)
  }

  return (
    <>
      <header className="header">
        {/* Logo */}
        <div className="header-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#5B4CF5"/>
            <path d="M8 6h8l6 6v14a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" fill="white" opacity="0.9"/>
            <path d="M16 6l6 6h-4a2 2 0 01-2-2V6z" fill="white" opacity="0.6"/>
            <line x1="10" y1="14" x2="18" y2="14" stroke="#5B4CF5" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="10" y1="17" x2="18" y2="17" stroke="#5B4CF5" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="10" y1="20" x2="14" y2="20" stroke="#5B4CF5" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          PDF Leader
        </div>

        {/* Page tabs */}
        <nav className="header-tabs">
          <button
            className={`header-tab ${activePage === 'editor' ? 'active' : ''}`}
            onClick={() => onNavigate('editor')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Editor
          </button>
          <button
            className={`header-tab ${activePage === 'automator' ? 'active' : ''}`}
            onClick={() => onNavigate('automator')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Automator
          </button>
        </nav>

        {/* Filename */}
        <div className="header-filename">
          {activePage === 'editor' ? (filename || (uploadedFile ? 'Untitled.pdf' : 'No file open')) : 'Batch PDF Automator'}
        </div>

        {/* Right actions */}
        <div className="header-actions" style={{ minWidth: 'auto', gap: '6px' }}>
        {activePage === 'editor' && (<>
          {/* Sidebar toggle */}
          <div className="header-group">
            <button
              className={`header-btn ${showSidebar ? 'active' : ''}`}
              onClick={onToggleSidebar}
              title="Toggle pages panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          {uploadedFile && (
            <div className="header-group">
              <button className="page-nav-btn" onClick={handleZoomOut} title="Zoom out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <select
                className="zoom-select"
                value={zoomLevels.includes(zoom) ? zoom : 'custom'}
                onChange={e => onZoomChange(parseFloat(e.target.value))}
              >
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
                {!zoomLevels.includes(zoom) && <option value="custom">{Math.round(zoom * 100)}%</option>}
              </select>
              <button className="page-nav-btn" onClick={handleZoomIn} title="Zoom in">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          )}

          {/* Page navigation */}
          {uploadedFile && totalPages > 0 && (
            <div className="header-group">
              <div className="page-nav">
                <button
                  className="page-nav-btn"
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  title="Previous page"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span style={{ fontSize: '13px', color: '#374151', minWidth: '80px', textAlign: 'center' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="page-nav-btn"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  title="Next page"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Tools dropdown */}
          {uploadedFile && (
            <div className="header-group">
              <div className="tools-dropdown">
                <button
                  className="header-btn"
                  onClick={() => setShowToolsMenu(m => !m)}
                  title="PDF Tools"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                  </svg>
                  Tools
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showToolsMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowToolsMenu(false)} />
                    <div className="tools-dropdown-menu" style={{ zIndex: 200 }}>
                      <div className="tools-dropdown-item" onClick={() => { onShowMerge(); setShowToolsMenu(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
                          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                        </svg>
                        Merge PDFs
                      </div>
                      <div className="tools-dropdown-item" onClick={() => { onShowSplit(); setShowToolsMenu(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                        Split PDF
                      </div>
                      <div className="tools-dropdown-divider" />
                      <div className="tools-dropdown-item" onClick={() => { onCompress(); setShowToolsMenu(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
                          <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                          <line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/>
                        </svg>
                        Compress PDF
                      </div>
                      <div className="tools-dropdown-item" onClick={handleAddPageNumbers}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4CF5" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        Add Page Numbers
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Export */}
          {uploadedFile && (
            <div className="header-group" style={{ borderRight: 'none' }}>
              <button
                className="header-btn primary"
                onClick={onExport}
                disabled={isExporting}
                title="Export PDF"
              >
                {isExporting ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="15"/>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export
                  </>
                )}
              </button>
            </div>
          )}
        </>)}
        </div>
      </header>

      {/* Page Numbers Modal */}
      {showPageNumModal && (
        <div className="modal-overlay" onClick={() => setShowPageNumModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Page Numbers</h2>
              <button className="modal-close" onClick={() => setShowPageNumModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>Choose where to place page numbers:</p>
              <div className="position-grid">
                {[
                  { value: 'top-center', label: 'Top Center' },
                  { value: 'bottom-center', label: 'Bottom Center' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'bottom-right', label: 'Bottom Right' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`position-option ${pageNumPosition === opt.value ? 'selected' : ''}`}
                    onClick={() => setPageNumPosition(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPageNumModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => { onAddPageNumbers(pageNumPosition); setShowPageNumModal(false); }}>
                Add Page Numbers
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
