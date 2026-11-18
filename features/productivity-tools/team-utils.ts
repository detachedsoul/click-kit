export type Team = { name: string; members: string[] };
export type SplitMode = "teams" | "size";
export type SplitOptions = { mode: SplitMode; value: number };

export type RandomSource = () => number;

export const parseNames = (input: string) =>
	input
		.split(/[\n,;]+/u)
		.map((name) => name.trim().replace(/\s+/gu, " "))
		.filter(Boolean);

export const dedupeNames = (names: string[]) => {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const name of names) {
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(name);
	}
	return output;
};

export const shuffle = <T,>(items: T[], random: RandomSource = Math.random) => {
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		[copy[index], copy[swap]] = [copy[swap], copy[index]];
	}
	return copy;
};

const validate = (names: string[], options: SplitOptions) => {
	if (names.length < 2) throw new Error("Add at least two names to make teams.");
	if (!Number.isInteger(options.value) || options.value < 1) throw new Error("Teams and sizes must be whole numbers of at least 1.");
	if (options.mode === "teams" && options.value > names.length) throw new Error("There cannot be more teams than people.");
};

/** Deal people into teams round-robin after a shuffle, so sizes differ by at most one. */
export const splitTeams = (names: string[], options: SplitOptions, random: RandomSource = Math.random): Team[] => {
	validate(names, options);
	const teamCount = options.mode === "teams" ? options.value : Math.ceil(names.length / options.value);
	const teams: Team[] = Array.from({ length: teamCount }, (_, index) => ({ name: `Team ${index + 1}`, members: [] }));
	shuffle(names, random).forEach((name, index) => teams[index % teamCount].members.push(name));
	return teams;
};

export const teamSummary = (teams: Team[]) => {
	const sizes = teams.map((team) => team.members.length);
	return {
		teams: teams.length,
		people: sizes.reduce((sum, size) => sum + size, 0),
		largest: sizes.length ? Math.max(...sizes) : 0,
		smallest: sizes.length ? Math.min(...sizes) : 0,
	};
};

export const teamsAsText = (teams: Team[]) =>
	teams.map((team) => `${team.name} (${team.members.length})\n${team.members.map((member) => `- ${member}`).join("\n")}`).join("\n\n");
