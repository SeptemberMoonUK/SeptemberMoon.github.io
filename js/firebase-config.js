// Paste the Firebase web-app configuration from Firebase Console > Project settings > Your apps.
// This config is safe to ship in browser code; access control is enforced by Firebase Security Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyCzFRt0oHT5SYqmAtTu1bpS61nMa9zxldc",
  authDomain: "september-moon.firebaseapp.com",
  projectId: "september-moon",
  storageBucket: "september-moon.firebasestorage.app",
  messagingSenderId: "572285773667",
  appId: "1:572285773667:web:e16f8950a35e0428b25556"
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("PASTE_") &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.startsWith("PASTE_")
);
