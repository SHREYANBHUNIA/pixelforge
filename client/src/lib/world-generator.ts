/** PixelForge engine: deterministic, inspectable terrain data for the Cartographer's Workbench interface. */

export type Biome =
  | "ocean"
  | "lake"
  | "beach"
  | "grassland"
  | "forest"
  | "desert"
  | "mountain"
  | "snow";

export type Brush = "forest" | "grassland" | "water" | "road" | "village" | "erase";

export interface Point {
  x: number;
  y: number;
}

export interface Tile extends Point {
  height: number;
  moisture: number;
  temperature: number;
  biome: Biome;
  river: boolean;
  road: boolean;
  settlementId?: string;
  spawn?: boolean;
}

export interface Settlement extends Point {
  id: string;
  name: string;
  population: number;
}

export interface River {
  id: string;
  source: Point;
  mouth: Point;
  path: Point[];
}

export interface Road {
  id: string;
  from: string;
  to: string;
  path: Point[];
}

export interface ValidationIssue {
  id: string;
  label: string;
  detail: string;
  state: "pass" | "warn" | "fail";
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  reachableVillages: number;
  isolatedRegions: number;
}

export interface WorldStats {
  landPercent: number;
  forestPercent: number;
  mountainPercent: number;
  waterPercent: number;
  settlements: number;
  roads: number;
  rivers: number;
  chunks: number;
  repairs: number;
}

export interface WorldConfig {
  seed: number;
  size: number;
  seaLevel: number;
  roughness: number;
  rainfall: number;
  settlementTarget: number;
}

export interface World {
  config: WorldConfig;
  tiles: Tile[][];
  settlements: Settlement[];
  rivers: River[];
  roads: Road[];
  validation: ValidationReport;
  stats: WorldStats;
  generatedAt: string;
}

export const DEFAULT_CONFIG: WorldConfig = {
  seed: 184729,
  size: 64,
  seaLevel: 0.3,
  roughness: 0.72,
  rainfall: 0.58,
  settlementTarget: 4,
};

