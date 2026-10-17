import { NextResponse } from "next/server";
import { BOARDS, CPUS, GAMES, GPUS, SOURCES } from "@/components/pc-anatomy/data/catalog";

// The parts catalogue and the measured game data, as the drawer and the overlay fetch them.
export function GET() {
  return NextResponse.json({ gpus: GPUS, cpus: CPUS, boards: BOARDS, games: GAMES.map(({ id, name, genre }) => ({ id, name, genre })), sources: SOURCES }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
