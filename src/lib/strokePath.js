/**
 * Freehand stroke path helpers.
 * Smooth mode uses Catmull-Rom → cubic Bézier
 * (same approach as MockupShell pencil paths / zoom-stable edge cubics).
 */

export function pointsToPolylinePath(points) {
  if (!points?.length) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${points[i].x} ${points[i].y}`;
  }
  return d;
}

/** Catmull-Rom spline through points, converted to cubic Bézier segments. */
export function pointsToSmoothPath(points) {
  if (!points?.length) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M${p.x} ${p.y}`;
  }
  if (points.length === 2) {
    return `M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  // Duplicate endpoints so tangents at the ends stay stable.
  const ring = [first, ...points, last];
  let d = `M${first.x} ${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = ring[i];
    const p1 = ring[i + 1];
    const p2 = ring[i + 2];
    const p3 = ring[i + 3];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x} ${c1y},${c2x} ${c2y},${p2.x} ${p2.y}`;
  }
  return d;
}

export function pointsToPath(points, { smooth = false } = {}) {
  return smooth ? pointsToSmoothPath(points) : pointsToPolylinePath(points);
}

export function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True if (x,y) is within tol of any vertex or segment of the stroke. */
export function pointHitsStroke(x, y, stroke, tol) {
  const pts = stroke?.points || [];
  if (!pts.length) return false;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (Math.hypot(p.x - x, p.y - y) <= tol) return true;
    if (i > 0) {
      const prev = pts[i - 1];
      if (distPointToSegment(x, y, prev.x, prev.y, p.x, p.y) <= tol) return true;
    }
  }
  return false;
}

/**
 * Area erase: drop points inside the brush, then split each stroke into
 * contiguous runs so removing midpoints does not leave a gappy polyline.
 */
export function eraseAreaFromStrokes(strokes, x, y, r, newId) {
  const out = [];
  for (const stroke of strokes) {
    const points = stroke.points || [];
    if (points.length < 2) continue;
    let run = [];
    let firstFragment = true;
    const pushRun = () => {
      if (run.length > 1) {
        out.push({
          ...stroke,
          id: firstFragment ? stroke.id : newId(),
          points: run,
        });
        firstFragment = false;
      }
      run = [];
    };
    for (const p of points) {
      if (Math.hypot(p.x - x, p.y - y) > r) run.push(p);
      else pushRun();
    }
    pushRun();
  }
  return out;
}
