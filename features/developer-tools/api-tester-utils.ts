export const API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type ApiMethod = (typeof API_METHODS)[number];

export type ApiKeyValue = { id: string; key: string; value: string };
export type ApiFormField = ApiKeyValue & { fileName?: string; mimeType?: string; base64?: string };
export type ApiRequest = {
	name: string;
	url: string;
	method: ApiMethod;
	headers: ApiKeyValue[];
	query: ApiKeyValue[];
	bodyKind: "json" | "form";
	body: string;
	formFields: ApiFormField[];
};
export type ApiResponse = {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	elapsedMs: number;
	truncated: boolean;
};
export type ApiHistoryEntry = { id: string; savedAt: string; request: ApiRequest; response?: ApiResponse; error?: string };

export const newApiRequest = (): ApiRequest => ({
	name: "Untitled request",
	url: "https://jsonplaceholder.typicode.com/posts/1",
	method: "GET",
	headers: [{ id: "header-1", key: "Accept", value: "application/json" }],
	query: [],
	bodyKind: "json",
	body: '{\n  "title": "hello",\n  "body": "world",\n  "userId": 1\n}',
	formFields: [{ id: "form-1", key: "name", value: "Ada Lovelace" }],
});

export const buildRequestUrl = (rawUrl: string, params: ApiKeyValue[]) => {
	const url = new URL(rawUrl.trim());
	for (const { key, value } of params) {
		if (key.trim()) url.searchParams.append(key.trim(), value);
	}
	return url.toString();
};

export const parseRequestHeaders = (rows: ApiKeyValue[]) => {
	const result: Record<string, string> = {};
	for (const row of rows) {
		const key = row.key.trim();
		if (key) result[key] = row.value;
	}
	return result;
};

export const formatJson = (source: string) => {
	if (!source.trim()) return { formatted: "", error: "" };
	try {
		return { formatted: JSON.stringify(JSON.parse(source), null, 2), error: "" };
	} catch {
		return { formatted: source, error: "The JSON is not valid yet." };
	}
};

export const displayResponseBody = (source: string, pretty: boolean) => {
	if (!pretty || !source.trim()) return source;
	try {
		return JSON.stringify(JSON.parse(source), null, 2);
	} catch {
		return source;
	}
};

export const safeReadHistory = (source: string | null): ApiHistoryEntry[] => {
	if (!source) return [];
	try {
		const value: unknown = JSON.parse(source);
		if (!Array.isArray(value)) return [];
		return value.filter((entry): entry is ApiHistoryEntry =>
			typeof entry === "object" && entry !== null &&
			typeof (entry as ApiHistoryEntry).id === "string" &&
			typeof (entry as ApiHistoryEntry).savedAt === "string" &&
			typeof (entry as ApiHistoryEntry).request?.url === "string" &&
			API_METHODS.includes((entry as ApiHistoryEntry).request?.method),
		).slice(0, 20);
	} catch {
		return [];
	}
};

const ipv4IsPublic = (address: string) => {
	const octets = address.split(".").map(Number);
	if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
	const [a, b, c] = octets;
	if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
	if (a === 100 && b >= 64 && b <= 127) return false;
	if (a === 169 && b === 254) return false;
	if (a === 172 && b >= 16 && b <= 31) return false;
	if (a === 192 && (b === 0 || b === 168)) return false;
	if (a === 192 && b === 88 && c === 99) return false;
	if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
	if (a === 203 && b === 0 && c === 113) return false;
	return true;
};

const ipv6ToGroups = (input: string): number[] | null => {
	let address = input.toLowerCase().split("%")[0];
	if (address.includes(".")) {
		const lastColon = address.lastIndexOf(":");
		const v4 = address.slice(lastColon + 1).split(".").map(Number);
		if (v4.length !== 4 || v4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
		address = `${address.slice(0, lastColon)}:${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
	}
	const halves = address.split("::");
	if (halves.length > 2) return null;
	const left = halves[0] ? halves[0].split(":") : [];
	const right = halves[1] ? halves[1].split(":") : [];
	const missing = 8 - left.length - right.length;
	if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
	const groups = [...left, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...right];
	if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return null;
	return groups.map((group) => Number.parseInt(group, 16));
};

/** Returns true only for globally routable IP literals; used to guard the server-side fetch proxy. */
export const isPublicIpAddress = (address: string) => {
	if (address.includes(":")) {
		const groups = ipv6ToGroups(address);
		if (!groups) return false;
		if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
			const v4 = [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join(".");
			return ipv4IsPublic(v4);
		}
		// Allow only global unicast 2000::/3, excluding documentation, transition, and local-use ranges.
		if (groups[0] < 0x2000 || groups[0] > 0x3fff) return false;
		if ((groups[0] === 0x2001 && (groups[1] <= 0x000f || groups[1] === 0x0db8)) || groups[0] === 0x2002) return false;
		return true;
	}
	return ipv4IsPublic(address);
};
