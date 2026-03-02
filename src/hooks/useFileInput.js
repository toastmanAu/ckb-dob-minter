/**
 * hooks/useFileInput.js — file selection, drag-drop, metadata extraction
 */
import { useState, useCallback, useRef } from 'react';
import { estimateCost } from '../lib/minter.js';

const MAX_BYTES = 500 * 1024; // 500KB Spore limit

export function useFileInput() {
  const [file,         setFile]         = useState(null);  // { name, type, size, content: Uint8Array, preview: string|null }
  const [fileError,    setFileError]    = useState('');
  const inputRef = useRef(null);

  const processFile = useCallback((raw) => {
    if (!raw) return;
    if (raw.size > MAX_BYTES) {
      setFileError(`File too large: ${(raw.size / 1024).toFixed(0)} KB — Spore Protocol limit is 500 KB`);
      return;
    }
    setFileError('');
    const reader = new FileReader();
    reader.onload = () => {
      const content = new Uint8Array(reader.result);
      const preview = raw.type.startsWith('image/')
        ? URL.createObjectURL(raw)
        : raw.type === 'application/json' || raw.type.startsWith('text/')
          ? new TextDecoder().decode(content).slice(0, 2000)
          : null;
      setFile({
        name:      raw.name,
        type:      raw.type || 'application/octet-stream',
        size:      raw.size,
        content,
        preview,
        isImage:   raw.type.startsWith('image/'),
        isText:    raw.type.startsWith('text/') || raw.type === 'application/json',
        costCKB:   estimateCost(content.length),
      });
    };
    reader.readAsArrayBuffer(raw);
  }, []);

  const onInputChange = useCallback(e => processFile(e.target.files[0]), [processFile]);
  const onDrop        = useCallback(e => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }, [processFile]);
  const onDragOver    = useCallback(e => e.preventDefault(), []);
  const clearFile     = useCallback(() => { setFile(null); setFileError(''); }, []);
  const openPicker    = useCallback(() => inputRef.current?.click(), []);

  return { file, fileError, inputRef, onInputChange, onDrop, onDragOver, clearFile, openPicker };
}
