export type EmailSample = { id: string; name: string; html: string };

export const EMAIL_SAMPLES: EmailSample[] = [
	{
		id: "welcome",
		name: "Welcome note",
		html: `<!doctype html>
<html><head><style>
  body { margin: 0; background: #f1f0ea; font-family: Arial, sans-serif; }
  .card { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
  .content { padding: 32px; color: #2d332e; }
  .button { display: inline-block; padding: 12px 20px; background: #2f4539; color: #ffffff; text-decoration: none; border-radius: 6px; }
  @media (max-width: 480px) { .content { padding: 20px !important; } h1 { font-size: 25px !important; } }
</style></head><body>
<table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="content">
<p style="color:#7a8178;font-size:12px;letter-spacing:1px;text-transform:uppercase">CLICKKIT · NOTES</p>
<h1 style="font-size:32px;margin:12px 0">Welcome aboard, Ada</h1>
<p>Thanks for joining us. We’re glad you’re here. Your first step is ready whenever you are.</p>
<p style="margin:28px 0"><a class="button" href="https://example.com/start">Explore your workspace</a></p>
<p style="color:#777;font-size:13px">You’re receiving this because you signed up for ClickKit updates.</p>
</td></tr></table>
</body></html>`,
	},
	{
		id: "receipt",
		name: "Order receipt",
		html: `<!doctype html>
<html><body style="margin:0;background:#f4f3ef;font-family:Arial,sans-serif;color:#252923">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e3dc"><tr><td style="padding:32px">
<p style="margin:0;color:#526557;font-size:12px;font-weight:bold;letter-spacing:1px">ORDER CONFIRMATION</p>
<h1 style="font-size:28px">Thanks for your order, Ada.</h1><p>Order <strong>#CK-2048</strong> · 15 November 2026</p>
<table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse"><tr><td style="border-bottom:1px solid #e5e3dc">Field notebook</td><td align="right" style="border-bottom:1px solid #e5e3dc">$18.00</td></tr><tr><td><strong>Total</strong></td><td align="right"><strong>$18.00</strong></td></tr></table>
<p style="margin-top:28px">We’ll send another note when your parcel is on its way.</p><p style="font-size:12px;color:#777">Questions? Reply to this email and we’ll help.</p>
</td></tr></table></td></tr></table></body></html>`,
	},
	{
		id: "newsletter",
		name: "Product newsletter",
		html: `<!doctype html>
<html><head><style>
  body { margin: 0; background: #edece6; font-family: Georgia, serif; }
  .wrap { max-width: 620px; margin: 20px auto; background: #fff; }
  .pad { padding: 28px 36px; }
  @media (max-width: 520px) { .pad { padding: 20px !important; } .two-col { display: block !important; width: 100% !important; } }
</style></head><body><table class="wrap" role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="pad">
<p style="font:12px Arial,sans-serif;letter-spacing:1.5px;color:#657365">THE WEEKLY FIELDNOTE</p><h1 style="font-size:34px;line-height:1.1">Small tools. More room to think.</h1>
<p>Three ideas for a quieter, more focused week.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="two-col" width="50%" style="padding:12px;background:#f3f4ef"><strong>01 · Clear the clutter</strong><p>Turn the small jobs into one quick pass.</p></td><td class="two-col" width="50%" style="padding:12px"><strong>02 · Keep a little space</strong><p>Leave room for the unexpected good thing.</p></td></tr></table>
<p style="margin-top:24px"><a href="https://example.com/read" style="color:#2f4539">Read this week’s note →</a></p><p style="font:12px Arial,sans-serif;color:#777">You can unsubscribe at any time.</p>
</td></tr></table></body></html>`,
	},
];

