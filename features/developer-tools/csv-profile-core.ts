export type CsvColumnProfile = {
	name: string;
	type: "empty" | "boolean" | "integer" | "number" | "date" | "text" | "mixed";
	nonEmpty: number;
	empty: number;
	uniqueValues: number;
	uniqueIsLowerBound: boolean;
	minimum: number | null;
	maximum: number | null;
	average: number | null;
	inconsistent: boolean;
	inconsistencyNotes: string[];
	sampleValues: string[];
};

export type CsvProfileReport = {
	fileName: string;
	fileSize: number;
	delimiter: string;
	rowCount: number;
	columnCount: number;
	duplicateRows: number;
	rowsWithMissingFields: number;
	rowsWithExtraFields: number;
	parseErrors: string[];
	columns: CsvColumnProfile[];
	preview: string[][];
};

type ColumnAccumulator = {
	nonEmpty: number;
	unique: Set<string>;
	uniqueIsLowerBound: boolean;
	types: Set<string>;
	minimum: number | null;
	maximum: number | null;
	numericSum: number;
	numericCount: number;
	samples: string[];
	normalizedSamples: Map<string, string>;
	variants: Set<string>;
};

const UNIQUE_LIMIT = 20_000;
const VARIANT_SCAN_LIMIT = 10_000;
const PREVIEW_LIMIT = 100;

export const inferCsvValueType = (value: string): "empty" | "boolean" | "integer" | "number" | "date" | "text" => {
	const trimmed = value.trim();
	if (!trimmed) return "empty";
	if (/^(?:true|false)$/iu.test(trimmed)) return "boolean";
	if (/^[+-]?(?:0|[1-9]\d*)$/u.test(trimmed)) return "integer";
	if (/^[+-]?0\d+$/u.test(trimmed)) return "text";
	if (/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[+-]?\d+)?$/iu.test(trimmed) && Number.isFinite(Number(trimmed))) return "number";
	if (/^\d{4}-\d{2}-\d{2}(?:[tT ][0-9:.+-]+(?:[zZ]|[+-]\d{2}:?\d{2})?)?$/u.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) return "date";
	return "text";
};

const createColumnAccumulator = (): ColumnAccumulator => ({
	nonEmpty: 0,
	unique: new Set(),
	uniqueIsLowerBound: false,
	types: new Set(),
	minimum: null,
	maximum: null,
	numericSum: 0,
	numericCount: 0,
	samples: [],
	normalizedSamples: new Map(),
	variants: new Set(),
});

