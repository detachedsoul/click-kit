export type FileKind = "image" | "video" | "audio" | "document" | "archive" | "font" | "code" | "text" | "executable" | "data" | "unknown";

export type DetectedType = {
	mime: string;
	extension: string;
	label: string;
	kind: FileKind;
};

export type FileIdentity = {
	detected: DetectedType | null;
	declaredExtension: string;
	declaredMime: string;
	matches: boolean | null;
	note: string;
};

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
	signature.every((value, index) => bytes[offset + index] === value);

const startsWithText = (bytes: Uint8Array, text: string, offset = 0) => startsWith(bytes, ascii(text), offset);

type Signature = DetectedType & { test: (bytes: Uint8Array) => boolean };

const SIGNATURES: Signature[] = [
	{ label: "PNG image", mime: "image/png", extension: "png", kind: "image", test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
	{ label: "JPEG image", mime: "image/jpeg", extension: "jpg", kind: "image", test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
	{ label: "GIF image", mime: "image/gif", extension: "gif", kind: "image", test: (b) => startsWithText(b, "GIF87a") || startsWithText(b, "GIF89a") },
	{ label: "WebP image", mime: "image/webp", extension: "webp", kind: "image", test: (b) => startsWithText(b, "RIFF") && startsWithText(b, "WEBP", 8) },
	{ label: "AVIF image", mime: "image/avif", extension: "avif", kind: "image", test: (b) => startsWithText(b, "ftypavif", 4) || startsWithText(b, "ftypavis", 4) },
	{ label: "HEIC image", mime: "image/heic", extension: "heic", kind: "image", test: (b) => ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].some((brand) => startsWithText(b, `ftyp${brand}`, 4)) },
	{ label: "BMP image", mime: "image/bmp", extension: "bmp", kind: "image", test: (b) => startsWithText(b, "BM") },
	{ label: "TIFF image", mime: "image/tiff", extension: "tif", kind: "image", test: (b) => startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a]) },
	{ label: "ICO icon", mime: "image/x-icon", extension: "ico", kind: "image", test: (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]) },
	{ label: "PDF document", mime: "application/pdf", extension: "pdf", kind: "document", test: (b) => startsWithText(b, "%PDF") },
	{ label: "ZIP archive", mime: "application/zip", extension: "zip", kind: "archive", test: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]) },
	{ label: "Gzip archive", mime: "application/gzip", extension: "gz", kind: "archive", test: (b) => startsWith(b, [0x1f, 0x8b]) },
	{ label: "Bzip2 archive", mime: "application/x-bzip2", extension: "bz2", kind: "archive", test: (b) => startsWithText(b, "BZh") },
	{ label: "XZ archive", mime: "application/x-xz", extension: "xz", kind: "archive", test: (b) => startsWith(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) },
	{ label: "7-Zip archive", mime: "application/x-7z-compressed", extension: "7z", kind: "archive", test: (b) => startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) },
	{ label: "RAR archive", mime: "application/vnd.rar", extension: "rar", kind: "archive", test: (b) => startsWithText(b, "Rar!\u001a\u0007") },
	{ label: "Zstandard archive", mime: "application/zstd", extension: "zst", kind: "archive", test: (b) => startsWith(b, [0x28, 0xb5, 0x2f, 0xfd]) },
	{ label: "TAR archive", mime: "application/x-tar", extension: "tar", kind: "archive", test: (b) => startsWithText(b, "ustar", 257) },
	{ label: "SQLite database", mime: "application/vnd.sqlite3", extension: "sqlite", kind: "data", test: (b) => startsWithText(b, "SQLite format 3\u0000") },
	{ label: "MP3 audio", mime: "audio/mpeg", extension: "mp3", kind: "audio", test: (b) => startsWithText(b, "ID3") || startsWith(b, [0xff, 0xfb]) || startsWith(b, [0xff, 0xf3]) },
	{ label: "WAV audio", mime: "audio/wav", extension: "wav", kind: "audio", test: (b) => startsWithText(b, "RIFF") && startsWithText(b, "WAVE", 8) },
	{ label: "OGG media", mime: "audio/ogg", extension: "ogg", kind: "audio", test: (b) => startsWithText(b, "OggS") },
	{ label: "FLAC audio", mime: "audio/flac", extension: "flac", kind: "audio", test: (b) => startsWithText(b, "fLaC") },
	{ label: "MP4 video", mime: "video/mp4", extension: "mp4", kind: "video", test: (b) => ["isom", "iso2", "mp41", "mp42", "avc1", "dash"].some((brand) => startsWithText(b, `ftyp${brand}`, 4)) },
	{ label: "QuickTime video", mime: "video/quicktime", extension: "mov", kind: "video", test: (b) => startsWithText(b, "ftypqt", 4) || startsWithText(b, "moov", 4) },
	{ label: "WebM video", mime: "video/webm", extension: "webm", kind: "video", test: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]) },
	{ label: "WOFF font", mime: "font/woff", extension: "woff", kind: "font", test: (b) => startsWithText(b, "wOFF") },
	{ label: "WOFF2 font", mime: "font/woff2", extension: "woff2", kind: "font", test: (b) => startsWithText(b, "wOF2") },
	{ label: "TrueType font", mime: "font/ttf", extension: "ttf", kind: "font", test: (b) => startsWith(b, [0x00, 0x01, 0x00, 0x00]) || startsWithText(b, "true") },
	{ label: "OpenType font", mime: "font/otf", extension: "otf", kind: "font", test: (b) => startsWithText(b, "OTTO") },
	{ label: "ELF binary", mime: "application/x-elf", extension: "elf", kind: "executable", test: (b) => startsWith(b, [0x7f, 0x45, 0x4c, 0x46]) },
	{ label: "Windows executable", mime: "application/vnd.microsoft.portable-executable", extension: "exe", kind: "executable", test: (b) => startsWithText(b, "MZ") },
	{ label: "Mach-O binary", mime: "application/x-mach-binary", extension: "macho", kind: "executable", test: (b) => startsWith(b, [0xfe, 0xed, 0xfa, 0xce]) || startsWith(b, [0xcf, 0xfa, 0xed, 0xfe]) || startsWith(b, [0xca, 0xfe, 0xba, 0xbe]) },
];

