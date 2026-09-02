export function bindEquation(source) {
  const loader = new Function(
    `${source}\nreturn { equation, text2eq, printflat, printlatex, deepCopy };`
  );
  return loader();
}
