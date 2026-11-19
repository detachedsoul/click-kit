import { buildInfo } from "@/lib/build-info";

// Prerendered with the rest of the site, so it always describes the deploy that is serving it.
export const dynamic = "force-static";
export const revalidate = false;

export const GET = () =>
	Response.json(buildInfo(), {
		headers: {
			"cache-control": "no-store, max-age=0",
			"content-type": "application/json",
		},
	});
