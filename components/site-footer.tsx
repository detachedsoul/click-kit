import Shell from "@/components/shell";

const SiteFooter = () => (
	<footer className="border-t border-line py-5 text-[11px] text-[#85857d]">
		<Shell className="flex justify-between gap-[15px] max-[620px]:flex-col">
			<span className="font-bold text-[#41423c]">clickkit</span>
			<span>Small tools. Less friction. Your data stays yours.</span>
			<span>Made for everyday use.</span>
		</Shell>
	</footer>
);

export default SiteFooter;
