import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import { i18n } from './data';
import { parseLink } from './notificationHelpers';

const t = i18n.en;
const r = t.reviews;
const OWNER = 'a'.repeat(24);
const ORDER = 'd'.repeat(24);
const REVIEW = 'e'.repeat(24);
const artisan = { _id: 'f'.repeat(24), slug: 'noon-handmade', shopName: 'Noon Handmade', status: 'approved', ratingAvg: 4.5, ratingCount: 8, user: { _id: OWNER, name: 'Bolor', avatarUrl: '' } };
const product = {
  _id: 'c'.repeat(24), title: 'Гутал', titleEn: 'Boots', category: 'textile', images: [], description: 'Warm', likeCount: 0, createdAt: '2026-01-01', ratingAvg: 4.25, ratingCount: 4,
  pricingTiers: { basic: { price: 25 }, story: { price: 30 }, patron: { price: 40 } }, patronBonus: { mn: '', en: '' }, artisan,
};
const USERS = {
  buyer: { id: 'b'.repeat(24), name: 'Bat', email: 'bat@example.com', role: 'buyer' },
  owner: { id: OWNER, name: 'Bolor', email: 'bolor@example.com', role: 'artisan' },
  admin: { id: '2'.repeat(24), name: 'Admin', email: 'admin@example.com', role: 'admin' },
};
const review = (over = {}) => ({ id: REVIEW, rating: 5, comment: 'Lovely boots', photos: [], displayName: 'Tuya', verified: true, createdAt: '2026-10-01T00:00:00Z', edited: false, reply: null, mine: false, canReply: false, ...over });
const summary = { count: 4, average: 4.25, breakdown: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 } };
const openItem = (reviewState) => ({ id: ORDER, createdAt: '2026-01-02', status: 'completed', viewer: { isBuyer: true, isArtisan: false }, shop: { shopName: 'Noon Handmade', ownerName: 'Bolor' }, milestones: [], items: [{ index: 0, title: 'Гутал', titleEn: 'Boots', image: '', tier: 'basic', unitPrice: 25, qty: 1, reviewState }], subtotal: 25, commissionFee: 4, shipping: 12, total: 41, shippingAddress: null, payout: null, payment: { paid: false }, actions: {} });
const OPEN = { canReview: true, block: null, review: null };
const ownReview = (over = {}) => ({ id: REVIEW, rating: 4, comment: 'Mine', photos: [], createdAt: '2026-10-01T00:00:00Z', editedAt: null, editableUntil: '2026-10-15T00:00:00Z', editable: true, reply: null, hidden: false, hiddenReason: '', ...over });

const isApi = (url) => String(url).includes('/api/');
const pathOf = (url) => new URL(String(url)).pathname.replace(/^\/api/, '');
const callsTo = (path, method) => global.fetch.mock.calls.filter(([url, o]) => isApi(url) && pathOf(url) === path && (!method || (o?.method || 'GET') === method));

