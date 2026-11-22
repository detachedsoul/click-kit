#!/usr/bin/env node
/**
 * Turn git history into a changelog.
 *
 * Every non-merge commit becomes one entry, grouped by the day it landed and
 * bucketed into Added / Changed / Fixed / Maintenance from its conventional
 * commit type. Output goes to lib/changelog.generated.json (rendered at
 * /changelog) and CHANGELOG.md (for the repository).
 *
 * Usage: node scripts/build-changelog.mjs           # rewrite generated notes
 *        node scripts/build-changelog.mjs --check   # fail when generated notes are stale
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_URL = "https://github.com/detachedsoul/click-kit";

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

const GROUPS = {
	feat: "Added",
	perf: "Changed",
	refine: "Changed",
	refactor: "Changed",
	style: "Changed",
	fix: "Fixed",
	docs: "Maintenance",
	chore: "Maintenance",
	test: "Maintenance",
	build: "Maintenance",
	ci: "Maintenance",
};

const GROUP_ORDER = ["Added", "Changed", "Fixed", "Maintenance"];

const raw = git(["log", "--no-merges", "--format=%H%x1f%cI%x1f%s"]).split("\n").filter(Boolean);

const entries = raw.map((line) => {
	const [hash, iso, subject] = line.split("\x1f");
	const match = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/u.exec(subject ?? "");
	const type = match ? match[1].toLowerCase() : "chore";
	return {
		hash: hash.slice(0, 7),
		date: (iso ?? "").slice(0, 10),
		type,
		scope: match?.[2] ?? "",
		summary: match ? match[3] : (subject ?? "").trim(),
		group: GROUPS[type] ?? "Changed",
	};
});

// A generated-changelog commit cannot list itself without making the output stale immediately.
const meaningful = entries.filter((entry) =>
	entry.summary.length > 0 &&
	!(entry.scope.toLowerCase() === "changelog" && ["docs", "chore"].includes(entry.type)) &&
	!/^merge /iu.test(entry.summary),
);

const releases = [...new Set(meaningful.map((entry) => entry.date))]
	.sort((left, right) => right.localeCompare(left))
	.map((date) => ({
		date,
		groups: GROUP_ORDER.map((group) => ({ group, entries: meaningful.filter((entry) => entry.date === date && entry.group === group) })).filter((group) => group.entries.length > 0),
	}));

const generatedJson = `${JSON.stringify({ releases }, null, 2)}\n`;

const longDate = (iso) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

const markdown = [
	"# Changelog",
	"",
	"Every change to ClickKit, newest first. Generated from git history with `npm run changelog` — do not edit by hand.",
	"",
	...releases.flatMap((release) => [
		`## ${longDate(release.date)}`,
		"",
		...release.groups.flatMap((group) => [
			`### ${group.group}`,
			"",
			...group.entries.map((entry) => `- ${entry.scope ? `**${entry.scope}** — ` : ""}${entry.summary} ([${entry.hash}](${REPO_URL}/commit/${entry.hash}))`),
			"",
		]),
	]),
].join("\n");

const generatedMarkdown = `${markdown.trimEnd()}\n`;
const generatedJsonPath = join(root, "lib", "changelog.generated.json");
const generatedMarkdownPath = join(root, "CHANGELOG.md");

if (process.argv.includes("--check")) {
	const jsonMatches = readFileSync(generatedJsonPath, "utf8") === generatedJson;
	const markdownMatches = readFileSync(generatedMarkdownPath, "utf8") === generatedMarkdown;
	if (!jsonMatches || !markdownMatches) {
		console.error("Generated changelog is stale. Run `npm run changelog`, then commit CHANGELOG.md and lib/changelog.generated.json.");
		process.exit(1);
	}
	console.log("Generated changelog matches commit history.");
} else {
	writeFileSync(generatedJsonPath, generatedJson);
	writeFileSync(generatedMarkdownPath, generatedMarkdown);
	console.log(`Wrote ${meaningful.length} entries across ${releases.length} release day(s).`);
}
