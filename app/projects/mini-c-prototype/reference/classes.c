class Base {
  int val;
  void speak() {
    print_s((char*)"base\n");
  }
}
class Child extends Base {
  void speak() {
    print_s((char*)"child\n");
  }
}
int main() {
  class Base b;
  class Base c;
  b = new class Base();
  c = (class Base) new class Child();
  b.speak();
  c.speak();
  return 0;
}
