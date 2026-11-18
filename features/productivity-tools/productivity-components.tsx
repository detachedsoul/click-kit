"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { CheckboxField, selectClassName } from "@/features/developer-tools/tool-ui";
import {
	chooseRandomOption,
	generatePassword,
	generateQrCode,
	type PasswordOptions,
} from "@/features/productivity-tools/productivity-utils";

const fieldClass =
	"block h-11 w-full border border-[#d9d7cd] bg-surface px-3 text-sm text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent";
const actionClass =
	"min-h-10 cursor-pointer bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-[#b8b9b1]";
const sectionClass = "flex flex-col gap-4 p-7 max-[760px]:p-[18px] max-[520px]:gap-3 max-[520px]:p-[14px]";

export const QrGeneratorTool = () => {
	const [source, setSource] = useState("https://clickkit.tools");
	const [dataUrl, setDataUrl] = useState("");
	const [error, setError] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const generate = async () => {
		setIsGenerating(true);
		setError("");
		setDataUrl("");
		try {
			setDataUrl(await generateQrCode(source));
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Could not generate this QR code.");
		} finally {
			setIsGenerating(false);
		}
	};
	return (
		<div className={sectionClass}>
			<TextAreaField
				id="qr-content"
				label="Link or message"
				readOnly={isGenerating}
				value={source}
				onChange={(value) => {
					setSource(value);
					setDataUrl("");
					setError("");
				}}
				placeholder="https://example.com or a short message"
				rows={4}
				hint="QR codes are generated locally. Shorter content is easier to scan."
			/>
			<button
				className={actionClass + " self-start"}
				type="button"
				onClick={() => void generate()}
				disabled={isGenerating}
			>
				{isGenerating ? "Generating…" : "Generate QR code"}
			</button>
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{dataUrl && (
				<div className="flex flex-col items-start gap-3 border-t border-line pt-4">
					<h2 className="m-0 text-sm font-semibold">Your QR code</h2>
					<Image
						className="h-64 w-64 max-w-full border border-line bg-white p-2"
						src={dataUrl}
						width={512}
						height={512}
						unoptimized
						alt="Generated QR code"
					/>
					<a
						className="inline-flex min-h-10 cursor-pointer items-center border border-line bg-surface px-4 text-xs font-medium text-ink hover:bg-[#f3f2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						href={dataUrl}
						download="clickkit-qr-code.png"
					>
						Download PNG
					</a>
				</div>
			)}
		</div>
	);
};

export const PasswordGeneratorTool = () => {
	const [length, setLength] = useState(20);
	const [options, setOptions] = useState<PasswordOptions>({
		length: 20,
		lowercase: true,
		uppercase: true,
		numbers: true,
		symbols: true,
		excludeAmbiguous: false,
	});
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const updateLength = (value: number) => {
		setLength(value);
		setOptions((current) => ({ ...current, length: value }));
		setPassword("");
	};
	const toggle = (key: "lowercase" | "uppercase" | "numbers" | "symbols" | "excludeAmbiguous", checked: boolean) => {
		setOptions((current) => ({ ...current, [key]: checked }));
		setPassword("");
	};
	const generate = () => {
		try {
			setPassword(generatePassword(options));
			setError("");
		} catch (caughtError) {
			setPassword("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not generate a password.");
		}
	};
	const checks: { key: "lowercase" | "uppercase" | "numbers" | "symbols" | "excludeAmbiguous"; label: string }[] = [
		{ key: "lowercase", label: "Lowercase letters" },
		{ key: "uppercase", label: "Uppercase letters" },
		{ key: "numbers", label: "Numbers" },
		{ key: "symbols", label: "Symbols" },
		{ key: "excludeAmbiguous", label: "Exclude look-alike characters" },
	];
	return (
		<div className={sectionClass}>
			<label className="block max-w-[440px] text-xs font-semibold text-[#3c3d37]" htmlFor="password-length">
				Length <span className="ml-2 font-mono font-normal text-muted">{length}</span>
				<input
					className="mt-3 block w-full cursor-pointer accent-[#405a4e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					id="password-length"
					type="range"
					min={4}
					max={128}
					value={length}
					onChange={(event) => updateLength(Number(event.target.value))}
				/>
			</label>
			<fieldset className="m-0 grid grid-cols-2 gap-3 border border-line p-4 max-[520px]:grid-cols-1">
				<legend className="px-1 text-xs font-semibold">Include</legend>
				{checks.map(({ key, label }) => (
					<CheckboxField checked={options[key]} key={key} label={label} onChange={(next) => toggle(key, next)} />
				))}
			</fieldset>
			<button className={actionClass + " self-start"} type="button" onClick={generate}>
				Generate password
			</button>
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{password && (
				<section className="flex flex-col gap-3 border-t border-line pt-4" aria-live="polite">
					<div className="flex items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Generated password</h2>
						<CopyTextButton text={password} />
					</div>
					<p className="m-0 break-all border border-line bg-[#f6f5f0] p-4 font-mono text-sm leading-relaxed">
						{password}
					</p>
					<p className="m-0 text-[11px] leading-relaxed text-muted">
						Created locally with cryptographically secure browser randomness. No password is transmitted or
						stored.
					</p>
				</section>
			)}
		</div>
	);
};

