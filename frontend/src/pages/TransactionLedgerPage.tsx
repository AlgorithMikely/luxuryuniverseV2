import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    Chip,
    IconButton,
    Collapse,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Stack,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridPaginationModel } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import { format } from 'date-fns';

// Types
interface LedgerItem {
    id: number;
    timestamp: string;
    action: string;
    credits_spent: number;
    usd_earned: number;
    platform_revenue_usd: number;
    request_id: string;
    ip_address: string;
    user_agent: string;
    meta_data: any;
    user?: {
        username: string;
        avatar: string;
    };
    reviewer?: {
        user: {
            username: string;
        }
    };
}

const TransactionLedgerPage: React.FC = () => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<LedgerItem[]>([]);
    const [total, setTotal] = useState(0);

    // Pagination State
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: 25,
    });

    // Filter State
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionType, setActionType] = useState<string>('all');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    // Details Modal State
    const [selectedItem, setSelectedItem] = useState<LedgerItem | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const fetchLedger = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.post('/api/admin/ledger/search', {
                page: paginationModel.page + 1,
                limit: paginationModel.pageSize,
                search_term: searchTerm || undefined,
                action_types: actionType !== 'all' ? [actionType] : undefined,
                start_date: startDate,
                end_date: endDate
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setRows(response.data.items);
            setTotal(response.data.total);
        } catch (error) {
            console.error("Failed to fetch ledger:", error);
        } finally {
            setLoading(false);
        }
    }, [token, paginationModel, searchTerm, actionType, startDate, endDate]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    const handleViewDetails = (item: LedgerItem) => {
        setSelectedItem(item);
        setDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedItem(null);
    };

    const handleExport = () => {
        if (rows.length === 0) {
            alert("No data to export");
            return;
        }

        // Convert rows to CSV
        const headers = ['ID', 'Date', 'Action', 'User', 'Reviewer', 'Credits', 'USD Earned', 'Request ID', 'Metadata'];
        const csvContent = [
            headers.join(','),
            ...rows.map(row => [
                row.id,
                `"${new Date(row.timestamp).toLocaleString()}"`,
                row.action,
                row.user?.username || 'System',
                row.reviewer?.user?.username || '-',
                row.credits_spent,
                row.usd_earned,
                row.request_id || '',
                `"${JSON.stringify(row.meta_data).replace(/"/g, '""')}"` // Escape quotes in JSON
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `ledger_export_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
            field: 'timestamp',
            headerName: 'Date',
            width: 180,
            valueFormatter: (value: any) => value ? format(new Date(value), 'yyyy-MM-dd HH:mm:ss') : ''
        },
        {
            field: 'action',
            headerName: 'Action',
            width: 130,
            renderCell: (params: GridRenderCellParams) => {
                let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
                if (params.value === 'purchase') color = 'success';
                if (params.value === 'skip') color = 'primary';
                if (params.value === 'withdraw') color = 'warning';
                return <Chip label={params.value as string} color={color} size="small" variant="outlined" />;
            }
        },
        {
            field: 'user',
            headerName: 'User',
            width: 150,
            valueGetter: (value: any, row: LedgerItem) => row.user?.username || 'System'
        },
        {
            field: 'reviewer',
            headerName: 'Reviewer',
            width: 150,
            valueGetter: (value: any, row: LedgerItem) => row.reviewer?.user?.username || '-'
        },
        {
            field: 'credits_spent',
            headerName: 'Credits',
            width: 100,
            type: 'number'
        },
        {
            field: 'usd_earned',
            headerName: 'USD Earned',
            width: 120,
            type: 'number',
            valueFormatter: (value: any) => value ? `$${Number(value).toFixed(2)}` : '$0.00'
        },
        {
            field: 'request_id',
            headerName: 'Request ID',
            width: 150,
            renderCell: (params) => (
                <Tooltip title={params.value as string || ''}>
                    <Typography variant="body2" noWrap>{(params.value as string)?.substring(0, 8)}...</Typography>
                </Tooltip>
            )
        },
        {
            field: 'details',
            headerName: 'Details',
            width: 100,
            sortable: false,
            renderCell: (params) => (
                <IconButton size="small" onClick={() => handleViewDetails(params.row as LedgerItem)}>
                    <VisibilityIcon fontSize="small" />
                </IconButton>
            )
        }
    ];

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                    Transaction Ledger
                </Typography>
                <Stack direction="row" spacing={2}>
                    <Button
                        startIcon={<FilterListIcon />}
                        variant={showFilters ? "contained" : "outlined"}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        Filters
                    </Button>
                    <Button
                        startIcon={<DownloadIcon />}
                        variant="outlined"
                        onClick={handleExport}
                    >
                        Export
                    </Button>
                    <Button
                        startIcon={<RefreshIcon />}
                        variant="contained"
                        onClick={fetchLedger}
                    >
                        Refresh
                    </Button>
                </Stack>
            </Box>

            <Collapse in={showFilters}>
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                            <Box sx={{ flex: '1 1 250px' }}>
                                <TextField
                                    fullWidth
                                    label="Search"
                                    placeholder="Username, Request ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    size="small"
                                />
                            </Box>
                            <Box sx={{ flex: '1 1 150px' }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Action Type</InputLabel>
                                    <Select
                                        value={actionType}
                                        label="Action Type"
                                        onChange={(e) => setActionType(e.target.value)}
                                    >
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="purchase">Purchase</MenuItem>
                                        <MenuItem value="skip">Skip</MenuItem>
                                        <MenuItem value="withdraw">Withdraw</MenuItem>
                                        <MenuItem value="adjustment">Adjustment</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                            <Box sx={{ flex: '1 1 150px' }}>
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={(newValue) => setStartDate(newValue)}
                                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                />
                            </Box>
                            <Box sx={{ flex: '1 1 150px' }}>
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={(newValue) => setEndDate(newValue)}
                                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                />
                            </Box>
                            <Box sx={{ flex: '1 1 100px', display: 'flex', justifyContent: 'flex-end' }}>
                                <Button onClick={() => {
                                    setSearchTerm('');
                                    setActionType('all');
                                    setStartDate(null);
                                    setEndDate(null);
                                }}>
                                    Clear Filters
                                </Button>
                            </Box>
                        </Box>
                    </LocalizationProvider>
                </Paper>
            </Collapse>

            <Paper sx={{ height: 650, width: '100%', bgcolor: 'background.paper' }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    rowCount={total}
                    loading={loading}
                    pageSizeOptions={[25, 50, 100]}
                    paginationModel={paginationModel}
                    paginationMode="server"
                    onPaginationModelChange={setPaginationModel}
                    disableRowSelectionOnClick
                    sx={{
                        border: 0,
                        '& .MuiDataGrid-columnHeaders': {
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                        },
                        '& .MuiDataGrid-cell': {
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                        }
                    }}
                />
            </Paper>

            {/* Details Dialog */}
            <Dialog open={detailsOpen} onClose={handleCloseDetails} maxWidth="md" fullWidth>
                <DialogTitle>Transaction Details</DialogTitle>
                <DialogContent dividers>
                    {selectedItem && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            <Box sx={{ flex: '1 1 45%' }}>
                                <Typography variant="subtitle2" color="text.secondary">Transaction ID</Typography>
                                <Typography variant="body1">{selectedItem.id}</Typography>
                            </Box>
                            <Box sx={{ flex: '1 1 45%' }}>
                                <Typography variant="subtitle2" color="text.secondary">Date</Typography>
                                <Typography variant="body1">{new Date(selectedItem.timestamp).toLocaleString()}</Typography>
                            </Box>
                            <Box sx={{ flex: '1 1 45%' }}>
                                <Typography variant="subtitle2" color="text.secondary">Action</Typography>
                                <Chip label={selectedItem.action} size="small" />
                            </Box>
                            <Box sx={{ flex: '1 1 45%' }}>
                                <Typography variant="subtitle2" color="text.secondary">Request ID</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{selectedItem.request_id}</Typography>
                            </Box>
                            <Box sx={{ flex: '1 1 100%', mt: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary">Metadata</Typography>
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', mt: 1 }}>
                                    <pre style={{ margin: 0, overflow: 'auto' }}>
                                        {JSON.stringify(selectedItem.meta_data, null, 2)}
                                    </pre>
                                </Paper>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDetails}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default TransactionLedgerPage;
