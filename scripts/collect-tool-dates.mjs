#!/usr/bin/env node
/**
 * Track when each tool first appeared in the catalogue.
 *
 * The date comes from git history rather than a hand-written field: for every
 * commit that touched `lib/tools.ts`, we note which tool ids it introduced.
 * Tools that were already in the repository's first commit are marked `null`
 * ("before tracking started") so a fresh clone does not label the whole
 * catalogue as new.
 *
 * Usage:
 *   node scripts/collect-tool-dates.mjs           # rewrite lib/tool-dates.generated.json
 *   node scripts/collect-tool-dates.mjs --check   # exit 1 if the file is stale
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(root, "lib", "tool-dates.generated.json");
const ID_PATTERN = /\bid: "([a-z0-9][a-z0-9-]*)"/gu;

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

/** Only the tools array counts — the categories above it use the same `id` key. */
const toolsBlock = (source) => {
	const start = source.indexOf("export const tools");
	return start === -1 ? source : source.slice(start);
};

const slugsIn = (source) => {
	const found = new Set();
	for (const match of toolsBlock(source).matchAll(ID_PATTERN)) found.add(match[1]);
	return found;
};

const catalogue = readFileSync(join(root, "lib", "tools.ts"), "utf8");
const slugs = [...slugsIn(catalogue)].sort();

const commits = git(["log", "--reverse", "--format=%H|%cI", "--", "lib/tools.ts"])
	.split("\n")
	.filter(Boolean)
	.map((line) => {
		const [hash, iso] = line.split("|");
		return { hash, date: iso.slice(0, 10) };
	});

const rootCommits = new Set(git(["rev-list", "--max-parents=0", "HEAD"]).split("\n").filter(Boolean));

const firstSeen = new Map();
for (const commit of commits) {
	const source = git(["show", `${commit.hash}:lib/tools.ts`]);
	for (const slug of slugsIn(source)) if (!firstSeen.has(slug)) firstSeen.set(slug, commit);
}

const firstTracked = commits.find((commit) => !rootCommits.has(commit.hash)) ?? commits[commits.length - 1];
const trackedSince = firstTracked ? firstTracked.date : new Date().toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

const dates = {};
const introduced = [];
for (const slug of slugs) {
	const commit = firstSeen.get(slug);
	if (!commit) {
		// Added in the working tree, before the commit that will carry it.
		dates[slug] = today;
		introduced.push({ slug, date: today, hash: "(uncommitted)" });
		continue;
	}
	if (rootCommits.has(commit.hash) || commit.date < trackedSince) {
		dates[slug] = null;
		continue;
	}
	dates[slug] = commit.date;
	introduced.push({ slug, date: commit.date, hash: commit.hash.slice(0, 7) });
}

const payload = `${JSON.stringify({ trackedSince, dates }, null, 2)}\n`;
const previous = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";

if (process.argv.includes("--check")) {
	if (previous !== payload) {
		console.error("lib/tool-dates.generated.json is stale. Run: npm run tool-dates");
		process.exit(1);
	}
	console.log("Tool dates are up to date.");
	process.exit(0);
}

writeFileSync(OUTPUT, payload);
console.log(`Tracked ${slugs.length} tools, ${introduced.length} added since ${trackedSince}.`);
for (const item of introduced) console.log(`  ${item.date}  ${item.slug}  ${item.hash}`);
