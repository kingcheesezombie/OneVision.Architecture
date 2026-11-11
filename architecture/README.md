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
5. Use **Copy YAML** or **Download YAML** to retain changes, or **Edit on GitHub** to commit the equivalent changes to the repository.

**Important:** This is an in-browser, uncommitted **preview**, not a GitHub editor. It does not have repository-write permissions. Committing on GitHub triggers the normal CI validation and website deployment. The browser preview validates the key cross-references but the Python compiler remains the publishing authority. Do not paste secrets or personal data into this public architecture model.