export const createCsvProfiler = (file: File) => {
	let headers: string[] = [];
	let columns: ColumnAccumulator[] = [];
	let rowCount = 0;
	let duplicateRows = 0;
	let rowsWithMissingFields = 0;
	let rowsWithExtraFields = 0;
	const seenRows = new Set<string>();
	const parseErrors: string[] = [];
	const preview: string[][] = [];

	return {
		setHeader(rawHeaders: string[]) {
			const seenNames = new Map<string, number>();
			headers = rawHeaders.map((raw, index) => {
				const trimmed = raw.replace(/^\uFEFF/u, "").trim();
				const base = trimmed || `Column ${index + 1}`;
				const count = (seenNames.get(base.toLocaleLowerCase()) ?? 0) + 1;
				seenNames.set(base.toLocaleLowerCase(), count);
				return count > 1 ? `${base} (${count})` : base;
			});
			columns = headers.map(() => createColumnAccumulator());
		},
		addRow(rawRow: string[]) {
			if (!headers.length) return;
			const row = rawRow.map((value) => String(value ?? ""));
			rowCount++;
			if (row.length < headers.length) rowsWithMissingFields++;
			if (row.length > headers.length) rowsWithExtraFields++;
			if (preview.length < PREVIEW_LIMIT) preview.push(row.slice(0, headers.length));
			const signature = JSON.stringify(row);
			if (seenRows.has(signature)) duplicateRows++;
			else seenRows.add(signature);
			for (let index = 0; index < headers.length; index++) {
				const value = row[index] ?? "";
				const trimmed = value.trim();
				if (!trimmed) continue;
				const column = columns[index];
				column.nonEmpty++;
				column.types.add(inferCsvValueType(trimmed));
				if (column.samples.length < 5 && !column.samples.includes(value)) column.samples.push(value);
				if (!column.unique.has(value)) {
					if (column.unique.size < UNIQUE_LIMIT) column.unique.add(value);
					else column.uniqueIsLowerBound = true;
				}
				const numeric = Number(trimmed);
				if (trimmed && Number.isFinite(numeric) && inferCsvValueType(trimmed) !== "text" && inferCsvValueType(trimmed) !== "date" && inferCsvValueType(trimmed) !== "boolean") {
					column.minimum = column.minimum === null ? numeric : Math.min(column.minimum, numeric);
					column.maximum = column.maximum === null ? numeric : Math.max(column.maximum, numeric);
					column.numericSum += numeric;
					column.numericCount++;
				}
				if (column.normalizedSamples.size < VARIANT_SCAN_LIMIT) {
					const normalized = trimmed.toLocaleLowerCase();
					const previous = column.normalizedSamples.get(normalized);
					if (previous !== undefined && previous !== value && column.variants.size < 8) {
						column.variants.add(previous);
						column.variants.add(value);
					} else if (previous === undefined) column.normalizedSamples.set(normalized, value);
				}
			}
		},
		addParseErrors(messages: string[]) {
			for (const message of messages) if (parseErrors.length < 20) parseErrors.push(message);
		},
		finish(delimiter: string): CsvProfileReport {
			const profiles = headers.map((name, index): CsvColumnProfile => {
				const column = columns[index];
				const types = [...column.types];
				const allNumeric = types.length > 0 && types.every((type) => type === "integer" || type === "number");
				const type = types.length === 0 ? "empty" : allNumeric ? (types.includes("number") ? "number" : "integer") : types.length === 1 ? types[0] as CsvColumnProfile["type"] : "mixed";
				const notes: string[] = [];
				if (types.length > 1 && !allNumeric) notes.push(`Values have mixed detected types: ${types.join(", ")}.`);
				if (column.variants.size) notes.push(`Possible case or whitespace variants: ${[...column.variants].map((value) => `“${value}”`).join(", ")}.`);
				return {
					name,
					type,
					nonEmpty: column.nonEmpty,
					empty: rowCount - column.nonEmpty,
					uniqueValues: column.unique.size,
					uniqueIsLowerBound: column.uniqueIsLowerBound,
					minimum: column.minimum,
					maximum: column.maximum,
					average: column.numericCount ? column.numericSum / column.numericCount : null,
					inconsistent: notes.length > 0,
					inconsistencyNotes: notes,
					sampleValues: column.samples,
				};
			});
			return {
				fileName: file.name,
				fileSize: file.size,
				delimiter,
				rowCount,
				columnCount: headers.length,
				duplicateRows,
				rowsWithMissingFields,
				rowsWithExtraFields,
				parseErrors,
				columns: profiles,
				preview,
			};
		},
	};
};

export const csvProfileToCsv = (report: CsvProfileReport): string => {
	const escape = (value: string | number | boolean | null) => {
		const text = value === null ? "" : String(value);
		return /[",\r\n]/u.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
	};
	const rows: Array<Array<string | number | boolean | null>> = [
		["Column", "Detected type", "Non-empty", "Empty", "Unique values", "Minimum", "Maximum", "Average", "Inconsistent values"],
		...report.columns.map((column) => [column.name, column.type, column.nonEmpty, column.empty, `${column.uniqueIsLowerBound ? "at least " : ""}${column.uniqueValues}`, column.minimum, column.maximum, column.average, column.inconsistencyNotes.join(" ")]),
	];
	return rows.map((row) => row.map(escape).join(",")).join("\r\n");
};
