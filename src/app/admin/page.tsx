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
    <div className="min-h-screen overflow-x-hidden bg-[#080c13] px-3 py-5 text-zinc-100 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <MainTabsHeader session={session} activeTab="admin" />

        <Card className="rounded-3xl border border-white/10 bg-[#101722] text-zinc-100">
          <CardHeader>
            <CardTitle>Admin Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 md:hidden">
              {rows.map(({ user, status }) => (
                <div key={user.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-zinc-500">{user.id}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center justify-between rounded-md border border-white/10 px-2 py-1.5">
                      <span>W1</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-400"
                        checked={status.week1Paid}
                        disabled={savingKey === `${user.id}:week1Paid`}
                        onChange={(event) => {
                          void toggleField(user.id, 'week1Paid', event.target.checked);
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border border-white/10 px-2 py-1.5">
                      <span>W2</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-400"
                        checked={status.week2Paid}
                        disabled={savingKey === `${user.id}:week2Paid`}
                        onChange={(event) => {
                          void toggleField(user.id, 'week2Paid', event.target.checked);
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border border-white/10 px-2 py-1.5">
                      <span>Q1</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-400"
                        checked={status.quarter1Paid}
                        disabled={savingKey === `${user.id}:quarter1Paid`}
                        onChange={(event) => {
                          void toggleField(user.id, 'quarter1Paid', event.target.checked);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
              <table className="w-full text-sm">
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
