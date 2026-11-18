"use client";

import { useMemo, useState } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { CheckboxField } from "@/features/developer-tools/tool-ui";
import {
	calculateContrast,
	compareJson,
	parseEnvFile,
	previewCronSchedule,
	jsonToYaml,
	yamlToJson,
} from "@/features/developer-tools/extra-tools-utils";

const ToolLayout = ({ children }: { children: React.ReactNode }) => (
	<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		{children}
	</div>
);

const ResultPanel = ({ title, value, rows = 9 }: { title: string; value: string; rows?: number }) => (
	<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
		<div className="flex items-center justify-between gap-3">
			<h2 className="m-0 text-sm font-semibold">{title}</h2>
			<CopyTextButton text={value} />
		</div>
		<TextAreaField
			id={`${title.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-output`}
			label="Result"
			value={value}
			onChange={() => undefined}
			placeholder="Your result will appear here."
			rows={rows}
			readOnly
		/>
	</section>
);

const inputClassName =
	"block h-11 w-full border border-[#d9d7cd] bg-surface px-3 text-sm text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent";

export const JsonDiffTool = () => {
	const [left, setLeft] = useState('{\n  "name": "ClickKit",\n  "version": 1,\n  "tags": ["tools"]\n}');
	const [right, setRight] = useState(
		'{\n  "name": "ClickKit",\n  "version": 2,\n  "active": true,\n  "tags": ["tools", "local"]\n}',
	);
	const comparison = useMemo(() => {
		try {
			return { differences: compareJson(left, right), error: "" };
		} catch (error) {
			return {
				differences: [],
				error: error instanceof Error ? error.message : "Could not compare these JSON values.",
			};
		}
	}, [left, right]);
	const output = JSON.stringify(comparison.differences, null, 2);
	return (
		<ToolLayout>
			<div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
				<TextAreaField
					id="json-diff-left"
					label="Original JSON"
					value={left}
					onChange={setLeft}
					placeholder="Paste the original JSON…"
					rows={11}
				/>
				<TextAreaField
					id="json-diff-right"
					label="Updated JSON"
					value={right}
					onChange={setRight}
					placeholder="Paste the updated JSON…"
					rows={11}
				/>
			</div>
			{comparison.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{comparison.error}
				</p>
			) : (
				<>
					<p className="m-0 text-xs text-muted" role="status">
						{comparison.differences.length === 0
							? "The JSON values are structurally identical."
							: `${comparison.differences.length} difference${comparison.differences.length === 1 ? "" : "s"} found. Paths point to changed values.`}
					</p>
					<ResultPanel title="Structured differences" value={output} />
				</>
			)}
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Compares parsed values, so object key order and whitespace do not count as changes. Array positions are
				compared by index.
			</p>
		</ToolLayout>
	);
};

export const YamlJsonTool = () => {
	const [direction, setDirection] = useState<"yaml-to-json" | "json-to-yaml">("yaml-to-json");
	const [source, setSource] = useState("name: ClickKit\nactive: true\nfeatures:\n  - format\n  - validate");
	const result = useMemo(() => {
		try {
			return {
				output: direction === "yaml-to-json" ? yamlToJson(source) : jsonToYaml(source),
				error: "",
			};
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this document." };
		}
	}, [direction, source]);
	const updateDirection = (next: "yaml-to-json" | "json-to-yaml") => {
		setDirection(next);
		setSource(
			next === "yaml-to-json"
				? "name: ClickKit\nactive: true\nfeatures:\n  - format\n  - validate"
				: '{\n  "name": "ClickKit",\n  "active": true,\n  "features": ["format", "validate"]\n}',
		);
	};
	return (
		<ToolLayout>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Conversion direction">
				{(["yaml-to-json", "json-to-yaml"] as const).map((item) => (
					<button
						className={`min-h-9 cursor-pointer border px-3 text-xs ${direction === item ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`}
						key={item}
						type="button"
						aria-pressed={direction === item}
						onClick={() => updateDirection(item)}
					>
						{item === "yaml-to-json" ? "YAML to JSON" : "JSON to YAML"}
					</button>
				))}
			</div>
			<TextAreaField
				id="yaml-json-input"
				label={direction === "yaml-to-json" ? "YAML input" : "JSON input"}
				value={source}
				onChange={setSource}
				placeholder={direction === "yaml-to-json" ? "Paste YAML…" : "Paste JSON…"}
				rows={12}
				hint="Conversion runs in your browser. YAML custom tags are not evaluated; only JSON-compatible data is converted."
			/>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				<ResultPanel
					title={direction === "yaml-to-json" ? "Converted JSON" : "Converted YAML"}
					value={result.output}
				/>
			)}
		</ToolLayout>
	);
};

