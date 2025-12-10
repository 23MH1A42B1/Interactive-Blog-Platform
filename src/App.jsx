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
const USER_KEY = "blog-user";

const AVAILABLE_TAGS = ["Tech", "Life", "Tutorial", "Opinion", "Career", "News"];

/* ---------- Auto-save hook ---------- */
// Auto-save draft every 30 seconds
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
        localStorage.setItem("blog-draft", JSON.stringify(draft));
        toast.info("Draft auto-saved", { autoClose: 1400, pauseOnHover: false });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save draft");
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [draft, delay]);
}


/* ---------- Dribbble-style Login Screen ---------- */
function LoginScreen({ onLogin }) {
  const [isSignup, setIsSignup] = useState(true);
  const [name, setName] = useState("");
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
        // sign up new user
        cred = await createUserWithEmailAndPassword(auth, email, password);
        // name is optional extra info – you can later store it in Firestore/profile
      } else {
        // login existing user
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
        <h1>
          {isSignup ? "Create your blog account" : "Welcome back"}
        </h1>
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
          A clean, modern editor with rich text, tags, images, auto-save and live preview.
        </p>
      </div>
    </div>
  );
}


/* ---------- Editor toolbar ---------- */
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

/* ---------- Link modal ---------- */
function LinkModal({ open, onClose, onInsert }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  if (!open) return null;

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

    onLogin(cred.user); // tells App user logged in
  } catch (err) {
    toast.error(err.message);
  }
};


  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Insert hyperlink</h3>
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

/* ---------- Tag selector ---------- */
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

  // 🔎 Filter posts only by title
  const filtered = posts.filter((post) =>
    post.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="post-list-view">
      <h2>Your published posts</h2>

      {/* 🔍 Search bar */}
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
                  {new Date(post.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
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

  // Load user, draft & posts on first mount
  // Listen for real Firebase login/logout
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

    console.log("Draft restored ✔");
  } catch (err) {
    console.error("Failed to restore draft", err);
    localStorage.removeItem(DRAFT_KEY);
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
      editor.format("header", value || false);
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



  // If not logged in, show login screen only
  if (!user) {
    return (
      <>
        <LoginScreen onLogin={setUser} />
        <ToastContainer position="bottom-right" theme="light" />
      </>
    );
  }

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
            onClick={() => setView("editor")}
          >
            + New post
          </button>
          <div className="user-pill">
            <div className="avatar-circle">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="user-meta">
              <span className="user-name">{user.name}</span>
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

      {view === "posts" && <PostListView posts={posts} onSelectPost={handleSelectPost} />}

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
