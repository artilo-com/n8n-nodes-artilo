const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBaseUrl } = require('../dist/nodes/shared/base-url');
const { ArtiloApi } = require('../dist/credentials/ArtiloApi.credentials');
const { toDecimal, withDecimalTotal } = require('../dist/nodes/shared/money');
const { subscriptionsOf } = require('../dist/nodes/shared/subscriptions');

test('takes an https Artilo URL, or http only for a local backend', () => {
	assert.equal(normalizeBaseUrl(' https://api.artilo.com/ '), 'https://api.artilo.com');
	assert.equal(normalizeBaseUrl('http://localhost:3000'), 'http://localhost:3000');
	assert.equal(normalizeBaseUrl('http://api.artilo.com'), null);
	assert.equal(normalizeBaseUrl('https://api.artilo.com/api/v1'), null);
	assert.equal(normalizeBaseUrl(''), null);
});

test("the credential test reaches the same base URL the nodes use", () => {
	const baseURL = new ArtiloApi().test.request.baseURL;
	const expression = baseURL.slice(baseURL.indexOf('{{') + 2, baseURL.indexOf('}}'));
	const evaluate = new Function('$credentials', `return ${expression};`);
	for (const value of [' https://api.artilo.com/ ', 'http://localhost:3000', 'http://api.artilo.com', '']) {
		const expected = normalizeBaseUrl(value) ?? 'https://the-artilo-url-must-start-with-https.invalid';
		assert.equal(evaluate({ baseUrl: value }), expected);
	}
});

test('turns minor units into the currency decimal', () => {
	assert.equal(toDecimal(1250050, 'USD'), 12500.5);
	assert.equal(toDecimal(1250, 'JPY'), 1250);
	assert.equal(toDecimal(1000, 'NOT_A_CURRENCY'), 10);
	assert.equal(toDecimal(null, 'USD'), null);
	assert.deepEqual(withDecimalTotal({ id: 'e', total_value: 500, currency: 'EUR' }), {
		id: 'e',
		total_value: 5,
		currency: 'EUR',
	});
	assert.deepEqual(withDecimalTotal({ id: 'e' }), { id: 'e' });
});

test('reads only well formed stored subscriptions', () => {
	assert.deepEqual(subscriptionsOf({}), {});
	assert.deepEqual(
		subscriptionsOf({
			subscriptions: {
				'https://n8n.test/webhook/a': { id: 'sub-1', signingSecret: 's1' },
				'https://n8n.test/webhook-test/a': { id: 'sub-2' },
			},
		}),
		{ 'https://n8n.test/webhook/a': { id: 'sub-1', signingSecret: 's1' } },
	);
});
