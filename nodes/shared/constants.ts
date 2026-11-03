/** Every route of the shared integration API Artilo serves to Zapier and n8n. */
export const API_PREFIX = '/api/v1/integrations/connectors';

export const CREDENTIAL_NAME = 'artiloApi';

export const SIGNATURE_HEADER = 'x-artilo-signature';
export const SIGNATURE_VERSION = 'v1';
/** An event signed longer ago than this is refused as a possible replay. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
