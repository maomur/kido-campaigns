import './globals.css';

export const metadata = {
  title: 'Abitare Marketing Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
