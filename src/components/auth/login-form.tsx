"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword } from "firebase/auth";
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
import { Loader2 } from "lucide-react";

// Define the validation schema
const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    if (!turnstileToken) {
      toast.error("Please verify you are not a robot.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Verify Turnstile token first
      const turnstileResponse = await fetch("/api/verify-turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });

      const turnstileData = await turnstileResponse.json();
      if (!turnstileResponse.ok) {
        throw new Error(turnstileData.error || "Turnstile verification failed.");
      }

      // 2. If Turnstile is valid, sign in with Firebase
      await signInWithEmailAndPassword(auth, values.email, values.password);

      toast.success("Login successful!");
      router.push("/");
      router.refresh();

    } catch (error) { // Catch as unknown
      console.error("Login Error:", error); // Log the original error for debugging
      let errorMessage = "An unknown error occurred during login."; // Default message

      // Check if it's likely a Firebase AuthError (which has a 'code' property)
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
        switch (error.code) {
          case "auth/wrong-password":
          case "auth/user-not-found":
          case "auth/invalid-credential":
            errorMessage = "Invalid email or password.";
            break;
          case "auth/too-many-requests":
             errorMessage = "Too many failed login attempts. Please try again later.";
             break;
          default:
            errorMessage = `Login failed: ${error.code}`; // Include unknown code if possible
        }
      // Check if it's a standard Error object (like from Turnstile verification)
      } else if (error instanceof Error) {
        errorMessage = error.message; // Use the message property
      } else {
        // Fallback for unexpected error types
         errorMessage = "An unexpected error occurred. Please try again.";
      }

      // Show the determined error message
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
                <Input placeholder="company email" {...field} disabled={isLoading} />
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
                <Input type="password" placeholder="" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
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
