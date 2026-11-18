import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { cleanInvisible, hexCode, scanInvisible } from "@/features/text-tools/invisible-utils";
import { InvisibleTool } from "@/features/text-tools/invisible-tool";

afterEach(cleanup);

describe("invisible character scanner", () => {
	it("finds zero-width, exotic space, and soft hyphen characters", () => {
		const scan = scanInvisible("Hi\u200Bthere\u00A0friend\u00ADly");
		expect(scan.total).toBe(3);
		expect(scan.visible).toBe(15);
		expect(scan.totals.map((item) => [item.code, item.count])).toEqual([
			[0x200b, 1],
			[0x00a0, 1],
			[0x00ad, 1],
		].sort((left, right) => left[0] - right[0]) as number[][]);
	});

	it("reports line and column positions", () => {
		const scan = scanInvisible("first\nsecond\u200Bline");
		expect(scan.findings[0]).toMatchObject({ line: 2, column: 7, code: 0x200b, category: "zero-width" });
		expect(scan.lines).toBe(2);
	});

	it("labels bidi controls and formats code points", () => {
		expect(scanInvisible("a\u202Eb").findings[0].label).toBe("Right-to-left override");
		expect(hexCode(0x200b)).toBe("U+200B");
		expect(hexCode(0x00a0)).toBe("U+00A0");
	});

	it("cleans text while keeping tabs and line breaks", () => {
		expect(cleanInvisible("Hello\u200B world\u00A0today")).toBe("Hello world today");
		expect(cleanInvisible("soft\u00ADhyphen")).toBe("softhyphen");
		expect(cleanInvisible("keep\ttabs\nand lines\u202E")).toBe("keep\ttabs\nand lines");
		expect(cleanInvisible("wide\u3000space", { spacesToSpaces: false })).toBe("widespace");
		expect(cleanInvisible("multi   space")).toBe("multi space");
	});

	it("reports a clean sample in the UI", async () => {
		const user = userEvent.setup();
		render(<InvisibleTool />);
		const report = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(report()).toContain("Invisible characters: 4");
		expect(report()).toContain("U+200B");
		expect((screen.getByLabelText("Cleaned text") as HTMLTextAreaElement).value).toContain("Hello world —");
		await user.clear(screen.getByLabelText("Text to scan"));
		expect(screen.getByRole("alert").textContent).toContain("Paste some text");
	});
});
