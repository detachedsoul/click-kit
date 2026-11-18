import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { generateFixtures, hashSeed, makeRandom } from "@/features/developer-tools/fixture-utils";
import { FixtureTool } from "@/features/developer-tools/fixture-tool";

afterEach(cleanup);

const sample = JSON.stringify({
	id: 1,
	name: "Ada Lovelace",
	email: "ada@example.com",
	website: "https://example.com",
	joinedAt: "2024-03-01T09:30:00Z",
	seats: 4,
	score: 1.5,
	active: true,
	nickname: null,
	address: { city: "Lisbon", street: "1 Alder Way" },
	tags: ["beta"],
});

type Row = Record<string, unknown>;

describe("JSON fixture generator", () => {
	it("is deterministic for a given seed", () => {
		const first = generateFixtures(sample, { count: 3, seed: "alpha" }).records as Row[];
		const second = generateFixtures(sample, { count: 3, seed: "alpha" }).records as Row[];
		const other = generateFixtures(sample, { count: 3, seed: "beta" }).records as Row[];
		expect(first).toEqual(second);
		expect(JSON.stringify(first)).not.toBe(JSON.stringify(other));
		expect(hashSeed("alpha")).not.toBe(hashSeed("beta"));
		const randomA = makeRandom("seed");
		const randomB = makeRandom("seed");
		expect([randomA(), randomA(), randomA()]).toEqual([randomB(), randomB(), randomB()]);
	});

	it("generates the requested number of records with matching shapes", () => {
		const { records } = generateFixtures(sample, { count: 25, seed: "s" });
		expect(records).toHaveLength(25);
		const first = records[0] as Row;
		expect(Object.keys(first)).toEqual(["id", "name", "email", "website", "joinedAt", "seats", "score", "active", "nickname", "address", "tags"]);
		expect(typeof first.email).toBe("string");
		expect(String(first.email)).toMatch(/@example\.(com|org|net)|@mail\.test/u);
		expect(String(first.website)).toMatch(/^https:\/\//u);
		expect(String(first.joinedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
		expect(Number.isInteger(first.seats)).toBe(true);
		expect(first.nickname).toBeNull();
		expect(typeof first.active).toBe("boolean");
		expect((first.address as Row)["city"]).toBeTruthy();
		expect(Array.isArray(first.tags)).toBe(true);
		expect(records.map((record) => (record as Row).id)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
	});

	it("produces emails, uuids, and ObjectIds from field hints", () => {
		const { records } = generateFixtures('{"user_email":"x@y.co","guid":"00000000-0000-4000-8000-000000000000","_id":"507f1f77bcf86cd799439011","phone":"+1 555 0100"}', {
			count: 2,
			seed: "x",
		});
		const first = records[0] as Row;
		expect(String(first.user_email)).toMatch(/^[a-z]+\.[a-z]+\d+@/u);
		expect(String(first.guid)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/u);
		expect(String(first._id)).toMatch(/^[0-9a-f]{24}$/u);
		expect(String(first.phone)).toMatch(/^\+1 555 \d{3} \d{4}$/u);
	});

	it("validates the sample and options", () => {
		expect(() => generateFixtures("  ")).toThrow(/Paste a JSON sample/u);
		expect(() => generateFixtures("{oops")).toThrow(/Unexpected|Expected/u);
		expect(() => generateFixtures("[1,2]")).toThrow(/Use a JSON object/u);
		expect(() => generateFixtures("[]")).toThrow(/Use a JSON object/u);
		expect(() => generateFixtures(sample, { count: 0 })).toThrow(/between 1 and 1,000/u);
		expect(() => generateFixtures(sample, { count: 5000 })).toThrow(/between 1 and 1,000/u);
	});

	it("renders fixtures and switches to JSON Lines", () => {
		render(<FixtureTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(JSON.parse(output())).toHaveLength(10);
		fireEvent.change(screen.getByLabelText("Records"), { target: { value: "2" } });
		expect(JSON.parse(output())).toHaveLength(2);
		fireEvent.click(screen.getByLabelText("Emit JSON Lines instead of a JSON array"));
		expect(output().split("\n")).toHaveLength(2);
		expect(output().split("\n")[0].startsWith("{")).toBe(true);
		fireEvent.change(screen.getByLabelText("Sample record"), { target: { value: "7" } });
		expect(screen.getByRole("alert").textContent).toContain("Use a JSON object");
	});
});
