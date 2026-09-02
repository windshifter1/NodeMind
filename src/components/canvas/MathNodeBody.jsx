import React, { useMemo } from 'react';
import {
  defForKind,
  fieldVisibleForNode,
  isEquationOpNode,
  isNumberNode,
  isSelectionOpNode,
  NODE_KIND,
} from '@/lib/nodeTypes';
import {
  OPERATION_IGNORED_ERROR,
  OPERATION_IGNORED_MESSAGE,
  selectionOpKey,
} from '@/lib/cas/selectionOps';
import MathPreview from './MathPreview';

const FIELD_METHODS = new Set([
  'collect',
  'polynomialdivision',
  'partialfractions',
  'intsplitlimits',
]);

function inputClass(darkNodes, color) {
  return {
    className: `w-full rounded-md border px-2 py-1.5 text-sm outline-none ${
      darkNodes
        ? 'border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-500'
        : 'border-slate-200 bg-white/80 text-slate-800 placeholder:text-slate-400'
    }`,
    style: { borderColor: `${color}55` },
  };
}

function methodNeedsField(method) {
  return FIELD_METHODS.has(method);
}

export default function MathNodeBody({
  node,
  darkNodes,
  result,
  onUpdate,
  applicableModes = null,
  applicableSelectionOps = null,
  onPreviewMetrics,
  onSelectionMenu,
  ghostSelection = null,
  onSelectNode,
}) {
  const def = defForKind(node.kind);
  const fieldLooks = inputClass(darkNodes, node.color);
  const hasInput = result?.inputAst != null && result?.inputAst !== '';
  const isIgnored =
    Boolean(result?.ignored) || result?.error === OPERATION_IGNORED_ERROR;
  const emptyHint =
    isIgnored ||
    (!result?.flat &&
      (result?.error === 'Empty number' ||
        result?.error === 'Empty expression' ||
        result?.error === 'Connect a Math node' ||
        result?.error === 'Select an operation' ||
        result?.error === 'Select an equation operation' ||
        result?.error === 'No operation selected' ||
        !result));
  const isError = Boolean(result?.error) && !emptyHint && !isIgnored;
  const showField = fieldVisibleForNode(def, node);

  const modes = (() => {
    if (!def?.modes?.length) return [];
    if (!applicableModes?.length) return def.modes;
    const allowed = new Set(applicableModes);
    const filtered = def.modes.filter((mode) => allowed.has(mode.id));
    return filtered.length ? filtered : def.modes;
  })();

  const selectionOps = useMemo(() => {
    if (!isSelectionOpNode(node)) return [];
    return applicableSelectionOps || [];
  }, [node, applicableSelectionOps]);

  const currentOpKey = useMemo(() => {
    if (!node.method) return '';
    if (node.opId) return node.opId;
    const match = selectionOps.find(
      (op) =>
        op.method === node.method &&
        (op.extra?.arg ?? op.selection?.arg) === (node.selection?.arg) &&
        (op.extra?.callStyle ?? op.selection?.callStyle) === (node.selection?.callStyle)
    );
    return match ? match.id || selectionOpKey(match) : selectionOpKey(node);
  }, [node, selectionOps]);

  const showSelectionField =
    isSelectionOpNode(node) &&
    (methodNeedsField(node.method) || (isEquationOpNode(node) && hasInput && !selectionOps.length));

  const ignoredSelectValue = '__ignored__';
  const selectValue = isIgnored && node.method ? ignoredSelectValue : currentOpKey;

  const pickSelectionOp = (opId) => {
    if (!opId || opId === ignoredSelectValue) {
      if (opId === ignoredSelectValue) return;
      onUpdate({ method: '', selection: null, opId: '', field: isEquationOpNode(node) ? node.field : '' });
      return;
    }
    const op = selectionOps.find((item) => (item.id || selectionOpKey(item)) === opId);
    if (!op) return;
    const extra = { ...(op.extra || {}) };
    delete extra.needsField;
    delete extra.fieldPlaceholder;
    const nextField = methodNeedsField(op.method)
      ? node.field || ''
      : isEquationOpNode(node)
        ? String(extra.arg ?? node.field ?? '')
        : '';
    onUpdate({
      method: op.method,
      opId: op.id || selectionOpKey(op),
      selection: {
        ...(op.selection || { path: [], issel: null }),
        ...extra,
      },
      field: nextField,
    });
  };

  return (
    <div className="px-3 pt-2 pb-3" onPointerDown={(e) => e.stopPropagation()}>
      {isNumberNode(node) && (
        <input
          type="number"
          step="any"
          value={node.value ?? ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="0"
          {...fieldLooks}
        />
      )}

      {node.kind === NODE_KIND.EXPRESSION && (
        <textarea
          value={node.expr ?? ''}
          onChange={(e) => onUpdate({ expr: e.target.value })}
          placeholder={def?.field?.placeholder || 'x^2+1'}
          rows={2}
          className={`${fieldLooks.className} resize-none leading-relaxed`}
          style={fieldLooks.style}
        />
      )}

      {isSelectionOpNode(node) && (
        <select
          value={selectValue}
          disabled={!hasInput}
          onFocus={() => onSelectNode?.(node.id)}
          onPointerDown={() => onSelectNode?.(node.id)}
          onChange={(e) => pickSelectionOp(e.target.value)}
          className={`${fieldLooks.className} ${!hasInput ? 'opacity-60 cursor-not-allowed' : ''}`}
          style={fieldLooks.style}
          title={hasInput ? 'Choose operation' : 'Connect an input to choose an operation'}
        >
          <option value="">
            {hasInput
              ? selectionOps.length
                ? 'Select operation…'
                : 'No applicable operations'
              : 'Connect input to select…'}
          </option>
          {isIgnored && node.method && (
            <option value={ignoredSelectValue}>Ignored</option>
          )}
          {selectionOps.map((op) => {
            const key = op.id || selectionOpKey(op);
            // Hide the broken/stale current entry while ignored — shown as "Ignored" above.
            if (isIgnored && (key === currentOpKey || op.method === node.method)) return null;
            return (
              <option key={key} value={key}>
                {op.label}
              </option>
            );
          })}
        </select>
      )}

      {modes.length > 0 && !isSelectionOpNode(node) && (
        <select
          value={modes.some((mode) => mode.id === node.mode) ? node.mode : modes[0].id}
          onChange={(e) => onUpdate({ mode: e.target.value })}
          className={`${fieldLooks.className} ${node.kind === NODE_KIND.EXPRESSION || isNumberNode(node) ? 'mt-2' : ''}`}
          style={fieldLooks.style}
        >
          {modes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      )}

      {showSelectionField && (
        <input
          type="text"
          value={node.field ?? ''}
          onChange={(e) => {
            const field = e.target.value;
            if (isEquationOpNode(node)) {
              onUpdate({
                field,
                method: 'solveui',
                opId: field ? `solveui:Solve equation for ${field}` : '',
                selection: {
                  path: [],
                  issel: null,
                  arg: field,
                  callStyle: 'solve',
                },
              });
              return;
            }
            onUpdate({ field });
          }}
          placeholder={
            isEquationOpNode(node)
              ? 'Variable'
              : node.method === 'intsplitlimits'
                ? '0'
                : 'x'
          }
          className={`${fieldLooks.className} mt-2`}
          style={fieldLooks.style}
        />
      )}

      {showField && def.field.key !== 'expr' && !isSelectionOpNode(node) && (
        <input
          type="text"
          value={node.field ?? ''}
          onChange={(e) => onUpdate({ field: e.target.value })}
          placeholder={def.field.placeholder || def.field.label}
          className={`${fieldLooks.className} mt-2`}
          style={fieldLooks.style}
        />
      )}

      {isIgnored && (
        <div
          className={`mt-2 rounded-md border px-2.5 py-2 text-left text-xs leading-relaxed ${
            darkNodes
              ? 'border-zinc-500/35 bg-zinc-500/10 text-zinc-300'
              : 'border-slate-300 bg-slate-100 text-slate-500'
          }`}
          role="status"
        >
          {OPERATION_IGNORED_MESSAGE}
        </div>
      )}

      <MathPreview
        nodeId={node.id}
        ast={result?.ast}
        flat={result?.flat}
        error={isError ? result.error : null}
        empty={emptyHint || (!result?.flat && !result?.latex && result?.ast == null)}
        onMetrics={onPreviewMetrics}
        onSelectionMenu={onSelectionMenu}
        ghostSelection={isIgnored ? null : ghostSelection}
      />
    </div>
  );
}
