// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Quill from "quill";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// optional: Quill image resize (if installed)
import ImageResize from "quill-image-resize-module-react";
try {
  Quill.register("modules/imageResize", ImageResize);
} catch (err) {
  // ignore if not installed
  // console.warn("quill image-resize registration failed", err);
}

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DOMPurify from "dompurify";

/* ---------- constants ---------- */
const DRAFT_KEY = "blog-draft";
const POSTS_KEY = "blog-posts";

/* ---------- helper: clean Quill HTML (run once on publish) ---------- */
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

/* ---------- autosave hook (debounced) ---------- */
function useAutoSaveDraft(draft, delay = 30000) {
  useEffect(() => {
    const hasContent =
      (draft.title && draft.title.trim()) ||
      (draft.content && draft.content.trim()) ||
      (draft.tags && draft.tags.length > 0) ||
      (draft.images && draft.images.length > 0);

    if (!hasContent) return;

    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        toast.info("Draft auto-saved", { autoClose: 1100, pauseOnHover: false });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save draft");
      }
    }, delay);

    return () => clearTimeout(t);
  }, [draft, delay]);
}

/* ---------- Editor toolbar (with width/height inputs) ---------- */
function EditorToolbar({ onFormat, onShowLinkModal, onResizeImage }) {
  const [widthVal, setWidthVal] = useState("");
  const [heightVal, setHeightVal] = useState("");

  const handleHeading = (e) => {
    const map = { h1: "36px", h2: "32px", h3: "28px", h4: "24px", h5: "18px", h6: "14px" };
    const v = e.target.value;
    onFormat("size", v ? map[v] : false);
    e.target.value = "";
  };

  const applyResize = () => {
    if (!widthVal && !heightVal) {
      toast.warn("Enter width or height (e.g. 300 or 50%)");
      return;
    }
    onResizeImage(widthVal.trim(), heightVal.trim());
    // keep inputs intact so user can adjust again if needed
  };

  return (
    <div className="toolbar" style={{ alignItems: "center" }}>
      <div className="toolbar-left">
        <button type="button" onClick={() => onFormat("bold")}>B</button>
        <button type="button" onClick={() => onFormat("italic")}>i</button>
        <button type="button" onClick={() => onFormat("list", "ordered")}>OL</button>
        <button type="button" onClick={() => onFormat("list", "bullet")}>UL</button>

        <select defaultValue="" onChange={handleHeading}>
          <option value="">Normal</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="h5">H5</option>
          <option value="h6">H6</option>
        </select>

        <button type="button" onClick={onShowLinkModal}>Insert Link</button>

        {/* image size controls */}
        <div style={{ display: "inline-flex", gap: 8, marginLeft: 12, alignItems: "center" }}>
          <input
            aria-label="Image width"
            title="Width (px or %). e.g. 300 or 50%"
            value={widthVal}
            onChange={(e) => setWidthVal(e.target.value)}
            placeholder="Width (px or %)"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", width: 120 }}
          />
          <input
            aria-label="Image height"
            title="Height (px or %). e.g. 200 or 50%"
            value={heightVal}
            onChange={(e) => setHeightVal(e.target.value)}
            placeholder="Height (px or %)"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", width: 120 }}
          />
          <button type="button" onClick={applyResize} style={{ padding: "6px 10px", borderRadius: 8 }}>
            Apply
          </button>
        </div>
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
    let final = url.trim();
    if (!final.startsWith("http://") && !final.startsWith("https://")) final = "https://" + final;
    onInsert(final);
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

/* ---------- Image uploader (insert + persist thumbnail sizes) ---------- */
function ImageUploader({ images, onImagesChange, quillRef }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const prepareImageDom = (imgEl) => {
    if (!imgEl) return;
    imgEl.setAttribute("draggable", "true");
    imgEl.setAttribute("data-default-size", "true");
    // default inline style so the HTML contains it (editor content includes style)
    // use percentage default to look good in article body; thumbnails use separate stored width/height
    imgEl.style.width = "60%";
    imgEl.style.maxWidth = "100%";
    imgEl.style.height = "auto";
    imgEl.style.display = "block";
    imgEl.style.margin = "0.5rem auto";
    imgEl.addEventListener("dragstart", (ev) => {
      if (ev.dataTransfer) ev.dataTransfer.setData("text/plain", imgEl.getAttribute("src"));
    });
  };

  const insertImageIntoEditor = (imageUrl, fileName) => {
    const editor = quillRef?.current?.getEditor();
    if (!editor) {
      onImagesChange((prev) => [...prev, { id: Date.now(), name: fileName || "image", url: imageUrl, width: "120px", height: "80px" }]);
      return;
    }

    const range = editor.getSelection(true);
    const index = (range && typeof range.index === "number") ? range.index : editor.getLength();
    editor.insertEmbed(index, "image", imageUrl, "user");
    editor.setSelection(index + 1, 0);

    // style the inserted DOM image so HTML includes inline style
    setTimeout(() => {
      try {
        const imgs = editor.root.querySelectorAll("img");
        const imgEl = imgs[imgs.length - 1];
        if (imgEl) prepareImageDom(imgEl);
      } catch (err) { /* ignore */ }
    }, 40);

    // push image to images[] with thumbnail defaults (px values)
    onImagesChange((prev) => {
      const updated = [...prev, { id: Date.now(), name: fileName || "image", url: imageUrl, width: "120px", height: "80px" }];
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: (localStorage.getItem("last-title") || ""), content: editor.root.innerHTML || "", tags: [], images: updated }));
      } catch (_) {}
      return updated;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setProgress(0);

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
      }, 120);
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
              {/* use stored width/height for thumbnail display */}
              <img
                src={img.url}
                alt={img.name}
                style={{
                  width: img.width || "120px",
                  height: img.height || "80px",
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb"
                }}
              />
              <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>{img.name}</span>
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
          {tags.filter(Boolean).map((t) => <span key={t} className="tag-chip">{t}</span>)}
        </div>
      )}

      <div className="preview-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

      {images.length > 0 && (
        <>
          <h3>Images</h3>
          <div className="preview-images">
            {images.map((img) => (
              <img key={img.id} src={img.url} alt={img.name} style={{ width: img.width || "140px", height: img.height || "92px", objectFit: "cover", borderRadius: 8, border: "1px solid #eee", margin: 6 }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Posts list view ---------- */
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
export default function App() {
  const [view, setView] = useState("editor"); // "editor" | "posts"
  const [isPreview, setIsPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [images, setImages] = useState([]);

  const [posts, setPosts] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const quillRef = useRef(null);
  const lastSelectionRef = useRef(null);

  // load draft
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setTitle(parsed.title || "");
      setContent(parsed.content || "");
      setTags(Array.isArray(parsed.tags) ? parsed.tags : []);
      setImages(Array.isArray(parsed.images) ? parsed.images : []);
    } catch (err) {
      console.error("restore draft failed", err);
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // load posts
  useEffect(() => {
    const saved = localStorage.getItem(POSTS_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setPosts(parsed);
    } catch (err) { console.error("load posts failed", err); localStorage.removeItem(POSTS_KEY); }
  }, []);

  // persist posts
  useEffect(() => {
    try { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); } catch (err) { console.error(err); }
  }, [posts]);

  // autosave drafts
  useAutoSaveDraft({ title, content, tags, images }, 30000);

  // persist draft immediately when images changes (so uploads don't vanish)
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, tags, images })); } catch (_) {}
  }, [images]);

  // keep last selection so modal insertion and resizing work after focus loss
  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const snapshotSelection = () => {
      try {
        const sel = editor.getSelection();
        if (sel) lastSelectionRef.current = { index: sel.index, length: sel.length };
        else lastSelectionRef.current = null;
      } catch {}
    };

    const handleSelectionChange = (range) => {
      if (range) lastSelectionRef.current = { index: range.index, length: range.length };
      else lastSelectionRef.current = null;
    };

    const onTextChange = () => snapshotSelection();
    const onClick = () => snapshotSelection();
    const onKeyUp = () => snapshotSelection();

    const onPaste = (e) => {
      if (!e.clipboardData) return;
      const text = e.clipboardData.getData("text");
      if (!text) return;
      e.preventDefault();
      let sel = null;
      try { sel = editor.getSelection(); } catch {}
      const saved = lastSelectionRef.current;
      const insertIndex = (sel && typeof sel.index === "number") ? sel.index
        : (saved && typeof saved.index === "number") ? saved.index
        : Math.max(0, editor.getLength() - 1);

      editor.insertText(insertIndex, text, "user");
      editor.setSelection(insertIndex + text.length, 0, "user");
      lastSelectionRef.current = { index: insertIndex + text.length, length: 0 };
    };

    try { editor.on("selection-change", handleSelectionChange); } catch {}
    try { editor.on("text-change", onTextChange); } catch {}
    if (editor.root) {
      editor.root.addEventListener("click", onClick);
      editor.root.addEventListener("keyup", onKeyUp);
      editor.root.addEventListener("paste", onPaste);
    }

    snapshotSelection();

    return () => {
      try { editor.off("selection-change", handleSelectionChange); } catch {}
      try { editor.off("text-change", onTextChange); } catch {}
      try {
        if (editor.root) {
          editor.root.removeEventListener("click", onClick);
          editor.root.removeEventListener("keyup", onKeyUp);
          editor.root.removeEventListener("paste", onPaste);
        }
      } catch {}
    };
  }, [quillRef.current]);

  const quillModules = { toolbar: false, imageResize: {} };
  const quillFormats = ["header", "bold", "italic", "underline", "strike", "size", "list", "bullet", "link", "image"];

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

  const openLinkModal = () => {
    const editor = quillRef.current?.getEditor();
    try {
      const sel = editor?.getSelection();
      if (sel) lastSelectionRef.current = { index: sel.index, length: sel.length };
    } catch {}
    setLinkModalOpen(true);
  };

  const handleInsertLink = (url) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    let finalUrl = url;
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) finalUrl = "https://" + finalUrl;

    const saved = lastSelectionRef.current;
    let range = null;
    try { range = editor.getSelection(); } catch {}
    const useIndex = (range && typeof range.index === "number") ? range.index
      : (saved && typeof saved.index === "number") ? saved.index
      : Math.max(0, editor.getLength() - 1);

    const useLength = (range && typeof range.length === "number") ? range.length
      : (saved && typeof saved.length === "number") ? saved.length
      : 0;

    if (useLength > 0) {
      editor.formatText(useIndex, useLength, "link", finalUrl, "user");
      editor.setSelection(useIndex + useLength, 0, "user");
      editor.focus();
      lastSelectionRef.current = null;
      return;
    }

    editor.insertText(useIndex, finalUrl, { link: finalUrl }, "user");
    editor.setSelection(useIndex + finalUrl.length, 0, "user");
    editor.focus();
    lastSelectionRef.current = null;
  };

  // normalize user size input
  const normalizeSizeValue = (raw) => {
    if (!raw) return "";
    const v = String(raw).trim();
    if (v.endsWith("%")) return v;
    if (/^[0-9]+$/.test(v)) return `${v}px`;
    return v;
  };

  // ----- handle resize called from toolbar -----
  const handleResizeImage = (widthRaw, heightRaw) => {
    try {
      const editor = quillRef.current?.getEditor();
      if (!editor) {
        toast.error("Editor not ready");
        return;
      }

      // prefer current selection, but ensure we have a caret position
      const sel = editor.getSelection(true);
      if (!sel) {
        toast.warn("Place cursor on the image or select it before resizing");
        return;
      }

      // get leaf at selection index
      let leaf;
      try { [leaf] = editor.getLeaf(sel.index); } catch {}
      const node = leaf && leaf.domNode ? leaf.domNode : null;

      let imgEl = null;
      if (node && node.tagName === "IMG") imgEl = node;
      else {
        try {
          const prevLeafIndex = Math.max(0, sel.index - 1);
          const [prevLeaf] = editor.getLeaf(prevLeafIndex) || [];
          if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === "IMG") imgEl = prevLeaf.domNode;
        } catch {}
      }

      if (!imgEl) {
        toast.warn("Put your cursor inside the image (or click the image) before applying size.");
        return;
      }

      const widthCss = normalizeSizeValue(widthRaw);
      const heightCss = normalizeSizeValue(heightRaw);

      if (widthCss) imgEl.style.width = widthCss;
      else imgEl.style.removeProperty("width");

      if (heightCss) imgEl.style.height = heightCss;
      else imgEl.style.removeProperty("height");

      imgEl.style.display = "block";
      if (!imgEl.style.margin) imgEl.style.margin = "0.5rem auto";

      // Persist HTML back to state and store size into images[] (so thumbnails update)
      setTimeout(() => {
        try {
          const newHtml = editor.root.innerHTML;
          setContent(newHtml);

          // update images[] entry matching by src to store width/height for thumbnail
          setImages((prev) => prev.map((it) => {
            if (!it.url) return it;
            // match src exactly
            if (it.url === imgEl.src) {
              return {
                ...it,
                width: widthCss || it.width,
                height: heightCss || it.height
              };
            }
            return it;
          }));

          toast.success("Image size updated");
        } catch (err) {
          console.error(err);
        }
      }, 40);
    } catch (err) {
      console.error(err);
      toast.error("Failed to resize image");
    }
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

    const updatedPosts = [newPost, ...posts];
    setPosts(updatedPosts);
    try { localStorage.setItem(POSTS_KEY, JSON.stringify(updatedPosts)); } catch (err) { console.error(err); }

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
    setContent(post.contentHtml || "");
    setTags((post.tags || []).filter(Boolean));
    setImages(post.images || []);
    setView("editor");
    setIsPreview(false);
    toast.info("Loaded post for editing", { autoClose: 1200, pauseOnHover: false });
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
              <EditorToolbar onFormat={handleFormat} onShowLinkModal={openLinkModal} onResizeImage={handleResizeImage} />
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={(html) => setContent(html)}
                modules={quillModules}
                formats={quillFormats}
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

      {/* small helpful inline styles for preview spacing */}
      <style>{`
        .preview-pane h2 { margin: 0 0 0.6rem; line-height: 1.15; }
        .preview-content p { margin: 0 0 0.68rem; }
        .preview-content p:empty { display: none; }
        .preview-content img { max-width: 100%; height: auto; display: block; margin: 0.6rem auto; }
        .ql-editor img { max-width: 100%; height: auto; display: block; margin: 0.5rem 0; }
      `}</style>
    </div>
  );
}
  