import yaml

import pytest

from prawko_analytics.contract import ContractError, load_contract
from prawko_analytics.paths import CONTRACT_PATH


def test_contract_matches_catalog():
    contract = load_contract()
    assert contract.version == 2
    assert contract.primary_analysis_key == "app_user_id"
    assert "first_start_shown" in contract.catalog_keys
    assert contract.recommendations_enabled is False
    assert contract.changes == ()
    assert contract.acquisition_mix == "asa-installation-v1"


def test_unknown_event_is_rejected(tmp_path):
    raw = yaml.safe_load(CONTRACT_PATH.read_text())
    raw["events"]["not_a_real_event"] = raw["events"]["first_start_shown"]
    path = tmp_path / "contract.yaml"
    path.write_text(yaml.safe_dump(raw))
    with pytest.raises(ContractError, match="not_a_real_event"):
        load_contract(path)


def test_tied_interpretations_are_rejected(tmp_path):
    raw = yaml.safe_load(CONTRACT_PATH.read_text())
    duplicate = dict(raw["events"]["first_start_shown"]["interpretations"][0])
    duplicate["id"] = "legacy_spotlight_copy"
    raw["events"]["first_start_shown"]["interpretations"].append(duplicate)
    path = tmp_path / "contract.yaml"
    path.write_text(yaml.safe_dump(raw))
    with pytest.raises(ContractError, match="equal specificity"):
        load_contract(path)
