"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Camera, Clipboard, Download, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { ToolPanel } from "@/features/developer-tools/tool-ui";
import { collectBrowserCapabilities, formatStorageSize, type BrowserCapabilityReport, type PermissionCheck } from "@/features/developer-tools/browser-capability-utils";

const buttonClass = "inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-line bg-surface px-3 text-xs text-ink hover:bg-[#f1f0ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

type StatusKind = "available" | "unavailable" | "limited" | "permission";

const StatusBadge = ({ kind, children }: { kind: StatusKind; children: string }) => {
	const styles: Record<StatusKind, string> = {
		available: "border-[#bfd0bd] bg-[#edf4eb] text-[#3e6445]",
		unavailable: "border-[#e4c6bc] bg-[#fbf1ee] text-[#8a3f30]",
		limited: "border-[#e6d8b8] bg-[#fbf6eb] text-[#70541e]",
		permission: "border-line bg-[#f5f4ef] text-muted",
	};
	return <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-[10px] font-semibold ${styles[kind]}`}>{children}</span>;
};

const FeatureRow = ({ name, supported, detail, state }: { name: string; supported: boolean | null; detail: string; state?: { kind: StatusKind; label: string } }) => {
	const kind = state?.kind ?? (supported === true ? "available" : supported === false ? "unavailable" : "limited");
	const label = state?.label ?? (supported === true ? "Available" : supported === false ? "Not detected" : "Not reported");
	return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3 last:border-b-0"><div className="min-w-0 flex-1"><h3 className="m-0 text-xs font-semibold">{name}</h3><p className="mb-0 mt-1 text-[11px] leading-relaxed text-muted">{detail}</p></div><StatusBadge kind={kind}>{label}</StatusBadge></div>;
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) => (
	<section className="flex flex-col gap-2 border border-line bg-surface p-4" aria-label={title}><h2 className="m-0 flex items-center gap-2 text-sm font-semibold"><Icon size={16} aria-hidden="true" />{title}</h2><div>{children}</div></section>
);

const permissionState = (permission: PermissionCheck): { kind: StatusKind; label: string } => {
	if (permission === "granted") return { kind: "available", label: "Granted" };
	if (permission === "denied") return { kind: "unavailable", label: "Denied" };
	if (permission === "prompt") return { kind: "permission", label: "Ask first" };
	if (permission === "unsupported") return { kind: "limited", label: "Not exposed" };
	return { kind: "limited", label: "Could not query" };
};

const browserLabel = (report: BrowserCapabilityReport) => report.browser.version ? `${report.browser.name} ${report.browser.version}` : report.browser.name;

const downloadReport = (report: BrowserCapabilityReport) => {
	const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "browser-capability-report.json";
	anchor.click();
	URL.revokeObjectURL(url);
};

export const BrowserCapabilityTool = () => {
	const [report, setReport] = useState<BrowserCapabilityReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const refresh = useCallback(async () => {
		setLoading(true);
		setError("");
		try { setReport(await collectBrowserCapabilities()); }
		catch { setError("Some browser details could not be read. Try refreshing, or use a current browser."); }
		finally { setLoading(false); }
	}, []);
	useEffect(() => {
		const timer = window.setTimeout(() => { void refresh(); }, 0);
		return () => window.clearTimeout(timer);
	}, [refresh]);

	return <ToolPanel>
		<div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="m-0 text-sm font-semibold">Browser capability report</h2><p className="mb-0 mt-1 text-[11px] text-muted">Checks are performed on this device and are not sent anywhere.</p></div><div className="flex gap-2"><button className={buttonClass} type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} size={14} aria-hidden="true" />Refresh</button><button className={buttonClass} type="button" onClick={() => report && downloadReport(report)} disabled={!report || loading}><Download size={14} aria-hidden="true" />Download report</button></div></div>
		{error && <p className="m-0 border-l-2 border-[#a34d37] bg-[#fbf1ee] p-3 text-xs text-[#8a3f30]" role="alert">{error}</p>}
		{loading && !report && <p className="m-0 border-l-2 border-accent bg-[#f8f6ef] p-3 text-xs" role="status">Checking browser capabilities…</p>}
		{report && <>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
				<Section title="Browser & platform" icon={Smartphone}><dl className="m-0 grid grid-cols-[105px_1fr] gap-x-2 gap-y-2 text-xs"><dt className="text-muted">Browser</dt><dd className="m-0 font-medium">{browserLabel(report)}</dd><dt className="text-muted">Operating system</dt><dd className="m-0 font-medium">{report.browser.operatingSystem}</dd><dt className="text-muted">Platform</dt><dd className="m-0 break-words font-mono text-[10px]">{report.browser.platform}</dd><dt className="text-muted">Language</dt><dd className="m-0 font-mono text-[10px]">{report.browser.language}</dd><dt className="text-muted">Secure context</dt><dd className="m-0"><StatusBadge kind={report.secureContext ? "available" : "limited"}>{report.secureContext ? "Yes" : "No"}</StatusBadge></dd></dl></Section>
				<Section title="Screen & viewport" icon={Monitor}><dl className="m-0 grid grid-cols-[105px_1fr] gap-x-2 gap-y-2 text-xs"><dt className="text-muted">Screen</dt><dd className="m-0 font-mono">{report.display.screenWidth} × {report.display.screenHeight} px</dd><dt className="text-muted">Viewport</dt><dd className="m-0 font-mono">{report.display.viewportWidth} × {report.display.viewportHeight} px</dd><dt className="text-muted">Pixel ratio</dt><dd className="m-0 font-mono">{report.display.pixelRatio}×</dd><dt className="text-muted">Color depth</dt><dd className="m-0 font-mono">{report.display.colorDepth}-bit</dd></dl></Section>
			</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
				<Section title="Browser APIs" icon={Activity}>
					<FeatureRow name="WebRTC" supported={report.apis.webRtc} detail="RTCPeerConnection support is detected; no connection is created." />
					<FeatureRow name="Web Workers" supported={report.apis.workers} detail="Background JavaScript workers can be started by this browser." />
					<FeatureRow name="IndexedDB" supported={report.apis.indexedDb} detail="Browser database API presence; no database is opened or written." />
					<FeatureRow name="WebGPU" supported={report.apis.webGpu.supported} detail={report.apis.webGpu.adapterAvailable === null ? "GPU adapter request is not available." : report.apis.webGpu.adapterAvailable ? "A compatible adapter was reported; no device or hardware details were read." : "No adapter was returned by the browser."} state={report.apis.webGpu.adapterAvailable === null ? undefined : { kind: report.apis.webGpu.adapterAvailable ? "available" : "limited", label: report.apis.webGpu.adapterAvailable ? "Adapter found" : "No adapter" }} />
					<FeatureRow name="Notifications" supported={report.apis.notifications.supported} detail="Permission is only inspected; this tester never requests permission or shows a notification." state={{ kind: permissionState(report.apis.notifications.permission).kind, label: report.apis.notifications.supported ? permissionState(report.apis.notifications.permission).label : "Not supported" }} />
				</Section>
				<Section title="Clipboard & storage" icon={Clipboard}>
					<FeatureRow name="Clipboard read" supported={report.apis.clipboard.readText} detail="The clipboard is never read. Permission state, when available, is checked without prompting." state={{ kind: report.apis.clipboard.readText ? permissionState(report.apis.clipboard.readPermission).kind : "unavailable", label: report.apis.clipboard.readText ? permissionState(report.apis.clipboard.readPermission).label : "Not supported" }} />
					<FeatureRow name="Clipboard write" supported={report.apis.clipboard.writeText} detail="Nothing is copied to your clipboard by this check." state={{ kind: report.apis.clipboard.writeText ? permissionState(report.apis.clipboard.writePermission).kind : "unavailable", label: report.apis.clipboard.writeText ? permissionState(report.apis.clipboard.writePermission).label : "Not supported" }} />
					<FeatureRow name="Storage estimate" supported={report.apis.storage.supported} detail={`Usage: ${formatStorageSize(report.apis.storage.usageBytes)} · quota: ${formatStorageSize(report.apis.storage.quotaBytes)}. This is an estimate, not a guarantee.`} />
				</Section>
				<Section title="Camera & microphone" icon={Camera}>
					<FeatureRow name="Camera access API" supported={report.apis.media.getUserMedia} detail="No stream is requested and no permission prompt is opened." state={{ kind: permissionState(report.apis.media.cameraPermission).kind, label: report.apis.media.getUserMedia ? permissionState(report.apis.media.cameraPermission).label : "Not supported" }} />
					<FeatureRow name="Microphone access API" supported={report.apis.media.getUserMedia} detail="No audio is captured; permission state is queried only when the browser allows it." state={{ kind: permissionState(report.apis.media.microphonePermission).kind, label: report.apis.media.getUserMedia ? permissionState(report.apis.media.microphonePermission).label : "Not supported" }} />
					<FeatureRow name="Inputs listed by browser" supported={report.apis.media.enumerateDevices} detail={report.apis.media.enumerateDevices ? `${report.apis.media.audioInputsListed ?? "?"} audio input(s) · ${report.apis.media.videoInputsListed ?? "?"} video input(s). Browsers can hide devices until permission is granted.` : "Device enumeration is not available."} />
				</Section>
			</div>
			<details className="border border-line bg-[#f8f7f3] p-3"><summary className="cursor-pointer text-xs font-semibold">User-agent string and privacy details</summary><p className="mb-0 mt-3 break-all font-mono text-[10px] leading-relaxed">{report.browser.userAgent}</p><p className="mb-0 mt-3 text-[11px] leading-relaxed text-muted">This report only checks standard browser APIs and basic display information. It does not read your clipboard, request camera/microphone/notification access, create a WebRTC connection, inspect GPU hardware details, collect device IDs, use canvas fingerprinting, or send information to a server. Device listings may be incomplete until you grant browser permission.</p></details>
			<p className="m-0 text-[10px] text-muted">Last checked {new Date(report.generatedAt).toLocaleString()} · reporting is approximate and depends on browser privacy settings.</p>
		</>}
	</ToolPanel>;
};
