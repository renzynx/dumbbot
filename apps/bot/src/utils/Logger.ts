import type { LogLevel, LoggerOptions } from "@/types";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: "gray",
  info: "dodgerblue",
  success: "limegreen",
  warn: "gold",
  error: "crimson",
};

const LOG_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  success: "SUCCESS",
  warn: "WARN",
  error: "ERROR",
};

export class Logger {
  private readonly options: Required<LoggerOptions>;
  private readonly name: string;

  constructor(name: string, options: LoggerOptions = {}) {
    this.name = name;
    this.options = {
      level: options.level ?? "info",
      timestamps: options.timestamps ?? true,
      colors: options.colors ?? true,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.options.level];
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace("T", " ").slice(0, -1);
  }

  private colorize(text: string, color: string): string {
    if (!this.options.colors) return text;
    const ansi = Bun.color(color, "ansi") ?? "";
    return `${ansi}${text}${RESET}`;
  }

  private dim(text: string): string {
    if (!this.options.colors) return text;
    return `${DIM}${text}${RESET}`;
  }

  private bold(text: string): string {
    if (!this.options.colors) return text;
    return `${BOLD}${text}${RESET}`;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];
    const color = LOG_COLORS[level];

    if (this.options.timestamps) {
      parts.push(this.dim(`[${this.formatTimestamp()}]`));
    }

    const label = this.bold(this.colorize(`[${LOG_LABELS[level]}]`, color));
    parts.push(label);
    parts.push(this.dim(`[${this.name}]`));
    parts.push(message);

    return parts.join(" ");
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message), ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog("success")) {
      console.log(this.formatMessage("success", message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message), ...args);
    }
  }

  child(name: string): Logger {
    return new Logger(`${this.name}:${name}`, this.options);
  }

  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  static create(name: string, options?: LoggerOptions): Logger {
    return new Logger(name, options);
  }
}

// Default global logger instance
export const logger = new Logger("Bot");
