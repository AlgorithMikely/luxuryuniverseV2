import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount?: number; // Optional, defaults to 0 or calculated
    reviewerId: number;
    submissionId?: number; // For skipping line
    onSuccess: () => void;
    metadata?: any; // Extra data like track_url, track_title
}

const CheckoutForm = ({ amount, onSuccess, metadata, reviewerId }: { amount: number, onSuccess: () => void, metadata: any, reviewerId: number }) => {
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

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/payment-success`,
                },
                redirect: "if_required"
            });

            if (error) {
                setMessage(error.message || "An unexpected error occurred.");
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Verify with backend to ensure coins are added
                try {
                    await api.post('/stripe/verify-payment', {
                        payment_intent_id: paymentIntent.id,
                        reviewer_id: reviewerId
                    });
                    toast.success("Payment successful!");
                    onSuccess();
                } catch (verifyError) {
                    console.error("Verification failed:", verifyError);
                    setMessage("Payment succeeded but verification failed. Please contact support.");
                }
            } else {
                setMessage("Payment processing...");
            }
        } catch (err: any) {
            setMessage(err.message || "An unexpected error occurred.");
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
    const { user } = useAuthStore();
    const [clientSecret, setClientSecret] = useState("");
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
    const [email, setEmail] = useState("");
    const [tiktokHandle, setTiktokHandle] = useState("");
    const [trackUrl, setTrackUrl] = useState("");
    const [trackTitle, setTrackTitle] = useState("");
    const [artistName, setArtistName] = useState(""); // Add artist name state
    const [step, setStep] = useState<'track_info' | 'email' | 'payment'>('email');
    const [isInitializing, setIsInitializing] = useState(false);
    const [paypalConfig, setPaypalConfig] = useState<{ client_id: string, currency: string } | null>(null);

    // Initialize state based on metadata and user profile
    useEffect(() => {
        if (isOpen) {
            // Pre-fill email and other details if logged in
            if (user) {
                if (user.email) setEmail(user.email);
                if (user.tiktok_username) setTiktokHandle(user.tiktok_username);
            }

            // Initialize Artist Name
            // Priority 1: Metadata (from link scrape)
            // Priority 2: User Profile (from Settings)
            if (metadata?.artist) {
                setArtistName(metadata.artist);
            } else if (user?.artist_name) {
                setArtistName(user.artist_name);
            }

            // Initialize TikTok Handle with Fallback
            const userTiktok = user?.tiktok_username || user?.reviewer_profile?.tiktok_handle;
            if (userTiktok) {
                setTiktokHandle(userTiktok);
            }

            // Skip User Details Step if we have everything
            if (user?.email && userTiktok) {
                // If we also need track info
                if (!submissionId && !metadata?.track_url) {
                    setStep('track_info');
                } else {
                    setStep('payment');
                    // Initialize payment immediately if skipping to payment
                    if (amount && amount > 0) {
                        initializePayment(user.email, userTiktok);
                    }
                }
            } else {
                // Default logic
                if (!submissionId && !metadata?.track_url) {
                    setStep('track_info');
                } else {
                    setStep('email');
                }
            }

            // Fetch PayPal Config
            const fetchPayPalConfig = async () => {
                try {
                    const res = await api.get(`/paypal/config/${reviewerId}`);
                    setPaypalConfig(res.data);
                } catch (err) {
                    console.log("PayPal not enabled or error fetching config", err);
                    setPaypalConfig(null);
                }
            };
            fetchPayPalConfig();

        } else {
            setClientSecret("");
            setStep('email');
            if (!user?.email) setEmail(""); // Only clear if not logged in
            setTiktokHandle("");
            setTrackUrl("");
            setTrackTitle("");
            setPaypalConfig(null);
        }
    }, [isOpen, submissionId, metadata, reviewerId, user]);

    const handleTrackSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (trackUrl) {
            setStep('email');
        }
    };

    // Helper to initialize payment
    const initializePayment = async (targetEmail: string, targetTiktok: string) => {
        console.log("initializePayment called", { targetEmail, targetTiktok });
        setIsInitializing(true);
        try {
            let finalTrackUrl = metadata?.track_url || trackUrl;
            const finalTrackTitle = metadata?.track_title || trackTitle;

            // Check if track_url is a blob URL (indicating a local file)
            if (finalTrackUrl && finalTrackUrl.startsWith('blob:') && metadata?.file) {
                const formData = new FormData();
                formData.append('file', metadata.file);

                const uploadRes = await api.post('/uploads/stage', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                finalTrackUrl = uploadRes.data.url;
            }

            // Create PaymentIntent
            const finalPaymentType = metadata?.type || (submissionId ? 'skip_line' : 'priority_request');
            const finalAmount = amount ? Math.round(amount * 100) : 500; // Ensure integer cents

            const { data } = await api.post('/stripe/create-payment-intent', {
                amount: finalAmount,
                currency: 'usd',
                email: targetEmail,
                tier: metadata?.tier || 'standard',
                track_url: finalTrackUrl,
                track_title: finalTrackTitle,
                artist: artistName || metadata?.artist,
                genre: metadata?.genre,
                tiktok_handle: targetTiktok
            }, {
                params: {
                    reviewer_id: reviewerId,
                    payment_type: finalPaymentType,
                    submission_id: submissionId
                }
            });

            console.log("Stripe Payment Intent Created:", data);
            setClientSecret(data.client_secret);

            if (data.stripe_account_id) {
                console.log("Loading Stripe with Account ID:", data.stripe_account_id);
                setStripePromise(loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "", {
                    stripeAccount: data.stripe_account_id
                }));
            } else {
                console.log("Loading Stripe with Platform Account");
                setStripePromise(loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""));
            }
        } catch (error: any) {
            console.error("Payment Init Error:", error);
            toast.error(error.response?.data?.detail || "Failed to initialize payment");
        } finally {
            setIsInitializing(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        // If amount is 0, submit directly (Free Guest)
        if (amount === 0) {
            setIsInitializing(true);
            try {
                let finalTrackUrl = metadata?.track_url || trackUrl;
                const finalTrackTitle = metadata?.track_title || trackTitle;

                const formData = new FormData();
                const items = [{
                    track_url: finalTrackUrl,
                    track_title: finalTrackTitle || "Untitled",
                    priority_value: 0,
                    sequence_order: 1,
                    artist: artistName || metadata?.artist,
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
            } catch (err) {
                console.error("Submission Error:", err);
                toast.error("Failed to submit");
            } finally {
                setIsInitializing(false);
            }
            return;
        }

        // Initialize Payment for Paid Flow
        setStep('payment');
        await initializePayment(email, tiktokHandle);
    };

    console.log("CheckoutModal rendering. isOpen:", isOpen, "Step:", step);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="name@example.com"
                                disabled={!!user?.email}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                We'll use this to link your submission. Use the same email if you sign up later!
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">TikTok Handle</label>
                            <input
                                type="text"
                                required
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
                    <div className="space-y-6">
                        {isInitializing && (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            </div>
                        )}

                        {!isInitializing && !clientSecret && !paypalConfig && (
                            <div className="text-center text-red-400 py-4">
                                Unable to load payment methods. Please try again.
                            </div>
                        )}

                        {/* Stripe Payment */}
                        {clientSecret && stripePromise && (
                            <div className="border-b border-gray-700 pb-6 mb-6">
                                <h3 className="text-sm font-medium text-gray-400 mb-4">Pay with Card</h3>
                                <Elements options={{ clientSecret, appearance: { theme: 'night' } }} stripe={stripePromise}>
                                    <CheckoutForm amount={amount || 5} onSuccess={onSuccess} metadata={metadata} reviewerId={reviewerId} />
                                </Elements>
                            </div>
                        )}

                        {/* PayPal Payment */}
                        {paypalConfig && (
                            <div className="pt-2">
                                <h3 className="text-sm font-medium text-gray-400 mb-4">Pay with PayPal</h3>
                                <PayPalScriptProvider options={{
                                    clientId: paypalConfig.client_id,
                                    currency: "USD",
                                    intent: "capture"
                                }}>
                                    <PayPalButtons
                                        style={{ layout: "vertical", color: "blue", shape: "rect", label: "pay" }}
                                        createOrder={async (data, actions) => {
                                            try {
                                                const res = await api.post('/paypal/create-order', {
                                                    amount: (amount || 5) * 100, // Cents
                                                    currency: 'usd',
                                                    email: email,
                                                    tier: metadata?.tier || 'standard',
                                                    track_url: metadata?.track_url || trackUrl,
                                                    track_title: metadata?.track_title || trackTitle,
                                                    artist: artistName || metadata?.artist, // Use state or fallback
                                                    genre: metadata?.genre,
                                                    tiktok_handle: tiktokHandle
                                                }, {
                                                    params: {
                                                        reviewer_id: reviewerId,
                                                        payment_type: submissionId ? 'skip_line' : 'priority_request',
                                                        submission_id: submissionId
                                                    }
                                                });
                                                return res.data.order_id;
                                            } catch (err: any) {
                                                console.error("PayPal Create Order Error:", err);
                                                toast.error("Failed to start PayPal payment");
                                                throw err;
                                            }
                                        }}
                                        onApprove={async (data, actions) => {
                                            try {
                                                const res = await api.post('/paypal/capture-order', {
                                                    order_id: data.orderID,
                                                    email: email,
                                                    track_url: metadata?.track_url || trackUrl,
                                                    track_title: metadata?.track_title || trackTitle
                                                }, {
                                                    params: {
                                                        reviewer_id: reviewerId,
                                                        payment_type: submissionId ? 'skip_line' : 'priority_request',
                                                        submission_id: submissionId
                                                    }
                                                });

                                                if (res.data.status === 'COMPLETED') {
                                                    toast.success("Payment successful!");
                                                    onSuccess();
                                                }
                                            } catch (err: any) {
                                                console.error("PayPal Capture Error:", err);
                                                toast.error("Failed to complete PayPal payment");
                                            }
                                        }}
                                    />
                                </PayPalScriptProvider>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutModal;
