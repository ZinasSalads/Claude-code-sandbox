export type UnitSystem = 'imperial' | 'metric';

// In-memory preference — defaults to imperial (mph, lbs, ft).
// Persists within the app session; resets on restart.
let _current: UnitSystem = 'imperial';

export async function getUnitSystem(): Promise<UnitSystem> {
  return _current;
}

export async function setUnitSystem(system: UnitSystem): Promise<void> {
  _current = system;
}

// Weight: kg ↔ lbs
export function kgToLbs(kg: number): number { return kg * 2.20462; }
export function lbsToKg(lbs: number): number { return lbs / 2.20462; }
export function formatWeight(kg: number, system: UnitSystem): string {
  if (system === 'imperial') return `${Math.round(kgToLbs(kg))} lbs`;
  return `${kg} kg`;
}

// Distance: km ↔ mi
export function kmToMi(km: number): number { return km * 0.621371; }
export function miToKm(mi: number): number { return mi / 0.621371; }
export function formatDistance(km: number, system: UnitSystem): string {
  if (system === 'imperial') return `${kmToMi(km).toFixed(1)} mi`;
  return `${km.toFixed(1)} km`;
}

// Speed: pace min/km → mph or km/h
export function pacePerKmToMph(paceMinPerKm: number): number {
  if (!paceMinPerKm || paceMinPerKm === 0) return 0;
  return 60 / (paceMinPerKm * 1.60934);
}
export function pacePerKmToKph(paceMinPerKm: number): number {
  if (!paceMinPerKm || paceMinPerKm === 0) return 0;
  return 60 / paceMinPerKm;
}
export function formatPace(paceMinPerKm: number, system: UnitSystem): string {
  if (system === 'imperial') return `${pacePerKmToMph(paceMinPerKm).toFixed(1)} mph`;
  return `${pacePerKmToKph(paceMinPerKm).toFixed(1)} km/h`;
}

// Height: cm ↔ ft/in
export function cmToFtIn(cm: number): string {
  const inches = cm / 2.54;
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return `${ft}'${inch}"`;
}
export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === 'imperial') return cmToFtIn(cm);
  return `${cm} cm`;
}
