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
