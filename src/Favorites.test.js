import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import { i18n } from './data';
import { notificationText } from './notificationHelpers';

const OWNER = 'o'.repeat(24);
const artisan = { _id: 'a'.repeat(24), shopName: 'Nar Esgii', status: 'approved', user: { _id: OWNER, name: 'Nara', avatarUrl: '' } };
const product = {
  _id: 'c'.repeat(24), title: 'Гутал', titleEn: 'Boots', category: 'textile', images: [], description: 'Warm', likeCount: 2, createdAt: '2026-01-01',
  pricingTiers: { basic: { price: 25 }, story: { price: 30 }, patron: { price: 40 } }, patronBonus: { mn: '', en: '' }, artisan,
};
const ownerUser = { id: OWNER, name: 'Nara', email: 'nara@example.com', role: 'artisan' };
const buyerUser = { id: 'b'.repeat(24), name: 'Bat', email: 'bat@example.com', role: 'buyer' };
const hearts = () => document.querySelectorAll('.a-wishlist-btn, .a-icon-only-btn[aria-pressed]');

function signIn(user, notifications = { items: [], unreadCount: 0, unreadMessages: 0 }) {
  localStorage.setItem('artisan-token', 'token');
  localStorage.setItem('artisan-user', JSON.stringify(user));
  localStorage.setItem('artisan-lang', 'en');
  jest.spyOn(global, 'fetch').mockImplementation((url) => {
    if (!String(url).includes('/api/')) return new Promise(() => {});
    const path = new URL(String(url)).pathname.replace(/^\/api/, '');
    const reply = (body) => Promise.resolve({ ok: true, status: 200, statusText: '', json: async () => body });
    if (path === '/products') return reply([product]);
    if (path === `/products/${product._id}`) return reply(product);
    if (path === `/artisans/${artisan._id}`) return reply(artisan);
    if (path === '/notifications') return reply(notifications);
    if (path === '/cart') return reply({ items: [] });
    if (path === '/users/me') return reply(user);
    if (path === '/artisans/me') return reply({ _id: artisan._id, status: 'approved', payoutEmail: '', user });
    return reply([]);
  });
}
const openProduct = async () => {
  fireEvent.click((await screen.findAllByRole('link', { name: /Boots/ }))[0]);
  await screen.findByRole('heading', { name: 'Boots' });
};

beforeAll(() => { window.scrollTo = () => {}; Element.prototype.scrollIntoView = () => {}; });
afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

test('the owner has no heart on their product: cards, product page, shop page, profile', async () => {
  signIn(ownerUser);
  render(<App />);
  await screen.findAllByRole('link', { name: /Boots/ });
  expect(hearts()).toHaveLength(0); // home card
  await openProduct();
  expect(hearts()).toHaveLength(0); // product page
  fireEvent.click(screen.getByRole('button', { name: /Nar Esgii/ }));
  await screen.findByRole('heading', { name: 'Nar Esgii', level: 1 });
  expect(hearts()).toHaveLength(0); // shop page tile
  fireEvent.click(screen.getAllByRole('button', { name: 'Nara' })[0]);
  await screen.findByRole('heading', { name: 'My products' });
  await screen.findAllByRole('link', { name: /Boots/ });
  expect(hearts()).toHaveLength(0); // profile card
});

test('a buyer keeps the heart in those places', async () => {
  signIn(buyerUser);
  render(<App />);
  await screen.findAllByRole('link', { name: /Boots/ });
  expect(hearts().length).toBeGreaterThan(0);
  await openProduct();
  expect(hearts().length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /Nar Esgii/ }));
  await screen.findByRole('heading', { name: 'Nar Esgii', level: 1 });
  expect(hearts().length).toBeGreaterThan(0);
});

test('a visitor keeps the heart, which asks them to sign in', async () => {
  localStorage.setItem('artisan-lang', 'en');
  jest.spyOn(global, 'fetch').mockImplementation((url) => {
    if (!String(url).includes('/api/products')) return new Promise(() => {});
    return Promise.resolve({ ok: true, status: 200, statusText: '', json: async () => [product] });
  });
  render(<App />);
  await screen.findAllByRole('link', { name: /Boots/ });
  expect(hearts().length).toBeGreaterThan(0);
});

test('unread messages show on the chat icon only, not on the bell', async () => {
  signIn(buyerUser, { items: [], unreadCount: 0, unreadMessages: 4 });
  render(<App />);
  const chat = await screen.findByRole('button', { name: 'Messages, 4 unread' });
  expect(within(chat).getByTestId('count-badge')).toHaveTextContent('4');
  const bell = screen.getByRole('button', { name: 'Notifications' });
  expect(within(bell).queryByTestId('count-badge')).not.toBeInTheDocument();
  fireEvent.click(bell);
  expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
});

test('a "saved" item in the bell opens the product', async () => {
  signIn(ownerUser, { unreadCount: 1, unreadMessages: 0, items: [{ id: 'n1', type: 'product_saved', params: { productId: product._id, title: 'Гутал', titleEn: 'Boots', count: 3 }, link: `/products/${product._id}`, readAt: null, createdAt: new Date().toISOString() }] });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  const item = await screen.findByRole('button', { name: /3 people saved Boots/ });
  expect(item).toBeInTheDocument();
  fireEvent.click(item);
  await waitFor(() => {
    const calls = global.fetch.mock.calls.map(([url]) => String(url));
    expect(calls.some((u) => u.endsWith('/notifications/n1/read'))).toBe(true);
    expect(calls.some((u) => u.endsWith(`/products/${product._id}`))).toBe(true);
  });
});

describe('the "saved" text', () => {
  const text = (lang, count) => notificationText(i18n[lang], { type: 'product_saved', params: { productId: 'x', title: 'Гутал', titleEn: 'Boots', count } }, String);

  test('English', () => {
    expect(text('en', 1)).toBe('Someone saved your product Boots.');
    expect(text('en', 3)).toBe('3 people saved Boots.');
  });
  test('Mongolian uses the Mongolian name', () => {
    expect(text('mn', 1)).toContain('Гутал');
    expect(text('mn', 1)).toContain('Хэн нэгэн');
    expect(text('mn', 3)).toContain('3 хүн');
  });
  test('Korean', () => {
    expect(text('ko', 1)).toContain('Boots');
    expect(text('ko', 1)).toContain('누군가');
    expect(text('ko', 3)).toContain('3명');
  });
  test('a product with no English name still has a name', () => {
    const params = { productId: 'x', title: 'Гутал', titleEn: '', count: 1 };
    expect(notificationText(i18n.en, { type: 'product_saved', params }, String)).toContain('Гутал');
    expect(notificationText(i18n.ko, { type: 'product_saved', params }, String)).toContain('Гутал');
  });
  test('older message notifications have no text any more', () => {
    for (const lang of ['mn', 'en', 'ko']) expect(i18n[lang].notifications.text.new_message).toBeUndefined();
  });
});
