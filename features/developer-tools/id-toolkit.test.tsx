import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { IdToolkitTool } from "@/features/developer-tools/id-tool";
import { generateNanoId, generateUlid, inspectUuid, parseUlid } from "@/features/developer-tools/id-utils";

afterEach(cleanup);

describe("identifier toolkit", () => {
	it("identifies UUID versions, variants, and time payloads", () => {
		expect(inspectUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toMatchObject({
			version: "v4",
			variant: "RFC 4122 / RFC 9562",
			timestamp: "Not time based",
		});
		expect(inspectUuid("f47ac10b-58cc-4372-a567-0e02b2c3d479").version).toBe("v4");
		const v1 = inspectUuid("C232AB00-9414-11EC-B3C8-9F6BDECED846");
		expect(v1.version).toBe("v1");
		expect(v1.timestamp).toMatch(/^2022-02-2/u);
		const v7 = inspectUuid("01890a5d-ac96-774b-bcce-b302099a8057");
		expect(v7.version).toBe("v7");
		expect(v7.timestamp).toBe("2023-06-30T03:34:18.518Z");
	});

	it("handles nil and brace-wrapped UUIDs", () => {
		expect(inspectUuid("00000000-0000-0000-0000-000000000000")).toMatchObject({ version: "Nil (v0)", isNil: true, timestamp: "None" });
		expect(inspectUuid("{3f2504e0-4f89-41d3-9a0c-0305e82c3301}").uuid).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
	});

	it("generates and parses ULIDs with a stable timestamp", () => {
		const bytes = new Uint8Array(16).fill(0);
		const generated = generateUlid(Date.parse("2024-06-01T12:00:00.000Z"), bytes);
		expect(generated.ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/u);
		expect(generated.randomness).toBe("0".repeat(16));
		expect(parseUlid(generated.ulid)).toMatchObject({
			timestamp: "2024-06-01T12:00:00.000Z",
			milliseconds: String(Date.parse("2024-06-01T12:00:00.000Z")),
		});
		expect(generateUlid(1_700_000_000_000, bytes).ulid).toBe(generateUlid(1_700_000_000_000, bytes).ulid);
		const random = generateUlid();
		expect(random.ulid).toHaveLength(26);
		expect(parseUlid(random.ulid).ulid).toBe(random.ulid);
	});

	it("generates NanoIDs with the requested length and alphabet", () => {
		const value = generateNanoId(12);
		expect(value).toHaveLength(12);
		expect(/^[A-Za-z0-9_-]+$/u.test(value)).toBe(true);
		expect(generateNanoId(6, "abc")).toMatch(/^[abc]{6}$/u);
		expect(generateNanoId(5, "ab", (max) => max - 1)).toBe("bbbbb");
	});

	it("rejects malformed identifiers", () => {
		expect(() => inspectUuid("nope")).toThrow(/8-4-4-4-12/u);
		expect(() => parseUlid("short")).toThrow(/26 Crockford/u);
		expect(() => parseUlid("01HZX8N5R3K8ZQ2W7YV4T6B9CI")).toThrow(/cannot contain I, L, O, or U/u);
		expect(() => generateNanoId(0)).toThrow(/1 to 128/u);
		expect(() => generateNanoId(10, "a")).toThrow(/two distinct/u);
		expect(() => generateNanoId(10, "a b")).toThrow(/whitespace/u);
		expect(() => generateUlid(-1)).toThrow(/Unix milliseconds/u);
	});

	it("switches between identifier types in the UI", async () => {
		const user = userEvent.setup();
		render(<IdToolkitTool />);
		expect(screen.getByText("v4")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "ULID" }));
		expect((screen.getByLabelText("ULID") as HTMLInputElement).value).toHaveLength(26);
		await user.click(screen.getByRole("button", { name: "Generate now" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toHaveLength(26);
		await user.click(screen.getByRole("button", { name: "NanoID" }));
		fireEvent.change(screen.getByLabelText("Length"), { target: { value: "8" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toHaveLength(8);
	});
});
