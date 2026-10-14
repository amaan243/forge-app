import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Layers,
  Sparkles,
  RotateCcw,
  Play,
  Pause,
  ShieldCheck,
  GitBranch,
  Network,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Compass,
  Radio,
  Database,
  Maximize2,
  X,
  Zap,
  Globe2,
  FileCode,
  FileText,
  Share2,
  Activity,
} from "lucide-react";

export interface PlanetWorld {
  id: string;
  name: string;
  shortLabel: string;
  category: "core" | "gateway" | "services" | "data" | "events" | "intelligence" | "drift" | "quality" | "requirements";
  role: string;
  protocol: string;
  port: number;
  health: "verified" | "warning" | "active";
  // Realistic Independent Orbital Mechanics
  semiMajorAxis: number; // a
  eccentricity: number;   // e
  inclination: number;    // i (tilt in radians)
  longitudeOfAscendingNode: number; // Ω (plane orientation in radians)
  initialPhase: number;   // M0 (independent starting angle in radians)
  angularVelocity: number;// n (orbital speed in radians per second)
  axialTilt: number;      // tilt of planet's pole
  axialRotationSpeed: number; // spin rate
  size: number;
  colorHex: number;
  emissiveHex: number;
  explodedPosition: [number, number, number];
  connections: string[];
  sla: string;
  description: string;
  codeMapping: string;
}

// 8 Distinct Worlds + Central Hub with INDEPENDENT, INCOMMENSURATE ORBITS
export const PLANET_WORLDS: PlanetWorld[] = [
  {
    id: "arch-core",
    name: "Architecture Core Hub",
    shortLabel: "ARCH CORE",
    category: "core",
    role: "Central Computational Nucleus & Topology Dispatcher",
    protocol: "Kernel / IPC",
    port: 8080,
    health: "active",
    semiMajorAxis: 0,
    eccentricity: 0,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    initialPhase: 0,
    angularVelocity: 0,
    axialTilt: 0.1,
    axialRotationSpeed: 0.25,
    size: 1.18,
    colorHex: 0x00f0ff,
    emissiveHex: 0x0284c7,
    explodedPosition: [0, 0.4, 0],
    connections: ["requirements-world", "api-gateway", "microservices-world", "database-world", "event-stream", "repo-intel", "quality-world"],
    sla: "Core Kernel Online",
    description: "The gravitational center of ArchForge. Coordinates specifications, topology graph states, and telemetry.",
    codeMapping: "backend/src/services/architecture-service.ts",
  },
  {
    id: "requirements-world",
    name: "Requirements World",
    shortLabel: "REQUIREMENTS",
    category: "requirements",
    role: "Structured Specifications & Constraint Store",
    protocol: "Schema / JSON",
    port: 8001,
    health: "verified",
    semiMajorAxis: 3.8,
    eccentricity: 0.08,
    inclination: 0.26,
    longitudeOfAscendingNode: 0.45,
    initialPhase: 0.85, // Quadrant 1 (Foreground Right)
    angularVelocity: 0.26,
    axialTilt: 0.15,
    axialRotationSpeed: 0.4,
    size: 0.88,
    colorHex: 0xfbbf24,
    emissiveHex: 0xb45309,
    explodedPosition: [-4.2, 2.2, 1.2],
    connections: ["arch-core", "api-gateway"],
    sla: "Versioned Specs",
    description: "Layered document planet with orbiting specification panels. Encodes functional goals, SLAs, and security boundaries.",
    codeMapping: "backend/src/api/requirements.ts",
  },
  {
    id: "api-gateway",
    name: "API Gateway World",
    shortLabel: "API GATEWAY",
    category: "gateway",
    role: "Edge Ingress, TLS Termination & Routing Rings",
    protocol: "HTTP/2 / TLS 1.3",
    port: 8443,
    health: "verified",
    semiMajorAxis: 5.4,
    eccentricity: 0.05,
    inclination: -0.22,
    longitudeOfAscendingNode: 2.15,
    initialPhase: 3.42, // Quadrant 3 (Background Left)
    angularVelocity: 0.19,
    axialTilt: 0.28,
    axialRotationSpeed: 0.6,
    size: 0.98,
    colorHex: 0x00f0ff,
    emissiveHex: 0x0284c7,
    explodedPosition: [0, 2.8, 1.6],
    connections: ["microservices-world", "arch-core"],
    sla: "< 6ms p99 latency",
    description: "Cyan planetary sphere encircled by an energetic Ingress Ring. Filters incoming traffic, terminates TLS, and enforces rate limits.",
    codeMapping: "backend/src/routes/api.ts",
  },
  {
    id: "microservices-world",
    name: "Microservices Cluster World",
    shortLabel: "MICROSERVICES",
    category: "services",
    role: "Application Service Mesh & Compute Cluster",
    protocol: "gRPC / Protobuf",
    port: 8082,
    health: "verified",
    semiMajorAxis: 7.1,
    eccentricity: 0.11,
    inclination: 0.16,
    longitudeOfAscendingNode: 4.25,
    initialPhase: 1.95, // Quadrant 2 (Background Right)
    angularVelocity: 0.145,
    axialTilt: 0.2,
    axialRotationSpeed: 0.35,
    size: 1.08,
    colorHex: 0xf59e0b,
    emissiveHex: 0x92400e,
    explodedPosition: [-3.2, 0.4, 0.4],
    connections: ["database-world", "event-stream", "repo-intel"],
    sla: "Zero-Trust Mesh",
    description: "Multi-body planetary system with a central application core and smaller satellite service moonlets orbiting in tandem.",
    codeMapping: "backend/src/controllers/auth-controller.ts",
  },
  {
    id: "event-stream",
    name: "Event Stream World (Kafka)",
    shortLabel: "EVENT MESH",
    category: "events",
    role: "Durable Event Mesh & Asynchronous Pulse Stream",
    protocol: "Kafka 3.6 / TCP",
    port: 9092,
    health: "verified",
    semiMajorAxis: 8.8,
    eccentricity: 0.09,
    inclination: -0.28,
    longitudeOfAscendingNode: 1.15,
    initialPhase: 4.85, // Quadrant 4 (Foreground Left)
    angularVelocity: 0.112,
    axialTilt: 0.35,
    axialRotationSpeed: 0.5,
    size: 0.92,
    colorHex: 0xa855f7,
    emissiveHex: 0x6b21a8,
    explodedPosition: [-2.4, -1.8, -1.2],
    connections: ["database-world", "arch-core"],
    sla: "At-least-once delivery",
    description: "Violet planet surrounded by concentric signal rings emitting periodic telemetry waves through the system.",
    codeMapping: "backend/src/services/audit-service.ts",
  },
  {
    id: "database-world",
    name: "Database & Graph World",
    shortLabel: "GRAPH & DB",
    category: "data",
    role: "ACID Relational Spec Store & Graph Platters",
    protocol: "PostgreSQL 16",
    port: 5432,
    health: "verified",
    semiMajorAxis: 10.5,
    eccentricity: 0.14,
    inclination: 0.34,
    longitudeOfAscendingNode: 5.65,
    initialPhase: 0.25, // Far Right, Midground
    angularVelocity: 0.088,
    axialTilt: 0.12,
    axialRotationSpeed: 0.25,
    size: 1.18,
    colorHex: 0x10b981,
    emissiveHex: 0x047857,
    explodedPosition: [1.2, -2.4, -2.0],
    connections: ["quality-world"],
    sla: "RPO: 0 / RTO: < 30s",
    description: "Emerald layered planet with visible data rings and magnetic latitude bands storing architecture lineages and entities.",
    codeMapping: "backend/src/models/architecture.ts",
  },
  {
    id: "repo-intel",
    name: "Repository Intelligence World",
    shortLabel: "REPO INTEL",
    category: "intelligence",
    role: "Source Codebase AST & Module Extractor",
    protocol: "gRPC",
    port: 8083,
    health: "verified",
    semiMajorAxis: 12.2,
    eccentricity: 0.07,
    inclination: -0.15,
    longitudeOfAscendingNode: 3.05,
    initialPhase: 2.75, // Far Left, Midground
    angularVelocity: 0.071,
    axialTilt: 0.22,
    axialRotationSpeed: 0.38,
    size: 0.9,
    colorHex: 0x3b82f6,
    emissiveHex: 0x1d4ed8,
    explodedPosition: [4.2, 0.8, 0.6],
    connections: ["drift-world", "quality-world"],
    sla: "AST Sync < 1.2s",
    description: "Deep azure celestial world with miniature orbiting Git commit nodes extracting snapshot routes, modules, and dependencies.",
    codeMapping: "backend/src/services/workspace-service.ts",
  },
  {
    id: "drift-world",
    name: "Impact & Drift World",
    shortLabel: "DRIFT RADAR",
    category: "drift",
    role: "Architecture Drift Radar & Blast Radius",
    protocol: "AST Comparator",
    port: 8085,
    health: "warning",
    semiMajorAxis: 13.8,
    eccentricity: 0.16,
    inclination: 0.22,
    longitudeOfAscendingNode: 0.85,
    initialPhase: 5.45, // Foreground Center-Right
    angularVelocity: 0.055,
    axialTilt: 0.42,
    axialRotationSpeed: 0.3,
    size: 0.92,
    colorHex: 0xf97316,
    emissiveHex: 0xc2410c,
    explodedPosition: [4.8, -0.6, -0.8],
    connections: ["quality-world"],
    sla: "Zero Undetected Drift",
    description: "Fiery amber world equipped with comparison radar rings highlighting discrepancies between intended design and observed code.",
    codeMapping: "backend/src/services/drift-service.ts",
  },
  {
    id: "quality-world",
    name: "Release Quality World",
    shortLabel: "RELEASE GATE",
    category: "quality",
    role: "Deterministic Release Verification & Gates",
    protocol: "HTTPS / Agent",
    port: 8090,
    health: "verified",
    semiMajorAxis: 15.4,
    eccentricity: 0.06,
    inclination: -0.18,
    longitudeOfAscendingNode: 4.75,
    initialPhase: 3.95, // Deep Space Background Center-Left
    angularVelocity: 0.042,
    axialTilt: 0.18,
    axialRotationSpeed: 0.32,
    size: 1.04,
    colorHex: 0x059669,
    emissiveHex: 0x065f46,
    explodedPosition: [3.4, -1.8, -1.4],
    connections: ["arch-core"],
    sla: "Deterministic Gates",
    description: "Radiant emerald world enveloped by a hexagonal verification shield that validates tests, security policies, and release readiness.",
    codeMapping: "backend/src/services/workflow-readiness-service.ts",
  },
];

