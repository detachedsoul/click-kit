/**
 * Contacts: vCard (2.1 / 3.0 / 4.0 style) and CSV.
 *
 * Only the fields a phone, a spreadsheet, and an email client all understand are carried,
 * so a round trip keeps names, numbers, and addresses without inventing anything.
 */

export type Contact = {
	name: string;
	first: string;
	last: string;
	organization: string;
	title: string;
	phone: string;
	mobile: string;
	email: string;
	website: string;
	address: string;
	note: string;
	birthday: string;
};

export const EMPTY_CONTACT: Contact = {
	name: "",
	first: "",
	last: "",
	organization: "",
	title: "",
	phone: "",
	mobile: "",
	email: "",
	website: "",
	address: "",
	note: "",
	birthday: "",
};

export const CONTACT_COLUMNS: { key: keyof Contact; label: string }[] = [
	{ key: "name", label: "Name" },
	{ key: "first", label: "First name" },
	{ key: "last", label: "Last name" },
	{ key: "organization", label: "Organization" },
	{ key: "title", label: "Title" },
	{ key: "phone", label: "Phone" },
	{ key: "mobile", label: "Mobile" },
	{ key: "email", label: "Email" },
	{ key: "website", label: "Website" },
	{ key: "address", label: "Address" },
	{ key: "note", label: "Note" },
	{ key: "birthday", label: "Birthday" },
];

/** vCard wraps long lines with a leading space; put them back together first. */
const unfold = (source: string) => source.replace(/\r\n?/gu, "\n").replace(/\n[ \t]/gu, "");

const decode = (value: string) =>
	value
		.replace(/\\n/giu, "\n")
		.replace(/\\,/gu, ",")
		.replace(/\\;/gu, ";")
		.replace(/\\\\/gu, "\\")
		.replace(/\u0000/gu, "")
		.trim();

/** "Family;Given;Middle;Dr.;Jr." → the three parts we keep. */
const splitName = (value: string) => {
	const parts = value.split(";").map((part) => decode(part));
	return { last: parts[0] ?? "", first: parts[1] ?? "" };
};

const typeOf = (params: string) => params.toLowerCase();

export const parseVCards = (source: string): Contact[] => {
	const text = unfold(source);
	const blocks = text.split(/BEGIN:VCARD/iu).slice(1);
	const contacts: Contact[] = [];
	for (const block of blocks) {
		const body = block.split(/END:VCARD/iu)[0] ?? "";
		const contact: Contact = { ...EMPTY_CONTACT };
		let structuredName = "";
		for (const rawLine of body.split("\n")) {
			const line = rawLine.trim();
			if (!line) continue;
			const colon = line.indexOf(":");
			if (colon === -1) continue;
			const left = line.slice(0, colon);
			const value = line.slice(colon + 1);
			const [rawName, ...rawParams] = left.split(";");
			const name = rawName.toUpperCase();
			const params = typeOf(rawParams.join(";"));
			if (name === "FN" && !contact.name) contact.name = decode(value);
			else if (name === "N") {
				structuredName = value;
				const parts = splitName(value);
				contact.first = contact.first || parts.first;
				contact.last = contact.last || parts.last;
			} else if (name === "ORG") contact.organization = contact.organization || decode(value.split(";")[0] ?? "");
			else if (name === "TITLE") contact.title = contact.title || decode(value);
			else if (name === "EMAIL") contact.email = contact.email || decode(value);
			else if (name === "URL") contact.website = contact.website || decode(value);
			else if (name === "NOTE") contact.note = contact.note || decode(value);
			else if (name === "BDAY") contact.birthday = contact.birthday || decode(value);
			else if (name === "TEL") {
				const mobile = /cell|mobile/iu.test(params);
				if (mobile && !contact.mobile) contact.mobile = decode(value);
				else if (!contact.phone) contact.phone = decode(value);
				else if (!contact.mobile) contact.mobile = decode(value);
			} else if (name === "ADR") {
				if (!contact.address) {
					contact.address = value
						.split(";")
						.map((part) => decode(part))
						.filter(Boolean)
						.join(", ");
				}
			}
		}
		if (!contact.name) {
			const parts = splitName(structuredName);
			contact.name = [parts.first, parts.last].filter(Boolean).join(" ") || contact.organization || contact.email;
		}
		if (contact.name || contact.email || contact.phone || contact.mobile) contacts.push(contact);
	}
	return contacts;
};

