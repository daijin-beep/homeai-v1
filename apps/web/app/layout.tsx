import type { ReactNode } from "react";

export const metadata = {
  title: "homeAI V1",
  description: "Spatial foundation and soft decor GPS"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
