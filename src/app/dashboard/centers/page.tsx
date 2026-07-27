'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

const centerSchema = z.object({
  name: z.string().min(1, 'સેન્ટરનું નામ જરૂરી છે.'),
  location: z.string().min(1, 'સ્થળ જરૂરી છે.'),
});

type CenterFormValues = z.infer<typeof centerSchema>;

type DataEntryCenter = {
    id: string;
    name: string;
    location: string;
};

export default function CentersPage() {
  const { user: adminUser, loading: adminLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  useEffect(() => {
    if (!adminLoading && adminUser?.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [adminUser, adminLoading, router]);

  const [isSubmitting, setIsSubmitting] = useState(false);


  const centersQuery = useMemoFirebase(() => collection(firestore, 'dataEntryCenters'), [firestore]);
  const { data: centers, isLoading } = useCollection<DataEntryCenter>(centersQuery);

  const form = useForm<CenterFormValues>({
    resolver: zodResolver(centerSchema),
    defaultValues: { name: '', location: '' },
  });

  async function onSubmit(values: CenterFormValues) {
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'dataEntryCenters'), {
        ...values,
        members: {} // Initialize members map
      });
      toast({
        title: 'સફળ!',
        description: 'નવું ડેટા એન્ટ્રી સેન્ટર બનાવ્યું.',
      });
      form.reset();
    } catch (error) {
      console.error("Error creating center:", error);
      toast({
        variant: 'destructive',
        title: 'ભૂલ',
        description: 'સેન્ટર બનાવતી વખતે ભૂલ આવી.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (adminLoading || !adminUser) {
    return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (adminUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-10 overflow-visible w-full px-2 sm:px-4">
      <div className="pb-8 border-b-2 border-primary/10">
        <h1 className="text-2xl sm:text-4xl font-black text-primary tracking-tighter flex items-center gap-3 py-2 leading-tight">
          <Building className="h-10 w-10" />
          સેન્ટર વ્યવસ્થાપન
        </h1>
        <p className="text-muted-foreground font-medium mt-2">નવા ડેટા એન્ટ્રી કેન્દ્રો ઉમેરો અને સંચાલન કરો.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 items-start w-full">
        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white w-full">
          <CardHeader className="bg-muted/5 p-4 sm:p-8 border-b">
            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
              <Plus className="h-5 w-5" />
              નવું સેન્ટર ઉમેરો
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-xs uppercase tracking-widest text-muted-foreground">સેન્ટરનું નામ</FormLabel>
                    <FormControl><Input placeholder="દા.ત. પાલિતાણા શહેર" {...field} className="h-12 rounded-xl" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-xs uppercase tracking-widest text-muted-foreground">સ્થળ / સરનામું</FormLabel>
                    <FormControl><Input placeholder="દા.ત. મુખ્ય બજાર" {...field} className="h-12 rounded-xl" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                  {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  સેન્ટર બનાવો
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white w-full">
          <CardHeader className="bg-muted/5 p-4 sm:p-8 border-b">
            <CardTitle className="text-xl font-black text-primary">નોંધાયેલા કેન્દ્રો</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-8">
              <div className="space-y-4">
                  {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="p-5 border rounded-2xl space-y-2">
                              <Skeleton className="h-5 w-2/4" />
                              <Skeleton className="h-4 w-3/4" />
                          </div>
                      ))
                  ) : centers && centers.length > 0 ? (
                      centers.map(center => (
                          <div key={center.id} className="p-5 border border-border/50 rounded-2xl hover:bg-primary/5 transition-all shadow-sm">
                              <p className="font-black text-primary text-sm uppercase">{center.name}</p>
                              <p className="text-xs font-bold text-muted-foreground mt-1">{center.location}</p>
                          </div>
                      ))
                  ) : (
                      <p className="text-muted-foreground text-center py-20 font-bold italic">કોઈ કેન્દ્રો મળ્યાં નથી.</p>
                  )}
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
