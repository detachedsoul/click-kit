import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { siteDescription, siteName, siteTagline, siteUrl } from "@/lib/site";
import { tools } from "@/lib/tools";

export const alt = `${siteName} — ${siteTagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7.5" fill="#263b34"/><g transform="translate(21.9 9.1) scale(-1.02 1.02)"><path d="M0 0 L0 13.4 L3.7 9.9 L6.3 15.6 L9.3 14.2 L6.7 8.6 L11 8.2 Z" fill="#fffdf8" stroke="#263b34" stroke-linejoin="round" stroke-width="1.1"/></g><circle cx="23.2" cy="8.4" r="2.3" fill="none" stroke="#f1c891" stroke-width="1.5" opacity="0.85"/><circle cx="23.2" cy="8.4" r="3.9" fill="none" stroke="#e08a63" stroke-width="0.9" opacity="0.38"/></svg>`;

export default async function OpengraphImage() {
	const serif = await readFile(join(process.cwd(), "node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff"));
	const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;
	return new ImageResponse(
		(
			<div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#f3f1e9", padding: "64px 72px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
					<img alt="" height={56} src={mark} width={56} />
					<span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.6px", color: "#252820" }}>clickkit</span>
				</div>
				<div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 56 }}>
					<div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
						<div style={{ display: "flex", flexDirection: "column", fontFamily: "Instrument Serif", fontSize: 104, lineHeight: 0.92, letterSpacing: "-3px", color: "#252820" }}>
							<span>Good tools.</span>
							<span style={{ fontStyle: "italic", color: "#b64b31" }}>Less fuss.</span>
						</div>
						<p style={{ maxWidth: 620, margin: "26px 0 0", fontSize: 27, lineHeight: 1.42, color: "#5d6058" }}>
							{siteDescription.split(".")[0]}. No account, no detour.
						</p>
					</div>
					<div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 300, height: 330, borderRadius: 6, backgroundColor: "#263b34", padding: "30px 30px 26px" }}>
						<div style={{ display: "flex", flexDirection: "column" }}>
							<span style={{ fontFamily: "Instrument Serif", fontSize: 96, lineHeight: 0.8, letterSpacing: "-3px", color: "#f1c891" }}>{tools.filter((tool) => tool.status === "available").length}</span>
							<span style={{ marginTop: 10, fontSize: 24, color: "#e7e8dd" }}>tools ready to use</span>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 19, color: "#c6cec3" }}>
							<span>Runs in your browser</span>
							<span>No account needed</span>
							<span>Free, no upsell</span>
						</div>
					</div>
				</div>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #dedbd1", paddingTop: 24, fontSize: 22, color: "#5f6259" }}>
					<span>{siteUrl.replace(/^https?:\/\//u, "")}</span>
					<span>Free · Private · In your browser</span>
				</div>
			</div>
		),
		{ ...size, fonts: [{ name: "Instrument Serif", data: serif, style: "normal", weight: 400 }] },
	);
}
