import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserCapabilityTool } from "@/features/developer-tools/browser-capability-tool";

const { mockCollect } = vi.hoisted(() => ({ mockCollect: vi.fn() }));
vi.mock("@/features/developer-tools/browser-capability-utils", async (importOriginal) => ({
	...await importOriginal<typeof import("@/features/developer-tools/browser-capability-utils")>(),
	collectBrowserCapabilities: mockCollect,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const sampleReport = {
	generatedAt: "2026-11-15T10:00:00.000Z",
	secureContext: true,
	browser: { name: "Firefox", version: "132", userAgent: "Firefox/132", platform: "Linux x86_64", operatingSystem: "Linux", language: "en-NG" },
	display: { screenWidth: 1920, screenHeight: 1080, viewportWidth: 1280, viewportHeight: 720, pixelRatio: 1.5, colorDepth: 24 },
	apis: {
		webRtc: true,
		workers: true,
		indexedDb: true,
		webGpu: { supported: true, adapterAvailable: true },
		clipboard: { readText: true, writeText: true, readPermission: "prompt", writePermission: "granted" },
		media: { getUserMedia: true, enumerateDevices: true, audioInputsListed: 1, videoInputsListed: 1, cameraPermission: "prompt", microphonePermission: "denied" },
		notifications: { supported: true, permission: "prompt" },
		storage: { supported: true, usageBytes: 1024, quotaBytes: 2048 },
	},
} as const;

describe("Browser Capability Tester", () => {
	it("shows browser, display, and API information without asking for permissions", async () => {
		mockCollect.mockResolvedValue(sampleReport);
		render(<BrowserCapabilityTool />);
		expect(await screen.findByText("Firefox 132")).toBeTruthy();
		expect(screen.getByText("1920 × 1080 px")).toBeTruthy();
		expect(screen.getByText(/no stream is requested/i)).toBeTruthy();
		expect(screen.getByText(/clipboard is never read/i)).toBeTruthy();
		expect(screen.getByText("Adapter found")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Download report" })).toBeTruthy();
	});

	it("refreshes checks and downloads a JSON diagnostic", async () => {
		mockCollect.mockResolvedValue(sampleReport);
		const createObjectURL = vi.fn(() => "blob:diagnostic");
		const revokeObjectURL = vi.fn();
		const OriginalURL = URL;
		class MockURL extends OriginalURL {
			static createObjectURL = createObjectURL;
			static revokeObjectURL = revokeObjectURL;
		}
		vi.stubGlobal("URL", MockURL);
		const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
		render(<BrowserCapabilityTool />);
		await screen.findByText("Firefox 132");
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() => expect(mockCollect).toHaveBeenCalledTimes(2));
		await waitFor(() => expect((screen.getByRole("button", { name: "Download report" }) as HTMLButtonElement).disabled).toBe(false));
		fireEvent.click(screen.getByRole("button", { name: "Download report" }));
		expect(anchorClick).toHaveBeenCalledTimes(1);
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:diagnostic");
	});
});
