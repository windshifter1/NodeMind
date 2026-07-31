export const NODE_WIDTH = 180; // default (empty title) width
export const TOP_BAR_HEIGHT = 44;
export const SOCKET_RADIUS = 8;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export function nodeWidthForTitle(title) {
  const t = title && title.length ? title : 'Untitled';
  return Math.max(180, Math.min(460, t.length * 7.5 + 96));
}

export function socketWorld(node, type) {
  const y = node.y + TOP_BAR_HEIGHT / 2;
  const w = nodeWidthForTitle(node.title);
  return type === 'output' ? { x: node.x + w, y } : { x: node.x, y };
}

export function bezierPath(x1, y1, x2, y2, reversed = false) {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
  if (reversed) {
    return `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}