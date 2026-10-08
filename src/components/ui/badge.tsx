import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Soft status chip: 24px high, pill-shaped, 12px text, pastel tinted background. `success`/`warning`/`danger`/`info` carry a hairline border
// matching their tint (same semantic tokens as alert.tsx); other variants stay borderless. Tones carry meaning only (docs/design/UI_SYSTEM.md section 6).
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs leading-none font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        neutral: "bg-muted text-foreground/70",
        muted: "bg-transparent text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
        // Same semantic tokens as alert.tsx's variants, so Badge and Alert always render identical colours for the same status meaning.
        success: "border-success-border bg-success-bg text-success",
        warning: "border-warning-border bg-warning-bg text-warning",
        danger: "border-danger-border bg-danger-bg text-danger",
        info: "border-info-border bg-info-bg text-info",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
