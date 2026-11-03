import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Messages from './Messages';
import ChatSettingsForm from './ChatSettingsForm';
import OrderDetail from './OrderDetail';
import { i18n } from '../data';

const t = i18n.en;
const CHAT = 'c'.repeat(24);
const conv = (over = {}) => ({ id: CHAT, role: 'buyer', other: { name: 'Nar Esgii', photo: '' }, lastMessageAt: new Date().toISOString(), preview: 'Hi', previewMine: false, unread: 0, canSend: true, ...over });
const msg = (id, over = {}) => ({ id: String(id).padStart(24, '0'), text: `message ${id}`, mine: false, createdAt: new Date().toISOString(), readAt: null, ...over });
const pathOf = (url) => new URL(String(url)).pathname.replace(/^\/api/, '');
const callsTo = (path, method = 'GET') => global.fetch.mock.calls.filter(([url, o]) => pathOf(url) === path && (o?.method || 'GET') === method);
const bodyOf = (call) => JSON.parse(call[1].body);

function mockApi(state) {
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    const path = pathOf(url);
    const method = options?.method || 'GET';
    const ok = (body, status = 200) => Promise.resolve({ ok: status < 400, status, statusText: '', json: async () => body });
    if (path === '/conversations') return state.listError ? ok({ error: 'x' }, 500) : ok({ conversations: state.list });
    if (path === `/conversations/${CHAT}/messages` && method === 'POST') {
      if (state.sendError) return ok(state.sendError, state.sendError.status);
      return ok({ message: msg(900 + callsTo(path, 'POST').length, { text: JSON.parse(options.body).text, mine: true }) }, 201);
    }
    if (path === `/conversations/${CHAT}/messages`) return ok(state.chat);
    if (path === `/conversations/${CHAT}/read`) return ok({ unread: 0 });
    if (path === '/artisans/me/chat-settings' && method === 'PUT') return state.saveError ? ok(state.saveError, 400) : ok(JSON.parse(options.body));
    if (path === '/artisans/me/chat-settings') return ok(state.settings);
    return ok({});
  });
}
const noop = () => {};
const renderChat = (over = {}) => render(
  <Messages t={t} lang="en" fmtAmt={(n) => `$${n}`} activeId={CHAT} onSelect={noop} navigate={noop} onApiError={noop} onOpenProduct={noop} onOpenOrder={noop} {...over} />
);
const setVisibility = (value) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
};

beforeAll(() => { Element.prototype.scrollTo = () => {}; });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); delete document.visibilityState; });

test('shows bubbles, the pinned card, the safety notice and "Seen" under the last read message only', async () => {
  const onOpenProduct = jest.fn();
  mockApi({ list: [conv()], chat: { conversation: conv(), hasMore: false, card: { type: 'product', id: 'p1', title: 'Гутал', titleEn: 'Boots', image: '', price: 25 },
    messages: [msg(1, { mine: true, readAt: 'x' }), msg(2, { mine: true, readAt: 'x' }), msg(3, { mine: true }), msg(4)] } });
  renderChat({ onOpenProduct });
  expect(await screen.findByText('message 4')).toBeInTheDocument();
  expect(screen.getAllByText('Seen')).toHaveLength(1);
  expect(screen.getByText('message 2').parentElement).toHaveTextContent('Seen');
  expect(screen.getByText('For your safety keep payments and contact details on Artisan.')).toBeInTheDocument();
  const card = screen.getByRole('button', { name: 'Product: Boots' });
  expect(card).toHaveTextContent('$25');
  fireEvent.click(card);
  expect(onOpenProduct).toHaveBeenCalledWith('p1');
});

test('renders HTML in a message as plain text', async () => {
  const html = '<img src=x onerror="window.hacked=1"><b>bold</b>';
  mockApi({ list: [conv()], chat: { conversation: conv(), card: null, hasMore: false, messages: [msg(1, { text: html })] } });
  const { container } = renderChat();
  expect(await screen.findByText(html)).toBeInTheDocument();
  expect(container.querySelector('.msg-bubble img, .msg-bubble b')).toBeNull();
  expect(window.hacked).toBeUndefined();
});

test('Enter sends, Shift+Enter and Korean composition do not; the counter counts', async () => {
  mockApi({ list: [conv()], chat: { conversation: conv(), card: null, hasMore: false, messages: [] } });
  renderChat();
  const box = await screen.findByLabelText('Write a message…');
  expect(box).toHaveAttribute('maxLength', '1000');
  fireEvent.change(box, { target: { value: 'Hello' } });
  expect(screen.getByText('5 / 1000')).toBeInTheDocument();

  const sends = () => callsTo(`/conversations/${CHAT}/messages`, 'POST');
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 });
  expect(sends()).toHaveLength(0);

  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(() => expect(sends()).toHaveLength(1));
  expect(bodyOf(sends()[0]).text).toBe('Hello');
  expect(await screen.findByText('Hello')).toBeInTheDocument(); // the new bubble
  await waitFor(() => expect(box).toHaveValue(''));
  expect(screen.getByText('0 / 1000')).toBeInTheDocument();
});

