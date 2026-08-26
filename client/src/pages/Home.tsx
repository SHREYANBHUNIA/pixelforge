/** PixelForge style: Cartographer's Workbench — asymmetric controls around a tactile, data-rich world map. */

import { useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  Compass,
  Download,
  FileUp,
  Grid2X2,
  Layers3,
  Map as MapIcon,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Paintbrush,
  Play,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trees,
  Undo2,
  Workflow,
} from "lucide-react";
import WorldCanvas, { type MapLayer } from "@/components/WorldCanvas";
import {
  applyBrush,
  configFromJSON,
  DEFAULT_CONFIG,
  generateWorld,
  type Brush,
  type Tile,
  type World,
  type WorldConfig,
} from "@/lib/world-generator";

const brushOptions: { id: Brush; label: string; icon: typeof Trees }[] = [
  { id: "forest", label: "Forest", icon: Trees },
  { id: "grassland", label: "Terrain", icon: Paintbrush },
  { id: "water", label: "Water", icon: Activity },
  { id: "road", label: "Road", icon: Route },
  { id: "village", label: "Village", icon: MapIcon },
  { id: "erase", label: "Erase", icon: Minus },
];

const presetConfigs: { name: string; copy: string; config: Partial<WorldConfig> }[] = [
  { name: "Verdant", copy: "Deep forests / wide rivers", config: { rainfall: 0.72, roughness: 0.58 } },
  { name: "Highland", copy: "Alpine ridges / hard routes", config: { roughness: 0.92, seaLevel: 0.26 } },
  { name: "Archipelago", copy: "Broken coast / sparse land", config: { seaLevel: 0.38, roughness: 0.67 } },
];

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control-field">
      <span className="control-label">
        {label}
        <strong>
          {suffix === "%" ? Math.round(value * 100) : value}
          {suffix}
        </strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToolButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active?: boolean;
  label: string;
  icon: typeof Trees;
  onClick: () => void;
}) {
  return (
    <button className={`tool-button ${active ? "is-active" : ""}`} onClick={onClick} type="button" aria-label={label} title={label}>
      <Icon size={17} strokeWidth={1.7} />
      <span>{label}</span>
    </button>
  );
}

