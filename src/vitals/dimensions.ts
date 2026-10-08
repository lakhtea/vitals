// The two coarse "for whom" dimensions every session is tagged with. Values
// mirror what a browser can actually report (UA hints for device class,
// navigator.connection.effectiveType for connection), each with an explicit
// "unknown" because Safari and Firefox expose neither.
export const DEVICE_CLASSES = ["desktop", "mobile", "tablet", "unknown"] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

export const CONNECTION_TYPES = ["slow-2g", "2g", "3g", "4g", "unknown"] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];
