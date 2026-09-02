/**
 * Headless smoke test for the Algebra CAS adapter.
 * Run: node scripts/cas-smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindEquation } from '../src/lib/cas/loadEquation.js';

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById() {
      return null;
    },
    createElement() {
      return {
        getContext() {
          return {
            font: '',
            measureText: () => ({ width: 8 }),
            fillText() {},
            clearRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
            setTransform() {},
          };
        },
        style: {},
      };
    },
    body: { appendChild() {}, removeChild() {} },
  };
}
if (typeof globalThis.devicePixelRatio === 'undefined') {
  globalThis.devicePixelRatio = 1;
}

const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/cas/equation.js');
const { equation, text2eq, printflat } = bindEquation(fs.readFileSync(sourcePath, 'utf8'));

const [ast, errors] = text2eq('x^2+2*x+1');
if (errors) {
  console.error('parse failed', errors);
  process.exit(1);
}
console.log('parsed', printflat(ast));

const eq = new equation();
eq.history = undefined;
eq.canvasid = '';
eq.equation = ast;
eq.sortanddraw = function sortHeadless() {
  this.changedgraph = true;
  for (let i = 0; i < 100; i++) {
    this.changedgraph = false;
    this.simplifygraph(this.equation);
    this.rem01(this.equation);
    this.ordergraph(this.equation);
    if (!this.changedgraph) break;
  }
};
eq.factorcompletesquare(eq.equation);
console.log('complete-square', printflat(eq.equation));

const mult = new equation();
mult.history = undefined;
mult.canvasid = '';
mult.sortanddraw = eq.sortanddraw;
const [frac] = text2eq('1/(1+i)');
mult.equation = frac;
mult.mult1conj(mult.equation);
console.log('multiply-by-one', printflat(mult.equation));

if (!printflat(eq.equation) || !printflat(mult.equation).includes('conj')) {
  console.error('expected rewrite results');
  process.exit(1);
}

console.log('cas-smoke ok');
