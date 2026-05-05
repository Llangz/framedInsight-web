-- Enable Row Level Security on core tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cows ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_harvests ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_disease_thresholds ENABLE ROW LEVEL SECURITY;

-- Policy 1: farm_managers can only read/update their own association
CREATE POLICY "Users can manage their own farm manager associations"
ON farm_managers
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: farms can only be viewed/updated by their managers
CREATE POLICY "Farm managers can view their farms"
ON farms
FOR SELECT
USING (id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()));

CREATE POLICY "Farm managers can update their farms"
ON farms
FOR UPDATE
USING (id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
WITH CHECK (id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()));

-- Policy 3: cows can only be accessed by the farm manager
CREATE POLICY "Farm managers can access their cows"
ON cows
FOR ALL
USING (farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
WITH CHECK (farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()));

-- Policy 4: milk_records can only be accessed by the farm manager (via cows)
CREATE POLICY "Farm managers can access their milk records"
ON milk_records
FOR ALL
USING (cow_id IN (SELECT id FROM cows WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())))
WITH CHECK (cow_id IN (SELECT id FROM cows WHERE farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid())));

-- Policy 5: coffee_plots can only be accessed by the farm manager
CREATE POLICY "Farm managers can access their coffee plots"
ON coffee_plots
FOR ALL
USING (farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
WITH CHECK (farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()));

-- Policy 6: coffee_harvests can only be accessed by the farm manager
CREATE POLICY "Farm managers can access their coffee harvests"
ON coffee_harvests
FOR ALL
USING (farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()))
WITH CHECK (farm_id IN (SELECT farm_id FROM farm_managers WHERE user_id = auth.uid()));

-- Policy 7: coffee_disease_thresholds are global reference data; anyone can read them
CREATE POLICY "Anyone can read coffee disease thresholds"
ON coffee_disease_thresholds
FOR SELECT
USING (true);

-- Security definer functions for auth bypass on secure endpoints are maintained separately.
