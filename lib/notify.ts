export type NotificationPayload = { title: string; body: string; url: string };

export const NOTIFIED_VERSION_KEY = "clickkit:notified-version";
const ICON = "/icon-192.png";

/** True only when the browser can actually show a notification right now. */
export const notificationsReady = (hasNotification: boolean, hasServiceWorker: boolean, permission: NotificationPermission | "unsupported") =>
	hasNotification && hasServiceWorker && permission === "granted";

/** One alert per deploy: a tab left open checks every minute, so the version is the guard. */
export const alreadyAnnounced = (version: string) => {
	try {
		return window.sessionStorage.getItem(NOTIFIED_VERSION_KEY) === version;
	} catch {
		return false;
	}
};

export const markAnnounced = (version: string) => {
	try {
		window.sessionStorage.setItem(NOTIFIED_VERSION_KEY, version);
	} catch {
		// Storage can be blocked; the worst case is a second alert for the same deploy.
	}
};

/**
 * Shows the alert through the service worker so it works from an installed app, and falls back
 * to the window's own Notification when no worker is registered yet.
 */
export const showToolNotification = async (payload: NotificationPayload): Promise<boolean> => {
	try {
		const registration = await navigator.serviceWorker?.getRegistration();
		if (registration) {
			await registration.showNotification(payload.title, {
				body: payload.body,
				icon: ICON,
				badge: ICON,
				tag: "clickkit-new-tools",
				data: { url: payload.url },
				renotify: true,
			} as NotificationOptions);
			return true;
		}
	} catch {
		// Fall through to the window notification below.
	}
	try {
		if (!("Notification" in window)) return false;
		const notification = new Notification(payload.title, { body: payload.body, icon: ICON });
		notification.onclick = () => {
			window.focus();
			window.location.assign(payload.url);
		};
		return true;
	} catch {
		// The OS can block notifications even when the browser allows them.
		return false;
	}
};
