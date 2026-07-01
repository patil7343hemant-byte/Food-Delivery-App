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

function money(v) {
  return `₹${v}`;
}

function renderRestaurants() {
  const q = els.searchInput.value.trim().toLowerCase();
  const filtered = state.restaurants.filter(r =>
    `${r.name} ${r.cuisine}`.toLowerCase().includes(q)
  );
  els.restaurantList.innerHTML = filtered.map(r => `
    <div class="card ${state.selectedRestaurant?.id === r.id ? 'active' : ''}" onclick="selectRestaurant(${r.id})">
      <h3>${r.name}</h3>
      <div class="muted">${r.cuisine}</div>
      <p>⭐ ${r.rating} · ${r.eta}</p>
      <span class="badge">${r.address}</span>
    </div>
  `).join('');
}

async function selectRestaurant(id) {
  state.selectedRestaurant = state.restaurants.find(r => r.id === id) || null;
  state.cart = [];
  state.lastOrderId = null;
  els.orderResult.innerHTML = '';
  els.trackingBox.classList.add('hidden');
  if (!state.selectedRestaurant) return;

  els.selectedRestaurant.textContent = `${state.selectedRestaurant.name} · ${state.selectedRestaurant.cuisine}`;
  els.menuTitle.textContent = `${state.selectedRestaurant.name} Menu`;
  els.menuSubtitle.textContent = state.selectedRestaurant.address;

  state.menu = await api(`/api/restaurants/${id}/menu`);
  renderMenu();
  renderRestaurants();
  renderCart();
}

function addToCart(item) {
  const existing = state.cart.find(x => x.id === item.id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ ...item, quantity: 1 });
  renderCart();
}

function renderMenu() {
  els.menuList.innerHTML = state.menu.map(item => `
    <div class="menu-item">
      <h4>${item.name}</h4>
      <div class="small">${item.category}</div>
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
  els.cartItems.innerHTML = state.cart.length
    ? state.cart.map(item => `
      <div class="cart-row">
        <div>
          <strong>${item.name}</strong>
          <div class="small">${money(item.price)} x ${item.quantity}</div>
        </div>
        <input class="qty" type="number" min="1" value="${item.quantity}" onchange="updateQty(${item.id}, this.value)" />
      </div>
    `).join('')
    : '<div class="muted">Cart is empty</div>';

  const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  els.cartTotal.textContent = money(total);
}

window.updateQty = function(id, qty) {
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.quantity = Math.max(1, Number(qty) || 1);
  renderCart();
}

function renderOrders() {
  els.ordersList.innerHTML = state.orders.length
    ? state.orders.slice(0, 5).map(order => `
      <div class="order-card">
        <div class="cart-row">
          <strong>${order.id}</strong>
          <span class="status">${order.status}</span>
        </div>
        <div>${order.customerName} · ${order.restaurantName}</div>
        <div class="small">${order.items.length} item(s) · ${money(order.total)} · ETA ${order.eta}</div>
      </div>
    `).join('')
    : '<div class="muted">No orders yet</div>';
}

async function loadRestaurants() {
  els.health.textContent = 'API status: loading...';
  state.restaurants = await api('/api/restaurants');
  els.health.textContent = 'API status: connected';
  renderRestaurants();
}

async function refreshOrders() {
  state.orders = await api('/api/orders');
  renderOrders();
  if (state.lastOrderId) {
    const current = state.orders.find(o => o.id === state.lastOrderId);
    if (current) {
      els.trackingBox.classList.remove('hidden');
      els.trackingBox.innerHTML = `
        <h3>Live Tracking</h3>
        <p><strong>Order:</strong> ${current.id}</p>
        <p><strong>Status:</strong> <span class="status">${current.status}</span></p>
        <p><strong>ETA:</strong> ${current.eta}</p>
      `;
    }
  }
}

els.searchInput.addEventListener('input', renderRestaurants);
els.clearBtn.addEventListener('click', () => {
  els.searchInput.value = '';
  renderRestaurants();
});
els.refreshOrdersBtn.addEventListener('click', refreshOrders);

els.checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.selectedRestaurant) {
    alert('Select a restaurant first');
    return;
  }
  if (!state.cart.length) {
    alert('Add at least one item');
    return;
  }

  const form = new FormData(els.checkoutForm);
  const payload = {
    customerName: form.get('customerName'),
    phone: form.get('phone'),
    address: form.get('address'),
    paymentMethod: form.get('paymentMethod'),
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
    els.orderResult.innerHTML = `
      <strong>Order placed successfully!</strong>
      <div>Order ID: ${response.order.id}</div>
      <div>Status: ${response.order.status}</div>
      <div>ETA: ${response.order.eta}</div>
    `;
    renderCart();
    await refreshOrders();
  } catch (err) {
    alert(err.message);
  }
});

(async function init() {
  try {
    await loadRestaurants();
    await refreshOrders();
    if (state.restaurants.length) {
      selectRestaurant(state.restaurants[0].id);
    }
  } catch (err) {
    els.health.textContent = 'API status: offline';
    els.restaurantList.innerHTML = `<div class="card">Failed to load app: ${err.message}</div>`;
  }
})();
