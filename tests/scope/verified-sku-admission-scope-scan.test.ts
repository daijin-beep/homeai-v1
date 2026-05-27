import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const repoRoot = process.cwd();
const lineFeedByte = 0x0a;
const carriageReturnByte = 0x0d;
const carriageReturn =
  String.fromCharCode(13);
const lineFeed =
  String.fromCharCode(10);
const escapedNewline =
  String.fromCharCode(92) + "n";
const byteOrderMark = [
  0xef, 0xbb, 0xbf,
];
const formatCategory = /^\p{Cf}$/u;
const lineSeparatorCategory =
  /^\p{Zl}$/u;
const paragraphSeparatorCategory =
  /^\p{Zp}$/u;
const forbiddenCodePoints = new Set([
  0x061c, 0x200b, 0x200c, 0x200d,
  0x200e, 0x200f, 0x2028, 0x2029,
  0x202a, 0x202b, 0x202c, 0x202d,
  0x202e, 0x2066, 0x2067, 0x2068,
  0x2069, 0xfeff,
]);

const batch20RawGuardFiles = [
  {
    path: "apps/web/app/api/dev/verified-skus/route.ts",
    expectedLfBytes: 25,
  },
  {
    path: "apps/web/app/dev/verified-sku-debug/page.tsx",
    expectedLfBytes: 187,
  },
  {
    path: "apps/web/package.json",
    expectedLfBytes: 27,
  },
  {
    path: "packages/contracts/src/soft-decor-gps.ts",
    expectedLfBytes: 404,
  },
  {
    path: "packages/soft-decor-gps/package.json",
    expectedLfBytes: 21,
  },
  {
    path: "packages/soft-decor-gps/src/index.ts",
    expectedLfBytes: 416,
  },
  {
    path: "pnpm-lock.yaml",
    expectedLfBytes: 2568,
  },
  {
    path: "tests/contracts/verified-sku-contracts.test.ts",
    expectedLfBytes: 123,
  },
  {
    path: "tests/frontend/verified-sku-debug.test.tsx",
    expectedLfBytes: 53,
  },
  {
    path: "tests/scope/v1-beta-events-scope-scan.test.ts",
    expectedLfBytes: 325,
  },
  {
    path: "tests/scope/verified-sku-admission-scope-scan.test.ts",
    expectedLfBytes: 324,
  },
  {
    path: "tests/soft-decor-gps/verified-sku-admission.test.ts",
    expectedLfBytes: 74,
  },
  {
    path: "tests/soft-decor-gps/verified-sku-route.test.ts",
    expectedLfBytes: 63,
  },
  {
    path: "vitest.config.ts",
    expectedLfBytes: 99,
  },
];

describe("Verified SKU admission scope scan", () => {
  it("keeps Batch 20 on local fixtures without live provider, network, commerce, or Space Truth writes", () => {
    const files = collectFiles([
      join(
        repoRoot,
        "packages",
        "contracts",
        "src",
        "soft-decor-gps.ts",
      ),
      join(
        repoRoot,
        "packages",
        "soft-decor-gps",
        "src",
      ),
      join(
        repoRoot,
        "apps",
        "web",
        "app",
        "api",
        "dev",
        "verified-skus",
      ),
      join(
        repoRoot,
        "apps",
        "web",
        "app",
        "dev",
        "verified-sku-debug",
      ),
    ]);
    const forbidden = [
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
      /render-snapshot/i,
      /render-human-review/i,
      new RegExp(["fet", "ch", "\\s*\\("].join(""), "i"),
      new RegExp(["ax", "ios"].join(""), "i"),
      new RegExp(["node", ":http", "|node", ":https", "|node-", "fetch", "|un", "dici", "|XML", "Http", "Request"].join(""), "i"),
      new RegExp(["https", "?:", "\\/\\/"].join(""), "i"),
      /OpenAI|Anthropic|Gemini|Replicate|Stability|DASHSCOPE/i,
      new RegExp(["API", "_KEY", "|SEC", "RET", "|TOK", "EN"].join(""), "i"),
      /stripe|checkout|payment/i,
      /pdf|dwg|dxf/i,
      /construction|contractor|load-bearing|structural/i,
      /persistCanonicalRevision|confirmFloorplanDraft|createInMemoryP1Repositories/i,
    ];

    const hits = files.flatMap(
      (file) => {
        const lines = readFileSync(
          file,
          "utf8",
        )
          .replaceAll(
            carriageReturn,
            "",
          )
          .split(lineFeed);
        return lines.flatMap(
          (line, index) =>
            forbidden
              .filter((pattern) =>
                pattern.test(line),
              )
              .map(
                (pattern) =>
                  `${file}:${index + 1}: ${pattern.toString()}`,
              ),
        );
      },
    );

    expect(hits).toEqual([]);
  });

  it.each(batch20RawGuardFiles)(
    "$path uses strict Batch 20 ASCII LF raw formatting",
    ({ path, expectedLfBytes }) => {
      const bytes = readFileSync(
        join(repoRoot, path),
      );
      const text =
        bytes.toString("utf8");
      const physicalLfCount = countByte(
        bytes,
        lineFeedByte,
      );
      const lines =
        text.split(lineFeed);

      expect(
        Array.from(
          bytes.subarray(0, 3),
        ),
      ).not.toEqual(byteOrderMark);
      expect(physicalLfCount).toBe(
        expectedLfBytes,
      );
      expect(
        countByte(
          bytes,
          carriageReturnByte,
        ),
      ).toBe(0);
      expect(
        bytes[bytes.length - 1],
      ).toBe(lineFeedByte);
      expect(lines.length).toBe(
        physicalLfCount + 1,
      );
      expect(text).not.toContain(
        escapedNewline,
      );
      expect(
        findHiddenCharacters(text),
      ).toEqual([]);
      expect(
        findNonAsciiBytes(bytes),
      ).toEqual([]);
    },
  );
});

function collectFiles(
  roots: string[],
): string[] {
  return roots
    .filter((root) => existsSync(root))
    .flatMap((root) => walk(root))
    .filter((file) =>
      /\.(ts|tsx|json)$/.test(file),
    );
}

function walk(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path).flatMap(
    (entry) => {
      const child = join(path, entry);
      if (
        child.includes("node_modules")
      ) {
        return [];
      }
      return walk(child);
    },
  );
}

function countByte(
  bytes: Buffer,
  expected: number,
): number {
  let count = 0;

  for (const byte of bytes) {
    if (byte === expected) {
      count += 1;
    }
  }

  return count;
}

function findNonAsciiBytes(
  bytes: Buffer,
): string[] {
  const nonAscii: string[] = [];

  for (const [
    index,
    byte,
  ] of bytes.entries()) {
    if (byte > 0x7f) {
      nonAscii.push(
        `0x${byte.toString(16).toUpperCase().padStart(2, "0")} at byte ${index}`,
      );
    }
  }

  return nonAscii;
}

function findHiddenCharacters(
  text: string,
): string[] {
  const hidden: string[] = [];
  let index = 0;

  for (const character of text) {
    const codePoint =
      character.codePointAt(0);

    if (codePoint === undefined) {
      index += 1;
      continue;
    }

    if (
      forbiddenCodePoints.has(
        codePoint,
      ) ||
      formatCategory.test(character) ||
      lineSeparatorCategory.test(
        character,
      ) ||
      paragraphSeparatorCategory.test(
        character,
      )
    ) {
      hidden.push(
        `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} at char ${index}`,
      );
    }

    index += character.length;
  }

  return hidden;
}
