void main() {
  int x;
  int* p;
  x = 42;
  p = &x;
  *p = *p + 1;
  print_i(x);
}
