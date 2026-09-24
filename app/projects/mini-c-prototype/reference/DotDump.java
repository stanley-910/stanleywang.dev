import java.io.*;
import java.util.*;
import ast.*;
import lexer.*;
import parser.*;
public class DotDump {
  public static void main(String[] a) throws Exception {
    File f = new File(a[0]);
    Tokeniser t = new Tokeniser(new lexer.Scanner(f));
    Parser p = new Parser(t);
    Program prog = p.parse();
    try (PrintWriter w = new PrintWriter(new FileWriter(a[1]))) { new DotPrinter(w).print(prog); }
  }
}
