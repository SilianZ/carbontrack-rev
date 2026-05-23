import * as Silian_React from "react"
import Silian_PropTypes from 'prop-types';
import { Slot as Silian_Slot } from "@radix-ui/react-slot"
import { cva as Silian_cva } from "class-variance-authority";

import { cn as Silian_cn } from "@/lib/utils"

const Silian_badgeVariants = Silian_cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Priority specific variants
        urgent:
          "border-transparent bg-red-600 text-white [a&]:hover:bg-red-700",
        high:
          "border-transparent bg-orange-500 text-white [a&]:hover:bg-orange-600",
        normal:
          "border-transparent bg-gray-100 text-gray-800 [a&]:hover:bg-gray-200",
        low:
          "border-transparent bg-blue-100 text-blue-800 [a&]:hover:bg-blue-200",
      }
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Silian_Badge({
  className: Silian_className,
  variant: Silian_variant,
  asChild: Silian_asChild = false,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "span"

  return (
    <Silian_Comp
      data-slot="badge"
      className={Silian_cn(Silian_badgeVariants({ variant: Silian_variant }), Silian_className)}
      {...Silian_props} />
  );
}

export { Silian_Badge as Badge }

Silian_Badge.propTypes = {
  className: Silian_PropTypes.string,
  variant: Silian_PropTypes.string,
  asChild: Silian_PropTypes.bool,
};
