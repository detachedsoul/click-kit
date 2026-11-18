"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { applyCipher, bruteForceCaesar, caesarToText, type CipherMode } from "@/features/text-tools/cipher-utils";
import { ErrorNote, ResultBlock, ToolPanel, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = "Meet me at the harbour — the plan stands.";

export const CipherTool = () => {
	const [source, setSource] = useState(sample);
	const [mode, setMode] = useState<CipherMode>("caesar");
	const [shift, setShift] = useState(3);
	const [decode, setDecode] = useState(false);
	const [bruteForce, setBruteForce] = useState(false);
	const result = useMemo(() => {
		try {
			if (bruteForce) return { text: caesarToText(bruteForceCaesar(source)), error: "" };
			return { text: applyCipher(source, mode, shift, decode), error: "" };
		} catch (error) {
			return { text: "", error: error instanceof Error ? error.message : "Could not transform this text." };
		}
	}, [source, mode, shift, decode, bruteForce]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label className={labelClassName} htmlFor="cipher-mode">
					Cipher
					<select className={selectClassName} id="cipher-mode" onChange={(event) => setMode(event.target.value as CipherMode)} value={mode}>
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
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="cipher-decode">
					<input checked={decode} disabled={mode !== "caesar"} id="cipher-decode" onChange={(event) => setDecode(event.target.checked)} type="checkbox" />
					Decode instead of encode
				</label>
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="cipher-brute">
					<input checked={bruteForce} id="cipher-brute" onChange={(event) => setBruteForce(event.target.checked)} type="checkbox" />
					Brute force all 25 shifts
				</label>
			</div>
			<TextAreaField id="cipher-input" label="Your text" value={source} onChange={setSource} placeholder="Paste text to encode or decode." rows={8} />
			<ErrorNote message={result.error} />
			{result.text && <ResultBlock title="Result" value={result.text} rows={bruteForce ? 20 : 8} fileName={bruteForce ? "caesar-shifts.txt" : "cipher.txt"} />}
			<p className={hintClassName}>
				Caesar and ROT13 only touch letters, keeping case and punctuation. ROT47 shifts printable ASCII, which covers digits and symbols too. These
				ciphers are for puzzles and obfuscation, never for protecting secrets.
			</p>
		</ToolPanel>
	);
};
