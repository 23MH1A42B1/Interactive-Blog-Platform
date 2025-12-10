import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";

import "react-quill/dist/quill.snow.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DOMPurify from "dompurify";

import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";




const DRAFT_KEY = "blog-draft";
const POSTS_KEY = "blog-posts";

const AVAILABLE_TAGS = []; // not used now, but kept if needed later

/* ---------- Auto-save hook ---------- */
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
        toast.info("Draft auto-saved", { autoClose: 1400, pauseOnHover: false });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save draft");
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [draft, delay]);
}

/* ---------- Login Screen ---------- */
function LoginScreen({ onLogin }) {
  const [isSignup, setIsSignup] = useState(true);
  const [name, setName] = useState(""); // just UI
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.warn("Please fill in email and password");
      return;
    }

    try {
      let cred;
      if (isSignup) {
        cred = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        cred = await signInWithEmailAndPassword(auth, email, password);
      }

      onLogin(cred.user);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo-circle">IB</div>
        <h1>{isSignup ? "Create your blog account" : "Welcome back"}</h1>
        <p className="login-subtitle">
          {isSignup
            ? "Sign up to start creating and managing your posts."
            : "Log in to continue writing and editing your posts."}
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          {isSignup && (
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                placeholder="Murali Nadipena"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="login-button">
            {isSignup ? "Sign up" : "Log in"}
          </button>

          <p
            style={{
              cursor: "pointer",
              fontSize: "0.8rem",
              marginTop: "0.75rem",
            }}
            onClick={() => setIsSignup(!isSignup)}
          >
            {isSignup
              ? "Already have an account? Log in"
              : "New here? Create an account"}
          </p>
        </form>

        <p className="login-footer">
          Secure login powered by Firebase Authentication.
        </p>
      </div>

      <div className="login-hero">
        <h2>Create, save, and share posts.</h2>
        <p>
          A clean, modern editor with rich text, tags, images, auto-save and
          live preview.
        </p>
      </div>
    </div>
  );
}

/* ---------- Editor toolbar ---------- */
function EditorToolbar({ onFormat, onShowLinkModal }) {
  const handleHeadingChange = (e) => {
    const value = e.target.value;
    if (!value) {
      onFormat("header", null); // normal
    } else {
      onFormat("header", Number(value)); // H1..H6
    }
    e.target.value = "";
  };

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

        <select onChange={handleHeadingChange} defaultValue="">
          <option value="">Normal</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
          <option value="5">H5</option>
          <option value="6">H6</option>
        </select>

        <button type="button" onClick={onShowLinkModal}>
          Insert Link
        </button>
      </div>
    </div>
  );
}

/* ---------- Link modal ---------- */
function LinkModal({ open, onClose, onInsert }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!url.trim()) {
      toast.warn("Please enter a link URL");
      return;
    }

    let finalUrl = url.trim();

    if (
      !finalUrl.startsWith("http://") &&
      !finalUrl.startsWith("https://")
    ) {
      finalUrl = "https://" + finalUrl;
    }

    onInsert(finalUrl);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Insert hyperlink</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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

/* ---------- Tag selector (free typing) ---------- */
function TagSelector({ selectedTags, onChange }) {
  const [input, setInput] = useState("");

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag) return;
    if (selectedTags.includes(tag)) return;

    onChange([...selectedTags, tag]);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && selectedTags.length) {
      onChange(selectedTags.slice(0, -1));
    }
  };

  const handleRemove = (tagToRemove) => {
    onChange(selectedTags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="tag-selector">
      <label>Tags</label>
      <div className="tag-input-wrapper">
        {selectedTags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-remove"
              onClick={() => handleRemove(tag)}
            >
              ×
            </button>
          </span>
        ))}

        <input
          className="tag-text-input"
          placeholder={
            selectedTags.length === 0
              ? "Type a tag and press Enter…"
              : "Add another tag…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <small>Press Enter or comma to add a tag.</small>
    </div>
  );
}

/* ---------- Image uploader ---------- */
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

/* ---------- Preview pane ---------- */
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

