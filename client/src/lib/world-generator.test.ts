/** PixelForge verification: deterministic seeds and core validation rules remain stable. */

import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, generateWorld } from "./world-generator";

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
});
