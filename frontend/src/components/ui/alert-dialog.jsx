"use client"

import * as Silian_React from "react"
import * as Silian_AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn as Silian_cn } from "@/lib/utils"
import { buttonVariants as Silian_buttonVariants } from "@/components/ui/button-variants"

function Silian_AlertDialog({
  ...Silian_props
}) {
  return <Silian_AlertDialogPrimitive.Root data-slot="alert-dialog" {...Silian_props} />;
}

function Silian_AlertDialogTrigger({
  ...Silian_props
}) {
  return (<Silian_AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...Silian_props} />);
}

function Silian_AlertDialogPortal({
  ...Silian_props
}) {
  return (<Silian_AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...Silian_props} />);
}

function Silian_AlertDialogOverlay({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={Silian_cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_AlertDialogContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AlertDialogPortal>
      <Silian_AlertDialogOverlay />
      <Silian_AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={Silian_cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          Silian_className
        )}
        {...Silian_props} />
    </Silian_AlertDialogPortal>
  );
}

function Silian_AlertDialogHeader({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={Silian_cn("flex flex-col gap-2 text-center sm:text-left", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AlertDialogFooter({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={Silian_cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AlertDialogTitle({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={Silian_cn("text-lg font-semibold", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AlertDialogDescription({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={Silian_cn("text-muted-foreground text-sm", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AlertDialogAction({
  className: Silian_className,
  ...Silian_props
}) {
  return (<Silian_AlertDialogPrimitive.Action className={Silian_cn(Silian_buttonVariants(), Silian_className)} {...Silian_props} />);
}

function Silian_AlertDialogCancel({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AlertDialogPrimitive.Cancel
      className={Silian_cn(Silian_buttonVariants({ variant: "outline" }), Silian_className)}
      {...Silian_props} />
  );
}

export {
  Silian_AlertDialog as AlertDialog,
  Silian_AlertDialogPortal as AlertDialogPortal,
  Silian_AlertDialogOverlay as AlertDialogOverlay,
  Silian_AlertDialogTrigger as AlertDialogTrigger,
  Silian_AlertDialogContent as AlertDialogContent,
  Silian_AlertDialogHeader as AlertDialogHeader,
  Silian_AlertDialogFooter as AlertDialogFooter,
  Silian_AlertDialogTitle as AlertDialogTitle,
  Silian_AlertDialogDescription as AlertDialogDescription,
  Silian_AlertDialogAction as AlertDialogAction,
  Silian_AlertDialogCancel as AlertDialogCancel,
}
