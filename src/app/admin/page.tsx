"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import {
  getDefaultPaymentStatusMap,
  savePaymentStatusField,
  subscribePaymentStatusMap,
  type PaymentStatusField,
  type PaymentStatusMap,
} from '@/lib/firestore-payment-status';
import { TEST_USERS } from '@/lib/test-users';
import { toast } from '@/hooks/use-toast';

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [paymentStatusBySlug, setPaymentStatusBySlug] = useState<PaymentStatusMap>(getDefaultPaymentStatusMap());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
      if (!nextSession) {
        router.replace('/');
        return;
      }
      if (!nextSession.isAdmin) {
        router.replace('/contests');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!session?.isAdmin) return;
    const unsubscribe = subscribePaymentStatusMap((nextValue) => {
      setPaymentStatusBySlug(nextValue);
    });
    return () => {
      unsubscribe();
    };
  }, [session?.isAdmin]);

  const rows = useMemo(() => {
    return TEST_USERS.map((user) => ({
      user,
      status: paymentStatusBySlug[user.id] ?? {
        week1Paid: false,
        week2Paid: false,
        quarter1Paid: false,
      },
    }));
  }, [paymentStatusBySlug]);

  const toggleField = async (userSlug: string, field: PaymentStatusField, value: boolean) => {
    if (!session?.isAdmin) return;
    const key = `${userSlug}:${field}`;
    setSavingKey(key);
    try {
      await savePaymentStatusField(userSlug, field, value, session);
    } catch (error) {
      toast({
        title: 'Payment status update failed',
        description: error instanceof Error ? error.message : 'Unable to save payment status.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-[#080c13]" />;
  }

  if (!session || !session.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <MainTabsHeader session={session} activeTab="admin" />

        <Card className="rounded-3xl border border-white/10 bg-[#101722] text-zinc-100">
          <CardHeader>
            <CardTitle>Admin Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-white/[0.04] text-zinc-300">
                  <tr>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-center">W1 ($10)</th>
                    <th className="px-3 py-2 text-center">W2 ($10)</th>
                    <th className="px-3 py-2 text-center">Q1 ($50)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ user, status }) => (
                    <tr key={user.id} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-zinc-500">{user.id}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-400"
                          checked={status.week1Paid}
                          disabled={savingKey === `${user.id}:week1Paid`}
                          onChange={(event) => {
                            void toggleField(user.id, 'week1Paid', event.target.checked);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-400"
                          checked={status.week2Paid}
                          disabled={savingKey === `${user.id}:week2Paid`}
                          onChange={(event) => {
                            void toggleField(user.id, 'week2Paid', event.target.checked);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-400"
                          checked={status.quarter1Paid}
                          disabled={savingKey === `${user.id}:quarter1Paid`}
                          onChange={(event) => {
                            void toggleField(user.id, 'quarter1Paid', event.target.checked);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
