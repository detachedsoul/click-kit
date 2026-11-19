export type PngIcon = { size: number; bytes: Uint8Array };

/** Sizes that make sense as standalone PNG icons (Apple touch icon and Android/PWA). */
export const PNG_ICON_SIZES = [180, 192, 512];
/** Sizes that go inside favicon.ico. Browsers pick the closest one. */
export const ICO_ICON_SIZES = [16, 32, 48];

/** Standard ICO names, kept next to the builder so the UI and tests agree. */
export const ICO_FILE_NAME = "favicon.ico";

/**
 * Build a multi-size .ico that stores PNG payloads (supported by every browser
 * that matters today). No image re-encoding happens here.
 */
export const buildIco = (icons: PngIcon[]) => {
	if (icons.length === 0) throw new Error("Choose at least one icon size.");
	if (icons.length > 64) throw new Error("An icon file can hold at most 64 images.");
	const headerSize = 6 + icons.length * 16;
	const total = icoByteLength(icons);
	const output = new Uint8Array(total);
	const view = new DataView(output.buffer);
	view.setUint16(0, 0, true);
	view.setUint16(2, 1, true);
	view.setUint16(4, icons.length, true);
	let dataOffset = headerSize;
	icons.forEach((icon, index) => {
		const entry = 6 + index * 16;
		// 256px and larger are stored as 0 in the ICO directory.
		output[entry] = icon.size >= 256 ? 0 : icon.size;
		output[entry + 1] = icon.size >= 256 ? 0 : icon.size;
		output[entry + 2] = 0;
		output[entry + 3] = 0;
		view.setUint16(entry + 4, 1, true);
		view.setUint16(entry + 6, 32, true);
		view.setUint32(entry + 8, icon.bytes.length, true);
		view.setUint32(entry + 12, dataOffset, true);
		output.set(icon.bytes, dataOffset);
		dataOffset += icon.bytes.length;
	});
	return output;
};

/** Byte length of the icon file that `buildIco` would produce, without building it. */
export const icoByteLength = (icons: PngIcon[]) => 6 + icons.length * 16 + icons.reduce((sum, icon) => sum + icon.bytes.length, 0);

/** The link tags a site needs for a full icon set. */
export const faviconHtmlSnippet = () =>
	[
		'<link rel="icon" href="/favicon.ico" sizes="any">',
		'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
		'<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">',
		'<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">',
		'<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
	].join("\n");

/** A minimal web app manifest that points at the PNG icons. */
export const webManifestSnippet = () =>
	JSON.stringify(
		{
			icons: [
				{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
				{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
			],
		},
		null,
		2,
	);

/** A short, copyable summary of the icons that were generated. */
export const iconSummary = (icons: { size: number; bytes: { length?: number; size?: number } }[]) =>
	icons.map((icon) => `${icon.size} × ${icon.size} px · ${((icon.bytes.size ?? icon.bytes.length ?? 0) / 1024).toFixed(1)} kB`).join("\n");
