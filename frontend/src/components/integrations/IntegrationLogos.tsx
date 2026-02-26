const SIZE = { sm: 20, md: 28 };

function Svg({ children, size = 'md', bg }: { children: React.ReactNode; size?: 'sm' | 'md'; bg: string }) {
  const dim = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-12 w-12 rounded-xl';
  return (
    <div className={`flex items-center justify-center ${dim} ${bg} shrink-0`}>
      <svg viewBox="0 0 24 24" width={SIZE[size]} height={SIZE[size]} fill="none" xmlns="http://www.w3.org/2000/svg">
        {children}
      </svg>
    </div>
  );
}

export function SlackLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#4A154B]">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
    </Svg>
  );
}

export function GitHubLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#24292e]">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" fill="white"/>
    </Svg>
  );
}

export function GoogleDriveLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-white">
      <path d="M7.71 3.5L1.15 15l2.76 4.77L10.47 8.27z" fill="#0066DA"/>
      <path d="M22.85 15L16.29 3.5H9.71L16.27 15z" fill="#00AC47"/>
      <path d="M7.71 3.5L1.15 15h6.56L14.27 3.5z" fill="#EA4335"/>
      <path d="M14.27 3.5L7.71 15l2.76 4.77L22.85 15 16.29 3.5z" fill="#00832D"/>
      <path d="M7.71 15l2.76 4.77h9.62L22.85 15z" fill="#2684FC"/>
      <path d="M1.15 15l2.76 4.77h6.56L7.71 15z" fill="#FFBA00"/>
    </Svg>
  );
}

export function JiraLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#0052CC]">
      <path d="M20.77 11.33L13 3.57 12 2.57l-7.77 7.76a.75.75 0 000 1.06L12 19.16l7.77-7.77a.75.75 0 000-1.06zM12 14.47L9.53 12 12 9.53 14.47 12 12 14.47z" fill="white"/>
    </Svg>
  );
}

export function NotionLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-white">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.12 2.15c-.42-.326-.98-.7-2.055-.606l-12.77.84c-.467.047-.56.28-.374.466l1.538 1.358zm.793 3.358v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.166V6.592c0-.607-.233-.933-.747-.886l-15.177.886c-.56.047-.746.327-.746.934zm14.337.746c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.166.514-1.633.514-.746 0-.933-.234-1.493-.933l-4.571-7.19v6.957l1.446.327s0 .84-1.166.84l-3.218.186c-.094-.187 0-.653.327-.746l.84-.233V9.854L7.87 9.76c-.094-.42.14-1.026.793-1.073l3.452-.233 4.758 7.283V9.388l-1.213-.14c-.094-.514.28-.886.747-.933l3.219-.187z" fill="black"/>
    </Svg>
  );
}

export function GmailLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-white">
      <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12z" fill="#EA4335"/>
      <path d="M3 6a1 1 0 011-1h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" stroke="#EA4335" strokeWidth="0.5" fill="none"/>
    </Svg>
  );
}

export function TrelloLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#0079BF]">
      <rect x="4" y="4" width="7" height="14" rx="1.2" fill="white"/>
      <rect x="13" y="4" width="7" height="9" rx="1.2" fill="white"/>
    </Svg>
  );
}

export function TeamsLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#6264A7]">
      <path d="M16.5 9.5h3.75a.75.75 0 01.75.75v4.5a2.25 2.25 0 01-2.25 2.25H16.5V9.5z" fill="rgba(255,255,255,0.6)"/>
      <circle cx="18" cy="7" r="1.75" fill="rgba(255,255,255,0.6)"/>
      <rect x="3" y="8" width="12" height="10" rx="1" fill="white"/>
      <path d="M6 13h6M9 11v4" stroke="#6264A7" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10.5" cy="5.5" r="2.5" fill="white"/>
    </Svg>
  );
}

export function SalesforceLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#00A1E0]">
      <path d="M10 5.5a4.5 4.5 0 014.2 2.9A3.5 3.5 0 0118 11.8a3.5 3.5 0 01-3.3 3.7H6.5A3 3 0 013.5 12 3 3 0 016 9.1a4.5 4.5 0 014-3.6z" fill="white"/>
    </Svg>
  );
}

