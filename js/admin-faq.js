import { auth, db } from "./firebase.js?v=3";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const faqState = {
  items: [],
  editingId: null
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function faqToast(message, isError = false) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");

  clearTimeout(window.__faqToastTimer);
  window.__faqToastTimer = setTimeout(
    () => toast.classList.remove("is-visible"),
    3200
  );
}

function injectFaqStyles() {
  if ($("#faqAdminStyles")) return;

  const style = document.createElement("style");
  style.id = "faqAdminStyles";
  style.textContent = `
    .faq-admin-toolbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      flex-wrap:wrap;
      margin-bottom:14px;
    }
    .faq-admin-list{display:grid;gap:10px}
    .faq-admin-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:14px;
      align-items:center;
      padding:15px 16px;
      background:rgba(255,250,240,.97);
      border:1px solid var(--line);
      border-radius:14px;
      box-shadow:0 5px 18px rgba(75,37,79,.05);
    }
    .faq-admin-row__question{font-weight:850;line-height:1.35}
    .faq-admin-row__answer{
      margin-top:5px;
      color:var(--muted);
      font-size:.84rem;
      line-height:1.45;
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
    }
    .faq-admin-row__meta{
      display:flex;
      gap:7px;
      flex-wrap:wrap;
      align-items:center;
      margin-top:8px;
    }
    .faq-admin-row__actions{
      display:flex;
      align-items:center;
      gap:6px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .faq-admin-empty{
      padding:34px;
      text-align:center;
      color:var(--muted);
      border:1px dashed var(--line);
      border-radius:16px;
      background:rgba(255,250,240,.96);
    }
    .faq-admin-count{
      color:var(--muted);
      font-size:.88rem;
    }
    @media(max-width:720px){
      .faq-admin-row{grid-template-columns:1fr}
      .faq-admin-row__actions{justify-content:flex-start}
    }
  `;
  document.head.appendChild(style);
}

function injectFaqAdmin() {
  if ($("#faqAdminPanel")) return;

  injectFaqStyles();

  const nav = $(".admin-nav");
  const settingsButton = nav?.querySelector('[data-tab="settings"]');

  const faqButton = document.createElement("button");
  faqButton.className = "admin-nav__item";
  faqButton.dataset.tab = "faqs";
  faqButton.type = "button";
  faqButton.textContent = "FAQ";

  if (settingsButton) {
    nav.insertBefore(faqButton, settingsButton);
  } else {
    nav?.appendChild(faqButton);
  }

  const main = $(".admin-main");
  const settingsPanel = main?.querySelector('[data-panel="settings"]');

  const panel = document.createElement("section");
  panel.id = "faqAdminPanel";
  panel.className = "admin-panel";
  panel.dataset.panel = "faqs";
  panel.innerHTML = `
    <section class="admin-card">
      <div class="faq-admin-toolbar">
        <div>
          <p class="eyebrow">Public page</p>
          <h2 style="margin:.15rem 0 .25rem;font-family:'SeptemberFont',serif;">Frequently Asked Questions</h2>
          <p class="faq-admin-count" id="faqAdminCount">Loading FAQs…</p>
        </div>
        <div class="admin-topbar__actions">
          <a class="admin-btn" href="faq.html" target="_blank" rel="noopener">View FAQ page ↗</a>
          <button id="addFaq" class="admin-btn admin-btn--primary" type="button">+ Add FAQ</button>
        </div>
      </div>
      <div id="faqAdminList" class="faq-admin-list">
        <div class="faq-admin-empty">Open this section to load your FAQs.</div>
      </div>
    </section>
  `;

  if (settingsPanel) {
    main.insertBefore(panel, settingsPanel);
  } else {
    main?.appendChild(panel);
  }

  const dialog = document.createElement("dialog");
  dialog.id = "faqDialog";
  dialog.className = "product-dialog";
  dialog.innerHTML = `
    <form id="faqForm" class="product-form">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">FAQ editor</p>
          <h2 id="faqDialogTitle">Add FAQ</h2>
        </div>
        <button id="closeFaqDialog" class="icon-btn" type="button" aria-label="Close">×</button>
      </div>

      <div class="form-grid">
        <label class="field">
          <span>Question</span>
          <input id="faqQuestion" maxlength="220" required placeholder="e.g. How long does delivery take?">
        </label>

        <label class="field">
          <span>Answer</span>
          <textarea id="faqAnswer" rows="8" maxlength="3000" required placeholder="Write the answer visitors should see…"></textarea>
        </label>

        <label class="mini-toggle" style="width:max-content">
          <input id="faqVisible" type="checkbox" checked>
          <span>Visible on FAQ page</span>
        </label>
      </div>

      <div class="dialog-actions">
        <button id="deleteFaq" class="admin-btn admin-btn--danger" type="button" hidden>Delete</button>
        <span class="dialog-spacer"></span>
        <button id="cancelFaq" class="admin-btn" type="button">Cancel</button>
        <button id="saveFaq" class="admin-btn admin-btn--primary" type="submit">Save FAQ</button>
      </div>

      <p id="faqFormError" class="form-error" role="alert"></p>
    </form>
  `;

  document.body.appendChild(dialog);

  faqButton.addEventListener("click", async () => {
    $$(".admin-nav__item").forEach((button) => {
      button.classList.toggle("is-active", button === faqButton);
    });

    $$(".admin-panel").forEach((item) => {
      item.classList.toggle("is-active", item === panel);
    });

    const pageTitle = $("#pageTitle");
    if (pageTitle) pageTitle.textContent = "FAQ";

    await loadFaqAdmin();
  });

  $("#addFaq").addEventListener("click", () => openFaqDialog());
  $("#closeFaqDialog").addEventListener("click", () => dialog.close());
  $("#cancelFaq").addEventListener("click", () => dialog.close());
  $("#faqForm").addEventListener("submit", saveFaq);
  $("#deleteFaq").addEventListener("click", deleteCurrentFaq);
}

