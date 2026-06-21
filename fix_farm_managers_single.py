import re
import pathlib

ROOT = pathlib.Path("app/dashboard")

PATTERN = re.compile(
    r"(\.from\(\s*['\"]farm_managers['\"]\s*\)"
    r"(?:[^;]*?)"
    r"\.eq\(\s*['\"]user_id['\"][^)]*\)\s*)"
    r"\.single\(\)",
    re.DOTALL,
)

changed_files = []

for path in ROOT.rglob("*.tsx"):
    text = path.read_text(encoding="utf-8")
    new_text, n = PATTERN.subn(r"\1.maybeSingle()", text)
    if n:
        path.write_text(new_text, encoding="utf-8")
        changed_files.append((str(path), n))

for path in ROOT.rglob("*.ts"):
    text = path.read_text(encoding="utf-8")
    new_text, n = PATTERN.subn(r"\1.maybeSingle()", text)
    if n:
        path.write_text(new_text, encoding="utf-8")
        changed_files.append((str(path), n))

if changed_files:
    print(f"Updated {len(changed_files)} file(s):")
    for f, n in changed_files:
        print(f"  {f}  ({n} replacement{'s' if n > 1 else ''})")
else:
    print("No matching patterns found - nothing changed.")
