import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Trafico {
  tiempo: string;
  descarga_mbps: number;
  subida_mbps: number;
}

interface Sesion {
  inicio: string;
  fin: string;
  duracion: string;
  ip_cliente?: string;
  razon_desconexion?: string;
  router: string;
}

interface BeholderHistoryProps {
  usuarioPPPoE: string;
}

export default function BeholderHistory({ usuarioPPPoE }: BeholderHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [trafico, setTrafico] = useState<Trafico[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [rango, setRango] = useState("15m"); // Rango de tráfico inicial, liviano para cargar más rápido

  const handleLoadHistory = async () => {
    setIsOpen(true);
    setLoading(true);
    setError(null);
    setGraphError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "/api";
      const apiKey = import.meta.env.VITE_API_KEY;

      // Fetch ambos endpoints en paralelo, pero sin abortar toda la vista si el gráfico falla.
      const [traficoRes, sesionesRes] = await Promise.allSettled([
        fetch(
          `${apiUrl}/v1/oraculo/trafico-pppoe/${usuarioPPPoE}?rango=${rango}`,
          {
            headers: { "x-api-key": apiKey },
          }
        ),
        fetch(`${apiUrl}/v1/oraculo/sesiones/${usuarioPPPoE}?limite=10`, {
          headers: { "x-api-key": apiKey },
        }),
      ]);

      if (sesionesRes.status === "fulfilled") {
        const sesionesResponse = sesionesRes.value;
        if (sesionesResponse.ok) {
          const sesionesData: Sesion[] = await sesionesResponse.json();
          setSesiones(sesionesData);
        } else {
          throw new Error(`Error cargando sesiones: ${sesionesResponse.status}`);
        }
      } else {
        throw new Error("Error de red cargando sesiones");
      }

      if (traficoRes.status === "fulfilled") {
        const traficoResponse = traficoRes.value;
        if (traficoResponse.ok) {
          const traficoData: Trafico[] = await traficoResponse.json();
          setTrafico(traficoData);
          setGraphError(null);
        } else {
          setTrafico([]);
          setGraphError(
            `El backend no pudo generar el gráfico (${traficoResponse.status}). Se muestran las sesiones igualmente.`
          );
        }
      } else {
        setTrafico([]);
        setGraphError(
          "No se pudo cargar el gráfico de tráfico. Se muestran las sesiones igualmente."
        );
      }
    } catch (err: any) {
      setError(err.message || "Error cargando historial. Intenta de nuevo.");
      setTrafico([]);
      setSesiones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = async (nuevoRango: string) => {
    setRango(nuevoRango);
    setLoading(true);
    setError(null);
    setGraphError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "/api";
      const apiKey = import.meta.env.VITE_API_KEY;

      const res = await fetch(
        `${apiUrl}/v1/oraculo/trafico-pppoe/${usuarioPPPoE}?rango=${nuevoRango}`,
        {
          headers: { "x-api-key": apiKey },
        }
      );

      if (!res.ok) {
        setGraphError(
          `El backend no pudo generar el gráfico (${res.status}).`
        );
        setTrafico([]);
        return;
      }

      const data: Trafico[] = await res.json();
      setTrafico(data);
    } catch (err: any) {
      setGraphError(
        err.message || "Error cargando datos del rango. Intenta de nuevo."
      );
      setTrafico([]);
    } finally {
      setLoading(false);
    }
  };

  // Si no está abierto, mostrar botón
  if (!isOpen) {
    return (
      <div className="mt-6">
        <button
          onClick={handleLoadHistory}
          className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
        >
          <span className="text-lg">📊 Cargar Historial de Tráfico y Sesiones</span>
          <span className="text-xs block mt-1 opacity-90">
            Gráfico de consumo de arranque liviano y sesiones recientes
          </span>
        </button>
      </div>
    );
  }

  // Construir datos para el gráfico
  const chartLabels = trafico.map((t) => {
    const date = new Date(t.tiempo);
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  const descargaData = trafico.map((t) => t.descarga_mbps);
  const subidaData = trafico.map((t) => t.subida_mbps);

  const chartData: ChartData<"line", number[], string> = {
    labels: chartLabels,
    datasets: [
      {
        label: "Descarga (Mbps)",
        data: descargaData,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: "Subida (Mbps)",
        data: subidaData,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: "#d1d5db",
          font: { size: 13, weight: "bold" as const },
        },
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Consumo de Ancho de Banda (${rango})`,
        color: "#f3f4f6",
        font: { size: 16, weight: "bold" as const },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(107, 114, 128, 0.2)" },
        ticks: { color: "#9ca3af", maxTicksLimit: 12 },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(107, 114, 128, 0.2)" },
        ticks: { color: "#9ca3af" },
        title: { display: true, text: "Mbps", color: "#9ca3af" },
      },
    },
  };

  // Función para formatear fecha/hora
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Función para formatear duración
  const formatDuracion = (duracionStr: string) => {
    // Esperamos formato como "00:45:30" o descripción
    if (!duracionStr) return "-";
    return duracionStr;
  };

  return (
    <div className="mt-6 bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-gray-700 shadow-lg p-6 text-gray-100">
      {/* Encabezado con selector de rango */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-xl font-bold text-emerald-400">Historial de Tráfico y Sesiones</h3>
        <div className="flex gap-2 flex-wrap">
          {["15m", "24h", "7d", "30d"].map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              disabled={loading}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                rango === r
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Spinner de carga */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-1 bg-gray-950 rounded-full"></div>
          </div>
          <span className="ml-3 text-gray-300">Cargando datos...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-200 font-semibold">⚠️ Error</p>
          <p className="text-red-100 text-sm mt-1">{error}</p>
        </div>
      )}

      {graphError && !loading && (
        <div className="bg-amber-900 bg-opacity-30 border border-amber-700 rounded-lg p-4 mb-6">
          <p className="text-amber-200 font-semibold">ℹ️ Gráfico no disponible</p>
          <p className="text-amber-100 text-sm mt-1">{graphError}</p>
        </div>
      )}

      {/* Gráfico */}
      {!loading && trafico.length > 0 && (
        <div className="mb-8 bg-gray-800 bg-opacity-50 rounded-lg p-4 border border-gray-700">
          <Line
            data={chartData}
            options={chartOptions}
            height={250}
          />
        </div>
      )}

      {!loading && trafico.length === 0 && !graphError && (
        <div className="mb-8 rounded-lg border border-dashed border-gray-700 bg-gray-800/30 p-4 text-sm text-gray-400">
          Sin registros de tráfico para este rango. Probá cambiar a 7d o 30d si querés ver más histórico.
        </div>
      )}

      {/* Tabla de Sesiones */}
      <div>
        <h4 className="text-lg font-bold text-emerald-400 mb-4">
          Últimas Sesiones ({sesiones.length})
        </h4>

        {sesiones.length === 0 && !loading ? (
          <p className="text-gray-400 text-sm italic">
            Sin sesiones registradas en este rango.
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-700 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-800 border-b border-gray-700">
                  <th className="px-3 py-2 text-left font-semibold text-emerald-300">
                    Inicio
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-emerald-300">
                    Fin
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-emerald-300">
                    Duración
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-emerald-300">
                    Router
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-emerald-300">
                    IP Cliente
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-emerald-300">
                    Motivo Desconexión
                  </th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((sesion, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-700 hover:bg-gray-800 hover:bg-opacity-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-200">
                      {formatDateTime(sesion.inicio)}
                    </td>
                    <td className="px-3 py-2 text-gray-200">
                      {sesion.fin ? formatDateTime(sesion.fin) : "Activa"}
                    </td>
                    <td className="px-3 py-2 text-gray-300 font-semibold">
                      {formatDuracion(sesion.duracion)}
                    </td>
                    <td className="px-3 py-2 text-blue-300">
                      {sesion.router || "-"}
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      {sesion.ip_cliente || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          sesion.razon_desconexion
                            ? "bg-red-900 bg-opacity-50 text-red-200"
                            : "bg-green-900 bg-opacity-50 text-green-200"
                        }`}
                      >
                        {sesion.razon_desconexion || "Normal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Botón para cerrar */}
      <button
        onClick={() => setIsOpen(false)}
        className="mt-6 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors"
      >
        ✕ Cerrar Historial
      </button>
    </div>
  );
}
