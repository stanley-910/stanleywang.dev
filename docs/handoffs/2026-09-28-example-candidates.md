# New built-in examples: candidates from the compiler's tests

2026-09-28. Three Opus subagents went through all 131 `.c` files under `mini-c-compiler/tests` (the `2026-09-25_showcase-traces` worktree). They compiled each one with the page's in-browser compiler (`public/mini-c/compiler.js`) and trimmed the good ones that were too big or noisy. I re-measured every pick below with the same bundle. "Graph" is the largest interference graph, in nodes.

**What the tests are like.** Most of `tests/parser` and `tests/lexer` are fixtures: `void main()` with unused assignments, or deliberately broken input. So nearly every pick is a trimmed or adapted version of a test, not the file as it is. `tests/showcase/` holds exactly the six current examples. Nothing in the tests uses recursion.

**Comfort limits.** From the untrimmed fibonacci run, which was already crowded at 58 nodes, 85 instructions and a 45-node graph, keep examples to about 45 nodes, 70 instructions and 30 graph nodes. The editor takes at most 1,200 characters.

## Recommended programs (ranked)

| # | name | from | chars | nodes | instr | graph | shows |
|---|---|---|---|---|---|---|---|
| 1 | fibonacci | `fibonacci.c` | 249 | 36 | 55 | 30 | a real program with output; stdlib `print_i`/`print_s`, a string and its `(char*)` cast |
| 2 | linked list | `sortLinkedList.c` | 419 | 53 | 95 | 22 | a self-referencing struct, `mcmalloc` on the heap, `(*p).field`, `&` of a global, nested calls, a global in `.data` |
| 3 | break and continue | `renderProgramWhileBreakContinue.c` | 137 | 27 | 46 | 23 | `if`, `break`, `continue`; extra CFG edges |
| 4 | pointer | `renderProgramPointersAddressOfAndValueAt.c` | 84 | 20 | 29 | 13 | `&`, `*`, a write through a pointer; `x` forced into the stack frame |
| 5 | struct | `struct_pointer_dereference.c` + `struct_usage.c` | 182 | 31 | 35 | 19 | a struct, `.` fields, a field written through a pointer |
| 6 | tic-tac-toe marks | `tictactoe.c` (its `get_mark`) | 251 | 37 | 69 | 21 | a `char` function, char literals, if/else, `print_c` |
| 7 | shadowing | `renderProgramNestedBlocksWithVarDeclOrder.c` | 94 | 15 | 26 | 8 | block scope: two `x`s in two scopes and two stack slots |
| 8 | arrays | `renderProgramArrayAccessAndAssignment.c` | 138 | 28 | 48 | 27 | an array filled and read in a loop |

The linked list is over the node and instruction limits. It's the only one with the heap, though, and emit draws it well (screenshot `shot-linked-list2-emit.png` in the scratchpad). The full sort (993 chars even trimmed, 154 nodes, 247 instructions) and the full tic-tac-toe (698 nodes) can't be made to fit.

### 1 fibonacci (prints 0 1 1 2 3 5 8 13 21 34)

```c
void main() {
  int first;
  int second;
  int next;
  int i;
  first = 0;
  second = 1;
  i = 0;
  while (i < 10) {
    print_i(first);
    print_s((char*)" ");
    next = first + second;
    first = second;
    second = next;
    i = i + 1;
  }
}
```

### 2 linked list (prints 123)

```c
struct Node {
  int data;
  struct Node* next;
};

struct Node end;

struct Node* push(struct Node* head, int value) {
  struct Node* node;
  node = (struct Node*)mcmalloc(sizeof(struct Node));
  (*node).data = value;
  (*node).next = head;
  return node;
}

void main() {
  struct Node* list;
  list = push(push(push(&end, 3), 2), 1);
  while (list != &end) {
    print_i((*list).data);
    list = (*list).next;
  }
}
```

### 3 break and continue (prints 123467)

