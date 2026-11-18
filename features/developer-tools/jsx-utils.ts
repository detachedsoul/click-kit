const attributeMap: Record<string, string> = {
	class: "className",
	for: "htmlFor",
	tabindex: "tabIndex",
	readonly: "readOnly",
	maxlength: "maxLength",
	minlength: "minLength",
	autocomplete: "autoComplete",
	autofocus: "autoFocus",
	autoplay: "autoPlay",
	colspan: "colSpan",
	rowspan: "rowSpan",
	contenteditable: "contentEditable",
	cellpadding: "cellPadding",
	cellspacing: "cellSpacing",
	crossorigin: "crossOrigin",
	datetime: "dateTime",
	enctype: "encType",
	formaction: "formAction",
	frameborder: "frameBorder",
	ismap: "isMap",
	novalidate: "noValidate",
	playsinline: "playsInline",
	srcset: "srcSet",
	usemap: "useMap",
	allowfullscreen: "allowFullScreen",
	"accent-height": "accentHeight",
	"alignment-baseline": "alignmentBaseline",
	"arabic-form": "arabicForm",
	"baseline-shift": "baselineShift",
	"cap-height": "capHeight",
	"clip-path": "clipPath",
	"clip-rule": "clipRule",
	"color-interpolation": "colorInterpolation",
	"color-interpolation-filters": "colorInterpolationFilters",
	"color-profile": "colorProfile",
	"color-rendering": "colorRendering",
	"dominant-baseline": "dominantBaseline",
	"enable-background": "enableBackground",
	"fill-opacity": "fillOpacity",
	"fill-rule": "fillRule",
	"flood-color": "floodColor",
	"flood-opacity": "floodOpacity",
	"font-family": "fontFamily",
	"font-size": "fontSize",
	"font-size-adjust": "fontSizeAdjust",
	"font-stretch": "fontStretch",
	"font-style": "fontStyle",
	"font-variant": "fontVariant",
	"font-weight": "fontWeight",
	"glyph-name": "glyphName",
	"glyph-orientation-horizontal": "glyphOrientationHorizontal",
	"glyph-orientation-vertical": "glyphOrientationVertical",
	"horiz-adv-x": "horizAdvX",
	"horiz-origin-x": "horizOriginX",
	"image-rendering": "imageRendering",
	"letter-spacing": "letterSpacing",
	"lighting-color": "lightingColor",
	"marker-end": "markerEnd",
	"marker-mid": "markerMid",
	"marker-start": "markerStart",
	"overline-position": "overlinePosition",
	"overline-thickness": "overlineThickness",
	"paint-order": "paintOrder",
	"panose-1": "panose1",
	"pointer-events": "pointerEvents",
	"rendering-intent": "renderingIntent",
	"shape-rendering": "shapeRendering",
	"stop-color": "stopColor",
	"stop-opacity": "stopOpacity",
	"strikethrough-position": "strikethroughPosition",
	"strikethrough-thickness": "strikethroughThickness",
	"stroke-dasharray": "strokeDasharray",
	"stroke-dashoffset": "strokeDashoffset",
	"stroke-linecap": "strokeLinecap",
	"stroke-linejoin": "strokeLinejoin",
	"stroke-miterlimit": "strokeMiterlimit",
	"stroke-opacity": "strokeOpacity",
	"stroke-width": "strokeWidth",
	"text-anchor": "textAnchor",
	"text-decoration": "textDecoration",
	"text-rendering": "textRendering",
	"underline-position": "underlinePosition",
	"underline-thickness": "underlineThickness",
	"unicode-bidi": "unicodeBidi",
	"unicode-range": "unicodeRange",
	"units-per-em": "unitsPerEm",
	"v-alphabetic": "vAlphabetic",
	"v-hanging": "vHanging",
	"v-ideographic": "vIdeographic",
	"v-mathematical": "vMathematical",
	"vector-effect": "vectorEffect",
	"vert-adv-y": "vertAdvY",
	"vert-origin-x": "vertOriginX",
	"vert-origin-y": "vertOriginY",
	"word-spacing": "wordSpacing",
	"writing-mode": "writingMode",
	"x-height": "xHeight",
	"xlink:href": "xlinkHref",
	"xml:base": "xmlBase",
	"xml:lang": "xmlLang",
	"xml:space": "xmlSpace",
	"xmlns:xlink": "xmlnsXlink",
	// Parsers may lower-case these camelCase SVG attributes.
	viewbox: "viewBox",
	preserveaspectratio: "preserveAspectRatio",
	gradientunits: "gradientUnits",
	gradienttransform: "gradientTransform",
	patternunits: "patternUnits",
	patterncontentunits: "patternContentUnits",
	patterntransform: "patternTransform",
	clippathunits: "clipPathUnits",
	spreadmethod: "spreadMethod",
	markerwidth: "markerWidth",
	markerheight: "markerHeight",
	markerunits: "markerUnits",
	refx: "refX",
	refy: "refY",
	textlength: "textLength",
	lengthadjust: "lengthAdjust",
	startoffset: "startOffset",
	stddeviation: "stdDeviation",
	basefrequency: "baseFrequency",
	numoctaves: "numOctaves",
	tablevalues: "tableValues",
	zoomandpan: "zoomAndPan",
	transformorigin: "transformOrigin",
};

