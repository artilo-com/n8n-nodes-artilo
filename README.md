# Artilo nodes for n8n

The n8n community node package for [Artilo](https://artilo.com) CRM (`n8n-nodes-artilo` on npm). It talks to Artilo's integration API, under `/api/v1/integrations/connectors`, authenticated with an Artilo key created for n8n.

| Node | Operation | What it does | Backend route |
| --- | --- | --- | --- |
| Credential | Artilo API | Key and Artilo URL, tested against `/me` | `GET /me` |
| Artilo Trigger | New Lead | A lead is created | `POST /subscriptions`, then signed events |
| Artilo Trigger | Lead Status Changed | A lead moves to another status, optionally into one status | same |
| Artilo Trigger | New Deal | A deal is created | same |
| Artilo Trigger | Deal Stage Changed | A deal moves to another stage, optionally into one stage | same |
| Artilo | Lead: Find | Finds a lead by Artilo ID or email. Never creates | `GET /leads/search` |
| Artilo | Lead: Create | Creates a lead | `POST /leads` |
| Artilo | Lead: Update | Updates a lead by Artilo ID | `PATCH /leads/:id` |

How it works:

- **Webhooks are managed for you.** Publishing a workflow with the Artilo Trigger subscribes its production webhook URL with Artilo, and unpublishing ends it. Publishing always subscribes again (Artilo returns the same subscription with a new secret), which also recovers one Artilo ended; an n8n restart keeps the stored subscription instead, so its secret never changes while events are arriving. Changing the event and publishing ends the old subscription. "Listen for test event" subscribes the separate test URL with its own static data, so testing never changes the live subscription. Each subscription is stored in the workflow's static data, by URL.
- **Every event is signed.** Artilo returns a secret per subscription and signs each event with `X-Artilo-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. The trigger checks it against the raw body before the workflow runs, and answers 401 to an event with a missing or wrong signature, or one signed more than 5 minutes ago.
- **Lead fields are dynamic.** Create and Update read `GET /leads/fields?action=create|update`, so custom fields show up without a new package version. Field ids are Artilo's stable keys (`first_name`, `custom_<definitionId>`), so renaming a field in Artilo never breaks a mapping. Owners, statuses and select options are dropdowns. Read-only fields are not offered.
- **Writes are idempotent.** Every write sends `{ requestId, values }`. Only non-blank values are sent; 0 and `false` are kept. Artilo answers 201 for a new lead and 200 when the same Request ID with the same values returns the lead already saved. An empty Request ID, Lead ID or search value stops the item before Artilo is called.
- **Money is converted.** Deal events carry `total_value` in the currency's minor units; the trigger turns it into a decimal (`12500.5` for USD 12,500.50), as the Zapier app does.
- **Errors** carry Artilo's own message, which says what to fix (a missing required field, an inactive owner, several leads with one email). 429 and 5xx ask to try again; turn on the node's Retry On Fail setting to retry automatically.

## Setup guide

### Before you start

- **Installing.** On self-hosted n8n, an n8n admin installs the package under Settings > Community Nodes > Install, with the name `n8n-nodes-artilo`. On n8n Cloud, the node is available once n8n has verified it.
- **A public webhook URL (self-hosted only).** Artilo sends trigger events to your n8n over the internet, so your n8n must be reachable at a public HTTPS address. Behind a reverse proxy, set `N8N_WEBHOOK_URL` (`WEBHOOK_URL` before n8n 2.35) to your public address, as described in [n8n's webhook URL setup](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/). Artilo refuses private and internal addresses.

### Connecting

1. In Artilo, an Owner or Admin opens Settings > Integrations > n8n and creates a key. The key is shown only once, so copy it then.
2. In n8n, add an Artilo node, create a new **Artilo API** credential and paste the key. Leave the Artilo URL as it is unless Artilo support gives you another one.
3. Save the credential. n8n checks the key with Artilo.

The key acts as the user who created it: workflows see and change only what that user may. Anyone who can use the credential in n8n can reach that data. If that user is removed, loses the Owner or Admin role, or the account is deactivated, the key is revoked for good. Create a new key, update the credential, then unpublish and publish again each workflow that uses the Artilo Trigger.

### Triggers

Pick the event on the Artilo Trigger. For Lead Status Changed and Deal Stage Changed you can pick one status or stage, or leave **Any**.

- Creating a lead starts New Lead only, not Lead Status Changed; creating a deal starts New Deal only. Saving the same status or stage again starts nothing. A to B and back to A starts it twice.
- Lead Status Changed includes changes made by hand and by Artilo workflows.
- Imports, bulk changes and restores do not start workflows. A lead converted to a client does not start New Lead.
- Events from before the workflow was published, or while it was unpublished, are never sent.
- An event carries `event_id`, `event_time`, `record_id` (the lead or deal), the record's fields with their current status or stage, and for a change the previous one (`previous_status_id` and `previous_status_name`, or `previous_stage` and `previous_stage_name`). Test and live events have the same fields.
- **Changes made through Zapier or n8n never start a Zapier or n8n workflow**, and neither do the Artilo workflow changes that follow them, even delayed ones. This stops two workflows from setting each other off. Put follow-up steps in the workflow that made the change instead of waiting for a second trigger.
- Artilo retries an event when your n8n can't be reached, times out, or answers 408, 429 or a 5xx error, so a workflow can rarely receive the same event twice. Any other answer, for example a 404 after the workflow was unpublished, is final. If repeating a later step would hurt, check `event_id` first (for example with n8n's Remove Duplicates node).
- Picking a status that no longer exists in Artilo fails with an error when the workflow is published. If the status or stage a published trigger filters on is deleted later, Artilo ends that subscription and the workflow stops receiving events: pick another one and publish the workflow again.
- "Listen for test event" waits for a real event, there is no sample data: while it listens, make the change in Artilo (create a lead, move a deal to another stage).

### Actions

- **Find Lead** looks up one lead by Artilo ID or email. Email matches in any case, ignoring spaces around it. Deleted and converted leads are never found. No match returns no items, so the branch stops there; turn on **Always Output Data** in the node's settings to continue with an empty item, then check for a Lead ID with an If node before Update Lead. Several leads with the same email stop the run with an error asking you to search by Artilo ID. Find never creates a lead.
- **Create Lead** always creates a new lead; it never updates another one.
- **Update Lead** changes only the fields you map, on the lead with that Artilo ID. A blank value keeps what the lead holds (clearing a field is not supported). Saving values the lead already has records nothing and runs no automation.
- **Request ID** is required on Create and Update. Map a stable ID of what the write comes from, such as the form submission or order ID, never a timestamp or a random value. When a run is retried or rerun, the same Request ID returns what Artilo already saved instead of writing twice. Two different submissions need two different Request IDs, even for the same email.
- **Testing Create or Update writes real data** to Artilo and can run your Artilo automations. Find and the trigger never change anything.
- Each input item is its own request: one item failing does not undo the others. Turn on Continue On Fail to keep going past a failed item.

### Examples

Import a file from `examples/` with **Import from File** in n8n, then pick your Artilo credential on each Artilo node. None of them contain keys or customer data.

1. `form-to-create-lead.json`: an n8n form creates a lead. The Request ID is built from the submission time and email, so a rerun of the same submission does not create a second lead.
2. `find-then-update-lead.json`: a webhook with an email and a new status finds the lead and updates it. The webhook uses Header Auth, so only callers that send your secret header can change a lead: create a Header Auth credential on it before you publish. Find has Always Output Data on, and an If node only runs Update Lead when a Lead ID came back.
3. `lead-status-changed-notification.json`: when a lead moves to a status, a message is posted to a chat webhook (replace the URL with your Slack or Teams incoming webhook).

## Developing

Node 22 or newer.

```sh
npm ci
npm run build   # n8n-node build, into dist/
npm run lint    # n8n's community node rules, the ones n8n Cloud verification checks
npm test        # builds, then the helper tests under test/ with node --test
npm run dev     # runs a local n8n with these nodes loaded and hot reload
```

To try it against a local backend, create a credential with the Artilo URL `http://localhost:3000` (plain http is accepted for localhost only) and an n8n key from your local Artilo. Triggers need Artilo to reach your n8n: expose it with a tunnel and set `N8N_WEBHOOK_URL` (`WEBHOOK_URL` before n8n 2.35) to the tunnel's HTTPS address.

### Releasing

Releases are published to npm by the `Publish` workflow (`.github/workflows/publish.yml`) through npm trusted publishing, so every version carries npm provenance and no npm token is stored in the repository.

1. Bump `version` in `package.json` (and `package-lock.json`, with `npm version <x.y.z> --no-git-tag-version`) and merge it to `main`.
2. Create a GitHub release with the tag `v<x.y.z>`, matching `package.json`. Publishing the release runs the workflow, which lints, tests, builds and publishes. A release marked as a pre-release is published under the `next` dist-tag, so `latest` keeps pointing at the last stable version.

npm only lets a repository become a package's trusted publisher once the package exists, so `0.1.0` was published by hand, without provenance. The first release from this workflow is therefore `0.1.1`, and that is the version to submit for n8n verification, which expects provenance.
