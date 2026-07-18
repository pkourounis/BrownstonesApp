/**
 * Hand-authored types mirroring supabase/migrations. Once the Supabase project
 * is provisioned you can regenerate a fuller version with:
 *   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

export type AppRole = 'super_admin' | 'manager' | 'employee';
export type EmploymentStatus = 'onboarding' | 'active' | 'inactive';
export type Department = 'boh' | 'foh' | 'management';
export type ShiftStatus = 'draft' | 'published';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';
export type ReviewStatus = 'scheduled' | 'completed' | 'skipped';
export type SwapKind = 'swap' | 'pickup';
export type ResourceType = 'product' | 'training' | 'compliance' | 'link' | 'document';
export type SchedulingRuleType =
  | 'max_hours_per_week'
  | 'max_consecutive_days'
  | 'min_rest_hours_between_shifts'
  | 'min_staff_on_peak'
  | 'max_labor_pct'
  | 'require_role_on_shift'
  | 'minor_curfew'
  | 'open_coverage'
  | 'manager_days_off'
  | 'lead_when_manager_off'
  | 'floor_manager_no_manager'
  | 'time_off_advance_days'
  | 'max_time_off_per_day'
  | 'review_cadence_months'
  | 'custom';

export const DEPARTMENT_LABELS: Record<Department, string> = {
  boh: 'Back of House',
  foh: 'Front of House',
  management: 'Management',
};
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
  opens_at: string;
  location_number: string | null;
  toast_guid: string | null; // Toast POS restaurant GUID (external id) for the sales sync
  seats: number | null;
  tables: number | null;
  revenue_per_hour_target: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LocationHours = {
  id: string;
  location_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export type ResourceKind = 'doc' | 'video' | 'link';

export type Resource = {
  id: string;
  type: ResourceType;
  kind: ResourceKind;
  category: string;
  title: string;
  description: string | null;
  url: string | null;
  requires_signoff: boolean;
  is_active: boolean;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ResourceAssignment = {
  id: string;
  resource_id: string;
  location_id: string | null;   // null = all locations
  profile_id: string | null;    // null = all employees
  department: Department | null; // null = all departments
  managers_only: boolean;
  created_at: string;
}

export type ResourceSignoff = {
  resource_id: string;
  profile_id: string;
  signed_at: string;
}

export type Profile = {
  id: string;
  full_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  employment_status: EmploymentStatus;
  primary_location_id: string | null;
  title: string | null;
  department: Department | null;
  hired_at: string | null;
  birthday: string | null;
  bio: string | null;
  address: string | null;
  marital_status: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_floor_cleared: boolean;
  must_change_password: boolean;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Pay, kept out of profiles so the directory can be world-readable. */
export type ProfileCompensation = {
  profile_id: string;
  hourly_rate: number | null;
  updated_at: string;
}

