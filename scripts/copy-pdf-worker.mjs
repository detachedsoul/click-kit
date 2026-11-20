#!/usr/bin/env node
/**
 * pdf.js needs a few of its own files served next to the app: the worker that does the
 * parsing, the standard font programs (so a PDF that relies on Helvetica still draws
 * text), the CJK character maps, and the small wasm decoders for JBIG2/JPEG 2000.
 *
 * They are copied out of node_modules into public/pdfjs/ on install and before a build,
 * so nothing about the deploy depends on a bundler rule we do not control.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist");
const target = join(root, "public", "pdfjs");

if (!existsSync(source)) {
	console.error("pdfjs-dist is not installed — run npm install first.");
	process.exit(1);
}

mkdirSync(target, { recursive: true });
const jobs = [
	["build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
	["standard_fonts", "standard_fonts"],
	["cmaps", "cmaps"],
	["wasm", "wasm"],
];
for (const [from, to] of jobs) {
	const src = join(source, from);
	if (!existsSync(src)) {
		console.error(`pdfjs-dist is missing ${from} — try a fresh install.`);
		process.exit(1);
	}
	cpSync(src, join(target, to), { recursive: true });
}
console.log("Copied the pdf.js worker, fonts, cmaps, and wasm into public/pdfjs/");
