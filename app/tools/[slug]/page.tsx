import Link from "next/link";
import { AudioTrimmer } from "@/features/audio-tools/audio-trimmer";
import { AudioVisualizer } from "@/features/audio-tools/audio-visualizer";
import { VideoFrameExtractor } from "@/features/video-tools/video-frame-extractor";
import { VideoTrimmer } from "@/features/video-tools/video-trimmer";
import Shell from "@/components/shell";
import ToolCard from "@/components/tool-card";
import WordCounter from "@/features/text-tools/word-counter";
import CaseConverter from "@/features/text-tools/case-converter";
import TextCleaner from "@/features/text-tools/text-cleaner";
import TextDiffChecker from "@/features/text-tools/text-diff-checker";
import ReadAloud from "@/features/text-tools/read-aloud";
import StandardCalculator from "@/features/calculators/standard-calculator";
import PercentageCalculator from "@/features/calculators/percentage-calculator";
import AgeCalculator from "@/features/calculators/age-calculator";
import UnitConverter from "@/features/calculators/unit-converter";
import ScientificCalculator from "@/features/calculators/scientific-calculator";
import LoanCalculator from "@/features/calculators/loan-calculator";
import TipSplitCalculator from "@/features/calculators/tip-split-calculator";
import BmiCalculator from "@/features/calculators/bmi-calculator";
import { Base64Tool, JsonFormatterTool, JsonTypeScriptTool, RegexTesterTool, TimestampConverterTool, UuidGeneratorTool } from "@/features/developer-tools/developer-tool-components";
import { ColorConverterTool, HashGeneratorTool, JsonSchemaTool, JwtDecoderTool, SqlFormatterTool, UrlInspectorTool } from "@/features/developer-tools/additional-developer-tools";
import { ColorContrastTool, CronExplainerTool, EnvValidatorTool, JsonDiffTool, YamlJsonTool } from "@/features/developer-tools/extra-tools-components";
import { CsvJsonTool, FileHashTool, GitignoreGeneratorTool, JsonPathTool, JsonSchemaValidatorTool } from "@/features/developer-tools/data-tools-components";
import { TomlJsonTool } from "@/features/developer-tools/toml-tool";
import { XmlJsonTool } from "@/features/developer-tools/xml-tool";
import { JsonFlattenTool } from "@/features/developer-tools/json-flatten-tool";
import { JsonCodeTool } from "@/features/developer-tools/json-code-tool";
import { QueryJsonTool } from "@/features/developer-tools/query-tool";
import { SemverTool } from "@/features/developer-tools/semver-tool";
import { SubnetTool } from "@/features/developer-tools/subnet-tool";
import { ChmodTool } from "@/features/developer-tools/chmod-tool";
import { IdToolkitTool } from "@/features/developer-tools/id-tool";
import { CurlTool } from "@/features/developer-tools/curl-tool";
import { HttpStatusTool } from "@/features/developer-tools/http-status-tool";
import { NumberBaseTool } from "@/features/developer-tools/number-base-tool";
import { JsonZodTool } from "@/features/developer-tools/zod-tool";
import { JsonPatchTool } from "@/features/developer-tools/json-patch-tool";
import { JsonSqlTool } from "@/features/developer-tools/json-sql-tool";
import { EscapeTool } from "@/features/developer-tools/escape-tool";
import { MimeLookupTool } from "@/features/developer-tools/mime-tool";
import { HeadersTool } from "@/features/developer-tools/headers-tool";
import { JsonlTool } from "@/features/developer-tools/jsonl-tool";
import { XPathTool } from "@/features/developer-tools/xpath-tool";
import { HmacTool } from "@/features/developer-tools/hmac-tool";
import { DockerTool } from "@/features/developer-tools/docker-tool";
import { DelimitedTool } from "@/features/developer-tools/delimited-tool";
import { IndentTool } from "@/features/developer-tools/indent-tool";
import { JsxTool } from "@/features/developer-tools/jsx-tool";
import { GradientTool } from "@/features/developer-tools/gradient-tool";
import { EnvConvertTool } from "@/features/developer-tools/env-convert-tool";
import { SvgTool } from "@/features/developer-tools/svg-tool";
import { SqlJsonTool } from "@/features/developer-tools/sql-json-tool";
import { ModelTool } from "@/features/developer-tools/model-tool";
import { ClampTool } from "@/features/developer-tools/clamp-tool";
import { ComposeTool } from "@/features/developer-tools/compose-tool";
import { ObjectIdTool } from "@/features/developer-tools/objectid-tool";
import { DdlTool } from "@/features/developer-tools/ddl-tool";
import { FixtureTool } from "@/features/developer-tools/fixture-tool";
import { FrequencyTool } from "@/features/text-tools/frequency-tool";
import { WrapTool } from "@/features/text-tools/wrap-tool";
import { CipherTool } from "@/features/text-tools/cipher-tool";
import { ImageCompressorTool, ImageResizerTool, PasswordGeneratorTool, PomodoroTimerTool, QrGeneratorTool, RandomPickerTool } from "@/features/productivity-tools/productivity-components";
import { BarcodeScanner } from "@/features/image-tools/barcode-scanner";
import { CropTool } from "@/features/image-tools/crop-tool";
import { PdfMergeTool } from "@/features/pdf-tools/merge-tool";
import { PdfSplitTool } from "@/features/pdf-tools/split-tool";
import { PdfOrganiseTool } from "@/features/pdf-tools/organise-tool";
import { PdfToImagesTool } from "@/features/pdf-tools/pdf-to-images-tool";
import { ImagesToPdfTool } from "@/features/pdf-tools/images-to-pdf-tool";
import { PdfCompressTool } from "@/features/pdf-tools/compress-tool";
import { PdfWatermarkTool } from "@/features/pdf-tools/watermark-tool";
import { PdfPageNumbersTool } from "@/features/pdf-tools/page-numbers-tool";
import { PdfMetadataTool } from "@/features/pdf-tools/metadata-tool";
import { PdfUnlockTool } from "@/features/pdf-tools/unlock-tool";
import { PdfTextTool } from "@/features/pdf-tools/text-tool";
import { PdfResizeTool } from "@/features/pdf-tools/resize-tool";
import { PdfCropTool } from "@/features/pdf-tools/crop-tool";
import { PdfNupTool } from "@/features/pdf-tools/nup-tool";
import { PdfRotateTool } from "@/features/pdf-tools/rotate-tool";
import { PdfEditorTool } from "@/features/pdf-tools/edit-tool";
import { PdfFlattenTool } from "@/features/pdf-tools/flatten-tool";
import { PdfSplitHalvesTool } from "@/features/pdf-tools/split-halves-tool";
import { PdfMarginTool } from "@/features/pdf-tools/margin-tool";
import { PdfBookletTool } from "@/features/pdf-tools/booklet-tool";
import { PdfCompareTool } from "@/features/pdf-tools/compare-tool";
import { PdfLongPageTool } from "@/features/pdf-tools/long-page-tool";
import { PdfOverlayTool } from "@/features/pdf-tools/overlay-tool";
import { MarkdownToHtmlTool } from "@/features/converter-tools/markdown-html-tool";
import { RtfTool } from "@/features/converter-tools/rtf-tool";
import { HtmlToMarkdownTool } from "@/features/converter-tools/html-markdown-tool";
import { SubtitleConverterTool } from "@/features/converter-tools/subtitle-tool";
import { ContactsConverterTool } from "@/features/converter-tools/contacts-tool";
import { CalendarConverterTool } from "@/features/converter-tools/calendar-tool";
import { DocxTool } from "@/features/converter-tools/docx-tool";
import { DocxPdfTool } from "@/features/converter-tools/docx-pdf-tool";
import { PdfDocxTool } from "@/features/converter-tools/pdf-docx-tool";
import { EpubTool } from "@/features/converter-tools/epub-tool";
import { PptxTool } from "@/features/converter-tools/pptx-tool";
import { SpreadsheetTool } from "@/features/converter-tools/xlsx-tool";
import { HtmlTableTool } from "@/features/converter-tools/html-tables-tool";
import { MarkdownTableTool } from "@/features/converter-tools/markdown-table-tool";
import { FaviconTool } from "@/features/image-tools/favicon-tool";
import { SvgPngTool } from "@/features/image-tools/svg-png-tool";
import { PaletteTool } from "@/features/image-tools/palette-tool";
import { MetadataTool } from "@/features/image-tools/metadata-tool";
import { FileTypeTool } from "@/features/image-tools/file-type-tool";
import { RotateTool } from "@/features/image-tools/rotate-tool";
import { WatermarkTool } from "@/features/image-tools/watermark-tool";
import { FiltersTool } from "@/features/image-tools/filters-tool";
import { StripTool } from "@/features/image-tools/strip-tool";
import { PlaceholderTool } from "@/features/image-tools/placeholder-tool";
import { ShadesTool } from "@/features/developer-tools/shades-tool";
import { UserAgentTool } from "@/features/developer-tools/user-agent-tool";
import { ChunkTool } from "@/features/text-tools/chunk-tool";
import { PostLengthTool } from "@/features/text-tools/post-length-tool";
import { ShadowTool } from "@/features/developer-tools/shadow-tool";
import SalaryCalculator from "@/features/calculators/salary-calculator";
import RecipeTool from "@/features/calculators/recipe-tool";
import { TeamTool } from "@/features/productivity-tools/team-tool";
import DecisionMatrixTool from "@/features/productivity-tools/decision-matrix";
import { TaskList } from "@/features/productivity-tools/task-list";
import { MeetingCostMeter } from "@/features/productivity-tools/meeting-cost";
import { SubscriptionTracker } from "@/features/productivity-tools/subscription-tracker";
import { ReadingList } from "@/features/productivity-tools/reading-list";
import { HabitTracker } from "@/features/productivity-tools/habit-tracker";
import { TypingTester } from "@/features/productivity-tools/typing-tool";
import { PackingList } from "@/features/productivity-tools/packing-list";
import { WorldClock } from "@/features/productivity-tools/world-clock";
import { MealPlanner } from "@/features/productivity-tools/meal-planner";
import { MeetingPlanner } from "@/features/productivity-tools/meeting-planner";
import { PaceCalculator } from "@/features/calculators/pace-calculator";
import { ZipTool } from "@/features/image-tools/zip-tool";
import { FramerTool } from "@/features/image-tools/framer-tool";
import { RedactTool } from "@/features/image-tools/redact-tool";
import { SplitTool } from "@/features/image-tools/split-tool";
import { EyedropperTool } from "@/features/image-tools/eyedropper-tool";
import { BatchTool } from "@/features/image-tools/batch-tool";
import { SheetTool } from "@/features/image-tools/sheet-tool";
import { CompareTool } from "@/features/image-tools/compare-tool";
import { FileSplitTool } from "@/features/image-tools/file-split-tool";
import CompoundInterestCalculator from "@/features/calculators/compound-interest-calculator";
import DateDiffCalculator from "@/features/calculators/date-diff-calculator";
import AspectCalculator from "@/features/calculators/aspect-calculator";
import DensityTool from "@/features/text-tools/density-tool";
import InvisibleTool from "@/features/text-tools/invisible-tool";
import MermaidTool from "@/features/developer-tools/mermaid-tool";
import NumeralsCalculator from "@/features/calculators/numerals-calculator";
import DurationCalculator from "@/features/calculators/duration-calculator";
import UnitPriceCalculator from "@/features/calculators/unit-price-calculator";
import GpaCalculator from "@/features/calculators/gpa-calculator";
import SalesTaxCalculator from "@/features/calculators/sales-tax-calculator";
import GeometryCalculator from "@/features/calculators/geometry-calculator";
import FuelEconomyCalculator from "@/features/calculators/fuel-economy-calculator";
import { FindReplaceTool, HtmlEntityTool, LineSorterTool, LoremGeneratorTool, SlugGeneratorTool, TextReverserTool, UnicodeInspectorTool, UrlEncoderTool } from "@/features/text-tools/text-transform-tools";
import { MarkdownPreviewTool, MarkdownTableGeneratorTool, ReadabilityCheckerTool } from "@/features/text-tools/text-writing-tools";
import { MarkupFormatterTool, TextExtractorTool } from "@/features/text-tools/text-developer-tools";
import type { Metadata } from "next";
import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NewBadge } from "@/components/new-badge";
import { addedOnLabel, toolAddedOn } from "@/lib/tool-recency";
import { categories, getTool, tools } from "@/lib/tools";
import { categoryUrl, siteUrl, toolUrl } from "@/lib/site";

