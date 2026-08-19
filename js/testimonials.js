import { db, firebaseConfigured } from "./firebase.js?v=3";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const testimonialsContainer =
  document.querySelector("#homepageTestimonials");


const TESTIMONIALS_PER_PAGE = 3;
const DISPLAY_TIME = 5000;
const FADE_TIME = 500;

let testimonials = [];
let currentPage = 0;
let rotationTimer = null;


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function renderTestimonialsPage() {
  if (!testimonials.length) {
    return;
  }

  const start =
    currentPage * TESTIMONIALS_PER_PAGE;

  const visibleTestimonials =
    testimonials.slice(
      start,
      start + TESTIMONIALS_PER_PAGE
    );


  testimonialsContainer.innerHTML =
    visibleTestimonials
      .map((testimonial) => `
        <figure class="quote">

          <blockquote>
            “${escapeHtml(testimonial.quote || "")}”
          </blockquote>

          <figcaption>
            — ${escapeHtml(
              testimonial.customer || "Customer"
            )}
          </figcaption>

        </figure>
      `)
      .join("");
}


function startRotation() {
  const totalPages =
    Math.ceil(
      testimonials.length /
      TESTIMONIALS_PER_PAGE
    );

  // If there are only 3 or fewer,
  // there is nothing to rotate.
  if (totalPages <= 1) {
    return;
  }


  rotationTimer = setInterval(() => {

    // Fade current testimonials out
    testimonialsContainer.classList.add(
      "testimonials--fading"
    );


    setTimeout(() => {

      currentPage =
        (currentPage + 1) % totalPages;


      renderTestimonialsPage();


      // Fade new testimonials back in
      requestAnimationFrame(() => {

        testimonialsContainer.classList.remove(
          "testimonials--fading"
        );

      });

    }, FADE_TIME);

  }, DISPLAY_TIME);
}


async function loadTestimonials() {
  if (!testimonialsContainer) {
    return;
  }


  if (!firebaseConfigured || !db) {
    testimonialsContainer.innerHTML =
      '<p class="catalog-empty">Testimonials are temporarily unavailable.</p>';

    return;
  }


  try {
    const testimonialsQuery =
      query(
        collection(db, "testimonials"),
        where("visible", "==", true)
      );


    const snapshot =
      await getDocs(testimonialsQuery);


    testimonials =
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


    if (!testimonials.length) {
      testimonialsContainer.innerHTML =
        '<p class="catalog-empty">No testimonials to show just yet.</p>';

      return;
    }


    currentPage = 0;

    renderTestimonialsPage();

    startRotation();


  } catch (error) {

    console.error(
      "Could not load testimonials:",
      error
    );


    testimonialsContainer.innerHTML =
      '<p class="catalog-empty">Testimonials are temporarily unavailable.</p>';
  }
}


loadTestimonials();