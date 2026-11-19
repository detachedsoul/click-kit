"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { FIRST_CHECK_MS, isStale, offlineMessage, parseSnapshot, POLL_INTERVAL_MS, updateMessage, upToDateMessage, type BuildSnapshot } from "@/lib/live-updates";

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
	const { state, remote, check } = useVersionCheck(version, tools);
	const [isPending, startTransition] = useTransition();
	// Once the refreshed layout hands us the new version, the notice clears itself.
	const showNotice = state === "stale" && remote?.version !== version;

	useEffect(() => {
		const run = () => {
			void check().then((stale) => {
				if (!stale) return;
				startTransition(() => router.refresh());
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
	}, [check, router]);

	if (!showNotice && !isPending) return null;

	return (
		<div
			aria-live="polite"
			className="fixed bottom-4 left-4 z-40 flex max-w-[min(92vw,340px)] items-start gap-2.5 border border-line bg-surface px-3 py-2.5 text-[11px] leading-[1.5] text-ink shadow-[0_10px_24px_#322c2014]"
			role="status"
		>
			<Sparkles aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={14} />
			<span>{updateMessage(remote, tools)}</span>
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
