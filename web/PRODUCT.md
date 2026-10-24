# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. Runs locally on the warehouse device. All AI runs on-device through the QVAC SDK. Source of this decision: the grill-me session (docs/01-grill-me.md).

## Users

Primary: warehouse operators on the floor of distribution centres and warehouses with poor or no connectivity. They work with gloves, on a tablet or laptop at the dock office or a shared device, often with their hands full, in bright and noisy buildings. Jobs: ask how to do something, find stock and its location, check a delivery against a purchase order, count a shelf.

Secondary: shift supervisors, who need exceptions, inventory health and shift handover.

## Product Purpose

An offline-first assistant that answers from the warehouse's own documents and records, reads a delivery note or a shelf photo, and never invents a number. Success is fewer receiving errors, faster counts and quicker access to procedures, measured honestly. The product is built for the AI Yako (QVAC) hackathon, Offline AI apps track, and the offline demonstration is part of the deliverable.

## Positioning

The AI runs on the device in front of the operator with the network off. Quantities always come from the inventory records and never from the model. The model cannot change inventory: every write is confirmed by a person.

## Constraints

- No external network requests at runtime (no CDN fonts, analytics or remote assets). The only network use is the one-time model download.
- QVAC SDK is the only AI layer.
- CPU-only target hardware with about 8 GB RAM, so responses stream and can be stopped.
- Typeface: Poppins, bundled locally.
- Terminology: operator, supervisor, purchase order (PO), receipt, discrepancy, count, variance, exception, location (aisle, rack, shelf).

## Accessibility

Large touch targets (gloved hands), high contrast for bright environments, visible focus, status never conveyed by colour alone, reduced-motion respected.

## Open decisions

- Visual direction is decided at implementation time and recorded in DESIGN.md.
