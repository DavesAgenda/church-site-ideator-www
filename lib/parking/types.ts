// lib/parking/types.ts
// Pure data types for the parking solver. No Leaflet, no DOM. Importable from
// both the solver and the renderer.

export type BayType = "standard" | "accessible";

export interface Bay {
  x: number; // metres from placement SW corner (local)
  y: number;
  w: number; // metres (along the aisle direction)
  h: number; // metres (along the row depth direction)
  type: BayType;
}

export type AisleOrientation = "h" | "v";

export interface Aisle {
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: AisleOrientation;
}

export interface Access {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SolverSummary {
  totalBays: number;
  standardBays: number;
  accessibleBays: number;
  grossAreaM2: number;
  /** bays per 100m^2 */
  efficiency: number;
}

export interface ParkingLayout {
  bays: Bay[];
  aisles: Aisle[];
  access: Access[];
  summary: SolverSummary;
  warnings: string[];
  /** Layout style used: "two-row" | "single-row" | "none". Useful for UI. */
  style: "two-row" | "single-row" | "none";
}

export interface SolverBounds {
  widthM: number;
  lengthM: number;
}

export interface SolverOptions {
  landscapingFraction?: number;
}
