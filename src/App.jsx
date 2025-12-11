// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// Quill + ReactQuill
import Quill from "quill";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// image resize module for Quill (default export)
import ImageResize from "quill-image-resize-module-react";
try {
  Quill.register("modules/imageResize", ImageResize);
} catch (err) {
  console.warn("ImageResize registration failed:", err);
}

// toast + sanitize
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DOMPurify from "dompurify";

/* ---------------- safe size registration ---------------- */
try {
  const SizeStyle = Quill.import("attributors/style/size");
  SizeStyle.whitelist = ["36px", "32px", "28px", "24px", "18px", "14px"];
  Quill.register(SizeStyle, true);
} catch (err) {
  console.warn("Quill size registration failed (non-fatal):", err);
}

/* ---------- constants ---------- */
const DRAFT_KEY = "blog-draft";
const POSTS_KEY = "blog-posts";

/* ---------- helper: clean Quill HTML ---------- */
function cleanHtml(rawHtml) {
  if (!rawHtml) return "";
  let html = rawHtml.trim();
  html = html.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "<p></p>");
  html = html.replace(/(<p>\s*<\/p>\s*){2,}/gi, "<p></p>");
  html = html.replace(/^(<p>\s*<\/p>\s*)+/i, "");
  html = html.replace(/(<p>\s*<\/p>\s*)+$/i, "");
  html = html.replace(/(<br\s*\/?>\s*){2,}/gi, "<br/>");
  return html.trim();
}

/* ---------- Auto-save hook ---------- */
function useAutoSaveDraft(draft, delay = 30000) {
  useEffect(() => {
    const hasContent =
      (draft.title && draft.title.trim()) ||
      (draft.content && draft.content.trim()) ||
      (draft.tags && draft.tags.length > 0) ||
      (draft.images && draft.images.length > 0);

    if (!hasContent) return;

    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        toast.info("Draft auto-saved", { autoClose: 1400, pauseOnHover: false });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save draft");
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [draft, delay]);
}

/* ---------- Editor toolbar ---------- */
function EditorToolbar({ onFormat, onShowLinkModal }) {
  const handleHeadingChange = (e) => {
    const value = e.target.value;
    if (!value) {
      onFormat("size", false);
    } else {
      const map = { h1: "36px", h2: "32px", h3: "28px", h4: "24px", h5: "18px", h6: "14px" };
      onFormat("size", map[value]);
    }
    e.target.value = "";
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button onClick={() => onFormat("bold")} type="button">B</button>
        <button onClick={() => onFormat("italic")} type="button">i</button>
        <button onClick={() => onFormat("list", "ordered")} type="button">OL</button>
        <button onClick={() => onFormat("list", "bullet")} type="button">UL</button>

        <select onChange={handleHeadingChange} defaultValue="">
          <option value="">Normal</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="h5">H5</option>
          <option value="h6">H6</option>
        </select>

        <button type="button" onClick={onShowLinkModal}>Insert Link</button>
      </div>
    </div>
  );
}

/* ---------- Link modal ---------- */
function LinkModal({ open, onClose, onInsert }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (open) setUrl(""); }, [open]);
  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.warn("Please enter a link URL");
      return;
    }
    let finalUrl = url.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) finalUrl = "https://" + finalUrl;
    onInsert(finalUrl);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Insert hyperlink</h3>
        <form onSubmit={handleSubmit}>
          <input autoFocus type="text" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Insert</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Tag selector ---------- */
function TagSelector({ selectedTags, onChange }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag) return;
    if (selectedTags.includes(tag)) return;
    onChange([...selectedTags, tag]);
    setInput("");
    // keep focus on tag input after adding
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
    else if (e.key === "Backspace" && !input && selectedTags.length) onChange(selectedTags.slice(0, -1));
  };
  const handleRemove = (tagToRemove) => onChange(selectedTags.filter((t) => t !== tagToRemove));

  return (
    <div className="tag-selector">
      <label>Tags</label>
      <div className="tag-input-wrapper">
        {selectedTags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button type="button" className="tag-remove" onClick={() => handleRemove(tag)}>×</button>
          </span>
        ))}
        <input ref={inputRef} className="tag-text-input" placeholder={selectedTags.length === 0 ? "Type a tag and press Enter…" : "Add another tag…"} value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={handleKeyDown}/>
      </div>
      <small>Press Enter or comma to add a tag.</small>
    </div>
  );
}

