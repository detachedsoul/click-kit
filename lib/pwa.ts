import { recentTools, toolAddedOn } from "@/lib/tool-recency";
import { tools, type Tool } from "@/lib/tools";

export const INSTALL_DISMISS_KEY = "clickkit:install-dismissed";
export const NOTIFY_SEEN_KEY = "clickkit:notified-tools";
export const INSTALL_DISMISS_DAYS = 21;
export const INSTALL_PROMPT_DELAY_MS = 6000;

/** Ask again only after the cooldown, and never inside an installed window. */
export const shouldOfferInstall = ({
	standalone,
	dismissedAt,
	now = new Date(),
	cooldownDays = INSTALL_DISMISS_DAYS,
}: {
	standalone: boolean;
	dismissedAt: string | null;
	now?: Date;
	cooldownDays?: number;
}) => {
	if (standalone) return false;
	if (!dismissedAt) return true;
	const dismissed = Date.parse(dismissedAt);
	if (!Number.isFinite(dismissed)) return true;
	return (now.getTime() - dismissed) / 86_400_000 >= cooldownDays;
};

export const isIosDevice = (userAgent: string) => /iphone|ipad|ipod/iu.test(userAgent) || (/macintosh/iu.test(userAgent) && /mobile/iu.test(userAgent));

export const isStandaloneMode = (displayStandalone: boolean, navigatorStandalone: boolean) => displayStandalone || navigatorStandalone;

/** iOS has no install prompt event, so the card explains the share-sheet route instead. */
export const installInstructions = (ios: boolean) =>
	ios
		? "On iPhone or iPad: tap the Share button in Safari, then “Add to Home Screen”."
		: "Your browser will ask for a quick confirmation — it installs without an app store.";

/**
 * What we last told the browser about. A list of tool slugs, because several tools often land on
 * the same day — a date alone would hide every tool added after the first one that day.
 */
export type SeenTools = { slugs: string[]; at: string | null };

/** Reads the stored watermark, including the plain "yyyy-mm-dd" value older visits left behind. */
export const parseSeen = (raw: string | null): SeenTools => {
	if (!raw) return { slugs: [], at: null };
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			const record = parsed as { slugs?: unknown; at?: unknown };
			const slugs = Array.isArray(record.slugs) ? record.slugs.filter((slug): slug is string => typeof slug === "string") : [];
			return { slugs, at: typeof record.at === "string" ? record.at : null };
		}
	} catch {
		// Not JSON: an old date-only watermark.
	}
	return { slugs: [], at: raw.slice(0, 10) };
};

/** Everything in the catalogue right now, ready to be stored as "nothing here is news". */
export const seenSnapshot = (known: Tool[] = tools): SeenTools => ({ slugs: known.map((tool) => tool.slug), at: latestToolDate() });

/** Tools added since the last notification we showed. */
export const unseenTools = (lastSeen: string | null, now: Date = new Date()): Tool[] => {
	const seen = parseSeen(lastSeen);
	return recentTools(now).filter((tool) => {
		if (seen.slugs.includes(tool.slug)) return false;
		const added = toolAddedOn(tool.slug);
		if (added === null) return false;
		// An explicit list speaks for itself. A bare date from an older visit means "up to and
		// including that day", so a same-day batch is still announced once.
		return seen.slugs.length > 0 || seen.at === null || added >= seen.at;
	});
};

/** A notification for a deploy that added tools while this tab stayed open. */
export const buildNotification = (remoteTools: number, pageTools: number, siteName = "ClickKit") => {
	const added = remoteTools - pageTools;
	if (added <= 0) return null;
	return {
		title: added === 1 ? `A new tool just landed on ${siteName}` : `${added} new tools just landed on ${siteName}`,
		body: "Tap to see what is new — everything runs in your browser.",
		url: "/changelog",
	};
};

export const toolNotification = (tools: Tool[], siteName = "ClickKit") => {
	if (!tools.length) return null;
	const single = tools.length === 1;
	const names = tools.map((tool) => tool.name);
	const body = single
		? "Tap to try it — it runs right in your browser."
		: `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}. Tap to see what is new.`;
	return {
		title: single ? `New on ${siteName}: ${names[0]}` : `${tools.length} new tools on ${siteName}`,
		body,
		url: single ? `/tools/${tools[0].slug}` : "/changelog",
	};
};

/** The newest tool date in the catalogue, used as the "seen" watermark. */
export const latestToolDate = () => {
	const dates = recentTools().map((tool) => toolAddedOn(tool.slug)).filter((date): date is string => Boolean(date));
	return dates.sort((left, right) => right.localeCompare(left))[0] ?? null;
};

export const supportsNotifications = (hasNotification: boolean, hasServiceWorker: boolean) => hasNotification && hasServiceWorker;

/** Plain-language status for the notification row in the install card. */
export const notifyPermissionCopy = (permission: NotificationPermission | "unsupported") => {
	if (permission === "granted") return "Alerts are on — you will hear from us only when a new tool ships.";
	if (permission === "denied") return "Alerts are blocked in this browser. Re-enable them in site settings if you change your mind.";
	return "Want a nudge when a new tool lands? We send one notification per release, nothing else.";
};
