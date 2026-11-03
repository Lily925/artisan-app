import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import MessageShopButton, { messageShopMode } from './MessageShopButton';
import Portfolio from './Portfolio';
import ProductDetail from './ProductDetail';
import { i18n } from '../data';

const CHAT = 'c'.repeat(24);
const OWNER = 'o'.repeat(24);
const t = i18n.en;
const artisan = {
  _id: 'a'.repeat(24), shopName: 'Nar Esgii', status: 'approved', contactInfo: 'call +97699112233', location: 'Darkhan',
  user: { _id: OWNER, name: 'Nara', avatarUrl: '', email: 'nara@example.com' },
};
const product = {
  _id: 'p'.repeat(24), title: 'Гутал', titleEn: 'Boots', category: 'textile', images: [], description: 'Warm', likeCount: 0, createdAt: '2026-01-01',
  pricingTiers: { basic: { price: 25 }, story: { price: 30 }, patron: { price: 40 } }, patronBonus: { mn: '', en: '' }, artisan,
};
const conversation = { id: CHAT, role: 'buyer', other: { name: 'Nar Esgii', photo: '' }, lastMessageAt: null, preview: '', previewMine: false, unread: 0, canSend: true };

const pathOf = (url) => new URL(String(url)).pathname.replace(/^\/api/, '');
const posts = (path) => global.fetch.mock.calls.filter(([url, o]) => String(url).includes('/api/') && pathOf(url) === path && o?.method === 'POST');
const gets = (path) => global.fetch.mock.calls.filter(([url, o]) => String(url).includes('/api/') && pathOf(url) === path && (o?.method || 'GET') === 'GET');

function signIn(user, startResult = { status: 201, body: { conversation, created: true } }) {
  localStorage.setItem('artisan-token', 'token');
  localStorage.setItem('artisan-user', JSON.stringify(user));
  localStorage.setItem('artisan-lang', 'en');
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    if (!String(url).includes('/api/')) return new Promise(() => {}); // exchange rates
    const path = pathOf(url);
    const method = options?.method || 'GET';
    const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, statusText: '', json: async () => body });
    if (path === '/products') return reply([product]);
    if (path === `/products/${product._id}/view`) return reply({});
    if (path === `/products/${product._id}`) return reply(product);
    if (path === `/artisans/${artisan._id}`) return reply(artisan);
    if (path === '/conversations' && method === 'POST') return reply(startResult.body, startResult.status);
    if (path === '/conversations') return reply({ conversations: [] });
    if (path === `/conversations/${CHAT}/messages`) return reply({ conversation, card: null, messages: [], hasMore: false });
    if (path === '/notifications') return reply({ items: [], unreadCount: 0, unreadMessages: 0 });
    if (path === '/cart') return reply({ items: [] });
    if (path === '/users/me') return reply(user);
    if (path === '/artisans/me') return reply({ _id: 'x', status: 'approved', user });
    return reply([]);
  });
}

const buyer = { id: 'b'.repeat(24), name: 'Bat', email: 'bat@example.com', role: 'buyer' };
const openProductPage = async () => {
  fireEvent.click((await screen.findAllByRole('link', { name: /Boots/ }))[0]);
  await screen.findByRole('heading', { name: 'Boots' });
};
const openShopPage = async () => {
  await openProductPage();
  fireEvent.click(screen.getByRole('button', { name: /Nar Esgii/ }));
  await screen.findByRole('heading', { name: 'Nar Esgii', level: 1 });
};

beforeAll(() => { window.scrollTo = () => {}; Element.prototype.scrollIntoView = () => {}; });
afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

test('who sees what', () => {
  expect(messageShopMode(null, false)).toBe('signin');
  expect(messageShopMode({ role: 'buyer' }, false)).toBe('message');
  expect(messageShopMode({ role: 'buyer' }, true)).toBeNull();
  expect(messageShopMode({ role: 'artisan' }, true)).toBeNull();
  expect(messageShopMode({ role: 'artisan' }, false)).toBeNull();
  expect(messageShopMode({ role: 'admin' }, false)).toBeNull();
});

test('product page: a buyer\'s Message shop opens the chat for that product, selected', async () => {
  signIn(buyer);
  render(<App />);
  await openProductPage();
  fireEvent.click(screen.getByRole('button', { name: 'Message shop' }));
  await waitFor(() => expect(posts('/conversations')).toHaveLength(1));
  expect(JSON.parse(posts('/conversations')[0][1].body)).toEqual({ productId: product._id });
  expect(await screen.findByRole('log', { name: 'Nar Esgii' })).toBeInTheDocument(); // the chat itself, not just the inbox
  expect(document.querySelector('.msg-layout.has-active')).toBeInTheDocument();
  expect(gets(`/conversations/${CHAT}/messages`).length).toBeGreaterThan(0);
});

