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
});
