import Link from "next/link";
import Shell from "@/components/shell";
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
import { ImageCompressorTool, ImageResizerTool, PasswordGeneratorTool, PomodoroTimerTool, QrGeneratorTool, RandomPickerTool } from "@/features/productivity-tools/productivity-components";
import CompoundInterestCalculator from "@/features/calculators/compound-interest-calculator";
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
import { categories, getTool, tools } from "@/lib/tools";

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
	"qr-generator": QrGeneratorTool,
	"image-compressor": ImageCompressorTool,
	"image-resizer": ImageResizerTool,
	"password-generator": PasswordGeneratorTool,
	"pomodoro-timer": PomodoroTimerTool,
	"random-picker": RandomPickerTool,
	"compound-interest-calculator": CompoundInterestCalculator,
	"sales-tax-calculator": SalesTaxCalculator,
	"geometry-calculator": GeometryCalculator,
	"fuel-economy-calculator": FuelEconomyCalculator,
};

export const generateStaticParams = () => tools.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
	const { slug } = await params;
	const tool = getTool(slug);
	return tool ? { title: tool.name, description: tool.description } : {};
};

const ToolPage = async ({ params }: { params: Promise<{ slug: string }> }) => {
	const { slug } = await params;
	const tool = getTool(slug);
	if (!tool) notFound();
	const category = categories.find((item) => item.id === tool.category)!;
	const Icon = tool.icon;
	const AvailableTool = availableToolComponents[tool.slug];

	return <Shell>
		<header className="py-[45px] pb-[30px] max-[620px]:py-[33px] max-[620px]:pb-6">
			<nav className="flex items-center gap-[9px] text-[11px] text-[#777a70]" aria-label="Breadcrumb"><Link className="hover:text-accent-dark" href="/">Home</Link><span aria-hidden="true">/</span><Link className="hover:text-accent-dark" href={`/category/${category.id}`}>{category.name}</Link><span aria-hidden="true">/</span><span>{tool.name}</span></nav>
			<div className="mt-[26px] font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark max-[620px]:mt-[21px]">{tool.status === "available" ? "Available now" : category.name}</div>
			<h1 className="mb-2 mt-1.5 font-serif text-[clamp(50px,6vw,72px)] font-normal leading-[.98] tracking-[-.035em] max-[620px]:mt-[5px] max-[620px]:text-[clamp(48px,12vw,62px)]">{tool.name}</h1>
			<p className="m-0 max-w-[570px] text-sm leading-[1.65] text-[#60635b]">{tool.description}</p>
		</header>
		{tool.status === "available" && AvailableTool
			? <section className="mb-[90px] mt-1 border border-line border-t-[3px] border-t-forest bg-surface shadow-[0_18px_50px_#29291f0b] max-[620px]:mb-[66px]" aria-label={`${tool.name} tool`}><AvailableTool /></section>
			: <section className="mx-auto mb-[110px] mt-[42px] max-w-[680px] border border-line bg-surface p-[45px_35px] text-center shadow-[0_16px_40px_#322c2009] max-[620px]:mb-[67px] max-[620px]:mt-8 max-[620px]:p-[35px_21px]" aria-labelledby="planned-title">
				<Icon className="text-accent" size={27} strokeWidth={1.6} aria-hidden="true" />
				<h2 id="planned-title" className="mb-2.5 mt-[18px] font-serif text-[32px] font-normal leading-[1.05] tracking-[-.02em]">A useful tool is taking shape.</h2>
				<p className="mx-auto mb-[22px] max-w-[400px] text-[13px] leading-[1.65] text-muted">This tool is on the ClickKit roadmap. It will be marked available here only when it can do the job properly.</p>
				<Link className="inline-flex items-center gap-2 bg-forest px-[14px] py-[11px] text-xs text-white hover:bg-[#354d44]" href={`/category/${category.id}`}><ArrowLeft size={14} /> Explore {category.name}</Link>
			</section>}
	</Shell>;
};

export default ToolPage;
