import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../services/api';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

// Initialize Stripe outside of component to avoid recreating it
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount?: number; // Optional, defaults to 0 or calculated
    reviewerId: number;
    submissionId?: number; // For skipping line
    onSuccess: () => void;
    metadata?: any; // Extra data like track_url, track_title
}

const CheckoutForm = ({ amount, onSuccess, metadata }: { amount: number, onSuccess: () => void, metadata: any }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: `${window.location.origin}/payment-success`,
            },
            redirect: "if_required" // Handle redirect manually if needed, or let Stripe handle it
        });

        if (error) {
            setMessage(error.message || "An unexpected error occurred.");
        } else {
            // Success!
            toast.success("Payment successful!");
            onSuccess();
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {message && <div className="text-red-500 text-sm">{message}</div>}
            <button
                disabled={isLoading || !stripe || !elements}
                id="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
            >
                {isLoading ? "Processing..." : `Pay $${amount}`}
            </button>
        </form>
    );
};

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, amount, reviewerId, submissionId, onSuccess, metadata }) => {
    const [clientSecret, setClientSecret] = useState("");
    const [email, setEmail] = useState("");
    const [tiktokHandle, setTiktokHandle] = useState("");
    const [trackUrl, setTrackUrl] = useState("");
    const [trackTitle, setTrackTitle] = useState("");
    const [step, setStep] = useState<'track_info' | 'email' | 'payment'>('email');
    const [isInitializing, setIsInitializing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Determine starting step
            if (!submissionId && !metadata?.track_url) {
                setStep('track_info');
            } else {
                setStep('email');
            }
        } else {
            setClientSecret("");
            setStep('email');
            setEmail("");
            setTiktokHandle("");
            setTrackUrl("");
            setTrackTitle("");
        }
    }, [isOpen, submissionId, metadata]);

    const handleTrackSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (trackUrl) {
            setStep('email');
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsInitializing(true);
        try {
            let finalTrackUrl = metadata?.track_url || trackUrl;
            const finalTrackTitle = metadata?.track_title || trackTitle;

            // Check if track_url is a blob URL (indicating a local file)
            if (finalTrackUrl && finalTrackUrl.startsWith('blob:')) {
                if (metadata?.file) {
                    // Handled below or in stage
                }
            }

            // If amount is 0, submit directly (Free Guest)
            if (amount === 0) {
                const formData = new FormData();

                const items = [{
                    track_url: finalTrackUrl,
                    track_title: finalTrackTitle || "Untitled",
                    priority_value: 0,
                    sequence_order: 1,
                    artist: metadata?.artist,
                    genre: metadata?.genre
                }];

                const payload = {
                    submissions: items,
                    is_priority: false
                };

                formData.append('submissions_json', JSON.stringify(payload));
                formData.append('email', email);
                if (tiktokHandle) formData.append('tiktok_handle', tiktokHandle);

                if (metadata?.file) {
                    formData.append('files', metadata.file);
                }

                await api.post(`/reviewer/${reviewerId}/submit`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                toast.success("Submission sent! Check your email.");
                onSuccess();
                return;
            }

            // ... Paid Flow ...
            if (finalTrackUrl && finalTrackUrl.startsWith('blob:') && metadata?.file) {
                const formData = new FormData();
                formData.append('file', metadata.file);

                const uploadRes = await api.post('/uploads/stage', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                finalTrackUrl = uploadRes.data.url;
            }

            // Create PaymentIntent
            const paymentType = submissionId ? 'skip_line' : 'priority_request';
            const finalAmount = amount ? amount * 100 : 500;

            const { data } = await api.post('/stripe/create-payment-intent', {
                amount: finalAmount,
                currency: 'usd',
                email: email,
                tier: metadata?.tier || 'standard',
                track_url: finalTrackUrl,
                track_title: finalTrackTitle,
                artist: metadata?.artist,
                genre: metadata?.genre,
                tiktok_handle: tiktokHandle
            }, {
                params: {
                    reviewer_id: reviewerId,
                    payment_type: paymentType,
                    submission_id: submissionId
                }
            });

            setClientSecret(data.client_secret);
            setStep('payment');
        } catch (error: any) {
            console.error("Payment Intent Error:", error);
            toast.error(error.response?.data?.detail || "Failed to initialize payment");
        } finally {
            setIsInitializing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold mb-6">
                    {step === 'track_info' ? 'Track Details' : step === 'email' ? 'Contact Info' : 'Complete Payment'}
                </h2>

                {step === 'track_info' ? (
                    <form onSubmit={handleTrackSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Track Link (SoundCloud/Spotify)</label>
                            <input
                                type="url"
                                required
                                value={trackUrl}
                                onChange={(e) => setTrackUrl(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="https://soundcloud.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Track Title</label>
                            <input
                                type="text"
                                required
                                value={trackTitle}
                                onChange={(e) => setTrackTitle(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="My Awesome Track"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
                        >
                            Next
                        </button>
                    </form>
                ) : step === 'email' ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="name@example.com"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                We'll use this to link your submission. Use the same email if you sign up later!
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">TikTok Handle (Optional)</label>
                            <input
                                type="text"
                                value={tiktokHandle}
                                onChange={(e) => setTiktokHandle(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                placeholder="@username"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isInitializing}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {isInitializing ? "Loading..." : "Continue to Payment"}
                        </button>
                    </form>
                ) : (
                    clientSecret && (
                        <Elements options={{ clientSecret, appearance: { theme: 'night' } }} stripe={stripePromise}>
                            <CheckoutForm amount={amount || 5} onSuccess={onSuccess} metadata={metadata} />
                        </Elements>
                    )
                )}
            </div>
        </div>
    );
};

export default CheckoutModal;
