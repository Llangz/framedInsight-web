-- Add coffee plot weather data table
CREATE TABLE IF NOT EXISTS coffee_plot_weather (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES coffee_plots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Weather observations
  temperature_2m_mean NUMERIC(5,2),
  temperature_2m_max NUMERIC(5,2),
  temperature_2m_min NUMERIC(5,2),
  precipitation_sum NUMERIC(6,2),
  relative_humidity_2m_mean NUMERIC(5,2),
  soil_moisture_0_to_10cm NUMERIC(6,3),
  evapotranspiration NUMERIC(6,3),
  weather_code INTEGER,
  
  -- Calculated risk scores
  cbd_risk_score INTEGER CHECK (cbd_risk_score BETWEEN 0 AND 100),
  clr_risk_score INTEGER CHECK (clr_risk_score BETWEEN 0 AND 100),
  drought_stress_score INTEGER CHECK (drought_stress_score BETWEEN 0 AND 100),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plot_id, date)
);

-- Indexes for performance
CREATE INDEX idx_weather_plot_date ON coffee_plot_weather(plot_id, date DESC);
CREATE INDEX idx_weather_cbd_risk ON coffee_plot_weather(cbd_risk_score DESC) WHERE cbd_risk_score > 60;
CREATE INDEX idx_weather_clr_risk ON coffee_plot_weather(clr_risk_score DESC) WHERE clr_risk_score > 60;
CREATE INDEX idx_weather_drought ON coffee_plot_weather(drought_stress_score DESC) WHERE drought_stress_score > 60;

-- View for latest weather per plot with risk averages
CREATE OR REPLACE VIEW v_plot_latest_weather AS
SELECT 
  cp.id AS plot_id,
  cp.farm_id,
  cp.plot_name,
  cp.region_name,
  cw.date AS weather_date,
  cw.temperature_2m_mean,
  cw.precipitation_sum,
  cw.relative_humidity_2m_mean,
  cw.soil_moisture_0_to_10cm,
  cw.cbd_risk_score,
  cw.clr_risk_score,
  cw.drought_stress_score,
  -- 7-day averages
  AVG(cw.cbd_risk_score) OVER (
    PARTITION BY cp.id 
    ORDER BY cw.date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS avg_cbd_risk_7d,
  AVG(cw.clr_risk_score) OVER (
    PARTITION BY cp.id 
    ORDER BY cw.date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS avg_clr_risk_7d,
  AVG(cw.drought_stress_score) OVER (
    PARTITION BY cp.id 
    ORDER BY cw.date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS avg_drought_risk_7d
FROM coffee_plots cp
LEFT JOIN LATERAL (
  SELECT * FROM coffee_plot_weather cpw 
  WHERE cpw.plot_id = cp.id 
  ORDER BY cpw.date DESC 
  LIMIT 1
) cw ON true
WHERE cp.id IS NOT NULL;

-- Grant permissions
ALTER TABLE coffee_plot_weather ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON coffee_plot_weather
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policy: Farmers can read their own farm's weather data
CREATE POLICY "Farm managers can read" ON coffee_plot_weather
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM farm_managers fm
      JOIN coffee_plots cp ON cp.farm_id = fm.farm_id
      WHERE fm.user_id = auth.uid()
      AND cp.id = coffee_plot_weather.plot_id
    )
  );