/* ---------- Image uploader (insert + drag/resize support) ---------- */
function ImageUploader({ images, onImagesChange, quillRef }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // global drag move helpers (per-editor)
  const draggingState = useRef({
    draggedImgEl: null,   // DOM img element being dragged
    draggedBlot: null,    // corresponding Quill blot
    draggedSrc: null,
  });

  // called after insert to set draggable + event handlers on the inserted image DOM
  const prepareImageDom = (imgEl) => {
    if (!imgEl) return;
    imgEl.setAttribute("draggable", "true");

    // ondragstart: store element and blot for later removal (move)
    imgEl.addEventListener("dragstart", (ev) => {
      try {
        const src = imgEl.getAttribute("src");
        draggingState.current.draggedImgEl = imgEl;
        draggingState.current.draggedSrc = src;
        // find blot for removal using Quill.find
        const blot = Quill.find(imgEl);
        draggingState.current.draggedBlot = blot || null;
        // put src into dataTransfer so drop handlers can detect it
        if (ev.dataTransfer) ev.dataTransfer.setData("text/plain", src);
      } catch (err) {
        // ignore
      }
    });

    // optional: ondragend clear
    imgEl.addEventListener("dragend", () => {
      draggingState.current.draggedImgEl = null;
      draggingState.current.draggedBlot = null;
      draggingState.current.draggedSrc = null;
    });
  };

  const insertImageIntoEditor = (imageUrl, fileName) => {
    const editor = quillRef?.current?.getEditor();
    if (!editor) {
      onImagesChange((prev) => [...prev, { id: Date.now(), name: fileName || "image", url: imageUrl }]);
      return;
    }

    // Insert at current cursor position (or end)
    const range = editor.getSelection(true);
    const index = (range && typeof range.index === "number") ? range.index : editor.getLength();

    editor.insertEmbed(index, "image", imageUrl, "user");
    editor.setSelection(index + 1, 0);

    // After Quill renders the embed, style and make it draggable + attach handlers
    setTimeout(() => {
      try {
        const imgs = editor.root.querySelectorAll("img");
        const imgEl = imgs[imgs.length - 1];
        if (imgEl) {
          imgEl.setAttribute("data-default-size", "true");
          imgEl.style.width = "60%";
          imgEl.style.maxWidth = "100%";
          imgEl.style.height = "auto";
          imgEl.style.display = "block";
          imgEl.style.margin = "0.5rem 0";
          prepareImageDom(imgEl);
        }
      } catch (err) {
        // ignore
      }
    }, 60);

    // Add to local list for preview/management
    onImagesChange((prev) => [...prev, { id: Date.now(), name: fileName || "image", url: imageUrl }]);

    // Make the editor accept drops for moving images: (attach once)
    const root = quillRef?.current?.getEditor().root;
    if (root && !root._hasDropHandlers) {
      root._hasDropHandlers = true;
      // allow drop
      root.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      root.addEventListener("drop", (e) => {
        e.preventDefault();

        const editor = quillRef?.current?.getEditor();
        if (!editor) return;

        // try to read src from dataTransfer
        const src = e.dataTransfer?.getData("text/plain") || null;

        // get drop position: Quill usually sets selection for drop location, so prefer it
        let dropIndex = editor.getSelection(true)?.index;
        if (dropIndex == null) {
          // fallback: try caret position from point
          let range;
          if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(e.clientX, e.clientY);
          else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) range = document.createRange();
            if (pos) range.setStart(pos.offsetNode, pos.offset);
          }
          if (range) {
            // get node at that caret - walk up to find blot
            const node = range.startContainer;
            try {
              const blot = Quill.find(node);
              dropIndex = blot ? editor.getIndex(blot) : editor.getLength();
            } catch {
              dropIndex = editor.getLength();
            }
          } else {
            dropIndex = editor.getLength();
          }
        }

        // if we have a src, insert it at dropIndex
        if (src) {
          editor.insertEmbed(dropIndex, "image", src, "user");
          // remove the original image blot if we have it (move)
          const dragged = draggingState.current;
          if (dragged && dragged.draggedBlot) {
            try {
              const originalIndex = editor.getIndex(dragged.draggedBlot);
              // If originalIndex < newIndex and original will be removed first, newIndex shifts - handle carefully:
              // If originalIndex < dropIndex, after deletion dropIndex should be reduced by 1
              let adjustedDropIndex = dropIndex;
              if (typeof originalIndex === "number" && originalIndex < dropIndex) adjustedDropIndex = dropIndex - 1;
              editor.deleteText(originalIndex, 1);
              // clear drag state
              draggingState.current.draggedBlot = null;
              draggingState.current.draggedImgEl = null;
              draggingState.current.draggedSrc = null;
            } catch (err) {
              // ignore removal errors
            }
          }
        } else {
          // no src in dataTransfer — nothing to do
        }
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setProgress(0);

    // Read file as data URL (base64)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      let simulated = 0;
      const timer = setInterval(() => {
        simulated += 15;
        setProgress(Math.min(simulated, 100));
        if (simulated >= 100) {
          clearInterval(timer);
          insertImageIntoEditor(dataUrl, file.name);
          setIsUploading(false);
          toast.success("Image uploaded and inserted into editor");
        }
      }, 140);
    };

    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      toast.error("Failed to read image file");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (id) => onImagesChange(images.filter((i) => i.id !== id));

  return (
    <div className="image-uploader">
      <label>Upload Images</label>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {isUploading && (
        <div className="progress-wrapper">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <span>{progress}%</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="image-list">
          {images.map((img) => (
            <div key={img.id} className="image-item">
              <img src={img.url} alt={img.name} style={{ maxWidth: 120, maxHeight: 80, objectFit: "cover" }} />
              <span>{img.name}</span>
              <button type="button" onClick={() => handleRemove(img.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Preview pane ---------- */
function PreviewPane({ title, content, tags, images }) {
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(content || ""), [content]);

  return (
    <div className="preview-pane">
      <h2>{title || "Untitled Post"}</h2>

      {tags && tags.filter(Boolean).length > 0 && (
        <div className="preview-tags">
          {tags.filter(Boolean).map((t) => (
            <span key={t} className="tag-chip">{t}</span>
          ))}
        </div>
      )}

      <div className="preview-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

      {images.length > 0 && (
        <>
          <h3>Images</h3>
          <div className="preview-images">
            {images.map((img) => (
              <img key={img.id} src={img.url} alt={img.name} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Posts view ---------- */
function PostListView({ posts, onSelectPost }) {
  const [query, setQuery] = useState("");
  const filtered = posts.filter((post) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const inTitle = (post.title || "").toLowerCase().includes(q);
    const inContent = (post.contentPlain || "").toLowerCase().includes(q);
    return inTitle || inContent;
  });

  return (
    <div className="post-list-view">
      <h2>Your published posts</h2>
      <input className="search-input" placeholder="Search by title or content..." value={query} onChange={(e)=>setQuery(e.target.value)} />
      {filtered.length === 0 ? <p className="no-posts">No posts found for this query.</p> : (
        <div className="post-list">
          {filtered.map((post) => (
            <div key={post.id} className="post-card" onClick={() => onSelectPost(post)}>
              <h3>{post.title || "Untitled"}</h3>
              <p className="post-snippet">{post.contentPlain?.slice(0,150)}{post.contentPlain && post.contentPlain.length > 150 ? "..." : ""}</p>
              <div className="post-meta">
                <span>{post.createdAt ? new Date(post.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short"}) : "Just now"}</span>
                <div className="post-tags">{post.tags?.map((t)=><span key={t} className="tag-chip">{t}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Main App ---------- */
function App() {
  const [view, setView] = useState("editor"); // "editor" | "posts"
  const [isPreview, setIsPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [images, setImages] = useState([]);

  const [posts, setPosts] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const quillRef = useRef(null);

  // store last known selection so modal insertions can reuse it
  const lastSelectionRef = useRef(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (!savedDraft) return;
    try {
      const { title: sTitle, content: sContent, tags: sTags, images: sImages } = JSON.parse(savedDraft);
      setTitle(sTitle || "");
      setContent(cleanHtml(sContent || ""));
      setTags(Array.isArray(sTags) ? sTags.filter(Boolean) : []);
      setImages(Array.isArray(sImages) ? sImages : []);
    } catch (err) {
      console.error("Failed to restore draft", err);
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const savedPosts = localStorage.getItem(POSTS_KEY);
    if (savedPosts) {
      try {
        const parsed = JSON.parse(savedPosts);
        if (Array.isArray(parsed)) setPosts(parsed);
        else localStorage.removeItem(POSTS_KEY);
      } catch (err) {
        console.error("Failed to parse posts", err);
        localStorage.removeItem(POSTS_KEY);
      }
    }
  }, []);

  // keep localStorage in sync whenever posts change
  useEffect(()=> {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    } catch (err) {
      console.error("Failed to persist posts", err);
    }
  }, [posts]);

  useAutoSaveDraft({ title, content, tags, images }, 30000);

  // set up selection-change listener once quill is mounted so we always remember last caret position
// set up selection-change + extra handlers so caret is always reliable (selection-change, text-change, click, keyup, paste, Enter)
useEffect(() => {
  const editor = quillRef.current?.getEditor();
  if (!editor) return;

  // store a shallow copy of the selection
  const snapshotSelection = () => {
    try {
      const sel = editor.getSelection();
      if (sel) lastSelectionRef.current = { index: sel.index, length: sel.length };
      else lastSelectionRef.current = null;
    } catch (err) {
      // ignore
    }
  };

  // selection-change handler (keeps lastSelectionRef up to date)
  const handleSelectionChange = (range/*, oldRange, source */) => {
    if (range) lastSelectionRef.current = { index: range.index, length: range.length };
    else lastSelectionRef.current = null;
  };

  // text-change / click / keyup => snapshot selection after typing/clicking
  const onTextChange = () => snapshotSelection();
  const onClick = () => snapshotSelection();
  const onKeyUp = () => snapshotSelection();

  // paste handler: insert plain text at the recorded caret position
  const onPaste = (e) => {
    if (!e.clipboardData) return;
    const pasteText = e.clipboardData.getData("text");
    if (!pasteText) return; // allow default if no text (images etc)

    e.preventDefault();
    // prefer actual selection, fallback to saved selection, else end
    let sel = null;
    try { sel = editor.getSelection(); } catch {}
    const saved = lastSelectionRef.current;
    const insertIndex = (sel && typeof sel.index === "number") ? sel.index
      : (saved && typeof saved.index === "number") ? saved.index
      : Math.max(0, editor.getLength() - 1);

    editor.insertText(insertIndex, pasteText, "user");
    editor.setSelection(insertIndex + pasteText.length, 0, "user");
    lastSelectionRef.current = { index: insertIndex + pasteText.length, length: 0 };
  };

  // Enter binding: allow default Quill handling then snapshot selection
  const enterBinding = {
    key: 13,
    handler: function(range, context) {
      // allow default behavior; snapshot after default handling
      setTimeout(() => snapshotSelection(), 0);
      return true;
    }
  };

  // attach listeners
  try { editor.on("selection-change", handleSelectionChange); } catch (e) {}
  try { editor.on("text-change", onTextChange); } catch (e) {}
  if (editor.root) {
    editor.root.addEventListener("click", onClick);
    editor.root.addEventListener("keyup", onKeyUp);
    editor.root.addEventListener("paste", onPaste);
  }
  try { editor.keyboard.addBinding(enterBinding); } catch (e) {}

  // initial snapshot
  snapshotSelection();

  // cleanup
  return () => {
    try { editor.off("selection-change", handleSelectionChange); } catch (e) {}
    try { editor.off("text-change", onTextChange); } catch (e) {}
    try { editor.keyboard.removeBinding(enterBinding); } catch (e) {}
    try {
      if (editor.root) {
        editor.root.removeEventListener("click", onClick);
        editor.root.removeEventListener("keyup", onKeyUp);
        editor.root.removeEventListener("paste", onPaste);
      }
    } catch (e) {}
  };
}, [quillRef.current]);


  const quillModules = {
    toolbar: false,
    imageResize: {},
  };

  const handleFormat = (format, value) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection();

    if (format === "list") {
      if (!range || range.length === 0) { toast.info("Select the text you want to turn into a list."); return; }
      editor.format("list", value);
      return;
    }

    if (format === "size") {
      if (!range || range.length === 0) { toast.info("Select text to apply the heading size."); return; }
      if (value === false) editor.formatText(range.index, range.length, "size", false);
      else editor.formatText(range.index, range.length, "size", value);
      editor.setSelection(range.index + range.length, 0);
      editor.format("size", false);
      return;
    }

    if (["bold","italic","underline","strike"].includes(format)) {
      if (!range || range.length === 0) { toast.info("Select text to apply formatting."); return; }
      const currentFormats = editor.getFormat(range.index, range.length);
      const currentlyEnabled = !!currentFormats[format];
      editor.formatText(range.index, range.length, format, !currentlyEnabled);
      editor.setSelection(range.index + range.length, 0);
      editor.format(format, false);
      return;
    }

    if (!range) return;
    editor.format(format, value === undefined ? true : value);
  };

  // open link modal while capturing last selection so insertion works even if focus is lost
  const openLinkModal = () => {
    const editor = quillRef.current?.getEditor();
    try {
      const sel = editor?.getSelection();
      if (sel) lastSelectionRef.current = { index: sel.index, length: sel.length };
    } catch (err) {
      // ignore
    }
    setLinkModalOpen(true);
  };

  const handleInsertLink = (url) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    let finalUrl = url;
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) finalUrl = "https://" + finalUrl;

    // Use saved selection if available (this deals with modal stealing focus)
    const saved = lastSelectionRef.current;
    let range = null;
    try {
      range = editor.getSelection();
    } catch {}
    // prefer actual selection if exists, else fallback to saved selection, else to end
    const useIndex = (range && typeof range.index === "number") ? range.index
      : (saved && typeof saved.index === "number") ? saved.index
      : Math.max(0, editor.getLength() - 1);

    const useLength = (range && typeof range.length === "number") ? range.length
      : (saved && typeof saved.length === "number") ? saved.length
      : 0;

    // If selection length > 0, apply link format to selected text
    if (useLength > 0) {
      editor.formatText(useIndex, useLength, "link", finalUrl, "user");
      // set cursor right after selection
      editor.setSelection(useIndex + useLength, 0, "user");
      editor.focus();
      // clear saved selection
      lastSelectionRef.current = null;
      return;
    }

    // If no selection length, insert the URL text at index with link attribute
    editor.insertText(useIndex, finalUrl, { link: finalUrl }, "user");
    editor.setSelection(useIndex + finalUrl.length, 0, "user");
    editor.focus();

    // clear saved selection
    lastSelectionRef.current = null;
  };

  const handlePublish = () => {
    if (!title.trim() && !content.trim()) { toast.warn("Add a title or some content before publishing"); return; }

    const cleanedHtml = cleanHtml(content);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cleanedHtml;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    const newPost = {
      id: Date.now(),
      title: title.trim() || "Untitled Post",
      contentHtml: cleanedHtml,
      contentPlain: plainText,
      tags: (tags || []).filter(Boolean),
      images,
      createdAt: new Date().toISOString(),
    };

    // Immediately persist posts (so they survive refresh even if effect hasn't run)
    const updatedPosts = [newPost, ...posts];
    setPosts(updatedPosts);
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(updatedPosts));
    } catch (err) {
      console.error("Failed to persist posts at publish time", err);
    }

    toast.success("Post published!");

    setTitle("");
    setContent("");
    setTags([]);
    setImages([]);
    localStorage.removeItem(DRAFT_KEY);
  };

  const draftChanged = !!((title && title.trim()) || (content && content.trim()) || (tags && tags.length) || (images && images.length));

  const handleSelectPost = (post) => {
    setTitle(post.title || "");
    setContent(cleanHtml(post.contentHtml || ""));
    setTags((post.tags || []).filter(Boolean));
    setImages(post.images || []);
    setView("editor");
    setIsPreview(false);

    toast.info("Loaded post for editing", {
      autoClose: 1200,
      pauseOnHover: false,
    });
  };

  const handleNewPostClick = () => {
    setView("editor");
    setTitle("");
    setContent("");
    setTags([]);
    setImages([]);
    localStorage.removeItem(DRAFT_KEY);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">IB</div>
          <div className="logo-text"><span className="brand">Interactive Blog</span><span className="tagline">Interactive blog editor</span></div>
          <nav className="main-nav">
            <button className={view === "editor" ? "nav-link active" : "nav-link"} onClick={()=>setView("editor")}>Editor</button>
            <button className={view === "posts" ? "nav-link active" : "nav-link"} onClick={()=>setView("posts")}>Posts</button>
          </nav>
        </div>

        <div className="header-right">
          <button type="button" className="upload-chip" onClick={handleNewPostClick}>+ New post</button>
        </div>
      </header>

      {view === "editor" && (
        <main className="editor-layout">
          <section className="editor-pane">
            <div className="editor-header-row">
              <input className="title-input" placeholder="Give your post a catchy title..." value={title} onChange={(e)=>setTitle(e.target.value)} />
              <button type="button" className="preview-toggle" onClick={()=>setIsPreview(p=>!p)}>{isPreview ? "Back to editor" : "Preview"}</button>
            </div>

            {!isPreview && <>
              <EditorToolbar onFormat={handleFormat} onShowLinkModal={openLinkModal} />
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={(html) => {
                  // keep editor responsive, but store cleaned HTML
                  setContent(cleanHtml(html));
                }}
                modules={quillModules}
                className="editor"
                placeholder="Write your story here..."
              />
              <TagSelector selectedTags={tags} onChange={setTags} />
              <ImageUploader images={images} onImagesChange={setImages} quillRef={quillRef} />
              <div className="editor-actions">
                <button type="button" onClick={handlePublish}>Publish Post</button>
                {draftChanged && <span className="draft-hint">Draft auto-saves after 30 seconds of inactivity.</span>}
              </div>
            </>}

            {isPreview && <PreviewPane title={title} content={content} tags={tags} images={images} />}
          </section>
        </main>
      )}

      {view === "posts" && <PostListView posts={posts} onSelectPost={handleSelectPost} />}

      <LinkModal open={linkModalOpen} onClose={()=>setLinkModalOpen(false)} onInsert={handleInsertLink} />
      <ToastContainer position="bottom-right" theme="light" />

      {/* small style fixes to improve preview spacing and title placement */}
      <style>{`
        .preview-pane h2 { margin: 0 0 0.6rem; line-height: 1.15; }
        .preview-content p { margin: 0 0 0.68rem; }
        .preview-content p:empty { display: none; }
        .ql-editor img { max-width: 100%; height: auto; display: block; margin: 0.5rem 0; }
        .ql-editor img[data-default-size="true"] { width: 60%; max-width: 100%; height: auto; }
      `}</style>
    </div>
  );
}

export default App;
