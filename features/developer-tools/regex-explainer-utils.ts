export type RegexNodeKind = "sequence" | "alternation" | "group" | "literal" | "escape" | "character-class" | "dot" | "anchor" | "quantifier";

export type RegexNode = {
	id: number;
	kind: RegexNodeKind;
	raw: string;
	label: string;
	explanation: string;
	children: RegexNode[];
	groupNumber?: number;
};

export type RegexToken = {
	id: number;
	raw: string;
	kind: RegexNodeKind;
	explanation: string;
	groupNumber?: number;
};

export type RegexParseResult = {
	tree: RegexNode;
	tokens: RegexToken[];
	groups: Array<{ number: number; label: string; raw: string }>;
};

const escapeDescription = (value: string): string => {
	const descriptions: Record<string, string> = {
		d: "a digit (0–9)", D: "a non-digit character", w: "a word character (letter, digit, or underscore)", W: "a non-word character",
		s: "a whitespace character", S: "a non-whitespace character", b: "a word boundary", B: "a position that is not a word boundary",
		n: "a line feed", r: "a carriage return", t: "a tab", f: "a form feed", v: "a vertical tab", "0": "a NUL character",
	};
	if (Object.hasOwn(descriptions, value)) return `Matches ${descriptions[value]}.`;
	if (/^[1-9]$/u.test(value)) return `A backreference to capture group ${value}.`;
	if (value === "p" || value === "P") return "Begins a Unicode property escape; add braces with a property name and use the Unicode flag.";
	if (value === "u" || value === "x" || value === "c") return "Begins an encoded character escape; check that the required code or character follows it.";
	return `Matches the escaped character “${value}”.`;
};

class RegexParser {
	private cursor = 0;
	private nextId = 0;
	private groupNumber = 0;
	private readonly groups: RegexParseResult["groups"] = [];
	private readonly tokens: RegexToken[] = [];

	constructor(private readonly source: string) {}

	parse(): RegexParseResult {
		const tree = this.parseAlternation();
		if (this.cursor < this.source.length) this.fail(`Unexpected “${this.source[this.cursor]}”.`);
		return { tree, tokens: this.tokens, groups: this.groups };
	}

	private id() { return this.nextId++; }
	private fail(message: string): never { throw new Error(`${message} (at character ${this.cursor + 1})`); }

	private addToken(raw: string, kind: RegexNodeKind, explanation: string, groupNumber?: number) {
		this.tokens.push({ id: this.id(), raw, kind, explanation, groupNumber });
	}

	private node(kind: RegexNodeKind, raw: string, label: string, explanation: string, children: RegexNode[] = [], groupNumber?: number): RegexNode {
		return { id: this.id(), kind, raw, label, explanation, children, groupNumber };
	}

	private parseAlternation(): RegexNode {
		const branches = [this.parseSequence()];
		while (this.source[this.cursor] === "|") {
			this.addToken("|", "alternation", "Matches either the expression before it or the expression after it.");
			this.cursor++;
			branches.push(this.parseSequence());
		}
		if (branches.length === 1) return branches[0];
		return this.node("alternation", branches.map((branch) => branch.raw).join(" | "), "Alternation", "Try each branch from left to right.", branches);
	}

	private parseSequence(): RegexNode {
		const children: RegexNode[] = [];
		while (this.cursor < this.source.length && this.source[this.cursor] !== ")" && this.source[this.cursor] !== "|") {
			const before = this.cursor;
			let atom = this.parseAtom();
			if (this.cursor === before) this.fail("Could not read this part of the expression.");
			const quantifier = this.readQuantifier();
			if (quantifier) {
				const raw = atom.raw + quantifier.raw;
				atom = this.node("quantifier", raw, "Repetition", `${atom.label} ${quantifier.explanation}${quantifier.mode === "lazy" ? " It is lazy, so it tries fewer repetitions first." : ""}`, [atom]);
			}
			children.push(atom);
		}
		if (!children.length) return this.node("sequence", "", "Empty expression", "This branch matches an empty string.");
		if (children.length === 1) return children[0];
		return this.node("sequence", children.map((child) => child.raw).join(""), "Sequence", "Match each child in order, from left to right.", children);
	}

