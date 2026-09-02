import React, { useMemo } from 'react';
import {
  defForKind,
  fieldVisibleForNode,
  GRAPH_NODE_BASIC_BODY_HEIGHT,
  GRAPH_NODE_BODY_HEIGHT,
  isBasicOperationNode,
  isDefaultExprEqTitle,
  isExpressionNode,
  isGraphNode,
  isSelectionOpNode,
  isSolveNode,
  isSubstituteNode,
  titleForExprEqRole,
} from '@/lib/nodeTypes';
import {
  ALL_EQUATIONS_REQUIRED_ERROR,
  NOT_ENOUGH_INPUTS_ERROR,
  ONLY_ONE_EQUATION_ERROR,
  OPERATION_IGNORED_ERROR,
  operationIgnoredMessage,
  selectionOpDisplayLabel,
  selectionOpKey,
} from '@/lib/cas/selectionOps';
import { classifyExprEqText } from '@/lib/cas/engine';
import {
  SUB_SLOT_GAP,
  SUB_SLOT_PAD_TOP,
  SUB_SLOT_ROW_H,
  patchSubstituteSlotText,
} from '@/lib/substituteSlots';
import { patchGraphSlotText } from '@/lib/graphSlots';
import MathPreview from './MathPreview';
import GraphPlot from './GraphPlot';

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
  zoom = 1,
  bodySlots = [],
  basicView = false,
}) {
  const def = defForKind(node.kind);
  const fieldLooks = inputClass(darkNodes, node.color);
  const hasInput = result?.inputAst != null && result?.inputAst !== '';
  const isIgnored =
    Boolean(result?.ignored) ||
    result?.error === OPERATION_IGNORED_ERROR ||
    result?.error === NOT_ENOUGH_INPUTS_ERROR ||
    result?.error === ONLY_ONE_EQUATION_ERROR ||
    result?.error === ALL_EQUATIONS_REQUIRED_ERROR;
  const ignoredMessage = useMemo(() => {
    if (
      result?.error === NOT_ENOUGH_INPUTS_ERROR ||
      result?.error === ONLY_ONE_EQUATION_ERROR ||
      result?.error === ALL_EQUATIONS_REQUIRED_ERROR
    ) {
      return result.error;
    }
    if (isBasicOperationNode(node) || isSubstituteNode(node)) {
      return NOT_ENOUGH_INPUTS_ERROR;
    }
    return operationIgnoredMessage(selectionOpDisplayLabel(node));
  }, [node, result?.error]);
  const emptyHint =
    !result?.flat &&
    (result?.error === 'Empty expression' ||
      result?.error === 'Empty equation' ||
      result?.error === 'Empty number' ||
      result?.error === 'Connect a Math node' ||
      result?.error === 'Select an operation' ||
      result?.error === 'Select a variable' ||
      result?.error === 'Select an equation operation' ||
      result?.error === 'No operation selected' ||
      !result);
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
    if (!isSelectionOpNode(node) && !isSolveNode(node)) return [];
    return applicableSelectionOps || [];
  }, [node, applicableSelectionOps]);

  const currentOpKey = useMemo(() => {
    if (!node.method) return '';
    if (node.opId) return node.opId;
    const match = selectionOps.find(
      (op) =>
        op.method === node.method &&
        (op.extra?.arg ?? op.selection?.arg) === node.selection?.arg &&
        (op.extra?.callStyle ?? op.selection?.callStyle) === node.selection?.callStyle
    );
    return match ? match.id || selectionOpKey(match) : selectionOpKey(node);
  }, [node, selectionOps]);

  const solveVariable = String(node.selection?.arg ?? node.field ?? '').trim();
  const showSelectionField =
    isSelectionOpNode(node) && methodNeedsField(node.method);

  const ignoredSelectValue = '__ignored__';
  const selectValue = isIgnored && node.method ? ignoredSelectValue : currentOpKey;
  const solveSelectValue =
    isIgnored && solveVariable ? ignoredSelectValue : solveVariable;

  const pickSelectionOp = (opId) => {
    if (opId === ignoredSelectValue) return;
    if (!opId) {
      onUpdate({ method: '', selection: null, opId: '', field: '' });
      return;
    }
    const op = selectionOps.find((item) => (item.id || selectionOpKey(item)) === opId);
    if (!op) return;
    const extra = { ...(op.extra || {}) };
    delete extra.needsField;
    delete extra.fieldPlaceholder;
    const nextField = methodNeedsField(op.method) ? node.field || '' : '';
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

  const pickSolveVariable = (variable) => {
    if (variable === ignoredSelectValue) return;
    if (!variable) {
      onUpdate({ method: '', selection: null, opId: '', field: '' });
      return;
    }
    onUpdate({
      method: 'solveui',
      opId: `solveui:${variable}`,
      field: variable,
      selection: {
        path: [],
        issel: null,
        arg: variable,
        callStyle: 'solve',
      },
    });
  };

  if (isGraphNode(node)) {
    const plotH = basicView
      ? Math.max(160, GRAPH_NODE_BASIC_BODY_HEIGHT - 16)
      : Math.max(200, GRAPH_NODE_BODY_HEIGHT - 48);
    const softErrors = (result?.plot?.series || []).filter((s) => s.kind === 'error');
    return (
      <div
        className={`px-3 pb-3 ${basicView ? 'pt-2' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        style={!basicView ? { paddingTop: SUB_SLOT_PAD_TOP } : undefined}
      >
        {!basicView && (
          <div className="mb-2 flex flex-col" style={{ gap: SUB_SLOT_GAP }}>
            {bodySlots.map((slot) => (
              <div
                key={slot.id}
                className={`flex items-center gap-2 transition-opacity ${
                  slot.greyed ? 'opacity-45' : 'opacity-100'
                }`}
                style={{ minHeight: SUB_SLOT_ROW_H }}
              >
                <span
                  className={`w-4 shrink-0 text-center text-xs font-semibold ${
                    darkNodes ? 'text-zinc-300' : 'text-slate-600'
                  }`}
                  title={`Series ${slot.label}`}
                >
                  {slot.label}
                </span>
                {slot.connected ? (
                  <div
                    className={`min-w-0 flex-1 truncate rounded-md border border-dashed px-2 py-1.5 text-xs ${
                      darkNodes
                        ? 'border-white/15 text-zinc-400'
                        : 'border-slate-300 text-slate-500'
                    }`}
                    title="Socket connected — typed value is remembered until disconnect"
                  >
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    value={slot.text}
                    onChange={(e) => {
                      const patch = patchGraphSlotText(node, slot.id, e.target.value);
                      if (patch) onUpdate(patch);
                    }}
                    placeholder="y=f(x) or expression in x"
                    className={`${fieldLooks.className} min-w-0 flex-1`}
                    style={fieldLooks.style}
                  />
                )}
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2">
              <label
                className={`shrink-0 text-xs font-medium ${
                  darkNodes ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                x ∈
              </label>
              <input
                type="text"
                value={node.xMin ?? '-10'}
                onChange={(e) => onUpdate({ xMin: e.target.value })}
                className={`${fieldLooks.className} w-20`}
                style={fieldLooks.style}
                title="x minimum"
              />
              <span className={darkNodes ? 'text-zinc-500' : 'text-slate-400'}>…</span>
              <input
                type="text"
                value={node.xMax ?? '10'}
                onChange={(e) => onUpdate({ xMax: e.target.value })}
                className={`${fieldLooks.className} w-20`}
                style={fieldLooks.style}
                title="x maximum"
              />
            </div>
          </div>
        )}
        <GraphPlot plot={result?.plot} darkNodes={darkNodes} height={plotH} />
        {!basicView && softErrors.length > 0 && (
          <div
            className={`mt-2 rounded-md border px-2.5 py-2 text-left text-xs leading-relaxed ${
              darkNodes
                ? 'border-amber-400/35 bg-amber-400/10 text-amber-100/90'
                : 'border-amber-500/40 bg-amber-50 text-amber-900/90'
            }`}
            role="status"
          >
            {softErrors.map((s) => s.error).filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`px-3 pb-3 ${basicView || !isSubstituteNode(node) ? 'pt-2' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      style={
        !basicView && isSubstituteNode(node) ? { paddingTop: SUB_SLOT_PAD_TOP } : undefined
      }
    >
      {!basicView && (
        <>
          {isSubstituteNode(node) && (
            <div className="flex flex-col" style={{ gap: SUB_SLOT_GAP }}>
              {bodySlots.map((slot) => {
                const placeholder =
                  slot.label === 'A' ? 'Equation, e.g. x=2*y' : 'Substitute, e.g. y=3';
                return (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-2 transition-opacity ${
                      slot.greyed ? 'opacity-45' : 'opacity-100'
                    }`}
                    style={{ minHeight: SUB_SLOT_ROW_H }}
                  >
                    <span
                      className={`w-4 shrink-0 text-center text-xs font-semibold ${
                        darkNodes ? 'text-zinc-300' : 'text-slate-600'
                      }`}
                      title={slot.label === 'A' ? 'Base equation' : 'Substitution equation'}
                    >
                      {slot.label}
                    </span>
                    {slot.connected ? (
                      <div
                        className={`min-w-0 flex-1 truncate rounded-md border border-dashed px-2 py-1.5 text-xs ${
                          darkNodes
                            ? 'border-white/15 text-zinc-400'
                            : 'border-slate-300 text-slate-500'
                        }`}
                        title="Socket connected — typed value is remembered until disconnect"
                      >
                        Connected
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={slot.text}
                        onChange={(e) => {
                          const patch = patchSubstituteSlotText(node, slot.id, e.target.value);
                          if (patch) onUpdate(patch);
                        }}
                        placeholder={placeholder}
                        className={`${fieldLooks.className} min-w-0 flex-1`}
                        style={fieldLooks.style}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isExpressionNode(node) && (
            <textarea
              value={node.expr ?? ''}
              onChange={(e) => {
                const expr = e.target.value;
                const patch = { expr };
                if (isDefaultExprEqTitle(node.title)) {
                  patch.title = titleForExprEqRole(classifyExprEqText(expr).role);
                }
                onUpdate(patch);
              }}
              placeholder={def?.field?.placeholder || 'x^2+2*x+1 or x^2-1=0'}
              rows={2}
              className={`${fieldLooks.className} resize-none leading-relaxed`}
              style={fieldLooks.style}
            />
          )}

          {isSolveNode(node) && (
            <select
              value={solveSelectValue}
              disabled={!hasInput && result?.error !== 'Connect an equation'}
              onFocus={() => onSelectNode?.(node.id)}
              onPointerDown={() => onSelectNode?.(node.id)}
              onChange={(e) => pickSolveVariable(e.target.value)}
              className={`${fieldLooks.className} ${
                !hasInput && result?.error !== 'Select a variable'
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
              style={fieldLooks.style}
              title={hasInput ? 'Choose variable' : 'Connect an equation to choose a variable'}
            >
              <option value="">
                {hasInput
                  ? selectionOps.length || isIgnored
                    ? 'Select variable…'
                    : 'No variables found'
                  : 'Connect an equation…'}
              </option>
              {isIgnored && solveVariable && (
                <option value={ignoredSelectValue}>Ignored</option>
              )}
              {selectionOps.map((op) => {
                const key = String(op.extra?.arg ?? op.label ?? op.id);
                return (
                  <option key={key} value={key}>
                    {op.label || key}
                  </option>
                );
              })}
            </select>
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
                  ? selectionOps.length || isIgnored
                    ? 'Select operation…'
                    : 'No applicable operations'
                  : 'Connect input to select…'}
              </option>
              {isIgnored && node.method && (
                <option value={ignoredSelectValue}>Ignored</option>
              )}
              {selectionOps.map((op) => {
                const key = op.id || selectionOpKey(op);
                return (
                  <option key={key} value={key}>
                    {op.label}
                  </option>
                );
              })}
            </select>
          )}

          {modes.length > 0 && !isSelectionOpNode(node) && !isSolveNode(node) && (
            <select
              value={modes.some((mode) => mode.id === node.mode) ? node.mode : modes[0].id}
              onChange={(e) => onUpdate({ mode: e.target.value })}
              className={`${fieldLooks.className} ${isExpressionNode(node) ? 'mt-2' : ''}`}
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
              onChange={(e) => onUpdate({ field: e.target.value })}
              placeholder={node.method === 'intsplitlimits' ? '0' : 'x'}
              className={`${fieldLooks.className} mt-2`}
              style={fieldLooks.style}
            />
          )}

          {showField &&
            def.field.key !== 'expr' &&
            !isSelectionOpNode(node) &&
            !isSolveNode(node) && (
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
                  ? 'border-amber-400/35 bg-amber-400/10 text-amber-100/90'
                  : 'border-amber-500/40 bg-amber-50 text-amber-900/90'
              }`}
              role="status"
            >
              {ignoredMessage}
            </div>
          )}
        </>
      )}

      <MathPreview
        nodeId={node.id}
        ast={result?.ast}
        flat={result?.flat}
        error={isError ? result.error : null}
        empty={emptyHint || (!result?.flat && !result?.latex && result?.ast == null)}
        zoom={zoom}
        onMetrics={onPreviewMetrics}
        onSelectionMenu={onSelectionMenu}
        ghostSelection={isIgnored ? null : ghostSelection}
      />
    </div>
  );
}
