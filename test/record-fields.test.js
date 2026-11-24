const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toMappingFields } = require('../dist/nodes/shared/record-fields');

test('maps writable fields by their stable key, with dropdowns for choices', () => {
	const fields = toMappingFields([
		{ key: 'first_name', label: 'First Name', type: 'string', required: true, readOnly: false },
		{ key: 'custom_1', label: 'Budget', type: 'number', required: false, readOnly: false },
		{ key: 'custom_2', label: 'Closes', type: 'datetime', required: false, readOnly: false },
		{ key: 'custom_3', label: 'VIP', type: 'boolean', required: false, readOnly: false },
		{
			key: 'owner_id',
			label: 'Owner',
			type: 'string',
			required: false,
			readOnly: false,
			choices: [{ id: 'user-1', label: 'Dana' }],
		},
		{ key: 'url', label: 'Link', type: 'string', required: false, readOnly: true },
		{ key: 'custom_4', label: 'Future type', type: 'rating', required: false, readOnly: false },
	]);

	assert.deepEqual(
		fields.map((field) => [field.id, field.displayName, field.type, field.required]),
		[
			['first_name', 'First Name', 'string', true],
			['custom_1', 'Budget', 'number', false],
			['custom_2', 'Closes', 'dateTime', false],
			['custom_3', 'VIP', 'boolean', false],
			['owner_id', 'Owner', 'options', false],
			['custom_4', 'Future type', 'string', false],
		],
	);
	assert.deepEqual(fields[4].options, [{ name: 'Dana', value: 'user-1' }]);
	assert.ok(fields.every((field) => field.display && !field.canBeUsedToMatch));
});
