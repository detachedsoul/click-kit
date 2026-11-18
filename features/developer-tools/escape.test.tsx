import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EscapeTool } from "@/features/developer-tools/escape-tool";
import { transformEscapes } from "@/features/developer-tools/escape-utils";

afterEach(cleanup);

describe("escape toolkit", () => {
	it("escapes and unescapes JSON strings", () => {
		const escaped = transformEscapes('say "hi"\nnext', "json", "escape");
		expect(escaped).toBe('say \\"hi\\"\\nnext');
		expect(transformEscapes(escaped, "json", "unescape")).toBe('say "hi"\nnext');
	});

	it("handles JavaScript string escapes", () => {
		const escaped = transformEscapes("It's a\nline\twith\\slash", "javascript", "escape");
		expect(escaped).toBe("It\\'s a\\nline\\twith\\\\slash");
		expect(transformEscapes(escaped, "javascript", "unescape")).toBe("It's a\nline\twith\\slash");
		expect(transformEscapes("\\u00e9 and \\x41", "javascript", "unescape")).toBe("é and A");
	});

	it("doubles SQL quotes", () => {
		expect(transformEscapes("O'Hara", "sql", "escape")).toBe("O''Hara");
		expect(transformEscapes("O''Hara", "sql", "unescape")).toBe("O'Hara");
	});

	it("wraps shell arguments and restores them", () => {
		const escaped = transformEscapes("echo 'quoted'", "shell", "escape");
		expect(escaped).toBe(`'echo '\\''quoted'\\'''`);
		expect(transformEscapes(escaped, "shell", "unescape")).toBe("echo 'quoted'");
		expect(transformEscapes("plain", "shell", "unescape")).toBe("plain");
	});

	it("escapes and unescapes regex metacharacters", () => {
		expect(transformEscapes("a+b?c(d)", "regex", "escape")).toBe("a\\+b\\?c\\(d\\)");
		expect(transformEscapes("a\\+b", "regex", "unescape")).toBe("a+b");
	});

	it("converts non-ASCII text to Unicode escapes, including astral characters", () => {
		expect(transformEscapes("Café", "unicode", "escape")).toBe("Caf\\u00e9");
		expect(transformEscapes("🚀", "unicode", "escape")).toBe("\\ud83d\\ude80");
		expect(transformEscapes("Caf\\u00e9", "unicode", "unescape")).toBe("Café");
	});

	it("rejects empty input and broken escapes", () => {
		expect(() => transformEscapes("", "json", "escape")).toThrow(/Paste text/u);
		expect(() => transformEscapes("bad \\u12", "javascript", "unescape")).toThrow(/Invalid \\uXXXX/u);
		expect(() => transformEscapes("tail\\", "javascript", "unescape")).toThrow(/dangling backslash/u);
		expect(() => transformEscapes('bad "quote', "json", "unescape")).toThrow(/Could not decode JSON/u);
	});

	it("renders escaped output and switches direction", async () => {
		const user = userEvent.setup();
		render(<EscapeTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("\\n");
		fireEvent.change(screen.getByLabelText("Text to escape"), { target: { value: 'say \\"hi\\"\\nnext' } });
		await user.click(screen.getByRole("button", { name: "Unescape" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe('say "hi"\nnext');
		fireEvent.change(screen.getByLabelText("Context"), { target: { value: "unicode" } });
		fireEvent.change(screen.getByLabelText("Escaped text"), { target: { value: "Caf\u00e9" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("Café");
	});
});