function mockApi({ reviews = { summary, reviews: [review()], page: 1, pages: 1 }, order = openItem(OPEN), orders = [], admin = { reviews: [], page: 1, pages: 1 }, createError, replyError } = {}) {
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    if (!isApi(url)) return new Promise(() => {});
    const path = pathOf(url);
    const method = options?.method || 'GET';
    const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, statusText: '', json: async () => body });
    if (path === '/products') return reply([product]);
    if (path === `/products/${product._id}`) return reply(product);
    if (path === `/products/${product._id}/view`) return reply({});
    if (path === `/products/${product._id}/reviews`) return reply(reviews);
    if (path === '/artisans/noon-handmade') return reply(artisan);
    if (!options?.headers?.Authorization) return reply({ error: 'Missing token' }, 401);
    if (path === '/notifications') return reply({ items: [], unreadCount: 0, unreadMessages: 0 });
    if (path === '/cart') return reply({ items: [] });
    if (path === '/users/me') return reply(JSON.parse(localStorage.getItem('artisan-user')));
    if (path === '/artisans/me') return reply({ _id: artisan._id, status: 'approved', payoutEmail: 'p@example.com' });
    if (path === '/orders') return reply(orders);
    if (path === `/orders/${ORDER}`) return reply(order);
    if (path === '/reviews' && method === 'POST') return createError ? reply(createError, createError.status) : reply(ownReview(), 201);
    if (path === `/reviews/${REVIEW}` && method === 'PUT') return reply(ownReview());
    if (path === `/reviews/${REVIEW}` && method === 'DELETE') return reply({ deleted: true });
    if (path === `/reviews/${REVIEW}/reply` && method === 'DELETE') return replyError ? reply(replyError, replyError.status) : reply({ deleted: true });
    if (path === `/reviews/${REVIEW}/reply`) return replyError ? reply(replyError, replyError.status) : reply({ reply: { text: JSON.parse(options.body).text, at: '2026-10-02T00:00:00Z', edited: method === 'PUT' } }, method === 'PUT' ? 200 : 201);
    if (path === '/admin/reviews') return reply(admin);
    if (path === `/admin/reviews/${REVIEW}/hide`) return reply({ ...admin.reviews[0], hidden: true, hiddenReason: JSON.parse(options.body).reason });
    return reply([]);
  });
}
const signIn = (user) => { localStorage.setItem('artisan-token', 'token'); localStorage.setItem('artisan-user', JSON.stringify(user)); };
const open = (url) => { window.history.pushState({}, '', url); return render(<App />); };
const here = () => window.location.pathname + window.location.search;
const openProduct = async () => { open(`/product/${product._id}`); return screen.findByRole('heading', { name: r.title + ' (4)' }); };

beforeEach(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = jest.fn();
  localStorage.clear();
  localStorage.setItem('artisan-lang', 'en');
  URL.createObjectURL = () => 'blob:preview';
  URL.revokeObjectURL = () => {};
});
afterEach(() => { jest.restoreAllMocks(); localStorage.clear(); });

describe('reading reviews', () => {
  test('logged out: average, 5-to-1 breakdown, the review, its badge and name, no account requests', async () => {
    mockApi();
    await openProduct();
    expect(screen.getAllByRole('img', { name: 'Rated 4.3 out of 5, 4 reviews' }).length).toBeGreaterThan(0);
    const breakdown = screen.getByRole('list', { name: r.breakdownAria });
    expect(within(breakdown).getAllByRole('listitem').map((li) => li.textContent[0])).toEqual(['5', '4', '3', '2', '1']);
    expect(screen.getByText('5 stars: 2')).toBeInTheDocument();
    expect(await screen.findByText('Lovely boots')).toBeInTheDocument();
    expect(screen.getByText('Tuya')).toBeInTheDocument();
    expect(screen.getByText(/Verified purchase/)).toBeInTheDocument();
    expect(callsTo('/cart')).toHaveLength(0);
    expect(callsTo('/users/me')).toHaveLength(0);
  });

  test('a review without a name says "Buyer"; HTML in a comment is plain text', async () => {
    const html = '<img src=x onerror="window.hacked=1"><b>bold</b>';
    mockApi({ reviews: { summary, reviews: [review({ displayName: '', comment: html })], page: 1, pages: 1 } });
    await openProduct();
    expect(await screen.findByText(html)).toBeInTheDocument();
    expect(screen.getByText(r.anonymous)).toBeInTheDocument();
    expect(document.querySelector('#reviews li img, #reviews b')).toBeNull();
    expect(window.hacked).toBeUndefined();
  });

  test('photos open in full, the reply shows, "Edited" shows', async () => {
    mockApi({ reviews: { summary, reviews: [review({ photos: ['/uploads/reviews/x.png'], edited: true, reply: { text: 'Thank you!', at: '2026-10-02T00:00:00Z' } })], page: 1, pages: 1 } });
    await openProduct();
    expect(await screen.findByRole('img', { name: 'Review photo 1' })).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
    expect(screen.getByText(r.replyFrom, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Edited/)).toBeInTheDocument();
  });

  test('pagination asks for the next page', async () => {
    mockApi({ reviews: { summary, reviews: [review()], page: 1, pages: 3 } });
    await openProduct();
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/reviews?page=2'))).toBe(true));
  });

  test('no reviews: an empty state, no rating on the product', async () => {
    mockApi({ reviews: { summary: { count: 0, average: 0, breakdown: {} }, reviews: [], page: 1, pages: 1 } });
    open(`/product/${product._id}`);
    expect(await screen.findByText(r.none)).toBeInTheDocument();
  });

  test('a failed load offers a retry and leaves the product page working', async () => {
    mockApi();
    const real = global.fetch.getMockImplementation();
    let down = true;
    global.fetch.mockImplementation((url, o) => (down && String(url).includes('/reviews') ? Promise.reject(new Error('offline')) : real(url, o)));
    open(`/product/${product._id}`);
    expect(await screen.findByRole('heading', { name: 'Boots' })).toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: r.retry });
    down = false;
    fireEvent.click(retry);
    expect(await screen.findByText('Lovely boots')).toBeInTheDocument();
  });

  test('product cards and the shop page show the average and count', async () => {
    mockApi();
    const home = open('/');
    expect((await screen.findAllByRole('img', { name: 'Rated 4.3 out of 5, 4 reviews' })).length).toBeGreaterThan(0);
    home.unmount();
    open('/shop/noon-handmade');
    expect(await screen.findByRole('img', { name: 'Rated 4.5 out of 5, 8 reviews' })).toBeInTheDocument();
  });

  test('a link ending in #reviews scrolls to them once loaded', async () => {
    mockApi();
    open(`/product/${product._id}#reviews`);
    await screen.findByText('Lovely boots');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});