export const WORKFLOW_STAGES = [
  { id: "requirements", number: "01", name: "Requirements", desc: "Specifications enter the gravitational orbit of the system.", accent: "#F59E0B" },
  { id: "architecture", number: "02", name: "Architecture Assembly", desc: "The central core coordinates microservices and ingress.", accent: "#38BDF8" },
  { id: "repository", number: "03", name: "Repository Analysis", desc: "Codebase ASTs synchronize with architecture entities.", accent: "#818CF8" },
  { id: "drift", number: "04", name: "Impact & Drift", desc: "Radar rings flag discrepancies between design and code.", accent: "#F97316" },
  { id: "readiness", number: "05", name: "Release Readiness", desc: "Quality shield validates tests and release criteria.", accent: "#10B981" },
];

export type VisualMode = "orbit" | "exploded" | "dataflow" | "quality";

/**
 * Mathematically calculate real 3D elliptical position in space:
 * 1. Calculate 2D Keplerian coordinates in orbital plane:
 *    theta = M0 + omega * time
 *    r = a * (1 - e^2) / (1 + e * cos(theta))
 * 2. Rotate by orbital inclination (i) around local axis
 * 3. Rotate by longitude of ascending node (Omega) around world Y axis
 */
function computeKeplerianOrbitalPosition(world: PlanetWorld, time: number): THREE.Vector3 {
  if (world.semiMajorAxis === 0) {
    return new THREE.Vector3(0, 0, 0);
  }

  const a = world.semiMajorAxis;
  const e = world.eccentricity;
  const i = world.inclination;
  const Omega = world.longitudeOfAscendingNode;
  const theta = world.initialPhase + world.angularVelocity * time;

  // 2D radius along ellipse
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));

  // 2D position in orbital plane
  const xOrb = r * Math.cos(theta);
  const zOrb = r * Math.sin(theta);

  // Tilt by inclination i
  const xPrime = xOrb;
  const yPrime = -zOrb * Math.sin(i);
  const zPrime = zOrb * Math.cos(i);

  // Rotate by longitude of ascending node Omega around Y
  const xWorld = xPrime * Math.cos(Omega) - zPrime * Math.sin(Omega);
  const yWorld = yPrime;
  const zWorld = xPrime * Math.sin(Omega) + zPrime * Math.cos(Omega);

  return new THREE.Vector3(xWorld, yWorld, zWorld);
}

/**
 * Generate a complete 3D curve matching the planet's exact trajectory
 */
function generateOrbitTrajectoryCurve(world: PlanetWorld, segments = 128): THREE.Vector3[] {
  if (world.semiMajorAxis === 0) return [];
  const points: THREE.Vector3[] = [];
  const a = world.semiMajorAxis;
  const e = world.eccentricity;
  const i = world.inclination;
  const Omega = world.longitudeOfAscendingNode;

  for (let s = 0; s <= segments; s++) {
    const theta = (s / segments) * Math.PI * 2;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));

    const xOrb = r * Math.cos(theta);
    const zOrb = r * Math.sin(theta);

    const xPrime = xOrb;
    const yPrime = -zOrb * Math.sin(i);
    const zPrime = zOrb * Math.cos(i);

    const xWorld = xPrime * Math.cos(Omega) - zPrime * Math.sin(Omega);
    const yWorld = yPrime;
    const zWorld = xPrime * Math.sin(Omega) + zPrime * Math.cos(Omega);

    points.push(new THREE.Vector3(xWorld, yWorld, zWorld));
  }
  return points;
}

/**
 * PROCEDURAL CANVAS TEXTURE GENERATORS
 * Creates realistic planetary diffuse, bump, and emissive maps directly in memory.
 */
