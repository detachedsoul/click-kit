"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { SelectField } from "@/components/select-field";
import { ErrorNote, ToolPanel, buttonClassName, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";
import { EMAIL_SAMPLES, buildEmailDocument, sanitizeEmailHtml, validateEmailHtml } from "@/features/developer-tools/email-preview-utils";

const VIEWPORTS = [
	{ id: "mobile", name: "Mobile · 375 px", width: 375 },
	{ id: "compact", name: "Small mobile · 320 px", width: 320 },
	{ id: "tablet", name: "Tablet · 768 px", width: 768 },
	{ id: "desktop", name: "Desktop · 1024 px", width: 1024 },
	{ id: "wide", name: "Wide · 1280 px", width: 1280 },
	{ id: "custom", name: "Custom width", width: 600 },
];
const previewTabClass = (selected: boolean) => `border-b-2 px-3 py-2 text-xs ${selected ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`;
const secondaryButton = `${buttonClassName} min-h-8 border-line bg-surface text-ink hover:bg-[#f1f0ea]`;
const noSubscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export const EmailPreviewTool = () => {
	const [sampleId, setSampleId] = useState(EMAIL_SAMPLES[0].id);
	const [source, setSource] = useState(EMAIL_SAMPLES[0].html);
	const [selectedViewport, setSelectedViewport] = useState("mobile");
	const [customWidth, setCustomWidth] = useState(600);
	const [allowRemoteImages, setAllowRemoteImages] = useState(false);
	const [tab, setTab] = useState<"preview" | "text">("preview");
	const hydrated = useSyncExternalStore(noSubscribe, clientSnapshot, serverSnapshot);
	const safe = useMemo(() => hydrated ? sanitizeEmailHtml(source, allowRemoteImages) : { html: "", plainText: "", warnings: [], errors: [] }, [source, allowRemoteImages, hydrated]);
	const validation = useMemo(() => validateEmailHtml(source, safe), [source, safe]);
	const documentSource = useMemo(() => buildEmailDocument(safe.html, allowRemoteImages), [safe.html, allowRemoteImages]);
	const viewport = VIEWPORTS.find((item) => item.id === selectedViewport) ?? VIEWPORTS[0];
	const width = selectedViewport === "custom" ? Math.max(240, Math.min(1440, Number(customWidth) || 240)) : viewport.width;

	const loadSample = (id: string) => {
		setSampleId(id);
		const sample = EMAIL_SAMPLES.find((item) => item.id === id);
		if (sample) setSource(sample.html);
	};
	const downloadHtml = () => {
		const blob = new Blob([source], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "email-template.html";
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	};
	const resetPreview = () => {
		const sample = EMAIL_SAMPLES.find((item) => item.id === sampleId) ?? EMAIL_SAMPLES[0];
		setSource(sample.html);
		setTab("preview");
	};

	return (
		<ToolPanel>
			<div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
				<section aria-label="Email HTML editor" className="flex min-w-0 flex-col gap-3">
					<div className="flex flex-wrap items-end gap-2">
						<label className={`${labelClassName} min-w-48 flex-1`} htmlFor="email-template-sample">Sample template
							<SelectField className={selectClassName} containerClassName="" id="email-template-sample" onChange={(event) => loadSample(event.target.value)} value={sampleId}>
								{EMAIL_SAMPLES.map((sample) => <option key={sample.id} value={sample.id}>{sample.name}</option>)}
							</SelectField>
						</label>
						<button className={secondaryButton} onClick={resetPreview} type="button">Reset preview</button>
					</div>
					<label className={labelClassName} htmlFor="email-html-source">HTML template
						<textarea aria-describedby="email-html-help" className="mt-2 min-h-[440px] w-full resize-y border border-line bg-[#fbfaf7] p-3 font-mono text-xs leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" id="email-html-source" onChange={(event) => setSource(event.target.value)} spellCheck={false} value={source} />
					</label>
					<p className={hintClassName} id="email-html-help">Paste or edit the source. The preview strips scripts and active content; it never runs your HTML as part of the ClickKit page.</p>
					<button className={`${buttonClassName} min-h-9 self-start border-forest bg-forest text-white hover:bg-[#354d44]`} onClick={downloadHtml} type="button">Download HTML</button>
				</section>

				<section aria-label="Email preview" className="flex min-w-0 flex-col gap-3">
					<div className="flex flex-wrap items-end gap-3">
						<label className={`${labelClassName} min-w-52 flex-1`} htmlFor="email-viewport">Preview size
							<SelectField className={selectClassName} containerClassName="" id="email-viewport" onChange={(event) => setSelectedViewport(event.target.value)} value={selectedViewport}>
								{VIEWPORTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
							</SelectField>
						</label>
						{selectedViewport === "custom" ? <label className={`${labelClassName} w-28`} htmlFor="email-custom-width">Width (px)<input className={fieldClassName} id="email-custom-width" max={1440} min={240} onChange={(event) => setCustomWidth(Number(event.target.value))} type="number" value={customWidth} /></label> : null}
					</div>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="font-mono text-[10px] text-muted">Viewport {width} × responsive height</span>
						<label className="flex items-center gap-2 text-[11px] text-[#4d514a]"><input checked={allowRemoteImages} className="h-4 w-4 accent-[#2f4539]" onChange={(event) => setAllowRemoteImages(event.target.checked)} type="checkbox" />Load remote images</label>
					</div>
					<div className="flex gap-1 border-b border-line" aria-label="Email output view">
						<button aria-pressed={tab === "preview"} className={previewTabClass(tab === "preview")} onClick={() => setTab("preview")} type="button">Visual preview</button>
						<button aria-pressed={tab === "text"} className={previewTabClass(tab === "text")} onClick={() => setTab("text")} type="button">Plain text</button>
					</div>
					{tab === "preview" ? (
						<div className="max-h-[680px] overflow-auto border border-line bg-[#e8e7e1] p-3" aria-label="Responsive email canvas">
							<iframe aria-label={`${width} pixel email preview`} className="mx-auto block min-h-[560px] border-0 bg-white shadow-md" referrerPolicy="no-referrer" sandbox="" srcDoc={validation.errors.length ? "" : documentSource} style={{ width: `${width}px` }} title={`Email preview at ${width} pixels`} />
						</div>
					) : <pre aria-label="Plain text version" className="m-0 min-h-[280px] max-h-[680px] overflow-auto whitespace-pre-wrap border border-line bg-white p-4 font-mono text-xs leading-relaxed">{safe.plainText || "Plain-text version will appear here."}</pre>}
				</section>
			</div>

			<section aria-label="HTML validation" className="flex flex-col gap-2 border-t border-line pt-4">
				<div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-sm font-semibold">HTML validation</h2><span className={`font-mono text-[10px] ${validation.errors.length ? "text-[#8a3f30]" : validation.warnings.length ? "text-[#79602b]" : "text-[#315340]"}`}>{validation.errors.length ? `${validation.errors.length} issue(s)` : validation.warnings.length ? `${validation.warnings.length} suggestion(s)` : "No common preview issues"}</span></div>
				<ErrorNote message={validation.errors.join(" ")} />
				{validation.warnings.length ? <ul className="m-0 flex flex-col gap-1 pl-5 text-xs leading-relaxed text-[#64583a]">{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
				{!validation.errors.length && !validation.warnings.length ? <p className={hintClassName}>The preview is ready. Email-client rendering can still differ, especially for advanced CSS and web fonts.</p> : null}
			</section>
			<p className="m-0 border border-[#e6ddc4] bg-[#fbf7ea] p-3 text-[11px] leading-relaxed text-[#64583a]">This is a responsive browser preview, not a full simulation of Outlook, Gmail, or Apple Mail. Scripts, forms, embeds, active links, and remote images are blocked by default. Remote HTTPS images load only after you opt in.</p>
		</ToolPanel>
	);
};
