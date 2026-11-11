# OneVision Architecture Explorer

Interactive documentation of the OneVision application landscape, inherent capabilities, functional workflows, API contracts and illustrative external entity mappings.

**Live site:** https://kingcheesezombie.github.io/OneVision.Architecture/

## Architecture-as-code

The authoritative, human-editable architecture definitions are maintained in [`architecture/`](architecture/README.md), as six YAML files:

| File | Defines |
|---|---|
| [applications.yaml](architecture/applications.yaml) | Applications and their source configuration capabilities |
| [capabilities.yaml](architecture/capabilities.yaml) | Canonical capabilities, with one owning provider each |
| [sources.yaml](architecture/sources.yaml) | Illustrative external entity classes and field mappings |
| [workflows.yaml](architecture/workflows.yaml) | Ordered steps that reference canonical capabilities and endpoints |
| [endpoints.yaml](architecture/endpoints.yaml) | Reusable API endpoint contracts |
| [meta.yaml](architecture/meta.yaml) | Catalogue version and updated date |

**Edit YAML, not `data/architecture.json`.** Every push to `main` triggers GitHub Actions to load the six YAML files, validate cross-references, generate the JSON consumed by the website, and publish GitHub Pages. The checked-in JSON is a legacy snapshot and is overwritten during the publish build; it is not authoritative.

The renderer (HTML, JavaScript and CSS) is maintained separately from `architecture/`. Website changes do not need to modify your definitions.

## Validate locally

Requires Python 3 and PyYAML 6.0.2:

```bash
python -m pip install PyYAML==6.0.2
python scripts/build_architecture.py --check
python scripts/build_architecture.py
```

The local second command refreshes the generated JSON snapshot. Normal authoring does not require running commands: edit YAML on GitHub and commit.

## Scope and safeguards

The explorer documents architecture, not live operational state. OneVision.UI is a cross-cutting design standard, not a data-integration provider. Planned relationships are distinguished from established workflows; examples in `sources.yaml` are not claims of verified live feeds.

The repository is public. Do not commit credentials, internal hostnames, patient/personnel records, confidential datasets or connection secrets.

To activate publishing in a fork, select **Settings → Pages → Build and deployment → GitHub Actions**.
