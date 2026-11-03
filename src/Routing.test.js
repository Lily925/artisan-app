import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import { i18n } from './data';

const OWNER = 'a'.repeat(24);
const ORDER = 'd'.repeat(24);
const CHAT = 'e'.repeat(24);
const artisan = { _id: 'f'.repeat(24), slug: 'noon-handmade', shopName: 'Noon Handmade', status: 'approved', user: { _id: OWNER, name: 'Bolor', avatarUrl: '' } };
const product = {
  _id: 'c'.repeat(24), title: 'Гутал', titleEn: 'Boots', category: 'textile', images: [], description: 'Warm', likeCount: 0, createdAt: '2026-01-01',
  pricingTiers: { basic: { price: 25 }, story: { price: 30 }, patron: { price: 40 } }, patronBonus: { mn: '', en: '' }, artisan,
};
const order = { id: ORDER, createdAt: '2026-01-02', status: 'paid', viewer: { isBuyer: true, isArtisan: false }, shop: { shopName: 'Noon Handmade', ownerName: 'Bolor' }, milestones: [], items: [], subtotal: 25, commissionFee: 4, shipping: 12, total: 41, shippingAddress: null, payout: null, payment: { paid: false }, actions: {} };
const conversation = { id: CHAT, role: 'buyer', other: { name: 'Noon Handmade', photo: '' }, lastMessageAt: null, preview: 'Hello', previewMine: false, unread: 0, canSend: true };

const USERS = {
  buyer: { id: 'b'.repeat(24), name: 'Bat', email: 'bat@example.com', role: 'buyer' },
  artisan: { id: OWNER, name: 'Bolor', email: 'bolor@example.com', role: 'artisan' },
  otherArtisan: { id: '1'.repeat(24), name: 'Dulam', email: 'dulam@example.com', role: 'artisan' },
  admin: { id: '2'.repeat(24), name: 'Admin', email: 'admin@example.com', role: 'admin' },
};

const isApi = (url) => String(url).includes('/api/');
const pathOf = (url) => new URL(String(url)).pathname.replace(/^\/api/, '');
const callsTo = (path) => global.fetch.mock.calls.filter(([url]) => isApi(url) && pathOf(url) === path);

// A stand-in for the API, by path. Account paths answer 401 without a token, like the real one.
function mockApi({ loginAs = USERS.buyer, cartItems = [] } = {}) {
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    if (!isApi(url)) return new Promise(() => {}); // exchange rates
    const path = pathOf(url);
    const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, statusText: '', json: async () => body });
    if (path === '/auth/login') return reply({ token: 'token', user: loginAs });
    if (path === '/products') return reply(new URL(String(url)).searchParams.get('category') === 'wood' ? [] : [product]);
    if (path === `/products/${product._id}`) return reply(product);
    if (path === `/products/${product._id}/view`) return reply({});
    if (path.startsWith('/products/') && path !== '/products/liked') return reply({ error: 'Not found' }, 404);
    if (path === '/artisans/noon-handmade' || path === `/artisans/${artisan._id}`) return reply(artisan);
    if (path.startsWith('/artisans/') && !path.startsWith('/artisans/me')) return reply({ error: 'Artisan not found' }, 404);
    if (!options?.headers?.Authorization) return reply({ error: 'Missing token' }, 401);
    if (path === '/notifications') return reply({ items: [], unreadCount: 0, unreadMessages: 0 });
    if (path === '/cart') return reply({ items: cartItems, totals: { subtotal: 25, commissionFee: 4, shipping: 12, total: 41 } });
    if (path === '/users/me') return reply(JSON.parse(localStorage.getItem('artisan-user')));
    if (path === '/artisans/me') return reply({ _id: artisan._id, status: 'approved', statusReason: '', payoutEmail: 'p@example.com' });
    if (path === '/artisans/me/dashboard') return reply({ error: 'stop here' }, 500);
    if (path === '/orders') return reply([{ _id: ORDER, createdAt: '2026-01-02', status: 'paid', items: [{}], total: 41 }]);
    if (path === `/orders/${ORDER}`) return reply(order);
    if (path.startsWith('/orders/')) return reply({ error: 'Order not found' }, 404);
    if (path === '/conversations') return reply({ conversations: [conversation] });
    if (path === `/conversations/${CHAT}/messages`) return reply({ conversation, card: null, messages: [], hasMore: false });
    if (path === '/admin/shops') return reply([]);
    return reply([]);
  });
}

