/**
 * Spreadsheets, built and read here in the tab.
 *
 * A .xlsx is a zip of XML parts: a workbook that lists the sheets, a relationships file that
 * says where each sheet lives, and one XML file per sheet. Writing one needs no library, and
 * reading one only needs the shared-strings table and the cell references — which is all this
 * does. Formulas, styles, and charts are not carried across; the values are.
 */

import { parseCsvRows } from "@/features/converter-tools/contacts";
import { readZipEntries } from "@/features/converter-tools/zip-reader";
import { createZip } from "@/features/image-tools/zip-utils";

export type Sheet = { name: string; rows: string[][] };

export const MAX_ROWS = 20_000;
export const MAX_COLUMNS = 200;
const MAX_SHEET_NAME = 31;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

/** 0 → A, 25 → Z, 26 → AA. */
export const columnName = (index: number): string => {
	let name = "";
	let rest = Math.max(0, Math.floor(index));
	do {
		name = String.fromCharCode(65 + (rest % 26)) + name;
		rest = Math.floor(rest / 26) - 1;
	} while (rest >= 0);
	return name;
};

/** "AB12" → 27, the column index, zero-based. */
export const columnIndex = (reference: string): number => {
	const letters = (/^[A-Za-z]+/u.exec(reference)?.[0] ?? "A").toUpperCase();
	let index = 0;
	for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
	return index - 1;
};

export const escapeXml = (text: string): string =>
	text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");

/** Excel's rule: 31 characters, and none of : \ / ? * [ ]. */
export const sheetName = (raw: string): string => {
	const clean = raw
		.replace(/[:\\/?*[\]]/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()
		.slice(0, MAX_SHEET_NAME);
	return clean || "Sheet1";
};

/**
 * A cell that is only a number is written as one, so Excel can add it up. Leading zeros are
 * left alone: "007" is an account number or a code, not seven.
 */
export const asNumber = (value: string): number | null => {
	const text = value.trim();
	if (!/^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,10})?$/u.test(text)) return null;
	if (/^-0(?:\.0+)?$/u.test(text)) return 0;
	const number = Number(text);
	return Number.isFinite(number) ? number : null;
};

const cellXml = (index: number, row: number, value: string): string => {
	const reference = `${columnName(index)}${row}`;
	if (value === "") return "";
	const number = asNumber(value);
	if (number !== null) return `<c r="${reference}"><v>${number}</v></c>`;
	return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

export const sheetXml = (rows: string[][]): string => {
	const body = rows
		.slice(0, MAX_ROWS)
		.map((row, rowIndex) => {
			const cells = row
				.slice(0, MAX_COLUMNS)
				.map((value, column) => cellXml(column, rowIndex + 1, value ?? ""))
				.join("");
			return cells ? `<row r="${rowIndex + 1}">${cells}</row>` : "";
		})
		.join("");
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
};

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml";

const contentTypes = (sheets: number) =>
	`${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
	'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
	'<Default Extension="xml" ContentType="application/xml"/>' +
	`<Override PartName="/xl/workbook.xml" ContentType="${CONTENT_TYPE}.sheet.main+xml"/>` +
	Array.from({ length: sheets }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="${CONTENT_TYPE}.worksheet+xml"/>`).join("") +
	"</Types>";

