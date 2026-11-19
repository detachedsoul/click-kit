/* ClickKit service worker: installable app shell plus new-tool notifications. */

const VERSION = "clickkit-v1";
const OFFLINE_URLS = ["/", "/tools"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(VERSION)
			.then((cache) => cache.addAll(OFFLINE_URLS))
			.catch(() => undefined)
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

	// Pages: network first, so a new tool is never hidden behind a stale cache.
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
					return response;
				})
				.catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
		);
		return;
	}

	// Assets: cache first, refreshed in the background.
	event.respondWith(
		caches.match(request).then((cached) => {
			const network = fetch(request)
				.then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
					}
					return response;
				})
				.catch(() => cached);
			return cached || network;
		}),
	);
});

const showToolNotification = async (payload) => {
	const data = payload || {};
	const title = data.title || "New tools on ClickKit";
	const options = {
		body: data.body || "Tap to see what just landed.",
		icon: "/icon-192.png",
		badge: "/icon-192.png",
		tag: "clickkit-new-tools",
		renotify: true,
		data: { url: data.url || "/changelog" },
	};
	await self.registration.showNotification(title, options);
};

/* Real push: send { title, body, url } from your push service. */
self.addEventListener("push", (event) => {
	let payload = null;
	try {
		payload = event.data ? event.data.json() : null;
	} catch {
		payload = { body: event.data ? event.data.text() : undefined };
	}
	event.waitUntil(showToolNotification(payload));
});

/* Local notifications: the page asks for a heads-up when the catalogue grows. */
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "notify-new-tools") event.waitUntil(showToolNotification(event.data.payload));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url.startsWith(self.location.origin)) {
					client.navigate(target);
					return client.focus();
				}
			}
			return self.clients.openWindow(target);
		}),
	);
});