async function loadFaqAdmin() {
  const list = $("#faqAdminList");
  const count = $("#faqAdminCount");

  if (!auth.currentUser) {
    list.innerHTML = '<div class="faq-admin-empty">Please sign in first.</div>';
    return;
  }

  list.innerHTML = '<div class="faq-admin-empty">Loading FAQs…</div>';

  try {
    const snapshot = await getDocs(collection(db, "faqs"));

    faqState.items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

    count.textContent =
      `${faqState.items.length} FAQ${faqState.items.length === 1 ? "" : "s"} · ` +
      `${faqState.items.filter((item) => item.visible).length} visible`;

    renderFaqAdmin();
  } catch (error) {
    console.error(error);
    list.innerHTML = `<div class="faq-admin-empty">${escapeHtml(error.message || "Could not load FAQs.")}</div>`;
  }
}

function renderFaqAdmin() {
  const list = $("#faqAdminList");

  if (!faqState.items.length) {
    list.innerHTML = `
      <div class="faq-admin-empty">
        No FAQs yet. Click <strong>+ Add FAQ</strong> to create your first one.
      </div>
    `;
    return;
  }

  list.innerHTML = faqState.items.map((faq, index) => `
    <article class="faq-admin-row">
      <div>
        <div class="faq-admin-row__question">${escapeHtml(faq.question || "Untitled question")}</div>
        <div class="faq-admin-row__answer">${escapeHtml(faq.answer || "")}</div>
        <div class="faq-admin-row__meta">
          <span class="mini-pill ${faq.visible ? "" : "mini-pill--hidden"}">
            ${faq.visible ? "Visible" : "Hidden"}
          </span>
          <span class="mini-pill">Position ${index + 1}</span>
        </div>
      </div>

      <div class="faq-admin-row__actions">
        <button class="icon-action" type="button" data-faq-move="up" data-id="${escapeHtml(faq.id)}" ${index === 0 ? "disabled" : ""} aria-label="Move FAQ up">↑</button>
        <button class="icon-action" type="button" data-faq-move="down" data-id="${escapeHtml(faq.id)}" ${index === faqState.items.length - 1 ? "disabled" : ""} aria-label="Move FAQ down">↓</button>
        <button class="admin-btn admin-btn--small" type="button" data-faq-edit="${escapeHtml(faq.id)}">Edit</button>
      </div>
    </article>
  `).join("");

  $$("[data-faq-edit]").forEach((button) => {
    button.addEventListener("click", () => openFaqDialog(button.dataset.faqEdit));
  });

  $$("[data-faq-move]").forEach((button) => {
    button.addEventListener("click", () => {
      moveFaq(button.dataset.id, button.dataset.faqMove);
    });
  });
}

function openFaqDialog(id = null) {
  faqState.editingId = id;
  const faq = id ? faqState.items.find((item) => item.id === id) : null;

  $("#faqDialogTitle").textContent = faq ? "Edit FAQ" : "Add FAQ";
  $("#faqQuestion").value = faq?.question || "";
  $("#faqAnswer").value = faq?.answer || "";
  $("#faqVisible").checked = faq?.visible ?? true;
  $("#deleteFaq").hidden = !faq;
  $("#faqFormError").textContent = "";

  $("#faqDialog").showModal();
}

async function saveFaq(event) {
  event.preventDefault();

  const question = $("#faqQuestion").value.trim();
  const answer = $("#faqAnswer").value.trim();
  const visible = $("#faqVisible").checked;
  const saveButton = $("#saveFaq");

  if (!question || !answer) {
    $("#faqFormError").textContent = "Please enter both a question and an answer.";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving…";

  try {
    if (faqState.editingId) {
      await updateDoc(doc(db, "faqs", faqState.editingId), {
        question,
        answer,
        visible,
        updatedAt: serverTimestamp()
      });
    } else {
      const newRef = doc(collection(db, "faqs"));

      await setDoc(newRef, {
        question,
        answer,
        visible,
        order: faqState.items.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    $("#faqDialog").close();
    await loadFaqAdmin();
    faqToast(faqState.editingId ? "FAQ updated." : "FAQ added.");
  } catch (error) {
    console.error(error);
    $("#faqFormError").textContent = error.message || "Could not save FAQ.";
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save FAQ";
  }
}

async function deleteCurrentFaq() {
  if (!faqState.editingId) return;

  const faq = faqState.items.find((item) => item.id === faqState.editingId);

  if (!confirm(`Delete “${faq?.question || "this FAQ"}”?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "faqs", faqState.editingId));
    $("#faqDialog").close();
    await loadFaqAdmin();
    await persistFaqOrder(faqState.items);
    faqToast("FAQ deleted.");
  } catch (error) {
    console.error(error);
    faqToast(error.message || "Could not delete FAQ.", true);
  }
}

async function moveFaq(id, direction) {
  const index = faqState.items.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= faqState.items.length) {
    return;
  }

  [faqState.items[index], faqState.items[target]] =
    [faqState.items[target], faqState.items[index]];

  renderFaqAdmin();

  try {
    await persistFaqOrder(faqState.items);
    faqToast("FAQ order saved.");
  } catch (error) {
    console.error(error);
    faqToast(error.message || "Could not save FAQ order.", true);
    await loadFaqAdmin();
  }
}

async function persistFaqOrder(items) {
  if (!items.length) return;

  const batch = writeBatch(db);

  items.forEach((item, index) => {
    item.order = index;
    batch.update(doc(db, "faqs", item.id), {
      order: index,
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

injectFaqAdmin();
