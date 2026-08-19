import { auth, db, firebaseConfigured } from "./firebase.js?v=3";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];


const state = {
  user: null,
  products: [],
  settings: {},
  productFilter: "in-stock",
  productSearch: "",
  editingId: null,
  dragId: null,
  authorised: false
};


// ============================================================
// GitHub image upload configuration
// ============================================================

const IMAGE_UPLOAD_ENDPOINT =
  "https://september-moon-image-upload.septembermoonclothing.workers.dev";

const GITHUB_IMAGES_API =
  "https://api.github.com/repos/SeptemberMoonUK/SeptemberMoon.github.io/contents/images/forsale?ref=main";


// ============================================================
// Main elements
// ============================================================

const setupRequired = $("#setupRequired");
const loginView = $("#loginView");
const unauthorisedView = $("#unauthorisedView");
const adminApp = $("#adminApp");
const toastEl = $("#toast");

let toastTimer;


// ============================================================
// General helpers
// ============================================================

function showOnly(element) {
  [setupRequired, loginView, unauthorisedView, adminApp].forEach((item) => {
    item.hidden = item !== element;
  });
}


function toast(message, isError = false) {
  clearTimeout(toastTimer);

  toastEl.textContent = message;
  toastEl.classList.toggle("is-error", isError);
  toastEl.classList.add("is-visible");

  toastTimer = setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, 3200);
}


function errorMessage(error) {
  console.error(error);

  return (
    error?.message?.replace(/^Firebase:\s*/i, "") ||
    "Something went wrong."
  );
}


function money(value) {
  const number = Number(value || 0);

  return `£${
    Number.isInteger(number)
      ? number
      : number.toFixed(2)
  }`;
}


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ============================================================
// Navigation
// ============================================================

function setTab(tab) {
  $$(".admin-nav__item").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.tab === tab
    );
  });

  $$(".admin-panel").forEach((panel) => {
    panel.classList.toggle(
      "is-active",
      panel.dataset.panel === tab
    );
  });

  const titles = {
    overview: "Overview",
    products: "Products",
    images: "Images",
    settings: "Site settings"
  };

  $("#pageTitle").textContent = titles[tab] || "Admin";

  if (tab === "images") {
    loadImages();
  }
}


// ============================================================
// Google login
// ============================================================

async function handleLogin() {
  $("#loginError").textContent = "";

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account"
  });

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (
      [
        "auth/popup-blocked",
        "auth/cancelled-popup-request"
      ].includes(error.code)
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }

    if (error.code !== "auth/popup-closed-by-user") {
      $("#loginError").textContent = errorMessage(error);
    }
  }
}


async function checkAdmin(user) {
  try {
    const adminDoc = await getDoc(
      doc(db, "admins", user.uid)
    );

    return adminDoc.exists();
  } catch (error) {
    console.error("Admin check failed", error);
    return false;
  }
}


async function initialiseAdmin(user) {
  state.user = user;
  state.authorised = true;

  showOnly(adminApp);

  $("#userName").textContent =
    user.displayName || "Admin";

  $("#userEmail").textContent =
    user.email || "";

  if (user.photoURL) {
    $("#userAvatar").src = user.photoURL;
    $("#userAvatar").hidden = false;
  }

  await Promise.all([
    loadProducts(),
    loadSettings()
  ]);
}


// ============================================================
// Products
// ============================================================

async function loadProducts() {
  try {
    const snapshot = await getDocs(
      collection(db, "products")
    );

    state.products = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    state.products.sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999)
    );

    renderProducts();
    renderStats();
    renderSeedImport();
  } catch (error) {
    toast(errorMessage(error), true);
  }
}


function renderStats() {
  $("#statInStock").textContent =
    state.products.filter(
      (product) =>
        product.collection === "in-stock" &&
        product.visible
    ).length;

  $("#statComingSoon").textContent =
    state.products.filter(
      (product) =>
        product.collection === "coming-soon" &&
        product.visible
    ).length;

  $("#statFeatured").textContent =
    state.products.filter(
      (product) =>
        product.featured &&
        product.visible
    ).length;

  $("#statHidden").textContent =
    state.products.filter(
      (product) => !product.visible
    ).length;
}


function productRows() {
  const search =
    state.productSearch.trim().toLowerCase();

  return state.products
    .filter(
      (product) =>
        product.collection === state.productFilter
    )
    .filter((product) => {
      if (!search) return true;

      const searchable =
        `${product.title} ${product.description}`
          .toLowerCase();

      return searchable.includes(search);
    })
    .sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999)
    );
}


