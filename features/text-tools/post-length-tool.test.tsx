import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PostLengthTool } from "@/features/text-tools/post-length-tool";
import { PLATFORMS } from "@/features/text-tools/post-length-utils";

afterEach(cleanup);

describe("post length counter", () => {
	it("checks a sample post against X by default", () => {
		render(<PostLengthTool />);
		expect(screen.getByLabelText("Check against")).toHaveProperty("value", "x");
		expect(document.body.textContent).toContain("X / Twitter length");
		expect(document.body.textContent).toContain("/ 280");
	});

	it("switches platform and reports the limit", async () => {
		const user = userEvent.setup();
		render(<PostLengthTool />);
		await user.selectOptions(screen.getByLabelText("Check against"), "sms");
		expect(document.body.textContent).toContain("160");
		expect(document.body.textContent).toContain("SMS");
		expect(document.body.textContent).toMatch(/SMS part/u);
	});

	it("lists every platform it knows about", () => {
		render(<PostLengthTool />);
		for (const platform of PLATFORMS) expect(document.body.textContent).toContain(platform.label);
	});
});
