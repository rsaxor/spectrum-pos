"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Import FileDown icon
import {
  Home,
  UploadCloud as Upload, // Keep alias if used elsewhere, or just use UploadCloud
  Keyboard,
  Database,
  PanelLeft,
  FileDown // Added import
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Define navigation items array
const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/csv-upload", label: "CSV Upload", icon: Upload },
  { href: "/manual-input", label: "Manual Input", icon: Keyboard },
  { href: "/view-data", label: "Data Collection", icon: Database },
  { href: "/export-data", label: "Export Data", icon: FileDown },
];

// Define props for the TooltipLink component
interface TooltipLinkProps {
  href: string;
  icon: React.ElementType; // Use ElementType for component icons
  label: string;
  isActive: boolean;
  isMobile?: boolean; // Optional prop for mobile context
}

// Reusable TooltipLink component
const TooltipLink = ({ href, icon: Icon, label, isActive, isMobile = false }: TooltipLinkProps) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
            isActive
              ? "bg-accent text-accent-foreground" // Active state style
              : "text-muted-foreground hover:text-foreground" // Default/hover state style
          } ${isMobile ? "h-12 w-12" : ""}`} // Larger size if mobile prop is true
        >
          <Icon className="h-5 w-5" />
          <span className="sr-only">{label}</span> {/* Screen reader text */}
        </Link>
      </TooltipTrigger>
      {/* Only show tooltip content on non-mobile (desktop) */}
      {!isMobile && (
        <TooltipContent side="right">{label}</TooltipContent>
      )}
    </Tooltip>
  </TooltipProvider>
);


export function Sidebar() {
  const pathname = usePathname(); // Hook to get the current URL path

  return (
    <>
      {/* Desktop Sidebar (Hidden on small screens) */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          {/* Map through navItems and render TooltipLink for each */}
          {navItems.map((item) => (
             <TooltipLink
               key={item.href}
               href={item.href}
               icon={item.icon}
               label={item.label}
               isActive={pathname === item.href}
             />
          ))}
        </nav>
      </aside>
      <div className="sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            {/* Hamburger button */}
            <Button size="icon" variant="outline" className="sm:hidden m-4 fixed top-0 left-0 z-20"> 
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          {/* Content of the slide-out menu */}
          <SheetContent side="left" className="sm:max-w-xs pt-5">
            <VisuallyHidden>
              <SheetHeader>
                <SheetTitle>Mobile menu</SheetTitle>
                <SheetDescription> Navigation links </SheetDescription>
              </SheetHeader>
            </VisuallyHidden>
            {/* Navigation links inside the sheet */}
            <nav className="grid gap-6 text-lg font-medium pt-5">
               {navItems.map((item) => (
                 <Link
                    key={item.href}
                    href={item.href}
                    // Apply styles based on active state
                    className={`flex items-center gap-4 px-2.5 ${
                        pathname === item.href
                        ? "text-foreground font-semibold" // Active style
                        : "text-muted-foreground hover:text-foreground" // Default/hover style
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
               ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}