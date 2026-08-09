// Type declaration for algebrite — no @types/algebrite package exists
declare module 'algebrite' {
  interface Algebrite {
    run(expr: string): string;
    eval(expr: string): string;
    simplify(expr: string): string;
  }
  const Algebrite: Algebrite;
  export = Algebrite;
}
