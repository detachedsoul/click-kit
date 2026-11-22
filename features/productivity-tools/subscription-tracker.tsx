"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { buttonClassName, choiceButtonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, smallActionClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { todayIso } from "@/features/productivity-tools/local-day";
import { clearStore, useStoredState } from "@/features/productivity-tools/stored-state";
import {
	addSubscription,
	byRenewal,
	clampAmount,
	cycleLabel,
	CYCLES,
	type Cycle,
	describeRenewal,
	MAX_SUBSCRIPTIONS,
	money,
	monthlyCost,
	removeSubscription,
	renameSubscription,
	reviveSubscriptions,
	SUBSCRIPTION_KEY,
	type Subscription,
	subscriptionsAsMarkdown,
	toggleSubscription,
	totals,
} from "@/features/productivity-tools/subscription-utils";

const CURRENCY = "GBP";

export const SubscriptionTracker = () => {
	const [subscriptions, setSubscriptions, ready] = useStoredState<Subscription[]>(SUBSCRIPTION_KEY, [], reviveSubscriptions);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [cycle, setCycle] = useState<Cycle>("monthly");
	const [next, setNext] = useState("");
	const [error, setError] = useState("");
	const [editing, setEditing] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState("");

	const today = todayIso();
	const all = totals(subscriptions);
	const sorted = [...subscriptions].sort(byRenewal(today));

	const add = () => {
		const nextList = addSubscription(subscriptions, { name, amount, cycle, next });
		if (nextList === subscriptions) {
			setError(!name.trim() ? "Give the subscription a name." : !clampAmount(Number.parseFloat(amount)) ? "Add what it costs — a number greater than zero." : `That is ${MAX_SUBSCRIPTIONS} subscriptions, which is plenty.`);
			return;
		}
		setSubscriptions(nextList);
		setName("");
		setAmount("");
		setNext("");
		setError("");
	};

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label className={labelClassName} htmlFor="sub-name">
						What it is
					</label>
					<input className={fieldClassName} id="sub-name" onChange={(event) => setName(event.target.value)} placeholder="Streaming, hosting, the gym…" type="text" value={name} />
				</div>
				<div>
					<label className={labelClassName} htmlFor="sub-amount">
						What it costs
					</label>
					<input className={fieldClassName} id="sub-amount" inputMode="decimal" min={0} onChange={(event) => setAmount(event.target.value)} placeholder="12.99" step="0.01" type="number" value={amount} />
				</div>
			</div>
			<div>
				<span className={labelClassName}>Billed</span>
				<div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Billing cycle">
					{CYCLES.map((option) => (
						<button aria-pressed={cycle === option.id} className={choiceButtonClassName(cycle === option.id)} key={option.id} onClick={() => setCycle(option.id)} type="button">
							{option.label}
						</button>
					))}
				</div>
			</div>
			<div>
				<label className={labelClassName} htmlFor="sub-next">
					Next renewal (optional)
				</label>
				<input className={fieldClassName} id="sub-next" onChange={(event) => setNext(event.target.value)} type="date" value={next} />
			</div>
			{error ? <ErrorNote message={error} /> : null}
			<button className={primaryButtonClassName} onClick={add} type="button">
				Add the subscription
			</button>
			<StatGrid
				items={[
					{ label: "Live", value: String(all.count) },
					{ label: "A month", value: money(all.monthly, CURRENCY) },
					{ label: "A year", value: money(all.yearly, CURRENCY) },
					{ label: "Cancelled", value: String(all.cancelled) },
				]}
			/>
			{!ready ? (
				<p className={hintClassName}>Reading this browser&apos;s list…</p>
			) : sorted.length === 0 ? (
				<p className={hintClassName}>Nothing tracked yet. Add a subscription and it is kept on this device only — no account, no sync, no server.</p>
			) : (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{sorted.map((subscription) => (
						<li className={`flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2 ${subscription.active ? "" : "opacity-60"}`} key={subscription.id}>
							<div className="min-w-0">
								{editing === subscription.id ? (
									<input
										className={`${fieldClassName} mt-0 h-9`}
										aria-label={`New name for ${subscription.name}`}
										onBlur={() => setEditing(null)}
										onChange={(event) => setEditDraft(event.target.value)}
										onKeyDown={(event) => {
											if (event.key !== "Enter") return;
											setSubscriptions(renameSubscription(subscriptions, subscription.id, editDraft));
											setEditing(null);
										}}
										value={editDraft}
									/>
								) : (
									<p className="m-0 text-sm font-medium text-ink">{subscription.name}</p>
								)}
								<p className="m-0 mt-1 text-xs text-muted">
									{money(subscription.amount, CURRENCY)} {cycleLabel(subscription.cycle)} · {money(monthlyCost(subscription), CURRENCY)} a month · {describeRenewal(subscription.next, today)}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									aria-label={`Rename ${subscription.name}`}
									className={buttonClassName}
									onClick={() => {
										setEditing(subscription.id);
										setEditDraft(subscription.name);
									}}
									type="button"
								>
									Rename
								</button>
								<button aria-pressed={!subscription.active} className={buttonClassName} onClick={() => setSubscriptions(toggleSubscription(subscriptions, subscription.id))} type="button">
									{subscription.active ? "Cancel it" : "Bring it back"}
								</button>
								<button aria-label={`Remove ${subscription.name}`} className={buttonClassName} onClick={() => setSubscriptions(removeSubscription(subscriptions, subscription.id))} type="button">
									<Trash2 aria-hidden="true" size={13} /> Remove
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<CopyTextButton text={subscriptionsAsMarkdown(subscriptions, CURRENCY, today)} />
				<button
					className={smallActionClassName}
					onClick={() => {
						setSubscriptions([]);
						clearStore(SUBSCRIPTION_KEY);
						setEditing(null);
					}}
					type="button"
				>
					Clear the list
				</button>
			</div>
			<p className={hintClassName}>
				Everything is normalised to a monthly figure, so a yearly renewal and a weekly one can be compared honestly. Cancelling keeps the row for the record and takes it out of the totals.
			</p>
		</ToolPanel>
	);
};
