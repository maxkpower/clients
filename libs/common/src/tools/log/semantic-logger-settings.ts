import { LogLevelType } from "../../platform/enums";

export type SemanticLoggerSettings = {
  filter?: (level: LogLevelType) => boolean;
};
