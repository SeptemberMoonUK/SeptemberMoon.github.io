import { db, firebaseConfigured } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const FALLBACK_IMAGE = "images/comingsoon.png";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeExternalUrl(value = "") {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch (_) {}
  return "";
}

function productCard(product) {
  const title = escapeHtml(product.title || "Untitled product");
  const description = escapeHtml(product.description || "");
  const price = Number(product.price || 0);
  const image = escapeHtml(product.imageUrl || FALLBACK_IMAGE);
  const ebay = safeExternalUrl(product.ebayUrl || "");
  const vinted = safeExternalUrl(product.vintedUrl || "");
  const sold = Boolean(product.sold);
  const links = [
    ebay ? `<a class="product__link" href="${escapeHtml(ebay)}" target="_blank" rel="noopener noreferrer"><img src="images/ebay.png" alt="eBay"></a>` : "",
    vinted ? `<a class="product__link" href="${escapeHtml(vinted)}" target="_blank" rel="noopener noreferrer"><img src="images/vinted.png" alt="Vinted"></a>` : ""
  ].join("");

  return `
    <article class="product${sold ? " product--sold" : ""}">
      <div class="product__img">
        <img src="${image}" alt="${title}" class="product__photo" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
        ${sold ? '<span class="product__sold">Sold</span>' : ""}
      </div>
      <h3 class="product__title">${title}</h3>
      <p class="product__desc">${description}</p>
      <p class="product__price">£${Number.isInteger(price) ? price : price.toFixed(2)}</p>
      ${links ? `<div class="product__links">${links}</div>` : ""}
    </article>`;
}

async function loadSeedProducts() {
  const response = await fetch("data/seed-products.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the local product catalogue.");
  return response.json();
}

async function loadProducts() {
  if (!firebaseConfigured) return loadSeedProducts();
  try {
    const snapshot = await getDocs(query(collection(db, "products"), where("visible", "==", true)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("Firebase catalogue unavailable; using bundled catalogue.", error);
    return loadSeedProducts();
  }
}

async function checkMaintenance() {
  if (!firebaseConfigured || document.body.dataset.maintenancePage === "true") {
    document.documentElement.classList.remove("site-checking");
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "settings", "site"));
    const settings = snapshot.exists() ? snapshot.data() : null;
    if (settings?.maintenanceMode) {
      const target = new URL("maintenance.html", window.location.href);
      window.location.replace(target.href);
      return settings;
    }
  } catch (error) {
    console.warn("Maintenance check unavailable.", error);
  } finally {
    document.documentElement.classList.remove("site-checking");
  }
  return null;
}

async function renderMaintenancePage() {
  if (document.body.dataset.maintenancePage !== "true") return;
  document.documentElement.classList.remove("site-checking");
  if (!firebaseConfigured) return;

  try {
    const snapshot = await getDoc(doc(db, "settings", "site"));
    if (!snapshot.exists()) return;
    const settings = snapshot.data();
    const title = document.querySelector("[data-maintenance-title]");
    const message = document.querySelector("[data-maintenance-message]");
    const image = document.querySelector("[data-maintenance-image]");
    if (title && settings.maintenanceTitle) title.textContent = settings.maintenanceTitle;
    if (message && settings.maintenanceMessage) message.textContent = settings.maintenanceMessage;
    if (image && settings.maintenanceImageUrl) {
      image.src = settings.maintenanceImageUrl;
      image.hidden = false;
    }
  } catch (error) {
    console.warn("Could not load maintenance-page settings.", error);
  }
}

function renderGrid(grid, products) {
  const mode = grid.dataset.productGrid;
  let subset = [...products];

  if (mode === "featured") {
    const featured = subset.filter((item) => item.featured && item.collection === "in-stock" && !item.sold);
    subset = featured.length
      ? featured.sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999)).slice(0, 4)
      : subset.filter((item) => item.collection === "in-stock" && !item.sold)
          .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999)).slice(0, 4);
  } else {
    subset = subset
      .filter((item) => item.collection === mode)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }

  if (!subset.length) {
    grid.innerHTML = '<p class="catalog-empty">Nothing is listed here just yet.</p>';
    return;
  }
  grid.innerHTML = subset.map(productCard).join("");
}

async function renderProductGrids() {
  const grids = [...document.querySelectorAll("[data-product-grid]")];
  if (!grids.length) return;
  try {
    const products = await loadProducts();
    grids.forEach((grid) => renderGrid(grid, products));
  } catch (error) {
    console.error(error);
    grids.forEach((grid) => {
      grid.innerHTML = '<p class="catalog-empty">The catalogue could not be loaded. Please try again shortly.</p>';
    });
  }
}

await checkMaintenance();
await Promise.all([renderMaintenancePage(), renderProductGrids()]);