test('a buyer\'s quick question sends on tap; a failed send keeps the draft and says why', async () => {
  const state = { list: [conv()], chat: { conversation: conv(), card: null, hasMore: false, messages: [] } };
  mockApi(state);
  renderChat();
  const group = await screen.findByRole('group', { name: 'Quick questions' });
  expect(within(group).getAllByRole('button').length).toBeGreaterThanOrEqual(3);
  fireEvent.click(within(group).getByRole('button', { name: 'Is it available?' }));
  await waitFor(() => expect(callsTo(`/conversations/${CHAT}/messages`, 'POST')).toHaveLength(1));
  expect(bodyOf(callsTo(`/conversations/${CHAT}/messages`, 'POST')[0]).text).toBe('Is it available?');
  await screen.findByText('Is it available?', { selector: '.msg-bubble' });

  state.sendError = { status: 429, code: 'RATE_LIMITED', error: 'x' };
  const box = screen.getByLabelText('Write a message…');
  fireEvent.change(box, { target: { value: 'Keep me' } });
  fireEvent.keyDown(box, { key: 'Enter' });
  expect(await screen.findByRole('alert')).toHaveTextContent('too quickly');
  expect(box).toHaveValue('Keep me');
});

test('artisans get quick replies instead of quick questions; tapping one fills the box', async () => {
  const artisan = conv({ role: 'artisan', other: { name: 'Bat', photo: '' } });
  mockApi({ list: [artisan], settings: { savedReplies: ['Ships in 3 days'], greeting: '' }, chat: { conversation: artisan, card: null, hasMore: false, messages: [msg(1)] } });
  renderChat();
  await screen.findByText('message 1');
  expect(screen.queryByRole('group', { name: 'Quick questions' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Quick replies/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ships in 3 days' }));
  expect(screen.getByLabelText('Write a message…')).toHaveValue('Ships in 3 days');
  expect(callsTo(`/conversations/${CHAT}/messages`, 'POST')).toHaveLength(0);
});

test('unread messages are marked read when the chat opens', async () => {
  const unread = conv({ unread: 2 });
  mockApi({ list: [unread], chat: { conversation: unread, card: null, hasMore: false, messages: [msg(1)] } });
  renderChat();
  await screen.findByText('message 1');
  await waitFor(() => expect(callsTo(`/conversations/${CHAT}/read`, 'POST')).toHaveLength(1));
});

test('a suspended shop: the history shows, the text box does not', async () => {
  const closed = conv({ canSend: false });
  mockApi({ list: [closed], chat: { conversation: closed, card: null, hasMore: false, messages: [msg(1)] } });
  renderChat();
  expect(await screen.findByText('message 1')).toBeInTheDocument();
  expect(screen.getByText("This shop isn't receiving messages right now.")).toBeInTheDocument();
  expect(screen.queryByLabelText('Write a message…')).not.toBeInTheDocument();
});

test('empty and error states', async () => {
  const state = { list: [], chat: {} };
  mockApi(state);
  const { unmount } = renderChat({ activeId: null });
  expect(await screen.findByRole('heading', { name: t.messages.emptyTitle })).toBeInTheDocument();
  expect(screen.queryByText(t.messages.pick)).not.toBeInTheDocument();
  unmount();

  state.listError = true;
  renderChat({ activeId: null });
  expect(await screen.findByRole('alert')).toHaveTextContent(t.messages.listError);
});

const shopOf = (n) => ({ _id: `s${n}`, shopName: `Shop ${n}`, photoUrl: '', contactInfo: 'call +97699112233', location: 'Secret Street 1', payoutEmail: 'pay@example.com', user: { _id: `u${n}`, name: `Owner ${n}`, email: 'owner@example.com', avatarUrl: '' } });

test('empty inbox for a buyer: explanation, Browse shops, and up to 4 shops that start a chat', async () => {
  mockApi({ list: [], chat: {} });
  const navigate = jest.fn();
  const onStartChat = jest.fn(() => Promise.resolve());
  window.scrollTo = () => {};
  const { container } = renderChat({ activeId: null, navigate, onStartChat, suggestedShops: [1, 2, 3, 4, 5].map(shopOf) });
  await screen.findByText(t.messages.emptyBody);

  fireEvent.click(screen.getByRole('button', { name: t.messages.browseShops }));
  expect(navigate).toHaveBeenCalledWith('shop');

  expect(screen.getAllByRole('button', { name: /^Start a chat with/ })).toHaveLength(4);
  expect(screen.queryByText('Shop 5')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start a chat with Shop 2' }));
  expect(onStartChat).toHaveBeenCalledWith('s2');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start a chat with Shop 1' })).toBeEnabled());

  // Name and avatar only.
  expect(container.querySelector('.msg-empty').textContent).not.toMatch(/@|\+976|Secret Street|Owner \d/);
});

test('empty inbox with no shops to suggest still offers Browse shops', async () => {
  mockApi({ list: [], chat: {} });
  renderChat({ activeId: null, suggestedShops: [] });
  expect(await screen.findByRole('button', { name: t.messages.browseShops })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Start a chat with/ })).not.toBeInTheDocument();
});

test('empty inbox for an artisan: no shops to start a chat with, since only buyers can', async () => {
  mockApi({ list: [], chat: {} });
  renderChat({ activeId: null, role: 'artisan', suggestedShops: [shopOf(1)] });
  expect(await screen.findByText(t.messages.emptyBodyArtisan)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: t.messages.browseShops })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Start a chat with/ })).not.toBeInTheDocument();
});

