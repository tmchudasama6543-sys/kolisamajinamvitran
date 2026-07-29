'use client';

import { useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, initiateEmailSignIn, initiateEmailSignUp } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, GraduationCap, Loader2, ShieldCheck, UserCircle } from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'કૃપા કરીને માન્ય ઇમેઇલ દાખલ કરો.' }),
  password: z.string().min(6, { message: 'પાસવર્ડ ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ.' }),
});

type FormValues = z.infer<typeof formSchema>;

const ADMIN_EMAIL = 'jayhind6543@gmail.com';
const CENTER_EMAIL = 'yuvapalitana123@gmail.com';

interface AuthFieldsProps {
  form: UseFormReturn<FormValues>;
  mode: 'signin' | 'signup';
  role: 'admin' | 'data_entry';
  loading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  onSubmit: (values: FormValues, mode: 'signin' | 'signup', role: 'admin' | 'data_entry') => Promise<void>;
}

const AuthFields = ({ form, mode, role, loading, showPassword, setShowPassword, onSubmit }: AuthFieldsProps) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, mode, role))} className="space-y-5">
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel className="font-bold text-xs uppercase tracking-wider">ઈમેલ</FormLabel>
          <FormControl>
            <Input placeholder="example@email.com" {...field} className="h-12 rounded-xl focus:ring-2" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="password" render={({ field }) => (
        <FormItem>
          <FormLabel className="font-bold text-xs uppercase tracking-wider">પાસવર્ડ</FormLabel>
          <FormControl>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} className="h-12 rounded-xl focus:ring-2" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-xl" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <Button type="submit" className="w-full h-14 text-lg font-black rounded-2xl shadow-lg transition-all hover:scale-[1.02]" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {mode === 'signin' ? 'લોગિન કરો' : 'નવું એકાઉન્ટ બનાવો'}
      </Button>
    </form>
  </Form>
);

export default function LoginForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { auth, firestore } = useFirebase();

  const adminForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const centerForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  async function handleAuth(values: FormValues, mode: 'signin' | 'signup', role: 'admin' | 'data_entry') {
    setLoading(true);
    try {
      // Allow all registered admins to log in via the admin tab

      if (mode === 'signin') {
        await initiateEmailSignIn(auth, values.email, values.password);
        toast({ title: 'લૉગિન સફળ', description: 'તમારા ડેશબોર્ડ પર રીડાયરેક્ટ કરી રહ્યાં છીએ...' });
      } else {
        const userCredential = await initiateEmailSignUp(auth, values.email, values.password);
        const user = userCredential.user;
        const batch = writeBatch(firestore);
        
        batch.set(doc(firestore, "users", user.uid), {
          email: values.email,
          role: role,
          dataEntryCenterId: null,
          accessApproved: values.email === CENTER_EMAIL ? true : false
        });

        // એડમિન ઈમેઈલ માટે roles_admin માં ડોક્યુમેન્ટ બનાવો
        if (role === 'admin' || values.email === ADMIN_EMAIL) {
          batch.set(doc(firestore, "roles_admin", user.uid), {
            email: values.email,
            createdAt: new Date().toISOString()
          });
        }

        await batch.commit();
        toast({ title: 'એકાઉન્ટ સફળતાપૂર્વક બન્યું', description: 'હવે તમે લોગિન કરી શકો છો.' });
      }
    } catch (error: any) {
      let errorMsg = 'કૃપા કરીને તમારી વિગતો તપાસો.';
      if (
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/invalid-login-credentials'
      ) {
        errorMsg = 'તમે દાખલ કરેલો પાસવર્ડ ખોટો છે.';
      } else if (error.code === 'auth/user-not-found') {
        errorMsg = 'આ ઈમેલ પર કોઈ એકાઉન્ટ નથી.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'આ ઈમેલથી પહેલેથી જ એકાઉન્ટ બનેલું છે.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'વધુ પડતા ખોટા પ્રયત્નોને કારણે એકાઉન્ટ થોડીવાર માટે બ્લોક થયું છે.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'ભૂલ આવી',
        description: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-2xl shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white/80 backdrop-blur-xl">
        <div className="h-3 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="text-center p-8 sm:p-12 pb-4">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/30 transform transition-transform hover:rotate-12">
            <GraduationCap className="h-12 w-12 text-primary-foreground" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tighter text-primary uppercase">તળપદા કોળી સમાજ ઈનામ વિતરણ</CardTitle>
          <CardDescription className="text-lg font-bold text-muted-foreground mt-3">પોર્ટલ ઍક્સેસ કરવા માટે તમારો વિભાગ પસંદ કરો</CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 sm:p-12 pt-0">
          <Tabs defaultValue="center" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-10 bg-muted/50 p-1.5 rounded-2xl h-16 border border-border">
              <TabsTrigger value="admin" className="rounded-xl font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex gap-2">
                <ShieldCheck className="h-4 w-4" /> એડમિન પેનલ
              </TabsTrigger>
              <TabsTrigger value="center" className="rounded-xl font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex gap-2">
                <UserCircle className="h-4 w-4" /> સેન્ટર પેનલ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-xl font-black text-primary">એડમિન લોગિન</CardTitle>
                  <CardDescription>માત્ર મુખ્ય એડમિન માટે જ એક્સેસ.</CardDescription>
                </CardHeader>
                <Tabs defaultValue="signin">
                  <TabsContent value="signin">
                    <AuthFields 
                      form={adminForm} 
                      mode="signin" 
                      role="admin" 
                      loading={loading} 
                      showPassword={showPassword} 
                      setShowPassword={setShowPassword} 
                      onSubmit={handleAuth} 
                    />
                  </TabsContent>
                </Tabs>
              </Card>
            </TabsContent>

            <TabsContent value="center">
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-xl font-black text-primary">સેન્ટર લોગિન</CardTitle>
                  <CardDescription>ડેટા એન્ટ્રી સેન્ટરના વપરાશકર્તાઓ માટે.</CardDescription>
                </CardHeader>
                <Tabs defaultValue="signin">
                  <TabsList className="grid w-fit grid-cols-2 mb-6 bg-muted/30 p-1 rounded-xl">
                    <TabsTrigger value="signin" className="rounded-lg text-xs font-bold">સાઇન ઇન</TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-lg text-xs font-bold">સાઇન અપ</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signin">
                    <AuthFields 
                      form={centerForm} 
                      mode="signin" 
                      role="data_entry" 
                      loading={loading} 
                      showPassword={showPassword} 
                      setShowPassword={setShowPassword} 
                      onSubmit={handleAuth} 
                    />
                  </TabsContent>
                  <TabsContent value="signup">
                    <AuthFields 
                      form={centerForm} 
                      mode="signup" 
                      role="data_entry" 
                      loading={loading} 
                      showPassword={showPassword} 
                      setShowPassword={setShowPassword} 
                      onSubmit={handleAuth} 
                    />
                  </TabsContent>
                </Tabs>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