export function HubSpotLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#FF7A59]">
      <circle cx="12" cy="12" r="3" fill="white"/>
      <path d="M12 5v4M12 15v4M5 12h4M15 12h4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </Svg>
  );
}

export function GoogleAnalyticsLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#E37400]">
      <rect x="5" y="14" width="4" height="6" rx="2" fill="white"/>
      <rect x="10" y="9" width="4" height="11" rx="2" fill="white"/>
      <rect x="15" y="4" width="4" height="16" rx="2" fill="white"/>
    </Svg>
  );
}

export function DropboxLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#0061FF]">
      <path d="M12 4l-5 3.2L12 10.3l5-3.1L12 4zM2 7.2l5 3.1-5 3.2 5 3.1 5-3.1 5 3.1 5-3.1-5-3.2 5-3.1-5-3.1-5 3.1-5-3.1L2 7.2z" fill="white"/>
    </Svg>
  );
}

export function LinearLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#5E6AD2]">
      <path d="M3.36 13.2a9.54 9.54 0 007.44 7.44L3.36 13.2zm-.62-2.04A9.6 9.6 0 0012.84 21.24L2.74 11.16zm.88-2.06l10.72 10.72a9.6 9.6 0 00.88-1.56L4.18 7.22a9.6 9.6 0 00-.56.88zm1.52-1.96l10.6 10.6a9.54 9.54 0 001.06-1.62L6.36 5.68a9.54 9.54 0 00-1.22 1.46zm2.58-2.32l9.34 9.34c.5-.66.9-1.38 1.2-2.16l-8.38-8.38a9.6 9.6 0 00-2.16 1.2zm3.94-1.68l7.2 7.2a9.6 9.6 0 00-7.2-7.2z" fill="white"/>
    </Svg>
  );
}

export function FigmaLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-[#1E1E1E]">
      <path d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4z" fill="#0ACF83" transform="scale(0.75) translate(4,0)"/>
      <path d="M4 12c0-2.2 1.8-4 4-4h4v8H8c-2.2 0-4-1.8-4-4z" fill="#A259FF" transform="scale(0.75) translate(4,0)"/>
      <path d="M4 4c0-2.2 1.8-4 4-4h4v8H8C5.8 8 4 6.2 4 4z" fill="#F24E1E" transform="scale(0.75) translate(4,0)"/>
      <path d="M12 0h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4V0z" fill="#FF7262" transform="scale(0.75) translate(4,0)"/>
      <circle cx="16" cy="12" r="4" fill="#1ABCFE" transform="scale(0.75) translate(4,0)"/>
    </Svg>
  );
}

export function GoogleCalendarLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Svg size={size} bg="bg-white">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#4285F4"/>
      <rect x="5" y="8" width="14" height="11" rx="1" fill="white"/>
      <path d="M8 11h2v2H8zM11 11h2v2h-2zM14 11h2v2h-2zM8 14h2v2H8zM11 14h2v2h-2z" fill="#4285F4"/>
    </Svg>
  );
}

// Logo registry
const LOGOS: Record<string, React.ComponentType<{ size?: 'sm' | 'md' }>> = {
  slack: SlackLogo,
  github: GitHubLogo,
  'google-drive': GoogleDriveLogo,
  jira: JiraLogo,
  notion: NotionLogo,
  gmail: GmailLogo,
  trello: TrelloLogo,
  'microsoft-teams': TeamsLogo,
  salesforce: SalesforceLogo,
  hubspot: HubSpotLogo,
  'google-analytics': GoogleAnalyticsLogo,
  dropbox: DropboxLogo,
  linear: LinearLogo,
  figma: FigmaLogo,
  'google-calendar': GoogleCalendarLogo,
};

export function IntegrationLogo({ slug, size = 'md' }: { slug: string; size?: 'sm' | 'md' }) {
  const Logo = LOGOS[slug];
  if (Logo) return <Logo size={size} />;

  // Fallback: letter avatar
  const dim = size === 'sm' ? 'h-8 w-8 text-sm rounded-lg' : 'h-12 w-12 text-lg rounded-xl';
  return (
    <div className={`flex items-center justify-center ${dim} bg-primary-600 text-white font-bold shrink-0`}>
      {slug.charAt(0).toUpperCase()}
    </div>
  );
}