const availableToolComponents: Record<string, ComponentType> = {
	"word-counter": WordCounter,
	"case-converter": CaseConverter,
	"text-cleaner": TextCleaner,
	"text-diff": TextDiffChecker,
	"read-aloud": ReadAloud,
	"find-replace": FindReplaceTool,
	"sort-lines": LineSorterTool,
	"slug-generator": SlugGeneratorTool,
	"markdown-preview": MarkdownPreviewTool,
	"readability-checker": ReadabilityCheckerTool,
	"text-extractor": TextExtractorTool,
	"markup-formatter": MarkupFormatterTool,
	"markdown-table": MarkdownTableGeneratorTool,
	"html-entities": HtmlEntityTool,
	"url-encoder": UrlEncoderTool,
	"unicode-inspector": UnicodeInspectorTool,
	"lorem-generator": LoremGeneratorTool,
	"text-reverser": TextReverserTool,
	"calculator": StandardCalculator,
	"percentage-calculator": PercentageCalculator,
	"age-calculator": AgeCalculator,
	"unit-converter": UnitConverter,
	"scientific-calculator": ScientificCalculator,
	"loan-calculator": LoanCalculator,
	"tip-split-calculator": TipSplitCalculator,
	"bmi-calculator": BmiCalculator,
	"json-formatter": JsonFormatterTool,
	"json-typescript": JsonTypeScriptTool,
	"base64": Base64Tool,
	"uuid-generator": UuidGeneratorTool,
	"regex-tester": RegexTesterTool,
	"timestamp-converter": TimestampConverterTool,
	"url-inspector": UrlInspectorTool,
	"hash-generator": HashGeneratorTool,
	"sql-formatter": SqlFormatterTool,
	"color-converter": ColorConverterTool,
	"jwt-decoder": JwtDecoderTool,
	"json-schema": JsonSchemaTool,
	"json-diff": JsonDiffTool,
	"yaml-json": YamlJsonTool,
	"cron-explainer": CronExplainerTool,
	"env-validator": EnvValidatorTool,
	"color-contrast": ColorContrastTool,
	"csv-json": CsvJsonTool,
	"jsonpath-tester": JsonPathTool,
	"json-schema-validator": JsonSchemaValidatorTool,
	"file-checksum": FileHashTool,
	"gitignore-generator": GitignoreGeneratorTool,
	"toml-json": TomlJsonTool,
	"xml-json": XmlJsonTool,
	"json-flatten": JsonFlattenTool,
	"json-code": JsonCodeTool,
	"query-json": QueryJsonTool,
	"semver-check": SemverTool,
	"subnet-calculator": SubnetTool,
	"chmod-calculator": ChmodTool,
	"id-toolkit": IdToolkitTool,
	"curl-converter": CurlTool,
	"http-status": HttpStatusTool,
	"number-base": NumberBaseTool,
	"json-zod": JsonZodTool,
	"json-patch": JsonPatchTool,
	"json-sql": JsonSqlTool,
	"string-escape": EscapeTool,
	"mime-lookup": MimeLookupTool,
	"http-header-parser": HeadersTool,
	"jsonl-formatter": JsonlTool,
	"xpath-tester": XPathTool,
	"hmac-totp": HmacTool,
	"docker-compose": DockerTool,
	"delimiter-converter": DelimitedTool,
	"indent-converter": IndentTool,
	"html-to-jsx": JsxTool,
	"css-gradient": GradientTool,
	"dotenv-converter": EnvConvertTool,
	"svg-optimizer": SvgTool,
	"sql-to-json": SqlJsonTool,
	"json-model-generator": ModelTool,
	"fluid-clamp": ClampTool,
	"compose-to-run": ComposeTool,
	"mongodb-objectid": ObjectIdTool,
	"sql-ddl": DdlTool,
	"json-fixtures": FixtureTool,
	"word-frequency": FrequencyTool,
	"text-wrapper": WrapTool,
	"text-cipher": CipherTool,
	"barcode-scanner": BarcodeScanner,
	"qr-generator": QrGeneratorTool,
	"audio-trimmer": AudioTrimmer,
	"audio-visualizer": AudioVisualizer,
	"video-frame-extractor": VideoFrameExtractor,
	"video-trimmer": VideoTrimmer,
	"image-compressor": ImageCompressorTool,
	"image-resizer": ImageResizerTool,
	"image-cropper": CropTool,
	"favicon-generator": FaviconTool,
	"svg-to-png": SvgPngTool,
	"image-palette": PaletteTool,
	"image-metadata": MetadataTool,
	"file-type-identifier": FileTypeTool,
	"image-rotate": RotateTool,
	"image-watermark": WatermarkTool,
	"image-filters": FiltersTool,
	"image-metadata-remover": StripTool,
	"placeholder-image": PlaceholderTool,
	"zip-creator": ZipTool,
	"image-framer": FramerTool,
	"image-redactor": RedactTool,
	"image-splitter": SplitTool,
	"image-colour-picker": EyedropperTool,
	"image-batch-converter": BatchTool,
	"image-contact-sheet": SheetTool,
	"image-compare": CompareTool,
	"file-splitter": FileSplitTool,
	"colour-shades": ShadesTool,
	"user-agent-parser": UserAgentTool,
	"text-chunker": ChunkTool,
	"post-length": PostLengthTool,
	"css-shadow": ShadowTool,
	"salary-converter": SalaryCalculator,
	"recipe-scaler": RecipeTool,
	"team-splitter": TeamTool,
	"meeting-planner": MeetingPlanner,
	"typing-speed": TypingTester,
	"packing-list": PackingList,
	"world-clock": WorldClock,
	"pace-calculator": PaceCalculator,
	"password-generator": PasswordGeneratorTool,
	"pomodoro-timer": PomodoroTimerTool,
	"random-picker": RandomPickerTool,
	"pdf-merge": PdfMergeTool,
	"pdf-split": PdfSplitTool,
	"pdf-organise": PdfOrganiseTool,
	"pdf-to-images": PdfToImagesTool,
	"images-to-pdf": ImagesToPdfTool,
	"pdf-compress": PdfCompressTool,
	"pdf-watermark": PdfWatermarkTool,
	"pdf-page-numbers": PdfPageNumbersTool,
	"pdf-metadata": PdfMetadataTool,
	"pdf-unlock": PdfUnlockTool,
	"pdf-text": PdfTextTool,
	"pdf-resize": PdfResizeTool,
	"pdf-crop": PdfCropTool,
	"pdf-nup": PdfNupTool,
	"pdf-rotate": PdfRotateTool,
	"pdf-editor": PdfEditorTool,
	"pdf-flatten": PdfFlattenTool,
	"pdf-split-halves": PdfSplitHalvesTool,
	"pdf-margins": PdfMarginTool,
	"pdf-booklet": PdfBookletTool,
	"pdf-compare": PdfCompareTool,
	"pdf-long-page": PdfLongPageTool,
	"pdf-overlay": PdfOverlayTool,
	"html-to-markdown": HtmlToMarkdownTool,
	"markdown-to-html": MarkdownToHtmlTool,
	"rtf-to-text": RtfTool,
	"subtitle-converter": SubtitleConverterTool,
	"contacts-converter": ContactsConverterTool,
	"calendar-converter": CalendarConverterTool,
	"docx-to-pdf": DocxPdfTool,
	"pdf-to-word": PdfDocxTool,
	"docx-to-markdown": DocxTool,
	"epub-to-markdown": EpubTool,
	"pptx-to-markdown": PptxTool,
	"csv-excel": SpreadsheetTool,
	"html-tables": HtmlTableTool,
	"markdown-html-table": MarkdownTableTool,
	"meal-planner": MealPlanner,
	"habit-tracker": HabitTracker,
	"task-list": TaskList,
	"meeting-cost": MeetingCostMeter,
	"subscription-tracker": SubscriptionTracker,
	"reading-list": ReadingList,
	"decision-matrix": DecisionMatrixTool,
	"compound-interest-calculator": CompoundInterestCalculator,
	"sales-tax-calculator": SalesTaxCalculator,
	"geometry-calculator": GeometryCalculator,
	"fuel-economy-calculator": FuelEconomyCalculator,
	"date-difference": DateDiffCalculator,
	"json-mermaid": MermaidTool,
	"aspect-ratio": AspectCalculator,
	"invisible-characters": InvisibleTool,
	"keyword-density": DensityTool,
	"roman-numerals": NumeralsCalculator,
	"time-duration": DurationCalculator,
	"unit-price": UnitPriceCalculator,
	"gpa-calculator": GpaCalculator,
};

