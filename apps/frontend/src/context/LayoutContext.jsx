"use client"

import { createContext, useContext } from "react"

/**
 * LayoutContext — dùng để phát hiện page đang nằm trong MainLayout2 hay không.
 * 
 * Khi MainLayout2 bọc page → hasLayout = true
 * → Navbar.jsx và Footer.jsx sẽ tự ẩn (return null)
 * → Tránh bị double navigation
 */
const LayoutContext = createContext({ hasLayout: false })

export const LayoutProvider = ({ children }) => (
  <LayoutContext.Provider value={{ hasLayout: true }}>
    {children}
  </LayoutContext.Provider>
)

export const useLayout = () => useContext(LayoutContext)
