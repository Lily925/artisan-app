// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// The app reads its page from the address, which would otherwise carry over between tests.
beforeEach(() => { window.history.pushState({}, '', '/'); });
