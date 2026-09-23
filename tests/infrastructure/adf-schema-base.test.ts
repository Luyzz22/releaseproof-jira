import { URL as NativeURL } from "node:url";
import { Validator } from "jsonschema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectAdfDocument } from "../../src/infrastructure/jira/adf-to-text";
import adfSchema from "../../src/infrastructure/jira/adf-schema.json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Node 24.20's URL parser rejects path references against this opaque base.
// Reproduce that rule even when the suite runs on an older Node release.
function useStrictUrlParser(): void {
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      constructor(input: string | NativeURL, base?: string | NativeURL) {
        if (
          base === "thismessage::/" &&
          !NativeURL.canParse(String(input)) &&
          !String(input).startsWith("#")
        ) {
          throw new TypeError("Invalid URL");
        }
        super(input, base);
      }
    },
  );
}

const document = {
  type: "doc",
  version: 1,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Synthetic acceptance criterion" }],
    },
  ],
};

describe("ADF schema references on strict URL runtimes", () => {
  it("validates local references despite the upstream anonymous-base failure", () => {
    useStrictUrlParser();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(() => new Validator().validate(document, adfSchema)).toThrow(
      TypeError,
    );
    expect(inspectAdfDocument(document)).toEqual({ valid: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still rejects invalid ADF and validates the diagnostic probe", () => {
    useStrictUrlParser();
    expect(
      inspectAdfDocument({ ...document, content: [{ type: "unknown" }] }),
    ).toEqual({
      valid: false,
      reason: "schema_rejected",
      probe: "valid",
    });
  });
});
