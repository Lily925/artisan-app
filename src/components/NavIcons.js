// Header icons: one line style, coloured by the button (currentColor).
function LineIcon({ children }) {
  return (
    <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const HeartIcon = () => (
  <LineIcon><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.7 4.8 7 4.8c2 0 3.8 1.1 5 3 1.2-1.9 3-3 5-3 3.3 0 5.3 3.2 4.2 6.4-1.7 4.7-9.2 9.3-9.2 9.3Z" /></LineIcon>
);

export const CartIcon = () => (
  <LineIcon>
    <path d="M6 8h12l1.2 12.2H4.8L6 8Z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </LineIcon>
);

export const BellIcon = () => (
  <LineIcon>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </LineIcon>
);

export const ChatIcon = () => (
  <LineIcon>
    <path d="M20.5 11.5c0 4.1-3.8 7.4-8.5 7.4-1.1 0-2.2-.2-3.2-.5L4 20l1.3-3.8c-1.1-1.3-1.8-2.9-1.8-4.7C3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.5Z" />
  </LineIcon>
);
