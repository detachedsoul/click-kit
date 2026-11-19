import { recentTools, toolAddedOn } from "@/lib/tool-recency";
import type { Tool } from "@/lib/tools";

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

/** Tools added since the last notification we showed. */
export const unseenTools = (lastSeen: string | null, now: Date = new Date()): Tool[] =>
	recentTools(now).filter((tool) => {
		const added = toolAddedOn(tool.slug);
		return added !== null && (lastSeen === null || added > lastSeen);
	});

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
