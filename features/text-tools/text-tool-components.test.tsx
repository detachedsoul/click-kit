import userEvent from "@testing-library/user-event";
import CaseConverter from "@/features/text-tools/case-converter";
import TextCleaner from "@/features/text-tools/text-cleaner";
import TextDiffChecker from "@/features/text-tools/text-diff-checker";
import WordCounter from "@/features/text-tools/word-counter";
import ReadAloud from "@/features/text-tools/read-aloud";
import { FindReplaceTool, HtmlEntityTool, LineSorterTool, LoremGeneratorTool, SlugGeneratorTool, TextReverserTool, UnicodeInspectorTool, UrlEncoderTool } from "@/features/text-tools/text-transform-tools";
import { MarkdownPreviewTool, MarkdownTableGeneratorTool, ReadabilityCheckerTool } from "@/features/text-tools/text-writing-tools";
import { MarkupFormatterTool, TextExtractorTool } from "@/features/text-tools/text-developer-tools";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSpeechSynthesis = (voices: SpeechSynthesisVoice[] = []) => {
	const utterances: SpeechSynthesisUtterance[] = [];
	const speechSynthesis = {
		getVoices: vi.fn(() => voices),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		cancel: vi.fn(),
		speak: vi.fn((utterance: SpeechSynthesisUtterance) => utterances.push(utterance)),
		pause: vi.fn(),
		resume: vi.fn(),
	};
	class MockUtterance {
		voice: SpeechSynthesisVoice | null = null;
		rate = 1;

		constructor(public text: string) {}
	}

	vi.stubGlobal("speechSynthesis", speechSynthesis);
	vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
	return { speechSynthesis, utterances };
};

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("WordCounter", () => {
	it("updates word, character, and reading-time metrics while typing", async () => {
		const user = userEvent.setup();
		render(<WordCounter />);
		const editor = screen.getByRole("textbox", { name: "Your text" });
		await user.type(editor, "Two little words");

		const statistics = screen.getByRole("region", { name: "Live text statistics" });
		expect(statistics.textContent).toContain("3");
		expect(statistics.textContent).toContain("Under 1 min");
		expect(statistics.textContent).toContain("Characters · no spaces");
	});

	it("starts with zero counts and no reading-time estimate", () => {
		render(<WordCounter />);
		const statistics = screen.getByRole("region", { name: "Live text statistics" });
		expect(statistics.textContent).toContain("Words0");
		expect(statistics.textContent).toContain("Reading time—");
	});
});

describe("CaseConverter", () => {
	it("changes the output when the input or selected case changes", async () => {
		const user = userEvent.setup();
		render(<CaseConverter />);
		await user.type(screen.getByRole("textbox", { name: "Text to convert" }), "hello WORLD");
		const result = screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement;
		expect(result.value).toBe("Hello world");

		await user.click(screen.getByRole("button", { name: "Title case" }));
		expect(result.value).toBe("Hello World");
		const selectedButton = screen.getByRole("button", { name: "Title case" });
		expect(selectedButton.getAttribute("aria-pressed")).toBe("true");
		expect(selectedButton.className).toContain("bg-ink");
		expect(selectedButton.className).toContain("text-white");
		expect(selectedButton.className).not.toContain("bg-surface");
	});

	it("copies the converted result and announces success", async () => {
		const user = userEvent.setup();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		render(<CaseConverter />);
		await user.type(screen.getByRole("textbox", { name: "Text to convert" }), "copy me");
		await user.click(screen.getByRole("button", { name: "Copy" }));

		expect(writeText).toHaveBeenCalledWith("Copy me");
		expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
	});
});

describe("TextCleaner", () => {
	it("previews cleaning live and applies the blank-line option", async () => {
		const user = userEvent.setup();
		render(<TextCleaner />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text to clean" }), {
			target: { value: "  first   line  \n\n second\tline " },
		});
		const result = screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement;
		expect(result.value).toBe("first line\n\nsecond line");

		await user.click(screen.getByRole("checkbox", { name: /Remove blank lines/ }));
		expect(result.value).toBe("first line\nsecond line");
	});

	it("can preserve spaces when cleanup options are unchecked", async () => {
		const user = userEvent.setup();
		render(<TextCleaner />);
		await user.click(screen.getByRole("checkbox", { name: /Trim line edges/ }));
		await user.click(screen.getByRole("checkbox", { name: /Collapse repeated spaces/ }));
		fireEvent.change(screen.getByRole("textbox", { name: "Text to clean" }), {
			target: { value: "  keep   this  " },
		});
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("  keep   this  ");
	});
});

