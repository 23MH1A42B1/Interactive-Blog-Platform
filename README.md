# Interactive Blog

A polished, single-file React + Vite WYSIWYG blog editor for demos and rapid prototyping.  
Features rich-text editing (ReactQuill), image upload + inline sizing, tags, auto-save drafts, and local publish — all client-side (no backend required).

---

## 🔎 Project overview

**Interactive Blog** is a minimal but feature-rich front-end blog editor that allows users to:

- Write and format content using a WYSIWYG editor (bold, italic, headings, lists, links).
- Upload images (base64) and insert them into the editor.
- Resize images by specifying Width / Height (supports `px`, `%`, or other CSS units).
- Move images inside the editor using drag/drop (basic behavior).
- Add and manage tags for posts.
- Auto-save drafts to `localStorage` and restore them automatically.
- Publish posts to a local list (persisted to `localStorage`) and edit previously published posts.
- Preview sanitized HTML using `DOMPurify` to reduce XSS risk.

This is intended as a frontend prototype/demo or a starting point for a backend-enabled application.

---

## ✅ Features

- Rich-text editing via **ReactQuill**.
- Image upload from disk (read as base64 and inserted inline).
- Inline image sizing via toolbar inputs (Width / Height) — accepts `300`, `300px`, `50%`, `auto`, etc.
- Thumbnails panel listing uploaded images (with remove).
- Draft auto-save (debounced) to `localStorage`.
- Publish posts to a local posts list (persisted to `localStorage`).
- Post preview with sanitized HTML via **DOMPurify**.
- Toast notifications for user feedback via **react-toastify**.

---

## 🧰 Tech stack

- React (function components + hooks)
- Vite (dev server, HMR)
- ReactQuill (QuillJS editor)
- DOMPurify (sanitizing preview)
- react-toastify (toasts)
- Optional: `quill-image-resize-module-react` (for interactive corner resizing)

---

## 🔧 Quickstart (development)

1. Clone the repo:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
