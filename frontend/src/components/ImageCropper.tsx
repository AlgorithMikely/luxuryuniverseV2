import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';
import getCroppedImg from '../utils/cropImage';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
    imageSrc: string;
    aspectRatio: number; // 1 for avatar, 16/9 for banner?
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, aspectRatio, onCropComplete, onCancel }) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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
        if (croppedAreaPixels) {
            try {
                const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
                if (croppedImage) {
                    onCropComplete(croppedImage);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Adjust Image</h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white">
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
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 rounded-lg font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors flex items-center space-x-2"
                        >
                            <Check size={18} />
                            <span>Apply Crop</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