const DIRECTION_STEPS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const BIOME_COLORS: Record<Biome, string> = {
  ocean: "#235a77",
  lake: "#3b7894",
  beach: "#d9c48d",
  grassland: "#9fb879",
  forest: "#416a4e",
  desert: "#cbad70",
  mountain: "#686d69",
  snow: "#e8ece4",
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (value: number) => value * value * (3 - 2 * value);
const keyOf = (point: Point) => `${point.x},${point.y}`;
const pointEquals = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

function hash(seed: number, x: number, y: number) {
  let value = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(seed: number, x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  return lerp(
    lerp(hash(seed, xi, yi), hash(seed, xi + 1, yi), tx),
    lerp(hash(seed, xi, yi + 1), hash(seed, xi + 1, yi + 1), tx),
    ty,
  );
}

function fractalNoise(seed: number, x: number, y: number, octaves: number) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(seed + octave * 1013, x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.54;
    frequency *= 2.05;
  }
  return sum / norm;
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function isWater(tile: Tile) {
  return tile.biome === "ocean" || tile.biome === "lake";
}

function isWalkable(tile: Tile) {
  return !isWater(tile) && tile.biome !== "mountain" && tile.biome !== "snow" && tile.height < 0.78;
}

function inBounds(world: World, point: Point) {
  return point.x >= 0 && point.y >= 0 && point.x < world.config.size && point.y < world.config.size;
}

function getTile(world: World, point: Point) {
  return world.tiles[point.y]?.[point.x];
}

function neighbors(world: World, point: Point) {
  return DIRECTION_STEPS.map((step) => ({ x: point.x + step.x, y: point.y + step.y })).filter((candidate) =>
    inBounds(world, candidate),
  );
}

function classifyBiome(height: number, moisture: number, temperature: number, seaLevel: number): Biome {
  if (height < seaLevel) return "ocean";
  if (height < seaLevel + 0.032) return "beach";
  if (height > 0.79) return temperature < 0.42 ? "snow" : "mountain";
  if (height > 0.67) return "mountain";
  if (temperature > 0.7 && moisture < 0.38) return "desert";
  if (moisture > 0.56) return "forest";
  return "grassland";
}

function heuristic(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findPath(world: World, start: Point, goal: Point, kind: "road" | "river") {
  const open: Point[] = [start];
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>([[keyOf(start), 0]]);
  const fScore = new Map<string, number>([[keyOf(start), heuristic(start, goal)]]);
  const maxSteps = world.config.size * world.config.size * 4;
  let steps = 0;

  while (open.length && steps < maxSteps) {
    steps += 1;
    let lowestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      if ((fScore.get(keyOf(open[index])) ?? Infinity) < (fScore.get(keyOf(open[lowestIndex])) ?? Infinity)) {
        lowestIndex = index;
      }
    }
    const current = open.splice(lowestIndex, 1)[0];
    if (pointEquals(current, goal)) {
      const path = [current];
      let trace = current;
      while (cameFrom.has(keyOf(trace))) {
        trace = cameFrom.get(keyOf(trace))!;
        path.unshift(trace);
      }
      return path;
    }

    for (const next of neighbors(world, current)) {
      const tile = getTile(world, next)!;
      if (kind === "road" && (!isWalkable(tile) || tile.height > 0.69)) continue;
      const currentTile = getTile(world, current)!;
      const incline = Math.max(0, tile.height - currentTile.height);
      const terrainCost =
        kind === "road"
          ? 1 + tile.height * 2 + (tile.biome === "forest" ? 0.35 : 0) + (tile.river ? 0.45 : 0)
          : 1 + incline * 7 + tile.height * 0.3;
      const tentative = (gScore.get(keyOf(current)) ?? Infinity) + terrainCost;
      if (tentative >= (gScore.get(keyOf(next)) ?? Infinity)) continue;
      cameFrom.set(keyOf(next), current);
      gScore.set(keyOf(next), tentative);
      fScore.set(keyOf(next), tentative + heuristic(next, goal) * 0.88);
      if (!open.some((candidate) => pointEquals(candidate, next))) open.push(next);
    }
  }
  return [] as Point[];
}

function buildTerrain(config: WorldConfig) {
  const tiles: Tile[][] = [];
  for (let y = 0; y < config.size; y += 1) {
    const row: Tile[] = [];
    for (let x = 0; x < config.size; x += 1) {
      const nx = x / config.size;
      const ny = y / config.size;
      const continental = fractalNoise(config.seed, nx * 2.35, ny * 2.35, 4);
      const detail = fractalNoise(config.seed + 224, nx * 8.2, ny * 8.2, 3);
      const ridge = 1 - Math.abs(fractalNoise(config.seed + 811, nx * 4.7, ny * 4.7, 3) * 2 - 1);
      const coastDistance = Math.min(nx, ny, 1 - nx, 1 - ny);
      const coastalFalloff = clamp(coastDistance * 4.5, 0, 1);
      const height = clamp(
        (continental * 0.56 + detail * 0.19 + ridge * 0.25 * config.roughness) * coastalFalloff + 0.015,
      );
      const moisture = clamp(fractalNoise(config.seed + 1973, nx * 4.4, ny * 4.4, 4) * 0.72 + config.rainfall * 0.28);
      const temperature = clamp(
        0.77 - Math.abs(ny - 0.48) * 0.7 + (fractalNoise(config.seed + 3331, nx * 3, ny * 3, 2) - 0.5) * 0.22 - height * 0.34,
      );
      row.push({
        x,
        y,
        height,
        moisture,
        temperature,
        biome: classifyBiome(height, moisture, temperature, config.seaLevel),
        river: false,
        road: false,
      });
    }
    tiles.push(row);
  }
  return tiles;
}

function closestWater(world: World, source: Point) {
  let closest: Point | undefined;
  let distance = Infinity;
  for (const row of world.tiles) {
    for (const tile of row) {
      if (!isWater(tile)) continue;
      const candidateDistance = heuristic(source, tile);
      if (candidateDistance < distance) {
        closest = tile;
        distance = candidateDistance;
      }
    }
  }
  return closest;
}

function generateRivers(world: World, random: () => number) {
  const candidates = world.tiles
    .flat()
    .filter((tile) => tile.height > 0.63 && tile.biome !== "snow")
    .sort((a, b) => b.height - a.height);
  const count = Math.max(2, Math.min(4, Math.floor(world.config.size / 25) + 1));
  const rivers: River[] = [];
  const usedSources: Point[] = [];

  for (let index = 0; index < count && candidates.length; index += 1) {
    const pool = candidates.slice(0, Math.min(candidates.length, 90));
    const source = pool[Math.floor(random() * pool.length)];
    if (!source || usedSources.some((other) => heuristic(other, source) < world.config.size * 0.18)) continue;
    const mouth = closestWater(world, source);
    if (!mouth) continue;
    const path = findPath(world, source, mouth, "river");
    if (path.length < 8) continue;
    path.forEach((point) => {
      const tile = getTile(world, point)!;
      tile.river = true;
    });
    rivers.push({ id: `river-${rivers.length + 1}`, source, mouth, path });
    usedSources.push(source);
  }
  return rivers;
}

function settlementName(index: number) {
  return ["Juniper", "Morrow", "Tern", "Vellum", "Hollow", "Alder"][index % 6] + " Reach";
}

function placeSettlements(world: World, random: () => number) {
  const candidates = world.tiles
    .flat()
    .filter(
      (tile) =>
        isWalkable(tile) &&
        !tile.river &&
        tile.height > world.config.seaLevel + 0.08 &&
        tile.biome !== "desert" &&
        tile.biome !== "beach",
    );
  const settlements: Settlement[] = [];
  const minimumDistance = Math.max(9, Math.floor(world.config.size * 0.18));
  for (let attempt = 0; attempt < candidates.length * 2 && settlements.length < world.config.settlementTarget; attempt += 1) {
    const candidate = candidates[Math.floor(random() * candidates.length)];
    if (!candidate || settlements.some((settlement) => heuristic(settlement, candidate) < minimumDistance)) continue;
    const settlement: Settlement = {
      id: `settlement-${settlements.length + 1}`,
      x: candidate.x,
      y: candidate.y,
      name: settlementName(settlements.length),
      population: 80 + Math.floor(random() * 260),
    };
    settlements.push(settlement);
    candidate.settlementId = settlement.id;
  }
  if (settlements[0]) getTile(world, settlements[0])!.spawn = true;
  return settlements;
}

function buildRoads(world: World) {
  world.tiles.flat().forEach((tile) => {
    tile.road = false;
  });
  const roads: Road[] = [];
  const origin = world.settlements[0];
  if (!origin) return roads;
  for (const settlement of world.settlements.slice(1)) {
    const path = findPath(world, origin, settlement, "road");
    if (!path.length) continue;
    path.forEach((point) => {
      getTile(world, point)!.road = true;
    });
    roads.push({ id: `road-${roads.length + 1}`, from: origin.id, to: settlement.id, path });
  }
  return roads;
}

function connectedComponent(world: World, start: Point) {
  const visited = new Set<string>();
  const queue = [start];
  if (!getTile(world, start) || !isWalkable(getTile(world, start)!)) return visited;
  visited.add(keyOf(start));
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighbors(world, current)) {
      const tile = getTile(world, next)!;
      if (!isWalkable(tile) || visited.has(keyOf(next))) continue;
      visited.add(keyOf(next));
      queue.push(next);
    }
  }
  return visited;
}

