import { afterEach, describe, expect, it, vi } from "vitest";
import { log, setVerbose, verbose, warn } from "./logger";

afterEach(() => {
  setVerbose(false);
  vi.restoreAllMocks();
});

describe("setVerbose", () => {
  it("should enable verbose mode", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setVerbose(true);
    verbose("test");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("should disable verbose mode", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setVerbose(true);
    setVerbose(false);
    verbose("test");
    expect(spy).not.toHaveBeenCalled();
  });

  it("should toggle back and forth", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    setVerbose(true);
    verbose("first");
    expect(spy).toHaveBeenCalledTimes(1);

    setVerbose(false);
    verbose("second");
    expect(spy).toHaveBeenCalledTimes(1);

    setVerbose(true);
    verbose("third");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("verbose", () => {
  it("should suppress output when verbose mode is off", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    verbose("hidden message");
    expect(spy).not.toHaveBeenCalled();
  });

  it("should output to console.log when verbose mode is on", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setVerbose(true);
    verbose("visible message");
    expect(spy).toHaveBeenCalledWith("  visible message");
  });

  it("should prefix message with two spaces", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setVerbose(true);
    verbose("indented");
    expect(spy).toHaveBeenCalledWith("  indented");
  });
});

describe("log", () => {
  it("should output to console.log when verbose mode is off", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("always visible");
    expect(spy).toHaveBeenCalledWith("always visible");
  });

  it("should output to console.log when verbose mode is on", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setVerbose(true);
    log("still visible");
    expect(spy).toHaveBeenCalledWith("still visible");
  });

  it("should pass the message through without modification", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("exact message");
    expect(spy).toHaveBeenCalledWith("exact message");
  });
});

describe("warn", () => {
  it("should output to console.warn when verbose mode is off", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn("problem detected");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("should output to console.warn when verbose mode is on", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setVerbose(true);
    warn("problem detected");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("should prefix message with 'Warning:'", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn("something is wrong");
    expect(spy).toHaveBeenCalledWith("  Warning: something is wrong");
  });

  it("should preserve the original message text after the prefix", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn("Skipping 'foo': missing SKILL.md");
    expect(spy).toHaveBeenCalledWith("  Warning: Skipping 'foo': missing SKILL.md");
  });
});
