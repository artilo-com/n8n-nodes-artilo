import type { IDataObject } from 'n8n-workflow';

/** What Artilo returned when this trigger subscribed a webhook URL. */
export interface StoredSubscription {
	id: string;
	signingSecret: string;
}

const isStoredSubscription = (value: unknown): value is StoredSubscription =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as IDataObject).id === 'string' &&
	typeof (value as IDataObject).signingSecret === 'string';

/**
 * The node's subscriptions, by webhook URL. The test URL ("Listen for test
 * event") and the production URL each get their own subscription and secret,
 * so testing never touches the live one.
 */
export const subscriptionsOf = (staticData: IDataObject): Record<string, StoredSubscription> => {
	const stored = staticData.subscriptions;
	if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(stored).filter((entry): entry is [string, StoredSubscription] =>
			isStoredSubscription(entry[1]),
		),
	);
};
