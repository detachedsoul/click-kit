import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: `${siteName} — everyday browser tools`,
		short_name: siteName,
		description: siteDescription,
		id: "/",
		start_url: "/",
		scope: "/",
		display: "standalone",
		display_override: ["standalone", "minimal-ui"],
		background_color: "#f3f1e9",
		theme_color: "#263b34",
		categories: ["productivity", "utilities", "developer"],
		shortcuts: [
			{ name: "All tools", short_name: "Tools", url: "/tools" },
			{ name: "What's new", short_name: "Changelog", url: "/changelog" },
			{ name: "Image resizer", short_name: "Resize", url: "/tools/image-resizer" },
		],
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
