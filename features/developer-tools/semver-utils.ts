import semver from "semver";

const maximumVersionLength = 100;
const maximumListLength = 200;

const ensureVersion = (value: string, label: string) => {
	const trimmed = value.trim();
	if (!trimmed) throw new Error(`Enter a ${label} version.`);
	if (trimmed.length > maximumVersionLength) throw new Error(`Keep the ${label} version under 100 characters.`);
	const valid = semver.valid(trimmed);
	if (!valid) throw new Error(`"${trimmed}" is not a valid semantic version. Use major.minor.patch, for example 1.4.2.`);
	return valid;
};

export type ComparisonResult = {
	left: string;
	right: string;
	relation: "older than" | "equal to" | "newer than";
	difference: string;
	majorAhead: boolean | null;
};

export const compareVersions = (left: string, right: string): ComparisonResult => {
	const a = ensureVersion(left, "first");
	const b = ensureVersion(right, "second");
	const comparison = semver.compare(a, b);
	return {
		left: a,
		right: b,
		relation: comparison < 0 ? "older than" : comparison === 0 ? "equal to" : "newer than",
		difference: semver.diff(a, b) ?? "none",
		majorAhead: semver.major(a) !== semver.major(b) ? semver.gt(a, b) : null,
	};
};

export const checkRange = (version: string, range: string) => {
	const validVersion = ensureVersion(version, "version");
	const trimmedRange = range.trim();
	if (!trimmedRange) throw new Error("Enter a semver range, for example ^1.2.0 or >=2 <3.");
	if (trimmedRange.length > maximumVersionLength * 2) throw new Error("Keep semver ranges under 200 characters.");
	const validRange = semver.validRange(trimmedRange, { loose: false });
	if (!validRange) throw new Error(`"${trimmedRange}" is not a valid semver range.`);
	const minimum = semver.minVersion(validRange);
	return {
		version: validVersion,
		range: trimmedRange,
		normalizedRange: validRange,
		satisfies: semver.satisfies(validVersion, validRange),
		minimum: minimum ? minimum.version : "",
		prereleaseAllowed: /-/u.test(validRange),
	};
};

export const bumpVersion = (version: string, release: semver.ReleaseType) => {
	const valid = ensureVersion(version, "version");
	const next = semver.inc(valid, release);
	if (!next) throw new Error(`Could not apply a ${release} bump to ${valid}.`);
	return { previous: valid, next, release, difference: semver.diff(valid, next) ?? "none" };
};

export const sortVersions = (source: string) => {
	const lines = source
		.split(/[\n,]/u)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0) throw new Error("Paste at least one version to sort.");
	if (lines.length > maximumListLength) throw new Error("Sort at most 200 versions at a time.");
	const valid: string[] = [];
	const invalid: string[] = [];
	for (const line of lines) {
		const parsed = semver.valid(line);
		if (parsed) valid.push(parsed);
		else invalid.push(line);
	}
	const ascending = semver.sort([...valid]);
	return {
		ascending: ascending.join("\n"),
		descending: semver.rsort([...valid]).join("\n"),
		invalid,
		latest: ascending.at(-1) ?? "",
		count: ascending.length,
	};
};
