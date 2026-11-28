import { afterEach, describe, expect, it, vi } from "vitest";
import { collectBrowserCapabilities, detectBrowser, detectOperatingSystem, formatStorageSize } from "@/features/developer-tools/browser-capability-utils";

afterEach(() => { vi.unstubAllGlobals(); });

describe("browser capability helpers", () => {
	it("identifies common browsers and only coarse operating-system families", () => {
		expect(detectBrowser("Mozilla/5.0 Chrome/132.0.0.0 Safari/537.36")).toEqual({ name: "Chrome", version: "132" });
		expect(detectBrowser("Mozilla/5.0 Chrome/132.0.0.0 Edg/132.0.0.0")).toEqual({ name: "Microsoft Edge", version: "132" });
		expect(detectBrowser("Mozilla/5.0 Version/18.0 Safari/605.1.15")).toEqual({ name: "Safari", version: "18" });
		expect(detectOperatingSystem("Mozilla/5.0 (X11; CrOS x86_64)", "Linux x86_64")).toBe("ChromeOS");
		expect(detectOperatingSystem("Mozilla/5.0 (Linux; Android 15)", "Linux armv8l")).toBe("Android");
	});

	it("formats storage estimates without overclaiming precision", () => {
		expect(formatStorageSize(null)).toBe("Not reported");
		expect(formatStorageSize(1024)).toBe("1 KB");
		expect(formatStorageSize(1_572_864)).toBe("1.5 MB");
	});

	it("inspects capability and permission metadata without invoking protected APIs", async () => {
		const permissionQuery = vi.fn(async ({ name }: { name: string }) => ({ state: name === "camera" ? "prompt" : "granted" }) as PermissionStatus);
		const enumerateDevices = vi.fn(async () => [
			{ kind: "audioinput", deviceId: "secret-audio-id", label: "Private microphone" },
			{ kind: "videoinput", deviceId: "secret-camera-id", label: "Private camera" },
		] as MediaDeviceInfo[]);
		const readText = vi.fn(async () => "should not be read");
		const writeText = vi.fn(async () => undefined);
		const getUserMedia = vi.fn(async () => ({ getTracks: () => [] } as unknown as MediaStream));
		const queryDescriptor = Object.getOwnPropertyDescriptor(navigator, "permissions");
		const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
		const mediaDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
		const gpuDescriptor = Object.getOwnPropertyDescriptor(navigator, "gpu");
		const storageDescriptor = Object.getOwnPropertyDescriptor(navigator, "storage");
		Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: permissionQuery } });
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText, writeText } });
		Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { enumerateDevices, getUserMedia } });
		Object.defineProperty(navigator, "gpu", { configurable: true, value: { requestAdapter: async () => ({}) } });
		Object.defineProperty(navigator, "storage", { configurable: true, value: { estimate: async () => ({ usage: 1024, quota: 2048 }) } });
		vi.stubGlobal("Notification", class { static permission = "default"; });
		try {
			const report = await collectBrowserCapabilities();
			expect(report.browser.userAgent).toBeTruthy();
			expect(report.apis.webGpu.adapterAvailable).toBe(true);
			expect(report.apis.clipboard.readPermission).toBe("granted");
			expect(report.apis.media.audioInputsListed).toBe(1);
			expect(report.apis.media.videoInputsListed).toBe(1);
			expect(report.apis.media.cameraPermission).toBe("prompt");
			expect(report.apis.storage.usageBytes).toBe(1024);
			expect(JSON.stringify(report)).not.toContain("secret-camera-id");
			expect(JSON.stringify(report)).not.toContain("Private microphone");
			expect(readText).not.toHaveBeenCalled();
			expect(writeText).not.toHaveBeenCalled();
			expect(getUserMedia).not.toHaveBeenCalled();
			expect(permissionQuery).toHaveBeenCalledTimes(5);
		} finally {
			for (const [key, descriptor] of [["permissions", queryDescriptor], ["clipboard", clipboardDescriptor], ["mediaDevices", mediaDescriptor], ["gpu", gpuDescriptor], ["storage", storageDescriptor]] as const) {
				if (descriptor) Object.defineProperty(navigator, key, descriptor);
				else Reflect.deleteProperty(navigator, key);
			}
		}
	});
});