export const CronExplainerTool = () => {
	const [expression, setExpression] = useState("*/15 * * * *");
	const [timezone, setTimezone] = useState("UTC");
	const preview = useMemo(() => {
		try {
			return { schedule: previewCronSchedule(expression, timezone), error: "" };
		} catch (error) {
			return { schedule: null, error: error instanceof Error ? error.message : "Could not parse this schedule." };
		}
	}, [expression, timezone]);
	return (
		<ToolLayout>
			<div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,.55fr)] gap-4 max-[620px]:grid-cols-1">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="cron-expression">
					Cron expression
					<input
						className={`${inputClassName} mt-2 font-mono`}
						id="cron-expression"
						value={expression}
						onChange={(event) => setExpression(event.target.value)}
						placeholder="*/15 * * * *"
					/>
				</label>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="cron-timezone">
					IANA time zone
					<input
						className={`${inputClassName} mt-2`}
						id="cron-timezone"
						value={timezone}
						onChange={(event) => setTimezone(event.target.value)}
						placeholder="Africa/Lagos"
					/>
				</label>
			</div>
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Accepts standard five-field cron schedules or six fields with seconds. When both day fields are
				constrained, either match qualifies. Times below are shown in the selected zone.
			</p>
			{preview.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{preview.error}
				</p>
			) : (
				preview.schedule && (
					<div className="flex flex-col gap-4">
						<section className="flex flex-col gap-2 border-t border-line pt-[18px]">
							<h2 className="m-0 text-sm font-semibold">Schedule summary</h2>
							<p className="m-0 font-mono text-xs leading-relaxed text-ink">
								{preview.schedule.description}
							</p>
							<p className="m-0 text-[11px] text-muted">Normalized: {preview.schedule.expression}</p>
						</section>
						<section aria-labelledby="cron-next-runs">
							<h2 className="mb-3 mt-0 text-sm font-semibold" id="cron-next-runs">
								Next five runs
							</h2>
							<ol className="m-0 grid list-decimal gap-2 pl-5 text-xs">
								{preview.schedule.nextRuns.map((run) => (
									<li className="font-mono" key={run}>
										{new Intl.DateTimeFormat("en-GB", {
											year: "numeric",
											month: "short",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
											hour12: false,
											timeZone: timezone,
											timeZoneName: "short",
										}).format(new Date(run))}
									</li>
								))}
							</ol>
						</section>
					</div>
				)
			)}
		</ToolLayout>
	);
};