function createProceduralPlanetMaps(category: string, baseHex: number, accentHex: number) {
  const W = 512;
  const H = 256;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bumpCtx = bumpCanvas.getContext("2d")!;

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = W;
  roughnessCanvas.height = H;
  const roughCtx = roughnessCanvas.getContext("2d")!;

  const emissiveCanvas = document.createElement("canvas");
  emissiveCanvas.width = W;
  emissiveCanvas.height = H;
  const emisCtx = emissiveCanvas.getContext("2d")!;

  // Default canvas baselines
  bumpCtx.fillStyle = "#333333";
  bumpCtx.fillRect(0, 0, W, H);

  roughCtx.fillStyle = "#888888";
  roughCtx.fillRect(0, 0, W, H);

  emisCtx.fillStyle = "#000000";
  emisCtx.fillRect(0, 0, W, H);

  switch (category) {
    case "core": {
      // High-Tech Quantum Computational Core: Silicon Nanophotonic Die
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#030712");
      bgGrad.addColorStop(0.5, "#0b1329");
      bgGrad.addColorStop(1, "#030712");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Micro-grid silicon wafer pattern
      ctx.strokeStyle = "rgba(30, 58, 102, 0.35)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Semiconductor Logic Blocks
      const dies = [
        { x: 24, y: 28, w: 96, h: 64 },
        { x: 152, y: 28, w: 84, h: 64 },
        { x: 268, y: 28, w: 96, h: 64 },
        { x: 396, y: 28, w: 84, h: 64 },
        { x: 24, y: 164, w: 84, h: 64 },
        { x: 140, y: 164, w: 96, h: 64 },
        { x: 268, y: 164, w: 84, h: 64 },
        { x: 384, y: 164, w: 96, h: 64 },
      ];

      dies.forEach((die, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? "#0f172a" : "#0c1a30";
        ctx.fillRect(die.x, die.y, die.w, die.h);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(die.x, die.y, die.w, die.h);

        for (let ix = die.x + 8; ix < die.x + die.w - 8; ix += 14) {
          for (let iy = die.y + 8; iy < die.y + die.h - 8; iy += 14) {
            ctx.fillStyle = (ix + iy) % 28 === 0 ? "#00f0ff" : "#1e293b";
            ctx.fillRect(ix, iy, 8, 8);
          }
        }
      });

      // Waveguide busses
      const busLines = [114, 128, 142];
      busLines.forEach((y, bIdx) => {
        ctx.strokeStyle = bIdx === 1 ? "#ffffff" : "#00f0ff";
        ctx.lineWidth = bIdx === 1 ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      });

      // Interconnect tracks
      ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
      ctx.lineWidth = 1.5;
      for (let x = 48; x < W; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 92);
        ctx.lineTo(x + 16, 114);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 16, 142);
        ctx.lineTo(x, 164);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + 16, 114, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 16, 142, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bump: Silicon etching
      bumpCtx.fillStyle = "#111111";
      bumpCtx.fillRect(0, 0, W, H);
      dies.forEach((die) => {
        bumpCtx.fillStyle = "#555555";
        bumpCtx.fillRect(die.x, die.y, die.w, die.h);
        bumpCtx.fillStyle = "#ffffff";
        bumpCtx.strokeRect(die.x + 2, die.y + 2, die.w - 4, die.h - 4);
      });
      busLines.forEach((y) => {
        bumpCtx.strokeStyle = "#ffffff";
        bumpCtx.lineWidth = 2;
        bumpCtx.beginPath();
        bumpCtx.moveTo(0, y);
        bumpCtx.lineTo(W, y);
        bumpCtx.stroke();
      });

      // Roughness: Silicon mirror sheen
      roughCtx.fillStyle = "#1e293b";
      roughCtx.fillRect(0, 0, W, H);

      // Emissive: Laser circuits
      emisCtx.strokeStyle = "#00f0ff";
      emisCtx.lineWidth = 2;
      busLines.forEach((y) => {
        emisCtx.beginPath();
        emisCtx.moveTo(0, y);
        emisCtx.lineTo(W, y);
        emisCtx.stroke();
      });
      break;
    }

    case "gateway": {
      // API Ingress: Photorealistic Azure Ocean Exoplanet with Continental Archipelagos & Coriolis Clouds
      // Deep sapphire ocean gradient
      const oGrad = ctx.createLinearGradient(0, 0, W, H);
      oGrad.addColorStop(0, "#031d33");
      oGrad.addColorStop(0.5, "#074067");
      oGrad.addColorStop(1, "#031d33");
      ctx.fillStyle = oGrad;
      ctx.fillRect(0, 0, W, H);

      // Continental Landmasses
      ctx.fillStyle = "#0d5c75";
      const continents = [
        { cx: 120, cy: 90, rx: 65, ry: 35 },
        { cx: 280, cy: 140, rx: 80, ry: 45 },
        { cx: 420, cy: 80, rx: 55, ry: 30 },
        { cx: 80, cy: 190, rx: 50, ry: 25 },
        { cx: 360, cy: 200, rx: 70, ry: 35 },
      ];
      continents.forEach((c) => {
        ctx.beginPath();
        ctx.ellipse(c.cx, c.cy, c.rx, c.ry, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Coastlines
        ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bump for continents
        bumpCtx.fillStyle = "#666666";
        bumpCtx.beginPath();
        bumpCtx.ellipse(c.cx, c.cy, c.rx - 4, c.ry - 4, 0.2, 0, Math.PI * 2);
        bumpCtx.fill();

        // Roughness: Land is matte
        roughCtx.fillStyle = "#888888";
        roughCtx.beginPath();
        roughCtx.ellipse(c.cx, c.cy, c.rx, c.ry, 0.2, 0, Math.PI * 2);
        roughCtx.fill();
      });

      // Roughness: Oceans are specular
      roughCtx.fillStyle = "rgba(20, 20, 20, 0.7)";
      roughCtx.fillRect(0, 0, W, H);

      // Swirling Coriolis Clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      for (let i = 0; i < 22; i++) {
        const cx = (i * 38 + 15) % W;
        const cy = 25 + (i * 18) % (H - 50);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 75, 14, 0.15, 0, Math.PI * 2);
        ctx.fill();

        bumpCtx.fillStyle = "rgba(200, 200, 200, 0.25)";
        bumpCtx.beginPath();
        bumpCtx.ellipse(cx, cy, 75, 14, 0.15, 0, Math.PI * 2);
        bumpCtx.fill();
      }

      // Emissive: Equatorial Gateway Ingress Conduit & Coastal Cities
      emisCtx.strokeStyle = "#00f0ff";
      emisCtx.lineWidth = 4;
      emisCtx.beginPath();
      emisCtx.moveTo(0, 128);
      emisCtx.lineTo(W, 128);
      emisCtx.stroke();

      emisCtx.fillStyle = "#ffffff";
      for (let x = 32; x < W; x += 48) {
        emisCtx.beginPath();
        emisCtx.arc(x, 128, 3, 0, Math.PI * 2);
        emisCtx.fill();
      }
      break;
    }

    case "data": {
      // Database & Graph World: Crystalline Emerald Strata & Subterranean Data Rivers
      for (let y = 0; y < H; y += 12) {
        ctx.fillStyle = (y / 12) % 2 === 0 ? "#022c22" : "#064e3b";
        ctx.fillRect(0, y, W, 12);
        bumpCtx.fillStyle = (y / 12) % 2 === 0 ? "#222222" : "#888888";
        bumpCtx.fillRect(0, y, W, 12);
      }

      // Jade Tectonic Shelves
      ctx.fillStyle = "#047857";
      for (let i = 0; i < 12; i++) {
        const x = (i * 54) % W;
        const y = 30 + (i * 22) % (H - 60);
        ctx.fillRect(x, y, 48, 20);
        bumpCtx.fillStyle = "#ffffff";
        bumpCtx.strokeRect(x, y, 48, 20);
      }

      // Roughness: Mineral Crystal
      roughCtx.fillStyle = "#444444";
      roughCtx.fillRect(0, 0, W, H);

      // Emissive: Subterranean Data Conduits
      emisCtx.strokeStyle = "#10b981";
      emisCtx.lineWidth = 2.5;
      for (let y = 16; y < H; y += 32) {
        emisCtx.beginPath();
        emisCtx.moveTo(0, y);
        emisCtx.lineTo(W, y);
        emisCtx.stroke();
      }
      emisCtx.fillStyle = "#34d399";
      for (let x = 24; x < W; x += 64) {
        for (let y = 16; y < H; y += 32) {
          emisCtx.beginPath();
          emisCtx.arc(x, y, 3, 0, Math.PI * 2);
          emisCtx.fill();
        }
      }
      break;
    }

    case "services": {
      // Microservices World: Rocky Lunar Basalt + Geodesic Domes
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, W, H);

      // Basalt Terrain Variations
      ctx.fillStyle = "#334155";
      for (let i = 0; i < 30; i++) {
        const x = (i * 42) % W;
        const y = (i * 28) % H;
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      // Impact Craters with Ejecta Rims
      const craters = [
        { cx: 70, cy: 60, r: 22 },
        { cx: 210, cy: 110, r: 32 },
        { cx: 380, cy: 75, r: 26 },
        { cx: 140, cy: 180, r: 28 },
        { cx: 310, cy: 200, r: 20 },
        { cx: 460, cy: 160, r: 25 },
      ];

      craters.forEach((cr) => {
        // Crater floor
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(cr.cx, cr.cy, cr.r, 0, Math.PI * 2);
        ctx.fill();

        // Rim bump
        bumpCtx.fillStyle = "#111111";
        bumpCtx.beginPath();
        bumpCtx.arc(cr.cx, cr.cy, cr.r, 0, Math.PI * 2);
        bumpCtx.fill();
        bumpCtx.strokeStyle = "#ffffff";
        bumpCtx.lineWidth = 3;
        bumpCtx.stroke();
      });

      // Roughness: Regolith is dry and matte
      roughCtx.fillStyle = "#cccccc";
      roughCtx.fillRect(0, 0, W, H);

      // Emissive: Geodesic Microservice Domes & Amber Surface Pipelines
      emisCtx.fillStyle = "#fbbf24";
      emisCtx.strokeStyle = "#f59e0b";
      emisCtx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        const dx = (i * 52 + 20) % W;
        const dy = 30 + (i * 24) % (H - 60);
        emisCtx.beginPath();
        emisCtx.arc(dx, dy, 4, 0, Math.PI * 2);
        emisCtx.fill();

        if (i % 2 === 0) {
          emisCtx.beginPath();
          emisCtx.moveTo(dx, dy);
          emisCtx.lineTo(dx + 30, dy + 15);
          emisCtx.stroke();
        }
      }
      break;
    }

    case "events": {
      // Event Stream World: Jovian Violet Gas Giant with Atmospheric Wind Belts
      const gGrad = ctx.createLinearGradient(0, 0, 0, H);
      gGrad.addColorStop(0, "#2e1065");
      gGrad.addColorStop(0.25, "#581c87");
      gGrad.addColorStop(0.5, "#7e22ce");
      gGrad.addColorStop(0.75, "#3b0764");
      gGrad.addColorStop(1, "#1e0538");
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, 0, W, H);

      // Turbulent wind shear lines
      ctx.strokeStyle = "rgba(192, 132, 252, 0.45)";
      ctx.lineWidth = 2;
      for (let y = 16; y < H; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(W * 0.3, y - 8, W * 0.7, y + 8, W, y);
        ctx.stroke();

        bumpCtx.strokeStyle = "#888888";
        bumpCtx.lineWidth = 2;
        bumpCtx.stroke();
      }

      // Cyclone Storm Spot
      ctx.fillStyle = "#c084fc";
      ctx.beginPath();
      ctx.ellipse(340, 145, 36, 18, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Roughness: Gaseous Fluid
      roughCtx.fillStyle = "#333333";
      roughCtx.fillRect(0, 0, W, H);

      // Emissive: Equatorial Synchrotron Resonance Ring
      emisCtx.strokeStyle = "#a855f7";
      emisCtx.lineWidth = 4;
      emisCtx.beginPath();
      emisCtx.moveTo(0, 128);
      emisCtx.lineTo(W, 128);
      emisCtx.stroke();

      emisCtx.fillStyle = "#e9d5ff";
      emisCtx.beginPath();
      emisCtx.ellipse(340, 145, 14, 8, 0.1, 0, Math.PI * 2);
      emisCtx.fill();
      break;
    }

    case "intelligence": {
      // Repo Intel World: Deep Azure Oceanic Planet with Digital AST Fiber Grid
      const aGrad = ctx.createLinearGradient(0, 0, W, H);
      aGrad.addColorStop(0, "#0b1329");
      aGrad.addColorStop(0.5, "#1e3a8a");
      aGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = aGrad;
      ctx.fillRect(0, 0, W, H);

      // Polar Ice Caps
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(0, 0, W, 22);
      ctx.fillRect(0, H - 22, W, 22);

      // Submerged trenches
      bumpCtx.fillStyle = "#222222";
      bumpCtx.fillRect(0, 0, W, H);
      bumpCtx.fillStyle = "#ffffff";
      bumpCtx.fillRect(0, 0, W, 22);
      bumpCtx.fillRect(0, H - 22, W, 22);

      // Roughness: Reflective Deep Ocean
      roughCtx.fillStyle = "#222222";
      roughCtx.fillRect(0, 0, W, H);

      // Emissive: AST Repository Commit Node Hubs & Vector Highways
      emisCtx.strokeStyle = "#38bdf8";
      emisCtx.lineWidth = 1.5;
      for (let x = 0; x < W; x += 36) {
        emisCtx.beginPath();
        emisCtx.moveTo(x, 26);
        emisCtx.lineTo(x, H - 26);
        emisCtx.stroke();
      }
      for (let y = 30; y < H - 26; y += 36) {
        emisCtx.beginPath();
        emisCtx.moveTo(0, y);
        emisCtx.lineTo(W, y);
        emisCtx.stroke();
      }

      emisCtx.fillStyle = "#ffffff";
      for (let x = 0; x < W; x += 72) {
        for (let y = 30; y < H - 26; y += 72) {
          emisCtx.beginPath();
          emisCtx.arc(x, y, 3, 0, Math.PI * 2);
          emisCtx.fill();
        }
      }
      break;
    }

    case "drift": {
      // Drift Radar: Volcanic Tectonic Planet with Magma Fissures
      ctx.fillStyle = "#451a03";
      ctx.fillRect(0, 0, W, H);

      // Iron-oxide highlands
      ctx.fillStyle = "#7c2d12";
      for (let i = 0; i < 25; i++) {
        const x = (i * 44) % W;
        const y = (i * 26) % H;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tectonic Fracture Chasms
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 70);
      ctx.bezierCurveTo(150, 40, 320, 160, W, 90);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 170);
      ctx.bezierCurveTo(180, 210, 360, 110, W, 190);
      ctx.stroke();

      bumpCtx.fillStyle = "#666666";
      bumpCtx.fillRect(0, 0, W, H);
      bumpCtx.fillStyle = "#000000";
      bumpCtx.lineWidth = 6;
      bumpCtx.beginPath();
      bumpCtx.moveTo(0, 70);
      bumpCtx.bezierCurveTo(150, 40, 320, 160, W, 90);
      bumpCtx.stroke();

      // Roughness: Dry volcanic ash
      roughCtx.fillStyle = "#bbbbbb";
      roughCtx.fillRect(0, 0, W, H);

      // Emissive: Active Magma Fissures & Radar Beacons
      emisCtx.strokeStyle = "#f97316";
      emisCtx.lineWidth = 2.5;
      emisCtx.beginPath();
      emisCtx.moveTo(0, 70);
      emisCtx.bezierCurveTo(150, 40, 320, 160, W, 90);
      emisCtx.stroke();
      emisCtx.beginPath();
      emisCtx.moveTo(0, 170);
      emisCtx.bezierCurveTo(180, 210, 360, 110, W, 190);
      emisCtx.stroke();
      break;
    }

    default: {
      // Quality / Requirements: Emerald Terraformed World / Golden Sedimentary Plateaus
      const isQual = category === "quality";
      ctx.fillStyle = isQual ? "#022c22" : "#78350f";
      ctx.fillRect(0, 0, W, H);

      // Continents / Strata
      ctx.fillStyle = isQual ? "#047857" : "#b45309";
      for (let i = 0; i < 18; i++) {
        const x = (i * 48) % W;
        const y = 30 + (i * 22) % (H - 50);
        ctx.beginPath();
        ctx.ellipse(x, y, 60, 24, 0.2, 0, Math.PI * 2);
        ctx.fill();

        bumpCtx.fillStyle = "#888888";
        bumpCtx.beginPath();
        bumpCtx.ellipse(x, y, 60, 24, 0.2, 0, Math.PI * 2);
        bumpCtx.fill();
      }

      // Clouds for Quality world
      if (isQual) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        for (let i = 0; i < 16; i++) {
          const x = (i * 44 + 20) % W;
          const y = 20 + (i * 18) % (H - 40);
          ctx.beginPath();
          ctx.ellipse(x, y, 70, 12, 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      roughCtx.fillStyle = isQual ? "#444444" : "#999999";
      roughCtx.fillRect(0, 0, W, H);

      emisCtx.strokeStyle = isQual ? "#10b981" : "#fbbf24";
      emisCtx.lineWidth = 2;
      for (let x = 20; x < W; x += 50) {
        emisCtx.strokeRect(x, 40, 22, 160);
      }
      break;
    }
  }

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessTex = new THREE.CanvasTexture(roughnessCanvas);
  roughnessTex.wrapS = THREE.RepeatWrapping;
  roughnessTex.wrapT = THREE.ClampToEdgeWrapping;

  const emissiveTex = new THREE.CanvasTexture(emissiveCanvas);
  emissiveTex.wrapS = THREE.RepeatWrapping;
  emissiveTex.wrapT = THREE.ClampToEdgeWrapping;

  return { mapTex, bumpTex, roughnessTex, emissiveTex };
}

