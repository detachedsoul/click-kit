export type CurlRequest = {
	url: string;
	method: string;
	headers: [string, string][];
	body: string | null;
	bodyKind: "none" | "json" | "urlencoded" | "text" | "graphql";
	formFields: [string, string][];
	basicAuth: { user: string; password: string } | null;
	followRedirects: boolean;
	insecure: boolean;
};

const maximumCommandLength = 20_000;

const tokenize = (source: string) => {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;
	const text = source.replace(/\\\r?\n/gu, " ");
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quote) {
			if (character === quote) {
				quote = null;
				continue;
			}
			if (character === "\\" && quote === '"' && index + 1 < text.length) {
				const next = text[index + 1];
				if (next === '"' || next === "\\" || next === "$") {
					current += next;
					index += 1;
					continue;
				}
			}
			current += character;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (character === "\\" && index + 1 < text.length) {
			current += text[index + 1];
			index += 1;
			continue;
		}
		if (/\s/u.test(character)) {
			if (current) tokens.push(current);
			current = "";
			continue;
		}
		current += character;
	}
	if (quote) throw new Error("The command has an unclosed quote.");
	if (current) tokens.push(current);
	return tokens;
};

const valueFlags = new Set(["-X", "--request", "-H", "--header", "-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--json", "-F", "--form", "-u", "--user", "-A", "--user-agent", "-e", "--referer", "-b", "--cookie", "--url"]);

