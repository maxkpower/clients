import { Jsonify } from "type-fest";

import { LogLevelType } from "../../platform/enums";

import { SemanticLoggerSettings } from "./semantic-logger-settings";
import { SemanticLogger } from "./semantic-logger.abstraction";

/** Sends semantic logs to the console.
 *  @remarks the behavior of this logger is based on `LogService`; it
 *   replaces dynamic messages (`%s`) with a JSON-formatted semantic log.
 */
export class ConsoleSemanticLogger<Context extends object> implements SemanticLogger {
  /** Instantiates a console semantic logger
   *  @param context a static payload that is cloned when the logger
   *   logs a message. The `messages`, `level`, and `content` fields
   *   are reserved for use by loggers.
   */
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

  panic<T>(content: Jsonify<T>, message?: string): never {
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
