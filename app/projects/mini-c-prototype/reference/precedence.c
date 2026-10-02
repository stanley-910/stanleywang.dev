int main() {
  int a;
  int b;
  int c;
  print_i(a == b + c);  // a == (b + c)
  print_i(a || b && c); // a || (b && c)
  return 4 + 2 * 3;     // 4 + (2 * 3)
}
