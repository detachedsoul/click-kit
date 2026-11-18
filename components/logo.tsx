type LogoMarkProps = {
	size?: number;
	className?: string;
	/** Draws the mark on a transparent background, for use inside dark surfaces. */
	floating?: boolean;
};

/** The ClickKit mark: a pointer hitting its target, drawn as one crisp SVG. */
export const LogoMark = ({ size = 30, className = "", floating = false }: LogoMarkProps) => (
	<svg aria-hidden="true" className={`shrink-0 ${className}`} focusable="false" height={size} viewBox="0 0 32 32" width={size}>
		{!floating && <rect fill="#263b34" height="32" rx="7.5" width="32" />}
		<g transform="translate(21.9 9.1) scale(-1.02 1.02)">
			<path
				d="M0 0 L0 13.4 L3.7 9.9 L6.3 15.6 L9.3 14.2 L6.7 8.6 L11 8.2 Z"
				fill="#fffdf8"
				stroke="#263b34"
				strokeLinejoin="round"
				strokeWidth="1.1"
			/>
		</g>
		<circle cx="23.2" cy="8.4" fill="none" opacity="0.85" r="2.3" stroke="#f1c891" strokeWidth="1.5" />
		<circle cx="23.2" cy="8.4" fill="none" opacity="0.38" r="3.9" stroke="#e08a63" strokeWidth="0.9" />
	</svg>
);

/** Mark plus wordmark, sized for the header and footer. */
export const LogoLockup = ({ size = 30, className = "" }: { size?: number; className?: string }) => (
	<span className={`inline-flex items-center gap-2.5 ${className}`}>
		<LogoMark size={size} />
		<span>clickkit</span>
	</span>
);
