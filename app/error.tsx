"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="mx-auto w-[calc(100%-2rem)] max-w-[720px] py-[80px] max-[620px]:py-[50px]">
			<p className="m-0 font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark">Something broke</p>
			<h1 className="mb-3 mt-3 font-serif text-[clamp(42px,6vw,64px)] font-normal leading-[.95] tracking-[-.03em]">That did not go to plan.</h1>
			<p className="m-0 max-w-[520px] text-sm leading-[1.7] text-[#60635b]">
				The page hit an unexpected problem. Your data was never uploaded — every ClickKit tool runs in this browser. Try again, or head back to the tool list.
			</p>
			<div className="mt-6 flex flex-wrap gap-2">
				<button
					className="inline-flex min-h-10 cursor-pointer items-center border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					onClick={reset}
					type="button"
				>
					Try again
				</button>
				<Link
					className="inline-flex min-h-10 items-center border border-line bg-surface px-4 text-xs font-medium text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					href="/"
				>
					All tools
				</Link>
			</div>
		</div>
	);
}
