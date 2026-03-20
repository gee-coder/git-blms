import type { BlameLineInfo } from "./types";

interface PositionLike {
  line: number;
}

interface RangeLike {
  start: PositionLike;
  end: PositionLike;
}

export interface TextDocumentContentChangeLike {
  range: RangeLike;
  text: string;
}

export function hasStructuralLineChange(changes: readonly TextDocumentContentChangeLike[]): boolean {
  return changes.some((change) => change.range.start.line !== change.range.end.line || countLineBreaks(change.text) > 0);
}

export function hasStructuralLineDeletion(changes: readonly TextDocumentContentChangeLike[]): boolean {
  return changes.some((change) => change.range.end.line - change.range.start.line > countLineBreaks(change.text));
}

export function buildTransientBlameLines(
  existingLines: readonly BlameLineInfo[],
  changes: readonly TextDocumentContentChangeLike[],
  nowSeconds = Math.floor(Date.now() / 1000)
): BlameLineInfo[] {
  let working = existingLines.map((line) => ({ ...line }));

  for (const change of [...changes].reverse()) {
    const removedStartLine = change.range.start.line;
    const removedEndLine = change.range.end.line;
    const insertedLineBreaks = countLineBreaks(change.text);
    const removedLineBreaks = removedEndLine - removedStartLine;
    const lineDelta = insertedLineBreaks - removedLineBreaks;

    const nextLines: BlameLineInfo[] = [];
    for (const line of working) {
      if (line.lineNumber < removedStartLine) {
        nextLines.push(line);
        continue;
      }

      if (line.lineNumber === removedStartLine) {
        nextLines.push(line);
        continue;
      }

      if (line.lineNumber <= removedEndLine) {
        continue;
      }

      nextLines.push({
        ...line,
        lineNumber: line.lineNumber + lineDelta
      });
    }

    for (let offset = 1; offset <= insertedLineBreaks; offset += 1) {
      nextLines.push(createUncommittedLine(removedStartLine + offset, nowSeconds));
    }

    working = nextLines;
  }

  return working.sort((left, right) => left.lineNumber - right.lineNumber);
}

function createUncommittedLine(lineNumber: number, nowSeconds: number): BlameLineInfo {
  return {
    lineNumber,
    commitHash: "0000000000000000000000000000000000000000",
    shortCommitHash: "0000000",
    author: "",
    authorMail: "",
    authorTime: nowSeconds,
    summary: "",
    isUncommitted: true
  };
}

function countLineBreaks(value: string): number {
  const matches = value.match(/\r\n|\r|\n/g);
  return matches?.length ?? 0;
}
