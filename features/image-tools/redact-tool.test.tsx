import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedactTool } from "@/features/image-tools/redact-tool";

afterEach(cleanup);

beforeEach(() => {
	// jsdom has no pointer capture; the drag handlers only need it to exist.
	Element.prototype.setPointerCapture = vi.fn();
	Element.prototype.releasePointerCapture = vi.fn();
});

vi.mock("@/features/image-tools/image-file-shared", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/features/image-tools/image-file-shared")>();
	return { ...actual, loadImage: vi.fn(async () => ({ naturalWidth: 800, naturalHeight: 600 }) as unknown as HTMLImageElement) };
});

const pickImage = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("Image file"), new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }));
};

describe("image redactor page", () => {
	it("starts empty with the drawing area hidden until an image is picked", () => {
		render(<RedactTool />);
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(screen.queryByRole("application")).toBeNull();
		expect(screen.queryByRole("button", { name: "Redact and download" })).toBeNull();
	});

	it("explains each redaction mode", () => {
		render(<RedactTool />);
		expect(document.body.textContent).toContain("Export re-encodes the pixels");
	});

	it("offers a working strength slider once an image is loaded", async () => {
		const user = userEvent.setup();
		render(<RedactTool />);
		await pickImage(user);
		const slider = screen.getByLabelText(/Strength for new areas/u);
		expect(slider).toHaveProperty("disabled", false);
		expect(slider).toHaveProperty("value", "60");
		fireEvent.change(slider, { target: { value: "90" } });
		expect(screen.getByLabelText("Strength for new areas (90%)")).toHaveProperty("value", "90");
		// The slider is usable even while new areas default to a solid block.
		expect(screen.getByLabelText("Mark areas as")).toHaveProperty("value", "solid");
	});

	it("gives each pixelated area its own strength control", async () => {
		const user = userEvent.setup();
		render(<RedactTool />);
		await pickImage(user);
		await user.selectOptions(screen.getByLabelText("Mark areas as"), "pixelate");
		const drawArea = screen.getByRole("application");
		drawArea.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
		fireEvent.pointerDown(drawArea, { clientX: 20, clientY: 20, pointerId: 1 });
		fireEvent.pointerMove(drawArea, { clientX: 220, clientY: 160, pointerId: 1 });
		fireEvent.pointerUp(drawArea, { clientX: 220, clientY: 160, pointerId: 1 });
		const perArea = await screen.findByLabelText("Strength for area 1");
		expect(perArea).toHaveProperty("value", "60");
		fireEvent.change(perArea, { target: { value: "25" } });
		expect(screen.getByLabelText("Strength for area 1")).toHaveProperty("value", "25");
	});
});
