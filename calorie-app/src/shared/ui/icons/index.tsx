interface IconProps {
  size?: number;
}

function IconSvg({ size = 22, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const IconHome = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </IconSvg>
);

export const IconCamera = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.8a1 1 0 0 1 .9-.5h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.4" />
  </IconSvg>
);

export const IconBook = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6M9 11h6" />
  </IconSvg>
);

export const IconChart = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M4 20V4M4 20h16M8 16v-5M12.5 16V8M17 16v-8" />
  </IconSvg>
);

export const IconUser = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </IconSvg>
);

export const IconFlame = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1.5-.5-2.5C16 9 18 12 18 14.5A6 6 0 0 1 6 14.5C6 10 10 8 12 3z" />
  </IconSvg>
);

export const IconWater = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M12 3c3 4 6 7.1 6 11.2A6 6 0 0 1 6 14.2C6 10.1 9 7 12 3z" />
    <path d="M9.5 15.5c.5 1.1 1.5 1.8 2.5 1.8" />
  </IconSvg>
);

export const IconTarget = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
  </IconSvg>
);

export const IconTrend = ({ size }: IconProps) => (
  <IconSvg size={size}><path d="M4 15l5-5 3.5 3.5L20 6M20 6h-4M20 6v4" /></IconSvg>
);
