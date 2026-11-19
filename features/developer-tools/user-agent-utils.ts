export type DeviceKind = "bot" | "mobile" | "tablet" | "desktop";
export type AgentInfo = {
	browser: string;
	browserVersion: string;
	engine: string;
	os: string;
	osVersion: string;
	device: DeviceKind;
	isBot: boolean;
	summary: string;
};

const BOT_PATTERN = /bot\b|crawler|spider|slurp|facebookexternalhit|headlesschrome|curl\/|wget\/|python-requests|axios\/|go-http-client/iu;

const BROWSER_RULES: { name: string; pattern: RegExp; engine: string }[] = [
	{ name: "Edge", pattern: /Edg(?:e|A|iOS)?\/([\d.]+)/u, engine: "Blink" },
	{ name: "Opera", pattern: /OPR\/([\d.]+)/u, engine: "Blink" },
	{ name: "Samsung Internet", pattern: /SamsungBrowser\/([\d.]+)/u, engine: "Blink" },
	{ name: "Firefox", pattern: /Firefox\/([\d.]+)/u, engine: "Gecko" },
	{ name: "Chrome", pattern: /(?:Chrome|CriOS)\/([\d.]+)/u, engine: "Blink" },
	{ name: "Safari", pattern: /Version\/([\d.]+).*Safari/u, engine: "WebKit" },
	{ name: "Internet Explorer", pattern: /Trident\/.*rv:([\d.]+)/u, engine: "Trident" },
];

const cleanVersion = (value: string) => value.replace(/_/gu, ".").replace(/[^\d.]/gu, "");

const windowsName = (version: string) => {
	if (version === "10.0") return "Windows 10/11";
	if (version === "6.3") return "Windows 8.1";
	if (version === "6.2") return "Windows 8";
	if (version === "6.1") return "Windows 7";
	return "Windows";
};

const detectOs = (ua: string) => {
	const windows = /Windows NT ([\d.]+)/u.exec(ua);
	if (windows) return { os: windowsName(windows[1]), osVersion: windows[1] };
	const android = /Android ([\d.]+)/u.exec(ua);
	if (android) return { os: "Android", osVersion: cleanVersion(android[1]) };
	const apple = /(?:iPhone|iPad|iPod).*?OS ([\d_]+)/u.exec(ua);
	if (apple) return { os: /iPad/u.test(ua) ? "iPadOS" : "iOS", osVersion: cleanVersion(apple[1]) };
	if (/CrOS/u.test(ua)) {
		const chromeOs = /CrOS \S+ ([\d.]+)/u.exec(ua);
		return { os: "ChromeOS", osVersion: chromeOs ? cleanVersion(chromeOs[1]) : "" };
	}
	const mac = /Mac OS X ([\d_.]+)/u.exec(ua);
	if (mac) return { os: "macOS", osVersion: cleanVersion(mac[1]) };
	if (/Ubuntu/u.test(ua)) return { os: "Ubuntu", osVersion: "" };
	if (/Linux/u.test(ua)) return { os: "Linux", osVersion: "" };
	if (/FreeBSD/u.test(ua)) return { os: "FreeBSD", osVersion: "" };
	return { os: "Unknown", osVersion: "" };
};

const detectDevice = (ua: string, isBot: boolean): DeviceKind => {
	if (isBot) return "bot";
	if (/iPad|Tablet/u.test(ua)) return "tablet";
	if (/Android/u.test(ua) && !/Mobile/u.test(ua)) return "tablet";
	if (/Mobi|iPhone|iPod|Windows Phone/u.test(ua)) return "mobile";
	return "desktop";
};

export const parseUserAgent = (userAgent: string): AgentInfo => {
	const ua = userAgent.trim();
	if (!ua) throw new Error("Paste a user agent string first.");
	const isBot = BOT_PATTERN.test(ua);
	const match = BROWSER_RULES.find((rule) => rule.pattern.test(ua));
	const browserMatch = match ? match.pattern.exec(ua) : null;
	const browser = match?.name ?? (isBot ? "Automated client" : "Unknown browser");
	const browserVersion = browserMatch ? cleanVersion(browserMatch[1]) : "";
	const { os, osVersion } = detectOs(ua);
	const device = detectDevice(ua, isBot);
	const summary = [
		browserVersion ? `${browser} ${browserVersion}` : browser,
		`on ${osVersion ? `${os} ${osVersion}` : os}`,
		device === "bot" ? "(automated)" : `· ${device}`,
	].join(" ");
	return { browser, browserVersion, engine: match?.engine ?? "Unknown", os, osVersion, device, isBot, summary };
};

export const browserMajor = (info: AgentInfo) => Number.parseInt(info.browserVersion.split(".")[0] ?? "", 10) || 0;

/** Short note about what the string implies for the person reading it. */
export const agentNotes = (info: AgentInfo) => {
	const notes: string[] = [];
	if (info.isBot) notes.push("This looks like a crawler or script, not a person, so feature detection will see no browser UI.");
	if (info.device === "mobile") notes.push("Mobile browsers report a reduced screen and often block autoplay and some sensors.");
	if (info.device === "tablet") notes.push("Tablets usually report the mobile layout but a full-size viewport.");
	if (info.engine === "WebKit" && info.browser !== "Safari") notes.push("WebKit engines are Safari's, even when the browser name differs.");
	if (info.browser === "Internet Explorer") notes.push("Internet Explorer is unsupported everywhere; treat this as an old log line.");
	if (info.osVersion && info.os === "Windows 10/11") notes.push("A Windows NT 10.0 string covers both Windows 10 and Windows 11 by design.");
	return notes;
};

export const exampleAgents: { label: string; value: string }[] = [
	{
		label: "Chrome on Windows",
		value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	},
	{
		label: "Safari on iPhone",
		value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
	},
	{
		label: "Chrome on Android",
		value: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
	},
	{
		label: "Googlebot",
		value: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	},
];
