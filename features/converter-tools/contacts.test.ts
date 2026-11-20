import { describe, expect, it } from "vitest";
import { parseContactsCsv, parseVCards, toCsv, toVCards, type Contact } from "@/features/converter-tools/contacts";

const VCARD = `BEGIN:VCARD
VERSION:3.0
N:Okafor;Amara;;;
FN:Amara Okafor
ORG:Lagos Textiles
TITLE:Buyer
TEL;TYPE=HOME,VOICE:+234 801 555 0100
TEL;TYPE=CELL:+234 802 555 0111
EMAIL;TYPE=INTERNET:amara@example.com
URL:https://example.com
ADR;TYPE=HOME:;;12 Marina Road;Lagos;;101001;Nigeria
BDAY:1990-04-02
NOTE:Met at the trade fair
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Chidi Bello
TEL;TYPE=CELL:+234 803 555 0122
END:VCARD`;

describe("vcard parsing", () => {
	it("reads names, numbers, and details", () => {
		const [amara, chidi] = parseVCards(VCARD);
		expect(amara.name).toBe("Amara Okafor");
		expect(amara.first).toBe("Amara");
		expect(amara.last).toBe("Okafor");
		expect(amara.organization).toBe("Lagos Textiles");
		expect(amara.phone).toBe("+234 801 555 0100");
		expect(amara.mobile).toBe("+234 802 555 0111");
		expect(amara.email).toBe("amara@example.com");
		expect(amara.address).toContain("12 Marina Road");
		expect(amara.address).toContain("Lagos");
		expect(amara.birthday).toBe("1990-04-02");
		expect(chidi.name).toBe("Chidi Bello");
		expect(chidi.mobile).toBe("+234 803 555 0122");
	});

	it("joins lines a vCard wrapped", () => {
		const folded = "BEGIN:VCARD\nFN:Amara Okafor\nNOTE:This note was wrapped across\n  two lines\nEND:VCARD\n";
		expect(parseVCards(folded)[0].note).toBe("This note was wrapped across two lines");
	});

	it("keeps escaped commas and newlines as characters", () => {
		const card = "BEGIN:VCARD\nFN:Ada\\, the first\nNOTE:line one\\nline two\nEND:VCARD\n";
		const [ada] = parseVCards(card);
		expect(ada.name).toBe("Ada, the first");
		expect(ada.note).toBe("line one\nline two");
	});

	it("ignores anything that is not a card", () => {
		expect(parseVCards("hello there")).toEqual([]);
	});
});

describe("csv", () => {
	it("writes a header row and quotes what needs it", () => {
		const contacts: Contact[] = [{ ...parseVCards(VCARD)[0], note: 'Said "hello", loudly' }];
		const csv = toCsv(contacts);
		expect(csv.split("\n")[0]).toContain("Name,First name,Last name");
		expect(csv).toContain('"Said ""hello"", loudly"');
	});

	it("reads its own csv back", () => {
		const original = parseVCards(VCARD);
		const roundTripped = parseContactsCsv(toCsv(original));
		expect(roundTripped).toHaveLength(2);
		expect(roundTripped[0].name).toBe("Amara Okafor");
		expect(roundTripped[0].mobile).toBe("+234 802 555 0111");
		expect(roundTripped[1].email).toBe("");
	});

	it("accepts header names in any case", () => {
		const rows = parseContactsCsv("name,EMAIL\nAda Lovelace,ada@example.com\n");
		expect(rows).toEqual([{ ...{ name: "", first: "", last: "", organization: "", title: "", phone: "", mobile: "", email: "", website: "", address: "", note: "", birthday: "" }, name: "Ada Lovelace", email: "ada@example.com" }]);
	});

	it("needs a header before it will read rows", () => {
		expect(parseContactsCsv("Ada,ada@example.com")).toEqual([]);
	});
});

describe("vcard writing", () => {
	it("writes cards a phone can import", () => {
		const cards = toVCards(parseVCards(VCARD));
		expect(cards).toContain("BEGIN:VCARD\nVERSION:3.0");
		expect(cards.match(/END:VCARD/gu)).toHaveLength(2);
		expect(cards).toContain("TEL;TYPE=CELL:+234 802 555 0111");
		expect(cards).toContain("FN:Amara Okafor");
	});

	it("survives a full round trip", () => {
		const once = parseVCards(toVCards(parseContactsCsv(toCsv(parseVCards(VCARD)))));
		expect(once).toHaveLength(2);
		expect(once[0].name).toBe("Amara Okafor");
		expect(once[0].note).toBe("Met at the trade fair");
	});
});
