const state = {
  restaurants: [],
  selectedRestaurant: null,
  menu: [],
  cart: [],
  lastOrderId: null,
  orders: []
};

const els = {
  health: document.getElementById('health'),
  searchInput: document.getElementById('searchInput'),
  clearBtn: document.getElementById('clearBtn'),
  restaurantList: document.getElementById('restaurantList'),
  selectedRestaurant: document.getElementById('selectedRestaurant'),
  menuTitle: document.getElementById('menuTitle'),
  menuSubtitle: document.getElementById('menuSubtitle'),
  menuList: document.getElementById('menuList'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutForm: document.getElementById('checkoutForm'),
  orderResult: document.getElementById('orderResult'),
  trackingBox: document.getElementById('trackingBox'),
  ordersList: document.getElementById('ordersList'),
  refreshOrdersBtn: document.getElementById('refreshOrdersBtn'),
};

// Validate DOM elements exist
Object.entries(els).forEach(([key, el]) => {
  if (!el) console.warn(`Missing DOM element: ${key}`);
});

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function money(v) {
  return `₹${Number(v).toFixed(2)}`;
}

function renderRestaurants() {
  if (!els.restaurantList) return;
  
  const q = (els.searchInput?.value || '').trim().toLowerCase();
  const filtered = state.restaurants.filter(r =>
    `${r.name} ${r.cuisine}`.toLowerCase().includes(q)
  );
  
  els.restaurantList.innerHTML = filtered.map(r => `
    <div class="card ${state.selectedRestaurant?.id === r.id ? 'active' : ''}" 
         onclick="selectRestaurant(${r.id})" role="button" tabindex="0"
         onkeypress="if(event.key==='Enter') selectRestaurant(${r.id})">
      <h3>${escapeHtml(r.name)}</h3>
      <div class="muted">${escapeHtml(r.cuisine)}</div>
      <p>⭐ ${escapeHtml(r.rating)} · ${escapeHtml(r.eta)}</p>
      <span class="badge">${escapeHtml(r.address)}</span>
    </div>
  `).join('');
}

async function selectRestaurant(id) {
  state.selectedRestaurant = state.restaurants.find(r => r.id === id) || null;
  state.cart = [];
  state.lastOrderId = null;
  if (els.orderResult) els.orderResult.innerHTML = '';
  if (els.trackingBox) els.trackingBox.classList.add('hidden');
  if (!state.selectedRestaurant) return;

  if (els.selectedRestaurant) {
    els.selectedRestaurant.textContent = `${state.selectedRestaurant.name} · ${state.selectedRestaurant.cuisine}`;
  }
  if (els.menuTitle) els.menuTitle.textContent = `${state.selectedRestaurant.name} Menu`;
  if (els.menuSubtitle) els.menuSubtitle.textContent = state.selectedRestaurant.address;

  try {
    state.menu = await api(`/api/restaurants/${id}/menu`);
    renderMenu();
    renderRestaurants();
    renderCart();
  } catch (err) {
    showError(`Failed to load menu: ${err.message}`);
  }
}

function addToCart(item) {
  if (!item || !item.id) return;
  const existing = state.cart.find(x => x.id === item.id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ ...item, quantity: 1 });
  renderCart();
}

function renderMenu() {
  if (!els.menuList) return;
  
  els.menuList.innerHTML = state.menu.map(item => `
    <div class="menu-item">
      <h4>${escapeHtml(item.name)}</h4>
      <div class="small">${escapeHtml(item.category)}</div>
      <p>${money(item.price)}</p>
      <div class="menu-actions">
        <button onclick="addMenuItem(${item.id})">Add</button>
      </div>
    </div>
  `).join('');
}

window.addMenuItem = function(id) {
  const item = state.menu.find(i => i.id === id);
  if (!item) return;
  addToCart(item);
}

function renderCart() {
  if (!els.cartItems || !els.cartTotal) return;
  
  els.cartItems.innerHTML = state.cart.length
    ? state.cart.map(item => `
      <div class="cart-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="small">${money(item.price)} x ${item.quantity}</div>
        </div>
        <input class="qty" type="number" min="1" value="${item.quantity}" 
               onchange="updateQty(${item.id}, this.value)" />
      </div>
    `).join('')
    : '<div class="muted">Cart is empty</div>';

  const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  els.cartTotal.textContent = money(total);
}

window.updateQty = function(id, qty) {
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.quantity = Math.max(1, Number(qty) || 1);
  renderCart();
}

