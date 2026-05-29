import CopyButton from "./CopyButton";
import BeholderHistory from "./BeholderHistory";

interface OutputBoxProps {
  data: any;
}

export default function OutputBox({ data }: OutputBoxProps) {
  const traducciones: Record<string, string> = {
    Online: "En línea",
    "Power fail": "Problema de energía",
    LOS: "Sin señal/sin luz",
    Offline: "Fuera de línea",
    true: "Conectado",
    false: "Desconectado",
    Critical: "Crítico - Luz muy alta",
    Warning: "Advertencia - Luz alta",
    "Very good": "Muy buena - Luz óptima",
  };

  // Texto para el portapapeles
  const outputText = `
    Cliente: ${data?.cliente_nombre ?? "-"}
    Domicilio: ${data?.direccion ?? "-"}
    Usuario PPPoE: ${data?.pppoe_original ?? data?.pppoe_username ?? "-"}
    Plan: ${data?.plan ?? "-"}
    Nodo: ${data?.nodo_nombre ? data.nodo_nombre + " - " + (data?.nodo_ip ?? "-") : "-"}
    OLT: ${data?.OLT ?? "-"}
    Estado PPPoE: ${traducciones[data?.mikrotik?.active] ?? "-"}
    Tiempo activo: ${data?.mikrotik?.uptime ?? "-"}
    Última conexión: ${data?.mikrotik?.secret?.["last-logged-out"] ?? "-"}
    ONU s/n: ${data?.onu_sn ?? "-"}
    ONU Estado: ${traducciones[data?.onu_status_smrt?.onu_status] ?? "-"}
    ONU Último cambio de estado: ${data?.onu_status_smrt?.last_status_change ?? "-"}
    ONU Señal: ${traducciones[data?.onu_signal_smrt?.onu_signal] ?? "-"}
    Señal Detalle: ${data?.onu_signal_smrt?.onu_signal_value ?? "-"}
    `;

  return (
    // Se agregan clases dark: para el fondo y borde
    <div className="border rounded-xl p-6 mt-4 bg-white dark:bg-[#2c2c2c] shadow-sm border-gray-100 dark:border-gray-700 transition-colors">
      <div className="header-row">
        <h3 className="diagnostic-title dark:text-white">Diagnóstico normalizado</h3>
        <CopyButton text={outputText} />
      </div>
      
      <div className="grid">
        
        {/* FILA 1: DATOS PRINCIPALES (Ocupan mitad y mitad en PC) */}
        <div className="cell span-2">
            <strong>Cliente:</strong> 
            <span className="text-lg font-medium">{data?.cliente_nombre ?? "-"}</span>
        </div>
        <div className="cell span-2">
            <strong>Domicilio:</strong> 
            <span>{data?.direccion ?? "-"}</span>
        </div>
        
        {/* FILA 2: DATOS DE RED (4 columnas en PC) */}
        <div className="cell">
            <strong>Usuario PPPoE:</strong> 
            {data?.pppoe_original ?? data?.pppoe_username ?? "-"}
        </div>
        <div className="cell">
            <strong>Plan:</strong> 
            {data?.plan ?? "-"}
        </div>
        <div className="cell">
            <strong>Nodo:</strong> 
            {data?.nodo_nombre ? data.nodo_nombre : "-"}
            <span className="text-xs text-gray-500">{data?.nodo_ip ?? ""}</span>
        </div>
        <div className="cell">
            <strong>OLT:</strong> 
            {data?.OLT ?? "-"}
        </div>
        
        {/* FILA 3: ESTADOS (Colorizados) */}
        <div className={`cell ${data?.mikrotik?.active ? "estado-ok" : "estado-error"}`}>
          <strong>Estado PPPoE:</strong> {traducciones[data?.mikrotik?.active] ?? "-"}
        </div>
        <div className="cell">
            <strong>Tiempo activo:</strong> {data?.mikrotik?.uptime ?? "-"}
        </div>
        <div className={`cell ${data?.onu_status_smrt?.onu_status === "Online" ? "estado-ok" : "estado-error"}`}>
          <strong>ONU Estado:</strong> {traducciones[data?.onu_status_smrt?.onu_status] ?? "-"}
        </div>
        <div className="cell">
            <strong>ONU Señal:</strong> {traducciones[data?.onu_signal_smrt?.onu_signal] ?? "-"}
        </div>

        {/* FILA 4: DETALLES */}
        <div className="cell">
            <strong>Última conexión:</strong> {data?.mikrotik?.secret?.["last-logged-out"] ?? "-"}
        </div>
        <div className="cell">
            <strong>ONU s/n:</strong> {data?.onu_sn ?? "-"}
        </div>
        <div className="cell">
            <strong>Último cambio:</strong> {data?.onu_status_smrt?.last_status_change ?? "-"}
        </div>
        <div className="cell">
            <strong>Señal Detalle:</strong> {data?.onu_signal_smrt?.onu_signal_value ?? "-"}
        </div>
      </div>

      {/* Componente de historial: Lazy load */}
      {(data?.pppoe_original || data?.pppoe_username) && (
        <BeholderHistory usuarioPPPoE={data?.pppoe_original || data?.pppoe_username} />
      )}
    </div>
  );
}