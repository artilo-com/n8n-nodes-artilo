import type { ArtiloResource } from './resources';

export interface SearchInput {
	searchBy: string;
	value: string;
	country: string;
	registrationNumber: string;
}

/** The query string of a Find, or why the item stops before Artilo is called. */
export type SearchQuery =
	| { kind: 'query'; qs: Record<string, string> }
	| { kind: 'invalid'; message: string };

const invalid = (message: string): SearchQuery => ({ kind: 'invalid', message });

const emptyValue = (what: string): SearchQuery =>
	invalid(`${what} is empty. Map it from an earlier step.`);

/** Leads and clients are found by Artilo ID or email. */
const byIdOrEmail = ({ searchBy, value }: SearchInput): SearchQuery => {
	const trimmed = value.trim();
	if (!trimmed) {
		return invalid(
			'Value is empty. Map the Artilo ID or email to search for from an earlier step.',
		);
	}
	return { kind: 'query', qs: { [searchBy === 'artiloId' ? 'artiloId' : 'email']: trimmed } };
};

/**
 * A company is found by its Artilo ID, or by its country and registration
 * number together. The registration number matches exactly, spaces included,
 * so it is sent as mapped.
 */
const companyQuery = ({
	searchBy,
	value,
	country,
	registrationNumber,
}: SearchInput): SearchQuery => {
	if (searchBy === 'artiloId') {
		const artiloId = value.trim();
		return artiloId ? { kind: 'query', qs: { artiloId } } : emptyValue('Artilo ID');
	}
	const countryCode = country.trim();
	if (!countryCode) {
		return emptyValue('Country');
	}
	if (!registrationNumber.trim()) {
		return emptyValue('Registration Number');
	}
	return { kind: 'query', qs: { country: countryCode, registrationNumber } };
};

export const searchQueryOf = (resource: ArtiloResource, input: SearchInput): SearchQuery => {
	if (resource === 'company') {
		return companyQuery(input);
	}
	if (resource === 'deal') {
		const artiloId = input.value.trim();
		return artiloId ? { kind: 'query', qs: { artiloId } } : emptyValue('Artilo ID');
	}
	return byIdOrEmail(input);
};
