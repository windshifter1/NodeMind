import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/liquid-glass/cn';
import { GlassTopHighlight } from '@/lib/liquid-glass/GlassTopHighlight';

export function MobileSearchBar({
  placeholder = 'Search',
  value: controlledValue,
  onChange,
  onCancel,
  showCancelButton = false,
  className,
  autoFocus = false,
  inputRef: inputRefProp,
  'aria-label': ariaLabel,
}) {
  const [value, setValue] = useState(controlledValue || '');
  const [isFocused, setIsFocused] = useState(false);
  const localInputRef = useRef(null);
  const inputRef = inputRefProp || localInputRef;

  useEffect(() => {
    setValue(controlledValue || '');
  }, [controlledValue]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [autoFocus, inputRef]);

  const isActive = isFocused || (controlledValue ?? value).length > 0;
  const isControlled = controlledValue !== undefined;
  const displayValue = isControlled ? controlledValue : value;

  const handleClear = () => {
    if (isControlled) {
      onChange?.('');
    } else {
      setValue('');
    }
    inputRef.current?.focus();
  };

  return (
    <motion.div
      className={cn(
        'nm-lg-mobile-search relative flex items-center gap-2 px-3 py-2.5 rounded-full',
        'transition-[border-color,box-shadow] duration-200 overflow-hidden',
        'glass-blur glass-surface-strong glass-border',
        className,
      )}
    >
      <GlassTopHighlight className="inset-x-4 top-0 rounded-full" opacity={0.22} />

      <Search size={16} strokeWidth={1.75} className="relative z-10 text-[var(--lg-text-muted)] shrink-0" />

      <input
        ref={inputRef}
        type="search"
        value={displayValue}
        onChange={(e) => {
          if (isControlled) onChange?.(e.target.value);
          else setValue(e.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        enterKeyHint="search"
        className="relative z-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-muted)]"
      />

      <AnimatePresence>
        {displayValue.length > 0 ? (
          <motion.button
            type="button"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={handleClear}
            className="relative z-10 shrink-0 border-0 bg-transparent p-0 text-[var(--lg-text-muted)]"
            aria-label="Clear search"
          >
            <X size={16} strokeWidth={1.75} />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {showCancelButton || isActive ? (
        <button
          type="button"
          className="relative z-10 shrink-0 border-0 bg-transparent text-sm font-medium text-liquid-blue"
          onClick={() => {
            handleClear();
            onCancel?.();
          }}
        >
          Cancel
        </button>
      ) : null}
    </motion.div>
  );
}