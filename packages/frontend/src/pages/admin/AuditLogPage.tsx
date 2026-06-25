import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';

interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

interface PaginatedAuditLog {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export const AuditLogPage = () => {
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery<PaginatedAuditLog>({
    queryKey: ['admin', 'audit-log', pageIndex],
    queryFn: async () => {
      const res = await api.get<PaginatedAuditLog>('/admin/audit-log', {
        params: { page: pageIndex + 1, limit: pageSize },
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ getValue }) => (
        <code className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-indigo-300">
          {String(getValue())}
        </code>
      ),
    },
    {
      accessorKey: 'actorId',
      header: 'Actor',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-gray-400">{String(getValue()).slice(0, 8)}…</span>
      ),
    },
    {
      accessorKey: 'targetType',
      header: 'Target Type',
    },
    {
      accessorKey: 'targetId',
      header: 'Target',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-gray-400">{String(getValue()).slice(0, 8)}…</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Timestamp',
      cell: ({ getValue }) => (
        <span className="text-gray-400 text-xs">
          {new Date(String(getValue())).toLocaleString()}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / pageSize) : -1,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isError ? (
          <p className="text-red-400 p-6 text-sm">Failed to load audit log.</p>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-gray-400 py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-gray-400 py-8">
                    No audit log entries.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
        >
          ← Prev
        </Button>
        <span className="text-gray-400 text-sm">
          Page {pageIndex + 1} of {totalPages || 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex + 1 >= totalPages}
          onClick={() => setPageIndex((p) => p + 1)}
        >
          Next →
        </Button>
      </div>
    </div>
  );
};
