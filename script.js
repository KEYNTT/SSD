/**
 * NRIAL PLATFORM — Controlador Unificado (Portada y Catálogo)
 * Maneja imágenes y videos en relación 3:4 con CLS = 0.
 */

const API_POSTS_URL = "https://nrial-media-api.kevin-123-abanto.workers.dev/api/posts";
const HOMEPAGE_LIMIT = 6;

/**
 * Validador de formato de video
 */
function isVideoUrl(url) {
  return /\.(webm|mp4|mov|ogg)(\?.*)?$/i.test(url);
}

/**
 * Precarga de videos al aproximarse a la pantalla (300px de margen)
 */
const preloadObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(({ target: video, isIntersecting }) => {
    if (isIntersecting && !video.src && video.dataset.src) {
      video.src = video.dataset.src;
      video.preload = "metadata";
      observer.unobserve(video);
    }
  });
}, { rootMargin: "300px 0px" });

/**
 * Reproducción silenciosa automática cuando el video está visible
 */
const playbackObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target: video, isIntersecting }) => {
    if (isIntersecting) {
      video.muted = true;
      video.defaultMuted = true;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}, { threshold: 0.35 });

/**
 * Controlador táctil y puntero del deslizador Antes/Después
 */
function setupComparator(container) {
  if (!container) return;
  let resetTimer = null;

  const updateSplit = (pct) => {
    const clamped = Math.max(0, Math.min(pct, 100));
    container.style.setProperty("--split", `${clamped}%`);
  };

  const onMove = (e) => {
    container.classList.remove("is-resetting");
    clearTimeout(resetTimer);
    const rect = container.getBoundingClientRect();
    if (rect.width > 0) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      updateSplit(((clientX - rect.left) / rect.width) * 100);
    }
  };

  const onReset = () => {
    container.classList.add("is-resetting");
    updateSplit(50);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => container.classList.remove("is-resetting"), 450);
  };

  // Eventos para soporte móvil (táctil) y escritorio
  container.addEventListener("pointerdown", onMove);
  container.addEventListener("pointerenter", onMove);
  container.addEventListener("pointermove", onMove);
  ["pointerleave", "pointerup", "pointercancel"].forEach((evt) => {
    container.addEventListener(evt, onReset);
  });

  updateSplit(50);
}

/**
 * Construcción individual de tarjeta desde la plantilla
 */
function createCard(media, template) {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector(".ig-card");

  // Asignación de imagen "Antes"
  const beforeImg = clone.querySelector(".before-media");
  if (beforeImg) beforeImg.src = media.before;

  // Asignación de capa "Después"
  const afterClip = clone.querySelector(".after-clip");
  const videoEl = clone.querySelector(".after-video");

  if (isVideoUrl(media.after)) {
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("muted", "");
    videoEl.setAttribute("playsinline", "");
    videoEl.dataset.src = media.after;

    preloadObserver.observe(videoEl);
    playbackObserver.observe(videoEl);
  } else {
    // Si es imagen estática, remueve el video e inserta <img>
    videoEl.remove();
    const imgEl = document.createElement("img");
    imgEl.className = "after-media";
    imgEl.src = media.after;
    imgEl.alt = "Después";
    imgEl.loading = "lazy";
    imgEl.draggable = false;
    afterClip.appendChild(imgEl);
  }

  setupComparator(card.querySelector("[data-comparison]"));
  return card;
}

/**
 * Inicialización principal
 */
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Activa el reproductor 16:9 del Hero (si existe en la página)
  const heroComparator = document.querySelector(".comparator-16-9");
  if (heroComparator) setupComparator(heroComparator);

  // 2. Detección automática del contenedor activo
  const cardsGrid = document.getElementById("cards-grid") || document.getElementById("full-grid");
  const template = document.getElementById("card-template");
  const catalogCounter = document.getElementById("catalog-counter");
  const loadMoreBtn = document.getElementById("load-more-btn");

  if (!cardsGrid || !template) return;

  try {
    const res = await fetch(`${API_POSTS_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      if (catalogCounter) catalogCounter.textContent = "No hay piezas registradas.";
      return;
    }

    // Actualiza contador si estamos en galeria.html
    if (catalogCounter) {
      catalogCounter.textContent = `${posts.length} publicaciones disponibles en alta fidelidad`;
    }

    cardsGrid.innerHTML = "";

    // Si el contenedor es "cards-grid", aplica el límite de 6 piezas (portada);
    // si es "full-grid", carga todo el catálogo.
    const isHomepage = cardsGrid.id === "cards-grid";
    const itemsToRender = isHomepage ? posts.slice(0, HOMEPAGE_LIMIT) : posts;

    itemsToRender.forEach((item) => {
      cardsGrid.appendChild(createCard(item, template));
    });

    // Gestión del botón "Ver más..." en portada
    if (loadMoreBtn) {
      if (isHomepage && posts.length > HOMEPAGE_LIMIT) {
        loadMoreBtn.classList.remove("is-hidden");
      } else {
        loadMoreBtn.classList.add("is-hidden");
      }
    }
  } catch (err) {
    console.error("Error al sincronizar con el catálogo:", err);
    if (catalogCounter) {
      catalogCounter.textContent = "Error al conectar con el servidor.";
    }
  }
});