describe('order history', () => {
  const order = (nextReviewItem) => ({ _id: ORDER, createdAt: '2026-01-02', status: 'completed', items: [{}], total: 41, nextReviewItem });

  test.each([['the orders page', '/orders'], ['the profile', '/profile']])('%s: "Write a review" opens its own route, until reviewed', async (_, url) => {
    mockApi({ orders: [order(0)] });
    signIn(USERS.buyer);
    const view = open(url);
    fireEvent.click(await screen.findByRole('button', { name: `★ ${r.write}` }));
    expect(here()).toBe(`/orders/${ORDER}/review/0`);
    expect(await screen.findByRole('heading', { name: r.formTitle })).toBeInTheDocument();
    view.unmount();
    jest.restoreAllMocks();
    mockApi({ orders: [order(null)] });
    open(url);
    await screen.findByRole('button', { name: /1 item/ });
    expect(screen.queryByRole('button', { name: `★ ${r.write}` })).not.toBeInTheDocument();
  });

  test('the order page offers it per item, or the way to your review', async () => {
    mockApi();
    signIn(USERS.buyer);
    const view = open(`/orders/${ORDER}`);
    expect(await screen.findByRole('button', { name: `★ ${r.write}` })).toBeInTheDocument();
    view.unmount();
    jest.restoreAllMocks();
    mockApi({ order: openItem({ canReview: false, block: null, review: ownReview() }) });
    open(`/orders/${ORDER}`);
    expect(await screen.findByRole('button', { name: `★ ${r.editYours}` })).toBeInTheDocument();
  });
});

