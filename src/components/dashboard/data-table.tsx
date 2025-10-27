"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table"
import { rankItem } from "@tanstack/match-sorter-utils"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, X as XIcon } from "lucide-react"

// ✅ Fuzzy filter with safe typing
export const fuzzyFilter: FilterFn<unknown> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(String(row.getValue(columnId)), value)
  addMeta?.({ itemRank })
  return itemRank.passed
}

// ✅ Safe client-side MS date parser
const parseClientMsDateString = (msDateString?: string | null): Date | null => {
  if (!msDateString) return null
  const match = msDateString.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//)
  if (match && match[1]) {
    const ms = parseInt(match[1], 10)
    if (!isNaN(ms)) return new Date(ms)
  }
  console.warn(`Could not parse MS Date string: ${msDateString}`)
  return null
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

// ✅ DataTable props
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

// ✅ DataTable component
export function DataTable<TData extends { receiptDate?: string }, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")

  const [selectedMonth, setSelectedMonth] = React.useState<string>("")
  const [selectedYear, setSelectedYear] = React.useState<string>("")

  // ✅ Update column filters when month/year changes
  React.useEffect(() => {
    const monthFilterValue = selectedMonth ? parseInt(selectedMonth, 10) : null
    const yearFilterValue = selectedYear ? parseInt(selectedYear, 10) : null

    const existingFilters = columnFilters.filter(f => f.id !== "receiptDate")
    let newFilters = existingFilters

    if (monthFilterValue !== null || yearFilterValue !== null) {
      newFilters = [
        ...existingFilters,
        {
          id: "receiptDate",
          value: [monthFilterValue, yearFilterValue],
        },
      ]
    }
    setColumnFilters(newFilters)
  }, [selectedMonth, selectedYear])

  // ✅ Compute available years (type-safe)
  const availableYears = React.useMemo(() => {
    const years = new Set<number>()
    data.forEach(row => {
      const date = parseClientMsDateString(row.receiptDate)
      if (date) years.add(date.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [data])

  // ✅ Properly typed table
  const table = useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: fuzzyFilter as FilterFn<TData>,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  const clearDateFilters = () => {
    setSelectedMonth("")
    setSelectedYear("")
  }

  // ✅ Render
  return (
    <div className="w-full">
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-4 py-4">
        {/* Global Search */}
        <Input
          placeholder="Search all..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs h-10"
        />

        {/* Month Select */}
        <Select
          value={selectedMonth || "all"}
          onValueChange={(value) => setSelectedMonth(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[180px] h-10">
            <SelectValue placeholder="Filter by Month..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map((month, index) => (
              <SelectItem key={month} value={String(index)}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year Select */}
        <Select
          value={selectedYear || "all"}
          onValueChange={(value) => setSelectedYear(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[120px] h-10">
            <SelectValue placeholder="Filter by Year..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.length > 0 ? (
              availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-data" disabled>
                No data
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {(selectedMonth || selectedYear) && (
          <Button variant="ghost" onClick={clearDateFilters} className="h-10 px-2 lg:px-3">
            Clear Dates
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Column Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto h-10">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllColumns().filter((c) => c.getCanHide()).map((column) => {
              let displayName = column.id.replace(/([A-Z])/g, " $1")
              displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                >
                  {displayName}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} row(s) found. Showing page{" "}
          {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
