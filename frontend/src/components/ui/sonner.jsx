import { useTheme as Silian_useTheme } from "next-themes"
import { Toaster as Silian_Sonner } from "sonner";

const Silian_Toaster = ({
  ...Silian_props
}) => {
  const { theme: Silian_theme = "system" } = Silian_useTheme()

  return (
    <Silian_Sonner
      theme={Silian_theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        }
      }
      {...Silian_props} />
  );
}

export { Silian_Toaster as Toaster }
