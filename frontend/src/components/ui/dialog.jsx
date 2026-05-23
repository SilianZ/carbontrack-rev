import * as Silian_React from "react"
import * as Silian_DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon as Silian_XIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Dialog({
  ...Silian_props
}) {
  return <Silian_DialogPrimitive.Root data-slot="dialog" {...Silian_props} />;
}

function Silian_DialogTrigger({
  ...Silian_props
}) {
  return <Silian_DialogPrimitive.Trigger data-slot="dialog-trigger" {...Silian_props} />;
}

function Silian_DialogPortal({
  ...Silian_props
}) {
  return <Silian_DialogPrimitive.Portal data-slot="dialog-portal" {...Silian_props} />;
}

function Silian_DialogClose({
  ...Silian_props
}) {
  return <Silian_DialogPrimitive.Close data-slot="dialog-close" {...Silian_props} />;
}

function Silian_DialogOverlay({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={Silian_cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_DialogContent({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_DialogPortal data-slot="dialog-portal">
      <Silian_DialogOverlay />
      <Silian_DialogPrimitive.Content
        data-slot="dialog-content"
        className={Silian_cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          Silian_className
        )}
        {...Silian_props}>
        {Silian_children}
        <Silian_DialogPrimitive.Close
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <Silian_XIcon />
          <span className="sr-only">Close</span>
        </Silian_DialogPrimitive.Close>
      </Silian_DialogPrimitive.Content>
    </Silian_DialogPortal>
  );
}

function Silian_DialogHeader({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="dialog-header"
      className={Silian_cn("flex flex-col gap-2 text-center sm:text-left", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_DialogFooter({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={Silian_cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_DialogTitle({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_DialogPrimitive.Title
      data-slot="dialog-title"
      className={Silian_cn("text-lg leading-none font-semibold", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_DialogDescription({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_DialogPrimitive.Description
      data-slot="dialog-description"
      className={Silian_cn("text-muted-foreground text-sm", Silian_className)}
      {...Silian_props} />
  );
}

export {
  Silian_Dialog as Dialog,
  Silian_DialogClose as DialogClose,
  Silian_DialogContent as DialogContent,
  Silian_DialogDescription as DialogDescription,
  Silian_DialogFooter as DialogFooter,
  Silian_DialogHeader as DialogHeader,
  Silian_DialogOverlay as DialogOverlay,
  Silian_DialogPortal as DialogPortal,
  Silian_DialogTitle as DialogTitle,
  Silian_DialogTrigger as DialogTrigger,
}
