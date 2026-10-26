"""Marks every acceptance criterion of the given ticket numbers as done in docs/03-tickets.md."""
import pathlib
import re
import sys

path = pathlib.Path(__file__).resolve().parent.parent / "docs" / "03-tickets.md"
text = path.read_text()
parts = re.split(r"(?m)^(?=# \d\d: )", text)
wanted = {n.zfill(2) for n in sys.argv[1:]}
for i, part in enumerate(parts):
    if part[2:4] in wanted and part.startswith("# "):
        parts[i] = part.replace("- [ ] ", "- [x] ")
path.write_text("".join(parts))
