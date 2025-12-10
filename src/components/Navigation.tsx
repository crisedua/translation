import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, Upload, FolderTree, Users, LayoutDashboard } from 'lucide-react';

const Navigation = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/requests', label: 'Requests', icon: FileText },
        { path: '/admin/templates', label: 'Templates', icon: Upload },
        { path: '/admin/categories', label: 'Categories', icon: FolderTree },
        { path: '/admin/users', label: 'Users', icon: Users },
    ];

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo/Brand */}
                    <div className="flex-shrink-0">
                        <Link to="/" className="flex items-center space-x-2">
                            <div className="bg-white rounded-lg p-1.5">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                            <span className="text-white font-bold text-xl hidden sm:block">
                                Colombian Docs
                            </span>
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex space-x-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`
                                        flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium
                                        transition-all duration-200 ease-in-out
                                        ${active
                                            ? 'bg-white text-blue-600 shadow-md'
                                            : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                                        }
                                    `}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden md:block">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
