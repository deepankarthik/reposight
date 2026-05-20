export class JsonParseError extends Error {
  constructor(message: string, public readonly input: string) {
    super(message);
    this.name = "JsonParseError";
  }
}

export function safeJsonParse<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function jsonParse<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new JsonParseError(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`, value);
  }
}
