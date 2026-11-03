import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';
import { i18n } from '../data';
import { notificationText, parseLink, timeAgo } from '../notificationHelpers';

const ID = 'a'.repeat(24);
const note = (over) => ({ id: over.id || 'n1', type: 'order_shipped', params: {}, link: `/orders/${ID}`, readAt: null, createdAt: new Date(Date.now() - 5 * 60000).toISOString(), ...over });

const pathOf = (url) => new URL(String(url)).pathname.replace(/^\/api/, '');
const callsTo = (path) => global.fetch.mock.calls.filter(([url]) => String(url).includes('/api/') && pathOf(url) === path);

// A signed-in buyer; `state` is what GET /notifications answers.
function signIn(state, cartQty = 0) {
  localStorage.setItem('artisan-token', 'token');
  localStorage.setItem('artisan-user', JSON.stringify({ id: 'u1', name: 'Bat', email: 'bat@example.com', role: 'buyer' }));
  localStorage.setItem('artisan-lang', 'en');
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    if (!String(url).includes('/api/')) return new Promise(() => {}); // exchange rates
    const path = pathOf(url);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (path === '/notifications') return ok(state);
    if (path === '/notifications/read-all') { state.items = state.items.map((n) => ({ ...n, readAt: 'now' })); state.unreadCount = 0; return ok({ unreadCount: 0 }); }
    if (path.endsWith('/read')) { state.unreadCount -= 1; return ok({ unreadCount: state.unreadCount }); }
    if (path.startsWith('/orders/')) return Promise.resolve({ ok: false, status: 404, statusText: '', json: async () => ({ error: 'Order not found' }) });
    if (path === '/cart') return ok({ items: cartQty ? [{ qty: cartQty }] : [] });
    if (path === '/users/me') return ok({ id: 'u1', name: 'Bat', email: 'bat@example.com', role: 'buyer', avatarUrl: '', bio: '' });
    return ok([]);
  });
}

const setVisibility = (value) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
};

beforeAll(() => { window.scrollTo = () => {}; });

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  localStorage.clear();
  delete document.visibilityState;
});

test('the bell shows the unread count, "9+" above 9, and nothing at 0', async () => {
  const state = { items: [], unreadCount: 0 };
  signIn(state);
  const { unmount } = render(<App />);
  const bell = await screen.findByRole('button', { name: 'Notifications' });
  expect(within(bell).queryByTestId('count-badge')).not.toBeInTheDocument();
  unmount();

  state.unreadCount = 12;
  render(<App />);
  const busy = await screen.findByRole('button', { name: 'Notifications, 12 unread' });
  expect(within(busy).getByTestId('count-badge')).toHaveTextContent('9+');
});

test('the cart shows its item count, and header icons are line icons with labels', async () => {
  signIn({ items: [], unreadCount: 0 }, 3);
  render(<App />);
  const cart = await screen.findByRole('button', { name: 'Cart, 3 items' });
  expect(within(cart).getByTestId('count-badge')).toHaveTextContent('3');
  expect(cart.querySelector('svg')).toBeInTheDocument();
  expect(cart).not.toHaveTextContent('🛍');
  const liked = screen.getByRole('button', { name: 'Liked, 0 items' });
  expect(liked.querySelector('svg')).toBeInTheDocument();
  expect(liked).not.toHaveTextContent('♡');
});

test('opening the bell lists messages; clicking one marks it read and follows the link', async () => {
  const state = { items: [note({ id: 'n1' }), note({ id: 'n2', type: 'shop_approved', link: '/profile', readAt: 'earlier' })], unreadCount: 1 };
  signIn(state);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  const panel = screen.getByRole('dialog', { name: 'Notifications' });
  expect(await within(panel).findByText('Your order has shipped.')).toBeInTheDocument();
  expect(within(panel).getAllByText('5 minutes ago')).toHaveLength(2);
  expect(within(panel).getByText('Your shop is approved and live.')).toBeInTheDocument();

  fireEvent.click(within(panel).getByRole('button', { name: /Your order has shipped/ }));
  await waitFor(() => expect(callsTo('/notifications/n1/read')).toHaveLength(1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(callsTo(`/orders/${ID}`).length).toBeGreaterThan(0); // the order page opened
  expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument(); // count back to 0
});

test('"Mark all as read" clears the count; an empty list says so', async () => {
  const state = { items: [note({ id: 'n1' })], unreadCount: 1 };
  signIn(state);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  await waitFor(() => expect(callsTo('/notifications/read-all')).toHaveLength(1));
  expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  state.items = [];
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
});

test('polls every 45 seconds while visible, pauses while hidden, and refreshes on return', async () => {
  jest.useFakeTimers();
  signIn({ items: [], unreadCount: 0 });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  const base = callsTo('/notifications').length;
  expect(base).toBeGreaterThan(0);

  await act(async () => { jest.advanceTimersByTime(45000); });
  expect(callsTo('/notifications').length).toBe(base + 1);

  setVisibility('hidden');
  await act(async () => { jest.advanceTimersByTime(180000); });
  expect(callsTo('/notifications').length).toBe(base + 1);

  setVisibility('visible');
  expect(callsTo('/notifications').length).toBe(base + 2);
  await act(async () => { jest.advanceTimersByTime(45000); });
  expect(callsTo('/notifications').length).toBe(base + 3);
});

test('every notification type has text in all three languages, none stored', () => {
  const types = Object.keys(i18n.en.notifications.text);
  expect(types.length).toBeGreaterThan(10);
  for (const lang of ['mn', 'en', 'ko']) {
    const t = i18n[lang];
    expect(Object.keys(t.notifications.text).sort()).toEqual([...types].sort());
    for (const type of types) {
      const text = notificationText(t, { type, params: { shopName: 'S', units: 2, category: 'wood', amount: 5, percent: 30, reason: 'R', title: 'Гутал', titleEn: 'Boots', count: 2 } }, (n) => `$${n}`);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/undefined|NaN/);
    }
    expect(notificationText(t, { type: 'from_the_future', params: {} }, String)).toBe(t.notifications.fallback);
  }
});

test('relative times and in-app links', () => {
  const now = Date.UTC(2026, 0, 10);
  const n = i18n.en.notifications;
  expect(timeAgo(now - 20000, n, now)).toBe('Just now');
  expect(timeAgo(now - 60000, n, now)).toBe('1 minute ago');
  expect(timeAgo(now - 2 * 3600000, n, now)).toBe('2 hours ago');
  expect(timeAgo(now - 3 * 86400000, n, now)).toBe('3 days ago');

  expect(parseLink(`/orders/${ID}`)).toBe(`/orders/${ID}`);
  expect(parseLink('/admin/shops')).toBe('/admin/shops');
  expect(parseLink(`/products/${ID}`)).toBe(`/product/${ID}`); // stored by the server as /products/:id
  expect(parseLink(`/messages/${ID}`)).toBeNull(); // messages have no bell items
  for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/orders/1', '/unknown', '', null]) {
    expect(parseLink(bad)).toBeNull();
  }
});
