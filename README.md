<div align="center">

# 🎬 IMDb Extractor

**A lightweight, privacy-focused Chrome Extension to export, backup, and download your IMDb Watch History, Watchlists, and Custom Lists into CSV, Markdown, JSON, Plain Text, or HTML.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-F5C518?style=flat-square&logo=googlechrome&logoColor=black)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-None-brightgreen?style=flat-square)](#)
[![Privacy Friendly](https://img.shields.io/badge/Privacy-100%25%20Local-blue?style=flat-square)](#-privacy--security)

</div>

---

## Overview

**IMDb Extractor** is an open-source browser extension designed to extract movie and TV show data from IMDb without requiring API keys or third-party server access. 

While IMDb does not provide a native one-click export for watch history and complete list metadata, this tool automates page traversal and client-side extraction to generate clean, structured datasets formatted for spreadsheets, note-taking applications, and developer workflows.

---

## Key Features

- **Multiple Export Formats:** Export directly to **CSV** (Excel, Google Sheets, Notion), **Markdown** (Obsidian, Logseq), **JSON**, **Plain Text**, or **HTML**.
- **Granular Metadata Selection:** Toggle individual attributes including IMDb URLs, Ratings & Vote Counts, Runtimes, Age Certificates, Cast & Directors, and Plot Summaries.
- **Automated List Traversal:** Handles infinite scroll and automatically triggers "Load More" pagination buttons to ensure complete dataset capture.
- **Client-Side Processing:** All extraction logic executes locally within the browser session. No personal data, credentials, or browsing history are stored or transmitted.

---

## Supported IMDb Pages

| Page Type | URL Pattern |
|---|---|
| **Watch History / Check-ins** | `imdb.com/list/watchhistory/` |
| **User Watchlists** | `imdb.com/user/ur.../watchlist` |
| **Custom Lists** | `imdb.com/list/ls.../` |
| **Top Charts & Ratings** | `imdb.com/chart/top/`, `imdb.com/chart/toptv/` |
| **Search & Filter Results** | `imdb.com/search/title/...` |

---

## Supported Formats

| Format | File Extension | Common Use Case |
|---|---|---|
| **CSV** | `.csv` | Spreadsheet analysis (Excel, Google Sheets, Airtable, Notion) |
| **Markdown** | `.md` | Knowledge bases & Personal wikis (Obsidian, Logseq, Bear) |
| **JSON** | `.json` | Programmatic processing, data pipelines, and developer workflows |
| **HTML** | `.html` | Standalone interactive webpage with direct IMDb links |
| **Plain Text** | `.txt` | Simple, human-readable offline archive |

---

## Installation

### Method 1: Pre-Packaged Release (Recommended)
1. Download the latest release `.zip` from the [Releases](https://github.com/Omwardhan13/IMDb_Extractor/releases) section.
   - For Chrome: Download `imdb-extractor-v1.0.0.zip`
   - For Firefox: Download `imdb-extractor-v1.0.0-firefox.zip`
2. Extract the ZIP archive to a folder on your computer.
3. **For Chrome:**
   - Navigate to `chrome://extensions/`.
   - Enable **Developer mode** (top-right corner).
   - Click **Load unpacked** (top-left) and select the extracted folder.
4. **For Firefox:**
   - Navigate to `about:debugging#/runtime/this-firefox`.
   - Click **Load Temporary Add-on...**
   - Select the `manifest.json` file inside the extracted folder.

### Method 2: Clone from Source
```bash
git clone https://github.com/Omwardhan13/IMDb_Extractor.git
```
In `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select the `IMDb_Extractor/` directory.

### Method 3: Download Repository Archive
1. Click the green **Code** button at the top of the repository and select **Download ZIP**.
2. Extract the repository.
3. In `chrome://extensions/`, click **Load unpacked** and select the `IMDb_Extractor/` folder.

---

## Usage

1. Navigate to any supported IMDb list or watch history page in Google Chrome or Mozilla Firefox.
2. Click the **IMDb Extractor** icon in the browser toolbar.
3. Select your target **Export Format** and choose the desired **Metadata Fields**.
4. Click **Scrape & Export**.
5. The extension will scroll through the list and automatically trigger a file download upon completion.

---

## Privacy & Security

- **Zero Telemetry:** No analytics, tracking scripts, or remote logging.
- **No Authentication Required:** Operates within your existing active browser session without accessing account credentials.
- **Open Source:** Codebase is fully auditable under the MIT license.

---

## Search Keywords & Tags

`imdb watch history extractor` • `imdb watchlist downloader` • `export imdb to csv` • `export imdb to markdown` • `backup imdb ratings` • `imdb list scraper` • `imdb json export` • `letterboxd imdb import` • `chrome extension manifest v3`

---

## License

This project is open source and available under the [MIT License](LICENSE).
