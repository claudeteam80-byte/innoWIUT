// Supabase database types for the `public` schema.
//
// Mirrors supabase/migrations/*. Once a Supabase project is linked, regenerate with:
//   npx supabase gen types typescript --linked --schema public > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database['public']['Enums']['app_role'];
          email: string;
          full_name: string;
          phone: string | null;
          linkedin_url: string | null;
          notify_update_reminders: boolean;
          notify_weekly_summary: boolean;
        } & Timestamps;
        Insert: never;
        Update: {
          full_name?: string;
          phone?: string | null;
          linkedin_url?: string | null;
          notify_update_reminders?: boolean;
          notify_weekly_summary?: boolean;
        };
        Relationships: [];
      };
      startups: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          tagline: string | null;
          description: string | null;
          logo_path: string | null;
          industry: string | null;
          stage: string | null;
          website: string | null;
          founded_year: number | null;
          team_size: number | null;
          founder_role: string | null;
          has_product: boolean | null;
          has_users: boolean | null;
          has_revenue: boolean | null;
          main_goal: string | null;
          biggest_challenge: string | null;
          onboarding_completed_at: string | null;
        } & Timestamps;
        Insert: {
          name: string;
          tagline?: string | null;
          description?: string | null;
          logo_path?: string | null;
          industry?: string | null;
          stage?: string | null;
          website?: string | null;
          founded_year?: number | null;
          team_size?: number | null;
          founder_role?: string | null;
          has_product?: boolean | null;
          has_users?: boolean | null;
          has_revenue?: boolean | null;
          main_goal?: string | null;
          biggest_challenge?: string | null;
        };
        Update: Partial<Database['public']['Tables']['startups']['Insert']>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          startup_id: string;
          name: string;
          role: string | null;
          email: string | null;
          linkedin_url: string | null;
        } & Timestamps;
        Insert: {
          startup_id: string;
          name: string;
          role?: string | null;
          email?: string | null;
          linkedin_url?: string | null;
        };
        Update: {
          name?: string;
          role?: string | null;
          email?: string | null;
          linkedin_url?: string | null;
        };
        Relationships: [];
      };
      mentors: {
        Row: {
          id: string;
          name: string;
          title: string | null;
          bio: string | null;
          expertise: string[];
          email: string | null;
          contact_url: string | null;
          photo_path: string | null;
          is_active: boolean;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          name: string;
          title?: string | null;
          bio?: string | null;
          expertise?: string[];
          email?: string | null;
          contact_url?: string | null;
          photo_path?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['mentors']['Insert']>;
        Relationships: [];
      };
      mentor_assignments: {
        Row: {
          id: string;
          startup_id: string;
          mentor_id: string;
          assigned_by: string | null;
          assigned_at: string;
          ended_at: string | null;
        };
        Insert: {
          startup_id: string;
          mentor_id: string;
        };
        Update: {
          ended_at?: string | null;
        };
        Relationships: [];
      };
      mentor_notes: {
        Row: {
          id: string;
          startup_id: string;
          mentor_id: string | null;
          body: string;
          note_date: string;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          startup_id: string;
          mentor_id?: string | null;
          body: string;
          note_date?: string;
        };
        Update: {
          mentor_id?: string | null;
          body?: string;
          note_date?: string;
        };
        Relationships: [];
      };
      meeting_requests: {
        Row: {
          id: string;
          startup_id: string;
          mentor_id: string | null;
          requested_by: string | null;
          reason: string;
          message: string | null;
          preferred_date: string | null;
          status: Database['public']['Enums']['meeting_request_status'];
          admin_response: string | null;
        } & Timestamps;
        Insert: {
          startup_id: string;
          mentor_id?: string | null;
          reason: string;
          message?: string | null;
          preferred_date?: string | null;
        };
        Update: {
          status?: Database['public']['Enums']['meeting_request_status'];
          admin_response?: string | null;
        };
        Relationships: [];
      };
      startup_updates: {
        Row: {
          id: string;
          startup_id: string;
          author_id: string | null;
          title: string;
          summary: string | null;
          highlights: string[];
          challenge: string | null;
          next_steps: string | null;
          image_path: string | null;
          link_url: string | null;
          status: Database['public']['Enums']['update_status'];
          update_date: string;
          published_at: string | null;
        } & Timestamps;
        Insert: {
          startup_id: string;
          title: string;
          summary?: string | null;
          highlights?: string[];
          challenge?: string | null;
          next_steps?: string | null;
          image_path?: string | null;
          link_url?: string | null;
          status?: Database['public']['Enums']['update_status'];
          update_date?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['startup_updates']['Insert'], 'startup_id'>
        >;
        Relationships: [];
      };
      traction_metrics: {
        Row: {
          id: string;
          startup_id: string;
          name: string;
          unit: Database['public']['Enums']['metric_unit'];
          currency: Database['public']['Enums']['currency_code'] | null;
          target: number | null;
          note: string | null;
          is_archived: boolean;
          current_value: number | null;
          previous_value: number | null;
          last_recorded_on: string | null;
        } & Timestamps;
        Insert: {
          startup_id: string;
          name: string;
          unit?: Database['public']['Enums']['metric_unit'];
          currency?: Database['public']['Enums']['currency_code'] | null;
          target?: number | null;
          note?: string | null;
        };
        Update: {
          name?: string;
          unit?: Database['public']['Enums']['metric_unit'];
          currency?: Database['public']['Enums']['currency_code'] | null;
          target?: number | null;
          note?: string | null;
          is_archived?: boolean;
        };
        Relationships: [];
      };
      traction_entries: {
        Row: {
          id: string;
          metric_id: string;
          startup_id: string;
          value: number;
          recorded_on: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          metric_id: string;
          value: number;
          recorded_on?: string;
          note?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      startup_activity: {
        Row: {
          startup_id: string;
          last_update_on: string | null;
          last_traction_on: string | null;
          last_active_on: string;
          days_since_activity: number;
          activity_status: 'active' | 'needs_update' | 'inactive';
        };
        Relationships: [];
      };
    };
    Functions: {
      activity_status: {
        Args: { days_since_activity: number | null };
        Returns: string;
      };
    };
    Enums: {
      app_role: 'founder' | 'admin';
      metric_unit: 'number' | 'currency' | 'percent';
      currency_code: 'USD' | 'UZS';
      update_status: 'draft' | 'published';
      meeting_request_status: 'requested' | 'confirmed' | 'completed' | 'declined' | 'cancelled';
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type AppRole = Enums<'app_role'>;
export type Profile = Tables<'profiles'>;
export type MetricUnit = Enums<'metric_unit'>;
export type CurrencyCode = Enums<'currency_code'>;
