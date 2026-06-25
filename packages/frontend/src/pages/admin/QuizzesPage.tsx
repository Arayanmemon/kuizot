import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';

interface AdminQuiz {
  id: string;
  title: string;
  ownerEmail: string;
  playCount: number;
  createdAt: string;
}

interface PaginatedQuizzes {
  data: AdminQuiz[];
  total: number;
  page: number;
  limit: number;
}

export const QuizzesPage = () => {
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPageIndex(0);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<PaginatedQuizzes>({
    queryKey: ['admin', 'quizzes', pageIndex, debouncedSearch],
    queryFn: async () => {
      const res = await api.get<PaginatedQuizzes>('/admin/quizzes', {
        params: {
          page: pageIndex + 1,
          limit: pageSize,
          search: debouncedSearch || undefined,
        },
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/quizzes/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quizzes'] });
    },
  });

  const columns: ColumnDef<AdminQuiz>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
    },
    {
      accessorKey: 'ownerEmail',
      header: 'Owner',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-gray-300">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: 'playCount',
      header: 'Plays',
      cell: ({ getValue }) => (
        <span className="text-indigo-400 font-semibold">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => (
        <span className="text-gray-400 text-xs">
          {new Date(String(getValue())).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="destructive"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (confirm(`Delete quiz "${row.original.title}"? This cannot be undone.`)) {
              deleteMutation.mutate(row.original.id);
            }
          }}
        >
          Delete
        </Button>
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
      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search quizzes…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
        {data && (
          <span className="text-gray-400 text-sm">{data.total} quizzes total</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isError ? (
          <p className="text-red-400 p-6 text-sm">Failed to load quizzes.</p>
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
                    No quizzes found.
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
