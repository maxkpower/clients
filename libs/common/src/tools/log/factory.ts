import { Jsonify } from "type-fest";

import { LogLevelType } from "../../platform/enums";

import { ConsoleSemanticLogger } from "./console-semantic-logger";
import { DisabledSemanticLogger } from "./disabled-semantic-logger";
import { SemanticLoggerSettings } from "./semantic-logger-settings";
import { SemanticLogger } from "./semantic-logger.abstraction";

export function disabledSemanticLoggerProvider<Context>(
  _context: Jsonify<Context>,
): SemanticLogger {
  return new DisabledSemanticLogger();
}

const DefaultSemanticLoggerSettings: SemanticLoggerSettings = Object.freeze({
  filter: (level: LogLevelType) => level > LogLevelType.Debug,
});

export function consoleSemanticLoggerProvider<Context>(
  context: Jsonify<Context>,
  settings?: SemanticLoggerSettings,
): SemanticLogger {
  return new ConsoleSemanticLogger(context, settings ?? DefaultSemanticLoggerSettings);
}
