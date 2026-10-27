"use client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
export interface DataColumn<T> {
  id: string;
  label: string;
  render: (row: T) => React.ReactNode;
}
export function DataTable<T extends { id: string }>({
  data,
  columns,
  caption,
}: {
  data: T[];
  columns: DataColumn<T>[];
  caption: string;
}) {
  const definitions: ColumnDef<T>[] = columns.map((column) => ({
    id: column.id,
    header: column.label,
    cell: (context) => column.render(context.row.original),
  }));
  const table = useReactTable({
    data,
    columns: definitions,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
  });
  return (
    <>
      <div className="panel hidden overflow-x-auto xl:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border bg-background text-xs text-secondary">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    scope="col"
                    className="px-4 py-4 font-semibold"
                    key={header.id}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr className="hover:bg-background/60" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className="max-w-56 break-words px-4 py-5" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:hidden">
        {data.map((row) => (
          <article className="panel min-w-0 space-y-4 p-5" key={row.id}>
            {columns.map((column) => (
              <div key={column.id} className="min-w-0">
                <p className="mb-1 text-xs text-secondary">{column.label}</p>
                <div className="break-words text-sm">{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
