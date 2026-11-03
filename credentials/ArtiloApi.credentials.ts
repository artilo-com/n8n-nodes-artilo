import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';
import { BASE_URL_PATTERN } from '../nodes/shared/base-url';

const TRIMMED_BASE_URL = '$credentials.baseUrl.trim().replace(/\\/+$/, "")';

export class ArtiloApi implements ICredentialType {
	name = 'artiloApi';

	displayName = 'Artilo API';

	icon: Icon = {
		light: 'file:../nodes/Artilo/artilo.svg',
		dark: 'file:../nodes/Artilo/artilo.dark.svg',
	};

	documentationUrl =
		'https://github.com/OnlineJustice-com/n8n-nodes-artilo#connecting';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'An n8n key created in Artilo by an Owner or Admin under Settings > Integrations > n8n. It starts with art_n8n_ (crm_ for a key created before) and is shown only once, when it is created. Anyone who can use this credential can read and change the Artilo data the key allows.',
		},
		{
			displayName: 'Artilo URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.artilo.com',
			description:
				'The address of the Artilo API. Change it only if Artilo support gives you another one.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// The test uses the URL only when it is https, or http on localhost. Any
	// other value points at a host under .invalid, which never resolves, so a
	// mistyped http address never receives the key in clear text.
	test: ICredentialTestRequest = {
		request: {
			baseURL: `={{ ${BASE_URL_PATTERN}.test(${TRIMMED_BASE_URL}) ? ${TRIMMED_BASE_URL} : "https://the-artilo-url-must-start-with-https.invalid" }}/api/v1/integrations/connectors`,
			url: '/me',
			method: 'GET',
		},
	};
}
