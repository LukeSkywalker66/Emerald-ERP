/**
 * UpdateLocationModal.jsx
 *
 * Modal reutilizable para actualizar la ubicación (lat/lng) de una WorkOrder
 * pegando un link de Google Maps y validándolo contra /api/v2/utils/parse-map-link.
 *
 * Props:
 *   workOrderId  : number  — ID de la OT a actualizar
 *   isOpen       : boolean — controla visibilidad del modal
 *   onClose      : () => void
 *   onSaved      : (lat, lng) => void — callback al guardar coordenadas exitosamente
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/api/client';

export default function UpdateLocationModal({
  workOrderId,
  isOpen,
  onClose,
  onSaved,
  contentClassName = '',
}) {
  const [mapsLink, setMapsLink] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(null); // null | 'loading' | 'success' | 'error'
  const [parsedLat, setParsedLat] = useState(null);
  const [parsedLng, setParsedLng] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!mapsLink.trim()) return;
    setIsParsing(true);
    setParseSuccess('loading');
    setError('');
    try {
      const res = await api.post('/v2/utils/parse-map-link', { url: mapsLink });
      setParsedLat(res.data.latitude);
      setParsedLng(res.data.longitude);
      setParseSuccess('success');
    } catch (err) {
      const detail =
        err?.response?.data?.detail || err?.message || 'Error desconocido';
      setError(detail);
      setParseSuccess('error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (parsedLat === null || parsedLng === null) return;
    setIsSaving(true);
    setError('');
    try {
      await api.patch(`/v2/work-orders/${workOrderId}`, {
        latitude: parsedLat,
        longitude: parsedLng,
      });
      onSaved?.(parsedLat, parsedLng);
      handleClose();
    } catch (err) {
      const detail =
        err?.response?.data?.detail || err?.message || 'Error al guardar';
      setError(detail);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setMapsLink('');
    setParseSuccess(null);
    setParsedLat(null);
    setParsedLng(null);
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={`bg-zinc-950 border border-zinc-800 text-white max-w-md ${contentClassName}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-400">
            <MapPin size={18} />
            Actualizar Ubicación
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-zinc-400">
            Pegá un link de Google Maps para actualizar la ubicación de la OT
            #{workOrderId}.
          </p>

          {/* Input + Validar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={mapsLink}
              onChange={(e) => {
                setMapsLink(e.target.value);
                setParseSuccess(null);
                setParsedLat(null);
                setParsedLng(null);
                setError('');
              }}
              placeholder="https://maps.app.goo.gl/... o https://www.google.com/maps/..."
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700
                         text-white text-sm placeholder-zinc-600
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <Button
              onClick={handleValidate}
              disabled={isParsing || !mapsLink.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700
                         disabled:text-zinc-500 text-white px-4 py-2 rounded-lg text-sm"
            >
              {isParsing ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                'Validar'
              )}
            </Button>
          </div>

          {/* Status indicator */}
          {parseSuccess === 'success' && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} />
              <span>
                Coordenadas: {parsedLat}, {parsedLng}
              </span>
            </div>
          )}

          {parseSuccess === 'error' && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              <AlertCircle size={16} />
              <span>{error || 'No se pudieron extraer coordenadas'}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            onClick={handleClose}
            variant="ghost"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              parseSuccess !== 'success' || isSaving
            }
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700
                       disabled:text-zinc-500 text-white"
          >
            {isSaving ? (
              <Loader size={16} className="animate-spin mr-1" />
            ) : null}
            Guardar Ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
