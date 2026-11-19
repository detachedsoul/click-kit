/**
 * Comparing two documents by their words.
 *
 * Text is all we compare: a PDF holds drawings, fonts, and images as well, but the words
 * are what a reader notices. Pages are lined up by number, then the lines on each page are
 * matched with a longest-common-subsequence pass so a moved line shows as one removal and
 * one addition rather than the whole page turning red.
 */

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

export type PageChange = { page: number; status: "same" | "changed" | "added" | "removed"; lines: DiffLine[] };

export type CompareSummary = { same: number; changed: number; added: number; removed: number; total: number };

/** Beyond this the table gets too big to fill in a browser tab; fall back to a coarse pass. */
const CELL_LIMIT = 400_000;

const coarse = (before: string[], after: string[]): DiffLine[] => {
	const lines: DiffLine[] = [];
	const height = Math.max(before.length, after.length);
	for (let index = 0; index < height; index += 1) {
		const left = before[index];
		const right = after[index];
		if (left === right) lines.push({ kind: "same", text: left });
		else {
			if (left !== undefined) lines.push({ kind: "removed", text: left });
			if (right !== undefined) lines.push({ kind: "added", text: right });
		}
	}
	return lines;
};

/**
 * Line-by-line difference, oldest first. Identical heads and tails are stripped before the
 * table is built, which keeps the common case — one changed paragraph in a long page — cheap.
 */
export const diffLines = (before: string[], after: string[]): DiffLine[] => {
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
	let endBefore = before.length;
	let endAfter = after.length;
	while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
		endBefore -= 1;
		endAfter -= 1;
	}
	const head = before.slice(0, start).map((text): DiffLine => ({ kind: "same", text }));
	const tail = before.slice(endBefore).map((text): DiffLine => ({ kind: "same", text }));
	const middleBefore = before.slice(start, endBefore);
	const middleAfter = after.slice(start, endAfter);
	if (middleBefore.length === 0) return [...head, ...middleAfter.map((text): DiffLine => ({ kind: "added", text })), ...tail];
	if (middleAfter.length === 0) return [...head, ...middleBefore.map((text): DiffLine => ({ kind: "removed", text })), ...tail];
	if (middleBefore.length * middleAfter.length > CELL_LIMIT) return [...head, ...coarse(middleBefore, middleAfter), ...tail];

	const rows = middleBefore.length;
	const columns = middleAfter.length;
	// lengths[i][j] = how many lines the two tails have in common from these positions on.
	const lengths: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
	for (let i = rows - 1; i >= 0; i -= 1) {
		for (let j = columns - 1; j >= 0; j -= 1) {
			lengths[i][j] = middleBefore[i] === middleAfter[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
		}
	}
	const middle: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < rows && j < columns) {
		if (middleBefore[i] === middleAfter[j]) {
			middle.push({ kind: "same", text: middleBefore[i] });
			i += 1;
			j += 1;
		} else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
			middle.push({ kind: "removed", text: middleBefore[i] });
			i += 1;
		} else {
			middle.push({ kind: "added", text: middleAfter[j] });
			j += 1;
		}
	}
	for (; i < rows; i += 1) middle.push({ kind: "removed", text: middleBefore[i] });
	for (; j < columns; j += 1) middle.push({ kind: "added", text: middleAfter[j] });
	return [...head, ...middle, ...tail];
};

/** Pages are matched by number: a page only in the second file is added, only in the first, removed. */
export const comparePages = (before: string[][], after: string[][]): PageChange[] => {
	const total = Math.max(before.length, after.length);
	const changes: PageChange[] = [];
	for (let index = 0; index < total; index += 1) {
		const left = before[index];
		const right = after[index];
		const page = index + 1;
		if (left === undefined && right !== undefined) {
			changes.push({ page, status: "added", lines: right.map((text) => ({ kind: "added" as const, text })) });
			continue;
		}
		if (right === undefined && left !== undefined) {
			changes.push({ page, status: "removed", lines: left.map((text) => ({ kind: "removed" as const, text })) });
			continue;
		}
		const lines = diffLines(left ?? [], right ?? []);
		changes.push({ page, status: lines.some((line) => line.kind !== "same") ? "changed" : "same", lines });
	}
	return changes;
};

export const summarise = (changes: PageChange[]): CompareSummary => ({
	same: changes.filter((change) => change.status === "same").length,
	changed: changes.filter((change) => change.status === "changed").length,
	added: changes.filter((change) => change.status === "added").length,
	removed: changes.filter((change) => change.status === "removed").length,
	total: changes.length,
});

/** A one-line answer, for the top of any report. */
export const describeComparison = (summary: CompareSummary): string => {
	if (summary.total === 0) return "Both documents are empty.";
	if (summary.changed === 0 && summary.added === 0 && summary.removed === 0) return `No differences: all ${summary.total} page${summary.total === 1 ? "" : "s"} read the same.`;
	const parts: string[] = [];
	if (summary.changed) parts.push(`${summary.changed} page${summary.changed === 1 ? "" : "s"} changed`);
	if (summary.added) parts.push(`${summary.added} added`);
	if (summary.removed) parts.push(`${summary.removed} removed`);
	return `${parts.join(", ")} — ${summary.same} of ${summary.total} page${summary.total === 1 ? "" : "s"} unchanged.`;
};

/** The report as Markdown, worth keeping beside the files. */
export const comparisonToMarkdown = (changes: PageChange[], before: string, after: string): string => {
	const summary = summarise(changes);
	const lines = [`# Comparing ${before} with ${after}`, "", describeComparison(summary), ""];
	for (const change of changes) {
		if (change.status === "same") continue;
		lines.push(`## Page ${change.page} (${change.status})`, "");
		for (const line of change.lines) {
			if (line.kind === "same") continue;
			lines.push(`${line.kind === "added" ? "+" : "-"} ${line.text}`);
		}
		lines.push("");
	}
	return lines.join("\n").trim();
};
