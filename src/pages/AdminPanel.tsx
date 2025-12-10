import React from 'react';
import { Link } from 'react-router-dom';

const AdminPanel = () => {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link to="/admin/requests" className="p-6 bg-white shadow rounded-lg hover:shadow-md">
                    <h2 className="text-xl font-semibold">Requests</h2>
                    <p className="text-gray-600">Manage document requests</p>
                </Link>
                <Link to="/admin/templates" className="p-6 bg-white shadow rounded-lg hover:shadow-md">
                    <h2 className="text-xl font-semibold">Templates</h2>
                    <p className="text-gray-600">Manage document templates</p>
                </Link>
                <Link to="/admin/categories" className="p-6 bg-white shadow rounded-lg hover:shadow-md">
                    <h2 className="text-xl font-semibold">Categories</h2>
                    <p className="text-gray-600">Manage document categories</p>
                </Link>
                <Link to="/admin/users" className="p-6 bg-white shadow rounded-lg hover:shadow-md">
                    <h2 className="text-xl font-semibold">Users</h2>
                    <p className="text-gray-600">Manage users and roles</p>
                </Link>
            </div>
        </div>
    );
};

export default AdminPanel;
