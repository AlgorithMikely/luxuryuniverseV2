import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const LegalPages = () => {
    const location = useLocation();
    const isPrivacy = location.pathname.includes('privacy');

    return (
        <div className="container mx-auto px-4 py-8 text-white max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">
                {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
            </h1>

            <div className="prose prose-invert">
                <p className="text-gray-400 mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

                {isPrivacy ? (
                    <>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
                            <p>We collect information you provide directly to us, such as when you create an account, submit content, or communicate with us. This may include your username, email address, and social media handles.</p>
                        </section>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">2. How We Use Information</h2>
                            <p>We use your information to operate, maintain, and improve our services, facilitate transactions, and communicate with you.</p>
                        </section>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">3. Data Security</h2>
                            <p>We implement reasonable security measures to protect your information. However, no security system is impenetrable.</p>
                        </section>
                    </>
                ) : (
                    <>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
                            <p>By accessing or using our services, you agree to be bound by these Terms. If you do not agree, do not use our services.</p>
                        </section>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">2. User Accounts</h2>
                            <p>You are responsible for maintaining the security of your account and for all activities that occur under your account.</p>
                        </section>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">3. Content</h2>
                            <p>You retain ownership of content you submit. You grant us a license to use, display, and distribute your content in connection with the service.</p>
                        </section>
                        <section className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">4. Termination</h2>
                            <p>We reserve the right to suspend or terminate your account at our discretion.</p>
                        </section>
                    </>
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800 flex gap-4">
                <Link to="/terms" className={`text-blue-400 hover:underline ${!isPrivacy ? 'font-bold' : ''}`}>Terms of Service</Link>
                <Link to="/privacy" className={`text-blue-400 hover:underline ${isPrivacy ? 'font-bold' : ''}`}>Privacy Policy</Link>
            </div>
        </div>
    );
};

export default LegalPages;
