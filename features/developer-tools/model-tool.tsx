"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { parseModel, toMongoose, toPrisma } from "@/features/developer-tools/model-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `{
  "id": "3f2b8c1e-1d6a-4b0e-9f2c-5d7a1b2c3d4e",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "age": 36,
  "balance": 129.5,
  "active": true,
  "joinedAt": "2024-03-01T09:30:00Z",
  "address": { "city": "London", "postcode": "N1 9GU" },
  "tags": ["founder", "engineer"],
  "preferences": { "theme": "dark", "digest": "weekly" },
  "deletedAt": null
}`;

type Target = "mongoose" | "prisma";

export const ModelTool = () => {
	const [source, setSource] = useState(sample);
	const [name, setName] = useState("User");
	const [target, setTarget] = useState<Target>("mongoose");
	const [timestamps, setTimestamps] = useState(true);
	const [strict, setStrict] = useState(true);
	const [addId, setAddId] = useState(true);
	const [nullableOptional, setNullableOptional] = useState(true);
	const [mapTo, setMapTo] = useState("");
	const result = useMemo(() => {
		try {
			const model = parseModel(source, name);
			const text =
				target === "mongoose"
					? toMongoose(model, { timestamps, strictMode: strict })
					: toPrisma(model, { idField: addId, nullableOptional, mapTo });
			return { text, model, error: "" };
		} catch (error) {
			return { text: "", model: null, error: error instanceof Error ? error.message : "Could not build a model from this JSON." };
		}
	}, [source, name, target, timestamps, strict, addId, nullableOptional, mapTo]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="model-target">
					Output
					<select className={selectClassName} id="model-target" value={target} onChange={(event) => setTarget(event.target.value as Target)}>
						<option value="mongoose">Mongoose schema</option>
						<option value="prisma">Prisma model</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="model-name">
					Model name
					<input className={fieldClassName} id="model-name" value={name} onChange={(event) => setName(event.target.value)} />
				</label>
				{target === "mongoose" ? (
					<div className="flex flex-col gap-2">
						<CheckboxField checked={timestamps} id="model-timestamps" label={<>Add createdAt / updatedAt timestamps</>} onChange={setTimestamps} />
						<CheckboxField checked={strict} id="model-strict" label={<>Strict mode (reject unknown fields)</>} onChange={setStrict} />
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<CheckboxField checked={addId} id="model-id" label={<>Add an <code>id</code> field with <code>@id</code></>} onChange={setAddId} />
						<CheckboxField checked={nullableOptional} id="model-optional" label={<>Make nullable fields optional (<code>?</code>)</>} onChange={setNullableOptional} />
					</div>
				)}
				{target === "prisma" && (
					<label className={labelClassName} htmlFor="model-map">
						Map to table (optional)
						<input className={fieldClassName} id="model-map" value={mapTo} onChange={(event) => setMapTo(event.target.value)} placeholder="users" />
					</label>
				)}
			</div>
			<TextAreaField
				id="model-source"
				label="Sample JSON"
				value={source}
				onChange={setSource}
				placeholder='{"name": "Ada", "age": 36}'
				rows={14}
				hint="Paste an object or an array of objects: keys missing from some records become optional, ISO date strings become DateTime/Date, and mixed types fall back to Json/Mixed."
			/>
			<ErrorNote message={result.error} />
			{result.model && result.text && (
				<>
					<StatGrid
						items={[
							{ label: "Fields", value: String(result.model.fields.length) },
							{ label: "Optional", value: String(result.model.fields.filter((field) => field.optional).length) },
							{ label: "Nested objects", value: String(result.model.fields.filter((field) => field.kind === "object").length) },
						]}
					/>
					<ResultBlock
						title="Result"
						value={result.text}
						rows={20}
						fileName={target === "mongoose" ? `${name || "Model"}.model.js` : "schema.prisma"}
					/>
				</>
			)}
			<p className={hintClassName}>
				Generated code is a starting point: add indexes, validators, and relations by hand. Prisma relations need a second model, so references are
				emitted as plain scalar or Json fields.
			</p>
		</ToolPanel>
	);
};
