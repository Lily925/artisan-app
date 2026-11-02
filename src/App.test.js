import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// The app loads products and exchange rates on start; keep those requests pending so the
// test never touches the network (no API or exchange-rate service needed).
beforeEach(() => {
  window.scrollTo = () => {};
  jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  jest.restoreAllMocks();
});

const openLogin = () => fireEvent.click(screen.getByRole('button', { name: 'Login' }));

test('the login page has the brand and login/register tabs', () => {
  render(<App />);
  openLogin();
  expect(screen.getByText('Artisan')).toBeInTheDocument();
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(2);
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
});

test('signing up as an artisan asks for the shop and sends only the chosen role', async () => {
  render(<App />);
  openLogin();
  fireEvent.click(screen.getAllByRole('tab')[1]); // Register
  expect(screen.queryByLabelText(/Shop name/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /I want to sell my crafts/ }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nara' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nara@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-pw' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please fill all fields'); // shop name missing

  fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: 'Нар Эсгий' } });
  fireEvent.change(screen.getByLabelText('Short shop description'), { target: { value: 'Felt slippers' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/signup'))).toBe(true));
  const [, init] = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/auth/signup'));
  expect(JSON.parse(init.body)).toEqual({ name: 'Nara', email: 'nara@example.com', password: 'long-enough-pw', role: 'artisan', shopName: 'Нар Эсгий', shopDescription: 'Felt slippers' });
});

// A logged-in artisan whose shop is still pending: answers each API call by path.
function loginPendingArtisan() {
  localStorage.setItem('artisan-token', 'token');
  localStorage.setItem('artisan-user', JSON.stringify({ id: 'u1', name: 'Nara', email: 'nara@example.com', role: 'artisan' }));
  localStorage.setItem('artisan-lang', 'en');
  const byPath = {
    '/artisans/me': { _id: 'a1', shopName: 'Nar Esgii', status: 'pending', statusReason: '', user: { _id: 'u1', name: 'Nara' } },
    '/users/me': { id: 'u1', name: 'Nara', email: 'nara@example.com', role: 'artisan', avatarUrl: '', bio: '' },
    '/cart': { items: [] },
  };
  global.fetch.mockImplementation((url) => {
    const path = new URL(String(url)).pathname.replace(/^\/api/, '');
    if (!String(url).includes('/api/')) return new Promise(() => {}); // exchange rates
    return Promise.resolve({ ok: true, status: 200, json: async () => byPath[path] ?? [] });
  });
}

test('a pending artisan sees the approval banner and no Add product buttons', async () => {
  loginPendingArtisan();
  try {
    render(<App />);
    expect(await screen.findByText('Your shop is waiting for approval')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nara' })); // profile
    expect(await screen.findByRole('heading', { name: 'My products' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add product' })).not.toBeInTheDocument();
    expect(screen.getByText('You can add products once your shop is approved.')).toBeInTheDocument(); // onboarding step
  } finally {
    localStorage.clear();
  }
});
