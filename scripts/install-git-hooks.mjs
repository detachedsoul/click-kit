#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

try {
	if (resolve(git(["rev-parse", "--show-toplevel"])) !== root) {
		console.log("Skipping local Git hook setup: this is not the repository root.");
		process.exit(0);
	}

	let hooksPath = "";
	try {
		hooksPath = git(["config", "--local", "--get", "core.hooksPath"]);
	} catch {
		// No local hooks directory has been configured yet.
	}

	if (hooksPath && hooksPath !== ".githooks") {
		console.warn(`Skipping local Git hook setup: core.hooksPath is already set to ${hooksPath}.`);
		process.exit(0);
	}

	if (!hooksPath) git(["config", "--local", "core.hooksPath", ".githooks"]);
	console.log("Installed repository post-commit changelog check.");
} catch {
	console.log("Skipping local Git hook setup: Git metadata is unavailable.");
}
