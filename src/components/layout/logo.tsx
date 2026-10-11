import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold tracking-tight text-text" aria-label="BG LEARN — начало">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 10.5V15c0 1.4 2.2 2.8 5 2.8s5-1.4 5-2.8v-4.5" />
          <path d="M21 8.5V14" />
        </svg>
      </span>
      <span className="text-[15px]">
        BG <span className="text-accent">LEARN</span>
      </span>
    </Link>
  );
}
