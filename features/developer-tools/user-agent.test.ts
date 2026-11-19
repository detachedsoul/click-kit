import { describe, expect, it } from "vitest";
import { agentNotes, browserMajor, exampleAgents, parseUserAgent } from "@/features/developer-tools/user-agent-utils";

const byLabel = (label: string) => parseUserAgent(exampleAgents.find((example) => example.label === label)!.value);

describe("user agent parser", () => {
	it("reads Chrome on Windows", () => {
		const info = byLabel("Chrome on Windows");
		expect(info.browser).toBe("Chrome");
		expect(info.browserVersion).toBe("131.0.0.0");
		expect(browserMajor(info)).toBe(131);
		expect(info.os).toBe("Windows 10/11");
		expect(info.device).toBe("desktop");
		expect(info.isBot).toBe(false);
		expect(info.summary).toContain("Chrome 131.0.0.0");
	});

	it("reads Safari on an iPhone", () => {
		const info = byLabel("Safari on iPhone");
		expect(info.browser).toBe("Safari");
		expect(info.engine).toBe("WebKit");
		expect(info.os).toBe("iOS");
		expect(info.osVersion).toBe("17.4");
		expect(info.device).toBe("mobile");
	});

	it("reads Chrome on Android and flags mobile", () => {
		const info = byLabel("Chrome on Android");
		expect(info.os).toBe("Android");
		expect(info.osVersion).toBe("14");
		expect(info.device).toBe("mobile");
	});

	it("spots crawlers and explains the string", () => {
		const info = byLabel("Googlebot");
		expect(info.isBot).toBe(true);
		expect(info.device).toBe("bot");
		expect(info.browser).toBe("Automated client");
		expect(agentNotes(info).join(" ")).toContain("crawler");
		expect(() => parseUserAgent("   ")).toThrow(/user agent/u);
	});

	it("classifies an Android tablet and an Edge browser", () => {
		const tablet = parseUserAgent("Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
		expect(tablet.device).toBe("tablet");
		const edge = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91");
		expect(edge.browser).toBe("Edge");
		expect(edge.browserVersion).toBe("120.0.2210.91");
	});
});
