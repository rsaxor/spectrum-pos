"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format as dateFormat } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { DateTimePicker } from "../ui/date-time-picker";

const parseSanitizedFloat = (value: string | undefined | null): number => {
    if (!value) return NaN;
    return parseFloat(value.replace(/,/g, '')); // Remove commas
};

type ApiResponse = {
	ResultCode: string;
	ReturnMessage: string | null;
	PushShiftReturnResult: ShiftResultDetail[] | null;
};
type RetailerInfo = { key: string; name: string }; // Type for retailer list

type ShiftResultDetail = {
    Asset: string;
    Brand: string;
    ErrorDetails: string | null;
    ErrorMessage: string;
    Retailer: string;
    ReturnCode: string;
    ShiftDay: string;
    Unit: string;
};

const GST_TIMEZONE = "Asia/Dubai";

const formSchema = z.object({
	retailerKey: z.string().min(1, "You must select a retailer."),
	ReceiptNo: z.string().min(1, "Receipt number is required."),
	ReceiptDate: z.date(),
	Total: z
		.string()
		.min(1, "Total is required.")
		.refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
			message: "Total must be a positive number.",
		}),
	Tax: z
		.string()
		.min(1, "Tax is required.")
		.refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
			message: "Tax cannot be negative.",
		}),
	Gross: z.string().optional(),
	Type: z.string().min(1, "You must select a transaction type."),
	SaleChannel: z.string().optional(), // Keep this optional in schema, backend hardcodes it
});

type ManualFormValues = z.infer<typeof formSchema>;

