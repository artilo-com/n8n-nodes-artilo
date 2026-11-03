import { createHmac, timingSafeEqual } from 'crypto';
import { SIGNATURE_TOLERANCE_SECONDS, SIGNATURE_VERSION } from './constants';

export type SignatureCheck = 'valid' | 'missing' | 'invalid' | 'expired';

const parseHeader = (header: string): { timestamp: number; signatures: string[] } | null => {
	const parts = header.split(',').map((part) => part.trim().split('='));
	const timestamp = Number(parts.find(([name]) => name === 't')?.[1]);
	const signatures = parts
		.filter(([name, value]) => name === SIGNATURE_VERSION && Boolean(value))
		.map(([, value]) => value);
	if (!Number.isInteger(timestamp) || signatures.length === 0) {
		return null;
	}
	return { timestamp, signatures };
};

const sign = (secret: string, timestamp: number, rawBody: string): Buffer =>
	createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();

const matches = (expected: Buffer, given: string): boolean => {
	const givenBuffer = Buffer.from(given, 'hex');
	return givenBuffer.length === expected.length && timingSafeEqual(givenBuffer, expected);
};

/**
 * Checks Artilo's `X-Artilo-Signature: t=<seconds>,v1=<hex>` header: an
 * HMAC-SHA256 of `<t>.<raw body>` keyed with one of this trigger's
 * subscription secrets, signed within the last five minutes. The raw body
 * must be the exact bytes received, before any JSON parsing.
 */
export const checkSignature = (
	header: string | undefined,
	rawBody: string,
	secrets: string[],
	nowSeconds: number,
): SignatureCheck => {
	if (!header) {
		return 'missing';
	}
	const parsed = parseHeader(header);
	if (!parsed) {
		return 'invalid';
	}
	const signedByUs = secrets.some((secret) => {
		const expected = sign(secret, parsed.timestamp, rawBody);
		return parsed.signatures.some((signature) => matches(expected, signature));
	});
	if (!signedByUs) {
		return 'invalid';
	}
	if (Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
		return 'expired';
	}
	return 'valid';
};
