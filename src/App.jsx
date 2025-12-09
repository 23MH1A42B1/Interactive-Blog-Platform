import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DOMPurify from "dompurify";

const DRAFT_KEY = "blog-draft";
const POSTS_KEY = "blog-posts";

/** Simple tags you can change as needed */
const AVAILABLE_TAGS = ["Tech", "Life", "Tutorial", "Opinion", "Career", "News"];

/** Auto-save hook: saves after 30s of inactivity */
function useAutoSaveDraft(draft, delay = 30000) {
  useEffect(() => {
    const hasContent =
      draft.title.trim() ||
      draft.content.trim() ||
      draft.tags.length > 0 ||
      draft.images.length > 0;

    if (!hasContent) return;

    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        toast.info("Draft auto-saved", { autoClose: 1500, pauseOnHover: false });
      } catch (err) {
        toast.error("Failed to save draft");
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [draft, delay]);
}

/** Toolbar for formatting + link modal trigger */
function EditorToolbar({ onFormat, onShowLinkModal }) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button onClick={() => onFormat("bold")} type="button">
          B
        </button>
        <button onClick={() => onFormat("italic")} type="button">
          i
        </button>

        <button onClick={() => onFormat("list", "ordered")} type="button">
          OL
        </button>
        <button onClick={() => onFormat("list", "bullet")} type="button">
          UL
        </button>

        <select
          onChange={(e) => onFormat("header", Number(e.target.value))}
          defaultValue=""
        >
          <option value="">Normal</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
        </select>

        <button type="button" onClick={onShowLinkModal}>
          Insert Link
        </button>
      </div>
    </div>
  );
}

