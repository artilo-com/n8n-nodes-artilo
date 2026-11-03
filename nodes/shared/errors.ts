const GENERIC_MESSAGES: Record<number, string> = {
	401: 'Artilo did not accept this API key. Create a new n8n key in Artilo and update the credential.',
	403: 'This Artilo account or user is not allowed to do this.',
	404: 'Artilo could not find what this step asked for.',
	409: 'Artilo refused this request because it conflicts with an earlier one.',
	422: 'Artilo could not accept the data this step sent.',
	429: 'Artilo is receiving too many requests. Try again in a moment, or turn on Retry On Fail for this node.',
	500: 'Artilo hit an unexpected error. Try again in a moment, or turn on Retry On Fail for this node.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The integration API's error body is `{ code, message, field? }`, with
 * `message` already saying what to fix. Errors raised before it (a rejected
 * key, the global rate limit) come as `{ statusCode, message, errors }`,
 * whose `errors` name the fields of a validation failure.
 */
const messageFromBody = (body: unknown): string | null => {
	if (!isRecord(body)) {
		return null;
	}
	const message = typeof body.message === 'string' ? body.message.trim() : '';
	const field = typeof body.field === 'string' && body.field ? `(field: ${body.field})` : '';
	const fieldErrors = isRecord(body.errors)
		? Object.entries(body.errors)
				.filter(
					(entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0,
				)
				.map(([key, messages]) => `${key}: ${messages.join(', ')}`)
		: [];
	return [message, field, ...fieldErrors].filter(Boolean).join(' ') || null;
};

/** What to tell the user about a failed call to Artilo. */
export const artiloErrorMessage = (status: number | undefined, body: unknown): string => {
	if (status === 429 || (status !== undefined && status >= 500 && status !== 503)) {
		return GENERIC_MESSAGES[status === 429 ? 429 : 500];
	}
	// Artilo answers 503 while a write with the same Request ID is still running
	const fromBody = messageFromBody(body);
	if (fromBody) {
		return fromBody;
	}
	if (status === undefined) {
		return 'Artilo could not be reached. Check the Artilo URL in the credential.';
	}
	return GENERIC_MESSAGES[status] ?? `Artilo answered with HTTP ${status}.`;
};
