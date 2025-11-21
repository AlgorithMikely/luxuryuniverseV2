import React, { useState, useEffect } from 'react';
import { X, CreditCard, Check, ArrowLeft } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../services/api';
import toast from 'react-hot-toast';

// Replace with your actual publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface TopUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    reviewerId?: number;
}

const CheckoutForm = ({ amount, onSuccess, reviewerId }: { amount: number, onSuccess: () => void, reviewerId?: number }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        try {
            // Confirm Payment
            const result = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.href,
                },
                redirect: 'if_required',
            });

            if (result.error) {
                toast.error(result.error.message || 'Payment failed');
            } else {
                if (result.paymentIntent.status === 'succeeded') {
                    // Manual verification for localhost
                    try {
                        await api.post('/stripe/verify-payment', {
                            payment_intent_id: result.paymentIntent.id,
                            reviewer_id: reviewerId || 1
                        });
                        toast.success('Payment successful!');
                        onSuccess();
                    } catch (verifyError) {
                        console.error("Verification failed", verifyError);
                        toast.error("Payment succeeded but verification failed. Please contact support.");
                    }
                }
            }
        } catch (error) {
            console.error('Payment error:', error);
            toast.error('An error occurred during payment.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <PaymentElement
                    options={{
                        layout: 'tabs'
                    }}
                />
            </div>
            <button
                type="submit"
                disabled={!stripe || isProcessing}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
                {isProcessing ? 'Processing...' : `Pay $${amount}`}
            </button>
        </form>
    );
};

const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, onSuccess, reviewerId }) => {
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [dynamicStripePromise, setDynamicStripePromise] = useState<Promise<any> | null>(null);
    const amounts = [5, 10, 20, 50, 100];

    useEffect(() => {
        if (selectedAmount) {
            const fetchPaymentIntent = async () => {
                try {
                    // Use the stripe endpoint which handles connected accounts correctly
                    // We need a reviewerId. If not passed, we default to 1 for now.
                    const targetReviewerId = reviewerId || 1;

                    const { data } = await api.post<{ client_secret: string, stripe_account_id?: string }>(`/stripe/create-payment-intent?reviewer_id=${targetReviewerId}&payment_type=wallet_topup`, {
                        amount: selectedAmount * 100, // Convert to cents
                        currency: 'usd',
                    });
                    setClientSecret(data.client_secret);

                    if (data.stripe_account_id) {
                        setDynamicStripePromise(loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY, {
                            stripeAccount: data.stripe_account_id
                        }));
                    } else {
                        setDynamicStripePromise(stripePromise);
                    }

                } catch (error) {
                    console.error('Failed to create payment intent:', error);
                    toast.error('Failed to initialize payment');
                    setClientSecret(null);
                    setDynamicStripePromise(null);
                }
            };
            fetchPaymentIntent();
        } else {
            setClientSecret(null);
            setDynamicStripePromise(null);
        }
    }, [selectedAmount, reviewerId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <CreditCard className="w-5 h-5 mr-2 text-purple-400" />
                        Top Up Wallet
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {!selectedAmount ? (
                        <div className="grid grid-cols-2 gap-4">
                            {amounts.map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => setSelectedAmount(amount)}
                                    className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500 rounded-xl transition-all group"
                                >
                                    <span className="text-2xl font-bold text-white group-hover:text-purple-400">${amount}</span>
                                    <span className="text-sm text-gray-400">{amount * 100} Coins</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <button
                                onClick={() => setSelectedAmount(null)}
                                className="mb-4 text-sm text-gray-400 hover:text-white flex items-center"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" /> Back to amounts
                            </button>
                            <div className="mb-6 text-center">
                                <p className="text-gray-400 text-sm">Top up amount</p>
                                <p className="text-3xl font-bold text-white">${selectedAmount}</p>
                            </div>

                            {clientSecret && dynamicStripePromise ? (
                                <Elements
                                    stripe={dynamicStripePromise}
                                    options={{
                                        clientSecret,
                                        appearance: {
                                            theme: 'night',
                                            variables: {
                                                colorPrimary: '#9333ea', // Purple-600
                                                colorBackground: '#1f2937', // Gray-800
                                                colorText: '#ffffff',
                                                colorDanger: '#ef4444',
                                                fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
                                            }
                                        }
                                    }}
                                >
                                    <CheckoutForm
                                        amount={selectedAmount}
                                        reviewerId={reviewerId}
                                        onSuccess={() => {
                                            onSuccess();
                                            onClose();
                                        }}
                                    />
                                </Elements>
                            ) : (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopUpModal;
