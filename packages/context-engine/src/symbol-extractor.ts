import ts from "typescript";
import type { CodeSymbol } from "@reposight/shared";

const MAX_SYMBOLS = 60;

const PYTHON_FUNC_RE = /^(\s*)def\s+(\w+)\s*\(/gm;
const PYTHON_CLASS_RE = /^(\s*)class\s+(\w+)\s*[:(]/gm;
const PYTHON_IMPORT_RE = /^(?:from\s+(\S+)\s+)?import\s+(.+)/gm;

const GO_FUNC_RE = /^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(\w+)\s*\(/gm;
const GO_STRUCT_RE = /^type\s+(\w+)\s+struct\s*\{/gm;
const GO_INTERFACE_RE = /^type\s+(\w+)\s+interface\s*\{/gm;
const GO_IMPORT_RE = /^import\s+(?:\(\n([\s\S]*?)\n\)|"([^"]+)")/gm;

const RUST_FN_RE = /^\s*(?:pub\s+)?fn\s+(\w+)\s*(?:<[^>]*>\s*)?\(/gm;
const RUST_STRUCT_RE = /^(?:pub\s+)?struct\s+(\w+)\s*(?:<[^>]*>\s*)?\{/gm;
const RUST_ENUM_RE = /^(?:pub\s+)?enum\s+(\w+)\s*(?:<[^>]*>\s*)?\{/gm;
const RUST_TRAIT_RE = /^(?:pub\s+)?trait\s+(\w+)\s*(?:<[^>]*>\s*)?\{/gm;
const RUST_IMPL_RE = /^(?:pub\s+)?impl\s+(?:<[^>]*>\s+)?(\w+)(?:\s*<[^>]*>)?(?:\s+for\s+\w+)?\s*\{/gm;
const RUST_IMPORT_RE = /^(?:pub\s+)?use\s+([^;]+);/gm;
const RUST_MOD_RE = /^(?:pub\s+)?mod\s+(\w+);/gm;

const JAVA_CLASS_RE = /^(?:public\s+|abstract\s+|final\s+)*(?:class|interface|enum)\s+(\w+)/gm;
const JAVA_METHOD_RE = /^\s*(?:public|private|protected|static|final|abstract|synchronized\s+)*[\w<>[\] ,]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+(?:\s*,\s*\w+)*)?\s*\{/gm;
const JAVA_IMPORT_RE = /^import\s+(static\s+)?([\w.*]+);/gm;

function extractLeadingComment(source: string, lines: string[], symbolLine: number): string | undefined {
  if (symbolLine <= 1) return undefined;
  const commentLines: string[] = [];
  for (let i = symbolLine - 2; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) break;
    if (line.startsWith("//")) {
      commentLines.unshift(line.slice(2).trim());
    } else if (line.startsWith("*/")) {
      commentLines.unshift(line.slice(0, -2).replace(/^\*\s?/, "").trim());
      i--;
      while (i >= 0 && !lines[i].trim().startsWith("/*")) {
        const inner = lines[i].trim().replace(/^\*\s?/, "");
        if (inner) commentLines.unshift(inner);
        i--;
      }
      if (i >= 0) {
        const startLine = lines[i].trim();
        if (startLine.startsWith("/*")) {
          const inner = startLine.slice(2).replace(/^\*/, "").trim();
          if (inner) commentLines.unshift(inner);
        }
      }
      break;
    } else if (line.startsWith("/*")) {
      commentLines.unshift(line.slice(2).replace(/^\*\s?/, "").trim());
      break;
    } else if (line.startsWith("*") || line.startsWith("* ")) {
      commentLines.unshift(line.replace(/^\*\s?/, "").trim());
    } else if (line.startsWith('"""') || line.startsWith("'''")) {
      const quote = line.slice(0, 3);
      const content = line.replace(/^['"]{3}|['"]{3}$/g, "").trim();
      if (content) commentLines.unshift(content);
      break;
    } else {
      break;
    }
  }
  const comment = commentLines.filter(Boolean).join(" ").trim();
  return comment.length > 0 ? comment : undefined;
}

function extractPythonSymbols(source: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const classStack: Array<{ name: string; indent: number }> = [];
  const lines = source.split("\n");

  let match: RegExpExecArray | null;

  while ((match = PYTHON_CLASS_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const indent = match[1]?.length ?? 0;
    const name = match[2];
    const lineNum = getLineNumber(source, match.index);

    while (classStack.length > 0 && classStack[classStack.length - 1].indent >= indent) {
      classStack.pop();
    }

    symbols.push({ name, kind: "class", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    classStack.push({ name, indent });
  }

  while ((match = PYTHON_FUNC_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const indent = match[1]?.length ?? 0;
    const name = match[2];
    const lineNum = getLineNumber(source, match.index);

    const parentClass = [...classStack].reverse().find((c) => c.indent < indent);
    const kind = parentClass ? "method" : "function";

    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  return symbols.slice(0, MAX_SYMBOLS);
}

function countLeadingSpaces(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function getLineNumber(source: string, index: number): number {
  let lineNum = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") lineNum++;
  }
  return lineNum;
}

function getLineContent(source: string, lines: string[], index: number): string {
  let lineNum = 0;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") lineNum++;
  }
  if (lineNum < lines.length && lines[lineNum].trim() === "" && lineNum + 1 < lines.length) {
    lineNum++;
  }
  return lines[lineNum] || "";
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

function extractGoSymbols(source: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const structStack: Array<{ name: string; indent: number }> = [];
  const interfaceStack: Array<{ name: string; indent: number }> = [];
  const lines = source.split("\n");

  let match: RegExpExecArray | null;

  while ((match = GO_STRUCT_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);

    symbols.push({ name, kind: "class", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    structStack.push({ name, indent });
  }

  while ((match = GO_INTERFACE_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);

    symbols.push({ name, kind: "interface", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    interfaceStack.push({ name, indent });
  }

  while ((match = GO_FUNC_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);

    const isMethod = lineContent.includes("func (") && lineContent.includes(") ");
    const inStruct = structStack.some((s) => s.indent < indent);
    const inInterface = interfaceStack.some((s) => s.indent < indent);

    const kind = isMethod || inStruct || inInterface ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  return symbols.slice(0, MAX_SYMBOLS);
}

function extractGoImports(source: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = GO_IMPORT_RE.exec(source)) !== null) {
    if (match[1]) {
      const lines = match[1].split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//")) continue;
        const importPath = trimmed.replace(/"/g, "").split(" ")[0];
        if (importPath) imports.push(importPath);
      }
    }
    if (match[2]) {
      imports.push(match[2]);
    }
  }

  return [...new Set(imports)];
}

function extractRustSymbols(source: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const implBlocks: Array<{ name: string; indent: number; startPos: number }> = [];
  const lines = source.split("\n");

  let match: RegExpExecArray | null;

  while ((match = RUST_STRUCT_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    symbols.push({ name, kind: "class", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  while ((match = RUST_ENUM_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    symbols.push({ name, kind: "type", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  while ((match = RUST_TRAIT_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    symbols.push({ name, kind: "interface", line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  while ((match = RUST_IMPL_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);
    implBlocks.push({ name, indent, startPos: match.index });
  }

  while ((match = RUST_FN_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const fnIndex = match.index;
    const lineNum = getLineNumber(source, fnIndex);
    const lineContent = getLineContent(source, lines, fnIndex);
    const indent = countLeadingSpaces(lineContent);

    const parentImpl = [...implBlocks].reverse().find((impl) => impl.startPos < fnIndex && impl.indent < indent);
    const kind = parentImpl ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  return symbols.slice(0, MAX_SYMBOLS);
}

function extractRustImports(source: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = RUST_IMPORT_RE.exec(source)) !== null) {
    const importPath = match[1].trim();
    const parts = importPath.split("::");
    if (parts.length > 0) {
      imports.push(parts.join("::"));
    }
  }

  while ((match = RUST_MOD_RE.exec(source)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
}

function extractJavaSymbols(source: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const classStack: Array<{ name: string; indent: number }> = [];
  const lines = source.split("\n");

  let match: RegExpExecArray | null;

  while ((match = JAVA_CLASS_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);

    while (classStack.length > 0 && classStack[classStack.length - 1].indent >= indent) {
      classStack.pop();
    }

    const fullMatch = match[0];
    const kind = fullMatch.includes("interface") ? "interface" :
                 fullMatch.includes("enum") ? "type" : "class";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
    classStack.push({ name, indent });
  }

  while ((match = JAVA_METHOD_RE.exec(source)) !== null) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const name = match[1];
    const lineNum = getLineNumber(source, match.index);
    const lineContent = getLineContent(source, lines, match.index);
    const indent = countLeadingSpaces(lineContent);

    const inClass = classStack.some((c) => c.indent < indent);
    const kind = inClass ? "method" : "function";
    symbols.push({ name, kind, line: lineNum, comment: extractLeadingComment(source, lines, lineNum) });
  }

  return symbols.slice(0, MAX_SYMBOLS);
}

function extractJavaImports(source: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = JAVA_IMPORT_RE.exec(source)) !== null) {
    const isStatic = !!match[1];
    const importPath = match[2].trim();
    if (!isStatic && importPath.startsWith("java.lang.")) {
      continue;
    }
    imports.push(importPath);
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

function extractLeadingTsComment(sourceFile: ts.SourceFile, node: ts.Node): string | undefined {
  const fullText = sourceFile.getFullText();
  const comments = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!comments || comments.length === 0) return undefined;
  const parts: string[] = [];
  for (const comment of comments) {
    const text = fullText.slice(comment.pos, comment.end);
    if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      parts.push(text.replace(/^\/\/\s?/, "").trim());
    } else if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
      const cleaned = text.replace(/^\/\*+|\*+\/$/g, "").split("\n").map(l => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean).join(" ");
      parts.push(cleaned);
    }
  }
  const comment = parts.join(" ").trim();
  return comment.length > 0 ? comment : undefined;
}

function extractSymbolsFromNode(node: ts.Node, source: ts.SourceFile, symbols: CodeSymbol[]): void {
  if (symbols.length >= MAX_SYMBOLS) return;

  ts.forEachChild(node, (child) => {
    if (symbols.length >= MAX_SYMBOLS) return;

    const kind = getSymbolKind(child);
    const name = getNodeName(child);

    if (kind && name) {
      const { line } = source.getLineAndCharacterOfPosition(child.getStart(source));
      symbols.push({ name, kind, line: line + 1, comment: extractLeadingTsComment(source, child) });
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
  if (language === "go") {
    return extractGoSymbols(source);
  }
  if (language === "rust") {
    return extractRustSymbols(source);
  }
  if (language === "java") {
    return extractJavaSymbols(source);
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
  if (language === "go") {
    return extractGoImports(source);
  }
  if (language === "rust") {
    return extractRustImports(source);
  }
  if (language === "java") {
    return extractJavaImports(source);
  }

  if (!["typescript", "typescriptreact", "javascript", "javascriptreact"].includes(language)) {
    return [];
  }

  const fileName = language.includes("react") ? "file.tsx" : "file.ts";
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  return extractImports(sourceFile);
}
