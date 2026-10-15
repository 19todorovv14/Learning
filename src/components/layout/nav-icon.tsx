import {
  BookOpen,
  Car,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Layers,
  LibraryBig,
  NotebookPen,
  Settings,
  Shield,
  Sparkles,
  Target,
  Wrench,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  home: Home,
  graduation: GraduationCap,
  library: LibraryBig,
  book: BookOpen,
  sparkles: Sparkles,
  check: ClipboardCheck,
  clipboard: ClipboardList,
  layers: Layers,
  notebook: NotebookPen,
  target: Target,
  landmark: Landmark,
  wrench: Wrench,
  car: Car,
  heart: HeartPulse,
  settings: Settings,
  shield: Shield,
} as const;

export function NavIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? BookOpen;
  return <Icon {...props} />;
}
