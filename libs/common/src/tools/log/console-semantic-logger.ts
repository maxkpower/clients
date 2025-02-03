import { Jsonify } from "type-fest";

import { LogLevelType } from "../../platform/enums";

import { SemanticLoggerSettings } from "./semantic-logger-settings";
import { SemanticLogger } from "./semantic-logger.abstraction";

export class ConsoleSemanticLogger<Context> implements SemanticLogger {
  constructor(
    context: Jsonify<Context>,
    private settings: SemanticLoggerSettings,
  ) {
    this.context = context && typeof context === "object" ? context : {};
  }

  readonly context: object;

  debug<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Debug, message);
  }

  info<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Info, message);
  }

  warn<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Warning, message);
  }

  error<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Error, message);
  }

  panic<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Error, message);
    throw new Error(message);
  }

  private log<T>(content: Jsonify<T>, level: LogLevelType, message?: string) {
    if (this.settings.filter?.(level) ?? false) {
      return;
    }

    const log = {
      ...this.context,
      message,
      content: content ?? undefined,
      level,
    };

    if (typeof content == "string" && !message) {
      log.message = content;
      delete log.content;
    }

    switch (level) {
      case LogLevelType.Debug:
        // eslint-disable-next-line
        console.log(log);
        break;
      case LogLevelType.Info:
        // eslint-disable-next-line
        console.log(log);
        break;
      case LogLevelType.Warning:
        // eslint-disable-next-line
        console.warn(log);
        break;
      case LogLevelType.Error:
        // eslint-disable-next-line
        console.error(log);
        break;
      default:
        break;
    }
  }
}
