import * as Silian_React from "react"
import * as Silian_HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_HoverCard({
  ...Silian_props
}) {
  return <Silian_HoverCardPrimitive.Root data-slot="hover-card" {...Silian_props} />;
}

function Silian_HoverCardTrigger({
  ...Silian_props
}) {
  return (<Silian_HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...Silian_props} />);
}

function Silian_HoverCardContent({
  className: Silian_className,
  align: Silian_align = "center",
  sideOffset: Silian_sideOffset = 4,
  ...Silian_props
}) {
  return (
    <Silian_HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <Silian_HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={Silian_align}
        sideOffset={Silian_sideOffset}
        className={Silian_cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          Silian_className
        )}
        {...Silian_props} />
    </Silian_HoverCardPrimitive.Portal>
  );
}

export { Silian_HoverCard as HoverCard, Silian_HoverCardTrigger as HoverCardTrigger, Silian_HoverCardContent as HoverCardContent }
