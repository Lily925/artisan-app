import { render, screen } from '@testing-library/react';
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
