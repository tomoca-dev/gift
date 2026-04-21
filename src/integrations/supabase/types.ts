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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      },
      branches: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      },
      gift_campaigns: {
        Row: {
          active: boolean
          created_at: string
          end_at: string | null
          id: string
          name: string
          start_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_at?: string | null
          id?: string
          name: string
          start_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          end_at?: string | null
          id?: string
          name?: string
          start_at?: string | null
        }
        Relationships: []
      },
      gift_qr_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          recipient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          recipient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          recipient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_qr_sessions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "gift_recipients"
            referencedColumns: ["id"]
          },
        ]
      },
      gift_recipients: {
        Row: {
          branch_id: string | null
          campaign_id: string | null
          claimed_at: string | null
          created_at: string
          gift_type: string
          id: string
          import_batch_id: string | null
          phone_normalized: string
          phone_raw: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          campaign_id?: string | null
          claimed_at?: string | null
          created_at?: string
          gift_type: string
          id?: string
          import_batch_id?: string | null
          phone_normalized: string
          phone_raw?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          campaign_id?: string | null
          claimed_at?: string | null
          created_at?: string
          gift_type?: string
          id?: string
          import_batch_id?: string | null
          phone_normalized?: string
          phone_raw?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_recipients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "gift_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_recipients_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      },
      import_batches: {
        Row: {
          created_at: string
          duplicate_rows: number
          id: string
          invalid_rows: number
          original_filename: string | null
          suspicious_rows: number
          total_rows: number
          uploaded_by: string | null
          valid_rows: number
        }
        Insert: {
          created_at?: string
          duplicate_rows?: number
          id?: string
          invalid_rows?: number
          original_filename?: string | null
          suspicious_rows?: number
          total_rows?: number
          uploaded_by?: string | null
          valid_rows?: number
        }
        Update: {
          created_at?: string
          duplicate_rows?: number
          id?: string
          invalid_rows?: number
          original_filename?: string | null
          suspicious_rows?: number
          total_rows?: number
          uploaded_by?: string | null
          valid_rows?: number
        }
        Relationships: []
      },
      reward_customers: {
        Row: {
          claim_expires_at: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          id: string
          import_source: string | null
          imported_by: string | null
          phone: string
          redeemed_at: string | null
          redeemed_by: string | null
          redemption_code: string
          reward_type: string
          status: string
          store_name: string | null
          updated_at: string
        }
        Insert: {
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          import_source?: string | null
          imported_by?: string | null
          phone: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          redemption_code?: string
          reward_type?: string
          status?: string
          store_name?: string | null
          updated_at?: string
        }
        Update: {
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          import_source?: string | null
          imported_by?: string | null
          phone?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          redemption_code?: string
          reward_type?: string
          status?: string
          store_name?: string | null
          updated_at?: string
        }
        Relationships: []
      },
      staff_profiles: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      },
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      claim_reward_by_phone: {
        Args: {
          input_phone: string
        }
        Returns: {
          customer_id: string | null
          message: string
          phone: string | null
          qr_expires_at: string | null
          qr_token: string | null
          redemption_code: string | null
          reward_type: string | null
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_reward_qr: {
        Args: {
          input_code: string
        }
        Returns: {
          customer_id: string | null
          message: string
          phone: string | null
          redeemed_at: string | null
          redemption_code: string | null
          reward_type: string | null
          status: string
        }[]
      }
      validate_reward_qr: {
        Args: {
          input_code: string
        }
        Returns: {
          customer_id: string | null
          message: string
          phone: string | null
          qr_expires_at: string | null
          redemption_code: string | null
          reward_type: string | null
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "cashier"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "cashier"],
    },
  },
} as const
