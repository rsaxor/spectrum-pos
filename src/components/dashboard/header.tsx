"use client";

import { useAuth } from "@/context/auth-provider";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out successfully.");
      router.push("/login");
    } catch (error) {
      console.error("Sign out error", error);
      toast.error("Failed to sign out.");
    }
  };

  if (!user) return null;

  return (
    <header className="sm:sticky right-0 top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 absolute sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
       <div className="flex-1">
        {/* TO DO - BREADCRUMBS */}
       </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden md:inline">
          {user.email}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign Out</span>
            </Button>
          </TooltipTrigger>
        <TooltipContent>
          <p>Sign Out</p>
        </TooltipContent>
      </Tooltip>
      </div>
    </header>
  );
}
