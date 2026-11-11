import json
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def main():
    DIST.mkdir(exist_ok=True)
    manifest = json.loads((ROOT / "eagle/manifest.json").read_text())
    assert (ROOT / "eagle/logo.png").is_file()
    notices = ["LICENSE", "THIRD_PARTY_NOTICES.md"]
    package = DIST / f"magpie-agent-eagle-{manifest['version']}.eagleplugin"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted((ROOT / "eagle").iterdir()):
            assert file.is_file(), f"Unexpected directory in Eagle runtime: {file}"
            archive.write(file, file.name)
        for name in notices:
            archive.write(ROOT / name, name)
    with zipfile.ZipFile(package) as archive:
        assert archive.testzip() is None
    package_json = json.loads((ROOT / "package.json").read_text())
    target = DIST / f"{package_json['name']}-{package_json['version']}.tgz"
    with tarfile.open(target, "w:gz") as archive:
        for name in ["package.json", package_json["magpie"]["agent"], "README.md", *notices]:
            archive.add(ROOT / name, arcname=str(Path("package") / name))
    print(package)
    print(target)


if __name__ == "__main__":
    main()
