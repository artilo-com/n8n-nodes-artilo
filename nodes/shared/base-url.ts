/**
 * An Artilo backend origin without a trailing slash. The API key travels in a
 * header, so only a local backend may use plain http. The credential test
 * embeds this pattern in its expression, since it can't call code.
 */
export const BASE_URL_PATTERN = /^(https:\/\/[^/\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

/** The base URL from the credential, without a trailing slash, or null. */
export const normalizeBaseUrl = (value: string): string | null => {
	const trimmed = value.trim().replace(/\/+$/, '');
	return BASE_URL_PATTERN.test(trimmed) ? trimmed : null;
};
