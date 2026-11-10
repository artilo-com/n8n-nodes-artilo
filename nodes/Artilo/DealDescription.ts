import type { INodeProperties } from 'n8n-workflow';
import { recordOperations, recordWriteFields } from './RecordDescription';

export const dealOperations: INodeProperties[] = [
	recordOperations('deal', 'Find a deal by its Artilo ID'),
];

const findFields: INodeProperties[] = [
	{
		displayName: 'Artilo ID',
		name: 'value',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['find'] } },
		description:
			'The Artilo ID of the deal. No match returns no items, so the branch stops unless Always Output Data is on in the node settings.',
	},
];

const productLines: INodeProperties = {
	displayName: 'Product Lines',
	name: 'productLines',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Product Line',
	default: {},
	displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
	description:
		'The products on the new deal. The lines are saved with the deal or not at all: a line Artilo refuses leaves no deal behind.',
	options: [
		{
			name: 'lines',
			displayName: 'Line',
			values: [
				{
					displayName: 'Discount',
					name: 'discount',
					type: 'number',
					typeOptions: { minValue: 0, numberPrecision: 0 },
					default: 0,
					description:
						"Taken once off the line. Flat: in the currency's smallest unit (500 for 5.00). Percentage: in basis points (1000 for 10%).",
				},
				{
					displayName: 'Discount Type',
					name: 'discountType',
					type: 'options',
					options: [
						{ name: 'Flat Amount (in Cents)', value: 'flat' },
						{ name: 'Percentage (Basis Points)', value: 'percentage' },
					],
					default: 'flat',
				},
				{
					displayName: 'Product',
					name: 'productId',
					type: 'resourceLocator',
					required: true,
					default: { mode: 'list', value: '' },
					description: 'An active product',
					modes: [
						{
							displayName: 'From List',
							name: 'list',
							type: 'list',
							typeOptions: { searchListMethod: 'searchProducts', searchable: false },
						},
						{
							displayName: 'By ID',
							name: 'id',
							type: 'string',
							placeholder: 'e.g. 550e8400-e29b-41d4-a716-446655440000',
						},
					],
				},
				{
					displayName: 'Quantity',
					name: 'quantity',
					type: 'number',
					typeOptions: { minValue: 1, numberPrecision: 0 },
					default: 1,
					description: 'Physical products must have it in stock',
				},
				{
					displayName: 'Unit Price (in Cents)',
					name: 'unitPrice',
					type: 'string',
					default: '',
					placeholder: '1250',
					description:
						"In the currency's smallest unit, as Artilo stores it: 1250 for 12.50 USD. Leave empty to use the product's price.",
				},
			],
		},
	],
};

export const dealFields: INodeProperties[] = [
	...findFields,
	...recordWriteFields('deal'),
	productLines,
];