const COMPATIBLE_EXTENSIONS: Record<string, string[]> = {
	jpg: ["jpg", "jpeg", "jpe", "jfif"],
	tif: ["tif", "tiff"],
	zip: ["zip", "docx", "xlsx", "pptx", "odt", "ods", "odp", "jar", "apk", "epub", "whl"],
	gz: ["gz", "tgz"],
	bz2: ["bz2", "tbz", "tbz2"],
	xz: ["xz", "txz"],
	mp3: ["mp3"],
	mp4: ["mp4", "m4v", "m4a"],
	mov: ["mov", "qt"],
	ogg: ["ogg", "oga", "ogv", "opus"],
	webm: ["webm", "mkv"],
	sqlite: ["sqlite", "sqlite3", "db", "db3"],
	exe: ["exe", "dll", "sys"],
	heim: ["heic", "heif"],
	heic: ["heic", "heif"],
	elf: ["elf", "so", "bin"],
	bmp: ["bmp", "dib"],
	svg: ["svg"],
	json: ["json", "jsonc", "geojson", "ndjson"],
	txt: ["txt", "text", "log", "md", "markdown", "csv", "tsv", "ini", "cfg", "conf", "env", "yml", "yaml", "toml", "srt", "vtt"],
	html: ["html", "htm", "xhtml"],
	xml: ["xml", "rss", "atom", "plist", "svg"],
	js: ["js", "mjs", "cjs", "jsx"],
	ts: ["ts", "mts", "cts", "tsx"],
	css: ["css", "scss", "sass", "less"],
	sh: ["sh", "bash", "zsh", "command"],
};

export const extensionOf = (fileName: string) => {
	const match = /\.([A-Za-z0-9]+)$/u.exec(fileName.trim());
	return match ? match[1].toLowerCase() : "";
};

const decoder = new TextDecoder("utf-8", { fatal: true });

