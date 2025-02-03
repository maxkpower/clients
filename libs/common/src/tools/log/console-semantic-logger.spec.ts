import { interceptConsole, restoreConsole } from "../../../spec";
import { LogLevelType } from "../../platform/enums";

import { ConsoleSemanticLogger } from "./console-semantic-logger";

describe("ConsoleLogService", () => {
  let consoleSpy: {
    log: jest.Mock<any, any>;
    warn: jest.Mock<any, any>;
    error: jest.Mock<any, any>;
  };

  beforeEach(() => {
    consoleSpy = interceptConsole();
  });

  afterAll(() => {
    restoreConsole();
  });

  it("filters messages below the set threshold", () => {
    const log = new ConsoleSemanticLogger({}, { filter: () => true });
    log.debug("debug");
    log.info("info");
    log.warn("warning");
    log.error("error");

    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  describe("debug", () => {
    it("writes structural log messages to console.log", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.debug("this is a debug message");

      expect(consoleSpy.log).toHaveBeenCalledWith({
        message: "this is a debug message",
        level: LogLevelType.Debug,
      });
    });

    it("writes structural content to console.log", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.debug({ example: "this is content" });

      expect(consoleSpy.log).toHaveBeenCalledWith({
        content: { example: "this is content" },
        level: LogLevelType.Debug,
      });
    });

    it("writes structural content to console.log with a message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.info({ example: "this is content" }, "this is a message");

      expect(consoleSpy.log).toHaveBeenCalledWith({
        content: { example: "this is content" },
        message: "this is a message",
        level: LogLevelType.Info,
      });
    });
  });

  describe("info", () => {
    it("writes structural log messages to console.log", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.info("this is an info message");

      expect(consoleSpy.log).toHaveBeenCalledWith({
        message: "this is an info message",
        level: LogLevelType.Info,
      });
    });

    it("writes structural content to console.log", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.info({ example: "this is content" });

      expect(consoleSpy.log).toHaveBeenCalledWith({
        content: { example: "this is content" },
        level: LogLevelType.Info,
      });
    });

    it("writes structural content to console.log with a message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.info({ example: "this is content" }, "this is a message");

      expect(consoleSpy.log).toHaveBeenCalledWith({
        content: { example: "this is content" },
        message: "this is a message",
        level: LogLevelType.Info,
      });
    });
  });

  describe("warn", () => {
    it("writes structural log messages to console.warn", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.warn("this is a warning message");

      expect(consoleSpy.warn).toHaveBeenCalledWith({
        message: "this is a warning message",
        level: LogLevelType.Warning,
      });
    });

    it("writes structural content to console.warn", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.warn({ example: "this is content" });

      expect(consoleSpy.warn).toHaveBeenCalledWith({
        content: { example: "this is content" },
        level: LogLevelType.Warning,
      });
    });

    it("writes structural content to console.warn with a message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.warn({ example: "this is content" }, "this is a message");

      expect(consoleSpy.warn).toHaveBeenCalledWith({
        content: { example: "this is content" },
        message: "this is a message",
        level: LogLevelType.Warning,
      });
    });
  });

  describe("error", () => {
    it("writes structural log messages to console.error", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.error("this is an error message");

      expect(consoleSpy.error).toHaveBeenCalledWith({
        message: "this is an error message",
        level: LogLevelType.Error,
      });
    });

    it("writes structural content to console.error", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.error({ example: "this is content" });

      expect(consoleSpy.error).toHaveBeenCalledWith({
        content: { example: "this is content" },
        level: LogLevelType.Error,
      });
    });

    it("writes structural content to console.error with a message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      log.error({ example: "this is content" }, "this is a message");

      expect(consoleSpy.error).toHaveBeenCalledWith({
        content: { example: "this is content" },
        message: "this is a message",
        level: LogLevelType.Error,
      });
    });
  });

  describe("panic", () => {
    it("writes structural log messages to console.error before throwing the message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      expect(() => log.panic("this is an error message")).toThrow("this is an error message");

      expect(consoleSpy.error).toHaveBeenCalledWith({
        message: "this is an error message",
        level: LogLevelType.Error,
      });
    });

    it("writes structural log messages to console.error with a message before throwing the message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      expect(() => log.panic({ example: "this is content" }, "this is an error message")).toThrow(
        "this is an error message",
      );

      expect(consoleSpy.error).toHaveBeenCalledWith({
        content: { example: "this is content" },
        message: "this is an error message",
        level: LogLevelType.Error,
      });
    });

    it("writes structural log messages to console.error with a content before throwing the message", () => {
      const log = new ConsoleSemanticLogger({}, { filter: () => false });

      expect(() => log.panic("this is content", "this is an error message")).toThrow(
        "this is an error message",
      );

      expect(consoleSpy.error).toHaveBeenCalledWith({
        content: "this is content",
        message: "this is an error message",
        level: LogLevelType.Error,
      });
    });
  });
});
