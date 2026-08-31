export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          slot: number
          role: 'admin' | 'user'
          status: 'pending' | 'active' | 'denied'
          avatar_color: string
          created_at: string
        }
        Insert: {
          id: string
          username: string
          slot: number
          role?: 'admin' | 'user'
          status?: 'pending' | 'active' | 'denied'
          avatar_color?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          slot?: number
          role?: 'admin' | 'user'
          status?: 'pending' | 'active' | 'denied'
          avatar_color?: string
          created_at?: string
        }
      }
      months: {
        Row: {
          id: string
          label: string
          is_closed: boolean
          opening_balances: Json
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          is_closed?: boolean
          opening_balances?: Json
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          is_closed?: boolean
          opening_balances?: Json
          closed_at?: string | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          month_id: string
          paid_by: string
          category: 'rent' | 'internet' | 'maid' | 'electricity' | 'gas' | 'misc' | 'grocery'
          description: string | null
          amount: number
          paid_full: boolean
          split_type: 'even' | 'custom'
          split_details: Json
          paid_by_details: Json
          is_advance: boolean
          advance_for_month: string | null
          created_at: string
        }
        Insert: {
          id?: string
          month_id: string
          paid_by: string
          category: 'rent' | 'internet' | 'maid' | 'electricity' | 'gas' | 'misc' | 'grocery'
          description?: string | null
          amount: number
          paid_full?: boolean
          split_type?: 'even' | 'custom'
          split_details?: Json
          paid_by_details?: Json
          is_advance?: boolean
          advance_for_month?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          month_id?: string
          paid_by?: string
          category?: 'rent' | 'internet' | 'maid' | 'electricity' | 'gas' | 'misc' | 'grocery'
          description?: string | null
          amount?: number
          paid_full?: boolean
          split_type?: 'even' | 'custom'
          split_details?: Json
          paid_by_details?: Json
          is_advance?: boolean
          advance_for_month?: string | null
          created_at?: string
        }
      }
      meals: {
        Row: {
          id: string
          user_id: string
          month_id: string
          date: string
          count: number
          guest_count: number
        }
        Insert: {
          id?: string
          user_id: string
          month_id: string
          date: string
          count: number
          guest_count?: number
        }
        Update: {
          id?: string
          user_id?: string
          month_id?: string
          date?: string
          count?: number
          guest_count?: number
        }
      }
      settlements: {
        Row: {
          id: string
          month_id: string
          from_user: string
          to_user: string
          amount: number
          note: string | null
          settled_by_admin: boolean
          settled_at: string
        }
        Insert: {
          id?: string
          month_id: string
          from_user: string
          to_user: string
          amount: number
          note?: string | null
          settled_by_admin?: boolean
          settled_at?: string
        }
        Update: {
          id?: string
          month_id?: string
          from_user?: string
          to_user?: string
          amount?: number
          note?: string | null
          settled_by_admin?: boolean
          settled_at?: string
        }
      }
      edit_requests: {
        Row: {
          id: string
          requested_by: string
          month_id: string
          description: string
          status: 'pending' | 'approved' | 'denied'
          admin_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requested_by: string
          month_id: string
          description: string
          status?: 'pending' | 'approved' | 'denied'
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requested_by?: string
          month_id?: string
          description?: string
          status?: 'pending' | 'approved' | 'denied'
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          name: string
          tag: string
          phone_numbers: string[]
          is_flatmate: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tag: string
          phone_numbers: string[]
          is_flatmate?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tag?: string
          phone_numbers?: string[]
          is_flatmate?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      servers: {
        Row: {
          id: string
          name: string
          url: string
          description: string | null
          category: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          description?: string | null
          category?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          description?: string | null
          category?: string
          created_at?: string
          updated_at?: string
        }
      }
      password_resets: {
        Row: {
          id: string
          user_id: string
          status: 'pending' | 'approved' | 'denied' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'pending' | 'approved' | 'denied' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'pending' | 'approved' | 'denied' | 'completed'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

