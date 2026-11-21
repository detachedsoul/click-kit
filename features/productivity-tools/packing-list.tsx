"use client";

import { useState } from "react";
import { Check, Download, Printer, Sparkles, Trash2 } from "lucide-react";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, rowButtonClassName, rowFieldClassName, SegmentedControl, selectClassName, smallActionClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { useStoredState } from "@/features/productivity-tools/stored-state";
import {
	addItem,
	buildList,
	CATEGORIES,
	CATEGORY_NAMES,
	type Category,
	clampNights,
	firstState,
	groupByCategory,
	LIST_KEY,
	MAX_NIGHTS,
	MAX_NAME,
	MIN_NIGHTS,
	packingListAsText,
	progressOf,
	recordTemplate,
	removeItem,
	reviveState,
	reviveTemplates,
	stateFromTemplate,
	type Template,
	TEMPLATE_KEY,
	templateOf,
	templateWhen,
	togglePacked,
	tripAdvice,
	tripLabel,
	TRIP_TYPES,
	type TripType,
	unpackAll,
} from "@/features/productivity-tools/packing-utils";

export const PackingList = () => {
	const [state, setState] = useStoredState(LIST_KEY, firstState(), (raw) => reviveState(raw) ?? firstState());
	const [templates, setTemplates] = useStoredState<Template[]>(TEMPLATE_KEY, [], reviveTemplates);
	const [trip, setTrip] = useState<TripType>(state.trip);
	const [nights, setNights] = useState(state.nights);
	const [draft, setDraft] = useState("");
	const [category, setCategory] = useState<Category>("other");
	const [templateName, setTemplateName] = useState("");
	const [note, setNote] = useState("");
	const [problem, setProblem] = useState("");

	const progress = progressOf(state.items);
	const groups = groupByCategory(state.items);
	const advice = tripAdvice(trip, nights);
	const tripBlurb = TRIP_TYPES.find((entry) => entry.id === trip)?.blurb ?? "";

	/** A new list for the chosen trip. Anything added by hand comes with it. */
	const build = () => {
		const length = clampNights(nights);
		setNights(length);
		setState({ items: buildList(trip, length, state.items), nights: length, trip, updatedAt: Date.now() });
		setNote(`A fresh list for ${length} night${length === 1 ? "" : "s"} in ${tripLabel(trip).toLowerCase()}.`);
		setProblem("");
	};

	const tick = (id: string) => {
		setState((current) => ({ ...current, items: togglePacked(current.items, id), updatedAt: Date.now() }));
		setNote("");
	};

	const drop = (id: string) => {
		setState((current) => ({ ...current, items: removeItem(current.items, id), updatedAt: Date.now() }));
	};

	const add = () => {
		const trimmed = draft.trim();
		if (!trimmed) {
			setProblem("Type the thing you want to add first.");
			return;
		}
		setProblem("");
		setState((current) => ({ ...current, items: addItem(current.items, trimmed, category), updatedAt: Date.now() }));
		setNote(`${trimmed} is on the list under ${CATEGORY_NAMES[category].toLowerCase()}.`);
		setDraft("");
	};

	const saveTemplate = () => {
		const template = templateOf(state, templateName);
		setTemplates((current) => recordTemplate(current, template));
		setTemplateName("");
		setNote(`Saved as “${template.name}”. It is on this device only.`);
	};

	const loadTemplate = (template: Template) => {
		setState(stateFromTemplate(template));
		setTrip(template.trip);
		setNights(template.nights);
		setNote(`“${template.name}” is on the list, unticked and ready.`);
		setProblem("");
	};

	const dropTemplate = (id: string) => {
		setTemplates((current) => current.filter((template) => template.id !== id));
	};

	const text = packingListAsText(state);
	const nightsLabel = `${state.nights} night${state.nights === 1 ? "" : "s"}`;

	return (
		<ToolPanel>
			<div className="flex flex-col gap-3" data-print="hide">
				<SegmentedControl<TripType>
					label="Where are you going?"
					onChange={setTrip}
					options={TRIP_TYPES.map((entry) => ({ id: entry.id, label: entry.label }))}
					value={trip}
				/>
				<p className={`${hintClassName} -mt-1`}>{tripBlurb}</p>
				<div>
					<label className={labelClassName} htmlFor="packing-nights">
						How many nights?
					</label>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<input
							className={`${rowFieldClassName} max-w-28`}
							id="packing-nights"
							inputMode="numeric"
							max={MAX_NIGHTS}
							min={MIN_NIGHTS}
							onChange={(event) => setNights(Number.parseInt(event.target.value, 10) || MIN_NIGHTS)}
							type="number"
							value={nights}
						/>
						<button className={rowButtonClassName} onClick={build} type="button">
							<Sparkles aria-hidden="true" size={13} /> Build the list
						</button>
						<span className={hintClassName}>{advice}</span>
					</div>
				</div>
				{note ? (
					<p className="m-0 text-xs leading-relaxed text-ink" role="status">
						<Check aria-hidden="true" className="mr-1 inline align-[-2px]" size={12} /> {note}
					</p>
				) : null}
				{problem ? <ErrorNote message={problem} /> : null}
			</div>

			<section aria-live="polite" className="flex flex-col gap-3 border border-line bg-[#fbfaf7] p-3" data-print="sheet">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold text-ink">Your list</h2>
					<span className="text-xs text-muted">
						{tripLabel(state.trip)} · {nightsLabel} · {progress.total} line{progress.total === 1 ? "" : "s"}
					</span>
				</div>
				<StatGrid
					items={[
						{ label: "Packed", value: `${progress.packed} of ${progress.total}` },
						{ label: "Still to pack", value: String(progress.left) },
						{ label: "Progress", value: `${progress.percent}%` },
						{ label: "Trip", value: nightsLabel },
					]}
				/>
				<div aria-label="Packing progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress.percent} className="h-2 w-full bg-sage" role="progressbar">
					<div className="h-full bg-forest transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
				</div>
				<p className="m-0 text-xs text-muted">{progress.packed === progress.total ? "Everything is packed. Shut the bag." : `${progress.left} thing${progress.left === 1 ? "" : "s"} still to go.`}</p>
			</section>

			{groups.map((group) => (
				<section className="flex flex-col gap-2" data-print="sheet" key={group.category}>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h3 className="m-0 text-xs font-semibold uppercase tracking-[.08em] text-ink">{CATEGORY_NAMES[group.category]}</h3>
						<span className="text-[11px] text-muted">
							{group.packed} of {group.total} packed
						</span>
					</div>
					<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
						{group.items.map((item) => (
							<li className="flex items-center gap-2.5 border border-line bg-surface px-3 py-2" key={item.id}>
								<input
									aria-label={`Packed: ${item.name}`}
									checked={item.packed}
									className="checkbox-input"
									id={`pack-${item.id}`}
									onChange={() => tick(item.id)}
									type="checkbox"
								/>
								<label className={`min-w-0 flex-1 cursor-pointer text-sm ${item.packed ? "text-muted line-through" : "text-ink"}`} htmlFor={`pack-${item.id}`}>
									{item.name}
									{item.quantity > 1 ? <span className="ml-1.5 font-mono text-xs text-muted">×{item.quantity}</span> : null}
									{item.custom ? <span className="ml-1.5 text-[10px] uppercase tracking-[.08em] text-muted">added</span> : null}
								</label>
								<button aria-label={`Remove ${item.name}`} className="cursor-pointer text-[11px] text-[#8a3f30] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-print="hide" onClick={() => drop(item.id)} type="button">
									Remove
								</button>
							</li>
						))}
					</ul>
				</section>
			))}

			<section className="flex flex-col gap-3" data-print="hide">
				<h2 className="m-0 text-sm font-semibold text-ink">Add something of your own</h2>
				<div className="flex flex-wrap items-end gap-2">
					<div className="min-w-0 flex-1">
						<label className={labelClassName} htmlFor="packing-new">
							Item
						</label>
						<input
							className={fieldClassName}
							id="packing-new"
							maxLength={MAX_NAME}
							onChange={(event) => {
								setDraft(event.target.value);
								setProblem("");
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") add();
							}}
							placeholder="Passport wallet, spare battery, a good book"
							type="text"
							value={draft}
						/>
					</div>
					<div>
						<label className={labelClassName} htmlFor="packing-category">
							Category
						</label>
						<select className={`${selectClassName} min-w-40`} id="packing-category" onChange={(event) => setCategory(event.target.value as Category)} value={category}>
							{CATEGORIES.map((entry) => (
								<option key={entry} value={entry}>
									{CATEGORY_NAMES[entry]}
								</option>
							))}
						</select>
					</div>
					<button className={rowButtonClassName} onClick={add} type="button">
						Add item
					</button>
				</div>
				<p className={hintClassName}>Adding the same thing twice means one more of it, not a second row.</p>
			</section>

			<section className="flex flex-col gap-3" data-print="hide">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold text-ink">Templates</h2>
					{templates.length ? (
						<span className="text-xs text-muted">
							{templates.length} kept on this device
						</span>
					) : null}
				</div>
				<div className="flex flex-wrap items-end gap-2">
					<div className="min-w-0 flex-1">
						<label className={labelClassName} htmlFor="packing-template-name">
							Save this list as
						</label>
						<input
							className={fieldClassName}
							id="packing-template-name"
							maxLength={MAX_NAME}
							onChange={(event) => setTemplateName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") saveTemplate();
							}}
							placeholder={`${tripLabel(state.trip)} · ${nightsLabel}`}
							type="text"
							value={templateName}
						/>
					</div>
					<button className={rowButtonClassName} onClick={saveTemplate} type="button">
						Save template
					</button>
				</div>
				{templates.length ? (
					<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
						{templates.map((template) => (
							<li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-line bg-surface px-3 py-2" key={template.id}>
								<div className="min-w-0 flex-1">
									<p className="m-0 text-sm text-ink">{template.name}</p>
									<p className="m-0 text-[11px] text-muted">
										{tripLabel(template.trip)} · {template.nights} night{template.nights === 1 ? "" : "s"} · {template.items.length} line{template.items.length === 1 ? "" : "s"} · saved {templateWhen(template.savedAt)}
									</p>
								</div>
								<button aria-label={`Use template ${template.name}`} className={smallActionClassName} onClick={() => loadTemplate(template)} type="button">
									Use
								</button>
								<button aria-label={`Delete template ${template.name}`} className={smallActionClassName} onClick={() => dropTemplate(template.id)} type="button">
									<Trash2 aria-hidden="true" size={12} /> Delete
								</button>
							</li>
						))}
					</ul>
				) : (
					<p className="m-0 text-xs text-muted">No templates yet. Save a list you get right, and next trip starts from it.</p>
				)}
			</section>

			<div className="flex flex-wrap items-center gap-2" data-print="hide">
				<button className={smallActionClassName} onClick={() => window.print()} type="button">
					<Printer aria-hidden="true" size={12} /> Print list
				</button>
				<a className={smallActionClassName} download="packing-list.md" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(text)}`}>
					<Download aria-hidden="true" size={12} /> Download .md
				</a>
				<button className={smallActionClassName} onClick={() => setState((current) => ({ ...current, items: unpackAll(current.items), updatedAt: Date.now() }))} type="button">
					Unpack everything
				</button>
				<CopyTextButton text={text} />
			</div>
			<p className={`${hintClassName} -mt-2`} data-print="hide">
				The list, the ticks, and your templates live in this browser only — nothing is uploaded, and clearing site data clears them. Printing shows the list and hides the controls.
			</p>
		</ToolPanel>
	);
};
