/**
 * NRIAL PLATFORM - Controlador Unificado
 */
const API_POSTS_URL = "https://nrial-media-api.kevin-123-abanto.workers.dev/api/posts";
const HOMEPAGE_LIMIT = 6;

function isVideoUrl(url) {
  return /\.(webm|mp4|mov|ogg)(\?.*)?$/i.test(url);
}

// 1. Observador de precarga
const preloadObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(({ target: video, isIntersecting }) => {
    if (isIntersecting && !video.src && video.dataset.src) {
      video.src = video.dataset.src;
      video.preload = "metadata";
      observer.unobserve(video);
    }
  });
}, { rootMargin: "300px 0px" });

// 2. Observador de reproducción
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
}, { threshold: 0.4 });

// 3. Lógica del comparador
function setupComparator(container) {
  if (!container) return;
  let resetTimer = null;
  let rafId = null;
  let rect = null;

  const updateSplit = (pct) => {
    const clamped = Math.max(0, Math.min(pct, 100));
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      container.style.setProperty("--split", `${clamped}%`);
    });
  };

  const refreshRect = () => {
    rect = container.getBoundingClientRect();
  };

  const onMove = (e) => {
    container.classList.remove("is-resetting");
    clearTimeout(resetTimer);
    if (!rect) refreshRect();
    if (rect && rect.width > 0) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      updateSplit(((clientX - rect.left) / rect.width) * 100);
    }
  };

  const onReset = () => {
    rect = null;
    container.classList.add("is-resetting");
    updateSplit(50);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => container.classList.remove("is-resetting"), 450);
  };

  container.addEventListener("pointerdown", (e) => {
    refreshRect();
    onMove(e);
  });
  container.addEventListener("pointerenter", (e) => {
    refreshRect();
    onMove(e);
  });
  container.addEventListener("pointermove", onMove);
  ["pointerleave", "pointerup", "pointercancel"].forEach((evt) => {
    container.addEventListener(evt, onReset);
  });

  updateSplit(50);
}

// 4. Construcción de tarjetas de la galería
function buildCard(media, template) {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector(".ig-card");
  const beforeImg = clone.querySelector(".before-media");
  if (beforeImg) beforeImg.src = media.before;

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
    videoEl.remove();
    const imgEl = document.createElement("img");
    imgEl.className = "after-media";
    imgEl.src = media.after;
    imgEl.alt = "Después";
    imgEl.draggable = false;
    imgEl.loading = "lazy";
    imgEl.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;";
    afterClip.appendChild(imgEl);
  }

  setupComparator(card.querySelector("[data-comparison]"));
  return card;
}

// 5. Carga de datos
document.addEventListener("DOMContentLoaded", async () => {
  const heroComparator = document.querySelector(".comparator-16-9");
  if (heroComparator) setupComparator(heroComparator);

  const fullGrid = document.getElementById("full-grid");
  const cardsGrid = document.getElementById("cards-grid");
  const targetGrid = fullGrid || cardsGrid;
  const catalogCounter = document.getElementById("catalog-counter");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const template = document.getElementById("card-template");

  if (!targetGrid || !template) return;

  try {
    const isGallery = !!fullGrid;
    const [resPosts, resFeat] = await Promise.all([
      fetch(`${API_POSTS_URL}?t=${Date.now()}`),
      fetch(`${API_POSTS_URL.replace('/posts', '/featured')}?t=${Date.now()}`).catch(() => null)
    ]);

    if (!resPosts.ok) return;
    const posts = await resPosts.json();
    if (!Array.isArray(posts) || posts.length === 0) return;

    let featuredIds = [];
    if (resFeat && resFeat.ok) {
      featuredIds = await resFeat.json();
    }

    if (catalogCounter) {
      catalogCounter.textContent = `${posts.length} publicaciones disponibles en alta fidelidad`;
    }

    targetGrid.innerHTML = "";
    let displayPosts = [];

    if (isGallery) {
      displayPosts = [...posts].sort((a, b) => b.id - a.id);
    } else {
      if (featuredIds.length > 0) {
        displayPosts = featuredIds
          .map(id => posts.find(p => p.id === id))
          .filter(Boolean)
          .slice(0, HOMEPAGE_LIMIT);
      } else {
        displayPosts = posts.slice(0, HOMEPAGE_LIMIT);
      }
    }

    displayPosts.forEach((media) => {
      const cardNode = buildCard(media, template);
      targetGrid.appendChild(cardNode);
    });

    if (loadMoreBtn) {
      if (!isGallery && posts.length > HOMEPAGE_LIMIT) {
        loadMoreBtn.classList.remove("is-hidden");
      } else {
        loadMoreBtn.classList.add("is-hidden");
      }
    }
  } catch (err) {
    console.error("Error al cargar publicaciones:", err);
  }
});