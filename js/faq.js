import { db, firebaseConfigured } from "./firebase.js?v=3";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const statusEl = document.querySelector("#faqStatus");
const listEl = document.querySelector("#faqList");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadFaqs() {
  if (!firebaseConfigured || !db) {
    statusEl.textContent = "The FAQ is temporarily unavailable. Please try again shortly.";
    return;
  }

  try {
    const faqQuery = query(
      collection(db, "faqs"),
      where("visible", "==", true)
    );

    const snapshot = await getDocs(faqQuery);

    const faqs = snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data()
      }))
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

    if (!faqs.length) {
      statusEl.textContent = "We’re putting our FAQ together. Please check back soon.";
      return;
    }

    listEl.innerHTML = faqs.map((faq) => `
      <details class="faq-item">
        <summary>${escapeHtml(faq.question || "Question")}</summary>
        <div class="faq-item__answer">${escapeHtml(faq.answer || "")}</div>
      </details>
    `).join("");

    statusEl.hidden = true;
    listEl.hidden = false;
  } catch (error) {
    console.error("FAQ loading failed", error);
    statusEl.textContent = "We couldn’t load the FAQ just now. Please try again shortly.";
  }
}

loadFaqs();
