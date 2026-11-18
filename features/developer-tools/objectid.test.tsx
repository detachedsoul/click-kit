import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { describeAge, generateObjectId, parseObjectId } from "@/features/developer-tools/objectid-utils";
import { ObjectIdTool } from "@/features/developer-tools/objectid-tool";

afterEach(cleanup);

describe("MongoDB ObjectId inspector", () => {
	it("decodes the timestamp, random part, and counter", () => {
		const info = parseObjectId("507f1f77bcf86cd799439011");
		expect(info.timestamp.toISOString()).toBe("2012-10-17T21:13:27.000Z");
		expect(info.random).toBe("bcf86cd799");
		expect(info.counter).toBe(0x439011);
		expect(info.canonical).toBe('ObjectId("507f1f77bcf86cd799439011")');
	});

	it("accepts wrappers, quotes, and upper case", () => {
		expect(parseObjectId("ObjectId('507F1F77BCF86CD799439011')").hex).toBe("507f1f77bcf86cd799439011");
		expect(parseObjectId('{"_id":"507f1f77bcf86cd799439012"}').hex).toBe("507f1f77bcf86cd799439012");
	});

	it("rejects empty or malformed ids", () => {
		expect(() => parseObjectId("  ")).toThrow(/Paste an ObjectId/u);
		expect(() => parseObjectId("not-an-id")).toThrow(/24 hexadecimal/u);
		expect(() => parseObjectId("507f1f77bcf86cd79943901")).toThrow(/24 hexadecimal/u);
	});

	it("generates round-trippable ids for a timestamp", () => {
		const date = new Date("2024-05-01T12:00:00Z");
		const id = generateObjectId(date);
		expect(id).toHaveLength(24);
		expect(id).toMatch(/^[0-9a-f]{24}$/u);
		expect(parseObjectId(id).timestamp.toISOString()).toBe("2024-05-01T12:00:00.000Z");
		expect(() => generateObjectId(new Date(Number.NaN))).toThrow(/valid date/u);
	});

	it("describes ages in readable units", () => {
		const now = new Date("2024-05-02T00:00:00Z");
		expect(describeAge(new Date("2024-05-01T23:59:30Z"), now)).toBe("30 seconds ago");
		expect(describeAge(new Date("2024-05-01T23:30:00Z"), now)).toBe("30 minutes ago");
		expect(describeAge(new Date("2024-05-01T00:00:00Z"), now)).toBe("1 day ago");
		expect(describeAge(new Date("2022-05-02T00:00:00Z"), now)).toBe("2 years ago");
		expect(describeAge(new Date("2024-05-02T00:01:00Z"), now)).toBe("in 60 seconds");
	});

	it("renders decoded details and generated ids", () => {
		render(<ObjectIdTool />);
		expect(screen.getByLabelText("Result")).toBeTruthy();
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("2012-10-17T21:13:27.000Z");
		fireEvent.change(screen.getByLabelText("MongoDB ObjectId"), { target: { value: "nope" } });
		expect(screen.getByRole("alert").textContent).toContain("24 hexadecimal");
	});
});
