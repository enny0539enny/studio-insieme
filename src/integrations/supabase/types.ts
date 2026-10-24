export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      class_events: {
        Row: {
          course_id: string
          ends_at: string
          id: string
          room: string | null
          source: Database["public"]["Enums"]["data_source"]
          starts_at: string
        }
        Insert: {
          course_id: string
          ends_at: string
          id?: string
          room?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          starts_at: string
        }
        Update: {
          course_id?: string
          ends_at?: string
          id?: string
          room?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          course_id: string
          created_at: string
          file_path: string | null
          id: string
          source: Database["public"]["Enums"]["data_source"]
          title: string
          topic_id: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          course_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          source?: Database["public"]["Enums"]["data_source"]
          title: string
          topic_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          source?: Database["public"]["Enums"]["data_source"]
          title?: string
          topic_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "course_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      course_professors: {
        Row: {
          course_id: string
          email: string
          full_name: string
          id: string
          profile_id: string | null
          source: Database["public"]["Enums"]["data_source"]
        }
        Insert: {
          course_id: string
          email: string
          full_name: string
          id?: string
          profile_id?: string | null
          source?: Database["public"]["Enums"]["data_source"]
        }
        Update: {
          course_id?: string
          email?: string
          full_name?: string
          id?: string
          profile_id?: string | null
          source?: Database["public"]["Enums"]["data_source"]
        }
        Relationships: [
          {
            foreignKeyName: "course_professors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_professors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_topics: {
        Row: {
          course_id: string
          id: string
          name: string
          sort_order: number
          source: Database["public"]["Enums"]["data_source"]
          weight: Database["public"]["Enums"]["topic_weight"]
        }
        Insert: {
          course_id: string
          id?: string
          name: string
          sort_order?: number
          source?: Database["public"]["Enums"]["data_source"]
          weight?: Database["public"]["Enums"]["topic_weight"]
        }
        Update: {
          course_id?: string
          id?: string
          name?: string
          sort_order?: number
          source?: Database["public"]["Enums"]["data_source"]
          weight?: Database["public"]["Enums"]["topic_weight"]
        }
        Relationships: [
          {
            foreignKeyName: "course_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          class_hours: number | null
          code: string | null
          credits: number
          degree_program_id: string | null
          id: string
          name: string
          program_year: number | null
          semester: number
          source: Database["public"]["Enums"]["data_source"]
          university_id: string
        }
        Insert: {
          class_hours?: number | null
          code?: string | null
          credits: number
          degree_program_id?: string | null
          id?: string
          name: string
          program_year?: number | null
          semester: number
          source?: Database["public"]["Enums"]["data_source"]
          university_id: string
        }
        Update: {
          class_hours?: number | null
          code?: string | null
          credits?: number
          degree_program_id?: string | null
          id?: string
          name?: string
          program_year?: number | null
          semester?: number
          source?: Database["public"]["Enums"]["data_source"]
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_degree_program_id_fkey"
            columns: ["degree_program_id"]
            isOneToOne: false
            referencedRelation: "degree_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      degree_programs: {
        Row: {
          id: string
          level: string | null
          name: string
          source: Database["public"]["Enums"]["data_source"]
          university_id: string
        }
        Insert: {
          id?: string
          level?: string | null
          name: string
          source?: Database["public"]["Enums"]["data_source"]
          university_id: string
        }
        Update: {
          id?: string
          level?: string | null
          name?: string
          source?: Database["public"]["Enums"]["data_source"]
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "degree_programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          id: string
          role: Database["public"]["Enums"]["enrollment_role"]
          source: Database["public"]["Enums"]["data_source"]
          user_id: string
        }
        Insert: {
          course_id: string
          id?: string
          role?: Database["public"]["Enums"]["enrollment_role"]
          source?: Database["public"]["Enums"]["data_source"]
          user_id: string
        }
        Update: {
          course_id?: string
          id?: string
          role?: Database["public"]["Enums"]["enrollment_role"]
          source?: Database["public"]["Enums"]["data_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          exam_date: string
          id: string
          kind: string
          room: string | null
          source: Database["public"]["Enums"]["data_source"]
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          exam_date: string
          id?: string
          kind?: string
          room?: string | null
          source?: Database["public"]["Enums"]["data_source"]
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          exam_date?: string
          id?: string
          kind?: string
          room?: string | null
          source?: Database["public"]["Enums"]["data_source"]
        }
        Relationships: [
          {
            foreignKeyName: "exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          discoverable_in_matching: boolean
          leaderboard_opt_in: boolean
          map_active: boolean
          open_to_invitations: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          discoverable_in_matching?: boolean
          leaderboard_opt_in?: boolean
          map_active?: boolean
          open_to_invitations?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          discoverable_in_matching?: boolean
          leaderboard_opt_in?: boolean
          map_active?: boolean
          open_to_invitations?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          degree_program_id: string | null
          email: string | null
          full_name: string
          id: string
          is_demo: boolean
          program_year: number | null
          university_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          degree_program_id?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_demo?: boolean
          program_year?: number | null
          university_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          degree_program_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_demo?: boolean
          program_year?: number | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_degree_program_id_fkey"
            columns: ["degree_program_id"]
            isOneToOne: false
            referencedRelation: "degree_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          archetype: string | null
          bio: string | null
          exam_scenario: string | null
          group_size: string | null
          languages: string[]
          likert_answers: Json
          living_situation: string | null
          looking_for: string | null
          onboarding_completed: boolean
          photo_url: string | null
          places: string[]
          tags: string[]
          time_slots: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype?: string | null
          bio?: string | null
          exam_scenario?: string | null
          group_size?: string | null
          languages?: string[]
          likert_answers?: Json
          living_situation?: string | null
          looking_for?: string | null
          onboarding_completed?: boolean
          photo_url?: string | null
          places?: string[]
          tags?: string[]
          time_slots?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype?: string | null
          bio?: string | null
          exam_scenario?: string | null
          group_size?: string | null
          languages?: string[]
          likert_answers?: Json
          living_situation?: string | null
          looking_for?: string | null
          onboarding_completed?: boolean
          photo_url?: string | null
          places?: string[]
          tags?: string[]
          time_slots?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          short_name: string | null
          source: Database["public"]["Enums"]["data_source"]
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          short_name?: string | null
          source?: Database["public"]["Enums"]["data_source"]
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          short_name?: string | null
          source?: Database["public"]["Enums"]["data_source"]
        }
        Relationships: []
      }
      university_email_domains: {
        Row: {
          domain: string
          university_id: string
        }
        Insert: {
          domain: string
          university_id: string
        }
        Update: {
          domain?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_email_domains_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_teacher: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
      data_source: "university" | "student"
      enrollment_role: "student" | "teacher"
      topic_weight: "high" | "medium" | "low"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin"],
      data_source: ["university", "student"],
      enrollment_role: ["student", "teacher"],
      topic_weight: ["high", "medium", "low"],
    },
  },
} as const
