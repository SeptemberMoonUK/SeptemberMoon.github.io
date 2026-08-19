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


const testimonialState = {
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


function testimonialToast(message, isError = false) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");

  clearTimeout(window.__testimonialToastTimer);

  window.__testimonialToastTimer = setTimeout(
    () => toast.classList.remove("is-visible"),
    3200
  );
}


function injectTestimonialStyles() {
  if ($("#testimonialAdminStyles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "testimonialAdminStyles";

  style.textContent = `
    .testimonial-admin-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .testimonial-admin-list {
      display: grid;
      gap: 10px;
    }

    .testimonial-admin-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 15px 16px;
      background: rgba(255, 250, 240, .97);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 5px 18px rgba(75, 37, 79, .05);
    }

    .testimonial-admin-row__quote {
      font-weight: 850;
      line-height: 1.45;
    }

    .testimonial-admin-row__customer {
      margin-top: 6px;
      color: var(--muted);
      font-size: .85rem;
    }

    .testimonial-admin-row__meta {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 8px;
    }

    .testimonial-admin-row__actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .testimonial-admin-empty {
      padding: 34px;
      text-align: center;
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: 16px;
      background: rgba(255, 250, 240, .96);
    }

    .testimonial-admin-count {
      color: var(--muted);
      font-size: .88rem;
    }

    @media (max-width: 720px) {
      .testimonial-admin-row {
        grid-template-columns: 1fr;
      }

      .testimonial-admin-row__actions {
        justify-content: flex-start;
      }
    }
  `;

  document.head.appendChild(style);
}


function injectTestimonialsAdmin() {
  if ($("#testimonialAdminPanel")) {
    return;
  }

  injectTestimonialStyles();

  const nav = $(".admin-nav");

  const settingsButton =
    nav?.querySelector('[data-tab="settings"]');

  const testimonialButton =
    document.createElement("button");

  testimonialButton.className =
    "admin-nav__item";

  testimonialButton.dataset.tab =
    "testimonials";

  testimonialButton.type =
    "button";

  testimonialButton.textContent =
    "Testimonials";


  if (settingsButton) {
    nav.insertBefore(
      testimonialButton,
      settingsButton
    );
  } else {
    nav?.appendChild(
      testimonialButton
    );
  }


  const main =
    $(".admin-main");

  const settingsPanel =
    main?.querySelector(
      '[data-panel="settings"]'
    );


  const panel =
    document.createElement("section");

  panel.id =
    "testimonialAdminPanel";

  panel.className =
    "admin-panel";

  panel.dataset.panel =
    "testimonials";


  panel.innerHTML = `
    <section class="admin-card">

      <div class="testimonial-admin-toolbar">

        <div>
          <p class="eyebrow">Homepage</p>

          <h2 style="
            margin:.15rem 0 .25rem;
            font-family:'SeptemberFont',serif;
          ">
            Testimonials
          </h2>

          <p
            id="testimonialAdminCount"
            class="testimonial-admin-count"
          >
            Loading testimonials…
          </p>
        </div>

        <div class="admin-topbar__actions">

          <a
            class="admin-btn"
            href="index.html#testimonials"
            target="_blank"
            rel="noopener"
          >
            View homepage ↗
          </a>

          <button
            id="addTestimonial"
            class="admin-btn admin-btn--primary"
            type="button"
          >
            + Add testimonial
          </button>

        </div>

      </div>

      <div
        id="testimonialAdminList"
        class="testimonial-admin-list"
      >
        <div class="testimonial-admin-empty">
          Open this section to load testimonials.
        </div>
      </div>

    </section>
  `;


  if (settingsPanel) {
    main.insertBefore(
      panel,
      settingsPanel
    );
  } else {
    main?.appendChild(panel);
  }


  const dialog =
    document.createElement("dialog");

  dialog.id =
    "testimonialDialog";

  dialog.className =
    "product-dialog";


  dialog.innerHTML = `
    <form
      id="testimonialForm"
      class="product-form"
    >

      <div class="dialog-head">

        <div>
          <p class="eyebrow">
            Testimonial editor
          </p>

          <h2 id="testimonialDialogTitle">
            Add testimonial
          </h2>
        </div>

        <button
          id="closeTestimonialDialog"
          class="icon-btn"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="form-grid">

        <label class="field">
          <span>Testimonial</span>

          <textarea
            id="testimonialQuote"
            rows="6"
            maxlength="1200"
            required
            placeholder="What did the customer say?"
          ></textarea>
        </label>


        <label class="field">
          <span>Customer / username</span>

          <input
            id="testimonialCustomer"
            maxlength="160"
            required
            placeholder="e.g. Clarabrewis31"
          >
        </label>


        <label
          class="mini-toggle"
          style="width:max-content"
        >
          <input
            id="testimonialVisible"
            type="checkbox"
            checked
          >

          <span>
            Visible on homepage
          </span>
        </label>

      </div>


      <div class="dialog-actions">

        <button
          id="deleteTestimonial"
          class="admin-btn admin-btn--danger"
          type="button"
          hidden
        >
          Delete
        </button>

        <span class="dialog-spacer"></span>

        <button
          id="cancelTestimonial"
          class="admin-btn"
          type="button"
        >
          Cancel
        </button>

        <button
          id="saveTestimonial"
          class="admin-btn admin-btn--primary"
          type="submit"
        >
          Save testimonial
        </button>

      </div>


      <p
        id="testimonialFormError"
        class="form-error"
        role="alert"
      ></p>

    </form>
  `;


  document.body.appendChild(dialog);


  testimonialButton.addEventListener(
    "click",
    async () => {

      $$(".admin-nav__item")
        .forEach((button) => {

          button.classList.toggle(
            "is-active",
            button === testimonialButton
          );
        });


      $$(".admin-panel")
        .forEach((item) => {

          item.classList.toggle(
            "is-active",
            item === panel
          );
        });


      const pageTitle =
        $("#pageTitle");

      if (pageTitle) {
        pageTitle.textContent =
          "Testimonials";
      }


      await loadTestimonialsAdmin();
    }
  );


  $("#addTestimonial")
    .addEventListener(
      "click",
      () => openTestimonialDialog()
    );


  $("#closeTestimonialDialog")
    .addEventListener(
      "click",
      () => dialog.close()
    );


  $("#cancelTestimonial")
    .addEventListener(
      "click",
      () => dialog.close()
    );


  $("#testimonialForm")
    .addEventListener(
      "submit",
      saveTestimonial
    );


  $("#deleteTestimonial")
    .addEventListener(
      "click",
      deleteCurrentTestimonial
    );
}


async function loadTestimonialsAdmin() {
  const list =
    $("#testimonialAdminList");

  const count =
    $("#testimonialAdminCount");


  if (!auth.currentUser) {
    list.innerHTML =
      '<div class="testimonial-admin-empty">Please sign in first.</div>';

    return;
  }


  list.innerHTML =
    '<div class="testimonial-admin-empty">Loading testimonials…</div>';


  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "testimonials"
        )
      );


    testimonialState.items =
      snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }))
        .sort(
          (a, b) =>
            (a.order ?? 9999) -
            (b.order ?? 9999)
        );


    count.textContent =
      `${testimonialState.items.length} testimonial${testimonialState.items.length === 1 ? "" : "s"} · ` +
      `${testimonialState.items.filter((item) => item.visible).length} visible`;


    renderTestimonialsAdmin();

  } catch (error) {
    console.error(error);

    list.innerHTML =
      `<div class="testimonial-admin-empty">${escapeHtml(
        error.message ||
        "Could not load testimonials."
      )}</div>`;
  }
}


