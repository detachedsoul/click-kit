const firstNames = ["Ada", "Grace", "Alan", "Katherine", "Linus", "Margaret", "Barbara", "Edsger", "Radia", "Guido", "Anita", "Dennis"];
const lastNames = ["Lovelace", "Hopper", "Turing", "Johnson", "Torvalds", "Hamilton", "Liskov", "Dijkstra", "Perlman", "Rossum", "Borg", "Ritchie"];
const cities = ["Lisbon", "Lagos", "Kyoto", "Toronto", "Berlin", "Nairobi", "Auckland", "Medellín", "Tbilisi", "Seoul", "Porto", "Austin"];
const countries = ["Portugal", "Nigeria", "Japan", "Canada", "Germany", "Kenya", "New Zealand", "Colombia", "Georgia", "South Korea", "Brazil", "Ireland"];
const companies = ["Northwind", "Acme Labs", "Contoso", "Globex", "Initech", "Umbrella", "Hooli", "Vandelay", "Soylent", "Zentric"];
const streets = ["Alder Way", "Beacon Street", "Cedar Lane", "Dock Road", "Elm Court", "Foundry Row", "Granite Avenue", "Harbour Walk"];
const words = ["amber", "basalt", "cobalt", "delta", "ember", "fjord", "garnet", "harbor", "indigo", "juniper", "kelp", "linen", "marble", "nickel"];
const domains = ["example.com", "example.org", "example.net", "mail.test"];
const departments = ["Engineering", "Design", "Operations", "Finance", "Support", "Research"];
const statuses = ["active", "pending", "archived", "draft"];

export const hashSeed = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

