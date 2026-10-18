"use client";
// Cooling: a 360 mm AIO (pump with a square display on the CPU, two sleeved tubes, the radiator under
// the slatted top with three fans), the rear exhaust fan and three front intake fans.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extrude, grid, memo, roundedRect, tube } from "./geo";
import { Assembly, Bx, Cy, Explode, Fins, G, M, useLive } from "./kit";
import { CaseFan } from "./Fans";
import { CPU, F, HEADERS } from "./Board";
import { Harness } from "./Power";

type V3 = [number, number, number];
const FITTINGS = [CPU.x - 1.15, CPU.x + 1.15];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function drawScreen(c: HTMLCanvasElement, temp: number) {
  const g = c.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#0d0e10";
  g.fillRect(0, 0, 512, 512);
  g.translate(256, 256);
  g.lineCap = "round";
  g.strokeStyle = "#23262b";
  g.lineWidth = 26;
  g.beginPath();
  g.arc(0, 0, 182, Math.PI * 0.75, Math.PI * 2.25);
  g.stroke();
  const grad = g.createLinearGradient(-180, 0, 180, 0);
  grad.addColorStop(0, "#5fc8ff");
  grad.addColorStop(1, "#d9f3ff");
  g.strokeStyle = grad;
  g.beginPath();
  g.arc(0, 0, 182, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.min(1, Math.max(0.02, (temp - 20) / 80))));
  g.stroke();
  g.strokeStyle = "#3a3e45";
  g.lineWidth = 3;
  for (let i = 0; i <= 30; i++) {
    const a = Math.PI * 0.75 + (i / 30) * Math.PI * 1.5;
    const r0 = i % 5 ? 140 : 128;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * 152, Math.sin(a) * 152);
    g.stroke();
  }
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "300 150px Arial, sans-serif";
  g.fillText(`${Math.round(temp)}°`, 14, -6);
  g.fillStyle = "#8f959e";
  g.font = "600 34px Arial, sans-serif";
  g.fillText("CPU", 0, 98);
  g.font = "500 28px Arial, sans-serif";
  g.fillText(`${Math.round(2000 + Math.max(0, temp - 30) * 18)} RPM`, 0, 196);
}
function screenTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  drawScreen(c, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Pump() {
  const live = useLive();
  const { x, y } = CPU;
  const body = memo("pump", () => extrude(roundedRect(new THREE.Shape(), -3.3, -3.3, 6.6, 6.6, 1.25), 3.2, 0.18, 24));
  const trim = memo("pumptrim", () => {
    const s = roundedRect(new THREE.Shape(), -3.0, -3.0, 6.0, 6.0, 1.05);
    s.holes.push(roundedRect(new THREE.Path(), -2.72, -2.72, 5.44, 5.44, 0.85));
    return extrude(s, 0.14, 0, 24);
  });
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ map: screenTexture(), color: "#000000" }), []);
  const off = useMemo(() => new THREE.Color("#0f1012"), []);
  const on = useMemo(() => new THREE.Color("#ffffff"), []);
  const shown = useRef(34);
  useFrame(() => {
    screen.color.copy(off).lerp(on, Math.min(1, Math.max(0, live.current.level * 1.8 - 0.3)));
    // the display reads the running workload's CPU temperature
    const temp = Math.round(live.current.temps?.cpuC ?? 34);
    if (live.current.level > 0.2 && temp !== shown.current && screen.map) {
      shown.current = temp;
      drawScreen((screen.map as THREE.CanvasTexture).image as HTMLCanvasElement, temp);
      screen.map.needsUpdate = true;
    }
  });
  const top = F + 4.2;
  return (
    <group>
      {/* mounting bracket: four arms to the socket's corners, with thumb nuts */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => (
        <group key={`${sx}${sy}`}>
          <Bx a={[x + sx * 2.6 - 0.35, y + sy * 3.2 - 0.35, F + 0.76]} b={[x + sx * 2.6 + 0.35, y + sy * 3.2 + 0.35, F + 1.3]} m={M.white} />
          <Cy p={[x + sx * 2.6, y + sy * 3.2, F + 1.5]} r={0.42} h={0.4} axis="z" m={M.soft} seg={6} />
        </group>
      ))}
      <Bx a={[x - 2.95, y - 3.55, F + 1.0]} b={[x + 2.95, y + 3.55, F + 1.25]} m={M.white} />
      <Cy p={[x, y, F + 0.89]} r={2.0} h={0.22} axis="z" m={M.copper} seg={40} />
      <G g={body} p={[x, y, F + 1.0]} m={M.white} threshold={35} />
      <G g={trim} p={[x, y, top]} m={M.soft} e={false} />
      <mesh position={[x, y, top + 0.02]} material={screen} userData={{ noTint: true }}>
        <planeGeometry args={[5.44, 5.44]} />
      </mesh>
      {/* rotary elbow fittings on the top edge, pointing up */}
      {FITTINGS.map((fx) => (
        <group key={fx}>
          <Cy p={[fx, y + 3.55, F + 2.9]} r={0.66} h={0.5} m={M.soft} seg={24} />
          <Cy p={[fx, y + 4.15, F + 2.9]} r={0.58} h={0.75} m={M.white} seg={24} />
          <Cy p={[fx, y + 4.55, F + 2.9]} r={0.66} h={0.12} m={M.soft} seg={24} />
        </group>
      ))}
    </group>
  );
}