test('shop page: a buyer\'s Message shop opens the chat with that shop, selected', async () => {
  signIn(buyer);
  render(<App />);
  await openShopPage();
  fireEvent.click(screen.getByRole('button', { name: 'Message shop' }));
  await waitFor(() => expect(posts('/conversations')).toHaveLength(1));
  expect(JSON.parse(posts('/conversations')[0][1].body)).toEqual({ shopId: artisan._id });
  expect(await screen.findByRole('log', { name: 'Nar Esgii' })).toBeInTheDocument();
});

test('an existing conversation opens the same way', async () => {
  signIn(buyer, { status: 200, body: { conversation, created: false } });
  render(<App />);
  await openProductPage();
  fireEvent.click(screen.getByRole('button', { name: 'Message shop' }));
  expect(await screen.findByRole('log', { name: 'Nar Esgii' })).toBeInTheDocument();
});

test('a double click sends one request', async () => {
  signIn(buyer);
  render(<App />);
  await openProductPage();
  const button = screen.getByRole('button', { name: 'Message shop' });
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByRole('log', { name: 'Nar Esgii' });
  expect(posts('/conversations')).toHaveLength(1);
});

test('the header\'s Messages icon opens the inbox, not the last chat', async () => {
  signIn(buyer);
  render(<App />);
  await openProductPage();
  fireEvent.click(screen.getByRole('button', { name: 'Message shop' }));
  await screen.findByRole('log', { name: 'Nar Esgii' });
  fireEvent.click(screen.getByRole('link', { name: 'Artisan' })); // leave
  fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
  expect(await screen.findByRole('heading', { name: t.messages.emptyTitle })).toBeInTheDocument();
  expect(document.querySelector('.msg-layout.has-active')).not.toBeInTheDocument();
});

test('a refused start says why and stays on the page', async () => {
  signIn(buyer, { status: 403, body: { error: 'x', code: 'SHOP_NOT_APPROVED' } });
  render(<App />);
  await openProductPage();
  fireEvent.click(screen.getByRole('button', { name: 'Message shop' }));
  expect(await screen.findByText(t.messages.errors.SHOP_NOT_APPROVED)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Boots' })).toBeInTheDocument();
});

test.each([
  ['the shop\'s own artisan', { id: OWNER, name: 'Nara', email: 'nara@example.com', role: 'artisan' }],
  ['another artisan', { id: 'd'.repeat(24), name: 'Dulam', email: 'd@example.com', role: 'artisan' }],
  ['an admin', { id: 'e'.repeat(24), name: 'Admin', email: 'a@example.com', role: 'admin' }],
])('%s gets no button on the product or shop page', async (_, user) => {
  signIn(user);
  render(<App />);
  await openProductPage();
  expect(screen.queryByRole('button', { name: 'Message shop' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: t.messages.signInToMessage })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Nar Esgii/ }));
  await screen.findByRole('heading', { name: 'Nar Esgii', level: 1 });
  expect(screen.queryByRole('button', { name: 'Message shop' })).not.toBeInTheDocument();
});

test('logged out: the prompt replaces the button on both pages', () => {
  const shared = { lang: 'en', t, savedItems: [], toggleSave: () => {}, navigate: () => {}, viewer: null };
  const onSignIn = jest.fn(), onMessageShop = jest.fn();
  const { unmount } = render(
    <MemoryRouter><ProductDetail {...shared} selected={{ ...product, id: product._id }} addToCart={() => {}} fmtAmt={String} openStorefront={() => {}} openArtisanProfile={() => {}} onSignIn={onSignIn} onMessageShop={onMessageShop} /></MemoryRouter>
  );
  expect(screen.queryByRole('button', { name: 'Message shop' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to message' }));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  unmount();

  render(<MemoryRouter><Portfolio {...shared} artisan={artisan} products={[]} openProduct={() => {}} fmtBasic={String} onBack={() => {}} onSignIn={onSignIn} onMessageShop={onMessageShop} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Message shop' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to message' }));
  expect(onSignIn).toHaveBeenCalledTimes(2);
  expect(onMessageShop).not.toHaveBeenCalled();
});

test('the new texts exist in all three languages', () => {
  for (const lang of ['mn', 'en', 'ko']) {
    const m = i18n[lang].messages;
    for (const key of ['emptyTitle', 'emptyBody', 'emptyTitleArtisan', 'emptyBodyArtisan', 'browseShops', 'suggestedShops', 'signInToMessage']) expect(m[key]).toBeTruthy();
    expect(m.startChatWith('X')).toContain('X');
    render(<MessageShopButton t={i18n[lang]} viewer={null} isOwner={false} onSignIn={() => {}} />);
    expect(screen.getByRole('button', { name: m.signInToMessage })).toBeInTheDocument();
  }
});
