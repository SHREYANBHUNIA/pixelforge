/** PixelForge style: the terrain canvas is the visual protagonist of the Cartographer's Workbench. */

import { useEffect, useMemo, useRef, useState } from "react";
import { getBiomeColor, type Brush, type Point, type Tile, type World } from "@/lib/world-generator";

export type MapLayer = "terrain" | "height" | "biomes";

interface WorldCanvasProps {
  world: World;
  brush: Brush;
  layer: MapLayer;
  showRivers: boolean;
  showRoads: boolean;
  showSettlements: boolean;
  zoom: number;
  onBrush: (point: Point) => void;
  onInspect: (tile: Tile | null) => void;
}

function toHexChannel(value: number) {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
}

function shade(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  const red = Number.parseInt(clean.slice(0, 2), 16) + amount;
  const green = Number.parseInt(clean.slice(2, 4), 16) + amount;
  const blue = Number.parseInt(clean.slice(4, 6), 16) + amount;
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
}

function tileColor(tile: Tile, layer: MapLayer) {
  if (layer === "height") {
    const level = Math.round(50 + tile.height * 170);
    return `rgb(${level}, ${Math.round(level * 1.03)}, ${Math.round(level * 0.95)})`;
  }
  const base = getBiomeColor(tile.biome);
  if (layer === "biomes") return base;
  return shade(base, Math.round((tile.height - 0.48) * 26));
}

