import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, ZoomIn, ZoomOut, Maximize, Minimize, RotateCw, Download, Loader2, AlertTriangle } from 'lucide-react';

/**
 * ImageViewer — Visor de imágenes con zoom, paneo, pantalla completa y gestos táctiles.
 *
 * Props:
 *   image: { url, name, size, type? }
 *   onClose: () => void
 *
 * Arquitectura:
 *   - Renderiza via createPortal para evitar stacking context issues.
 *   - Zoom/Pan mediante CSS transform (GPU composited).
 *   - Manejo de eventos con useCallback para estabilidad de referencias.
 *   - Sin dependencias externas (pure React + Tailwind).
 */

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const ZOOM_STEP_SCROLL = 0.1;
const ZOOM_STEP_BUTTON = 0.25;

export default function ImageViewer({ image, onClose }) {
  // ── Estado ──────────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ── Refs ────────────────────────────────────────────────────────────────────
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // Mantener refs sincronizados para los event listeners
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ── Resetear zoom/pan al cambiar de imagen ─────────────────────────────────
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLoadState('loading');
  }, [image?.url]);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API puede no estar disponible o ser bloqueado
    }
  }, []);

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // ── Zoom helpers ────────────────────────────────────────────────────────────
  const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  const applyZoom = useCallback((newZoom, centerX, centerY) => {
    const clamped = clampZoom(newZoom);
    const container = containerRef.current;
    if (!container) {
      setZoom(clamped);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = container.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;

    // Ajustar pan para que el punto bajo el cursor permanezca fijo
    const scale = clamped / zoomRef.current;
    setPan(prev => ({
      x: cx - scale * (cx - prev.x),
      y: cy - scale * (cy - prev.y),
    }));
    setZoom(clamped);
  }, []);

  const zoomIn = useCallback(() => {
    applyZoom(zoomRef.current + ZOOM_STEP_BUTTON);
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    applyZoom(zoomRef.current - ZOOM_STEP_BUTTON);
  }, [applyZoom]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ── Mouse wheel zoom ────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+scroll nativo del navegador — no interceptar
      return;
    }
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP_SCROLL : ZOOM_STEP_SCROLL;
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? e.clientX - rect.left : undefined;
    const cy = rect ? e.clientY - rect.top : undefined;
    applyZoom(zoomRef.current + delta, cx, cy);
  }, [applyZoom]);

  // ── Mouse drag pan ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ── Double-click zoom ────────────────────────────────────────────────────────
  const handleDoubleClick = useCallback((e) => {
    if (zoomRef.current > 1.5) {
      resetZoom();
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : undefined;
      const cy = rect ? e.clientY - rect.top : undefined;
      applyZoom(zoomRef.current + 1, cx, cy);
    }
  }, [applyZoom, resetZoom]);

  // ── Touch gestures ──────────────────────────────────────────────────────────
  const touchState = useRef({ touches: [], lastDist: 0, lastTap: 0 });

  const handleTouchStart = useCallback((e) => {
    const touches = Array.from(e.touches);
    touchState.current.touches = touches;

    if (touches.length === 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      touchState.current.lastDist = Math.sqrt(dx * dx + dy * dy);
      e.preventDefault();
    } else if (touches.length === 1 && zoomRef.current > 1) {
      setIsDragging(true);
      setDragStart({
        x: touches[0].clientX - panRef.current.x,
        y: touches[0].clientY - panRef.current.y,
      });
    } else if (touches.length === 1) {
      // Double-tap detection
      const now = Date.now();
      if (now - touchState.current.lastTap < 300) {
        handleDoubleClick({ clientX: touches[0].clientX, clientY: touches[0].clientY });
        touchState.current.lastTap = 0;
      } else {
        touchState.current.lastTap = now;
      }
    }
  }, [handleDoubleClick]);

  const handleTouchMove = useCallback((e) => {
    const touches = Array.from(e.touches);

    if (touches.length === 2) {
      e.preventDefault();
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = (dist - touchState.current.lastDist) * 0.01;
      touchState.current.lastDist = dist;

      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? (touches[0].clientX + touches[1].clientX) / 2 - rect.left : undefined;
      const cy = rect ? (touches[0].clientY + touches[1].clientY) / 2 - rect.top : undefined;
      applyZoom(zoomRef.current + delta, cx, cy);
    } else if (touches.length === 1 && isDragging) {
      setPan({
        x: touches[0].clientX - dragStart.x,
        y: touches[0].clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, applyZoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    touchState.current.touches = [];
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y + 50 }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y - 50 }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x + 50 }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x - 50 }));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, zoomIn, zoomOut, resetZoom, toggleFullscreen, isFullscreen]);

  // ── Global mouse up (para capturar fuera del componente) ────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => window.removeEventListener('mouseup', handleGlobalUp);
  }, [isDragging]);

  // ── Cerrar con click en backdrop ────────────────────────────────────────────
  const handleBackdropClick = useCallback((e) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  }, [onClose]);

  // ── Calcular escala para info bar ──────────────────────────────────────────
  const zoomPercent = Math.round(zoom * 100);

  // ── Render ─────────────────────────────────────────────────────────────────
  const viewer = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBackdropClick}
      style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
    >
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm text-zinc-300 truncate max-w-[200px] sm:max-w-[400px]">
            {image?.name || 'Imagen'}
          </p>
          {image?.size && (
            <span className="text-xs text-zinc-500 shrink-0">
              {formatBytes(image.size)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            title="Alejar (-)"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition font-mono min-w-[48px] text-center"
            title="Restablecer zoom (0)"
          >
            {zoomPercent}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            title="Acercar (+)"
          >
            <ZoomIn size={16} />
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            title={isFullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>

          {/* Download */}
          {image?.url && (
            <a
              href={image.url}
              download={image.name}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Descargar imagen"
            >
              <Download size={16} />
            </a>
          )}

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-red-900/50 text-zinc-400 hover:text-red-400 transition"
            title="Cerrar (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Image area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative min-h-0">
        {/* Loading */}
        {loadState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-emerald-400 animate-spin" />
              <p className="text-sm text-zinc-500">Cargando imagen...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <AlertTriangle size={32} className="text-ruby-400" />
              <p className="text-sm text-zinc-400">No se pudo cargar la imagen</p>
              <button
                onClick={() => {
                  setLoadState('loading');
                  // Forzar recarga del img
                  if (imageRef.current) {
                    imageRef.current.src = image.url;
                  }
                }}
                className="px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Image */}
        <img
          ref={imageRef}
          src={image?.url}
          alt={image?.name || ''}
          onLoad={() => setLoadState('loaded')}
          onError={() => setLoadState('error')}
          className="max-w-full max-h-full transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            willChange: 'transform',
            opacity: loadState === 'loaded' ? 1 : 0,
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      </div>

      {/* ── Bottom hint bar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-zinc-950/60 border-t border-zinc-800/50 shrink-0">
        <span className="text-[11px] text-zinc-600 hidden sm:inline">
          Rueda: zoom
        </span>
        <span className="text-[11px] text-zinc-600 hidden sm:inline">
          Arrastrar: paneo
        </span>
        <span className="text-[11px] text-zinc-600 hidden sm:inline">
          {isFullscreen ? 'F: salir' : 'F: pantalla completa'}
        </span>
        <span className="text-[11px] text-zinc-600">
          ESC: cerrar
        </span>
      </div>
    </div>
  );

  return ReactDOM.createPortal(viewer, document.body);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
