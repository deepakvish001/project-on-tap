// Route-level statistics for the Route Intelligence module.
// Passenger traffic figures are illustrative DGCA-style values; index values are APIx calculated.

import { ROUTES, routeTable, type RouteRow } from "@/lib/apix-data";

export type City = { code: string; name: string; lat: number; lon: number };

export const CITIES: City[] = [
  { code: "DEL", name: "Delhi", lat: 28.61, lon: 77.21 },
  { code: "BOM", name: "Mumbai", lat: 19.08, lon: 72.88 },
  { code: "BLR", name: "Bengaluru", lat: 12.97, lon: 77.59 },
  { code: "CCU", name: "Kolkata", lat: 22.57, lon: 88.36 },
  { code: "HYD", name: "Hyderabad", lat: 17.39, lon: 78.49 },
  { code: "MAA", name: "Chennai", lat: 13.08, lon: 80.27 },
  { code: "GOI", name: "Goa", lat: 15.38, lon: 73.83 },
  { code: "PNQ", name: "Pune", lat: 18.52, lon: 73.86 },
  { code: "AMD", name: "Ahmedabad", lat: 23.02, lon: 72.57 },
];

export const TOTAL_TRAFFIC = 152_400_000; // annual domestic passengers (DGCA)

export const INDIA_OUTLINE: [number, number][] = [
  [68.9, 23.7], [70.0, 20.8], [72.8, 19.1], [73.5, 15.9], [75.0, 12.0],
  [77.5, 8.1], [80.3, 13.1], [80.2, 16.0], [84.8, 19.1], [87.0, 21.6],
  [88.9, 21.7], [89.0, 25.3], [92.0, 24.0], [94.6, 27.0], [96.0, 27.5],
  [97.4, 28.2], [95.0, 29.0], [92.0, 27.5], [88.9, 27.3], [85.0, 27.5],
  [81.0, 30.3], [78.9, 31.5], [76.0, 32.5], [74.3, 34.7], [73.9, 32.8],
  [71.0, 29.0], [70.0, 25.5], [68.9, 23.7],
];

export const MAP_WIDTH = 620;
export const MAP_HEIGHT = 660;

const LON_MIN = 67.5;
const LON_MAX = 98.5;
const LAT_MIN = 6.5;
const LAT_MAX = 36.5;

export function project(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_WIDTH,
    y: MAP_HEIGHT - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_HEIGHT,
  };
}

export type RouteIntel = RouteRow & {
  code: string;
  origin: string;
  destination: string;
  traffic: number;
  share: number;
  baseFare: number;
  contribution: number;
};

export function routeIntel(airlineCode: string): RouteIntel[] {
  const rows = routeTable(airlineCode);
  return rows.map((row, i) => {
    const meta = ROUTES.filter((r) => r.code !== "ALL")[i]!;
    const [origin, destination] = meta.code.split("-") as [string, string];
    const traffic = Math.round((row.weight / 100) * TOTAL_TRAFFIC);
    return {
      ...row,
      code: meta.code,
      origin,
      destination,
      traffic,
      share: row.weight,
      baseFare: Math.round((row.avgFare / (row.index / 100)) / 10) * 10,
      contribution: Math.round(row.index * (row.weight / 100) * 100) / 100,
    };
  });
}

export function cityOf(code: string): City | undefined {
  return CITIES.find((c) => c.code === code);
}

export function formatTraffic(value: number) {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(1)} Lakh`;
  return value.toLocaleString("en-IN");
}
