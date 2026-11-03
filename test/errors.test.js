const { test } = require('node:test');
const assert = require('node:assert/strict');
const { artiloErrorMessage } = require('../dist/nodes/shared/errors');

test("passes Artilo's own message on, with the field it is about", () => {
	assert.equal(
		artiloErrorMessage(422, { code: 'INVALID_VALUE', message: 'Owner is not active.', field: 'owner_id' }),
		'Owner is not active. (field: owner_id)',
	);
});

test('lists the fields of a validation failure', () => {
	assert.equal(
		artiloErrorMessage(400, { message: 'Bad Request', errors: { requestId: ['must be a string'] } }),
		'Bad Request requestId: must be a string',
	);
});

test('keeps the message of a 503 for a write still running', () => {
	assert.equal(
		artiloErrorMessage(503, { message: 'A write with this Request ID is still running.' }),
		'A write with this Request ID is still running.',
	);
});

test('falls back to a generic message', () => {
	assert.match(artiloErrorMessage(401, null), /n8n key/);
	assert.match(artiloErrorMessage(429, { message: 'ThrottlerException' }), /too many requests/);
	assert.match(artiloErrorMessage(500, { message: 'Internal error' }), /unexpected error/);
	assert.equal(artiloErrorMessage(418, null), 'Artilo answered with HTTP 418.');
	assert.match(artiloErrorMessage(undefined, undefined), /could not be reached/);
});
