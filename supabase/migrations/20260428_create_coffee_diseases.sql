-- Create coffee_diseases table for disease reporting
CREATE TABLE IF NOT EXISTS coffee_diseases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plot_id UUID NOT NULL REFERENCES coffee_plots(id) ON DELETE CASCADE,
  disease_name TEXT NOT NULL,
  severity_level TEXT NOT NULL CHECK (severity_level IN ('watch', 'action', 'emergency')),
  affected_percentage NUMERIC(5,2) NOT NULL CHECK (affected_percentage >= 0 AND affected_percentage <= 100),
  detection_date DATE NOT NULL,
  treatment_applied TEXT,
  treatment_date DATE,
  resulting_losses_kg NUMERIC(10,2),
  photo_url TEXT,
  notes TEXT,
  ai_diagnosis TEXT DEFAULT 'Pending AI analysis',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_coffee_diseases_farm_id ON coffee_diseases(farm_id);
CREATE INDEX IF NOT EXISTS idx_coffee_diseases_plot_id ON coffee_diseases(plot_id);
CREATE INDEX IF NOT EXISTS idx_coffee_diseases_detection_date ON coffee_diseases(detection_date);
CREATE INDEX IF NOT EXISTS idx_coffee_diseases_severity ON coffee_diseases(severity_level);

-- Enable RLS
ALTER TABLE coffee_diseases ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see diseases for their farm's plots
CREATE POLICY "coffee_diseases_select_farm" 
  ON coffee_diseases 
  FOR SELECT 
  USING (
    farm_id IN (
      SELECT farm_id FROM farm_managers 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert diseases for their farm's plots
CREATE POLICY "coffee_diseases_insert_farm" 
  ON coffee_diseases 
  FOR INSERT 
  WITH CHECK (
    farm_id IN (
      SELECT farm_id FROM farm_managers 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own farm's diseases
CREATE POLICY "coffee_diseases_update_farm" 
  ON coffee_diseases 
  FOR UPDATE 
  USING (
    farm_id IN (
      SELECT farm_id FROM farm_managers 
      WHERE user_id = auth.uid()
    )
  );
