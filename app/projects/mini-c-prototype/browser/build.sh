#!/bin/sh
# Compile the real Mini-C compiler to JavaScript with TeaVM so the page can run
# it in the browser. Reads the compiler from its own repo (nothing is copied
# into this one) and writes public/mini-c/compiler.js. Commit that file after
# rebuilding: Vercel's build is only `next build` (no Java or TeaVM there), so
# the committed bundle is what the live page runs.
# Needs the TeaVM 0.12 jars in ~/.cache/teavm/lib.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
compiler="${MINI_C:-$HOME/Developer/mcgill/mini-c-compiler}"
lib="${TEAVM_LIB:-$HOME/.cache/teavm/lib}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Work on a temporary copy; the patches below are for TeaVM only.
cp -R "$compiler/src/java" "$work/src"
mkdir -p "$work/src/util"
cp "$compiler/src/test/util/ParseTrace.java" "$compiler/src/test/util/RegAllocTrace.java" \
  "$here/BrowserTrace.java" "$work/src/util/"
find "$work/src" -name '*.java' > "$work/sources"

# `case BaseType.INT` in a pattern switch compiles to an EnumDesc constant
# TeaVM can't translate; rewrite as guarded type patterns.
python3 "$here/desugar.py" $(cat "$work/sources")
# No Integer.sum, no java.nio.file.Path and no Method.invoke in TeaVM's class
# library, so ParseTrace calls ProgramCodeGen.generate directly. The register
# and label intern tables are opened up so BrowserTrace can clear them between
# compiles (the JVM gets a fresh process each time).
sed -i '' \
  -e 's/^    void generate(Program p)/    public void generate(Program p)/' \
  -e 's/generate\.invoke(new ProgramCodeGen(asm), program);/new ProgramCodeGen(asm).generate(program); if (false) throw new ReflectiveOperationException();/' \
  -e 's/Integer::sum/(__a, __b) -> __a + __b/g' \
  -e 's/Files\.readString(file\.toPath(), StandardCharsets\.UTF_8)/new String(new java.io.FileInputStream(file).readAllBytes(), StandardCharsets.UTF_8)/' \
  $(cat "$work/sources")
sed -i '' -E 's/private (static final HashMap<String, (Virtual|Label)> instances)/public \1/' \
  $(cat "$work/sources")

javac --release 21 -nowarn -cp "$lib/*" -d "$work/classes" @"$work/sources"

mkdir -p "$root/public/mini-c"
java -cp "$lib/*:$work/classes" org.teavm.cli.TeaVMRunner \
  -t js --js-module-type es2015 -O 2 ${MINIFY--m} \
  -d "$root/public/mini-c" -f compiler.js util.BrowserTrace