export const parseCurl = (source: string): CurlRequest => {
	if (!source.trim()) throw new Error("Paste a cURL command to convert.");
	if (source.length > maximumCommandLength) throw new Error("Keep cURL commands under 20,000 characters.");
	const tokens = tokenize(source);
	if (tokens[0] !== "curl") throw new Error('Commands must start with "curl".');
	const request: CurlRequest = {
		url: "",
		method: "",
		headers: [],
		body: null,
		bodyKind: "none",
		formFields: [],
		basicAuth: null,
		followRedirects: false,
		insecure: false,
	};
	const dataParts: string[] = [];
	for (let index = 1; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (!token.startsWith("-")) {
			request.url ||= token;
			continue;
		}
		const equalsIndex = token.startsWith("--") ? token.indexOf("=") : -1;
		const flag = equalsIndex > 0 ? token.slice(0, equalsIndex) : token;
		const inlineValue = equalsIndex > 0 ? token.slice(equalsIndex + 1) : null;
		const nextValue = () => {
			if (inlineValue !== null) return inlineValue;
			const value = tokens[index + 1];
			if (value === undefined) throw new Error(`${flag} needs a value.`);
			index += 1;
			return value;
		};
		switch (flag) {
			case "-X":
			case "--request":
				request.method = nextValue().toUpperCase();
				break;
			case "-H":
			case "--header": {
				const header = nextValue();
				const colon = header.indexOf(":");
				if (colon === -1) throw new Error(`Header "${header}" needs a name and a value, separated by a colon.`);
				request.headers.push([header.slice(0, colon).trim(), header.slice(colon + 1).trim()]);
				break;
			}
			case "-d":
			case "--data":
			case "--data-raw":
			case "--data-binary":
			case "--data-urlencode":
				dataParts.push(nextValue());
				break;
			case "--json":
				dataParts.push(nextValue());
				request.bodyKind = "json";
				break;
			case "-F":
			case "--form": {
				const field = nextValue();
				const equals = field.indexOf("=");
				if (equals === -1) throw new Error(`Form field "${field}" needs name=value.`);
				request.formFields.push([field.slice(0, equals), field.slice(equals + 1)]);
				break;
			}
			case "-u":
			case "--user": {
				const credentials = nextValue();
				const colon = credentials.indexOf(":");
				request.basicAuth = { user: colon === -1 ? credentials : credentials.slice(0, colon), password: colon === -1 ? "" : credentials.slice(colon + 1) };
				break;
			}
			case "-A":
			case "--user-agent":
				request.headers.push(["User-Agent", nextValue()]);
				break;
			case "-e":
			case "--referer":
				request.headers.push(["Referer", nextValue()]);
				break;
			case "-b":
			case "--cookie":
				request.headers.push(["Cookie", nextValue()]);
				break;
			case "--url":
				request.url = nextValue();
				break;
			case "-I":
			case "--head":
				request.method = "HEAD";
				break;
			case "-L":
			case "--location":
				request.followRedirects = true;
				break;
			case "-k":
			case "--insecure":
				request.insecure = true;
				break;
			case "-s":
			case "--silent":
			case "-S":
			case "--show-error":
			case "-i":
			case "--include":
			case "-v":
			case "--verbose":
			case "--compressed":
			case "-g":
			case "--globoff":
				break;
			default:
				if (valueFlags.has(flag)) nextValue();
				break;
		}
	}
	if (!request.url) throw new Error("No URL found. Add one after curl or with --url.");
	if (!/^https?:\/\//iu.test(request.url)) throw new Error("Only http and https URLs are supported.");
	if (dataParts.length > 0) {
		request.body = dataParts.join("&");
		const contentType = request.headers.find(([name]) => name.toLowerCase() === "content-type")?.[1]?.toLowerCase() ?? "";
		if (!request.bodyKind || request.bodyKind === "none") {
			if (contentType.includes("json")) request.bodyKind = "json";
			else if (contentType.includes("x-www-form-urlencoded")) request.bodyKind = "urlencoded";
			else if (/^\s*[[{]/u.test(request.body)) request.bodyKind = "json";
			else request.bodyKind = "text";
		}
	}
	if (request.formFields.length > 0) request.bodyKind = "urlencoded";
	if (!request.method) request.method = request.body || request.formFields.length > 0 ? "POST" : "GET";
	return request;
};

const indent = (level: number) => "  ".repeat(level);

const headerEntries = (request: CurlRequest) => {
	const headers = [...request.headers];
	if (request.basicAuth) {
		const encoded = btoa(`${request.basicAuth.user}:${request.basicAuth.password}`);
		headers.push(["Authorization", `Basic ${encoded}`]);
	}
	return headers;
};

const jsonBodyLiteral = (body: string, language: "js" | "python") => {
	try {
		const value = JSON.parse(body) as unknown;
		return language === "js" ? JSON.stringify(value, null, 2) : toPythonLiteral(value, 0);
	} catch {
		return null;
	}
};

const toPythonLiteral = (value: unknown, level: number): string => {
	if (value === null) return "None";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" || typeof value === "boolean") return typeof value === "boolean" ? (value ? "True" : "False") : String(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		return `[\n${value.map((item) => `${indent(level + 1)}${toPythonLiteral(item, level + 1)},`).join("\n")}\n${indent(level)}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) return "{}";
	return `{\n${entries.map(([key, item]) => `${indent(level + 1)}${JSON.stringify(key)}: ${toPythonLiteral(item, level + 1)},`).join("\n")}\n${indent(level)}}`;
};

export const curlToFetch = (request: CurlRequest) => {
	const headers = headerEntries(request);
	const options: string[] = [`  method: ${JSON.stringify(request.method)},`];
	if (headers.length > 0) {
		options.push(`  headers: {\n${headers.map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`).join("\n")}\n  },`);
	}
	if (request.formFields.length > 0) {
		options.push(
			`  body: (() => {\n    const form = new FormData();\n${request.formFields
				.map(([name, value]) => `    form.append(${JSON.stringify(name)}, ${JSON.stringify(value)});`)
				.join("\n")}\n    return form;\n  })(),`,
		);
	} else if (request.body !== null) {
		const literal = request.bodyKind === "json" ? jsonBodyLiteral(request.body, "js") : null;
		options.push(`  body: ${literal ? `JSON.stringify(${literal})` : JSON.stringify(request.body)},`);
	}
	if (request.followRedirects) options.push("  redirect: \"follow\",");
	return `const response = await fetch(${JSON.stringify(request.url)}, {\n${options.join("\n")}\n});\n\nif (!response.ok) {\n  throw new Error(\`Request failed: \${response.status} \${response.statusText}\`);\n}\n\nconst data = await response.json();\nconsole.log(data);`;
};

export const curlToAxios = (request: CurlRequest) => {
	const headers = headerEntries(request).filter(([name]) => !(request.formFields.length > 0 && name.toLowerCase() === "content-type"));
	const method = request.method.toLowerCase();
	const options: string[] = [];
	if (headers.length > 0) options.push(`  headers: {\n${headers.map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`).join("\n")}\n  },`);
	if (request.followRedirects) options.push("  maxRedirects: 5,");
	const dataArgument = request.formFields.length > 0
		? `(() => {\n  const form = new FormData();\n${request.formFields.map(([name, value]) => `  form.append(${JSON.stringify(name)}, ${JSON.stringify(value)});`).join("\n")}\n  return form;\n})()`
		: request.body === null
			? null
			: request.bodyKind === "json"
				? jsonBodyLiteral(request.body, "js")
				: JSON.stringify(request.body);
	const args = [JSON.stringify(request.url), dataArgument, options.length > 0 ? `{\n${options.join("\n")}\n}` : null].filter(Boolean).join(", ");
	return `import axios from "axios";\n\nconst response = await axios.${method}(${args});\nconsole.log(response.data);`;
};

export const curlToPython = (request: CurlRequest) => {
	const headers = headerEntries(request);
	const lines = ["import requests", ""];
	const call: string[] = [`"${request.url}"`];
	if (headers.length > 0) {
		lines.push(`headers = {\n${headers.map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`).join("\n")}\n}`, "");
		call.push("headers=headers");
	}
	if (request.formFields.length > 0) {
		lines.push(`files = {\n${request.formFields.map(([name, value]) => `    ${JSON.stringify(name)}: (None, ${JSON.stringify(value)}),`).join("\n")}\n}`, "");
		call.push("files=files");
	} else if (request.body !== null) {
		if (request.bodyKind === "json") {
			const literal = jsonBodyLiteral(request.body, "python") ?? JSON.stringify(request.body);
			call.push(`json=${literal}`);
		} else {
			call.push(`data=${JSON.stringify(request.body)}`);
		}
	}
	call.push("timeout=30");
	if (!request.insecure) {
		lines.push(`response = requests.${request.method.toLowerCase()}(${call.join(", ")})`, "");
		lines.push("print(response.status_code, response.text)");
		return lines.join("\n");
	}
	call.push("verify=False");
	lines.push("# verify=False disables TLS verification, mirroring curl -k. Use only for trusted local endpoints.", "");
	lines.push(`response = requests.${request.method.toLowerCase()}(${call.join(", ")})`, "");
	lines.push("print(response.status_code, response.text)");
	return lines.join("\n");
};
