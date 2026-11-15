import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { ApiFormField, ApiMethod } from "@/features/developer-tools/api-tester-utils";
import { API_METHODS, isPublicIpAddress } from "@/features/developer-tools/api-tester-utils";

export const runtime = "nodejs";

const MAX_INCOMING_BYTES = 3 * 1024 * 1024;
const MAX_OUTGOING_BYTES = 1024 * 1024;
const MAX_TIMEOUT_MS = 20_000;
const ALLOWED_HEADERS = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const FORBIDDEN_HEADERS = new Set(["host", "content-length", "transfer-encoding", "connection", "proxy-connection", "keep-alive", "upgrade", "te", "trailer", "accept-encoding"]);
const RESPONSE_HEADER_DENYLIST = new Set(["set-cookie", "set-cookie2"]);

const json = (status: number, payload: Record<string, unknown>) => Response.json(payload, { status });
class BadRequestError extends Error {}

const parseDestination = async (raw: unknown) => {
	if (typeof raw !== "string" || raw.length > 2048) throw new BadRequestError("Enter a valid HTTP or HTTPS URL, up to 2,048 characters.");
	let url: URL;
	try { url = new URL(raw); } catch { throw new BadRequestError("Enter a complete URL, such as https://api.example.com/v1/items."); }
	if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password || !url.hostname) {
		throw new BadRequestError("Only HTTP and HTTPS URLs without embedded credentials are supported.");
	}
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
	if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test")) {
		throw new BadRequestError("For safety, requests to local and internal hostnames are blocked.");
	}
	let addresses: { address: string; family: number }[];
	if (isIP(host)) addresses = [{ address: host, family: isIP(host) }];
	else {
		try { addresses = await dnsLookup(host, { all: true, verbatim: true }); }
		catch { throw new BadRequestError("The hostname could not be resolved from the request server."); }
	}
	if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
		throw new BadRequestError("Requests to private, local, or reserved network addresses are blocked.");
	}
	return { url, pinnedAddress: addresses[0] };
};

const normalizeHeaders = (raw: unknown) => {
	if (raw === undefined) return {} as Record<string, string>;
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new BadRequestError("Request headers must be a key/value object.");
	const input = raw as Record<string, unknown>;
	const keys = Object.keys(input);
	if (keys.length > 40) throw new BadRequestError("A request can have up to 40 custom headers.");
	const headers: Record<string, string> = {};
	let total = 0;
	for (const [key, value] of Object.entries(input)) {
		if (!ALLOWED_HEADERS.test(key) || typeof value !== "string" || /[\r\n]/u.test(value) || FORBIDDEN_HEADERS.has(key.toLowerCase())) {
			throw new BadRequestError(`The header “${key.slice(0, 80)}” is invalid or reserved.`);
		}
		if (value.length > 8192) throw new BadRequestError("A request header is too long.");
		total += key.length + value.length;
		if (total > 16_384) throw new BadRequestError("Combined request headers must be under 16 KB.");
		headers[key] = value;
	}
	return headers;
};

