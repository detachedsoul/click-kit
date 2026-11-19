import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompareTool } from "@/features/image-tools/compare-tool";

afterEach(cleanup);

beforeEach(() => {
	// jsdom has no pointer capture or object URLs; the drag handlers only need them to exist.
	Element.prototype.setPointerCapture = vi.fn();
	Element.prototype.releasePointerCapture = vi.fn();
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

vi.mock("@/features/image-tools/image-file-shared", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/features/image-tools/image-file-shared")>();
	return { ...actual, loadImage: vi.fn(async () => ({ naturalWidth: 800, naturalHeight: 600 }) as unknown as HTMLImageElement) };
});

const loadBoth = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("Before image"), new File([new Uint8Array([1, 2, 3])], "before.png", { type: "image/png" }));
	await user.upload(screen.getByLabelText("After image"), new File([new Uint8Array([4, 5, 6])], "after.png", { type: "image/png" }));
};

describe("comparison page", () => {
	it("starts with the divider in the middle and the export disabled", () => {
		render(<CompareTool />);
		expect(screen.getByLabelText("Before image")).toHaveProperty("type", "file");
		expect(screen.getByLabelText("After image")).toHaveProperty("type", "file");
		expect(screen.queryByLabelText(/Divider position/u)).toBeNull();
		expect(screen.getByRole("button", { name: "Side by side" })).toHaveProperty("ariaPressed", "true");
		expect(screen.getByRole("button", { name: "Export comparison" })).toHaveProperty("disabled", true);
	});

	it("offers a draggable handle instead of a slider", async () => {
		const user = userEvent.setup();
		render(<CompareTool />);
		await loadBoth(user);
		const handle = screen.getByRole("slider", { name: "Comparison divider" });
		expect(handle).toHaveProperty("ariaValueNow", "50");
		expect(handle).toHaveProperty("ariaOrientation", "horizontal");
		expect(handle).toHaveProperty("tabIndex", 0);
		expect(handle.getAttribute("title")).toBe("Drag to move the divider");
	});

	it("nudges the handle with the keyboard", async () => {
		const user = userEvent.setup();
		render(<CompareTool />);
		await loadBoth(user);
		const handle = screen.getByRole("slider", { name: "Comparison divider" });
		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "55");
		fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "45");
		fireEvent.keyDown(handle, { key: "End" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "100");
		fireEvent.keyDown(handle, { key: "Home" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "0");
		fireEvent.keyDown(handle, { key: "PageDown" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "10");
	});

	it("ignores keys that do not point along the divider", async () => {
		const user = userEvent.setup();
		render(<CompareTool />);
		await loadBoth(user);
		const handle = screen.getByRole("slider", { name: "Comparison divider" });
		fireEvent.keyDown(handle, { key: "ArrowUp" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "50");
	});

	it("switches orientation and turns the handle with it", async () => {
		const user = userEvent.setup();
		render(<CompareTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Top to bottom" }));
		expect(screen.getByRole("button", { name: "Top to bottom" })).toHaveProperty("ariaPressed", "true");
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaOrientation", "vertical");
		fireEvent.keyDown(screen.getByRole("slider", { name: "Comparison divider" }), { key: "ArrowUp" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "45");
		fireEvent.keyDown(screen.getByRole("slider", { name: "Comparison divider" }), { key: "ArrowRight" });
		expect(screen.getByRole("slider", { name: "Comparison divider" })).toHaveProperty("ariaValueNow", "45");
	});
});
