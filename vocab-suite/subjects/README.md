# Subjects Folder (`0` Built-In Subjects by Default)

The suite ships with **0 pre-loaded subjects** (`BUILT_IN_SUBJECTS = []` in `./index.js`) so you have complete control over your own curriculum.

## Recommended Way: Upload `<Subject>.zip` in the Browser
Drop any `.zip` file (e.g. `AP Lang.zip`) onto the Suite Hub:
- `.zip` filename → **Subject Name**
- Optional subfolder → **Unit Name** (`Unit 1 Rhetoric/Tones Vocab.txt`)
- `.txt` filename → **Topic Name** (`Tones Vocab.txt`)
- Multiple valid answers separated by `-` dashes: `Acerbic - Caustic - Biting : Sharp and harsh in tone` (use `\-` for literal hyphens)
- Optional explanations written as Java comments: `// explanation` or `/* multi-line explanation */`

## Optional Way: Commit Static `.js` Subject Modules to GitHub Pages
Use **Subject Lab → Export .js Module** to export a `<slug>.subject.js` file, place it in `subjects/`, and register it in `subjects/index.js`.
