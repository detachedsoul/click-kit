export type IndentUnit = "tab" | 2 | 4 | 8;

export type IndentOptions = {
	from: IndentUnit | "auto";
	to: IndentUnit;
	trimTrailing: boolean;
	blankLines: boolean;
};

export type IndentReport = {
	output: string;
	detected: IndentUnit;
	basis: string;
	changedLines: number;
	tabbedLines: number;
	spacedLines: number;
	mixedLines: number;
};

const leading = (line: string) => /^[ \t]*/u.exec(line)?.[0] ?? "";

export const detectIndentation = (source: string): { unit: IndentUnit; basis: string } => {
	const lines = source.split(/\r?\n/u).filter((line) => line.trim());
	const indented = lines.filter((line) => leading(line).length > 0);
	if (indented.length === 0) return { unit: 2, basis: "No indented lines found; assumed 2 spaces." };
	const tabLines = indented.filter((line) => leading(line).startsWith("\t"));
	if (tabLines.length / indented.length > 0.6) return { unit: "tab", basis: `${tabLines.length} of ${indented.length} indented lines use tabs.` };
	const counts = indented
		.filter((line) => !leading(line).includes("\t"))
		.map((line) => leading(line).length)
		.filter((length) => length > 0);
	const smallest = counts.length ? Math.min(...counts) : 0;
	const unit: IndentUnit = smallest <= 2 ? 2 : smallest <= 4 ? 4 : 8;
	return { unit, basis: `Smallest space indent is ${smallest}; using ${unit} spaces.` };
};

const widthOf = (unit: IndentUnit) => (unit === "tab" ? 4 : unit);

const expand = (whitespace: string, from: IndentUnit, to: IndentUnit) => {
	// A tab counts as one indentation level of the target unit, so "	" becomes
	// exactly one level of the chosen width instead of a fixed four columns.
	const width = from === "tab" ? widthOf(to) : from;
	let columns = 0;
	for (const character of whitespace) {
		if (character === "\t") columns += width - (columns % width);
		else columns += 1;
	}
	return columns;
};

const emit = (columns: number, unit: IndentUnit) => {
	if (unit === "tab") {
		const width = widthOf(unit);
		return "\t".repeat(Math.floor(columns / width)) + " ".repeat(columns % width);
	}
	return " ".repeat(columns);
};

export const convertIndentation = (source: string, options: IndentOptions): IndentReport => {
	if (!source.trim()) throw new Error("Paste text to re-indent first.");
	const detected = detectIndentation(source);
	const from = options.from === "auto" ? detected.unit : options.from;
	const lines = source.replace(/\r\n/gu, "\n").split("\n");
	let changedLines = 0;
	let tabbedLines = 0;
	let spacedLines = 0;
	let mixedLines = 0;
	const output = lines.map((line) => {
		const whitespace = leading(line);
		if (whitespace.includes("\t") && whitespace.includes(" ")) mixedLines += 1;
		else if (whitespace.startsWith("\t")) tabbedLines += 1;
		else if (whitespace.length) spacedLines += 1;
		if (!line.trim()) {
			const blank = options.blankLines ? line : "";
			if (blank !== line) changedLines += 1;
			return blank;
		}
		const body = line.slice(whitespace.length);
		const reindented = emit(expand(whitespace, from, options.to), options.to) + body;
		const result = options.trimTrailing ? reindented.replace(/[ \t]+$/u, "") : reindented;
		if (result !== line) changedLines += 1;
		return result;
	});
	return {
		output: output.join("\n"),
		detected: detected.unit,
		basis: detected.basis,
		changedLines,
		tabbedLines,
		spacedLines,
		mixedLines,
	};
};

export const indentLabel = (unit: IndentUnit) => (unit === "tab" ? "tab" : `${unit} spaces`);
