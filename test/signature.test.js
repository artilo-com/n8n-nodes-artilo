const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { checkSignature } = require('../dist/nodes/shared/signature');

const SECRET = 'a'.repeat(64);
const BODY = '{"id":"event-1","first_name":"Jane"}';
const NOW = 1700000000;

const headerFor = (secret, timestamp, body) =>
	`t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

test('accepts an event signed with one of the trigger secrets', () => {
	assert.equal(checkSignature(headerFor(SECRET, NOW, BODY), BODY, ['other', SECRET], NOW), 'valid');
});

test('refuses an event with no signature', () => {
	assert.equal(checkSignature(undefined, BODY, [SECRET], NOW), 'missing');
});

test('refuses a changed body, a wrong secret and a malformed header', () => {
	const header = headerFor(SECRET, NOW, BODY);
	assert.equal(checkSignature(header, BODY.replace('Jane', 'John'), [SECRET], NOW), 'invalid');
	assert.equal(checkSignature(headerFor('b'.repeat(64), NOW, BODY), BODY, [SECRET], NOW), 'invalid');
	assert.equal(checkSignature('v1=abc', BODY, [SECRET], NOW), 'invalid');
	assert.equal(checkSignature(`t=${NOW},v1=zz`, BODY, [SECRET], NOW), 'invalid');
});

test('refuses everything when the trigger has no subscription yet', () => {
	assert.equal(checkSignature(headerFor(SECRET, NOW, BODY), BODY, [], NOW), 'invalid');
});

test('refuses a genuine event replayed more than five minutes later', () => {
	const header = headerFor(SECRET, NOW, BODY);
	assert.equal(checkSignature(header, BODY, [SECRET], NOW + 300), 'valid');
	assert.equal(checkSignature(header, BODY, [SECRET], NOW + 301), 'expired');
});
