export type MimeKind = "text" | "image" | "audio" | "video" | "application" | "font" | "model";

export type MimeType = { mime: string; extensions: string[]; kind: MimeKind; description: string };

type Entry = [mime: string, extensions: string, description: string];

const entries: Entry[] = [
	["application/json", "json", "JSON data"],
	["application/ld+json", "jsonld", "JSON-LD linked data"],
	["application/manifest+json", "webmanifest", "Web app manifest"],
	["application/xml", "xml xsl xsd", "XML document"],
	["application/xhtml+xml", "xhtml", "XHTML document"],
	["application/javascript", "js mjs cjs", "JavaScript source"],
	["application/typescript", "ts mts cts", "TypeScript source"],
	["application/pdf", "pdf", "Portable Document Format"],
	["application/zip", "zip", "ZIP archive"],
	["application/gzip", "gz tgz", "Gzip archive"],
	["application/x-tar", "tar", "Tar archive"],
	["application/x-7z-compressed", "7z", "7-Zip archive"],
	["application/vnd.rar", "rar", "RAR archive"],
	["application/wasm", "wasm", "WebAssembly module"],
	["application/octet-stream", "bin exe dmg iso", "Generic binary download"],
	["application/msword", "doc", "Word 97-2003 document"],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx", "Word document"],
	["application/vnd.ms-excel", "xls", "Excel 97-2003 workbook"],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx", "Excel workbook"],
	["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx", "PowerPoint presentation"],
	["application/epub+zip", "epub", "EPUB e-book"],
	["application/rtf", "rtf", "Rich Text Format"],
	["application/graphql", "graphql gql", "GraphQL query"],
	["application/sql", "sql", "SQL script"],
	["application/x-www-form-urlencoded", "urlencoded", "Form submission body"],
	["application/x-ndjson", "ndjson jsonl", "Newline-delimited JSON"],
	["application/x-yaml", "yaml yml", "YAML document"],
	["application/toml", "toml", "TOML configuration"],
	["application/protobuf", "proto", "Protocol Buffers schema"],
	["application/x-httpd-php", "php", "PHP script"],
	["application/java-archive", "jar", "Java archive"],
	["application/x-sh", "sh bash", "Shell script"],
	["text/plain", "txt text log", "Plain text"],
	["text/html", "html htm", "HTML document"],
	["text/css", "css", "Cascading Style Sheet"],
	["text/csv", "csv", "Comma-separated values"],
	["text/tab-separated-values", "tsv", "Tab-separated values"],
	["text/markdown", "md markdown", "Markdown document"],
	["text/calendar", "ics", "iCalendar events"],
	["text/vcard", "vcf", "Contact card"],
	["text/rtf", "rtf", "Rich text"],
	["text/srt", "srt", "SubRip subtitles"],
	["image/png", "png", "PNG image"],
	["image/jpeg", "jpg jpeg jpe", "JPEG image"],
	["image/gif", "gif", "GIF image"],
	["image/webp", "webp", "WebP image"],
	["image/avif", "avif", "AVIF image"],
	["image/svg+xml", "svg", "Scalable Vector Graphics"],
	["image/bmp", "bmp", "Bitmap image"],
	["image/tiff", "tif tiff", "TIFF image"],
	["image/x-icon", "ico", "Icon file"],
	["image/heic", "heic", "HEIC photo"],
	["image/jxl", "jxl", "JPEG XL image"],
	["audio/mpeg", "mp3", "MP3 audio"],
	["audio/wav", "wav", "WAV audio"],
	["audio/ogg", "ogg oga opus", "Ogg audio"],
	["audio/flac", "flac", "FLAC audio"],
	["audio/aac", "aac", "AAC audio"],
	["audio/webm", "weba", "WebM audio"],
	["audio/midi", "mid midi", "MIDI audio"],
	["video/mp4", "mp4 m4v", "MP4 video"],
	["video/webm", "webm", "WebM video"],
	["video/ogg", "ogv", "Ogg video"],
	["video/quicktime", "mov", "QuickTime video"],
	["video/x-matroska", "mkv", "Matroska video"],
	["video/mpeg", "mpeg mpg", "MPEG video"],
	["font/woff", "woff", "WOFF font"],
	["font/woff2", "woff2", "WOFF2 font"],
	["font/ttf", "ttf", "TrueType font"],
	["font/otf", "otf", "OpenType font"],
	["font/collection", "ttc", "Font collection"],
	["model/gltf+json", "gltf", "glTF 3D model"],
	["model/gltf-binary", "glb", "Binary glTF model"],
	["model/obj", "obj", "Wavefront OBJ model"],
	["model/stl", "stl", "STL 3D model"],
	["message/rfc822", "eml", "Email message"],
	["multipart/form-data", "form-data", "File upload body"],
	["application/vnd.api+json", "api.json", "JSON:API document"],
	["application/problem+json", "problem.json", "RFC 7807 error body"],
	["application/jwt", "jwt", "JSON Web Token"],
	["application/pkcs7-signature", "p7s", "Detached signature"],
	["application/x-pem-file", "pem", "PEM certificate or key"],
	["application/pkix-cert", "cer crt", "X.509 certificate"],
	["application/x-pkcs12", "p12 pfx", "PKCS#12 bundle"],
	["application/x-msdownload", "msi msi", "Windows installer"],
	["application/vnd.apple.installer+xml", "mpkg", "Apple installer package"],
	["application/x-apple-diskimage", "dmg", "Apple disk image"],
	["application/vnd.android.package-archive", "apk", "Android package"],
	["application/x-iso9660-image", "iso", "CD/DVD image"],
	["application/vnd.oasis.opendocument.text", "odt", "OpenDocument text"],
	["application/vnd.oasis.opendocument.spreadsheet", "ods", "OpenDocument spreadsheet"],
	["application/vnd.google-earth.kml+xml", "kml", "Google Earth KML"],
	["application/vnd.ms-fontobject", "eot", "Embedded OpenType font"],
];

const kindFor = (mime: string): MimeKind => {
	if (mime.startsWith("image/")) return "image";
	if (mime.startsWith("audio/")) return "audio";
	if (mime.startsWith("video/")) return "video";
	if (mime.startsWith("font/") || mime.includes("fontobject")) return "font";
	if (mime.startsWith("model/")) return "model";
	if (mime.startsWith("text/")) return "text";
	return "application";
};

export const mimeTypes: MimeType[] = entries.map(([mime, extensions, description]) => ({
	mime,
	extensions: extensions.split(" ").filter(Boolean),
	kind: kindFor(mime),
	description,
}));

export const normaliseExtension = (input: string) => {
	const lower = input.trim().toLowerCase();
	const base = lower.split(/[\\/]/u).pop() ?? "";
	const dot = base.lastIndexOf(".");
	return dot > 0 ? base.slice(dot + 1) : base.replace(/^\./u, "");
};

export const searchMime = (query: string) => {
	const needle = query.trim().toLowerCase().replace(/^\./u, "");
	if (!needle) return mimeTypes;
	return mimeTypes.filter(
		(item) => item.mime.includes(needle) || item.description.toLowerCase().includes(needle) || item.extensions.some((extension) => extension === needle || extension.startsWith(`${needle}.`)) || item.kind === needle,
	);
};

export const lookupByExtension = (input: string) => {
	const extension = normaliseExtension(input);
	if (!extension) return null;
	return mimeTypes.find((item) => item.extensions.includes(extension)) ?? null;
};
