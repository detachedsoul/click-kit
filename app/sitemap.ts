import type { MetadataRoute } from "next";
import { categories, tools } from "@/lib/tools";
import { siteUrl } from "@/lib/site";

const lastModified = new Date("2026-11-15");

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{ url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
		...categories.map((category) => ({ url: `${siteUrl}/category/${category.id}`, lastModified, changeFrequency: "weekly" as const, priority: 0.8 })),
		{ url: `${siteUrl}/tools`, lastModified, changeFrequency: "weekly" as const, priority: 0.9 },
		{ url: `${siteUrl}/changelog`, lastModified, changeFrequency: "weekly" as const, priority: 0.5 },
		{ url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly" as const, priority: 0.3 },
		...tools
			.filter((tool) => tool.status === "available")
			.map((tool) => ({ url: `${siteUrl}/tools/${tool.slug}`, lastModified, changeFrequency: "monthly" as const, priority: 0.6 })),
	];
}
