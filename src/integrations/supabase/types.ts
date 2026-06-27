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
      ads: {
        Row: {
          created_at: string
          generated_description: string | null
          generated_title: string | null
          id: string
          inventory_id: string | null
          photos: string[]
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_description?: string | null
          generated_title?: string | null
          id?: string
          inventory_id?: string | null
          photos?: string[]
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_description?: string | null
          generated_title?: string | null
          id?: string
          inventory_id?: string | null
          photos?: string[]
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          citta: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          note: string | null
          paese: string | null
          piattaforma: string | null
          preferito: boolean
          tags: string[]
          telefono: string | null
          tipo: string
          totale_speso: number
          totale_transazioni: number
          ultimo_contatto: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          citta?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          note?: string | null
          paese?: string | null
          piattaforma?: string | null
          preferito?: boolean
          tags?: string[]
          telefono?: string | null
          tipo?: string
          totale_speso?: number
          totale_transazioni?: number
          ultimo_contatto?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          citta?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          paese?: string | null
          piattaforma?: string | null
          preferito?: boolean
          tags?: string[]
          telefono?: string | null
          tipo?: string
          totale_speso?: number
          totale_transazioni?: number
          ultimo_contatto?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          campi_spuntati: Json
          categoria: string | null
          categoria_prodotto: string | null
          codice_tracciamento: string | null
          costo_acquisto: number | null
          costo_spedizione: number | null
          costo_spedizione_valore: number | null
          created_at: string
          data_acquisto: string | null
          data_vendita: string | null
          descrizione: string | null
          descrizioni_piattaforma: Json
          destinazione: string | null
          fee_piattaforma: number | null
          fonte_acquisto: string | null
          foto_url: string | null
          id: string
          margine_profitto: number | null
          mese_acquisto: string | null
          mese_vendita: string | null
          nome_oggetto: string | null
          note: string | null
          piattaforma_vendita: string | null
          posizione_inventario: string | null
          prezzo_vendita: number | null
          prezzo_vendita_valore: number | null
          profitto: number | null
          ricavi_netti: number | null
          soldi_persi: number | null
          spedizione: string | null
          stato_prodotto: string
          tasse: number | null
          titoli_piattaforma: Json
          titolo: string | null
          updated_at: string
          user_id: string
          zona_acquisto: string | null
        }
        Insert: {
          campi_spuntati?: Json
          categoria?: string | null
          categoria_prodotto?: string | null
          codice_tracciamento?: string | null
          costo_acquisto?: number | null
          costo_spedizione?: number | null
          costo_spedizione_valore?: number | null
          created_at?: string
          data_acquisto?: string | null
          data_vendita?: string | null
          descrizione?: string | null
          descrizioni_piattaforma?: Json
          destinazione?: string | null
          fee_piattaforma?: number | null
          fonte_acquisto?: string | null
          foto_url?: string | null
          id?: string
          margine_profitto?: number | null
          mese_acquisto?: string | null
          mese_vendita?: string | null
          nome_oggetto?: string | null
          note?: string | null
          piattaforma_vendita?: string | null
          posizione_inventario?: string | null
          prezzo_vendita?: number | null
          prezzo_vendita_valore?: number | null
          profitto?: number | null
          ricavi_netti?: number | null
          soldi_persi?: number | null
          spedizione?: string | null
          stato_prodotto: string
          tasse?: number | null
          titoli_piattaforma?: Json
          titolo?: string | null
          updated_at?: string
          user_id: string
          zona_acquisto?: string | null
        }
        Update: {
          campi_spuntati?: Json
          categoria?: string | null
          categoria_prodotto?: string | null
          codice_tracciamento?: string | null
          costo_acquisto?: number | null
          costo_spedizione?: number | null
          costo_spedizione_valore?: number | null
          created_at?: string
          data_acquisto?: string | null
          data_vendita?: string | null
          descrizione?: string | null
          descrizioni_piattaforma?: Json
          destinazione?: string | null
          fee_piattaforma?: number | null
          fonte_acquisto?: string | null
          foto_url?: string | null
          id?: string
          margine_profitto?: number | null
          mese_acquisto?: string | null
          mese_vendita?: string | null
          nome_oggetto?: string | null
          note?: string | null
          piattaforma_vendita?: string | null
          posizione_inventario?: string | null
          prezzo_vendita?: number | null
          prezzo_vendita_valore?: number | null
          profitto?: number | null
          ricavi_netti?: number | null
          soldi_persi?: number | null
          spedizione?: string | null
          stato_prodotto?: string
          tasse?: number | null
          titoli_piattaforma?: Json
          titolo?: string | null
          updated_at?: string
          user_id?: string
          zona_acquisto?: string | null
        }
        Relationships: []
      }
      inventory_template_fields: {
        Row: {
          categoria_prodotto: string | null
          costo_spedizione: number | null
          created_at: string
          data_vendita: string | null
          destinazione: string | null
          id: string
          inventory_item_id: string | null
          mese_vendita: string | null
          nome_oggetto: string | null
          prezzo_vendita: number | null
          spedizione: string | null
          stato_prodotto: string | null
          tasse: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria_prodotto?: string | null
          costo_spedizione?: number | null
          created_at?: string
          data_vendita?: string | null
          destinazione?: string | null
          id?: string
          inventory_item_id?: string | null
          mese_vendita?: string | null
          nome_oggetto?: string | null
          prezzo_vendita?: number | null
          spedizione?: string | null
          stato_prodotto?: string | null
          tasse?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria_prodotto?: string | null
          costo_spedizione?: number | null
          created_at?: string
          data_vendita?: string | null
          destinazione?: string | null
          id?: string
          inventory_item_id?: string | null
          mese_vendita?: string | null
          nome_oggetto?: string | null
          prezzo_vendita?: number | null
          spedizione?: string | null
          stato_prodotto?: string | null
          tasse?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_template_fields_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: true
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_accounts: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          platform: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          platform: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          platform?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          plan: string
          telegram_notifications: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          plan?: string
          telegram_notifications?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          plan?: string
          telegram_notifications?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
