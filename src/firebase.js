// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔑 Your Firebase config (use exactly what console shows)
const firebaseConfig = {
  apiKey: "AIzaSyBOQosTi457jS_OEW0rsSno_qXfJ0Oh13M",
  authDomain: "interactive-blog-platform.firebaseapp.com",
  projectId: "interactive-blog-platform",
  storageBucket: "interactive-blog-platform.firebasestorage.app",
  messagingSenderId: "240767176264",
  appId: "1:240767176264:web:78c91298a8e34e6e90527d",
  // measurementId is optional for analytics – we don't need it here
  // measurementId: "G-0W10CVE147",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Export what the rest of the app uses
export const auth = getAuth(app);
export const db = getFirestore(app);