function renderProducts() {
  const list = $("#productList");
  const products = productRows();

  if (!products.length) {
    list.innerHTML =
      '<div class="empty-state">No products match this view yet.</div>';

    return;
  }

  list.innerHTML = products
    .map((product, index) => {
      const badges = [
        product.featured
          ? '<span class="mini-pill mini-pill--featured">Featured</span>'
          : "",

        !product.visible
          ? '<span class="mini-pill mini-pill--hidden">Hidden</span>'
          : "",

        product.sold
          ? '<span class="mini-pill mini-pill--sold">Sold</span>'
          : ""
      ].join("");

      const fallback =
        "images/comingsoon.png";

      return `
        <div
          class="product-row"
          draggable="${state.productSearch ? "false" : "true"}"
          data-product-id="${escapeHtml(product.id)}"
        >

          <button
            class="drag-handle"
            type="button"
            title="Drag to reorder"
            aria-label="Drag ${escapeHtml(product.title)}"
          >
            ⋮⋮
          </button>

          <img
            class="product-thumb"
            src="${escapeHtml(product.imageUrl || fallback)}"
            alt=""
            onerror="this.onerror=null;this.src='${fallback}'"
          >

          <div class="product-row__main">

            <div class="product-row__title">
              ${escapeHtml(product.title || "Untitled")}
            </div>

            <div class="product-row__meta">
              ${badges}

              <span>
                ${escapeHtml(product.description || "")}
              </span>
            </div>

          </div>

          <div class="product-row__price">
            ${money(product.price)}
          </div>

          <div class="product-row__actions">

            <button
              class="icon-action"
              type="button"
              data-move="up"
              data-id="${escapeHtml(product.id)}"
              ${index === 0 ? "disabled" : ""}
              aria-label="Move up"
            >
              ↑
            </button>

            <button
              class="icon-action"
              type="button"
              data-move="down"
              data-id="${escapeHtml(product.id)}"
              ${index === products.length - 1 ? "disabled" : ""}
              aria-label="Move down"
            >
              ↓
            </button>

            <button
              class="icon-action"
              type="button"
              data-edit-product="${escapeHtml(product.id)}"
            >
              Edit
            </button>

          </div>

        </div>
      `;
    })
    .join("");

  wireProductRowEvents();
}


function wireProductRowEvents() {
  $$("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => {
      openProductDialog(
        button.dataset.editProduct
      );
    });
  });


  $$("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      moveProduct(
        button.dataset.id,
        button.dataset.move
      );
    });
  });


  $$(".product-row").forEach((row) => {
    row.addEventListener(
      "dragstart",
      (event) => {
        if (state.productSearch) {
          event.preventDefault();
          return;
        }

        state.dragId =
          row.dataset.productId;

        row.classList.add(
          "is-dragging"
        );

        event.dataTransfer.effectAllowed =
          "move";
      }
    );


    row.addEventListener(
      "dragend",
      () => {
        row.classList.remove(
          "is-dragging"
        );

        state.dragId = null;
      }
    );


    row.addEventListener(
      "dragover",
      (event) => {
        if (!state.dragId) return;

        event.preventDefault();

        event.dataTransfer.dropEffect =
          "move";
      }
    );


    row.addEventListener(
      "drop",
      async (event) => {
        event.preventDefault();

        if (
          !state.dragId ||
          state.dragId ===
            row.dataset.productId
        ) {
          return;
        }

        await reorderProduct(
          state.dragId,
          row.dataset.productId
        );
      }
    );
  });
}


async function persistOrder(ordered) {
  const batch = writeBatch(db);

  ordered.forEach((product, index) => {
    product.order = index;

    batch.update(
      doc(
        db,
        "products",
        product.id
      ),
      {
        order: index,
        updatedAt:
          serverTimestamp()
      }
    );
  });

  await batch.commit();
}


async function reorderProduct(
  fromId,
  toId
) {
  const ordered = state.products
    .filter(
      (product) =>
        product.collection ===
        state.productFilter
    )
    .sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999)
    );

  const fromIndex =
    ordered.findIndex(
      (product) =>
        product.id === fromId
    );

  const toIndex =
    ordered.findIndex(
      (product) =>
        product.id === toId
    );

  if (
    fromIndex < 0 ||
    toIndex < 0
  ) {
    return;
  }

  const [moved] =
    ordered.splice(fromIndex, 1);

  ordered.splice(
    toIndex,
    0,
    moved
  );

  try {
    await persistOrder(ordered);

    renderProducts();

    toast(
      "Product order saved."
    );
  } catch (error) {
    toast(
      errorMessage(error),
      true
    );

    await loadProducts();
  }
}