export const EnvValidatorTool = () => {
	const [source, setSource] = useState(
		"# Local app settings\nAPP_NAME=ClickKit\nAPI_TOKEN=replace-me\nexport DEBUG=true",
	);
	const [maskValues, setMaskValues] = useState(true);
	const result = useMemo(() => {
		try {
			return { parsed: parseEnvFile(source), error: "" };
		} catch (error) {
			return {
				parsed: null,
				error: error instanceof Error ? error.message : "Could not parse these .env contents.",
			};
		}
	}, [source]);
	const output = result.parsed
		? result.parsed.variables
				.map(({ name, value }) => `${name}=${maskValues && value ? "••••••" : value}`)
				.join("\n")
		: "";
	return (
		<ToolLayout>
			<TextAreaField
				id="env-input"
				label=".env contents"
				value={source}
				onChange={setSource}
				placeholder="KEY=value"
				rows={12}
				hint="Parsed locally only. Variable values are masked by default; this tool never executes shell code or expands variables."
			/>
			<CheckboxField checked={maskValues} id="env-mask-values" label={<>Mask values in results</>} onChange={setMaskValues} />
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				result.parsed && (
					<div className="flex flex-col gap-3">
						<p className="m-0 text-xs text-muted" role="status">
							{result.parsed.variables.length} variable{result.parsed.variables.length === 1 ? "" : "s"}{" "}
							parsed
							{result.parsed.errors.length > 0 &&
								` · ${result.parsed.errors.length} invalid line${result.parsed.errors.length === 1 ? "" : "s"}`}
							{result.parsed.duplicates.length > 0 &&
								` · duplicate keys: ${result.parsed.duplicates.join(", ")}`}
						</p>
						{result.parsed.errors.length > 0 && (
							<ul
								className="m-0 list-disc pl-5 text-xs text-[#8a3f30]"
								aria-label=".env parse errors"
								role="alert"
							>
								{result.parsed.errors.map((item) => (
									<li key={`${item.line}-${item.message}`}>
										Line {item.line}: {item.message}
									</li>
								))}
							</ul>
						)}
						<ResultPanel
							title={maskValues ? "Parsed variables (masked)" : "Parsed variables"}
							value={output}
							rows={8}
						/>
					</div>
				)
			)}
		</ToolLayout>
	);
};

export const ColorContrastTool = () => {
	const [foreground, setForeground] = useState("#1a1a1a");
	const [background, setBackground] = useState("#ffffff");
	const result = useMemo(() => {
		try {
			return { contrast: calculateContrast(foreground, background), error: "" };
		} catch (error) {
			return { contrast: null, error: error instanceof Error ? error.message : "Could not calculate contrast." };
		}
	}, [foreground, background]);
	return (
		<ToolLayout>
			<div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="contrast-foreground">
					Text color
					<input
						className={`${inputClassName} mt-2 font-mono`}
						id="contrast-foreground"
						value={foreground}
						onChange={(event) => setForeground(event.target.value)}
						placeholder="#1a1a1a"
					/>
				</label>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="contrast-background">
					Background color
					<input
						className={`${inputClassName} mt-2 font-mono`}
						id="contrast-background"
						value={background}
						onChange={(event) => setBackground(event.target.value)}
						placeholder="#ffffff"
					/>
				</label>
			</div>
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Supports HEX, RGB, and HSL formats. Semi-transparent colors are composited over white before calculating
				WCAG 2 contrast.
			</p>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				result.contrast && (
					<div className="flex flex-col gap-4">
						<div
							className="flex min-h-28 flex-col items-center justify-center gap-2 border border-line p-5 text-center"
							style={{ color: result.contrast.foreground, backgroundColor: result.contrast.background }}
						>
							<span className="text-lg font-semibold">Sample text</span>
							<span className="text-xs">The quick brown fox jumps over the lazy dog.</span>
						</div>
						<p className="m-0 text-center font-mono text-2xl font-semibold" role="status">
							{result.contrast.ratio.toFixed(2)}:1 contrast ratio
						</p>
						<dl
							className="m-0 grid grid-cols-2 gap-3 text-xs max-[520px]:grid-cols-1"
							aria-label="WCAG contrast results"
						>
							{(
								[
									["AA normal text", result.contrast.aaNormal],
									["AA large text", result.contrast.aaLarge],
									["AAA normal text", result.contrast.aaaNormal],
									["AAA large text", result.contrast.aaaLarge],
								] as const
							).map(([label, passes]) => (
								<div
									className="flex items-center justify-between gap-2 border border-line px-3 py-2"
									key={label}
								>
									<dt>{label}</dt>
									<dd className={`m-0 font-semibold ${passes ? "text-[#315e43]" : "text-[#8a3028]"}`}>
										{passes ? "Pass" : "Fail"}
									</dd>
								</div>
							))}
						</dl>
					</div>
				)
			)}
		</ToolLayout>
	);
};
