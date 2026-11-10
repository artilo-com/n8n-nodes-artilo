import { toDecimal } from './money';
import { isBlank } from './record-write';

/** A product line as the node's Product Lines parameter holds it. */
export interface ProductLineInput {
	productId?: unknown;
	quantity?: unknown;
	unitPrice?: unknown;
	discountType?: unknown;
	discount?: unknown;
}

/** An active product as `GET /products/choices` lists it, its price in minor units. */
export interface ProductChoice {
	id: string;
	label: string;
	sku?: string | null;
	unit_price: number;
	currency: string;
}

const LINE_KEYS: Array<[keyof ProductLineInput, string]> = [
	['productId', 'product_id'],
	['quantity', 'quantity'],
	['unitPrice', 'unit_price'],
	['discountType', 'discount_type'],
	['discount', 'discount'],
];

/** A resource locator holds `{ mode, value }`; an expression may give the ID itself. */
const productIdOf = (productId: unknown): unknown =>
	typeof productId === 'object' && productId !== null && 'value' in productId
		? (productId as { value: unknown }).value
		: productId;

/**
 * A deal's product lines as Artilo reads them. Values are sent as mapped:
 * Artilo reads numbers written as text and refuses anything else, so a
 * mistyped price fails the item instead of saving the product's own price. A
 * blank takes Artilo's default (quantity 1, the product's price, no
 * discount), and a line with nothing in it is left out.
 */
export const toProductLines = (lines: unknown): Array<Record<string, unknown>> => {
	if (!Array.isArray(lines)) {
		return [];
	}
	return lines
		.map((input: ProductLineInput) => ({ ...input, productId: productIdOf(input?.productId) }))
		.map((line) =>
			Object.fromEntries(
				LINE_KEYS.filter(([inputKey]) => !isBlank(line[inputKey])).map(([inputKey, apiKey]) => [
					apiKey,
					line[inputKey],
				]),
			),
		)
		.filter((line) => Object.keys(line).length > 0);
};

/** "Website audit (WEB-01), 499 USD", with the price in the currency's own units. */
export const productLabel = (product: ProductChoice): string => {
	const sku = product.sku ? ` (${product.sku})` : '';
	return `${product.label}${sku}, ${toDecimal(product.unit_price, product.currency)} ${product.currency}`;
};
