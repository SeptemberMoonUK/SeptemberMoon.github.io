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


const filterState = {
  items: [],
  groups: [],
  editingId: null,
  editingGroupId: null
};


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function filterToast(message, isError = false) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");

  clearTimeout(window.__filterToastTimer);

  window.__filterToastTimer = setTimeout(
    () => toast.classList.remove("is-visible"),
    3200
  );
}


function injectFilterStyles() {
  if ($("#filterAdminStyles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "filterAdminStyles";

  style.textContent = `
    .filter-admin-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .filter-admin-list {
      display: grid;
      gap: 10px;
    }

    .filter-admin-row {
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

    .filter-admin-row__name {
      font-weight: 850;
      font-size: 1rem;
    }

    .filter-admin-row__meta {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 8px;
    }

    .filter-admin-row__actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .filter-admin-empty {
      padding: 34px;
      text-align: center;
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: 16px;
      background: rgba(255, 250, 240, .96);
    }

    .filter-admin-count {
      color: var(--muted);
      font-size: .88rem;
    }

    @media (max-width: 720px) {
      .filter-admin-row {
        grid-template-columns: 1fr;
      }

      .filter-admin-row__actions {
        justify-content: flex-start;
      }
    }
  `;

  document.head.appendChild(style);
}


function injectFiltersAdmin() {
  if ($("#filterAdminPanel")) {
    return;
  }

  injectFilterStyles();


  // ---------------------------------------------------------
  // Add Filters button to the admin navigation
  // ---------------------------------------------------------

  const nav = $(".admin-nav");

  const settingsButton =
    nav?.querySelector('[data-tab="settings"]');

  const filterButton =
    document.createElement("button");

  filterButton.className =
    "admin-nav__item";

  filterButton.dataset.tab =
    "filters";

  filterButton.type =
    "button";

  filterButton.textContent =
    "Filters";


  if (settingsButton) {
    nav.insertBefore(
      filterButton,
      settingsButton
    );
  } else {
    nav?.appendChild(filterButton);
  }


  // ---------------------------------------------------------
  // Create Filters admin panel
  // ---------------------------------------------------------

  const main =
    $(".admin-main");

  const settingsPanel =
    main?.querySelector(
      '[data-panel="settings"]'
    );

  const panel =
    document.createElement("section");

  panel.id =
    "filterAdminPanel";

  panel.className =
    "admin-panel";

  panel.dataset.panel =
    "filters";


  panel.innerHTML = `
    <section class="admin-card">

      <div class="filter-admin-toolbar">

        <div>
          <p class="eyebrow">
            Collections
          </p>

          <h2 style="
            margin:.15rem 0 .25rem;
            font-family:'SeptemberFont',serif;
          ">
            Product Filters
          </h2>

          <p
            id="filterAdminCount"
            class="filter-admin-count"
          >
            Loading filters…
          </p>
        </div>


        <div style="
  display:flex;
  gap:8px;
  flex-wrap:wrap;
">

  <button
    id="addFilterGroup"
    class="admin-btn"
    type="button"
  >
    + Add section
  </button>

  <button
    id="addFilter"
    class="admin-btn admin-btn--primary"
    type="button"
  >
    + Add filter
  </button>

</div>

<div style="margin:8px 0 24px;">

  <h3 style="margin:0 0 10px;">
    Sections
  </h3>

  <div
    id="filterGroupList"
    class="filter-admin-list"
  >
    <div class="filter-admin-empty">
      No sections yet.
    </div>
  </div>

</div>


<h3 style="margin:0 0 10px;">
  Filters
</h3>

      <div
        id="filterAdminList"
        class="filter-admin-list"
      >
        <div class="filter-admin-empty">
          Open this section to load your filters.
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


  // ---------------------------------------------------------
  // Create Add/Edit Filter popup
  // ---------------------------------------------------------

  const dialog =
    document.createElement("dialog");

  dialog.id =
    "filterDialog";

  dialog.className =
    "product-dialog";


  dialog.innerHTML = `
    <form
      id="filterForm"
      class="product-form"
    >

      <div class="dialog-head">

        <div>
          <p class="eyebrow">
            Product filter
          </p>

          <h2 id="filterDialogTitle">
            Add filter
          </h2>
        </div>

        <button
          id="closeFilterDialog"
          class="icon-btn"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>


      <div class="form-grid">

        <label class="field">

          <span>Filter name</span>

          <input
            id="filterName"
            maxlength="120"
            required
            placeholder="e.g. Puffy Full Circle Dresses"
          >

        </label>


        <label
          class="mini-toggle"
          style="width:max-content"
        >

          <input
            id="filterVisible"
            type="checkbox"
            checked
          >

          <span>
            Show this filter to customers
          </span>

        </label>

      </div>


      <div class="dialog-actions">

        <button
          id="deleteFilter"
          class="admin-btn admin-btn--danger"
          type="button"
          hidden
        >
          Delete
        </button>

        <span class="dialog-spacer"></span>

        <button
          id="cancelFilter"
          class="admin-btn"
          type="button"
        >
          Cancel
        </button>

        <button
          id="saveFilter"
          class="admin-btn admin-btn--primary"
          type="submit"
        >
          Save filter
        </button>

      </div>


      <p
        id="filterFormError"
        class="form-error"
        role="alert"
      ></p>

    </form>
  `;


  document.body.appendChild(dialog);

  const groupDialog =
  document.createElement("dialog");

groupDialog.id =
  "filterGroupDialog";

groupDialog.className =
  "product-dialog";


groupDialog.innerHTML = `
  <form
    id="filterGroupForm"
    class="product-form"
  >

    <div class="dialog-head">

      <div>
        <p class="eyebrow">
          Filter section
        </p>

        <h2 id="filterGroupDialogTitle">
          Add section
        </h2>
      </div>

      <button
        id="closeFilterGroupDialog"
        class="icon-btn"
        type="button"
        aria-label="Close"
      >
        ×
      </button>

    </div>


    <div class="form-grid">

      <label class="field">

        <span>Section name</span>

        <input
          id="filterGroupName"
          maxlength="120"
          required
          placeholder="e.g. Colour"
        >

      </label>


      <label
        class="mini-toggle"
        style="width:max-content"
      >

        <input
          id="filterGroupVisible"
          type="checkbox"
          checked
        >

        <span>
          Show this section to customers
        </span>

      </label>

    </div>


    <div class="dialog-actions">

      <button
        id="deleteFilterGroup"
        class="admin-btn admin-btn--danger"
        type="button"
        hidden
      >
        Delete
      </button>

      <span class="dialog-spacer"></span>

      <button
        id="cancelFilterGroup"
        class="admin-btn"
        type="button"
      >
        Cancel
      </button>

      <button
        id="saveFilterGroup"
        class="admin-btn admin-btn--primary"
        type="submit"
      >
        Save section
      </button>

    </div>


    <p
      id="filterGroupFormError"
      class="form-error"
      role="alert"
    ></p>

  </form>
`;


document.body.appendChild(
  groupDialog
);


  // ---------------------------------------------------------
  // Events
  // ---------------------------------------------------------

  filterButton.addEventListener(
    "click",
    async () => {

      $$(".admin-nav__item")
        .forEach((button) => {

          button.classList.toggle(
            "is-active",
            button === filterButton
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
          "Filters";
      }


      await loadFiltersAdmin();
    }
  );

  $("#addFilterGroup").addEventListener(
  "click",
  () => openFilterGroupDialog()
);


$("#closeFilterGroupDialog").addEventListener(
  "click",
  () => groupDialog.close()
);


$("#cancelFilterGroup").addEventListener(
  "click",
  () => groupDialog.close()
);


$("#filterGroupForm").addEventListener(
  "submit",
  saveFilterGroup
);


$("#deleteFilterGroup").addEventListener(
  "click",
  deleteCurrentFilterGroup
);

  $("#addFilter").addEventListener(
    "click",
    () => openFilterDialog()
  );


  $("#closeFilterDialog").addEventListener(
    "click",
    () => dialog.close()
  );


  $("#cancelFilter").addEventListener(
    "click",
    () => dialog.close()
  );


  $("#filterForm").addEventListener(
    "submit",
    saveFilter
  );


  $("#deleteFilter").addEventListener(
    "click",
    deleteCurrentFilter
  );
}

async function loadFilterGroups() {
  const snapshot =
    await getDocs(
      collection(
        db,
        "filterGroups"
      )
    );

  filterState.groups =
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
}

// ============================================================
// Load filters from Firestore
// ============================================================

async function loadFiltersAdmin() {
  const list =
    $("#filterAdminList");

  const count =
    $("#filterAdminCount");


  if (!auth.currentUser) {
    list.innerHTML =
      '<div class="filter-admin-empty">Please sign in first.</div>';

    return;
  }


  list.innerHTML =
    '<div class="filter-admin-empty">Loading filters…</div>';


  try {

    const [
  snapshot
] =
  await Promise.all([
    getDocs(
      collection(
        db,
        "productFilters"
      )
    ),

    loadFilterGroups()
  ]);


    filterState.items =
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
      `${filterState.items.length} filter${filterState.items.length === 1 ? "" : "s"} · ` +
      `${filterState.items.filter((item) => item.visible).length} visible`;


    renderFiltersAdmin();
    renderFilterGroupsAdmin();

  } catch (error) {

    console.error(error);

    list.innerHTML =
      `<div class="filter-admin-empty">${escapeHtml(
        error.message ||
        "Could not load filters."
      )}</div>`;
  }
}


// ============================================================
// Render filters
// ============================================================

function renderFiltersAdmin() {
  const list =
    $("#filterAdminList");


  if (!filterState.items.length) {

    list.innerHTML = `
      <div class="filter-admin-empty">

        No product filters yet.

        Click <strong>+ Add filter</strong>
        to create your first one.

      </div>
    `;

    return;
  }


  list.innerHTML =
    filterState.items
      .map((filter, index) => `

        <article class="filter-admin-row">

          <div>

            <div class="filter-admin-row__name">
              ${escapeHtml(
                filter.name ||
                "Untitled filter"
              )}
            </div>


            <div class="filter-admin-row__meta">

              <span class="mini-pill ${
                filter.visible
                  ? ""
                  : "mini-pill--hidden"
              }">

                ${
                  filter.visible
                    ? "Visible"
                    : "Hidden"
                }

              </span>


              <span class="mini-pill">
                Position ${index + 1}
              </span>

            </div>

          </div>


          <div class="filter-admin-row__actions">

            <button
              class="icon-action"
              type="button"
              data-filter-move="up"
              data-id="${escapeHtml(filter.id)}"
              ${index === 0 ? "disabled" : ""}
              aria-label="Move filter up"
            >
              ↑
            </button>


            <button
              class="icon-action"
              type="button"
              data-filter-move="down"
              data-id="${escapeHtml(filter.id)}"
              ${
                index === filterState.items.length - 1
                  ? "disabled"
                  : ""
              }
              aria-label="Move filter down"
            >
              ↓
            </button>


            <button
              class="admin-btn admin-btn--small"
              type="button"
              data-filter-edit="${escapeHtml(filter.id)}"
            >
              Edit
            </button>

          </div>

        </article>

      `)
      .join("");


  $$("[data-filter-edit]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          openFilterDialog(
            button.dataset.filterEdit
          );

        }
      );

    });


  $$("[data-filter-move]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          moveFilter(
            button.dataset.id,
            button.dataset.filterMove
          );

        }
      );

    });
}


// ============================================================
// Open Add/Edit filter
// ============================================================

function openFilterDialog(id = null) {
  filterState.editingId =
    id;


  const filter =
    id
      ? filterState.items.find(
          (item) =>
            item.id === id
        )
      : null;


  $("#filterDialogTitle")
    .textContent =
    filter
      ? "Edit filter"
      : "Add filter";


  $("#filterName")
    .value =
    filter?.name || "";


  $("#filterVisible")
    .checked =
    filter?.visible ?? true;


  $("#deleteFilter")
    .hidden =
    !filter;


  $("#filterFormError")
    .textContent =
    "";


  $("#filterDialog")
    .showModal();
}


// ============================================================
// Save filter
// ============================================================

async function saveFilter(event) {
  event.preventDefault();


  const name =
    $("#filterName")
      .value
      .trim();


  const visible =
    $("#filterVisible")
      .checked;


  const saveButton =
    $("#saveFilter");


  if (!name) {

    $("#filterFormError")
      .textContent =
      "Please enter a filter name.";

    return;
  }


  saveButton.disabled =
    true;

  saveButton.textContent =
    "Saving…";


  try {

    if (filterState.editingId) {

      await updateDoc(
        doc(
          db,
          "productFilters",
          filterState.editingId
        ),
        {
          name,
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
            "productFilters"
          )
        );


      await setDoc(
        newRef,
        {
          name,
          visible,

          order:
            filterState.items.length,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );

    }


    $("#filterDialog")
      .close();


    await loadFiltersAdmin();


    filterToast(
      filterState.editingId
        ? "Filter updated."
        : "Filter added."
    );

  } catch (error) {

    console.error(error);

    $("#filterFormError")
      .textContent =
      error.message ||
      "Could not save filter.";

  } finally {

    saveButton.disabled =
      false;

    saveButton.textContent =
      "Save filter";

  }
}


// ============================================================
// Delete filter
// ============================================================

async function deleteCurrentFilter() {
  if (!filterState.editingId) {
    return;
  }


  const filter =
    filterState.items.find(
      (item) =>
        item.id ===
        filterState.editingId
    );


  if (
    !confirm(
      `Delete the filter “${
        filter?.name ||
        "this filter"
      }”?`
    )
  ) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "productFilters",
        filterState.editingId
      )
    );


    $("#filterDialog")
      .close();


    await loadFiltersAdmin();


    await persistFilterOrder(
      filterState.items
    );


    filterToast(
      "Filter deleted."
    );

  } catch (error) {

    console.error(error);

    filterToast(
      error.message ||
      "Could not delete filter.",
      true
    );

  }
}


// ============================================================
// Move filters up/down
// ============================================================

async function moveFilter(
  id,
  direction
) {
  const index =
    filterState.items.findIndex(
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
      filterState.items.length
  ) {
    return;
  }


  [
    filterState.items[index],
    filterState.items[target]
  ] = [
    filterState.items[target],
    filterState.items[index]
  ];


  renderFiltersAdmin();


  try {

    await persistFilterOrder(
      filterState.items
    );


    filterToast(
      "Filter order saved."
    );

  } catch (error) {

    console.error(error);

    filterToast(
      error.message ||
      "Could not save filter order.",
      true
    );


    await loadFiltersAdmin();

  }
}


// ============================================================
// Save ordering
// ============================================================

async function persistFilterOrder(items) {
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
          "productFilters",
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

// ============================================================
// Filter groups / sections
// ============================================================

function renderFilterGroupsAdmin() {
  const list =
    $("#filterGroupList");

  if (!list) {
    return;
  }


  if (!filterState.groups.length) {
    list.innerHTML = `
      <div class="filter-admin-empty">
        No sections yet.
        Click <strong>+ Add section</strong>
        to create one.
      </div>
    `;

    return;
  }


  list.innerHTML =
    filterState.groups
      .map((group, index) => `

        <article class="filter-admin-row">

          <div>

            <div class="filter-admin-row__name">
              ${escapeHtml(
                group.name ||
                "Untitled section"
              )}
            </div>

            <div class="filter-admin-row__meta">

              <span class="mini-pill ${
                group.visible
                  ? ""
                  : "mini-pill--hidden"
              }">

                ${
                  group.visible
                    ? "Visible"
                    : "Hidden"
                }

              </span>

              <span class="mini-pill">
                Position ${index + 1}
              </span>

            </div>

          </div>


          <div class="filter-admin-row__actions">

            <button
              class="admin-btn admin-btn--small"
              type="button"
              data-group-edit="${escapeHtml(group.id)}"
            >
              Edit
            </button>

          </div>

        </article>

      `)
      .join("");


  $$("[data-group-edit]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {
          openFilterGroupDialog(
            button.dataset.groupEdit
          );
        }
      );

    });
}


function openFilterGroupDialog(id = null) {
  filterState.editingGroupId =
    id;


  const group =
    id
      ? filterState.groups.find(
          (item) =>
            item.id === id
        )
      : null;


  $("#filterGroupDialogTitle")
    .textContent =
    group
      ? "Edit section"
      : "Add section";


  $("#filterGroupName")
    .value =
    group?.name || "";


  $("#filterGroupVisible")
    .checked =
    group?.visible ?? true;


  $("#deleteFilterGroup")
    .hidden =
    !group;


  $("#filterGroupFormError")
    .textContent =
    "";


  $("#filterGroupDialog")
    .showModal();
}


async function saveFilterGroup(event) {
  event.preventDefault();


  const name =
    $("#filterGroupName")
      .value
      .trim();


  const visible =
    $("#filterGroupVisible")
      .checked;


  const saveButton =
    $("#saveFilterGroup");


  if (!name) {
    $("#filterGroupFormError")
      .textContent =
      "Please enter a section name.";

    return;
  }


  saveButton.disabled =
    true;

  saveButton.textContent =
    "Saving…";


  try {

    if (filterState.editingGroupId) {

      await updateDoc(
        doc(
          db,
          "filterGroups",
          filterState.editingGroupId
        ),
        {
          name,
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
            "filterGroups"
          )
        );


      await setDoc(
        newRef,
        {
          name,
          visible,

          order:
            filterState.groups.length,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );

    }


    $("#filterGroupDialog")
      .close();


    await loadFilterGroups();

    renderFilterGroupsAdmin();


    filterToast(
      filterState.editingGroupId
        ? "Section updated."
        : "Section added."
    );

  } catch (error) {

    console.error(error);

    $("#filterGroupFormError")
      .textContent =
      error.message ||
      "Could not save section.";

  } finally {

    saveButton.disabled =
      false;

    saveButton.textContent =
      "Save section";

  }
}


async function deleteCurrentFilterGroup() {
  if (!filterState.editingGroupId) {
    return;
  }


  const group =
    filterState.groups.find(
      (item) =>
        item.id ===
        filterState.editingGroupId
    );


  if (
    !confirm(
      `Delete the section “${
        group?.name ||
        "this section"
      }”?`
    )
  ) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "filterGroups",
        filterState.editingGroupId
      )
    );


    $("#filterGroupDialog")
      .close();


    await loadFilterGroups();

    renderFilterGroupsAdmin();


    filterToast(
      "Section deleted."
    );

  } catch (error) {

    console.error(error);

    filterToast(
      error.message ||
      "Could not delete section.",
      true
    );

  }
}

injectFiltersAdmin();