export type SvgOptions = {
	decimals: number;
	removeIds: boolean;
	removeMetadata: boolean;
	keepTitle: boolean;
	prettify: boolean;
};

export type SvgReport = {
	output: string;
	before: number;
	after: number;
	saved: number;
	commentCount: number;
	metadataCount: number;
	editorAttributeCount: number;
	warnings: string[];
};

const numericAttributes = new Set([
	"d",
	"points",
	"viewBox",
	"transform",
	"gradientTransform",
	"patternTransform",
	"x",
	"y",
	"x1",
	"x2",
	"y1",
	"y2",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"fx",
	"fy",
	"width",
	"height",
	"stroke-width",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-miterlimit",
	"opacity",
	"fill-opacity",
	"stroke-opacity",
	"stop-opacity",
	"offset",
	"font-size",
	"letter-spacing",
	"word-spacing",
	"startOffset",
	"stdDeviation",
	"baseFrequency",
]);

const roundNumbers = (value: string, decimals: number) => {
	const factor = 10 ** decimals;
	return value
		.replace(/-?\d*\.\d+(?:e[-+]?\d+)?/giu, (match) => {
			const rounded = Math.round(Number(match) * factor) / factor;
			return String(rounded);
		})
		.replace(/(^|[\s,])0\.(\d)/gu, "$1.$2")
		.replace(/(\d)\.0+(?=\D|$)/gu, "$1");
};

const tidyPath = (value: string) =>
	value
		.replace(/\s*,\s*/gu, ",")
		.replace(/([a-z])[\s,]+/giu, "$1")
		.replace(/\s+([a-z])/giu, "$1")
		.replace(/\s+/gu, " ")
		.replace(/(\d)\s+(-\d)/gu, "$1$2")
		.replace(/(\d)-\s+(\d)/gu, "$1-$2")
		.trim();

const editorNamespaces = ["inkscape", "sodipodi", "sketch", "figma", "adobe", "i", "graph"];

const isEditorAttribute = (name: string) =>
	editorNamespaces.some((namespace) => name.startsWith(`${namespace}:`));
// `xmlns:*` declarations for editor namespaces are dropped alongside their attributes.
const isEditorNamespace = (name: string) =>
	name.startsWith("xmlns:") && editorNamespaces.includes(name.slice(6));

const serialise = (element: Element, options: SvgOptions, counters: { editor: number }, depth: number): string => {
	const pad = options.prettify ? "\n" + "  ".repeat(depth) : "";
	const attributes: string[] = [];
	for (const attribute of Array.from(element.attributes)) {
		if (isEditorAttribute(attribute.name) || isEditorNamespace(attribute.name)) {
			counters.editor += 1;
			continue;
		}
		if (options.removeIds && attribute.name === "id" && element.tagName !== "svg") continue;
		let value = attribute.value.replace(/\s+/gu, " ").trim();
		if (numericAttributes.has(attribute.name) && Number.isFinite(options.decimals)) value = roundNumbers(value, options.decimals);
		if (attribute.name === "d") value = tidyPath(roundNumbers(value, options.decimals));
		attributes.push(`${attribute.name}="${value.replaceAll('"', "&quot;")}"`);
	}
	const open = `<${element.tagName}${attributes.length ? " " + attributes.join(" ") : ""}`;
	const children = Array.from(element.childNodes).map((child) => serialiseNode(child, options, counters, depth + 1)).filter(Boolean);
	if (children.length === 0) return `${pad}${open}/>`;
	if (!options.prettify && children.every((child) => !child.includes("<"))) return `${open}>${children.join("")}</${element.tagName}>`;
	const inner = options.prettify ? children.join("") : children.join("");
	const closePad = options.prettify ? "\n" + "  ".repeat(depth) : "";
	return `${pad}${open}>${inner}${closePad}</${element.tagName}>`;
};

const serialiseNode = (node: Node, options: SvgOptions, counters: { editor: number }, depth: number): string => {
	if (node.nodeType === Node.TEXT_NODE) {
		const raw = node.textContent ?? "";
		if (!raw.trim()) return "";
		const text = raw.replace(/\s+/gu, " ");
		return options.prettify ? `${"\n"}${"  ".repeat(depth)}${text.trim()}` : text;
	}
	if (node.nodeType !== Node.ELEMENT_NODE) return "";
	const element = node as Element;
	return serialise(element, options, counters, depth);
};

export const optimiseSvg = (source: string, options: Partial<SvgOptions> = {}): SvgReport => {
	if (!source.trim()) throw new Error("Paste SVG markup first.");
	const settings: SvgOptions = {
		decimals: 2,
		removeIds: false,
		removeMetadata: true,
		keepTitle: true,
		prettify: false,
		...options,
	};
	const parser = new DOMParser();
	const doc = parser.parseFromString(source, "image/svg+xml");
	const failure = doc.querySelector("parsererror");
	if (failure) throw new Error(`Invalid SVG: ${(failure.textContent ?? "could not parse the markup").replace(/\s+/gu, " ").trim().slice(0, 200)}`);
	const root = doc.documentElement;
	if (root.tagName.toLowerCase() !== "svg") throw new Error("The root element must be <svg>.");
	const warnings: string[] = [];
	let commentCount = 0;
	let metadataCount = 0;
	const walk = (element: Element) => {
		for (const child of Array.from(element.children)) {
			const tag = child.tagName.toLowerCase();
			if (settings.removeMetadata && (tag === "metadata" || tag === "sodipodi:namedview" || (tag === "title" && !settings.keepTitle) || (tag === "desc" && !settings.keepTitle))) {
				child.remove();
				metadataCount += 1;
				continue;
			}
			walk(child);
		}
	};
	walk(root);
	const walkComments = (node: Node) => {
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType === Node.COMMENT_NODE) {
				child.parentNode?.removeChild(child);
				commentCount += 1;
				continue;
			}
			walkComments(child);
		}
	};
	walkComments(doc);
	const counters = { editor: 0 };
	const serialised = serialise(root, settings, counters, 0).trim();
	const output = settings.prettify ? `${serialised}\n` : serialised;
	if (!output.includes("<svg")) throw new Error("No SVG content survived optimisation.");
	const before = new TextEncoder().encode(source).length;
	const after = new TextEncoder().encode(output).length;
	if (after >= before) warnings.push("This file is already compact; the output is not smaller than the input.");
	return {
		output,
		before,
		after,
		saved: Math.max(0, Math.round(((before - after) / before) * 1000) / 10),
		commentCount,
		metadataCount,
		editorAttributeCount: counters.editor,
		warnings,
	};
};

export const formatBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`);
