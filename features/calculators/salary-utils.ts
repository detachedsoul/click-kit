export type PayPeriod = "hour" | "day" | "week" | "month" | "year";

export const PAY_PERIODS: { id: PayPeriod; label: string; short: string }[] = [
	{ id: "hour", label: "Per hour", short: "hour" },
	{ id: "day", label: "Per day", short: "day" },
	{ id: "week", label: "Per week", short: "week" },
	{ id: "month", label: "Per month", short: "month" },
	{ id: "year", label: "Per year", short: "year" },
];

export const CURRENCIES: { code: string; label: string }[] = [
	{ code: "NGN", label: "Naira (₦)" },
	{ code: "USD", label: "US dollar ($)" },
	{ code: "GBP", label: "Pound (£)" },
	{ code: "EUR", label: "Euro (€)" },
	{ code: "CAD", label: "Canadian dollar" },
	{ code: "INR", label: "Indian rupee" },
];

export type PaySettings = { hoursPerWeek: number; daysPerWeek: number; weeksPerYear: number };

export const DEFAULT_SETTINGS: PaySettings = { hoursPerWeek: 40, daysPerWeek: 5, weeksPerYear: 52 };

const requirePositive = (value: number, label: string, max: number) => {
	if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be more than zero.`);
	if (value > max) throw new Error(`${label} cannot be more than ${max}.`);
	return value;
};

export const normaliseSettings = ({ hoursPerWeek, daysPerWeek, weeksPerYear }: PaySettings): PaySettings => ({
	hoursPerWeek: requirePositive(hoursPerWeek, "Hours per week", 168),
	daysPerWeek: requirePositive(daysPerWeek, "Working days per week", 7),
	weeksPerYear: requirePositive(weeksPerYear, "Working weeks per year", 52),
});

/** Turn any one period's pay into all the others, using the hours and weeks you actually work. */
export const convertPay = (amount: number, period: PayPeriod, settings: PaySettings = DEFAULT_SETTINGS) => {
	if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter the pay amount first.");
	const { hoursPerWeek, daysPerWeek, weeksPerYear } = normaliseSettings(settings);
	const hoursPerYear = hoursPerWeek * weeksPerYear;
	const hourly =
		period === "hour"
			? amount
			: period === "day"
				? amount / (hoursPerWeek / daysPerWeek)
				: period === "week"
					? amount / hoursPerWeek
					: period === "month"
						? (amount * 12) / hoursPerYear
						: amount / hoursPerYear;
	const weekly = hourly * hoursPerWeek;
	const annual = weekly * weeksPerYear;
	const round = (value: number) => Math.round(value * 100) / 100;
	return {
		hour: round(hourly),
		day: round(weekly / daysPerWeek),
		week: round(weekly),
		month: round(annual / 12),
		year: round(annual),
		hoursPerYear,
		settings: { hoursPerWeek, daysPerWeek, weeksPerYear },
	};
};

export const formatMoney = (amount: number, currency = "NGN") => {
	try {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency,
			maximumFractionDigits: amount >= 1000 ? 0 : 2,
			minimumFractionDigits: 0,
		}).format(amount);
	} catch {
		return `${currency} ${amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
	}
};

export const formatAmount = (amount: number) =>
	new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: amount < 100 ? 2 : 0 }).format(amount);

export const payReport = (amount: number, period: PayPeriod, currency: string, settings: PaySettings = DEFAULT_SETTINGS) => {
	const result = convertPay(amount, period, settings);
	const source = PAY_PERIODS.find((option) => option.id === period)?.label ?? "Pay";
	return [
		`${source.padEnd(12)} ${formatMoney(amount, currency)}`,
		"",
		...PAY_PERIODS.map((option) => `${option.label.padEnd(12)} ${formatMoney(result[option.id], currency)}`),
		"",
		`Hours per week   ${result.settings.hoursPerWeek}`,
		`Days per week    ${result.settings.daysPerWeek}`,
		`Weeks per year   ${result.settings.weeksPerYear}`,
		`Hours per year   ${formatAmount(result.hoursPerYear)}`,
	].join("\n");
};