describe("ReadAloud", () => {
	it("speaks pasted text locally and supports pause, resume, and stop", async () => {
		const user = userEvent.setup();
		const browserVoice: SpeechSynthesisVoice = {
			name: "Browser English",
			voiceURI: "browser-en",
			lang: "en",
			default: false,
			localService: true,
		};
		const availableVoices = [browserVoice];
		const { speechSynthesis, utterances } = mockSpeechSynthesis(availableVoices);
		render(<ReadAloud />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text to read aloud" }), {
			target: { value: "A sentence to hear. Another one to hear." },
		});

		const voiceSelect = screen.getByRole("combobox", { name: "Voice" }) as HTMLSelectElement;
		expect(voiceSelect.disabled).toBe(false);
		const readButton = screen.getByRole("button", { name: "Read aloud" });
		expect(readButton.className).toContain("cursor-pointer");
		await user.click(readButton);
		expect(speechSynthesis.speak).toHaveBeenCalledOnce();
		expect(utterances[0].text).toBe("A sentence to hear. ");
		expect(utterances[0].rate).toBe(1);
		expect(screen.getByText("Reading your text…")).toBeTruthy();

		await user.selectOptions(voiceSelect, "browser-en");
		expect(speechSynthesis.speak).toHaveBeenCalledOnce();
		fireEvent.change(screen.getByRole("slider", { name: "Speaking speed" }), { target: { value: "1.4" } });
		expect(speechSynthesis.speak).toHaveBeenCalledOnce();
		expect(screen.getByText(/next speech segment/)).toBeTruthy();
		utterances[0].onend?.(new Event("end") as SpeechSynthesisEvent);
		expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
		expect(utterances[1].rate).toBe(1.4);
		expect(utterances[1].voice).toBe(browserVoice);

		await user.click(screen.getByRole("button", { name: "Pause" }));
		expect(speechSynthesis.pause).toHaveBeenCalledOnce();
		await user.click(screen.getByRole("button", { name: "Resume" }));
		expect(speechSynthesis.resume).toHaveBeenCalledOnce();
		await user.click(screen.getByRole("button", { name: "Stop" }));
		expect(speechSynthesis.cancel).toHaveBeenCalled();

		availableVoices.splice(0, 1);
		await user.click(screen.getByRole("button", { name: "Refresh" }));
		expect(screen.getByRole("alert").textContent).toContain("selected voice/language is unavailable");
		await user.click(screen.getByRole("button", { name: "Read aloud" }));
		expect(speechSynthesis.speak).toHaveBeenCalledTimes(2);
		expect(screen.getByText(/no longer available/)).toBeTruthy();

		await user.selectOptions(voiceSelect, "");
		await user.click(screen.getByRole("button", { name: "Read aloud" }));
		expect(speechSynthesis.speak).toHaveBeenCalledTimes(3);
		expect(utterances[2].voice).toBeNull();
	});

	it("shows refresh results and a useful error when a listed voice fails", async () => {
		const user = userEvent.setup();
		const browserVoice: SpeechSynthesisVoice = {
			name: "Sample English",
			voiceURI: "sample-en",
			lang: "en",
			default: true,
			localService: true,
		};
		const { speechSynthesis, utterances } = mockSpeechSynthesis([browserVoice]);
		render(<ReadAloud />);

		await user.click(screen.getByRole("button", { name: "Refresh" }));
		expect(screen.getByText(/Voice list refreshed: 1 voice found/)).toBeTruthy();
		await user.selectOptions(screen.getByRole("combobox", { name: "Voice" }), "sample-en");
		await user.click(screen.getByRole("button", { name: "Test voice" }));
		expect(utterances[0].text).toContain("short sample");
		expect(utterances[0].voice).toBe(browserVoice);

		const voiceUnavailable = Object.assign(new Event("error"), { error: "voice-unavailable" }) as SpeechSynthesisErrorEvent;
		await act(() => utterances[0].onerror?.(voiceUnavailable));
		expect(screen.getByText(/Could not play Sample English \(en\)/)).toBeTruthy();
		expect(speechSynthesis.speak).toHaveBeenCalledOnce();
	});
});

describe("TextDiffChecker", () => {
	it("compares changes and highlights removed and added text", async () => {
		const user = userEvent.setup();
		const { container } = render(<TextDiffChecker />);
		fireEvent.change(screen.getByRole("textbox", { name: "Original text" }), { target: { value: "I like cats." } });
		fireEvent.change(screen.getByRole("textbox", { name: "Revised text" }), { target: { value: "I really like dogs." } });
		await user.click(screen.getByRole("button", { name: /Compare passages/ }));

		expect(container.querySelector("del")?.textContent).toContain("cats.");
		const addedText = Array.from(container.querySelectorAll("ins"), (addition) => addition.textContent).join("");
		expect(addedText).toContain("really");
		expect(addedText).toContain("dogs.");
		expect(screen.getByRole("status").textContent).toContain("2 additions");
	});

	it("reports identical empty passages as a valid comparison", async () => {
		const user = userEvent.setup();
		render(<TextDiffChecker />);
		await user.click(screen.getByRole("button", { name: /Compare passages/ }));
		expect(screen.getByRole("status").textContent).toContain("The passages are identical");
	});

	it("compares passages longer than the previous character limit", async () => {
		const user = userEvent.setup();
		const { container } = render(<TextDiffChecker />);
		const longPassage = "x".repeat(20_001);
		fireEvent.change(screen.getByRole("textbox", { name: "Original text" }), { target: { value: longPassage } });
		await user.click(screen.getByRole("button", { name: /Compare passages/ }));

		expect(screen.queryByRole("alert")).toBeNull();
		expect(container.querySelector("del")?.textContent).toBe(longPassage);
	});
});

