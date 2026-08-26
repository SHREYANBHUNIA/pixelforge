/** PixelForge verification: deterministic seeds and core validation rules remain stable. */

import { describe, expect, it } from "vitest";
import { applyBrush, DEFAULT_CONFIG, generateWorld } from "./world-generator";

describe("PixelForge world generator", () => {
  it("recreates identical terrain from the same seed", () => {
    const first = generateWorld(DEFAULT_CONFIG);
    const second = generateWorld(DEFAULT_CONFIG);
    expect(first.tiles[20][20].biome).toBe(second.tiles[20][20].biome);
    expect(first.tiles[20][20].height).toBe(second.tiles[20][20].height);
    expect(first.settlements).toEqual(second.settlements);
  });

  it("returns a validated playable world", () => {
    const world = generateWorld({ ...DEFAULT_CONFIG, seed: 94116 });
    expect(world.validation.valid).toBe(true);
    expect(world.validation.reachableVillages).toBe(world.settlements.length);
  });

  it("erases an edited feature back to neutral grassland", () => {
    const world = generateWorld(DEFAULT_CONFIG);
    const point = { x: 16, y: 16 };
    const forest = applyBrush(world, point, "forest");
    const erased = applyBrush(forest, point, "erase");
    expect(erased.tiles[point.y][point.x].biome).toBe("grassland");
    expect(erased.tiles[point.y][point.x].road).toBe(false);
  });

  it("applies every editor brush to a visible world state", () => {
    const world = generateWorld(DEFAULT_CONFIG);
    const forestPoint = { x: 12, y: 12 };
    const waterPoint = { x: 14, y: 14 };
    const roadPoint = { x: 16, y: 16 };
    const villagePoint = { x: 18, y: 18 };
    const forest = applyBrush(world, forestPoint, "forest");
    const terrain = applyBrush(forest, forestPoint, "grassland");
    const water = applyBrush(terrain, waterPoint, "water");
    const road = applyBrush(water, roadPoint, "road");
    const villageWater = applyBrush(road, villagePoint, "water");
    const village = applyBrush(villageWater, villagePoint, "village");
    expect(forest.tiles[forestPoint.y][forestPoint.x].biome).toBe("forest");
    expect(terrain.tiles[forestPoint.y][forestPoint.x].biome).toBe("grassland");
    expect(water.tiles[waterPoint.y][waterPoint.x].biome).toBe("lake");
    expect(road.tiles[roadPoint.y][roadPoint.x].road).toBe(true);
    expect(village.tiles[villagePoint.y][villagePoint.x].settlementId).toBeDefined();
    expect(village.tiles[villagePoint.y][villagePoint.x].biome).toBe("grassland");
  });
});
