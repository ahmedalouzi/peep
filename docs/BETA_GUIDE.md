# Peep Closed Beta — Participant Guide

> **Welcome, beta tester!** You're one of the first developers to use Peep. This guide gets you set up and tells you how to give feedback that actually shapes the product.

---

## 1. Getting Started

### System Requirements

| Platform | Minimum |
|----------|---------|
| macOS    | 12 Monterey (Apple Silicon or Intel) |
| Windows  | Windows 10 22H2 or later (64-bit) |
| RAM      | 8 GB (16 GB recommended) |
| Disk     | 500 MB free |

### Before You Install

Install whichever SDK you plan to use:

**Flutter:**
```bash
# Verify
flutter --version
# Expected: Flutter 3.22 or later
```

**React Native / Expo:**
```bash
# Verify Node.js
node --version  # 18+

# Verify npx
npx --version
```

### Installing Peep

1. Download the installer from the link in your beta invite email.
2. **macOS**: Open `Peep-x.x.x.dmg` → drag to Applications → right-click → Open (for unsigned app dialog).
3. **Windows**: Run `Peep-Setup-x.x.x.exe` → follow prompts.
4. Launch Peep. The onboarding wizard will guide you through the rest.

---

## 2. Connecting Your AI

Peep uses **your own API key** (BYOK). Your code is never sent to Peep's servers.

1. Open Settings (`Ctrl+,` / `⌘+,`)
2. Go to the **AI** tab.
3. Paste your OpenAI API key (`sk-...`).
4. (Optional) Change the model: `gpt-4o-mini` is recommended for speed, `gpt-4o` for quality.

> **Anthropic users:** Claude Sonnet / Haiku work too — paste your Anthropic key and select the model.

---

## 3. The Three Core Workflows

### 3.1 Open a Project → See it Running

1. Click **Open Project** in the sidebar or press `Ctrl+O`.
2. Select your Flutter or React Native project folder.
3. Peep auto-detects the platform and starts the preview.
4. The phone frame on the right shows your app live.

**Tip:** The app must be able to run as `flutter run -d web` or `npx expo start --web`. Web target is required for preview.

### 3.2 Prompt → AI Edits → Preview

1. Type in the AI chat panel (bottom right).
2. The agent reads your open file + project structure.
3. It proposes file edits as a unified diff.
4. Click **Accept** to apply, **Reject** to discard.
5. Preview auto-refreshes after apply.

**Good prompts:**
- "Add a dark mode toggle to the settings screen."
- "Fix the overflow error on line 42 in home_screen.dart."
- "Create a UserCard component with avatar, name, and bio props."
- "Extract the product list into a separate ProductList widget."

**Prompts that need more context:** If the agent doesn't produce what you want, open the target file first (so it's in context), then re-prompt.

### 3.3 Errors → Fix with AI

1. Run `flutter analyze` or your RN type check from the terminal panel.
2. Errors appear in the **Diagnostics** panel.
3. Click any error to jump to the file.
4. Click **"Fix this"** — the agent attempts a targeted fix.
5. Re-run analyze to confirm.

---

## 4. Keyboard Shortcuts

Press **F1** inside Peep to see the full shortcut list.

| Action | Shortcut |
|--------|----------|
| Quick file open | `Ctrl+P` |
| Open settings | `Ctrl+,` |
| New project | `Ctrl+N` |
| Refresh preview | `Ctrl+R` |
| Send AI message | `Ctrl+Enter` |
| Cancel AI | `Escape` |
| Show keyboard help | `F1` |

---

## 5. Known Limitations (Beta)

We know about these — no need to report:

- [ ] Expo preview requires `npx expo install` to succeed; if your project has native modules, web preview may not work.
- [ ] Code signing is not configured — Windows SmartScreen may warn on first run.
- [ ] The AI sometimes creates a file and forgets to import it — just tell it "add the import for X".
- [ ] Very large projects (>500 source files) may cause the file tree to load slowly.
- [ ] Hot reload via Metro 'r' signal is not yet wired up for React Native.

---

## 6. How to Give Feedback

### Weekly Feedback Form
Fill in the [weekly form](https://peep.dev/beta-feedback.html?week=1) every Friday. Takes 3 minutes. This is the most valuable thing you can do.

### Bug Reports
For reproducible bugs, please include:
1. What you did (steps)
2. What you expected
3. What actually happened
4. Your OS + Peep version (Settings → About tab)

Send to: **beta@peep.dev** or post in `#bugs` on Discord.

### Discord
Join our beta Discord: [discord.gg/peep-beta](https://discord.gg/peep-beta)

Channels:
- `#general` — general chat
- `#bugs` — reproducible issues
- `#ideas` — feature requests
- `#show-and-tell` — share what you built with Peep

---

## 7. Your Beta Perks

- ✅ **3 months Pro free** — access to all features
- ✅ **Early-adopter pricing** — locked forever when Pro launches
- ✅ **Direct Discord access** to the Peep team
- ✅ **Vote on the roadmap** — your vote counts 10x

---

## 8. Privacy Reminder

- Your **code never leaves your machine**.
- The only network call is to the AI provider you configure (OpenAI / Anthropic).
- Telemetry is **opt-in** and **local-only** (no code content, no file paths).
- You can disable telemetry anytime in Settings → Privacy.

---

*Thank you for being a Peep beta tester. You're helping build the IDE that mobile developers deserve. 🙏*

— The Peep Team
