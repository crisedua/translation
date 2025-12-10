import React from 'react';
import { Link } from 'react-router-dom';
import DocumentUpload from '../components/DocumentUpload';
import { Settings, FileText } from 'lucide-react';

const Index = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-xl font-bold text-gray-900">
                            Colombian Document Processing
                        </h1>
                        <div className="flex space-x-4">
                            <Link
                                to="/admin/templates"
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                <span>Manage Templates</span>
                            </Link>
                            <Link
                                to="/admin"
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                <span>Admin Panel</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
                        Upload Document for Processing
                    </h2>
                    <DocumentUpload />
                </div>
            </div>
        </div>
    );
};

export default Index;
