import {
  CircleHelpIcon,
  FileTextIcon,
  ImageIcon,
  type LucideIcon,
  MapIcon,
  ReceiptIcon,
  RocketIcon,
} from 'lucide-react';
import type { TourEditorStep } from '@/lib/tour-editor-view';

/** Icon của từng bước (spec F19 §2a) — thanh bước và bước Review dùng chung một bảng. */
export const STEP_ICONS: Record<TourEditorStep, LucideIcon> = {
  details: FileTextIcon,
  photos: ImageIcon,
  itinerary: MapIcon,
  content: CircleHelpIcon,
  costs: ReceiptIcon,
  review: RocketIcon,
};
