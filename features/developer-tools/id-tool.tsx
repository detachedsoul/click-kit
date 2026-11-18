"use client";

import { useMemo, useState } from "react";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { generateNanoId, generateUlid, inspectUuid, parseUlid } from "@/features/developer-tools/id-utils";
import {
	ErrorNote,
	ResultBlock,
	SegmentedControl,
	StatGrid,
	ToolPanel,
	fieldClassName,
	hintClassName,
	labelClassName,
	primaryButtonClassName,
} from "@/features/developer-tools/tool-ui";

type Mode = "uuid" | "ulid" | "nanoid";

export const IdToolkitTool = () => {
	const [mode, setMode] = useState<Mode>("uuid");
	const [uuid, setUuid] = useState("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
	const [ulid, setUlid] = useState("01HZX8N5R3K8ZQ2W7YV4T6B9C0");
	const [nanoSize, setNanoSize] = useState("21");
	const [nanoAlphabet, setNanoAlphabet] = useState("");

	const uuidResult = useMemo(() => {
		if (mode !== "uuid") return { data: null, error: "" };
		try {
			return { data: inspectUuid(uuid), error: "" };
		} catch (error) {
			return { data: null, error: error instanceof Error ? error.message : "Could not read this UUID." };
		}
	}, [mode, uuid]);

	const ulidResult = useMemo(() => {
		if (mode !== "ulid") return { parsed: null, error: "" };
		try {
			return { parsed: parseUlid(ulid), error: "" };
		} catch (error) {
			return { parsed: null, error: error instanceof Error ? error.message : "Could not read this ULID." };
		}
	}, [mode, ulid]);

	const nanoResult = useMemo(() => {
		if (mode !== "nanoid") return { value: "", error: "" };
		try {
			return { value: generateNanoId(Number(nanoSize), nanoAlphabet.trim() || undefined), error: "" };
		} catch (error) {
			return { value: "", error: error instanceof Error ? error.message : "Could not generate a NanoID." };
		}
	}, [mode, nanoSize, nanoAlphabet]);

	const [freshUlid, setFreshUlid] = useState("");
	const [freshNano, setFreshNano] = useState("");
	const [generateError, setGenerateError] = useState("");

	const generate = (kind: "ulid" | "nanoid") => {
		try {
			setGenerateError("");
			if (kind === "ulid") {
				const value = generateUlid().ulid;
				setFreshUlid(value);
				setUlid(value);
			} else {
				const value = generateNanoId(Number(nanoSize), nanoAlphabet.trim() || undefined);
				setFreshNano(value);
			}
		} catch (error) {
			setGenerateError(error instanceof Error ? error.message : "Could not generate an identifier.");
		}
	};

	return (
		<ToolPanel>
			<SegmentedControl<Mode>
				label="Identifier type"
				options={[
					{ id: "uuid", label: "UUID inspector" },
					{ id: "ulid", label: "ULID" },
					{ id: "nanoid", label: "NanoID" },
				]}
				value={mode}
				onChange={setMode}
			/>
			{mode === "uuid" && (
				<>
					<label className={labelClassName} htmlFor="uuid-input">
						UUID
						<input
							className={`${fieldClassName} font-mono`}
							id="uuid-input"
							value={uuid}
							onChange={(event) => setUuid(event.target.value)}
							placeholder="3f2504e0-4f89-41d3-9a0c-0305e82c3301"
							spellCheck={false}
						/>
					</label>
					<ErrorNote message={uuidResult.error} />
					{uuidResult.data && (
						<>
							<StatGrid
								items={[
									{ label: "Version", value: uuidResult.data.version },
									{ label: "Variant", value: uuidResult.data.variant },
									{ label: "Timestamp", value: uuidResult.data.timestamp },
									{ label: "Payload", value: uuidResult.data.randomness },
								]}
							/>
							{uuidResult.data.note && <p className={hintClassName}>{uuidResult.data.note}</p>}
						</>
					)}
				</>
			)}
			{mode === "ulid" && (
				<>
					<div className="flex flex-wrap items-end gap-3">
						<label className={`${labelClassName} min-w-0 flex-1`} htmlFor="ulid-input">
							ULID
							<input
								className={`${fieldClassName} font-mono`}
								id="ulid-input"
								value={ulid}
								onChange={(event) => setUlid(event.target.value)}
								placeholder="01HZX8N5R3K8ZQ2W7YV4T6B9C0"
								spellCheck={false}
							/>
						</label>
						<button className={primaryButtonClassName} type="button" onClick={() => generate("ulid")}>
							Generate now
						</button>
					</div>
					<ErrorNote message={ulidResult.error || generateError} />
					{ulidResult.parsed && (
						<StatGrid
							items={[
								{ label: "Timestamp", value: ulidResult.parsed.timestamp },
								{ label: "Unix milliseconds", value: ulidResult.parsed.milliseconds },
								{ label: "Randomness", value: ulidResult.parsed.randomness },
								{ label: "Length", value: `${ulidResult.parsed.ulid.length} characters` },
							]}
						/>
					)}
					{freshUlid && <ResultBlock title="New ULID" value={freshUlid} rows={2} />}
				</>
			)}
			{mode === "nanoid" && (
				<>
					<div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
						<label className={labelClassName} htmlFor="nanoid-size">
							Length
							<input
								className={fieldClassName}
								id="nanoid-size"
								value={nanoSize}
								onChange={(event) => setNanoSize(event.target.value)}
								inputMode="numeric"
							/>
						</label>
						<label className={labelClassName} htmlFor="nanoid-alphabet">
							Custom alphabet (optional)
							<input
								className={`${fieldClassName} font-mono`}
								id="nanoid-alphabet"
								value={nanoAlphabet}
								onChange={(event) => setNanoAlphabet(event.target.value)}
								placeholder="Default URL-safe alphabet"
								spellCheck={false}
							/>
						</label>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<button className={primaryButtonClassName} type="button" onClick={() => generate("nanoid")}>
							Generate new
						</button>
						<CopyTextButton text={freshNano || nanoResult.value} />
					</div>
					<ErrorNote message={nanoResult.error || generateError} />
					{!nanoResult.error && <ResultBlock title="NanoID" value={freshNano || nanoResult.value} rows={2} />}
					<p className={hintClassName}>Uses cryptographically secure randomness with rejection-free sampling for uniform characters.</p>
				</>
			)}
		</ToolPanel>
	);
};