export type Position = {
  id: string;
  name: string;
  department: Department;
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

/** A job role an employee can work, with a manager-set 1–5 skill rating. */
export type StaffPosition = {
  profile_id: string;
  position_id: string;
  skill_level: number; // 1–5, 5 = most experienced
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type Shift = {
  id: string;
  location_id: string;
  position_id: string | null;
  employee_id: string | null;
  roster_employee_id: string | null;
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
  status: RequestStatus; // must be 'approved' for the scheduler to use it
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string | null;
  created_at: string;
}

/** A recurring busy window at a location (scheduler input #3). */
export type LocationPeakHours = {
  id: string;
  location_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  intensity: number; // 1 light, 2 standard, 3 peak
  expected_covers: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Required headcount for a role at a location on a given day.
 * month = null is the baseline; month = 1–12 is that month's override.
 */
export type StaffingRequirement = {
  id: string;
  location_id: string;
  position_id: string;
  day_of_week: number;
  month: number | null;
  required_count: number;
  must_cover_open: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** A hard constraint or soft preference for the scheduler (input #4). */
export type SchedulingRule = {
  id: string;
  location_id: string | null; // null = org-wide
  department: Department | null;
  rule_type: SchedulingRuleType;
  config: Record<string, unknown>;
  is_hard: boolean;
  is_active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export type ShiftSwapRequest = {
  id: string;
  shift_id: string;
  requested_by: string;
  requested_to: string | null;
  kind: SwapKind;               // 'swap' or 'pickup' (up-for-grabs)
  claimed_by: string | null;    // who claimed an open pickup
  status: RequestStatus;
  deviates_rules: boolean;      // flagged when the swap breaks a rule
  deviation_note: string | null;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type TimeOffBlackout = {
  id: string;
  location_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export type EmployeeReview = {
  id: string;
  profile_id: string;
  reviewer_id: string | null;
  due_date: string;
  status: ReviewStatus;
  completed_at: string | null;
  notes: string | null;
  skills_snapshot: Record<string, number> | null;
  created_at: string;
  updated_at: string;
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

export type PushSubscription = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

/** Hourly sales from Toast (per location per hour). */
export type PosSales = {
  id: string;
  location_id: string;
  business_date: string;
  hour: number;
  revenue: number;
  transactions: number;
  source: string;
  synced_at: string;
}

export type PostCategory = 'post' | 'announcement' | 'product' | 'seasonal' | 'menu';

/** Feed post. */
export type Post = {
  id: string;
  author_id: string | null;
  location_id: string | null;
  title: string | null;
  body: string;
  category: PostCategory;
  requires_ack: boolean;
  pinned: boolean;
  pinned_until: string | null;
  reposted_from: string | null;
  created_at: string;
}

export type PostComment = {
  id: string;
  post_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export type PostAttachment = {
  id: string;
  post_id: string;
  url: string;
  mime: string | null;
  created_at: string;
}

export type PostAck = {
  post_id: string;
  profile_id: string;
  acknowledged_at: string;
}

export type PostReaction = {
  post_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

export type ChatChannel = {
  id: string;
  name: string;
  location_id: string | null;
  kind: 'store' | 'managers' | 'dm';
  created_at: string;
}

export type ChatChannelMember = {
  channel_id: string;
  profile_id: string;
}

export type ChatMessage = {
  id: string;
  channel_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

/** Manager-only star ranking (0–5) for a team member. */
export type StaffRating = {
  profile_id: string;
  rating: number;
  updated_by: string | null;
  updated_at: string;
}

/** Unified schedulable roster: imported from Toast or added in-app. */
export type Employee = {
  id: string;
  location_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  position_id: string | null;
  department: Department | null;
  default_wage: number | null;
  source: 'toast' | 'manual';
  toast_employee_guid: string | null;
  active: boolean;
  rating: number | null;
  profile_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Punch in/out record synced from the Toast Labor API. */
export type ToastTimeEntry = {
  location_id: string;
  guid: string;
  employee_guid: string | null;
  job_guid: string | null;
  business_date: string;
  in_at: string | null;
  out_at: string | null;
  regular_hours: number;
  overtime_hours: number;
  hourly_wage: number;
  non_cash_tips: number;
  cash_tips: number | null;
  deleted: boolean;
  labor_cost: number;
  synced_at: string;
}

/** View: avg hourly revenue by (location, day-of-week, hour), trailing 8 weeks. */
export type LocationHourDemand = {
  location_id: string;
  day_of_week: number;
  hour: number;
  avg_revenue: number;
  avg_transactions: number;
  sample_days: number;
}

/** View: derived peak-hour intensity (1 light / 2 standard / 3 peak). */
export type DerivedPeakHour = LocationHourDemand & { intensity: number };

/** Reporting views (Insights page) — all RLS-scoped via security_invoker. */
export type ReportSalesMonthly = {
  location_id: string;
  ym: string; // 'YYYY-MM'
  net: number;
  checks: number;
};
export type ReportSalesByHour = {
  location_id: string;
  business_date: string;
  hour: number;
  revenue: number;
  checks: number;
};
export type ReportSalesTotals = {
  location_id: string;
  latest_date: string;
  latest_net: number;
  ytd_net: number;
  ytd_checks: number;
};
export type ReportForecastWeekly = {
  location_id: string;
  projected_week: number;
};
export type ReportDaypart = {
  location_id: string;
  breakfast_net: number;
  lunch_net: number;
};
export type ReportDow = {
  location_id: string;
  dow: number;
  avg_net: number;
};
export type ReportSalesDaily = {
  location_id: string;
  business_date: string;
  net: number;
};
export type LocationSalesForecast = {
  location_id: string;
  day_of_week: number;
  hour: number;
  forecast_revenue: number;
  trend_factor: number;
  season_factor: number;
};

export type Quiz = {
  id: string;
  title: string;
  description: string | null;
  pass_threshold: number;
  blocks_floor: boolean;
  is_active: boolean;
  created_at: string;
}

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  sort_order: number;
}

export type QuizAttempt = {
  id: string;
  quiz_id: string;
  profile_id: string;
  score: number;
  passed: boolean;
  taken_at: string;
}

export type TrainingCompletion = {
  profile_id: string;
  resource_id: string;
  completed_at: string;
}

export type ResourceAttachment = {
  id: string;
  resource_id: string;
  url: string;
  kind: string; // 'photo' | 'document' | 'other'
  name: string | null;
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
      profile_compensation: Table<ProfileCompensation>;
      positions: Table<Position>;
      staff_locations: Table<StaffLocation>;
      staff_positions: Table<StaffPosition>;
      shifts: Table<Shift>;
      availability: Table<Availability>;
      time_off_requests: Table<TimeOffRequest>;
      shift_swap_requests: Table<ShiftSwapRequest>;
      time_off_blackouts: Table<TimeOffBlackout>;
      employee_reviews: Table<EmployeeReview>;
      staffing_requirements: Table<StaffingRequirement>;
      location_peak_hours: Table<LocationPeakHours>;
      location_hours: Table<LocationHours>;
      scheduling_rules: Table<SchedulingRule>;
      pos_sales: Table<PosSales>;
      toast_time_entries: Table<ToastTimeEntry>;
      employees: Table<Employee>;
      staff_ratings: Table<StaffRating>;
      posts: Table<Post>;
      post_reactions: Table<PostReaction>;
      post_comments: Table<PostComment>;
      post_attachments: Table<PostAttachment>;
      post_acks: Table<PostAck>;
      chat_channels: Table<ChatChannel>;
      chat_messages: Table<ChatMessage>;
      chat_channel_members: Table<ChatChannelMember>;
      quizzes: Table<Quiz>;
      quiz_questions: Table<QuizQuestion>;
      quiz_attempts: Table<QuizAttempt>;
      training_completions: Table<TrainingCompletion>;
      resources: Table<Resource>;
      resource_assignments: Table<ResourceAssignment>;
      resource_signoffs: Table<ResourceSignoff>;
      resource_attachments: Table<ResourceAttachment>;
      notifications: Table<Notification>;
      push_subscriptions: Table<PushSubscription>;
    };
    Views: {
      location_hour_demand: { Row: LocationHourDemand; Relationships: [] };
      location_peak_hours_derived: { Row: DerivedPeakHour; Relationships: [] };
      location_sales_forecast: { Row: LocationSalesForecast; Relationships: [] };
      report_sales_monthly: { Row: ReportSalesMonthly; Relationships: [] };
      report_sales_by_hour: { Row: ReportSalesByHour; Relationships: [] };
      report_sales_totals: { Row: ReportSalesTotals; Relationships: [] };
      report_forecast_weekly: { Row: ReportForecastWeekly; Relationships: [] };
      report_daypart: { Row: ReportDaypart; Relationships: [] };
      report_dow: { Row: ReportDow; Relationships: [] };
      report_sales_daily: { Row: ReportSalesDaily; Relationships: [] };
    };
    Functions: {
      insights: {
        Args: { p_range: string; p_location: string | null };
        Returns: unknown;
      };
      sync_toast_now: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      timesheet: {
        Args: { p_date: string | null; p_location: string | null };
        Returns: unknown;
      };
      staffing_reco: {
        Args: { p_location: string | null; p_target: number };
        Returns: unknown;
      };
      roster_import_from_toast: {
        Args: Record<string, never>;
        Returns: number;
      };
      create_shift: {
        Args: {
          p_location: string;
          p_date: string;
          p_start: string;
          p_end: string;
          p_break: number;
          p_employee: string | null;
        };
        Returns: string;
      };
      week_shifts: {
        Args: { p_location: string; p_monday: string };
        Returns: unknown;
      };
      publish_week: {
        Args: { p_location: string; p_monday: string };
        Returns: number;
      };
      schedule_vs_actual: {
        Args: { p_location: string; p_date: string | null };
        Returns: unknown;
      };
      home_summary: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      open_dm: {
        Args: { p_other: string };
        Returns: string;
      };
      request_time_off: {
        Args: { p_start: string; p_end: string; p_reason: string };
        Returns: string | null;
      };
      set_timeoff_status: {
        Args: { p_id: string; p_approve: boolean };
        Returns: string | null;
      };
      notify_users: {
        Args: { p_targets: string[]; p_type: string; p_title: string; p_body: string | null; p_link: string | null };
        Returns: undefined;
      };
      location_managers: {
        Args: { p_location: string };
        Returns: string[];
      };
    };
    Enums: {
      app_role: AppRole;
      employment_status: EmploymentStatus;
      department: Department;
      shift_status: ShiftStatus;
      request_status: RequestStatus;
      review_status: ReviewStatus;
      swap_kind: SwapKind;
      resource_type: ResourceType;
      scheduling_rule_type: SchedulingRuleType;
      notification_type: NotificationType;
    };
  };
}
