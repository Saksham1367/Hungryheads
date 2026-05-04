/**
 * HungryHeads — Supabase Postgres types.
 *
 * Hand-rolled from `supabase/migrations/0001_init.sql` to match the brief §8
 * schema exactly. Once the Supabase CLI is connected to a real project we'll
 * regenerate this with:
 *
 *   pnpm supabase gen types typescript --project-id <id> > types/database.ts
 *
 * Until then, this file is the source of truth for Supabase row shapes and
 * stays in lockstep with the migration file by hand.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      user_preferences: {
        Row: {
          user_id: string;
          cuisines: string[];
          diet: string | null;
          monthly_budget: number | null;
          delivery_radius_km: number;
          personality: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          cuisines?: string[];
          diet?: string | null;
          monthly_budget?: number | null;
          delivery_radius_km?: number;
          personality?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          cuisines?: string[];
          diet?: string | null;
          monthly_budget?: number | null;
          delivery_radius_km?: number;
          personality?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      user_allergies: {
        Row: {
          id: string;
          user_id: string;
          allergen: string;
          severity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          allergen: string;
          severity?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          allergen?: string;
          severity?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_allergies_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      swiggy_tokens: {
        Row: {
          user_id: string;
          access_token: string;
          expires_at: string;
          scopes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          expires_at: string;
          scopes?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          access_token?: string;
          expires_at?: string;
          scopes?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "swiggy_tokens_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      orders_cache: {
        Row: {
          id: string;
          user_id: string;
          swiggy_order_id: string;
          source: string;
          total_amount: number;
          items: Json;
          restaurant_name: string | null;
          ordered_at: string;
          raw_response: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          swiggy_order_id: string;
          source: string;
          total_amount: number;
          items: Json;
          restaurant_name?: string | null;
          ordered_at: string;
          raw_response?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          swiggy_order_id?: string;
          source?: string;
          total_amount?: number;
          items?: Json;
          restaurant_name?: string | null;
          ordered_at?: string;
          raw_response?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_cache_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      huddles: {
        Row: {
          id: string;
          code: string;
          admin_id: string;
          status: string;
          mode: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          admin_id: string;
          status?: string;
          mode?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          admin_id?: string;
          status?: string;
          mode?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "huddles_admin_id_fkey";
            columns: ["admin_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      huddle_members: {
        Row: {
          huddle_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          huddle_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          huddle_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "huddle_members_huddle_id_fkey";
            columns: ["huddle_id"];
            referencedRelation: "huddles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "huddle_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      huddle_responses: {
        Row: {
          id: string;
          huddle_id: string;
          user_id: string;
          cuisines: string[] | null;
          mood: string | null;
          veg_only: boolean | null;
          budget: number | null;
          max_distance: number | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          huddle_id: string;
          user_id: string;
          cuisines?: string[] | null;
          mood?: string | null;
          veg_only?: boolean | null;
          budget?: number | null;
          max_distance?: number | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          huddle_id?: string;
          user_id?: string;
          cuisines?: string[] | null;
          mood?: string | null;
          veg_only?: boolean | null;
          budget?: number | null;
          max_distance?: number | null;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "huddle_responses_huddle_id_fkey";
            columns: ["huddle_id"];
            referencedRelation: "huddles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "huddle_responses_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      huddle_recommendations: {
        Row: {
          id: string;
          huddle_id: string;
          rank: number;
          swiggy_id: string;
          name: string;
          cuisines: string[] | null;
          rating: number | null;
          distance_km: number | null;
          reasoning: string | null;
          raw_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          huddle_id: string;
          rank: number;
          swiggy_id: string;
          name: string;
          cuisines?: string[] | null;
          rating?: number | null;
          distance_km?: number | null;
          reasoning?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          huddle_id?: string;
          rank?: number;
          swiggy_id?: string;
          name?: string;
          cuisines?: string[] | null;
          rating?: number | null;
          distance_km?: number | null;
          reasoning?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "huddle_recommendations_huddle_id_fkey";
            columns: ["huddle_id"];
            referencedRelation: "huddles";
            referencedColumns: ["id"];
          },
        ];
      };

      agent_conversations: {
        Row: {
          id: string;
          user_id: string;
          messages: Json;
          context: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          messages: Json;
          context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          messages?: Json;
          context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_conversations_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_huddle_member: {
        Args: { p_huddle_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_huddle_admin: {
        Args: { p_huddle_id: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience row aliases — keeps app code readable.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
