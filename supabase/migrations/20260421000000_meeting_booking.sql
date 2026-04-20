-- Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    full_name TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    intent TEXT NOT NULL,
    proposal_url TEXT,
    booking_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Policies for meetings
CREATE POLICY "Enable insert for everyone" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for proposals (Note: User may need to manually enable this in Supabase dashboard)
-- We attempt to insert, but policies are the key part.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proposals', 'proposals', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for proposals
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'proposals');

CREATE POLICY "Authenticated Read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'proposals');

CREATE POLICY "Authenticated Manage"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'proposals')
WITH CHECK (bucket_id = 'proposals');
