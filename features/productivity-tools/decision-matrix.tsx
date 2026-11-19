"use client";

import { useRef, useState } from "react";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	isTie,
	MAX_SCORE,
	rankOptions,
	summaryText,
	validateMatrix,
	verdict,
	type Criterion,
	type MatrixOption,
	type Scores,
} from "@/features/productivity-tools/decision-utils";

const START_CRITERIA: Criterion[] = [
	{ id: "c1", name: "Price", weight: 3 },
	{ id: "c2", name: "Quality", weight: 2 },
	{ id: "c3", name: "Delivery", weight: 1 },
];

const START_OPTIONS: MatrixOption[] = [
	{ id: "o1", name: "Option A" },
	{ id: "o2", name: "Option B" },
];

const SCORE_LABELS = ["–", "1 · poor", "2 · weak", "3 · fair", "4 · good", "5 · best"];

export default function DecisionMatrix() {
	const [criteria, setCriteria] = useState<Criterion[]>(START_CRITERIA);
	const [options, setOptions] = useState<MatrixOption[]>(START_OPTIONS);
	const [scores, setScores] = useState<Scores>({});
	const counter = useRef(4);

	const ranked = rankOptions(criteria, options, scores);
	const problem = validateMatrix(criteria, options);
	const summary = summaryText(ranked);
	const top = Math.max(1, ...ranked.map((entry) => entry.score));

	const addCriterion = () => {
		const id = `c${counter.current++}`;
		setCriteria((current) => [...current, { id, name: `Criterion ${current.length + 1}`, weight: 1 }]);
	};

	const addOption = () => {
		const id = `o${counter.current++}`;
		setOptions((current) => [...current, { id, name: `Option ${String.fromCharCode(65 + current.length)}` }]);
	};

	const removeCriterion = (id: string) => {
		setCriteria((current) => current.filter((criterion) => criterion.id !== id));
		setScores((current) =>
			Object.fromEntries(
				Object.entries(current).map(([optionId, row]) => [optionId, Object.fromEntries(Object.entries(row).filter(([criterionId]) => criterionId !== id))]),
			),
		);
	};

	const removeOption = (id: string) => {
		setOptions((current) => current.filter((option) => option.id !== id));
		setScores((current) => Object.fromEntries(Object.entries(current).filter(([optionId]) => optionId !== id)));
	};

	const setScore = (optionId: string, criterionId: string, value: number) =>
		setScores((current) => ({ ...current, [optionId]: { ...current[optionId], [criterionId]: value } }));

	const resetScores = () => setScores({});

	return (
		<ToolPanel>
			<p className={hintClassName}>
				List the options, decide what matters, and give each option a 1–5 mark per criterion. Weights say how much each criterion counts, so a weight of 3
				criterion moves the result three times as much as a weight of 1.
			</p>

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold">Criteria and weights</h2>
					<button className={`${buttonClassName} border-line bg-surface text-ink hover:border-[#5f6259]`} onClick={addCriterion} type="button">
						Add criterion
					</button>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					{criteria.map((criterion, index) => (
						<div className="flex items-end gap-2" key={criterion.id}>
							<label className={`${labelClassName} flex-1`} htmlFor={`${criterion.id}-name`}>
								Criterion {index + 1}
								<input
									className={fieldClassName}
									id={`${criterion.id}-name`}
									onChange={(event) => setCriteria((current) => current.map((item) => (item.id === criterion.id ? { ...item, name: event.target.value } : item)))}
									value={criterion.name}
								/>
							</label>
							<label className={labelClassName} htmlFor={`${criterion.id}-weight`}>
								Weight
								<select
									className={`${selectClassName} w-24`}
									id={`${criterion.id}-weight`}
									onChange={(event) =>
										setCriteria((current) => current.map((item) => (item.id === criterion.id ? { ...item, weight: Number(event.target.value) } : item)))
									}
									value={criterion.weight}
								>
									{[1, 2, 3, 4, 5].map((weight) => (
										<option key={weight} value={weight}>
											{weight}
										</option>
									))}
								</select>
							</label>
							<button
								aria-label={`Remove ${criterion.name || `criterion ${index + 1}`}`}
								className={`${buttonClassName} mb-[1px] border-line bg-surface text-[#5f6259] hover:border-[#8a8779] hover:text-ink`}
								onClick={() => removeCriterion(criterion.id)}
								type="button"
							>
								Remove
							</button>
						</div>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold">Options</h2>
					<button className={`${buttonClassName} border-line bg-surface text-ink hover:border-[#5f6259]`} onClick={addOption} type="button">
						Add option
					</button>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					{options.map((option, index) => (
						<div className="flex items-end gap-2" key={option.id}>
							<label className={`${labelClassName} flex-1`} htmlFor={`${option.id}-name`}>
								Option {String.fromCharCode(65 + index)}
								<input
									className={fieldClassName}
									id={`${option.id}-name`}
									onChange={(event) => setOptions((current) => current.map((item) => (item.id === option.id ? { ...item, name: event.target.value } : item)))}
									value={option.name}
								/>
							</label>
							<button
								aria-label={`Remove ${option.name || `option ${index + 1}`}`}
								className={`${buttonClassName} mb-[1px] border-line bg-surface text-[#5f6259] hover:border-[#8a8779] hover:text-ink`}
								onClick={() => removeOption(option.id)}
								type="button"
							>
								Remove
							</button>
						</div>
					))}
				</div>
			</section>

			<ErrorNote message={problem} />

			{options.length && criteria.length ? (
				<div className="overflow-x-auto">
					<table className="w-full min-w-[420px] border-collapse text-left text-xs">
						<thead>
							<tr>
								<th className="border-b border-line pb-2 pr-3 font-semibold" scope="col">
									Criterion
								</th>
								{options.map((option) => (
									<th className="border-b border-line p-2 font-semibold" key={option.id} scope="col">
										{option.name || "Untitled"}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{criteria.map((criterion) => (
								<tr key={criterion.id}>
									<th className="border-b border-line/70 py-2 pr-3 font-medium" scope="row">
										{criterion.name || "Untitled"}
										<span className="block text-[11px] font-normal text-muted">weight {criterion.weight}</span>
									</th>
									{options.map((option) => (
										<td className="border-b border-line/70 p-1.5" key={option.id}>
											<select
												aria-label={`${option.name || "Untitled"} score for ${criterion.name || "untitled criterion"}`}
												className={`${selectClassName} w-full`}
												onChange={(event) => setScore(option.id, criterion.id, Number(event.target.value))}
												value={scores[option.id]?.[criterion.id] ?? 0}
											>
												{Array.from({ length: MAX_SCORE + 1 }, (_, value) => (
													<option key={value} value={value}>
														{SCORE_LABELS[value]}
													</option>
												))}
											</select>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold">Ranking</h2>
					<button className={`${buttonClassName} border-line bg-surface text-ink hover:border-[#5f6259]`} onClick={resetScores} type="button">
						Clear scores
					</button>
				</div>
				<p className="m-0 text-[13px] text-ink" role="status">
					{verdict(ranked)}
				</p>
				{isTie(ranked) ? <p className={hintClassName}>Both options earn the same points, so either is a defensible pick.</p> : null}
				<ul className="m-0 flex list-none flex-col gap-2">
					{ranked.map((entry, index) => (
						<li className="flex flex-col gap-1" key={entry.option.id}>
							<div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
								<span className="font-medium text-ink">
									{index + 1}. {entry.option.name || "Untitled"}
								</span>
								<span className="text-muted">
									{entry.score}% · {entry.points} of {entry.possible} points
								</span>
							</div>
							<div aria-hidden="true" className="h-2 w-full border border-line bg-[#fbfaf7]">
								<div className="h-full bg-forest" style={{ width: `${Math.round((entry.score / top) * 100)}%` }} />
							</div>
						</li>
					))}
				</ul>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<span className={labelClassName}>Copy the ranking</span>
					<CopyTextButton text={summary} />
				</div>
				<ResultBlock fileName="decision-matrix.txt" rows={6} title="Ranked options" value={summary} />
			</section>
		</ToolPanel>
	);
}