/** Link modal */
function LinkModal({ open, onClose, onInsert }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onInsert(url.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Insert Hyperlink</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Insert</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Tag multi-select */
function TagSelector({ selectedTags, onChange }) {
  const handleChange = (e) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    onChange(values);
  };

  return (
    <div className="tag-selector">
      <label>Tags / Categories</label>
      <select multiple value={selectedTags} onChange={handleChange}>
        {AVAILABLE_TAGS.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <small>Hold Ctrl (Windows) or Cmd (Mac) to select multiple tags.</small>
    </div>
  );
}

/** Image uploader with fake progress */
function ImageUploader({ images, onImagesChange }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);

    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 10;
        if (next >= 100) {
          clearInterval(uploadInterval);
          const url = URL.createObjectURL(file);
          onImagesChange([
            ...images,
            { id: Date.now(), name: file.name, url: url },
          ]);
          setIsUploading(false);
          toast.success("Image uploaded");
        }
        return next;
      });
    }, 200);
  };

  return (
    <div className="image-uploader">
      <label>Upload Images</label>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {isUploading && (
        <div className="progress-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="image-list">
          {images.map((img) => (
            <div key={img.id} className="image-item">
              <img src={img.url} alt={img.name} />
              <span>{img.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Preview pane */
function PreviewPane({ title, content, tags, images }) {
  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(content || ""),
    [content]
  );

  return (
    <div className="preview-pane">
      <h2>{title || "Untitled Post"}</h2>

      {tags.length > 0 && (
        <div className="preview-tags">
          {tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}

      <div
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

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

/** Posts list with search */
function PostListView({ posts }) {
  const [query, setQuery] = useState("");

  const filtered = posts.filter((post) => {
    const q = query.toLowerCase();
    return (
      post.title.toLowerCase().includes(q) ||
      post.contentPlain.toLowerCase().includes(q)
    );
  });

  return (
    <div className="post-list-view">
      <h2>All Blog Posts</h2>
      <input
        className="search-input"
        placeholder="Search by title or content..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="no-posts">No posts found.</p>
      ) : (
        <div className="post-list">
          {filtered.map((post) => (
            <div key={post.id} className="post-card">
              <h3>{post.title || "Untitled"}</h3>
              <p className="post-snippet">{post.contentPlain.slice(0, 180)}...</p>
              <div className="post-meta">
                <span>{new Date(post.createdAt).toLocaleString()}</span>
                <div className="post-tags">
                  {post.tags.map((t) => (
                    <span key={t} className="tag-chip">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [view, setView] = useState("editor"); // "editor" | "posts"
  const [isPreview, setIsPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(""); // HTML string from Quill
  const [tags, setTags] = useState([]);
  const [images, setImages] = useState([]);

  const [posts, setPosts] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const quillRef = useRef(null);

  // Load draft & posts from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const { title, content, tags, images } = JSON.parse(savedDraft);
        setTitle(title || "");
        setContent(content || "");
        setTags(tags || []);
        setImages(images || []);
      } catch (err) {
        console.error("Failed to parse draft", err);
      }
    }

    const savedPosts = localStorage.getItem(POSTS_KEY);
    if (savedPosts) {
      try {
        setPosts(JSON.parse(savedPosts));
      } catch (err) {
        console.error("Failed to parse posts", err);
      }
    }
  }, []);

  // Persist posts whenever they change
  useEffect(() => {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  }, [posts]);

  // Auto-save draft using custom hook
  useAutoSaveDraft({ title, content, tags, images }, 30000);

  const handleFormat = (format, value) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    if (format === "header") {
      if (!value) {
        editor.format("header", false);
      } else {
        editor.format("header", value);
      }
      return;
    }

    if (format === "list") {
      editor.format("list", value);
      return;
    }

    editor.format(format, !editor.getFormat()[format]);
  };

  const handleInsertLink = (url) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection();
    if (!range) return;
    editor.format("link", url);
  };

  const handlePublish = () => {
    if (!title.trim() && !content.trim()) {
      toast.warn("Add a title or some content before publishing");
      return;
    }

    // Convert HTML to plain text for searching/snippets
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    const newPost = {
      id: Date.now(),
      title: title.trim() || "Untitled Post",
      contentHtml: content,
      contentPlain: plainText,
      tags,
      images,
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) => [newPost, ...prev]);
    toast.success("Post published!");

    // Clear draft & localStorage draft
    setTitle("");
    setContent("");
    setTags([]);
    setImages([]);
    localStorage.removeItem(DRAFT_KEY);
  };

  const draftChanged = !!(
    title.trim() ||
    content.trim() ||
    tags.length ||
    images.length
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Interactive Blog Editor</h1>
        <div className="nav-buttons">
          <button
            className={view === "editor" ? "active" : ""}
            onClick={() => setView("editor")}
          >
            Editor
          </button>
          <button
            className={view === "posts" ? "active" : ""}
            onClick={() => setView("posts")}
          >
            Posts
          </button>
        </div>
      </header>

      {view === "editor" && (
        <main className="editor-layout">
          <section className="editor-pane">
            <div className="editor-header-row">
              <input
                className="title-input"
                placeholder="Post title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <button
                type="button"
                className="preview-toggle"
                onClick={() => setIsPreview((p) => !p)}
              >
                {isPreview ? "Back to Editor" : "Preview"}
              </button>
            </div>

            {!isPreview && (
              <>
                <EditorToolbar
                  onFormat={handleFormat}
                  onShowLinkModal={() => setLinkModalOpen(true)}
                />
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={{ toolbar: false }} // we use our own toolbar
                  className="editor"
                />

                <TagSelector selectedTags={tags} onChange={setTags} />
                <ImageUploader images={images} onImagesChange={setImages} />

                <div className="editor-actions">
                  <button type="button" onClick={handlePublish}>
                    Publish Post
                  </button>
                  {draftChanged && (
                    <span className="draft-hint">
                      Draft auto-saves after 30 seconds of inactivity.
                    </span>
                  )}
                </div>
              </>
            )}

            {isPreview && (
              <PreviewPane
                title={title}
                content={content}
                tags={tags}
                images={images}
              />
            )}
          </section>
        </main>
      )}

      {view === "posts" && <PostListView posts={posts} />}

      <LinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onInsert={handleInsertLink}
      />

      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;
