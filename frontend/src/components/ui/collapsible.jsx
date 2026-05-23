import * as Silian_CollapsiblePrimitive from "@radix-ui/react-collapsible"

function Silian_Collapsible({
  ...Silian_props
}) {
  return <Silian_CollapsiblePrimitive.Root data-slot="collapsible" {...Silian_props} />;
}

function Silian_CollapsibleTrigger({
  ...Silian_props
}) {
  return (<Silian_CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...Silian_props} />);
}

function Silian_CollapsibleContent({
  ...Silian_props
}) {
  return (<Silian_CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...Silian_props} />);
}

export { Silian_Collapsible as Collapsible, Silian_CollapsibleTrigger as CollapsibleTrigger, Silian_CollapsibleContent as CollapsibleContent }
