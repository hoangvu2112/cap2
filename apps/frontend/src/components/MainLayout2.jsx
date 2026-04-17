"use client"

import Sidebar2 from "./Sidebar2"
import Header2 from "./Header2"
import Footer2 from "./Footer2"
import { LayoutProvider } from "../context/LayoutContext"

/**
 * MainLayout2 — Layout wrapper cho toàn bộ app sau khi đăng nhập.
 *
 * Cấu trúc:
 * ┌─────────┬──────────────────────────────┐
 * │ Sidebar │  Header (sticky)             │
 * │         │  ┌────────────────────────┐   │
 * │         │  │  Main Content (scroll) │   │
 * │         │  └────────────────────────┘   │
 * │         │  Footer                       │
 * └─────────┴──────────────────────────────┘
 *
 * Thay thế pattern cũ:
 *   <Navbar />
 *   {children}
 *   <Footer />
 *
 * Cách dùng trong App.jsx:
 *   <MainLayout2>
 *     <Dashboard2 />
 *   </MainLayout2>
 */
export default function MainLayout2({ children }) {
  return (
    <div
      className="flex h-screen overflow-hidden bg-background app-content-gradient"
      style={{
        background:
          "radial-gradient(1200px 560px at 6% -12%, hsl(150 70% 78% / 0.64), transparent 62%), radial-gradient(980px 460px at 100% 0%, hsl(42 94% 72% / 0.58), transparent 60%), linear-gradient(180deg, hsl(47 78% 96%), hsl(42 58% 93%) 54%, hsl(143 48% 92%))",
      }}
    >
      {/* Sidebar — fixed left */}
      <Sidebar2 />

      {/* Main area — flex column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header — sticky top */}
        <Header2 />

        {/* Content — scrollable, wrapped in LayoutProvider để Navbar/Footer cũ tự ẩn */}
        <main
          className="flex-1 overflow-y-auto app-content-gradient"
          style={{
            background:
              "linear-gradient(180deg, hsl(48 76% 97% / 0.86), hsl(43 58% 95% / 0.74) 38%, hsl(145 42% 93% / 0.72))",
          }}
        >
          <LayoutProvider>
            {children}
          </LayoutProvider>
        </main>

        {/* Footer — bottom */}
        <Footer2 />
      </div>
    </div>
  )
}
