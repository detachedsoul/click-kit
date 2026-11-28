import { describe, expect, it } from "vitest";
import {
	formatTimecode,
	mergeEditableCues,
	parseSubtitleDocument,
	parseTimecode,
	replaceCueText,
	serializeSubtitleDocument,
	shiftEditableCues,
	splitEditableCue,
	validateEditableCues,
} from "@/features/converter-tools/subtitle-editor-utils";

const SRT = `1\n00:00:01,000 --> 00:00:04,000\nWelcome to the show.\n\n2\n00:00:05,250 --> 00:00:07,500\nThanks for watching.\n`;
const VTT = `WEBVTT\n\nintro\n00:01.500 --> 00:03.000 align:start position:10%\nHello there\n`;

describe("subtitle editor utilities", () => {
	it("imports SRT cues and exports sequential numbering", () => {
		const document = parseSubtitleDocument(SRT);
		expect(document.format).toBe("srt");
		expect(document.cues).toHaveLength(2);
		expect(document.cues[1]).toMatchObject({ start: 5.25, end: 7.5, text: "Thanks for watching." });
		expect(serializeSubtitleDocument(document.cues, "srt")).toBe(SRT);
	});

	it("imports VTT cue ids, settings, and minute-second timecodes", () => {
		const document = parseSubtitleDocument(VTT);
		expect(document.format).toBe("vtt");
		expect(document.cues[0]).toMatchObject({ start: 1.5, end: 3, vttId: "intro", settings: "align:start position:10%" });
		expect(serializeSubtitleDocument(document.cues, "vtt")).toBe("WEBVTT\n\nintro\n00:00:01.500 --> 00:00:03.000 align:start position:10%\nHello there\n");
	});

	it("ignores notes and malformed or zero-length entries", () => {
		const parsed = parseSubtitleDocument(`WEBVTT\n\nNOTE do not parse\n00:00:01.000 --> 00:00:02.000\nA note\n\n00:00:03.000 --> 00:00:03.000\nNo duration\n`);
		expect(parsed.cues).toEqual([]);
	});

	it("parses strict timecodes and rounds boundaries without spilling milliseconds", () => {
		expect(parseTimecode("00:00:59,999")).toBe(59.999);
		expect(parseTimecode("00:60:00.000")).toBeNull();
		expect(parseTimecode("00:00:60.000")).toBeNull();
		expect(parseTimecode(`${"9".repeat(400)}:00:00.000`)).toBeNull();
		expect(formatTimecode(59.9999, "vtt")).toBe("00:01:00.000");
	});

	it("shifts all cues, clamps at zero, and preserves duration", () => {
		const cues = parseSubtitleDocument(SRT).cues;
		const shifted = shiftEditableCues(cues, -10);
		expect(shifted[0]).toMatchObject({ start: 0, end: 3 });
		expect(shiftEditableCues(cues, 1.5)[0]).toMatchObject({ start: 2.5, end: 5.5 });
	});

	it("splits at a word boundary in the middle of the cue and merges back", () => {
		const cue = parseSubtitleDocument(SRT).cues[0];
		const parts = splitEditableCue(cue, "cue-new");
		expect(parts).not.toBeNull();
		if (!parts) return;
		expect(parts[0].end).toBe(parts[1].start);
		expect(`${parts[0].text} ${parts[1].text}`).toBe(cue.text);
		expect(mergeEditableCues(parts[0], parts[1])).toMatchObject({ start: cue.start, end: cue.end, text: "Welcome to\nthe show." });
	});

	it("replaces every literal match and validates timing and text before export", () => {
		const cues = parseSubtitleDocument(SRT).cues;
		const result = replaceCueText(cues, "the", "a");
		expect(result.replacements).toBe(1);
		expect(result.cues[0].text).toBe("Welcome to a show.");
		expect(validateEditableCues(result.cues)).toBeNull();
		expect(validateEditableCues([{ ...cues[0], end: cues[0].start, text: "" }])).not.toBeNull();
	});
});
