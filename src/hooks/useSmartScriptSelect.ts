import { ScriptTemplate } from '@/hooks/useScriptTemplates';
import { isMembershipSale } from '@/lib/sales-detection';
import { format, addDays } from 'date-fns';

function getLocalDateString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface ScriptContext {
  personType: 'booking' | 'lead';
  isSecondIntro?: boolean;
  classDate?: string;
  classTime?: string | null;
  bookingCreatedAt?: string;
  qCompleted?: boolean;
  qSlug?: string | null;
  introResult?: string | null;
  primaryObjection?: string | null;
  leadStage?: string;
  leadSource?: string;
}

export interface SmartScriptResult {
  template: ScriptTemplate | null;
  note: string | null;
  relevantCategories: string[];
}

const OBJECTION_VARIANT_MAP: Record<string, string> = {
  'Pricing': '7B',
  'Time': '7C',
  'Shopping Around': '7D',
  'Think About It': '7E',
  'Spousal/Parental': '7F',
  "Didn't Like It": '7F',
  'Out of Town': '7A',
  'Other': '7A',
};

export function selectBestScript(
  ctx: ScriptContext,
  templates: ScriptTemplate[]
): SmartScriptResult {
  const active = templates.filter(t => t.is_active);
  const now = new Date();
  const today = getLocalDateString();
  const tomorrow = getLocalDateString(addDays(now, 1));

  const find = (cat: string, filter?: (t: ScriptTemplate) => boolean): ScriptTemplate | null => {
    const pool = active.filter(t => t.category === cat);
    if (filter) return pool.find(filter) || pool[0] || null;
    return pool[0] || null;
  };

  // --- BOOKING ---
  if (ctx.personType === 'booking' && ctx.classDate) {
    const isClassToday = ctx.classDate === today;
    const isClassTomorrow = ctx.classDate === tomorrow;
    const isPast = ctx.classDate < today;

    let classTimePassed = false;
    let hoursSinceClass = 0;
    if (ctx.classTime && isClassToday) {
      const parts = ctx.classTime.split(':').map(Number);
      const ct = new Date();
      ct.setHours(parts[0], parts[1], 0, 0);
      classTimePassed = now > ct;
      hoursSinceClass = Math.max(0, (now.getTime() - ct.getTime()) / 3600000);
    }

    let hoursSinceBooking = Infinity;
    if (ctx.bookingCreatedAt) {
      hoursSinceBooking = (now.getTime() - new Date(ctx.bookingCreatedAt).getTime()) / 3600000;
    }

    // TOMORROW
    if (isClassTomorrow) {
      if (ctx.isSecondIntro) {
        return {
          template: find('booking_confirmation', t => t.name.toLowerCase().includes('2nd')),
          note: null,
          relevantCategories: ['booking_confirmation', 'pre_class_reminder'],
        };
      }
      if (hoursSinceBooking < 6) {
        const hrs = Math.round(hoursSinceBooking);
        return {
          template: find('booking_confirmation', t => t.name.toLowerCase().includes('1st')),
          note: `Booked ${hrs} hour${hrs !== 1 ? 's' : ''} ago. Confirmation likely unnecessary.`,
          relevantCategories: ['booking_confirmation', 'pre_class_reminder'],
        };
      }
      return {
        template: find('booking_confirmation', t => t.name.toLowerCase().includes('1st')),
        note: null,
        relevantCategories: ['booking_confirmation', 'pre_class_reminder'],
      };
    }

    // TODAY
    if (isClassToday) {
      if (!classTimePassed) {
        return {
          template: null,
          note: 'Class is today. Prepare with the Prep card.',
          relevantCategories: ['booking_confirmation'],
        };
      }

      if (ctx.introResult) {
        if (isMembershipSale(ctx.introResult)) {
          return {
            template: find('post_class_joined'),
            note: null,
            relevantCategories: ['post_class_joined', 'referral_ask'],
          };
        }
        const isNoShow = ctx.introResult.toLowerCase().replace(/[\s-]+/g, '').includes('noshow');
        if (isNoShow) {
          return {
            template: find('no_show', t => (t.sequence_order || 99) <= 1),
            note: null,
            relevantCategories: ['no_show'],
          };
        }
        // Didn't buy
        const variant = ctx.primaryObjection ? OBJECTION_VARIANT_MAP[ctx.primaryObjection] : null;
        return {
          template: find('post_class_no_close', t =>
            variant ? (t.variant_label || '').includes(variant) : (t.sequence_order || 99) <= 1
          ),
          note: null,
          relevantCategories: ['post_class_no_close'],
        };
      }

      if (hoursSinceClass >= 1) {
        return {
          template: find('no_show', t => (t.sequence_order || 99) <= 1),
          note: `Class ended ${Math.round(hoursSinceClass)}h ago. Outcome not logged.`,
          relevantCategories: ['no_show', 'post_class_no_close', 'post_class_joined'],
        };
      }

      return {
        template: null,
        note: 'Class just ended. Log the intro result first.',
        relevantCategories: ['post_class_no_close', 'post_class_joined', 'no_show'],
      };
    }

    // PAST
    if (isPast) {
      if (ctx.introResult) {
        if (isMembershipSale(ctx.introResult)) {
          return { template: find('post_class_joined'), note: null, relevantCategories: ['post_class_joined', 'referral_ask'] };
        }
        const isNoShow = ctx.introResult.toLowerCase().replace(/[\s-]+/g, '').includes('noshow');
        if (isNoShow) {
          return { template: find('no_show'), note: null, relevantCategories: ['no_show'] };
        }
        const variant = ctx.primaryObjection ? OBJECTION_VARIANT_MAP[ctx.primaryObjection] : null;
        return {
          template: find('post_class_no_close', t =>
            variant ? (t.variant_label || '').includes(variant) : (t.sequence_order || 99) <= 1
          ),
          note: null,
          relevantCategories: ['post_class_no_close'],
        };
      }
      return { template: find('no_show'), note: 'Past booking with no outcome.', relevantCategories: ['no_show', 'post_class_no_close'] };
    }

    // FUTURE (not tomorrow)
    return {
      template: find('booking_confirmation', t =>
        ctx.isSecondIntro ? t.name.toLowerCase().includes('2nd') : t.name.toLowerCase().includes('1st')
      ),
      note: null,
      relevantCategories: ['booking_confirmation', 'pre_class_reminder'],
    };
  }

  // --- LEAD ---
  if (ctx.personType === 'lead') {
    if (ctx.leadStage === 'new') {
      const src = (ctx.leadSource || '').toLowerCase();
      if (src.includes('instagram') || src.includes('ig')) {
        return { template: find('ig_dm', t => (t.sequence_order || 99) <= 1), note: null, relevantCategories: ['ig_dm'] };
      }
      return { template: find('web_lead', t => (t.sequence_order || 99) <= 1), note: null, relevantCategories: ['web_lead', 'ig_dm'] };
    }
    return { template: null, note: null, relevantCategories: ['web_lead', 'ig_dm', 'cold_lead'] };
  }

  return { template: null, note: null, relevantCategories: [] };
}
