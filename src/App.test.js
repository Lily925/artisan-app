import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// The app loads products and exchange rates on start; keep those requests pending so the
// test never touches the network (no API or exchange-rate service needed).
beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('logged-out visitors see the login page with the brand and login/register tabs', () => {
  render(<App />);
  expect(screen.getByText('Artisan')).toBeInTheDocument();
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(2);
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
});

test('signing up as an artisan asks for the shop and sends only the chosen role', async () => {
  render(<App />);
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