function findComponents(world: World) {
  const all = new Set<string>();
  const components: Point[][] = [];
  for (const tile of world.tiles.flat()) {
    if (!isWalkable(tile) || all.has(keyOf(tile))) continue;
    const keys = connectedComponent(world, tile);
    const component = Array.from(keys).map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });
    component.forEach((point) => all.add(keyOf(point)));
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

function roadTerminiAreValid(world: World) {
  const settlements = new Set(world.settlements.map(keyOf));
  for (const road of world.roads) {
    const start = road.path[0];
    const end = road.path[road.path.length - 1];
    if (!start || !end || !settlements.has(keyOf(start)) || !settlements.has(keyOf(end))) return false;
  }
  return true;
}

export function validateWorld(world: World): ValidationReport {
  const spawn = world.tiles.flat().find((tile) => tile.spawn);
  const reachable = spawn ? connectedComponent(world, spawn) : new Set<string>();
  const reachableVillages = world.settlements.filter((settlement) => reachable.has(keyOf(settlement))).length;
  const components = findComponents(world);
  const isolatedRegions = components.filter((component) => component.length >= Math.max(16, world.config.size / 2)).length - 1;
  const riversReachWater = world.rivers.every((river) => {
    const mouth = getTile(world, river.mouth);
    return Boolean(mouth && isWater(mouth));
  });
  const roadsAreComplete = roadTerminiAreValid(world);
  const spawnIsAccessible = Boolean(spawn && isWalkable(spawn));
  const terrainIsPossible = world.tiles.flat().some((tile) => isWalkable(tile)) && world.settlements.length > 0;
  const issues: ValidationIssue[] = [
    {
      id: "villages",
      label: "All villages reachable",
      detail: `${reachableVillages} of ${world.settlements.length} settlements lie in the spawn region`,
      state: reachableVillages === world.settlements.length ? "pass" : "fail",
    },
    {
      id: "regions",
      label: "No isolated regions",
      detail: isolatedRegions > 0 ? `${isolatedRegions} major region requires a terrain repair` : "Walkable land resolves as one primary region",
      state: isolatedRegions > 0 ? "fail" : "pass",
    },
    {
      id: "rivers",
      label: "Rivers reach water",
      detail: `${world.rivers.length} watercourses trace from source to water`,
      state: riversReachWater ? "pass" : "fail",
    },
    {
      id: "roads",
      label: "Road termini are intentional",
      detail: `${world.roads.length} routes terminate at registered settlements`,
      state: roadsAreComplete ? "pass" : "fail",
    },
    {
      id: "spawn",
      label: "Spawn point is accessible",
      detail: spawnIsAccessible ? "Spawn marker sits on walkable terrain" : "Spawn marker needs relocation",
      state: spawnIsAccessible ? "pass" : "fail",
    },
    {
      id: "terrain",
      label: "No impossible terrain",
      detail: terrainIsPossible ? "Playable terrain is available for settlement and traversal" : "No viable playable terrain found",
      state: terrainIsPossible ? "pass" : "fail",
    },
  ];
  return {
    valid: issues.every((issue) => issue.state !== "fail"),
    issues,
    reachableVillages,
    isolatedRegions: Math.max(0, isolatedRegions),
  };
}