export const generateStaticParams = () => tools.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
	const { slug } = await params;
	const tool = getTool(slug);
	if (!tool) return { title: "Tool not found" };
	const category = categories.find((item) => item.id === tool.category);
	return {
		title: tool.name,
		description: tool.description,
		keywords: [...tool.keywords, category?.name ?? "", "browser tool", "free"],
		alternates: { canonical: `/tools/${tool.slug}` },
		openGraph: { type: "website", title: `${tool.name} · ClickKit`, description: tool.description, url: toolUrl(tool.slug) },
		twitter: { card: "summary_large_image", title: `${tool.name} · ClickKit`, description: tool.description },
	};
};

const ToolPage = async ({ params }: { params: Promise<{ slug: string }> }) => {
	const { slug } = await params;
	const tool = getTool(slug);
	if (!tool) notFound();
	const category = categories.find((item) => item.id === tool.category)!;
	const Icon = tool.icon;
	const AvailableTool = availableToolComponents[tool.slug];
	const related = tools.filter((item) => item.category === tool.category && item.id !== tool.id).slice(0, 4);
	const categoryCount = tools.filter((item) => item.category === tool.category).length;

	const toolJsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebApplication",
				name: tool.name,
				description: tool.description,
				url: toolUrl(tool.slug),
				applicationCategory: "UtilitiesApplication",
				operatingSystem: "Any",
				browserRequirements: "Requires JavaScript",
				isAccessibleForFree: true,
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				isPartOf: { "@id": `${siteUrl}/#website` },
			},
			{
				"@type": "BreadcrumbList",
				itemListElement: [
					{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
					{ "@type": "ListItem", position: 2, name: category.name, item: categoryUrl(category.id) },
					{ "@type": "ListItem", position: 3, name: tool.name, item: toolUrl(tool.slug) },
				],
			},
		],
	};

	return <Shell data-print-page={tool.slug === "packing-list" ? "packing-list" : undefined}>
		<script dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd) }} type="application/ld+json" />
		<header className="py-[45px] pb-[30px] max-[620px]:py-6 max-[620px]:pb-5">
			<nav className="flex flex-wrap items-center gap-x-[9px] gap-y-1 text-[11px] text-[#5f6259]" aria-label="Breadcrumb"><Link className="hover:text-accent-dark" href="/">Home</Link><span aria-hidden="true">/</span><Link className="hover:text-accent-dark" href={`/category/${category.id}`}>{category.name}</Link><span aria-hidden="true">/</span><span>{tool.name}</span></nav>
			<div className="mt-[26px] flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark max-[620px]:mt-4">
				<span>{tool.status === "available" ? "Available now" : category.name}</span>
				<NewBadge slug={tool.slug} variant="banner" />
				{toolAddedOn(tool.slug) ? <span className="normal-case tracking-normal text-[#5f6259]">Added {addedOnLabel(toolAddedOn(tool.slug) as string)}</span> : null}
			</div>
			<h1 className="mb-2 mt-1.5 font-serif text-[clamp(50px,6vw,72px)] font-normal leading-[.98] tracking-[-.035em] max-[620px]:mt-1 max-[620px]:text-[clamp(34px,9.5vw,46px)]">{tool.name}</h1>
			<p className="m-0 max-w-[570px] text-sm leading-[1.65] text-[#60635b]">{tool.description}</p>
		</header>
		{tool.status === "available" && AvailableTool
			? <section className="mb-[90px] mt-1 border border-line border-t-[3px] border-t-forest bg-surface shadow-[0_18px_50px_#29291f0b] max-[620px]:mb-[66px]" aria-label={`${tool.name} tool`} data-print={tool.slug === "packing-list" ? "packing-list" : undefined}><AvailableTool /></section>
			: <section className="mx-auto mb-[110px] mt-[42px] max-w-[680px] border border-line bg-surface p-[45px_35px] text-center shadow-[0_16px_40px_#322c2009] max-[620px]:mb-[67px] max-[620px]:mt-8 max-[620px]:p-[35px_21px]" aria-labelledby="planned-title">
				<Icon className="text-accent" size={27} strokeWidth={1.6} aria-hidden="true" />
				<h2 id="planned-title" className="mb-2.5 mt-[18px] font-serif text-[32px] font-normal leading-[1.05] tracking-[-.02em]">A useful tool is taking shape.</h2>
				<p className="mx-auto mb-[22px] max-w-[400px] text-[13px] leading-[1.65] text-muted">This tool is on the ClickKit roadmap. It will be marked available here only when it can do the job properly.</p>
				<Link className="inline-flex items-center gap-2 bg-forest px-[14px] py-[11px] text-xs text-white hover:bg-[#354d44]" href={`/category/${category.id}`}><ArrowLeft size={14} /> Explore {category.name}</Link>
			</section>}
		{related.length > 0 && (
			<section className="border-t border-line py-8 pb-[70px] max-[620px]:py-6 max-[620px]:pb-[55px]" aria-labelledby="related-title">
				<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
					<div>
						<h2 className="m-0 font-serif text-[26px] font-normal leading-[1.05] tracking-[-.02em]" id="related-title">More {category.name.toLowerCase()}</h2>
						<p className="mb-0 mt-1.5 text-xs text-muted">If this one was not quite it, these are close by.</p>
					</div>
					<Link className="inline-flex items-center gap-1.5 text-xs text-[#50534c] hover:text-accent-dark" href={`/category/${category.id}`}>
						All {categoryCount} tools <ArrowLeft className="rotate-180" size={13} aria-hidden="true" />
					</Link>
				</div>
				<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{related.map((item) => <ToolCard key={item.id} tool={item} />)}</div>
			</section>
		)}
	</Shell>;
};

export default ToolPage;