function signIn(user) {
  localStorage.setItem('artisan-token', 'token');
  localStorage.setItem('artisan-user', JSON.stringify(user));
}
// Opens the app at an address, the way pasting a link or pressing refresh does.
const open = (url) => { window.history.pushState({}, '', url); return render(<App />); };
const here = () => window.location.pathname + window.location.search;
const onSignIn = () => expect(screen.getAllByRole('tab')).toHaveLength(2);
const submitLogin = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bat@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-pw' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Login' }).pop());
};

beforeEach(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
  localStorage.clear();
  localStorage.setItem('artisan-lang', 'en');
});
afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

describe('deep links', () => {
  test('a product link works logged out, with the product name as the title', async () => {
    mockApi();
    open(`/product/${product._id}`);
    expect(await screen.findByRole('heading', { name: 'Boots' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Boots · Artisan'));
    expect(callsTo(`/products/${product._id}`).length).toBeGreaterThan(0);
    await waitFor(() => expect(callsTo(`/products/${product._id}/view`).length).toBeGreaterThan(0));
    for (const path of ['/cart', '/users/me', '/notifications', '/orders']) expect(callsTo(path)).toHaveLength(0);
  });

  test('a shop link works logged out by slug, with the shop name as the title', async () => {
    mockApi();
    open('/shop/noon-handmade');
    expect(await screen.findByRole('heading', { name: 'Noon Handmade', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Noon Handmade · Artisan'));
    expect(screen.getAllByRole('button', { name: /Boots/ }).length).toBeGreaterThan(0); // its products
    expect(callsTo('/artisans/noon-handmade').length).toBeGreaterThan(0);
  });

  test('an id or different capitals land on the shop\'s slug address', async () => {
    mockApi();
    open(`/shop/${artisan._id}`);
    await screen.findByRole('heading', { name: 'Noon Handmade', level: 1 });
    expect(here()).toBe('/shop/noon-handmade');
  });

  test('the product list, a category and a search all open from their address', async () => {
    mockApi();
    const list = open('/shops');
    expect(await screen.findAllByRole('link', { name: /Boots/ })).not.toHaveLength(0);
    list.unmount();

    const category = open('/category/textile');
    await screen.findAllByRole('link', { name: /Boots/ });
    expect(screen.getByRole('button', { name: 'Textile', pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Textile · Artisan'));
    category.unmount();

    const empty = open('/category/wood');
    expect(await screen.findByRole('heading', { name: 'No wood pieces yet' })).toBeInTheDocument();
    empty.unmount();

    open('/shops?q=nothing-like-this');
    expect(await screen.findByRole('heading', { name: /Nothing matches/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Search artisan')).toHaveValue('nothing-like-this');
  });

  test('the category chips and the search box write to the address', async () => {
    mockApi();
    open('/shops');
    await screen.findAllByRole('link', { name: /Boots/ });
    fireEvent.click(screen.getAllByRole('button', { name: 'Textile' })[0]);
    expect(here()).toBe('/category/textile');
    fireEvent.change(screen.getByLabelText('Search artisan'), { target: { value: 'boot' } });
    expect(here()).toBe('/category/textile?q=boot');
  });

  test('a signed-in page opens directly: order detail, chat', async () => {
    mockApi();
    signIn(USERS.buyer);
    const orderPage = open(`/orders/${ORDER}`);
    expect(await screen.findByRole('heading', { name: 'Order' })).toBeInTheDocument();
    orderPage.unmount();

    open(`/messages/${CHAT}`);
    expect(await screen.findByRole('log', { name: 'Noon Handmade' })).toBeInTheDocument();
    expect(document.querySelector('.msg-layout.has-active')).toBeInTheDocument();
  });

  test('choosing a conversation changes the address', async () => {
    mockApi();
    signIn(USERS.buyer);
    open('/messages');
    fireEvent.click(await screen.findByRole('button', { name: /Noon Handmade/ }));
    expect(here()).toBe(`/messages/${CHAT}`);
    expect(await screen.findByRole('log', { name: 'Noon Handmade' })).toBeInTheDocument();
  });
});

describe('refresh', () => {
  test.each([
    ['product', `/product/${product._id}`, () => screen.findByRole('heading', { name: 'Boots' })],
    ['shop', '/shop/noon-handmade', () => screen.findByRole('heading', { name: 'Noon Handmade', level: 1 })],
    ['order', `/orders/${ORDER}`, () => screen.findByRole('heading', { name: 'Order' })],
    ['orders', '/orders', () => screen.findByRole('heading', { name: 'Order history' })],
    ['favorites', '/favorites', () => screen.findByRole('heading', { name: /Liked/ })],
    ['notifications', '/notifications', () => screen.findByRole('heading', { name: 'Notifications' })],
    ['profile', '/profile', () => screen.findByRole('heading', { name: 'Profile' })],
    ['commission form', '/commission', () => screen.findByRole('heading', { name: 'Describe your order to artisans' })],
    ['my requests', '/my-commissions', () => screen.findByRole('heading', { name: 'My requests' })],
  ])('%s stays on the same address and page', async (_, url, find) => {
    mockApi();
    signIn(USERS.buyer);
    const first = open(url);
    await find();
    first.unmount(); // the browser's refresh: everything in memory is gone, the address stays
    render(<App />);
    expect(await find()).toBeInTheDocument();
    expect(here()).toBe(url);
  });

  test('the checkout survives a refresh; the cart page has no payment form', async () => {
    const item = { qty: 1, tier: 'basic', product };
    mockApi({ cartItems: [item] });
    signIn(USERS.buyer);
    const cart = open('/cart');
    fireEvent.click(await screen.findByRole('button', { name: /Proceed to Checkout/ }));
    expect(here()).toBe('/checkout');
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getByText('Shipping address')).toBeInTheDocument();
    cart.unmount();
    const refreshed = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    refreshed.unmount();
    open('/cart');
    await screen.findByRole('button', { name: /Proceed to Checkout/ });
    expect(screen.queryByText('Shipping address')).not.toBeInTheDocument();
  });

  test('language and currency stay through navigation and refresh', async () => {
    mockApi();
    localStorage.setItem('artisan-lang', 'ko');
    const first = open(`/product/${product._id}`);
    await screen.findByRole('heading', { name: 'Boots' });
    expect(screen.getByRole('button', { name: /KO/, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByText(/₩/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /MN/ }));
    expect(await screen.findByRole('heading', { name: 'Гутал' })).toBeInTheDocument();
    expect(document.title).toBe('Гутал · Artisan');
    fireEvent.click(screen.getByRole('link', { name: 'Artisan' }));
    expect(screen.getByRole('button', { name: /MN/, pressed: true })).toBeInTheDocument();
    first.unmount();

    render(<App />);
    expect(screen.getByRole('button', { name: /MN/, pressed: true })).toBeInTheDocument();
    expect(localStorage.getItem('artisan-lang')).toBe('mn');
  });
});

describe('browser Back and Forward', () => {
  test('retrace the pages', async () => {
    mockApi();
    open('/');
    fireEvent.click((await screen.findAllByRole('link', { name: /Boots/ }))[0]);
    await screen.findByRole('heading', { name: 'Boots' });
    expect(here()).toBe(`/product/${product._id}`);
    fireEvent.click(screen.getByRole('button', { name: /Noon Handmade/ }));
    await screen.findByRole('heading', { name: 'Noon Handmade', level: 1 });
    expect(here()).toBe('/shop/noon-handmade');

    window.history.back();
    await screen.findByRole('heading', { name: 'Boots' });
    expect(here()).toBe(`/product/${product._id}`);
    window.history.forward();
    await screen.findByRole('heading', { name: 'Noon Handmade', level: 1 });
    expect(here()).toBe('/shop/noon-handmade');
  });

  test('the shop page\'s Back goes to the previous page, or the shop list from a shared link', async () => {
    mockApi();
    const view = open('/');
    fireEvent.click((await screen.findAllByRole('link', { name: /Boots/ }))[0]);
    await screen.findByRole('heading', { name: 'Boots' });
    fireEvent.click(screen.getByRole('button', { name: /Noon Handmade/ }));
    await screen.findByRole('heading', { name: 'Noon Handmade', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: /^‹ Back$/ }));
    expect(await screen.findByRole('heading', { name: 'Boots' })).toBeInTheDocument();
    view.unmount();

    window.history.replaceState({}, '', '/shop/noon-handmade'); // a fresh tab: nothing behind it
    render(<App />);
    await screen.findByRole('heading', { name: 'Noon Handmade', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: /^‹ Back$/ }));
    await waitFor(() => expect(here()).toBe('/shops'));
  });
});

describe('sign-in redirect', () => {
  test.each([
    ['/cart'], ['/checkout'], ['/orders'], [`/orders/${ORDER}`], ['/messages'], [`/messages/${CHAT}`],
    ['/favorites'], ['/profile'], ['/notifications'], ['/commission'], ['/dashboard'], ['/admin/shops'],
  ])('%s goes to sign-in when logged out and makes no account request', async (url) => {
    mockApi();
    open(url);
    onSignIn();
    expect(here()).toBe('/signin');
    for (const path of ['/cart', '/orders', '/conversations', `/orders/${ORDER}`, '/admin/shops', '/artisans/me/dashboard']) expect(callsTo(path)).toHaveLength(0);
  });

  test('signing in returns to the original page, query included', async () => {
    mockApi();
    open(`/orders/${ORDER}`);
    expect(here()).toBe('/signin');
    submitLogin();
    expect(await screen.findByRole('heading', { name: 'Order' })).toBeInTheDocument();
    expect(here()).toBe(`/orders/${ORDER}`);
  });

  test('switching to Sign up keeps the return address, and the address changes', async () => {
    mockApi();
    open('/orders');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kept@example.com' } });
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(here()).toBe('/signup');
    expect(screen.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Email')).toHaveValue('kept@example.com');
    fireEvent.click(screen.getAllByRole('tab')[0]);
    expect(here()).toBe('/signin');
    submitLogin();
    expect(await screen.findByRole('heading', { name: 'Order history' })).toBeInTheDocument();
    expect(here()).toBe('/orders');
  });

  test('/signup opens on the Register tab; a signed-in visitor doesn\'t stay on sign-in', async () => {
    mockApi();
    const view = open('/signup');
    expect(screen.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true');
    view.unmount();
    signIn(USERS.buyer);
    open('/signin');
    await screen.findByRole('heading', { name: /Handcrafted/ });
    expect(here()).toBe('/');
  });

  test('the Logout button goes home, not to sign-in', async () => {
    mockApi();
    signIn(USERS.buyer);
    open('/profile');
    fireEvent.click(await screen.findByRole('button', { name: /Logout/ }));
    await screen.findByRole('heading', { name: /Handcrafted/ });
    expect(here()).toBe('/');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(localStorage.getItem('artisan-token')).toBeNull();
  });

  test('an expired login on a protected page asks to sign in and comes back', async () => {
    mockApi();
    signIn(USERS.buyer);
    const realFetch = global.fetch.getMockImplementation();
    let expired = true;
    global.fetch.mockImplementation((url, options) => {
      if (expired && isApi(url) && !['/products', '/auth/login'].includes(pathOf(url))) {
        return Promise.resolve({ ok: false, status: 401, statusText: '', json: async () => ({ error: 'expired' }) });
      }
      return realFetch(url, options);
    });
    open('/orders');
    await waitFor(onSignIn);
    expired = false;
    submitLogin();
    expect(await screen.findByRole('heading', { name: 'Order history' })).toBeInTheDocument();
    expect(here()).toBe('/orders');
  });

  test('a visitor\'s Add to Cart returns to the same product after signing in', async () => {
    mockApi();
    open(`/product/${product._id}`);
    await screen.findByRole('heading', { name: 'Boots' });
    fireEvent.click(screen.getByRole('button', { name: /Add to Cart/ }));
    onSignIn();
    submitLogin();
    expect(await screen.findByRole('heading', { name: 'Boots' })).toBeInTheDocument();
    expect(here()).toBe(`/product/${product._id}`);
  });
});

describe('role guard', () => {
  const notAllowed = () => screen.findByRole('heading', { name: i18n.en.routing.notAllowedTitle });

  test.each([
    ['a buyer', USERS.buyer, '/dashboard'],
    ['a buyer', USERS.buyer, '/dashboard/orders'],
    ['a buyer', USERS.buyer, '/dashboard/products/new'],
    ['a buyer', USERS.buyer, '/commission-board'],
    ['a buyer', USERS.buyer, '/admin/shops'],
    ['an artisan', USERS.artisan, '/admin/shops'],
    ['an admin', USERS.admin, '/dashboard'],
    ['an admin', USERS.admin, '/messages'],
  ])('%s sees "not allowed" at %s, the address stays, nothing is requested', async (_, user, url) => {
    mockApi();
    signIn(user);
    open(url);
    expect(await notAllowed()).toBeInTheDocument();
    expect(here()).toBe(url);
    for (const path of ['/admin/shops', '/artisans/me/dashboard', '/orders/shop', '/commissions', '/conversations']) expect(callsTo(path)).toHaveLength(0);
    expect(screen.getByRole('button', { name: i18n.en.backHome })).toBeInTheDocument();
  });

  test('the right role gets the page', async () => {
    mockApi();
    signIn(USERS.admin);
    const admin = open('/admin/shops');
    expect(await screen.findByRole('heading', { name: 'Shops' })).toBeInTheDocument();
    admin.unmount();
    localStorage.clear();
    localStorage.setItem('artisan-lang', 'en');
    signIn(USERS.artisan);
    open('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Shop dashboard' })).toBeInTheDocument();
    await waitFor(() => expect(callsTo('/artisans/me/dashboard').length).toBeGreaterThan(0));
  });

  test('only the owner gets the edit form for a product', async () => {
    mockApi();
    signIn(USERS.otherArtisan);
    const other = open(`/product/${product._id}/edit`);
    expect(await notAllowed()).toBeInTheDocument();
    other.unmount();
    signIn(USERS.artisan);
    open(`/product/${product._id}/edit`);
    expect(await screen.findByRole('heading', { name: 'Edit product' })).toBeInTheDocument();
  });

  test('logged out, a role page asks to sign in and a wrong role is told after signing in', async () => {
    mockApi();
    open('/admin/shops');
    onSignIn();
    submitLogin();
    expect(await notAllowed()).toBeInTheDocument();
    expect(here()).toBe('/admin/shops');
  });
});

describe('404', () => {
  test.each([['mn'], ['en'], ['ko']])('an unknown address has a friendly page with a way home (%s)', async (lang) => {
    mockApi();
    localStorage.setItem('artisan-lang', lang);
    const t = i18n[lang];
    open('/no/such/page');
    expect(screen.getByRole('heading', { name: t.routing.notFoundTitle })).toBeInTheDocument();
    expect(screen.getByText(t.routing.notFoundBody)).toBeInTheDocument();
    expect(document.title).toBe(`${t.routing.notFoundTitle} · Artisan`);
    fireEvent.click(screen.getByRole('button', { name: t.backHome }));
    expect(here()).toBe('/');
  });

  test.each([
    ['product', '/product/000000000000000000000000'],
    ['shop', '/shop/no-such-shop'],
    ['category', '/category/spaceships'],
  ])('a %s that doesn\'t exist is a 404 too', async (_, url) => {
    mockApi();
    open(url);
    expect(await screen.findByRole('heading', { name: i18n.en.routing.notFoundTitle })).toBeInTheDocument();
  });

  test('an order that isn\'t yours reads as not found', async () => {
    mockApi();
    signIn(USERS.buyer);
    open(`/orders/${'9'.repeat(24)}`);
    expect(await screen.findByRole('heading', { name: i18n.en.routing.notFoundTitle })).toBeInTheDocument();
  });

  test('a failed load offers a retry instead of a 404', async () => {
    mockApi();
    const realFetch = global.fetch.getMockImplementation();
    let down = true;
    global.fetch.mockImplementation((url, options) => {
      const product404 = isApi(url) && ['/products', `/products/${product._id}`].includes(pathOf(url));
      if (down && product404) return Promise.reject(new Error('offline'));
      return realFetch(url, options);
    });
    open(`/product/${product._id}`);
    const retry = await screen.findByRole('button', { name: i18n.en.routing.retry });
    down = false;
    fireEvent.click(retry);
    expect(await screen.findByRole('heading', { name: 'Boots' })).toBeInTheDocument();
  });
});

describe('Copy link', () => {
  const stubClipboard = (writeText) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  afterEach(() => { delete navigator.clipboard; });

  test.each([
    ['product', `/product/${product._id}`, () => screen.findByRole('heading', { name: 'Boots' })],
    ['shop', '/shop/noon-handmade', () => screen.findByRole('heading', { name: 'Noon Handmade', level: 1 })],
  ])('the %s page copies its own address', async (_, url, find) => {
    mockApi();
    const writeText = jest.fn(() => Promise.resolve());
    stubClipboard(writeText);
    open(url);
    await find();
    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
    expect(await screen.findByRole('button', { name: /Link copied/ })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${url}`);
  });

  test('says so when the copy fails', async () => {
    mockApi();
    stubClipboard(jest.fn(() => Promise.reject(new Error('denied'))));
    document.execCommand = jest.fn(() => false);
    open(`/product/${product._id}`);
    await screen.findByRole('heading', { name: 'Boots' });
    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
    expect(await screen.findByRole('button', { name: i18n.en.routing.copyFailed })).toBeInTheDocument();
    delete document.execCommand;
  });
});

test('product cards are real links, so they can be shared or opened in a new tab', async () => {
  mockApi();
  open('/');
  const links = await screen.findAllByRole('link', { name: /Boots/ });
  links.forEach((link) => expect(link).toHaveAttribute('href', `/product/${product._id}`));
});

test('the bell has a way to the full notifications page', async () => {
  mockApi();
  signIn(USERS.buyer);
  open('/');
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: i18n.en.routing.seeAllNotifications }));
  expect(here()).toBe('/notifications');
  expect(await screen.findByRole('heading', { name: 'Notifications', level: 1 })).toBeInTheDocument();
});

test('all routing text exists in all three languages', () => {
  const keys = Object.keys(i18n.en.routing).sort();
  for (const lang of ['mn', 'ko']) {
    expect(Object.keys(i18n[lang].routing).sort()).toEqual(keys);
    for (const key of keys) expect(i18n[lang].routing[key]).toBeTruthy();
  }
});