function renderOrders() {
  if (!els.ordersList) return;
  
  els.ordersList.innerHTML = state.orders.length
    ? state.orders.slice(0, 5).map(order => `
      <div class="order-card">
        <div class="cart-row">
          <strong>${escapeHtml(order.id)}</strong>
          <span class="status">${escapeHtml(order.status)}</span>
        </div>
        <div>${escapeHtml(order.customerName)} · ${escapeHtml(order.restaurantName)}</div>
        <div class="small">${order.items.length} item(s) · ${money(order.total)} · ETA ${escapeHtml(order.eta)}</div>
      </div>
    `).join('')
    : '<div class="muted">No orders yet</div>';
}

async function loadRestaurants() {
  if (els.health) els.health.textContent = 'API status: loading...';
  try {
    state.restaurants = await api('/api/restaurants');
    if (els.health) els.health.textContent = 'API status: connected';
    renderRestaurants();
  } catch (err) {
    if (els.health) els.health.textContent = 'API status: offline';
    throw err;
  }
}

async function refreshOrders() {
  try {
    state.orders = await api('/api/orders');
    renderOrders();
    if (state.lastOrderId) {
      const current = state.orders.find(o => o.id === state.lastOrderId);
      if (current && els.trackingBox) {
        els.trackingBox.classList.remove('hidden');
        els.trackingBox.innerHTML = `
          <h3>Live Tracking</h3>
          <p><strong>Order:</strong> ${escapeHtml(current.id)}</p>
          <p><strong>Status:</strong> <span class="status">${escapeHtml(current.status)}</span></p>
          <p><strong>ETA:</strong> ${escapeHtml(current.eta)}</p>
        `;
      }
    }
  } catch (err) {
    showError(`Failed to refresh orders: ${err.message}`);
  }
}

function showError(message) {
  if (els.orderResult) {
    els.orderResult.innerHTML = `<div class="error"><strong>Error:</strong> ${escapeHtml(message)}</div>`;
    els.orderResult.classList.remove('hidden');
  }
}

if (els.searchInput) els.searchInput.addEventListener('input', renderRestaurants);
if (els.clearBtn) {
  els.clearBtn.addEventListener('click', () => {
    if (els.searchInput) els.searchInput.value = '';
    renderRestaurants();
  });
}
if (els.refreshOrdersBtn) els.refreshOrdersBtn.addEventListener('click', refreshOrders);

if (els.checkoutForm) {
  els.checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.selectedRestaurant) {
      showError('Select a restaurant first');
      return;
    }
    if (!state.cart.length) {
      showError('Add at least one item');
      return;
    }

    const form = new FormData(els.checkoutForm);
    const customerName = form.get('customerName')?.trim();
    const phone = form.get('phone')?.trim();
    const address = form.get('address')?.trim();
    const paymentMethod = form.get('paymentMethod');

    if (!customerName || !phone || !address) {
      showError('Please fill in all required fields');
      return;
    }

    // Validate phone number (basic validation)
    if (!/^\d{10}$/.test(phone.replace(/[\s\-()]/g, ''))) {
      showError('Please enter a valid 10-digit phone number');
      return;
    }

    const payload = {
      customerName,
      phone,
      address,
      paymentMethod,
      restaurantId: state.selectedRestaurant.id,
      items: state.cart.map(item => ({ id: item.id, quantity: item.quantity }))
    };

    try {
      const response = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.lastOrderId = response.order.id;
      state.cart = [];
      els.checkoutForm.reset();
      if (els.orderResult) {
        els.orderResult.innerHTML = `
          <strong>✓ Order placed successfully!</strong>
          <div>Order ID: ${escapeHtml(response.order.id)}</div>
          <div>Status: ${escapeHtml(response.order.status)}</div>
          <div>ETA: ${escapeHtml(response.order.eta)}</div>
        `;
      }
      renderCart();
      await refreshOrders();
    } catch (err) {
      showError(err.message);
    }
  });
}

(async function init() {
  try {
    await loadRestaurants();
    await refreshOrders();
    if (state.restaurants.length) {
      selectRestaurant(state.restaurants[0].id);
    }
  } catch (err) {
    if (els.health) els.health.textContent = 'API status: offline';
    if (els.restaurantList) {
      els.restaurantList.innerHTML = `<div class="card error">Failed to load app: ${escapeHtml(err.message)}</div>`;
    }
  }
})();
