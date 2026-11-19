/**
 * Getting a picked image into something pdf-lib can embed. PNG and JPEG go in as they are —
 * no re-encoding, so nothing is lost — while anything else (WebP, GIF, AVIF, SVG) is drawn
 * once onto a canvas and handed over as PNG.
 */

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export type EmbeddableImage = { bytes: Uint8Array; type: "image/png" | "image/jpeg" };

const loadDrawable = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("That image could not be opened."));
		image.src = url;
	});

export const toEmbeddable = async (file: File): Promise<EmbeddableImage> => {
	if (file.type === "image/jpeg") return { bytes: new Uint8Array(await file.arrayBuffer()), type: "image/jpeg" };
	if (file.type === "image/png") return { bytes: new Uint8Array(await file.arrayBuffer()), type: "image/png" };
	const url = URL.createObjectURL(file);
	try {
		const image = await loadDrawable(url);
		const canvas = document.createElement("canvas");
		canvas.width = image.naturalWidth || image.width || 1;
		canvas.height = image.naturalHeight || image.height || 1;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("This browser cannot prepare that image.");
		context.drawImage(image, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
		if (!blob) throw new Error("That image could not be prepared.");
		return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "image/png" };
	} finally {
		URL.revokeObjectURL(url);
	}
};
