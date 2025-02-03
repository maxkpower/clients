import { Jsonify } from "type-fest";

export interface SemanticLogger {
  debug<T>(content: Jsonify<T>, message?: string): void;

  info<T>(content: Jsonify<T>, message?: string): void;

  warn<T>(content: Jsonify<T>, message?: string): void;

  error<T>(content: Jsonify<T>, message?: string): void;

  panic<T>(content: Jsonify<T>, message?: string): void;
}
