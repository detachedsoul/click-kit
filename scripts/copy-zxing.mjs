#!/usr/bin/env node
/**
 * zxing is the decoder of last resort: the browsers that do not ship `BarcodeDetector`
 * (Safari and Firefox, mostly) get this instead. It is copied out of node_modules into
 * public/zxing/ rather than bundled, so the other hundred and eighty tool pages do not
 * carry a megabyte of barcode readers they will never open.
 *
 * The page fetches it only when the browser has no detector of its own and a code needs
 * reading, which on Chrome and Android is never.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@zxing", "library", "umd", "index.min.js");
const target = join(root, "public", "zxing");

if (!existsSync(source)) {
	console.error("@zxing/library is not installed — run npm install first.");
	process.exit(1);
}

mkdirSync(target, { recursive: true });
copyFileSync(source, join(target, "index.min.js"));
console.log("Copied the zxing decoder into public/zxing/");
