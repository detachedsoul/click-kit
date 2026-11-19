"use client";

import { useState } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { CHUNK_MODES, CHUNK_PRESETS, chunkSummary, chunkText, numberedChunks, type ChunkMode } from "@/features/text-tools/chunk-utils";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

export const ChunkTool = () => {
	const [text, setText] = useState("");
	const [limitInput, setLimitInput] = useState("280");
	const [mode, setMode] = useState<ChunkMode>("word");
	const [numbered, setNumbered] = useState(true);

	const limit = Number(limitInput);
	const result = (() => {
		try {
			const chunks = chunkText(text, limit, mode);
			return { chunks, error: "", summary: chunkSummary(chunks) };
		} catch (caught) {
			return { chunks: [], error: caught instanceof Error ? caught.message : "Could not split this text.", summary: chunkSummary([]) };
		}
	})();
	const activeMode = CHUNK_MODES.find((option) => option.id === mode);

	return (
		<ToolPanel>
			<TextAreaField
				hint="Paste an article, a thread, or a script. Nothing leaves the page."
				id="chunk-input"
				label="Text to split"
				onChange={setText}
				placeholder="Paste the text you need to break into pieces…"
				value={text}
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="chunk-limit">
					Characters per piece
					<input
						className={fieldClassName}
						id="chunk-limit"
						max={10000}
						min={1}
						onChange={(event) => setLimitInput(event.target.value)}
						type="number"
						value={limitInput}
					/>
				</label>
				<span className="flex flex-col justify-end gap-2">
					<span className={labelClassName}>Presets</span>
					<span className="flex flex-wrap gap-2">
						{CHUNK_PRESETS.map((preset) => (
							<button
								className="cursor-pointer border border-line bg-[#fbfaf7] px-2.5 py-1 text-[11px] hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								key={preset.label}
								onClick={() => setLimitInput(String(preset.limit))}
								type="button"
							>
								{preset.label}
							</button>
						))}
					</span>
				</span>
			</div>
			<SegmentedControl label="Break on" onChange={setMode} options={CHUNK_MODES.map((option) => ({ id: option.id, label: option.label }))} value={mode} />
			<p className={hintClassName}>{activeMode?.hint}</p>
			<label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink" htmlFor="chunk-number">
				<input
					checked={numbered}
					className="checkbox-input mt-0.5"
					id="chunk-number"
					onChange={(event) => setNumbered(event.target.checked)}
					type="checkbox"
				/>
				<span>Number each piece, so they can be posted in order</span>
			</label>
			<ErrorNote message={result.error} />
			{result.chunks.length > 0 ? (
				<>
					<StatGrid
						items={[
							{ label: "Pieces", value: String(result.summary.count) },
							{ label: "Longest", value: `${result.summary.longest} chars` },
							{ label: "Shortest", value: `${result.summary.shortest} chars` },
							{ label: "Total", value: `${result.summary.total} chars` },
						]}
					/>
					<ol className="m-0 flex list-none flex-col gap-2 p-0">
						{result.chunks.map((chunk, index) => (
							<li className="border border-line bg-[#fbfaf7] px-3 py-2.5" key={`${index}-${chunk.slice(0, 12)}`}>
								<div className="mb-1.5 flex items-center justify-between gap-3">
									<span className="font-mono text-[10px] uppercase tracking-[.06em] text-[#5f6259]">
										{index + 1} of {result.chunks.length} · {Array.from(chunk).length} chars
									</span>
									<CopyTextButton text={chunk} />
								</div>
								<p className="m-0 whitespace-pre-wrap break-words text-xs leading-[1.65] text-ink">{chunk}</p>
							</li>
						))}
					</ol>
					<ResultBlock
						fileName="chunks.txt"
						rows={12}
						title={numbered ? "Numbered pieces" : "All pieces"}
						value={numbered ? numberedChunks(result.chunks) : result.chunks.join("\n\n")}
					/>
				</>
			) : null}
			<p className={hintClassName}>
				Character counts follow how platforms count: a URL or emoji can still consume more of a limit than it looks. When a single word is longer than the
				limit it is cut at the limit rather than dropped.
			</p>
		</ToolPanel>
	);
};