async function moveProduct(
  id,
  direction
) {
  if (state.productSearch) {
    toast(
      "Clear the search box before reordering.",
      true
    );

    return;
  }

  const ordered = state.products
    .filter(
      (product) =>
        product.collection ===
        state.productFilter
    )
    .sort(
      (a, b) =>
        (a.order ?? 9999) -
        (b.order ?? 9999)
    );

  const index =
    ordered.findIndex(
      (product) =>
        product.id === id
    );

  const target =
    direction === "up"
      ? index - 1
      : index + 1;

  if (
    index < 0 ||
    target < 0 ||
    target >= ordered.length
  ) {
    return;
  }

  [
    ordered[index],
    ordered[target]
  ] = [
    ordered[target],
    ordered[index]
  ];

  try {
    await persistOrder(ordered);

    renderProducts();

    toast(
      "Product order saved."
    );
  } catch (error) {
    toast(
      errorMessage(error),
      true
    );

    await loadProducts();
  }
}


// ============================================================
// Product dialog
// ============================================================

function openProductDialog(
  id = null
) {
  state.editingId = id;

  $("#productFormError").textContent =
    "";

  $("#productImageFile").value =
    "";

  const product = id
    ? state.products.find(
        (item) =>
          item.id === id
      )
    : null;


  $("#productDialogTitle").textContent =
    product
      ? "Edit product"
      : "Add product";


  $("#productId").value =
    product?.id || "";

  $("#productTitle").value =
    product?.title || "";

  $("#productDescription").value =
    product?.description || "";

  $("#productPrice").value =
    product?.price ?? "";

  $("#productCollection").value =
    product?.collection ||
    state.productFilter;

  $("#productImageUrl").value =
    product?.imageUrl || "";

  $("#productEbayUrl").value =
    product?.ebayUrl || "";

  $("#productVintedUrl").value =
    product?.vintedUrl || "";

  $("#productVisible").checked =
    product?.visible ?? true;

  $("#productFeatured").checked =
    product?.featured ?? false;

  $("#productSold").checked =
    product?.sold ?? false;

  $("#deleteProduct").hidden =
    !product;

  updateProductPreview();

  $("#productDialog").showModal();
}


function updateProductPreview() {
  const preview =
    $("#productImagePreview");

  const file =
    $("#productImageFile").files[0];

  if (file) {
    preview.src =
      URL.createObjectURL(file);

    preview.hidden = false;

    return;
  }


  const url =
    $("#productImageUrl")
      .value
      .trim();


  if (url) {
    preview.src = url;

    preview.hidden = false;
  } else {
    preview.hidden = true;

    preview.removeAttribute("src");
  }
}


// ============================================================
// GitHub image uploader
// ============================================================

