/** Unit conversion helpers — permissive in-house tables (no copyleft deps). */

export const UNIT_CATEGORIES = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'm', label: 'metres (m)', toBase: 1 },
      { id: 'km', label: 'kilometres (km)', toBase: 1000 },
      { id: 'cm', label: 'centimetres (cm)', toBase: 0.01 },
      { id: 'mm', label: 'millimetres (mm)', toBase: 0.001 },
      { id: 'mi', label: 'miles (mi)', toBase: 1609.344 },
      { id: 'yd', label: 'yards (yd)', toBase: 0.9144 },
      { id: 'ft', label: 'feet (ft)', toBase: 0.3048 },
      { id: 'in', label: 'inches (in)', toBase: 0.0254 },
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    units: [
      { id: 'kg', label: 'kilograms (kg)', toBase: 1 },
      { id: 'g', label: 'grams (g)', toBase: 0.001 },
      { id: 'mg', label: 'milligrams (mg)', toBase: 0.000001 },
      { id: 'lb', label: 'pounds (lb)', toBase: 0.45359237 },
      { id: 'oz', label: 'ounces (oz)', toBase: 0.028349523125 },
      { id: 't', label: 'tonnes (t)', toBase: 1000 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'C', label: 'Celsius (°C)' },
      { id: 'F', label: 'Fahrenheit (°F)' },
      { id: 'K', label: 'Kelvin (K)' },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    units: [
      { id: 's', label: 'seconds (s)', toBase: 1 },
      { id: 'min', label: 'minutes (min)', toBase: 60 },
      { id: 'h', label: 'hours (h)', toBase: 3600 },
      { id: 'd', label: 'days (d)', toBase: 86400 },
      { id: 'ms', label: 'milliseconds (ms)', toBase: 0.001 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    units: [
      { id: 'B', label: 'bytes (B)', toBase: 1 },
      { id: 'KB', label: 'kilobytes (KB)', toBase: 1000 },
      { id: 'MB', label: 'megabytes (MB)', toBase: 1e6 },
      { id: 'GB', label: 'gigabytes (GB)', toBase: 1e9 },
      { id: 'KiB', label: 'kibibytes (KiB)', toBase: 1024 },
      { id: 'MiB', label: 'mebibytes (MiB)', toBase: 1024 ** 2 },
      { id: 'GiB', label: 'gibibytes (GiB)', toBase: 1024 ** 3 },
    ],
  },
  {
    id: 'angle',
    label: 'Angle',
    units: [
      { id: 'rad', label: 'radians (rad)', toBase: 1 },
      { id: 'deg', label: 'degrees (°)', toBase: Math.PI / 180 },
      { id: 'grad', label: 'gradians (gon)', toBase: Math.PI / 200 },
    ],
  },
];

const UNIT_INDEX = new Map();
UNIT_CATEGORIES.forEach((cat) => {
  cat.units.forEach((unit) => {
    UNIT_INDEX.set(unit.id, { ...unit, category: cat.id, categoryLabel: cat.label });
  });
});

export function getUnit(unitId) {
  return UNIT_INDEX.get(unitId) || null;
}

export function categoryForUnit(unitId) {
  return getUnit(unitId)?.category || null;
}

/** Compatible output units for a chosen input unit (same dimension, excluding self optional). */
export function listCompatibleUnits(fromUnitId, { includeSelf = true } = {}) {
  const from = getUnit(fromUnitId);
  if (!from) return [];
  const cat = UNIT_CATEGORIES.find((c) => c.id === from.category);
  if (!cat) return [];
  return cat.units.filter((u) => includeSelf || u.id !== fromUnitId);
}

function tempToKelvin(value, fromId) {
  if (fromId === 'K') return value;
  if (fromId === 'C') return value + 273.15;
  if (fromId === 'F') return ((value - 32) * 5) / 9 + 273.15;
  return NaN;
}

function kelvinToTemp(kelvin, toId) {
  if (toId === 'K') return kelvin;
  if (toId === 'C') return kelvin - 273.15;
  if (toId === 'F') return ((kelvin - 273.15) * 9) / 5 + 32;
  return NaN;
}

export function convertUnits(value, fromUnitId, toUnitId) {
  const n = Number(value);
  if (!Number.isFinite(n)) return { error: 'Enter a valid number', result: null };
  const from = getUnit(fromUnitId);
  const to = getUnit(toUnitId);
  if (!from || !to) return { error: 'Unknown unit', result: null };
  if (from.category !== to.category) {
    return { error: 'Units are not compatible', result: null };
  }
  if (from.category === 'temperature') {
    const k = tempToKelvin(n, from.id);
    const out = kelvinToTemp(k, to.id);
    if (!Number.isFinite(out)) return { error: 'Conversion failed', result: null };
    return { error: null, result: out };
  }
  const base = n * from.toBase;
  const out = base / to.toBase;
  if (!Number.isFinite(out)) return { error: 'Conversion failed', result: null };
  return { error: null, result: out };
}

export function formatUnitResult(value) {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return value.toExponential(6);
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

/** Parse a number from math eval flat text or typed value. */
export function parseNumericInput(raw) {
  if (raw == null) return NaN;
  if (typeof raw === 'number') return raw;
  const text = String(raw).trim().replace(/,/g, '');
  if (!text) return NaN;
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  const match = text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
  if (!match) return NaN;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : NaN;
}
