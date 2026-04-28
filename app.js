import { client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.js";

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const bgUpload = document.getElementById('bg-upload');
    const topUpload = document.getElementById('top-upload');
    const bottomUpload = document.getElementById('bottom-upload');
    
    const userPhotoDisplay = document.getElementById('user-photo-display');
    const emptyMsg = document.getElementById('empty-msg');
    const aiTryOnBtn = document.getElementById('ai-tryon-btn');
    const aiLoader = document.getElementById('ai-loader');
    const resetBtn = document.getElementById('reset-btn');

    const selectionPreview = document.getElementById('selection-preview');
    const topPreviewBox = document.getElementById('top-preview-box');
    const topPreviewImg = document.getElementById('top-preview-img');
    const bottomPreviewBox = document.getElementById('bottom-preview-box');
    const bottomPreviewImg = document.getElementById('bottom-preview-img');

    // Camera UI Elements
    const cameraOpenBtn = document.getElementById('camera-open-btn');
    const cameraTopBtn = document.getElementById('camera-top-btn');
    const cameraBottomBtn = document.getElementById('camera-bottom-btn');
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const cameraCaptureBtn = document.getElementById('camera-capture-btn');
    const cameraCloseBtn = document.getElementById('camera-close-btn');
    const cameraFlipBtn = document.getElementById('camera-flip-btn');

    // Data Store
    let humanData = null; 
    let topData = null; 
    let bottomData = null;

    // 1. Human Photo Upload (Album)
    bgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            humanData = file;
            const url = URL.createObjectURL(file);
            userPhotoDisplay.src = url;
            userPhotoDisplay.onload = () => {
                userPhotoDisplay.style.display = 'block';
                emptyMsg.style.display = 'none';
            };
        }
    });

    // 1-1. Camera Functionality
    let stream = null;
    let currentCameraTarget = 'human'; 
    let currentFacingMode = 'user'; 

    const startStream = async () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            cameraVideo.srcObject = stream;
            cameraVideo.onloadedmetadata = () => cameraVideo.play();
            cameraVideo.style.transform = (currentFacingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
        } catch (err) {
            alert('카메라 시작 실패: ' + err.message);
        }
    };

    const openCamera = async (target) => {
        currentCameraTarget = target;
        currentFacingMode = (target === 'human') ? 'user' : 'environment';
        cameraModal.style.display = 'flex';
        await startStream();
    };

    cameraOpenBtn.addEventListener('click', () => openCamera('human'));
    if (cameraTopBtn) cameraTopBtn.addEventListener('click', () => openCamera('top'));
    if (cameraBottomBtn) cameraBottomBtn.addEventListener('click', () => openCamera('bottom'));

    cameraFlipBtn.addEventListener('click', async () => {
        currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
        await startStream();
    });

    const closeCamera = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        cameraModal.style.display = 'none';
    };

    cameraCloseBtn.addEventListener('click', closeCamera);

    cameraCaptureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (currentFacingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(cameraVideo, 0, 0);
        
        canvas.toBlob((blob) => {
            if (currentCameraTarget === 'human') {
                humanData = blob;
                userPhotoDisplay.src = URL.createObjectURL(blob);
                userPhotoDisplay.style.display = 'block';
                emptyMsg.style.display = 'none';
            } else {
                addGarmentToGrid(blob, currentCameraTarget);
            }
            closeCamera();
        }, 'image/jpeg', 0.9);
    });

    // 2. Garment Selection & List Management
    const selectGarment = (srcOrFile, category) => {
        selectionPreview.style.display = 'block';
        const url = (typeof srcOrFile === 'string') ? srcOrFile : URL.createObjectURL(srcOrFile);
        
        if (category === 'top') {
            topData = srcOrFile;
            topPreviewImg.src = url;
            topPreviewBox.style.display = 'block';
        } else {
            bottomData = srcOrFile;
            bottomPreviewImg.src = url;
            bottomPreviewBox.style.display = 'block';
        }
    };

    const addGarmentToGrid = (srcOrFile, category) => {
        const grid = document.getElementById(`${category}-grid`);
        const url = (typeof srcOrFile === 'string') ? srcOrFile : URL.createObjectURL(srcOrFile);
        
        const newCard = document.createElement('div');
        newCard.className = 'item-card';
        newCard.innerHTML = `<img src="${url}" alt="Custom Item">`;
        newCard.style.border = '2px solid transparent';
        
        newCard.addEventListener('click', () => {
            selectGarment(srcOrFile, category);
            grid.querySelectorAll('.item-card').forEach(c => c.style.borderColor = 'transparent');
            newCard.style.borderColor = 'var(--accent)';
        });
        
        grid.appendChild(newCard);
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    document.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            const img = card.dataset.img;
            selectGarment(img, category);
            const grid = card.parentElement;
            grid.querySelectorAll('.item-card').forEach(c => c.style.borderColor = 'transparent');
            card.style.borderColor = 'var(--accent)';
        });
    });

    topUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) addGarmentToGrid(file, 'top');
    });

    bottomUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) addGarmentToGrid(file, 'bottom');
    });

    // 3. Sequential AI Try-On Logic
    aiTryOnBtn.addEventListener('click', async () => {
        if (!humanData || (!topData && !bottomData)) {
            alert('사진과 의상을 모두 선택해 주세요!');
            return;
        }

        aiLoader.style.display = 'flex';
        const loaderText = aiLoader.querySelector('p');
        
        try {
            const app = await client("yisol/IDM-VTON");
            let currentImage = humanData;

            if (topData) {
                loaderText.innerHTML = "상의 피팅 중...";
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(topData),
                    "High quality top garment", true, false, 30, 42
                ]);
                if (res.data && res.data[0].url) {
                    currentImage = res.data[0].url;
                    userPhotoDisplay.src = currentImage;
                }
            }

            if (bottomData) {
                loaderText.innerHTML = "하의 피팅 중...";
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(bottomData),
                    "High quality bottom garment", true, false, 30, 42
                ]);
                if (res.data && res.data[0].url) {
                    userPhotoDisplay.src = res.data[0].url;
                }
            }
        } catch (err) {
            alert('AI 피팅 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            aiLoader.style.display = 'none';
        }
    });

    resetBtn.addEventListener('click', () => location.reload());

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js');
        });
    }
});