export default function WorldCanvas({
  world,
  brush,
  layer,
  showRivers,
  showRoads,
  showSettlements,
  zoom,
  onBrush,
  onInspect,
}: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const size = world.config.size;
  const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  const settlementMap = useMemo(
    () => new Map(world.settlements.map((settlement) => [`${settlement.x},${settlement.y}`, settlement])),
    [world.settlements],
  );

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const draw = () => {
      const bounds = frame.getBoundingClientRect();
      const width = Math.max(320, Math.floor(bounds.width));
      const height = Math.max(320, Math.floor(bounds.height));
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#d8d2c4";
      context.fillRect(0, 0, width, height);

      const scaledWidth = width * zoom;
      const scaledHeight = height * zoom;
      const offsetX = (width - scaledWidth) / 2;
      const offsetY = (height - scaledHeight) / 2;
      const tileWidth = scaledWidth / size;
      const tileHeight = scaledHeight / size;

      context.save();
      context.beginPath();
      context.rect(0, 0, width, height);
      context.clip();
      for (const row of world.tiles) {
        for (const tile of row) {
          context.fillStyle = tileColor(tile, layer);
          context.fillRect(offsetX + tile.x * tileWidth, offsetY + tile.y * tileHeight, tileWidth + 0.6, tileHeight + 0.6);
          if (layer === "terrain" && tile.biome === "mountain" && tileWidth > 8) {
            context.strokeStyle = "rgba(31, 45, 38, 0.16)";
            context.lineWidth = 0.75;
            context.beginPath();
            context.moveTo(offsetX + tile.x * tileWidth + 1, offsetY + (tile.y + 1) * tileHeight - 1);
            context.lineTo(offsetX + (tile.x + 1) * tileWidth - 1, offsetY + tile.y * tileHeight + 1);
            context.stroke();
          }
        }
      }

      context.save();
      context.strokeStyle = "rgba(246, 241, 224, 0.28)";
      context.fillStyle = "rgba(247, 242, 227, 0.84)";
      context.font = "500 9px 'DM Mono', monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const majorStep = Math.max(8, Math.round(size / 4));
      for (let index = majorStep; index < size; index += majorStep) {
        const x = offsetX + index * tileWidth;
        const y = offsetY + index * tileHeight;
        context.setLineDash([2, 4]);
        context.beginPath();
        context.moveTo(x, offsetY + 14);
        context.lineTo(x, offsetY + scaledHeight - 14);
        context.stroke();
        context.beginPath();
        context.moveTo(offsetX + 14, y);
        context.lineTo(offsetX + scaledWidth - 14, y);
        context.stroke();
        context.setLineDash([]);
        context.fillText(String(index).padStart(2, "0"), x, offsetY + 10);
        context.save();
        context.translate(offsetX + 10, y);
        context.rotate(-Math.PI / 2);
        context.fillText(String(index).padStart(2, "0"), 0, 0);
        context.restore();
      }
      context.textAlign = "left";
      context.fillStyle = "rgba(247, 242, 227, 0.9)";
      context.fillText("N  //  00", offsetX + 18, offsetY + 23);
      context.textAlign = "right";
      context.fillText("E  //  " + String(size).padStart(2, "0"), offsetX + scaledWidth - 18, offsetY + scaledHeight - 20);
      context.restore();

      if (showRivers) {
        context.strokeStyle = "rgba(28, 88, 121, 0.92)";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = Math.max(1.5, Math.min(3.2, tileWidth * 0.34));
        for (const river of world.rivers) {
          context.beginPath();
          river.path.forEach((point, index) => {
            const x = offsetX + (point.x + 0.5) * tileWidth;
            const y = offsetY + (point.y + 0.5) * tileHeight;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.stroke();
        }
      }

      if (showRoads) {
        context.strokeStyle = "rgba(116, 73, 45, 0.78)";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = Math.max(1.4, Math.min(2.8, tileWidth * 0.25));
        for (const road of world.roads) {
          context.beginPath();
          road.path.forEach((point, index) => {
            const x = offsetX + (point.x + 0.5) * tileWidth;
            const y = offsetY + (point.y + 0.5) * tileHeight;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.stroke();
        }
      }

      if (showSettlements) {
        for (const settlement of world.settlements) {
          const x = offsetX + (settlement.x + 0.5) * tileWidth;
          const y = offsetY + (settlement.y + 0.5) * tileHeight;
          const radius = Math.max(3.5, Math.min(6, tileWidth * 0.64));
          context.fillStyle = "#f3ebdb";
          context.strokeStyle = "#263a32";
          context.lineWidth = 1.2;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          const settlementTile = world.tiles[settlement.y][settlement.x];
          if (settlementTile.spawn) {
            context.fillStyle = "#e75d2a";
            context.beginPath();
            context.moveTo(x, y - radius - 4);
            context.lineTo(x - 3.2, y - radius + 2);
            context.lineTo(x + 3.2, y - radius + 2);
            context.closePath();
            context.fill();
          }
        }
      }

      if (hoverPoint) {
        context.strokeStyle = "#e75d2a";
        context.lineWidth = 1.7;
        context.strokeRect(
          offsetX + hoverPoint.x * tileWidth + 0.7,
          offsetY + hoverPoint.y * tileHeight + 0.7,
          Math.max(2, tileWidth - 1.4),
          Math.max(2, tileHeight - 1.4),
        );
      }
      context.restore();
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [world, layer, showRivers, showRoads, showSettlements, hoverPoint, zoom, pixelRatio, size]);

  const eventToPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const scaledWidth = bounds.width * zoom;
    const scaledHeight = bounds.height * zoom;
    const x = Math.floor(((localX - (bounds.width - scaledWidth) / 2) / scaledWidth) * size);
    const y = Math.floor(((localY - (bounds.height - scaledHeight) / 2) / scaledHeight) * size);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  };

  return (
    <div className="world-canvas-frame" ref={frameRef}>
      <canvas
        ref={canvasRef}
        className="world-canvas"
        aria-label="Interactive generated world map"
        onClick={(event) => {
          const point = eventToPoint(event);
          if (point) onBrush(point);
        }}
        onMouseMove={(event) => {
          const point = eventToPoint(event);
          setHoverPoint(point);
          onInspect(point ? world.tiles[point.y][point.x] : null);
        }}
        onMouseLeave={() => {
          setHoverPoint(null);
          onInspect(null);
        }}
      />
      <div className="canvas-corner canvas-corner--top-left" />
      <div className="canvas-corner canvas-corner--bottom-right" />
      <div className="map-scale" aria-hidden="true">
        <span />
        <small>{Math.round(zoom * 100)}% VIEW</small>
      </div>
      <div className="map-tooltip" aria-live="polite">
        <span>BRUSH</span>
        <strong>{brush}</strong>
      </div>
      {settlementMap.size > 0 && <div className="map-watermark">PIXELFORGE ATLAS / C-04</div>}
    </div>
  );
}
