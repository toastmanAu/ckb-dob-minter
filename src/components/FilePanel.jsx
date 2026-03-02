import { useState } from 'react';

export function FilePanel({ file, fileError, inputRef, onInputChange, onDrop, onClear, onOpen, contentType, onContentTypeChange }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="card">
      <div className="card-step">Step 2</div>
      <div className="card-title">Content</div>

      {!file ? (
        <div
          className={`dropzone${dragging ? ' drag-over' : ''}`}
          onDrop={e => { setDragging(false); onDrop(e); }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={onOpen}
        >
          <div className="drop-icon">📄</div>
          <p>Drop any file here, or click to browse</p>
          <small>Image · text · JSON · binary · anything up to 500 KB · stored fully on-chain</small>
        </div>
      ) : (
        <div className="file-info-box">
          {file.isImage && <img src={file.preview} alt="preview" className="file-preview" />}
          {file.isText  && <pre className="text-preview">{file.preview}</pre>}
          <div className="file-meta">
            <div className="meta-row"><span className="meta-label">Name</span><span className="meta-value">{file.name}</span></div>
            <div className="meta-row"><span className="meta-label">Size</span><span className="meta-value">{(file.size / 1024).toFixed(1)} KB</span></div>
            <div className="meta-row"><span className="meta-label">Est. cost</span><span className="meta-value text-accent">~{file.costCKB} CKB</span></div>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClear} style={{ marginTop: '0.6rem' }}>× Remove file</button>
        </div>
      )}

      <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={onInputChange} />
      {fileError && <div className="status-error" style={{ marginTop: '0.6rem' }}>{fileError}</div>}

      <div className="field-group" style={{ marginTop: '1rem' }}>
        <label className="field-label">
          Content-Type
          <span className="field-hint">auto-detected · override if needed</span>
        </label>
        <input
          type="text" className="input"
          value={contentType}
          onChange={e => onContentTypeChange(e.target.value)}
          placeholder="image/png"
          list="ct-suggestions"
        />
        <datalist id="ct-suggestions">
          {['image/png','image/jpeg','image/svg+xml','image/gif','image/webp',
            'text/plain','text/html','application/json','application/octet-stream',
            'audio/mpeg','video/mp4'].map(t => <option key={t} value={t} />)}
        </datalist>
      </div>
    </div>
  );
}
