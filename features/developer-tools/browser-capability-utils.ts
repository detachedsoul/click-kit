export type PermissionCheck = "granted" | "prompt" | "denied" | "unsupported" | "unavailable";

export type BrowserCapabilityReport = {
	generatedAt: string;
	secureContext: boolean;
	browser: { name: string; version: string; userAgent: string; platform: string; operatingSystem: string; language: string };
	display: { screenWidth: number; screenHeight: number; viewportWidth: number; viewportHeight: number; pixelRatio: number; colorDepth: number };
	apis: {
		webRtc: boolean;
		workers: boolean;
		indexedDb: boolean;
		webGpu: { supported: boolean; adapterAvailable: boolean | null };
		clipboard: { readText: boolean; writeText: boolean; readPermission: PermissionCheck; writePermission: PermissionCheck };
		media: { getUserMedia: boolean; enumerateDevices: boolean; audioInputsListed: number | null; videoInputsListed: number | null; cameraPermission: PermissionCheck; microphonePermission: PermissionCheck };
		notifications: { supported: boolean; permission: PermissionCheck };
		storage: { supported: boolean; usageBytes: number | null; quotaBytes: number | null };
	};
};

type NavigatorWithOptionalApis = Navigator & {
	gpu?: { requestAdapter: () => Promise<unknown | null> };
	storage?: { estimate: () => Promise<{ usage?: number; quota?: number }> };
	mediaDevices?: MediaDevices & { enumerateDevices?: () => Promise<MediaDeviceInfo[]> };
	clipboard?: { readText?: () => Promise<string>; writeText?: (text: string) => Promise<void> };
};

export const detectBrowser = (userAgent: string): { name: string; version: string } => {
	const candidates: Array<[string, RegExp]> = [
		["Microsoft Edge", /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/u],
		["Opera", /(?:OPR|Opera)\/([\d.]+)/u],
		["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/u],
		["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/u],
		["Safari", /Version\/([\d.]+).*Safari/u],
	];
	for (const [name, pattern] of candidates) {
		const version = pattern.exec(userAgent)?.[1];
		if (version) return { name, version: version.split(".")[0] };
	}
	return { name: "Unknown browser", version: "" };
};

export const detectOperatingSystem = (userAgent: string, platform: string): string => {
	const value = `${platform} ${userAgent}`.toLowerCase();
	if (/android/u.test(value)) return "Android";
	if (/(?:iphone|ipad|ipod)/u.test(value)) return "iOS / iPadOS";
	if (/cros/u.test(value)) return "ChromeOS";
	if (/windows/u.test(value)) return "Windows";
	if (/macintosh|mac os|macintel/u.test(value)) return "macOS";
	if (/linux|x11/u.test(value)) return "Linux";
	return "Unknown platform";
};

const permissionCheck = async (name: string): Promise<PermissionCheck> => {
	if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
	try {
		const query = navigator.permissions.query as (descriptor: { name: string }) => Promise<PermissionStatus>;
		return await query({ name }).then((permission) => permission.state);
	} catch {
		return "unavailable";
	}
};

const detectAdapter = async (nav: NavigatorWithOptionalApis): Promise<boolean | null> => {
	if (!nav.gpu?.requestAdapter) return null;
	try { return Boolean(await nav.gpu.requestAdapter()); }
	catch { return false; }
};

const collectMediaDevices = async (nav: NavigatorWithOptionalApis) => {
	if (!nav.mediaDevices?.enumerateDevices) return { enumerateDevices: false, audioInputsListed: null, videoInputsListed: null };
	try {
		const devices = await nav.mediaDevices.enumerateDevices();
		return {
			enumerateDevices: true,
			audioInputsListed: devices.filter((device) => device.kind === "audioinput").length,
			videoInputsListed: devices.filter((device) => device.kind === "videoinput").length,
		};
	} catch {
		return { enumerateDevices: true, audioInputsListed: null, videoInputsListed: null };
	}
};

const collectStorage = async (nav: NavigatorWithOptionalApis) => {
	if (!nav.storage?.estimate) return { supported: false, usageBytes: null, quotaBytes: null };
	try {
		const estimate = await nav.storage.estimate();
		return { supported: true, usageBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null };
	} catch {
		return { supported: true, usageBytes: null, quotaBytes: null };
	}
};

export const collectBrowserCapabilities = async (): Promise<BrowserCapabilityReport> => {
	const nav = navigator as NavigatorWithOptionalApis;
	const userAgent = nav.userAgent || "Unavailable";
	const platform = nav.platform || "Unavailable";
	const browser = detectBrowser(userAgent);
	const [adapterAvailable, mediaDevices, storage, cameraPermission, microphonePermission, notificationsPermission, clipboardReadPermission, clipboardWritePermission] = await Promise.all([
		detectAdapter(nav),
		collectMediaDevices(nav),
		collectStorage(nav),
		permissionCheck("camera"),
		permissionCheck("microphone"),
		permissionCheck("notifications"),
		permissionCheck("clipboard-read"),
		permissionCheck("clipboard-write"),
	]);
	const clipboard = nav.clipboard;
	const notificationApi = typeof Notification !== "undefined";
	return {
		generatedAt: new Date().toISOString(),
		secureContext: globalThis.isSecureContext,
		browser: { ...browser, userAgent, platform, operatingSystem: detectOperatingSystem(userAgent, platform), language: nav.language || "Unavailable" },
		display: {
			screenWidth: typeof screen === "undefined" ? 0 : screen.width,
			screenHeight: typeof screen === "undefined" ? 0 : screen.height,
			viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
			viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
			pixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
			colorDepth: typeof screen === "undefined" ? 0 : screen.colorDepth,
		},
		apis: {
			webRtc: typeof RTCPeerConnection !== "undefined",
			workers: typeof Worker !== "undefined",
			indexedDb: typeof indexedDB !== "undefined",
			webGpu: { supported: Boolean(nav.gpu?.requestAdapter), adapterAvailable },
			clipboard: { readText: Boolean(clipboard?.readText), writeText: Boolean(clipboard?.writeText), readPermission: clipboard ? clipboardReadPermission : "unsupported", writePermission: clipboard ? clipboardWritePermission : "unsupported" },
			media: { getUserMedia: Boolean(nav.mediaDevices?.getUserMedia), ...mediaDevices, cameraPermission, microphonePermission },
			notifications: { supported: notificationApi, permission: notificationApi ? (Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : notificationsPermission) : "unsupported" },
			storage,
		},
	};
};

export const formatStorageSize = (bytes: number | null): string => {
	if (bytes === null || !Number.isFinite(bytes)) return "Not reported";
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex++; }
	return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
};