/** Text bytes plus a best guess at which dialect of text they are. */
export const sniffText = (bytes: Uint8Array): DetectedType | null => {
	const sample = bytes.subarray(0, 4096);
	if (sample.some((byte) => byte === 0)) return null;
	let text = "";
	try {
		text = decoder.decode(sample);
	} catch {
		return null;
	}
	const controlChars = Array.from(text).filter((character) => character.charCodeAt(0) < 32 && !"\t\n\r".includes(character)).length;
	if (controlChars / Math.max(1, text.length) > 0.02) return null;
	const trimmed = text.trimStart();
	if (!trimmed) return { label: "Empty or whitespace file", mime: "text/plain", extension: "txt", kind: "text" };
	if (/^<\?xml/iu.test(trimmed) && /<svg[\s>]/iu.test(trimmed)) return { label: "SVG vector image", mime: "image/svg+xml", extension: "svg", kind: "image" };
	if (/^<\?xml/iu.test(trimmed)) return { label: "XML document", mime: "application/xml", extension: "xml", kind: "document" };
	if (/^<!doctype html|^<html[\s>]/iu.test(trimmed) || (/^<(?:head|body|div|main|p|section)[\s>]/iu.test(trimmed))) {
		return { label: "HTML document", mime: "text/html", extension: "html", kind: "document" };
	}
	if (/^[[{]/u.test(trimmed)) {
		try {
			JSON.parse(text);
			return { label: "JSON data", mime: "application/json", extension: "json", kind: "data" };
		} catch {
			return { label: "JSON-like text", mime: "application/json", extension: "json", kind: "data" };
		}
	}
	if (/^(?:\uFEFF)?#!\/usr\/bin\/env\s+\w+/u.test(trimmed) || /^(?:npm|yarn|pnpm|node|git)\s+\w+/u.test(trimmed)) {
		return { label: "Shell script", mime: "application/x-sh", extension: "sh", kind: "code" };
	}
	if (/^(?:import|export|const|let|var|function|class)\s/mu.test(trimmed) && /[;{}]/u.test(trimmed)) {
		return { label: "Source code", mime: "text/plain", extension: "txt", kind: "code" };
	}
	const lines = text.split(/\r?\n/u).filter((line) => line.trim());
	if (lines.length >= 2 && lines.every((line) => line.includes(",") && line.split(",").length === lines[0].split(",").length)) {
		return { label: "CSV text", mime: "text/csv", extension: "csv", kind: "data" };
	}
	return { label: "Plain text", mime: "text/plain", extension: "txt", kind: "text" };
};

/** Work out what a file really is from its first bytes, and whether the name agrees. */
export const identifyFile = (bytes: Uint8Array, fileName = "", declaredMime = ""): FileIdentity => {
	const declaredExtension = extensionOf(fileName);
	const signature = SIGNATURES.find((entry) => entry.test(bytes));
	const detected = signature ? { label: signature.label, mime: signature.mime, extension: signature.extension, kind: signature.kind } : sniffText(bytes);
	const compatible = detected ? (COMPATIBLE_EXTENSIONS[detected.extension] ?? [detected.extension]) : [];
	const matches = detected && declaredExtension ? compatible.includes(declaredExtension) : null;
	const notes: string[] = [];
	if (detected?.extension === "zip") notes.push("ZIP containers also carry .docx, .xlsx, .pptx, .jar, .apk, and .epub files.");
	if (detected?.kind === "text" && declaredMime && !declaredMime.startsWith("text/")) notes.push("The browser thought this was binary, but the bytes are plain text.");
	if (!declaredExtension && detected) notes.push("This file has no extension in its name.");
	if (matches === false) notes.push(`Renaming a ${detected?.label.toLowerCase() ?? "file"} to .${declaredExtension} does not change its contents.`);
	return {
		detected,
		declaredExtension,
		declaredMime,
		matches,
		note: notes.join(" "),
	};
};

/** A short hex + ASCII dump, one line per 16 bytes. */
export const hexDump = (bytes: Uint8Array, limit = 128) => {
	const slice = bytes.subarray(0, limit);
	const lines: string[] = [];
	for (let offset = 0; offset < slice.length; offset += 16) {
		const chunk = slice.subarray(offset, offset + 16);
		const hex = Array.from(chunk, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
		const asciiText = Array.from(chunk, (byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".")).join("");
		lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex.padEnd(47, " ")}  ${asciiText}`);
	}
	return lines.join("\n");
};
