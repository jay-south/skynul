import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

// Drawer Component based on shadcn/ui but adapted for our CSS system

const Drawer = DialogPrimitive.Root

const DrawerTrigger = DialogPrimitive.Trigger

const DrawerPortal = DialogPrimitive.Portal

const DrawerClose = DialogPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className="drawer-overlay"
    {...props}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease-out'
    }}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className="drawer-content"
      {...props}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '280px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--nb-panel)',
        borderRight: '1px solid var(--nb-border)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.2)',
        animation: 'slideInFromLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {children}
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = DialogPrimitive.Content.displayName

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="drawer-header"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '16px',
      borderBottom: '1px solid var(--nb-border)'
    }}
    {...props}
  />
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="drawer-footer"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      borderTop: '1px solid var(--nb-border)'
    }}
    {...props}
  />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className="drawer-title"
    style={{
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text-primary)'
    }}
    {...props}
  />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className="drawer-description"
    style={{
      fontSize: '12px',
      color: 'var(--nb-muted)'
    }}
    {...props}
  />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

// Global styles for animations
const DrawerStyles = () => (
  <style>{`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideInFromLeft {
      from { 
        transform: translateX(-100%);
        opacity: 0;
      }
      to { 
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutToLeft {
      from { 
        transform: translateX(0);
        opacity: 1;
      }
      to { 
        transform: translateX(-100%);
        opacity: 0;
      }
    }

    .drawer-content[data-state="closed"] {
      animation: slideOutToLeft 0.2s ease-in;
    }

    .drawer-overlay[data-state="closed"] {
      animation: fadeOut 0.2s ease-in;
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `}</style>
)

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerStyles,
  DrawerTitle,
  DrawerTrigger
}
