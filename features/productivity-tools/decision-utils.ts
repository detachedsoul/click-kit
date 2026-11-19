export type Criterion = { id: string; name: string; weight: number };
export type MatrixOption = { id: string; name: string };
export type Scores = Record<string, Record<string, number>>;

export const MAX_SCORE = 5;

export type RankedOption = { option: MatrixOption; score: number; points: number; possible: number };

/** An option's weighted percentage of the best possible score. */
export const scoreOption = (optionId: string, criteria: Criterion[], scores: Scores) => {
	const weightTotal = criteria.reduce((total, criterion) => total + Math.max(0, criterion.weight), 0);
	if (weightTotal === 0 || criteria.length === 0) return 0;
	const points = criteria.reduce((total, criterion) => {
		const raw = scores[optionId]?.[criterion.id] ?? 0;
		const value = Math.min(MAX_SCORE, Math.max(0, Number.isFinite(raw) ? raw : 0));
		return total + value * Math.max(0, criterion.weight);
	}, 0);
	return round(points / (weightTotal * MAX_SCORE) * 100, 1);
};

export const rankOptions = (criteria: Criterion[], options: MatrixOption[], scores: Scores): RankedOption[] => {
	const weightTotal = criteria.reduce((total, criterion) => total + Math.max(0, criterion.weight), 0);
	return options
		.map((option) => {
			const points = criteria.reduce((total, criterion) => {
				const raw = scores[option.id]?.[criterion.id] ?? 0;
				const value = Math.min(MAX_SCORE, Math.max(0, Number.isFinite(raw) ? raw : 0));
				return total + value * Math.max(0, criterion.weight);
			}, 0);
			return { option, score: scoreOption(option.id, criteria, scores), points: round(points, 2), possible: round(weightTotal * MAX_SCORE, 2) };
		})
		.sort((a, b) => b.points - a.points);
};

/** True when the top two options score the same, so the tool can say so instead of faking a winner. */
export const isTie = (ranked: RankedOption[]) => ranked.length > 1 && Math.abs(ranked[0].points - ranked[1].points) < 0.005;

export const winnerName = (ranked: RankedOption[]) => (ranked.some((entry) => entry.points > 0) ? ranked[0].option.name.trim() || "Option 1" : "");

export const verdict = (ranked: RankedOption[]) => {
	if (ranked.length === 0) return "Add an option to see a ranking.";
	if (ranked.every((entry) => entry.points === 0)) return "Score each option to see a ranking.";
	if (isTie(ranked)) return "The top two are level — add weight to the criterion that matters most to break the tie.";
	return `${winnerName(ranked)} comes out ahead at ${ranked[0].score}%.`;
};

export const summaryText = (ranked: RankedOption[]) =>
	ranked
		.map((entry, index) => `${index + 1}. ${entry.option.name.trim() || `Option ${index + 1}`} — ${entry.score}% (${entry.points} of ${entry.possible} weighted points)`)
		.join("\n");

export const validateMatrix = (criteria: Criterion[], options: MatrixOption[]) => {
	if (options.length < 2) return "A decision needs at least two options to compare.";
	if (criteria.length < 1) return "Add at least one criterion to score against.";
	if (criteria.every((criterion) => criterion.weight <= 0)) return "Give at least one criterion a weight above zero.";
	return "";
};

export const round = (value: number, places = 2) => {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
};
