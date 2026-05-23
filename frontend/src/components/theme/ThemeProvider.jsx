import { ThemeProvider as Silian_NextThemesProvider } from 'next-themes'

function Silian_ThemeProvider({ children: Silian_children, ...Silian_props }) {
  return (
    <Silian_NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...Silian_props}
    >
      {Silian_children}
    </Silian_NextThemesProvider>
  )
}

export { Silian_ThemeProvider as ThemeProvider }