/* ---------- Posts view ---------- */
function PostListView({ posts, onSelectPost }) {
  const [query, setQuery] = useState("");

  const filtered = posts.filter((post) =>
    post.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="post-list-view">
      <h2>Your published posts</h2>

      <input
        className="search-input"
        placeholder="Search by title..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="no-posts">No posts found for this title.</p>
      ) : (
        <div className="post-list">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="post-card"
              onClick={() => onSelectPost(post)}
            >
              <h3>{post.title || "Untitled"}</h3>
              <p className="post-snippet">
                {post.contentPlain?.slice(0, 150)}
                {post.contentPlain && post.contentPlain.length > 150 ? "..." : ""}
              </p>
              <div className="post-meta">
                <span>
                  {post.createdAt
                    ? new Date(post.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Just now"}
                </span>
                <div className="post-tags">
                  {post.tags?.map((t) => (
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

/* ---------- Main App ---------- */
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("editor"); // "editor" | "posts"
  const [isPreview, setIsPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [images, setImages] = useState([]);

  const [posts, setPosts] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const quillRef = useRef(null);

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load saved draft when app opens
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (!savedDraft) return;

    try {
      const { title, content, tags, images } = JSON.parse(savedDraft);
      setTitle(title || "");
      setContent(content || "");
      setTags(tags || []);
      setImages(images || []);
    } catch (err) {
      console.error("Failed to restore draft", err);
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Load posts from localStorage on first mount
  useEffect(() => {
    const savedPosts = localStorage.getItem(POSTS_KEY);
    if (savedPosts) {
      try {
        const parsed = JSON.parse(savedPosts);
        if (Array.isArray(parsed)) {
          setPosts(parsed);
        } else {
          localStorage.removeItem(POSTS_KEY);
        }
      } catch (err) {
        console.error("Failed to parse posts", err);
        localStorage.removeItem(POSTS_KEY);
      }
    }
  }, []);

  // Persist posts whenever they change
  useEffect(() => {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  }, [posts]);

  // Auto-save draft
  useAutoSaveDraft({ title, content, tags, images }, 30000);

  const handleFormat = (format, value) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    if (format === "header") {
      editor.formatLine(
        editor.getSelection()?.index || 0,
        1,
        "header",
        value || false
      );
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

    if (!range) {
      editor.insertText(editor.getLength(), url, "link", url);
    } else if (range.length === 0) {
      editor.insertText(range.index, url, "link", url);
    } else {
      editor.format("link", url);
    }
  };

  const handlePublish = () => {
    if (!title.trim() && !content.trim()) {
      toast.warn("Add a title or some content before publishing");
      return;
    }

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

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSelectPost = (post) => {
    setTitle(post.title);
    setContent(post.contentHtml);
    setTags(post.tags || []);
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

  if (authLoading) {
    return null;
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={setUser} />
        <ToastContainer position="bottom-right" theme="light" />
      </>
    );
  }

  const userInitial =
    (user.email && user.email.charAt(0).toUpperCase()) || "U";

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">IB</div>
          <div className="logo-text">
            <span className="brand">Interactive Blog</span>
            <span className="tagline">Interactive blog editor</span>
          </div>
          <nav className="main-nav">
            <button
              className={view === "editor" ? "nav-link active" : "nav-link"}
              onClick={() => setView("editor")}
            >
              Editor
            </button>
            <button
              className={view === "posts" ? "nav-link active" : "nav-link"}
              onClick={() => setView("posts")}
            >
              Posts
            </button>
          </nav>
        </div>

        <div className="header-right">
          <button
            type="button"
            className="upload-chip"
            onClick={handleNewPostClick}
          >
            + New post
          </button>
          <div className="user-pill">
            <div className="avatar-circle">{userInitial}</div>
            <div className="user-meta">
              <span className="user-name">{user.email}</span>
              <button onClick={handleLogout} className="logout-link">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      {view === "editor" && (
        <main className="editor-layout">
          <section className="editor-pane">
            <div className="editor-header-row">
              <input
                className="title-input"
                placeholder="Give your post a catchy title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <button
                type="button"
                className="preview-toggle"
                onClick={() => setIsPreview((p) => !p)}
              >
                {isPreview ? "Back to editor" : "Preview"}
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
                  modules={{ toolbar: false }}
                  className="editor"
                  placeholder="Write your story here..."
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

      {view === "posts" && (
        <PostListView posts={posts} onSelectPost={handleSelectPost} />
      )}

      <LinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onInsert={handleInsertLink}
      />

      <ToastContainer position="bottom-right" theme="light" />
    </div>
  );
}

export default App;
