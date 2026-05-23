import * as Silian_React from "react"
import * as Silian_AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon as Silian_ChevronDownIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Accordion({
  ...Silian_props
}) {
  return <Silian_AccordionPrimitive.Root data-slot="accordion" {...Silian_props} />;
}

function Silian_AccordionItem({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_AccordionPrimitive.Item
      data-slot="accordion-item"
      className={Silian_cn("border-b last:border-b-0", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_AccordionTrigger({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_AccordionPrimitive.Header className="flex">
      <Silian_AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={Silian_cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          Silian_className
        )}
        {...Silian_props}>
        {Silian_children}
        <Silian_ChevronDownIcon
          className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </Silian_AccordionPrimitive.Trigger>
    </Silian_AccordionPrimitive.Header>
  );
}

function Silian_AccordionContent({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
      {...Silian_props}>
      <div className={Silian_cn("pt-0 pb-4", Silian_className)}>{Silian_children}</div>
    </Silian_AccordionPrimitive.Content>
  );
}

export { Silian_Accordion as Accordion, Silian_AccordionItem as AccordionItem, Silian_AccordionTrigger as AccordionTrigger, Silian_AccordionContent as AccordionContent }
