import type { Role } from "./capabilities";

export interface DemoAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
}

/**
 * Seeded demo accounts. These are demo values for synthetic data only and are shown on the
 * sign-in page on purpose so every persona can be tried. Set DEMO_ACCOUNTS=off to hide them.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: "o-amina", name: "Amina Otieno", username: "amina", password: "Operator@123", role: "operator" },
  { id: "o-brian", name: "Brian Mwangi", username: "brian", password: "Operator@123", role: "operator" },
  { id: "o-chebet", name: "Chebet Kiprop", username: "chebet", password: "Operator@123", role: "operator" },
  { id: "o-daniel", name: "Daniel Odhiambo", username: "daniel", password: "Supervisor@123", role: "supervisor" },
  { id: "o-esther", name: "Esther Wanjiru", username: "esther", password: "Controller@123", role: "inventory_controller" },
  { id: "o-kevin", name: "Kevin Mutua", username: "kevin", password: "Logistics@123", role: "logistics_manager" },
];

/** One featured login per persona, in the order shown on the sign-in page. */
export const FEATURED_USERNAMES = ["amina", "daniel", "esther", "kevin"];
