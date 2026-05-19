-- Migration to add transactions table for Daraja MPesa integration
CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES public.farms(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  phone_number text NOT NULL,
  merchant_request_id text NOT NULL,
  checkout_request_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, completed, failed
  mpesa_receipt_number text,
  result_desc text,
  months_added integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage transactions"
ON public.transactions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
