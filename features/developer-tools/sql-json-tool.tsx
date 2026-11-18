"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { sqlToJson } from "@/features/developer-tools/sql-json-utils";
import { CheckboxField, ErrorNote, hintClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `-- exported from the billing database
INSERT INTO customers (id, name, email, plan, seats, trial, notes) VALUES
  (1, 'Ada Lovelace', 'ada@example.com', 'pro', 4, false, 'joined via invite'),
  (2, 'Grace Hopper', 'grace@example.com', 'team', 12, false, NULL),
  (3, 'O''Brien, Tim', 'tim@example.com', 'free', 1, true, 'It''s a trial');

INSERT INTO invoices (id, customer_id, total, currency) VALUES
  (10, 1, 129.5, 'EUR'),
  (11, 2, 349, 'EUR');`;

export const SqlJsonTool = () => {
	const [source, setSource] = useState(sample);
	const [castTypes, setCastTypes] = useState(true);
	const [wrap, setWrap] = useState(false);
	const result = useMemo(() => {
		try {
			const converted = sqlToJson(source, { castTypes, wrap });
			return { ...converted, error: "" };
		} catch (error) {
			return { text: "", report: null, error: error instanceof Error ? error.message : "Could not read this SQL." };
		}
	}, [source, castTypes, wrap]);
	const rows = result.report?.tables.reduce((total, table) => total + table.rows.length, 0) ?? 0;
	return (
		<ToolPanel>
			<div className="flex flex-wrap items-center gap-4">
				<CheckboxField checked={castTypes} id="sql-cast" label={<>Cast numbers, booleans, and NULL (off = everything is a string)</>} onChange={setCastTypes} />
				{result.report && result.report.tables.length > 1 && (
					<CheckboxField checked={wrap} id="sql-wrap" label={<>Wrap tables in a <code>tables</code> object</>} onChange={setWrap} />
				)}
			</div>
			<TextAreaField
				id="sql-inserts"
				label="SQL INSERT statements"
				value={source}
				onChange={setSource}
				placeholder="INSERT INTO people (id, name) VALUES (1, 'Ada');"
				rows={14}
				hint="Handles multi-row VALUES, quoted identifiers, escaped single quotes, NULL/TRUE/FALSE, numeric casts, and -- or /* */ comments. Multiple tables become one object."
			/>
			<ErrorNote message={result.error} />
			{result.report && result.text && (
				<>
					<StatGrid
						items={[
							{ label: "Statements", value: String(result.report.statements) },
							{ label: "Tables", value: String(result.report.tables.length) },
							{ label: "Rows", value: String(rows) },
							{ label: "Warnings", value: String(result.report.warnings.length) },
						]}
					/>
					{result.report.warnings.length > 0 && (
						<ul className="m-0 flex list-none flex-col gap-1 text-xs text-[#8a6a1f]">
							{result.report.warnings.map((warning) => (
								<li key={warning}>{warning}</li>
							))}
						</ul>
					)}
					<ResultBlock title="Result" value={result.text} rows={16} fileName="rows.json" />
					<p className={hintClassName}>
						Columns: {result.report.tables.map((table) => `${table.table} (${table.columns.length})`).join(", ")}. Values that are SQL expressions
						such as <code>NOW()</code> or <code>nextval(&apos;seq&apos;)</code> are kept verbatim as strings.
					</p>
				</>
			)}
		</ToolPanel>
	);
};