function renderTestimonialsAdmin() {
  const list =
    $("#testimonialAdminList");


  if (!testimonialState.items.length) {
    list.innerHTML = `
      <div class="testimonial-admin-empty">
        No testimonials yet.
        Click <strong>+ Add testimonial</strong>
        to create your first one.
      </div>
    `;

    return;
  }


  list.innerHTML =
    testimonialState.items
      .map((testimonial, index) => `
        <article class="testimonial-admin-row">

          <div>

            <div class="testimonial-admin-row__quote">
              “${escapeHtml(
                testimonial.quote ||
                "Untitled testimonial"
              )}”
            </div>

            <div class="testimonial-admin-row__customer">
              — ${escapeHtml(
                testimonial.customer ||
                "Anonymous"
              )}
            </div>

            <div class="testimonial-admin-row__meta">

              <span class="mini-pill ${
                testimonial.visible
                  ? ""
                  : "mini-pill--hidden"
              }">
                ${
                  testimonial.visible
                    ? "Visible"
                    : "Hidden"
                }
              </span>

              <span class="mini-pill">
                Position ${index + 1}
              </span>

            </div>

          </div>


          <div class="testimonial-admin-row__actions">

            <button
              class="icon-action"
              type="button"
              data-testimonial-move="up"
              data-id="${escapeHtml(testimonial.id)}"
              ${index === 0 ? "disabled" : ""}
              aria-label="Move testimonial up"
            >
              ↑
            </button>

            <button
              class="icon-action"
              type="button"
              data-testimonial-move="down"
              data-id="${escapeHtml(testimonial.id)}"
              ${
                index === testimonialState.items.length - 1
                  ? "disabled"
                  : ""
              }
              aria-label="Move testimonial down"
            >
              ↓
            </button>

            <button
              class="admin-btn admin-btn--small"
              type="button"
              data-testimonial-edit="${escapeHtml(testimonial.id)}"
            >
              Edit
            </button>

          </div>

        </article>
      `)
      .join("");


  $$("[data-testimonial-edit]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => openTestimonialDialog(
          button.dataset.testimonialEdit
        )
      );
    });


  $$("[data-testimonial-move]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {
          moveTestimonial(
            button.dataset.id,
            button.dataset.testimonialMove
          );
        }
      );
    });
}


