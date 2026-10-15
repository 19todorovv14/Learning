export type NavItem = { href: string; label: string; icon: string; minRole?: "EDITOR" };
export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Учене",
    items: [
      { href: "/dashboard", label: "Начало", icon: "home" },
      { href: "/my-learning", label: "Моето обучение", icon: "graduation" },
      { href: "/subjects", label: "Всички предмети", icon: "library" },
      { href: "/lessons", label: "Уроци", icon: "book" },
      { href: "/tutor", label: "AI учител", icon: "sparkles" },
      { href: "/quizzes", label: "Тестове", icon: "check" },
      { href: "/review", label: "Преговор", icon: "layers" },
      { href: "/notes", label: "Моите записки", icon: "notebook" },
    ],
  },
  {
    title: "Изпити и пътища",
    items: [
      { href: "/exams", label: "Подготовка за изпити", icon: "clipboard" },
      { href: "/admission", label: "Кандидатстване", icon: "target" },
      { href: "/universities", label: "Университети", icon: "landmark" },
      { href: "/vocational", label: "Професионално обучение", icon: "wrench" },
      { href: "/driving", label: "Шофьорски изпити", icon: "car" },
      { href: "/first-aid", label: "Първа помощ и спасители", icon: "heart" },
    ],
  },
  {
    title: "Акаунт",
    items: [
      { href: "/settings", label: "Профил и настройки", icon: "settings" },
      { href: "/admin", label: "Администрация", icon: "shield", minRole: "EDITOR" },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Начало", icon: "home" },
  { href: "/subjects", label: "Предмети", icon: "library" },
  { href: "/tutor", label: "AI учител", icon: "sparkles" },
  { href: "/quizzes", label: "Тестове", icon: "check" },
];
