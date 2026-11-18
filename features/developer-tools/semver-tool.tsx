"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import type { ReleaseType } from "semver";
import { bumpVersion, checkRange, compareVersions, sortVersions } from "@/features/developer-tools/semver-utils";
import {
	ErrorNote,
	ResultBlock,
	SegmentedControl,
	StatGrid,
	ToolPanel,
	fieldClassName,
	hintClassName,
	labelClassName,
	selectClassName,
} from "@/features/developer-tools/tool-ui";

type Mode = "compare" | "range" | "increment" | "sort";

const releases: ReleaseType[] = ["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease"];

export const SemverTool = () => {
	const [mode, setMode] = useState<Mode>("compare");
	const [left, setLeft] = useState("1.4.2");
	const [right, setRight] = useState("1.5.0");
	const [range, setRange] = useState("^1.4.0");
	const [release, setRelease] = useState<ReleaseType>("minor");
	const [list, setList] = useState("1.10.0\n1.2.3\n2.0.0-beta.1\n1.2.3-alpha\nnot-a-version");

	const output = useMemo(() => {
		try {
			if (mode === "compare") {
				const result = compareVersions(left, right);
				return {
					error: "",
					stats: [
						{ label: "Result", value: `${result.left} is ${result.relation} ${result.right}` },
						{ label: "Difference", value: result.difference },
						{ label: "Major mismatch", value: result.majorAhead === null ? "No" : result.majorAhead ? "Yes — left ahead" : "Yes — right ahead" },
					],
					text: "",
					title: "",
				};
			}
			if (mode === "range") {
				const result = checkRange(left, range);
				return {
					error: "",
					stats: [
						{ label: "Satisfies range", value: result.satisfies ? "Yes" : "No" },
						{ label: "Normalized range", value: result.normalizedRange },
						{ label: "Lowest allowed", value: result.minimum },
					],
					text: "",
					title: "",
				};
			}
			if (mode === "increment") {
				const result = bumpVersion(left, release);
				return {
					error: "",
					stats: [
						{ label: "Previous", value: result.previous },
						{ label: `After ${result.release} bump`, value: result.next },
						{ label: "Difference", value: result.difference },
					],
					text: result.next,
					title: "Next version",
				};
			}
			const result = sortVersions(list);
			return {
				error: "",
				stats: [
					{ label: "Valid versions", value: String(result.count) },
					{ label: "Latest", value: result.latest },
					{ label: "Invalid lines", value: result.invalid.length === 0 ? "None" : String(result.invalid.length) },
				],
				text: `${result.ascending}\n\n--- descending ---\n${result.descending}${result.invalid.length ? `\n\n--- ignored ---\n${result.invalid.join("\n")}` : ""}`,
				title: "Sorted versions",
			};
		} catch (error) {
			return { error: error instanceof Error ? error.message : "Could not evaluate these versions.", stats: [], text: "", title: "" };
		}
	}, [mode, left, right, range, release, list]);

	return (
		<ToolPanel>
			<SegmentedControl<Mode>
				label="Semver mode"
				options={[
					{ id: "compare", label: "Compare" },
					{ id: "range", label: "Range check" },
					{ id: "increment", label: "Bump" },
					{ id: "sort", label: "Sort list" },
				]}
				value={mode}
				onChange={setMode}
			/>
			{mode === "sort" ? (
				<TextAreaField
					id="semver-list"
					label="Versions (one per line or comma separated)"
					value={list}
					onChange={setList}
					placeholder={"1.2.3\n2.0.0-rc.1"}
					rows={10}
				/>
			) : (
				<div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-1">
					<label className={labelClassName} htmlFor="semver-left">
						{mode === "range" ? "Version" : "First version"}
						<input className={fieldClassName} id="semver-left" value={left} onChange={(event) => setLeft(event.target.value)} placeholder="1.4.2" />
					</label>
					{mode === "compare" && (
						<label className={labelClassName} htmlFor="semver-right">
							Second version
							<input className={fieldClassName} id="semver-right" value={right} onChange={(event) => setRight(event.target.value)} placeholder="1.5.0" />
						</label>
					)}
					{mode === "range" && (
						<label className={labelClassName} htmlFor="semver-range">
							Range
							<input className={fieldClassName} id="semver-range" value={range} onChange={(event) => setRange(event.target.value)} placeholder="^1.4.0" />
						</label>
					)}
					{mode === "increment" && (
						<div>
							<label className={labelClassName} htmlFor="semver-release">
								Release type
							</label>
							<SelectField
								className={selectClassName}
								containerClassName="mt-2"
								id="semver-release"
								value={release}
								onChange={(event) => setRelease(event.target.value as ReleaseType)}
							>
								{releases.map((item) => (
									<option key={item} value={item}>
										{item}
									</option>
								))}
							</SelectField>
						</div>
					)}
				</div>
			)}
			<ErrorNote message={output.error} />
			{!output.error && (
				<>
					<StatGrid items={output.stats} />
					{output.text && <ResultBlock title={output.title} value={output.text} rows={10} />}
				</>
			)}
			<p className={hintClassName}>
				Follows semver 2.0.0 precedence: build metadata is ignored, prerelease versions sort before their release, and ranges support operators,
				tildes, carets, x-ranges, and hyphen ranges.
			</p>
		</ToolPanel>
	);
};
