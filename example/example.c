// Simple example to show LLVM to WASM conversion
// To compile: clang -emit-llvm example.c -c -o example.bc 

int fib(int n) {
  int i, a = 0, b = 1, t;
  for (i = 0; i < n; i++) {
    t = a + b; a = b; b = t;
  }
  return b;
}
