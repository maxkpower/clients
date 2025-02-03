import { Jsonify } from "type-fest";

import { StateProvider } from "../../platform/state";
import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";
import { SemanticLogger } from "../log";

export abstract class UserStateSubjectDependencyProvider {
  abstract encryptor: LegacyEncryptorProvider;
  abstract state: StateProvider;
  abstract log: <Context extends object>(_context: Jsonify<Context>) => SemanticLogger;
}