async function uploadImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      `${file.name} is not an image.`
    );
  }


  if (
    file.size >
    10 * 1024 * 1024
  ) {
    throw new Error(
      `${file.name} is larger than 10 MB.`
    );
  }


  const user =
    auth.currentUser;


  if (!user) {
    throw new Error(
      "You must be signed in before uploading an image."
    );
  }


  const idToken =
    await user.getIdToken(true);


  const formData =
    new FormData();


  formData.append(
    "file",
    file,
    file.name
  );


  const response =
    await fetch(
      IMAGE_UPLOAD_ENDPOINT,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${idToken}`
        },

        body: formData
      }
    );


  let result = {};


  try {
    result =
      await response.json();
  } catch {
    // Worker returned something
    // other than JSON.
  }


  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.error ||
      `Image upload failed (${response.status}).`
    );
  }


  return {
    url: result.path,
    path: result.path,
    fileName:
      result.fileName,
    githubUrl:
      result.githubUrl || "",
    commitUrl:
      result.commitUrl || ""
  };
}


// ============================================================
// Save product
// ============================================================

async function saveProduct(event) {
  event.preventDefault();

  $("#productFormError").textContent =
    "";


  const saveButton =
    $("#saveProduct");


  saveButton.disabled = true;

  saveButton.textContent =
    "Saving…";


  try {
    let imageUrl =
      $("#productImageUrl")
        .value
        .trim();


    let imagePath =
      state.editingId
        ? (
            state.products.find(
              (product) =>
                product.id ===
                state.editingId
            )?.imagePath || ""
          )
        : "";


    const file =
      $("#productImageFile")
        .files[0];


    // If a new image has been chosen,
    // upload it to GitHub first.
    if (file) {
      saveButton.textContent =
        "Uploading image…";


      const uploaded =
        await uploadImage(file);


      imageUrl =
        uploaded.url;


      imagePath =
        uploaded.path;


      $("#productImageUrl").value =
        uploaded.url;


      saveButton.textContent =
        "Saving product…";
    }


    const collectionName =
      $("#productCollection")
        .value;


    const existingInCollection =
      state.products.filter(
        (product) =>
          product.collection ===
          collectionName
      );


    const existing =
      state.editingId
        ? state.products.find(
            (product) =>
              product.id ===
              state.editingId
          )
        : null;


    const data = {
      title:
        $("#productTitle")
          .value
          .trim(),

      description:
        $("#productDescription")
          .value
          .trim(),

      price:
        Number(
          $("#productPrice")
            .value || 0
        ),

      collection:
        collectionName,

      imageUrl,

      imagePath,

      ebayUrl:
        $("#productEbayUrl")
          .value
          .trim(),

      vintedUrl:
        $("#productVintedUrl")
          .value
          .trim(),

      visible:
        $("#productVisible")
          .checked,

      featured:
        $("#productFeatured")
          .checked,

      sold:
        $("#productSold")
          .checked,

      featuredOrder:
        existing?.featuredOrder ??
        999,

      order:
        existing &&
        existing.collection ===
          collectionName
          ? (
              existing.order ??
              existingInCollection.length
            )
          : existingInCollection.length,

      updatedAt:
        serverTimestamp()
    };


    if (!data.title) {
      throw new Error(
        "Please enter a product title."
      );
    }


    if (state.editingId) {
      await updateDoc(
        doc(
          db,
          "products",
          state.editingId
        ),
        data
      );
    } else {
      const newRef =
        doc(
          collection(
            db,
            "products"
          )
        );


      await setDoc(
        newRef,
        {
          ...data,

          createdAt:
            serverTimestamp()
        }
      );
    }


    $("#productDialog").close();


    await loadProducts();


    toast(
      state.editingId
        ? "Product updated."
        : "Product added."
    );

  } catch (error) {
    $("#productFormError").textContent =
      errorMessage(error);

  } finally {
    saveButton.disabled =
      false;

    saveButton.textContent =
      "Save product";
  }
}


// ============================================================
// Delete product
// ============================================================

async function deleteCurrentProduct() {
  if (!state.editingId) {
    return;
  }


  const product =
    state.products.find(
      (product) =>
        product.id ===
        state.editingId
    );


  if (
    !confirm(
      `Delete “${product?.title || "this product"}”? This cannot be undone.`
    )
  ) {
    return;
  }


  try {
    await deleteDoc(
      doc(
        db,
        "products",
        state.editingId
      )
    );


    $("#productDialog").close();


    await loadProducts();


    toast(
      "Product deleted."
    );

  } catch (error) {
    toast(
      errorMessage(error),
      true
    );
  }
}


// ============================================================
// Seed catalogue import
// ============================================================

async function renderSeedImport() {
  const text =
    $("#seedImportText");

  const button =
    $("#importSeed");


  if (state.products.length) {
    text.textContent =
      `${state.products.length} backend products are currently loaded.`;

    button.hidden = true;

  } else {
    text.textContent =
      "The backend is empty. You can import all products found in your original HTML in one click.";

    button.hidden = false;
  }
}


async function importSeed() {
  const button =
    $("#importSeed");


  button.disabled = true;

  button.textContent =
    "Importing…";


  try {
    const response =
      await fetch(
        "data/seed-products.json",
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {
      throw new Error(
        "Could not load seed-products.json."
      );
    }


    const products =
      await response.json();


    if (products.length > 450) {
      throw new Error(
        "Seed catalogue is too large for a single import."
      );
    }


    const batch =
      writeBatch(db);


    products.forEach(
      (product) => {
        const {
          seedId,
          ...data
        } = product;


        batch.set(
          doc(
            db,
            "products",
            seedId
          ),
          {
            ...data,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()
          }
        );
      }
    );


    await batch.commit();


    await loadProducts();


    toast(
      `Imported ${products.length} products.`
    );

  } catch (error) {
    toast(
      errorMessage(error),
      true
    );

  } finally {
    button.disabled =
      false;

    button.textContent =
      "Import existing catalogue";
  }
}


// ============================================================
// Site settings
// ============================================================

async function loadSettings() {
  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "settings",
          "site"
        )
      );


    state.settings =
      snapshot.exists()
        ? snapshot.data()
        : {
            maintenanceMode:
              false,

            maintenanceTitle:
              "We’ll be right back",

            maintenanceMessage:
              "We’re making the website a little more magical. Please check back soon.",

            maintenanceImageUrl:
              ""
          };


    renderSettings();

  } catch (error) {
    toast(
      errorMessage(error),
      true
    );
  }
}


function renderSettings() {
  const settings =
    state.settings;


  $("#maintenanceMode").checked =
    Boolean(
      settings.maintenanceMode
    );


  $("#maintenanceQuickToggle").checked =
    Boolean(
      settings.maintenanceMode
    );


  $("#maintenanceTitle").value =
    settings.maintenanceTitle ||
    "We’ll be right back";


  $("#maintenanceMessage").value =
    settings.maintenanceMessage ||
    "We’re making the website a little more magical. Please check back soon.";


  $("#maintenanceImageUrl").value =
    settings.maintenanceImageUrl ||
    "";


  const pill =
    $("#siteStatusPill");


  pill.textContent =
    settings.maintenanceMode
      ? "Maintenance"
      : "Live";


  pill.classList.toggle(
    "is-maintenance",
    Boolean(
      settings.maintenanceMode
    )
  );
}


async function saveSettings(event) {
  event?.preventDefault();


  const settings = {
    maintenanceMode:
      $("#maintenanceMode")
        .checked,

    maintenanceTitle:
      $("#maintenanceTitle")
        .value
        .trim() ||
      "We’ll be right back",

    maintenanceMessage:
      $("#maintenanceMessage")
        .value
        .trim() ||
      "We’re making the website a little more magical. Please check back soon.",

    maintenanceImageUrl:
      $("#maintenanceImageUrl")
        .value
        .trim(),

    updatedAt:
      serverTimestamp()
  };


  try {
    await setDoc(
      doc(
        db,
        "settings",
        "site"
      ),
      settings,
      {
        merge: true
      }
    );


    state.settings = {
      ...state.settings,
      ...settings
    };


    renderSettings();


    toast(
      settings.maintenanceMode
        ? "Maintenance mode is on."
        : "Website is live."
    );

  } catch (error) {
    toast(
      errorMessage(error),
      true
    );
  }
}


async function quickToggleMaintenance() {
  const checked =
    $("#maintenanceQuickToggle")
      .checked;


  $("#maintenanceMode").checked =
    checked;


  await saveSettings();
}

function normaliseImagePath(value = "") {
  return String(value)
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\/+/, "");
}


function productsUsingImage(imagePath) {
  const normalisedPath = normaliseImagePath(imagePath);

  return state.products.filter((product) => {
    const imageUrl = normaliseImagePath(product.imageUrl || "");
    const storedPath = normaliseImagePath(product.imagePath || "");

    return (
      imageUrl === normalisedPath ||
      storedPath === normalisedPath
    );
  });
}


async function deleteGitHubImage(imagePath) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be signed in before deleting an image."
    );
  }

  const usedBy = productsUsingImage(imagePath);

  if (usedBy.length) {
    const productNames = usedBy
      .slice(0, 8)
      .map((product) => `• ${product.title || "Untitled product"}`)
      .join("\n");

    const extra =
      usedBy.length > 8
        ? `\n• and ${usedBy.length - 8} more`
        : "";

    const confirmed = confirm(
      `WARNING: This image is currently used by ${usedBy.length} product${usedBy.length === 1 ? "" : "s"}:\n\n` +
      `${productNames}${extra}\n\n` +
      `Deleting it from GitHub will cause those products to show a missing image.\n\n` +
      `Delete the image anyway?`
    );

    if (!confirmed) {
      return false;
    }
  } else {
    const fileName = imagePath.split("/").pop();

    const confirmed = confirm(
      `Delete "${fileName}" from the website image library?\n\n` +
      `This will permanently remove the file from GitHub.`
    );

    if (!confirmed) {
      return false;
    }
  }

  const idToken =
    await user.getIdToken(true);

  const response = await fetch(
    IMAGE_UPLOAD_ENDPOINT,
    {
      method: "DELETE",

      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        path: imagePath
      })
    }
  );

  let result = {};

  try {
    result = await response.json();
  } catch {
    // Ignore JSON parsing problems so we can show
    // the HTTP status below.
  }

  if (!response.ok || !result.ok) {
    throw new Error(
      result.error ||
      `Image deletion failed (${response.status}).`
    );
  }

  return true;
}
// ============================================================
// GitHub image library
// ============================================================

function filterImageLibrary() {
  const searchInput = $("#imageSearch");

  if (!searchInput) {
    return;
  }

  const search = searchInput.value
    .trim()
    .toLowerCase();

  $$("#imageLibrary .image-card").forEach((card) => {
    const imageName =
      card.dataset.imageName || "";

    card.hidden =
      Boolean(search) &&
      !imageName.includes(search);
  });
}

async function loadImages() {
  const library = $("#imageLibrary");

  if (!state.authorised) {
    return;
  }

  library.innerHTML =
    '<div class="empty-state">Loading GitHub images…</div>';

  try {
    const response = await fetch(
      GITHUB_IMAGES_API,
      {
        cache: "no-store",

        headers: {
          Accept: "application/vnd.github+json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load GitHub images (${response.status}).`
      );
    }

    const items =
      await response.json();

    const images = (
      Array.isArray(items)
        ? items
        : []
    )
      .filter(
        (item) =>
          item.type === "file"
      )
      .filter(
        (item) =>
          /\.(jpe?g|png|webp|gif|avif)$/i.test(item.name)
      )
      .sort((a, b) => {
  const getTimestamp = (name) => {
    const match = name.match(/^(\d{13})-/);
    return match ? Number(match[1]) : 0;
  };

  const aTime = getTimestamp(a.name);
  const bTime = getTimestamp(b.name);

  if (aTime !== bTime) {
    return bTime - aTime;
  }

  return a.name.localeCompare(b.name);
});

    if (!images.length) {
      library.innerHTML =
        '<div class="empty-state">No images found in images/forsale yet.</div>';

      return;
    }

    library.innerHTML = images
      .map((image) => {
        const publicPath =
          image.path;

        const previewUrl =
          image.download_url ||
          `/${publicPath}`;

        const usedBy =
          productsUsingImage(publicPath);

        const usageText =
          usedBy.length
            ? `<div class="image-usage image-usage--used">
                Used by ${usedBy.length} product${usedBy.length === 1 ? "" : "s"}
              </div>`
            : `<div class="image-usage">
                Not currently used
              </div>`;

        return `
          <article
  class="image-card"
  data-image-name="${escapeHtml(image.name.toLowerCase())}"
>

            <img
              src="${escapeHtml(previewUrl)}"
              alt=""
            >

            <div class="image-card__body">

              <div
                class="image-card__name"
                title="${escapeHtml(image.name)}"
              >
                ${escapeHtml(image.name)}
              </div>

              ${usageText}

              <div class="image-card__actions">

                <button
                  class="admin-btn admin-btn--small"
                  type="button"
                  data-copy-image="${escapeHtml(publicPath)}"
                >
                  Copy path
                </button>

                <a
                  class="admin-btn admin-btn--small"
                  href="${escapeHtml(previewUrl)}"
                  target="_blank"
                  rel="noopener"
                >
                  Open
                </a>

              </div>

              <div
                class="image-card__actions"
                style="margin-top:6px"
              >

                <button
                  class="admin-btn admin-btn--small admin-btn--danger"
                  type="button"
                  data-delete-github-image="${escapeHtml(publicPath)}"
                >
                  Delete image
                </button>

              </div>

            </div>

          </article>
        `;
      })
      .join("");


    $$("[data-copy-image]")
      .forEach((button) => {

        button.addEventListener(
          "click",
          async () => {

            await navigator.clipboard.writeText(
              button.dataset.copyImage
            );

            toast(
              "Image path copied."
            );
          }
        );
      });


    $$("[data-delete-github-image]")
      .forEach((button) => {

        button.addEventListener(
          "click",
          async () => {

            const imagePath =
              button.dataset.deleteGithubImage;

            button.disabled = true;
            button.textContent = "Deleting…";

            try {
              const deleted =
                await deleteGitHubImage(imagePath);

              if (!deleted) {
                button.disabled = false;
                button.textContent = "Delete image";
                return;
              }

              toast(
                "Image deleted from GitHub."
              );

              await loadImages();

            } catch (error) {
              toast(
                errorMessage(error),
                true
              );

              button.disabled = false;
              button.textContent = "Delete image";
            }
          }
        );
      });

