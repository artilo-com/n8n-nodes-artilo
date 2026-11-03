import type { FieldType, ResourceMapperField } from 'n8n-workflow';

/** A lead field as `GET /leads/fields` describes it. */
export interface ArtiloLeadField {
	key: string;
	label: string;
	type: string;
	required: boolean;
	readOnly: boolean;
	choices?: Array<{ id: string; label: string }> | null;
}

/** Artilo field types as n8n names them. Anything new reads as text. */
const N8N_TYPES: Record<string, FieldType> = {
	string: 'string',
	number: 'number',
	boolean: 'boolean',
	datetime: 'dateTime',
};

/**
 * A writable lead field in the mapping form. Its id is Artilo's stable key
 * (`first_name`, `custom_<definitionId>`), so renaming a field in Artilo never
 * breaks a mapping. Owners, statuses and select options are dropdowns.
 */
export const toMappingField = (field: ArtiloLeadField): ResourceMapperField => {
	const choices = Array.isArray(field.choices) ? field.choices : null;
	return {
		id: field.key,
		displayName: field.label,
		required: Boolean(field.required),
		defaultMatch: false,
		canBeUsedToMatch: false,
		display: true,
		type: choices ? 'options' : (N8N_TYPES[field.type] ?? 'string'),
		...(choices && {
			options: choices.map((choice) => ({ name: choice.label, value: choice.id })),
		}),
	};
};

export const toMappingFields = (fields: ArtiloLeadField[]): ResourceMapperField[] =>
	fields.filter((field) => !field.readOnly).map(toMappingField);
