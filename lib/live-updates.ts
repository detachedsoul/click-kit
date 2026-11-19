export const POLL_INTERVAL_MS = 45_000;
export const FIRST_CHECK_MS = 8_000;

export type BuildSnapshot = { version: string; tools: number; commit?: string | null; latestTool?: string | null };

/** Anything that is not a usable snapshot is treated as "no news". */
export const parseSnapshot = (value: unknown): BuildSnapshot | null => {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	if (typeof record.version !== "string" || record.version.length === 0) return null;
	const tools = typeof record.tools === "number" && Number.isFinite(record.tools) ? record.tools : 0;
	return {
		version: record.version,
		tools,
		commit: typeof record.commit === "string" ? record.commit : null,
		latestTool: typeof record.latestTool === "string" ? record.latestTool : null,
	};
};

export const isStale = (pageVersion: string, remote: BuildSnapshot | null) => Boolean(remote && remote.version !== pageVersion);

/** What to tell people when a newer build is waiting. */
export const updateMessage = (remote: BuildSnapshot | null, pageTools: number) => {
	if (!remote) return "Checking for updates…";
	const added = remote.tools - pageTools;
	if (added > 0) return `${added} new tool${added === 1 ? "" : "s"} just landed — updating…`;
	return "A newer build is available — updating…";
};

/**
 * A tool page can hold a loaded picture, a draft, or a half-finished setup. Swapping the app under
 * someone mid-edit throws that away, so those pages get a notice with a button instead.
 */
export const shouldAutoRefresh = (pathname: string | null) => !(pathname ?? "").startsWith("/tools/");

/** Wording for the notice a tool page shows while it waits for permission to refresh. */
export const waitingMessage = (remote: BuildSnapshot | null, pageTools: number) => {
	const added = (remote?.tools ?? pageTools) - pageTools;
	if (added > 0) return `${added} new tool${added === 1 ? "" : "s"} just landed.`;
	return "A newer build is ready.";
};

export const upToDateMessage = "You are looking at the newest version.";
export const offlineMessage = "Could not reach the server — still showing the copy on this device.";
