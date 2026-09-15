import { loadRecipes } from './data.js';
import { read, write, remove } from './storage.js';
import { escapeHtml, formatIngredient, formatAmount, weekStart, weekKey, vibrate } from './utils.js';

const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
let db = { categories: {}, recipes: [] };
let plannerOffset = 0;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const recipeById = (id) => db.recipes.find(r => r.id === id);

function navigate(hash) {
  history.pushState({}, '', hash);
  renderRoute();
}

function recipeHref(id) {
  return `#recipe/${encodeURIComponent(id)}`;
}

function renderHome() {
  app.innerHTML = `
    <section class="home-hero">
      <div class="home-hero-copy">
        <span class="home-eyebrow">THE TRITLE KITCHEN</span>
        <h1>What are we cooking?</h1>
        <p>Find something for tonight, rediscover a favorite, or browse the kitchen by category.</p>
      </div>

      <div class="home-search-wrap">
        <span class="home-search-icon">⌕</span>
        <input
          id="nameSearch"
          class="home-search"
          type="search"
          placeholder="Search recipes…"
          autocomplete="off"
          aria-label="Search recipes"
        >
      </div>
    </section>

    <section class="recipe-browser">
      <div class="browser-top">
        <div>
          <span class="section-kicker">YOUR RECIPE BOX</span>
          <h2>Browse Recipes</h2>
        </div>
        <div class="browser-count" id="recipeCount"></div>
      </div>

      <div class="category-bar" id="categoryBar"></div>

      <div class="browser-tools">
        <select id="subcategory" class="control browser-select" disabled>
          <option value="">All sub-categories</option>
        </select>

        <input
          id="ingredientSearch"
          class="control"
          type="search"
          placeholder="Search ingredients…"
          autocomplete="off"
          aria-label="Search ingredients"
        >

        <button class="filter-btn" id="favoritesFilter" type="button">
          <span>☆</span> Favorites
        </button>
      </div>

      <div id="results" class="recipe-grid"></div>
    </section>

    <section class="home-actions">
      <button class="home-action-card" id="plannerBtn" type="button">
        <span class="home-action-icon">▦</span>
        <span>
          <strong>Meal Planner</strong>
          <small>Plan your week and build a grocery list.</small>
        </span>
        <span class="home-action-arrow">→</span>
      </button>

      <button class="home-action-card" id="submitBtn" type="button">
        <span class="home-action-icon">＋</span>
        <span>
          <strong>Submit a Recipe</strong>
          <small>Add another favorite to the kitchen.</small>
        </span>
        <span class="home-action-arrow">→</span>
      </button>
    </section>
  `;

  const categoryBar = $('#categoryBar');
  const subcategory = $('#subcategory');
  const nameSearch = $('#nameSearch');
  const ingredientSearch = $('#ingredientSearch');
  const favoritesFilter = $('#favoritesFilter');

  let activeCategory = "";
  let favoritesOnly = false;

  const categories = Object.keys(db.categories).sort((a, b) => a.localeCompare(b));

  categoryBar.innerHTML = [
    `<button class="category-chip active" data-category="">All Recipes</button>`,
    ...categories.map(c =>
      `<button class="category-chip" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ),
    `<button class="category-chip" data-category="__gluten_free__">Gluten Free</button>`
  ].join('');

  const updateSubcategories = () => {
    subcategory.innerHTML = '<option value="">All sub-categories</option>';
    subcategory.disabled = !activeCategory;

    if (activeCategory && activeCategory !== "__gluten_free__") {
      Object.keys(db.categories[activeCategory])
        .sort((a, b) => a.localeCompare(b))
        .forEach(s => subcategory.add(new Option(s, s)));
    }
  };

  const imageFor = (recipe) => {
    const slug = (recipe.url || recipe.id || '')
      .split('/')
      .pop()
      .replace(/\.html$/i, '');

    return {
      jpg: `assets/recipes/${slug}.jpg`,
      png: `assets/recipes/${slug}.png`,
    };
  };

  const render = () => {
    const nameTerm = nameSearch.value.trim().toLowerCase();
    const ingredientTerms = ingredientSearch.value
      .toLowerCase()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const filtered = db.recipes
      .filter(r => {
        if (activeCategory === "__gluten_free__" && !r.glutenFree) return false;
        if (activeCategory && activeCategory !== "__gluten_free__" && r.category !== activeCategory) return false;
        if (subcategory.value && r.subcategory !== subcategory.value) return false;
        if (favoritesOnly && !r.favorite) return false;
        if (nameTerm && !r.displayName.toLowerCase().includes(nameTerm)) return false;

        if (ingredientTerms.length) {
          const ingredients = (r.ingredients ?? []).map(i =>
            `${i.item ?? ''} ${i.note ?? ''}`.toLowerCase()
          );
          if (!ingredientTerms.every(term =>
            ingredients.some(i => i.includes(term))
          )) return false;
        }

        return true;
      })
      .sort((a, b) =>
        (Number(b.favorite) - Number(a.favorite)) ||
        a.displayName.localeCompare(b.displayName)
      );

    $('#recipeCount').textContent =
      `${filtered.length} ${filtered.length === 1 ? 'recipe' : 'recipes'}`;

    if (!filtered.length) {
      $('#results').innerHTML = `
        <div class="recipe-empty">
          <div class="recipe-empty-icon">⌕</div>
          <h3>No recipes found</h3>
          <p>Try a different search, category, or ingredient.</p>
          <button class="btn primary" id="clearFilters">Clear Filters</button>
        </div>`;
      $('#clearFilters').onclick = () => {
        activeCategory = "";
        favoritesOnly = false;
        nameSearch.value = "";
        ingredientSearch.value = "";
        updateSubcategories();
        $$('.category-chip', categoryBar).forEach(b => b.classList.toggle('active', b.dataset.category === ""));
        favoritesFilter.classList.remove('active');
        render();
      };
      return;
    }

    $('#results').innerHTML = filtered.map(r => `
      <article
        class="recipe-card-v2"
        data-recipe="${escapeHtml(r.id)}"
        tabindex="0"
        role="button"
        aria-label="Open ${escapeHtml(r.displayName)}"
      >
        <div class="recipe-card-image-wrap">
          <img
            class="recipe-card-image"
            src="${imageFor(r).jpg}"
            data-image-jpg="${imageFor(r).jpg}"
            data-image-png="${imageFor(r).png}"
            data-image-index="0"
            alt=""
            loading="lazy"
          >
          <button
            class="card-favorite ${r.favorite ? 'is-favorite' : ''}"
            data-favorite="${escapeHtml(r.id)}"
            type="button"
            aria-label="${r.favorite ? 'Remove from favorites' : 'Add to favorites'}"
          >
            ${r.favorite ? '★' : '☆'}
          </button>
        </div>

        <div class="recipe-card-content">
          <div class="recipe-card-meta">
            <span>${escapeHtml(r.category)}</span>
            <span>•</span>
            <span>${escapeHtml(r.subcategory)}</span>
          </div>
          <h3>${escapeHtml(r.displayName)}</h3>
          ${r.subtitle ? `<p>${escapeHtml(r.subtitle)}</p>` : ''}
        </div>
      </article>
    `).join('');

    $$('.recipe-card-image', $('#results')).forEach(img => {
      img.addEventListener('error', () => {
        const currentIndex = Number(img.dataset.imageIndex || '0');

        if (currentIndex === 0 && img.dataset.imagePng) {
          img.dataset.imageIndex = '1';
          img.src = img.dataset.imagePng;
          return;
        }

        img.classList.add('image-missing');
        img.removeAttribute('src');
      });
    });
  };

  categoryBar.addEventListener('click', e => {
    const button = e.target.closest('[data-category]');
    if (!button) return;

    activeCategory = button.dataset.category;
    $$('.category-chip', categoryBar).forEach(b =>
      b.classList.toggle('active', b === button)
    );
    updateSubcategories();
    render();
  });

  [nameSearch, ingredientSearch, subcategory].forEach(el =>
    el.addEventListener('input', render)
  );

  favoritesFilter.onclick = () => {
    favoritesOnly = !favoritesOnly;
    favoritesFilter.classList.toggle('active', favoritesOnly);
    favoritesFilter.querySelector('span').textContent = favoritesOnly ? '★' : '☆';
    render();
  };

  $('#results').addEventListener('click', e => {
    const favoriteButton = e.target.closest('[data-favorite]');
    if (favoriteButton) {
      e.stopPropagation();

      const id = favoriteButton.dataset.favorite;
      const recipe = recipeById(id);
      if (!recipe) return;

      const favorites = read('favorites', {});
      recipe.favorite = !recipe.favorite;
      favorites[id] = recipe.favorite;
      write('favorites', favorites);
      vibrate(10);
      render();
      return;
    }

    const card = e.target.closest('[data-recipe]');
    if (card) navigate(recipeHref(card.dataset.recipe));
  });

  $('#results').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-recipe]');
    if (!card || e.target.closest('button')) return;
    e.preventDefault();
    navigate(recipeHref(card.dataset.recipe));
  });

  $('#plannerBtn').onclick = () => navigate('#planner');
  $('#submitBtn').onclick = openSubmitModal;

  updateSubcategories();
  render();
}

function findImage(recipe) {
  const slug = (recipe.url || recipe.id || '')
    .split('/')
    .pop()
    .replace(/\.html$/i, '');

  return `assets/recipes/${slug}.jpg`;
}

function renderRecipe(recipe) {
  if (!recipe) {
    app.innerHTML = `
      <section class="section empty">
        <h2>Recipe not found.</h2>
        <button class="btn" id="backToHome">Back to Recipes</button>
      </section>`;
    $('#backToHome').onclick = () => navigate('#home');
    return;
  }

  const ingredients = recipe.ingredients ?? [];
  const directions = recipe.directions ?? [];

  const imageSlug = (recipe.url || recipe.id || '')
    .split('/')
    .pop()
    .replace(/\.html$/i, '');

  const imageCandidates = [
    `assets/recipes/${imageSlug}.jpg`,
    `assets/recipes/${imageSlug}.png`,
  ];

  const ingredientHtml = ingredients.length
    ? ingredients.map(ingredient => ingredient?.type === "section"
        ? `<li class="ingredient-section">${escapeHtml(ingredient.text ?? "")}</li>`
        : `
        <li class="ingredient-item">
          <span class="ingredient-dot"></span>
          <span>${escapeHtml(formatIngredient(ingredient))}</span>
        </li>`
      ).join('')
    : `<li class="empty-message">No ingredients are available for this recipe.</li>`;

  const directionHtml = directions.length
    ? directions.map((step, index) => `
        <li class="direction-item">
          <span class="direction-number">${index + 1}</span>
          <div class="direction-text">${escapeHtml(step)}</div>
        </li>
      `).join('')
    : `<li class="empty-message">No directions are available for this recipe.</li>`;

  app.innerHTML = `
    <article class="recipe-page-v2">

      <div class="recipe-topbar">
        <button class="secondary-btn" id="backToRecipes" type="button">
          ← Back to Recipes
        </button>

        <button
          class="favorite-btn ${recipe.favorite ? 'is-favorite' : ''}"
          id="recipeFavorite"
          type="button"
          aria-label="${recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}"
        >
          <span class="favorite-star">${recipe.favorite ? '★' : '☆'}</span>
          <span>${recipe.favorite ? 'Favorite' : 'Add Favorite'}</span>
        </button>
      </div>

      <header class="recipe-intro">
        <div class="recipe-breadcrumb">
          <span>${escapeHtml(recipe.category)}</span>
          <span>/</span>
          <span>${escapeHtml(recipe.subcategory)}</span>
        </div>

        <h1>${escapeHtml(recipe.displayName)}</h1>

        ${recipe.subtitle
          ? `<p class="recipe-subtitle-v2">${escapeHtml(recipe.subtitle)}</p>`
          : ''}
      </header>

      <div class="recipe-photo-frame" id="recipePhotoFrame">
        <img
          class="recipe-hero-image-v2"
          src="${imageCandidates[0]}"
          data-image-index="0"
          alt="${escapeHtml(recipe.displayName)}"
          loading="eager"
        >
        <div class="recipe-no-photo" aria-hidden="true">
          <span>NO PHOTO</span>
          <strong>${escapeHtml(recipe.displayName)}</strong>
        </div>
      </div>

      <div class="recipe-quick-actions">
        <button class="primary-btn" id="printRecipe" type="button">
          🖨 Print / Save PDF
        </button>

        <button class="secondary-btn" id="copyRecipeLink" type="button">
          ↗ Copy Recipe Link
        </button>

        <a class="secondary-btn" href="#recipe/${encodeURIComponent(recipe.id)}/ingredients">Ingredients ↓</a>
        <a class="secondary-btn" href="#recipe/${encodeURIComponent(recipe.id)}/directions">Directions ↓</a>
      </div>

      <div class="recipe-content-grid">

        <aside class="ingredients-panel recipe-panel" id="ingredients">
          <div class="panel-heading">
            <span class="section-kicker">WHAT YOU NEED</span>
            <h2>Ingredients</h2>
            <span class="panel-count">${ingredients.length} ${ingredients.length === 1 ? 'item' : 'items'}</span>
          </div>

          <ul class="ingredient-list-v2">
            ${ingredientHtml}
          </ul>
        </aside>

        <section class="directions-panel recipe-panel" id="directions">
          <div class="panel-heading">
            <span class="section-kicker">HOW TO MAKE IT</span>
            <h2>Directions</h2>
            <span class="panel-count">${directions.length} ${directions.length === 1 ? 'step' : 'steps'}</span>
          </div>

          <ol class="direction-list-v2">
            ${directionHtml}
          </ol>
        </section>

      </div>

      <section class="cook-mode-card cook-mode-v2">
        <div class="cook-mode-copy">
          <span class="section-kicker">COOKING MODE</span>
          <h2>Keep the screen awake</h2>
          <p>Turn this on while cooking to prevent your device from going to sleep.</p>
        </div>

        <label class="switch" aria-label="Keep screen awake">
          <input
            type="checkbox"
            id="cookModeToggle"
            ${read('cookMode', false) ? 'checked' : ''}
          >
          <span class="slider"></span>
        </label>
      </section>

    </article>
  `;

  $('#backToRecipes')?.addEventListener('click', () => navigate('#home'));

  $('#recipeFavorite')?.addEventListener('click', () => {
    const favorites = read('favorites', {});
    recipe.favorite = !recipe.favorite;
    favorites[recipe.id] = recipe.favorite;
    write('favorites', favorites);
    vibrate(10);
    renderRecipe(recipe);
  });

  const printButton = $('#printRecipe');

  // Use the compact recipe-card print layout on phones and tablets,
  // regardless of whether the device is currently portrait or landscape.
  // Android/iOS devices are detected independently of viewport width so
  // rotating a phone or tablet cannot switch to the desktop print layout.
  const isMobileOrTabletDevice = () => {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    // iPadOS can request the desktop Safari user-agent, so identify it
    // by its Macintosh UA combined with touch support.
    const isIPadDesktopMode =
      /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;

    return isAppleMobile || isAndroid || isIPadDesktopMode;
  };

  const compactPrintDevice = isMobileOrTabletDevice();

  if (printButton) {
    printButton.textContent = compactPrintDevice
      ? '💾 Save Recipe PDF'
      : '🖨 Print / Save PDF';
  }

  printButton?.addEventListener('click', () => {
    document.body.classList.toggle('mobile-recipe-print', compactPrintDevice);
    window.print();
  });

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('mobile-recipe-print');
  }, { once: false });

  $('#copyRecipeLink')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      const original = button.textContent;
      button.textContent = '✓ Link Copied';
      vibrate(10);
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch {
      button.textContent = 'Copy unavailable';
      setTimeout(() => { button.textContent = '↗ Copy Recipe Link'; }, 1800);
    }
  });

  const image = $('#recipePhotoFrame .recipe-hero-image-v2');

  if (image) {
    image.addEventListener('error', () => {
      const currentIndex = Number(image.dataset.imageIndex || '0');
      const nextIndex = currentIndex + 1;

      if (nextIndex < imageCandidates.length) {
        image.dataset.imageIndex = String(nextIndex);
        image.src = imageCandidates[nextIndex];
      } else {
        $('#recipePhotoFrame')?.classList.add('no-photo');
        image.remove();
      }
    });
  }

  setupCookMode();
}

function setupCookMode() {
  const toggle = $('#cookModeToggle');
  if (!toggle) return;

  if (wakeLockVisibilityHandler) {
    document.removeEventListener('visibilitychange', wakeLockVisibilityHandler);
  }

  const saved = Boolean(read('cookMode', false));
  toggle.checked = saved;

  if (saved) requestWakeLock();

  toggle.addEventListener('change', async () => {
    write('cookMode', toggle.checked);

    if (toggle.checked) {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
    }
  });

  wakeLockVisibilityHandler = () => {
    if (toggle.checked && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  };

  document.addEventListener('visibilitychange', wakeLockVisibilityHandler);
}

let wakeLock = null;
let wakeLockVisibilityHandler = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {}
}

async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch {}
  wakeLock = null;
}

function getPlan() { return read(`plan:${weekKey(weekStart(new Date(), plannerOffset))}`, Array.from({length:7},()=>[])); }
function savePlan(plan){ write(`plan:${weekKey(weekStart(new Date(), plannerOffset))}`, plan); }

function renderPlanner() {
  const start = weekStart(new Date(), plannerOffset);
  const plan = getPlan();

  const weekEnd = new Date(start);
  weekEnd.setDate(start.getDate() + 6);

  const dateLabel =
    start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' – ' +
    weekEnd.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

  const totalMeals = plan.reduce((total, day) => total + day.length, 0);

  app.innerHTML = `
    <section class="planner-page">

      <header class="planner-hero">
        <div>
          <span class="section-kicker">PLAN YOUR WEEK</span>
          <h1>Meal Planner</h1>
          <p>Choose your meals for the week, then turn your plan into a grocery list.</p>
        </div>

        <div class="planner-summary">
          <strong>${totalMeals}</strong>
          <span>${totalMeals === 1 ? 'meal planned' : 'meals planned'}</span>
        </div>
      </header>

      <section class="planner-toolbar">
        <button class="secondary-btn" id="prev" type="button">← Previous</button>

        <div class="planner-week">
          <span>WEEK OF</span>
          <strong>${escapeHtml(dateLabel)}</strong>
        </div>

        <button class="secondary-btn" id="next" type="button">Next →</button>
        <button class="today-btn" id="today" type="button">Today</button>
      </section>

      <section class="planner-builder">

        <div class="planner-library">
          <div class="planner-section-heading">
            <div>
              <span class="section-kicker">RECIPE BOX</span>
              <h2>Add a meal</h2>
            </div>
            <span id="poolCount" class="panel-count"></span>
          </div>

          <div class="planner-search-row">
            <input
              id="plannerSearch"
              class="control"
              type="search"
              placeholder="Search recipes…"
              autocomplete="off"
            >

            <select id="plannerAddDay" class="control" aria-label="Choose day to add recipe">
              ${Array.from({ length: 7 }, (_, i) => {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                return `<option value="${i}">${d.toLocaleDateString(undefined, { weekday: 'long' })}</option>`;
              }).join('')}
            </select>
          </div>

          <p class="planner-help">
            Drag a recipe onto a day, or choose a day and tap <strong>Add</strong>.
          </p>

          <div id="pool" class="recipe-pool-v2"></div>
        </div>

        <div class="week-board">
          <div class="week-board-heading">
            <div>
              <span class="section-kicker">YOUR WEEK</span>
              <h2>Meals</h2>
            </div>
            <span class="panel-count">Drag to reorder or move meals</span>
          </div>

          <div id="planner" class="planner-grid-v2"></div>

          <section class="planner-actions planner-actions-centered">
            <button class="secondary-btn danger-btn" id="clearWeek" type="button">Clear Week</button>
            <button class="primary-btn" id="grocery" type="button">🛒 Generate Grocery List</button>
            <button class="secondary-btn" id="calendar" type="button">＋ Add Week to Calendar</button>
          </section>

        </div>

      </section>

      <div id="groceryList" class="grocery-v2"></div>

    </section>
  `;

  $('#prev').onclick = () => { plannerOffset--; renderPlanner(); };
  $('#next').onclick = () => { plannerOffset++; renderPlanner(); };
  $('#today').onclick = () => { plannerOffset = 0; renderPlanner(); };

  $('#clearWeek').onclick = () => {
    if (!totalMeals || confirm('Clear all meals from this week?')) {
      remove(`plan:${weekKey(start)}`);
      renderPlanner();
    }
  };

  $('#grocery').onclick = renderGrocery;
  $('#calendar').onclick = exportCalendar;

  const pool = $('#pool');
  const search = $('#plannerSearch');
  const addDay = $('#plannerAddDay');

  const addRecipeToDay = (id, dayIndex) => {
    if (!plan[dayIndex]) plan[dayIndex] = [];
    plan[dayIndex].push(id);
    savePlan(plan);
    vibrate(15);
    renderPlanner();
  };

  const renderPool = () => {
    const q = search.value.toLowerCase().trim();

    const list = db.recipes
      .filter(r => !q || r.displayName.toLowerCase().includes(q))
      .sort((a, b) =>
        (Number(b.favorite) - Number(a.favorite)) ||
        a.displayName.localeCompare(b.displayName)
      )
      .slice(0, 40);

    $('#poolCount').textContent = `${list.length}${q ? '' : '+'} recipes`;

    pool.innerHTML = list.map(r => `
      <article class="planner-recipe-card" draggable="true" data-add="${escapeHtml(r.id)}">
        <div class="planner-recipe-thumb">
          <img
            src="${escapeHtml(findImage(r))}"
            alt=""
            loading="lazy"
          >
        </div>

        <div class="planner-recipe-info">
          <div class="recipe-card-meta">
            <span>${escapeHtml(r.category)}</span>
          </div>
          <strong>${r.favorite ? '★ ' : ''}${escapeHtml(r.displayName)}</strong>
        </div>

        <button class="planner-add-btn" data-add-button="${escapeHtml(r.id)}" type="button">
          Add
        </button>
      </article>
    `).join('');

    $$('.planner-recipe-card img', pool).forEach(img => {
      img.addEventListener('error', () => {
        img.remove();
        img.parentElement?.classList.add('image-missing');
      }, { once: true });
    });

    $$('.planner-recipe-card', pool).forEach(card => {
      card.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', card.dataset.add);
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
  };

  pool.addEventListener('click', e => {
    const button = e.target.closest('[data-add-button]');
    if (!button) return;
    e.stopPropagation();
    addRecipeToDay(button.dataset.addButton, Number(addDay.value));
  });

  const planner = $('#planner');

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);

    const day = document.createElement('section');
    day.className = 'planner-day-v2';

    if (dayDate.toDateString() === new Date().toDateString()) {
      day.classList.add('today');
    }

    const dayMeals = plan[i] || [];

    day.innerHTML = `
      <header class="planner-day-header">
        <div>
          <span class="day-name">${dayDate.toLocaleDateString(undefined, { weekday: 'long' })}</span>
          <strong>${dayDate.getDate()}</strong>
        </div>
        <span class="day-meal-count">${dayMeals.length}</span>
      </header>

      <div class="planner-dropzone" data-day="${i}">
        ${dayMeals.length ? '' : `<div class="planner-drop-hint">Drop a recipe here</div>`}
        <button class="day-add-meal" type="button" data-day-add="${i}">
          ＋ Add Meal
        </button>
      </div>
    `;

    const dropzone = day.querySelector('.planner-dropzone');

    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', e => {
      if (!dropzone.contains(e.relatedTarget)) {
        dropzone.classList.remove('drag-over');
      }
    });

    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');

      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;

      const sourceDay = plan.findIndex(dayItems => dayItems.includes(id));

      if (sourceDay >= 0) {
        const sourceIndex = plan[sourceDay].indexOf(id);
        plan[sourceDay].splice(sourceIndex, 1);
      }

      if (!plan[i]) plan[i] = [];
      plan[i].push(id);

      savePlan(plan);
      vibrate(20);
      renderPlanner();
    });

    dayMeals.forEach((id, idx) => {
      const r = recipeById(id);
      if (!r) return;

      const meal = document.createElement('article');
      meal.className = 'planned-meal';
      meal.draggable = true;

      meal.innerHTML = `
        <div class="planned-meal-thumb">
          <img src="${escapeHtml(findImage(r))}" alt="" loading="lazy">
        </div>

        <div class="planned-meal-copy">
          <strong>${escapeHtml(r.displayName)}</strong>
          <span>${escapeHtml(r.subcategory)}</span>
        </div>

        <button
          class="planned-meal-remove"
          type="button"
          aria-label="Remove ${escapeHtml(r.displayName)}"
        >×</button>
      `;

      meal.querySelector('img')?.addEventListener('error', e => {
        e.currentTarget.style.display = 'none';
      });

      meal.querySelector('.planned-meal-remove').onclick = e => {
        e.stopPropagation();
        plan[i].splice(idx, 1);
        savePlan(plan);
        vibrate(25);
        renderPlanner();
      };

      meal.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        navigate(recipeHref(id));
      });

      meal.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        meal.classList.add('dragging');
      });

      meal.addEventListener('dragend', () => meal.classList.remove('dragging'));

      dropzone.appendChild(meal);
    });

    planner.appendChild(day);
  }

  $$('[data-day-add]', planner).forEach(button => {
    button.addEventListener('click', () => {
      addDay.value = button.dataset.dayAdd;
      document.querySelector('.planner-library')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      setTimeout(() => search.focus(), 150);
    });
  });

  search.addEventListener('input', renderPool);
  renderPool();
}
function renderGrocery(){
  const plan=getPlan(); const totals=new Map();
  plan.flat().forEach(id=>{const r=recipeById(id); (r?.ingredients??[]).forEach(i=>{ if(!i.item) return; const key=`${i.item.toLowerCase()}|${i.unit||''}`; const current=totals.get(key); totals.set(key,current?{...current,amount:Number(current.amount||0)+Number(i.amount||0)}:{...i}); });});
  const grouped={}; totals.forEach(i=>{const c=getIngredientCategory(i.item);(grouped[c]??=[]).push(i)});
  $('#groceryList').innerHTML=`<section class="section"><h2>Grocery List</h2>${Object.keys(grouped).sort().map(c=>`<div class="grocery-category"><button type="button" data-collapse>${escapeHtml(c)} <span>▾</span></button><ul class="grocery-items">${grouped[c].sort((a,b)=>(a.item||'').localeCompare(b.item||'')).map(i=>`<li data-check>${escapeHtml(`${formatAmount(i.amount)} ${i.unit||''} ${i.item}${i.note?' — '+i.note:''}`.replace(/\s+/g,' ').trim())}</li>`).join('')}</ul></div>`).join('')}</section>`;
  $$('[data-collapse]').forEach(b=>b.onclick=()=>b.nextElementSibling.classList.toggle('hidden')); $$('[data-check]').forEach(li=>li.onclick=()=>{li.classList.toggle('checked');});
}
function getIngredientCategory(item=''){const n=item.toLowerCase();if(/soup|broth|stock|rotel|beans|canned|jar|package|can /.test(n))return'Canned & Pantry';if(/milk|cheese|cream|butter|yogurt|sour cream/.test(n))return'Dairy';if(/chicken|beef|bacon|pork|ham|steak|turkey|sausage/.test(n))return'Meat';if(/onion|lemon|apple|tomato|cucumber|pepper|cilantro|carrot|lettuce|zucchini|banana/.test(n))return'Produce';if(/flour|sugar|baking|oats|cocoa|powder|chips|rice/.test(n))return'Baking & Dry Goods';return'Other'}
function icsEscape(value=''){return String(value).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
function exportCalendar(){const start=weekStart(new Date(),plannerOffset),plan=getPlan();let ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Tritle Kitchen//EN\r\n';plan.forEach((day,i)=>{if(!day.length)return;const d=new Date(start);d.setDate(start.getDate()+i);const ds=d.toISOString().slice(0,10).replaceAll('-','');day.forEach(id=>{const r=recipeById(id);if(!r)return;const ingredients=(r.ingredients??[]).map(i=>i?.type === "section" ? `\n${String(i.text ?? "").toUpperCase()}\n` : i?.item ? `- ${formatIngredient(i)}` : "").filter(Boolean);const description=ingredients.length?`INGREDIENTS\n\n${ingredients.join('\n')}`:'INGREDIENTS\n\nNo ingredients are available for this recipe.';ics+=`BEGIN:VEVENT\r\nUID:${crypto.randomUUID()}\r\nDTSTAMP:${ds}T120000Z\r\nDTSTART;VALUE=DATE:${ds}\r\nSUMMARY:${icsEscape(r.displayName)}\r\nDESCRIPTION:${icsEscape(description)}\r\nEND:VEVENT\r\n`})});ics+='END:VCALENDAR\r\n';const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));const a=document.createElement('a');a.href=url;a.download=`tritle-kitchen-week-${weekKey(start)}.ics`;a.click();URL.revokeObjectURL(url)}
function openSubmitModal(){modalRoot.innerHTML=`<div class="modal-backdrop" id="submitBackdrop"><div class="modal"><div class="modal-head"><h2>Submit a Recipe</h2><button class="btn" id="close">×</button></div><p class="meta">Prepare your recipe text and attach any photos using your usual submission method.</p><textarea id="recipeText" placeholder="Recipe name\n\nIngredients\n\nDirections"></textarea><div class="action-row"><button class="btn primary" id="copy">Copy Recipe</button><a class="btn" href="mailto:?subject=Tritle%20Kitchen%20Recipe%20Submission" id="email">Email</a></div></div></div>`; $('#close').onclick=()=>modalRoot.innerHTML=''; $('#submitBackdrop').onclick=e=>{if(e.target.id==='submitBackdrop')modalRoot.innerHTML='';}; $('#copy').onclick=async()=>{await navigator.clipboard?.writeText($('#recipeText').value);vibrate(10);}};

function renderRoute(){
  const raw = decodeURIComponent(location.hash.slice(1));

  if (raw.startsWith('recipe/')) {
    let route = raw.slice('recipe/'.length);
    let targetSection = '';

    if (route.endsWith('/ingredients')) {
      targetSection = 'ingredients';
      route = route.slice(0, -'/ingredients'.length);
    } else if (route.endsWith('/directions')) {
      targetSection = 'directions';
      route = route.slice(0, -'/directions'.length);
    }

    const id = route;
    const recipe = recipeById(id);

    if (recipe) {
      renderRecipe(recipe);

      if (targetSection) {
        requestAnimationFrame(() => {
          document.getElementById(targetSection)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        });
      }
    } else {
      app.innerHTML = `
        <section class="section empty">
          <h2>Recipe not found.</h2>
          <button class="btn" id="backToHome">Back to Recipes</button>
        </section>`;
      $('#backToHome').onclick = () => navigate('#home');
    }
  } else if (raw === 'planner') {
    renderPlanner();
  } else {
    renderHome();
  }

  // Keep normal route changes at the top of the page. The previous
  // app.scrollIntoView() call could leave the home page slightly scrolled
  // down because #app begins below the site header.
  const hasRecipeSection = raw.endsWith('/ingredients') || raw.endsWith('/directions');
  if (!hasRecipeSection) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

async function boot(){
  try{
    // Prevent the browser from restoring a previous scroll position when
    // loading or refreshing the site.
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    db=await loadRecipes();
    const favs=read('favorites',{}); db.recipes.forEach(r=>{if(Object.prototype.hasOwnProperty.call(favs,r.id))r.favorite=favs[r.id]});
    addEventListener('hashchange',renderRoute); renderRoute();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }catch(error){app.innerHTML=`<section class="section empty"><h2>Kitchen data could not be loaded.</h2><p>${escapeHtml(error.message)}</p></section>`}
}
boot();
