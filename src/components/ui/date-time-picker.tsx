"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronUp, ChevronDown } from "lucide-react";
import { format, setHours, setMinutes, setSeconds } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "./input";

// --- THIS IS THE FIX ---
// Add 'id' to the component's props interface
interface DateTimePickerProps {
  id?: string; // Allow an id to be passed in
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: boolean;
}

// Ensure the 'id' prop is destructured here
export function DateTimePicker({ id, date, setDate, disabled }: DateTimePickerProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const handleTimeChange = (type: "hours" | "minutes", value: number) => {
    if (!date) return;
    let newDate = date;
    if (type === "hours") {
      newDate = setHours(date, value);
    } else if (type === "minutes") {
      newDate = setMinutes(date, value);
    }
    setDate(newDate);
  };

  const handleTimeSpinner = (type: "hours" | "minutes", direction: "up" | "down") => {
    if (!date) return;
    const increment = direction === "up" ? 1 : -1;
    let newValue;
    if (type === "hours") {
      newValue = (date.getHours() + increment + 24) % 24;
    } else {
      newValue = (date.getMinutes() + increment + 60) % 60;
    }
    handleTimeChange(type, newValue);
  };
  
  const todayInGst = toZonedTime(new Date(), 'Asia/Dubai');

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          // Apply the 'id' to the button
          id={id} 
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd MMM yyyy hh:mm a") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
             if (selectedDate) {
              const hours = date?.getHours() ?? 0;
              const minutes = date?.getMinutes() ?? 0;
              let newDate = setSeconds(selectedDate, 0);
              newDate = setHours(newDate, hours);
              newDate = setMinutes(newDate, minutes);
              setDate(newDate);
            } else {
              setDate(undefined);
            }
          }}
          initialFocus
          disabled={{ after: todayInGst }}
        />
        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-center space-x-2">
            <div className="relative">
              <Input
                type="text"
                value={String(date?.getHours() ?? 0).padStart(2, "0")}
                onChange={(e) => handleTimeChange("hours", parseInt(e.target.value) || 0)}
                className="w-16 text-center"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
                 <button type="button" onClick={() => handleTimeSpinner("hours", "up")} className="h-4 w-4"><ChevronUp size={16}/></button>
                 <button type="button" onClick={() => handleTimeSpinner("hours", "down")} className="h-4 w-4"><ChevronDown size={16}/></button>
              </div>
            </div>
            <span>:</span>
             <div className="relative">
              <Input
                type="text"
                value={String(date?.getMinutes() ?? 0).padStart(2, "0")}
                onChange={(e) => handleTimeChange("minutes", parseInt(e.target.value) || 0)}
                className="w-16 text-center"
              />
               <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
                 <button type="button" onClick={() => handleTimeSpinner("minutes", "up")} className="h-4 w-4"><ChevronUp size={16}/></button>
                 <button type="button" onClick={() => handleTimeSpinner("minutes", "down")} className="h-4 w-4"><ChevronDown size={16}/></button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}