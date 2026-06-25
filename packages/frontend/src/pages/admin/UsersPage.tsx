import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'owner';
  suspended: boolean;
  createdAt: string;
}

interface PaginatedUsers {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

const editSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'owner']),
  suspended: z.boolean(),
});

type EditFormValues = z.infer<typeof editSchema>;

const roleBadgeVariant = (role: string) => {
  if (role === 'super_admin') return 'destructive' as const;
  if (role === 'admin') return 'warning' as const;
  return 'secondary' as const;
};

export const UsersPage = () => {
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

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

  const sortBy = sorting[0]?.id ?? 'createdAt';
  const sortOrder = sorting[0]?.desc ? 'DESC' : 'ASC';

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<PaginatedUsers>({
    queryKey: ['admin', 'users', pageIndex, debouncedSearch, sortBy, sortOrder],
    queryFn: async () => {
      const res = await api.get<PaginatedUsers>('/admin/users', {
        params: {
          page: pageIndex + 1,
          limit: pageSize,
          search: debouncedSearch || undefined,
          sortBy,
          sortOrder,
        },
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: EditFormValues }) => {
      await api.patch(`/admin/users/${id}`, values);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditingUser(null);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { role: 'owner', suspended: false },
  });

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    reset({ role: user.role, suspended: user.suspended });
  };

  const onSubmit = (values: EditFormValues) => {
    if (!editingUser) return;
    updateMutation.mutate({ id: editingUser.id, values });
  };

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'email',
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-white transition-colors"
          onClick={() =>
            setSorting([{ id: 'email', desc: sortBy === 'email' ? !sorting[0]?.desc : false }])
          }
        >
          Email {sortBy === 'email' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
        </button>
      ),
      cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
    },
    {
      accessorKey: 'username',
      header: 'Username',
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const role = String(getValue());
        return <Badge variant={roleBadgeVariant(role)}>{role.replace('_', ' ')}</Badge>;
      },
    },
    {
      accessorKey: 'suspended',
      header: 'Status',
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="destructive">Suspended</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        ),
    },
    {
      accessorKey: 'createdAt',
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-white transition-colors"
          onClick={() =>
            setSorting([{ id: 'createdAt', desc: sortBy === 'createdAt' ? !sorting[0]?.desc : true }])
          }
        >
          Joined {sortBy === 'createdAt' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
        </button>
      ),
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
        <Button size="sm" variant="outline" onClick={() => handleEdit(row.original)}>
          Edit
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: data ? Math.ceil(data.total / pageSize) : -1,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
        {data && (
          <span className="text-gray-400 text-sm">{data.total} users total</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isError ? (
          <p className="text-red-400 p-6 text-sm">Failed to load users.</p>
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
                    No users found.
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

      {/* Edit Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <p className="text-gray-400 text-sm mb-4">{editingUser.email}</p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
              <Select
                value={watch('role')}
                onValueChange={(val) => setValue('role', val as EditFormValues['role'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">owner</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="super_admin">super_admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-red-400 text-xs mt-1">{errors.role.message}</p>
              )}
            </div>

            {/* Suspended toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="suspended"
                {...register('suspended')}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600"
              />
              <label htmlFor="suspended" className="text-sm font-medium text-gray-300">
                Suspended
              </label>
            </div>

            {updateMutation.isError && (
              <p className="text-red-400 text-sm">Failed to update user. Please try again.</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
