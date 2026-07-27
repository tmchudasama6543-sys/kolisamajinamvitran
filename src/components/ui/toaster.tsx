"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  // Dismiss all toasts instantly if the user clicks anywhere else on the screen
  React.useEffect(() => {
    if (toasts.length === 0) return

    const timer = setTimeout(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.group') && !target.closest('[role="status"]')) {
          dismiss()
        }
      }
      document.addEventListener("click", handleOutsideClick)
      return () => document.removeEventListener("click", handleOutsideClick)
    }, 100)

    return () => clearTimeout(timer)
  }, [toasts, dismiss])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const observer = new MutationObserver(() => {
      const hasOpenModal = document.querySelector(
        '[role="dialog"], [role="alertdialog"], [data-radix-menu-content], [data-radix-popper-content-wrapper]'
      )
      if (!hasOpenModal) {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = 'auto'
        }
        if (document.body.style.overflow === 'hidden') {
          document.body.style.overflow = ''
        }
      }
    })

    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  return (
    <ToastProvider duration={1500}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
