import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChangePasswordForm from './ChangePasswordForm';
import { i18n } from '../data';
import { getToken, setToken } from '../api';

const t = i18n.en;
const cp = t.changePassword;
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const respond = (status, body) => jest.spyOn(global, 'fetch').mockResolvedValue({ ok: status < 400, status, statusText: '', json: async () => body });

beforeEach(() => setToken('old-token'));
afterEach(() => { jest.restoreAllMocks(); setToken(null); });

test('shows inline errors and sends nothing when the form is invalid', () => {
  const fetchSpy = respond(200, {});
  render(<ChangePasswordForm t={t} onApiError={() => {}} />);
  fill(cp.current, 'current-pass');
  fill(cp.next, 'short');
  fill(cp.confirm, 'other');
  fireEvent.click(screen.getByRole('button', { name: cp.submit }));
  expect(screen.getByText(cp.tooShort)).toBeInTheDocument();
  expect(screen.getByText(cp.mismatch)).toBeInTheDocument();
  fill(cp.next, 'current-pass');
  expect(screen.getByText(cp.same)).toBeInTheDocument();
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('the eye button shows and hides a password', () => {
  render(<ChangePasswordForm t={t} onApiError={() => {}} />);
  const input = screen.getByLabelText(cp.current);
  expect(input).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getAllByRole('button', { name: cp.show })[0]);
  expect(input).toHaveAttribute('type', 'text');
});

test('on success stores the new token, clears the fields and says so', async () => {
  respond(200, { token: 'new-token', user: {} });
  render(<ChangePasswordForm t={t} onApiError={() => {}} />);
  fill(cp.current, 'current-pass');
  fill(cp.next, 'brand-new-pass');
  fill(cp.confirm, 'brand-new-pass');
  fireEvent.click(screen.getByRole('button', { name: cp.submit }));
  expect(await screen.findByRole('status')).toHaveTextContent(cp.success);
  expect(getToken()).toBe('new-token');
  expect(screen.getByLabelText(cp.current)).toHaveValue('');
  expect(screen.getByLabelText(cp.next)).toHaveValue('');
});

test('a wrong current password shows a translated error and keeps the token', async () => {
  respond(400, { error: 'Current password is incorrect', code: 'WRONG_PASSWORD' });
  render(<ChangePasswordForm t={i18n.mn} onApiError={() => {}} />);
  const m = i18n.mn.changePassword;
  fill(m.current, 'wrong-pass');
  fill(m.next, 'brand-new-pass');
  fill(m.confirm, 'brand-new-pass');
  fireEvent.click(screen.getByRole('button', { name: m.submit }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(m.wrong));
  expect(getToken()).toBe('old-token');
});
