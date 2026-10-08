/** Types for demo-dashboard.json produced by scripts/30_export_demo_site_json.py */

export interface SegmentRow {
  segment: string;
  action: string;
  clients: number;
  revenue: number;
  pct_clients: number;
  pct_revenue: number;
  avg_frequency: number;
  avg_recency_days: number;
  avg_check: number;
}

export interface CallListRow {
  no?: number;
  client_name: string;
  phone_fmt: string;
  frequency?: number;
  monetary?: number;
  avg_check?: number;
  recency_days?: number;
  last_visit?: string;
  segment?: string;
  branches?: string;
}

export interface PrepayRow {
  client_name: string;
  phone_fmt?: string;
  branches?: string;
  noshow_streak?: number;
  noshow_rate_12m?: number;
  appointments_12m?: number;
  lost_revenue_12m?: number;
}

export interface DashboardSlice {
  branch_key: string;
  period_key: string;
  period_label: string;
  date_range: string;
  kpis: {
    clients: number;
    revenue: number;
    yadro_clients: number;
    yadro_pct_revenue: number;
    avg_check: number;
    noshow_pct_12m: number;
    novichki_clients: number;
    novichki_to_call: number;
    ukhodyat_clients: number;
    ukhodyat_revenue: number;
    prepay_recommended: number;
    lost_revenue_12m: number;
  };
  week_actions: string[];
  segments: SegmentRow[];
  call_lists: {
    ukhodyat: CallListRow[];
    yadro_no_booking: CallListRow[];
    novichki: CallListRow[];
  };
  noshow: {
    summary: Record<string, number | string | null>;
    prepay_list: PrepayRow[];
  };
  ads: {
    channels: { channel: string; clients: number; share_pct: number }[];
  };
}

export interface DemoPayload {
  meta: {
    product_name: string;
    salon_name: string;
    city: string;
    caption: string;
    /** Demo slice anchor, ISO date YYYY-MM-DD */
    anchor_date?: string;
    segment_actions: Record<string, string>;
    segment_order: string[];
    client_count_approx: number;
  };
  filters: {
    branches: { key: string; label: string; company_id?: string }[];
    periods: { key: string; label: string }[];
    default_branch: string;
    default_period: string;
  };
  slices: Record<string, DashboardSlice>;
  transitions: {
    pair_label: string;
    end_from?: string;
    end_to?: string;
    kpis: Record<string, number | string | null>;
    worsened: CallListRow[];
    flows: { flow: string; clients: number; sample?: CallListRow[] }[];
  };
  labels_preview: {
    title: string;
    summary: string;
    would_update: number;
    would_skip: number;
    sample: { name: string; from: string; to: string }[];
  };
}

export type PrimaryNav = "overview" | "noshow";
export type OverviewTab = "summary" | "calls";
export type MoreNav = "none" | "transitions" | "ads" | "labels";