type ImageMode = "compress" | "resize";
type ImageResult = { url: string; filename: string; width: number; height: number; size: number; type: string };

const ImageTool = ({ mode }: { mode: ImageMode }) => {
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState("");
	const [width, setWidth] = useState(0);
	const [height, setHeight] = useState(0);
	const [targetWidth, setTargetWidth] = useState(0);
	const [targetHeight, setTargetHeight] = useState(0);
	const [format, setFormat] = useState("image/webp");
	const [quality, setQuality] = useState(80);
	const [keepRatio, setKeepRatio] = useState(true);
	const [result, setResult] = useState<ImageResult | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(
		() => () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		},
		[previewUrl],
	);
	const chooseFile = async (selected: File | undefined) => {
		setError("");
		setResult(null);
		if (!selected) return;
		setFile(null);
		setPreviewUrl("");
		if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(selected.type)) {
			setError("Choose a PNG, JPEG, WebP, GIF, or AVIF image.");
			return;
		}
		if (selected.size > 25 * 1024 * 1024) {
			setError("Choose an image smaller than 25 MB.");
			return;
		}
		let objectUrl = "";
		setBusy(true);
		try {
			const image = new window.Image();
			objectUrl = URL.createObjectURL(selected);
			image.src = objectUrl;
			await image.decode();
			setPreviewUrl(objectUrl);
			setFile(selected);
			setWidth(image.naturalWidth);
			setHeight(image.naturalHeight);
			setTargetWidth(image.naturalWidth);
			setTargetHeight(image.naturalHeight);
		} catch {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
			setError("This image could not be decoded in your browser. Try a PNG, JPEG, or WebP file.");
		} finally {
			setBusy(false);
		}
	};
	const adjustWidth = (value: number) => {
		setTargetWidth(value);
		if (keepRatio && width > 0) setTargetHeight(Math.max(1, Math.round((value * height) / width)));
	};
	const adjustHeight = (value: number) => {
		setTargetHeight(value);
		if (keepRatio && height > 0) setTargetWidth(Math.max(1, Math.round((value * width) / height)));
	};
	const process = async () => {
		if (!file) return;
		if (
			!Number.isInteger(targetWidth) ||
			!Number.isInteger(targetHeight) ||
			targetWidth < 1 ||
			targetHeight < 1 ||
			targetWidth > 8192 ||
			targetHeight > 8192 ||
			targetWidth * targetHeight > 40_000_000
		) {
			setError("Choose whole-number dimensions up to 8,192 pixels per side and 40 megapixels total.");
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const image = new window.Image();
			image.src = previewUrl;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			if (format === "image/jpeg") {
				context.fillStyle = "#ffffff";
				context.fillRect(0, 0, targetWidth, targetHeight);
			}
			context.drawImage(image, 0, 0, targetWidth, targetHeight);
			const blob = await new Promise<Blob>((resolve, reject) =>
				canvas.toBlob(
					(value) =>
						value ? resolve(value) : reject(new Error("The browser could not encode this image format.")),
					format,
					quality / 100,
				),
			);
			const actualFormat = blob.type || format;
			const extension = actualFormat === "image/jpeg" ? "jpg" : actualFormat === "image/png" ? "png" : "webp";
			const url = URL.createObjectURL(blob);
			setResult({
				url,
				filename: `${file.name.replace(/\.[^.]+$/u, "")}-${mode === "resize" ? "resized" : "compressed"}.${extension}`,
				width: targetWidth,
				height: targetHeight,
				size: blob.size,
				type: actualFormat,
			});
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Could not process this image.");
		} finally {
			setBusy(false);
		}
	};
	useEffect(
		() => () => {
			if (result?.url) URL.revokeObjectURL(result.url);
		},
		[result],
	);
	return (
		<div className={sectionClass}>
			<div>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor={`${mode}-file`}>
					Image file
				</label>
				<input
					className="mt-2 block w-full cursor-pointer border border-line bg-surface p-2 text-xs file:mr-3 file:min-h-8 file:cursor-pointer file:border-0 file:bg-[#eeede7] file:px-3 file:text-xs file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					id={`${mode}-file`}
					type="file"
					disabled={busy}
					accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
					onChange={(event) => void chooseFile(event.target.files?.[0])}
				/>
				<p className="mb-0 mt-2 text-[11px] text-muted">
					Processed on this device. Maximum source size: 25 MB. Animated images are exported as a single still
					frame; transparency becomes white in JPEG output.
				</p>
			</div>
			{busy && !file && (
				<p className="m-0 text-xs text-muted" role="status">
					Loading image dimensions locally…
				</p>
			)}
			{file && (
				<>
					<div className="flex flex-wrap items-center gap-4 border border-line bg-[#f8f7f3] p-3">
						<Image
							className="max-h-36 max-w-44 object-contain"
							src={previewUrl}
							width={width}
							height={height}
							unoptimized
							alt={`Preview of ${file.name}`}
						/>
						<p className="m-0 text-xs leading-relaxed text-muted">
							{file.name}
							<br />
							Original: {width.toLocaleString()} × {height.toLocaleString()} px ·{" "}
							{(file.size / 1024).toFixed(1)} KB
						</p>
					</div>
					<div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
						<label className="block text-xs font-semibold" htmlFor={`${mode}-width`}>
							Width (px)
							<input
								className={fieldClass + " mt-2"}
								id={`${mode}-width`}
								disabled={busy}
								type="number"
								min={1}
								max={8192}
								value={targetWidth}
								onChange={(event) => adjustWidth(Number(event.target.value))}
							/>
						</label>
						<label className="block text-xs font-semibold" htmlFor={`${mode}-height`}>
							Height (px)
							<input
								className={fieldClass + " mt-2"}
								id={`${mode}-height`}
								disabled={busy}
								type="number"
								min={1}
								max={8192}
								value={targetHeight}
								onChange={(event) => adjustHeight(Number(event.target.value))}
							/>
						</label>
					</div>
					<CheckboxField checked={keepRatio} disabled={busy} label="Keep aspect ratio" onChange={setKeepRatio} />
					<div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
						<label className="block text-xs font-semibold" htmlFor={`${mode}-format`}>
							Output format
							<select
								className={`${selectClassName} mt-2 cursor-pointer`}
								id={`${mode}-format`}
								disabled={busy}
								value={format}
								onChange={(event) => setFormat(event.target.value)}
							>
								<option value="image/webp">WebP</option>
								<option value="image/jpeg">JPEG</option>
								<option value="image/png">PNG</option>
							</select>
						</label>
						{format !== "image/png" && (
							<label className="block text-xs font-semibold" htmlFor={`${mode}-quality`}>
								Quality <span className="font-mono font-normal text-muted">{quality}%</span>
								<input
									className="mt-4 block w-full cursor-pointer accent-[#405a4e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									id={`${mode}-quality`}
									disabled={busy}
									type="range"
									min={10}
									max={100}
									value={quality}
									onChange={(event) => setQuality(Number(event.target.value))}
								/>
							</label>
						)}
					</div>
					<button
						className={actionClass + " self-start"}
						type="button"
						disabled={busy}
						onClick={() => void process()}
					>
						{busy ? "Processing locally…" : mode === "resize" ? "Resize image" : "Compress image"}
					</button>
				</>
			)}
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{result && (
				<section className="flex flex-col items-start gap-3 border-t border-line pt-4" aria-live="polite">
					<h2 className="m-0 text-sm font-semibold">Processed image</h2>
					<p className="m-0 text-xs text-muted">
						{result.width.toLocaleString()} × {result.height.toLocaleString()} px ·{" "}
						{(result.size / 1024).toFixed(1)} KB · {result.type}
					</p>
					{mode === "compress" && (
						<p className="m-0 text-xs text-muted">
							{result.size < (file?.size ?? result.size)
								? `${((1 - result.size / (file?.size ?? result.size)) * 100).toFixed(1)}% smaller than the original.`
								: "This output is not smaller than the original; try a lower quality or smaller dimensions."}
						</p>
					)}
					<a
						className="inline-flex min-h-10 cursor-pointer items-center border border-line bg-surface px-4 text-xs font-medium text-ink hover:bg-[#f3f2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						href={result.url}
						download={result.filename}
					>
						Download {result.filename}
					</a>
				</section>
			)}
		</div>
	);
};

