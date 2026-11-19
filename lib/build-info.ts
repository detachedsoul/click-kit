import changelog from "@/lib/changelog.generated.json";
import { tools } from "@/lib/tools";
import { addedOnLabel, recentTools, toolAddedOn } from "@/lib/tool-recency";

export type BuildInfo = {
	/** Changes whenever a deploy carries newer commits, e.g. "a868eaa-131". */
	version: string;
	/** Tools in the catalogue at build time. */
	tools: number;
	/** Newest commit the changelog knows about. */
	commit: string | null;
	/** Newest tool date, so the client can say what changed. */
	latestTool: string | null;
};

const newestCommit = () => {
	for (const release of changelog.releases) {
		for (const group of release.groups) {
			for (const entry of group.entries) return entry.hash;
		}
	}
	return null;
};

/**
 * Identity of the build that served this page. The generated changelog is refreshed with every
 * release, so its newest commit plus the catalogue size is enough to spot a newer deploy.
 */
export const buildInfo = (): BuildInfo => {
	const commit = newestCommit();
	const sorted = recentTools()
		.map((tool) => toolAddedOn(tool.slug))
		.filter((date): date is string => Boolean(date))
		.sort((left, right) => right.localeCompare(left));
	return {
		version: `${commit ?? "dev"}-${tools.length}`,
		tools: tools.length,
		commit,
		latestTool: sorted[0] ?? null,
	};
};

export const buildVersion = () => buildInfo().version;

/** "19 Nov 2026", for the footer of the live-update notice. */
export const buildDateLabel = () => {
	const latest = buildInfo().latestTool;
	return latest ? addedOnLabel(latest) : null;
};