const rootRels = () => `${HEAD}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const workbook = (names: string[]) =>
	`${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${names
		.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
		.join("")}</sheets></workbook>`;

const workbookRels = (count: number) =>
	`${HEAD}<Relationships xmlns="${PACKAGE_REL}">${Array.from(
		{ length: count },
		(_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
	).join("")}</Relationships>`;

/** A workbook you can open in Excel, Numbers, or LibreOffice. */
export const buildXlsx = async (sheets: Sheet[]): Promise<Uint8Array> => {
	const clean = sheets.length ? sheets : [{ name: "Sheet1", rows: [] }];
	const names = clean.map((sheet, index) => {
		const name = sheetName(sheet.name);
		return clean.slice(0, index).some((earlier) => sheetName(earlier.name) === name) ? sheetName(`${name} ${index + 1}`) : name;
	});
	const files = [
		{ name: "[Content_Types].xml", data: encoder.encode(contentTypes(clean.length)) },
		{ name: "_rels/.rels", data: encoder.encode(rootRels()) },
		{ name: "xl/workbook.xml", data: encoder.encode(workbook(names)) },
		{ name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels(clean.length)) },
		...clean.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: encoder.encode(sheetXml(sheet.rows)) })),
	];
	return createZip(files);
};

const parseXml = (text: string) => new DOMParser().parseFromString(text, "application/xml");

const elements = (root: Document | Element, name: string) => Array.from(root.getElementsByTagName("*")).filter((node) => node.localName === name);

const textOf = (element: Element) =>
	elements(element, "t")
		.map((node) => node.textContent ?? "")
		.join("");

const resolveTarget = (base: string, target: string): string => {
	const out: string[] = [];
	for (const part of `${base}${target}`.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") out.pop();
		else out.push(part);
	}
	return out.join("/");
};

/** Every sheet in the workbook, in workbook order, with numbers kept as their text. */
export const readXlsx = async (bytes: Uint8Array): Promise<Sheet[]> => {
	const entries = new Map<string, Uint8Array>();
	for (const entry of await readZipEntries(bytes)) entries.set(entry.name.toLowerCase(), entry.bytes);
	const workbookBytes = entries.get("xl/workbook.xml");
	if (!workbookBytes) throw new Error("That file is not a spreadsheet — there is no workbook inside it.");
	const workbookDoc = parseXml(decoder.decode(workbookBytes));

	const shared: string[] = [];
	const sharedBytes = entries.get("xl/sharedstrings.xml");
	if (sharedBytes) {
		for (const item of elements(parseXml(decoder.decode(sharedBytes)), "si")) shared.push(textOf(item));
	}

	const relsBytes = entries.get("xl/_rels/workbook.xml.rels");
	const targets = new Map<string, string>();
	if (relsBytes) {
		for (const relationship of elements(parseXml(decoder.decode(relsBytes)), "Relationship")) {
			const id = relationship.getAttribute("Id") ?? "";
			const target = relationship.getAttribute("Target") ?? "";
			if (id && target) targets.set(id, target);
		}
	}

	const sheets: Sheet[] = [];
	for (const declared of elements(workbookDoc, "sheet")) {
		const name = declared.getAttribute("name") ?? `Sheet ${sheets.length + 1}`;
		const rid = declared.getAttribute("r:id") ?? declared.getAttributeNS(REL, "id") ?? "";
		const target = targets.get(rid) ?? `worksheets/sheet${sheets.length + 1}.xml`;
		const path = resolveTarget("xl/", target);
		const sheetBytes = entries.get(path.toLowerCase()) ?? entries.get(`xl/${path}`.toLowerCase());
		if (!sheetBytes) continue;
		const rows: string[][] = [];
		for (const row of elements(parseXml(decoder.decode(sheetBytes)), "row")) {
			const cells: string[] = [];
			for (const cell of elements(row, "c")) {
				const reference = cell.getAttribute("r") ?? `${columnName(cells.length)}1`;
				const column = columnIndex(reference);
				const type = cell.getAttribute("t") ?? "";
				const valueElement = elements(cell, "v")[0];
				const value = valueElement?.textContent ?? "";
				let text: string;
				if (type === "s") text = shared[Number(value)] ?? "";
				else if (type === "inlineStr") text = textOf(cell);
				else if (type === "b") text = value === "1" ? "TRUE" : "FALSE";
				else text = value;
				while (cells.length < column) cells.push("");
				cells[column] = text;
			}
			rows.push(cells);
			if (rows.length > MAX_ROWS) break;
		}
		// Trailing empty rows and columns are noise; Excel stores them all the same way.
		while (rows.length && rows[rows.length - 1].every((value) => value === "")) rows.pop();
		const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
		sheets.push({ name, rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? "")) });
	}
	if (!sheets.length) throw new Error("That workbook has no sheets in it.");
	return sheets;
};

const csvCell = (value: string) => (/[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value);

export const rowsToCsv = (rows: string[][]): string => `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;

export const csvToRows = (text: string): string[][] => {
	const rows = parseCsvRows(text);
	if (rows.length > MAX_ROWS) throw new Error(`That file has more than ${MAX_ROWS.toLocaleString("en-GB")} rows. Split it before converting.`);
	const tooWide = rows.find((row) => row.length > MAX_COLUMNS);
	if (tooWide) throw new Error(`One row has more than ${MAX_COLUMNS} columns.`);
	return rows;
};

export const sheetSummary = (rows: string[][]): { rows: number; columns: number; numbers: number } => ({
	rows: rows.length,
	columns: rows.reduce((most, row) => Math.max(most, row.length), 0),
	numbers: rows.reduce((count, row) => count + row.filter((value) => asNumber(value) !== null).length, 0),
});
