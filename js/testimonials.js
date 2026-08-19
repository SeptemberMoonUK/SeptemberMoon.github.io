import { db, firebaseConfigured } from "./firebase.js?v=3";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const testimonialsContainer =
  document.querySelector("#homepageTestimonials");


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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


    const testimonials =
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


    testimonialsContainer.innerHTML =
      testimonials
        .map((testimonial) => `
          <figure class="quote">

            <blockquote>
              “${escapeHtml(testimonial.quote || "")}”
            </blockquote>

            <figcaption>
              — ${escapeHtml(testimonial.customer || "Customer")}
            </figcaption>

          </figure>
        `)
        .join("");

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