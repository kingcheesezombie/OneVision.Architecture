#!/usr/bin/env python3
"""Build OneVision's published architecture catalogue from editable YAML definitions.

Source of truth: architecture/*.yaml
Generated output: data/architecture.json (written by CI before Pages upload)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent.parent
PARTS = (
    ("meta.yaml", ("version", "updated")),
    ("applications.yaml", ("applications",)),
    ("capabilities.yaml", ("capabilities",)),
    ("sources.yaml", ("externalMappings",)),
    ("workflows.yaml", ("workflows",)),
    ("endpoints.yaml", ("endpoints",)),
)


class UniqueKeyLoader(yaml.SafeLoader):
    """Reject accidental duplicate YAML keys rather than silently overriding them."""


def construct_mapping(loader: UniqueKeyLoader, node: yaml.MappingNode, deep: bool = False) -> dict:
    result: dict = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str):
            raise ValueError(f"Non-string YAML key: {key!r}")
        if key in result:
            raise ValueError(f"Duplicate YAML key: {key}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def indexed(records: Any, name: str) -> dict[str, dict]:
    require(isinstance(records, list), f"{name} must be a YAML list")
    index: dict[str, dict] = {}
    for i, record in enumerate(records):
        require(isinstance(record, dict), f"{name}[{i}] must be a mapping")
        identifier = record.get("id")
        require(isinstance(identifier, str) and bool(identifier.strip()), f"{name}[{i}] missing id")
        require(identifier not in index, f"Duplicate {name} id: {identifier}")
        index[identifier] = record
    return index


def build(directory: Path) -> dict:
    model: dict = {}
    for filename, expected_keys in PARTS:
        path = directory / filename
        require(path.is_file(), f"Missing source file: {path}")
        with path.open("r", encoding="utf-8") as stream:
            source = yaml.load(stream, Loader=UniqueKeyLoader)
        require(isinstance(source, dict), f"{filename} must contain a YAML mapping")
        require(set(source) == set(expected_keys),
                f"{filename}: expected exactly {', '.join(expected_keys)}; found {', '.join(source)}")
        model.update({key: source[key] for key in expected_keys})

    require(isinstance(model["version"], str), "version must be a string")
    require(isinstance(model["updated"], str), "updated must be a quoted ISO date string")
    applications = indexed(model["applications"], "applications")
    capabilities = indexed(model["capabilities"], "capabilities")
    endpoints = indexed(model["endpoints"], "endpoints")
    workflows = indexed(model["workflows"], "workflows")
    sources = indexed(model["externalMappings"], "externalMappings")

    for id_, capability in capabilities.items():
        require(capability.get("provider") in applications,
                f"Capability {id_} has unknown owner {capability.get('provider')}")
    for id_, endpoint in endpoints.items():
        require(endpoint.get("owner") in applications,
                f"Endpoint {id_} has unknown owner {endpoint.get('owner')}")
        require(endpoint.get("method") in {"GET", "POST", "PUT", "PATCH", "DELETE"},
                f"Endpoint {id_} has invalid HTTP method")
        require(str(endpoint.get("path", "")).startswith("/"), f"Endpoint {id_} must use a relative API path")

    for id_, workflow in workflows.items():
        steps = workflow.get("steps")
        require(isinstance(steps, list) and bool(steps), f"Workflow {id_} needs steps")
        participants = workflow.get("participants")
        require(isinstance(participants, list), f"Workflow {id_} needs participants")
        step_ids = indexed(steps, f"workflow {id_} steps")
        owners: set[str] = set()
        for step_id, step in step_ids.items():
            capability_id = step.get("capability")
            require(capability_id in capabilities,
                    f"Workflow {id_} step {step_id} references unknown capability {capability_id}")
            require("description" not in step and "name" not in step,
                    f"Workflow {id_} step {step_id} must reuse canonical capability name/description")
            owners.add(capabilities[capability_id]["provider"])
            for next_id in step.get("next", []):
                require(next_id in step_ids, f"Workflow {id_}: unknown next step {next_id}")
            connection = step.get("connection", {})
            require(isinstance(connection, dict), f"Workflow {id_} step {step_id}: invalid connection")
            require(connection.get("kind", "unspecified") in
                    {"api", "api-handler", "internal", "unspecified"},
                    f"Workflow {id_} step {step_id}: unknown connection kind")
            for endpoint_id in connection.get("endpointIds", []):
                require(endpoint_id in endpoints,
                        f"Workflow {id_} step {step_id}: unknown endpoint {endpoint_id}")
        require(set(participants) == owners,
                f"Workflow {id_}: participants {participants} do not match step owners {sorted(owners)}")

    for id_, source in sources.items():
        app_id, cap_id = source.get("targetApp"), source.get("targetCapability")
        require(app_id in applications, f"External mapping {id_}: unknown application {app_id}")
        require(cap_id in capabilities, f"External mapping {id_}: unknown capability {cap_id}")
        require(capabilities[cap_id]["provider"] == app_id,
                f"External mapping {id_}: capability {cap_id} does not belong to {app_id}")
        require(source.get("status") == "example",
                f"External mapping {id_}: source examples must be labelled example")
        require(isinstance(source.get("fields"), list) and bool(source["fields"]),
                f"External mapping {id_}: field mapping examples required")
        for field in source["fields"]:
            require(isinstance(field, list) and len(field) == 2,
                    f"External mapping {id_}: fields must be [externalField, targetMeaning] pairs")
    return model


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "architecture")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "architecture.json")
    parser.add_argument("--check", action="store_true", help="Validate YAML and references without modifying JSON")
    args = parser.parse_args()
    model = build(args.source)
    if args.check:
        print(f"Valid YAML: {len(model['applications'])} applications, "
              f"{len(model['capabilities'])} capabilities, "
              f"{len(model['workflows'])} workflows, "
              f"{len(model['externalMappings'])} mapping examples, "
              f"{len(model['endpoints'])} API endpoints")
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(model, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {args.output} from architecture/*.yaml")


if __name__ == "__main__":
    main()
