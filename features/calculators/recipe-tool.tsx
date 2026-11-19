"use client";

import { useState } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { factorLabel, scaleFactor, scaledText, scaleIngredients } from "@/features/calculators/recipe-utils";

const SAMPLE = "2 cups flour\n1 1/2 tsp baking powder\n1/2 tsp salt\n3 eggs\n1 1/4 cups milk\n2 tbsp butter, melted\nSalt to taste";

export default function RecipeTool() {
	const [text, setText] = useState(SAMPLE);
	const [original, setOriginal] = useState("4");
	const [target, setTarget] = useState("6");

	const factor = (() => {
		try {
			return { value: scaleFactor(Number(original), Number(target)), error: "" };
		} catch (error) {
			return { value: null, error: error instanceof Error ? error.message : "Check the serving figures." };
		}
	})();

	const items = (() => {
		if (!factor.value) return [];
		try {
			return scaleIngredients(text, factor.value);
		} catch {
			return [];
		}
	})();
	const result = items.length ? scaledText(items) : "";
	const changed = items.filter((item) => item.scaled !== null).length;

	return (
		<ToolPanel>
			<TextAreaField
				hint="One ingredient per line, as you would write it on a card. Fractions like 1/2 or ½ both work, and notes such as “salt to taste” are left alone."
				id="recipe-input"
				label="Ingredients"
				onChange={setText}
				placeholder={"2 cups flour\n1/2 tsp salt\n3 eggs"}
				rows={8}
				value={text}
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="recipe-original">
					Recipe serves
					<input
						className={fieldClassName}
						id="recipe-original"
						max={200}
						min={1}
						onChange={(event) => setOriginal(event.target.value)}
						type="number"
						value={original}
					/>
				</label>
				<label className={labelClassName} htmlFor="recipe-target">
					You want to serve
					<input
						className={fieldClassName}
						id="recipe-target"
						max={4000}
						min={1}
						onChange={(event) => setTarget(event.target.value)}
						type="number"
						value={target}
					/>
				</label>
			</div>
			<ErrorNote message={factor.error} />
			{factor.value ? (
				<>
					<StatGrid
						items={[
							{ label: "Scale", value: factorLabel(factor.value) },
							{ label: "Ingredients", value: String(items.length) },
							{ label: "Amounts changed", value: String(changed) },
							{ label: "Left as written", value: String(items.length - changed) },
						]}
					/>
					<ul className="m-0 flex list-none flex-col gap-1 border border-line bg-[#fbfaf7] p-3 text-[13px]">
						{items.map((item, index) => (
							<li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line/70 pb-1 last:border-b-0 last:pb-0" key={`${item.line}-${index}`}>
								<span className="text-[#5f6259]">{item.line.trim()}</span>
								<span className="font-medium text-ink">{item.scaled === null ? "unchanged" : item.scaledText}</span>
							</li>
						))}
					</ul>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Scaled ingredients</h2>
						<CopyTextButton text={result} />
					</div>
					<ResultBlock fileName="scaled-recipe.txt" rows={10} title="For your servings" value={result} />
				</>
			) : null}
			<p className={hintClassName}>
				Amounts are rounded to the fractions a measuring spoon can actually hit — quarters, thirds, and eighths — so “1 1/2 eggs” means beat one and
				half of a second. Cooking times, pan sizes, and oven temperatures do not scale, so keep an eye on the dish near the end.
			</p>
		</ToolPanel>
	);
}
