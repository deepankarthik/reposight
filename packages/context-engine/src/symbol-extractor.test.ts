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

  it("should extract Go functions", () => {
    const source = `
func Hello() string {
    return "hello"
}

func Add(a, b int) int {
    return a + b
}
`;
    const symbols = extractSymbols(source, "go");
    expect(symbols).toHaveLength(2);
    expect(symbols.map((s) => s.name)).toContain("Hello");
    expect(symbols.map((s) => s.name)).toContain("Add");
  });

  it("should extract Go structs", () => {
    const source = `
type User struct {
    Name string
    Age int
}

type Config struct {
    Debug bool
}
`;
    const symbols = extractSymbols(source, "go");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("User");
    expect(names).toContain("Config");
    expect(symbols.filter((s) => s.kind === "class")).toHaveLength(2);
  });

  it("should extract Go interfaces", () => {
    const source = `
type Reader interface {
    Read(p []byte) (n int, err error)
}
`;
    const symbols = extractSymbols(source, "go");
    expect(symbols.some((s) => s.name === "Reader" && s.kind === "interface")).toBe(true);
  });

  it("should extract Go methods on structs", () => {
    const source = `
type User struct {
    Name string
}

func (u *User) GetName() string {
    return u.Name
}
`;
    const symbols = extractSymbols(source, "go");
    const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.name);
    expect(methodNames).toContain("GetName");
  });

  it("should extract Rust functions", () => {
    const source = `
pub fn hello() -> String {
    String::from("hello")
}

fn add(a: i32, b: i32) -> i32 {
    a + b
}
`;
    const symbols = extractSymbols(source, "rust");
    expect(symbols).toHaveLength(2);
    expect(symbols.map((s) => s.name)).toContain("hello");
    expect(symbols.map((s) => s.name)).toContain("add");
  });

  it("should extract Rust structs", () => {
    const source = `
pub struct User {
    name: String,
    age: u32,
}

struct Config {
    debug: bool,
}
`;
    const symbols = extractSymbols(source, "rust");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("User");
    expect(names).toContain("Config");
    expect(symbols.filter((s) => s.kind === "class")).toHaveLength(2);
  });

  it("should extract Rust enums", () => {
    const source = `
pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
`;
    const symbols = extractSymbols(source, "rust");
    expect(symbols.some((s) => s.name === "Result" && s.kind === "type")).toBe(true);
  });

  it("should extract Rust traits", () => {
    const source = `
pub trait Drawable {
    fn draw(&self);
}
`;
    const symbols = extractSymbols(source, "rust");
    expect(symbols.some((s) => s.name === "Drawable" && s.kind === "interface")).toBe(true);
  });

  it("should extract Rust methods in impl blocks", () => {
    const source = `
struct User {
    name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }

    fn get_name(&self) -> &str {
        &self.name
    }
}
`;
    const symbols = extractSymbols(source, "rust");
    const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.name);
    expect(methodNames).toContain("new");
    expect(methodNames).toContain("get_name");
  });

  it("should extract Java classes", () => {
    const source = `
public class User {
    private String name;
}

abstract class Animal {
    abstract void makeSound();
}
`;
    const symbols = extractSymbols(source, "java");
    const names = symbols.map((s) => s.name);
    expect(names).toContain("User");
    expect(names).toContain("Animal");
  });

  it("should extract Java interfaces", () => {
    const source = `
public interface Drawable {
    void draw();
}
`;
    const symbols = extractSymbols(source, "java");
    expect(symbols.some((s) => s.name === "Drawable" && s.kind === "interface")).toBe(true);
  });

  it("should extract Java methods", () => {
    const source = `
public class User {
    public String getName() {
        return name;
    }

    private void setName(String name) {
        this.name = name;
    }
}
`;
    const symbols = extractSymbols(source, "java");
    const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.name);
    expect(methodNames).toContain("getName");
    expect(methodNames).toContain("setName");
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

  it("should extract Go imports", () => {
    const source = `
import (
    "fmt"
    "os"
    "path/filepath"
)
`;
    const imports = extractImportsFromSource(source, "go");
    expect(imports).toContain("fmt");
    expect(imports).toContain("os");
    expect(imports).toContain("path/filepath");
  });

  it("should extract single Go import", () => {
    const source = `import "fmt"`;
    const imports = extractImportsFromSource(source, "go");
    expect(imports).toContain("fmt");
  });

  it("should extract Rust use statements", () => {
    const source = `
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
`;
    const imports = extractImportsFromSource(source, "rust");
    expect(imports).toContain("std::collections::HashMap");
    expect(imports).toContain("serde::{Serialize, Deserialize}");
  });

  it("should extract Rust mod statements", () => {
    const source = `
pub mod utils;
mod config;
`;
    const imports = extractImportsFromSource(source, "rust");
    expect(imports).toContain("utils");
    expect(imports).toContain("config");
  });

  it("should extract Java imports", () => {
    const source = `
import java.util.List;
import java.util.ArrayList;
import static java.lang.Math.PI;
`;
    const imports = extractImportsFromSource(source, "java");
    expect(imports).toContain("java.util.List");
    expect(imports).toContain("java.util.ArrayList");
    expect(imports).toContain("java.lang.Math.PI");
  });

  it("should exclude java.lang imports", () => {
    const source = `
import java.lang.String;
import java.util.List;
`;
    const imports = extractImportsFromSource(source, "java");
    expect(imports).not.toContain("java.lang.String");
    expect(imports).toContain("java.util.List");
  });
});
