import * as React from "react"
import PropTypes from "prop-types"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

const SAFE_CHART_TOKEN_PATTERN = /[^a-zA-Z0-9_-]/g
const BLOCKED_COLOR_PATTERN = /[;{}<>]|(?:@import|expression\s*\(|url\s*\()/i
const SAFE_COLOR_PATTERNS = [
  /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i,
  /^(?:rgb|hsl)a?\([\d.%\s,+\-/]+\)$/i,
  /^var\(--[a-z0-9_-]+\)$/i,
  /^(?:rgb|hsl)a?\(\s*var\(--[a-z0-9_-]+\)(?:\s*\/\s*[\d.%]+)?\s*\)$/i,
  /^[a-z]+$/i,
]

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = {
  light: "",
  dark: ".dark"
}

const ChartContext = React.createContext(null)

function sanitizeChartToken(value, fallback = "chart") {
  const normalized = `${value ?? ""}`
    .trim()
    .replaceAll(SAFE_CHART_TOKEN_PATTERN, "-")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^-+|-+$/g, "")

  return normalized || fallback
}

function sanitizeChartColor(value) {
  const normalized = `${value ?? ""}`.trim()

  if (!normalized || BLOCKED_COLOR_PATTERN.test(normalized)) {
    return null
  }

  return SAFE_COLOR_PATTERNS.some((pattern) => pattern.test(normalized))
    ? normalized
    : null
}

function buildChartCssText(id, config) {
  if (!config || typeof config !== "object") {
    return ""
  }

  const colorConfig = Object.entries(config)
    .map(([key, itemConfig]) => {
      const safeKey = sanitizeChartToken(key, "series")
      const safeItemConfig = itemConfig && typeof itemConfig === "object" ? itemConfig : {}

      return [safeKey, safeItemConfig]
    })
    .filter(([, itemConfig]) => itemConfig.theme || itemConfig.color)

  if (!colorConfig.length) {
    return ""
  }

  return Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const declarations = colorConfig
        .map(([key, itemConfig]) => {
          const color = sanitizeChartColor(itemConfig.theme?.[theme] || itemConfig.color)
          return color ? `  --color-${key}: ${color};` : null
        })
        .filter(Boolean)
        .join("\n")

      if (!declarations) {
        return null
      }

      const selectorPrefix = prefix ? `${prefix} ` : ""
      const selector = `${selectorPrefix}[data-chart="${id}"]`
      return `${selector} {\n${declarations}\n}`
    })
    .filter(Boolean)
    .join("\n")
}

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}) {
  const uniqueId = React.useId()
  const chartContextValue = React.useMemo(() => ({ config }), [config])
  const chartId = React.useMemo(
    () => `chart-${sanitizeChartToken(id || uniqueId.replaceAll(":", ""))}`,
    [id, uniqueId]
  )

  return (
    <ChartContext.Provider value={chartContextValue}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}>
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({
  id,
  config
}) => {
  const cssText = React.useMemo(() => buildChartCssText(id, config), [id, config])

  if (!cssText) {
    return null
  }

  return <style>{cssText}</style>
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey
}) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === "string"
        ? config[label]?.label || label
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }

    if (!value) {
      return null
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}>
      {nestLabel ? null : tooltipLabel}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)
          const indicatorColor = color || item.payload.fill || item.color

          return (
            <div
              key={item.dataKey}
              className={cn(
                "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                indicator === "dot" && "items-center"
              )}>
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
                          "h-2.5 w-2.5": indicator === "dot",
                          "w-1": indicator === "line",
                          "w-0 border-[1.5px] border-dashed bg-transparent":
                            indicator === "dashed",
                          "my-0.5": nestLabel && indicator === "dashed",
                        })}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor
                          }
                        } />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between leading-none",
                      nestLabel ? "items-end" : "items-center"
                    )}>
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
                      </span>
                    </div>
                    {item.value && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {item.value.toLocaleString()}
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

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey
}) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}>
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)

        return (
          <div
            key={item.value}
            className={cn(
              "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
            )}>
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }} />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config,
  payload,
  key
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey = key

  if (
    key in payload &&
    typeof payload[key] === "string"
  ) {
    configLabelKey = payload[key]
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === "string"
  ) {
    configLabelKey = payloadPayload[key]
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key];
}

const chartConfigItemPropType = PropTypes.shape({
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  icon: PropTypes.elementType,
  color: PropTypes.string,
  theme: PropTypes.objectOf(PropTypes.string),
})

const chartConfigPropType = PropTypes.objectOf(chartConfigItemPropType)

const chartPayloadItemPropType = PropTypes.shape({
  color: PropTypes.string,
  dataKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  fill: PropTypes.string,
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  payload: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
})

ChartContainer.propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
  config: chartConfigPropType.isRequired,
}

ChartStyle.propTypes = {
  id: PropTypes.string.isRequired,
  config: chartConfigPropType.isRequired,
}

ChartTooltipContent.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(chartPayloadItemPropType),
  className: PropTypes.string,
  indicator: PropTypes.oneOf(["dot", "line", "dashed"]),
  hideLabel: PropTypes.bool,
  hideIndicator: PropTypes.bool,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.node]),
  labelFormatter: PropTypes.func,
  labelClassName: PropTypes.string,
  formatter: PropTypes.func,
  color: PropTypes.string,
  nameKey: PropTypes.string,
  labelKey: PropTypes.string,
}

ChartLegendContent.propTypes = {
  className: PropTypes.string,
  hideIcon: PropTypes.bool,
  payload: PropTypes.arrayOf(chartPayloadItemPropType),
  verticalAlign: PropTypes.oneOf(["top", "bottom", "middle"]),
  nameKey: PropTypes.string,
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
