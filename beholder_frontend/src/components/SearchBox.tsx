import { useState } from "react";

interface SearchResult {
  pppoe: string;
  nombre: string;
  direccion: string;
  origen: string;
  nodo_ip?: string; // <--- 1. AGREGADO: La IP del nodo para diferenciar duplicados
}

export default function SearchBox({ onResult }: { onResult: (data: any) => void }) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(""); 

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setCandidates([]);
    onResult(null); 
    setStatusMsg("🔍 Buscando...");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL}/search?q=${query}`,
        { headers: { "x-api-key": import.meta.env.VITE_API_KEY } }
      );

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const results: SearchResult[] = await resp.json();

      if (results.length === 0) {
        setError("No se encontraron coincidencias.");
        setStatusMsg("");
      } else if (results.length === 1) {
        setStatusMsg("🎯 Único. Diagnosticando...");
        // 2. MODIFICADO: Pasamos la IP también en la auto-selección
        await fetchDiagnosis(results[0].pppoe, results[0].nodo_ip);
      } else {
        setCandidates(results);
        setStatusMsg(`✅ ${results.length} coincidencias:`);
      }
    } catch (err: any) {
      setError("Error de conexión.");
      setStatusMsg("");
    } finally {
      setLoading(false);
    }
  };

  // 3. MODIFICADO: Acepta parámetro opcional 'ip'
  const fetchDiagnosis = async (pppoe: string, ip?: string) => {
    setLoading(true);
    setCandidates([]); 
    setStatusMsg(`📡 Diagnosticando ${pppoe}...`);
    
    try {
      // Construimos la URL base
      let url = `${import.meta.env.VITE_API_URL}/diagnosis/${pppoe}`;
      // Si tenemos IP, la agregamos como Query Parameter
      if (ip) {
        url += `?ip=${ip}`;
      }

      const resp = await fetch(
        url,
        { headers: { "x-api-key": import.meta.env.VITE_API_KEY } }
      );
      if (!resp.ok) throw new Error("Fallo");
      
      const data = await resp.json();
      onResult({ ...data, pppoe_original: pppoe });
      setStatusMsg(""); 
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Input y Botón */}
      <div className="flex flex-col gap-3 mb-4 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
              if (statusMsg) setStatusMsg("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Nombre, Dirección, DNI o Usuario..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 bg-white"
          />
          <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
        </div>
        
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-all transform active:scale-95 disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar Cliente"}
        </button>
      </div>

      {/* Mensajes */}
      <div className="mb-3 min-h-[20px] shrink-0">
        {loading && <p className="text-blue-600 font-medium text-sm animate-pulse">{statusMsg}</p>}
        {!loading && statusMsg && candidates.length > 0 && <p className="text-green-600 font-medium text-sm">{statusMsg}</p>}
        {error && <div className="bg-red-50 text-red-600 p-2 rounded border border-red-200 text-sm">❌ {error}</div>}
      </div>

      {/* Lista de Resultados */}
      {candidates.length > 0 && (
        <ul className="flex flex-col gap-3 overflow-y-auto pr-2 pb-4 flex-1">
          {candidates.map((c, i) => (
            <li
              key={`${c.pppoe}-${i}`} 
              // 4. MODIFICADO: Al hacer click, enviamos la IP específica de este resultado
              onClick={() => fetchDiagnosis(c.pppoe, c.nodo_ip)}
              className="shrink-0 bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer transition-all group text-left relative overflow-hidden"
            >
              {/* Borde lateral */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${c.origen === 'ispcube' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>

              <div className="pl-3">
                {/* 1. Encabezado: Nombre y Badge */}
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 group-hover:text-blue-700 text-sm uppercase leading-tight">
                    {c.nombre}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ml-2 whitespace-nowrap ${c.origen === 'ispcube' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {c.origen === 'ispcube' ? 'CLIENTE' : 'NO VINC'}
                  </span>
                </div>
                
                {/* 2. PPPoE (Dato Primordial - Más grande y destacado) */}
                <div className="flex items-center gap-2 mb-1.5 bg-gray-50 p-1.5 rounded border border-gray-100">
                   <span title="Usuario PPPoE">👤</span>
                   <code className="text-blue-800 font-bold font-mono text-sm">
                      {c.pppoe}
                   </code>
                </div>
                
                {/* 3. Dirección (Secundaria) */}
                <div className="flex items-start gap-1.5 text-xs text-gray-500">
                  <span className="shrink-0 mt-0.5" title="Dirección">📍</span>
                  <span className="leading-snug break-words">
                    {c.direccion || <i className="text-gray-400">Sin dirección</i>}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}