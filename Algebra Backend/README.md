# Algebra Backend (vendor source)

The rewrite engine used by NodeMind’s Math nodes originally comes from the
[mathsfromnothing.au Algebra Calculator](https://mathsfromnothing.au/wp-content/uploads/algebraprogramnew/index.html).

The calculator UI (HTML chrome, on-screen keyboard, handwriting/OCR, history pane)
has been removed. The live engine lives at [`src/lib/cas/equation.js`](../src/lib/cas/equation.js)
and is driven headlessly by [`src/lib/cas/engine.js`](../src/lib/cas/engine.js).

This folder keeps a copy of the original engine file for reference.