function paintTraversable(tile: Tile) {
  tile.height = 0.46;
  tile.moisture = 0.55;
  tile.biome = "grassland";
  tile.river = false;
}

function carvePassage(world: World, from: Point, to: Point) {
  let x = from.x;
  let y = from.y;
  const horizontalFirst = Math.abs(from.x - to.x) > Math.abs(from.y - to.y);
  const carve = () => paintTraversable(getTile(world, { x, y })!);
  carve();
  while (x !== to.x || y !== to.y) {
    if ((horizontalFirst && x !== to.x) || y === to.y) x += Math.sign(to.x - x);
    else y += Math.sign(to.y - y);
    carve();
  }
}

function repairWorld(world: World) {
  let repairs = 0;
  let report = validateWorld(world);
  const spawn = world.tiles.flat().find((tile) => tile.spawn);
  if (!spawn && world.settlements[0]) {
    getTile(world, world.settlements[0])!.spawn = true;
    repairs += 1;
  }
  const activeSpawn = world.tiles.flat().find((tile) => tile.spawn);
  if (activeSpawn && !isWalkable(activeSpawn)) {
    paintTraversable(activeSpawn);
    repairs += 1;
  }
  const reachable = activeSpawn ? connectedComponent(world, activeSpawn) : new Set<string>();
  if (activeSpawn) {
    for (const settlement of world.settlements) {
      if (!reachable.has(keyOf(settlement))) {
        carvePassage(world, activeSpawn, settlement);
        repairs += 1;
      }
    }
  }
  for (const river of world.rivers) {
    const mouth = getTile(world, river.mouth);
    if (mouth && !isWater(mouth)) {
      mouth.biome = "lake";
      mouth.height = world.config.seaLevel * 0.65;
      repairs += 1;
    }
  }
  const components = findComponents(world);
  if (components.length > 1 && components[0]?.[0]) {
    for (const component of components.slice(1)) {
      if (component.length < Math.max(16, world.config.size / 2)) continue;
      carvePassage(world, components[0][0], component[0]);
      repairs += 1;
    }
  }
  if (repairs) world.roads = buildRoads(world);
  report = validateWorld(world);
  world.validation = report;
  return repairs;
}

