"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, BellRing } from "lucide-react";
import { latestToolDate, NOTIFY_SEEN_KEY, notifyPermissionCopy } from "@/lib/pwa";

const readPermission = (): NotificationPermission | "unsupported" =>
	typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";

// The server has no Notification API, so it always renders the empty state and the browser fills it in.
const subscribe = () => () => undefined;
const serverPermission = () => "unsupported" as const;

/** Compact new-tool alert switch for the changelog, where people go to see what changed. */
export const NotifyOptIn = () => {
	const live = useSyncExternalStore(subscribe, readPermission, serverPermission);
	const [answered, setAnswered] = useState<NotificationPermission | null>(null);
	const [status, setStatus] = useState("");
	const permission = answered ?? live;

	const enable = async () => {
		if (!("Notification" in window)) return;
		const result = await Notification.requestPermission();
		setAnswered(result);
		if (result !== "granted") {
			setStatus(notifyPermissionCopy(result));
			return;
		}
		const newest = latestToolDate();
		try {
			if (newest) window.localStorage.setItem(NOTIFY_SEEN_KEY, newest);
		} catch {
			// Storage can be blocked; the watermark simply starts from today next time.
		}
		try {
			const registration = await navigator.serviceWorker?.getRegistration();
			await registration?.showNotification("Alerts are on", {
				body: "We will ping you when the next tool ships — one notification per release.",
				icon: "/icon-192.png",
				tag: "clickkit-alerts-on",
			});
			setStatus("Alerts on. One notification per release, nothing else.");
		} catch {
			setStatus("Alerts on. One notification per release, nothing else.");
		}
	};

	if (permission === "unsupported") return null;

	return (
		<div className="flex flex-wrap items-center gap-3 border border-line bg-[#fbfaf7] px-4 py-3">
			<span className="text-accent-dark" aria-hidden="true">
				{permission === "granted" ? <BellRing size={16} /> : <Bell size={16} />}
			</span>
			<p className="m-0 min-w-[220px] flex-1 text-[11px] leading-[1.55] text-[#50534c]">
				{status || notifyPermissionCopy(permission)}
			</p>
			{permission === "default" ? (
				<button
					className="inline-flex min-h-9 cursor-pointer items-center border border-forest bg-forest px-3 text-[11px] font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					onClick={() => void enable()}
					type="button"
				>
					Notify me about new tools
				</button>
			) : null}
		</div>
	);
};

export default NotifyOptIn;
