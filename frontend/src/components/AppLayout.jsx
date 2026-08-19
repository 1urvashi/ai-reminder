import Navbar from './Navbar';

// Chrome for authenticated pages: sticky navbar + centered content container.
export default function AppLayout({ children, wide = false }) {
  return (
    <>
      <Navbar />
      <main className="container" style={wide ? { maxWidth: 1080 } : undefined}>
        {children}
      </main>
    </>
  );
}
