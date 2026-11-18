"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { applyCipher, bruteForceCaesar, caesarToText, type CipherMode } from "@/features/text-tools/cipher-utils";
import { CheckboxField, CheckboxRow, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = "Meet me at the harbour — the plan stands.";

export const CipherTool = () => {
	const [source, setSource] = useState(sample);
	const [mode, setMode] = useState<CipherMode>("caesar");
	const [shift, setShift] = useState(3);
	const [decode, setDecode] = useState(false);
	const [bruteForce, setBruteForce] = useState(false);
	// Brute force is a Caesar-only view: switching cipher must not silently keep it on.
	const bruteForcing = bruteForce && mode === "caesar";
	const result = useMemo(() => {
		try {
			if (bruteForcing) return { text: caesarToText(bruteForceCaesar(source)), error: "" };
			return { text: applyCipher(source, mode, shift, decode), error: "" };
		} catch (error) {
			return { text: "", error: error instanceof Error ? error.message : "Could not transform this text." };
		}
	}, [source, mode, shift, decode, bruteForcing]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="cipher-mode">
					Cipher
					<select
						className={selectClassName}
						id="cipher-mode"
						value={mode}
						onChange={(event) => {
							const next = event.target.value as CipherMode;
							setMode(next);
							if (next !== "caesar") {
								setBruteForce(false);
								setDecode(false);
							}
						}}
					>
						<option value="caesar">Caesar shift</option>
						<option value="rot13">ROT13</option>
						<option value="atbash">Atbash (A↔Z)</option>
						<option value="rot47">ROT47 (ASCII 33–126)</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="cipher-shift">
					Shift
					<input
						className={fieldClassName}
						disabled={mode !== "caesar"}
						id="cipher-shift"
						max={25}
						min={1}
						onChange={(event) => setShift(Number(event.target.value))}
						type="number"
						value={shift}
					/>
				</label>
			</div>
			<CheckboxRow>
				<CheckboxField checked={decode} disabled={mode !== "caesar"} id="cipher-decode" label={<>Decode instead of encode</>} onChange={setDecode} />
				<CheckboxField checked={bruteForcing} disabled={mode !== "caesar"} id="cipher-brute" label={<>Brute force all 25 shifts</>} onChange={setBruteForce} />
			</CheckboxRow>
			{mode !== "caesar" ? (
				<p className={hintClassName}>
					Shift, decoding, and brute force belong to the Caesar cipher. ROT13, Atbash, and ROT47 are their own inverse, so the same operation both
					encodes and decodes.
				</p>
			) : null}
			<TextAreaField id="cipher-input" label="Your text" value={source} onChange={setSource} placeholder="Paste text to encode or decode." rows={8} />
			<ErrorNote message={result.error} />
			{result.text && <ResultBlock title="Result" value={result.text} rows={bruteForcing ? 20 : 8} fileName={bruteForcing ? "caesar-shifts.txt" : "cipher.txt"} />}
			<p className={hintClassName}>
				Caesar and ROT13 only touch letters, keeping case and punctuation. ROT47 shifts printable ASCII, which covers digits and symbols too. These
				ciphers are for puzzles and obfuscation, never for protecting secrets.
			</p>
		</ToolPanel>
	);
};