test('polls the open chat every 15 seconds and the list every 45; both pause while hidden', async () => {
  jest.useFakeTimers();
  mockApi({ list: [conv()], chat: { conversation: conv(), card: null, hasMore: false, messages: [msg(1)] } });
  renderChat();
  await act(async () => { await Promise.resolve(); });
  const chatCalls = () => callsTo(`/conversations/${CHAT}/messages`).length;
  const listCalls = () => callsTo('/conversations').length;
  const chat0 = chatCalls(), list0 = listCalls();

  await act(async () => { jest.advanceTimersByTime(45000); });
  expect(chatCalls()).toBe(chat0 + 3);
  expect(listCalls()).toBe(list0 + 1);

  setVisibility('hidden');
  await act(async () => { jest.advanceTimersByTime(180000); });
  expect(chatCalls()).toBe(chat0 + 3);
  expect(listCalls()).toBe(list0 + 1);

  setVisibility('visible');
  expect(chatCalls()).toBe(chat0 + 4);
  expect(listCalls()).toBe(list0 + 2);
});

test('shop settings: saves the greeting and replies, and stops at 10', async () => {
  const showToast = jest.fn();
  mockApi({ settings: { savedReplies: Array.from({ length: 9 }, (_, i) => `R${i}`), greeting: 'Hi' } });
  render(<ChatSettingsForm t={t} onApiError={noop} showToast={showToast} />);
  const greeting = await screen.findByLabelText(/Automatic greeting/);
  expect(greeting).toHaveValue('Hi');
  fireEvent.click(screen.getByRole('button', { name: '+ Add a reply' }));
  expect(screen.queryByRole('button', { name: '+ Add a reply' })).not.toBeInTheDocument(); // 10 now
  fireEvent.change(screen.getByLabelText('Saved reply 10'), { target: { value: 'Thanks!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove reply 1' }));
  fireEvent.change(greeting, { target: { value: 'Welcome' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save message settings' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Saved'));
  const body = bodyOf(callsTo('/artisans/me/chat-settings', 'PUT')[0]);
  expect(body.greeting).toBe('Welcome');
  expect(body.savedReplies).toHaveLength(9);
  expect(body.savedReplies).toContain('Thanks!');
  expect(body.savedReplies).not.toContain('R0');
});

test('the order page offers the right chat button to each side', async () => {
  const order = (viewer) => ({ id: 'o1', createdAt: new Date().toISOString(), status: 'shipped', viewer, shop: { shopName: 'S', ownerName: 'O' }, milestones: [], items: [], subtotal: 1, commissionFee: 0, shipping: 0, total: 1, shippingAddress: null, payout: null, payment: { paid: false }, actions: {} });
  const show = async (viewer) => {
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: async () => order(viewer) }));
    const onMessage = jest.fn();
    const view = render(<OrderDetail t={t} lang="en" orderId="o1" fmtAmt={String} onBack={noop} onApiError={noop} showToast={noop} onMessage={onMessage} />);
    await screen.findByRole('heading', { name: t.orders.title });
    return { ...view, onMessage };
  };
  let view = await show({ isBuyer: true, isArtisan: false });
  fireEvent.click(screen.getByRole('button', { name: 'Message the artisan' }));
  expect(view.onMessage).toHaveBeenCalled();
  view.unmount();
  view = await show({ isBuyer: false, isArtisan: true });
  expect(screen.getByRole('button', { name: 'Message the buyer' })).toBeInTheDocument();
  view.unmount();
  await show({ isBuyer: true, isArtisan: true }); // own shop's order
  expect(screen.queryByRole('button', { name: /^Message/ })).not.toBeInTheDocument();
});

test('all chat text exists in all three languages', () => {
  const shape = (o) => Object.keys(o).sort();
  for (const lang of ['mn', 'ko']) {
    expect(shape(i18n[lang].messages)).toEqual(shape(t.messages));
    expect(shape(i18n[lang].messages.errors)).toEqual(shape(t.messages.errors));
    expect(i18n[lang].messages.quick).toHaveLength(t.messages.quick.length);
  }
});
