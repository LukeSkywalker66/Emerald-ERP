import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, Printer } from 'lucide-react';
import { getTrackedUnitLabels, getTrackedUnitLabelsPdf } from '@/services/logistics.service';

function parseSerialItemIds(searchParams) {
  const repeated = searchParams.getAll('serial_item_ids');
  const csv = searchParams.get('serial_item_ids');

  const raw = [];
  if (Array.isArray(repeated) && repeated.length > 0) {
    raw.push(...repeated);
  }
  if (csv && !repeated.includes(csv)) {
    raw.push(csv);
  }

  return raw
    .flatMap((chunk) => String(chunk).split(','))
    .map((value) => Number.parseInt(String(value).trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export default function BarcodeLabelPrinter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const serialItemIds = useMemo(
    () => parseSerialItemIds(searchParams),
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [labels, setLabels] = useState([]);
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const load = async () => {
      if (serialItemIds.length === 0) {
        setError('No se recibieron serial_item_ids para imprimir etiquetas.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getTrackedUnitLabels(serialItemIds);
        setLabels(Array.isArray(data) ? data : []);
      } catch (err) {
        const detail = err?.response?.data?.detail;
        const message = typeof detail === 'string'
          ? detail
          : 'No se pudieron cargar las etiquetas.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [serialItemIds]);

  const handleDownloadPdf = async () => {
    if (serialItemIds.length === 0) return;

    try {
      setDownloading(true);
      setError(null);
      const blob = await getTrackedUnitLabelsPdf(serialItemIds, columns);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Liberar el object URL luego de un rato prudencial.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo generar el PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/inventory/adjustments')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ajustes
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              Etiquetas por fila:
              <select
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-100"
              >
                <option value={2}>2 (recomendado)</option>
                <option value={3}>3</option>
              </select>
            </label>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading || serialItemIds.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              {downloading ? 'Generando PDF…' : `Descargar PDF e imprimir (${columns} por fila)`}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-zinc-300 gap-3">
            <Loader className="w-6 h-6 animate-spin text-emerald-400" />
            Cargando etiquetas...
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded border border-ruby-500/50 bg-ruby-500/10 text-ruby-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <section>
            <header className="mb-4">
              <h1 className="text-2xl font-bold text-emerald-300">Etiquetas de Unidades Trazables</h1>
              <p className="text-zinc-400 text-sm">
                Total: {labels.length} etiqueta(s). El botón genera un PDF con 2 etiquetas por fila,
                listo para imprimir a tamaño real (100%) en la impresora.
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {labels.map((item) => (
                <article
                  key={item.serial_item_id}
                  className="border border-zinc-700 rounded bg-white text-black p-4 flex flex-col items-center justify-center"
                >
                  <img
                    src={item.barcode_png}
                    alt={`Código ${item.serial_number}`}
                    style={{ width: '100%', height: 'auto' }}
                  />
                  <p className="mt-2 text-xs font-mono tracking-wide text-center break-all">
                    {item.serial_number}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
