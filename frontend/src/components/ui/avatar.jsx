"use client"

import * as Silian_React from "react"
import * as Silian_AvatarPrimitive from "@radix-ui/react-avatar"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Avatar({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AvatarPrimitive.Root
      data-slot="avatar"
      className={Silian_cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AvatarImage({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AvatarPrimitive.Image
      data-slot="avatar-image"
      className={Silian_cn("aspect-square size-full", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AvatarFallback({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={Silian_cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        Silian_className
      )}
      {...Silian_props} />
  );
}

export { Silian_Avatar as Avatar, Silian_AvatarImage as AvatarImage, Silian_AvatarFallback as AvatarFallback }
