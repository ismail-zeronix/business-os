import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Soft status chip (design v3): 24px high, pill-shaped, 12px text, pastel tinted background, no border. Tones carry meaning only (docs/design/UI_SYSTEM.md section 6).
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs leading-none font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        neutral: "bg-muted text-foreground/70",
        muted: "bg-transparent text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "bg-emerald-100 text-emerald-800",
        warning: "bg-amber-100 text-amber-900",
        danger: "bg-red-100 text-red-800",
        info: "bg-cyan-100 text-cyan-800",
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