/** RFC 4180 style: quote anything with a comma, a quote, or a newline. */
const csvCell = (value: string) => (/[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value);

export const toCsv = (contacts: Contact[]): string => {
	const header = CONTACT_COLUMNS.map((column) => csvCell(column.label)).join(",");
	const rows = contacts.map((contact) => CONTACT_COLUMNS.map((column) => csvCell(contact[column.key])).join(","));
	return [header, ...rows].join("\n").concat("\n");
};

/** Splits CSV text into records, respecting quotes. */
export const parseCsvRows = (source: string): string[][] => {
	const text = source.replace(/\r\n?/gu, "\n");
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (quoted) {
			if (char === '"' && text[index + 1] === '"') {
				cell += '"';
				index += 1;
			} else if (char === '"') quoted = false;
			else cell += char;
			continue;
		}
		if (char === '"') quoted = true;
		else if (char === ",") {
			row.push(cell);
			cell = "";
		} else if (char === "\n") {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else cell += char;
	}
	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
};

const headerKey = (label: string) => {
	const match = CONTACT_COLUMNS.find((column) => column.label.toLowerCase() === label.trim().toLowerCase());
	if (match) return match.key;
	const loose = CONTACT_COLUMNS.find((column) => column.key === label.trim().toLowerCase().replace(/\s+/gu, ""));
	return loose?.key ?? null;
};

export const parseContactsCsv = (source: string): Contact[] => {
	const rows = parseCsvRows(source);
	if (rows.length < 2) return [];
	const keys = rows[0].map((label) => headerKey(label));
	return rows
		.slice(1)
		.map((row) => {
			const contact: Contact = { ...EMPTY_CONTACT };
			keys.forEach((key, index) => {
				if (key) contact[key] = (row[index] ?? "").trim();
			});
			return contact;
		})
		.filter((contact) => contact.name || contact.first || contact.last || contact.email || contact.phone || contact.mobile);
};

const escapeVcard = (value: string) => value.replace(/\\/gu, "\\\\").replace(/\n/gu, "\\n").replace(/;/gu, "\\;").replace(/,/gu, "\\,");

/** Folds long lines the way vCard expects, at 75 characters. */
const fold = (line: string) => {
	if (line.length <= 75) return line;
	const parts: string[] = [];
	for (let index = 0; index < line.length; index += 75) parts.push(line.slice(index, index + 75));
	return parts.join("\n ");
};

export const toVCards = (contacts: Contact[]): string =>
	contacts
		.map((contact) => {
			const lines = ["BEGIN:VCARD", "VERSION:3.0"];
			const first = contact.first || (!contact.last ? contact.name.split(" ")[0] ?? "" : "");
			const last = contact.last || (!contact.first && contact.name.includes(" ") ? contact.name.split(" ").slice(1).join(" ") : "");
			lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
			lines.push(`FN:${escapeVcard(contact.name || [first, last].filter(Boolean).join(" "))}`);
			if (contact.organization) lines.push(`ORG:${escapeVcard(contact.organization)}`);
			if (contact.title) lines.push(`TITLE:${escapeVcard(contact.title)}`);
			if (contact.phone) lines.push(`TEL;TYPE=HOME,VOICE:${escapeVcard(contact.phone)}`);
			if (contact.mobile) lines.push(`TEL;TYPE=CELL:${escapeVcard(contact.mobile)}`);
			if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(contact.email)}`);
			if (contact.website) lines.push(`URL:${escapeVcard(contact.website)}`);
			if (contact.address) lines.push(`ADR;TYPE=HOME:;;${escapeVcard(contact.address)};;;;`);
			if (contact.birthday) lines.push(`BDAY:${escapeVcard(contact.birthday)}`);
			if (contact.note) lines.push(`NOTE:${escapeVcard(contact.note)}`);
			lines.push("END:VCARD");
			return lines.map(fold).join("\n");
		})
		.join("\n")
		.concat(contacts.length ? "\n" : "");

export const contactCount = (source: string) => parseVCards(source).length;
