/**
 * Hand-authored types mirroring supabase/migrations. Once the Supabase project
 * is provisioned you can regenerate a fuller version with:
 *   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type AppRole = 'super_admin' | 'manager' | 'employee';
export type EmploymentStatus = 'onboarding' | 'active' | 'inactive';
export type ShiftStatus = 'draft' | 'published';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';
export type NotificationType =
  | 'schedule_published'
  | 'shift_changed'
  | 'time_off_reviewed'
  | 'swap_request'
  | 'announcement'
  | 'general';

export type Location = {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Profile = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  employment_status: EmploymentStatus;
  primary_location_id: string | null;
  title: string | null;
  hourly_rate: number | null;
  hired_at: string | null;
  birthday: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export type Position = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type StaffLocation = {
  profile_id: string;
  location_id: string;
  is_primary: boolean;
  created_at: string;
}

export type Shift = {
  id: string;
  location_id: string;
  position_id: string | null;
  employee_id: string | null;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  status: ShiftStatus;
  notes: string | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Availability = {
  id: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  note: string | null;
  created_at: string;
}

export type TimeOffRequest = {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export type Notification = {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      locations: Table<Location>;
      profiles: Table<Profile>;
      positions: Table<Position>;
      staff_locations: Table<StaffLocation>;
      shifts: Table<Shift>;
      availability: Table<Availability>;
      time_off_requests: Table<TimeOffRequest>;
      notifications: Table<Notification>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      employment_status: EmploymentStatus;
      shift_status: ShiftStatus;
      request_status: RequestStatus;
      notification_type: NotificationType;
    };
  };
}
