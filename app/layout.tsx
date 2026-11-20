import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import PwaWidget from "@/components/pwa-widget";
import LiveUpdates from "@/components/live-updates";
import { buildInfo } from "@/lib/build-info";
import type { Metadata, Viewport } from "next";
import { siteDescription, siteName, siteTagline, siteUrl } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./globals.css";

const homeTitle = "ClickKit — free everyday browser tools";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: { default: homeTitle, template: `%s · ${siteName}` },
	description: siteDescription,
	applicationName: siteName,
	category: "productivity",
	keywords: ["browser tools", "online utilities", "text tools", "developer tools", "calculators", "free tools", "no signup"],
	authors: [{ name: "ClickKit", url: siteUrl }],
	creator: "ClickKit",
	publisher: "ClickKit",
	alternates: { canonical: "/" },
	manifest: "/manifest.webmanifest",
	appleWebApp: { capable: true, title: siteName, statusBarStyle: "default" },
	icons: {
		icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
		apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
	},
	openGraph: {
		type: "website",
		siteName,
		title: homeTitle,
		description: siteDescription,
		url: siteUrl,
		locale: "en_GB",
	},
	twitter: { card: "summary_large_image", title: homeTitle, description: siteDescription },
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
	},
	formatDetection: { telephone: false, address: false, email: false },
	// Older iOS versions only honour the prefixed capability tag.
	other: { "apple-mobile-web-app-capable": "yes", "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f3f1e9" },
		{ media: "(prefers-color-scheme: dark)", color: "#263b34" },
	],
	colorScheme: "light",
};

const siteJsonLd = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${siteUrl}/#website`,
			name: siteName,
			alternateName: siteTagline,
			url: siteUrl,
			description: siteDescription,
			inLanguage: "en",
			publisher: { "@id": `${siteUrl}/#organization` },
		},
		{
			"@type": "Organization",
			"@id": `${siteUrl}/#organization`,
			name: siteName,
			url: siteUrl,
			logo: { "@type": "ImageObject", url: `${siteUrl}/icon-512.png`, width: 512, height: 512 },
			sameAs: ["https://github.com/detachedsoul/click-kit"],
		},
	],
};

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
	const build = buildInfo();
	return (
	<html className="min-w-[320px] scroll-smooth bg-paper" lang="en">
		<body className="m-0 min-h-screen bg-paper font-sans text-[15px] font-normal text-ink antialiased">
			<a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-forest focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold" href="#main-content">
				Skip to content
			</a>
			<SiteHeader />
			<main id="main-content">{children}</main>
			<SiteFooter />
			<PwaWidget />
			<LiveUpdates tools={build.tools} version={build.version} />
			<Analytics />
			<SpeedInsights />
			<script dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} type="application/ld+json" />
		</body>
	</html>
	);
};

export default RootLayout;
