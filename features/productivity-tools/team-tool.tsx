"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { dedupeNames, parseNames, splitTeams, teamSummary, teamsAsText, type SplitMode, type Team } from "@/features/productivity-tools/team-utils";

export const TeamTool = () => {
	const [namesInput, setNamesInput] = useState("");
	const [mode, setMode] = useState<SplitMode>("teams");
	const [valueInput, setValueInput] = useState("2");
	const [removeDuplicates, setRemoveDuplicates] = useState(true);
	const [teams, setTeams] = useState<Team[]>([]);
	const [error, setError] = useState("");

	const names = parseNames(namesInput);
	const pool = removeDuplicates ? dedupeNames(names) : names;
	const summary = teamSummary(teams);

	const draw = () => {
		try {
			const drawn = splitTeams(pool, { mode, value: Number(valueInput) });
			setTeams(drawn);
			setError("");
		} catch (caught) {
			setTeams([]);
			setError(caught instanceof Error ? caught.message : "Could not draw teams.");
		}
	};

	return (
		<ToolPanel>
			<TextAreaField
				hint="One name per line, or separated by commas. Duplicates are removed first so nobody is counted twice."
				id="team-names"
				label="Names"
				onChange={setNamesInput}
				placeholder={"Ada\nGrace\nAlan\nLinus"}
				value={namesInput}
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<SegmentedControl
					label="Split by"
					onChange={(next) => {
						setMode(next);
						setTeams([]);
					}}
					options={[
						{ id: "teams", label: "Number of teams" },
						{ id: "size", label: "People per team" },
					]}
					value={mode}
				/>
				<label className={labelClassName} htmlFor="team-value">
					{mode === "teams" ? "How many teams" : "People in each team"}
					<input
						className={fieldClassName}
						id="team-value"
						max={pool.length || 100}
						min={1}
						onChange={(event) => setValueInput(event.target.value)}
						type="number"
						value={valueInput}
					/>
				</label>
			</div>
			<label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink" htmlFor="team-dedupe">
				<input
					checked={removeDuplicates}
					className="checkbox-input mt-0.5"
					id="team-dedupe"
					onChange={(event) => setRemoveDuplicates(event.target.checked)}
					type="checkbox"
				/>
				<span>
					Remove duplicate names <span className="text-muted">({names.length - pool.length} found)</span>
				</span>
			</label>
			<button className={primaryButtonClassName} disabled={pool.length < 2} onClick={draw} type="button">
				<Shuffle aria-hidden="true" className="mr-2" size={14} /> Draw teams
			</button>
			<ErrorNote message={error} />
			{teams.length > 0 ? (
				<>
					<StatGrid
						items={[
							{ label: "Teams", value: String(summary.teams) },
							{ label: "People", value: String(summary.people) },
							{ label: "Largest team", value: String(summary.largest) },
							{ label: "Smallest team", value: String(summary.smallest) },
						]}
					/>
					<div className="grid gap-3 sm:grid-cols-2">
						{teams.map((team) => (
							<section className="border border-line bg-[#fbfaf7] p-3.5" key={team.name}>
								<h2 className="m-0 text-xs font-semibold">
									{team.name} <span className="font-normal text-muted">({team.members.length})</span>
								</h2>
								<ul className="mb-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs text-ink">
									{team.members.map((member) => (
										<li key={`${team.name}-${member}`}>{member}</li>
									))}
								</ul>
							</section>
						))}
					</div>
					<ResultBlock fileName="teams.txt" rows={10} title="Teams as text" value={teamsAsText(teams)} />
					<p className={hintClassName}>Draw again for a fresh shuffle — team sizes stay within one person of each other every time.</p>
				</>
			) : null}
			{teams.length === 0 ? (
				<p className={hintClassName}>
					Shuffling happens in the page itself, so you can redraw as often as you like. With {pool.length} name{pool.length === 1 ? "" : "s"} in the list,
					the largest team will hold at most one more person than the smallest.
				</p>
			) : null}
		</ToolPanel>
	);
};
