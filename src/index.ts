#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
  detailedForecast?: string;
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event ?? "Unknown"}`,
    `Area: ${props.areaDesc ?? "Unknown"}`,
    `Severity: ${props.severity ?? "Unknown"}`,
    `Status: ${props.status ?? "Unknown"}`,
    `Headline: ${props.headline ?? "No headline"}`,
    "---",
  ].join("\n");
}

const server = new McpServer({
  name: "weather",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "get_alerts",
  "Get weather alerts for a state",
  {
    state: z
      .string()
      .length(2)
      .transform((value) => value.toUpperCase())
      .describe("Two-letter state code (e.g. CA, NY)"),
  },
  async ({ state }) => {
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${state}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    if (!alertsData) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Failed to retrieve alerts data.",
          },
        ],
      };
    }

    const features = alertsData.features ?? [];
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No active alerts for ${state}.`,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlert).join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `Active alerts for ${state}:\n\n${formattedAlerts}`,
        },
      ],
    };
  }
);

server.tool(
  "get_forecast",
  "Get weather forecast for a location",
  {
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .describe("Latitude of the location"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("Longitude of the location"),
  },
  async ({ latitude, longitude }) => {
    const lat = latitude.toFixed(4);
    const lon = longitude.toFixed(4);
    const pointsUrl = `${NWS_API_BASE}/points/${lat},${lon}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData || !pointsData.properties?.forecast) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}.`,
          },
        ],
      };
    }

    const forecastData = await makeNWSRequest<ForecastResponse>(pointsData.properties.forecast);

    if (!forecastData) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Failed to retrieve forecast data.",
          },
        ],
      };
    }

    const periods = forecastData.properties?.periods ?? [];
    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No forecast periods available.",
          },
        ],
      };
    }

    const formattedForecast = periods.slice(0, 5).map((period) =>
      [
        `${period.name ?? "Unknown"}:`,
        `Temperature: ${period.temperature ?? "Unknown"}°${period.temperatureUnit ?? "F"}`,
        `Wind: ${period.windSpeed ?? "Unknown"} ${period.windDirection ?? ""}`.trim(),
        `${period.detailedForecast ?? period.shortForecast ?? "No forecast available."}`,
        "---",
      ].join("\n")
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exitCode = 1;
});
