import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const SITE_TITLE = 'PGA-DK-Challenge';
const SITE_DESCRIPTION = 'Live tracking for DraftKings DFS custom PGA contests.';
const SITE_URL = 'https://ben-scire.github.io';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const githubPagesBasePath = process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}` : '';
const PREVIEW_IMAGE_URL = `${SITE_URL}${githubPagesBasePath}/og-card.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    images: [
      {
        url: PREVIEW_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [PREVIEW_IMAGE_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
