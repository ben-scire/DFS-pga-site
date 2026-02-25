"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Logo } from '@/components/logo';
import { Users } from 'lucide-react';

const LOGIN_USERS = [
  { id: '1', name: 'Ben' },
  { id: '2', name: 'Dylan' },
  { id: '3', name: 'Sam L' },
  { id: '4', name: 'Jake' },
  { id: '5', name: 'Nick' },
  { id: '6', name: 'Hank' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const loginImage = PlaceHolderImages.find(img => img.id === 'golf-course');

  const handleLogin = () => {
    if (selectedUserId) {
      router.push(`/contests?userId=${selectedUserId}`);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      {loginImage && (
        <Image
          src={loginImage.imageUrl}
          alt={loginImage.description}
          fill
          className="object-cover -z-10 brightness-[0.4]"
          priority
          data-ai-hint={loginImage.imageHint}
        />
      )}
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          <Logo className="h-16 w-16 text-primary" />
          <CardTitle className="text-3xl font-headline">5x5 Global</CardTitle>
          <CardDescription>Select your name to manage this week&apos;s lineup and standings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <Select onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select" className="w-full">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent position="popper">
                  {LOGIN_USERS.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLogin} disabled={!selectedUserId} className="w-full">
            <Users className="mr-2 h-4 w-4" /> Open 5x5
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
