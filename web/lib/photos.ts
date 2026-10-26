import type { StaticImageData } from "next/image";
import type { Role } from "./auth/capabilities";

import amina from "@/assets/people/amina.jpg";
import brian from "@/assets/people/brian.jpg";
import chebet from "@/assets/people/chebet.jpg";
import daniel from "@/assets/people/daniel.jpg";
import esther from "@/assets/people/esther.jpg";
import kevin from "@/assets/people/kevin.jpg";

import askTablet from "@/assets/photos/ask-tablet.jpg";
import blueRacks from "@/assets/photos/blue-racks.jpg";
import boxesPile from "@/assets/photos/boxes-pile.jpg";
import busyFloor from "@/assets/photos/busy-floor.jpg";
import checklist from "@/assets/photos/checklist.jpg";
import containers from "@/assets/photos/containers.jpg";
import controllerTablet from "@/assets/photos/controller-tablet.jpg";
import controllerTablet2 from "@/assets/photos/controller-tablet-2.jpg";
import countBins from "@/assets/photos/count-bins.jpg";
import darkShelves from "@/assets/photos/dark-shelves.jpg";
import floorTeam from "@/assets/photos/floor-team.jpg";
import forkliftAisle from "@/assets/photos/forklift-aisle.jpg";
import forkliftTruck from "@/assets/photos/forklift-truck.jpg";
import handingBox from "@/assets/photos/handing-box.jpg";
import handoverClipboard from "@/assets/photos/handover-clipboard.jpg";
import heroAisle from "@/assets/photos/hero-aisle.jpg";
import logisticsPort from "@/assets/photos/logistics-port.jpg";
import operatorShelf from "@/assets/photos/operator-shelf.jpg";
import receiveDock from "@/assets/photos/receive-dock.jpg";
import safetyGear from "@/assets/photos/safety-gear.jpg";
import supervisorUniform from "@/assets/photos/supervisor-uniform.jpg";
import trailersDock from "@/assets/photos/trailers-dock.jpg";
import voiceForklift from "@/assets/photos/voice-forklift.jpg";
import yellowFloor from "@/assets/photos/yellow-floor.jpg";

/** Bundled Unsplash photography (see assets/CREDITS.md). Served locally, never fetched at runtime. */
export const photos = {
  askTablet,
  blueRacks,
  boxesPile,
  busyFloor,
  checklist,
  containers,
  controllerTablet,
  controllerTablet2,
  countBins,
  darkShelves,
  floorTeam,
  forkliftAisle,
  forkliftTruck,
  handingBox,
  handoverClipboard,
  heroAisle,
  logisticsPort,
  operatorShelf,
  receiveDock,
  safetyGear,
  supervisorUniform,
  trailersDock,
  voiceForklift,
  yellowFloor,
} satisfies Record<string, StaticImageData>;

const people: Record<string, StaticImageData> = { amina, brian, chebet, daniel, esther, kevin };

export function avatarFor(username: string | undefined): StaticImageData | null {
  return (username && people[username]) || null;
}

export const rolePhoto: Record<Role, { src: StaticImageData; alt: string }> = {
  operator: { src: photos.operatorShelf, alt: "An operator in a hard hat checking a box on a shelf" },
  supervisor: { src: photos.floorTeam, alt: "A team walking through a busy warehouse aisle" },
  inventory_controller: { src: photos.controllerTablet, alt: "An inventory controller counting stock with a tablet" },
  logistics_manager: { src: photos.logisticsPort, alt: "Two logistics staff with a tablet at a container yard" },
};

/** One photo per screen, so every tile and banner shows the work it is about. */
export const screenPhoto: Record<string, StaticImageData> = {
  "/ask": photos.askTablet,
  "/voice": photos.voiceForklift,
  "/safety": photos.safetyGear,
  "/receive": photos.receiveDock,
  "/count": photos.countBins,
  "/dispatch": photos.forkliftTruck,
  "/handover": photos.handoverClipboard,
  "/supervisor": photos.busyFloor,
  "/health": photos.boxesPile,
  "/approvals": photos.controllerTablet2,
  "/reconciliation": photos.controllerTablet2,
  "/stock": photos.blueRacks,
  "/count-plan": photos.forkliftAisle,
  "/shipments": photos.containers,
  "/accuracy": photos.trailersDock,
  "/compliance": photos.checklist,
  "/readiness": photos.darkShelves,
};
