import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';

interface PaymentRequest {
  id: string;
  requestType: string;
  amountCents: number;
  creditsToAdd: number;
  status: 'pending' | 'confirmed' | 'rejected';
  ownerReference: string;
  adminNote?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected';

const STATUS_BADGE: Record<string, React.ReactElement> = {
  pending: <Badge variant="warning">Pending</Badge>,
  confirmed: <Badge variant="success">Confirmed</Badge>,
  rejected: <Badge variant="destructive">Rejected</Badge>,
};

const formatType = (type: string): string => {
  const map: Record<string, string> = {
    payg_topup: 'Pay-as-you-go',
    starter: 'Starter Plan',
    pro: 'Pro Plan',
    business: 'Business Plan',
  };
  return map[type] ?? type;
};

export const PaymentRequestsPage = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, isError } = useQuery<PaymentRequest[]>({
    queryKey: ['admin', 'payment-requests', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await api.get<PaymentRequest[]>('/admin/billing/payment-requests', { params });
      return res.data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/admin/billing/payment-requests/${id}/confirm`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payment-requests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      await api.patch(`/admin/billing/payment-requests/${id}/reject`, { adminNote: note });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payment-requests'] });
      setRejectingId(null);
      setAdminNote('');
    },
  });

  const columns: ColumnDef<PaymentRequest>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Submitted',
      cell: ({ getValue }) => (
        <span className="text-gray-400 text-xs">
          {new Date(String(getValue())).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'userEmail',
      header: 'User',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.user?.email ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'requestType',
      header: 'Type',
      cell: ({ getValue }) => (
        <span className="text-sm">{formatType(String(getValue()))}</span>
      ),
    },
    {
      accessorKey: 'amountCents',
      header: 'Amount',
      cell: ({ getValue }) => (
        <span className="font-mono">${(Number(getValue()) / 100).toFixed(2)}</span>
      ),
    },
    {
      accessorKey: 'creditsToAdd',
      header: 'Credits',
      cell: ({ getValue }) => <span>{String(getValue())}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => STATUS_BADGE[String(getValue())] ?? <span>{String(getValue())}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const req = row.original;
        if (req.status !== 'pending') return null;

        if (rejectingId === req.id) {
          return (
            <div className="flex flex-col gap-2 min-w-48">
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Rejection reason (optional)"
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-gray-200 text-xs resize-none focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => rejectMutation.mutate({ id: req.id, note: adminNote })}
                  disabled={rejectMutation.isPending}
                >
                  Confirm Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setRejectingId(null); setAdminNote(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => confirmMutation.mutate(req.id)}
              disabled={confirmMutation.isPending}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRejectingId(req.id)}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: requests,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'All', value: 'all' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              statusFilter === opt.value
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isError ? (
          <p className="text-red-400 p-6 text-sm">Failed to load payment requests.</p>
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
                    No payment requests found.
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

      {(confirmMutation.isError || rejectMutation.isError) && (
        <p className="text-red-400 text-sm">Action failed. Please try again.</p>
      )}
    </div>
  );
};
