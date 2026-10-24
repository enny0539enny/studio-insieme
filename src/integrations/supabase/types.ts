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
      attendance: {
        Row: {
          attended: boolean
          class_event_id: string
          created_at: string
          id: string
          source: Database["public"]["Enums"]["attendance_source"]
          user_id: string
        }
        Insert: {
          attended?: boolean
          class_event_id: string
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["attendance_source"]
          user_id: string
        }
        Update: {
          attended?: boolean
          class_event_id?: string
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["attendance_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_event_id_fkey"
            columns: ["class_event_id"]
            isOneToOne: false
            referencedRelation: "class_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          user_id: string
        }
        Update: {
          chat_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          chat_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          chat_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          chat_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          ping_id: string | null
          pinned: Json
        }
        Insert: {
          created_at?: string
          id?: string
          ping_id?: string | null
          pinned?: Json
        }
        Update: {
          created_at?: string
          id?: string
          ping_id?: string | null
          pinned?: Json
        }
        Relationships: [
          {
            foreignKeyName: "chats_ping_id_fkey"
            columns: ["ping_id"]
            isOneToOne: false
            referencedRelation: "pings"
            referencedColumns: ["id"]
          },
        ]
      }
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
      course_announcements: {
        Row: {
          author_id: string | null
          body: string
          course_id: string
          created_at: string
          id: string
          source: Database["public"]["Enums"]["data_source"]
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          course_id: string
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["data_source"]
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["data_source"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_announcements_course_id_fkey"
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
      live_sessions: {
        Row: {
          activity: string
          course_id: string | null
          created_at: string
          demo_auto_accept: boolean
          ended_at: string | null
          ends_at: string
          general_subject: string
          id: string
          open_to_invitations: boolean
          place_kind: string
          subject_label: string
          user_id: string
          venue_id: string | null
        }
        Insert: {
          activity: string
          course_id?: string | null
          created_at?: string
          demo_auto_accept?: boolean
          ended_at?: string | null
          ends_at: string
          general_subject?: string
          id?: string
          open_to_invitations?: boolean
          place_kind?: string
          subject_label: string
          user_id: string
          venue_id?: string | null
        }
        Update: {
          activity?: string
          course_id?: string | null
          created_at?: string
          demo_auto_accept?: boolean
          ended_at?: string | null
          ends_at?: string
          general_subject?: string
          id?: string
          open_to_invitations?: boolean
          place_kind?: string
          subject_label?: string
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      pings: {
        Row: {
          chat_id: string | null
          created_at: string
          id: string
          live_session_id: string
          message: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["ping_status"]
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          id?: string
          live_session_id: string
          message: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["ping_status"]
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          id?: string
          live_session_id?: string
          message?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["ping_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pings_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_settings: {
        Row: {
          buffer_updated_courses: string[]
          max_hours_per_day: number
          no_study_after: string
          personal_buffer: number
          plan_generated_at: string | null
          plan_mode: string
          plan_warnings: Json
          preferred_hours: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_updated_courses?: string[]
          max_hours_per_day?: number
          no_study_after?: string
          personal_buffer?: number
          plan_generated_at?: string | null
          plan_mode?: string
          plan_warnings?: Json
          preferred_hours?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_updated_courses?: string[]
          max_hours_per_day?: number
          no_study_after?: string
          personal_buffer?: number
          plan_generated_at?: string | null
          plan_mode?: string
          plan_warnings?: Json
          preferred_hours?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          discoverable_in_matching: boolean
          leaderboard_opt_in: boolean
          map_active: boolean
          map_active_allowed: boolean
          map_consent_at: string | null
          open_to_invitations: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          discoverable_in_matching?: boolean
          leaderboard_opt_in?: boolean
          map_active?: boolean
          map_active_allowed?: boolean
          map_consent_at?: string | null
          open_to_invitations?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          discoverable_in_matching?: boolean
          leaderboard_opt_in?: boolean
          map_active?: boolean
          map_active_allowed?: boolean
          map_consent_at?: string | null
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
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_tests: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          due_at: string
          id: string
          score: number | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          due_at: string
          id?: string
          score?: number | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          due_at?: string
          id?: string
          score?: number | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_tests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "course_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      study_sessions: {
        Row: {
          course_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          looking_for: string | null
          place: string
          starts_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          looking_for?: string | null
          place: string
          starts_at: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          looking_for?: string | null
          place?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions_planned: {
        Row: {
          actual_minutes: number | null
          class_event_id: string | null
          course_id: string
          created_at: string
          ends_at: string
          id: string
          is_manual: boolean
          is_review: boolean
          kind: string
          starts_at: string
          status: Database["public"]["Enums"]["session_status"]
          topic_ids: string[]
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          class_event_id?: string | null
          course_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_manual?: boolean
          is_review?: boolean
          kind?: string
          starts_at: string
          status?: Database["public"]["Enums"]["session_status"]
          topic_ids?: string[]
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          class_event_id?: string | null
          course_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_manual?: boolean
          is_review?: boolean
          kind?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          topic_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_planned_class_event_id_fkey"
            columns: ["class_event_id"]
            isOneToOne: false
            referencedRelation: "class_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_planned_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_planned_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      venues: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          opening_hours: string | null
          suggested_by: string | null
          type: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          opening_hours?: string | null
          suggested_by?: string | null
          type?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          opening_hours?: string | null
          suggested_by?: string | null
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _create_ping_chat: { Args: { _ping_id: string }; Returns: string }
      cancel_ping: { Args: { _ping_id: string }; Returns: undefined }
      chat_partner_blocked: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      get_live_sessions: {
        Args: never
        Returns: {
          activity: string
          archetype: string
          course_id: string
          ends_at: string
          first_name: string
          general_subject: string
          is_demo: boolean
          is_mine: boolean
          open_to_invitations: boolean
          place_kind: string
          program_name: string
          program_year: number
          session_id: string
          social: number
          subject_label: string
          tags: string[]
          university_id: string
          university_name: string
          user_id: string
          venue_id: string
        }[]
      }
      get_match_candidates: {
        Args: never
        Returns: {
          archetype: string
          candidate_id: string
          first_name: string
          is_demo: boolean
          likert: Json
          looking_for: string
          next_session: Json
          shared_course_ids: string[]
          tags: string[]
          time_slots: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_chat_member: {
        Args: { _chat_id: string; _user_id: string }
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
      my_chats: {
        Args: never
        Returns: {
          chat_id: string
          last_at: string
          last_body: string
          other_archetype: string
          other_first_name: string
          other_id: string
          other_is_demo: boolean
          other_social: number
          pinned: Json
        }[]
      }
      my_pings: {
        Args: never
        Returns: {
          chat_id: string
          created_at: string
          id: string
          incoming: boolean
          message: string
          other_archetype: string
          other_first_name: string
          other_id: string
          other_is_demo: boolean
          other_social: number
          status: Database["public"]["Enums"]["ping_status"]
        }[]
      }
      respond_ping: {
        Args: { _accept: boolean; _ping_id: string }
        Returns: string
      }
      seed_demo_history: { Args: { _uid: string }; Returns: undefined }
      send_ping: { Args: { _session_id: string }; Returns: string }
      simulate_demo_reply: { Args: { _ping_id: string }; Returns: string }
      topic_peers_this_week: {
        Args: never
        Returns: {
          course_id: string
          peers: number
          topic_id: string
          topic_name: string
        }[]
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
      attendance_source: "university" | "self"
      data_source: "university" | "student"
      enrollment_role: "student" | "teacher"
      ping_status: "pending" | "accepted" | "declined" | "cancelled" | "expired"
      session_status: "planned" | "completed" | "missed"
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
      attendance_source: ["university", "self"],
      data_source: ["university", "student"],
      enrollment_role: ["student", "teacher"],
      ping_status: ["pending", "accepted", "declined", "cancelled", "expired"],
      session_status: ["planned", "completed", "missed"],
      topic_weight: ["high", "medium", "low"],
    },
  },
} as const
