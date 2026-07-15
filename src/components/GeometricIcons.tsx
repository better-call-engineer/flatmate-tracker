'use client';

import { SVGProps } from 'react';

// ─── Base SVG wrapper ──────────────────────────────────────────────────────
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

// ─── Category Icons ────────────────────────────────────────────────────────

/** Rent — geometric house with diamond roof */
export function IconRent(props: IconProps) {
  return (
    <Icon {...props}>
      <polygon points="12 2 22 9 22 22 2 22 2 9" />
      <rect x="8" y="14" width="8" height="8" />
      <line x1="12" y1="2" x2="12" y2="14" />
    </Icon>
  );
}

/** Internet — signal rings */
export function IconWifi(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.55a11 11 0 0 1 14 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </Icon>
  );
}

/** Maid — broom sweep geometric */
export function IconBroom(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 22L15 11" />
      <path d="M15 11l5-9" />
      <path d="M11 15l4-4" />
      <path d="M4 22c3-1 6-2 7-4" />
      <line x1="20" y1="2" x2="15" y2="7" />
    </Icon>
  );
}

/** Electricity — lightning bolt (Zap-style geometric) */
export function IconBolt(props: IconProps) {
  return (
    <Icon {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Icon>
  );
}

/** Gas — flame geometric */
export function IconFlame(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 22c5 0 9-4.5 9-9.5C21 9 19 6 17 4c0 3-2 4-4 3-1.5-.7-2-3-2-4S9 1 7 3c-3 3-3 7-3 9.5C4 17.5 7 22 12 22z" />
      <path d="M12 22c-3 0-5-2-5-5 0-2 1.5-3 3-4 0 1.5.5 3 2 3.5 1.5.5 3-1 3-2.5 1 1 2 2.5 2 5 0 1.7-2.2 3-5 3z" />
    </Icon>
  );
}

/** Grocery — shopping bag geometric */
export function IconBag(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Icon>
  );
}

/** Miscellaneous — geometric grid of dots */
export function IconGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </Icon>
  );
}

/** Fixed Charges pin — geometric diamond pin */
export function IconPin(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2l3.5 7H20l-5 4.5 2 7L12 18l-5 2.5 2-7L4 9h4.5L12 2z" />
    </Icon>
  );
}

/** Wallet — for balance */
export function IconWallet(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1" y="6" width="22" height="14" rx="2" ry="2" />
      <path d="M1 10h22" />
      <circle cx="17" cy="15" r="1" fill="currentColor" />
    </Icon>
  );
}

/** Activity pulse */
export function IconActivity(props: IconProps) {
  return (
    <Icon {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Icon>
  );
}

/** Trending up arrow */
export function IconTrendUp(props: IconProps) {
  return (
    <Icon {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </Icon>
  );
}

/** Trending down arrow */
export function IconTrendDown(props: IconProps) {
  return (
    <Icon {...props}>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </Icon>
  );
}

/** Meal / fork-knife */
export function IconMeal(props: IconProps) {
  return (
    <Icon {...props}>
      <line x1="18" y1="8" x2="18" y2="21" />
      <line x1="15" y1="8" x2="21" y2="8" />
      <line x1="15" y1="12" x2="21" y2="12" />
      <path d="M6 2l.5 10.5L3 21h6l-2.5-8.5L7 2z" />
      <line x1="6" y1="2" x2="6" y2="21" />
    </Icon>
  );
}

/** Shield check for admin */
export function IconShield(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </Icon>
  );
}

/** Lock geometric */
export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  );
}

/** User add */
export function IconUserPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </Icon>
  );
}

/** Clock / pending */
export function IconClock(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  );
}

/** Check circle / active */
export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Icon>
  );
}

/** Plus geometric */
export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

/** Arrow right chevron */
export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <polyline points="9 18 15 12 9 6" />
    </Icon>
  );
}

/** Log out */
export function IconLogOut(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}

/** Home / building geometric */
export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Icon>
  );
}

/** Dashboard / layout grid */
export function IconDashboard(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </Icon>
  );
}

/** Credit card / expenses */
export function IconCard(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </Icon>
  );
}

/** Bar chart / reports */
export function IconChart(props: IconProps) {
  return (
    <Icon {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </Icon>
  );
}

/** Settings / overheads */
export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}

/** Calendar geometric */
export function IconCalendar(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Icon>
  );
}

/** Message square / edit requests */
export function IconMessage(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

/** Users / members */
export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

// ─── Category icon map (returns React elements) ─────────────────────────────
export type CategoryIconKey = 'rent' | 'internet' | 'maid' | 'electricity' | 'gas' | 'misc' | 'grocery';

export const CATEGORY_ICON_MAP: Record<CategoryIconKey, (props: IconProps) => JSX.Element> = {
  rent:        IconRent,
  internet:    IconWifi,
  maid:        IconBroom,
  electricity: IconBolt,
  gas:         IconFlame,
  misc:        IconGrid,
  grocery:     IconBag,
};

/** Render a category icon by key */
export function CategoryIcon({ category, ...props }: { category: string } & IconProps) {
  const Comp = CATEGORY_ICON_MAP[category as CategoryIconKey];
  if (!Comp) return <IconGrid {...props} />;
  return <Comp {...props} />;
}
