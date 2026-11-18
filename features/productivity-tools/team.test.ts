import { describe, expect, it } from "vitest";
import { dedupeNames, parseNames, splitTeams, teamSummary, teamsAsText } from "@/features/productivity-tools/team-utils";

const names = ["Ada", "Grace", "Alan", "Linus", "Margaret", "Katherine", "Tim"];

describe("team splitter", () => {
	it("parses and de-duplicates pasted names", () => {
		expect(parseNames("Ada\nGrace, Alan; Linus")).toEqual(["Ada", "Grace", "Alan", "Linus"]);
		expect(parseNames("  Ada   Lovelace \n\n Ada Lovelace ")).toEqual(["Ada Lovelace", "Ada Lovelace"]);
		expect(dedupeNames(parseNames("Ada\nADA\ngrace"))).toEqual(["Ada", "grace"]);
		expect(dedupeNames(["ada", "Ada", "Grace"])).toEqual(["ada", "Grace"]);
	});

	it("deals a balanced team count", () => {
		const teams = splitTeams(names, { mode: "teams", value: 3 }, () => 0.42);
		expect(teams).toHaveLength(3);
		expect(teamSummary(teams)).toEqual({ teams: 3, people: 7, largest: 3, smallest: 2 });
		expect(teams.map((team) => team.members.length).sort()).toEqual([2, 2, 3]);
		const everyone = teams.flatMap((team) => team.members).sort();
		expect(everyone).toEqual([...names].sort());
	});

	it("deals by team size", () => {
		const teams = splitTeams(names, { mode: "size", value: 2 }, () => 0.1);
		expect(teams).toHaveLength(4);
		expect(teams[3].members).toHaveLength(1);
	});

	it("validates impossible splits", () => {
		expect(() => splitTeams(["Ada"], { mode: "teams", value: 1 })).toThrow(/two names/u);
		expect(() => splitTeams(names, { mode: "teams", value: 9 })).toThrow(/more teams than people/u);
		expect(() => splitTeams(names, { mode: "size", value: 0 })).toThrow(/whole numbers/u);
	});

	it("renders copyable text", () => {
		const teams = splitTeams(["Ada", "Grace"], { mode: "teams", value: 2 }, () => 0.5);
		expect(teamsAsText(teams)).toContain("Team 1 (1)");
	});
});