filterImageLibrary();

  } catch (error) {
    library.innerHTML =
      `<div class="empty-state">${escapeHtml(
        errorMessage(error)
      )}</div>`;
  }
}


// ============================================================
// Upload one or multiple files from Images tab
// ============================================================

async function uploadFiles(files) {
  const imageFiles =
    [...files].filter(
      (file) =>
        file.type.startsWith(
          "image/"
        )
    );


  if (!imageFiles.length) {
    return;
  }


  const progress =
    $("#uploadProgress");


  try {
    for (
      let i = 0;
      i < imageFiles.length;
      i++
    ) {
      progress.textContent =
        `Uploading ${i + 1} of ${imageFiles.length}: ${imageFiles[i].name}`;


      await uploadImage(
        imageFiles[i]
      );
    }


    progress.textContent =
      `${imageFiles.length} image${imageFiles.length === 1 ? "" : "s"} uploaded to GitHub.`;


    toast(
      "Images uploaded to GitHub. GitHub Pages may take a minute to publish them."
    );


    await loadImages();

  } catch (error) {
    progress.textContent =
      errorMessage(error);


    toast(
      errorMessage(error),
      true
    );

  } finally {
    $("#imageUpload").value =
      "";
  }
}

// ============================================================
// Existing GitHub image picker for products
// ============================================================

