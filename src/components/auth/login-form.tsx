"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Turnstile from "react-turnstile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);

    if (!turnstileToken) {
      toast.error("Please verify you are not a robot.");
      setIsLoading(false);
      return;
    }

    try {
      const turnstileResponse = await fetch("/api/verify-turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const turnstileData = await turnstileResponse.json();
      if (!turnstileResponse.ok) {
        throw new Error(turnstileData.error || "Turnstile verification failed.");
      }
      
      const persistence = values.rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      
      await signInWithEmailAndPassword(auth, values.email, values.password);

      toast.success("Login successful!");
      router.push("/");
      router.refresh();

    } catch (error) { 
      console.error("Login Error:", error);
      let errorMessage = "An unknown error occurred during login.";
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
        switch (error.code) {
          case "auth/wrong-password":
          case "auth/user-not-found":
          case "auth/invalid-credential":
            errorMessage = "Invalid email or password."; break;
          case "auth/too-many-requests":
             errorMessage = "Too many failed login attempts. Please try again later."; break;
          default: errorMessage = `Login failed: ${error.code}`;
        }
      } else if (error instanceof Error) { errorMessage = error.message; }
      toast.error("Login Failed", { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  placeholder="company email" 
                  {...field} 
                  disabled={isLoading}
                  autoComplete="email" 
                  type="email"          
                  id="email"            
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...field} 
                    disabled={isLoading}
                    autoComplete="current-password" 
                    id="password" 
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowPassword(prev => !prev)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only"> {showPassword ? "Hide password" : "Show password"} </span>
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

         <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isLoading}
                  id="rememberMe"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label htmlFor="rememberMe" className="cursor-pointer">
                  Remember me
                </Label>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-center">
          <Turnstile
            sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}