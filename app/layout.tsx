import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import type { Metadata } from "next";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./globals.css";

export const metadata: Metadata = {
	title: { default: "ClickKit — your everyday digital toolbox", template: "%s · ClickKit" },
	description: "A thoughtfully made collection of useful browser-based tools for writing, numbers, code, images, and getting things done.",
	openGraph: { title: "ClickKit — your everyday digital toolbox", description: "Small tools for everyday digital tasks. Private, practical, and made to be useful.", type: "website" },
};

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
	<html className="min-w-[320px] scroll-smooth bg-paper" lang="en">
		<body className="m-0 min-h-screen bg-paper font-sans text-[15px] font-normal text-ink antialiased"><SiteHeader /><main>{children}</main><SiteFooter /></body>
	</html>
);

export default RootLayout;