function ensureImagePicker() {
  if ($("#imagePickerDialog")) {
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.id = "imagePickerDialog";
  dialog.className = "product-dialog";

  dialog.innerHTML = `
    <div class="product-form">

      <div class="dialog-head">
        <div>
          <p class="eyebrow">Image library</p>
          <h2>Choose an image</h2>
          <p class="muted">
            Select an existing image from your GitHub image library.
          </p>
        </div>

        <button
          id="closeImagePicker"
          class="icon-btn"
          type="button"
          aria-label="Close image library"
        >
          ×
        </button>
      </div>

      <div
        id="imagePickerGrid"
        class="image-library"
      >
        <div class="empty-state">
          Loading images…
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(dialog);

  $("#closeImagePicker").addEventListener(
    "click",
    () => {
      dialog.close();
    }
  );
}


async function openImagePicker() {
  ensureImagePicker();

  const dialog = $("#imagePickerDialog");
  const grid = $("#imagePickerGrid");

  grid.innerHTML =
    '<div class="empty-state">Loading images…</div>';

  dialog.showModal();

  try {
    const response = await fetch(
      GITHUB_IMAGES_API,
      {
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load image library (${response.status}).`
      );
    }

    const items = await response.json();

    const images = (
      Array.isArray(items)
        ? items
        : []
    )
      .filter(
        (item) =>
          item.type === "file"
      )
      .filter(
        (item) =>
          /\.(jpe?g|png|webp|gif|avif)$/i.test(
            item.name
          )
      )
      .sort((a, b) => {
  const getTimestamp = (name) => {
    const match = name.match(/^(\d{13})-/);
    return match ? Number(match[1]) : 0;
  };

  const aTime = getTimestamp(a.name);
  const bTime = getTimestamp(b.name);

  if (aTime !== bTime) {
    return bTime - aTime;
  }

  return a.name.localeCompare(b.name);
});

    if (!images.length) {
      grid.innerHTML =
        '<div class="empty-state">No images are currently available.</div>';

      return;
    }

    grid.innerHTML = images
      .map((image) => {
        const publicPath = image.path;

        const previewUrl =
          image.download_url ||
          `/${publicPath}`;

        return `
          <article
  class="image-card"
  data-image-name="${escapeHtml(image.name.toLowerCase())}"
>

            <img
              src="${escapeHtml(previewUrl)}"
              alt=""
            >

            <div class="image-card__body">

              <div
                class="image-card__name"
                title="${escapeHtml(image.name)}"
              >
                ${escapeHtml(image.name)}
              </div>

              <div class="image-card__actions">

                <button
                  class="admin-btn admin-btn--small admin-btn--primary"
                  type="button"
                  data-use-library-image="${escapeHtml(publicPath)}"
                >
                  Use image
                </button>

              </div>

            </div>

          </article>
        `;
      })
      .join("");

    $$("[data-use-library-image]")
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const path =
              button.dataset.useLibraryImage;

            // Clear any newly selected local upload
            $("#productImageFile").value = "";

            // Put the GitHub image path into the product
            $("#productImageUrl").value = path;

            updateProductPreview();

            dialog.close();

            toast("Image selected.");
          }
        );
      });

  } catch (error) {
    grid.innerHTML =
      `<div class="empty-state">${escapeHtml(
        errorMessage(error)
      )}</div>`;
  }
}


