/** Used when a currency code is not one Intl knows. */
const DEFAULT_FRACTION_DIGITS = 2;

const fractionDigitsOf = (currency: unknown): number => {
	try {
		return (
			new Intl.NumberFormat('en', {
				style: 'currency',
				currency: String(currency),
			}).resolvedOptions().maximumFractionDigits ?? DEFAULT_FRACTION_DIGITS
		);
	} catch {
		return DEFAULT_FRACTION_DIGITS;
	}
};

/**
 * Artilo sends money as an integer in the currency's minor units (cents for
 * USD). Workflows get a decimal in the currency's own units, as Zaps do:
 * 1250050 USD reads as 12500.5, 1250 JPY stays 1250.
 */
export const toDecimal = (minorUnits: unknown, currency: unknown): number | null => {
	if (minorUnits === null || minorUnits === undefined || minorUnits === '') {
		return null;
	}
	const amount = Number(minorUnits);
	if (Number.isNaN(amount)) {
		return null;
	}
	return amount / 10 ** fractionDigitsOf(currency);
};

/** A deal event as workflows read it: the total as a decimal. */
export const withDecimalTotal = <T extends Record<string, unknown>>(event: T): T =>
	'total_value' in event
		? { ...event, total_value: toDecimal(event.total_value, event.currency) }
		: event;
