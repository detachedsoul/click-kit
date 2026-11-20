"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small, defensive wrapper over localStorage for the tools that remember what you typed.
 * Everything stays on this device: nothing is sent anywhere, and a browser that blocks or
 * fills its storage still gets a working tool for the visit.
 */

export const readStore = <T,>(key: string, fallback: T, revive: (raw: unknown) => T): T => {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		return revive(JSON.parse(raw) as unknown);
	} catch {
		// Unreadable JSON, a blocked store, or an older shape: start from the fallback.
		return fallback;
	}
};

export const writeStore = (key: string, value: unknown) => {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota or a blocked store. The tool still works until the tab is closed.
	}
};

export const clearStore = (key: string) => {
	try {
		window.localStorage.removeItem(key);
	} catch {
		// Nothing to do; the key was not reachable anyway.
	}
};

/**
 * State that survives a reload. The first render shows the fallback so server and client
 * markup agree, then the stored value arrives in an effect and is written back on every change.
 */
export const useStoredState = <T,>(key: string, fallback: T, revive: (raw: unknown) => T) => {
	const [value, setValue] = useState<T>(fallback);
	const [ready, setReady] = useState(false);
	const fallbackRef = useRef(fallback);
	const reviveRef = useRef(revive);

	useEffect(() => {
		setValue(readStore(key, fallbackRef.current, reviveRef.current));
		setReady(true);
	}, [key]);

	useEffect(() => {
		if (!ready) return;
		writeStore(key, value);
	}, [key, value, ready]);

	return [value, setValue, ready] as const;
};
