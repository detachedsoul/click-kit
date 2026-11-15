import userEvent from "@testing-library/user-event";
import CaseConverter from "@/features/text-tools/case-converter";
import TextCleaner from "@/features/text-tools/text-cleaner";
import TextDiffChecker from "@/features/text-tools/text-diff-checker";
import WordCounter from "@/features/text-tools/word-counter";
import ReadAloud from "@/features/text-tools/read-aloud";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type TestUtterance = {
	text: string;
	voice: SpeechSynthesisVoice | null;
	rate: number;
};

const mockSpeechSynthesis = (voices: SpeechSynthesisVoice[] = []) => {
	const utterances: TestUtterance[] = [];
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
			default: true,
			localService: true,
		};
		const { speechSynthesis, utterances } = mockSpeechSynthesis([browserVoice]);
		render(<ReadAloud />);
		fireEvent.change(screen.getByRole("textbox", { name: "Text to read aloud" }), {
			target: { value: "A sentence to hear." },
		});
		await user.selectOptions(screen.getByRole("combobox", { name: "Voice" }), "browser-en");
		fireEvent.change(screen.getByRole("slider", { name: "Speaking speed" }), { target: { value: "1.4" } });

		const readButton = screen.getByRole("button", { name: "Read aloud" });
		expect(readButton.className).toContain("cursor-pointer");
		await user.click(readButton);
		expect(speechSynthesis.speak).toHaveBeenCalledOnce();
		expect(utterances[0].text).toBe("A sentence to hear.");
		expect(utterances[0].voice).toBe(browserVoice);
		expect(utterances[0].rate).toBe(1.4);
		expect(screen.getByText("Reading your text…")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Pause" }));
		expect(speechSynthesis.pause).toHaveBeenCalledOnce();
		await user.click(screen.getByRole("button", { name: "Resume" }));
		expect(speechSynthesis.resume).toHaveBeenCalledOnce();
		await user.click(screen.getByRole("button", { name: "Stop" }));
		expect(speechSynthesis.cancel).toHaveBeenCalled();
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
