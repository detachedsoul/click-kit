import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export const metadata: Metadata = {
	title: { default: "ClickKit — your everyday digital toolbox", template: "%s · ClickKit" },
	description: "A thoughtfully made collection of useful browser-based tools for writing, numbers, code, images, and getting things done.",
	openGraph: { title: "ClickKit — your everyday digital toolbox", description: "Small tools for everyday digital tasks. Private, practical, and made to be useful.", type: "website" },
};

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
	<html lang="en">
		<body><SiteHeader /><main>{children}</main><SiteFooter /></body>
	</html>
);

export default RootLayout;