	private parseAtom(): RegexNode {
		const start = this.cursor;
		const character = this.source[this.cursor];
		if (character === "*" || character === "+" || character === "?") this.fail("A quantifier needs an expression before it.");
		if (character === "{") this.fail("A repetition count needs an expression before it.");
		if (character === "^") {
			this.cursor++;
			this.addToken(character, "anchor", "Matches the start of the input, or the start of a line with the multiline flag.");
			return this.node("anchor", character, "Start anchor", "Matches a position, not a character.");
		}
		if (character === "$") {
			this.cursor++;
			this.addToken(character, "anchor", "Matches the end of the input, or the end of a line with the multiline flag.");
			return this.node("anchor", character, "End anchor", "Matches a position, not a character.");
		}
		if (character === ".") {
			this.cursor++;
			this.addToken(character, "dot", "Matches any character except a line terminator, unless the dotAll flag is enabled.");
			return this.node("dot", character, "Any character", "A dot wildcard.");
		}
		if (character === "\\") {
			this.cursor += 1;
			if (this.cursor >= this.source.length) this.fail("The expression ends with an unfinished escape.");
			this.cursor++;
			const raw = this.source.slice(start, this.cursor);
			const description = escapeDescription(this.source[this.cursor - 1]);
			this.addToken(raw, "escape", description);
			return this.node("escape", raw, `Escape ${raw}`, description);
		}
		if (character === "[") return this.parseCharacterClass();
		if (character === "(") return this.parseGroup();
		if (character === ")") this.fail("There is a closing parenthesis without a matching opening parenthesis.");
		this.cursor++;
		const raw = character;
		const printable = character === "\n" ? "line feed" : character === "\r" ? "carriage return" : character === "\t" ? "tab" : `“${character}”`;
		this.addToken(raw, "literal", `Matches the literal ${printable}.`);
		return this.node("literal", raw, `Literal ${printable}`, `Matches exactly ${printable}.`);
	}

	private parseCharacterClass(): RegexNode {
		const start = this.cursor++;
		let first = true;
		let closed = false;
		while (this.cursor < this.source.length) {
			const current = this.source[this.cursor];
			if (current === "\\") {
				this.cursor += this.cursor + 1 < this.source.length ? 2 : 1;
				first = false;
				continue;
			}
			if (current === "]" && !first) { this.cursor++; closed = true; break; }
			first = false;
			this.cursor++;
		}
		if (!closed) this.fail("This character class is missing its closing bracket.");
		const raw = this.source.slice(start, this.cursor);
		const negate = raw[1] === "^";
		const description = `${negate ? "Matches one character not in" : "Matches one character in"} this character class. Ranges such as a-z are supported by the browser regex engine.`;
		this.addToken(raw, "character-class", description);
		return this.node("character-class", raw, negate ? "Negated character class" : "Character class", description);
	}

	private parseGroup(): RegexNode {
		const start = this.cursor;
		this.cursor++;
		let groupKind = "capturing";
		let groupLabel = "Capture group";
		let captureNumber: number | undefined;
		if (this.source[this.cursor] === "?") {
			if (this.source.startsWith("?:", this.cursor)) { groupKind = "non-capturing"; groupLabel = "Non-capturing group"; this.cursor += 2; }
			else if (this.source.startsWith("?=", this.cursor)) { groupKind = "lookahead"; groupLabel = "Positive lookahead"; this.cursor += 2; }
			else if (this.source.startsWith("?!", this.cursor)) { groupKind = "negative-lookahead"; groupLabel = "Negative lookahead"; this.cursor += 2; }
			else if (this.source.startsWith("?<=", this.cursor)) { groupKind = "lookbehind"; groupLabel = "Positive lookbehind"; this.cursor += 3; }
			else if (this.source.startsWith("?<!", this.cursor)) { groupKind = "negative-lookbehind"; groupLabel = "Negative lookbehind"; this.cursor += 3; }
			else if (this.source.startsWith("?<", this.cursor)) {
				const endName = this.source.indexOf(">", this.cursor + 2);
				if (endName < 0) this.fail("A named group is missing its closing >.");
				groupKind = "named";
				groupLabel = `Named capture group “${this.source.slice(this.cursor + 2, endName)}”`;
				this.cursor = endName + 1;
			} else this.fail("This group modifier is not recognized by the explainer.");
		}
		if (groupKind === "capturing" || groupKind === "named") {
			captureNumber = ++this.groupNumber;
			this.groups.push({ number: captureNumber, label: groupLabel, raw: this.source.slice(start, this.cursor) });
		}
		const prefix = this.source.slice(start, this.cursor);
		const explanation = groupKind === "capturing" || groupKind === "named"
			? `${groupLabel} #${captureNumber}: matches its contents and saves the text for later use.`
			: `${groupLabel}: checks the contents at this position without consuming those characters.`;
		const inheritedGroup = captureNumber;
		this.addToken(prefix, "group", explanation, inheritedGroup);
		const contentTokenStart = this.tokens.length;
		const content = this.parseAlternation();
		if (captureNumber) {
			for (const token of this.tokens.slice(contentTokenStart)) token.groupNumber ??= captureNumber;
		}
		if (this.source[this.cursor] !== ")") this.fail("This group is missing its closing parenthesis.");
		this.cursor++;
		this.addToken(")", "group", `Closes ${groupLabel.toLowerCase()}.`, inheritedGroup);
		const raw = this.source.slice(start, this.cursor);
		return this.node("group", raw, groupLabel, explanation, [content], captureNumber);
	}

