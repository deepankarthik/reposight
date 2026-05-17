import type { LogLevel } from "./config.js";

const levelPriority: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createLogger(name: string, level: LogLevel = "info") {
  const minLevel = levelPriority[level] ?? 1;

  function log(lvl: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (levelPriority[lvl] < minLevel) return;
    const timestamp = new Date().toISOString();
    const payload = data ? ` ${JSON.stringify(data)}` : "";
    const line = `${timestamp} [${lvl.toUpperCase()}] ${name}: ${msg}${payload}`;
    if (lvl === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data)
  };
}
