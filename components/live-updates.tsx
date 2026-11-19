"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2, RefreshCw, Sparkles, X } from "lucide-react";
import { FIRST_CHECK_MS, isStale, offlineMessage, parseSnapshot, POLL_INTERVAL_MS, shouldAutoRefresh, updateMessage, upToDateMessage, waitingMessage, type BuildSnapshot } from "@/lib/live-updates";
import { alreadyAnnounced, markAnnounced, notificationsReady, showToolNotification } from "@/lib/notify";
import { buildNotification } from "@/lib/pwa";

type CheckState = "idle" | "checking" | "stale" | "current" | "offline";

const fetchSnapshot = async (): Promise<BuildSnapshot | null> => {
	const response = await fetch(`/api/version?at=${Date.now()}`, { cache: "no-store" });
	if (!response.ok) throw new Error(`Version check failed with ${response.status}`);
	return parseSnapshot(await response.json());
};

/** Shared check: no page reload, just a comparison of the served build with the running one. */
const useVersionCheck = (version: string, tools: number) => {
	const [state, setState] = useState<CheckState>("idle");
	const [remote, setRemote] = useState<BuildSnapshot | null>(null);
	const inFlight = useRef(false);

	const check = useCallback(async () => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setState("checking");
		try {
			const snapshot = await fetchSnapshot();
			setRemote(snapshot);
			const stale = isStale(version, snapshot);
			setState(stale ? "stale" : "current");
			return stale ? snapshot : null;
		} catch {
			setState("offline");
			return null;
		} finally {
			inFlight.current = false;
		}
	}, [version]);

	return { state, remote, check, message: state === "stale" ? updateMessage(remote, tools) : state === "current" ? upToDateMessage : state === "offline" ? offlineMessage : "" };
};

type LiveUpdatesProps = { version: string; tools: number };

/**
 * Keeps an open tab in step with the deployment: when a newer build appears, the server
 * components on the page are refreshed in place — no reload, no lost scroll position.
 */
export const LiveUpdates = ({ version, tools }: LiveUpdatesProps) => {
	const router = useRouter();
	const pathname = usePathname();
	const { state, remote, check } = useVersionCheck(version, tools);
	const [isPending, startTransition] = useTransition();
	const [waiting, setWaiting] = useState<BuildSnapshot | null>(null);
	const [dismissed, setDismissed] = useState<string | null>(null);
	// Tool pages keep whatever the person loaded, so they are never rebuilt under them.
	const auto = shouldAutoRefresh(pathname);
	// Once the refreshed layout hands us the new version, the notice clears itself.
	const showNotice = state === "stale" && remote?.version !== version;

	/** One alert per deploy, even though the tab keeps checking. */
	const announce = useCallback((snapshot: BuildSnapshot) => {
		const permission = typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported";
		if (!notificationsReady("Notification" in globalThis, typeof navigator !== "undefined" && "serviceWorker" in navigator, permission)) return;
		if (alreadyAnnounced(snapshot.version)) return;
		const payload = buildNotification(snapshot.tools, tools);
		if (!payload) return;
		markAnnounced(snapshot.version);
		void showToolNotification(payload);
	}, [tools]);

	useEffect(() => {
		const run = () => {
			void check().then((stale) => {
				if (!stale) return;
				announce(stale);
				if (auto) startTransition(() => router.refresh());
				else setWaiting(stale);
			});
		};
		const first = window.setTimeout(run, FIRST_CHECK_MS);
		const interval = window.setInterval(run, POLL_INTERVAL_MS);
		const onVisible = () => {
			if (!document.hidden) run();
		};
		const onOnline = () => run();
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("online", onOnline);
		// A deploy also ships a new service worker; let it take over while the tab stays open.
		void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
		return () => {
			window.clearTimeout(first);
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("online", onOnline);
		};
	}, [announce, auto, check, router]);

	const waitingNotice = waiting && dismissed !== waiting.version ? waiting : null;
	const notice = auto ? (showNotice ? remote : null) : waitingNotice;
	if (!notice && !isPending) return null;

	return (
		<div
			aria-live="polite"
			className="fixed bottom-4 left-4 z-40 flex max-w-[min(92vw,360px)] items-start gap-2.5 border border-line bg-surface px-3 py-2.5 text-[11px] leading-[1.5] text-ink shadow-[0_10px_24px_#322c2014]"
			role="status"
		>
			<Sparkles aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={14} />
			{waitingNotice ? (
				<div className="flex flex-col gap-2">
					<span>{waitingMessage(waitingNotice, tools)}</span>
					<span className="text-muted">Refreshing starts the page fresh, so anything you have loaded here is cleared.</span>
					<div className="flex flex-wrap items-center gap-3">
						<button
							className="inline-flex min-h-8 cursor-pointer items-center border border-forest bg-forest px-3 text-[11px] font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={() => startTransition(() => router.refresh())}
							type="button"
						>
							Refresh now
						</button>
						<button
							aria-label="Dismiss update notice"
							className="grid size-8 cursor-pointer place-items-center text-[#5f6259] hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={() => setDismissed(waitingNotice.version)}
							type="button"
						>
							<X aria-hidden="true" size={13} />
						</button>
					</div>
				</div>
			) : (
				<span>{updateMessage(remote, tools)}</span>
			)}
		</div>
	);
};

/** A manual trigger for the changelog, where people expect to be able to ask for news. */
export const CheckForUpdates = ({ version, tools }: LiveUpdatesProps) => {
	const router = useRouter();
	const { state, message, check } = useVersionCheck(version, tools);
	const [isPending, startTransition] = useTransition();

	const run = async () => {
		const stale = await check();
		if (stale) startTransition(() => router.refresh());
	};

	const idle = state === "idle";
	const label = idle ? "Check for new entries" : isPending ? "Updating…" : state === "checking" ? "Checking…" : "Check again";

	return (
		<div className="flex flex-wrap items-center gap-3">
			<button
				className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-surface px-3 text-[11px] text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				disabled={state === "checking" || isPending}
				onClick={() => void run()}
				type="button"
			>
				{state === "current" ? <CheckCircle2 aria-hidden="true" size={13} /> : <RefreshCw aria-hidden="true" size={13} />}
				{label}
			</button>
			{message ? (
				<p aria-live="polite" className={`m-0 text-[11px] ${state === "stale" ? "text-accent-dark" : "text-muted"}`}>
					{message}
					{state === "stale" ? <ArrowUpRight aria-hidden="true" className="ml-1 inline align-[-1px]" size={11} /> : null}
				</p>
			) : null}
		</div>
	);
};

export default LiveUpdates;
