import * as Silian_React from "react"
import Silian_PropTypes from "prop-types"
import * as Silian_RechartsPrimitive from "recharts"

import { cn as Silian_cn } from "@/lib/utils"

const Silian_SAFE_CHART_TOKEN_PATTERN = /[^a-zA-Z0-9_-]/g
const Silian_BLOCKED_COLOR_PATTERN = /[;{}<>]|(?:@import|expression\s*\(|url\s*\()/i
const Silian_SAFE_COLOR_PATTERNS = [
  /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i,
  /^(?:rgb|hsl)a?\([\d.%\s,+\-/]+\)$/i,
  /^var\(--[a-z0-9_-]+\)$/i,
  /^(?:rgb|hsl)a?\(\s*var\(--[a-z0-9_-]+\)(?:\s*\/\s*[\d.%]+)?\s*\)$/i,
  /^[a-z]+$/i,
]

// Format: { THEME_NAME: CSS_SELECTOR }
const Silian_THEMES = {
  light: "",
  dark: ".dark"
}

const Silian_ChartContext = Silian_React.createContext(null)

function Silian_sanitizeChartToken(Silian_value, Silian_fallback = "chart") {
  const Silian_normalized = `${Silian_value ?? ""}`
    .trim()
    .replaceAll(Silian_SAFE_CHART_TOKEN_PATTERN, "-")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^-+|-+$/g, "")

  return Silian_normalized || Silian_fallback
}

function Silian_sanitizeChartColor(Silian_value) {
  const Silian_normalized = `${Silian_value ?? ""}`.trim()

  if (!Silian_normalized || Silian_BLOCKED_COLOR_PATTERN.test(Silian_normalized)) {
    return null
  }

  return Silian_SAFE_COLOR_PATTERNS.some((Silian_pattern) => Silian_pattern.test(Silian_normalized))
    ? Silian_normalized
    : null
}

function Silian_buildChartCssText(Silian_id, Silian_config) {
  if (!Silian_config || typeof Silian_config !== "object") {
    return ""
  }

  const Silian_safeId = Silian_sanitizeChartToken(Silian_id, "chart")

  const Silian_colorConfig = Object.entries(Silian_config)
    .map(([Silian_key, Silian_itemConfig]) => {
      const Silian_safeKey = Silian_sanitizeChartToken(Silian_key, "series")
      const Silian_safeItemConfig = Silian_itemConfig && typeof Silian_itemConfig === "object" ? Silian_itemConfig : {}

      return [Silian_safeKey, Silian_safeItemConfig]
    })
    .filter(([, Silian_itemConfig]) => Silian_itemConfig.theme || Silian_itemConfig.color)

  if (!Silian_colorConfig.length) {
    return ""
  }

  return Object.entries(Silian_THEMES)
    .map(([Silian_theme, Silian_prefix]) => {
      const Silian_declarations = Silian_colorConfig
        .map(([Silian_key, Silian_itemConfig]) => {
          const Silian_color = Silian_sanitizeChartColor(Silian_itemConfig.theme?.[Silian_theme] || Silian_itemConfig.color)
          return Silian_color ? `  --color-${Silian_key}: ${Silian_color};` : null
        })
        .filter(Boolean)
        .join("\n")

      if (!Silian_declarations) {
        return null
      }

      const Silian_selectorPrefix = Silian_prefix ? `${Silian_prefix} ` : ""
      const Silian_selector = `${Silian_selectorPrefix}[data-chart="${Silian_safeId}"]`
      return `${Silian_selector} {\n${Silian_declarations}\n}`
    })
    .filter(Boolean)
    .join("\n")
}

function Silian_useChart() {
  const Silian_context = Silian_React.useContext(Silian_ChartContext)

  if (!Silian_context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return Silian_context
}

function Silian_ChartContainer({
  id: Silian_id,
  className: Silian_className,
  children: Silian_children,
  config: Silian_config,
  ...Silian_props
}) {
  const Silian_uniqueId = Silian_React.useId()
  const Silian_chartContextValue = Silian_React.useMemo(() => ({ config: Silian_config }), [Silian_config])
  const Silian_chartId = Silian_React.useMemo(
    () => `chart-${Silian_sanitizeChartToken(Silian_id || Silian_uniqueId.replaceAll(":", ""))}`,
    [Silian_id, Silian_uniqueId]
  )

  return (
    <Silian_ChartContext.Provider value={Silian_chartContextValue}>
      <div
        data-slot="chart"
        data-chart={Silian_chartId}
        className={Silian_cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          Silian_className
        )}
        {...Silian_props}>
        <Silian_ChartStyle id={Silian_chartId} config={Silian_config} />
        <Silian_RechartsPrimitive.ResponsiveContainer>
          {Silian_children}
        </Silian_RechartsPrimitive.ResponsiveContainer>
      </div>
    </Silian_ChartContext.Provider>
  );
}

const Silian_ChartStyle = ({
  id: Silian_id,
  config: Silian_config
}) => {
  const Silian_cssText = Silian_React.useMemo(() => Silian_buildChartCssText(Silian_id, Silian_config), [Silian_id, Silian_config])

  if (!Silian_cssText) {
    return null
  }

  return <style>{Silian_cssText}</style>
}

const Silian_ChartTooltip = Silian_RechartsPrimitive.Tooltip

function Silian_ChartTooltipContent({
  active: Silian_active,
  payload: Silian_payload,
  className: Silian_className,
  indicator: Silian_indicator = "dot",
  hideLabel: Silian_hideLabel = false,
  hideIndicator: Silian_hideIndicator = false,
  label: Silian_label,
  labelFormatter: Silian_labelFormatter,
  labelClassName: Silian_labelClassName,
  formatter: Silian_formatter,
  color: Silian_color,
  nameKey: Silian_nameKey,
  labelKey: Silian_labelKey
}) {
  const { config: Silian_config } = Silian_useChart()

  const Silian_tooltipLabel = Silian_React.useMemo(() => {
    if (Silian_hideLabel || !Silian_payload?.length) {
      return null
    }

    const [Silian_item] = Silian_payload
    const Silian_key = `${Silian_labelKey || Silian_item?.dataKey || Silian_item?.name || "value"}`
    const Silian_itemConfig = Silian_getPayloadConfigFromPayload(Silian_config, Silian_item, Silian_key)
    const Silian_value =
      !Silian_labelKey && typeof Silian_label === "string"
        ? Silian_config[Silian_label]?.label || Silian_label
        : Silian_itemConfig?.label

    if (Silian_labelFormatter) {
      return (
        <div className={Silian_cn("font-medium", Silian_labelClassName)}>
          {Silian_labelFormatter(Silian_value, Silian_payload)}
        </div>
      );
    }

    if (!Silian_value) {
      return null
    }

    return <div className={Silian_cn("font-medium", Silian_labelClassName)}>{Silian_value}</div>;
  }, [
    Silian_label,
    Silian_labelFormatter,
    Silian_payload,
    Silian_hideLabel,
    Silian_labelClassName,
    Silian_config,
    Silian_labelKey,
  ])

  if (!Silian_active || !Silian_payload?.length) {
    return null
  }

  const Silian_nestLabel = Silian_payload.length === 1 && Silian_indicator !== "dot"

  return (
    <div
      className={Silian_cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        Silian_className
      )}>
      {Silian_nestLabel ? null : Silian_tooltipLabel}
      <div className="grid gap-1.5">
        {Silian_payload.map((Silian_item, Silian_index) => {
          const Silian_key = `${Silian_nameKey || Silian_item.name || Silian_item.dataKey || "value"}`
          const Silian_itemConfig = Silian_getPayloadConfigFromPayload(Silian_config, Silian_item, Silian_key)
          const Silian_indicatorColor = Silian_color || Silian_item.payload.fill || Silian_item.color

          return (
            <div
              key={Silian_item.dataKey}
              className={Silian_cn(
                "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                Silian_indicator === "dot" && "items-center"
              )}>
              {Silian_formatter && Silian_item?.value !== undefined && Silian_item.name ? (
                Silian_formatter(Silian_item.value, Silian_item.name, Silian_item, Silian_index, Silian_item.payload)
              ) : (
                <>
                  {Silian_itemConfig?.icon ? (
                    <Silian_itemConfig.icon />
                  ) : (
                    !Silian_hideIndicator && (
                      <div
                        className={Silian_cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
                          "h-2.5 w-2.5": Silian_indicator === "dot",
                          "w-1": Silian_indicator === "line",
                          "w-0 border-[1.5px] border-dashed bg-transparent":
                            Silian_indicator === "dashed",
                          "my-0.5": Silian_nestLabel && Silian_indicator === "dashed",
                        })}
                        style={
                          {
                            "--color-bg": Silian_indicatorColor,
                            "--color-border": Silian_indicatorColor
                          }
                        } />
                    )
                  )}
                  <div
                    className={Silian_cn(
                      "flex flex-1 justify-between leading-none",
                      Silian_nestLabel ? "items-end" : "items-center"
                    )}>
                    <div className="grid gap-1.5">
                      {Silian_nestLabel ? Silian_tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {Silian_itemConfig?.label || Silian_item.name}
                      </span>
                    </div>
                    {Silian_item.value && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {Silian_item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Silian_ChartLegend = Silian_RechartsPrimitive.Legend

function Silian_ChartLegendContent({
  className: Silian_className,
  hideIcon: Silian_hideIcon = false,
  payload: Silian_payload,
  verticalAlign: Silian_verticalAlign = "bottom",
  nameKey: Silian_nameKey
}) {
  const { config: Silian_config } = Silian_useChart()

  if (!Silian_payload?.length) {
    return null
  }

  return (
    <div
      className={Silian_cn(
        "flex items-center justify-center gap-4",
        Silian_verticalAlign === "top" ? "pb-3" : "pt-3",
        Silian_className
      )}>
      {Silian_payload.map((Silian_item) => {
        const Silian_key = `${Silian_nameKey || Silian_item.dataKey || "value"}`
        const Silian_itemConfig = Silian_getPayloadConfigFromPayload(Silian_config, Silian_item, Silian_key)

        return (
          <div
            key={Silian_item.value}
            className={Silian_cn(
              "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
            )}>
            {Silian_itemConfig?.icon && !Silian_hideIcon ? (
              <Silian_itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: Silian_item.color,
                }} />
            )}
            {Silian_itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
}

// Helper to extract item config from a payload.
function Silian_getPayloadConfigFromPayload(
  Silian_config,
  Silian_payload,
  Silian_key
) {
  if (typeof Silian_payload !== "object" || Silian_payload === null) {
    return undefined
  }

  const Silian_payloadPayload =
    "payload" in Silian_payload &&
    typeof Silian_payload.payload === "object" &&
    Silian_payload.payload !== null
      ? Silian_payload.payload
      : undefined

  let Silian_configLabelKey = Silian_key

  if (
    Silian_key in Silian_payload &&
    typeof Silian_payload[Silian_key] === "string"
  ) {
    Silian_configLabelKey = Silian_payload[Silian_key]
  } else if (
    Silian_payloadPayload &&
    Silian_key in Silian_payloadPayload &&
    typeof Silian_payloadPayload[Silian_key] === "string"
  ) {
    Silian_configLabelKey = Silian_payloadPayload[Silian_key]
  }

  return Silian_configLabelKey in Silian_config
    ? Silian_config[Silian_configLabelKey]
    : Silian_config[Silian_key];
}

const Silian_chartConfigItemPropType = Silian_PropTypes.shape({
  label: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.node]),
  icon: Silian_PropTypes.elementType,
  color: Silian_PropTypes.string,
  theme: Silian_PropTypes.objectOf(Silian_PropTypes.string),
})

const Silian_chartConfigPropType = Silian_PropTypes.objectOf(Silian_chartConfigItemPropType)

const Silian_chartPayloadItemPropType = Silian_PropTypes.shape({
  color: Silian_PropTypes.string,
  dataKey: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]),
  fill: Silian_PropTypes.string,
  name: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]),
  payload: Silian_PropTypes.object,
  value: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]),
})

Silian_ChartContainer.propTypes = {
  id: Silian_PropTypes.string,
  className: Silian_PropTypes.string,
  children: Silian_PropTypes.node,
  config: Silian_chartConfigPropType.isRequired,
}

Silian_ChartStyle.propTypes = {
  id: Silian_PropTypes.string.isRequired,
  config: Silian_chartConfigPropType.isRequired,
}

Silian_ChartTooltipContent.propTypes = {
  active: Silian_PropTypes.bool,
  payload: Silian_PropTypes.arrayOf(Silian_chartPayloadItemPropType),
  className: Silian_PropTypes.string,
  indicator: Silian_PropTypes.oneOf(["dot", "line", "dashed"]),
  hideLabel: Silian_PropTypes.bool,
  hideIndicator: Silian_PropTypes.bool,
  label: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number, Silian_PropTypes.node]),
  labelFormatter: Silian_PropTypes.func,
  labelClassName: Silian_PropTypes.string,
  formatter: Silian_PropTypes.func,
  color: Silian_PropTypes.string,
  nameKey: Silian_PropTypes.string,
  labelKey: Silian_PropTypes.string,
}

Silian_ChartLegendContent.propTypes = {
  className: Silian_PropTypes.string,
  hideIcon: Silian_PropTypes.bool,
  payload: Silian_PropTypes.arrayOf(Silian_chartPayloadItemPropType),
  verticalAlign: Silian_PropTypes.oneOf(["top", "bottom", "middle"]),
  nameKey: Silian_PropTypes.string,
}

export {
  Silian_ChartContainer as ChartContainer,
  Silian_ChartTooltip as ChartTooltip,
  Silian_ChartTooltipContent as ChartTooltipContent,
  Silian_ChartLegend as ChartLegend,
  Silian_ChartLegendContent as ChartLegendContent,
  Silian_ChartStyle as ChartStyle,
}