export function calculateStats(world: World, repairs = world.stats?.repairs ?? 0): WorldStats {
  const tiles = world.tiles.flat();
  const count = (predicate: (tile: Tile) => boolean) => tiles.filter(predicate).length;
  const total = tiles.length || 1;
  const percent = (value: number) => Math.round((value / total) * 100);
  return {
    landPercent: percent(count((tile) => !isWater(tile))),
    waterPercent: percent(count(isWater)),
    forestPercent: percent(count((tile) => tile.biome === "forest")),
    mountainPercent: percent(count((tile) => tile.biome === "mountain" || tile.biome === "snow")),
    settlements: world.settlements.length,
    roads: world.roads.length,
    rivers: world.rivers.length,
    chunks: Math.ceil(world.config.size / 16) ** 2,
    repairs,
  };
}

export function generateWorld(input: WorldConfig): World {
  const config = { ...input, seed: Math.abs(Math.floor(input.seed)) || 1 };
  const world: World = {
    config,
    tiles: buildTerrain(config),
    settlements: [],
    rivers: [],
    roads: [],
    validation: { valid: false, issues: [], reachableVillages: 0, isolatedRegions: 0 },
    stats: {} as WorldStats,
    generatedAt: new Date().toISOString(),
  };
  const random = createRandom(config.seed);
  world.rivers = generateRivers(world, random);
  world.settlements = placeSettlements(world, random);
  world.roads = buildRoads(world);
  world.validation = validateWorld(world);
  const repairs = world.validation.valid ? 0 : repairWorld(world);
  world.stats = calculateStats(world, repairs);
  return world;
}

export function applyBrush(world: World, point: Point, brush: Brush): World {
  if (!inBounds(world, point)) return world;
  const next = structuredClone(world) as World;
  const tile = getTile(next, point)!;
  if (brush === "forest") {
    tile.biome = "forest";
    tile.height = Math.max(tile.height, next.config.seaLevel + 0.12);
    tile.moisture = 0.72;
  }
  if (brush === "grassland") {
    tile.biome = "grassland";
    tile.height = Math.max(tile.height, next.config.seaLevel + 0.1);
    tile.moisture = 0.48;
  }
  if (brush === "water") {
    tile.biome = "lake";
    tile.height = next.config.seaLevel * 0.64;
    tile.river = false;
    tile.road = false;
  }
  if (brush === "road") tile.road = true;
  if (brush === "village" && !tile.settlementId && !isWater(tile)) {
    const settlement: Settlement = {
      id: `settlement-manual-${next.settlements.length + 1}`,
      x: point.x,
      y: point.y,
      name: `Fieldstead ${next.settlements.length + 1}`,
      population: 100,
    };
    tile.settlementId = settlement.id;
    next.settlements.push(settlement);
  }
  if (brush === "erase") {
    tile.river = false;
    tile.road = false;
    if (tile.settlementId) {
      next.settlements = next.settlements.filter((settlement) => settlement.id !== tile.settlementId);
      tile.settlementId = undefined;
      tile.spawn = false;
    }
  }
  next.validation = validateWorld(next);
  next.stats = calculateStats(next);
  return next;
}

export function getBiomeColor(biome: Biome) {
  return BIOME_COLORS[biome];
}

export function configFromJSON(value: unknown): World | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<World>;
  if (!candidate.config || !Array.isArray(candidate.tiles) || !Array.isArray(candidate.settlements)) return null;
  const imported = candidate as World;
  imported.validation = validateWorld(imported);
  imported.stats = calculateStats(imported);
  return imported;
}