function addImageLibraryButton() {
  const fileInput =
    $("#productImageFile");

  if (
    !fileInput ||
    $("#chooseExistingImage")
  ) {
    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "chooseExistingImage";

  button.type =
    "button";

  button.className =
    "admin-btn";

  button.textContent =
    "Choose from image library";

  button.style.marginTop =
    "8px";

  button.addEventListener(
    "click",
    openImagePicker
  );

  fileInput.insertAdjacentElement(
    "afterend",
    button
  );
}
// ============================================================
// Events
// ============================================================

function wireEvents() {
    addImageLibraryButton();

  $("#googleLogin").addEventListener(
    "click",
    handleLogin
  );


  $("#signOut").addEventListener(
    "click",
    () => signOut(auth)
  );


  $("#unauthorisedSignOut").addEventListener(
    "click",
    () => signOut(auth)
  );


  $("#copyUid").addEventListener(
    "click",
    async () => {

      await navigator.clipboard.writeText(
        $("#currentUid")
          .textContent
      );


      toast(
        "User ID copied."
      );
    }
  );


  $$(".admin-nav__item")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {
          setTab(
            button.dataset.tab
          );
        }
      );
    });


  $$("[data-go-tab]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {
          setTab(
            button.dataset.goTab
          );
        }
      );
    });


  $$("[data-product-filter]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          state.productFilter =
            button.dataset.productFilter;


          $$("[data-product-filter]")
            .forEach((item) => {

              item.classList.toggle(
                "is-active",
                item === button
              );
            });


          renderProducts();
        }
      );
    });


  $("#productSearch").addEventListener(
    "input",
    (event) => {

      state.productSearch =
        event.target.value;


      renderProducts();
    }
  );


  [
    $("#addProduct"),
    $("#addProductTop")
  ].forEach((button) => {

    button.addEventListener(
      "click",
      () => {
        openProductDialog();
      }
    );
  });


  $("#productForm").addEventListener(
    "submit",
    saveProduct
  );


  $("#closeProductDialog").addEventListener(
    "click",
    () => {
      $("#productDialog").close();
    }
  );


  $("#cancelProduct").addEventListener(
    "click",
    () => {
      $("#productDialog").close();
    }
  );


  $("#deleteProduct").addEventListener(
    "click",
    deleteCurrentProduct
  );


  $("#productImageUrl").addEventListener(
    "input",
    updateProductPreview
  );


  $("#productImageFile").addEventListener(
    "change",
    updateProductPreview
  );


  $("#importSeed").addEventListener(
    "click",
    importSeed
  );


  $("#settingsForm").addEventListener(
    "submit",
    saveSettings
  );


  $("#maintenanceQuickToggle").addEventListener(
    "change",
    quickToggleMaintenance
  );

