import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Download, AlertCircle, Loader, Save, Edit2, RefreshCw, Search, Wrench } from 'lucide-react';

// Verification types
interface VerificationMatch {
    extractedKey: string;
    pdfField: string;
    value: string;
}

interface VerificationMismatch {
    extractedKey: string;
    expectedValue: string;
    pdfField: string;
    actualValue: string;
}

interface VerificationUnmapped {
    extractedKey: string;
    expectedValue: string;
}

interface VerificationResult {
    matches: number;
    mismatches: number;
    unmapped: number;
    details: {
        matches: VerificationMatch[];
        mismatches: VerificationMismatch[];
        unmapped: VerificationUnmapped[];
    };
}

interface DocumentRequest {
    id: string;
    category: string;
    status: string;
    original_file_url: string;
    extracted_data: any;
    ocr_text: string;
    validation_errors: any;
    delivery_timeline: string;
    generated_document_url?: string;
    created_at: string;
}

const AdminRequestReview = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [request, setRequest] = useState<DocumentRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showOCRModal, setShowOCRModal] = useState(false);
    const [showQAModal, setShowQAModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showFieldMapping, setShowFieldMapping] = useState(false);
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [correctionField, setCorrectionField] = useState<{ key: string; value: string } | null>(null);
    const [correctionHint, setCorrectionHint] = useState('');
    const [correcting, setCorrecting] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
    const [showVerificationPanel, setShowVerificationPanel] = useState(false);
    const [autoCorrectInProgress, setAutoCorrectInProgress] = useState(false);

    useEffect(() => {
        fetchRequest();
    }, [id]);

    // Populate form data when request is loaded
    useEffect(() => {
        if (request?.extracted_data) {
            const flattenedData: Record<string, string> = {};
            Object.entries(request.extracted_data).forEach(([key, value]) => {
                flattenedData[key] = String(value || '');
            });
            setFormData(flattenedData);
        }
    }, [request?.extracted_data]);

    const fetchRequest = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('document_requests')
                .select('*, document_templates(name)')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;
            setRequest(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load request');
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Helper to format snake_case to Title Case
    const formatLabel = (key: string) => {
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleSaveChanges = async () => {
        if (!request) return;
        setSaving(true);

        try {
            const { error: updateError } = await supabase
                .from('document_requests')
                .update({
                    extracted_data: formData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // Update local state
            setRequest(prev => prev ? { ...prev, extracted_data: formData } : null);
            setIsEditing(false);
            alert('Changes saved successfully!');
        } catch (err: any) {
            alert(`Failed to save changes: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!request) return;
        setProcessing(true);

        try {
            const { error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: 'approved',
                    extracted_data: formData, // Save current form data
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            alert('Document approved successfully!');
            navigate('/admin/requests');
        } catch (err: any) {
            alert(`Approval failed: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!request || !rejectionReason.trim()) {
            alert('Please provide a rejection reason');
            return;
        }
        setProcessing(true);

        try {
            const { error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: 'rejected',
                    validation_errors: {
                        ...(request.validation_errors || {}),
                        rejection_reason: rejectionReason
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            alert('Document rejected');
            navigate('/admin/requests');
        } catch (err: any) {
            alert(`Rejection failed: ${err.message}`);
        } finally {
            setProcessing(false);
            setShowRejectModal(false);
        }
    };

    const handleRequestCorrection = async () => {
        if (!correctionField || !request) return;
        setCorrecting(true);

        try {
            const { data, error } = await supabase.functions.invoke('correct-field', {
                body: {
                    requestId: request.id,
                    fieldName: correctionField.key,
                    hint: correctionHint.trim() || undefined
                }
            });

            if (error) throw error;

            if (data?.success) {
                // Update local form data with corrected value
                setFormData(prev => ({
                    ...prev,
                    [correctionField.key]: data.correctedValue
                }));

                // Also update the request object
                setRequest(prev => prev ? {
                    ...prev,
                    extracted_data: {
                        ...prev.extracted_data,
                        [correctionField.key]: data.correctedValue
                    }
                } : null);

                alert(`Field corrected! New value: "${data.correctedValue}"`);
                setShowCorrectionModal(false);
                setCorrectionField(null);
                setCorrectionHint('');
            } else {
                throw new Error(data?.error || 'Correction failed');
            }
        } catch (err: any) {
            console.error('Correction error:', err);
            alert(`Correction failed: ${err.message}`);
        } finally {
            setCorrecting(false);
        }
    };

    const openCorrectionModal = (key: string, value: string) => {
        setCorrectionField({ key, value });
        setCorrectionHint('');
        setShowCorrectionModal(true);
    };

    const handleGenerateDocument = async () => {
        if (!request) return;
        setProcessing(true);

        try {
            // First save the current form data
            const { error: saveError } = await supabase
                .from('document_requests')
                .update({
                    extracted_data: formData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (saveError) throw saveError;

            const { error } = await supabase.functions.invoke('generate-document', {
                body: { requestId: request.id }
            });

            if (error) {
                // Try to parse the error message if it's a JSON string
                let errorMessage = error.message;
                try {
                    const parsed = JSON.parse(error.message);
                    if (parsed.error) errorMessage = parsed.error;
                } catch (e) { }
                throw new Error(errorMessage || 'Generation failed');
            }

            // Refresh request data to get the new URL
            await fetchRequest();
            alert('Document generated successfully!');

        } catch (err: any) {
            console.error('Generation execution error:', err);

            // Try to extract a meaningful message
            let displayMessage = err.message || 'Generation failed';

            if (err && typeof err === 'object') {
                if (err.context && err.context.json) {
                    try {
                        const jsonBody = await err.context.json();
                        console.error('Error Response Body:', jsonBody);
                        if (jsonBody.error) displayMessage = jsonBody.error;
                        if (jsonBody.stack) console.error('Error Stack:', jsonBody.stack);
                    } catch (e) {
                        console.error('Failed to parse error context JSON', e);
                    }
                }
            }

            alert(`Generation failed: ${displayMessage}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleVerifyDocument = async () => {
        if (!request) return;
        setVerifying(true);
        setVerificationResult(null);

        try {
            const { data, error } = await supabase.functions.invoke('verify-document', {
                body: { requestId: request.id }
            });

            if (error) throw error;

            if (data?.success && data?.verification) {
                setVerificationResult(data.verification);
                setShowVerificationPanel(true);
            } else {
                throw new Error(data?.error || 'Verification failed');
            }
        } catch (err: any) {
            console.error('Verification error:', err);
            alert(`Verification failed: ${err.message}`);
        } finally {
            setVerifying(false);
        }
    };

    const handleAutoCorrect = async () => {
        if (!request || !verificationResult || verificationResult.mismatches === 0) return;

        setAutoCorrectInProgress(true);

        try {
            // Auto-correct means regenerating the document from extracted data
            // The extracted data is the source of truth
            const { error: saveError } = await supabase
                .from('document_requests')
                .update({
                    extracted_data: formData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (saveError) throw saveError;

            // Regenerate document
            const { error: genError } = await supabase.functions.invoke('generate-document', {
                body: { requestId: request.id }
            });

            if (genError) throw genError;

            // Refresh request data
            await fetchRequest();

            // Re-verify to show the results
            await handleVerifyDocument();

            alert('Document regenerated from extracted data!');
        } catch (err: any) {
            console.error('Auto-correct error:', err);
            alert(`Auto-correct failed: ${err.message}`);
        } finally {
            setAutoCorrectInProgress(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="p-8 max-w-6xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start">
                    <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-red-900">Error Loading Request</h3>
                        <p className="text-red-700 mt-1">{error || 'Request not found'}</p>
                        <button
                            onClick={() => navigate('/admin/requests')}
                            className="mt-4 text-sm text-red-600 hover:text-red-800 underline"
                        >
                            Back to Requests
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Document Review</h1>
                        <p className="text-gray-500 mt-1">Request ID: {request.id.slice(0, 8)}...</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                request.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                            }`}>
                            {request.status.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel: Extracted Data */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Extracted Data</h2>

                    {/* Category & Timeline */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-sm text-gray-600">Category</span>
                                <p className="font-medium">{request.category || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-sm text-gray-600">Timeline</span>
                                <p className="font-medium">{request.delivery_timeline || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-sm text-gray-600">File Name</span>
                                <p className="font-medium truncate" title={request.original_file_url?.split('/').pop()?.split('?')[0] || 'Unknown'}>
                                    {request.original_file_url?.split('/').pop()?.split('?')[0] || 'Unknown'}
                                </p>
                            </div>
                            <div>
                                <span className="text-sm text-gray-600">Template Matched</span>
                                <p className="font-medium">{(request as any).document_templates?.name || 'Unknown'}</p>
                            </div>
                            {/* QA Status Badge - Hidden as requested */}
                            {/* <div className="col-span-2 mt-2 pt-2 border-t border-gray-200">
                                <span className="text-sm text-gray-600 block mb-1">QA / Validation Status</span>
                                {(request.validation_errors && (Array.isArray(request.validation_errors) ? request.validation_errors.length > 0 : Object.keys(request.validation_errors).length > 0)) ? (
                                    <button
                                        onClick={() => setShowQAModal(true)}
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors cursor-pointer"
                                    >
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Issues Found - Click to View
                                    </button>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Passed
                                    </span>
                                )}
                            </div> */}
                        </div>
                    </div>

                    {/* Field Mapping Debug View - Collapsible */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <button
                            onClick={() => setShowFieldMapping(!showFieldMapping)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <h3 className="font-semibold text-blue-900 flex items-center">
                                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                Template Field → Extracted Data ({Object.keys(formData).length} fields)
                            </h3>
                            <span className="text-blue-600 text-sm">{showFieldMapping ? '▼ Collapse' : '▶ Expand'}</span>
                        </button>

                        {showFieldMapping && (
                            <div className="mt-3">
                                {/* OCR Raw Text Section */}
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                                    <h4 className="font-semibold text-amber-800 text-sm mb-2">📄 Raw OCR Text (Google Vision)</h4>
                                    <p className="text-xs text-amber-600 mb-2">This is what the OCR sees - notice location fields may be merged</p>
                                    <div className="max-h-40 overflow-y-auto bg-white p-2 rounded border border-amber-100">
                                        <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">
                                            {request?.ocr_text?.slice(0, 1500) || 'No OCR text available'}
                                            {request?.ocr_text && request.ocr_text.length > 1500 && '...(truncated)'}
                                        </pre>
                                    </div>
                                </div>

                                {/* Extracted Data Table */}
                                <h4 className="font-semibold text-blue-800 text-sm mb-2">🔍 Extracted Data (AI parsed)</h4>
                                <p className="text-xs text-blue-600 mb-3">All extracted data key-value pairs</p>
                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-blue-100">
                                            <tr className="border-b border-blue-200">
                                                <th className="text-left py-2 px-2 text-blue-800 font-medium">Extracted Key</th>
                                                <th className="text-left py-2 px-2 text-blue-800 font-medium">Value</th>
                                                <th className="text-right py-2 px-2 text-blue-800 font-medium w-16">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(formData)
                                                .map(([key, value]) => (
                                                    <tr key={key} className={`border-b border-blue-100 hover:bg-blue-100 ${!value || value.trim() === '' ? 'opacity-50' : ''}`}>
                                                        <td className="py-1.5 px-2 font-mono text-blue-700">{key}</td>
                                                        <td className="py-1.5 px-2 text-gray-800" title={value}>
                                                            {value || <span className="italic text-gray-400">empty</span>}
                                                        </td>
                                                        <td className="py-1.5 px-2 text-right">
                                                            <button
                                                                onClick={() => openCorrectionModal(key, value)}
                                                                className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-100"
                                                                title="Request AI Fix"
                                                            >
                                                                <RefreshCw className="w-3 h-3" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Extracted Fields - Editable Form */}
                    {Object.keys(formData).length > 0 ? (
                        <div className="space-y-4">
                            {/* Edit/Save Toggle */}
                            <div className="flex justify-end mb-2">
                                {isEditing ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                // Reset form data to original
                                                if (request?.extracted_data) {
                                                    const flattenedData: Record<string, string> = {};
                                                    Object.entries(request.extracted_data).forEach(([key, value]) => {
                                                        flattenedData[key] = String(value || '');
                                                    });
                                                    setFormData(flattenedData);
                                                }
                                                setIsEditing(false);
                                            }}
                                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveChanges}
                                            disabled={saving}
                                            className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                                        >
                                            <Save className="w-4 h-4 mr-1" />
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4 mr-1" />
                                        Edit Fields
                                    </button>
                                )}
                            </div>

                            {/* Form Fields */}
                            <div className="max-h-[500px] overflow-y-auto pr-2">
                                {Object.entries(formData).map(([key, value]) => (
                                    <div key={key} className="mb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium text-gray-700">
                                                {formatLabel(key)}
                                            </label>
                                            <button
                                                onClick={() => openCorrectionModal(key, value)}
                                                className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-purple-50 transition-colors"
                                                title="Request AI to re-extract this field"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                AI Fix
                                            </button>
                                        </div>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={value}
                                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                            />
                                        ) : (
                                            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                                                {value || <span className="text-gray-400 italic">Empty</span>}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">No extracted data available</p>
                    )}

                    {/* Validation Errors */}
                    {request.validation_errors && (
                        (Array.isArray(request.validation_errors) && request.validation_errors.length > 0) ||
                        (!Array.isArray(request.validation_errors) && Object.keys(request.validation_errors).length > 0)
                    ) && (
                            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h3 className="font-semibold text-yellow-900 mb-2 flex items-center">
                                    <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                                    Validation Issues
                                </h3>
                                <ul className="text-sm space-y-2">
                                    {/* Handle Array of Strings (New Format) */}
                                    {Array.isArray(request.validation_errors) ? (
                                        request.validation_errors.map((error: string, index: number) => {
                                            const isQA = error.startsWith('[QA]');
                                            const cleanError = isQA ? error.replace('[QA]', '').trim() : error;
                                            return (
                                                <li key={index} className={`flex items-start ${isQA ? 'text-blue-800' : 'text-yellow-800'}`}>
                                                    <span className="mr-2 mt-0.5">•</span>
                                                    <span>
                                                        {isQA && <span className="font-bold text-blue-600 mr-1">[AI Audit]</span>}
                                                        {cleanError}
                                                    </span>
                                                </li>
                                            );
                                        })
                                    ) : (
                                        /* Handle Object (Legacy Format) */
                                        Object.entries(request.validation_errors).map(([key, value]) => (
                                            <li key={key} className="text-yellow-800 flex items-start">
                                                <span className="mr-2">•</span>
                                                <span className="font-medium mr-1">{key}:</span> {String(value)}
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        )}

                    {/* OCR Text (Expandable) */}
                    {request.ocr_text && (
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">OCR Text</h3>
                                <button
                                    onClick={() => setShowOCRModal(true)}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    View Full Text
                                </button>
                            </div>
                            <div className="p-3 bg-gray-50 rounded text-xs text-gray-600 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
                                {request.ocr_text.slice(0, 500) + (request.ocr_text.length > 500 ? '...' : '')}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: PDF Viewer */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Generated Document</h2>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleGenerateDocument}
                                disabled={processing}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                            >
                                {processing ? 'Generating...' : 'Generate Document'}
                            </button>
                            {request.generated_document_url && (
                                <>
                                    <button
                                        onClick={handleVerifyDocument}
                                        disabled={verifying}
                                        className="flex items-center px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                                    >
                                        <Search className="w-3 h-3 mr-1" />
                                        {verifying ? 'Verifying...' : 'Verify'}
                                    </button>
                                    <a
                                        href={request.generated_document_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-blue-600 hover:text-blue-800"
                                    >
                                        <Download className="w-4 h-4 mr-1" />
                                        Download
                                    </a>
                                </>
                            )}
                        </div>
                    </div>

                    {request.generated_document_url ? (
                        <iframe
                            src={request.generated_document_url}
                            className="w-full h-[600px] border border-gray-300 rounded"
                            title="Generated Document"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-[600px] bg-gray-50 border border-gray-300 rounded">
                            <p className="text-gray-500">No generated document available</p>
                        </div>
                    )}

                    {/* Verification Results Panel */}
                    {showVerificationPanel && verificationResult && (
                        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 flex items-center">
                                    <Search className="w-4 h-4 mr-2 text-purple-600" />
                                    Verification Results
                                </h3>
                                <button
                                    onClick={() => setShowVerificationPanel(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Summary */}
                            <div className="flex gap-4 mb-4 text-sm">
                                <span className="flex items-center text-green-600">
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    {verificationResult.matches} Matches
                                </span>
                                <span className="flex items-center text-red-600">
                                    <XCircle className="w-4 h-4 mr-1" />
                                    {verificationResult.mismatches} Mismatches
                                </span>
                                <span className="flex items-center text-yellow-600">
                                    <AlertCircle className="w-4 h-4 mr-1" />
                                    {verificationResult.unmapped} Unmapped
                                </span>
                            </div>

                            {/* Mismatches (Most Important) */}
                            {verificationResult.mismatches > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-red-700 mb-2">❌ Mismatches (Need Correction)</h4>
                                    <div className="max-h-40 overflow-y-auto bg-red-50 rounded p-2 space-y-2">
                                        {verificationResult.details.mismatches.map((m, i) => (
                                            <div key={i} className="text-xs bg-white p-2 rounded border border-red-200">
                                                <span className="font-medium text-gray-700">{m.extractedKey}:</span>
                                                <div className="ml-2 mt-1">
                                                    <div className="text-green-700">Expected: "{m.expectedValue}"</div>
                                                    <div className="text-red-700">PDF has: "{m.actualValue || '(empty)'}"</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Auto Correct Button */}
                                    <button
                                        onClick={handleAutoCorrect}
                                        disabled={autoCorrectInProgress}
                                        className="mt-3 flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                                    >
                                        <Wrench className="w-4 h-4 mr-2" />
                                        {autoCorrectInProgress ? 'Correcting...' : 'Auto Correct (Regenerate)'}
                                    </button>
                                    <p className="text-xs text-gray-500 mt-1">
                                        This will regenerate the document using extracted data as the source of truth.
                                    </p>
                                </div>
                            )}

                            {/* Unmapped Fields */}
                            {verificationResult.unmapped > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-yellow-700 mb-2">⚠️ Unmapped (No PDF field found)</h4>
                                    <div className="max-h-32 overflow-y-auto bg-yellow-50 rounded p-2 space-y-1">
                                        {verificationResult.details.unmapped.slice(0, 10).map((u, i) => (
                                            <div key={i} className="text-xs text-yellow-800">
                                                <span className="font-medium">{u.extractedKey}:</span> "{u.expectedValue.substring(0, 50)}..."
                                            </div>
                                        ))}
                                        {verificationResult.unmapped > 10 && (
                                            <div className="text-xs text-yellow-600 italic">
                                                ...and {verificationResult.unmapped - 10} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* All Clear Message */}
                            {verificationResult.mismatches === 0 && verificationResult.unmapped === 0 && (
                                <div className="p-4 bg-green-50 rounded-lg text-center">
                                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                    <p className="text-green-800 font-medium">All fields verified successfully!</p>
                                    <p className="text-green-600 text-sm">The generated document matches the extracted data.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            {request.status === 'processing' && (
                <div className="mt-8 flex justify-center space-x-4">
                    <button
                        onClick={handleApprove}
                        disabled={processing}
                        className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {processing ? 'Processing...' : 'Approve Document'}
                    </button>
                    <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={processing}
                        className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                        <XCircle className="w-5 h-5 mr-2" />
                        Reject Document
                    </button>
                </div>
            )}

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-semibold mb-4">Reject Document</h3>
                        <p className="text-gray-600 mb-4">Please provide a reason for rejection:</p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            rows={4}
                            placeholder="Enter rejection reason..."
                        />
                        <div className="mt-4 flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason('');
                                }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectionReason.trim() || processing}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                            >
                                {processing ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OCR Modal */}
            {showOCRModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <h3 className="text-xl font-semibold text-gray-900">Full OCR Text</h3>
                            <button
                                onClick={() => setShowOCRModal(false)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-white">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed">
                                {request?.ocr_text || 'No text content available.'}
                            </pre>
                        </div>
                        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
                            <button
                                onClick={() => setShowOCRModal(false)}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QA Errors Modal */}
            {showQAModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-red-50 rounded-t-lg">
                            <h3 className="text-xl font-semibold text-red-900 flex items-center">
                                <AlertCircle className="w-6 h-6 mr-2 text-red-600" />
                                QA Validation Errors
                            </h3>
                            <button
                                onClick={() => setShowQAModal(false)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-white">
                            {request.validation_errors && (
                                <ul className="space-y-3">
                                    {Array.isArray(request.validation_errors) ? (
                                        request.validation_errors.map((error: string, index: number) => {
                                            const isQA = error.startsWith('[QA]');
                                            const cleanError = isQA ? error.replace('[QA]', '').trim() : error;
                                            return (
                                                <li
                                                    key={index}
                                                    className={`p-3 rounded-lg border ${isQA ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}
                                                >
                                                    <div className="flex items-start">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${isQA ? 'bg-blue-200 text-blue-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                            {isQA ? 'AI Audit' : 'Validation'}
                                                        </span>
                                                    </div>
                                                    <p className={`mt-2 text-sm ${isQA ? 'text-blue-900' : 'text-yellow-900'}`}>
                                                        {cleanError}
                                                    </p>
                                                </li>
                                            );
                                        })
                                    ) : (
                                        Object.entries(request.validation_errors).map(([key, value]) => (
                                            <li
                                                key={key}
                                                className="p-3 rounded-lg border bg-yellow-50 border-yellow-200"
                                            >
                                                <div className="flex items-start">
                                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 bg-yellow-200 text-yellow-800">
                                                        Field Error
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-yellow-900">
                                                    <span className="font-medium">{key}:</span> {String(value)}
                                                </p>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
                            <button
                                onClick={() => setShowQAModal(false)}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* AI Correction Modal */}
            {showCorrectionModal && correctionField && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-purple-600" />
                                Request AI Correction
                            </h3>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Field to Correct
                                </label>
                                <p className="text-gray-900 font-semibold">{formatLabel(correctionField.key)}</p>
                                <p className="text-sm text-gray-500 font-mono mt-1 bg-gray-50 p-1 rounded inline-block">
                                    {correctionField.key}
                                </p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Current Value
                                </label>
                                <p className="p-3 bg-gray-50 rounded border border-gray-200 text-gray-800 break-words">
                                    {correctionField.value || <span className="text-gray-400 italic">Empty</span>}
                                </p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hint for AI (Optional)
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Help the AI find the correct value. Example: "Look in the bottom right corner"
                                </p>
                                <textarea
                                    value={correctionHint}
                                    onChange={(e) => setCorrectionHint(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    rows={3}
                                    placeholder="e.g. The date is actually 12/05/2023..."
                                />
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowCorrectionModal(false);
                                        setCorrectionField(null);
                                        setCorrectionHint('');
                                    }}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={correcting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestCorrection}
                                    disabled={correcting}
                                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
                                >
                                    {correcting ? (
                                        <>
                                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                                            Correcting...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                            Request Correction
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRequestReview;
