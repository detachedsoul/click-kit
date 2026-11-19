import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/version/route";
import { buildInfo } from "@/lib/build-info";

describe("version route", () => {
	it("serves the running build and never lets it be cached", async () => {
		const response = GET();
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("no-store");
		const body = (await response.json()) as ReturnType<typeof buildInfo>;
		expect(body).toEqual(buildInfo());
	});
});
