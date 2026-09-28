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
