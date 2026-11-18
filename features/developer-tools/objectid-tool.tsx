"use client";

import { useMemo, useState } from "react";
import { describeAge, generateObjectId, parseObjectId } from "@/features/developer-tools/objectid-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, primaryButtonClassName } from "@/features/developer-tools/tool-ui";

const sample = "507f1f77bcf86cd799439011";

export const ObjectIdTool = () => {
	const [source, setSource] = useState(sample);
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
	const parsed = useMemo(() => {
		try {
			const info = parseObjectId(source);
			return { info, error: "", age: describeAge(info.timestamp) };
		} catch (error) {
			return { info: null, error: error instanceof Error ? error.message : "Could not read this ObjectId.", age: "" };
		}
	}, [source]);
	const generated = useMemo(() => {
		try {
			const value = generateObjectId(new Date(date));
			return { value, error: "" };
		} catch (error) {
			return { value: "", error: error instanceof Error ? error.message : "Could not generate an ObjectId." };
		}
	}, [date]);
	return (
		<ToolPanel>
			<label className={labelClassName} htmlFor="objectid-input">
				MongoDB ObjectId
				<input className={`${fieldClassName} font-mono`} id="objectid-input" onChange={(event) => setSource(event.target.value)} placeholder={sample} value={source} />
			</label>
			<ErrorNote message={parsed.error} />
			{parsed.info && (
				<>
					<StatGrid
						items={[
							{ label: "Created", value: parsed.info.timestamp.toISOString().replace("T", " ").slice(0, 19) },
							{ label: "Age", value: parsed.age },
							{ label: "Session counter", value: String(parsed.info.counter) },
							{ label: "Random part", value: parsed.info.random },
						]}
					/>
					<ResultBlock
						title="Decoded"
						value={[
							`hex          ${parsed.info.hex}`,
							`timestamp    ${parsed.info.timestamp.toISOString()}`,
							`unix seconds ${Math.floor(parsed.info.timestamp.getTime() / 1000)}`,
							`random       ${parsed.info.random} (5-byte process value)`,
							`counter      ${parsed.info.counter.toString(16).padStart(6, "0")} (${parsed.info.counter})`,
							`mongo syntax ${parsed.info.canonical}`,
						].join("\n")}
						rows={7}
						fileName="objectid.txt"
					/>
				</>
			)}
			<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
				<h2 className="m-0 text-sm font-semibold">Generate an ObjectId for a moment in time</h2>
				<div className="flex flex-wrap items-end gap-3">
					<label className={labelClassName} htmlFor="objectid-date">
						Timestamp
						<input className={fieldClassName} id="objectid-date" onChange={(event) => setDate(event.target.value)} type="datetime-local" value={date} />
					</label>
					<button className={primaryButtonClassName} onClick={() => setSource(generated.value || source)} type="button">
						Use this id
					</button>
				</div>
				<ErrorNote message={generated.error} />
				{generated.value && <p className="m-0 font-mono text-sm text-ink">{generated.value}</p>}
				<p className={hintClassName}>
					The first 4 bytes are a Unix timestamp, so any ObjectId reveals when it was created. The remaining bytes are random per process and a
					counter, not a machine or user identifier.
				</p>
			</section>
		</ToolPanel>
	);
};
