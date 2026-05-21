import XLSX from "xlsx";

import { FIELD_ALIASES, HEADER_DETECTION_FIELDS } from "./constants";
import type { SourceRow, WorkbookInspection } from "./types";
import { normalizeToken, toTrimmedString } from "./utils";

function buildDetectionAliasList(): string[] {
  return HEADER_DETECTION_FIELDS.flatMap((field) => FIELD_ALIASES[field]);
}

function detectHeaderRow(matrix: unknown[][]): number {
  const detectionAliases = buildDetectionAliasList();

  let bestIndex = 0;
  let bestScore = -1;

  matrix.slice(0, 25).forEach((row, rowIndex) => {
    const normalizedCells = row
      .map((cell) => normalizeToken(cell))
      .filter(Boolean);

    const score = detectionAliases.reduce((total, alias) => {
      if (normalizedCells.includes(alias)) {
        return total + 2;
      }

      if (normalizedCells.some((cell) => cell.includes(alias))) {
        return total + 1;
      }

      return total;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
    }
  });

  return bestIndex;
}

function buildHeaderKeyMap(headerRow: unknown[]): string[] {
  const counts = new Map<string, number>();

  return headerRow.map((cell, index) => {
    const fallback = `column_${index + 1}`;
    const base = toTrimmedString(cell) || fallback;
    const duplicateIndex = (counts.get(base) ?? 0) + 1;
    counts.set(base, duplicateIndex);
    return duplicateIndex === 1 ? base : `${base}_${duplicateIndex}`;
  });
}

function rowHasContent(row: unknown[]): boolean {
  return row.filter((cell) => toTrimmedString(cell).length > 0).length > 1;
}

export function loadWorkbook(
  sourcePath: string,
  preferredSheetName?: string
): { inspection: WorkbookInspection; rows: SourceRow[] } {
  const workbook = XLSX.readFile(sourcePath, {
    cellDates: false,
    raw: false,
  });

  const selectedSheetName =
    preferredSheetName && workbook.SheetNames.includes(preferredSheetName)
      ? preferredSheetName
      : workbook.SheetNames[0];

  const selectedSheet = workbook.Sheets[selectedSheetName];
  if (!selectedSheet) {
    throw new Error(`Could not find worksheet "${selectedSheetName}".`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(selectedSheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: "",
  });

  const headerRowIndex = detectHeaderRow(matrix);
  const headerKeys = buildHeaderKeyMap(matrix[headerRowIndex] ?? []);

  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter(rowHasContent)
    .map((row, index) => {
      const cells: Record<string, string> = {};
      const normalizedCells: Record<string, string> = {};

      headerKeys.forEach((header, headerIndex) => {
        const value = toTrimmedString(row[headerIndex]);
        cells[header] = value;
        normalizedCells[normalizeToken(header)] = value;
      });

      return {
        sourceRowNumber: headerRowIndex + index + 2,
        cells,
        normalizedCells,
      };
    });

  return {
    inspection: {
      sourcePath,
      selectedSheetName,
      availableSheetNames: workbook.SheetNames,
      headerRowIndex,
      headers: headerKeys,
      rowCount: rows.length,
    },
    rows,
  };
}
