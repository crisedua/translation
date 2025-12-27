import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DELIVERY_TIMELINES } from '../lib/dataAliases';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const DocumentUpload = () => {
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [category, setCategory] = useState<string>('');
    const [timeline, setTimeline] = useState<string>(DELIVERY_TIMELINES.STANDARD);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchCategories = async () => {
            const { data, error } = await supabase
                .from('document_categories')
                .select('id, name')
                .order('name');

            if (error) {
                console.error('Error fetching categories:', error);
            } else {
                setCategories(data || []);
            }
        };

        fetchCategories();
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file || !category) return;

        setUploadStatus('uploading');
        setErrorMessage('');

        try {
            // 0. Get current user (optional - allow anonymous uploads)
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || null; // null if not logged in

            // 1. Upload file to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `requests/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get signed URL (valid for 2 hours)
            const { data: urlData, error: urlError } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 7200);

            if (urlError) throw urlError;

            const fileUrl = urlData.signedUrl;

            // 3. Create document request in database
            const { data: requestData, error: insertError } = await supabase
                .from('document_requests')
                .insert({
                    user_id: userId, // Will be null for anonymous uploads
                    category: category,
                    delivery_timeline: timeline,
                    original_file_url: fileUrl,
                    status: 'processing'
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 4. Call process-document-v2 Edge Function
            const { error: functionError } = await supabase.functions
                .invoke('process-document-v2', {
                    body: {
                        fileUrl: fileUrl,
                        fileName: file.name,
                        userId: userId, // Pass userId (can be null)
                        categoryId: category,
                        timeline: timeline,
                        requestId: requestData.id
                    }
                });

            if (functionError) {
                // Parse the error message if possible
                console.error('Processing function error:', functionError);
                throw new Error(functionError.message || 'Error processing document. Please check the logs.');
            }

            setUploadStatus('success');

            // Redirect to review page after 2 seconds
            setTimeout(() => {
                navigate(`/admin/requests/${requestData.id}`);
            }, 2000);

        } catch (error: any) {
            console.error('Upload error:', error);
            setErrorMessage(error.message || 'Upload failed. Please try again.');
            setUploadStatus('error');
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl mx-auto">
            <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
                <p className="text-gray-500 mt-2">Select document category and upload your file</p>
            </div>

            <div className="space-y-6">
                {/* Category Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Document Category
                    </label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Select a category...</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Timeline Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Timeline
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { id: DELIVERY_TIMELINES.SAME_DAY, label: 'Same Day', price: '$$$' },
                            { id: DELIVERY_TIMELINES.TWENTY_FOUR_HOURS, label: '24 Hours', price: '$$' },
                            { id: DELIVERY_TIMELINES.STANDARD, label: 'Standard (2-3 days)', price: '$' },
                        ].map((option) => (
                            <div
                                key={option.id}
                                onClick={() => setTimeline(option.id)}
                                className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${timeline === option.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-200'
                                    }`}
                            >
                                <div className="font-medium text-gray-900">{option.label}</div>
                                <div className="text-sm text-gray-500">{option.price}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* File Upload Area */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                        }`}
                >
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.jpg,.jpeg,.png"
                    />

                    {file ? (
                        <div className="flex flex-col items-center">
                            <FileText className="w-12 h-12 text-blue-500 mb-3" />
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            <button
                                onClick={() => setFile(null)}
                                className="mt-4 text-sm text-red-600 hover:text-red-800"
                            >
                                Remove file
                            </button>
                        </div>
                    ) : (
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                            <Upload className="w-12 h-12 text-gray-400 mb-3" />
                            <p className="text-gray-600">
                                <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-sm text-gray-500 mt-1">PDF, JPG or PNG up to 20MB</p>
                        </label>
                    )}
                </div>

                {/* Action Button */}
                <button
                    onClick={handleUpload}
                    disabled={!file || !category || uploadStatus === 'uploading'}
                    className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${!file || !category || uploadStatus === 'uploading'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                        }`}
                >
                    {uploadStatus === 'uploading' ? 'Processing...' : 'Process Document'}
                </button>

                {/* Status Messages */}
                {uploadStatus === 'success' && (
                    <div className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Document uploaded successfully! Redirecting...
                    </div>
                )}
                {uploadStatus === 'error' && (
                    <div className="flex items-center p-4 bg-red-50 text-red-700 rounded-lg">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {errorMessage || 'Upload failed. Please try again.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentUpload;
