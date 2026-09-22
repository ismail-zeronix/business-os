"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// Light theme only (no next-themes). Toasts confirm success; errors stay inline in forms (docs/design/UI_SYSTEM.md section 7).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
