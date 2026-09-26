"""Rewrite `case BaseType.INT ->` labels in pattern switches as guarded type
patterns, in place, on a build copy of the compiler. javac compiles the
original to a ConstantBootstraps/EnumDesc constant that TeaVM can't translate.
Switches that lose exhaustiveness get a throwing default."""
import re
import sys

LABEL = re.compile(r'case\s+((?:BaseType\.[A-Z_]+\s*,\s*)*BaseType\.[A-Z_]+)\s*(->|:)')


def body_end(src, open_brace):
    depth = 0
    for i in range(open_brace, len(src)):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                return i
    raise ValueError('unbalanced braces')


def top_level_default(body):
    depth = 0
    for m in re.finditer(r'[{}]|\bdefault\b', body):
        t = m.group(0)
        if t == '{':
            depth += 1
        elif t == '}':
            depth -= 1
        elif depth == 0:
            return True
    return False


def rewrite(src):
    out, pos = [], 0
    for m in re.finditer(r'\bswitch\s*\(', src):
        if m.start() < pos:
            continue
        brace = src.index('{', m.end())
        end = body_end(src, brace)
        body = src[brace + 1:end]
        if not LABEL.search(body):
            continue

        def label(lm):
            names = [n.strip() for n in lm.group(1).split(',')]
            guard = ' || '.join(f'__bt == {n}' for n in names)
            return f'case BaseType __bt when {guard} {lm.group(2)}'

        new = LABEL.sub(label, body)
        if not top_level_default(new):
            arrow = '->' in LABEL.search(body).group(2)
            new = new.rstrip() + ('\n default -> throw new IllegalStateException();\n'
                                  if arrow else '\n default: throw new IllegalStateException();\n')
        out.append(src[pos:brace + 1] + new)
        pos = end
    out.append(src[pos:])
    return ''.join(out)


for path in sys.argv[1:]:
    with open(path) as f:
        src = f.read()
    new = rewrite(src)
    if new != src:
        with open(path, 'w') as f:
            f.write(new)
