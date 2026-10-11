import {
  Atom,
  BookOpen,
  Brain,
  Briefcase,
  Car,
  Code2,
  Cpu,
  Dna,
  Dumbbell,
  Feather,
  FlaskConical,
  Globe2,
  Hammer,
  HeartPulse,
  Hotel,
  Landmark,
  Languages,
  Leaf,
  LifeBuoy,
  Monitor,
  Music,
  Palette,
  Scale,
  Sigma,
  Sprout,
  Type,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  atom: Atom,
  book: BookOpen,
  brain: Brain,
  briefcase: Briefcase,
  car: Car,
  code: Code2,
  cpu: Cpu,
  dna: Dna,
  dumbbell: Dumbbell,
  feather: Feather,
  flask: FlaskConical,
  globe: Globe2,
  hammer: Hammer,
  heart: HeartPulse,
  hotel: Hotel,
  landmark: Landmark,
  language: Type,
  languages: Languages,
  leaf: Leaf,
  lifebuoy: LifeBuoy,
  monitor: Monitor,
  music: Music,
  palette: Palette,
  scale: Scale,
  sigma: Sigma,
  sprout: Sprout,
  users: Users,
  zap: Zap,
} as const;

export function SubjectIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = ICONS[icon as keyof typeof ICONS] ?? BookOpen;
  const box = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-14 w-14 rounded-2xl" }[size];
  const ic = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" }[size];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-[color-mix(in_srgb,var(--subject)_14%,transparent)] text-[var(--subject)] dark:bg-[color-mix(in_srgb,var(--subject)_30%,transparent)] dark:text-[color-mix(in_srgb,var(--subject)_45%,white)]",
        box,
        className,
      )}
      style={{ "--subject": color } as React.CSSProperties}
    >
      <Icon className={ic} strokeWidth={1.9} />
    </span>
  );
}
