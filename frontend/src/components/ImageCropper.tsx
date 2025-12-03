import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';
import getCroppedImg from '../utils/cropImage';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
    imageSrc: string;
    aspectRatio: number; // 1 for avatar, 16/9 for banner?
    onCropComplete: (croppedBlob: Blob) => Promise<void> | void;
    onCancel: () => void;
    isLoading?: boolean;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, aspectRatio, onCropComplete, onCancel, isLoading = false }) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = (crop: Point) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (croppedAreaPixels && !isLoading && !isProcessing) {
            setIsProcessing(true);
            try {
                const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
                if (croppedImage) {
                    await onCropComplete(croppedImage);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const showLoading = isLoading || isProcessing;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Adjust Image</h3>
                    <button onClick={onCancel} disabled={showLoading} className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        <X size={24} />
                    </button>
                </div>

                <div className="relative flex-1 bg-black">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={onZoomChange}
                    />
                    {showLoading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-white font-medium">Processing...</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-900 border-t border-gray-800 space-y-4">
                    <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-400">Zoom</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            disabled={showLoading}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={showLoading}
                            className="px-4 py-2 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={showLoading}
                            className="px-6 py-2 rounded-lg font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {showLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Check size={18} />
                                    <span>Apply Crop</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
