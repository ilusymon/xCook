"""Rebuild the heading font after changing UI copy; requires fontTools with Brotli."""
import base64
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

design = Path(__file__).resolve().parent
app = design.parents[1] / "miniprogram"
characters = set()
for pattern in ("*.wxml", "*.js"):
    for source in app.rglob(pattern):
        if not {"node_modules", "miniprogram_npm", "tests"}.intersection(source.parts):
            characters.update(source.read_text(encoding="utf-8"))
text = design / "sources/font-characters.txt"
text.write_text("".join(sorted(characters)), encoding="utf-8")
original = design / "sources/ZCOOLKuaiLe-Regular.ttf"
output = design / "sources/XCookHand.woff2"
subprocess.run([sys.executable, "-m", "fontTools.subset", str(original),
                "--text-file=" + str(text), "--flavor=woff2", "--output-file=" + str(output)], check=True)
with TTFont(original) as full, TTFont(output) as subset:
    required = {ord(char) for char in characters}.intersection(full.getBestCmap())
    assert required.issubset(subset.getBestCmap()), "The subset lost UI glyphs"
data = base64.b64encode(output.read_bytes()).decode("ascii")
css = "/* ZCOOL KuaiLe subset; license: /fonts/OFL-ZCOOL.txt. */\n"
css += "@font-face { font-family: 'XCookHand'; src: url('data:font/woff2;base64," + data
css += "') format('woff2'); font-weight: normal; font-style: normal; }\n"
assert len(css.encode("utf-8")) < 128 * 1024, "Check the font against the main-package budget"
(app / "styles/cartoon-font.wxss").write_text(css, encoding="utf-8")
print(f"Heading font: {len(characters)} characters, {output.stat().st_size} bytes")
