export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      admin_role_events: {
        Row: {
          changed_by: string | null;
          changed_by_email: string | null;
          created_at: string;
          id: string;
          new_role: Database['public']['Enums']['app_role'];
          previous_role: Database['public']['Enums']['app_role'];
          target_email: string;
          target_user_id: string | null;
        };
        Insert: {
          changed_by?: string | null;
          changed_by_email?: string | null;
          created_at?: string;
          id?: string;
          new_role: Database['public']['Enums']['app_role'];
          previous_role: Database['public']['Enums']['app_role'];
          target_email: string;
          target_user_id?: string | null;
        };
        Update: {
          changed_by?: string | null;
          changed_by_email?: string | null;
          created_at?: string;
          id?: string;
          new_role?: Database['public']['Enums']['app_role'];
          previous_role?: Database['public']['Enums']['app_role'];
          target_email?: string;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_role_events_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admin_role_events_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_requests: {
        Row: {
          admin_response: string | null;
          created_at: string;
          id: string;
          mentor_id: string | null;
          message: string | null;
          preferred_date: string | null;
          reason: string;
          requested_by: string | null;
          startup_id: string;
          status: Database['public']['Enums']['meeting_request_status'];
          updated_at: string;
        };
        Insert: {
          admin_response?: string | null;
          created_at?: string;
          id?: string;
          mentor_id?: string | null;
          message?: string | null;
          preferred_date?: string | null;
          reason: string;
          requested_by?: string | null;
          startup_id: string;
          status?: Database['public']['Enums']['meeting_request_status'];
          updated_at?: string;
        };
        Update: {
          admin_response?: string | null;
          created_at?: string;
          id?: string;
          mentor_id?: string | null;
          message?: string | null;
          preferred_date?: string | null;
          reason?: string;
          requested_by?: string | null;
          startup_id?: string;
          status?: Database['public']['Enums']['meeting_request_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_requests_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'mentors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_requests_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_requests_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'meeting_requests_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      mentor_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          ended_at: string | null;
          id: string;
          mentor_id: string;
          startup_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          ended_at?: string | null;
          id?: string;
          mentor_id: string;
          startup_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          ended_at?: string | null;
          id?: string;
          mentor_id?: string;
          startup_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mentor_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentor_assignments_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'mentors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentor_assignments_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'mentor_assignments_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      mentor_notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          mentor_id: string | null;
          note_date: string;
          startup_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mentor_id?: string | null;
          note_date?: string;
          startup_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mentor_id?: string | null;
          note_date?: string;
          startup_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mentor_notes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentor_notes_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'mentors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentor_notes_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'mentor_notes_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      mentors: {
        Row: {
          bio: string | null;
          contact_url: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          expertise: string[];
          id: string;
          is_active: boolean;
          linkedin_url: string | null;
          name: string;
          photo_path: string | null;
          telegram: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          contact_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expertise?: string[];
          id?: string;
          is_active?: boolean;
          linkedin_url?: string | null;
          name: string;
          photo_path?: string | null;
          telegram?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          contact_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expertise?: string[];
          id?: string;
          is_active?: boolean;
          linkedin_url?: string | null;
          name?: string;
          photo_path?: string | null;
          telegram?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mentors_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          notify_update_reminders: boolean;
          notify_weekly_summary: boolean;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          linkedin_url?: string | null;
          notify_update_reminders?: boolean;
          notify_weekly_summary?: boolean;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          linkedin_url?: string | null;
          notify_update_reminders?: boolean;
          notify_weekly_summary?: boolean;
          phone?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      stage_evidence: {
        Row: {
          created_at: string;
          created_by: string | null;
          evidence_type: Database['public']['Enums']['evidence_type'];
          file_path: string | null;
          id: string;
          label: string;
          linked_metric_id: string | null;
          requirement_id: string | null;
          stage: Database['public']['Enums']['startup_stage'];
          startup_id: string;
          text_value: string | null;
          update_id: string | null;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          evidence_type: Database['public']['Enums']['evidence_type'];
          file_path?: string | null;
          id?: string;
          label: string;
          linked_metric_id?: string | null;
          requirement_id?: string | null;
          stage: Database['public']['Enums']['startup_stage'];
          startup_id: string;
          text_value?: string | null;
          update_id?: string | null;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          evidence_type?: Database['public']['Enums']['evidence_type'];
          file_path?: string | null;
          id?: string;
          label?: string;
          linked_metric_id?: string | null;
          requirement_id?: string | null;
          stage?: Database['public']['Enums']['startup_stage'];
          startup_id?: string;
          text_value?: string | null;
          update_id?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stage_evidence_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stage_evidence_linked_metric_id_fkey';
            columns: ['linked_metric_id'];
            isOneToOne: false;
            referencedRelation: 'traction_metrics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stage_evidence_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'startup_stage_requirements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stage_evidence_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'stage_evidence_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stage_evidence_update_id_fkey';
            columns: ['update_id'];
            isOneToOne: false;
            referencedRelation: 'startup_updates';
            referencedColumns: ['id'];
          },
        ];
      };
      startup_stage_requirements: {
        Row: {
          completed_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          linked_metric_id: string | null;
          progress_target: number | null;
          progress_value: number | null;
          required: boolean;
          requirement_key: string;
          stage: Database['public']['Enums']['startup_stage'];
          startup_id: string;
          status: Database['public']['Enums']['requirement_status'];
          title: string;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          linked_metric_id?: string | null;
          progress_target?: number | null;
          progress_value?: number | null;
          required?: boolean;
          requirement_key: string;
          stage: Database['public']['Enums']['startup_stage'];
          startup_id: string;
          status?: Database['public']['Enums']['requirement_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          linked_metric_id?: string | null;
          progress_target?: number | null;
          progress_value?: number | null;
          required?: boolean;
          requirement_key?: string;
          stage?: Database['public']['Enums']['startup_stage'];
          startup_id?: string;
          status?: Database['public']['Enums']['requirement_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'startup_stage_requirements_linked_metric_id_fkey';
            columns: ['linked_metric_id'];
            isOneToOne: false;
            referencedRelation: 'traction_metrics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'startup_stage_requirements_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'startup_stage_requirements_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      startup_updates: {
        Row: {
          author_id: string | null;
          blocker: string | null;
          challenge: string | null;
          created_at: string;
          highlights: string[];
          id: string;
          image_path: string | null;
          link_url: string | null;
          linked_stage: Database['public']['Enums']['startup_stage'] | null;
          next_milestone: string | null;
          next_milestone_date: string | null;
          next_steps: string | null;
          progress_types: string[];
          published_at: string | null;
          startup_id: string;
          status: Database['public']['Enums']['update_status'];
          summary: string | null;
          title: string;
          update_date: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          blocker?: string | null;
          challenge?: string | null;
          created_at?: string;
          highlights?: string[];
          id?: string;
          image_path?: string | null;
          link_url?: string | null;
          linked_stage?: Database['public']['Enums']['startup_stage'] | null;
          next_milestone?: string | null;
          next_milestone_date?: string | null;
          next_steps?: string | null;
          progress_types?: string[];
          published_at?: string | null;
          startup_id: string;
          status?: Database['public']['Enums']['update_status'];
          summary?: string | null;
          title: string;
          update_date?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          blocker?: string | null;
          challenge?: string | null;
          created_at?: string;
          highlights?: string[];
          id?: string;
          image_path?: string | null;
          link_url?: string | null;
          linked_stage?: Database['public']['Enums']['startup_stage'] | null;
          next_milestone?: string | null;
          next_milestone_date?: string | null;
          next_steps?: string | null;
          progress_types?: string[];
          published_at?: string | null;
          startup_id?: string;
          status?: Database['public']['Enums']['update_status'];
          summary?: string | null;
          title?: string;
          update_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'startup_updates_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'startup_updates_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'startup_updates_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      startups: {
        Row: {
          biggest_challenge: string | null;
          created_at: string;
          description: string | null;
          founded_year: number | null;
          founder_role: string | null;
          has_product: boolean | null;
          has_revenue: boolean | null;
          has_users: boolean | null;
          id: string;
          industry: string | null;
          journey_stage: Database['public']['Enums']['startup_stage'];
          logo_path: string | null;
          main_goal: string | null;
          name: string;
          onboarding_completed_at: string | null;
          owner_id: string;
          stage: string | null;
          tagline: string | null;
          team_size: number | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          biggest_challenge?: string | null;
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          founder_role?: string | null;
          has_product?: boolean | null;
          has_revenue?: boolean | null;
          has_users?: boolean | null;
          id?: string;
          industry?: string | null;
          journey_stage?: Database['public']['Enums']['startup_stage'];
          logo_path?: string | null;
          main_goal?: string | null;
          name: string;
          onboarding_completed_at?: string | null;
          owner_id?: string;
          stage?: string | null;
          tagline?: string | null;
          team_size?: number | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          biggest_challenge?: string | null;
          created_at?: string;
          description?: string | null;
          founded_year?: number | null;
          founder_role?: string | null;
          has_product?: boolean | null;
          has_revenue?: boolean | null;
          has_users?: boolean | null;
          id?: string;
          industry?: string | null;
          journey_stage?: Database['public']['Enums']['startup_stage'];
          logo_path?: string | null;
          main_goal?: string | null;
          name?: string;
          onboarding_completed_at?: string | null;
          owner_id?: string;
          stage?: string | null;
          tagline?: string | null;
          team_size?: number | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'startups_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      team_members: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          linkedin_url: string | null;
          name: string;
          role: string | null;
          startup_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          linkedin_url?: string | null;
          name: string;
          role?: string | null;
          startup_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          linkedin_url?: string | null;
          name?: string;
          role?: string | null;
          startup_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'team_members_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      traction_entries: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          metric_id: string;
          note: string | null;
          recorded_on: string;
          startup_id: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          metric_id: string;
          note?: string | null;
          recorded_on?: string;
          startup_id: string;
          value: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          metric_id?: string;
          note?: string | null;
          recorded_on?: string;
          startup_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'traction_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'traction_entries_metric_id_fkey';
            columns: ['metric_id'];
            isOneToOne: false;
            referencedRelation: 'traction_metrics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'traction_entries_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'traction_entries_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
      traction_metrics: {
        Row: {
          created_at: string;
          currency: Database['public']['Enums']['currency_code'] | null;
          current_value: number | null;
          id: string;
          is_archived: boolean;
          last_recorded_on: string | null;
          name: string;
          note: string | null;
          previous_value: number | null;
          startup_id: string;
          target: number | null;
          unit: Database['public']['Enums']['metric_unit'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: Database['public']['Enums']['currency_code'] | null;
          current_value?: number | null;
          id?: string;
          is_archived?: boolean;
          last_recorded_on?: string | null;
          name: string;
          note?: string | null;
          previous_value?: number | null;
          startup_id: string;
          target?: number | null;
          unit?: Database['public']['Enums']['metric_unit'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: Database['public']['Enums']['currency_code'] | null;
          current_value?: number | null;
          id?: string;
          is_archived?: boolean;
          last_recorded_on?: string | null;
          name?: string;
          note?: string | null;
          previous_value?: number | null;
          startup_id?: string;
          target?: number | null;
          unit?: Database['public']['Enums']['metric_unit'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'traction_metrics_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startup_activity';
            referencedColumns: ['startup_id'];
          },
          {
            foreignKeyName: 'traction_metrics_startup_id_fkey';
            columns: ['startup_id'];
            isOneToOne: false;
            referencedRelation: 'startups';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      startup_activity: {
        Row: {
          activity_status: string | null;
          days_since_activity: number | null;
          last_active_on: string | null;
          last_traction_on: string | null;
          last_update_on: string | null;
          startup_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      activity_status: {
        Args: { days_since_activity: number };
        Returns: string;
      };
      add_traction_metric: {
        Args: {
          p_currency?: Database['public']['Enums']['currency_code'];
          p_initial_value?: number;
          p_name: string;
          p_note?: string;
          p_recorded_on?: string;
          p_target?: number;
          p_unit: Database['public']['Enums']['metric_unit'];
        };
        Returns: {
          created_at: string;
          currency: Database['public']['Enums']['currency_code'] | null;
          current_value: number | null;
          id: string;
          is_archived: boolean;
          last_recorded_on: string | null;
          name: string;
          note: string | null;
          previous_value: number | null;
          startup_id: string;
          target: number | null;
          unit: Database['public']['Enums']['metric_unit'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'traction_metrics';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_access_list: {
        Args: never;
        Returns: {
          added_at: string;
          email: string;
          full_name: string;
          id: string;
          last_sign_in_at: string;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      admin_dashboard_stats: {
        Args: never;
        Returns: {
          active_startups: number;
          growing_startups: number;
          inactive_startups: number;
          needs_update_startups: number;
          open_meeting_requests: number;
          total_startups: number;
          unassigned_startups: number;
          updates_this_week: number;
        }[];
      };
      admin_find_user: {
        Args: { p_email: string };
        Returns: {
          email: string;
          full_name: string;
          id: string;
          owns_startup: boolean;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      admin_stage_distribution: {
        Args: never;
        Returns: {
          stage: Database['public']['Enums']['startup_stage'];
          startups: number;
        }[];
      };
      admin_startup_list: {
        Args: {
          p_activity?: string;
          p_industry?: string;
          p_limit?: number;
          p_mentor?: string;
          p_offset?: number;
          p_search?: string;
          p_sort?: string;
          p_stage?: string;
        };
        Returns: {
          activity_status: string;
          created_at: string;
          days_since_activity: number;
          founder_email: string;
          founder_name: string;
          growth_percent: number;
          id: string;
          industry: string;
          journey_stage: Database['public']['Enums']['startup_stage'];
          last_active_on: string;
          logo_path: string;
          mentor_id: string;
          mentor_name: string;
          name: string;
          primary_metric_currency: Database['public']['Enums']['currency_code'];
          primary_metric_name: string;
          primary_metric_previous: number;
          primary_metric_unit: Database['public']['Enums']['metric_unit'];
          primary_metric_value: number;
          stage: string;
          tagline: string;
          total_count: number;
        }[];
      };
      assign_mentor: {
        Args: { p_mentor_id: string; p_startup_id: string };
        Returns: {
          assigned_at: string;
          assigned_by: string | null;
          ended_at: string | null;
          id: string;
          mentor_id: string;
          startup_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'mentor_assignments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      complete_onboarding: { Args: { payload: Json }; Returns: string };
      delete_mentor: { Args: { p_mentor_id: string }; Returns: string };
      end_mentor_assignment: {
        Args: { p_startup_id: string };
        Returns: boolean;
      };
      grant_admin_access: {
        Args: { p_email: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          notify_update_reminders: boolean;
          notify_weekly_summary: boolean;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      promote_to_superadmin: {
        Args: { p_confirm_email: string; p_user_id: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          notify_update_reminders: boolean;
          notify_weekly_summary: boolean;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_traction: {
        Args: { p_entries: Json; p_note?: string; p_recorded_on?: string };
        Returns: {
          created_at: string;
          currency: Database['public']['Enums']['currency_code'] | null;
          current_value: number | null;
          id: string;
          is_archived: boolean;
          last_recorded_on: string | null;
          name: string;
          note: string | null;
          previous_value: number | null;
          startup_id: string;
          target: number | null;
          unit: Database['public']['Enums']['metric_unit'];
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'traction_metrics';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      revoke_admin_access: {
        Args: { p_confirm_self?: boolean; p_user_id: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          notify_update_reminders: boolean;
          notify_weekly_summary: boolean;
          phone: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: 'founder' | 'admin' | 'superadmin';
      currency_code: 'USD' | 'UZS';
      evidence_type:
        | 'link'
        | 'screenshot'
        | 'document'
        | 'metric'
        | 'customer_feedback'
        | 'product_url'
        | 'text_note';
      meeting_request_status: 'requested' | 'confirmed' | 'completed' | 'declined' | 'cancelled';
      metric_unit: 'number' | 'currency' | 'percent';
      requirement_status: 'not_started' | 'in_progress' | 'ready_for_review' | 'completed';
      startup_stage:
        'idea' | 'validation' | 'mvp' | 'traction' | 'investor_readiness' | 'investor_access';
      update_status: 'draft' | 'published';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['founder', 'admin', 'superadmin'],
      currency_code: ['USD', 'UZS'],
      evidence_type: [
        'link',
        'screenshot',
        'document',
        'metric',
        'customer_feedback',
        'product_url',
        'text_note',
      ],
      meeting_request_status: ['requested', 'confirmed', 'completed', 'declined', 'cancelled'],
      metric_unit: ['number', 'currency', 'percent'],
      requirement_status: ['not_started', 'in_progress', 'ready_for_review', 'completed'],
      startup_stage: [
        'idea',
        'validation',
        'mvp',
        'traction',
        'investor_readiness',
        'investor_access',
      ],
      update_status: ['draft', 'published'],
    },
  },
} as const;
