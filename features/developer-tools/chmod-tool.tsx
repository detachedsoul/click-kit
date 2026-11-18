"use client";

import { useMemo, useState } from "react";
import {
	permissionsFromOctal,
	permissionsFromSymbolic,
	type Bit,
	type PermissionClass,
} from "@/features/developer-tools/chmod-utils";
import { ErrorNote, ResultBlock, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const classes: { id: PermissionClass; label: string }[] = [
	{ id: "user", label: "Owner" },
	{ id: "group", label: "Group" },
	{ id: "other", label: "Others" },
];

const actions: { key: keyof Bit; label: string; value: number }[] = [
	{ key: "read", label: "read", value: 4 },
	{ key: "write", label: "write", value: 2 },
	{ key: "execute", label: "execute", value: 1 },
];

export const ChmodTool = () => {
	const [octal, setOctal] = useState("755");
	const [symbolic, setSymbolic] = useState("");
	const permissions = useMemo(() => {
		try {
			const fourDigit = octal.trim().padStart(4, "0");
			const special = {
				setuid: Number(fourDigit[0]) >= 4,
				setgid: [2, 3, 6, 7].includes(Number(fourDigit[0])),
				sticky: [1, 3, 5, 7].includes(Number(fourDigit[0])),
			};
			const result = permissionsFromOctal(octal);
			return { result, special, error: "" };
		} catch (error) {
			return { result: null, special: null, error: error instanceof Error ? error.message : "Could not read this mode." };
		}
	}, [octal]);
	const symbolicResult = useMemo(() => {
		if (!symbolic.trim()) return { error: "" };
		try {
			return { parsed: permissionsFromSymbolic(symbolic), error: "" };
		} catch (error) {
			return { error: error instanceof Error ? error.message : "Could not read this symbolic mode." };
		}
	}, [symbolic]);
	const toggle = (target: PermissionClass, key: keyof Bit) => {
		if (!permissions.result) return;
		const current = permissions.result[target];
		const next = { ...current, [key]: !current[key] };
		const special = permissions.result.special;
		const specialDigit = (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0);
		const bits = { ...permissions.result, [target]: next };
		const value = (bit: Bit) => (bit.read ? 4 : 0) + (bit.write ? 2 : 0) + (bit.execute ? 1 : 0);
		setOctal(`${specialDigit === 0 ? "" : specialDigit}${value(bits.user)}${value(bits.group)}${value(bits.other)}`);
	};
	return (
		<ToolPanel>
			<label className={`${labelClassName} max-w-[220px]`} htmlFor="chmod-octal">
				Octal mode
				<input
					className={`${fieldClassName} font-mono`}
					id="chmod-octal"
					value={octal}
					onChange={(event) => setOctal(event.target.value)}
					placeholder="755"
					inputMode="numeric"
				/>
			</label>
			<ErrorNote message={permissions.error} />
			{permissions.result && (
				<>
					<fieldset className="m-0 border-0 p-0">
						<legend className={labelClassName}>Toggle permission bits</legend>
						<div className="mt-3 grid gap-3">
							{classes.map(({ id, label }) => (
								<div className="flex flex-wrap items-center gap-4" key={id}>
									<span className="w-20 text-xs text-[#4a4c43]">{label}</span>
									{actions.map((action) => (
										<label className="flex cursor-pointer items-center gap-2 text-xs text-ink" key={action.key}>
											<input
												className="size-4 cursor-pointer accent-[#42584d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
												type="checkbox"
												checked={permissions.result![id][action.key]}
												onChange={() => toggle(id, action.key)}
											/>
											{action.label}
											<span className="font-mono text-[10px] text-muted">({action.value})</span>
										</label>
									))}
								</div>
							))}
						</div>
					</fieldset>
					<ResultBlock title="chmod command" value={permissions.result.command} rows={3} />
					<ResultBlock title="Permission breakdown" value={permissions.result.summary.join("\n")} rows={6} />
				</>
			)}
			<div className="border-t border-line pt-[18px]">
				<label className={labelClassName} htmlFor="chmod-symbolic">
					Decode a symbolic mode
				</label>
				<input
					className={`${fieldClassName} font-mono`}
					id="chmod-symbolic"
					value={symbolic}
					onChange={(event) => setSymbolic(event.target.value)}
					placeholder="rwxr-xr-x"
					spellCheck={false}
				/>
				{symbolicResult.error ? (
					<div className="mt-2">
						<ErrorNote message={symbolicResult.error} />
					</div>
				) : symbolicResult.parsed ? (
					<p className="m-0 mt-2 font-mono text-xs text-[#3e4139]">
						{symbolicResult.parsed.symbolic} = {symbolicResult.parsed.octal} → {symbolicResult.parsed.command}
					</p>
				) : (
					<p className={`${hintClassName} mt-2`}>Paste rwxr-xr-x to see its octal equivalent and command.</p>
				)}
			</div>
			<p className={hintClassName}>Special bits follow standard Unix layout: 4 setuid, 2 setgid, 1 sticky, placed before the three class digits.</p>
		</ToolPanel>
	);
};
