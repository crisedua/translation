import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Eye, Loader, Trash2 } from 'lucide-react';

interface DocumentRequest {
    id: string;
    category: string;
    status: string;
    delivery_timeline: string;
    created_at: string;
    extracted_data: any;
}

const AdminRequests = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState<DocumentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('document_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        if (filter === 'all') return true;
        return req.status === filter;
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'rejected':
                return <XCircle className="w-5 h-5 text-red-600" />;
            case 'processing':
                return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />;
            default:
                return <AlertCircle className="w-5 h-5 text-gray-600" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const classes = {
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            processing: 'bg-blue-100 text-blue-800',
            pending: 'bg-gray-100 text-gray-800'
        };
        return classes[status as keyof typeof classes] || classes.pending;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Requests</h1>
                <p className="text-gray-600">Manage and review all document processing requests</p>
            </div>

            {/* Filters */}
            <div className="mb-6 flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Filter by status:</span>
                <div className="flex space-x-2">
                    {['all', 'processing', 'approved', 'rejected'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === status
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', count: requests.length, color: 'blue' },
                    { label: 'Processing', count: requests.filter(r => r.status === 'processing').length, color: 'blue' },
                    { label: 'Approved', count: requests.filter(r => r.status === 'approved').length, color: 'green' },
                    { label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length, color: 'red' }
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-lg shadow p-6">
                        <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
                        <div className={`text-3xl font-bold text-${stat.color}-600`}>{stat.count}</div>
                    </div>
                ))}
            </div>

            {/* Requests List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold">
                        {filteredRequests.length} {filter !== 'all' ? filter : ''} Request{filteredRequests.length !== 1 ? 's' : ''}
                    </h2>
                </div>

                {filteredRequests.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No requests found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredRequests.map(request => (
                            <div
                                key={request.id}
                                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => navigate(`/admin/requests/${request.id}`)}
                            >
                                <div className="flex items-center justify-between">
                                    {/* Left Section */}
                                    <div className="flex items-center space-x-4 flex-1">
                                        <div className="flex-shrink-0">
                                            {getStatusIcon(request.status)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-3 mb-1">
                                                <h3 className="text-sm font-medium text-gray-900">
                                                    {request.category || 'Unknown Category'}
                                                </h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                                                    {request.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                                                <span>ID: {request.id.slice(0, 8)}...</span>
                                                <span>•</span>
                                                <span>{new Date(request.created_at).toLocaleDateString()} {new Date(request.created_at).toLocaleTimeString()}</span>
                                                {request.delivery_timeline && (
                                                    <>
                                                        <span>•</span>
                                                        <span>Timeline: {request.delivery_timeline}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Section */}
                                    <div className="flex items-center space-x-3">
                                        {request.extracted_data && Object.keys(request.extracted_data).length > 0 && (
                                            <span className="text-xs text-gray-500">
                                                {Object.keys(request.extracted_data).length} fields
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Are you sure you want to delete this request?')) {
                                                    const handleDelete = async () => {
                                                        try {
                                                            const { error } = await supabase.functions.invoke('delete-request', {
                                                                body: { requestId: request.id }
                                                            });

                                                            if (error) throw error;

                                                            setRequests(requests.filter(r => r.id !== request.id));
                                                        } catch (error) {
                                                            alert('Error deleting request');
                                                            console.error(error);
                                                        }
                                                    };
                                                    handleDelete();
                                                }
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Request"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/admin/requests/${request.id}`);
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminRequests;
