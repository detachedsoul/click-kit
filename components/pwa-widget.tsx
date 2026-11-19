"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, Download, Share2, X } from "lucide-react";
import { LogoMark } from "@/components/logo";
import {
	INSTALL_DISMISS_KEY,
	INSTALL_PROMPT_DELAY_MS,
	installInstructions,
	isIosDevice,
	isStandaloneMode,
	NOTIFY_SEEN_KEY,
	notifyPermissionCopy,
	seenSnapshot,
	shouldOfferInstall,
	supportsNotifications,
	toolNotification,
	unseenTools,
} from "@/lib/pwa";
import { showToolNotification } from "@/lib/notify";
import { tools } from "@/lib/tools";

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const readStore = (key: string) => {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const writeStore = (key: string, value: string) => {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Private mode or a full quota: the prompt simply shows again next visit.
	}
};

const readPermission = (): NotificationPermission | "unsupported" =>
	typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";

const readStandalone = () =>
	typeof window !== "undefined" &&
	isStandaloneMode(window.matchMedia?.("(display-mode: standalone)").matches ?? false, (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Install card plus the new-tool notification opt-in, mounted once in the root layout. */
export const PwaWidget = () => {
	const promptRef = useRef<InstallPromptEvent | null>(null);
	const [open, setOpen] = useState(false);
	const [ios] = useState(() => typeof navigator !== "undefined" && isIosDevice(navigator.userAgent));
	const [installed, setInstalled] = useState(readStandalone);
	const [canPrompt, setCanPrompt] = useState(false);
	const [permission, setPermission] = useState<NotificationPermission | "unsupported">(readPermission);
	const [status, setStatus] = useState("");

	/** Show the browser notification for anything added since the last one we sent. */
	const announceNewTools = useCallback(async () => {
		if (readPermission() !== "granted") return;
		const unseen = unseenTools(readStore(NOTIFY_SEEN_KEY));
		if (!unseen.length) return;
		const payload = toolNotification(unseen);
		if (!payload) return;
		const shown = await showToolNotification(payload);
		// Record the exact slugs we covered, so a same-day batch is not collapsed into one date.
		if (shown) writeStore(NOTIFY_SEEN_KEY, JSON.stringify(seenSnapshot()));
	}, []);

	useEffect(() => {
		const standalone = readStandalone();

		const register = async () => {
			if (!("serviceWorker" in navigator)) return;
			try {
				await navigator.serviceWorker.register("/sw.js", { scope: "/" });
				await navigator.serviceWorker.ready;
				await announceNewTools();
			} catch {
				// Service workers need HTTPS (or localhost); the rest of the site works regardless.
			}
		};
		void register();

		const onInstallPrompt = (event: Event) => {
			event.preventDefault();
			promptRef.current = event as InstallPromptEvent;
			setCanPrompt(true);
			if (shouldOfferInstall({ standalone, dismissedAt: readStore(INSTALL_DISMISS_KEY) })) {
				window.setTimeout(() => setOpen(true), INSTALL_PROMPT_DELAY_MS);
			}
		};
		const onInstalled = () => {
			setInstalled(true);
			setOpen(false);
			setStatus("Installed — look for ClickKit on your home screen.");
		};
		window.addEventListener("beforeinstallprompt", onInstallPrompt);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onInstallPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, [announceNewTools]);

	// iOS never fires beforeinstallprompt, so it gets the share-sheet explanation instead.
	useEffect(() => {
		if (!ios || !("Notification" in window)) return;
		const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (standalone) return;
		if (!shouldOfferInstall({ standalone, dismissedAt: readStore(INSTALL_DISMISS_KEY) })) return;
		const timer = window.setTimeout(() => setOpen(true), INSTALL_PROMPT_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [ios]);

	const dismiss = () => {
		setOpen(false);
		writeStore(INSTALL_DISMISS_KEY, new Date().toISOString());
	};

	const install = async () => {
		const prompt = promptRef.current;
		if (!prompt) return;
		await prompt.prompt();
		const choice = await prompt.userChoice;
		promptRef.current = null;
		if (choice?.outcome === "accepted") {
			setStatus("Installing — ClickKit will open like an app from now on.");
			setOpen(false);
		}
	};

	const askForNotifications = async () => {
		if (!("Notification" in window)) return;
		const result = await Notification.requestPermission();
		setPermission(result);
		if (result === "granted") {
			// Everything on the site right now is already known; only later arrivals are news.
			writeStore(NOTIFY_SEEN_KEY, JSON.stringify(seenSnapshot()));
			setStatus("Alerts on — we will ping you when the next tool lands.");
			await announceNewTools();
		} else {
			setStatus("Notifications stayed off. You can allow them later in your browser settings.");
		}
	};

	const canNotify = supportsNotifications("Notification" in globalThis, typeof navigator !== "undefined" && "serviceWorker" in navigator);
	const showInstallButton = canPrompt && !ios;
	const showCard = open && !installed;

	return (
		<>
			{status ? (
				<p
					aria-live="polite"
					className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 m-0 max-w-[min(92vw,340px)] border border-line bg-surface px-3 py-2 text-[11px] leading-[1.5] text-ink shadow-[0_10px_24px_#322c2014] max-[520px]:bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))]"
				>
					{status}
				</p>
			) : null}
			{showCard ? (
				<aside
					aria-label="Install ClickKit"
					className="fixed bottom-4 right-4 z-50 w-[min(94vw,382px)] border border-line bg-surface p-4 shadow-[0_22px_60px_#241f1626] max-[520px]:bottom-0 max-[520px]:right-0 max-[520px]:w-full max-[520px]:pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					<div className="flex items-start gap-3">
						<LogoMark size={38} />
						<div className="min-w-0 flex-1">
							<p className="m-0 font-mono text-[9px] uppercase tracking-[.12em] text-accent-dark">One tap away</p>
							<h2 className="m-0 mt-1 font-serif text-[21px] font-normal leading-[1.1] tracking-[-.02em]">Keep ClickKit in your pocket</h2>
						</div>
						<button
							aria-label="Dismiss install prompt"
							className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-[2px] text-[#5f6259] hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={dismiss}
							type="button"
						>
							<X aria-hidden="true" size={15} />
						</button>
					</div>
					<ul className="mb-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[12px] leading-[1.5] text-[#50534c]">
						{["Opens full screen from your home screen", `A ${tools.length}-tool toolbox, ready offline`, "No account, no store, no install size"].map((line) => (
							<li className="flex items-start gap-2" key={line}>
								<Check aria-hidden="true" className="mt-0.5 shrink-0 text-[#536b4e]" size={13} />
								{line}
							</li>
						))}
					</ul>
					<p className="mb-0 mt-2.5 text-[11px] leading-[1.55] text-muted">{installInstructions(ios)}</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{showInstallButton ? (
							<button
								className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								onClick={() => void install()}
								type="button"
							>
								<Download aria-hidden="true" size={14} />
								Install app
							</button>
						) : null}
						{ios ? (
							<span className="inline-flex min-h-10 items-center gap-2 border border-line bg-[#f8f7f3] px-3 text-xs text-ink">
								<Share2 aria-hidden="true" size={14} />
								Share, then Add to Home Screen
							</span>
						) : null}
						<button
							className="inline-flex min-h-10 cursor-pointer items-center border border-line bg-surface px-4 text-xs text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={dismiss}
							type="button"
						>
							Not now
						</button>
					</div>
					{canNotify ? (
						<div className="mt-3 flex items-start gap-2 border-t border-line pt-3">
							<span className="mt-0.5 text-accent-dark">{permission === "granted" ? <BellRing aria-hidden="true" size={15} /> : <Bell aria-hidden="true" size={15} />}</span>
							<div className="min-w-0">
								<p className="m-0 text-[11px] leading-[1.5] text-[#50534c]">{notifyPermissionCopy(permission)}</p>
								{permission !== "granted" && permission !== "denied" ? (
									<button
										className="mt-1.5 cursor-pointer text-[11px] font-semibold text-accent-dark underline underline-offset-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
										onClick={() => void askForNotifications()}
										type="button"
									>
										Tell me when new tools land
									</button>
								) : null}
							</div>
						</div>
					) : null}
				</aside>
			) : null}
		</>
	);
};

export default PwaWidget;