const safeDisposition = (value: string) => value.replace(/[\r\n\0]/gu, "").replace(/[\\"]/gu, "\\$&").slice(0, 180);

const multipartBody = (fields: unknown) => {
	if (!Array.isArray(fields) || fields.length > 100) throw new BadRequestError("Form data must contain 100 fields or fewer.");
	const boundary = `----ClickKitApiTester${crypto.randomUUID().replace(/-/gu, "")}`;
	const chunks: Buffer[] = [];
	let total = 0;
	for (const item of fields as ApiFormField[]) {
		if (!item || typeof item.key !== "string" || typeof item.value !== "string" || item.key.length > 512 || item.value.length > 64_000) {
			throw new BadRequestError("A form field has an invalid or oversized name or value.");
		}
		const name = safeDisposition(item.key);
		let data: Buffer;
		let partHeader: string;
		if (item.fileName) {
			if (typeof item.base64 !== "string" || item.base64.length > 2_800_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(item.base64)) {
				throw new BadRequestError("A selected form file is invalid or larger than the 2 MB limit.");
			}
			data = Buffer.from(item.base64, "base64");
			if (data.length > 2 * 1024 * 1024) throw new BadRequestError("A selected form file is larger than the 2 MB limit.");
			const mimeType = typeof item.mimeType === "string" && /^[\w.+-]+\/[\w.+-]+$/u.test(item.mimeType) ? item.mimeType : "application/octet-stream";
			partHeader = `Content-Disposition: form-data; name="${name}"; filename="${safeDisposition(item.fileName)}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
		} else {
			data = Buffer.from(item.value, "utf8");
			partHeader = `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
		}
		const section = Buffer.concat([Buffer.from(`--${boundary}\r\n${partHeader}`, "utf8"), data, Buffer.from("\r\n")]);
		total += section.length;
		if (total > MAX_INCOMING_BYTES) throw new BadRequestError("The form body must be under 3 MB.");
		chunks.push(section);
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
};

const sendRequest = (url: URL, method: ApiMethod, headers: Record<string, string>, pinned: { address: string; family: number }, body?: Buffer) =>
	new Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string; truncated: boolean }>((resolve, reject) => {
		const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
				if (options.all) callback(null, [pinned]);
				else callback(null, pinned.address, pinned.family);
			};
			const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
			let settled = false;
			const finish = (value: Parameters<typeof resolve>[0]) => {
				if (settled) return;
				settled = true;
				resolve(value);
			};
			const request = transport(url, {
				method,
				headers,
				lookup: pinnedLookup,
				timeout: MAX_TIMEOUT_MS,
				maxHeaderSize: 16 * 1024,
				agent: false,
			});
			request.on("timeout", () => request.destroy(new Error("The API request timed out after 20 seconds.")));
			request.on("error", (error) => { if (!settled) reject(error); });
			request.on("response", (response) => {
				const chunks: Buffer[] = [];
				let size = 0;
				let truncated = false;
				response.on("data", (chunk: Buffer | string) => {
					const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
					const remaining = MAX_OUTGOING_BYTES - size;
					if (buffer.length > remaining) {
						if (remaining > 0) chunks.push(buffer.subarray(0, remaining));
						size = MAX_OUTGOING_BYTES;
						truncated = true;
						response.destroy();
						const outputHeaders: Record<string, string> = {};
						for (const [key, value] of Object.entries(response.headers)) {
							if (value !== undefined && !RESPONSE_HEADER_DENYLIST.has(key.toLowerCase())) outputHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
						}
						finish({ status: response.statusCode ?? 502, statusText: response.statusMessage ?? "", headers: outputHeaders, body: Buffer.concat(chunks).toString("utf8"), truncated });
						return;
					}
					chunks.push(buffer);
					size += buffer.length;
				});
				response.on("end", () => {
					const outputHeaders: Record<string, string> = {};
					for (const [key, value] of Object.entries(response.headers)) {
						if (value !== undefined && !RESPONSE_HEADER_DENYLIST.has(key.toLowerCase())) outputHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
					}
					finish({ status: response.statusCode ?? 502, statusText: response.statusMessage ?? "", headers: outputHeaders, body: Buffer.concat(chunks).toString("utf8"), truncated });
				});
			});
		if (body?.length) request.write(body);
		request.end();
	});

export async function POST(request: Request) {
	try {
		const raw = await request.text();
		if (raw.length > MAX_INCOMING_BYTES) return json(413, { error: "The request definition must be under 3 MB." });
		const input: unknown = JSON.parse(raw);
		if (typeof input !== "object" || input === null || Array.isArray(input)) return json(400, { error: "The request definition is not valid." });
		const payload = input as Record<string, unknown>;
		if (!API_METHODS.includes(payload.method as ApiMethod)) return json(400, { error: "Choose GET, POST, PUT, PATCH, or DELETE." });
		const { url, pinnedAddress } = await parseDestination(payload.url);
		const method = payload.method as ApiMethod;
		const headers = normalizeHeaders(payload.headers);
		let body: Buffer | undefined;
		if (payload.bodyKind === "form") {
			const multipart = multipartBody(payload.formFields);
			body = multipart.body;
			for (const name of Object.keys(headers)) if (name.toLowerCase() === "content-type") delete headers[name];
			headers["content-type"] = multipart.contentType;
		} else if (payload.bodyKind === "json") {
			if (typeof payload.body !== "string" || payload.body.length > MAX_INCOMING_BYTES) return json(413, { error: "The JSON body must be under 3 MB." });
			if (payload.body.trim()) {
				try { JSON.parse(payload.body); } catch { return json(400, { error: "The request body is not valid JSON." }); }
				body = Buffer.from(payload.body, "utf8");
				if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) headers["content-type"] = "application/json";
			}
		} else if (payload.bodyKind !== undefined) return json(400, { error: "Choose JSON or form-data for the request body." });
		headers["accept-encoding"] = "identity";
		if (body) headers["content-length"] = String(body.length);
		const started = performance.now();
		const result = await sendRequest(url, method, headers, pinnedAddress, body);
		return json(200, { ...result, elapsedMs: Math.round(performance.now() - started) });
	} catch (error) {
		const message = error instanceof Error ? error.message : "The API request could not be sent.";
		return json(error instanceof BadRequestError ? 400 : 502, { error: message });
	}
}
