interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

export function Logo({ size = 40, className = '', variant = 'icon' }: LogoProps) {
  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <RavenIcon size={size} />
        <span
          className="font-semibold text-gray-900 dark:text-white"
          style={{ fontSize: size * 0.6 }}
        >
          Envoy
        </span>
      </div>
    );
  }

  return <RavenIcon size={size} className={className} />;
}

function RavenIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background */}
      <rect width="512" height="512" rx="96" fill="#3b82f6" />

      {/* Flying Raven Shadow Silhouette */}
      <g transform="translate(256, 260)">
        {/* Left wing */}
        <path
          d="M-15 -10 C-50 -50, -130 -90, -175 -70 C-155 -50, -110 -20, -70 0 C-40 15, -20 15, -5 5 Z"
          fill="#1e3a8a"
        />

        {/* Right wing */}
        <path
          d="M15 -10 C50 -50, 130 -90, 175 -70 C155 -50, 110 -20, 70 0 C40 15, 20 15, 5 5 Z"
          fill="#1e3a8a"
        />

        {/* Body */}
        <ellipse cx="0" cy="25" rx="25" ry="40" fill="#1e3a8a" />

        {/* Head */}
        <circle cx="0" cy="-25" r="24" fill="#1e3a8a" />

        {/* Beak */}
        <path d="M0 -22 L22 -18 L0 -10 Z" fill="#1e3a8a" />

        {/* Tail */}
        <path d="M-12 60 L0 85 L12 60 Q0 70, -12 60 Z" fill="#1e3a8a" />
      </g>
    </svg>
  );
}

export default Logo;
