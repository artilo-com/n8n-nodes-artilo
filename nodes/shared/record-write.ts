export interface WriteBody {
	requestId: string;
	values: Record<string, unknown>;
}

export const EMPTY_REQUEST_ID_MESSAGE =
	'Request ID is empty. Map a stable ID from an earlier step, such as the form submission ID.';

export const isBlank = (value: unknown): boolean =>
	value === undefined ||
	value === null ||
	(typeof value === 'string' && value.trim() === '') ||
	(Array.isArray(value) && value.length === 0);

/**
 * The body of a create or update: the request ID, and only the values
 * that were mapped. A blank never clears what Artilo holds, so it is not
 * sent, but 0 and false are real values and are kept. Null when the Request
 * ID came through empty, which must stop the item before Artilo is called.
 */
export const buildWriteBody = (
	requestId: string,
	mapped: Record<string, unknown> | null | undefined,
): WriteBody | null => {
	const trimmedRequestId = requestId.trim();
	if (!trimmedRequestId) {
		return null;
	}
	const values = Object.fromEntries(
		Object.entries(mapped ?? {}).filter(([, value]) => !isBlank(value)),
	);
	return { requestId: trimmedRequestId, values };
};
