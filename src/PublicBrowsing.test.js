import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

const OWNER = 'o'.repeat(24);
const artisan = {
  _id: 'a'.repeat(24), shopName: 'Nar Esgii', status: 'approved', location: 'Darkhan',
  user: { _id: OWNER, name: 'Nara', avatarUrl: '' },
};
const product = {
  _id: 'p'.repeat(24), title: 'Гутал', titleEn: 'Boots', category: 'textile', images: [], description: 'Warm', likeCount: 0, createdAt: '2026-01-01',
  pricingTiers: { basic: { price: 25 }, story: { price: 30 }, patron: { price: 40 } }, patronBonus: { mn: '', en: '' }, artisan,
};
const buyer = { id: 'b'.repeat(24), name: 'Bat', email: 'bat@example.com', role: 'buyer' };

const isApi = (url) => String(url).includes('/api/');
const pathOf = (url) => new URL(String(url)).pathname.replace(/^\/api/, '');
const calls = () => global.fetch.mock.calls.filter(([url]) => isApi(url));
const callsTo = (path) => calls().filter(([url]) => pathOf(url) === path);

// A real API would answer account-only paths with 401 to a visitor without a token.
beforeEach(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  localStorage.clear();
  localStorage.setItem('artisan-lang', 'en');
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    if (!isApi(url)) return new Promise(() => {}); // exchange rates
    const path = pathOf(url);
    const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, statusText: '', json: async () => body });
    if (path === '/auth/login') return reply({ token: 'token', user: buyer });
    const signedIn = Boolean(options?.headers?.Authorization);
    if (path === '/products') return reply([product]);
    if (path === `/products/${product._id}/view`) return reply({});
    if (path === `/products/${product._id}`) return reply(product);
    if (path === `/artisans/${artisan._id}`) return reply(artisan);
    if (path === `/products/${product._id}/reviews`) return reply({ summary: { count: 0, average: 0, breakdown: {} }, reviews: [], page: 1, pages: 1 });
    if (!signedIn) return reply({ error: 'Missing token' }, 401);
    if (path === '/notifications') return reply({ items: [], unreadCount: 0, unreadMessages: 0 });
    if (path === '/cart') return reply({ items: [] });
    if (path === '/users/me') return reply(buyer);
    return reply([]);
  });
});
afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

const openProduct = async () => {
  fireEvent.click((await screen.findAllByRole('link', { name: /Boots/ }))[0]);
  await screen.findByRole('heading', { name: 'Boots' });
};
const openShop = async () => {
  await openProduct();
  fireEvent.click(screen.getByRole('button', { name: /Nar Esgii/ }));
  await screen.findByRole('heading', { name: 'Nar Esgii', level: 1 });
};

test('a visitor gets the home page with products, a Login button, and no account parts', async () => {
  render(<App />);
  expect(await screen.findAllByRole('link', { name: /Boots/ })).not.toHaveLength(0);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument(); // not the login page
  expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Messages/ })).not.toBeInTheDocument();
});

test('a visitor makes no account requests, so nothing logs them "out" or fails', async () => {
  render(<App />);
  await screen.findAllByRole('link', { name: /Boots/ });
  await openProduct();
  for (const path of ['/notifications', '/cart', '/users/me', '/orders', '/products/liked', '/conversations']) {
    expect(callsTo(path)).toHaveLength(0);
  }
  expect(calls().every(([, o]) => !o?.headers?.Authorization)).toBe(true);
  expect(screen.getByRole('heading', { name: 'Boots' })).toBeInTheDocument();
});

test('a visitor can browse the shop list, a product and its shop page', async () => {
  render(<App />);
  await openShop();
  expect(screen.getByText('Made by Nara')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /All products/ })).toBeInTheDocument();
});

test.each([['product page', openProduct], ['shop page', openShop]])('%s: "Sign in to message" replaces "Message shop"', async (_, open) => {
  render(<App />);
  await open();
  expect(screen.queryByRole('button', { name: 'Message shop' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to message' }));
  expect(screen.getAllByRole('tab')).toHaveLength(2); // the login page
  expect(callsTo('/conversations')).toHaveLength(0);
});

test('Back on the login page returns to the same page, still logged out', async () => {
  render(<App />);
  await openProduct();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to message' }));
  fireEvent.click(screen.getByRole('button', { name: /Back to Artisan/ }));
  expect(await screen.findByRole('heading', { name: 'Boots' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in to message' })).toBeInTheDocument();
});

test.each([['product page', openProduct, 'Boots'], ['shop page', openShop, 'Nar Esgii']])('signing in from the %s returns there, now with "Message shop"', async (_, open, heading) => {
  render(<App />);
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to message' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bat@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-pw' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Login' }).pop());
  expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Message shop' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign in to message' })).not.toBeInTheDocument();
  expect(callsTo('/conversations')).toHaveLength(0); // signing in alone starts no chat
});

test('account pages ask to sign in, then open what was asked for', async () => {
  render(<App />);
  await screen.findAllByRole('link', { name: /Boots/ });
  fireEvent.click(screen.getByRole('button', { name: /^Cart/ }));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(callsTo('/cart')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bat@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-pw' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Login' }).pop());
  await waitFor(() => expect(screen.queryByRole('tab')).not.toBeInTheDocument());
  expect(await screen.findByRole('button', { name: /^Notifications/ })).toBeInTheDocument();
  await waitFor(() => expect(callsTo('/cart').length).toBeGreaterThan(0));
});

test('adding to the cart or liking asks a visitor to sign in, and sends nothing', async () => {
  render(<App />);
  await openProduct();
  fireEvent.click(screen.getByRole('button', { name: /Add to Cart/ }));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /Back to Artisan/ }));
  await screen.findByRole('heading', { name: 'Boots' });
  fireEvent.click(screen.getByRole('button', { pressed: false, name: /\(0\)$/ }));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  const writes = calls().filter(([, o]) => o?.method && o.method !== 'GET').map(([url]) => pathOf(url));
  expect(writes.filter((path) => !path.endsWith('/view'))).toEqual([]);
});

test('an expired login drops back to the public site, not a dead end', async () => {
  localStorage.setItem('artisan-token', 'expired');
  localStorage.setItem('artisan-user', JSON.stringify(buyer));
  global.fetch.mockImplementation((url) => {
    if (!isApi(url)) return new Promise(() => {});
    const path = pathOf(url);
    const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, statusText: '', json: async () => body });
    return path === '/products' ? reply([product]) : reply({ error: 'expired' }, 401);
  });
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /Boots/ }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});
