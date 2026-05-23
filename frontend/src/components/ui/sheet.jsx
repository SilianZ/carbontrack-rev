import * as Silian_React from "react"
import * as Silian_SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon as Silian_XIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Sheet({
  ...Silian_props
}) {
  return <Silian_SheetPrimitive.Root data-slot="sheet" {...Silian_props} />;
}

function Silian_SheetTrigger({
  ...Silian_props
}) {
  return <Silian_SheetPrimitive.Trigger data-slot="sheet-trigger" {...Silian_props} />;
}

function Silian_SheetClose({
  ...Silian_props
}) {
  return <Silian_SheetPrimitive.Close data-slot="sheet-close" {...Silian_props} />;
}

function Silian_SheetPortal({
  ...Silian_props
}) {
  return <Silian_SheetPrimitive.Portal data-slot="sheet-portal" {...Silian_props} />;
}

function Silian_SheetOverlay({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={Silian_cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SheetContent({
  className: Silian_className,
  children: Silian_children,
  side: Silian_side = "right",
  ...Silian_props
}) {
  return (
    <Silian_SheetPortal>
      <Silian_SheetOverlay />
      <Silian_SheetPrimitive.Content
        data-slot="sheet-content"
        className={Silian_cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          Silian_side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          Silian_side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          Silian_side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          Silian_side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          Silian_className
        )}
        {...Silian_props}>
        {Silian_children}
        <Silian_SheetPrimitive.Close
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <Silian_XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </Silian_SheetPrimitive.Close>
      </Silian_SheetPrimitive.Content>
    </Silian_SheetPortal>
  );
}

function Silian_SheetHeader({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sheet-header"
      className={Silian_cn("flex flex-col gap-1.5 p-4", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SheetFooter({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sheet-footer"
      className={Silian_cn("mt-auto flex flex-col gap-2 p-4", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SheetTitle({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SheetPrimitive.Title
      data-slot="sheet-title"
      className={Silian_cn("text-foreground font-semibold", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SheetDescription({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SheetPrimitive.Description
      data-slot="sheet-description"
      className={Silian_cn("text-muted-foreground text-sm", Silian_className)}
      {...Silian_props} />
  );
}

export {
  Silian_Sheet as Sheet,
  Silian_SheetTrigger as SheetTrigger,
  Silian_SheetClose as SheetClose,
  Silian_SheetContent as SheetContent,
  Silian_SheetHeader as SheetHeader,
  Silian_SheetFooter as SheetFooter,
  Silian_SheetTitle as SheetTitle,
  Silian_SheetDescription as SheetDescription,
}
