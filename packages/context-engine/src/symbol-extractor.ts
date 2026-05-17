import ts from "typescript";
import type { CodeSymbol } from "@repolens/shared";

const MAX_SYMBOLS = 60;

const PYTHON_FUNC_RE = /^(\s*)def\s+(\w+)\s*\(/gm;
const PYTHON_CLASS_RE = /^(\s*)class\s+(\w+)\s*[:\(]/gm;
const PYTHON_IMPORT_RE = /^(?:from\s+(\S+)\s+)?import\s+(.+)/gm;

function extractPythonSymbols(source: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = source.split("\n");
  const classStack: Array<{ name: string; indent: number }> = [];

  let match: RegExpExecArray | null;

  while ((match = PYTHON_CLASS_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const indent = match[1]?.length ?? 0;
    const name = match[2];
    const lineNum = source.substring(0, match.index).split("\n").length;

    while (classStack.length > 0 && classStack[classStack.length - 1].indent >= indent) {
      classStack.pop();
    }

    symbols.push({ name, kind: "class", line: lineNum });
    classStack.push({ name, indent });
  }

  while ((match = PYTHON_FUNC_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const indent = match[1]?.length ?? 0;
    const name = match[2];
    const lineNum = source.substring(0, match.index).split("\n").length;

    const parentClass = [...classStack].reverse().find((c) => c.indent < indent);
    const kind = parentClass ? "method" : "function";

    symbols.push({ name, kind, line: lineNum });
  }

  return symbols.slice(0, MAX_SYMBOLS);
}

function extractPythonImports(source: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = PYTHON_IMPORT_RE.exec(source)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
    if (match[2]) {
      const parts = match[2].split(",").map((p) => p.trim());
      for (const part of parts) {
        const importName = part.split(" as ")[0]?.trim() ?? part;
        if (importName && !importName.includes("*") && !importName.includes("(")) {
          imports.push(importName);
        }
      }
    }
  }

  return [...new Set(imports)];
}

function getSymbolKind(node: ts.Node): CodeSymbol["kind"] | undefined {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "type";
  if (ts.isMethodDeclaration(node)) return "method";
  if (ts.isPropertyDeclaration(node)) return "method";
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (decl.initializer && (ts.isFunctionExpression(decl.initializer) || ts.isArrowFunction(decl.initializer))) {
        return "function";
      }
    }
  }
  return undefined;
}

function getNodeName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (ts.isClassDeclaration(node)) return node.name?.text;
  if (ts.isInterfaceDeclaration(node)) return node.name.text;
  if (ts.isTypeAliasDeclaration(node)) return node.name.text;
  if (ts.isEnumDeclaration(node)) return node.name.text;
  if (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) {
    if (ts.isIdentifier(node.name)) return node.name.text;
    if (ts.isStringLiteral(node.name)) return node.name.text;
  }
  if (ts.isVariableStatement(node)) {
    const names: string[] = [];
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) names.push(decl.name.text);
    }
    return names.join(", ");
  }
  return undefined;
}

function extractSymbolsFromNode(node: ts.Node, source: ts.SourceFile, symbols: CodeSymbol[]): void {
  if (symbols.length >= MAX_SYMBOLS) return;

  ts.forEachChild(node, (child) => {
    if (symbols.length >= MAX_SYMBOLS) return;

    const kind = getSymbolKind(child);
    const name = getNodeName(child);

    if (kind && name) {
      const { line } = source.getLineAndCharacterOfPosition(child.getStart(source));
      symbols.push({ name, kind, line: line + 1 });
    }

    if (ts.isClassDeclaration(child) || ts.isInterfaceDeclaration(child)) {
      extractSymbolsFromNode(child, source, symbols);
    }
  });
}

function extractImports(source: ts.SourceFile): string[] {
  const imports: string[] = [];

  ts.forEachChild(source, (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
  });

  return imports;
}

export function extractSymbols(source: string, language: string): CodeSymbol[] {
  if (language === "python") {
    return extractPythonSymbols(source);
  }

  if (!["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(language)) {
    return [];
  }

  const fileName = language.includes("react") ? "file.tsx" : "file.ts";
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  const symbols: CodeSymbol[] = [];

  extractSymbolsFromNode(sourceFile, sourceFile, symbols);
  return symbols;
}

export function extractImportsFromSource(source: string, language: string): string[] {
  if (language === "python") {
    return extractPythonImports(source);
  }

  if (!["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(language)) {
    return [];
  }

  const fileName = language.includes("react") ? "file.tsx" : "file.ts";
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  return extractImports(sourceFile);
}
