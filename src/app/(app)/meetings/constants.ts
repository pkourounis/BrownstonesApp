import type { MeetingType } from '@/lib/database.types';

export const MEETING_TYPES: { key: MeetingType; label: string }[] = [
  { key: 'review', label: 'Employee review' },
  { key: 'disciplinary', label: 'Disciplinary meeting' },
  { key: 'training', label: 'Training' },
  { key: 'discussion', label: 'Discussion' },
  { key: 'other', label: 'Other' },
];
