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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          ip_address: string | null
          performed_by: string | null
          success: boolean
          target_user_email: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          success?: boolean
          target_user_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          success?: boolean
          target_user_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      compliance_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_level: string
          created_at: string
          document_type: string
          entity_id: string
          entity_type: string
          expiry_date: string
          id: string
          notified_at: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_level?: string
          created_at?: string
          document_type: string
          entity_id: string
          entity_type: string
          expiry_date: string
          id?: string
          notified_at?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_level?: string
          created_at?: string
          document_type?: string
          entity_id?: string
          entity_type?: string
          expiry_date?: string
          id?: string
          notified_at?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      consent_logs: {
        Row: {
          created_at: string
          driver_id: string
          expires_at: string | null
          granted_at: string | null
          id: string
          requested_at: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["consent_status"]
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          requested_at?: string | null
          revoked_at?: string | null
          status: Database["public"]["Enums"]["consent_status"]
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          requested_at?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string
          display_name: string
          email: string | null
          gst_number: string | null
          id: string
          integration_code: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          pan_number: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          gst_number?: string | null
          id?: string
          integration_code?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          integration_code?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      driver_consents: {
        Row: {
          consent_expires_at: string | null
          consent_received_at: string | null
          consent_requested_at: string | null
          consent_status: Database["public"]["Enums"]["driver_consent_status"]
          created_at: string
          driver_id: string
          entity_id: string | null
          id: string
          msisdn: string
          telenity_response: Json | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          consent_expires_at?: string | null
          consent_received_at?: string | null
          consent_requested_at?: string | null
          consent_status?: Database["public"]["Enums"]["driver_consent_status"]
          created_at?: string
          driver_id: string
          entity_id?: string | null
          id?: string
          msisdn: string
          telenity_response?: Json | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          consent_expires_at?: string | null
          consent_received_at?: string | null
          consent_requested_at?: string | null
          consent_status?: Database["public"]["Enums"]["driver_consent_status"]
          created_at?: string
          driver_id?: string
          entity_id?: string | null
          id?: string
          msisdn?: string
          telenity_response?: Json | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_consents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_consents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          document_type: string
          driver_id: string
          file_name: string
          file_path: string
          id: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          driver_id: string
          file_name: string
          file_path: string
          id?: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          driver_id?: string
          file_name?: string
          file_path?: string
          id?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          aadhaar_number: string | null
          aadhaar_verified: boolean | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_dedicated: boolean
          license_expiry_date: string | null
          license_issue_date: string | null
          license_number: string | null
          location_code: string | null
          mobile: string
          name: string
          pan_number: string | null
          pan_verified: boolean | null
          passport_number: string | null
          police_verification_date: string | null
          police_verification_expiry: string | null
          transporter_id: string | null
          updated_at: string
          user_id: string | null
          voter_id: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          aadhaar_verified?: boolean | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_dedicated?: boolean
          license_expiry_date?: string | null
          license_issue_date?: string | null
          license_number?: string | null
          location_code?: string | null
          mobile: string
          name: string
          pan_number?: string | null
          pan_verified?: boolean | null
          passport_number?: string | null
          police_verification_date?: string | null
          police_verification_expiry?: string | null
          transporter_id?: string | null
          updated_at?: string
          user_id?: string | null
          voter_id?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          aadhaar_verified?: boolean | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_dedicated?: boolean
          license_expiry_date?: string | null
          license_issue_date?: string | null
          license_number?: string | null
          location_code?: string | null
          mobile?: string
          name?: string
          pan_number?: string | null
          pan_verified?: boolean | null
          passport_number?: string | null
          police_verification_date?: string | null
          police_verification_expiry?: string | null
          transporter_id?: string | null
          updated_at?: string
          user_id?: string | null
          voter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_type: string
          token_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_type: string
          token_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_type?: string
          token_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lane_route_calculations: {
        Row: {
          calculated_at: string | null
          created_at: string
          encoded_polyline: string | null
          id: string
          lane_id: string
          route_summary: string | null
          total_distance_meters: number | null
          total_duration_seconds: number | null
          updated_at: string
          waypoints: Json | null
        }
        Insert: {
          calculated_at?: string | null
          created_at?: string
          encoded_polyline?: string | null
          id?: string
          lane_id: string
          route_summary?: string | null
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          updated_at?: string
          waypoints?: Json | null
        }
        Update: {
          calculated_at?: string | null
          created_at?: string
          encoded_polyline?: string | null
          id?: string
          lane_id?: string
          route_summary?: string | null
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          updated_at?: string
          waypoints?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lane_route_calculations_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: true
            referencedRelation: "serviceability_lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      location_history: {
        Row: {
          accuracy_meters: number | null
          altitude_meters: number | null
          created_at: string
          driver_id: string | null
          event_time: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          raw_response: Json | null
          source: Database["public"]["Enums"]["tracking_source"]
          speed_kmph: number | null
          tracking_asset_id: string | null
          trip_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          altitude_meters?: number | null
          created_at?: string
          driver_id?: string | null
          event_time: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          raw_response?: Json | null
          source?: Database["public"]["Enums"]["tracking_source"]
          speed_kmph?: number | null
          tracking_asset_id?: string | null
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          altitude_meters?: number | null
          created_at?: string
          driver_id?: string | null
          event_time?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          raw_response?: Json | null
          source?: Database["public"]["Enums"]["tracking_source"]
          speed_kmph?: number | null
          tracking_asset_id?: string | null
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_history_tracking_asset_id_fkey"
            columns: ["tracking_asset_id"]
            isOneToOne: false
            referencedRelation: "tracking_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          district: string | null
          gps_radius_meters: number | null
          id: string
          integration_id: string | null
          is_active: boolean
          latitude: number | null
          location_name: string
          location_type: Database["public"]["Enums"]["location_type"]
          longitude: number | null
          pincode: string | null
          sim_radius_meters: number | null
          state: string | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          district?: string | null
          gps_radius_meters?: number | null
          id?: string
          integration_id?: string | null
          is_active?: boolean
          latitude?: number | null
          location_name: string
          location_type?: Database["public"]["Enums"]["location_type"]
          longitude?: number | null
          pincode?: string | null
          sim_radius_meters?: number | null
          state?: string | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          district?: string | null
          gps_radius_meters?: number | null
          id?: string
          integration_id?: string | null
          is_active?: boolean
          latitude?: number | null
          location_name?: string
          location_type?: Database["public"]["Enums"]["location_type"]
          longitude?: number | null
          pincode?: string | null
          sim_radius_meters?: number | null
          state?: string | null
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          breadth_cm: number | null
          created_at: string
          description: string | null
          height_cm: number | null
          id: string
          is_active: boolean
          is_bulk: boolean
          length_cm: number | null
          name: string
          packaging: string | null
          sku_code: string | null
          units: string | null
          updated_at: string
          volume_cbm: number | null
          weight_kg: number | null
        }
        Insert: {
          breadth_cm?: number | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_bulk?: boolean
          length_cm?: number | null
          name: string
          packaging?: string | null
          sku_code?: string | null
          units?: string | null
          updated_at?: string
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Update: {
          breadth_cm?: number | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_bulk?: boolean
          length_cm?: number | null
          name?: string
          packaging?: string | null
          sku_code?: string | null
          units?: string | null
          updated_at?: string
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at: string | null
          id: string
          resource: Database["public"]["Enums"]["permission_resource"]
          role_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at?: string | null
          id?: string
          resource: Database["public"]["Enums"]["permission_resource"]
          role_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          created_at?: string | null
          id?: string
          resource?: Database["public"]["Enums"]["permission_resource"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      serviceability_lanes: {
        Row: {
          created_at: string
          destination_location_id: string
          distance_km: number | null
          freight_type: Database["public"]["Enums"]["freight_type"]
          id: string
          is_active: boolean
          lane_code: string
          origin_location_id: string
          serviceability_mode: Database["public"]["Enums"]["serviceability_mode"]
          standard_tat_hours: number | null
          transporter_id: string | null
          updated_at: string
          vehicle_type_id: string | null
        }
        Insert: {
          created_at?: string
          destination_location_id: string
          distance_km?: number | null
          freight_type?: Database["public"]["Enums"]["freight_type"]
          id?: string
          is_active?: boolean
          lane_code: string
          origin_location_id: string
          serviceability_mode?: Database["public"]["Enums"]["serviceability_mode"]
          standard_tat_hours?: number | null
          transporter_id?: string | null
          updated_at?: string
          vehicle_type_id?: string | null
        }
        Update: {
          created_at?: string
          destination_location_id?: string
          distance_km?: number | null
          freight_type?: Database["public"]["Enums"]["freight_type"]
          id?: string
          is_active?: boolean
          lane_code?: string
          origin_location_id?: string
          serviceability_mode?: Database["public"]["Enums"]["serviceability_mode"]
          standard_tat_hours?: number | null
          transporter_id?: string | null
          updated_at?: string
          vehicle_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serviceability_lanes_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serviceability_lanes_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serviceability_lanes_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serviceability_lanes_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_exceptions: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          description: string
          detected_at: string
          escalated_at: string | null
          escalated_to: string | null
          exception_type: Database["public"]["Enums"]["shipment_exception_type"]
          id: string
          metadata: Json | null
          resolution_notes: string | null
          resolution_path: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          shipment_id: string
          status: Database["public"]["Enums"]["exception_status"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          description: string
          detected_at?: string
          escalated_at?: string | null
          escalated_to?: string | null
          exception_type: Database["public"]["Enums"]["shipment_exception_type"]
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolution_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shipment_id: string
          status?: Database["public"]["Enums"]["exception_status"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          description?: string
          detected_at?: string
          escalated_at?: string | null
          escalated_to?: string | null
          exception_type?: Database["public"]["Enums"]["shipment_exception_type"]
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolution_path?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shipment_id?: string
          status?: Database["public"]["Enums"]["exception_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_exceptions_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_exceptions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_exceptions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_history: {
        Row: {
          change_source: string | null
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_status: string
          new_sub_status: string | null
          notes: string | null
          previous_status: string | null
          previous_sub_status: string | null
          shipment_id: string
        }
        Insert: {
          change_source?: string | null
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status: string
          new_sub_status?: string | null
          notes?: string | null
          previous_status?: string | null
          previous_sub_status?: string | null
          shipment_id: string
        }
        Update: {
          change_source?: string | null
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string
          new_sub_status?: string | null
          notes?: string | null
          previous_status?: string | null
          previous_sub_status?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          billed_at: string | null
          breadth_cm: number | null
          confirmed_at: string | null
          consignee_code: string | null
          created_at: string
          customer_id: string | null
          delay_percentage: number | null
          delivered_at: string | null
          drop_location_id: string | null
          exception_count: number | null
          has_open_exception: boolean | null
          height_cm: number | null
          id: string
          in_pickup_at: string | null
          in_transit_at: string | null
          is_delayed: boolean | null
          length_cm: number | null
          loading_completed_at: string | null
          loading_started_at: string | null
          lr_number: string | null
          mapped_at: string | null
          material_id: string | null
          ndr_at: string | null
          notes: string | null
          order_id: string | null
          out_for_delivery_at: string | null
          paid_at: string | null
          pickup_location_id: string | null
          planned_delivery_time: string | null
          planned_pickup_time: string | null
          pod_cleaned_at: string | null
          pod_collected: boolean
          pod_collected_at: string | null
          pod_file_name: string | null
          pod_file_path: string | null
          quantity: number | null
          returned_at: string | null
          shipment_code: string
          shipment_type: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          sub_status: string | null
          success_at: string | null
          trip_id: string | null
          updated_at: string
          volume_cbm: number | null
          waybill_number: string | null
          weight_kg: number | null
        }
        Insert: {
          billed_at?: string | null
          breadth_cm?: number | null
          confirmed_at?: string | null
          consignee_code?: string | null
          created_at?: string
          customer_id?: string | null
          delay_percentage?: number | null
          delivered_at?: string | null
          drop_location_id?: string | null
          exception_count?: number | null
          has_open_exception?: boolean | null
          height_cm?: number | null
          id?: string
          in_pickup_at?: string | null
          in_transit_at?: string | null
          is_delayed?: boolean | null
          length_cm?: number | null
          loading_completed_at?: string | null
          loading_started_at?: string | null
          lr_number?: string | null
          mapped_at?: string | null
          material_id?: string | null
          ndr_at?: string | null
          notes?: string | null
          order_id?: string | null
          out_for_delivery_at?: string | null
          paid_at?: string | null
          pickup_location_id?: string | null
          planned_delivery_time?: string | null
          planned_pickup_time?: string | null
          pod_cleaned_at?: string | null
          pod_collected?: boolean
          pod_collected_at?: string | null
          pod_file_name?: string | null
          pod_file_path?: string | null
          quantity?: number | null
          returned_at?: string | null
          shipment_code: string
          shipment_type?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          sub_status?: string | null
          success_at?: string | null
          trip_id?: string | null
          updated_at?: string
          volume_cbm?: number | null
          waybill_number?: string | null
          weight_kg?: number | null
        }
        Update: {
          billed_at?: string | null
          breadth_cm?: number | null
          confirmed_at?: string | null
          consignee_code?: string | null
          created_at?: string
          customer_id?: string | null
          delay_percentage?: number | null
          delivered_at?: string | null
          drop_location_id?: string | null
          exception_count?: number | null
          has_open_exception?: boolean | null
          height_cm?: number | null
          id?: string
          in_pickup_at?: string | null
          in_transit_at?: string | null
          is_delayed?: boolean | null
          length_cm?: number | null
          loading_completed_at?: string | null
          loading_started_at?: string | null
          lr_number?: string | null
          mapped_at?: string | null
          material_id?: string | null
          ndr_at?: string | null
          notes?: string | null
          order_id?: string | null
          out_for_delivery_at?: string | null
          paid_at?: string | null
          pickup_location_id?: string | null
          planned_delivery_time?: string | null
          planned_pickup_time?: string | null
          pod_cleaned_at?: string | null
          pod_collected?: boolean
          pod_collected_at?: string | null
          pod_file_name?: string | null
          pod_file_path?: string | null
          quantity?: number | null
          returned_at?: string | null
          shipment_code?: string
          shipment_type?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          sub_status?: string | null
          success_at?: string | null
          trip_id?: string | null
          updated_at?: string
          volume_cbm?: number | null
          waybill_number?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_drop_location_id_fkey"
            columns: ["drop_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_assets: {
        Row: {
          api_token: string | null
          api_url: string | null
          asset_id: string | null
          asset_type: Database["public"]["Enums"]["tracking_asset_type"]
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          last_validated_at: string | null
          response_json_mapping: Json | null
          transporter_id: string | null
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          asset_id?: string | null
          asset_type: Database["public"]["Enums"]["tracking_asset_type"]
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          response_json_mapping?: Json | null
          transporter_id?: string | null
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          asset_id?: string | null
          asset_type?: Database["public"]["Enums"]["tracking_asset_type"]
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          response_json_mapping?: Json | null
          transporter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_assets_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_logs: {
        Row: {
          created_at: string
          id: string
          last_sequence_number: number
          last_updated_at: string | null
          location_history: Json
          raw_responses: Json
          source: string | null
          tracking_asset_id: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sequence_number?: number
          last_updated_at?: string | null
          location_history?: Json
          raw_responses?: Json
          source?: string | null
          tracking_asset_id?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sequence_number?: number
          last_updated_at?: string | null
          location_history?: Json
          raw_responses?: Json
          source?: string | null
          tracking_asset_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_logs_tracking_asset_id_fkey"
            columns: ["tracking_asset_id"]
            isOneToOne: false
            referencedRelation: "tracking_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      transporters: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          company: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          mobile: string | null
          pan: string | null
          pincode: string | null
          state: string | null
          transporter_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          pan?: string | null
          pincode?: string | null
          state?: string | null
          transporter_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          pan?: string | null
          pincode?: string | null
          state?: string | null
          transporter_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trip_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_value: number | null
          alert_type: Database["public"]["Enums"]["trip_alert_type"]
          created_at: string
          description: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: Database["public"]["Enums"]["alert_status"]
          threshold_value: number | null
          title: string
          triggered_at: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number | null
          alert_type: Database["public"]["Enums"]["trip_alert_type"]
          created_at?: string
          description: string
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["alert_status"]
          threshold_value?: number | null
          title: string
          triggered_at?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number | null
          alert_type?: Database["public"]["Enums"]["trip_alert_type"]
          created_at?: string
          description?: string
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["alert_status"]
          threshold_value?: number | null
          title?: string
          triggered_at?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_alerts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_audit_logs: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_status: Database["public"]["Enums"]["trip_status"]
          previous_status: Database["public"]["Enums"]["trip_status"] | null
          trip_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status: Database["public"]["Enums"]["trip_status"]
          previous_status?: Database["public"]["Enums"]["trip_status"] | null
          trip_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: Database["public"]["Enums"]["trip_status"]
          previous_status?: Database["public"]["Enums"]["trip_status"] | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_audit_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_shipment_map: {
        Row: {
          created_at: string
          id: string
          mapped_at: string
          mapped_by: string | null
          notes: string | null
          sequence_order: number
          shipment_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapped_at?: string
          mapped_by?: string | null
          notes?: string | null
          sequence_order?: number
          shipment_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapped_at?: string
          mapped_by?: string | null
          notes?: string | null
          sequence_order?: number
          shipment_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_shipment_map_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_shipment_map_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_shipment_map_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_waypoints: {
        Row: {
          actual_arrival_time: string | null
          actual_departure_time: string | null
          created_at: string
          delay_minutes: number | null
          id: string
          latitude: number | null
          location_id: string | null
          longitude: number | null
          notes: string | null
          planned_arrival_time: string | null
          planned_departure_time: string | null
          sequence_order: number
          status: string
          trip_id: string
          updated_at: string
          waypoint_name: string
          waypoint_type: string
        }
        Insert: {
          actual_arrival_time?: string | null
          actual_departure_time?: string | null
          created_at?: string
          delay_minutes?: number | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          planned_arrival_time?: string | null
          planned_departure_time?: string | null
          sequence_order?: number
          status?: string
          trip_id: string
          updated_at?: string
          waypoint_name: string
          waypoint_type?: string
        }
        Update: {
          actual_arrival_time?: string | null
          actual_departure_time?: string | null
          created_at?: string
          delay_minutes?: number | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          planned_arrival_time?: string | null
          planned_departure_time?: string | null
          sequence_order?: number
          status?: string
          trip_id?: string
          updated_at?: string
          waypoint_name?: string
          waypoint_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_waypoints_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_waypoints_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          active_alert_count: number | null
          actual_end_time: string | null
          actual_start_time: string | null
          closed_at: string | null
          closed_by: string | null
          closure_notes: string | null
          consignee_name: string | null
          created_at: string
          current_eta: string | null
          customer_id: string | null
          destination_location_id: string | null
          driver_id: string | null
          id: string
          is_trackable: boolean | null
          lane_id: string | null
          last_ping_at: string | null
          notes: string | null
          origin_location_id: string | null
          planned_end_time: string | null
          planned_eta: string | null
          planned_start_time: string | null
          sim_consent_id: string | null
          status: Database["public"]["Enums"]["trip_status"]
          total_distance_km: number | null
          tracking_asset_id: string | null
          tracking_type: Database["public"]["Enums"]["tracking_type"] | null
          transporter_id: string | null
          trip_code: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          active_alert_count?: number | null
          actual_end_time?: string | null
          actual_start_time?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          consignee_name?: string | null
          created_at?: string
          current_eta?: string | null
          customer_id?: string | null
          destination_location_id?: string | null
          driver_id?: string | null
          id?: string
          is_trackable?: boolean | null
          lane_id?: string | null
          last_ping_at?: string | null
          notes?: string | null
          origin_location_id?: string | null
          planned_end_time?: string | null
          planned_eta?: string | null
          planned_start_time?: string | null
          sim_consent_id?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          total_distance_km?: number | null
          tracking_asset_id?: string | null
          tracking_type?: Database["public"]["Enums"]["tracking_type"] | null
          transporter_id?: string | null
          trip_code: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          active_alert_count?: number | null
          actual_end_time?: string | null
          actual_start_time?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          consignee_name?: string | null
          created_at?: string
          current_eta?: string | null
          customer_id?: string | null
          destination_location_id?: string | null
          driver_id?: string | null
          id?: string
          is_trackable?: boolean | null
          lane_id?: string | null
          last_ping_at?: string | null
          notes?: string | null
          origin_location_id?: string | null
          planned_end_time?: string | null
          planned_eta?: string | null
          planned_start_time?: string | null
          sim_consent_id?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          total_distance_km?: number | null
          tracking_asset_id?: string | null
          tracking_type?: Database["public"]["Enums"]["tracking_type"] | null
          transporter_id?: string | null
          trip_code?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "serviceability_lanes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_sim_consent_id_fkey"
            columns: ["sim_consent_id"]
            isOneToOne: false
            referencedRelation: "driver_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_tracking_asset_id_fkey"
            columns: ["tracking_asset_id"]
            isOneToOne: false
            referencedRelation: "tracking_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          custom_role_id: string | null
          customer_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          customer_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          customer_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_types: {
        Row: {
          breadth_cm: number | null
          created_at: string
          height_cm: number | null
          id: string
          is_active: boolean
          length_cm: number | null
          type_name: string
          updated_at: string
          volume_capacity_cbm: number | null
          weight_capacity_kg: number | null
        }
        Insert: {
          breadth_cm?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          type_name: string
          updated_at?: string
          volume_capacity_cbm?: number | null
          weight_capacity_kg?: number | null
        }
        Update: {
          breadth_cm?: number | null
          created_at?: string
          height_cm?: number | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          type_name?: string
          updated_at?: string
          volume_capacity_cbm?: number | null
          weight_capacity_kg?: number | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          fitness_expiry_date: string | null
          fitness_issue_date: string | null
          fitness_number: string | null
          id: string
          insurance_expiry_date: string | null
          insurance_issue_date: string | null
          insurance_number: string | null
          integration_code: string | null
          is_active: boolean
          is_dedicated: boolean
          location_code: string | null
          make: string | null
          model: string | null
          permit_expiry_date: string | null
          permit_issue_date: string | null
          permit_number: string | null
          puc_expiry_date: string | null
          puc_issue_date: string | null
          puc_number: string | null
          rc_expiry_date: string | null
          rc_issue_date: string | null
          rc_number: string | null
          tracking_asset_id: string | null
          transporter_id: string | null
          updated_at: string
          vehicle_number: string
          vehicle_type_id: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          fitness_expiry_date?: string | null
          fitness_issue_date?: string | null
          fitness_number?: string | null
          id?: string
          insurance_expiry_date?: string | null
          insurance_issue_date?: string | null
          insurance_number?: string | null
          integration_code?: string | null
          is_active?: boolean
          is_dedicated?: boolean
          location_code?: string | null
          make?: string | null
          model?: string | null
          permit_expiry_date?: string | null
          permit_issue_date?: string | null
          permit_number?: string | null
          puc_expiry_date?: string | null
          puc_issue_date?: string | null
          puc_number?: string | null
          rc_expiry_date?: string | null
          rc_issue_date?: string | null
          rc_number?: string | null
          tracking_asset_id?: string | null
          transporter_id?: string | null
          updated_at?: string
          vehicle_number: string
          vehicle_type_id?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          fitness_expiry_date?: string | null
          fitness_issue_date?: string | null
          fitness_number?: string | null
          id?: string
          insurance_expiry_date?: string | null
          insurance_issue_date?: string | null
          insurance_number?: string | null
          integration_code?: string | null
          is_active?: boolean
          is_dedicated?: boolean
          location_code?: string | null
          make?: string | null
          model?: string | null
          permit_expiry_date?: string | null
          permit_issue_date?: string | null
          permit_number?: string | null
          puc_expiry_date?: string | null
          puc_issue_date?: string | null
          puc_number?: string | null
          rc_expiry_date?: string | null
          rc_issue_date?: string | null
          rc_number?: string | null
          tracking_asset_id?: string | null
          transporter_id?: string | null
          updated_at?: string
          vehicle_number?: string
          vehicle_type_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_tracking_asset_id_fkey"
            columns: ["tracking_asset_id"]
            isOneToOne: false
            referencedRelation: "tracking_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          action: Database["public"]["Enums"]["permission_action"]
          customer_id: string
          resource: Database["public"]["Enums"]["permission_resource"]
        }[]
      }
      has_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _resource: Database["public"]["Enums"]["permission_resource"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_scoped_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _customer_id: string
          _resource: Database["public"]["Enums"]["permission_resource"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_active_alert_count: {
        Args: { trip_uuid: string }
        Returns: undefined
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_active_alert_count: {
        Args: { trip_uuid: string }
        Returns: number
      }
    }
    Enums: {
      alert_status: "active" | "acknowledged" | "resolved" | "dismissed"
      app_role: "superadmin" | "admin" | "user"
      consent_status:
        | "not_requested"
        | "requested"
        | "granted"
        | "revoked"
        | "expired"
      driver_consent_status: "pending" | "allowed" | "not_allowed" | "expired"
      exception_status: "open" | "acknowledged" | "resolved" | "escalated"
      freight_type: "ftl" | "ptl" | "express"
      location_type:
        | "node"
        | "consignee"
        | "plant"
        | "warehouse"
        | "distribution_center"
        | "hub"
        | "branch"
        | "headquarters"
        | "regional_office"
      permission_action: "view" | "create" | "update" | "delete" | "manage"
      permission_resource:
        | "shipments"
        | "trips"
        | "customers"
        | "drivers"
        | "vehicles"
        | "transporters"
        | "locations"
        | "materials"
        | "lanes"
        | "tracking_assets"
        | "alerts"
        | "exceptions"
        | "reports"
        | "users"
        | "roles"
        | "settings"
        | "consents"
      serviceability_mode: "surface" | "air" | "rail"
      shipment_exception_type:
        | "duplicate_mapping"
        | "capacity_exceeded"
        | "vehicle_not_arrived"
        | "loading_discrepancy"
        | "tracking_unavailable"
        | "ndr_consignee_unavailable"
        | "pod_rejected"
        | "invoice_dispute"
        | "delay_exceeded"
        | "weight_mismatch"
        | "other"
      shipment_status:
        | "created"
        | "confirmed"
        | "mapped"
        | "in_pickup"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "ndr"
        | "returned"
        | "success"
      tracking_asset_type: "gps" | "sim" | "whatsapp" | "driver_app"
      tracking_source: "telenity" | "wheelseye" | "manual"
      tracking_type: "gps" | "sim" | "manual" | "none"
      trip_alert_type:
        | "route_deviation"
        | "stoppage"
        | "idle_time"
        | "tracking_lost"
        | "consent_revoked"
        | "geofence_entry"
        | "geofence_exit"
        | "speed_exceeded"
        | "delay_warning"
        | "idle_detected"
      trip_status:
        | "created"
        | "ongoing"
        | "completed"
        | "cancelled"
        | "on_hold"
        | "closed"
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
      alert_status: ["active", "acknowledged", "resolved", "dismissed"],
      app_role: ["superadmin", "admin", "user"],
      consent_status: [
        "not_requested",
        "requested",
        "granted",
        "revoked",
        "expired",
      ],
      driver_consent_status: ["pending", "allowed", "not_allowed", "expired"],
      exception_status: ["open", "acknowledged", "resolved", "escalated"],
      freight_type: ["ftl", "ptl", "express"],
      location_type: [
        "node",
        "consignee",
        "plant",
        "warehouse",
        "distribution_center",
        "hub",
        "branch",
        "headquarters",
        "regional_office",
      ],
      permission_action: ["view", "create", "update", "delete", "manage"],
      permission_resource: [
        "shipments",
        "trips",
        "customers",
        "drivers",
        "vehicles",
        "transporters",
        "locations",
        "materials",
        "lanes",
        "tracking_assets",
        "alerts",
        "exceptions",
        "reports",
        "users",
        "roles",
        "settings",
        "consents",
      ],
      serviceability_mode: ["surface", "air", "rail"],
      shipment_exception_type: [
        "duplicate_mapping",
        "capacity_exceeded",
        "vehicle_not_arrived",
        "loading_discrepancy",
        "tracking_unavailable",
        "ndr_consignee_unavailable",
        "pod_rejected",
        "invoice_dispute",
        "delay_exceeded",
        "weight_mismatch",
        "other",
      ],
      shipment_status: [
        "created",
        "confirmed",
        "mapped",
        "in_pickup",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "ndr",
        "returned",
        "success",
      ],
      tracking_asset_type: ["gps", "sim", "whatsapp", "driver_app"],
      tracking_source: ["telenity", "wheelseye", "manual"],
      tracking_type: ["gps", "sim", "manual", "none"],
      trip_alert_type: [
        "route_deviation",
        "stoppage",
        "idle_time",
        "tracking_lost",
        "consent_revoked",
        "geofence_entry",
        "geofence_exit",
        "speed_exceeded",
        "delay_warning",
        "idle_detected",
      ],
      trip_status: [
        "created",
        "ongoing",
        "completed",
        "cancelled",
        "on_hold",
        "closed",
      ],
    },
  },
} as const
