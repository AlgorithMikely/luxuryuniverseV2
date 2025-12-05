import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Alert,
    Divider
} from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import api from '../services/api';

interface MetricsSummary {
    gmv: number;
    net_revenue: number;
    reviewer_payouts: number;
    take_rate: number;
    net_margin: number;
    active_reviewers: number;
}

interface SessionMetric {
    session_id: number;
    session_name: string;
    reviewer_name: string;
    date: string;
    net_revenue: number;
    gmv: number;
    transaction_count: number;
}

interface ReviewerMetric {
    reviewer_id: number;
    reviewer_name: string;
    net_revenue: number;
    total_earnings: number;
    transaction_count: number;
}

const AdminMetricsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<MetricsSummary | null>(null);
    const [sessions, setSessions] = useState<SessionMetric[]>([]);
    const [reviewers, setReviewers] = useState<ReviewerMetric[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [summaryRes, sessionsRes, reviewersRes] = await Promise.all([
                    api.get('/admin/metrics/summary'),
                    api.get('/admin/metrics/sessions'),
                    api.get('/admin/metrics/reviewers')
                ]);

                setSummary(summaryRes.data);
                setSessions(sessionsRes.data);
                setReviewers(reviewersRes.data);
            } catch (err: any) {
                console.error("Failed to fetch metrics:", err);
                setError("Failed to load dashboard data. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={3}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box p={3}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#fff' }}>
                Platform Metrics Dashboard
            </Typography>

            {/* KPI Cards */}
            <Grid container spacing={3} mb={4}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KPICard title="Net Revenue" value={`$${summary?.net_revenue.toFixed(2)}`} subtext="Platform Share" color="#4caf50" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KPICard title="GMV" value={`$${summary?.gmv.toFixed(2)}`} subtext="Total Volume" color="#2196f3" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KPICard title="Take Rate" value={`${summary?.take_rate.toFixed(1)}%`} subtext="Target: 25%" color="#ff9800" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KPICard title="Active Reviewers" value={summary?.active_reviewers.toString() || "0"} subtext="Last 30 Days" color="#9c27b0" />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Reviewer Leaderboard */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: '100%', bgcolor: '#1e1e1e', color: '#fff' }}>
                        <Typography variant="h6" gutterBottom>Top Reviewers by Revenue</Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: '#aaa' }}>Reviewer</TableCell>
                                        <TableCell align="right" sx={{ color: '#aaa' }}>Net Revenue</TableCell>
                                        <TableCell align="right" sx={{ color: '#aaa' }}>Payouts</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {reviewers.slice(0, 5).map((r) => (
                                        <TableRow key={r.reviewer_id}>
                                            <TableCell sx={{ color: '#fff' }}>{r.reviewer_name}</TableCell>
                                            <TableCell align="right" sx={{ color: '#4caf50' }}>${r.net_revenue.toFixed(2)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#fff' }}>${r.total_earnings.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Revenue Chart (Placeholder for now, using Reviewer Data) */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: '100%', bgcolor: '#1e1e1e', color: '#fff' }}>
                        <Typography variant="h6" gutterBottom>Revenue Distribution</Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={reviewers.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="reviewer_name" stroke="#aaa" />
                                <YAxis stroke="#aaa" />
                                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
                                <Legend />
                                <Bar dataKey="net_revenue" name="Net Revenue" fill="#4caf50" />
                                <Bar dataKey="total_earnings" name="Reviewer Payout" fill="#2196f3" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Recent Sessions */}
                <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#fff' }}>
                        <Typography variant="h6" gutterBottom>Recent Sessions</Typography>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ color: '#aaa' }}>Session</TableCell>
                                        <TableCell sx={{ color: '#aaa' }}>Reviewer</TableCell>
                                        <TableCell sx={{ color: '#aaa' }}>Date</TableCell>
                                        <TableCell align="right" sx={{ color: '#aaa' }}>Tx Count</TableCell>
                                        <TableCell align="right" sx={{ color: '#aaa' }}>GMV</TableCell>
                                        <TableCell align="right" sx={{ color: '#aaa' }}>Net Revenue</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sessions.map((s) => (
                                        <TableRow key={s.session_id}>
                                            <TableCell sx={{ color: '#fff' }}>{s.session_name}</TableCell>
                                            <TableCell sx={{ color: '#fff' }}>{s.reviewer_name}</TableCell>
                                            <TableCell sx={{ color: '#fff' }}>{new Date(s.date).toLocaleDateString()}</TableCell>
                                            <TableCell align="right" sx={{ color: '#fff' }}>{s.transaction_count}</TableCell>
                                            <TableCell align="right" sx={{ color: '#fff' }}>${s.gmv.toFixed(2)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#4caf50' }}>${s.net_revenue.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

const KPICard: React.FC<{ title: string; value: string; subtext: string; color: string }> = ({ title, value, subtext, color }) => (
    <Card sx={{ bgcolor: '#1e1e1e', color: '#fff', borderLeft: `4px solid ${color}` }}>
        <CardContent>
            <Typography color="#aaa" gutterBottom variant="subtitle2">
                {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {value}
            </Typography>
            <Typography variant="caption" sx={{ color: '#aaa' }}>
                {subtext}
            </Typography>
        </CardContent>
    </Card>
);

export default AdminMetricsPage;