export function Architecture3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<PlanetWorld | null>(null);
  const [hoveredWorld, setHoveredWorld] = useState<PlanetWorld | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>("orbit");
  const [isOrbitPaused, setIsOrbitPaused] = useState<boolean>(false);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(1);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourIndex, setTourIndex] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [hudFps, setHudFps] = useState<number>(60);

  // Controller Interface
  const sceneController = useRef<{
    focusPlanet: (world: PlanetWorld | null) => void;
    resetView: () => void;
    fitSolarSystem: () => void;
    setVisualMode: (mode: VisualMode) => void;
    setStage: (idx: number) => void;
    toggleOrbit: () => void;
  } | null>(null);

  // Detect WebGL & Reduced Motion
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      setWebglSupported(Boolean(gl));
    } catch {
      setWebglSupported(false);
    }

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Guided Tour
  const TOUR_PLANETS = [
    "arch-core",
    "requirements-world",
    "api-gateway",
    "microservices-world",
    "event-stream",
    "database-world",
    "repo-intel",
    "drift-world",
    "quality-world",
  ];

  const handleTourStep = useCallback(
    (step: number) => {
      const targetId = TOUR_PLANETS[step];
      const world = PLANET_WORLDS.find((p) => p.id === targetId) || null;
      setSelectedWorld(world);
      sceneController.current?.focusPlanet(world);
      setTourIndex(step);
    },
    [TOUR_PLANETS]
  );

  const startTour = () => {
    setIsTourActive(true);
    handleTourStep(0);
  };

  const nextTour = () => {
    if (tourIndex < TOUR_PLANETS.length - 1) {
      handleTourStep(tourIndex + 1);
    } else {
      endTour();
    }
  };

  const prevTour = () => {
    if (tourIndex > 0) {
      handleTourStep(tourIndex - 1);
    }
  };

  const endTour = () => {
    setIsTourActive(false);
    setSelectedWorld(null);
    sceneController.current?.resetView();
  };

  // Main Three.js Lifecycle
  useEffect(() => {
    if (webglSupported === false || !containerRef.current) return;

    const container = containerRef.current;
    let width = container.clientWidth || 960;
    let height = container.clientHeight || 580;

    // 1. Scene, Camera, & Atmosphere
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.024);

    const isNarrow = width < 640;
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    // Cinematic camera framing adapted for narrow mobile screens & wide desktop
    const defaultCameraPos = new THREE.Vector3(0, isNarrow ? 18.0 : 13.0, isNarrow ? 32.0 : 21.0);
    const defaultLookAt = new THREE.Vector3(0, 0, 0);
    camera.position.copy(defaultCameraPos);
    camera.lookAt(defaultLookAt);

    // 2. High Dynamic Range Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglSupported(false);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrow ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 42;
    controls.minDistance = 3.2;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.target.copy(defaultLookAt);
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    // 4. PHYSICALLY COHERENT CINEMATIC LIGHTING
    // Ambient Light: calibrated for realistic day/night terminator lines while revealing dark-side details
    const ambientLight = new THREE.AmbientLight(0x0f172a, 0.95);
    scene.add(ambientLight);

    // Central Luminous Diamond-Cyan Light radiating outward from the Architecture Core Hub
    const corePointLight = new THREE.PointLight(0xa5f3fc, 4.8, 50, 1.1);
    corePointLight.position.set(0, 0, 0);
    scene.add(corePointLight);

    // Primary Key Directional Light (Warm White) with soft shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(24, 28, 20);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Cool Cyan Fill Light from opposite direction
    const coolFillLight = new THREE.DirectionalLight(0x0284c7, 1.35);
    coolFillLight.position.set(-20, -10, -16);
    scene.add(coolFillLight);

    // Subtle Cyan Rim Light from bottom
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(0, -18, 14);
    scene.add(rimLight);

    // 5. Multi-Layer Cosmic Starfield & Spatial Depth
    const nearStarCount = 380;
    const nearStarGeo = new THREE.BufferGeometry();
    const nearStarPos = new Float32Array(nearStarCount * 3);
    for (let i = 0; i < nearStarCount * 3; i += 3) {
      nearStarPos[i] = (Math.random() - 0.5) * 85;
      nearStarPos[i + 1] = (Math.random() - 0.5) * 60;
      nearStarPos[i + 2] = (Math.random() - 0.5) * 85;
    }
    nearStarGeo.setAttribute("position", new THREE.BufferAttribute(nearStarPos, 3));
    const nearStarMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.16,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(nearStarGeo, nearStarMat));

    const farStarCount = 650;
    const farStarGeo = new THREE.BufferGeometry();
    const farStarPos = new Float32Array(farStarCount * 3);
    for (let i = 0; i < farStarCount * 3; i += 3) {
      farStarPos[i] = (Math.random() - 0.5) * 160;
      farStarPos[i + 1] = (Math.random() - 0.5) * 120;
      farStarPos[i + 2] = (Math.random() - 0.5) * 160;
    }
    farStarGeo.setAttribute("position", new THREE.BufferAttribute(farStarPos, 3));
    const farStarMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.10,
      transparent: true,
      opacity: 0.35,
    });
    scene.add(new THREE.Points(farStarGeo, farStarMat));

    // 6. REFERENCES FOR CENTRAL ARCHITECTURE CORE SUB-SYSTEMS
    let innerCore: THREE.Mesh | null = null;
    let innerCoreMat: THREE.MeshStandardMaterial | null = null;
    let outerLattice: THREE.Mesh | null = null;
    let gimbal1: THREE.Mesh | null = null;
    let gimbal2: THREE.Mesh | null = null;
    let accelRing: THREE.Mesh | null = null;
    let fluxGroup: THREE.Group | null = null;

    // 7. BUILD INDEPENDENT 3D ORBIT PATHS & REALISTIC PLANET WORLDS
    const planetsMasterGroup = new THREE.Group();
    const orbitRingsGroup = new THREE.Group();

    // Helper: Crisp 3D Text Label Plate
    const createPlanetLabel = (title: string, sub: string, colorHex: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 96;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "rgba(6, 9, 19, 0.92)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 2;
      ctx.roundRect(4, 4, 376, 88, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = `#${colorHex.toString(16).padStart(6, "0")}`;
      ctx.fillRect(16, 4, 352, 4);

      ctx.font = "bold 26px 'Geist', 'Inter', sans-serif";
      ctx.fillStyle = "#F8FAFC";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, 192, 42);

      ctx.font = "bold 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(sub, 192, 72);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const geo = new THREE.PlaneGeometry(1.5, 0.38);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
      return new THREE.Mesh(geo, mat);
    };

    interface ActivePlanetState {
      group: THREE.Group;
      world: PlanetWorld;
      labelMesh: THREE.Mesh;
      meshCore: THREE.Mesh;
      satellites: THREE.Mesh[];
      pulseRings: THREE.Mesh[];
    }

    const activePlanets: ActivePlanetState[] = [];

    PLANET_WORLDS.forEach((world) => {
      // 1. Mathematical 3D Trajectory Curve (exact match to Keplerian path!)
      if (world.semiMajorAxis > 0) {
        const orbitPoints = generateOrbitTrajectoryCurve(world, 128);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({
          color: world.colorHex,
          transparent: true,
          opacity: 0.22,
        });
        const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
        orbitRingsGroup.add(orbitLine);
      }

      // 2. Planet Container Group
      const planetGroup = new THREE.Group();
      planetGroup.userData = { planetId: world.id };

      const satellites: THREE.Mesh[] = [];
      const pulseRings: THREE.Mesh[] = [];

      // Procedural textures with realistic bump/roughness/emissive
      const { mapTex, bumpTex, roughnessTex, emissiveTex } = createProceduralPlanetMaps(
        world.category,
        world.colorHex,
        world.emissiveHex
      );

      // Core Realistic Planet Sphere with PBR shading
      const isCore = world.category === "core";
      const sphereGeo = new THREE.SphereGeometry(world.size, 48, 48);
      const sphereMat = new THREE.MeshStandardMaterial({
        map: mapTex,
        bumpMap: bumpTex,
        bumpScale: isCore ? 0.035 : 0.045,
        roughnessMap: roughnessTex,
        roughness: isCore ? 0.18 : (world.category === "services" || world.category === "drift" ? 0.82 : 0.65),
        metalness: isCore ? 0.94 : (world.category === "data" ? 0.55 : 0.22),
        emissiveMap: emissiveTex,
        emissive: 0xffffff,
        emissiveIntensity: isCore ? 0.85 : 0.95,
        transparent: isCore,
        opacity: isCore ? 0.92 : 1.0,
      });
      const planetSphere = new THREE.Mesh(sphereGeo, sphereMat);
      planetSphere.castShadow = true;
      planetSphere.receiveShadow = true;
      planetGroup.add(planetSphere);

      // Atmospheric Rayleigh scattering rim shell for worlds with atmospheres
      if (["gateway", "quality", "intelligence", "events"].includes(world.category)) {
        const atmoGeo = new THREE.SphereGeometry(world.size * 1.045, 32, 32);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: world.colorHex,
          transparent: true,
          opacity: 0.22,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
        });
        const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
        planetGroup.add(atmoMesh);
      }

      // 3. Unique Architectural Silhouettes & Planetary Rings
      switch (world.category) {
        case "core": {
          // 1. Inner Glowing Quantum Singularity Nucleus
          const innerCoreGeo = new THREE.IcosahedronGeometry(0.72, 2);
          innerCoreMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 2.5,
            metalness: 0.8,
            roughness: 0.15,
          });
          innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
          planetGroup.add(innerCore);

          // 2. Inner Quantum Wireframe Lattice
          const latticeGeo = new THREE.OctahedronGeometry(0.86, 0);
          const latticeMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 1.2,
            wireframe: true,
          });
          outerLattice = new THREE.Mesh(latticeGeo, latticeMat);
          planetGroup.add(outerLattice);

          // 3. Inner Brushed Aerospace Titanium Gimbal Ring
          const gimbal1Geo = new THREE.TorusGeometry(1.52, 0.034, 16, 64);
          const gimbal1Mat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.95,
            roughness: 0.16,
          });
          gimbal1 = new THREE.Mesh(gimbal1Geo, gimbal1Mat);
          gimbal1.rotation.x = Math.PI / 3;

          // Inlaid neon optical guide
          const neonInlayGeo = new THREE.TorusGeometry(1.52, 0.012, 12, 64);
          const neonInlayMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
          const neonInlay = new THREE.Mesh(neonInlayGeo, neonInlayMat);
          gimbal1.add(neonInlay);

          // 4 miniature sensor pods at 90 deg intervals
          for (let p = 0; p < 4; p++) {
            const podGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
            const podMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
            const pod = new THREE.Mesh(podGeo, podMat);
            const podAngle = (p * Math.PI) / 2;
            pod.position.set(Math.cos(podAngle) * 1.52, Math.sin(podAngle) * 1.52, 0);
            gimbal1.add(pod);
          }
          planetGroup.add(gimbal1);

          // 4. Outer Counter-Precessing Gimbal Ring
          const gimbal2Geo = new THREE.TorusGeometry(1.78, 0.038, 16, 64);
          const gimbal2Mat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.92,
            roughness: 0.2,
          });
          gimbal2 = new THREE.Mesh(gimbal2Geo, gimbal2Mat);
          gimbal2.rotation.y = Math.PI / 4;

          // 4 telemetry emitter beads
          for (let b = 0; b < 4; b++) {
            const beadGeo = new THREE.SphereGeometry(0.05, 12, 12);
            const beadMat = new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              emissive: 0x00f0ff,
              emissiveIntensity: 1.8,
            });
            const bead = new THREE.Mesh(beadGeo, beadMat);
            const beadAngle = (b * Math.PI) / 2 + Math.PI / 4;
            bead.position.set(Math.cos(beadAngle) * 1.78, 0, Math.sin(beadAngle) * 1.78);
            gimbal2.add(bead);
          }
          planetGroup.add(gimbal2);

          // 5. Equatorial Holographic Quantum Accelerator Ring
          const accelGeo = new THREE.RingGeometry(1.98, 2.18, 64);
          const accelMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.75,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.55,
            metalness: 0.85,
            roughness: 0.25,
          });
          accelRing = new THREE.Mesh(accelGeo, accelMat);
          accelRing.rotation.x = Math.PI / 2;
          planetGroup.add(accelRing);

          // 6. Magnetic Polar Flux Loops
          fluxGroup = new THREE.Group();
          [0, Math.PI / 2].forEach((rotY) => {
            const fluxGeo = new THREE.TorusGeometry(1.32, 0.012, 8, 48);
            const fluxMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.35,
            });
            const flux = new THREE.Mesh(fluxGeo, fluxMat);
            flux.rotation.y = rotY;
            fluxGroup.add(flux);
          });
          planetGroup.add(fluxGroup);
          break;
        }

        case "gateway": {
          // Planetary Ingress Ring with Radial Conduits
          const ringGeo = new THREE.RingGeometry(world.size * 1.35, world.size * 1.85, 48);
          const ringMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 0.65,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
            metalness: 0.8,
            roughness: 0.2,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2.7;
          planetGroup.add(ring);
          break;
        }

        case "requirements": {
          // 2 Orbiting Spec Document Panels (Moons)
          [-0.8, 0.8].forEach((angleOffset) => {
            const docGeo = new THREE.BoxGeometry(0.48, 0.65, 0.04);
            const docMat = new THREE.MeshStandardMaterial({
              color: 0x1e293b,
              emissive: 0xfbbf24,
              emissiveIntensity: 0.5,
              metalness: 0.8,
              roughness: 0.3,
            });
            const doc = new THREE.Mesh(docGeo, docMat);
            doc.position.set(Math.cos(angleOffset) * 1.45, 0.2, Math.sin(angleOffset) * 1.45);
            planetGroup.add(doc);
            satellites.push(doc);
          });
          break;
        }

        case "services": {
          // Microservice Moonlets
          const moonColors = [0x38bdf8, 0x10b981];
          moonColors.forEach((col, mIdx) => {
            const mGeo = new THREE.SphereGeometry(0.32, 20, 20);
            const mMat = new THREE.MeshStandardMaterial({
              color: col,
              emissive: col,
              emissiveIntensity: 0.9,
              metalness: 0.6,
              roughness: 0.3,
            });
            const moon = new THREE.Mesh(mGeo, mMat);
            const dist = 1.65 + mIdx * 0.45;
            moon.position.set(dist * Math.cos(mIdx * 2.8), 0, dist * Math.sin(mIdx * 2.8));
            planetGroup.add(moon);
            satellites.push(moon);
          });
          break;
        }

        case "events": {
          // Moving Signal Rings
          [1.35, 1.75].forEach((radius) => {
            const ringGeo = new THREE.TorusGeometry(radius, 0.035, 12, 36);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85 });
            const r = new THREE.Mesh(ringGeo, ringMat);
            r.rotation.x = Math.PI / 2;
            planetGroup.add(r);
            pulseRings.push(r);
          });
          break;
        }

        case "data": {
          // Stacked Data Platters around Equator
          [-0.38, 0, 0.38].forEach((yOffset) => {
            const bandGeo = new THREE.TorusGeometry(world.size * 1.05, 0.035, 8, 40);
            const bandMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.rotation.x = Math.PI / 2;
            band.position.y = yOffset;
            planetGroup.add(band);
          });
          break;
        }

        case "intelligence": {
          // Orbiting Git AST Module Nodes
          [-1.2, 1.2].forEach((xOff) => {
            const cubeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
            const cubeMat = new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              emissive: 0x38bdf8,
              emissiveIntensity: 1.2,
              metalness: 0.8,
            });
            const cube = new THREE.Mesh(cubeGeo, cubeMat);
            cube.position.set(xOff, 0.3, 0);
            planetGroup.add(cube);
            satellites.push(cube);
          });
          break;
        }

        case "drift": {
          // Dual Intersecting Radar Comparison Rings
          const radar1 = new THREE.Mesh(
            new THREE.TorusGeometry(world.size * 1.45, 0.035, 8, 36),
            new THREE.MeshBasicMaterial({ color: 0xf97316 })
          );
          radar1.rotation.x = Math.PI / 3;
          planetGroup.add(radar1);

          const radar2 = new THREE.Mesh(
            new THREE.TorusGeometry(world.size * 1.45, 0.035, 8, 36),
            new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
          );
          radar2.rotation.y = Math.PI / 3;
          planetGroup.add(radar2);
          pulseRings.push(radar1, radar2);
          break;
        }

        case "quality": {
          // Hexagonal Geodesic Verification Shield
          const shieldGeo = new THREE.IcosahedronGeometry(world.size * 1.38, 1);
          const shieldMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x10b981,
            emissiveIntensity: 0.75,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
          });
          const shield = new THREE.Mesh(shieldGeo, shieldMat);
          planetGroup.add(shield);
          pulseRings.push(shield);
          break;
        }
      }

      // 3D Billboarding Text Label Plate
      const labelMesh = createPlanetLabel(world.shortLabel, `${world.protocol} :${world.port}`, world.colorHex);
      const labelY = isCore ? 2.45 : world.size + 0.88;
      labelMesh.position.set(0, labelY, 0);
      planetGroup.add(labelMesh);

      planetsMasterGroup.add(planetGroup);
      activePlanets.push({
        group: planetGroup,
        world,
        labelMesh,
        meshCore: planetSphere,
        satellites,
        pulseRings,
      });
    });

    scene.add(orbitRingsGroup);
    scene.add(planetsMasterGroup);

    // 8. INTER-PLANETARY ARCHITECTURAL CONDUITS & DATA PACKETS
    const connectionsGroup = new THREE.Group();
    const packetGroup = new THREE.Group();

    interface RealEdgeConnection {
      source: PlanetWorld;
      target: PlanetWorld;
      line: THREE.Line;
      p1: THREE.Vector3;
      p2: THREE.Vector3;
    }

    const realLinks: RealEdgeConnection[] = [];

    PLANET_WORLDS.forEach((src) => {
      src.connections.forEach((tgtId) => {
        const tgt = PLANET_WORLDS.find((p) => p.id === tgtId);
        if (!tgt) return;

        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const lineMat = new THREE.LineBasicMaterial({
          color: src.colorHex,
          transparent: true,
          opacity: 0.24,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        connectionsGroup.add(line);

        realLinks.push({
          source: src,
          target: tgt,
          line,
          p1: new THREE.Vector3(),
          p2: new THREE.Vector3(),
        });
      });
    });

    scene.add(connectionsGroup);

    // 28 Moving Energy Packets
    const packetCount = 28;
    const packetGeo = new THREE.SphereGeometry(0.08, 10, 10);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const packets: { mesh: THREE.Mesh; linkIndex: number; progress: number; speed: number }[] = [];

    for (let i = 0; i < packetCount; i++) {
      const p = new THREE.Mesh(packetGeo, packetMat);
      const linkIndex = i % realLinks.length;
      packetGroup.add(p);
      packets.push({
        mesh: p,
        linkIndex,
        progress: (i / packetCount) * 1.0,
        speed: 0.0028 + Math.random() * 0.003,
      });
    }
    scene.add(packetGroup);

    // 9. Raycasting Selection Handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clickMouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(clickMouse, camera);

      // Check Planet & Architecture Core Clicks
      const planetIntersects = raycaster.intersectObjects(planetsMasterGroup.children, true);
      if (planetIntersects.length > 0) {
        let parent = planetIntersects[0].object;
        while (parent.parent && parent.parent !== planetsMasterGroup) {
          parent = parent.parent;
        }
        const found = activePlanets.find((ap) => ap.group === parent);
        if (found) {
          setSelectedWorld(found.world);
          sceneController.current?.focusPlanet(found.world);
          return;
        }
      }

      // Background click unfocuses if not on tour
      if (!isTourActive) {
        setSelectedWorld(null);
        sceneController.current?.resetView();
      }
    };

    // Touch tap selection support for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        if (Math.hypot(dx, dy) < 14 && dt < 450) {
          const rect = container.getBoundingClientRect();
          const tapMouse = new THREE.Vector2(
            ((e.changedTouches[0].clientX - rect.left) / rect.width) * 2 - 1,
            -((e.changedTouches[0].clientY - rect.top) / rect.height) * 2 + 1
          );
          raycaster.setFromCamera(tapMouse, camera);
          const planetIntersects = raycaster.intersectObjects(planetsMasterGroup.children, true);
          if (planetIntersects.length > 0) {
            let parent = planetIntersects[0].object;
            while (parent.parent && parent.parent !== planetsMasterGroup) {
              parent = parent.parent;
            }
            const found = activePlanets.find((ap) => ap.group === parent);
            if (found) {
              setSelectedWorld(found.world);
              sceneController.current?.focusPlanet(found.world);
              return;
            }
          }
        }
      }
    };

    container.addEventListener("mousemove", onPointerMove);
    container.addEventListener("click", onClick);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    // 10. Intersection Observer (freeze when offscreen)
    let isIntersecting = true;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isIntersecting = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Resize handling
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth || 960;
      height = container.clientHeight || 580;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    // 11. Camera & Transition State
    let targetCameraPos = defaultCameraPos.clone();
    let targetLookAt = defaultLookAt.clone();
    let isTransitioningCamera = false;
    let explodeFactor = 0; // 0 = orbit mode, 1 = exploded layers mode
    let targetExplodeFactor = 0;
    let totalTime = 0;

    // Controller Methods
    sceneController.current = {
      focusPlanet: (world: PlanetWorld | null) => {
        if (!world) {
          targetCameraPos.copy(defaultCameraPos);
          targetLookAt.copy(defaultLookAt);
        } else {
          const ap = activePlanets.find((p) => p.world.id === world.id);
          const currentPos = ap ? ap.group.position : new THREE.Vector3(...world.explodedPosition);
          targetLookAt.copy(currentPos);
          targetCameraPos.set(currentPos.x, currentPos.y + 2.2, currentPos.z + 4.8);
        }
        isTransitioningCamera = true;
      },
      resetView: () => {
        targetCameraPos.copy(defaultCameraPos);
        targetLookAt.copy(defaultLookAt);
        isTransitioningCamera = true;
      },
      fitSolarSystem: () => {
        const isNarrow = (container?.clientWidth || 960) < 640;
        targetCameraPos.set(0, isNarrow ? 24.0 : 18.0, isNarrow ? 38.0 : 28.0);
        targetLookAt.copy(defaultLookAt);
        isTransitioningCamera = true;
      },
      setVisualMode: (mode: VisualMode) => {
        if (mode === "exploded") {
          targetExplodeFactor = 1.0;
        } else {
          targetExplodeFactor = 0.0;
        }

        realLinks.forEach((link) => {
          const lineMat = link.line.material as THREE.LineBasicMaterial;
          if (mode === "dataflow") {
            lineMat.opacity = 0.65;
          } else if (mode === "quality") {
            lineMat.opacity = link.source.category === "quality" || link.target.category === "quality" ? 0.9 : 0.15;
          } else {
            lineMat.opacity = 0.24;
          }
        });
      },
      setStage: (idx: number) => {
        const stage = WORKFLOW_STAGES[idx];
        const hex = new THREE.Color(stage.accent).getHex();
        if (innerCoreMat) {
          innerCoreMat.color.setHex(hex);
          innerCoreMat.emissive.setHex(hex);
        }
      },
      toggleOrbit: () => {
        setIsOrbitPaused((v) => !v);
      },
    };

    // 12. Animation Render Loop (No React re-renders every frame!)
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isIntersecting) return;

      const delta = clock.getDelta();
      if (!isOrbitPaused && !prefersReducedMotion) {
        totalTime += delta;
      }

      // FPS tracking
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setHudFps(frameCount);
        frameCount = 0;
        lastFpsTime = now;
      }

      // Smooth camera interpolation
      if (isTransitioningCamera) {
        camera.position.lerp(targetCameraPos, 0.05);
        controls.target.lerp(targetLookAt, 0.05);
        if (camera.position.distanceTo(targetCameraPos) < 0.04) {
          isTransitioningCamera = false;
        }
      }

      controls.update();

      // Explode factor interpolation (0 = Orbit, 1 = Exploded Blueprint)
      explodeFactor += (targetExplodeFactor - explodeFactor) * 0.05;

      // Animate Architecture Core Hub
      if (!prefersReducedMotion && innerCore && innerCoreMat && gimbal1 && gimbal2) {
        // 1. Quantum Singularity Core harmonic breath
        const breath = Math.sin(totalTime * 2.2);
        const coreScale = 1.0 + breath * 0.045;
        innerCore.scale.set(coreScale, coreScale, coreScale);
        innerCoreMat.emissiveIntensity = 2.4 + breath * 0.9;
        innerCore.rotation.y = totalTime * 0.35;
        innerCore.rotation.z = Math.sin(totalTime * 0.25) * 0.15;

        // 2. Wireframe quantum lattice counter-rotation
        if (outerLattice) {
          outerLattice.rotation.y = -totalTime * 0.28;
          outerLattice.rotation.x = totalTime * 0.18;
        }

        // 3. Gyroscopic Gimbal Rings: Authentic Precession & Nutation
        gimbal1.rotation.z = totalTime * 0.22;
        gimbal1.rotation.x = Math.PI / 3 + Math.sin(totalTime * 0.45) * 0.12;

        gimbal2.rotation.y = -totalTime * 0.16;
        gimbal2.rotation.z = Math.PI / 4 + Math.cos(totalTime * 0.38) * 0.09;

        // 4. Equatorial Accelerator Ring rotation
        if (accelRing) {
          accelRing.rotation.z = totalTime * 0.14;
        }

        // 5. Magnetic Flux Arcs drift
        if (fluxGroup) {
          fluxGroup.rotation.y = totalTime * 0.08;
        }
      }

      // Calculate Independent Keplerian Planetary Positions
      activePlanets.forEach((ap) => {
        const world = ap.world;

        // Mathematical Keplerian 3D Position
        const orbitPos = computeKeplerianOrbitalPosition(world, totalTime);
        const [expX, expY, expZ] = world.explodedPosition;

        // Smooth blend between Orbital motion and Exploded Blueprint layout
        const targetX = THREE.MathUtils.lerp(orbitPos.x, expX, explodeFactor);
        const targetY = THREE.MathUtils.lerp(orbitPos.y, expY, explodeFactor);
        const targetZ = THREE.MathUtils.lerp(orbitPos.z, expZ, explodeFactor);

        ap.group.position.set(targetX, targetY, targetZ);

        // Axial spin around planet pole
        if (!prefersReducedMotion) {
          ap.meshCore.rotation.y += delta * world.axialRotationSpeed;
        }

        // Billboarding labels so they continually face camera
        ap.labelMesh.quaternion.copy(camera.quaternion);

        // Animate satellites revolving around planet
        ap.satellites.forEach((sat, sIdx) => {
          if (!prefersReducedMotion) {
            const satAngle = totalTime * 1.6 + sIdx * 2.2;
            const dist = 1.4 + sIdx * 0.38;
            sat.position.set(Math.cos(satAngle) * dist, Math.sin(satAngle * 0.8) * 0.32, Math.sin(satAngle) * dist);
            sat.rotation.y += delta * 1.3;
          }
        });

        // Pulse signal rings
        ap.pulseRings.forEach((pr, pIdx) => {
          if (!prefersReducedMotion) {
            const scale = 1.0 + Math.sin(totalTime * 2.5 + pIdx * 1.6) * 0.07;
            pr.scale.set(scale, scale, scale);
          }
        });
      });

      // Update Inter-Planetary Architecture Connection Conduits
      realLinks.forEach((link) => {
        const srcObj = activePlanets.find((ap) => ap.world.id === link.source.id);
        const tgtObj = activePlanets.find((ap) => ap.world.id === link.target.id);

        if (srcObj && tgtObj) {
          link.p1.copy(srcObj.group.position);
          link.p2.copy(tgtObj.group.position);

          const positions = link.line.geometry.attributes.position as THREE.BufferAttribute;
          positions.setXYZ(0, link.p1.x, link.p1.y, link.p1.z);
          positions.setXYZ(1, link.p2.x, link.p2.y, link.p2.z);
          positions.needsUpdate = true;
        }
      });

      // Move Data Packets along Active Conduits
      const speedMult = visualMode === "dataflow" ? 2.6 : 1.0;
      packets.forEach((p) => {
        const link = realLinks[p.linkIndex];
        if (!link) return;

        if (!isOrbitPaused && !prefersReducedMotion) {
          p.progress += p.speed * speedMult;
          if (p.progress >= 1.0) p.progress = 0;
        }

        p.mesh.position.lerpVectors(link.p1, link.p2, p.progress);
      });

      // Raycast Hover Detection
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(planetsMasterGroup.children, true);

      if (intersects.length > 0) {
        let parent = intersects[0].object;
        while (parent.parent && parent.parent !== planetsMasterGroup) {
          parent = parent.parent;
        }
        const found = activePlanets.find((ap) => ap.group === parent);
        if (found) {
          setHoveredWorld(found.world);
          document.body.style.cursor = "pointer";
        }
      } else {
        setHoveredWorld(null);
        document.body.style.cursor = "default";
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      container.removeEventListener("mousemove", onPointerMove);
      container.removeEventListener("click", onClick);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      document.body.style.cursor = "default";

      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [webglSupported, prefersReducedMotion]);

  // Stage Change Handler
  const handleStageSelect = (idx: number) => {
    setActiveStageIdx(idx);
    sceneController.current?.setStage(idx);
  };

  // Visual Mode Change Handler
  const handleModeChange = (mode: VisualMode) => {
    setVisualMode(mode);
    sceneController.current?.setVisualMode(mode);
  };

  return (
    <div className="relative w-full rounded-2xl border border-border/80 bg-panel/85 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col">
      {/* ================= SOLAR SYSTEM WORKFLOW STAGE BAR ================= */}
      <div className="px-4 py-3 border-b border-border bg-[#0B1120]/95 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold shrink-0 mr-1 hidden sm:inline">
            Workflow:
          </span>
          {WORKFLOW_STAGES.map((stg, idx) => {
            const isCurrent = activeStageIdx === idx;
            return (
              <button
                key={stg.id}
                onClick={() => handleStageSelect(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all shrink-0 border ${
                  isCurrent
                    ? "bg-surface text-foreground border-primary/50 shadow-sm ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/50 border-transparent"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full transition-transform"
                  style={{ backgroundColor: stg.accent, transform: isCurrent ? "scale(1.2)" : "scale(1)" }}
                />
                <span className="font-semibold">{stg.name}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode Mode Toggles */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="inline-flex rounded-lg border border-border bg-surface/70 p-0.5 text-xs font-mono">
            {(
              [
                { mode: "orbit", label: "Solar Orbit", icon: Globe2 },
                { mode: "exploded", label: "Exploded Layers", icon: Layers },
                { mode: "dataflow", label: "Data Flow", icon: Zap },
                { mode: "quality", label: "Quality Shield", icon: ShieldCheck },
              ] as const
            ).map((item) => (
              <button
                key={item.mode}
                onClick={() => handleModeChange(item.mode)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors flex items-center gap-1.5 ${
                  visualMode === item.mode
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================= 3D VIEWPORT CANVAS ================= */}
      <div className="relative w-full h-[380px] xs:h-[450px] sm:h-[540px] lg:h-[640px] bg-gradient-to-b from-[#050811] via-[#090D18] to-[#0E1526] overflow-hidden">
        {webglSupported === false ? (
          <SolarSystemFallbackVisual />
        ) : (
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        )}

        {/* Guided Tour Banner Overlay */}
        {isTourActive && (
          <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-12 z-30 surface-panel p-2.5 sm:p-3.5 bg-panel/95 backdrop-blur-md border-primary/50 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-mono font-bold text-xs shrink-0">
                {tourIndex + 1}/{TOUR_PLANETS.length}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-primary font-semibold truncate">Guided Tour</div>
                <div className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {selectedWorld?.name || "Architecture Core"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={prevTour}
                disabled={tourIndex === 0}
                className="px-2 py-1 rounded bg-surface border border-border text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={nextTour}
                className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 flex items-center gap-1"
              >
                {tourIndex === TOUR_PLANETS.length - 1 ? "Finish" : "Next"} <ArrowRight className="h-3 w-3" />
              </button>
              <button
                onClick={endTour}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface ml-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Top-Right On-Canvas Viewport Controls */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 sm:gap-2">
          {!isTourActive && (
            <button
              onClick={startTour}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-primary/40 bg-panel/85 backdrop-blur-sm text-xs font-mono font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-md flex items-center gap-1.5"
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guided Tour</span>
            </button>
          )}

          <div className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-lg border border-border bg-panel/80 backdrop-blur-sm shadow-md">
            <button
              onClick={() => sceneController.current?.resetView()}
              className="p-1 sm:p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
              title="Reset Solar System View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => sceneController.current?.fitSolarSystem()}
              className="p-1 sm:p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
              title="Fit Entire Solar System"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setIsOrbitPaused(!isOrbitPaused);
                sceneController.current?.toggleOrbit();
              }}
              className="p-1 sm:p-1.5 rounded hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
              title={isOrbitPaused ? "Resume Orbit Motion" : "Pause Orbit Motion"}
            >
              {isOrbitPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Contextual Planet Telemetry Inspector */}
        {(selectedWorld || hoveredWorld) && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:left-4 sm:bottom-4 z-20 surface-panel p-3.5 sm:p-4 bg-panel/95 backdrop-blur-md border-primary/40 shadow-2xl w-auto sm:max-w-[340px] max-h-[50vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {(() => {
              const active = selectedWorld || hoveredWorld!;
              return (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                        <Globe2 className="h-3 w-3" />
                        <span>{active.category} layer</span>
                      </div>
                      <div className="text-sm font-semibold font-display text-foreground leading-snug">
                        {active.name}
                      </div>
                    </div>
                    {selectedWorld && (
                      <button
                        onClick={() => {
                          setSelectedWorld(null);
                          sceneController.current?.resetView();
                        }}
                        className="p-1 rounded hover:bg-surface text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{active.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground border-y border-border py-2">
                    <div>
                      Protocol: <span className="text-foreground">{active.protocol}</span>
                    </div>
                    <div>
                      Port: <span className="text-foreground">:{active.port}</span>
                    </div>
                    <div>
                      SLA: <span className="text-primary">{active.sla}</span>
                    </div>
                    <div>
                      Health:{" "}
                      <span className={active.health === "warning" ? "text-warning" : "text-success"}>
                        {active.health === "warning" ? "Drift Flagged" : "Verified ✓"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Inter-World Links:</span>
                      <span className="text-foreground font-semibold">{active.connections.length} conduits</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Orbit Axis (a):</span>
                      <span className="text-foreground font-semibold">{active.semiMajorAxis} AU</span>
                    </div>
                  </div>

                  {selectedWorld && (
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setSelectedWorld(null);
                          sceneController.current?.resetView();
                        }}
                        className="w-full text-center py-1.5 rounded border border-border bg-surface text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back to Solar System View
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Canvas Bottom Status Bar */}
        <div className="absolute bottom-3 right-4 z-10 hidden sm:flex items-center gap-3 text-[11px] font-mono text-muted-foreground/80 bg-panel/70 backdrop-blur-sm px-2.5 py-1 rounded-md border border-border/60">
          <span>{hudFps} FPS</span>
          <span>·</span>
          <span>Procedural Realistic Textures</span>
          <span>·</span>
          <span>Non-Synchronous Keplerian Orbits</span>
        </div>
      </div>

      {/* ================= SOLAR SYSTEM LEGEND & NARRATIVE BANNER ================= */}
      <div className="p-4 border-t border-border bg-surface/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-semibold text-foreground">
            Stage {WORKFLOW_STAGES[activeStageIdx].number}: {WORKFLOW_STAGES[activeStageIdx].name}
          </span>
          <span className="text-muted-foreground hidden md:inline">—</span>
          <span className="text-muted-foreground hidden md:inline">
            {WORKFLOW_STAGES[activeStageIdx].desc}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00F0FF]" /> Ingress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" /> Services
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> Persistence
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A855F7]" /> Events
          </span>
        </div>
      </div>
    </div>
  );
}

// Polished SVG Solar System Fallback if WebGL is unavailable
function SolarSystemFallbackVisual() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-radial from-[#1E293B]/60 to-[#070B14]">
      <svg className="w-full max-w-xl h-72" viewBox="0 0 700 350" fill="none">
        {/* Orbital Ellipses */}
        <ellipse cx="350" cy="175" rx="90" ry="40" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
        <ellipse cx="350" cy="175" rx="160" ry="70" stroke="#00F0FF" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
        <ellipse cx="350" cy="175" rx="230" ry="100" stroke="#A855F7" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
        <ellipse cx="350" cy="175" rx="300" ry="130" stroke="#10B981" strokeWidth="1" strokeDasharray="5 5" opacity="0.2" />

        {/* Central Architecture Core Hub */}
        <g transform="translate(350, 175)">
          <circle r="26" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="2" />
          <circle r="14" fill="#F59E0B" />
          <text y="42" fill="#F8FAFC" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            Architecture Core
          </text>
        </g>

        {/* Orbiting Worlds */}
        <g transform="translate(260, 175)">
          <circle r="10" fill="#FBBF24" />
          <text y="22" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">Requirements</text>
        </g>

        <g transform="translate(470, 130)">
          <circle r="12" fill="#00F0FF" />
          <ellipse cx="0" cy="0" rx="18" ry="6" stroke="#00F0FF" strokeWidth="1.5" />
          <text y="24" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">API Gateway</text>
        </g>

        <g transform="translate(190, 120)">
          <circle r="14" fill="#F59E0B" />
          <circle cx="18" cy="-8" r="4" fill="#38BDF8" />
          <text y="26" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">Microservices</text>
        </g>

        <g transform="translate(540, 220)">
          <circle r="11" fill="#A855F7" />
          <text y="23" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">Kafka Mesh</text>
        </g>

        <g transform="translate(100, 220)">
          <circle r="13" fill="#10B981" />
          <line x1="-15" y1="0" x2="15" y2="0" stroke="#34D399" strokeWidth="2" />
          <text y="25" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">Database</text>
        </g>
      </svg>
      <div className="mt-3 text-xs font-mono text-muted-foreground">
        2D Solar Architecture Fallback (WebGL acceleration disabled)
      </div>
    </div>
  );
}
