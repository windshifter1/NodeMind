function irand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function fmt(n) {
  return n.toFixed(2);
}

function bow(seed, amp) {
  return (irand(seed) - 0.5) * 2 * amp;
}

function smoothPath(pts, { closed = false } = {}) {
  if (pts.length < 2) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  const ring = closed ? [last, ...pts, first, pts[1]] : [first, ...pts, last];
  const count = closed ? pts.length : pts.length - 1;
  let d = `M ${fmt(first[0])} ${fmt(first[1])}`;
  for (let i = 0; i < count; i += 1) {
    const p0 = ring[i];
    const p1 = ring[i + 1];
    const p2 = ring[i + 2];
    const p3 = ring[i + 3];
    d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)}, ${fmt(
      p2[0] - (p3[0] - p1[0]) / 6,
    )} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

export function hashSeed(value) {
  const text = String(value ?? '');
  let n = 7;
  for (let i = 0; i < text.length; i += 1) n = (n * 31 + text.charCodeAt(i)) >>> 0;
  return n || 11;
}

export function wobbleRect(seed, w, h, { pad = 5, amp = 2.2 } = {}) {
  const x0 = pad;
  const y0 = pad;
  const x1 = w - pad;
  const y1 = h - pad;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const pts = [
    [x0 + bow(seed, amp * 0.35), y0 + bow(seed + 1, amp * 0.35)],
    [mx + bow(seed + 2, amp * 0.4), y0 + bow(seed + 3, amp)],
    [x1 + bow(seed + 4, amp * 0.35), y0 + bow(seed + 5, amp * 0.35)],
    [x1 + bow(seed + 6, amp), my + bow(seed + 7, amp * 0.4)],
    [x1 + bow(seed + 8, amp * 0.35), y1 + bow(seed + 9, amp * 0.35)],
    [mx + bow(seed + 10, amp * 0.4), y1 + bow(seed + 11, amp)],
    [x0 + bow(seed + 12, amp * 0.35), y1 + bow(seed + 13, amp * 0.35)],
    [x0 + bow(seed + 14, amp), my + bow(seed + 15, amp * 0.4)],
  ];
  return smoothPath(pts, { closed: true });
}

export function scribbleLine(seed, points, amp = 2) {
  const pts = [];
  points.forEach((p, i) => {
    pts.push([p[0] + bow(seed + i * 4, amp * 0.45), p[1] + bow(seed + i * 4 + 1, amp * 0.45)]);
    if (i < points.length - 1) {
      const n = points[i + 1];
      pts.push([
        (p[0] + n[0]) / 2 + bow(seed + i * 4 + 2, amp),
        (p[1] + n[1]) / 2 + bow(seed + i * 4 + 3, amp),
      ]);
    }
  });
  return smoothPath(pts, { closed: false });
}

export { irand };
