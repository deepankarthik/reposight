import { describe, it, expect } from "vitest";
import { extractSymbols, extractImportsFromSource } from "./symbol-extractor.js";

describe("extractSymbols", () => {
  it("should extract TypeScript functions", () => {
    const source = `
export function foo() {}
function bar() {}
`;
    const symbols = extractSymbols(source, "typescript");
    expect(symbols).toHaveLength(2);
    expect(symbols.map((s) => s.name)).toContain("foo");
    expect(symbols.map((s) => s.name)).toContain("bar");
  });

  it("should extract TypeScript classes", () => {
    const source = `
class MyClass {
  method() {}
  prop: string;
}
`;
    const symbols = extractSymbols(source, "typescript");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("MyClass");
    expect(names).toContain("method");
  });

  it("should extract interfaces", () => {
    const source = `
interface MyInterface {
  name: string;
}
`;
    const symbols = extractSymbols(source, "typescript");
    expect(symbols.some((s) => s.name === "MyInterface" && s.kind === "interface")).toBe(true);
  });

  it("should extract types", () => {
    const source = `
type MyType = string | number;
`;
    const symbols = extractSymbols(source, "typescript");
    expect(symbols.some((s) => s.name === "MyType" && s.kind === "type")).toBe(true);
  });

  it("should extract arrow functions", () => {
    const source = `
const myFunc = () => {};
const another = function() {};
`;
    const symbols = extractSymbols(source, "typescript");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("myFunc");
    expect(names).toContain("another");
  });

  it("should limit symbols to MAX_SYMBOLS", () => {
    let source = "";
    for (let i = 0; i < 100; i++) {
      source += `function func${i}() {}\n`;
    }
    const symbols = extractSymbols(source, "typescript");
    expect(symbols.length).toBeLessThanOrEqual(60);
  });

  it("should return empty for non-TS/JS/Python languages", () => {
    expect(extractSymbols("def foo(): pass", "text")).toEqual([]);
  });

  it("should extract Python functions", () => {
    const source = `
def foo():
    pass

def bar(x, y):
    return x + y
`;
    const symbols = extractSymbols(source, "python");
    expect(symbols).toHaveLength(2);
    expect(symbols.map((s) => s.name)).toContain("foo");
    expect(symbols.map((s) => s.name)).toContain("bar");
    expect(symbols.every((s) => s.kind === "function")).toBe(true);
  });

  it("should extract Python classes", () => {
    const source = `
class MyClass:
    pass

class Another(Base):
    pass
`;
    const symbols = extractSymbols(source, "python");
    expect(symbols).toHaveLength(2);
    expect(symbols.map((s) => s.name)).toContain("MyClass");
    expect(symbols.map((s) => s.name)).toContain("Another");
  });

  it("should extract Python methods inside classes", () => {
    const source = `
class MyClass:
    def __init__(self):
        pass

    def do_something(self):
        return True
`;
    const symbols = extractSymbols(source, "python");
    const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.name);
    expect(methodNames).toContain("__init__");
    expect(methodNames).toContain("do_something");
  });

  it("should extract Python imports", () => {
    const source = `
import os
import sys
from pathlib import Path
from collections import defaultdict, OrderedDict
`;
    const symbols = extractSymbols(source, "python");
    const imports = extractImportsFromSource(source, "python");
    expect(imports).toContain("os");
    expect(imports).toContain("sys");
    expect(imports).toContain("pathlib");
    expect(imports).toContain("defaultdict");
    expect(imports).toContain("OrderedDict");
  });
});

describe("extractImportsFromSource", () => {
  it("should extract TypeScript imports", () => {
    const source = `
import { foo } from "./foo";
import bar from "./bar";
export { baz } from "./baz";
`;
    const imports = extractImportsFromSource(source, "typescript");
    expect(imports).toContain("./foo");
    expect(imports).toContain("./bar");
    expect(imports).toContain("./baz");
  });

  it("should return empty for non-TS/JS/Python languages", () => {
    expect(extractImportsFromSource("import os", "text")).toEqual([]);
  });
});