export const ImageCompressorTool = () => <ImageTool mode="compress" />;
export const ImageResizerTool = () => <ImageTool mode="resize" />;

export const RandomPickerTool = () => {
	const [source, setSource] = useState("Tea\nCoffee\nWater");
	const [winner, setWinner] = useState("");
	const [error, setError] = useState("");
	const count = useMemo(
		() =>
			source
				.split(/\r?\n/u)
				.map((item) => item.trim())
				.filter(Boolean).length,
		[source],
	);
	const pick = () => {
		try {
			const selected = chooseRandomOption(source);
			setWinner(selected.choice);
			setError("");
		} catch (caughtError) {
			setWinner("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not pick a choice.");
		}
	};
	return (
		<div className={sectionClass}>
			<TextAreaField
				id="random-choices"
				label="Choices (one per line)"
				value={source}
				onChange={(value) => {
					setSource(value);
					setWinner("");
					setError("");
				}}
				placeholder="Add one choice per line…"
				rows={8}
				hint={`${count} non-empty choices. Duplicate lines count as separate entries.`}
			/>
			{count < 2 && (
				<p className="m-0 text-xs text-muted" role="status">
					Add at least two non-empty choices to pick one.
				</p>
			)}
			<button className={actionClass + " self-start"} type="button" onClick={pick} disabled={count < 2}>
				Pick one
			</button>
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{winner && (
				<section className="flex flex-col gap-2 border-t border-line pt-4" aria-live="polite">
					<h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">Your pick</h2>
					<p className="m-0 break-words border border-line bg-[#f6f5f0] p-4 font-serif text-2xl">{winner}</p>
					<p className="m-0 text-[11px] text-muted">
						Selected locally with browser cryptographic randomness from {count} entries.
					</p>
				</section>
			)}
		</div>
	);
};

