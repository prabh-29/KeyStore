# ⚡ Keystash (KeyStore)

A lightweight Chrome extension to **instantly store, search, and manage key-value pairs** — designed for developers who constantly deal with API keys, tokens, configs, and reusable snippets.

Built for **speed, simplicity, and keyboard-first workflow**.

---

## 🚀 Features

### 🔍 Instant Search
- Search keys and values in real-time
- Keyboard navigation support
- One-click copy to clipboard
- Clean grouped results with duplicates handling

### ➕ Add Entries
- Add key-value pairs quickly
- Smart conflict detection
- Overwrite or create multiple values for same key

### 📂 Bulk Upload
- Upload `.csv`, `.xlsx`, `.xls`
- Automatic parsing using Excel support
- Detects and updates existing keys
- Summary of new vs overridden entries

### 🛠 Manage Keys
- View all stored entries
- Edit values inline
- Delete entries instantly
- Built-in search for quick filtering

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|--------|--------|
| `Alt + 1` | Open Search |
| `Alt + 2` | Add Entry |
| `Alt + 3` | Upload File |
| `Alt + 4` | Manage Keys |

---

## 🧠 Why This Exists

As developers, we constantly juggle:
- API keys
- Tokens
- Environment configs
- Reusable snippets

Switching between notes, files, or password managers is slow and breaks flow.

**Keystash solves this by making access instant.**

---

## 🏗 Tech Stack

- **JavaScript (Vanilla)**
- **Chrome Extension (Manifest v3)**
- **Chrome Storage API**
- **XLSX.js** for Excel parsing
- HTML + CSS (custom UI)

---

## 📦 Installation

### Load Locally (Developer Mode)

1. Clone the repo
   ```bash
   git clone https://github.com/prabh-29/keystore.git