function Tubes() {
  // up out of the pump, then forward just under the radiator fans to the front end tank
  const z0 = F + 2.9;
  const y0 = CPU.y + 4.6;
  const [xa, xb] = FITTINGS;
  const a = useMemo(() => tube([v(xa, y0, z0), v(xa, y0 + 0.6, z0 + 0.1), v(xa + 1.2, 43.1, z0 + 1.6), v(xa + 6, 43.3, -2.6), v(4, 43.35, -0.4), v(14.6, 43.35, 0.6), v(17.6, 43.6, 0.8), v(18.4, 44.8, 0.8), v(18.4, 45.7, 0.8)], 0.56, 140, 18), [xa, y0, z0]);
  const b = useMemo(() => tube([v(xb, y0, z0), v(xb, y0 + 0.55, z0 + 0.2), v(xb + 1.0, 42.3, z0 + 2.4), v(xb + 5.5, 42.25, -1.0), v(4, 42.2, 1.8), v(14.4, 42.2, 2.8), v(17.5, 42.7, 3.0), v(18.4, 44.3, 3.0), v(18.4, 45.7, 3.0)], 0.56, 140, 18), [xb, y0, z0]);
  return (
    <group>
      <G g={a} m={M.cable} threshold={60} />
      <G g={b} m={M.cable} threshold={60} />
    </group>
  );
}

/** A fan or pump lead: four thin wires ending in a 4-pin plug pressed onto a header (or into a grommet). */
function Lead({ points, header }: { points: [number, number, number][]; header?: [number, number] }) {
  const pts = useMemo(() => points.map((p) => v(...p)), [points]);
  const layout = useMemo(() => grid(1, 4, 0.11), []);
  return (
    <group>
      <Harness points={pts} layout={layout} r={0.05} up={v(0, 0, 1)} m={M.dark} />
      {header && <Bx a={[header[0] - 0.56, header[1] - 0.32, F + 0.6]} b={[header[0] + 0.56, header[1] + 0.32, F + 1.3]} m={M.dark} />}
    </group>
  );
}
const PLUG_TOP = F + 1.3;

