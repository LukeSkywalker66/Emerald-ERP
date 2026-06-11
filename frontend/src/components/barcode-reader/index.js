/**
 * Barcode Reader Components — módulo reutilizable de escaneo inteligente.
 *
 * Proporciona hooks y componentes para manejar lectores de código de
 * barras (scanner gun) con debounce, validación visual, y contadores.
 */
export { default as BarcodeScanner } from './BarcodeScanner';
export { default as SerialScanner } from './SerialScanner';
export { default as ScanCounter } from './ScanCounter';
export { default as ScannedSerialsList } from './ScannedSerialsList';
export { useBarcodeScan } from './useBarcodeScan';
