"use client";

import { useState } from "react";
import { ErrorNote, hintClassName, labelClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { agentNotes, browserMajor, exampleAgents, parseUserAgent } from "@/features/developer-tools/user-agent-utils";

export const UserAgentTool = () => {
	const [userAgent, setUserAgent] = useState(exampleAgents[0].value);

	const parsed = (() => {
		try {
			return { info: parseUserAgent(userAgent), error: "" };
		} catch (caught) {
			return { info: null, error: caught instanceof Error ? caught.message : "Could not read that user agent." };
		}
	})();

	const info = parsed.info;
	const notes = info ? agentNotes(info) : [];

	return (
		<ToolPanel>
			<label className={labelClassName} htmlFor="ua-input">
				User agent string
				<textarea
					className="mt-2 block min-h-[86px] w-full resize-y border border-[#d9d7cd] bg-surface px-3 py-2.5 font-mono text-xs leading-relaxed text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="ua-input"
					onChange={(event) => setUserAgent(event.target.value)}
					placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 …"
					rows={3}
					value={userAgent}
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				{exampleAgents.map((example) => (
					<button
						className="cursor-pointer border border-line bg-[#fbfaf7] px-3 py-1 text-[11px] text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						key={example.label}
						onClick={() => setUserAgent(example.value)}
						type="button"
					>
						{example.label}
					</button>
				))}
				<button
					className="cursor-pointer border border-line bg-surface px-3 py-1 text-[11px] text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					onClick={() => setUserAgent(typeof navigator === "undefined" ? "" : navigator.userAgent)}
					type="button"
				>
					Use this browser
				</button>
			</div>
			<ErrorNote message={parsed.error} />
			{info ? (
				<>
					<p className="m-0 border border-[#d8dfd1] bg-[#e9ede3] px-[15px] py-3 text-[13px] leading-relaxed text-[#41493f]" role="status">
						{info.summary}
					</p>
					<StatGrid
						items={[
							{ label: "Browser", value: info.browserVersion ? `${info.browser} ${info.browserVersion}` : info.browser },
							{ label: "Major version", value: browserMajor(info) ? String(browserMajor(info)) : "Unknown" },
							{ label: "Engine", value: info.engine },
							{ label: "Operating system", value: info.osVersion ? `${info.os} ${info.osVersion}` : info.os },
							{ label: "Device", value: info.device },
							{ label: "Automated client", value: info.isBot ? "Yes" : "No" },
						]}
					/>
					{notes.length > 0 ? (
						<ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[11px] leading-relaxed text-muted">
							{notes.map((note) => (
								<li key={note}>{note}</li>
							))}
						</ul>
					) : null}
					<ResultBlock
						fileName="user-agent.json"
						rows={10}
						title="Parsed as JSON"
						value={JSON.stringify({ browser: info.browser, browserVersion: info.browserVersion, engine: info.engine, os: info.os, osVersion: info.osVersion, device: info.device, isBot: info.isBot }, null, 2)}
					/>
				</>
			) : null}
			<p className={hintClassName}>
				Parsing is pattern matching, not certainty: browsers copy each other&apos;s strings for compatibility, so the order of the checks matters
				(Edge claims to be Chrome, and Chrome claims to be Safari). Never make security decisions from a user agent — feature detection is the reliable
				test.
			</p>
		</ToolPanel>
	);
};
