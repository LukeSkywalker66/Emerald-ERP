export const buildTrackedLabelPrintPath = (serialItemIds = []) => {
  const ids = Array.from(
    new Set(
      (Array.isArray(serialItemIds) ? serialItemIds : [])
        .map((id) => Number.parseInt(String(id), 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (ids.length === 0) {
    return '/app/logistics/print-labels';
  }

  const idsCsv = ids.join(',');
  return `/app/logistics/print-labels?serial_item_ids=${encodeURIComponent(idsCsv)}`;
};

export const getPrintableSerialIdsFromMovement = (movement) => {
  if (!movement || typeof movement !== 'object') {
    return [];
  }

  const directId = Number.parseInt(String(movement.serial_item_id ?? ''), 10);
  const fromArray = Array.isArray(movement.serial_item_ids)
    ? movement.serial_item_ids
    : [];

  const normalized = [
    ...(Number.isFinite(directId) && directId > 0 ? [directId] : []),
    ...fromArray,
  ]
    .map((id) => Number.parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id) && id > 0);

  return Array.from(new Set(normalized));
};
