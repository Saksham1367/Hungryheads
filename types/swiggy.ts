/**
 * Swiggy MCP wire types. Filled in incrementally as we wrap each tool from
 * brief §9.5. For now this file holds shared shapes used by mock fixtures.
 */

export type SwiggyServer = "food" | "instamart" | "dineout";

export interface SwiggyAddress {
  id: string;
  label: string; // "Home" / "Work" / etc.
  line1: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface SwiggyRestaurant {
  id: string;
  name: string;
  cuisines: string[];
  rating: number;
  distance_km: number;
  delivery_time_min: number;
  cost_for_two: number;
  image_url?: string;
}

export interface SwiggyMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  is_veg: boolean;
  /** Free-text tags on the item, e.g. ["contains peanuts", "spicy"]. */
  tags?: string[];
}
