import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users } from 'lucide-react';
import otfLogo from '@/assets/otf-logo.jpg';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';

const OTF_ORANGE = '#FF6900';
const sb = supabase as any;

interface SessionInfo {
  id: string;
  reserved_by_group: string | null;
  session_date: string;
  session_time: string;
}

interface Registrant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

export default function VipRoster() {
  const { slug } = useParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    if (!slug) return;
    const { data: sessions } = await sb
      .from('vip_sessions')
      .select('id, reserved_by_group, session_date, session_time')
      .eq('shareable_slug', slug)
      .limit(1);

    const matched = (sessions as any[])?.[0];
    if (!matched) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSession(matched);

    const { data: regs } = await sb
      .from('vip_registrations')
      .select('id, first_name, last_name, created_at')
      .eq('vip_session_id', matched.id)
      .eq('is_group_contact', false)
      .order('created_at', { ascending: false });

    setRegistrants((regs as any[]) || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const displayName = (r: Registrant) => {
    const first = r.first_name || '';
    const lastInitial = r.last_name ? `${r.last_name[0]}.` : '';
    return `${first} ${lastInitial}`.trim() || 'Guest';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: OTF_ORANGE }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />
        <h1 className="text-xl font-bold mb-2" style={{ color: '#1a1a1a' }}>Session Not Found</h1>
        <p className="text-sm" style={{ color: '#888' }}>This roster link may be invalid or the session has been removed.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8">
      <img src={otfLogo} alt="Orangetheory Fitness" className="h-12 mb-6 object-contain" />

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: '#FFF5EB', color: OTF_ORANGE }}>
            <Users className="w-4 h-4" />
            Registration Roster
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
            {session?.reserved_by_group || 'VIP'} Class
          </h1>
          {session && (
            <p className="text-sm" style={{ color: '#555' }}>
              {format(new Date(session.session_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')} at {formatDisplayTime(session.session_time)}
            </p>
          )}
        </div>

        {/* Count */}
        <div className="text-center py-4 rounded-xl" style={{ backgroundColor: '#FFF5EB' }}>
          <span className="text-3xl font-bold" style={{ color: OTF_ORANGE }}>{registrants.length}</span>
          <p className="text-sm font-medium mt-1" style={{ color: '#555' }}>
            {registrants.length === 1 ? 'person registered' : 'people registered'} so far
          </p>
        </div>

        {/* List */}
        {registrants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: '#888' }}>
              No registrations yet. Share the registration link to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {registrants.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ backgroundColor: i % 2 === 0 ? '#FAFAFA' : '#F5F5F5' }}
              >
                <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  {displayName(r)}
                </span>
                <span className="text-xs" style={{ color: '#999' }}>
                  {format(new Date(r.created_at), 'MMM d, h:mm a')}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs" style={{ color: '#ccc' }}>
          Updates automatically every 30 seconds
        </p>
      </div>
    </div>
  );
}
