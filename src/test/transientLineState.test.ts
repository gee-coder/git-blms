import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTransientBlameLines,
  hasStructuralLineChange,
  hasStructuralLineDeletion,
  type TextDocumentContentChangeLike
} from "../transientLineState";
import type { BlameLineInfo } from "../types";

function makeLine(lineNumber: number, author = "Jane"): BlameLineInfo {
  return {
    lineNumber,
    commitHash: `${lineNumber}`.padStart(40, "a"),
    shortCommitHash: `${lineNumber}`.padStart(7, "a"),
    author,
    authorMail: `<${author.toLowerCase()}@example.com>`,
    authorTime: 1710000000 + lineNumber,
    summary: `line ${lineNumber}`,
    isUncommitted: false
  };
}

test("detects structural line changes", () => {
  const structural: TextDocumentContentChangeLike = {
    range: {
      start: { line: 3 },
      end: { line: 3 }
    },
    text: "\n"
  };
  const nonStructural: TextDocumentContentChangeLike = {
    range: {
      start: { line: 3 },
      end: { line: 3 }
    },
    text: "x"
  };

  assert.equal(hasStructuralLineChange([structural]), true);
  assert.equal(hasStructuralLineChange([nonStructural]), false);
});

test("detects structural line deletions separately from insertions", () => {
  const deletion: TextDocumentContentChangeLike = {
    range: {
      start: { line: 4 },
      end: { line: 5 }
    },
    text: ""
  };
  const insertion: TextDocumentContentChangeLike = {
    range: {
      start: { line: 4 },
      end: { line: 4 }
    },
    text: "\n"
  };

  assert.equal(hasStructuralLineDeletion([deletion]), true);
  assert.equal(hasStructuralLineDeletion([insertion]), false);
});

test("inserting a new line creates a transient uncommitted line and shifts later lines", () => {
  const lines = [makeLine(0), makeLine(1), makeLine(2)];
  const result = buildTransientBlameLines(
    lines,
    [
      {
        range: {
          start: { line: 1 },
          end: { line: 1 }
        },
        text: "\n"
      }
    ],
    1710000100
  );

  assert.equal(result.length, 4);
  assert.equal(result[1].lineNumber, 1);
  assert.equal(result[2].lineNumber, 2);
  assert.equal(result[2].isUncommitted, true);
  assert.equal(result[3].lineNumber, 3);
});

test("deleting a newline removes the deleted line instead of leaving it attached to the previous line", () => {
  const lines = [makeLine(0), makeLine(1), makeLine(2)];
  const result = buildTransientBlameLines(lines, [
    {
      range: {
        start: { line: 0 },
        end: { line: 1 }
      },
      text: ""
    }
  ]);

  assert.deepEqual(
    result.map((line) => line.lineNumber),
    [0, 1]
  );
});