const UNSAFE_ELEMENTS = new Set(["script", "iframe", "object", "embed", "form", "input", "textarea", "select", "option", "button", "video", "audio", "source", "track", "svg", "math", "base", "meta", "link"]);
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/]+=*$/iu;
const UNSAFE_CSS = /(?:url\s*\(|@import|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding)/iu;

const safeLink = (value: string) => /^(?:https?:\/\/|mailto:|tel:|#)/iu.test(value.trim());
const safeImageSource = (value: string, allowRemoteImages: boolean) => {
	const trimmed = value.trim();
	return SAFE_DATA_IMAGE.test(trimmed) || (allowRemoteImages && /^https:\/\//iu.test(trimmed));
};

const plainTextFrom = (root: Node) => {
	const blocks = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "LI", "MAIN", "OL", "P", "SECTION", "TABLE", "TR", "UL"]);
	const read = (node: Node): string => {
		if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
		if (node.nodeType !== Node.ELEMENT_NODE) return "";
		const element = node as Element;
		if (element.tagName === "BR") return "\n";
		const content = Array.from(element.childNodes).map(read).join("");
		return blocks.has(element.tagName) ? `\n${content}\n` : content;
	};
	return read(root).replace(/\u00a0/gu, " ").replace(/[\t ]+/gu, " ").replace(/ *\n */gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
};

/** Strip active content and external loads before an HTML fragment is placed in an isolated iframe. */
export const sanitizeEmailHtml = (source: string, allowRemoteImages = false) => {
	if (source.length > 500_000) return { html: "", plainText: "", warnings: [], errors: ["Keep the email template under 500 KB for a responsive preview."] };
	if (typeof DOMParser === "undefined") return { html: "", plainText: "", warnings: [], errors: [] };
	const parser = new DOMParser();
	const parsed = parser.parseFromString(source, "text/html");
	const warnings: string[] = [];
	const removedActive = parsed.querySelectorAll("script,iframe,object,embed,form,input,textarea,select,button,video,audio,svg,math").length;
	if (removedActive) warnings.push(`${removedActive} active or interactive element(s) were removed from the preview.`);

	for (const node of Array.from(parsed.querySelectorAll("*"))) {
		const tag = node.tagName.toLowerCase();
		if (UNSAFE_ELEMENTS.has(tag)) {
			if (tag === "form") node.replaceWith(...Array.from(node.childNodes));
			else node.remove();
			continue;
		}
		for (const attribute of Array.from(node.attributes)) {
			const name = attribute.name.toLowerCase();
			const value = attribute.value.trim();
			if (name.startsWith("on") || ["srcdoc", "formaction", "action", "nonce", "integrity", "autofocus", "contenteditable", "target"].includes(name)) {
				node.removeAttribute(attribute.name);
				continue;
			}
			if (name === "style" && UNSAFE_CSS.test(value)) {
				node.removeAttribute(attribute.name);
				warnings.push("A style containing remote resources or executable CSS was removed.");
				continue;
			}
			if (name === "href" && (tag !== "a" || !safeLink(value))) node.removeAttribute(attribute.name);
			if (name === "src" && (tag !== "img" || !safeImageSource(value, allowRemoteImages))) {
				node.removeAttribute(attribute.name);
				if (tag === "img" && /^https?:\/\//iu.test(value) && !allowRemoteImages) warnings.push("Remote images are blocked. Enable remote images to load them in the preview.");
			}
			if (name === "srcset") node.removeAttribute(attribute.name);
			if (name === "background" && !safeImageSource(value, allowRemoteImages)) node.removeAttribute(attribute.name);
		}
		if (tag === "style") {
			if (UNSAFE_CSS.test(node.textContent ?? "")) {
				node.remove();
				warnings.push("A stylesheet containing remote resources or executable CSS was removed.");
			}
		}
	}

	const stylesheet = Array.from(parsed.head.querySelectorAll("style")).map((style) => style.outerHTML).join("\n");
	const html = `${stylesheet}${stylesheet ? "\n" : ""}${parsed.body.innerHTML}`;
	const textDocument = parser.parseFromString(`<body>${parsed.body.innerHTML}</body>`, "text/html");
	textDocument.body.querySelectorAll("style,script").forEach((node) => node.remove());
	const plainText = plainTextFrom(textDocument.body);
	const missingAlt = parsed.body.querySelectorAll("img:not([alt])").length;
	if (missingAlt) warnings.push(`${missingAlt} image(s) do not have alternative text.`);
	if (parsed.body.querySelector("div") && !parsed.body.querySelector("table")) warnings.push("Email clients vary in their support for modern layout CSS; table-based layouts are usually the most portable.");
	if (!source.trim()) warnings.push("Paste or choose an email template to see a preview.");
	return { html, plainText, warnings: [...new Set(warnings)], errors: source.trim() ? [] : ["HTML is empty."] };
};

export const buildEmailDocument = (safeHtml: string, allowRemoteImages: boolean) => {
	const imageSources = allowRemoteImages ? "img-src data: https:;" : "img-src data:;";
	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${imageSources} style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; connect-src 'none';"><style>html,body{margin:0;min-height:100%;}body{overflow-x:hidden;}img{max-width:100%;height:auto;}</style></head><body>${safeHtml}</body></html>`;
};

export const validateEmailHtml = (source: string, sanitized: ReturnType<typeof sanitizeEmailHtml>) => {
	const errors = [...sanitized.errors];
	if (source.length > 500_000 && !errors.some((error) => error.includes("500 KB"))) errors.push("Keep the email template under 500 KB for a responsive preview.");
	const warnings = [...sanitized.warnings];
	if (source.includes("<!doctype") === false && source.trim()) warnings.push("A doctype was not found; the preview adds one automatically.");
	return { errors, warnings: [...new Set(warnings)] };
};
