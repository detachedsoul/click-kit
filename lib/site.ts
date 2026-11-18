export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://click-kit.vercel.app").replace(/\/$/u, "");

export const siteName = "ClickKit";
export const siteTagline = "Good tools. Less fuss.";
export const siteDescription =
	"ClickKit is a collection of free, private browser tools for writing, numbers, code, images, and everyday tasks. No account, no uploads — your data stays in your browser.";

export const toolUrl = (slug: string) => `${siteUrl}/tools/${slug}`;
export const categoryUrl = (id: string) => `${siteUrl}/category/${id}`;
