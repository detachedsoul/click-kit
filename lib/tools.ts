import {
	Binary,
	Braces,
	Calculator,
	CaseSensitive,
	Clock3,
	Code2,
	FileImage,
	FileText,
	Hash,
	Image,
	ListChecks,
	LockKeyhole,
	Percent,
	Regex,
	ScanQrCode,
	Shuffle,
	Timer,
	Type,
	WandSparkles,
	Workflow,
	Volume2,
	Baby,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CategoryId = "text" | "calculators" | "developer" | "image" | "productivity";
export type ToolStatus = "available" | "planned";

export type Tool = {
	id: string;
	name: string;
	description: string;
	category: CategoryId;
	slug: string;
	keywords: string[];
	icon: LucideIcon;
	status: ToolStatus;
};

export const categories: { id: CategoryId; name: string; description: string; icon: LucideIcon }[] = [
	{ id: "text", name: "Text & writing", description: "Tidy, transform, and understand your words.", icon: Type },
	{ id: "calculators", name: "Calculators", description: "Quick answers for everyday numbers.", icon: Calculator },
	{ id: "developer", name: "Developer tools", description: "Small, sharp helpers for working with code.", icon: Code2 },
	{ id: "image", name: "Image & files", description: "Useful image tools, processed right in your browser.", icon: Image },
	{ id: "productivity", name: "Productivity", description: "Simple tools to help you get into a good rhythm.", icon: ListChecks },
];

export const tools: Tool[] = [
	{ id: "word-counter", name: "Word counter", description: "Count words, characters, and estimate reading time.", category: "text", slug: "word-counter", keywords: ["writing", "words", "characters", "length"], icon: FileText, status: "available" },
	{ id: "case-converter", name: "Case converter", description: "Switch text between common letter cases.", category: "text", slug: "case-converter", keywords: ["uppercase", "lowercase", "title case"], icon: CaseSensitive, status: "available" },
	{ id: "text-cleaner", name: "Text cleaner", description: "Remove extra spaces, line breaks, and stray characters.", category: "text", slug: "text-cleaner", keywords: ["whitespace", "format", "clean"], icon: WandSparkles, status: "available" },
	{ id: "text-diff", name: "Text difference checker", description: "Compare two passages and spot what changed.", category: "text", slug: "text-diff", keywords: ["compare", "diff", "changes"], icon: Workflow, status: "available" },
	{ id: "read-aloud", name: "Read aloud", description: "Listen to pasted text with your device's built-in voices.", category: "text", slug: "read-aloud", keywords: ["text to speech", "listen", "voice", "audio", "speak"], icon: Volume2, status: "available" },
	{ id: "find-replace", name: "Find & Replace", description: "Search text and replace matches, with optional regular expressions.", category: "text", slug: "find-replace", keywords: ["search", "replace", "regex", "substitute"], icon: Regex, status: "available" },
	{ id: "sort-lines", name: "Sort & clean lines", description: "Sort a list and optionally remove duplicate or blank lines.", category: "text", slug: "sort-lines", keywords: ["alphabetize", "deduplicate", "list", "lines"], icon: ListChecks, status: "available" },
	{ id: "slug-generator", name: "Slug generator", description: "Turn a title into a clean, URL-friendly slug.", category: "text", slug: "slug-generator", keywords: ["url", "permalink", "title", "kebab case"], icon: Hash, status: "available" },
	{ id: "markdown-preview", name: "Markdown preview", description: "Write Markdown and preview a safe rendered version side by side.", category: "text", slug: "markdown-preview", keywords: ["md", "preview", "write", "format"], icon: FileText, status: "available" },
	{ id: "readability-checker", name: "Readability checker", description: "Estimate English reading difficulty from sentence and word length.", category: "text", slug: "readability-checker", keywords: ["reading level", "flesch", "grade", "writing"], icon: Type, status: "available" },
	{ id: "text-extractor", name: "Text extractor", description: "Find email addresses, links, phone-like numbers, or hashtags in text.", category: "text", slug: "text-extractor", keywords: ["extract", "email", "url", "phone", "hashtag"], icon: Workflow, status: "available" },
	{ id: "markup-formatter", name: "HTML & XML formatter", description: "Indent HTML snippets and validate and format well-formed XML locally.", category: "text", slug: "markup-formatter", keywords: ["html", "xml", "pretty print", "markup"], icon: Braces, status: "available" },
	{ id: "markdown-table", name: "Markdown table generator", description: "Convert tab- or comma-separated rows into a Markdown table.", category: "text", slug: "markdown-table", keywords: ["table", "csv", "markdown", "rows"], icon: Workflow, status: "available" },
	{ id: "html-entities", name: "HTML entity encoder & decoder", description: "Encode reserved characters or decode common HTML entities.", category: "text", slug: "html-entities", keywords: ["escape", "decode", "symbols", "html"], icon: Code2, status: "available" },
	{ id: "url-encoder", name: "URL component encoder & decoder", description: "Encode or decode text for safe use inside a URL component.", category: "text", slug: "url-encoder", keywords: ["percent encoding", "uri", "decode", "url"], icon: Hash, status: "available" },
	{ id: "unicode-inspector", name: "Unicode inspector", description: "Inspect the Unicode code points that make up your text and symbols.", category: "text", slug: "unicode-inspector", keywords: ["emoji", "code point", "character", "unicode"], icon: Binary, status: "available" },
	{ id: "lorem-generator", name: "Lorem Ipsum generator", description: "Create placeholder paragraphs with a chosen length.", category: "text", slug: "lorem-generator", keywords: ["placeholder", "dummy", "sample", "latin"], icon: WandSparkles, status: "available" },
	{ id: "text-reverser", name: "Text reverser", description: "Reverse characters while keeping combined emoji and accents intact.", category: "text", slug: "text-reverser", keywords: ["backwards", "reverse", "mirror"], icon: Shuffle, status: "available" },
	{ id: "calculator", name: "Standard calculator", description: "Solve everyday sums with parentheses and proper operator precedence.", category: "calculators", slug: "calculator", keywords: ["math", "arithmetic", "addition", "divide", "multiply"], icon: Calculator, status: "available" },
	{ id: "percentage-calculator", name: "Percentage calculator", description: "Find a percentage, compare percentage changes, or add and subtract percentages.", category: "calculators", slug: "percentage-calculator", keywords: ["percent", "discount", "increase", "decrease", "change"], icon: Percent, status: "available" },
	{ id: "age-calculator", name: "Age calculator", description: "Calculate an age on a date or the calendar time between two dates.", category: "calculators", slug: "age-calculator", keywords: ["birthday", "date", "years", "months", "days", "duration"], icon: Baby, status: "available" },
	{ id: "unit-converter", name: "Unit converter", description: "Convert length, mass, temperature, volume, area, and time.", category: "calculators", slug: "unit-converter", keywords: ["length", "weight", "temperature", "volume", "area", "time", "units"], icon: Workflow, status: "available" },
	{ id: "scientific-calculator", name: "Scientific calculator", description: "Calculate with trigonometry, logarithms, powers, statistics, combinatorics, scientific constants, and numerical integrals.", category: "calculators", slug: "scientific-calculator", keywords: ["math", "calculus", "integration", "trigonometry", "hyperbolic", "statistics", "combinations", "permutations", "logarithm", "scientific constants"], icon: Calculator, status: "available" },
	{ id: "loan-calculator", name: "Loan & interest calculator", description: "Estimate monthly loan payments and total interest for a fixed-rate loan.", category: "calculators", slug: "loan-calculator", keywords: ["loan", "interest", "repayment", "monthly payment", "amortization"], icon: Workflow, status: "available" },
	{ id: "tip-split-calculator", name: "Tip & bill splitter", description: "Add a tip to a bill and split the total evenly across a group.", category: "calculators", slug: "tip-split-calculator", keywords: ["tip", "bill", "split", "restaurant", "share"], icon: ListChecks, status: "available" },
	{ id: "bmi-calculator", name: "BMI calculator", description: "Calculate body mass index from height and weight, with adult screening context.", category: "calculators", slug: "bmi-calculator", keywords: ["body mass index", "health", "weight", "height", "metric", "imperial"], icon: Baby, status: "available" },
	{ id: "compound-interest-calculator", name: "Compound interest calculator", description: "Estimate savings growth with monthly compounding and optional monthly contributions.", category: "calculators", slug: "compound-interest-calculator", keywords: ["compound interest", "savings", "investment", "growth", "return"], icon: Workflow, status: "available" },
	{ id: "sales-tax-calculator", name: "Discount & sales tax calculator", description: "Apply a discount, estimate tax on the reduced price, and see the final total.", category: "calculators", slug: "sales-tax-calculator", keywords: ["sales tax", "discount", "final price", "shopping", "tax estimate"], icon: Percent, status: "available" },
	{ id: "geometry-calculator", name: "Geometry calculator", description: "Find area and perimeter or circumference for circles, rectangles, and triangles.", category: "calculators", slug: "geometry-calculator", keywords: ["geometry", "area", "perimeter", "circumference", "triangle", "circle", "rectangle"], icon: Calculator, status: "available" },
	{ id: "fuel-economy-calculator", name: "Fuel economy calculator", description: "Convert common fuel economy units and estimate fuel needed for a trip.", category: "calculators", slug: "fuel-economy-calculator", keywords: ["fuel economy", "fuel consumption", "mpg", "km/l", "litres per 100 kilometres", "trip fuel"], icon: Workflow, status: "available" },
	{ id: "json-formatter", name: "JSON formatter", description: "Validate, format, and minify JSON in your browser.", category: "developer", slug: "json-formatter", keywords: ["beautify", "minify", "validate", "code"], icon: Braces, status: "planned" },
	{ id: "json-typescript", name: "JSON to TypeScript", description: "Turn a JSON example into useful TypeScript types.", category: "developer", slug: "json-typescript", keywords: ["interface", "types", "code"], icon: Code2, status: "planned" },
	{ id: "base64", name: "Base64 encoder & decoder", description: "Encode or decode text, including Unicode characters.", category: "developer", slug: "base64", keywords: ["encode", "decode", "unicode"], icon: Binary, status: "planned" },
	{ id: "uuid-generator", name: "UUID generator", description: "Generate unique identifiers with browser-safe randomness.", category: "developer", slug: "uuid-generator", keywords: ["guid", "identifier", "random"], icon: Hash, status: "planned" },
	{ id: "regex-tester", name: "Regex tester", description: "Try a regular expression and inspect its matches.", category: "developer", slug: "regex-tester", keywords: ["pattern", "regular expression", "matches"], icon: Regex, status: "planned" },
	{ id: "timestamp-converter", name: "Timestamp converter", description: "Translate Unix timestamps to readable dates and back.", category: "developer", slug: "timestamp-converter", keywords: ["unix", "epoch", "date", "time"], icon: Clock3, status: "planned" },
	{ id: "qr-generator", name: "QR code generator", description: "Create a QR code for a link or a short message.", category: "image", slug: "qr-generator", keywords: ["qr", "barcode", "link", "scan"], icon: ScanQrCode, status: "planned" },
	{ id: "image-compressor", name: "Image compressor", description: "Reduce an image's file size before you share it.", category: "image", slug: "image-compressor", keywords: ["compress", "optimize", "photo"], icon: FileImage, status: "planned" },
	{ id: "image-resizer", name: "Image resizer", description: "Resize an image to the dimensions you need.", category: "image", slug: "image-resizer", keywords: ["dimensions", "scale", "photo"], icon: Image, status: "planned" },
	{ id: "password-generator", name: "Password generator", description: "Create a strong, random password on your device.", category: "productivity", slug: "password-generator", keywords: ["secure", "random", "privacy"], icon: LockKeyhole, status: "planned" },
	{ id: "pomodoro-timer", name: "Pomodoro timer", description: "Focus for a while, then take a proper break.", category: "productivity", slug: "pomodoro-timer", keywords: ["focus", "countdown", "work"], icon: Timer, status: "planned" },
	{ id: "random-picker", name: "Random picker", description: "Pick one option fairly from a list of choices.", category: "productivity", slug: "random-picker", keywords: ["choose", "decision", "draw"], icon: Shuffle, status: "planned" },
];

export const getCategory = (id: CategoryId) => categories.find((category) => category.id === id)!;
export const getTool = (slug: string) => tools.find((tool) => tool.slug === slug);
