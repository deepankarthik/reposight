import type { CodeSymbol } from "@reposight/shared";

export interface SymbolReference {
  fromSymbol: string;
  fromFile: string;
  toSymbol: string;
  toFile: string;
  kind: "import" | "usage";
}

export interface SymbolCrossReference {
  symbols: Map<string, { symbol: CodeSymbol; file: string; references: SymbolReference[]; referencedBy: SymbolReference[] }>;
  references: SymbolReference[];
}

export function buildSymbolCrossReference(
  files: { path: string; symbols: CodeSymbol[]; imports: string[]; content: string }[]
): SymbolCrossReference {
  const symbols = new Map<string, { symbol: CodeSymbol; file: string; references: SymbolReference[]; referencedBy: SymbolReference[] }>();
  const references: SymbolReference[] = [];

  const symbolLookup = new Map<string, Array<{ symbol: CodeSymbol; file: string }>>();

  for (const file of files) {
    for (const symbol of file.symbols) {
      const key = symbol.name.toLowerCase();
      const existing = symbolLookup.get(key) ?? [];
      existing.push({ symbol, file: file.path });
      symbolLookup.set(key, existing);

      const symbolKey = `${file.path}:${symbol.kind}:${symbol.name}`;
      symbols.set(symbolKey, { symbol, file: file.path, references: [], referencedBy: [] });
    }
  }

  for (const file of files) {
    for (const imp of file.imports) {
      const importedFile = files.find((f) => f.path === imp || f.path.endsWith(imp));
      if (!importedFile) continue;

      for (const symbol of importedFile.symbols) {
        const fromKey = `${file.path}:file:${file.path}`;
        const toKey = `${importedFile.path}:${symbol.kind}:${symbol.name}`;
        const ref: SymbolReference = {
          fromSymbol: file.path,
          fromFile: file.path,
          toSymbol: symbol.name,
          toFile: importedFile.path,
          kind: "import"
        };
        references.push(ref);

        const toEntry = symbols.get(toKey);
        if (toEntry) {
          toEntry.referencedBy.push(ref);
        }
      }
    }

    for (const symbol of file.symbols) {
      const symbolName = symbol.name.toLowerCase();
      const potentialRefs = symbolLookup.get(symbolName) ?? [];

      for (const target of potentialRefs) {
        if (target.file === file.path) continue;

        const ref: SymbolReference = {
          fromSymbol: symbol.name,
          fromFile: file.path,
          toSymbol: target.symbol.name,
          toFile: target.file,
          kind: "usage"
        };
        references.push(ref);

        const fromKey = `${file.path}:${symbol.kind}:${symbol.name}`;
        const toKey = `${target.file}:${target.symbol.kind}:${target.symbol.name}`;

        const fromEntry = symbols.get(fromKey);
        if (fromEntry) {
          fromEntry.references.push(ref);
        }

        const toEntry = symbols.get(toKey);
        if (toEntry) {
          toEntry.referencedBy.push(ref);
        }
      }
    }
  }

  return { symbols, references };
}

export function getTopReferencedSymbols(crossRef: SymbolCrossReference, limit = 10): Array<{ symbol: CodeSymbol; file: string; referenceCount: number }> {
  const result: Array<{ symbol: CodeSymbol; file: string; referenceCount: number }> = [];

  for (const [key, entry] of crossRef.symbols) {
    result.push({
      symbol: entry.symbol,
      file: entry.file,
      referenceCount: entry.referencedBy.length
    });
  }

  return result
    .sort((a, b) => b.referenceCount - a.referenceCount)
    .slice(0, limit);
}

export function getSymbolDependencies(crossRef: SymbolCrossReference, symbolName: string, file: string): { references: SymbolReference[]; referencedBy: SymbolReference[] } {
  for (const [key, entry] of crossRef.symbols) {
    if (entry.symbol.name === symbolName && entry.file === file) {
      return { references: entry.references, referencedBy: entry.referencedBy };
    }
  }

  return { references: [], referencedBy: [] };
}
