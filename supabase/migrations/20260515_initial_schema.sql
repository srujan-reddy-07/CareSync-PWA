-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Tables
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    blood_type TEXT,
    allergies TEXT,
    role TEXT CHECK (role IN ('user', 'caretaker')) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    stock INT DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.patient_caretakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    caretaker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, caretaker_id)
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caretakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Caretakers can read patient profile" ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.patient_caretakers pc WHERE pc.patient_id = public.profiles.id AND pc.caretaker_id = auth.uid())
);

-- Medications
CREATE POLICY "Users can view own medications" ON public.medications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Caretakers can view assigned patient medications" ON public.medications FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.patient_caretakers pc WHERE pc.patient_id = public.medications.user_id AND pc.caretaker_id = auth.uid())
);

-- Schedules
CREATE POLICY "Users can view own schedules" ON public.schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedules" ON public.schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.schedules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.schedules FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Caretakers can view assigned patient schedules" ON public.schedules FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.patient_caretakers pc WHERE pc.patient_id = public.schedules.user_id AND pc.caretaker_id = auth.uid())
);

-- Patient Caretakers (Only patient can add/remove caretakers)
CREATE POLICY "Patients view their caretakers" ON public.patient_caretakers FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = caretaker_id);
CREATE POLICY "Patients can assign caretakers" ON public.patient_caretakers FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can remove caretakers" ON public.patient_caretakers FOR DELETE USING (auth.uid() = patient_id);

-- Audit Logs (Insert via trigger, Select only by admins/service role, so no public policies needed or restrict to user)
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);

-- 5. Audit Log Triggers
CREATE OR REPLACE FUNCTION public.log_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (action, user_id, target_table, target_id, details)
    VALUES (TG_OP, auth.uid(), TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), row_to_json(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_medications
AFTER INSERT OR UPDATE OR DELETE ON public.medications
FOR EACH ROW EXECUTE FUNCTION public.log_action();

CREATE TRIGGER audit_schedules
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.log_action();
