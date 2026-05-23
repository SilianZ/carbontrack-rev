import * as Silian_React from "react"

const Silian_MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [Silian_isMobile, Silian_setIsMobile] = Silian_React.useState(undefined)

  Silian_React.useEffect(() => {
    const Silian_mql = window.matchMedia(`(max-width: ${Silian_MOBILE_BREAKPOINT - 1}px)`)
    const Silian_onChange = () => {
      Silian_setIsMobile(window.innerWidth < Silian_MOBILE_BREAKPOINT)
    }
    Silian_mql.addEventListener("change", Silian_onChange)
    Silian_setIsMobile(window.innerWidth < Silian_MOBILE_BREAKPOINT)
    return () => Silian_mql.removeEventListener("change", Silian_onChange);
  }, [])

  return !!Silian_isMobile
}
