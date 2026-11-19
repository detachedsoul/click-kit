"use client";

import { useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { hintClassName, labelClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { allPlatformReports, lengthSummary, linkCount, PLATFORMS, platformReport, smsSegments, wordCount } from "@/features/text-tools/post-length-utils";

const SAMPLE = "New: a before-and-after comparison tool. Drag the divider to see exactly what your compression settings changed — all in the browser. https://click-kit.vercel.app/tools/image-compare";

export const PostLengthTool = () => {
	const [text, setText] = useState(SAMPLE);
	const [platformId, setPlatformId] = useState(PLATFORMS[0].id);
	const platform = PLATFORMS.find((option) => option.id === platformId) ?? PLATFORMS[0];
	const active = platformReport(text, platform);
	const reports = allPlatformReports(text);

	return (
		<ToolPanel>
			<TextAreaField
				hint="Paste the post as you would publish it. Nothing leaves this page."
				id="post-length-input"
				label="Your post"
				onChange={setText}
				placeholder="Write or paste the post you want to check…"
				value={text}
			/>
			<label className={labelClassName} htmlFor="post-length-platform">
				Check against
				<select className={selectClassName} id="post-length-platform" onChange={(event) => setPlatformId(event.target.value)} value={platformId}>
					{PLATFORMS.map((option) => (
						<option key={option.id} value={option.id}>
							{option.label} ({option.limit})
						</option>
					))}
				</select>
			</label>
			<StatGrid
				items={[
					{ label: `${platform.label} length`, value: `${active.used} / ${platform.limit}` },
					{ label: active.fits ? "Room left" : "Over the limit", value: active.fits ? String(active.remaining) : String(active.over) },
					{ label: "Words", value: String(wordCount(text)) },
					{ label: "Links", value: String(linkCount(text)) },
				]}
			/>
			<p className={`m-0 border-l-2 pl-3 text-[11px] leading-[1.55] ${active.fits ? "border-[#6b8a61] text-muted" : "border-[#b64b31] text-[#873b28]"}`}>
				{lengthSummary(active)} — {platform.note}
				{platform.id === "sms" ? ` That is ${smsSegments(text)} SMS part${smsSegments(text) === 1 ? "" : "s"}.` : ""}
			</p>
			<div className="overflow-x-auto border border-line">
				<table className="w-full border-collapse text-left text-[11px]">
					<caption className="sr-only">Length on each platform</caption>
					<thead>
						<tr className="bg-[#f3f1e9] font-mono text-[10px] uppercase tracking-[.06em] text-[#5f6259]">
							<th className="px-3 py-2 font-normal" scope="col">
								Platform
							</th>
							<th className="px-3 py-2 font-normal" scope="col">
								Used
							</th>
							<th className="px-3 py-2 font-normal" scope="col">
								Status
							</th>
						</tr>
					</thead>
					<tbody>
						{reports.map((report) => (
							<tr className={`border-t border-line ${report.id === platformId ? "bg-[#fbfaf7]" : "bg-surface"}`} key={report.id}>
								<th className="px-3 py-2 font-medium text-ink" scope="row">
									{report.label}
								</th>
								<td className="whitespace-nowrap px-3 py-2 font-mono text-[#3c3d37]">
									{report.used} / {report.limit}
								</td>
								<td className={`whitespace-nowrap px-3 py-2 ${report.fits ? "text-[#536b4e]" : "text-[#873b28]"}`}>
									{report.fits ? `${report.remaining} left` : `${report.over} over`}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className={hintClassName}>
				Lengths are counted the way each platform counts them: emoji and accented letters count once, and X charges every link a flat 23 characters.
				Instagram and LinkedIn show only the opening lines, so keep the point in the first sentence.
			</p>
		</ToolPanel>
	);
};

export default PostLengthTool;