export default function Home() {
  const [config, setConfig] = useState<WorldConfig>(DEFAULT_CONFIG);
  const [world, setWorld] = useState<World>(() => generateWorld(DEFAULT_CONFIG));
  const [history, setHistory] = useState<World[]>([]);
  const [brush, setBrush] = useState<Brush>("forest");
  const [layer, setLayer] = useState<MapLayer>("terrain");
  const [showRivers, setShowRivers] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showSettlements, setShowSettlements] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [inspectedTile, setInspectedTile] = useState<Tile | null>(null);
  const [activity, setActivity] = useState<string[]>([
    "Seed normalized and deterministic streams initialized.",
    "Terrain, watercourses, settlements, and routes are indexed by chunks.",
    "Validation engine inspected connectivity before releasing the atlas.",
  ]);
  const fileInput = useRef<HTMLInputElement>(null);

  const updateConfig = (change: Partial<WorldConfig>) => setConfig((current) => ({ ...current, ...change }));

  const generate = (nextConfig = config) => {
    const fresh = generateWorld(nextConfig);
    setConfig(nextConfig);
    setHistory((current) => [...current.slice(-8), world]);
    setWorld(fresh);
    setActivity((current) => [
      `World ${String(nextConfig.seed).padStart(6, "0")} rebuilt across ${fresh.stats.chunks} streamed chunks.`,
      fresh.stats.repairs
        ? `Validation repaired ${fresh.stats.repairs} problematic terrain region${fresh.stats.repairs > 1 ? "s" : ""}.`
        : "Validation accepted the initial generated topology without repairs.",
      ...current.slice(0, 2),
    ]);
  };

  const randomizeSeed = () => {
    const next = { ...config, seed: Math.floor(Math.random() * 900000) + 100000 };
    generate(next);
  };

  const editWorld = (point: { x: number; y: number }) => {
    const edited = applyBrush(world, point, brush);
    setHistory((current) => [...current.slice(-8), world]);
    setWorld(edited);
    setActivity((current) => [`${brush} brush applied at coordinate ${point.x}, ${point.y}. Validation rechecked.`, ...current.slice(0, 2)]);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setWorld(last);
    setConfig(last.config);
    setHistory((current) => current.slice(0, -1));
    setActivity((current) => ["Restored the preceding atlas state.", ...current.slice(0, 2)]);
  };

  const exportWorld = () => {
    const data = JSON.stringify(world, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pixelforge-${world.config.seed}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setActivity((current) => [`Serialized world ${world.config.seed} to JSON.`, ...current.slice(0, 2)]);
  };

  const importWorld = async (file?: File) => {
    if (!file) return;
    try {
      const imported = configFromJSON(JSON.parse(await file.text()));
      if (!imported) throw new Error("File does not contain a PixelForge world.");
      setHistory((current) => [...current.slice(-8), world]);
      setWorld(imported);
      setConfig(imported.config);
      setActivity((current) => [`Imported world ${imported.config.seed} and reran validation.`, ...current.slice(0, 2)]);
    } catch {
      setActivity((current) => ["Import rejected: select a valid PixelForge world JSON file.", ...current.slice(0, 2)]);
    }
  };

  const validationCount = world.validation.issues.filter((issue) => issue.state === "pass").length;

  return (
    <div className="pf-shell">
      <aside className="pf-rail" aria-label="Primary application navigation">
        <button className="pf-logo" type="button" aria-label="PixelForge home" title="PixelForge">
          <span className="logo-contour logo-contour--one" />
          <span className="logo-contour logo-contour--two" />
          <span className="logo-crosshair" />
        </button>
        <nav className="rail-nav" aria-label="Workbench areas">
          <button className="rail-button is-current" type="button" title="World editor"><MapIcon size={19} /></button>
          <button className="rail-button" type="button" title="Generator settings"><Settings2 size={19} /></button>
          <button className="rail-button" type="button" title="World layers"><Layers3 size={19} /></button>
          <button className="rail-button" type="button" title="Path network"><Route size={19} /></button>
        </nav>
        <div className="rail-bottom">
          <button className="rail-button" type="button" title="Validation"><ShieldCheck size={19} /></button>
          <button className="rail-button" type="button" title="More options"><MoreHorizontal size={19} /></button>
        </div>
      </aside>

      <main className="pf-main">
        <header className="pf-header">
          <div className="headline-block">
            <div className="eyebrow"><span className="live-dot" /> PROCEDURAL WORLD WORKBENCH <span className="eyebrow-rule" /> LIVE EDITOR</div>
            <div className="page-heading">
              <div>
                <h1><span className="pixel-word">Pixel</span><span className="forge-word">Forge</span></h1>
                <p>Shape a world that can explain itself.</p>
              </div>
              <div className="world-ident"><small>ACTIVE ATLAS</small><strong>SEED · {world.config.seed}</strong></div>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-action" type="button" onClick={undo} disabled={!history.length} title="Undo last world change"><Undo2 size={17} /></button>
            <button className="quiet-action" type="button" onClick={exportWorld}><Download size={15} /> EXPORT</button>
            <button className="quiet-action" type="button" onClick={() => fileInput.current?.click()}><FileUp size={15} /> IMPORT</button>
            <button className="generate-action" type="button" onClick={() => generate()}><Sparkles size={16} /> GENERATE WORLD</button>
            <input ref={fileInput} type="file" accept="application/json" className="sr-only" onChange={(event) => importWorld(event.target.files?.[0])} />
          </div>
        </header>

        <section className="workbench-grid">
          <aside className="left-instrument-column">
            <section className="paper-panel parameter-panel">
              <div className="panel-title"><span>01 / WORLD PARAMETERS</span><Settings2 size={16} /></div>
              <div className="seed-control">
                <label htmlFor="seed">WORLD SEED</label>
                <div>
                  <input id="seed" type="number" value={config.seed} onChange={(event) => updateConfig({ seed: Number(event.target.value) })} />
                  <button type="button" onClick={randomizeSeed} title="Generate a fresh seed"><RefreshCcw size={15} /></button>
                </div>
              </div>
              <SliderField label="Landmass" value={config.seaLevel} min={0.22} max={0.42} step={0.01} suffix="%" onChange={(value) => updateConfig({ seaLevel: value })} />
              <SliderField label="Relief" value={config.roughness} min={0.35} max={1} step={0.01} suffix="%" onChange={(value) => updateConfig({ roughness: value })} />
              <SliderField label="Rainfall" value={config.rainfall} min={0.2} max={0.9} step={0.01} suffix="%" onChange={(value) => updateConfig({ rainfall: value })} />
              <div className="select-field">
                <span>WORLD SCALE</span>
                <div className="select-wrap">
                  <select value={config.size} onChange={(event) => updateConfig({ size: Number(event.target.value) })}>
                    <option value={48}>Local · 48×48</option>
                    <option value={64}>Regional · 64×64</option>
                    <option value={80}>Continental · 80×80</option>
                  </select>
                  <ChevronDown size={15} />
                </div>
              </div>
              <button className="sample-seed" type="button" onClick={randomizeSeed}><RefreshCcw size={14} /> SAMPLE ANOTHER SEED</button>
            </section>

            <section className="paper-panel preset-panel">
              <div className="panel-title"><span>02 / MAP INTENT</span><Compass size={16} /></div>
              <div className="preset-list">
                {presetConfigs.map((preset) => (
                  <button key={preset.name} type="button" onClick={() => generate({ ...config, ...preset.config })}>
                    <span><strong>{preset.name}</strong><small>{preset.copy}</small></span>
                    <Play size={13} fill="currentColor" />
                  </button>
                ))}
              </div>
            </section>

            <section className="coordinate-card">
              <div><span>CHUNK INDEX</span><strong>04 / 04</strong></div>
              <div><span>SPAWN</span><strong>{world.settlements[0] ? `${world.settlements[0].x}, ${world.settlements[0].y}` : "—"}</strong></div>
              <div><span>LOCAL TILE</span><strong>{inspectedTile ? `${inspectedTile.x}, ${inspectedTile.y}` : "HOVER MAP"}</strong></div>
            </section>
          </aside>

          <section className="map-column">
            <div className="map-topbar">
              <div className="map-tabs" role="tablist" aria-label="Map visualization">
                {(["terrain", "height", "biomes"] as MapLayer[]).map((item) => (
                  <button key={item} type="button" className={layer === item ? "is-active" : ""} onClick={() => setLayer(item)}>{item === "terrain" ? "Terrain" : item === "height" ? "Elevation" : "Biomes"}</button>
                ))}
              </div>
              <div className="map-tools">
                <button type="button" className={zoom <= 0.8 ? "is-muted" : ""} onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.15).toFixed(2))))}><Minus size={15} /></button>
                <span>{Math.round(zoom * 100)}%</span>
                <button type="button" className={zoom >= 1.4 ? "is-muted" : ""} onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.15).toFixed(2))))}><Plus size={15} /></button>
                <button type="button" className="grid-tool" onClick={() => setZoom(1)} title="Reset zoom"><Grid2X2 size={14} /></button>
              </div>
            </div>
            <WorldCanvas world={world} brush={brush} layer={layer} showRivers={showRivers} showRoads={showRoads} showSettlements={showSettlements} zoom={zoom} onBrush={editWorld} onInspect={setInspectedTile} />
            <div className="map-footer">
              <div><span className="legend-swatch legend-swatch--forest" /> FOREST <span className="legend-swatch legend-swatch--water" /> WATER <span className="legend-swatch legend-swatch--road" /> ROAD <span className="legend-swatch legend-swatch--village" /> SETTLEMENT</div>
              <div>GRID RESOLUTION <strong>{world.config.size} × {world.config.size}</strong></div>
            </div>
          </section>

          <aside className="right-instrument-column">
            <section className="paper-panel health-panel">
              <div className="panel-title"><span>03 / WORLD HEALTH</span><span className={`validation-badge ${world.validation.valid ? "is-valid" : "is-warning"}`}>{world.validation.valid ? "VALID" : "CHECK"}</span></div>
              <div className="health-score"><strong>{validationCount}<small>/6</small></strong><span>validation gates passed</span></div>
              <div className="validation-list">
                {world.validation.issues.map((issue) => (
                  <div className={`validation-row ${issue.state}`} key={issue.id}>
                    <span>{issue.state === "pass" ? "✓" : "!"}</span>
                    <div><strong>{issue.label}</strong><small>{issue.detail}</small></div>
                  </div>
                ))}
              </div>
              <div className="repair-note"><Workflow size={15} /><span><strong>{world.stats.repairs ? `${world.stats.repairs} repair pass${world.stats.repairs > 1 ? "es" : ""}` : "Initial pass clean"}</strong> · problematic regions are repaired before release.</span></div>
            </section>

            <section className="paper-panel layers-panel">
              <div className="panel-title"><span>04 / LAYER CONTROL</span><Layers3 size={16} /></div>
              <label><span><i className="layer-dot river-dot" /> Watercourses</span><input type="checkbox" checked={showRivers} onChange={(event) => setShowRivers(event.target.checked)} /></label>
              <label><span><i className="layer-dot road-dot" /> Road network</span><input type="checkbox" checked={showRoads} onChange={(event) => setShowRoads(event.target.checked)} /></label>
              <label><span><i className="layer-dot village-dot" /> Settlements</span><input type="checkbox" checked={showSettlements} onChange={(event) => setShowSettlements(event.target.checked)} /></label>
            </section>

            <section className="paper-panel composition-panel">
              <div className="panel-title"><span>05 / COMPOSITION</span><Activity size={16} /></div>
              <div className="composition-grid">
                <div><span>LAND</span><strong>{world.stats.landPercent}%</strong></div>
                <div><span>FOREST</span><strong>{world.stats.forestPercent}%</strong></div>
                <div><span>RIDGES</span><strong>{world.stats.mountainPercent}%</strong></div>
                <div><span>WATER</span><strong>{world.stats.waterPercent}%</strong></div>
              </div>
              <div className="composition-foot"><span>{world.stats.settlements} settlements</span><span>{world.stats.rivers} rivers</span><span>{world.stats.roads} roads</span></div>
            </section>
          </aside>
        </section>

        <section className="bottom-dock">
          <div className="tool-dock">
            <span className="dock-label"><MousePointer2 size={14} /> EDITOR TOOL</span>
            {brushOptions.map((option) => <ToolButton key={option.id} active={brush === option.id} label={option.label} icon={option.icon} onClick={() => setBrush(option.id)} />)}
          </div>
          <div className="activity-readout">
            <span className="dock-label"><Save size={14} /> GENERATOR LOG</span>
            <p>{activity[0]}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
