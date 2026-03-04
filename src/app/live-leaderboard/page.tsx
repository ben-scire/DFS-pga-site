import { redirect } from 'next/navigation';

export default function LiveLeaderboardRedirectPage() {
  redirect('/week-standings');
}
