# Editable architecture definitions

These six YAML files are the **source of truth** for the Architecture Explorer:

- `meta.yaml` — model version and update date
- `applications.yaml` — application identity, role, and source configuration capabilities
- `capabilities.yaml` — named capabilities, each owned by exactly one application
- `sources.yaml` — example external entity classes and field-to-meaning mappings
- `workflows.yaml` — workflow steps referring to canonical capability IDs and endpoint IDs
- `endpoints.yaml` — reusable HTTP API contracts

## How to make a change

Edit the relevant YAML file in GitHub or locally; commit to `main`.
The GitHub Pages workflow checks every YAML file, validates IDs, capability ownership, workflow steps, and mapping targets, then **generates `data/architecture.json`** and publishes the site.

The checked-in `data/architecture.json` is an existing snapshot for convenience and is **not** the authoritative source. The Pages build replaces it from YAML before publication. Do not edit the snapshot to change the architecture.

Local validation (requires Python 3 and `PyYAML==6.0.2`):

```sh
python scripts/build_architecture.py --check
python scripts/build_architecture.py
```

## Governance and data accuracy

- A workflow step refers to `capability: <ID>`; it must not duplicate the capability name or description.
- Each capability has one `provider`, which must be a registered application.
- Each endpoint has one `owner`.
- Example source fields are illustrative, **not** assertions of active production integrations. Retain the `status: "example"` field.
- Planned workflows are explicitly marked `status: "planned"`. Unverified endpoint contracts remain unspecified.
- Keep hostnames, credentials, personal data, connection strings and other confidential operational information out of this public repository.

The renderer and YAML can be updated separately; a website improvement should not rewrite files in this directory.

## Preview YAML changes in the helicopter map

Open the published **Landscape** page. The right-side **Architecture scripts** panel loads these six YAML files directly from the deployed website.

1. Choose a definition file and edit its text.
2. The panel validates the combined YAML after each edit, including IDs, capability ownership, workflow steps, endpoint references and external mapping destinations.
3. Valid edits immediately update the helicopter diagram; invalid edits display the error without changing the last valid map.
4. Switch files to preview changes across definitions. Drafts remain available during the current browser session while the page is open; the panel does not store or upload them.
5. Select **Review & save to GitHub** to review the changed YAML files, then connect a GitHub fine-grained personal access token and confirm the commit.
6. GitHub Actions validates and publishes the updated site. You can also copy/download a draft, or use **Edit on GitHub**.

### Authorised GitHub saving

The Explorer is hosted on **public static GitHub Pages**, so it has no private server to handle OAuth. For direct saving, you must explicitly provide a fine-grained personal access token in the editor with access to **only** `kingcheesezombie/OneVision.Architecture` and repository permission **Contents: Read and write** (choose a short expiry). The token is held in JavaScript memory only while the tab is open; it is not saved to files, cookies, localStorage, URLs, or YAML. Disconnect or close the tab to stop using it, and revoke the token in GitHub Settings when it is no longer needed. Never send the token through ChatGPT.

The editor validates all six YAML files and displays a review of the changed filenames. After confirmation, it checks the latest remote contents against the originally loaded definitions, creates **one atomic commit** with only the changed YAML files, and updates `main` without force-pushing. If another editor changed one of those files, saving stops and your drafts remain available for reconciliation. Repository permissions and branch protection still apply.

**Security:** This is suitable for a personal, explicitly authorised editing session, not unattended automated authentication. Prefer a GitHub App/OAuth server-side integration if this becomes a multi-user tool. The YAML parser is bundled locally at build time; the website no longer loads a third-party parser directly at runtime.

The browser's cross-reference validation is a preview check, not the publishing authority: the Python validator in GitHub Actions remains authoritative. A commit could still fail CI validation; watch the workflow run. Do not commit confidential or personally identifiable information to the public architecture repository.