```c
void main() {
  int i;
  i = 0;
  while (i < 10) {
    i = i + 1;
    if (i == 5) continue;
    if (i == 8) break;
    print_i(i);
  }
}
```

### 4 pointer (prints 43)

```c
void main() {
  int x;
  int* p;
  x = 42;
  p = &x;
  *p = *p + 1;
  print_i(x);
}
```

### 5 struct (returns 40)

```c
struct Point {
    int x;
    int y;
};

int main() {
    struct Point p;
    struct Point* ptr;
    p.x = 10;
    p.y = 20;
    ptr = &p;
    (*ptr).y = 30;
    return p.x + p.y;
}
```

### 6 tic-tac-toe marks (prints XOXOX)

```c
char mark(int player) {
  if (player == 1)
    return 'X';
  else
    return 'O';
}

void main() {
  int player;
  int turn;
  player = 1;
  turn = 0;
  while (turn < 5) {
    print_c(mark(player));
    player = 3 - player;
    turn = turn + 1;
  }
}
```

### 7 shadowing (prints 21)

```c
void main() {
  int x;
  x = 1;
  {
    int x;
    x = 2;
    print_i(x);
  }
  print_i(x);
}
```

### 8 arrays (prints the squares)

```c
void main() {
  int squares[5];
  int i;
  i = 0;
  while (i < 5) {
    squares[i] = i * i;
    print_i(squares[i]);
    i = i + 1;
  }
}
```

## Error examples (one per phase that the current six don't stop in)

| phase | name | from | message |
|---|---|---|---|
| lexer | no ternary | `ternary_comparison.c` | `?` isn't a character Mini-C knows |
| parser | missing semicolon | `unterminated_stmt.c` | Expected `;` but found `return` (one error, no cascade) |
| parser (alternative) | no `for` loop | `lexer/test_delimiters.c` | Mini-C has no `for`: it reads `for (…)` as a call and fails at the `;` |
| types | string into an int | `type_error.c` | “x” is int, but the value is char[6]. |
| types (alternative) | `/ *` isn't a comment | `lexer/test_comments.c` | “* 2”: dereference requires pointer type. |

### no ternary

```c
int main() {
    int x;
    int y;
    x = 3;
    y = 5;
    return x > y ? x : y;
}
```

### missing semicolon

```c
int main() {
    int x;
    x = 5
    return x;
}
```

### no for loop

```c
int main() {
  int i;
  for (i = 0; i < 3; i = i + 1) {
  }
  return 0;
}
```

### string into an int

```c
int main() {
    int x;
    x = "hello";
    return x;
}
```

### / * isn't a comment

```c
int main() {
  int x;
  x = 6 / * 2;
  return x;
}
```

## Defects found along the way

Both crashes were reproduced with the bundle and in the page.

1. **`#  include` (a space or tab after `#`) makes the tracer throw** "token INCLUDE not at 1:1", although the compiler accepts it. On the page, a valid program then falls back to the TypeScript stand-in, which says `#` "is outside this sketch's arithmetic subset". `#include` and ` #include` work.
2. **`sizeof int` (no parentheses) makes the tracer throw `Error: null`** instead of reporting a parse error. The page falls back to the stand-in, which gives a plausible parse error, so the harm is small.
3. **Parse and lex errors are generic in the raw trace** ("Parsing failed (N errors)", spanning the whole file). The page already swaps in the compiler's log line (`real.ts`), so this only affects tools reading the trace directly.
4. **Undefined functions:** `NameAnalyzer.java` reports a called-but-undefined function twice, with two wordings (lines 138 and 153–154).
5. **Classes that are declared but never used** compile through registers (the class is dropped). Any use stops at the checks. Class nodes have no children in the trace, so fields and methods never appear in the tree.
6. `empty.c` and a lone global (no functions) end after the checks with no error and no emit.

## Sources

The trimmed programs are in the session scratchpad under `examples/variants/`, and the measurement harness is `examples/measure.mts` there. The subagents' full reports, including a table of every file measured, were returned in chat. What matters from them is kept here.
