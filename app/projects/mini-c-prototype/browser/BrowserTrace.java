package util;

import gen.asm.Label;
import gen.asm.Register;
import java.io.File;
import java.io.FileOutputStream;
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
    ParseTrace t = new ParseTrace();
    t.run(file);
    return t.toJson("program.c");
  }
}
