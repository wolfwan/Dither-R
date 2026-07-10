# Sample SVGs

Test fixtures for the island-detection and bridging pipeline.

- `letter_O.svg` — included. Ring with a hole, no island. Good smoke test for
  svg_parser + fill-rule handling before islands.py exists.

Still needed (create with any vector tool, or ask Claude Code to generate simple
placeholder versions):

- `letter_A.svg` — one triangular island (the counter)
- `letter_B.svg` — two islands (upper and lower counters)
- `letter_at.svg` — nested islands, tests containment depth > 2
- `logo_text.svg` — multiple independent glyphs/field regions in one file
