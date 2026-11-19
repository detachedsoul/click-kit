import { blurRadius, pixelBlockSize, type Region } from "@/features/image-tools/redact-utils";

type DrawOptions = {
	/** A 2D context already showing the untouched picture at its natural size. */
	context: CanvasRenderingContext2D;
	image: CanvasImageSource;
	regions: Region[];
	/** Used only for the throwaway canvases a single pass needs. */
	createCanvas?: () => HTMLCanvasElement;
};

const makeCanvas = () => document.createElement("canvas");

/** Paint every marked area onto the context. Shared by the live preview and the export. */
export const drawRedactions = ({ context, image, regions, createCanvas = makeCanvas }: DrawOptions) => {
	for (const region of regions) {
		if (region.mode === "solid") {
			context.fillStyle = "#000000";
			context.fillRect(region.x, region.y, region.width, region.height);
			continue;
		}
		if (region.mode === "pixelate") {
			const block = pixelBlockSize(region);
			const small = createCanvas();
			small.width = Math.max(1, Math.round(region.width / block));
			small.height = Math.max(1, Math.round(region.height / block));
			const smallContext = small.getContext("2d");
			if (!smallContext) throw new Error("Canvas image processing is not available in this browser.");
			smallContext.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, small.width, small.height);
			context.save();
			context.imageSmoothingEnabled = false;
			context.drawImage(small, 0, 0, small.width, small.height, region.x, region.y, region.width, region.height);
			context.restore();
			continue;
		}
		const radius = blurRadius(region);
		context.save();
		context.beginPath();
		context.rect(region.x, region.y, region.width, region.height);
		context.clip();
		context.filter = `blur(${radius}px)`;
		// Draw a slightly larger area so the blur has real pixels to bleed in from the edges.
		const bleed = radius * 2;
		context.drawImage(
			image,
			region.x - bleed,
			region.y - bleed,
			region.width + bleed * 2,
			region.height + bleed * 2,
			region.x - bleed,
			region.y - bleed,
			region.width + bleed * 2,
			region.height + bleed * 2,
		);
		context.filter = "none";
		context.restore();
	}
};
