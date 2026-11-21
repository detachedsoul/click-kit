"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, SegmentedControl, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { parseContactsCsv, parseVCards, toCsv, toVCards } from "@/features/converter-tools/contacts";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

type Direction = "vcard-to-csv" | "csv-to-vcard";

const SAMPLE_VCARD = `BEGIN:VCARD
VERSION:3.0
N:Okafor;Amara;;;
FN:Amara Okafor
ORG:Lagos Textiles
TEL;TYPE=CELL:+234 802 555 0111
EMAIL;TYPE=INTERNET:amara@example.com
END:VCARD`;

const SAMPLE_CSV = `Name,First name,Last name,Organization,Title,Phone,Mobile,Email,Website,Address,Note,Birthday
Amara Okafor,Amara,Okafor,Lagos Textiles,Buyer,,+234 802 555 0111,amara@example.com,,,,`;

export const ContactsConverterTool = () => {
	const [direction, setDirection] = useState<Direction>("vcard-to-csv");
	const [source, setSource] = useState(SAMPLE_VCARD);

	const result = useMemo(() => {
		const trimmed = source.trim();
		if (!trimmed) return { value: "", error: "", count: 0 };
		if (direction === "vcard-to-csv") {
			const contacts = parseVCards(trimmed);
			if (contacts.length === 0) return { value: "", error: "No vCards found. Each one starts with BEGIN:VCARD and ends with END:VCARD.", count: 0 };
			return { value: toCsv(contacts), error: "", count: contacts.length };
		}
		const contacts = parseContactsCsv(trimmed);
		if (contacts.length === 0) return { value: "", error: "No rows found. The first line needs headings such as Name, Email, Mobile.", count: 0 };
		return { value: toVCards(contacts), error: "", count: contacts.length };
	}, [source, direction]);

	const switchDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => {
			const untouched = !current.trim() || current === SAMPLE_VCARD || current === SAMPLE_CSV;
			if (!untouched) return current;
			return next === "vcard-to-csv" ? SAMPLE_VCARD : SAMPLE_CSV;
		});
	};

	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Conversion direction"
				onChange={switchDirection}
				options={[
					{ id: "vcard-to-csv", label: "vCard to CSV" },
					{ id: "csv-to-vcard", label: "CSV to vCard" },
				]}
				value={direction}
			/>
			<TextAreaField
				hint={
					direction === "vcard-to-csv"
						? "Paste one card or a whole address book. Wrapped lines are joined back together; common contact fields are mapped, while photos and extra/custom vCard properties are not represented in CSV."
						: "The first line is the header. Headings are matched loosely; only the listed contact columns are written back, so other CSV fields are not included in vCards."
				}
				id="contacts-input"
				label={direction === "vcard-to-csv" ? "vCards" : "CSV"}
				onChange={setSource}
				placeholder={direction === "vcard-to-csv" ? "BEGIN:VCARD…" : "Name,Email,Mobile…"}
				rows={12}
				value={source}
			/>
			<StatGrid
				items={[
					{ label: "Contacts", value: String(result.count) },
					{ label: "Input", value: `${source.trim().length.toLocaleString()} chars` },
					{ label: "Output", value: `${result.value.length.toLocaleString()} chars` },
					{ label: "Lines", value: String(result.value ? result.value.split("\n").length : 0) },
				]}
			/>
			<ErrorNote message={result.error} />
			{!result.error ? (
				<ResultBlock
					fileName={direction === "vcard-to-csv" ? "contacts.csv" : "contacts.vcf"}
					title={direction === "vcard-to-csv" ? "CSV output" : "vCard output"}
					value={result.value}
				/>
			) : null}
			<p className={hintClassName}>Only the fields shown in the CSV columns are round-tripped; extra phone numbers, emails, photos, and custom vCard properties can be lost. Nothing is uploaded.</p>
		</ToolPanel>
	);
};