export const PomodoroTimerTool = () => {
	const [focusMinutes, setFocusMinutes] = useState(25);
	const [breakMinutes, setBreakMinutes] = useState(5);
	const [isBreak, setIsBreak] = useState(false);
	const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
	const [isRunning, setIsRunning] = useState(false);
	const [deadline, setDeadline] = useState<number | null>(null);
	useEffect(() => {
		if (!isRunning || deadline === null) return;
		const updateRemaining = () => {
			const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
			setSecondsRemaining(remaining);
			if (remaining === 0) {
				setIsRunning(false);
				setDeadline(null);
			}
		};
		const timer = window.setInterval(updateRemaining, 1000);
		return () => window.clearInterval(timer);
	}, [isRunning, deadline]);
	const totalSeconds = (isBreak ? breakMinutes : focusMinutes) * 60;
	const minutes = Math.floor(secondsRemaining / 60)
		.toString()
		.padStart(2, "0");
	const seconds = (secondsRemaining % 60).toString().padStart(2, "0");
	const progress =
		totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - secondsRemaining) / totalSeconds) * 100)) : 0;
	const reset = () => {
		setIsRunning(false);
		setDeadline(null);
		setIsBreak(false);
		setSecondsRemaining(focusMinutes * 60);
	};
	const toggleTimer = () => {
		if (isRunning) {
			const remaining =
				deadline === null ? secondsRemaining : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
			setSecondsRemaining(remaining);
			setIsRunning(false);
			setDeadline(null);
		} else if (secondsRemaining > 0) {
			setDeadline(Date.now() + secondsRemaining * 1000);
			setIsRunning(true);
		}
	};
	const updateDuration = (mode: "focus" | "break", value: number) => {
		if (!Number.isInteger(value) || value < 1 || value > 120) return;
		setIsRunning(false);
		setDeadline(null);
		if (mode === "focus") {
			setFocusMinutes(value);
			if (!isBreak) setSecondsRemaining(value * 60);
		} else {
			setBreakMinutes(value);
			if (isBreak) setSecondsRemaining(value * 60);
		}
	};
	return (
		<div className={sectionClass}>
			<section
				className="flex flex-col items-center gap-4 border border-line bg-[#f8f7f3] px-5 py-8"
				aria-label="Pomodoro timer"
			>
				<p className="m-0 text-xs font-semibold uppercase tracking-[.12em] text-muted" role="status">
					{isBreak ? "Break time" : "Focus session"}
					{secondsRemaining === 0 ? " complete" : ""}
				</p>
				<p
					className="m-0 font-mono text-[clamp(3rem,15vw,5.5rem)] leading-none tabular-nums"
					aria-label={`${minutes} minutes ${seconds} seconds remaining`}
					role="timer"
				>
					{minutes}:{seconds}
				</p>
				<div
					className="h-1.5 w-full max-w-[340px] bg-[#deddd4]"
					role="progressbar"
					aria-label="Timer progress"
					aria-valuenow={Math.round(progress)}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div className="h-full bg-[#405a4e] transition-[width]" style={{ width: `${progress}%` }} />
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					<button
						className={actionClass}
						type="button"
						onClick={toggleTimer}
						disabled={secondsRemaining === 0}
					>
						{isRunning ? "Pause" : "Start"}
					</button>
					<button
						className="min-h-10 cursor-pointer border border-line bg-surface px-4 text-xs font-medium text-ink hover:bg-[#f3f2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						type="button"
						onClick={reset}
					>
						Reset focus
					</button>
					{secondsRemaining === 0 && (
						<button
							className="min-h-10 cursor-pointer border border-line bg-surface px-4 text-xs font-medium text-ink hover:bg-[#f3f2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							type="button"
							onClick={() => {
								setIsBreak((previous) => !previous);
								setSecondsRemaining((isBreak ? focusMinutes : breakMinutes) * 60);
							}}
						>
							Start {isBreak ? "focus" : "break"}
						</button>
					)}
				</div>
			</section>
			<fieldset className="m-0 grid grid-cols-2 gap-3 border border-line p-4 max-[520px]:grid-cols-1">
				<legend className="px-1 text-xs font-semibold">Session lengths</legend>
				<label className="block text-xs font-semibold" htmlFor="focus-duration">
					Focus (minutes)
					<input
						className={fieldClass + " mt-2"}
						id="focus-duration"
						type="number"
						min={1}
						max={120}
						value={focusMinutes}
						onChange={(event) => updateDuration("focus", Number(event.target.value))}
					/>
				</label>
				<label className="block text-xs font-semibold" htmlFor="break-duration">
					Break (minutes)
					<input
						className={fieldClass + " mt-2"}
						id="break-duration"
						type="number"
						min={1}
						max={120}
						value={breakMinutes}
						onChange={(event) => updateDuration("break", Number(event.target.value))}
					/>
				</label>
			</fieldset>
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				This timer runs in this tab and does not send notifications if the page is closed. Keep this page open
				while a session is running.
			</p>
		</div>
	);
};
