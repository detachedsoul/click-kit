import toolDates from "@/lib/tool-dates.generated.json";
import { tools, type Tool } from "@/lib/tools";

/** How long a tool keeps its "New" badge. */
export const NEW_WINDOW_DAYS = 14;

/** The first date git history could tell us about; earlier tools have no known date. */
export const TOOL_TRACKING_SINCE: string = toolDates.trackedSince;

const DATES = toolDates.dates as Record<string, string | null>;

const DAY_MS = 86_400_000;

/** ISO date (yyyy-mm-dd) a tool first appeared in the catalogue, or null for the original set. */
export const toolAddedOn = (slug: string) => DATES[slug] ?? null;

export const daysSinceAdded = (slug: string, now: Date = new Date()) => {
	const iso = toolAddedOn(slug);
	if (!iso) return null;
	return Math.floor((now.getTime() - Date.parse(`${iso}T00:00:00Z`)) / DAY_MS);
};

/** True while a tool is inside the new-tools window. A clock running behind the build date still counts as new. */
export const isNewTool = (slug: string, now: Date = new Date()) => {
	const days = daysSinceAdded(slug, now);
	return days !== null && days <= NEW_WINDOW_DAYS;
};

export const addedOnLabel = (iso: string) =>
	new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Newest tools first; ties fall back to the catalogue order. */
export const recentTools = (now: Date = new Date()) =>
	tools
		.map((tool, index) => ({ tool, index, added: toolAddedOn(tool.slug) }))
		.filter((entry) => entry.added !== null && isNewTool(entry.tool.slug, now))
		.sort((left, right) => (right.added as string).localeCompare(left.added as string) || left.index - right.index)
		.map((entry) => entry.tool);

/** Every tool that first appeared on a given ISO date. */
export const toolsAddedOn = (date: string) => tools.filter((tool) => toolAddedOn(tool.slug) === date);

export type ToolRelease = { date: string; tools: Tool[] };

/** Recent tools bucketed by the day they were added, newest day first. */
export const recentToolReleases = (now: Date = new Date()): ToolRelease[] => {
	const buckets = new Map<string, Tool[]>();
	for (const tool of recentTools(now)) {
		const added = toolAddedOn(tool.slug);
		if (!added) continue;
		const bucket = buckets.get(added) ?? [];
		bucket.push(tool);
		buckets.set(added, bucket);
	}
	return [...buckets.entries()].map(([date, entries]) => ({ date, tools: entries })).sort((left, right) => right.date.localeCompare(left.date));
};

export const newToolCount = (now: Date = new Date()) => recentTools(now).length;
