# Educational Vocab Games Suite — Krillion (`Kev-0.6B`) + Unlimited Multi-Answer Vocab Wordle

A modular, zero-build **Educational Vocabulary Games Suite** engineered for out-of-the-box **`github.io` (GitHub Pages)** deployment and **Google Drive** subject `.zip` sharing.

Upload a single `<Subject>.zip` archive (e.g. `AP Lang.zip`) containing Topic `.txt` files (with optional Unit subfolders, `-`-separated multiple valid answers, and Java code comment `//` or `/* */` explanations) and play across **two complementary games**:

---

## 1. Two Games Sharing One Subject Bank

### 🌊 Game 1: Krillion (`Kev-0.6B` 3-Pass AI Edition)
- **Random Krillion Dives**: Randomly samples stored terms & definitions across your enabled Subjects, Units, and Topics (`Show Term → Type Definition`, `Show Definition → Type Term`, or `Mixed`).
- **Speed-Based Ocean Depth**: Freeze the clock on `Enter` to earn up to **1,000 m per round** (**7,000 m** across 7 rounds) from the Sunlight Zone down to the Hadal Trench.
- **3-Pass `onnx-community/kev-0.6b-ONNX` Browser Classifier**: Runs 3 independent passes (Semantic `noul`, Entailment `choice`, and Position-Debiased Reversed Rubric) in a dedicated Web Worker and compares their averaged calibrated probability against a configurable threshold — crediting **any** `-`-separated valid answer.
- **Stored Real Answer & `//` Explanation Always Shown**: Every round reveal (correct, timeout, incorrect, or give up) prominently displays the exact stored answer(s) and optional Java-comment explanation.
- **🏳️ "Give Up" Remaining-Time Study Lock**: Clicking **Give Up** reveals the stored answer immediately and locks progression to the next question for the **remaining time** on the round clock so the reader studies the real answer.

### 🟩 Game 2: Unlimited Multi-Answer Vocab Wordle
- **Zero AI-Assisted Correction**: Pure deterministic Wordle letter evaluation (`correct`, `present`, `absent`).
- **Unlimited Tries**: Keep refining your recall with no 6-row cap.
- **Simultaneous Multi-Answer Boards**: When a vocabulary entry defines multiple valid `-` answers (e.g. `Acerbic - Caustic - Biting`), all valid answer boards appear side-by-side so you can work on multiple answers at once — **finding any single valid answer wins the question!**
- **⏭ Skip with Dynamic Length-Scaled Cooldown**: Skipping reveals all stored valid answers + optional `//` explanation and locks **Next Vocab Word →** for a dynamic study cooldown scaled to the length of the answer and explanation.

---

## 2. Subject `.zip` & Topic `.txt` Specification

Also available interactively inside the app via **📖 Creator Spec** in the top navigation bar!

### Folder Layout Inside `<Subject>.zip`

```text
AP Lang.zip                     <-- Subject Name = "AP Lang"
├── Unit 1 Rhetoric/            <-- Optional Unit Folder = "Unit 1 Rhetoric"
│   ├── Tones Vocab.txt         <-- Topic = "Tones Vocab"
│   └── Appeals & Syntax.txt    <-- Topic = "Appeals & Syntax"
└── Unit 2 Fallacies/           <-- Optional Unit Folder = "Unit 2 Fallacies"
    └── Logical Fallacies.txt   <-- Topic = "Logical Fallacies"
```
*(Flat `.zip` archives with `.txt` files at the root — no Unit folders — are equally supported.)*

### Topic `.txt` Syntax (`-` Multi-Answers & Java Comment Explanations)

```java
// Optional Java line or block comments attach as end-of-question explanations!

Acerbic - Caustic - Biting : Sharp, harsh, and cutting in tone // Common in satirical AP Lang passages.

/* Multi-line Java block comments also work!
   Great for etymology, historical context, or common exam traps. */
Didactic - Preachy : Intended to teach or instruct, especially with heavy moralizing

Half\-Life : Time required for half of a radioactive sample to decay // Escape literal hyphens with \-
```

---

## 3. Small-File Modularity & `github.io` Deployment

Every source file in this repository is `< 20 KB` (`<< 25 MB` GitHub web upload limit), uses relative paths (`./...`), and includes `.nojekyll`:
1. Upload the unwrapped files to any GitHub repository (or `<username>.github.io`).
2. Enable **Settings → Pages → Deploy from a branch (`main` / root)**.
3. Open `https://<username>.github.io/<repo>/` and drop any `<Subject>.zip` archive onto the Suite Hub!

---

## Deployment notes (added for GitHub Pages)

This folder is the upstream suite, unmodified, plus a thin deployment layer.

| File | Purpose |
| --- | --- |
| `styles/10-mobile.css` | Small-screen layout: single-row HUD, Creator Spec width, Wordle tiles/keyboard, modal + spec code blocks, warm-up error banner. |
| `styles/11-icons.css` | Inline-SVG replacement glyphs (`.vs-icon.vs-i-*`). |
| `js/ui/icon-upgrade.js` | Swaps upstream emoji for the SVG glyphs at render time. |
| `js/mobile-boot.js` | Unregisters any stale service worker for this path and adds a 25 s fetch timeout so a stalled CDN fails visibly instead of hanging. |

Everything is relative-path and build-free — push the folder and it runs.

### Known limitation

Krillion's answer judge (`Kev-0.6B`) is fetched at first dive from
`cdn.jsdelivr.net` (~330 MB WebGPU / ~365 MB WASM). If that host is blocked the
dive shows a retry banner; Wordle and the subject importer are unaffected.
