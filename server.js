const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(__dirname, 'orders.json');

const restaurants = [
  {
    "id": 1,
    "name": "Spice Junction",
    "cuisine": "Indian",
    "rating": 4.6,
    "eta": "25-35 min",
    "address": "MG Road, Pune",
    "menu": [
      {
        "id": 101,
        "name": "Paneer Butter Masala",
        "price": 220,
        "category": "Main Course"
      },
      {
        "id": 102,
        "name": "Butter Naan",
        "price": 35,
        "category": "Bread"
      },
      {
        "id": 103,
        "name": "Veg Biryani",
        "price": 180,
        "category": "Rice"
      },
      {
        "id": 104,
        "name": "Masala Chaas",
        "price": 40,
        "category": "Beverage"
      }
    ]
  },
  {
    "id": 2,
    "name": "Burger Bay",
    "cuisine": "Fast Food",
    "rating": 4.4,
    "eta": "20-30 min",
    "address": "Baner, Pune",
    "menu": [
      {
        "id": 201,
        "name": "Classic Cheeseburger",
        "price": 160,
        "category": "Burger"
      },
      {
        "id": 202,
        "name": "Loaded Fries",
        "price": 120,
        "category": "Sides"
      },
      {
        "id": 203,
        "name": "Chicken Nuggets",
        "price": 140,
        "category": "Sides"
      },
      {
        "id": 204,
        "name": "Cold Coffee",
        "price": 90,
        "category": "Beverage"
      }
    ]
  },
  {
    "id": 3,
    "name": "Green Bowl",
    "cuisine": "Healthy",
    "rating": 4.7,
    "eta": "30-40 min",
    "address": "Kothrud, Pune",
    "menu": [
      {
        "id": 301,
        "name": "Quinoa Salad",
        "price": 250,
        "category": "Salad"
      },
      {
        "id": 302,
        "name": "Grilled Veg Wrap",
        "price": 170,
        "category": "Wrap"
      },
      {
        "id": 303,
        "name": "Fruit Smoothie",
        "price": 110,
        "category": "Beverage"
      },
      {
        "id": 304,
        "name": "Soup of the Day",
        "price": 130,
        "category": "Soup"
      }
    ]
  }
];

function loadOrders() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load orders:', err);
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

function getMenuItem(restaurantId, itemId) {
  const restaurant = restaurants.find(r => r.id === Number(restaurantId));
  if (!restaurant) return null;
  return restaurant.menu.find(item => item.id === Number(itemId)) || null;
}

function computeStatus(createdAt) {
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (mins < 1) return 'Placed';
  if (mins < 2) return 'Confirmed';
  if (mins < 4) return 'Preparing';
  if (mins < 6) return 'Out for delivery';
  return 'Delivered';
}

function computeETA(createdAt) {
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
  const left = Math.max(0, 35 - Math.floor(mins * 5));
  return `${left} min`;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(ROOT, 'frontend')));

app.get('/api/restaurants', (req, res) => {
  res.json(restaurants.map(({ menu, ...rest }) => rest));
});

app.get('/api/restaurants/:id/menu', (req, res) => {
  const restaurant = restaurants.find(r => r.id === Number(req.params.id));
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  res.json(restaurant.menu);
});

app.get('/api/orders', (req, res) => {
  const orders = loadOrders();
  res.json(orders.map(order => ({
    ...order,
    status: computeStatus(order.createdAt),
    eta: computeETA(order.createdAt)
  })));
});

app.get('/api/orders/:id', (req, res) => {
  const orders = loadOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({
    ...order,
    status: computeStatus(order.createdAt),
    eta: computeETA(order.createdAt)
  });
});

app.post('/api/orders', (req, res) => {
  const { customerName, phone, address, restaurantId, items, paymentMethod } = req.body;

  if (!customerName || !phone || !address || !restaurantId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const restaurant = restaurants.find(r => r.id === Number(restaurantId));
  if (!restaurant) return res.status(400).json({ error: 'Invalid restaurant' });

  const enrichedItems = items.map(item => {
    const menuItem = getMenuItem(restaurantId, item.id);
    if (!menuItem) throw new Error('Invalid item selected');
    return {
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: Number(item.quantity) || 1
    };
  });

  const total = enrichedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = {
    id: 'FD' + Date.now(),
    customerName,
    phone,
    address,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    items: enrichedItems,
    total,
    paymentMethod: paymentMethod || 'Online',
    createdAt: new Date().toISOString()
  };

  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);

  res.status(201).json({
    message: 'Order placed successfully',
    order: {
      ...order,
      status: computeStatus(order.createdAt),
      eta: computeETA(order.createdAt)
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Food Delivery API running' });
});

app.listen(PORT, () => {
  console.log(`Food Delivery App running on http://localhost:${PORT}`);
});