$("#imageSearch").addEventListener(
  "input",
  filterImageLibrary
);

  $("#imageUpload").addEventListener(
    "change",
    (event) => {
      uploadFiles(
        event.target.files
      );
    }
  );


  const dropzone =
    $("#imageDropzone");


  [
    "dragenter",
    "dragover"
  ].forEach((name) => {

    dropzone.addEventListener(
      name,
      (event) => {

        event.preventDefault();

        dropzone.classList.add(
          "is-over"
        );
      }
    );
  });


  [
    "dragleave",
    "drop"
  ].forEach((name) => {

    dropzone.addEventListener(
      name,
      (event) => {

        event.preventDefault();

        dropzone.classList.remove(
          "is-over"
        );
      }
    );
  });


  dropzone.addEventListener(
    "drop",
    (event) => {

      uploadFiles(
        event.dataTransfer.files
      );
    }
  );
}


// ============================================================
// Start
// ============================================================

wireEvents();


if (!firebaseConfigured) {
  showOnly(setupRequired);

} else {
  onAuthStateChanged(
    auth,
    async (user) => {

      if (!user) {
        state.user = null;
        state.authorised = false;

        showOnly(loginView);

        return;
      }


      const usesGoogle =
        user.providerData.some(
          (provider) =>
            provider.providerId ===
            "google.com"
        );


      if (!usesGoogle) {
        await signOut(auth);

        showOnly(loginView);

        return;
      }


      if (
        await checkAdmin(user)
      ) {
        await initialiseAdmin(user);

      } else {
        state.user = user;
        state.authorised = false;


        $("#currentUid").textContent =
          user.uid;


        showOnly(
          unauthorisedView
        );
      }
    }
  );
}