const svgTags: Record<string, string> = {
	lineargradient: "linearGradient",
	radialgradient: "radialGradient",
	clippath: "clipPath",
	textpath: "textPath",
	feblend: "feBlend",
	fecolormatrix: "feColorMatrix",
	fecomponenttransfer: "feComponentTransfer",
	fecomposite: "feComposite",
	feconvolvematrix: "feConvolveMatrix",
	fediffuselighting: "feDiffuseLighting",
	fedisplacementmap: "feDisplacementMap",
	fedistantlight: "feDistantLight",
	fedropshadow: "feDropShadow",
	feflood: "feFlood",
	fefunca: "feFuncA",
	fefuncb: "feFuncB",
	fefuncg: "feFuncG",
	fefuncr: "feFuncR",
	fegaussianblur: "feGaussianBlur",
	feimage: "feImage",
	femerge: "feMerge",
	femergenode: "feMergeNode",
	femorphology: "feMorphology",
	feoffset: "feOffset",
	fepointlight: "fePointLight",
	fespecularlighting: "feSpecularLighting",
	fespotlight: "feSpotLight",
	fetile: "feTile",
	feturbulence: "feTurbulence",
	foreignobject: "foreignObject",
};

const booleanAttributes = new Set([
	"allowfullscreen",
	"async",
	"autofocus",
	"autoplay",
	"checked",
	"controls",
	"default",
	"defer",
	"disabled",
	"formnovalidate",
	"hidden",
	"ismap",
	"loop",
	"multiple",
	"muted",
	"novalidate",
	"open",
	"playsinline",
	"readonly",
	"required",
	"reversed",
	"selected",
]);

const voidElements = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

const eventHandler = (name: string) => (name.startsWith("on") && name.length > 2 ? `on${name[2].toUpperCase()}${name.slice(3)}` : name);

const styleToObject = (style: string) => {
	const declarations = style
		.split(";")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const index = entry.indexOf(":");
			const property = entry.slice(0, index).trim();
			const value = entry.slice(index + 1).trim();
			const key = property.startsWith("--") ? `"${property}"` : property.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
			return `${key}: ${/^\d+(\.\d+)?$/u.test(value) ? value : `"${value}"`}`;
		});
	return `{ ${declarations.join(", ")} }`;
};

const escapeText = (text: string) => text.replace(/[{}]/gu, (character) => `{'${character}'}`).replace(/>\s*\n\s*</gu, ">\n<");

const attributeToJsx = (name: string, value: string | null) => {
	const lower = name.toLowerCase();
	if (lower === "style" && value) return `style={${styleToObject(value)}}`;
	if (lower === "class") return `className="${value ?? ""}"`;
	if (booleanAttributes.has(lower)) return value === null || value === "" || value === lower ? attributeMap[lower] ?? eventHandler(lower) : `${attributeMap[lower] ?? lower}={${value}}`;
	if (lower.startsWith("data-") || lower.startsWith("aria-")) return `${lower}="${value ?? ""}"`;
	const mapped = attributeMap[lower] ?? (lower.includes("-") ? lower.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase()) : eventHandler(lower));
	if (value === null) return mapped;
	return `${mapped}="${value.replaceAll('"', "&quot;")}"`;
};

const serialise = (node: Node, depth: number, svgMode: boolean): string[] => {
	const pad = "  ".repeat(depth);
	if (node.nodeType === Node.TEXT_NODE) {
		const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
		return text ? [`${pad}${escapeText(text)}`] : [];
	}
	if (node.nodeType === Node.COMMENT_NODE) return [`${pad}{/* ${(node.textContent ?? "").trim()} */}`];
	if (node.nodeType !== Node.ELEMENT_NODE) return [];
	const element = node as Element;
	const tag = svgTags[element.tagName.toLowerCase()] ?? element.tagName.toLowerCase();
	const attributes = Array.from(element.attributes)
		.filter((attribute) => !(tag === "svg" && attribute.name === "xmlns"))
		.map((attribute) => attributeToJsx(attribute.name, attribute.value));
	const open = attributes.length ? `${pad}<${tag} ${attributes.join(" ")}` : `${pad}<${tag}`;
	const children = Array.from(element.childNodes).flatMap((child) => serialise(child, depth + 1, svgMode));
	if (children.length === 0) return [voidElements.has(tag) || svgMode ? `${open} />` : `${open}></${tag}>`];
	const inline = children.length === 1 && !children[0].trim().startsWith("<") && !children[0].includes("{/*");
	if (inline) return [`${open}>${children[0].trim()}</${tag}>`];
	return [`${open}>`, ...children, `${pad}</${tag}>`];
};

export type JsxOptions = { component: string; wrap: boolean; svg: boolean };

export const htmlToJsx = (source: string, options: Partial<JsxOptions> = {}) => {
	if (!source.trim()) throw new Error("Paste HTML or SVG to convert first.");
	const isSvg = options.svg ?? /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/iu.test(source);
	const doc = new DOMParser().parseFromString(isSvg ? source.trim() : source, isSvg ? "image/svg+xml" : "text/html");
	const failure = isSvg ? doc.querySelector("parsererror") : null;
	if (failure) throw new Error(`Invalid SVG: ${(failure.textContent ?? "could not parse the markup").replace(/\s+/gu, " ").trim().slice(0, 200)}`);
	const root = isSvg ? doc.documentElement : doc.body;
	const nodes = isSvg ? [root] : Array.from(root.childNodes);
	const lines = nodes.flatMap((node) => serialise(node, isSvg ? 1 : 0, isSvg));
	if (lines.length === 0) throw new Error("No elements found in this markup.");
	const body = lines.join("\n");
	const component = (options.component ?? "Component").trim() || "Component";
	if (options.wrap === false) return body;
	return `export default function ${component}() {\n  return (\n${body
		.split("\n")
		.map((line) => `    ${line}`)
		.join("\n")}\n  );\n}`;
};