describe("additional text tools", () => {
	it("highlights matches in the editable text and replaces them", () => {
		const { container } = render(<FindReplaceTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text" }), { target: { value: "red red" } });
		fireEvent.change(screen.getByLabelText("Find"), { target: { value: "red" } });
		expect(Array.from(container.querySelectorAll("mark"), (match) => match.textContent)).toEqual(["red", "red"]);
		fireEvent.change(screen.getByLabelText("Replace with"), { target: { value: "blue" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("blue blue");
		expect(screen.getByText("2 matches found. Replacement preview is below.").textContent).toBe("2 matches found. Replacement preview is below.");
	});

	it("sorts lines and removes duplicates", () => {
		render(<LineSorterTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Lines to sort" }), { target: { value: "pear\napple\npear" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "Remove duplicate lines" }));
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("apple\npear");
	});

	it("creates a URL slug", () => {
		render(<SlugGeneratorTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Title or phrase" }), { target: { value: "A Better ClickKit!" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("a-better-clickkit");
	});

	it("previews markdown safely", () => {
		const { container } = render(<MarkdownPreviewTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Markdown" }), { target: { value: "# Hello\n\n<script>not executed</script>" } });
		expect(container.querySelector("h1")?.textContent).toBe("Hello");
		expect(container.querySelector("script")).toBeNull();
		expect(container.textContent).toContain("<script>not executed</script>");
	});

	it("shows a readability estimate as text is entered", () => {
		render(<ReadabilityCheckerTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text to analyze" }), { target: { value: "The cat sat. The dog ran." } });
		expect(screen.getByText("2", { selector: "p" })).toBeTruthy();
		expect(screen.getByRole("status").textContent).not.toContain("Add a few complete sentences");
	});

	it("extracts links from source text", () => {
		render(<TextExtractorTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Source text" }), { target: { value: "Visit https://clickkit.test/path." } });
		fireEvent.change(screen.getByLabelText("Extract"), { target: { value: "urls" } });
		expect(screen.getByText("https://clickkit.test/path").textContent).toBe("https://clickkit.test/path");
	});

	it("formats HTML snippets and reports malformed XML", async () => {
		const user = userEvent.setup();
		const { container } = render(<MarkupFormatterTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "HTML input" }), { target: { value: "<main><h1>Hello</h1></main>" } });
		await user.click(screen.getByRole("button", { name: "Format" }));
		expect(container.querySelector("pre")?.textContent).toBe("<main>\n  <h1>Hello</h1>\n</main>");
		fireEvent.change(screen.getByLabelText("Format"), { target: { value: "xml" } });
		fireEvent.change(screen.getByRole("textbox", { name: "XML input" }), { target: { value: "<note>" } });
		await user.click(screen.getByRole("button", { name: "Format" }));
		expect(screen.getByRole("alert").textContent).toContain("well-formed");
	});

	it("converts tab-separated rows into a markdown table", () => {
		const { container } = render(<MarkdownTableGeneratorTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Rows to convert" }), { target: { value: "Name\tAge\nAri\t31" } });
		expect(container.querySelector("pre")?.textContent).toBe("| Name | Age |\n| --- | --- |\n| Ari | 31 |");
	});

	it("encodes and decodes HTML entities", () => {
		render(<HtmlEntityTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text or entities" }), { target: { value: "<tag>" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("&lt;tag&gt;");
		fireEvent.click(screen.getByRole("button", { name: "Decode entities" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Text or entities" }), { target: { value: "&lt;tag&gt;" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("<tag>");
	});

	it("encodes URL components", () => {
		render(<UrlEncoderTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text or URL component" }), { target: { value: "a & b" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("a%20%26%20b");
	});

	it("lists Unicode code points for input characters", () => {
		render(<UnicodeInspectorTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text to inspect" }), { target: { value: "A😀" } });
		expect(screen.getByText("U+0041")).toBeTruthy();
		expect(screen.getByText("U+1F600")).toBeTruthy();
	});

	it("generates lorem ipsum with adjustable length", () => {
		render(<LoremGeneratorTool />);
		fireEvent.change(screen.getByRole("spinbutton", { name: "Paragraphs" }), { target: { value: "1" } });
		fireEvent.change(screen.getByRole("spinbutton", { name: "Words per paragraph" }), { target: { value: "5" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value.split(/\s+/u)).toHaveLength(5);
	});

	it("reverses text without splitting grapheme clusters", () => {
		render(<TextReverserTool />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text to reverse" }), { target: { value: "ab😀" } });
		expect((screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement).value).toBe("😀ba");
	});
});
