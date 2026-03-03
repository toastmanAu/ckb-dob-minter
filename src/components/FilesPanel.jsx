/**
 * FilesPanel — multi-file version of FilePanel
 * Shows a dropzone + list of queued files, each with remove + content-type override
 */
import { useState } from 'react';

export function FilesPanel({ files, fileError, inputRef, onInputChange, onDrop, onRemove, onOpen }) {
  const [dragging, setDragging] = useState(false);

  const totalCKB = files.reduce((s, f) => s + (f.costCKB || 0), 0);

  return (
    <div className="card">
      <div className="card-step">Step 2</div>
      <div className="card-title">Content {files.length > 0 && <span className="badge">{files.length} file{files.length > 1 ? 's' : ''}</span>}</div>

      <div
        className={`dropzone dropzone-sm${dragging ? ' drag-over' : ''}`}
        onDrop={e => { setDragging(false); onDrop(e); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={onOpen}
      >
        <div className="drop-icon">📂</div>
        <p>{files.length === 0 ? 'Drop files here, or click to browse' : 'Drop more files to add'}</p>
        <small>Up to 500 KB each · any format · stored fully on-chain</small>
      </div>

      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={onInputChange} />
      {fileError && <div className="status-error" style={{ marginTop: '0.5rem' }}>{fileError}</div>}

      {files.length > 0 && (
        <div className="files-list">
          {files.map((f, i) => (
            <div key={i} className="file-row">
              {f.isImage && <img src={f.preview} alt="" className="file-thumb" />}
              {!f.isImage && <span className="file-icon">📄</span>}
              <div className="file-row-info">
                <span className="file-row-name">{f.name}</span>
                <span className="file-row-meta">{(f.size / 1024).toFixed(1)} KB · ~{f.costCKB} CKB · {f.type}</span>
              </div>
              <button className="btn-ghost btn-xs" onClick={() => onRemove(i)}>×</button>
            </div>
          ))}
          {files.length > 1 && (
            <div className="files-total">Total: ~{totalCKB} CKB for {files.length} DOBs</div>
          )}
        </div>
      )}
    </div>
  );
}