export const makeRandom = (seed: string) => {
	let state = hashSeed(seed) || 1;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

type Random = () => number;

const pick = <T>(random: Random, list: T[]): T => list[Math.floor(random() * list.length)];
const integer = (random: Random, min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const digits = (random: Random, length: number) => Array.from({ length }, () => integer(random, 0, 9)).join("");
const hex = (random: Random, length: number) => Array.from({ length }, () => "0123456789abcdef"[integer(random, 0, 15)]).join("");

const detectFormat = (key: string, sample: string) => {
	const lower = key.toLowerCase();
	if (/^(email|e-mail|mail)$/u.test(lower) || /@/u.test(sample)) return "email";
	if (/uuid|guid/u.test(lower) || /^[0-9a-f]{8}-[0-9a-f]{4}-/iu.test(sample)) return "uuid";
	if (/objectid|_id$/u.test(lower) || /^[0-9a-f]{24}$/iu.test(sample)) return "objectId";
	if (/phone|mobile|tel/u.test(lower)) return "phone";
	if (/url|website|homepage|link/u.test(lower) || /^https?:\/\//u.test(sample)) return "url";
	if (/date|time|created|updated|_at$|_on$/u.test(lower) || /^\d{4}-\d{2}-\d{2}/u.test(sample)) return "date";
	if (/city|town/u.test(lower)) return "city";
	if (/country/u.test(lower)) return "country";
	if (/company|organisation|organization|employer/u.test(lower)) return "company";
	if (/street|address/u.test(lower)) return "street";
	if (/first_?name|given/u.test(lower)) return "firstName";
	if (/last_?name|surname|family/u.test(lower)) return "lastName";
	if (/full_?name|^name$|display_?name/u.test(lower)) return "fullName";
	if (/department|team|group/u.test(lower)) return "department";
	if (/status|state/u.test(lower)) return "status";
	if (/username|handle|nickname/u.test(lower)) return "username";
	if (/title|headline|subject/u.test(lower)) return "title";
	return "word";
};

const fakeString = (random: Random, key: string, sample: string, index: number): string => {
	switch (detectFormat(key, sample)) {
		case "email": {
			const first = pick(random, firstNames).toLowerCase();
			const last = pick(random, lastNames).toLowerCase();
			return `${first}.${last}${index}@${pick(random, domains)}`;
		}
		case "uuid":
			return `${hex(random, 8)}-${hex(random, 4)}-4${hex(random, 3)}-a${hex(random, 3)}-${hex(random, 12)}`;
		case "objectId": {
			const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
			return `${seconds}${hex(random, 10)}${hex(random, 6)}`;
		}
		case "phone":
			return `+1 555 ${digits(random, 3)} ${digits(random, 4)}`;
		case "url":
			return `https://${pick(random, domains).replace(/^mail\./u, "www.")}/${pick(random, words)}-${integer(random, 100, 999)}`;
		case "date": {
			const base = Number.isNaN(Date.parse(sample)) ? Date.now() : Date.parse(sample);
			const offset = integer(random, -120, 30) * 86_400_000;
			const value = new Date(base + offset);
			return sample.includes("T") ? value.toISOString() : value.toISOString().slice(0, 10);
		}
		case "city":
			return pick(random, cities);
		case "country":
			return pick(random, countries);
		case "company":
			return pick(random, companies);
		case "street":
			return `${integer(random, 1, 240)} ${pick(random, streets)}`;
		case "firstName":
			return pick(random, firstNames);
		case "lastName":
			return pick(random, lastNames);
		case "fullName":
			return `${pick(random, firstNames)} ${pick(random, lastNames)}`;
		case "department":
			return pick(random, departments);
		case "status":
			return pick(random, statuses);
		case "username":
			return `${pick(random, firstNames).toLowerCase()}_${pick(random, words)}`;
		case "title":
			return `${pick(random, words).replace(/^./u, (letter) => letter.toUpperCase())} ${pick(random, ["report", "notes", "summary", "roadmap", "review"])}`;
		default:
			return `${pick(random, words)}-${integer(random, 10, 99)}`;
	}
};

const fakeValue = (random: Random, key: string, sample: unknown, index: number, depth: number): unknown => {
	if (depth > 8) throw new Error("Sample JSON is nested too deeply (over 8 levels).");
	if (sample === null) return null;
	if (typeof sample === "string") return fakeString(random, key, sample, index);
	if (typeof sample === "boolean") return random() > 0.5;
	if (typeof sample === "number") {
		if (/id$/iu.test(key)) return index;
		if (Number.isInteger(sample)) return integer(random, Math.max(1, Math.round(Math.abs(sample) * 0.2)), Math.max(10, Math.round(Math.abs(sample) * 2)));
		return Math.round((random() * Math.max(10, Math.abs(sample) * 2)) * 100) / 100;
	}
	if (Array.isArray(sample)) {
		const count = sample.length === 0 ? 1 : Math.min(sample.length, 2);
		return Array.from({ length: count }, (_, itemIndex) => fakeValue(random, key, sample[itemIndex % Math.max(sample.length, 1)] ?? "item", index, depth + 1));
	}
	if (typeof sample === "object") {
		return Object.fromEntries(Object.entries(sample as Record<string, unknown>).map(([childKey, child]) => [childKey, fakeValue(random, childKey, child, index, depth + 1)]));
	}
	return null;
};

export type FixtureOptions = { count: number; seed: string; rootIsArray: boolean };

export const generateFixtures = (source: string, options: Partial<FixtureOptions> = {}) => {
	if (!source.trim()) throw new Error("Paste a JSON sample first.");
	let sample: unknown;
	try {
		sample = JSON.parse(source);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message.replace(/^JSON\.parse: /u, "") : "Invalid JSON");
	}
	const rootIsArray = Array.isArray(sample);
	const template = rootIsArray ? (sample as unknown[])[0] : sample;
	if (!template || typeof template !== "object" || Array.isArray(template)) throw new Error("Use a JSON object, or an array whose first item is an object, as the sample.");
	const count = options.count ?? 10;
	if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Record count must be a whole number between 1 and 1,000.");
	const seed = options.seed?.trim() || "clickkit";
	const random = makeRandom(seed);
	const records = Array.from({ length: count }, (_, index) => fakeValue(random, "", template, index + 1, 0));
	return { records, text: JSON.stringify(records, null, 2), rootIsArray };
};