export default function ManualForm() {
	const [isLoading, setIsLoading] = useState(false);
	const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
	const [apiError, setApiError] = useState<string | null>(null);
	const [isClient, setIsClient] = useState(false);
	const [fixedShiftDay, setFixedShiftDay] = useState<{
		date: Date;
		display: string;
	} | null>(null);

	const [retailers, setRetailers] = useState<RetailerInfo[]>([]);
	const [isFetchingRetailers, setIsFetchingRetailers] = useState(true);

	// --- FETCH RETAILERS ON MOUNT ---
	useEffect(() => {
		const fetchRetailers = async () => {
			setIsFetchingRetailers(true);
			try {
				const response = await fetch("/api/retailers");
				if (!response.ok) throw new Error("Failed to fetch retailers");
				const data: RetailerInfo[] = await response.json();
				setRetailers(data);
			} catch (error) {
				console.error("Error fetching retailers:", error);
				toast.error("Could not load retailer list.");
				setRetailers([]);
			} finally {
				setIsFetchingRetailers(false);
			}
		};
		fetchRetailers();
	}, []);

	// --- SET DEFAULT SHIFT DAY AND RECEIPT DATE ---
	useEffect(() => {
		const nowInGst = toZonedTime(new Date(), GST_TIMEZONE);
		const shiftDayDate = new Date(nowInGst);
		shiftDayDate.setHours(9, 0, 0, 0);
		setFixedShiftDay({
			date: shiftDayDate,
			display: dateFormat(shiftDayDate, "dd MMM yyyy h:mm a"),
		});
		form.setValue("ReceiptDate", nowInGst);
		setIsClient(true);
	}, []);

	const form = useForm<ManualFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			retailerKey: "",
			ReceiptNo: "",
			ReceiptDate: undefined,
			Total: "",
			Tax: "",
			Gross: "",
			SaleChannel: "",
			Type: "0",
		},
	});

	const { watch, setValue, reset } = form;
	const totalValue = watch("Total");
	const taxValue = watch("Tax");

	// --- AUTOCALCULATE GROSS ---
	useEffect(() => {
		const total = parseSanitizedFloat(totalValue);
		const tax = parseSanitizedFloat(taxValue);
		if (!isNaN(total) && !isNaN(tax)) {
            setValue("Gross", Math.max(0, total + tax).toFixed(2));
        } else {
            setValue("Gross", "");
        }
	}, [totalValue, taxValue, setValue]);

	async function onSubmit(values: ManualFormValues) {
		if (!fixedShiftDay) {
			toast.error("Page is still loading, please wait a moment.");
			return;
		}
		setIsLoading(true);
		setApiResponse(null);
		setApiError(null);
		try {
			const total = parseSanitizedFloat(values.Total);
            const tax = parseSanitizedFloat(values.Tax);
            const gross = parseSanitizedFloat(values.Gross);

			const receiptForApi = {
				ReceiptNo: values.ReceiptNo,
				Type: values.Type,
				ReceiptDate: `/Date(${values.ReceiptDate.getTime()})/`,
				ShiftDay: `/Date(${fixedShiftDay.date.getTime()})/`,
				Total: total,
				Tax: tax,
				Gross: !isNaN(gross) ? gross : null,
			};

			const response = await fetch("/api/upload-sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    receipts: [receiptForApi],
                    retailerKey: values.retailerKey,
                }),
            });

			const result = await response.json();
			if (!response.ok)
				throw new Error(
					result.error || "An unknown server error occurred."
				);

			setApiResponse(result);
			toast.success("Transaction submitted successfully!");
			form.reset();
			form.setValue("ReceiptDate", toZonedTime(new Date(), GST_TIMEZONE));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setApiError(message);
			toast.error("Submission failed", { description: message });
		} finally {
			setIsLoading(false);
		}
	}

	const isSuccess = apiResponse
		? parseInt(apiResponse.ResultCode, 10) === 200
		: false;

	if (!isClient || !fixedShiftDay || isFetchingRetailers) {
		return (
			<Card>
				<CardContent className="pt-6 flex items-center justify-center p-8">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent className="pt-6">
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-8"
					>
						{/* --- RETAILER SELECT FIELD --- */}
						<FormField
							control={form.control}
							name="retailerKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Retailer</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
										disabled={isLoading}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select the retailer for this transaction" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{retailers.length > 0 ? (
												retailers.map((retailer) => (
													<SelectItem
														key={retailer.key}
														value={retailer.key}
													>
														{retailer.name}
													</SelectItem>
												))
											) : (
												<SelectItem
													value="none"
													disabled
												>
													No retailers found.
												</SelectItem>
											)}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
							{/* Receipt Number */}
							<FormField
								control={form.control}
								name="ReceiptNo"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Receipt Number / Invoice No.</FormLabel>
										<FormControl>
											<Input
												placeholder="Enter receipt id/code"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{/* Transaction Type */}
							<FormField
								control={form.control}
								name="Type"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Type</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a transaction type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="0">Sale</SelectItem>
												<SelectItem value="1">Return</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							{/* Receipt Date */}
							<FormField
								control={form.control}
								name="ReceiptDate"
								render={({ field }) => (
									<FormItem className="flex flex-col pt-2">
										<FormLabel>Receipt Date & Time (GST)</FormLabel>
										<FormControl>
											<DateTimePicker
												id={field.name}
												date={field.value}
												setDate={field.onChange}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{/* Shift Day (auto) */}
							<FormItem>
								<FormLabel>Shift Day (GST)</FormLabel>
								<FormControl>
									<Input
										value={fixedShiftDay.display}
										disabled
										className="mt-2"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
							{/* Total */}
							<FormField
								control={form.control}
								name="Total"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Total (Net)</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="e.g., 115.00"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{/* Tax */}
							<FormField
								control={form.control}
								name="Tax"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Tax (VAT)</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="e.g., 15.00"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{/* Gross */}
							<FormField
								control={form.control}
								name="Gross"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Gross Total</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="Auto-calculated"
												{...field}
												disabled
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="flex justify-end">
							<Button type="submit" disabled={isLoading}>
								{isLoading && (
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								)}
								Submit Transaction
							</Button>
						</div>
					</form>
				</Form>

				{apiResponse && (
					<div className="mt-8">
						<Alert variant={isSuccess ? "success" : "destructive"}>
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>
								{isSuccess
									? "Submission Successful"
									: "Submission Failed"}{" "}
								(Result Code: {apiResponse.ResultCode})
							</AlertTitle>
							<AlertDescription className="mt-2">
								<pre className="w-full overflow-x-auto rounded-md bg-slate-950 p-4">
									<code className="text-white">
										{JSON.stringify(apiResponse, null, 2)}
									</code>
								</pre>
							</AlertDescription>
						</Alert>
					</div>
				)}
				{apiError && (
					<div className="mt-8">
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Submission Failed</AlertTitle>
							<AlertDescription>{apiError}</AlertDescription>
						</Alert>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
