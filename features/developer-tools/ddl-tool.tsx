"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { ddlToMongoose, ddlToPrisma, ddlToTypeScript, parseDdl, type DdlTarget } from "@/features/developer-tools/ddl-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = `CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  published_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);`;

export const DdlTool = () => {
	const [source, setSource] = useState(sample);
	const [target, setTarget] = useState<DdlTarget>("prisma");
	const result = useMemo(() => {
		try {
			const tables = parseDdl(source);
			const text = target === "prisma" ? ddlToPrisma(tables) : target === "typescript" ? ddlToTypeScript(tables) : ddlToMongoose(tables);
			return { text, tables, error: "" };
		} catch (error) {
			return { text: "", tables: null, error: error instanceof Error ? error.message : "Could not read this DDL." };
		}
	}, [source, target]);
	const fileName = target === "prisma" ? "schema.prisma" : target === "typescript" ? "models.ts" : "models.js";
	return (
		<ToolPanel>
			<label className={labelClassName} htmlFor="ddl-target">
				Output
				<select className={selectClassName} id="ddl-target" onChange={(event) => setTarget(event.target.value as DdlTarget)} value={target}>
					<option value="prisma">Prisma models</option>
					<option value="typescript">TypeScript interfaces</option>
					<option value="mongoose">Mongoose schemas</option>
				</select>
			</label>
			<TextAreaField
				id="ddl-source"
				label="CREATE TABLE statements"
				value={source}
				onChange={setSource}
				placeholder="CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL);"
				rows={14}
				hint="Column types, NOT NULL, PRIMARY KEY (inline or composite), UNIQUE, DEFAULT, REFERENCES, and SERIAL/IDENTITY auto-increment are recognised."
			/>
			<ErrorNote message={result.error} />
			{result.tables && result.text && (
				<>
					<StatGrid
						items={[
							{ label: "Tables", value: String(result.tables.length) },
							{ label: "Columns", value: String(result.tables.reduce((total, table) => total + table.columns.length, 0)) },
							{ label: "Primary keys", value: String(result.tables.filter((table) => table.compositePrimaryKey.length > 0).length) },
							{ label: "Foreign keys", value: String(result.tables.reduce((total, table) => total + table.columns.filter((column) => column.references).length, 0)) },
						]}
					/>
					<ResultBlock title="Result" value={result.text} rows={20} fileName={fileName} />
				</>
			)}
			<p className={hintClassName}>
				Relations are emitted as comments next to the foreign-key column, because real Prisma or Mongoose relations need a field on both sides. Add those
				by hand once the models are in place.
			</p>
		</ToolPanel>
	);
};
