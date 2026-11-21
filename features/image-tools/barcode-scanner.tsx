"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ExternalLink, Flashlight, FlashlightOff, ScanLine } from "lucide-react";
import { FileField } from "@/features/image-tools/image-file-shared";
import { cameraNote, decodeSource, openCamera, readImageFile, setTorch, supportsTorch, type Raw } from "@/features/image-tools/scan-decoder";
import { formatName, HISTORY_KEY, makeScan, recordScan, reviveScans, scanWhen, shorten, webUrlOf, type Scan, type ScanSource } from "@/features/image-tools/scan-utils";
import { useStoredState } from "@/features/productivity-tools/stored-state";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, SegmentedControl, smallActionClassName, smallPrimaryActionClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";

type Source = "camera" | "image";

/** A camera that keeps decoding the same code every frame would fill the history with one line. */
const SAME_CODE_MS = 2500;

export const BarcodeScanner = () => {
	const [source, setSource] = useState<Source>("camera");
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [cameraError, setCameraError] = useState("");
	const [torchReady, setTorchReady] = useState(false);
	const [torchOn, setTorchOn] = useState(false);
	const [busy, setBusy] = useState(false);
	const [pictureError, setPictureError] = useState("");
	const [latest, setLatest] = useState<Scan | null>(null);
	const [history, setHistory] = useStoredState<Scan[]>(HISTORY_KEY, [], reviveScans);
	const video = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const reportRef = useRef<(raw: Raw, from: ScanSource) => void>(() => undefined);
	const heard = useRef<{ at: number; value: string }>({ at: 0, value: "" });

	const keepAll = (scans: Scan[]) => {
		if (!scans.length) return;
		setLatest(scans[0]);
		// Folded in reverse so the first code of the batch stays at the top of the shelf.
		setHistory((current) => [...scans].reverse().reduce((kept, scan) => recordScan(kept, scan), current));
	};

	const report = (raw: Raw, from: ScanSource) => {
		const now = Date.now();
		if (raw.value === heard.current.value && now - heard.current.at < SAME_CODE_MS) return;
		heard.current = { at: now, value: raw.value };
		keepAll([makeScan(raw.value, raw.format, from)]);
	};

	useEffect(() => {
		reportRef.current = report;
	});

	const stopCamera = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		setStream(null);
		setTorchReady(false);
		setTorchOn(false);
	};

	// A camera left running on a page the visitor has walked away from is a lit light and a hot battery.
	useEffect(
		() => () => {
			streamRef.current?.getTracks().forEach((track) => track.stop());
		},
		[],
	);

	const startCamera = async () => {
		setCameraError("");
		try {
			const media = await openCamera();
			streamRef.current = media;
			setStream(media);
			setTorchReady(supportsTorch(media));
			const element = video.current;
			if (element) {
				element.srcObject = media;
				// Some browsers return nothing from play(); both shapes are fine here.
				await Promise.resolve(element.play()).catch(() => undefined);
			}
		} catch (error) {
			stopCamera();
			setCameraError(cameraNote(error));
		}
	};

	// One decode every third of a second: fast enough to feel instant, slow enough to leave the camera alone.
	useEffect(() => {
		if (!stream) return;
		let working = false;
		const tick = async () => {
			const element = video.current;
			if (working || !element || element.readyState < 2) return;
			working = true;
			try {
				const found = await decodeSource(element);
				if (found[0]) reportRef.current(found[0], "camera");
			} catch {
				// A frame that will not decode is the next frame's problem.
			} finally {
				working = false;
			}
		};
		const timer = window.setInterval(() => void tick(), 340);
		return () => window.clearInterval(timer);
	}, [stream]);

	const switchSource = (next: Source) => {
		if (next !== "camera") stopCamera();
		setSource(next);
	};

	const toggleTorch = async () => {
		const wanted = !torchOn;
		const done = await setTorch(streamRef.current, wanted);
		if (!done) {
			setCameraError("This camera would not switch its light on. On a phone, try the rear camera.");
			return;
		}
		setTorchOn(wanted);
	};

	const scanPicture = async (file: File) => {
		setBusy(true);
		setPictureError("");
		try {
			const found = await readImageFile(file);
			if (!found.length) {
				setPictureError("No barcode or QR code was found in that picture. Try a tighter crop, more light, or a photo taken square-on.");
				return;
			}
			keepAll(found.map((raw) => makeScan(raw.value, raw.format, "image")));
			if (found.length > 1) setPictureError("");
		} catch (error) {
			setPictureError(error instanceof Error ? error.message : "That picture could not be read.");
		} finally {
			setBusy(false);
		}
	};

	const latestUrl = latest ? webUrlOf(latest.value) : null;

	return (
		<ToolPanel>
			<SegmentedControl<Source>
				label="Scan from"
				onChange={switchSource}
				options={[
					{ id: "camera", label: "Camera" },
					{ id: "image", label: "Picture" },
				]}
				value={source}
			/>

			{source === "camera" ? (
				<div className="flex flex-col gap-3">
					<div className="relative aspect-video w-full overflow-hidden border border-line bg-[#1b1e19]">
						<video aria-label="Camera preview" className="h-full w-full object-contain" muted playsInline ref={video} />
						{stream ? (
							<div aria-hidden="true" className="pointer-events-none absolute inset-[12%] border-2 border-[#e7e8dd]/70" />
						) : (
							<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
								<ScanLine aria-hidden="true" className="text-[#e7e8dd]" size={26} />
								<p className="m-0 max-w-xs text-xs leading-relaxed text-[#e7e8dd]">Point the camera at a QR code or a barcode. Nothing is recorded and no frame leaves this device.</p>
							</div>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{stream ? (
							<button className={buttonClassName} onClick={stopCamera} type="button">
								<CameraOff aria-hidden="true" size={13} /> Stop camera
							</button>
						) : (
							<button className={primaryButtonClassName} onClick={() => void startCamera()} type="button">
								<Camera aria-hidden="true" size={13} /> Start camera
							</button>
						)}
						{torchReady ? (
							<button className={buttonClassName} onClick={() => void toggleTorch()} type="button">
								{torchOn ? <FlashlightOff aria-hidden="true" size={13} /> : <Flashlight aria-hidden="true" size={13} />} {torchOn ? "Turn light off" : "Turn light on"}
							</button>
						) : null}
					</div>
					<p className={hintClassName}>
						{stream
							? "Hold the code inside the frame for a moment. Every code found is copied into the history below."
							: "The browser will ask for camera permission the first time. On a phone the rear camera is used, and the light button appears where the camera has one."}
					</p>
					{cameraError ? <ErrorNote message={cameraError} /> : null}
				</div>
			) : (
				<div className="flex flex-col gap-3">
					<FileField
						accept="image/*"
						hint="A photo, a screenshot, or a downloaded code. Decoded here on the device — the picture is never uploaded."
						id="scan-picture"
						label="Picture of a code"
						onFile={(file) => {
							if (file) void scanPicture(file);
						}}
					/>
					{busy ? <p className={hintClassName}>Reading the picture…</p> : null}
					{pictureError ? <ErrorNote message={pictureError} /> : null}
				</div>
			)}

			{latest ? (
				<section aria-live="polite" className="flex flex-col gap-3 border border-line bg-[#fbfaf7] p-3">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 className="m-0 text-sm font-semibold text-ink">Your scan</h2>
						<span className="text-xs text-muted">{latest.label}</span>
					</div>
					<p className="m-0 max-h-40 overflow-y-auto break-all font-mono text-sm leading-relaxed text-ink">{latest.value}</p>
					<StatGrid
						items={[
							{ label: "Format", value: formatName(latest.format) },
							{ label: "Contains", value: latest.label },
							{ label: "Read from", value: latest.source === "camera" ? "Camera" : "Picture" },
							{ label: "When", value: scanWhen(latest.at) },
						]}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<CopyTextButton text={latest.value} />
						{latestUrl ? (
							<a className={smallPrimaryActionClassName} href={latestUrl} rel="noopener noreferrer" target="_blank">
								<ExternalLink aria-hidden="true" size={13} /> Open link
							</a>
						) : null}
						<span className="text-xs text-muted">{latestUrl ? "Copy the value, or open the link in a new tab." : latest.detail}</span>
					</div>
				</section>
			) : null}

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold text-ink">Your history</h2>
					{history.length ? (
						<span className="text-xs text-muted">
							{history.length} scan{history.length === 1 ? "" : "s"} kept on this device
						</span>
					) : null}
				</div>
				{history.length ? (
					<>
						<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
							{history.map((scan) => {
								const url = webUrlOf(scan.value);
								return (
									<li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-line bg-surface px-3 py-2" key={`${scan.at}-${scan.format}-${scan.value}`}>
										<div className="min-w-0 flex-1">
											<p className="m-0 break-all font-mono text-xs text-ink">{shorten(scan.value, 96)}</p>
											<p className="m-0 text-[11px] text-muted">
												{scan.label} · {formatName(scan.format)} · {scanWhen(scan.at)}
											</p>
										</div>
										<CopyTextButton text={scan.value} />
										{url ? (
											<a className={smallActionClassName} href={url} rel="noopener noreferrer" target="_blank">
												Open
											</a>
										) : null}
									</li>
								);
							})}
						</ul>
						<button className={`${buttonClassName} self-start`} onClick={() => setHistory(() => [])} type="button">
							Clear history
						</button>
					</>
				) : (
					<p className="m-0 text-xs text-muted">No scans yet. Start the camera or pick a picture, and every code found is listed here.</p>
				)}
			</section>
		</ToolPanel>
	);
};
