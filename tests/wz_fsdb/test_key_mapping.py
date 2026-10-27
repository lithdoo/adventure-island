"""Key mapping behavior and the 11 recorded collisions."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


class KeyMappingTest(unittest.TestCase):
    def test_current_duplicate_key_is_detected_and_later_record_dropped(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            self.assertTrue(store.write_struct("Look", "00000001", {"source": "alpha"}))
            self.assertFalse(store.write_struct("Look", "00000001", {"source": "beta"}))
            self.assertEqual(store.collisions, [{"table": "Look", "key": "00000001"}])
            written = json.loads((Path(tmp) / "[struct]Look" / "00000001.json").read_text(encoding="utf-8"))
            self.assertEqual(written["source"], "alpha")
            self.assertNotIn("beta", json.dumps(written))

    def test_repair_duplicate_key_preserves_both_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            store.write_struct("Look", "00000001", {"source": "alpha"})
            store.write_struct("Look", "00000001", {"source": "beta"})
            folder = Path(tmp) / "[struct]Look"
            bodies = [json.loads(path.read_text(encoding="utf-8")) for path in folder.glob("*.json")]
            sources = {body.get("source") for body in bodies}
            self.assertEqual(sources, {"alpha", "beta"})
            self.assertEqual(store.stats["keyCollisions"], 0)

    def test_device_name_string_key_falls_back_to_the_leaf(self):
        key, reason = convert_cms.string_record_key(("Con", "2000000"), set())
        self.assertEqual((key, reason), ("2000000", "device_fallback"))

    def test_current_string_key_keeps_a_dotted_trail(self):
        key, reason = convert_cms.string_record_key(("Eqp", "Cap", "1003233"), set())
        self.assertEqual((key, reason), ("Eqp.Cap.1003233", "ok"))

    def test_repair_quest_tables_follow_design(self):
        expected = {
            "Act": "QuestAct",
            "Check": "QuestCheck",
            "QuestInfo": "QuestQuestInfo",
            "Say": "QuestSay",
            "Exclusive": "QuestExclusive",
            "PQuest": "QuestPQuest",
        }
        for stem, table in expected.items():
            self.assertEqual(convert_cms.quest_table(stem), table)

    def test_logged_collisions_cover_eleven_real_keys(self):
        payload = json.loads((ROOT / "result" / "64-wz-fsdb-key-collisions.json").read_text(encoding="utf-8"))
        rows = payload["collisions"]
        self.assertEqual(len(rows), 11)
        counts = {}
        for row in rows:
            counts[row["table"]] = counts.get(row["table"], 0) + 1
            self.assertGreaterEqual(len(row["sources"]), 2)
            self.assertEqual(row["current_behavior"], "later_record_dropped")
            self.assertEqual(row["required_behavior"], "preserve_all_sources")
            self.assertNotIn("record", row)
        self.assertEqual(counts, {"Look": 5, "Item": 2, "MapEffect": 4})


if __name__ == "__main__":
    unittest.main()
