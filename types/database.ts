/**
 * HungryHeads — Supabase Postgres types.
 *
 * Hand-rolled to match `supabase/migrations/0001_init.sql` and
 * `0002_chat_and_persistent_huddles.sql`. Once Supabase CLI is connected to
 * your project we can regenerate via:
 *
 *   pnpm supabase gen types typescript --project-id <id> > types/database.ts
 *
 * Until then, treat the SQL migrations and this file as a pair — edit both
 * together.
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

      // ────────────────────────────────────────────────────────────────────
      // CHAT (added in 0002)
      // ────────────────────────────────────────────────────────────────────
      chats: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          mode: string; // 'hungry' | 'diet' | 'budget'
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          mode?: string;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          mode?: string;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chats_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      chat_messages: {
        Row: {
          id: string;
          chat_id: string;
          role: string; // 'user' | 'agent' | 'system'
          content: string;
          mode_at_send: string;
          payload: Json | null;
          tool_calls: Json | null;
          learned_fact: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          role: string;
          content?: string;
          mode_at_send?: string;
          payload?: Json | null;
          tool_calls?: Json | null;
          learned_fact?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          role?: string;
          content?: string;
          mode_at_send?: string;
          payload?: Json | null;
          tool_calls?: Json | null;
          learned_fact?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey";
            columns: ["chat_id"];
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
        ];
      };

      chat_shares: {
        Row: {
          id: string;
          chat_id: string;
          shared_by: string;
          token: string;
          title: string;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          shared_by: string;
          token: string;
          title: string;
          snapshot: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          shared_by?: string;
          token?: string;
          title?: string;
          snapshot?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_shares_chat_id_fkey";
            columns: ["chat_id"];
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
        ];
      };

      agent_memory: {
        Row: {
          id: string;
          user_id: string;
          fact: string;
          source_chat_id: string | null;
          confidence: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fact: string;
          source_chat_id?: string | null;
          confidence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          fact?: string;
          source_chat_id?: string | null;
          confidence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_memory_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_memory_source_chat_id_fkey";
            columns: ["source_chat_id"];
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
        ];
      };

      // ────────────────────────────────────────────────────────────────────
      // HUDDLES — persistent groups, modified in 0002
      // ────────────────────────────────────────────────────────────────────
      huddles: {
        Row: {
          id: string;
          code: string;
          name: string | null;
          admin_id: string;
          status: string;
          mode: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name?: string | null;
          admin_id: string;
          status?: string;
          mode?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string | null;
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

      huddle_sessions: {
        Row: {
          id: string;
          huddle_id: string;
          triggered_by: string;
          status: string; // 'polling' | 'decided' | 'ordered' | 'cancelled'
          mode: string | null; // 'order_in' | 'dine_out'
          winner_recommendation_id: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          huddle_id: string;
          triggered_by: string;
          status?: string;
          mode?: string | null;
          winner_recommendation_id?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          huddle_id?: string;
          triggered_by?: string;
          status?: string;
          mode?: string | null;
          winner_recommendation_id?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "huddle_sessions_huddle_id_fkey";
            columns: ["huddle_id"];
            referencedRelation: "huddles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "huddle_sessions_triggered_by_fkey";
            columns: ["triggered_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      huddle_responses: {
        Row: {
          id: string;
          huddle_session_id: string;
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
          huddle_session_id: string;
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
          huddle_session_id?: string;
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
            foreignKeyName: "huddle_responses_huddle_session_id_fkey";
            columns: ["huddle_session_id"];
            referencedRelation: "huddle_sessions";
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
          huddle_session_id: string;
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
          huddle_session_id: string;
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
          huddle_session_id?: string;
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
            foreignKeyName: "huddle_recommendations_huddle_session_id_fkey";
            columns: ["huddle_session_id"];
            referencedRelation: "huddle_sessions";
            referencedColumns: ["id"];
          },
        ];
      };

      huddle_orders: {
        Row: {
          id: string;
          huddle_id: string;
          session_id: string | null;
          placed_by: string;
          swiggy_order_id: string | null;
          restaurant_name: string | null;
          total_amount: number;
          items: Json;
          ordered_at: string;
        };
        Insert: {
          id?: string;
          huddle_id: string;
          session_id?: string | null;
          placed_by: string;
          swiggy_order_id?: string | null;
          restaurant_name?: string | null;
          total_amount: number;
          items: Json;
          ordered_at?: string;
        };
        Update: {
          id?: string;
          huddle_id?: string;
          session_id?: string | null;
          placed_by?: string;
          swiggy_order_id?: string | null;
          restaurant_name?: string | null;
          total_amount?: number;
          items?: Json;
          ordered_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "huddle_orders_huddle_id_fkey";
            columns: ["huddle_id"];
            referencedRelation: "huddles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "huddle_orders_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "huddle_sessions";
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
