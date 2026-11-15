
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ads": {
                  Row: {
                    "advertiser_id": string | null,"body": string | null,"countries": (string)[],"cta": string | null,"ended_at": string | null,"est_spend_high": number | null,"est_spend_low": number | null,"eu_total_reach": number | null,"external_id": string,"first_seen_at": string,"fts": unknown,"id": string,"is_active": boolean,"landing_domain": string | null,"landing_url": string | null,"languages": (string)[],"media_type": string | null,"media_urls": (string)[],"platform": Database["public"]['Enums']["ad_platform"],"raw": Json | null,"shop_id": string | null,"snapshot_url": string | null,"started_at": string | null,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advertiser_id"?: string | null,"body"?: string | null,"countries"?: (string)[],"cta"?: string | null,"ended_at"?: string | null,"est_spend_high"?: number | null,"est_spend_low"?: number | null,"eu_total_reach"?: number | null,"external_id": string,"first_seen_at"?: string,"fts"?: never,"id"?: string,"is_active"?: boolean,"landing_domain"?: string | null,"landing_url"?: string | null,"languages"?: (string)[],"media_type"?: string | null,"media_urls"?: (string)[],"platform": Database["public"]['Enums']["ad_platform"],"raw"?: Json | null,"shop_id"?: string | null,"snapshot_url"?: string | null,"started_at"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "advertiser_id"?: string | null,"body"?: string | null,"countries"?: (string)[],"cta"?: string | null,"ended_at"?: string | null,"est_spend_high"?: number | null,"est_spend_low"?: number | null,"eu_total_reach"?: number | null,"external_id"?: string,"first_seen_at"?: string,"fts"?: never,"id"?: string,"is_active"?: boolean,"landing_domain"?: string | null,"landing_url"?: string | null,"languages"?: (string)[],"media_type"?: string | null,"media_urls"?: (string)[],"platform"?: Database["public"]['Enums']["ad_platform"],"raw"?: Json | null,"shop_id"?: string | null,"snapshot_url"?: string | null,"started_at"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ads_advertiser_id_fkey"
      columns: ["advertiser_id"]
isOneToOne: false
      referencedRelation: "advertisers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ads_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"advertisers": {
                  Row: {
                    "country": string | null,"first_seen_at": string,"id": string,"last_synced_at": string | null,"page_id": string,"page_name": string | null,"platform": Database["public"]['Enums']["ad_platform"],"shop_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string | null,"first_seen_at"?: string,"id"?: string,"last_synced_at"?: string | null,"page_id": string,"page_name"?: string | null,"platform": Database["public"]['Enums']["ad_platform"],"shop_id"?: string | null
                  }
                  Update: {
                    "country"?: string | null,"first_seen_at"?: string,"id"?: string,"last_synced_at"?: string | null,"page_id"?: string,"page_name"?: string | null,"platform"?: Database["public"]['Enums']["ad_platform"],"shop_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "advertisers_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"api_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"key_hash": string,"last_used_at": string | null,"name": string,"prefix": string,"revoked_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash": string,"last_used_at"?: string | null,"name": string,"prefix": string,"revoked_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash"?: string,"last_used_at"?: string | null,"name"?: string,"prefix"?: string,"revoked_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_keys_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"emails": {
                  Row: {
                    "created_at": string,"flow_step": number | null,"from_address": string,"html_storage_path": string | null,"id": string,"message_id": string | null,"preheader": string | null,"received_at": string,"seed_inbox_id": string | null,"shop_id": string,"subject": string | null,"text_preview": string | null,"to_address": string | null,"type": Database["public"]['Enums']["email_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"flow_step"?: number | null,"from_address": string,"html_storage_path"?: string | null,"id"?: string,"message_id"?: string | null,"preheader"?: string | null,"received_at": string,"seed_inbox_id"?: string | null,"shop_id": string,"subject"?: string | null,"text_preview"?: string | null,"to_address"?: string | null,"type"?: Database["public"]['Enums']["email_type"]
                  }
                  Update: {
                    "created_at"?: string,"flow_step"?: number | null,"from_address"?: string,"html_storage_path"?: string | null,"id"?: string,"message_id"?: string | null,"preheader"?: string | null,"received_at"?: string,"seed_inbox_id"?: string | null,"shop_id"?: string,"subject"?: string | null,"text_preview"?: string | null,"to_address"?: string | null,"type"?: Database["public"]['Enums']["email_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "emails_seed_inbox_id_fkey"
      columns: ["seed_inbox_id"]
isOneToOne: false
      referencedRelation: "seed_inboxes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emails_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"folder_items": {
                  Row: {
                    "added_by": string | null,"created_at": string,"folder_id": string,"id": string,"item_id": string,"item_type": Database["public"]['Enums']["folder_item_type"],"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"folder_id": string,"id"?: string,"item_id": string,"item_type": Database["public"]['Enums']["folder_item_type"],"note"?: string | null
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"folder_id"?: string,"id"?: string,"item_id"?: string,"item_type"?: Database["public"]['Enums']["folder_item_type"],"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "folder_items_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"folders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"share_token": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"share_token"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"share_token"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inbound_rejects": {
                  Row: {
                    "from_address": string | null,"id": number,"reason": string,"received_at": string,"subject": string | null,"to_addresses": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "from_address"?: string | null,"id"?: never,"reason": string,"received_at"?: string,"subject"?: string | null,"to_addresses": (string)[]
                  }
                  Update: {
                    "from_address"?: string | null,"id"?: never,"reason"?: string,"received_at"?: string,"subject"?: string | null,"to_addresses"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"plans": {
                  Row: {
                    "id": string,"is_public": boolean,"limits": NonNullable<Json>,"monthly_price_cents": number,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"is_public"?: boolean,"limits"?: NonNullable<Json>,"monthly_price_cents"?: number,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"is_public"?: boolean,"limits"?: NonNullable<Json>,"monthly_price_cents"?: number,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"product_snapshots": {
                  Row: {
                    "available_variants": number | null,"captured_on": string,"inventory_signal": Json | null,"position_in_bestsellers": number | null,"price": number | null,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available_variants"?: number | null,"captured_on": string,"inventory_signal"?: Json | null,"position_in_bestsellers"?: number | null,"price"?: number | null,"product_id": string
                  }
                  Update: {
                    "available_variants"?: number | null,"captured_on"?: string,"inventory_signal"?: Json | null,"position_in_bestsellers"?: number | null,"price"?: number | null,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_snapshots_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "compare_at_price": number | null,"created_at_shop": string | null,"external_id": string,"first_seen_at": string,"fts": unknown,"handle": string | null,"id": string,"image_url": string | null,"last_seen_at": string,"price_max": number | null,"price_min": number | null,"product_type": string | null,"published_at": string | null,"shop_id": string,"tags": (string)[],"title": string,"vendor": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "compare_at_price"?: number | null,"created_at_shop"?: string | null,"external_id": string,"first_seen_at"?: string,"fts"?: never,"handle"?: string | null,"id"?: string,"image_url"?: string | null,"last_seen_at"?: string,"price_max"?: number | null,"price_min"?: number | null,"product_type"?: string | null,"published_at"?: string | null,"shop_id": string,"tags"?: (string)[],"title": string,"vendor"?: string | null
                  }
                  Update: {
                    "compare_at_price"?: number | null,"created_at_shop"?: string | null,"external_id"?: string,"first_seen_at"?: string,"fts"?: never,"handle"?: string | null,"id"?: string,"image_url"?: string | null,"last_seen_at"?: string,"price_max"?: number | null,"price_min"?: number | null,"product_type"?: string | null,"published_at"?: string | null,"shop_id"?: string,"tags"?: (string)[],"title"?: string,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"is_admin": boolean,"locale": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"is_admin"?: boolean,"locale"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"is_admin"?: boolean,"locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seed_inboxes": {
                  Row: {
                    "address": string,"created_at": string,"id": string,"notes": string | null,"shop_id": string,"subscribed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"created_at"?: string,"id"?: string,"notes"?: string | null,"shop_id": string,"subscribed_at"?: string | null
                  }
                  Update: {
                    "address"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"shop_id"?: string,"subscribed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seed_inboxes_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: true
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_snapshots": {
                  Row: {
                    "active_ads_count": number | null,"captured_on": string,"est_confidence": number | null,"est_daily_revenue": number | null,"est_daily_revenue_high": number | null,"est_daily_revenue_low": number | null,"new_products": number | null,"price_changes": number | null,"product_count": number | null,"removed_products": number | null,"review_count": number | null,"sellout_value": number | null,"sellouts": number | null,"shop_id": string,"total_reach": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_ads_count"?: number | null,"captured_on": string,"est_confidence"?: number | null,"est_daily_revenue"?: number | null,"est_daily_revenue_high"?: number | null,"est_daily_revenue_low"?: number | null,"new_products"?: number | null,"price_changes"?: number | null,"product_count"?: number | null,"removed_products"?: number | null,"review_count"?: number | null,"sellout_value"?: number | null,"sellouts"?: number | null,"shop_id": string,"total_reach"?: number | null
                  }
                  Update: {
                    "active_ads_count"?: number | null,"captured_on"?: string,"est_confidence"?: number | null,"est_daily_revenue"?: number | null,"est_daily_revenue_high"?: number | null,"est_daily_revenue_low"?: number | null,"new_products"?: number | null,"price_changes"?: number | null,"product_count"?: number | null,"removed_products"?: number | null,"review_count"?: number | null,"sellout_value"?: number | null,"sellouts"?: number | null,"shop_id"?: string,"total_reach"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_snapshots_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "apps": NonNullable<Json>,"country": string | null,"created_at": string,"currency": string | null,"domain": string,"est_confidence": number | null,"est_monthly_orders": number | null,"est_monthly_orders_high": number | null,"est_monthly_orders_low": number | null,"est_monthly_revenue": number | null,"est_monthly_revenue_high": number | null,"est_monthly_revenue_low": number | null,"est_signals": Json | null,"est_updated_at": string | null,"first_seen_at": string,"growth_score": number | null,"id": string,"last_crawled_at": string | null,"name": string | null,"platform": string | null,"status": Database["public"]['Enums']["shop_status"],"theme_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "apps"?: NonNullable<Json>,"country"?: string | null,"created_at"?: string,"currency"?: string | null,"domain": string,"est_confidence"?: number | null,"est_monthly_orders"?: number | null,"est_monthly_orders_high"?: number | null,"est_monthly_orders_low"?: number | null,"est_monthly_revenue"?: number | null,"est_monthly_revenue_high"?: number | null,"est_monthly_revenue_low"?: number | null,"est_signals"?: Json | null,"est_updated_at"?: string | null,"first_seen_at"?: string,"growth_score"?: number | null,"id"?: string,"last_crawled_at"?: string | null,"name"?: string | null,"platform"?: string | null,"status"?: Database["public"]['Enums']["shop_status"],"theme_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "apps"?: NonNullable<Json>,"country"?: string | null,"created_at"?: string,"currency"?: string | null,"domain"?: string,"est_confidence"?: number | null,"est_monthly_orders"?: number | null,"est_monthly_orders_high"?: number | null,"est_monthly_orders_low"?: number | null,"est_monthly_revenue"?: number | null,"est_monthly_revenue_high"?: number | null,"est_monthly_revenue_low"?: number | null,"est_signals"?: Json | null,"est_updated_at"?: string | null,"first_seen_at"?: string,"growth_score"?: number | null,"id"?: string,"last_crawled_at"?: string | null,"name"?: string | null,"platform"?: string | null,"status"?: Database["public"]['Enums']["shop_status"],"theme_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "billing_interval": string | null,"cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"id": string,"plan_id": string,"provider": string,"provider_subscription_id": string | null,"seats": number,"status": Database["public"]['Enums']["subscription_status"],"trial_ends_at": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval"?: string | null,"cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id": string,"provider"?: string,"provider_subscription_id"?: string | null,"seats"?: number,"status": Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "billing_interval"?: string | null,"cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id"?: string,"provider"?: string,"provider_subscription_id"?: string | null,"seats"?: number,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"tracked_brands": {
                  Row: {
                    "added_by": string | null,"created_at": string,"daily_digest": boolean,"id": string,"shop_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"daily_digest"?: boolean,"id"?: string,"shop_id": string,"workspace_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"daily_digest"?: boolean,"id"?: string,"shop_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tracked_brands_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tracked_brands_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_events": {
                  Row: {
                    "action": string,"created_at": string,"id": number,"metadata": Json | null,"quantity": number,"source": string,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: never,"metadata"?: Json | null,"quantity"?: number,"source"?: string,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: never,"metadata"?: Json | null,"quantity"?: number,"source"?: string,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_id": string,"stripe_customer_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id": string,"stripe_customer_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"stripe_customer_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_workspace_member":
{ Args: { "ws": string }; Returns: boolean
                           }
          }
          Enums: {
            "ad_platform": "meta"|"tiktok"|"google","email_type": "welcome"|"flow"|"campaign","folder_item_type": "ad"|"shop"|"email","shop_status": "active"|"blocked"|"dead","subscription_status": "trialing"|"active"|"past_due"|"canceled"|"incomplete"|"unpaid","workspace_role": "owner"|"admin"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "ad_platform": ["meta", "tiktok", "google"],"email_type": ["welcome", "flow", "campaign"],"folder_item_type": ["ad", "shop", "email"],"shop_status": ["active", "blocked", "dead"],"subscription_status": ["trialing", "active", "past_due", "canceled", "incomplete", "unpaid"],"workspace_role": ["owner", "admin", "member"]
          }
        }
} as const
