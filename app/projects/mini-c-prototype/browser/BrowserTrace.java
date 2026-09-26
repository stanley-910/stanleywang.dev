package util;

import gen.asm.Label;
import gen.asm.Register;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import org.teavm.jso.JSExport;

/**
 * Browser entry for the real compiler, compiled to JavaScript by TeaVM. The
 * compiler's Scanner only reads files, so the source goes through TeaVM's
 * in-memory file system first. Not part of the compiler repo; build.sh adds it.
 */
public final class BrowserTrace {
  public static void main(String[] args) {}

  @JSExport
  public static String trace(String source) throws Exception {
    // Fresh numbering each time, as in a new JVM: v0, label_0, ...
    Register.Virtual.instances.clear();
    Label.instances.clear();
    File file = new File("/program.c");
    try (FileOutputStream out = new FileOutputStream(file)) {
      out.write(source.getBytes(StandardCharsets.UTF_8));
    }
    // The lexer and parser print their errors ("Parsing error: expected (SC)
    // found (ASSIGN) at 2:9") instead of recording them, so keep what they
    // print and hand it back beside the trace.
    PrintStream saved = System.out;
    ByteArrayOutputStream log = new ByteArrayOutputStream();
    System.setOut(new PrintStream(log, true, StandardCharsets.UTF_8));
    ParseTrace t = new ParseTrace();
    try {
      t.run(file);
    } finally {
      System.setOut(saved);
    }
    return "{\"log\": " + quote(log.toString(StandardCharsets.UTF_8)) + ", \"trace\": "
        + t.toJson("program.c") + "}";
  }

  private static String quote(String s) {
    StringBuilder sb = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') sb.append('\\').append(c);
      else if (c == '\n') sb.append("\\n");
      else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
      else sb.append(c);
    }
    return sb.append('"').toString();
  }
}
