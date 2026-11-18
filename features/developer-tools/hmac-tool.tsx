"use client";

import { useEffect, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import {
	generateSecret,
	hmac,
	hashAlgorithms,
	totp,
	verifyTotp,
	type HashAlgorithm,
} from "@/features/developer-tools/hmac-utils";
import { ErrorNote, ResultBlock, ToolPanel, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const numberOptions = (values: number[]) => values.map((value) => ({ value, label: String(value) }));

export const HmacTool = () => {
	const [message, setMessage] = useState("The quick brown fox jumps over the lazy dog");
	const [key, setKey] = useState("secret-key");
	const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
	const [encoding, setEncoding] = useState<"utf8" | "base32">("utf8");
	const [signature, setSignature] = useState<{ value: string; error: string }>({ value: "", error: "" });

	const [secret, setSecret] = useState("JBSWY3DPEHPK3PXP");
	const [digits, setDigits] = useState(6);
	const [period, setPeriod] = useState(30);
	const [totpAlgorithm, setTotpAlgorithm] = useState<HashAlgorithm>("SHA-1");
	const [code, setCode] = useState<{ value: string; remaining: number; error: string }>({ value: "", remaining: 0, error: "" });
	const [token, setToken] = useState("");
	const [verdict, setVerdict] = useState("");
	const [tick, setTick] = useState(0);

	useEffect(() => {
		let active = true;
		const timer = setTimeout(() => {
			hmac(message, key, algorithm, encoding)
				.then((result) => {
					if (!active) return;
					setSignature({ value: [`hex      ${result.hex}`, `base64   ${result.base64}`, `base64url ${result.base64Url}`].join("\n"), error: "" });
				})
				.catch((error: unknown) => {
					if (!active) return;
					setSignature({ value: "", error: error instanceof Error ? error.message : "Could not sign this message." });
				});
		}, 120);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [message, key, algorithm, encoding]);

	useEffect(() => {
		const interval = setInterval(() => setTick((value) => value + 1), 1000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		let active = true;
		totp({ secret, digits, period, algorithm: totpAlgorithm })
			.then((result) => {
				if (active) setCode({ value: result.code, remaining: result.remaining, error: "" });
			})
			.catch((error: unknown) => {
				if (active) setCode({ value: "", remaining: 0, error: error instanceof Error ? error.message : "Could not generate a code." });
			});
		return () => {
			active = false;
		};
	}, [secret, digits, period, totpAlgorithm, tick]);

	const checkToken = async () => {
		try {
			const valid = await verifyTotp(token, { secret, digits, period, algorithm: totpAlgorithm, window: 1 });
			setVerdict(valid ? "Valid for the current, previous, or next time step." : "Not a valid code for this secret at this moment.");
		} catch (error) {
			setVerdict(error instanceof Error ? error.message : "Could not verify this code.");
		}
	};

	return (
		<ToolPanel>
			<section className="flex flex-col gap-4">
				<h2 className="m-0 text-sm font-semibold">HMAC signature</h2>
				<TextAreaField
					id="hmac-message"
					label="Message"
					value={message}
					onChange={setMessage}
					placeholder="Message to sign"
					rows={4}
					hint="Everything here is computed in your browser with the Web Crypto API; nothing is sent anywhere."
				/>
				<div className="grid gap-4 sm:grid-cols-3">
					<span className="flex flex-col gap-2">
						<label className={labelClassName} htmlFor="hmac-key">
							Key
						</label>
						<input className={fieldClassName} id="hmac-key" value={key} onChange={(event) => setKey(event.target.value)} />
					</span>
					<label className={labelClassName} htmlFor="hmac-algorithm">
						HMAC algorithm
						<select className={selectClassName} id="hmac-algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}>
							{hashAlgorithms.map((item) => (
								<option key={item} value={item}>
									{item}
								</option>
							))}
						</select>
					</label>
					<label className={labelClassName} htmlFor="hmac-encoding">
						Key encoding
						<select className={selectClassName} id="hmac-encoding" value={encoding} onChange={(event) => setEncoding(event.target.value as "utf8" | "base32")}>
							<option value="utf8">UTF-8 text</option>
							<option value="base32">Base32</option>
						</select>
					</label>
				</div>
				<ErrorNote message={signature.error} />
				{signature.value && <ResultBlock title="Signature" value={signature.value} rows={4} fileName="hmac.txt" />}
			</section>

			<section className="flex flex-col gap-4 border-t border-line pt-[18px]">
				<h2 className="m-0 text-sm font-semibold">TOTP generator</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<span className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
						<label className={labelClassName} htmlFor="totp-secret">
							TOTP secret (Base32)
						</label>
						<input className={`${fieldClassName} font-mono`} id="totp-secret" value={secret} onChange={(event) => setSecret(event.target.value)} />
					</span>
					<label className={labelClassName} htmlFor="totp-algorithm">
						TOTP algorithm
						<select className={selectClassName} id="totp-algorithm" value={totpAlgorithm} onChange={(event) => setTotpAlgorithm(event.target.value as HashAlgorithm)}>
							{hashAlgorithms.map((item) => (
								<option key={item} value={item}>
									{item}
								</option>
							))}
						</select>
					</label>
					<label className={labelClassName} htmlFor="totp-digits">
						Digits
						<select className={selectClassName} id="totp-digits" value={digits} onChange={(event) => setDigits(Number(event.target.value))}>
							{numberOptions([6, 7, 8]).map((item) => (
								<option key={item.value} value={item.value}>
									{item.label}
								</option>
							))}
						</select>
					</label>
					<label className={labelClassName} htmlFor="totp-period">
						Period (seconds)
						<select className={selectClassName} id="totp-period" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
							{numberOptions([30, 60]).map((item) => (
								<option key={item.value} value={item.value}>
									{item.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<ErrorNote message={code.error} />
				{code.value && (
					<div className="flex flex-wrap items-center gap-4 border border-line bg-[#fbfaf7] px-4 py-3">
						<span aria-label="Current code" className="font-mono text-2xl tracking-[.18em] text-ink">
							{code.value}
						</span>
						<span className="text-xs text-[#5b5e55]">refreshes in {code.remaining}s</span>
						<button className={primaryButtonClassName} onClick={() => setSecret(generateSecret())} type="button">
							New secret
						</button>
					</div>
				)}
				<div className="flex flex-wrap items-end gap-3">
					<span className="flex flex-col gap-2">
						<label className={labelClassName} htmlFor="totp-token">
							Verify a code
						</label>
						<input className={`${fieldClassName} w-36 font-mono`} id="totp-token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="123456" />
					</span>
					<button className={primaryButtonClassName} onClick={() => void checkToken()} type="button">
						Check code
					</button>
					{verdict && <p className="m-0 text-xs text-[#3e4139]">{verdict}</p>}
				</div>
				<p className={hintClassName}>
					TOTP follows RFC 6238 with a 30-second default step and a ±1 step verification window, which matches Google Authenticator, 1Password, and Authy.
				</p>
			</section>
		</ToolPanel>
	);
};
