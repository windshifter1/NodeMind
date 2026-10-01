# Third-party licenses

NodeMind prefers **permissive** open-source licenses suitable for future monetisation
(MIT, Apache-2.0, BSD, ISC). Copyleft (GPL/AGPL/LGPL) is avoided unless a dual-license
permissive grant is taken.

## Runtime / feature libraries

| Package / code | License | Used for |
|----------------|---------|----------|
| React / React DOM | MIT | UI |
| lucide-react | ISC | Icons |
| KaTeX | MIT | Math rendering (existing) |
| pdfjs-dist (optional dynamic) | Apache-2.0 | PDF text preview / extract |
| mammoth (optional dynamic) | BSD-2-Clause | DOCX → text |
| html-to-image | MIT | Share/export live canvas snapshot |
| In-house unit tables (`src/lib/units.js`) | Project | Unit conversion |
| In-house CSV/MD/PDF helpers (`src/lib/media/conversions.js`) | Project | File converter |
| IndexedDB wrapper (`src/lib/mediaStore.js`) | Project | Blob storage |
| SVG charts / geometry board / background draw | Project | Custom UI (no chart/geometry engine dep) |

Install optional packages when enabling full PDF/DOCX paths:

```bash
npm install pdfjs-dist mammoth
```

Without them, those conversions show a clear fallback message; other features still work.
