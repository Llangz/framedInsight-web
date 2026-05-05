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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_predictions: {
        Row: {
          actual_outcome: string | null
          actual_value: number | null
          animal_id: string | null
          confidence_score: number | null
          cow_id: string | null
          created_at: string | null
          farm_id: string | null
          id: string
          model_name: string | null
          model_version: string | null
          plot_id: string | null
          prediction_accurate: boolean | null
          prediction_date: string
          prediction_text: string | null
          prediction_type: string
          prediction_value: number | null
          valid_until_date: string | null
        }
        Insert: {
          actual_outcome?: string | null
          actual_value?: number | null
          animal_id?: string | null
          confidence_score?: number | null
          cow_id?: string | null
          created_at?: string | null
          farm_id?: string | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          plot_id?: string | null
          prediction_accurate?: boolean | null
          prediction_date: string
          prediction_text?: string | null
          prediction_type: string
          prediction_value?: number | null
          valid_until_date?: string | null
        }
        Update: {
          actual_outcome?: string | null
          actual_value?: number | null
          animal_id?: string | null
          confidence_score?: number | null
          cow_id?: string | null
          created_at?: string | null
          farm_id?: string | null
          id?: string
          model_name?: string | null
          model_version?: string | null
          plot_id?: string | null
          prediction_accurate?: boolean | null
          prediction_date?: string
          prediction_text?: string | null
          prediction_type?: string
          prediction_value?: number | null
          valid_until_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_predictions_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_predictions_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "ai_predictions_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_predictions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_predictions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          alert_date: string
          alert_priority: string | null
          alert_type: string
          animal_id: string | null
          cow_id: string | null
          created_at: string | null
          delivery_channels: string[] | null
          due_date: string | null
          farm_id: string
          id: string
          message: string
          plot_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_date: string
          alert_priority?: string | null
          alert_type: string
          animal_id?: string | null
          cow_id?: string | null
          created_at?: string | null
          delivery_channels?: string[] | null
          due_date?: string | null
          farm_id: string
          id?: string
          message: string
          plot_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_date?: string
          alert_priority?: string | null
          alert_type?: string
          animal_id?: string | null
          cow_id?: string | null
          created_at?: string | null
          delivery_channels?: string[] | null
          due_date?: string | null
          farm_id?: string
          id?: string
          message?: string
          plot_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "alerts_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      breeding_events: {
        Row: {
          bull_code: string | null
          cow_id: string
          created_at: string | null
          expected_calving_date: string | null
          heat_date: string | null
          id: string
          notes: string | null
          pregnancy_check_date: string | null
          pregnancy_result: string | null
          service_date: string
          service_type: string | null
          sire_breed: string | null
        }
        Insert: {
          bull_code?: string | null
          cow_id: string
          created_at?: string | null
          expected_calving_date?: string | null
          heat_date?: string | null
          id?: string
          notes?: string | null
          pregnancy_check_date?: string | null
          pregnancy_result?: string | null
          service_date: string
          service_type?: string | null
          sire_breed?: string | null
        }
        Update: {
          bull_code?: string | null
          cow_id?: string
          created_at?: string | null
          expected_calving_date?: string | null
          heat_date?: string | null
          id?: string
          notes?: string | null
          pregnancy_check_date?: string | null
          pregnancy_result?: string | null
          service_date?: string
          service_type?: string | null
          sire_breed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breeding_events_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      calves: {
        Row: {
          birth_date: string
          birth_weight: number | null
          cow_id: string | null
          created_at: string | null
          dam_id: string | null
          id: string
          notes: string | null
          sex: string | null
          sire_code: string | null
          status: string | null
          vaccination_records: string | null
          weaning_date: string | null
          weaning_weight: number | null
        }
        Insert: {
          birth_date: string
          birth_weight?: number | null
          cow_id?: string | null
          created_at?: string | null
          dam_id?: string | null
          id?: string
          notes?: string | null
          sex?: string | null
          sire_code?: string | null
          status?: string | null
          vaccination_records?: string | null
          weaning_date?: string | null
          weaning_weight?: number | null
        }
        Update: {
          birth_date?: string
          birth_weight?: number | null
          cow_id?: string | null
          created_at?: string | null
          dam_id?: string | null
          id?: string
          notes?: string | null
          sex?: string | null
          sire_code?: string | null
          status?: string | null
          vaccination_records?: string | null
          weaning_date?: string | null
          weaning_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calves_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calves_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      calving_records: {
        Row: {
          breeding_event_id: string | null
          calf_birth_weight: number | null
          calf_id: string | null
          calf_sex: string | null
          calf_vigor: string | null
          calving_date: string
          complications: string | null
          cow_id: string
          created_at: string | null
          delivery_type: string | null
          id: string
          notes: string | null
        }
        Insert: {
          breeding_event_id?: string | null
          calf_birth_weight?: number | null
          calf_id?: string | null
          calf_sex?: string | null
          calf_vigor?: string | null
          calving_date: string
          complications?: string | null
          cow_id: string
          created_at?: string | null
          delivery_type?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          breeding_event_id?: string | null
          calf_birth_weight?: number | null
          calf_id?: string | null
          calf_sex?: string | null
          calf_vigor?: string | null
          calving_date?: string
          complications?: string | null
          cow_id?: string
          created_at?: string | null
          delivery_type?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calving_records_breeding_event_id_fkey"
            columns: ["breeding_event_id"]
            isOneToOne: false
            referencedRelation: "breeding_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calving_records_calf_id_fkey"
            columns: ["calf_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calving_records_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_activities: {
        Row: {
          activity_date: string
          activity_type: string
          application_method: string | null
          area_covered_ha: number | null
          calendar_triggered: boolean | null
          cost_inputs: number | null
          cost_labour: number | null
          created_at: string | null
          days_worked: number | null
          dilution_rate: string | null
          farm_id: string
          fertilizer_type: string | null
          id: string
          labour_mode: string | null
          litres_water: number | null
          notes: string | null
          num_workers: number | null
          plot_id: string | null
          product_name: string | null
          pruning_type: string | null
          quantity: number | null
          quantity_unit: string | null
          rate_per_day: number | null
          spray_reason: string | null
          spray_type: string | null
          total_cost: number | null
          updated_at: string | null
          weather_conditions: string | null
          weeding_method: string | null
        }
        Insert: {
          activity_date?: string
          activity_type: string
          application_method?: string | null
          area_covered_ha?: number | null
          calendar_triggered?: boolean | null
          cost_inputs?: number | null
          cost_labour?: number | null
          created_at?: string | null
          days_worked?: number | null
          dilution_rate?: string | null
          farm_id: string
          fertilizer_type?: string | null
          id?: string
          labour_mode?: string | null
          litres_water?: number | null
          notes?: string | null
          num_workers?: number | null
          plot_id?: string | null
          product_name?: string | null
          pruning_type?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          rate_per_day?: number | null
          spray_reason?: string | null
          spray_type?: string | null
          total_cost?: number | null
          updated_at?: string | null
          weather_conditions?: string | null
          weeding_method?: string | null
        }
        Update: {
          activity_date?: string
          activity_type?: string
          application_method?: string | null
          area_covered_ha?: number | null
          calendar_triggered?: boolean | null
          cost_inputs?: number | null
          cost_labour?: number | null
          created_at?: string | null
          days_worked?: number | null
          dilution_rate?: string | null
          farm_id?: string
          fertilizer_type?: string | null
          id?: string
          labour_mode?: string | null
          litres_water?: number | null
          notes?: string | null
          num_workers?: number | null
          plot_id?: string | null
          product_name?: string | null
          pruning_type?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          rate_per_day?: number | null
          spray_reason?: string | null
          spray_type?: string | null
          total_cost?: number | null
          updated_at?: string | null
          weather_conditions?: string | null
          weeding_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      coffee_calendar_regions: {
        Row: {
          counties: string[]
          id: string
          month: number
          recommended_activities: Json
          region_name: string
          season_context: string | null
        }
        Insert: {
          counties: string[]
          id?: string
          month: number
          recommended_activities: Json
          region_name: string
          season_context?: string | null
        }
        Update: {
          counties?: string[]
          id?: string
          month?: number
          recommended_activities?: Json
          region_name?: string
          season_context?: string | null
        }
        Relationships: []
      }
      coffee_disease_thresholds: {
        Row: {
          action_count: number | null
          action_threshold: string | null
          alternative_products: string[] | null
          application_notes: string | null
          created_at: string | null
          disease_pest_type: string
          emergency_count: number | null
          emergency_threshold: string | null
          high_risk_months: number[] | null
          id: string
          recommended_product: string | null
          region_name: string
          updated_at: string | null
          watch_count: number | null
          watch_threshold: string | null
          why_different: string | null
        }
        Insert: {
          action_count?: number | null
          action_threshold?: string | null
          alternative_products?: string[] | null
          application_notes?: string | null
          created_at?: string | null
          disease_pest_type: string
          emergency_count?: number | null
          emergency_threshold?: string | null
          high_risk_months?: number[] | null
          id?: string
          recommended_product?: string | null
          region_name: string
          updated_at?: string | null
          watch_count?: number | null
          watch_threshold?: string | null
          why_different?: string | null
        }
        Update: {
          action_count?: number | null
          action_threshold?: string | null
          alternative_products?: string[] | null
          application_notes?: string | null
          created_at?: string | null
          disease_pest_type?: string
          emergency_count?: number | null
          emergency_threshold?: string | null
          high_risk_months?: number[] | null
          id?: string
          recommended_product?: string | null
          region_name?: string
          updated_at?: string | null
          watch_count?: number | null
          watch_threshold?: string | null
          why_different?: string | null
        }
        Relationships: []
      }
      coffee_diseases: {
        Row: {
          affected_percentage: number
          ai_diagnosis: string | null
          created_at: string | null
          detection_date: string
          disease_name: string
          farm_id: string
          id: string
          notes: string | null
          photo_url: string | null
          plot_id: string
          resulting_losses_kg: number | null
          severity_level: string
          treatment_applied: string | null
          treatment_date: string | null
          updated_at: string | null
        }
        Insert: {
          affected_percentage: number
          ai_diagnosis?: string | null
          created_at?: string | null
          detection_date: string
          disease_name: string
          farm_id: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          plot_id: string
          resulting_losses_kg?: number | null
          severity_level: string
          treatment_applied?: string | null
          treatment_date?: string | null
          updated_at?: string | null
        }
        Update: {
          affected_percentage?: number
          ai_diagnosis?: string | null
          created_at?: string | null
          detection_date?: string
          disease_name?: string
          farm_id?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          plot_id?: string
          resulting_losses_kg?: number | null
          severity_level?: string
          treatment_applied?: string | null
          treatment_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_diseases_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_diseases_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_diseases_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_diseases_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      coffee_eudr_compliance: {
        Row: {
          afa_verification_date: string | null
          afa_verified: boolean | null
          assessment_date: string
          compliance_status: string | null
          created_at: string | null
          deforestation_risk: boolean | null
          farm_id: string
          forest_cover_pct: number | null
          id: string
          land_use_before_2020: string | null
          last_forest_change_year: number | null
          notes: string | null
          plot_id: string
          raw_api_response: Json | null
          risk_level: string | null
          updated_at: string | null
        }
        Insert: {
          afa_verification_date?: string | null
          afa_verified?: boolean | null
          assessment_date?: string
          compliance_status?: string | null
          created_at?: string | null
          deforestation_risk?: boolean | null
          farm_id: string
          forest_cover_pct?: number | null
          id?: string
          land_use_before_2020?: string | null
          last_forest_change_year?: number | null
          notes?: string | null
          plot_id: string
          raw_api_response?: Json | null
          risk_level?: string | null
          updated_at?: string | null
        }
        Update: {
          afa_verification_date?: string | null
          afa_verified?: boolean | null
          assessment_date?: string
          compliance_status?: string | null
          created_at?: string | null
          deforestation_risk?: boolean | null
          farm_id?: string
          forest_cover_pct?: number | null
          id?: string
          land_use_before_2020?: string | null
          last_forest_change_year?: number | null
          notes?: string | null
          plot_id?: string
          raw_api_response?: Json | null
          risk_level?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_eudr_compliance_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_eudr_compliance_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_eudr_compliance_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_eudr_compliance_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      coffee_financials: {
        Row: {
          amount: number
          buyer_name: string | null
          category: string
          cooperative_name: string | null
          created_at: string | null
          description: string | null
          farm_id: string
          id: string
          notes: string | null
          payment_method: string | null
          plot_id: string | null
          transaction_date: string
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          buyer_name?: string | null
          category: string
          cooperative_name?: string | null
          created_at?: string | null
          description?: string | null
          farm_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          plot_id?: string | null
          transaction_date: string
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          buyer_name?: string | null
          category?: string
          cooperative_name?: string | null
          created_at?: string | null
          description?: string | null
          farm_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          plot_id?: string | null
          transaction_date?: string
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_financials_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_financials_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_harvests: {
        Row: {
          amount_paid: number | null
          buyer_name: string | null
          cherry_condition: string | null
          cherry_kg: number
          clean_coffee_kg: number | null
          cooperative_name: string | null
          created_at: string | null
          factory_code: string | null
          farm_id: string
          harvest_date: string
          harvest_season: string | null
          harvest_year: number | null
          id: string
          lot_number: string | null
          mbuni_accepted: boolean | null
          mbuni_rejection_reason: string | null
          nce_transaction_id: string | null
          notes: string | null
          parchment_kg: number | null
          payment_date: string | null
          payment_status: string | null
          plot_name: string
          price_per_kg: number | null
          processing_method: string | null
          produce_kg: number
          produce_type: string | null
          quality_grade: string | null
          receipt_number: string | null
          total_value: number | null
        }
        Insert: {
          amount_paid?: number | null
          buyer_name?: string | null
          cherry_condition?: string | null
          cherry_kg: number
          clean_coffee_kg?: number | null
          cooperative_name?: string | null
          created_at?: string | null
          factory_code?: string | null
          farm_id: string
          harvest_date: string
          harvest_season?: string | null
          harvest_year?: number | null
          id?: string
          lot_number?: string | null
          mbuni_accepted?: boolean | null
          mbuni_rejection_reason?: string | null
          nce_transaction_id?: string | null
          notes?: string | null
          parchment_kg?: number | null
          payment_date?: string | null
          payment_status?: string | null
          plot_name: string
          price_per_kg?: number | null
          processing_method?: string | null
          produce_kg: number
          produce_type?: string | null
          quality_grade?: string | null
          receipt_number?: string | null
          total_value?: number | null
        }
        Update: {
          amount_paid?: number | null
          buyer_name?: string | null
          cherry_condition?: string | null
          cherry_kg?: number
          clean_coffee_kg?: number | null
          cooperative_name?: string | null
          created_at?: string | null
          factory_code?: string | null
          farm_id?: string
          harvest_date?: string
          harvest_season?: string | null
          harvest_year?: number | null
          id?: string
          lot_number?: string | null
          mbuni_accepted?: boolean | null
          mbuni_rejection_reason?: string | null
          nce_transaction_id?: string | null
          notes?: string | null
          parchment_kg?: number | null
          payment_date?: string | null
          payment_status?: string | null
          plot_name?: string
          price_per_kg?: number | null
          processing_method?: string | null
          produce_kg?: number
          produce_type?: string | null
          quality_grade?: string | null
          receipt_number?: string | null
          total_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_health_records: {
        Row: {
          ai_confidence_score: number | null
          ai_diagnosis: string | null
          antestia_bugs_severity: string | null
          application_method: string | null
          bacterial_blight_present: boolean | null
          berry_borers_present: boolean | null
          berry_photo_url: string | null
          chemical_name: string | null
          chemical_quantity: string | null
          coffee_berry_disease_severity: string | null
          coffee_leaf_rust_severity: string | null
          cost: number | null
          created_at: string | null
          farm_id: string
          id: string
          inspection_date: string
          leaf_photo_url: string | null
          notes: string | null
          plot_id: string
          stem_borers_present: boolean | null
          treatment_applied: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_diagnosis?: string | null
          antestia_bugs_severity?: string | null
          application_method?: string | null
          bacterial_blight_present?: boolean | null
          berry_borers_present?: boolean | null
          berry_photo_url?: string | null
          chemical_name?: string | null
          chemical_quantity?: string | null
          coffee_berry_disease_severity?: string | null
          coffee_leaf_rust_severity?: string | null
          cost?: number | null
          created_at?: string | null
          farm_id: string
          id?: string
          inspection_date: string
          leaf_photo_url?: string | null
          notes?: string | null
          plot_id: string
          stem_borers_present?: boolean | null
          treatment_applied?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          ai_diagnosis?: string | null
          antestia_bugs_severity?: string | null
          application_method?: string | null
          bacterial_blight_present?: boolean | null
          berry_borers_present?: boolean | null
          berry_photo_url?: string | null
          chemical_name?: string | null
          chemical_quantity?: string | null
          coffee_berry_disease_severity?: string | null
          coffee_leaf_rust_severity?: string | null
          cost?: number | null
          created_at?: string | null
          farm_id?: string
          id?: string
          inspection_date?: string
          leaf_photo_url?: string | null
          notes?: string | null
          plot_id?: string
          stem_borers_present?: boolean | null
          treatment_applied?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_health_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_health_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_inputs: {
        Row: {
          created_at: string | null
          farm_id: string
          fertilizer_type: string | null
          id: string
          input_date: string
          input_type: string
          labor_cost: number | null
          labor_hours: number | null
          labor_type: string | null
          notes: string | null
          number_of_workers: number | null
          plot_applied: string | null
          quantity_kg: number | null
          supplier_name: string | null
          total_cost: number | null
          trees_treated: number | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          farm_id: string
          fertilizer_type?: string | null
          id?: string
          input_date: string
          input_type: string
          labor_cost?: number | null
          labor_hours?: number | null
          labor_type?: string | null
          notes?: string | null
          number_of_workers?: number | null
          plot_applied?: string | null
          quantity_kg?: number | null
          supplier_name?: string | null
          total_cost?: number | null
          trees_treated?: number | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          farm_id?: string
          fertilizer_type?: string | null
          id?: string
          input_date?: string
          input_type?: string
          labor_cost?: number | null
          labor_hours?: number | null
          labor_type?: string | null
          notes?: string | null
          number_of_workers?: number | null
          plot_applied?: string | null
          quantity_kg?: number | null
          supplier_name?: string | null
          total_cost?: number | null
          trees_treated?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_inputs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_inputs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_pest_library: {
        Row: {
          affected_plant_parts: string[] | null
          category: string
          chemical_control: string | null
          common_name_english: string
          common_name_swahili: string | null
          created_at: string | null
          cultural_control: string | null
          early_stage_symptoms: string | null
          high_risk_conditions: string | null
          id: string
          late_stage_symptoms: string | null
          organic_control: string | null
          pest_disease_code: string
          photo_urls: string[] | null
          prevention_tips: string | null
          quality_impact: string | null
          registered_products: string[] | null
          scientific_name: string | null
          symptoms_description: string | null
          updated_at: string | null
          video_url: string | null
          yield_loss_potential: string | null
        }
        Insert: {
          affected_plant_parts?: string[] | null
          category: string
          chemical_control?: string | null
          common_name_english: string
          common_name_swahili?: string | null
          created_at?: string | null
          cultural_control?: string | null
          early_stage_symptoms?: string | null
          high_risk_conditions?: string | null
          id?: string
          late_stage_symptoms?: string | null
          organic_control?: string | null
          pest_disease_code: string
          photo_urls?: string[] | null
          prevention_tips?: string | null
          quality_impact?: string | null
          registered_products?: string[] | null
          scientific_name?: string | null
          symptoms_description?: string | null
          updated_at?: string | null
          video_url?: string | null
          yield_loss_potential?: string | null
        }
        Update: {
          affected_plant_parts?: string[] | null
          category?: string
          chemical_control?: string | null
          common_name_english?: string
          common_name_swahili?: string | null
          created_at?: string | null
          cultural_control?: string | null
          early_stage_symptoms?: string | null
          high_risk_conditions?: string | null
          id?: string
          late_stage_symptoms?: string | null
          organic_control?: string | null
          pest_disease_code?: string
          photo_urls?: string[] | null
          prevention_tips?: string | null
          quality_impact?: string | null
          registered_products?: string[] | null
          scientific_name?: string | null
          symptoms_description?: string | null
          updated_at?: string | null
          video_url?: string | null
          yield_loss_potential?: string | null
        }
        Relationships: []
      }
      coffee_plants: {
        Row: {
          age_years: number | null
          created_at: string | null
          deforestation_risk_status: string | null
          eudr_compliant: boolean | null
          farm_id: string
          forest_cover_certification: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          land_ownership_doc_url: string | null
          notes: string | null
          plant_spacing_meters: number | null
          plant_status: string | null
          plant_tag: string | null
          planting_date: string | null
          plot_id: string
          qr_code: string | null
          updated_at: string | null
          variety: string | null
        }
        Insert: {
          age_years?: number | null
          created_at?: string | null
          deforestation_risk_status?: string | null
          eudr_compliant?: boolean | null
          farm_id: string
          forest_cover_certification?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          land_ownership_doc_url?: string | null
          notes?: string | null
          plant_spacing_meters?: number | null
          plant_status?: string | null
          plant_tag?: string | null
          planting_date?: string | null
          plot_id: string
          qr_code?: string | null
          updated_at?: string | null
          variety?: string | null
        }
        Update: {
          age_years?: number | null
          created_at?: string | null
          deforestation_risk_status?: string | null
          eudr_compliant?: boolean | null
          farm_id?: string
          forest_cover_certification?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          land_ownership_doc_url?: string | null
          notes?: string | null
          plant_spacing_meters?: number | null
          plant_status?: string | null
          plant_tag?: string | null
          planting_date?: string | null
          plot_id?: string
          qr_code?: string | null
          updated_at?: string | null
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_plants_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_plants_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_plots: {
        Row: {
          afa_geo_mapping_id: string | null
          age_years: number | null
          area_hectares: number | null
          created_at: string | null
          eudr_risk_assessed_at: string | null
          eudr_risk_details: string | null
          eudr_risk_level: string | null
          establishment_year: number | null
          farm_id: string
          gps_latitude: number | null
          gps_longitude: number | null
          gps_polygon: Json | null
          id: string
          land_ownership_doc_url: string | null
          land_ownership_type: string | null
          land_size_acres: number | null
          notes: string | null
          plant_spacing_meters: number | null
          plant_status: string | null
          planting_date: string | null
          plot_code: string | null
          plot_name: string
          productive_trees: number | null
          region_name: string | null
          total_trees: number
          updated_at: string | null
          variety: string | null
        }
        Insert: {
          afa_geo_mapping_id?: string | null
          age_years?: number | null
          area_hectares?: number | null
          created_at?: string | null
          eudr_risk_assessed_at?: string | null
          eudr_risk_details?: string | null
          eudr_risk_level?: string | null
          establishment_year?: number | null
          farm_id: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_polygon?: Json | null
          id?: string
          land_ownership_doc_url?: string | null
          land_ownership_type?: string | null
          land_size_acres?: number | null
          notes?: string | null
          plant_spacing_meters?: number | null
          plant_status?: string | null
          planting_date?: string | null
          plot_code?: string | null
          plot_name: string
          productive_trees?: number | null
          region_name?: string | null
          total_trees?: number
          updated_at?: string | null
          variety?: string | null
        }
        Update: {
          afa_geo_mapping_id?: string | null
          age_years?: number | null
          area_hectares?: number | null
          created_at?: string | null
          eudr_risk_assessed_at?: string | null
          eudr_risk_details?: string | null
          eudr_risk_level?: string | null
          establishment_year?: number | null
          farm_id?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_polygon?: Json | null
          id?: string
          land_ownership_doc_url?: string | null
          land_ownership_type?: string | null
          land_size_acres?: number | null
          notes?: string | null
          plant_spacing_meters?: number | null
          plant_status?: string | null
          planting_date?: string | null
          plot_code?: string | null
          plot_name?: string
          productive_trees?: number | null
          region_name?: string | null
          total_trees?: number
          updated_at?: string | null
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_quality_records: {
        Row: {
          acidity_score: number | null
          aroma_score: number | null
          blockchain_hash: string | null
          body_score: number | null
          created_at: string | null
          cupper_name: string | null
          cupping_date: string | null
          cupping_score: number | null
          export_ready_date: string | null
          fair_trade_certified: boolean | null
          flavor_notes: string | null
          harvest_id: string | null
          id: string
          lot_number: string | null
          milling_date: string | null
          notes: string | null
          organic_certified: boolean | null
          processing_date: string | null
          rainforest_alliance: boolean | null
          traceability_url: string | null
          utz_certified: boolean | null
        }
        Insert: {
          acidity_score?: number | null
          aroma_score?: number | null
          blockchain_hash?: string | null
          body_score?: number | null
          created_at?: string | null
          cupper_name?: string | null
          cupping_date?: string | null
          cupping_score?: number | null
          export_ready_date?: string | null
          fair_trade_certified?: boolean | null
          flavor_notes?: string | null
          harvest_id?: string | null
          id?: string
          lot_number?: string | null
          milling_date?: string | null
          notes?: string | null
          organic_certified?: boolean | null
          processing_date?: string | null
          rainforest_alliance?: boolean | null
          traceability_url?: string | null
          utz_certified?: boolean | null
        }
        Update: {
          acidity_score?: number | null
          aroma_score?: number | null
          blockchain_hash?: string | null
          body_score?: number | null
          created_at?: string | null
          cupper_name?: string | null
          cupping_date?: string | null
          cupping_score?: number | null
          export_ready_date?: string | null
          fair_trade_certified?: boolean | null
          flavor_notes?: string | null
          harvest_id?: string | null
          id?: string
          lot_number?: string | null
          milling_date?: string | null
          notes?: string | null
          organic_certified?: boolean | null
          processing_date?: string | null
          rainforest_alliance?: boolean | null
          traceability_url?: string | null
          utz_certified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_quality_records_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "coffee_harvests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_quality_records_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "v_payment_tracker"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_satellite_fetch_log: {
        Row: {
          cloud_cover_pct: number | null
          date_range_from: string | null
          date_range_to: string | null
          error_message: string | null
          fetch_attempted_at: string | null
          id: string
          plot_id: string
          processing_units_used: number | null
          status: string
        }
        Insert: {
          cloud_cover_pct?: number | null
          date_range_from?: string | null
          date_range_to?: string | null
          error_message?: string | null
          fetch_attempted_at?: string | null
          id?: string
          plot_id: string
          processing_units_used?: number | null
          status: string
        }
        Update: {
          cloud_cover_pct?: number | null
          date_range_from?: string | null
          date_range_to?: string | null
          error_message?: string | null
          fetch_attempted_at?: string | null
          id?: string
          plot_id?: string
          processing_units_used?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coffee_satellite_fetch_log_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_satellite_fetch_log_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      coffee_satellite_indices: {
        Row: {
          acquired_at: string | null
          alert_reason: string | null
          alert_triggered: boolean | null
          cloud_cover_pct: number | null
          created_at: string | null
          farm_id: string
          health_label: string | null
          health_score: number | null
          health_score_change: number | null
          id: string
          image_date: string
          ndre_max: number | null
          ndre_mean: number | null
          ndre_min: number | null
          ndvi_change: number | null
          ndvi_max: number | null
          ndvi_mean: number | null
          ndvi_min: number | null
          ndvi_std: number | null
          ndwi_max: number | null
          ndwi_mean: number | null
          ndwi_min: number | null
          plot_id: string
          raw_cdse_response: Json | null
          sentinel_tile: string | null
          weeks_of_decline: number | null
        }
        Insert: {
          acquired_at?: string | null
          alert_reason?: string | null
          alert_triggered?: boolean | null
          cloud_cover_pct?: number | null
          created_at?: string | null
          farm_id: string
          health_label?: string | null
          health_score?: number | null
          health_score_change?: number | null
          id?: string
          image_date: string
          ndre_max?: number | null
          ndre_mean?: number | null
          ndre_min?: number | null
          ndvi_change?: number | null
          ndvi_max?: number | null
          ndvi_mean?: number | null
          ndvi_min?: number | null
          ndvi_std?: number | null
          ndwi_max?: number | null
          ndwi_mean?: number | null
          ndwi_min?: number | null
          plot_id: string
          raw_cdse_response?: Json | null
          sentinel_tile?: string | null
          weeks_of_decline?: number | null
        }
        Update: {
          acquired_at?: string | null
          alert_reason?: string | null
          alert_triggered?: boolean | null
          cloud_cover_pct?: number | null
          created_at?: string | null
          farm_id?: string
          health_label?: string | null
          health_score?: number | null
          health_score_change?: number | null
          id?: string
          image_date?: string
          ndre_max?: number | null
          ndre_mean?: number | null
          ndre_min?: number | null
          ndvi_change?: number | null
          ndvi_max?: number | null
          ndvi_mean?: number | null
          ndvi_min?: number | null
          ndvi_std?: number | null
          ndwi_max?: number | null
          ndwi_mean?: number | null
          ndwi_min?: number | null
          plot_id?: string
          raw_cdse_response?: Json | null
          sentinel_tile?: string | null
          weeks_of_decline?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_satellite_indices_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_satellite_indices_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_satellite_indices_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_satellite_indices_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      coffee_scouting_records: {
        Row: {
          action_taken: string | null
          alert_level: string | null
          area_affected_ha: number | null
          cbd_green_berries_affected: number | null
          cbd_red_berries_affected: number | null
          cbd_yellow_berries_affected: number | null
          clr_defoliation_observed: boolean | null
          clr_leaves_affected: number | null
          created_at: string | null
          farm_id: string
          id: string
          notes: string | null
          observation_type: string
          percentage_plot_affected: number | null
          pest_count_per_tree: number | null
          pest_count_total: number | null
          photo_urls: string[] | null
          plot_id: string
          scouted_by: string | null
          scouting_date: string
          severity_level: string | null
          spray_activity_id: string | null
          symptoms_description: string | null
          threshold_breached: boolean | null
          trees_sampled: number | null
          updated_at: string | null
          weather_past_week: string | null
        }
        Insert: {
          action_taken?: string | null
          alert_level?: string | null
          area_affected_ha?: number | null
          cbd_green_berries_affected?: number | null
          cbd_red_berries_affected?: number | null
          cbd_yellow_berries_affected?: number | null
          clr_defoliation_observed?: boolean | null
          clr_leaves_affected?: number | null
          created_at?: string | null
          farm_id: string
          id?: string
          notes?: string | null
          observation_type: string
          percentage_plot_affected?: number | null
          pest_count_per_tree?: number | null
          pest_count_total?: number | null
          photo_urls?: string[] | null
          plot_id: string
          scouted_by?: string | null
          scouting_date?: string
          severity_level?: string | null
          spray_activity_id?: string | null
          symptoms_description?: string | null
          threshold_breached?: boolean | null
          trees_sampled?: number | null
          updated_at?: string | null
          weather_past_week?: string | null
        }
        Update: {
          action_taken?: string | null
          alert_level?: string | null
          area_affected_ha?: number | null
          cbd_green_berries_affected?: number | null
          cbd_red_berries_affected?: number | null
          cbd_yellow_berries_affected?: number | null
          clr_defoliation_observed?: boolean | null
          clr_leaves_affected?: number | null
          created_at?: string | null
          farm_id?: string
          id?: string
          notes?: string | null
          observation_type?: string
          percentage_plot_affected?: number | null
          pest_count_per_tree?: number | null
          pest_count_total?: number | null
          photo_urls?: string[] | null
          plot_id?: string
          scouted_by?: string | null
          scouting_date?: string
          severity_level?: string | null
          spray_activity_id?: string | null
          symptoms_description?: string | null
          threshold_breached?: boolean | null
          trees_sampled?: number | null
          updated_at?: string | null
          weather_past_week?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_scouting_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_spray_activity_id_fkey"
            columns: ["spray_activity_id"]
            isOneToOne: false
            referencedRelation: "coffee_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      constituencies: {
        Row: {
          county_id: string
          created_at: string | null
          id: string
          name: string
          population_2009: number | null
        }
        Insert: {
          county_id: string
          created_at?: string | null
          id: string
          name: string
          population_2009?: number | null
        }
        Update: {
          county_id?: string
          created_at?: string | null
          id?: string
          name?: string
          population_2009?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constituencies_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
        ]
      }
      counties: {
        Row: {
          created_at: string | null
          id: string
          name: string
          population_2009: number | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          population_2009?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          population_2009?: number | null
        }
        Relationships: []
      }
      cows: {
        Row: {
          birth_date: string | null
          breed: string | null
          cow_tag: string
          created_at: string | null
          dam_id: string | null
          exit_date: string | null
          exit_reason: string | null
          exit_value: number | null
          farm_id: string
          id: string
          name: string | null
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          purpose: string | null
          qr_code: string | null
          sex: string | null
          sire_id: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          cow_tag: string
          created_at?: string | null
          dam_id?: string | null
          exit_date?: string | null
          exit_reason?: string | null
          exit_value?: number | null
          farm_id: string
          id?: string
          name?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purpose?: string | null
          qr_code?: string | null
          sex?: string | null
          sire_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          cow_tag?: string
          created_at?: string | null
          dam_id?: string | null
          exit_date?: string | null
          exit_reason?: string | null
          exit_value?: number | null
          farm_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purpose?: string | null
          qr_code?: string | null
          sex?: string | null
          sire_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cows_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cows_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cows_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cows_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_managers: {
        Row: {
          created_at: string | null
          farm_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          farm_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          farm_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      farm_events: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          actor_id: string | null
          actor_type: string
          event_type: string
          event_data: Json
          created_at: string
          created_at_unix: number
          synced_to_server: boolean | null
          affects_risk_level: boolean | null
          affects_compliance: boolean | null
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          actor_id?: string | null
          actor_type: string
          event_type: string
          event_data?: Json
          created_at?: string
          created_at_unix?: number
          synced_to_server?: boolean | null
          affects_risk_level?: boolean | null
          affects_compliance?: boolean | null
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          actor_id?: string | null
          actor_type?: string
          event_type?: string
          event_data?: Json
          created_at?: string
          created_at_unix?: number
          synced_to_server?: boolean | null
          affects_risk_level?: boolean | null
          affects_compliance?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_events_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          }
        ]
      }
      farm_type_configs: {
        Row: {
          active_modules: string[] | null
          ai_diagnostics_enabled: boolean | null
          alert_channels: string[] | null
          alerts_enabled: boolean | null
          created_at: string | null
          farm_id: string
          farm_type: string
          id: string
          language: string | null
          measurement_units: string | null
          updated_at: string | null
          voice_notes_enabled: boolean | null
        }
        Insert: {
          active_modules?: string[] | null
          ai_diagnostics_enabled?: boolean | null
          alert_channels?: string[] | null
          alerts_enabled?: boolean | null
          created_at?: string | null
          farm_id: string
          farm_type: string
          id?: string
          language?: string | null
          measurement_units?: string | null
          updated_at?: string | null
          voice_notes_enabled?: boolean | null
        }
        Update: {
          active_modules?: string[] | null
          ai_diagnostics_enabled?: boolean | null
          alert_channels?: string[] | null
          alerts_enabled?: boolean | null
          created_at?: string | null
          farm_id?: string
          farm_type?: string
          id?: string
          language?: string | null
          measurement_units?: string | null
          updated_at?: string | null
          voice_notes_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_type_configs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_type_configs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          county: string | null
          created_at: string | null
          email: string | null
          farm_name: string
          farm_types: string[] | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          is_active: boolean | null
          land_size_acres: number | null
          location: string | null
          owner_name: string
          phone: string
          primary_enterprise: string | null
          sub_county: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_tier: string | null
          updated_at: string | null
          ward: string | null
        }
        Insert: {
          county?: string | null
          created_at?: string | null
          email?: string | null
          farm_name: string
          farm_types?: string[] | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          is_active?: boolean | null
          land_size_acres?: number | null
          location?: string | null
          owner_name: string
          phone: string
          primary_enterprise?: string | null
          sub_county?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          ward?: string | null
        }
        Update: {
          county?: string | null
          created_at?: string | null
          email?: string | null
          farm_name?: string
          farm_types?: string[] | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          is_active?: boolean | null
          land_size_acres?: number | null
          location?: string | null
          owner_name?: string
          phone?: string
          primary_enterprise?: string | null
          sub_county?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          ward?: string | null
        }
        Relationships: []
      }
      feed_records: {
        Row: {
          animal_group: string | null
          cost: number | null
          created_at: string | null
          farm_id: string
          feed_type: string | null
          id: string
          notes: string | null
          number_of_animals: number | null
          quantity_kg: number | null
          record_date: string
        }
        Insert: {
          animal_group?: string | null
          cost?: number | null
          created_at?: string | null
          farm_id: string
          feed_type?: string | null
          id?: string
          notes?: string | null
          number_of_animals?: number | null
          quantity_kg?: number | null
          record_date: string
        }
        Update: {
          animal_group?: string | null
          cost?: number | null
          created_at?: string | null
          farm_id?: string
          feed_type?: string | null
          id?: string
          notes?: string | null
          number_of_animals?: number | null
          quantity_kg?: number | null
          record_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_records: {
        Row: {
          amount: number
          animal_id: string | null
          category: string
          cow_id: string | null
          created_at: string | null
          description: string | null
          enterprise_type: string | null
          farm_id: string
          id: string
          notes: string | null
          payment_method: string | null
          plot_id: string | null
          receipt_url: string | null
          subcategory: string | null
          transaction_date: string
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          animal_id?: string | null
          category: string
          cow_id?: string | null
          created_at?: string | null
          description?: string | null
          enterprise_type?: string | null
          farm_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          plot_id?: string | null
          receipt_url?: string | null
          subcategory?: string | null
          transaction_date: string
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          animal_id?: string | null
          category?: string
          cow_id?: string | null
          created_at?: string | null
          description?: string | null
          enterprise_type?: string | null
          farm_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          plot_id?: string | null
          receipt_url?: string | null
          subcategory?: string | null
          transaction_date?: string
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "financial_records_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      goat_milk_records: {
        Row: {
          animal_id: string
          created_at: string | null
          days_in_milk: number | null
          evening_milk: number | null
          id: string
          lactation_number: number | null
          midday_milk: number | null
          milk_quality: string | null
          morning_milk: number | null
          notes: string | null
          record_date: string
          total_milk: number | null
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          days_in_milk?: number | null
          evening_milk?: number | null
          id?: string
          lactation_number?: number | null
          midday_milk?: number | null
          milk_quality?: string | null
          morning_milk?: number | null
          notes?: string | null
          record_date: string
          total_milk?: number | null
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          days_in_milk?: number | null
          evening_milk?: number | null
          id?: string
          lactation_number?: number | null
          midday_milk?: number | null
          milk_quality?: string | null
          morning_milk?: number | null
          notes?: string | null
          record_date?: string
          total_milk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goat_milk_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goat_milk_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
        ]
      }
      health_records: {
        Row: {
          cost: number | null
          cow_id: string
          created_at: string | null
          disease: string | null
          dosage: string | null
          drug_name: string | null
          id: string
          notes: string | null
          safe_meat_date: string | null
          safe_milk_date: string | null
          symptoms: string | null
          treatment: string | null
          treatment_date: string
          vet_contact: string | null
          vet_name: string | null
          withdrawal_days: number | null
        }
        Insert: {
          cost?: number | null
          cow_id: string
          created_at?: string | null
          disease?: string | null
          dosage?: string | null
          drug_name?: string | null
          id?: string
          notes?: string | null
          safe_meat_date?: string | null
          safe_milk_date?: string | null
          symptoms?: string | null
          treatment?: string | null
          treatment_date: string
          vet_contact?: string | null
          vet_name?: string | null
          withdrawal_days?: number | null
        }
        Update: {
          cost?: number | null
          cow_id?: string
          created_at?: string | null
          disease?: string | null
          dosage?: string | null
          drug_name?: string | null
          id?: string
          notes?: string | null
          safe_meat_date?: string | null
          safe_milk_date?: string | null
          symptoms?: string | null
          treatment?: string | null
          treatment_date?: string
          vet_contact?: string | null
          vet_name?: string | null
          withdrawal_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_records_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      kidding_lambing_records: {
        Row: {
          birth_weight: number | null
          breeding_event_id: string | null
          colostrum_given: boolean | null
          colostrum_time: string | null
          complications: string | null
          created_at: string | null
          dam_condition_post_delivery: string | null
          dam_id: string
          delivery_date: string
          delivery_type: string | null
          id: string
          kid_lamb_id: string | null
          notes: string | null
          sex: string | null
          vigor_score: string | null
        }
        Insert: {
          birth_weight?: number | null
          breeding_event_id?: string | null
          colostrum_given?: boolean | null
          colostrum_time?: string | null
          complications?: string | null
          created_at?: string | null
          dam_condition_post_delivery?: string | null
          dam_id: string
          delivery_date: string
          delivery_type?: string | null
          id?: string
          kid_lamb_id?: string | null
          notes?: string | null
          sex?: string | null
          vigor_score?: string | null
        }
        Update: {
          birth_weight?: number | null
          breeding_event_id?: string | null
          colostrum_given?: boolean | null
          colostrum_time?: string | null
          complications?: string | null
          created_at?: string | null
          dam_condition_post_delivery?: string | null
          dam_id?: string
          delivery_date?: string
          delivery_type?: string | null
          id?: string
          kid_lamb_id?: string | null
          notes?: string | null
          sex?: string | null
          vigor_score?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kidding_lambing_records_breeding_event_id_fkey"
            columns: ["breeding_event_id"]
            isOneToOne: false
            referencedRelation: "small_ruminant_breeding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kidding_lambing_records_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kidding_lambing_records_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "kidding_lambing_records_kid_lamb_id_fkey"
            columns: ["kid_lamb_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kidding_lambing_records_kid_lamb_id_fkey"
            columns: ["kid_lamb_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
        ]
      }
      milk_production: {
        Row: {
          animal_id: string
          created_at: string | null
          days_in_milk: number | null
          evening_milk: number | null
          farm_id: string
          fat_content: number | null
          id: string
          lactation_number: number | null
          midday_milk: number | null
          milk_quality: string | null
          morning_milk: number | null
          notes: string | null
          record_date: string
          temperature: number | null
          total_milk: number | null
          updated_at: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          days_in_milk?: number | null
          evening_milk?: number | null
          farm_id: string
          fat_content?: number | null
          id?: string
          lactation_number?: number | null
          midday_milk?: number | null
          milk_quality?: string | null
          morning_milk?: number | null
          notes?: string | null
          record_date: string
          temperature?: number | null
          total_milk?: number | null
          updated_at?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          days_in_milk?: number | null
          evening_milk?: number | null
          farm_id?: string
          fat_content?: number | null
          id?: string
          lactation_number?: number | null
          midday_milk?: number | null
          milk_quality?: string | null
          morning_milk?: number | null
          notes?: string | null
          record_date?: string
          temperature?: number | null
          total_milk?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_production_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_production_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "milk_production_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_production_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_records: {
        Row: {
          cow_id: string
          created_at: string | null
          days_in_milk: number | null
          evening_milk: number | null
          id: string
          lactation_number: number | null
          midday_milk: number | null
          milk_quality: string | null
          morning_milk: number | null
          notes: string | null
          record_date: string
          total_milk: number | null
        }
        Insert: {
          cow_id: string
          created_at?: string | null
          days_in_milk?: number | null
          evening_milk?: number | null
          id?: string
          lactation_number?: number | null
          midday_milk?: number | null
          milk_quality?: string | null
          morning_milk?: number | null
          notes?: string | null
          record_date: string
          total_milk?: number | null
        }
        Update: {
          cow_id?: string
          created_at?: string | null
          days_in_milk?: number | null
          evening_milk?: number | null
          id?: string
          lactation_number?: number | null
          midday_milk?: number | null
          milk_quality?: string | null
          morning_milk?: number | null
          notes?: string | null
          record_date?: string
          total_milk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_records_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otp_codes: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          otp_code: string
          phone_number: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          otp_code: string
          phone_number: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          otp_code?: string
          phone_number?: string
        }
        Relationships: []
      }
      small_ruminant_breeding: {
        Row: {
          actual_delivery_date: string | null
          complications: string | null
          created_at: string | null
          dam_id: string
          delivery_type: string | null
          expected_delivery_date: string | null
          heat_date: string | null
          id: string
          notes: string | null
          number_of_offspring: number | null
          offspring_ids: string[] | null
          pregnancy_check_date: string | null
          pregnancy_result: string | null
          service_date: string
          service_type: string | null
          sire_breed: string | null
          sire_id: string | null
          sire_tag: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          complications?: string | null
          created_at?: string | null
          dam_id: string
          delivery_type?: string | null
          expected_delivery_date?: string | null
          heat_date?: string | null
          id?: string
          notes?: string | null
          number_of_offspring?: number | null
          offspring_ids?: string[] | null
          pregnancy_check_date?: string | null
          pregnancy_result?: string | null
          service_date: string
          service_type?: string | null
          sire_breed?: string | null
          sire_id?: string | null
          sire_tag?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          complications?: string | null
          created_at?: string | null
          dam_id?: string
          delivery_type?: string | null
          expected_delivery_date?: string | null
          heat_date?: string | null
          id?: string
          notes?: string | null
          number_of_offspring?: number | null
          offspring_ids?: string[] | null
          pregnancy_check_date?: string | null
          pregnancy_result?: string | null
          service_date?: string
          service_type?: string | null
          sire_breed?: string | null
          sire_id?: string | null
          sire_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "small_ruminant_breeding_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminant_breeding_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "small_ruminant_breeding_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminant_breeding_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
        ]
      }
      small_ruminant_health: {
        Row: {
          animal_id: string
          cost: number | null
          created_at: string | null
          disease: string | null
          dosage: string | null
          drug_name: string | null
          event_date: string
          event_type: string
          id: string
          next_vaccination_due: string | null
          notes: string | null
          safe_consumption_date: string | null
          symptoms: string | null
          treatment: string | null
          vaccine_batch_number: string | null
          vaccine_name: string | null
          vaccine_type: string | null
          vet_contact: string | null
          vet_name: string | null
          withdrawal_days: number | null
        }
        Insert: {
          animal_id: string
          cost?: number | null
          created_at?: string | null
          disease?: string | null
          dosage?: string | null
          drug_name?: string | null
          event_date: string
          event_type: string
          id?: string
          next_vaccination_due?: string | null
          notes?: string | null
          safe_consumption_date?: string | null
          symptoms?: string | null
          treatment?: string | null
          vaccine_batch_number?: string | null
          vaccine_name?: string | null
          vaccine_type?: string | null
          vet_contact?: string | null
          vet_name?: string | null
          withdrawal_days?: number | null
        }
        Update: {
          animal_id?: string
          cost?: number | null
          created_at?: string | null
          disease?: string | null
          dosage?: string | null
          drug_name?: string | null
          event_date?: string
          event_type?: string
          id?: string
          next_vaccination_due?: string | null
          notes?: string | null
          safe_consumption_date?: string | null
          symptoms?: string | null
          treatment?: string | null
          vaccine_batch_number?: string | null
          vaccine_name?: string | null
          vaccine_type?: string | null
          vet_contact?: string | null
          vet_name?: string | null
          withdrawal_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "small_ruminant_health_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminant_health_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
        ]
      }
      small_ruminant_sales: {
        Row: {
          animal_id: string | null
          buyer_contact: string | null
          buyer_name: string | null
          created_at: string | null
          dressed_weight_kg: number | null
          farm_id: string
          id: string
          live_weight_kg: number | null
          market_location: string | null
          milk_price_per_liter: number | null
          milk_quantity_liters: number | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          price_per_kg: number | null
          sale_date: string
          sale_type: string
          total_price: number
        }
        Insert: {
          animal_id?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          created_at?: string | null
          dressed_weight_kg?: number | null
          farm_id: string
          id?: string
          live_weight_kg?: number | null
          market_location?: string | null
          milk_price_per_liter?: number | null
          milk_quantity_liters?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price_per_kg?: number | null
          sale_date: string
          sale_type: string
          total_price: number
        }
        Update: {
          animal_id?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          created_at?: string | null
          dressed_weight_kg?: number | null
          farm_id?: string
          id?: string
          live_weight_kg?: number | null
          market_location?: string | null
          milk_price_per_liter?: number | null
          milk_quantity_liters?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price_per_kg?: number | null
          sale_date?: string
          sale_type?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "small_ruminant_sales_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminant_sales_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "small_ruminant_sales_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminant_sales_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      small_ruminants: {
        Row: {
          animal_tag: string
          birth_date: string
          birth_weight: number | null
          breed: string | null
          breeding_type: string | null
          coat_color: string | null
          created_at: string | null
          dam_id: string | null
          distinguishing_marks: string | null
          ear_notch_pattern: string | null
          exit_date: string | null
          exit_reason: string | null
          exit_value: number | null
          farm_id: string
          id: string
          name: string | null
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          purpose: string | null
          qr_code: string | null
          sex: string
          sire_id: string | null
          source: string | null
          species: string
          status: string | null
          updated_at: string | null
          upgrade_level: string | null
        }
        Insert: {
          animal_tag: string
          birth_date: string
          birth_weight?: number | null
          breed?: string | null
          breeding_type?: string | null
          coat_color?: string | null
          created_at?: string | null
          dam_id?: string | null
          distinguishing_marks?: string | null
          ear_notch_pattern?: string | null
          exit_date?: string | null
          exit_reason?: string | null
          exit_value?: number | null
          farm_id: string
          id?: string
          name?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purpose?: string | null
          qr_code?: string | null
          sex: string
          sire_id?: string | null
          source?: string | null
          species: string
          status?: string | null
          updated_at?: string | null
          upgrade_level?: string | null
        }
        Update: {
          animal_tag?: string
          birth_date?: string
          birth_weight?: number | null
          breed?: string | null
          breeding_type?: string | null
          coat_color?: string | null
          created_at?: string | null
          dam_id?: string | null
          distinguishing_marks?: string | null
          ear_notch_pattern?: string | null
          exit_date?: string | null
          exit_reason?: string | null
          exit_value?: number | null
          farm_id?: string
          id?: string
          name?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purpose?: string | null
          qr_code?: string | null
          sex?: string
          sire_id?: string | null
          source?: string | null
          species?: string
          status?: string | null
          updated_at?: string | null
          upgrade_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "small_ruminants_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminants_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "small_ruminants_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminants_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminants_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "small_ruminants_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
        ]
      }
      vet_visits: {
        Row: {
          cost: number | null
          cow_id: string | null
          created_at: string | null
          diagnosis: string | null
          farm_id: string
          id: string
          next_visit_date: string | null
          notes: string | null
          prescription: string | null
          vet_contact: string | null
          vet_name: string
          visit_date: string
          visit_reason: string | null
        }
        Insert: {
          cost?: number | null
          cow_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          farm_id: string
          id?: string
          next_visit_date?: string | null
          notes?: string | null
          prescription?: string | null
          vet_contact?: string | null
          vet_name: string
          visit_date: string
          visit_reason?: string | null
        }
        Update: {
          cost?: number | null
          cow_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          farm_id?: string
          id?: string
          next_visit_date?: string | null
          notes?: string | null
          prescription?: string | null
          vet_contact?: string | null
          vet_name?: string
          visit_date?: string
          visit_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_visits_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_visits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_visits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          constituency_id: string
          created_at: string | null
          id: string
          name: string
          population_2009: number | null
          ward_uid: string | null
        }
        Insert: {
          constituency_id: string
          created_at?: string | null
          id: string
          name: string
          population_2009?: number | null
          ward_uid?: string | null
        }
        Update: {
          constituency_id?: string
          created_at?: string | null
          id?: string
          name?: string
          population_2009?: number | null
          ward_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wards_constituency_id_fkey"
            columns: ["constituency_id"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_records: {
        Row: {
          age_days: number | null
          animal_id: string
          average_daily_gain: number | null
          body_condition_score: number | null
          created_at: string | null
          id: string
          measurement_type: string | null
          notes: string | null
          record_date: string
          weight_kg: number
        }
        Insert: {
          age_days?: number | null
          animal_id: string
          average_daily_gain?: number | null
          body_condition_score?: number | null
          created_at?: string | null
          id?: string
          measurement_type?: string | null
          notes?: string | null
          record_date: string
          weight_kg: number
        }
        Update: {
          age_days?: number | null
          animal_id?: string
          average_daily_gain?: number | null
          body_condition_score?: number | null
          created_at?: string | null
          id?: string
          measurement_type?: string | null
          notes?: string | null
          record_date?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "small_ruminants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "v_animal_milk_summary"
            referencedColumns: ["animal_id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          conversation_context: Json | null
          created_at: string | null
          entities_extracted: Json | null
          farm_id: string | null
          id: string
          intent: string | null
          intent_confidence: number | null
          media_type: string | null
          media_url: string | null
          message_text: string | null
          message_type: string | null
          response_sent_at: string | null
          response_text: string | null
          sender_phone: string
          session_id: string | null
        }
        Insert: {
          conversation_context?: Json | null
          created_at?: string | null
          entities_extracted?: Json | null
          farm_id?: string | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          message_type?: string | null
          response_sent_at?: string | null
          response_text?: string | null
          sender_phone: string
          session_id?: string | null
        }
        Update: {
          conversation_context?: Json | null
          created_at?: string | null
          entities_extracted?: Json | null
          farm_id?: string | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          message_type?: string | null
          response_sent_at?: string | null
          response_text?: string | null
          sender_phone?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      coffee_cost_summary: {
        Row: {
          activity_year: number | null
          avg_cost_per_activity: number | null
          farm_id: string | null
          total_activities: number | null
          total_costs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_revenue_summary: {
        Row: {
          avg_revenue_per_harvest: number | null
          farm_id: string | null
          harvest_year: number | null
          total_harvests: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperative_eudr_summary: {
        Row: {
          afa_verified_plots: number | null
          county: string | null
          farm_id: string | null
          farm_name: string | null
          high_risk_plots: number | null
          low_risk_plots: number | null
          medium_risk_plots: number | null
          plots_with_polygon: number | null
          total_hectares: number | null
          total_plots: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_animal_milk_summary: {
        Row: {
          animal_id: string | null
          animal_tag: string | null
          avg_daily_milk: number | null
          breed: string | null
          current_days_in_milk: number | null
          current_lactation: number | null
          last_record_date: string | null
          name: string | null
          records_count: number | null
          species: string | null
          total_milk_7days: number | null
        }
        Relationships: []
      }
      v_coffee_season_costs: {
        Row: {
          activity_count: number | null
          activity_type: string | null
          farm_id: string | null
          plot_id: string | null
          plot_name: string | null
          total_cost: number | null
          total_input_cost: number | null
          total_labour_cost: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      v_current_scouting_alerts: {
        Row: {
          action_count: number | null
          action_taken: string | null
          action_threshold: string | null
          alert_level: string | null
          application_notes: string | null
          days_since_detection: number | null
          farm_id: string | null
          farm_name: string | null
          observation_type: string | null
          pest_count_per_tree: number | null
          plot_id: string | null
          plot_name: string | null
          recommended_product: string | null
          region_name: string | null
          scouting_date: string | null
          scouting_record_id: string | null
          severity_level: string | null
          status: string | null
          threshold_breached: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_scouting_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_scouting_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      v_daily_production: {
        Row: {
          cows_milked: number | null
          farm_id: string | null
          goat_evening_milk: number | null
          goat_midday_milk: number | null
          goat_morning_milk: number | null
          goats_milked: number | null
          grand_total_milk: number | null
          record_date: string | null
          total_evening_milk: number | null
          total_goat_milk_liters: number | null
          total_midday_milk: number | null
          total_milk_liters: number | null
          total_morning_milk: number | null
        }
        Relationships: []
      }
      v_disease_pressure_analytics: {
        Row: {
          avg_days_to_spray: number | null
          avg_pest_count: number | null
          detection_count: number | null
          emergency_alerts: number | null
          light_severity_count: number | null
          moderate_severity_count: number | null
          month: number | null
          observation_type: string | null
          region_name: string | null
          severe_severity_count: number | null
          threshold_breaches: number | null
          year: number | null
        }
        Relationships: []
      }
      v_farm_satellite_health: {
        Row: {
          avg_health_score: number | null
          avg_ndvi: number | null
          farm_id: string | null
          most_recent_image: string | null
          plots_critical: number | null
          plots_good: number | null
          plots_stress: number | null
          plots_watch: number | null
          plots_with_alerts: number | null
          stale_plots: number | null
          total_plots_monitored: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_farm_summary: {
        Row: {
          active_milking_cows_30d: number | null
          avg_daily_milk_7d: number | null
          created_at: string | null
          effective_tier: string | null
          enterprise_count: number | null
          eudr_compliant_plants: number | null
          farm_name: string | null
          farm_types: string[] | null
          female_ruminants: number | null
          has_coffee: boolean | null
          has_dairy: boolean | null
          has_small_ruminants: boolean | null
          high_priority_alerts: number | null
          id: string | null
          land_size_acres: number | null
          last_harvest_date: string | null
          mature_coffee_plants: number | null
          owner_name: string | null
          pending_alerts: number | null
          phone: string | null
          producing_cows: number | null
          productive_coffee_plants: number | null
          ruminants_added_this_month: number | null
          season_cherry_kg: number | null
          season_coffee_revenue_kes: number | null
          subscription_tier: string | null
          today_milk_liters: number | null
          total_coffee_plants: number | null
          total_coffee_plots: number | null
          total_cows: number | null
          total_goats: number | null
          total_sheep: number | null
          total_small_ruminants: number | null
        }
        Relationships: []
      }
      v_payment_tracker: {
        Row: {
          amount_outstanding: number | null
          amount_paid: number | null
          cooperative_name: string | null
          created_at: string | null
          days_since_delivery: number | null
          factory_code: string | null
          farm_id: string | null
          farm_name: string | null
          harvest_date: string | null
          harvest_season: string | null
          harvest_year: number | null
          id: string | null
          lot_number: string | null
          mbuni_accepted: boolean | null
          mbuni_rejection_reason: string | null
          notes: string | null
          payment_date: string | null
          payment_flag: string | null
          payment_status: string | null
          plot_name: string | null
          price_per_kg: number | null
          produce_kg: number | null
          produce_type: string | null
          receipt_number: string | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_plot_latest_satellite: {
        Row: {
          alert_reason: string | null
          alert_triggered: boolean | null
          area_hectares: number | null
          data_freshness: string | null
          days_since_image: number | null
          farm_id: string | null
          health_label: string | null
          health_score: number | null
          health_score_change: number | null
          image_date: string | null
          ndre_mean: number | null
          ndvi_change: number | null
          ndvi_mean: number | null
          ndvi_std: number | null
          ndwi_mean: number | null
          plot_id: string | null
          plot_name: string | null
          region_name: string | null
          weeks_of_decline: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_plot_ndvi_trend: {
        Row: {
          alert_triggered: boolean | null
          health_label: string | null
          health_score: number | null
          image_date: string | null
          ndre_mean: number | null
          ndvi_mean: number | null
          plot_id: string | null
          reading_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_satellite_indices_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "coffee_plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_satellite_indices_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "v_plot_latest_satellite"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      v_plot_pnl: {
        Row: {
          cherry_kg: number | null
          cost_per_kg: number | null
          farm_id: string | null
          farm_name: string | null
          fertilizer_costs: number | null
          harvest_season: string | null
          harvest_year: number | null
          margin_pct: number | null
          mbuni_kg: number | null
          net_profit: number | null
          other_costs: number | null
          pending_payments: number | null
          plot_name: string | null
          revenue_per_kg: number | null
          revenue_received: number | null
          spray_costs: number | null
          total_costs: number | null
          total_deliveries: number | null
          total_kg: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_season_cost_summary: {
        Row: {
          activity_count: number | null
          activity_type: string | null
          avg_cost_per_activity: number | null
          avg_inputs_per_activity: number | null
          avg_labour_per_activity: number | null
          cost_per_hectare: number | null
          farm_id: string | null
          farm_name: string | null
          harvest_year: number | null
          total_area_covered_ha: number | null
          total_cost: number | null
          total_input_cost: number | null
          total_labour_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_season_pnl: {
        Row: {
          avg_cherry_price_per_kg: number | null
          avg_mbuni_price_per_kg: number | null
          cherry_kg_total: number | null
          cherry_revenue: number | null
          cost_per_kg: number | null
          deliveries_advance: number | null
          deliveries_paid: number | null
          deliveries_partial: number | null
          deliveries_pending: number | null
          farm_id: string | null
          farm_name: string | null
          fertilizer_costs: number | null
          harvest_season: string | null
          harvest_year: number | null
          input_costs: number | null
          labour_costs: number | null
          margin_pct: number | null
          mbuni_kg_total: number | null
          mbuni_revenue: number | null
          mulching_costs: number | null
          net_profit_expected: number | null
          net_profit_realised: number | null
          pruning_costs: number | null
          revenue_outstanding: number | null
          revenue_received: number | null
          spraying_costs: number | null
          total_costs: number | null
          total_deliveries: number | null
          total_kg_delivered: number | null
          total_revenue_expected: number | null
          weeding_costs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_alerts: {
        Row: {
          id: string | null
          farm_id: string | null
          alert_type: string | null
          alert_priority: string | null
          message: string | null
          plot_id: string | null
          created_at: string | null
          acknowledged_at: string | null
          sort_order: number | null
        }
        Relationships: []
      }
      v_compliance_timeline: {
        Row: {
          farm_id: string | null
          plot_id: string | null
          actor_id: string | null
          actor_type: string | null
          event_type: string | null
          risk_level: string | null
          assessment_service: string | null
          created_at: string | null
          created_at_local_tz: string | null
        }
        Relationships: []
      }
      v_daily_production_new: {
        Row: {
          farm_id: string | null
          production_date: string | null
          num_animals: number | null
          total_milk_liters: number | null
          avg_milk_per_animal: number | null
          sick_count: number | null
        }
        Relationships: []
      }
      v_eudr_assessment_stream: {
        Row: {
          farm_id: string | null
          plot_id: string | null
          risk_level: string | null
          forest_cover_pct: string | null
          confidence_score: number | null
          assessment_service: string | null
          notes: string | null
          actor_id: string | null
          created_at: string | null
          created_at_local_tz: string | null
        }
        Relationships: []
      }
      v_eudr_summary: {
        Row: {
          farm_id: string | null
          total_plots: number | null
          plots_cleared: number | null
          plots_verify: number | null
          plots_blocked: number | null
          last_assessment: string | null
          avg_forest_cover: number | null
          verified_plots: number | null
        }
        Relationships: []
      }
      v_plot_status: {
        Row: {
          id: string | null
          farm_id: string | null
          plot_name: string | null
          area_hectares: number | null
          region_name: string | null
          risk_level: string | null
          forest_cover_pct: number | null
          compliance_status: string | null
          assessment_date: string | null
          ndvi_mean: number | null
          health_label: string | null
          satellite_date: string | null
          traffic_light_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_farm: { Args: { p_farm_id: string }; Returns: boolean }
      can_manage_farm_by_cow_id: {
        Args: { p_cow_id: string }
        Returns: boolean
      }
      can_manage_farm_by_small_ruminant_id: {
        Args: { p_animal_id: string }
        Returns: boolean
      }
      delete_expired_otps: { Args: never; Returns: undefined }
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
