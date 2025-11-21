import React, { useState, useEffect } from 'react';
import { X, CreditCard, Lock, Zap } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import api from '../services/api';

// Initialize Stripe with your Publishable Key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    reviewerId: number;
    submissionId?: number;
    onSuccess: () => void;
}

const CheckoutForm: React.FC<{ amount: number; reviewerId: number; onSuccess: () => void; onClose: () => void }> = ({ amount, reviewerId, onSuccess, onClose }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setProcessing(true);

        const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href,
            },
            redirect: 'if_required',
        });

        if (result.error) {
            setError(result.error.message || 'Payment failed');
            setProcessing(false);
        } else {
            if (result.paymentIntent.status === 'succeeded') {
                try {
                    // Manually verify payment to trigger queue update immediately
                    await api.post('/stripe/verify-payment', {
                        payment_intent_id: result.paymentIntent.id,
                        reviewer_id: reviewerId
                    });
                } catch (e) {
                    console.error("Verification failed", e);
                }
                onSuccess();
                onClose();
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <PaymentElement
                    options={{
                        layout: 'tabs'
                    }}
                />
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-800">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || processing}
                className={`w-full py-3 px-4 rounded-lg text-white font-bold flex items-center justify-center gap-2 transition-all
          ${processing
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-[#635BFF] hover:bg-[#534be0] shadow-lg hover:shadow-indigo-500/30'}`}
            >
                {processing ? (
                    <span className="animate-pulse">Processing...</span>
                ) : (
                    <>
                        <Lock size={16} /> Pay ${(amount / 100).toFixed(2)}
                    </>
                )}
            </button>

            <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                <Lock size={10} /> Payments secured by Stripe
            </p>
        </form>
    );
};

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, reviewerId, submissionId, onSuccess }) => {
    const [clientSecret, setClientSecret] = useState('');
    const [dynamicStripePromise, setDynamicStripePromise] = useState<Promise<any> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tiers, setTiers] = useState<number[]>([]);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [loadingTiers, setLoadingTiers] = useState(false);

    // Fetch active session tiers when modal opens
    useEffect(() => {
        if (isOpen && reviewerId) {
            setLoadingTiers(true);
            api.get('/sessions/active', { params: { reviewer_id: reviewerId } })
                .then(res => {
                    // Filter out 0 or null values, ensure they are numbers
                    const validTiers = (res.data.open_queue_tiers || [])
                        .filter((t: any) => typeof t === 'number' && t > 0)
                        .sort((a: number, b: number) => a - b);

                    setTiers(validTiers);
                })
                .catch(err => {
                    console.error("Failed to fetch session tiers", err);
                    setError("Could not load skip line options. Please try again.");
                })
                .finally(() => setLoadingTiers(false));
        }
    }, [isOpen, reviewerId]);

    // Create PaymentIntent when amount is selected
    useEffect(() => {
        if (isOpen && selectedAmount && selectedAmount > 0) {
            // Convert dollar amount to cents for Stripe
            const amountInCents = selectedAmount * 100;

            api.post('/stripe/create-payment-intent', { amount: amountInCents, currency: 'usd' }, { params: { reviewer_id: reviewerId, submission_id: submissionId } })
                .then(res => {
                    setClientSecret(res.data.client_secret);

                    if (res.data.stripe_account_id) {
                        setDynamicStripePromise(loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY, {
                            stripeAccount: res.data.stripe_account_id
                        }));
                    } else {
                        setDynamicStripePromise(stripePromise);
                    }
                    setError(null);
                })
                .catch(err => {
                    console.error("Failed to create payment intent", err);
                    setError("Failed to initialize payment. Please try again.");
                });
        } else {
            setClientSecret('');
            setDynamicStripePromise(null);
        }
    }, [isOpen, selectedAmount, reviewerId, submissionId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <CreditCard className="text-purple-400" /> Skip The Line
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {loadingTiers ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        </div>
                    ) : error && !clientSecret ? (
                        <div className="text-red-400 text-center mb-4 bg-red-900/20 p-4 rounded-lg border border-red-800">
                            {error}
                        </div>
                    ) : (
                        <>
                            {!clientSecret && (
                                <div className="mb-6">
                                    <p className="text-gray-300 mb-4 text-center">Select a priority tier to skip the line:</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {tiers.map((tier) => (
                                            <button
                                                key={tier}
                                                onClick={() => setSelectedAmount(tier)}
                                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2
                                                    ${selectedAmount === tier
                                                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                                        : 'bg-gray-700/30 border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-700/50'
                                                    }`}
                                            >
                                                <Zap size={24} className={selectedAmount === tier ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'} />
                                                <span className="text-xl font-bold">${tier}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {tiers.length === 0 && !error && (
                                        <p className="text-center text-gray-500 italic">No skip options available.</p>
                                    )}
                                </div>
                            )}

                            {clientSecret && dynamicStripePromise && selectedAmount && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="flex items-center justify-between mb-4 p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                                        <span className="text-gray-300">Selected Tier:</span>
                                        <span className="text-xl font-bold text-white">${selectedAmount.toFixed(2)}</span>
                                        <button
                                            onClick={() => {
                                                setClientSecret('');
                                                setSelectedAmount(null);
                                            }}
                                            className="text-xs text-purple-400 hover:text-purple-300 underline"
                                        >
                                            Change
                                        </button>
                                    </div>

                                    <Elements
                                        stripe={dynamicStripePromise}
                                        options={{
                                            clientSecret,
                                            appearance: {
                                                theme: 'night',
                                                variables: {
                                                    colorPrimary: '#635BFF',
                                                    colorBackground: '#374151',
                                                    colorText: '#ffffff',
                                                    colorDanger: '#fa755a',
                                                    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
                                                }
                                            }
                                        }}
                                    >
                                        <CheckoutForm amount={selectedAmount * 100} reviewerId={reviewerId} onSuccess={onSuccess} onClose={onClose} />
                                    </Elements>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
