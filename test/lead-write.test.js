const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildLeadWriteBody } = require('../dist/nodes/shared/lead-write');

test('sends only the mapped values, keeping 0 and false', () => {
	assert.deepEqual(
		buildLeadWriteBody(' form-12 ', {
			first_name: 'Jane',
			last_name: '',
			phone: '   ',
			email: null,
			tags: [],
			score: 0,
			newsletter: false,
		}),
		{ requestId: 'form-12', values: { first_name: 'Jane', score: 0, newsletter: false } },
	);
});

test('stops before calling Artilo when the Request ID is empty', () => {
	assert.equal(buildLeadWriteBody('  ', { first_name: 'Jane' }), null);
});

test('reads no mapped fields as no values', () => {
	assert.deepEqual(buildLeadWriteBody('form-12', null), { requestId: 'form-12', values: {} });
});
