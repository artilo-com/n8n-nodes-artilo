const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productLabel, toProductLines } = require('../dist/nodes/shared/product-lines');

test('sends each line by the keys Artilo reads, without blanks', () => {
	assert.deepEqual(
		toProductLines([
			{ productId: 'p-1', quantity: 2, unitPrice: '', discountType: 'flat', discount: 0 },
			{
				productId: 'p-2',
				quantity: 1,
				unitPrice: '1250',
				discountType: 'percentage',
				discount: 1000,
			},
		]),
		[
			{ product_id: 'p-1', quantity: 2, discount_type: 'flat', discount: 0 },
			{
				product_id: 'p-2',
				quantity: 1,
				unit_price: '1250',
				discount_type: 'percentage',
				discount: 1000,
			},
		],
	);
});

test('keeps a mistyped price for Artilo to refuse, and drops empty lines', () => {
	assert.deepEqual(toProductLines([{ productId: 'p-1', unitPrice: 'abc' }, {}]), [
		{ product_id: 'p-1', unit_price: 'abc' },
	]);
	assert.deepEqual(toProductLines(undefined), []);
});

test('labels a product with its SKU and price in the currency units', () => {
	assert.equal(
		productLabel({
			id: 'p',
			label: 'Website audit',
			sku: 'WEB-01',
			unit_price: 49900,
			currency: 'USD',
		}),
		'Website audit (WEB-01), 499 USD',
	);
	assert.equal(
		productLabel({ id: 'p', label: 'Setup', sku: null, unit_price: 1000, currency: 'JPY' }),
		'Setup, 1000 JPY',
	);
});

test('reads the product ID from the list or ID mode of the product picker', () => {
	assert.deepEqual(
		toProductLines([
			{ productId: { __rl: true, mode: 'list', value: 'p-1' }, quantity: 1 },
			{ productId: { __rl: true, mode: 'id', value: '' }, quantity: 2 },
		]),
		[{ product_id: 'p-1', quantity: 1 }, { quantity: 2 }],
	);
});
