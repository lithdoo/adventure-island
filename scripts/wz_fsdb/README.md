# WZ → FSDB converter

`convert_cms.py` is the CMS 079 converter used for the local validation. Importing it does not read a WZ archive or write an FSDB.

## Dependencies

Install the Python packages listed in `requirements.txt`. Pillow is enough for the synthetic tests. A real conversion also needs a local `wzpy` checkout; pass its parent directory with `--wzpy`. Do not copy that checkout into this repository. On the validation machine it lived under `.work/tools/wz-python`, which is gitignored.

## Synthetic tests

From the repository root:

```text
python -m unittest discover -s tests/wz_fsdb -v
```

These tests build their own nodes and files. They do not need a WZ archive. Tests named `test_repair_*` describe the repair target and currently fail. The other tests describe the converter as it behaves today.

## Conversion

```text
python scripts/wz_fsdb/convert_cms.py --scope phase1 --wz-root <wz-root> --wzpy <directory that contains the wzpy package> --out <fsdb-output>
```

`--wz-root` is the directory that contains `Base.wz`, `Character.wz`, and the other packages. `--out`, `--report-dir`, and `--pixel-log` must be outside tracked source, or in a gitignored directory. The summary does not record those absolute paths.

`--scope all` walks every package. `--only Map.wz,String.wz` limits the run. This handoff does not ask for another full conversion.
