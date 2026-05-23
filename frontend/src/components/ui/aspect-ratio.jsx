import * as Silian_AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

function Silian_AspectRatio({
  ...Silian_props
}) {
  return <Silian_AspectRatioPrimitive.Root data-slot="aspect-ratio" {...Silian_props} />;
}

export { Silian_AspectRatio as AspectRatio }