describe('the review form', () => {
  const formUrl = `/orders/${ORDER}/review/0`;

  test('logged out it asks to sign in', () => {
    mockApi();
    open(formUrl);
    expect(here()).toBe('/signin');
  });

  test('a star rating is required; then it posts rating, comment and item', async () => {
    mockApi();
    signIn(USERS.buyer);
    open(formUrl);
    fireEvent.click(await screen.findByRole('button', { name: r.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(r.errors.BAD_RATING);
    expect(callsTo('/reviews', 'POST')).toHaveLength(0);

    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    fireEvent.change(screen.getByLabelText(r.commentLabel), { target: { value: 'Nice' } });
    expect(screen.getByText('4 / 1000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: r.submit }));
    await waitFor(() => expect(callsTo('/reviews', 'POST')).toHaveLength(1));
    const form = callsTo('/reviews', 'POST')[0][1].body;
    expect(Object.fromEntries(form.entries())).toEqual({ rating: '4', comment: 'Nice', orderId: ORDER, itemIndex: '0' });
    await waitFor(() => expect(here()).toBe(`/orders/${ORDER}`)); // back to the order
  });

  test('the comment box stops at 1000 characters', async () => {
    mockApi();
    signIn(USERS.buyer);
    open(formUrl);
    expect(await screen.findByLabelText(r.commentLabel)).toHaveAttribute('maxLength', '1000');
  });

  test('photos: only images up to 2 MB, at most 3', async () => {
    mockApi();
    signIn(USERS.buyer);
    open(formUrl);
    await screen.findByRole('button', { name: r.submit });
    const input = () => document.getElementById('review-photos');
    const file = (name, type = 'image/png', size = 10) => new File([new Uint8Array(size)], name, { type });
    fireEvent.change(input(), { target: { files: [file('a.txt', 'text/plain')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('a.txt');
    fireEvent.change(input(), { target: { files: [file('big.png', 'image/png', 3 * 1024 * 1024)] } });
    expect(screen.getByRole('alert')).toHaveTextContent('big.png');
    fireEvent.change(input(), { target: { files: [file('1.png'), file('2.png'), file('3.png'), file('4.png')] } });
    expect(screen.getByRole('alert')).toHaveTextContent(r.photoLimit(3));
    expect(screen.getAllByRole('button', { name: /^Remove photo/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: r.photoAdd })).not.toBeInTheDocument();
  });

  test('the server\'s refusal is shown in the visitor\'s words', async () => {
    mockApi({ createError: { status: 429, code: 'RATE_LIMITED', error: 'x' } });
    signIn(USERS.buyer);
    open(formUrl);
    fireEvent.click(await screen.findByRole('radio', { name: '5 stars' }));
    fireEvent.click(screen.getByRole('button', { name: r.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(r.errors.RATE_LIMITED);
    expect(here()).toBe(formUrl);
  });

  test('an open review can be edited, keeping its values, and deleted after confirming', async () => {
    mockApi({ order: openItem({ canReview: false, block: null, review: ownReview({ photos: ['/uploads/reviews/x.png'] }) }) });
    signIn(USERS.buyer);
    const view = open(formUrl);
    expect(await screen.findByLabelText(r.commentLabel)).toHaveValue('Mine');
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: r.save }));
    await waitFor(() => expect(callsTo(`/reviews/${REVIEW}`, 'PUT')).toHaveLength(1));
    expect(callsTo(`/reviews/${REVIEW}`, 'PUT')[0][1].body.get('keepPhotos')).toBe('["/uploads/reviews/x.png"]');
    await waitFor(() => expect(here()).toBe(`/orders/${ORDER}`));
    view.unmount();

    open(formUrl);
    fireEvent.click(await screen.findByRole('button', { name: r.delete }));
    expect(callsTo(`/reviews/${REVIEW}`, 'DELETE')).toHaveLength(0); // asks first
    fireEvent.click(screen.getByRole('button', { name: r.deleteYes }));
    await waitFor(() => expect(callsTo(`/reviews/${REVIEW}`, 'DELETE')).toHaveLength(1));
  });

  test.each([
    ['locked after 14 days', { canReview: false, block: null, review: ownReview({ editable: false }) }, r.locked],
    ['hidden by an admin', { canReview: false, block: null, review: ownReview({ editable: false, hidden: true, hiddenReason: 'Off topic' }) }, 'Off topic'],
    ['order not completed', { canReview: false, block: 'NOT_COMPLETED', review: null }, r.blocked.NOT_COMPLETED],
    ['order not paid through PayPal', { canReview: false, block: 'NOT_PAID', review: null }, r.blocked.NOT_PAID],
    ['past the 60 days', { canReview: false, block: 'WINDOW_CLOSED', review: null }, r.blocked.WINDOW_CLOSED],
    ['your own shop', { canReview: false, block: 'OWN_PRODUCT', review: null }, r.blocked.OWN_PRODUCT],
    ['deleted earlier', { canReview: false, block: 'DELETED', review: null }, r.blocked.DELETED],
  ])('%s: explains, with no form', async (_, state, text) => {
    mockApi({ order: openItem(state) });
    signIn(USERS.buyer);
    open(formUrl);
    expect(await screen.findByText(text, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: r.submit })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: r.save })).not.toBeInTheDocument();
  });

  test('a deleted review can be written again, and the page says until when', async () => {
    mockApi({ order: openItem({ canReview: true, block: null, review: null, rewriteUntil: '2026-10-15T00:00:00Z' }) });
    signIn(USERS.buyer);
    open(formUrl);
    expect(await screen.findByText(/You deleted your earlier review/)).toHaveTextContent('Oct 15, 2026');
    fireEvent.click(screen.getByRole('radio', { name: '3 stars' }));
    fireEvent.click(screen.getByRole('button', { name: r.submit }));
    await waitFor(() => expect(callsTo('/reviews', 'POST')).toHaveLength(1));
  });

  test('deleting says it can be written again until the original date', async () => {
    mockApi({ order: openItem({ canReview: false, block: null, review: ownReview() }) });
    signIn(USERS.buyer);
    open(formUrl);
    fireEvent.click(await screen.findByRole('button', { name: r.delete }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/write it again until Oct 15, 2026/);
  });

  test.each([
    ['an item the order doesn\'t have', `/orders/${ORDER}/review/5`],
    ['a nonsense item', `/orders/${ORDER}/review/abc`],
  ])('%s is a 404', async (_, url) => {
    mockApi();
    signIn(USERS.buyer);
    open(url);
    expect(await screen.findByRole('heading', { name: t.routing.notFoundTitle })).toBeInTheDocument();
  });

  test('the order\'s artisan, with no review state, gets a 404 here', async () => {
    const order = openItem(undefined);
    order.viewer = { isBuyer: false, isArtisan: true };
    mockApi({ order });
    signIn(USERS.owner);
    open(`/orders/${ORDER}/review/0`);
    expect(await screen.findByRole('heading', { name: t.routing.notFoundTitle })).toBeInTheDocument();
  });
});

describe('on the product page', () => {
  test('your own open review links to its form', async () => {
    mockApi({ reviews: { summary, reviews: [review({ mine: true, own: { orderId: ORDER, itemIndex: 0, editable: true } })], page: 1, pages: 1 } });
    signIn(USERS.buyer);
    await openProduct();
    fireEvent.click(await screen.findByRole('button', { name: r.editYours }));
    expect(here()).toBe(`/orders/${ORDER}/review/0`);
  });

  test('no edit link once locked, nor on others\' reviews', async () => {
    mockApi({ reviews: { summary, reviews: [review({ mine: true, own: { orderId: ORDER, itemIndex: 0, editable: false } }), review({ id: 'x'.repeat(24) })], page: 1, pages: 1 } });
    signIn(USERS.buyer);
    await openProduct();
    await screen.findAllByText('Lovely boots');
    expect(screen.queryByRole('button', { name: r.editYours })).not.toBeInTheDocument();
  });

  test('the artisan can post one public reply; it replaces the form', async () => {
    mockApi({ reviews: { summary, reviews: [review({ canReply: true })], page: 1, pages: 1 } });
    signIn(USERS.owner);
    await openProduct();
    fireEvent.click(await screen.findByRole('button', { name: r.replySend }));
    expect(await screen.findByRole('alert')).toHaveTextContent(r.errors.EMPTY_REPLY);
    fireEvent.change(screen.getByLabelText(r.replyLabel), { target: { value: 'Thank you!' } });
    fireEvent.click(screen.getByRole('button', { name: r.replySend }));
    await waitFor(() => expect(screen.queryByLabelText(r.replyLabel)).not.toBeInTheDocument());
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
  });

  const posted = { text: 'Thank you!', at: '2026-10-02T00:00:00Z', edited: false };

  test('the artisan can edit their reply; it shows as edited', async () => {
    mockApi({ reviews: { summary, reviews: [review({ reply: posted, canEditReply: true })], page: 1, pages: 1 } });
    signIn(USERS.owner);
    await openProduct();
    fireEvent.click(await screen.findByRole('button', { name: r.replyEdit }));
    expect(screen.getByLabelText(r.replyLabel)).toHaveValue('Thank you!');
    fireEvent.click(screen.getByRole('button', { name: r.cancel }));
    fireEvent.click(screen.getByRole('button', { name: r.replyEdit }));
    fireEvent.change(screen.getByLabelText(r.replyLabel), { target: { value: 'Thanks so much!' } });
    fireEvent.click(screen.getByRole('button', { name: r.replySave }));
    await waitFor(() => expect(callsTo(`/reviews/${REVIEW}/reply`, 'PUT')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByLabelText(r.replyLabel)).not.toBeInTheDocument());
    expect(screen.getByText('Thanks so much!')).toBeInTheDocument();
    expect(screen.getByText(r.replyFrom, { exact: false })).toHaveTextContent(r.edited);
  });

  test('the artisan can delete their reply after confirming; no new reply is offered', async () => {
    mockApi({ reviews: { summary, reviews: [review({ reply: posted, canEditReply: true })], page: 1, pages: 1 } });
    signIn(USERS.owner);
    await openProduct();
    fireEvent.click(await screen.findByRole('button', { name: r.replyDelete }));
    expect(callsTo(`/reviews/${REVIEW}/reply`, 'DELETE')).toHaveLength(0); // asks first
    expect(screen.getByRole('alertdialog')).toHaveTextContent(r.replyDeleteConfirm);
    fireEvent.click(screen.getByRole('button', { name: r.deleteYes }));
    await waitFor(() => expect(screen.queryByText('Thank you!')).not.toBeInTheDocument());
    expect(callsTo(`/reviews/${REVIEW}/reply`, 'DELETE')).toHaveLength(1);
    expect(screen.queryByLabelText(r.replyLabel)).not.toBeInTheDocument();
  });

  test('a refused change says why and keeps the reply', async () => {
    mockApi({ replyError: { status: 403, code: 'REPLY_LOCKED', error: 'x' }, reviews: { summary, reviews: [review({ reply: posted, canEditReply: true })], page: 1, pages: 1 } });
    signIn(USERS.owner);
    await openProduct();
    fireEvent.click(await screen.findByRole('button', { name: r.replyDelete }));
    fireEvent.click(screen.getByRole('button', { name: r.deleteYes }));
    expect(await screen.findByText(r.errors.REPLY_LOCKED)).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
  });

  test('no Edit or Delete on a reply once locked, or for anyone else', async () => {
    mockApi({ reviews: { summary, reviews: [review({ reply: posted, canEditReply: false })], page: 1, pages: 1 } });
    signIn(USERS.owner);
    await openProduct();
    expect(await screen.findByText('Thank you!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: r.replyEdit })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: r.replyDelete })).not.toBeInTheDocument();
  });

  test('no reply form unless the server offers it', async () => {
    mockApi();
    signIn(USERS.buyer);
    await openProduct();
    await screen.findByText('Lovely boots');
    expect(screen.queryByLabelText(r.replyLabel)).not.toBeInTheDocument();
  });
});

describe('moderation', () => {
  const adminRow = { id: REVIEW, rating: 1, comment: 'Rude words', photos: [], displayName: 'Tuya', createdAt: '2026-10-01T00:00:00Z', reply: null, hidden: false, hiddenReason: '', product: { id: product._id, title: 'Гутал', titleEn: 'Boots' }, shopName: 'Noon Handmade' };

  test('an admin hides a review, and a reason is required', async () => {
    mockApi({ admin: { reviews: [adminRow], page: 1, pages: 1 } });
    signIn(USERS.admin);
    open('/admin/reviews');
    expect(await screen.findByText('Rude words')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: r.admin.hide }));
    fireEvent.click(screen.getAllByRole('button', { name: r.admin.confirmHide }).pop());
    expect(await screen.findByRole('alert')).toHaveTextContent(r.admin.reasonRequired);
    expect(callsTo(`/admin/reviews/${REVIEW}/hide`)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'Off topic' } });
    fireEvent.click(screen.getAllByRole('button', { name: r.admin.confirmHide }).pop());
    await waitFor(() => expect(callsTo(`/admin/reviews/${REVIEW}/hide`)).toHaveLength(1));
    expect(await screen.findByRole('button', { name: r.admin.unhide })).toBeInTheDocument();
    expect(screen.getByText(/Off topic/)).toBeInTheDocument();
  });

  test.each([['a buyer', USERS.buyer], ['an artisan', USERS.owner]])('%s sees "not allowed"', async (_, user) => {
    mockApi();
    signIn(user);
    open('/admin/reviews');
    expect(await screen.findByRole('heading', { name: t.routing.notAllowedTitle })).toBeInTheDocument();
    expect(callsTo('/admin/reviews')).toHaveLength(0);
  });

  test('the profile has a way there for admins only', async () => {
    mockApi();
    signIn(USERS.admin);
    const view = open('/profile');
    expect(await screen.findByRole('button', { name: r.admin.open })).toBeInTheDocument();
    view.unmount();
    localStorage.setItem('artisan-user', JSON.stringify(USERS.buyer));
    open('/profile');
    await screen.findByRole('heading', { name: t.profile });
    expect(screen.queryByRole('button', { name: r.admin.open })).not.toBeInTheDocument();
  });
});

describe('notifications and text', () => {
  const ID = 'a'.repeat(24);

  test('review links open the new product route; others are refused', () => {
    expect(parseLink(`/product/${ID}#reviews`)).toBe(`/product/${ID}#reviews`);
    for (const bad of [`/product/${ID}#elsewhere`, `/product/1#reviews`, `https://evil.example/product/${ID}#reviews`, `//evil.example#reviews`]) expect(parseLink(bad)).toBeNull();
  });

  test('following one from the bell opens the product at its reviews', async () => {
    mockApi();
    signIn(USERS.owner);
    const real = global.fetch.getMockImplementation();
    const item = { id: 'n1', type: 'review_received', params: { productId: product._id, title: 'Гутал', titleEn: 'Boots', rating: 5 }, link: `/product/${product._id}#reviews`, readAt: null, createdAt: new Date().toISOString() };
    global.fetch.mockImplementation((url, o) => {
      if (isApi(url) && pathOf(url) === '/notifications') return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [item], unreadCount: 1, unreadMessages: 0 }) });
      return real(url, o);
    });
    open('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: /New 5-star review on Boots/ }));
    await waitFor(() => expect(window.location.pathname).toBe(`/product/${product._id}`));
    expect(window.location.hash).toBe('#reviews');
    await screen.findByRole('heading', { name: r.title + ' (4)' });
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  test('notification text names the product and the shop, in every language', () => {
    for (const lang of ['mn', 'en', 'ko']) {
      const { review_received: received, review_replied: replied } = i18n[lang].notifications.text;
      const params = { title: 'Гутал', titleEn: 'Boots', rating: 5, shopName: 'Noon' };
      expect(received(params)).toMatch(/Гутал|Boots/);
      expect(received(params)).toContain('5');
      expect(replied(params)).toContain('Noon');
      expect(received({ title: 'Гутал' })).not.toMatch(/undefined/);
      expect(replied({ title: 'Гутал' })).not.toMatch(/undefined/);
    }
  });

  test('all review text exists in all three languages', () => {
    const shape = (value) => (value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, shape(value[k])]))
      : typeof value);
    for (const lang of ['mn', 'ko']) {
      expect(shape(i18n[lang].reviews)).toEqual(shape(r));
      const words = (value) => (typeof value === 'object' ? Object.values(value).flatMap(words) : typeof value === 'string' ? [value] : []);
      words(i18n[lang].reviews).forEach((text) => expect(text).toBeTruthy());
    }
    expect(i18n.mn.reviews.verified).not.toBe(r.verified);
    expect(i18n.ko.reviews.verified).not.toBe(r.verified);
  });
});
