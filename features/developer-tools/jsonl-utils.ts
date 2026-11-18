export type JsonlFormat = "compact" | "pretty" | "sorted";

export type JsonlError = { line: number; message: string };

export type JsonlReport = {
	records: number;
	output: string;
	errors: JsonlError[];
	fields: string[];
	blankLines: number;
};

const parseLine = (line: string) => {
	try {
		return { value: JSON.parse(line) as unknown, error: null };
	} catch (error) {
		return { value: null, error: error instanceof Error ? error.message.replace(/^JSON\.parse: /u, "") : "Invalid JSON" };
	}
};

const sortValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, item]) => [key, sortValue(item)]),
		);
	}
	return value;
};

export const formatJsonLines = (source: string, format: JsonlFormat = "compact"): JsonlReport => {
	if (!source.trim()) throw new Error("Paste newline-delimited JSON first.");
	const lines = source.replace(/\r\n/gu, "\n").split("\n");
	const errors: JsonlError[] = [];
	const rendered: string[] = [];
	const fields = new Set<string>();
	let records = 0;
	let blankLines = 0;
	lines.forEach((line, index) => {
		if (!line.trim()) {
			if (index < lines.length - 1) blankLines += 1;
			return;
		}
		const parsed = parseLine(line.trim());
		if (parsed.error) {
			errors.push({ line: index + 1, message: parsed.error });
			return;
		}
		records += 1;
		if (parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
			for (const key of Object.keys(parsed.value)) fields.add(key);
		}
		const value = format === "sorted" ? sortValue(parsed.value) : parsed.value;
		if (format === "pretty") {
			rendered.push(JSON.stringify(value, null, 2));
		} else {
			rendered.push(JSON.stringify(value));
		}
	});
	if (records === 0 && errors.length === 0) throw new Error("No JSON values found.");
	if (records === 0) throw new Error(`Every line failed to parse. Line ${errors[0].line}: ${errors[0].message}`);
	return {
		records,
		output: rendered.join(format === "pretty" ? "\n\n" : "\n"),
		errors,
		fields: [...fields].sort((left, right) => left.localeCompare(right)),
		blankLines,
	};
};

export const jsonArrayToJsonLines = (source: string, format: JsonlFormat = "compact") => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message.replace(/^JSON\.parse: /u, "") : "Invalid JSON");
	}
	if (!Array.isArray(parsed)) throw new Error("Expected a JSON array to convert into JSON Lines.");
	if (parsed.length === 0) throw new Error("The array is empty.");
	return parsed.map((item) => JSON.stringify(format === "sorted" ? sortValue(item) : item)).join("\n");
};

export const jsonLinesToArray = (source: string, format: JsonlFormat = "pretty") => {
	const report = formatJsonLines(source, "compact");
	const values = report.output
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as unknown);
	return JSON.stringify(format === "sorted" ? values.map(sortValue) : values, null, format === "pretty" ? 2 : undefined);
};
