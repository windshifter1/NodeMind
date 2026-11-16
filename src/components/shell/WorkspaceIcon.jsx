import React, { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { normalizeWorkspaceIconId } from '@/lib/workspaceIcons';

export default function WorkspaceIcon({
  icon,
  colour,
  color,
  size = 16,
  className,
  strokeWidth = 1.75,
  style,
  ...rest
}) {
  const name = normalizeWorkspaceIconId(icon);
  const tint = colour || color;
  const mergedStyle = tint ? { color: tint, ...style } : style;
  const [LucideDynamic, setLucideDynamic] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('lucide-react/dynamic')
      .then((mod) => {
        if (!cancelled) setLucideDynamic(() => mod.DynamicIcon);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const classNames = `shrink-0 ${className || ''}`.trim();

  if (!LucideDynamic) {
    return (
      <StickyNote
        size={size}
        strokeWidth={strokeWidth}
        className={classNames}
        style={mergedStyle}
        {...rest}
      />
    );
  }

  return (
    <LucideDynamic
      name={name}
      size={size}
      strokeWidth={strokeWidth}
      className={classNames}
      style={mergedStyle}
      fallback={() => (
        <StickyNote
          size={size}
          strokeWidth={strokeWidth}
          className={classNames}
          style={mergedStyle}
          {...rest}
        />
      )}
      {...rest}
    />
  );
}