function openTestimonialDialog(id = null) {
  testimonialState.editingId =
    id;


  const testimonial =
    id
      ? testimonialState.items.find(
          (item) =>
            item.id === id
        )
      : null;


  $("#testimonialDialogTitle")
    .textContent =
    testimonial
      ? "Edit testimonial"
      : "Add testimonial";


  $("#testimonialQuote")
    .value =
    testimonial?.quote || "";


  $("#testimonialCustomer")
    .value =
    testimonial?.customer || "";


  $("#testimonialVisible")
    .checked =
    testimonial?.visible ?? true;


  $("#deleteTestimonial")
    .hidden =
    !testimonial;


  $("#testimonialFormError")
    .textContent =
    "";


  $("#testimonialDialog")
    .showModal();
}


async function saveTestimonial(event) {
  event.preventDefault();


  const quote =
    $("#testimonialQuote")
      .value
      .trim();


  const customer =
    $("#testimonialCustomer")
      .value
      .trim();


  const visible =
    $("#testimonialVisible")
      .checked;


  const saveButton =
    $("#saveTestimonial");


  if (!quote || !customer) {
    $("#testimonialFormError")
      .textContent =
      "Please enter both the testimonial and customer name.";

    return;
  }


  saveButton.disabled =
    true;

  saveButton.textContent =
    "Saving…";


  try {
    if (testimonialState.editingId) {

      await updateDoc(
        doc(
          db,
          "testimonials",
          testimonialState.editingId
        ),
        {
          quote,
          customer,
          visible,
          updatedAt:
            serverTimestamp()
        }
      );

    } else {

      const newRef =
        doc(
          collection(
            db,
            "testimonials"
          )
        );


      await setDoc(
        newRef,
        {
          quote,
          customer,
          visible,

          order:
            testimonialState.items.length,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );
    }


    $("#testimonialDialog")
      .close();


    await loadTestimonialsAdmin();


    testimonialToast(
      testimonialState.editingId
        ? "Testimonial updated."
        : "Testimonial added."
    );

  } catch (error) {
    console.error(error);

    $("#testimonialFormError")
      .textContent =
      error.message ||
      "Could not save testimonial.";

  } finally {
    saveButton.disabled =
      false;

    saveButton.textContent =
      "Save testimonial";
  }
}


async function deleteCurrentTestimonial() {
  if (!testimonialState.editingId) {
    return;
  }


  const testimonial =
    testimonialState.items.find(
      (item) =>
        item.id ===
        testimonialState.editingId
    );


  if (
    !confirm(
      `Delete testimonial from “${
        testimonial?.customer ||
        "this customer"
      }”?`
    )
  ) {
    return;
  }


  try {
    await deleteDoc(
      doc(
        db,
        "testimonials",
        testimonialState.editingId
      )
    );


    $("#testimonialDialog")
      .close();


    await loadTestimonialsAdmin();

    await persistTestimonialOrder(
      testimonialState.items
    );


    testimonialToast(
      "Testimonial deleted."
    );

  } catch (error) {
    console.error(error);

    testimonialToast(
      error.message ||
      "Could not delete testimonial.",
      true
    );
  }
}


async function moveTestimonial(
  id,
  direction
) {
  const index =
    testimonialState.items.findIndex(
      (item) =>
        item.id === id
    );


  const target =
    direction === "up"
      ? index - 1
      : index + 1;


  if (
    index < 0 ||
    target < 0 ||
    target >=
      testimonialState.items.length
  ) {
    return;
  }


  [
    testimonialState.items[index],
    testimonialState.items[target]
  ] = [
    testimonialState.items[target],
    testimonialState.items[index]
  ];


  renderTestimonialsAdmin();


  try {
    await persistTestimonialOrder(
      testimonialState.items
    );


    testimonialToast(
      "Testimonial order saved."
    );

  } catch (error) {
    console.error(error);

    testimonialToast(
      error.message ||
      "Could not save testimonial order.",
      true
    );


    await loadTestimonialsAdmin();
  }
}


async function persistTestimonialOrder(items) {
  if (!items.length) {
    return;
  }


  const batch =
    writeBatch(db);


  items.forEach(
    (item, index) => {

      item.order =
        index;


      batch.update(
        doc(
          db,
          "testimonials",
          item.id
        ),
        {
          order: index,
          updatedAt:
            serverTimestamp()
        }
      );
    }
  );


  await batch.commit();
}


injectTestimonialsAdmin();