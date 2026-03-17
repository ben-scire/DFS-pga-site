"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { getDefaultContestId } from '@/lib/weekly-lineup-seed';
import { Logo } from '@/components/logo';
import { KeyRound } from 'lucide-react';
import { signInOrFirstClaim, subscribeAuthSession } from '@/lib/firebase-auth';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const defaultContestId = getDefaultContestId();
  const defaultHomePath = `/contests?contestId=${encodeURIComponent(defaultContestId)}`;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const loginImage = PlaceHolderImages.find((img) => img.id === 'golf-course');

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((session) => {
      if (session) {
        router.replace(defaultHomePath);
        return;
      }
      setCheckingSession(false);
    });

    return () => {
      unsubscribe();
    };
  }, [defaultHomePath, router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await signInOrFirstClaim(username, password);
      router.replace(defaultHomePath);
    } catch (error) {
      toast({
        title: 'Sign-in failed',
        description: error instanceof Error ? error.message : 'Unable to sign in.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      {loginImage && (
        <Image
          src={loginImage.imageUrl}
          alt={loginImage.description}
          fill
          className="-z-10 object-cover brightness-[0.4]"
          priority
          data-ai-hint={loginImage.imageHint}
        />
      )}
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          <Logo className="h-16 w-16 text-primary" />
          <CardTitle className="text-3xl font-headline">5x5 Global</CardTitle>
          <CardDescription>Enter your username or alias and password. First sign-in creates your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Username"
              disabled={checkingSession || submitting}
            />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              disabled={checkingSession || submitting}
            />
            <Button
              type="submit"
              disabled={checkingSession || submitting || !username.trim() || !password}
              className="w-full"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
