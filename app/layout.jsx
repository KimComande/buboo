import "./globals.css";

export const metadata = {
  title: "Buboo",
  description: "Offline matching operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
