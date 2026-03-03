/**
 * hooks/useFilesInput.js — multi-file selection, drag-drop, metadata extraction
 * Returns an array of file objects; each has: name, type, size, content, preview, costCKB
 */
import { useState, useCallback, useRef } from 'react';
import { estimateCost } from '../lib/minter.js';

const MAX_BYTES = 500 * 1024; // 500KB Spore limit per file

function processRawFile(raw) {
  return new Promise((resolve) => {
    if (raw.size > MAX_BYTES) {
      resolve({ error: `${raw.name}: too large (${(raw.size / 1024).toFixed(0)} KB — limit 500 KB)` });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = new Uint8Array(reader.result);
      const preview = raw.type.startsWith('image/')
        ? URL.createObjectURL(raw)
        : raw.type === 'application/json' || raw.type.startsWith('text/')
          ? new TextDecoder().decode(content).slice(0, 2000)
          : null;
      resolve({
        name:    raw.name,
        type:    raw.type || 'application/octet-stream',
        size:    raw.size,
        content,
        preview,
        isImage: raw.type.startsWith('image/'),
        isText:  raw.type.startsWith('text/') || raw.type === 'application/json',
        costCKB: estimateCost(content.length),
        error:   null,
      });
    };
    reader.readAsArrayBuffer(raw);
  });
}

export function useFilesInput() {
  const [files,     setFiles]     = useState([]);
  const [fileError, setFileError] = useState('');
  const inputRef = useRef(null);

  const addRawFiles = useCallback(async (rawList) => {
    setFileError('');
    const results = await Promise.all(Array.from(rawList).map(processRawFile));
    const errors  = results.filter(r => r.error).map(r => r.error);
    const good    = results.filter(r => !r.error);
    if (errors.length) setFileError(errors.join(' · '));
    if (good.length)   setFiles(prev => [...prev, ...good]);
  }, []);

  const onInputChange = useCallback(e => addRawFiles(e.target.files),   [addRawFiles]);
  const onDrop        = useCallback(e => { e.preventDefault(); addRawFiles(e.dataTransfer.files); }, [addRawFiles]);
  const onDragOver    = useCallback(e => e.preventDefault(), []);
  const removeFile    = useCallback(idx => setFiles(prev => prev.filter((_, i) => i !== idx)), []);
  const clearFiles    = useCallback(() => { setFiles([]); setFileError(''); }, []);
  const openPicker    = useCallback(() => inputRef.current?.click(), []);

  return { files, fileError, inputRef, onInputChange, onDrop, onDragOver, removeFile, clearFiles, openPicker };
}
