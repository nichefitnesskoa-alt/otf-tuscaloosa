import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface VipMember {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  phone_normalized: string | null;
  email: string | null;
  birthday: string | null;
  vip_last_interaction_at: string | null;
  vip_notes: string | null;
  vip_referral_count: number;
  vip_milestones: any;
  created_at: string;
}

export interface VipRegistrationLite {
  id: string;
  vip_member_id: string | null;
  vip_session_id: string | null;
  vip_class_name: string | null;
  booking_id: string | null;
}

export interface VipBookingLite {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  vip_session_id: string | null;
  phone: string | null;
}

export interface VipTouchpoint {
  id: string;
  vip_member_id: string;
  staff_name: string;
  touchpoint_type: 'text' | 'call' | 'in_person' | 'email' | 'class_visit';
  notes: string | null;
  created_at: string;
}

export interface VipRunLite {
  id: string;
  member_name: string;
  run_date: string | null;
  result_canon: string;
  is_vip: boolean;
}

export function useVipsData() {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const [members, setMembers] = useState<VipMember[]>([]);
  const [registrations, setRegistrations] = useState<VipRegistrationLite[]>([]);
  const [bookings, setBookings] = useState<VipBookingLite[]>([]);
  const [touchpoints, setTouchpoints] = useState<VipTouchpoint[]>([]);
  const [runs, setRuns] = useState<VipRunLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    const [mRes, rRes, bRes, tRes, runRes] = await Promise.all([
      supabase.from('vip_members' as any).select('*').is('deleted_at', null).order('first_name'),
      supabase.from('vip_registrations').select('id, vip_member_id, vip_session_id, vip_class_name, booking_id'),
      supabase.from('intros_booked')
        .select('id, member_name, class_date, intro_time, coach_name, vip_session_id, phone')
        .or('is_vip.eq.true,booking_type_canon.eq.VIP')
        .is('deleted_at', null),
      supabase.from('vip_touchpoints' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('intros_run').select('id, member_name, run_date, result_canon, is_vip'),
    ]);
    setMembers((mRes.data as any) || []);
    setRegistrations((rRes.data as any) || []);
    setBookings((bRes.data as any) || []);
    setTouchpoints((tRes.data as any) || []);
    setRuns((runRes.data as any) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Coach scope: only members whose registrations are tied to bookings the coach ran
  const scopedMemberIds = useMemo(() => {
    if (!isCoach) return null;
    const myBookingIds = new Set(bookings.filter(b => b.coach_name === user?.name).map(b => b.id));
    const ids = new Set<string>();
    registrations.forEach(r => {
      if (r.booking_id && myBookingIds.has(r.booking_id) && r.vip_member_id) ids.add(r.vip_member_id);
    });
    return ids;
  }, [isCoach, bookings, registrations, user?.name]);

  const scopedMembers = useMemo(() => {
    if (!scopedMemberIds) return members;
    return members.filter(m => scopedMemberIds.has(m.id));
  }, [members, scopedMemberIds]);

  // Lifetime visits — live computed from intros_run by phone or name
  const lifetimeVisitsFor = useCallback((m: VipMember): number => {
    const fullName = `${m.first_name} ${m.last_name || ''}`.trim().toLowerCase();
    return runs.filter(r => {
      const same = (r.member_name || '').trim().toLowerCase() === fullName;
      return same;
    }).length;
  }, [runs]);

  return {
    members: scopedMembers,
    allMembers: members,
    registrations,
    bookings,
    touchpoints,
    runs,
    isLoading,
    isCoach,
    fetchAll,
    lifetimeVisitsFor,
  };
}
