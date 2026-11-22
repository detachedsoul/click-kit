import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const target = join(root, "public", "ffmpeg");

await mkdir(target, { recursive: true });
const ffmpegPackage = join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "umd");
await Promise.all([
	copyFile(join(source, "ffmpeg-core.js"), join(target, "ffmpeg-core.js")),
	copyFile(join(source, "ffmpeg-core.wasm"), join(target, "ffmpeg-core.wasm")),
	copyFile(join(ffmpegPackage, "ffmpeg.js"), join(target, "ffmpeg.js")),
	copyFile(join(ffmpegPackage, "814.ffmpeg.js"), join(target, "814.ffmpeg.js")),
]);
console.log("Copied the FFmpeg WebAssembly runtime and worker to public/ffmpeg.");
