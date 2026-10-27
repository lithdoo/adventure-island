"""Resource name rules. Fixtures are constructed strings, not client files."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
import unicodedata
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


class ResourceNameTest(unittest.TestCase):
    def test_rejects_whitespace_device_names_and_separators(self):
        cases = {
            "backDefault ": "trailing_whitespace",
            " rise": "leading_whitespace",
            "CON": "reserved_device_name",
            "Con.2000000": "reserved_device_name",
            "a:b": "illegal_character",
            ".": "leading_dot",
            ":": "illegal_character",
        }
        for value, reason in cases.items():
            self.assertFalse(convert_cms.valid_segment(value), value)
            self.assertEqual(convert_cms.segment_issue(value), reason)

    def test_nfc_conflict_is_not_silently_renamed(self):
        composed = "caf\u00e9"
        decomposed = "cafe\u0301"
        self.assertEqual(unicodedata.normalize("NFC", decomposed), composed)
        self.assertTrue(convert_cms.valid_segment(composed))
        self.assertEqual(convert_cms.segment_issue(decomposed), "not_nfc")
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            self.assertTrue(store.write_struct("Fixture", composed, {"n": 1}))
            self.assertFalse(store.write_struct("Fixture", decomposed, {"n": 2}))
            names = [path.name for path in (Path(tmp) / "[struct]Fixture").iterdir()]
            self.assertEqual(names, [composed + ".json"])

    def test_invalid_resource_is_not_trimmed_into_a_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (1, 2, 3, 4))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            self.assertIsNone(store.write_png(["Fixture", "frame "], image, digest))
            self.assertEqual(list(Path(tmp).rglob("*.png")), [])

    def test_current_different_extensions_share_a_logical_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (9, 8, 7, 6))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            self.assertEqual(store.write_png(["Fixture", "mark"], image, digest), "Fixture/mark")
            self.assertEqual(store.write_sound(["Fixture", "mark"], b"synthetic-tone", "wav"), "Fixture/mark")
            self.assertEqual([row["error"] for row in store.errors], ["hash-collision"])
            files = list(Path(tmp).rglob("mark.*"))
            self.assertEqual([path.suffix for path in files], [".png"])

    def test_repair_extension_conflict_has_its_own_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (9, 8, 7, 6))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            store.write_png(["Fixture", "mark"], image, digest)
            store.write_sound(["Fixture", "mark"], b"synthetic-tone", "wav")
            self.assertIn("extension-conflict", [row["error"] for row in store.errors])

    def test_logged_invalid_paths_are_sixty_five_unresolved_names(self):
        payload = json.loads((ROOT / "result" / "64-wz-fsdb-invalid-paths.json").read_text(encoding="utf-8"))
        rows = payload["paths"]
        self.assertEqual(len(rows), 65)
        self.assertEqual(payload["count"], 65)
        for row in rows:
            self.assertIsNone(row["proposed_key"])
            self.assertEqual(row["status"], "unresolved")
            self.assertTrue(row["bad_segments"])
            self.assertEqual(convert_cms.segment_issue(row["bad_segments"][0]), row["reason"])
            for part in row["source_path"].split("/"):
                if convert_cms.segment_issue(part):
                    break
            else:
                self.fail(row["source_path"])


if __name__ == "__main__":
    unittest.main()
