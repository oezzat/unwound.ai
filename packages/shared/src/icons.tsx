// @ts-nocheck
import {
  Video, Siren, Clock, TriangleAlert, HeartPulse, MessageCircle, ClipboardList, Camera, CreditCard, Sparkles, PhoneOff, Bandage, Timer,
  NotebookPen, CircleCheck, CircleX, Stethoscope, Layers, Flag, MicOff, Mic, VideoOff, Hourglass, Cog, FlaskConical, SendHorizontal, Hospital,
  Download, Inbox, Receipt, Paperclip, LayoutDashboard, CalendarDays, House, Bell, Check, X, Circle, Phone, Radio,
} from "lucide-react";

// One icon set for both apps (Lucide, line style, inherits text colour, scales with font-size).
// Names are stable strings so the server can reference them (e.g. approval-card icons).
const ICONS = {
  video: Video, "video-off": VideoOff, siren: Siren, pending: Clock, warn: TriangleAlert, selma: HeartPulse, message: MessageCircle, plan: ClipboardList,
  camera: Camera, billing: CreditCard, augi: Sparkles, "end-call": PhoneOff, phone: Phone, wound: Bandage, timer: Timer, note: NotebookPen, done: CircleCheck,
  rejected: CircleX, exam: Stethoscope, ladder: Layers, flag: Flag, "mic-off": MicOff, mic: Mic, waiting: Hourglass, cog: Cog, labs: FlaskConical, send: SendHorizontal,
  referral: Hospital, download: Download, inbox: Inbox, receipt: Receipt, attach: Paperclip, dashboard: LayoutDashboard, calendar: CalendarDays, home: House,
  bell: Bell, check: Check, close: X, dot: Circle, live: Radio,
};

/** <Ic n="video"/> — inline icon. Size follows the surrounding font-size. Unknown names render as plain text (so old emoji strings still show). */
export function Ic({ n, size = "1.15em", label, style, className }) {
  const C = ICONS[n];
  if (!C) return n ? <span aria-hidden>{n}</span> : null;
  return <C size={size} strokeWidth={1.9} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ verticalAlign: "-0.2em", flexShrink: 0, ...style }} />;
}
