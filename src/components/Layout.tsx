import React from 'react';
import Navigation from './Navigation';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="w-full">
                {children}
            </main>
        </div>
    );
};

export default Layout;
