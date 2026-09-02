# Graph slot inputs — design choices

This documents the Graph node behaviour added for multi-form equations, per-slot
plot mode, and parameter controls.

## Accepted equation forms

**In scope**

- Explicit assignments where one side is a single variable: `y = f(x)`, `d = g^2`,
  `x = y^2`, `f = a*t + b`
- Expressions in one or more variables: `sin(x)`, `a*x^2` (pick independent; others
  become parameters)
- Constants: `y = 5` (horizontal), `x = 3` (vertical)

**Out of scope (for now)**

- Fully implicit relations like `x^2 + y^2 = 1` that cannot be rearranged to a
  single explicit side. These show a clear error instead of a slow contour sample.

Default mode preference: **y in terms of x**, then any `y = …`, then `y = const`,
then `x = const`, then the first plottable mode.

## Per-slot UI

Under each A/B/C… socket or text field (collapsible, **expanded by default**):

1. **Graph** — dropdown of plottable modes (`dependent in terms of independent`,
   or `f in terms of t` for bare expressions).
2. **Parameters** — one row per free variable that is neither the independent nor
   the dependent. Empty field means **1**. Plain numbers show left/right scrub
   bars (`←|` / `|→`); non-numeric expressions hide the bars and are evaluated as
   closed forms (no free variables).

Domain fields under the slot list remain the numeric sample window for the
independent axis; the label follows the shared independent name when series agree
(e.g. `g ∈`).

## Data model

```js
node.graphSlotOpts = {
  A: {
    expanded: true,
    kind: 'function',       // function | hline | vline
    independent: 'x',
    dependent: 'y',
    params: { a: '2', b: '' } // '' → 1 at eval time
  }
}
```

Socket Y positions use cumulative slot heights so edges stay aligned when sections
expand or parameters appear.

## Equal-scale plotting

The plot still uses one world-units-per-pixel scale for both axes. Horizontal axis
= independent variable; vertical = dependent (or expression value).