	private readQuantifier(): { raw: string; explanation: string; mode: "greedy" | "lazy" } | null {
		const start = this.cursor;
		const character = this.source[this.cursor];
		let explanation = "";
		if (character === "*") { this.cursor++; explanation = "zero or more times"; }
		else if (character === "+") { this.cursor++; explanation = "one or more times"; }
		else if (character === "?") { this.cursor++; explanation = "zero or one time (optional)"; }
		else if (character === "{") {
			const match = /^\{(\d+)(?:,(\d*))?\}/u.exec(this.source.slice(this.cursor));
			if (!match) return null;
			this.cursor += match[0].length;
			const min = match[1];
			const max = match[2];
			explanation = match[2] === undefined ? `exactly ${min} times` : max === "" ? `${min} or more times` : `${min} to ${max} times`;
		} else return null;
		let mode: "greedy" | "lazy" = "greedy";
		if (this.source[this.cursor] === "?") { mode = "lazy"; this.cursor++; }
		const raw = this.source.slice(start, this.cursor);
		this.addToken(raw, "quantifier", `Repeats the preceding expression ${explanation}${mode === "lazy" ? "; lazy matching tries the smallest number first" : "; greedy matching tries the largest number first"}.`);
		return { raw, explanation, mode };
	}
}

export const parseRegex = (source: string): RegexParseResult => {
	if (source.length > 500) throw new Error("Keep the expression under 500 characters for this visual explainer.");
	return new RegexParser(source).parse();
};

export const findCommonRegexIssues = (pattern: string): string[] => {
	const issues: string[] = [];
	if (!pattern) issues.push("Enter a pattern to see its tokens and expression tree.");
	if (/\.\*/u.test(pattern)) issues.push("A greedy .* may consume more text than expected. Consider a more specific character class or a lazy .*? when appropriate.");
	let escaped = false;
	let insideClass = false;
	let hasWildcardDot = false;
	for (const character of pattern) {
		if (escaped) { escaped = false; continue; }
		if (character === "\\") { escaped = true; continue; }
		if (character === "[" && !insideClass) { insideClass = true; continue; }
		if (character === "]" && insideClass) { insideClass = false; continue; }
		if (character === "." && !insideClass) hasWildcardDot = true;
	}
	if (hasWildcardDot) issues.push("A dot is a wildcard, not a literal period. Escape it as \\. when you mean a full stop.");
	if (/\((?!(?:\?:|\?=|\?!|\?<=|\?<!))/u.test(pattern)) issues.push("Parentheses capture text by default. Use (?:...) for grouping only, to avoid extra capture groups.");
	if (/(?:\*|\+|\?|\{\d+(?:,\d*)?\}){2}/u.test(pattern)) issues.push("Adjacent quantifiers can be invalid or confusing. Check that each repetition applies to the intended token or group.");
	if (/\$\^|\^\$/u.test(pattern)) issues.push("The anchors appear adjacent, so this only matches an empty string (or an empty line).");
	if (/\\b/u.test(pattern)) issues.push("JavaScript’s \\b uses the engine’s word-character definition; many non-English letters are not treated as word characters.");
	if (pattern.length > 120) issues.push("Long expressions are harder to maintain. Consider breaking the pattern into named pieces or adding comments outside the expression.");
	return [...new Set(issues)];
};

export const explainRegexFlags = (flags: string[]) => flags.map((flag) => ({
	g: "Find every match, rather than stopping after the first.",
	i: "Ignore differences between uppercase and lowercase letters.",
	m: "Make ^ and $ match the start and end of each line.",
	s: "Let the dot wildcard match line terminators too.",
	u: "Enable Unicode-aware matching and Unicode property escapes.",
	y: "Match only at the current search position (sticky mode).",
}[flag] ?? `The ${flag} flag affects how the browser matches this expression.`));
