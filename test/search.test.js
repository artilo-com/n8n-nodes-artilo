const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchQueryOf } = require('../dist/nodes/shared/search');

const input = (values) => ({
	searchBy: '',
	value: '',
	country: '',
	registrationNumber: '',
	...values,
});

test('finds leads and clients by email or Artilo ID, trimmed', () => {
	assert.deepEqual(searchQueryOf('client', input({ searchBy: 'email', value: ' a@b.co ' })), {
		kind: 'query',
		qs: { email: 'a@b.co' },
	});
	assert.deepEqual(searchQueryOf('lead', input({ searchBy: 'artiloId', value: 'id-1' })), {
		kind: 'query',
		qs: { artiloId: 'id-1' },
	});
	assert.equal(searchQueryOf('client', input({ searchBy: 'email', value: '  ' })).kind, 'invalid');
});

test('finds a company by country and the registration number as mapped', () => {
	assert.deepEqual(
		searchQueryOf(
			'company',
			input({ searchBy: 'registration', country: ' il ', registrationNumber: ' 515 ' }),
		),
		{ kind: 'query', qs: { country: 'il', registrationNumber: ' 515 ' } },
	);
	assert.deepEqual(searchQueryOf('company', input({ searchBy: 'artiloId', value: 'c-1' })), {
		kind: 'query',
		qs: { artiloId: 'c-1' },
	});
	assert.deepEqual(searchQueryOf('company', input({ searchBy: 'registration', country: 'IL' })), {
		kind: 'invalid',
		message: 'Registration Number is empty. Map it from an earlier step.',
	});
	assert.deepEqual(
		searchQueryOf('company', input({ searchBy: 'registration', registrationNumber: '515' })),
		{ kind: 'invalid', message: 'Country is empty. Map it from an earlier step.' },
	);
});

test('finds a deal only by its Artilo ID', () => {
	assert.deepEqual(searchQueryOf('deal', input({ value: ' d-1 ' })), {
		kind: 'query',
		qs: { artiloId: 'd-1' },
	});
	assert.deepEqual(searchQueryOf('deal', input({})), {
		kind: 'invalid',
		message: 'Artilo ID is empty. Map it from an earlier step.',
	});
});