function Radiator() {
  const channels = useMemo(() => Array.from({ length: 12 }, (_, i) => [-0.7, 47.1, -3.45 + i * 0.95] as V3), []);
  const fins = useMemo(() => Array.from({ length: 120 }, (_, i) => [-18.7 + i * 0.305, 46.75, 2.0] as V3), []);
  const tank = memo("radtank", () => extrude(roundedRect(new THREE.Shape(), -1.6 / 2, -2.75 / 2, 1.6, 2.75, 0.45), 12.4, 0.08, 12, true));
  return (
    <group>
      <Bx a={[-19.0, 46.7, -4.0]} b={[17.6, 49.3, 8.0]} m={M.grey} e={false} />
      <Fins size={[0.06, 0.1, 11.8]} positions={fins} m={M.soft} />
      <Fins size={[36.4, 0.06, 0.32]} positions={channels} m={M.white} />
      <Bx a={[-19.0, 46.6, -4.2]} b={[17.6, 49.35, -4.0]} m={M.white} />
      <Bx a={[-19.0, 46.6, 8.0]} b={[17.6, 49.35, 8.2]} m={M.white} />
      <G g={tank} p={[-19.8, 47.95, 2.0]} m={M.white} />
      <G g={tank} p={[18.4, 47.95, 2.0]} m={M.white} />
      {[0.8, 3.0].map((z) => (
        <group key={z}>
          <Cy p={[18.4, 46.15, z]} r={0.6} h={0.9} m={M.white} seg={24} />
          <Cy p={[18.4, 45.75, z]} r={0.68} h={0.2} m={M.soft} seg={24} />
        </group>
      ))}
    </group>
  );
}

export function Cooling() {
  return (
    <group>
      <Assembly id="cooler">
        {/* off the CPU first, then straight up out of the open roof */}
        <Explode by={[0, 15, 0]} from={0.3} to={0.56} id="aio">
          <Explode by={[0, 0, 1.9]} from={0.18} to={0.31}>
            <Pump />
            <Tubes />
            <Radiator />
            {[-12.9, -0.7, 11.5].map((cx, i) => (
              <CaseFan key={cx} p={[cx, 45.45, 2.0]} rot={[-Math.PI / 2, 0, 0]} phase={i * 0.7} />
            ))}
            <Lead header={HEADERS.pump} points={[[-9.8, 39.2, -7.6], [-9.2, 40.0, -7.3], [-8.95, 45.4, -7.3], [-7.0, 46.5, -8.0], [-4.4, 46.9, -8.4], [HEADERS.pump[0], HEADERS.pump[1], PLUG_TOP + 0.4], [HEADERS.pump[0], HEADERS.pump[1], PLUG_TOP]]} />
            <Lead header={HEADERS.cpuFan} points={[[-7.0, 44.6, -3.9], [-6.6, 45.2, -5.8], [-6.1, 46.4, -7.6], [HEADERS.cpuFan[0], HEADERS.cpuFan[1], PLUG_TOP + 0.4], [HEADERS.cpuFan[0], HEADERS.cpuFan[1], PLUG_TOP]]} />
          </Explode>
        </Explode>
      </Assembly>
      <Assembly id="fans">
        <Explode by={[0, 0, 12]} from={0.56} to={0.8} id="rearfan">
          <CaseFan p={[-20.65, 37.5, 1.5]} rot={[0, -Math.PI / 2, 0]} phase={0.3} />
          {/* low along the board's top edge, under the pump's lift path, to SYS_FAN1 */}
          <Lead header={HEADERS.sysFan} points={[[-20.2, 43.55, -4.3], [-19.4, 44.0, -5.6], [-18.4, 45.2, -6.6], [-17.6, 46.9, -8.4], [-17.0, 47.05, -8.6], [-11.4, 47.1, -8.6], [-10.4, 47.3, -8.75], [HEADERS.sysFan[0], HEADERS.sysFan[1], PLUG_TOP]]} />
        </Explode>
        <Explode by={[6, 0, 0]} from={0.08} to={0.36} id="frontfans">
          {[17.8, 30.0, 42.2].map((cy, i) => (
            <group key={cy}>
              <CaseFan p={[20.65, cy, 0]} rot={[0, -Math.PI / 2, 0]} phase={i * 1.1} />
              {/* down the fan's tray-side edge and into the grommet behind the fans */}
              <Lead points={[[19.55, cy - 5.7, -5.7], [18.9, cy - 5.9, -8.4], [17.9, Math.max(14.6, cy - 6.2), -10.2], [17.5 + (i - 1) * 0.3, 14.2 - i * 0.5, -10.72]]} />
            </group>
          ))}
        </Explode>
      </Assembly>
    </group>
  );
}
