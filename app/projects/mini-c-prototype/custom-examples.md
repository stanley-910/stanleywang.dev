# Custom-code test examples

Paste these into the editor. Typed code compiles with the real compiler in the
browser (`real.ts`, `public/mini-c/compiler.js`); only if that fails to load does
it fall back to the in-browser sketch (`trace.ts`), which accepts one
`int main()` with `int` declarations, assignments, one final `return`, `+ - *`,
parentheses, at most 90 tokens and 32 tree nodes. These examples were written to
work in both.

Adapted from `tests/parser/arithmetic_1.c`, `arithmetic_2.c` and
`variable_initialization.c` in the compiler repo (`void main` → `int main` with a
return, since the sketch needs a value). Checked 2026-09-23: sketch value from its
allocated instructions; real value from `Main4 -gen colour` on a wrapper that prints
the result in MARS.

## Valid — all five phases

| Example | Exercises | Sketch | Real |
| --- | --- | --- | --- |
| 1 nested parens | grouping inside grouping, negative result | -9 | -9 |
| 2 register pressure | four values live at once | 17 | 17 |
| 3 reassign chain | values dying and registers reused | 10 | 10 |
| 4 left associativity | `a - b - c` must group left | -1 | -1 |
| 5 Horner polynomial | deep left spine, one variable reused | 73 | 73 |

```c
// 1 nested parens (arithmetic_2.c)
int main() {
  int result;
  result = ((1 + 2) * (3 + 4)) - (5 * 6);
  return result;
}
```

```c
// 2 register pressure (arithmetic_1.c)
int main() {
  int a;
  int b;
  int c;
  int d;
  a = 10;
  b = 5;
  c = 3;
  d = 8;
  return a + b * c - d;
}
```

```c
// 3 reassign chain (variable_initialization.c)
int main() {
  int x;
  int y;
  int z;
  x = 10;
  y = 20;
  z = x + y;
  x = z * 2 - y;
  return x - z;
}
```

```c
// 4 left associativity (arithmetic_2.c); right-grouping would give 5
int main() {
  int r;
  r = 10 - 5 + 3;
  return r - 2 - 3 - 4;
}
```

```c
// 5 Horner polynomial
int main() {
  int x;
  x = 3;
  return ((2 * x + 3) * x - 5) * x + 7;
}
```

## Errors both compilers agree on

| Source change | Sketch | Real |
| --- | --- | --- |
| `int x = 4;` | Parse: declarations take no initializer | parse: expected (SC) found (ASSIGN) |
| `return x + y;` with no `y` | Check: “y” has no declaration | sem: UNDEFINED_SYMBOL |
| `int x;` twice | Check: “x” is already declared | sem: variable already declared |
| `x = 4` with no `;` | Parse: Expected “;”, found “return” | parse: expected (SC) found (RETURN) |

## Sketch rejects, real compiler accepts

These are valid Mini-C. The sketch's error is a limit of the sketch, not of the language.

| Source | Sketch | Real (MARS) |
| --- | --- | --- |
| `int x; return x + 1;` | Check: read before it has a value | compiles, prints 1 (no definite-assignment check) |
| `return a / 4 * 2;` with `a = 20` | Tokens: “/” outside the subset | 10 |
| `a = -3; return a * a;` | Parse: expected a number, name, or group | 9 |
