import * as Silian_React from "react"
import { Slot as Silian_Slot } from "@radix-ui/react-slot"
import { ChevronRight as Silian_ChevronRight, MoreHorizontal as Silian_MoreHorizontal } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Breadcrumb({
  ...Silian_props
}) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...Silian_props} />;
}

function Silian_BreadcrumbList({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={Silian_cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_BreadcrumbItem({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={Silian_cn("inline-flex items-center gap-1.5", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_BreadcrumbLink({
  asChild: Silian_asChild,
  className: Silian_className,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "a"

  return (
    <Silian_Comp
      data-slot="breadcrumb-link"
      className={Silian_cn("hover:text-foreground transition-colors", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_BreadcrumbPage({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={Silian_cn("text-foreground font-normal", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_BreadcrumbSeparator({
  children: Silian_children,
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={Silian_cn("[&>svg]:size-3.5", Silian_className)}
      {...Silian_props}>
      {Silian_children ?? <Silian_ChevronRight />}
    </li>
  );
}

function Silian_BreadcrumbEllipsis({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={Silian_cn("flex size-9 items-center justify-center", Silian_className)}
      {...Silian_props}>
      <Silian_MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Silian_Breadcrumb as Breadcrumb,
  Silian_BreadcrumbList as BreadcrumbList,
  Silian_BreadcrumbItem as BreadcrumbItem,
  Silian_BreadcrumbLink as BreadcrumbLink,
  Silian_BreadcrumbPage as BreadcrumbPage,
  Silian_BreadcrumbSeparator as BreadcrumbSeparator,
  Silian_BreadcrumbEllipsis as BreadcrumbEllipsis,
}
