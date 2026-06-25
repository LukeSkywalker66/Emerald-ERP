import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, Printer } from 'lucide-react';
import { getTrackedUnitLabels } from '@/services/logistics.service';

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
  const [error, setError] = useState(null);
  const [labels, setLabels] = useState([]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .barcode-print-root,
          .barcode-print-root * {
            visibility: visible !important;
          }

          .barcode-print-root {
            position: absolute;
            inset: 0;
            background: white;
            color: black;
            padding: 12mm;
          }

          .no-print {
            display: none !important;
          }

          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8mm;
          }

          .print-card {
            break-inside: avoid;
            border: 1px solid #d4d4d8;
            padding: 4mm;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <div className="no-print flex items-center justify-between mb-6 gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/inventory/adjustments')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ajustes
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir (Ctrl+P)
          </button>
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
          <section className="barcode-print-root">
            <header className="no-print mb-4">
              <h1 className="text-2xl font-bold text-emerald-300">Etiquetas de Unidades Trazables</h1>
              <p className="text-zinc-400 text-sm">
                Total: {labels.length} etiqueta(s). Al imprimir, se ocultará toda la UI y saldrán solo los códigos.
              </p>
            </header>

            <div className="print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {labels.map((item) => (
                <article
                  key={item.serial_item_id}
                  className="print-card border border-zinc-700 rounded bg-white text-black p-3 flex flex-col items-center justify-center"
                >
                  <div
                    className="w-full flex items-center justify-center overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: item.barcode_svg }}
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
